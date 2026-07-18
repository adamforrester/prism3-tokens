/**
 * Prism3 web dashboard (docs/08 §7 B3, docs/09).
 *
 * The FIRST rendering host over the engine core. It imports the SAME pure modules
 * the Figma plugin will (`theme`, `levers`, `preview`, `resolve-preview`, `color`,
 * `ramp`) and renders from the shared contracts:
 *   1. the theming knobs — from the lever manifest (`levers.ts`)
 *   2. a live component preview + per-mode contrast overlay — from `previewSpec`
 *      resolved through `resolvePreview(theme)`
 *   3. the generated palette ramps — straight off `brandTheme(input).palettes`
 *
 * The shell is a FOUR-STAGE build order (primitives → semantic → type → form),
 * mirroring how a theme actually composes: primitives first, then the semantic
 * roles that alias them, then type, then form. Stage 1 (Brand primitives) is the
 * bespoke redesign — a scalable brand-color list, a tunable neutral cast with a
 * Derive⇄Pin toggle (surfacing the engine's `neutral.anchor`), and the generated
 * ramps shown as labelled specimens. Later stages render their lever groups + the
 * live preview/overlay. Colour-axis edits re-resolve the engine and repaint only the
 * volatile region (ramps or preview), so knob focus is never lost; a failed brand
 * combination is caught and surfaced with the last-good render preserved.
 */
import { brandTheme, ALL_MODES } from '../../Prism3/engine/theme';
import type { BrandInput, Theme } from '../../Prism3/engine/theme';
import { hex, oklchToRgb, hexToRgb, rgbToOklch } from '../../Prism3/engine/color';
import { autoPlaceStep } from '../../Prism3/engine/ramp';
import { leverManifest, leverGroups } from '../../Prism3/engine/levers';
import type { Lever } from '../../Prism3/engine/levers';
import { previewSpec } from '../../Prism3/engine/preview';
import { resolvePreview } from '../../Prism3/engine/resolve-preview';
import type { ResolvedPreview } from '../../Prism3/engine/resolve-preview';
import { resolveAllModes } from '../../Prism3/engine/modes';
import { parseDesignMd, toDesignMd } from '../../Prism3/engine/design-md';
import { buildTree } from '../../Prism3/engine/tree';
import { makeWriteHost, hostCommit, cssVarName, typeVar } from './write-adapter';
import { persistInput, restoreInput } from './persist-local';
import exampleBrands from '../../Prism3/schema/example-brands.json';

type Mode = ResolvedPreview['modes'][number];

// Boot from a VALIDATED example brand — the emitted schema/example-brands.json (a
// test.ts gate asserts every brand there resolves all-green on the preview
// contracts). aurora: indigo anchor, action DECOUPLED onto an azure accent, tinted
// page. brandState is the mutable working copy the inputs edit.
const BRANDS = exampleBrands as Record<string, BrandInput>;
// Web persists the working brand to localStorage; the plugin uses Figma shared-data instead (restored
// via the host `restore-input` message below). `PRISM3_HOST` is a build-time define (`'figma'` in the
// plugin), so this guard is `'figma' !== 'figma'` → the localStorage path is INERT in the plugin —
// never executed — exactly as the web export-bar commit path is inert in the plugin bundle. On web
// boot, reopen on the persisted brand if one is stored AND still resolves; otherwise it's a first run —
// `firstRun` gates the start screen (below), and brandState still holds the demo so the app is in a
// valid state behind it. (Web only: the plugin never sets firstRun — it seeds via the host restore-input
// message; a plugin fresh-file start moment is a later cross-lane follow-up.)
let firstRun = false;
const bootBrand = (): BrandInput => {
  if (PRISM3_HOST !== 'figma') {
    const restored = restoreInput(localStorage);
    // Validate the SHAPE (brandTheme must accept it) before booting on it — a stale blob from an older
    // build could deserialise past the version guard yet fail to resolve; on reject, fall back to the demo.
    if (restored) { try { brandTheme(restored); return restored; } catch { /* stale/incompatible — fall through */ } }
    firstRun = true;   // web, nothing valid stored → show the start screen instead of the silent demo
  }
  return structuredClone(BRANDS.aurora);
};
let brandState: BrandInput = bootBrand();

// A minimal, known-good starting point for "New brand": one mid-indigo primary + a
// derived neutral, action defaults to primary, namespace at the 'prism' placeholder.
const NEW_BRAND = (): BrandInput => ({
  id: 'untitled', root: 'prism',
  modes: ['light'],                               // most brands ship light only (docs/11 Pillar 1)
  primary: { l: 0.55, c: 0.15, h: 262 },
  neutral: { hue: 262, chroma: 0.006 },
});
const ROOT_RE = /^[a-z][a-z0-9-]*$/;

// Every ATOMIC control is live — it edits brandState and re-runs the engine on change.
// Liveness is by control TYPE, not a per-key allowlist: sliders, enums, palette-refs, and
// toggles all have real handlers (a bad value just surfaces the error bar, never crashes —
// rebuild() is try/caught). Object/list levers (families, surfaces, brand colors) stay
// read-only until their bespoke editors land (#97). Not every live axis is mirrored in the
// shared preview yet (density/motion/shadow need specimens, #99) — but the control works.
const LIVE_CONTROLS = new Set(['slider', 'enum', 'palette-ref', 'toggle']);

const MODE_LABEL: Record<string, string> = { light: 'Light', dark: 'Dark', 'hc-light': 'HC light', 'hc-dark': 'HC dark', wireframe: 'Wireframe' };

// ---- stages ----------------------------------------------------------------
const STAGES = [
  { key: 'primitives', title: 'Brand primitives', sub: 'Hues & neutrals → ramps' },
  { key: 'semantic', title: 'Semantic colors', sub: 'Roles, action palette, states' },
  { key: 'type', title: 'Typography', sub: 'Families, weights → type scale' },
  { key: 'form', title: 'Form factor', sub: 'Density, radius, elevation' },
] as const;
type StageKey = (typeof STAGES)[number]['key'];
let stage: StageKey = 'primitives';

// Which lever keys belong to which stage (the manifest groups everything under a few
// axes; the stages slice it by intent). Stage 1's color primitives get a bespoke UI,
// so they're excluded from the generic knob render here.
const PRIMITIVE_KEYS = new Set(['primary', 'neutral.hue', 'neutral.chroma', 'neutral.anchor', 'brandColors']);
const stageOfLever = (l: Lever): StageKey => {
  if (l.group === 'type') return 'type';
  if (l.group === 'form' || l.group === 'elevation' || l.group === 'layout' || l.group === 'motion') return 'form';
  return 'semantic'; // remaining color levers: action palette, status, disabled, icon, gradients
};

// ---- engine read-model -----------------------------------------------------
let theme: Theme = brandTheme(brandState);
// The last input that resolved cleanly — the ramps + anchor badges render from THIS, so when a
// live edit fails (lastError set) the flagged anchor swatch still matches the shown ramp (M-16).
let lastGoodInput: BrandInput = structuredClone(brandState);
let rp: ResolvedPreview = resolvePreview(theme);
let currentMode: Mode = rp.modes[0];
let lastError: string | null = null;

const getPath = (o: any, p: string): any => p.split('.').reduce((a, k) => (a == null ? undefined : a[k]), o);
const setPath = (o: any, p: string, v: unknown): void => {
  const ks = p.split('.');
  const last = ks.pop()!;
  let cur = o;
  for (const k of ks) { if (cur[k] == null || typeof cur[k] !== 'object') cur[k] = {}; cur = cur[k]; }
  cur[last] = v;
};

/** Re-resolve from the current brandState. On failure keep the last-good theme/rp and
 *  record the message (the render stays coherent; the edit is what's flagged). */
const rebuild = (): void => {
  try {
    const t = brandTheme(brandState);
    rp = resolvePreview(t);
    theme = t;
    lastGoodInput = structuredClone(brandState);   // M-16: anchor badges read this, not the (maybe failing) live state
    lastError = null;
    if (PRISM3_HOST !== 'figma') persistInput(localStorage, brandState);   // persist the last-good brand (web only; inert in the plugin, best-effort)
  } catch (e) {
    lastError = (e as Error).message;
  }
};

// paint() repaints only the current stage's volatile region (ramps or preview) so
// input focus is never lost; applyFull() re-renders the whole workspace (structural
// edits — add/remove color, Derive⇄Pin, stage switch); build() re-renders the shell.
let paintVolatile: () => void = () => {};
const apply = (): void => { rebuild(); paintVolatile(); };
const applyFull = (): void => { rebuild(); renderWorkspace(); };

// ---- DOM helpers -----------------------------------------------------------
const el = (tag: string, cls?: string, text?: string): HTMLElement => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text !== undefined) n.textContent = text;
  return n;
};
const chunk = <T>(a: T[], n: number): T[][] => { const o: T[][] = []; for (let i = 0; i < a.length; i += n) o.push(a.slice(i, i + n)); return o; };
// Resolved-value lookups are for PRESENCE checks only (does this role resolve in this
// mode? — decides whether a chip paints a border, etc.). The VALUE a chip renders never
// comes from here: it's a `var(--…)` reference the active write host (write-adapter.ts,
// #106) fills in — so the UI stops writing resolved token values directly.
const hexOf = (binding: string | undefined, mode: Mode): string | undefined =>
  binding && binding.startsWith('color.') ? rp.colors[binding]?.[mode] : undefined;
/** The `var(--…)` a chip assigns for a color binding, with the resolved hex as fallback
 *  (so it's correct even before/without a host apply). */
const colorVar = (binding: string, mode: Mode): string => `var(${cssVarName(binding)}, ${hexOf(binding, mode) ?? 'transparent'})`;
const pageBg = (mode: Mode): string => `var(${cssVarName('color.background.primary')}, ${rp.colors['color.background.primary']?.[mode] ?? '#ffffff'})`;

// The active write host — projects the resolved model onto whatever backend this host
// owns (CSS vars on web; figma.variables in the plugin). Re-scoped per preview paint.
let writeHost = makeWriteHost(document.documentElement);

// The COMMIT host (docs/22 #110) — distinct from the preview: "materialise this theme".
// On web it's inert (the export bar downloads); in the Figma plugin it posts the BrandInput to
// the main thread (→ #108 applyWritePlan) and receives the #109 read-back seed summary on boot.
const commit = hostCommit();
let seedInfo: { ok: boolean; summary: string } | null = null;   // set by the host's boot read-back (#109)
// Host → UI notifications: the #109 read-back seed summary, and the #131 knob-rehydration (the
// persisted BrandInput). restore-input loads the brand wholesale (loadBrand rebuilds + re-renders),
// so re-opening a themed Figma file boots on that brand instead of the default. loadBrand is a
// const defined below — this callback only fires async (after ui-ready), so the ref is resolved.
commit.onHostMessage((m) => {
  if (m.kind === 'restore-input') {
    // The blob is public shared-data (any plugin can write it) — validate the SHAPE the same way
    // Import does (brandTheme must accept it) before loading. A versioned-but-malformed payload
    // (e.g. `{}`) that clears the persist envelope but has no `primary` would otherwise crash the
    // boot render (renderBar reads `brandState.primary`); on reject we silently keep defaults.
    try { brandTheme(m.input as BrandInput); } catch { return; }
    loadBrand(m.input as BrandInput);
    return;
  }
  seedInfo = { ok: m.ok, summary: m.summary };
  if (barHost) renderBar();
});

// ===========================================================================
// STAGE 1 — BRAND PRIMITIVES (bespoke)
// ===========================================================================

/** The per-palette pinned anchor step (null = derived, no anchor). */
const anchorStepFor = (palette: string): number | null => {
  // Read the LAST-GOOD input (M-16): the ramps paint from the last-good theme, so the anchor
  // badge must be computed from the same source — else a failing live edit flags the wrong swatch.
  if (palette === 'primary') return autoPlaceStep(lastGoodInput.primary.l);
  if (palette === 'neutral') return lastGoodInput.neutral.anchor ? autoPlaceStep(lastGoodInput.neutral.anchor.l) : null;
  const bc = (lastGoodInput.brandColors ?? []).find((b) => b.name === palette);
  return bc ? autoPlaceStep(bc.oklch.l) : null;
};

/** A labelled scale — 10 swatches per row, touching within a row, labels beneath. */
const rampEl = (name: string, steps: { num: number; key: string; hex: string }[], anchorStep: number | null, control?: HTMLElement): HTMLElement => {
  const wrap = el('section', 'ramp');
  const head = el('div', 'ramp-head');
  head.append(el('span', 'ramp-name', name));
  const right = el('div', 'ramp-head-right');
  const meta = el('span', 'ramp-anchor');
  const aKey = anchorStep != null ? steps.find((s) => s.num === anchorStep)?.key : undefined;
  // Built via el()/textContent, never innerHTML — `name` is a brand-controlled palette name
  // (pasted design.md / accent rename) and would otherwise be an XSS sink (CR-07).
  if (aKey) meta.append(document.createTextNode('anchor '), el('b', 'mono', `${name}/${aKey}`));
  else meta.append(el('span', 'faint', 'derived scale'));
  right.append(meta);
  // Status ramps carry an inline validation-color control (Auto / Custom hue / borrow a ramp).
  if (control) right.append(control);
  head.append(right);
  wrap.append(head);
  const sorted = [...steps].sort((a, b) => a.num - b.num);
  for (const rowSteps of chunk(sorted, 10)) {
    const band = el('div', 'band');
    const strip = el('div', 'strip');
    const labs = el('div', 'labs');
    for (const s of rowSteps) {
      const isAnchor = s.num === anchorStep;
      const sw = el('div', 'sw' + (isAnchor ? ' is-anchor' : ''));
      sw.style.background = s.hex;
      if (isAnchor) sw.append(el('span', 'flag', 'anchor'));
      strip.append(sw);
      const lab = el('div', 'lab');
      lab.append(el('span', 'lab-step mono' + (isAnchor ? ' on' : ''), s.key), el('span', 'lab-hex mono', s.hex));
      labs.append(lab);
    }
    band.append(strip, labs);
    wrap.append(band);
  }
  return wrap;
};

/** Ramps in reading order: brand palettes (primary + accents), then neutral, then
 *  the generated status palettes every semantic role will alias. */
const orderedPalettes = (): Theme['palettes'] => {
  const brand = theme.palettes.filter((p) => p.role === 'brand');
  const neutral = theme.palettes.filter((p) => p.palette === 'neutral');
  const status = theme.palettes.filter((p) => p.role !== 'brand' && p.palette !== 'neutral');
  return [...brand, ...neutral, ...status];
};

const paintRamps = (host: HTMLElement): void => {
  host.innerHTML = '';
  if (lastError) host.append(el('div', 'errbar', `This combination doesn't resolve: ${lastError} — showing the last valid palettes.`));
  const shown = new Set<string>();
  for (const p of orderedPalettes()) {
    const isStatus = (STATUS_ROLES as readonly string[]).includes(p.palette);
    if (isStatus) shown.add(p.palette);
    host.append(rampEl(p.palette, p.steps, anchorStepFor(p.palette), isStatus ? statusRampControl(p.palette as StatusRole) : undefined));
  }
  // A borrowed status role is PRUNED from the palette set (no own ramp), so surface a compact
  // reference row so its control stays reachable + shows what it's borrowing.
  for (const role of STATUS_ROLES)
    if (!shown.has(role) && brandState.roleColors?.[role]) host.append(borrowedStatusRow(role));
};

/** Brand colors — a scalable list. Primary is the pinned anchor (editable color, not
 *  removable); each accent is add / rename / remove and can drive the action palette. */
const renderBrandColors = (): HTMLElement => {
  const panel = el('div', 'panel');
  const list = brandState.brandColors ?? (brandState.brandColors = []);
  const head = el('div', 'panel-head');
  head.append(el('h2', undefined, 'Brand colors'));
  panel.append(head);
  const rows = el('div', 'clist');

  const colorRow = (getHex: () => string, setHex: (h: string) => void, nameEl: HTMLElement, removable: (() => void) | null): HTMLElement => {
    const row = el('div', 'crow');
    const picker = el('input', 'rsw') as HTMLInputElement;
    picker.type = 'color'; picker.value = getHex();
    const hexLab = el('span', 'mono rhex', picker.value);
    picker.oninput = () => { setHex(picker.value); hexLab.textContent = picker.value; apply(); };
    row.append(picker, nameEl, hexLab);
    if (removable) { const rm = el('button', 'rx', '×') as HTMLButtonElement; rm.title = 'Remove color'; rm.onclick = removable; row.append(rm); }
    return row;
  };

  // primary — editable color, fixed name, not removable
  const pName = el('span', 'rname', 'primary');
  rows.append(colorRow(
    () => hex(oklchToRgb(brandState.primary)),
    (h) => setPath(brandState, 'primary', rgbToOklch(hexToRgb(h))),
    pName, null,
  ));

  // accents
  list.forEach((bc, i) => {
    const name = el('input', 'nm mono') as HTMLInputElement;
    name.type = 'text'; name.value = bc.name; name.spellcheck = false;
    name.onchange = () => {
      const prev = bc.name, next = name.value.trim() || bc.name;
      bc.name = next;
      if (brandState.actionPalette === prev) brandState.actionPalette = next;
      applyFull();
    };
    rows.append(colorRow(
      () => hex(oklchToRgb(bc.oklch)),
      (h) => { bc.oklch = rgbToOklch(hexToRgb(h)); },
      name,
      () => { const removed = list[i].name; list.splice(i, 1); if (brandState.actionPalette === removed) brandState.actionPalette = 'primary'; applyFull(); },
    ));
  });
  panel.append(rows);

  const add = el('button', 'addbtn', '+ Add color') as HTMLButtonElement;
  add.onclick = () => {
    const names = new Set(list.map((b) => b.name));
    let n = list.length + 1, nm = `accent${n}`;
    while (names.has(nm)) nm = `accent${++n}`;
    list.push({ name: nm, oklch: { l: 0.55, c: 0.15, h: 235 } });
    applyFull();
  };
  panel.append(add);
  return panel;
};

/** Neutral cast — a Derive⇄Pin toggle. Derive: hue + chroma sliders. Pin: a color
 *  input that sets `neutral.anchor` (the engine builds the whole ramp around it). */
const renderNeutral = (): HTMLElement => {
  const panel = el('div', 'panel');
  const head = el('div', 'panel-head');
  head.append(el('h2', undefined, 'Neutral cast'));
  const seg = el('div', 'seg');
  const pinned = !!brandState.neutral.anchor;
  const bDerive = el('button', 'seg-b' + (pinned ? '' : ' on'), 'Derive') as HTMLButtonElement;
  const bPin = el('button', 'seg-b' + (pinned ? ' on' : ''), 'Pin') as HTMLButtonElement;
  bDerive.onclick = () => { if (brandState.neutral.anchor) { delete brandState.neutral.anchor; applyFull(); } };
  bPin.onclick = () => { if (!brandState.neutral.anchor) { brandState.neutral.anchor = { l: 0.5, c: Math.min(brandState.neutral.chroma, 0.02), h: brandState.neutral.hue }; applyFull(); } };
  seg.append(bDerive, bPin);
  head.append(seg);
  panel.replaceChildren(head);

  if (!pinned) {
    const slider = (key: string, label: string, min: number, max: number, step: number, unit: string, fmt: (v: number) => string) => {
      const wrap = el('div', 'slider');
      const top = el('div', 'slider-top');
      const val = el('span', 'mono val', fmt(getPath(brandState, key)));
      top.append(el('span', undefined, label), val);
      const input = el('input', 'range') as HTMLInputElement;
      input.type = 'range'; input.min = String(min); input.max = String(max); input.step = String(step);
      input.value = String(getPath(brandState, key));
      input.oninput = () => { setPath(brandState, key, Number(input.value)); val.textContent = fmt(Number(input.value)); apply(); };
      wrap.append(top, input);
      return wrap;
    };
    panel.append(slider('neutral.hue', 'Hue', 0, 360, 1, '°', (v) => `${Math.round(v)}°`));
    panel.append(slider('neutral.chroma', 'Chroma', 0, 0.03, 0.001, '', (v) => v.toFixed(3)));
    panel.append(el('p', 'np-note', 'Greys carry a trace of the brand hue for cohesion. Default derives from primary; nudge to taste.'));
  } else {
    const a = brandState.neutral.anchor!;
    const row = el('div', 'pin-row');
    const picker = el('input', 'rsw') as HTMLInputElement;
    picker.type = 'color'; picker.value = hex(oklchToRgb(a));
    const readout = el('div', 'pin-readout');
    const setReadout = () => { readout.innerHTML = `<span class="mono chip-hex">${picker.value}</span><span class="inp-meta mono">L ${a.l.toFixed(2)} · C ${a.c.toFixed(3)} · H ${Math.round(a.h)}°</span>`; };
    picker.oninput = () => { const o = rgbToOklch(hexToRgb(picker.value)); a.l = o.l; a.c = o.c; a.h = o.h; setReadout(); apply(); };
    setReadout();
    row.append(picker, readout);
    panel.append(row);
    panel.append(el('p', 'np-note', 'A pre-defined brand grey, pinned verbatim at its lightness step; the whole ramp is built around it.'));
  }
  return panel;
};

const renderPrimitives = (host: HTMLElement): void => {
  host.append(hero('Start from your brand colors.',
    'Give the engine your exact hues. It grows each into a gamut-aware, contrast-placed ramp and pins your color as the anchor — never shifted. Every semantic role downstream aliases these.'));
  const panels = el('div', 'panels');
  panels.append(renderBrandColors(), renderNeutral());
  host.append(panels);

  host.append(sectionHead('Palettes', 'The ramps every semantic role will alias.'));
  const ramps = el('div', 'ramps');
  host.append(ramps);
  paintVolatile = () => paintRamps(ramps);
  paintVolatile();
};

// ===========================================================================
// STAGES 2–4 — lever groups + live preview (generic)
// ===========================================================================

const renderControl = (lever: Lever): HTMLElement => {
  const live = LIVE_CONTROLS.has(lever.control);
  const wrap = el('div', 'knob');
  wrap.append(el('label', 'knob-label', lever.label));

  if (lever.control === 'slider') {
    const row = el('div', 'knob-body');
    const input = el('input') as HTMLInputElement;
    input.type = 'range';
    if (lever.min !== undefined) input.min = String(lever.min);
    if (lever.max !== undefined) input.max = String(lever.max);
    if (lever.step !== undefined) input.step = String(lever.step);
    input.value = String(getPath(brandState, lever.key) ?? lever.default ?? lever.min ?? 0);
    input.disabled = !live;
    const val = el('span', 'knob-val', `${input.value}${lever.unit ?? ''}`);
    if (live) input.oninput = () => { setPath(brandState, lever.key, Number(input.value)); val.textContent = `${input.value}${lever.unit ?? ''}`; apply(); };
    row.append(input, val);
    wrap.append(row);
  } else if (lever.control === 'palette-ref' && live) {
    const sel = el('select') as HTMLSelectElement;
    const palettes = ['primary', ...(brandState.brandColors ?? []).map((b) => b.name)];
    const cur = String(getPath(brandState, lever.key) ?? lever.default ?? 'primary');
    for (const p of palettes) { const opt = el('option') as HTMLOptionElement; opt.value = p; opt.textContent = p; if (p === cur) opt.selected = true; sel.append(opt); }
    sel.onchange = () => { setPath(brandState, lever.key, sel.value); apply(); };
    wrap.append(sel);
  } else if (lever.control === 'enum') {
    const sel = el('select') as HTMLSelectElement;
    const cur = getPath(brandState, lever.key) ?? lever.default;
    for (const o of lever.options ?? []) { const opt = el('option') as HTMLOptionElement; opt.value = String(o.value); opt.textContent = o.label; if (o.value === cur) opt.selected = true; sel.append(opt); }
    sel.disabled = !live;
    if (live) sel.onchange = () => { setPath(brandState, lever.key, sel.value); apply(); };
    wrap.append(sel);
  } else if (lever.control === 'toggle') {
    // Boolean axis. `checked` reads truthy — so `gradients` renders "on" whether it's `true`
    // or an explicit gradient array (the array is only reset if the user toggles off). Toggling
    // writes a plain boolean: on → the default (single gradient / inverse inks), off → false.
    const row = el('div', 'knob-body');
    const input = el('input') as HTMLInputElement;
    input.type = 'checkbox';
    input.className = 'toggle';
    input.checked = !!(getPath(brandState, lever.key) ?? lever.default);
    const val = el('span', 'knob-val', input.checked ? 'On' : 'Off');
    input.onchange = () => { setPath(brandState, lever.key, input.checked); val.textContent = input.checked ? 'On' : 'Off'; apply(); };
    row.append(input, val);
    wrap.append(row);
  } else {
    const v = getPath(brandState, lever.key) ?? lever.default;
    let text: string;
    if (Array.isArray(v)) text = v.map((it: any) => it?.name).filter(Boolean).join(', ') || `${v.length} item(s)`;
    else if (v && typeof v === 'object') text = 'configured';
    else text = String(v ?? lever.itemLabel ?? '—');
    wrap.append(el('div', 'knob-val ro', text));
  }
  wrap.append(el('p', 'knob-desc', lever.description));
  return wrap;
};

const renderChip = (label: string, bind: Record<string, string>, mode: Mode): HTMLElement => {
  // PRESENCE (resolved model) decides WHICH styles a chip paints; the VALUES are all
  // `var(--…)` refs the active write host fills in (#106). The resolved hex/px still ride
  // along as the `var()` fallback, so a chip is correct even if no host has applied yet.
  const fgBind = bind.text ?? bind.titleText ?? bind.bodyText;
  const chip = el('div', 'chip', label);
  if (hexOf(bind.bg, mode)) chip.style.background = colorVar(bind.bg, mode);
  if (fgBind && hexOf(fgBind, mode)) chip.style.color = colorVar(fgBind, mode);
  const border = bind.border && hexOf(bind.border, mode);
  chip.style.border = `2px solid ${border ? colorVar(bind.border, mode) : 'transparent'}`;
  // Geometry is per-mode now (wireframe zeroes radius): the host projects the effective
  // per-mode value onto the same var name, so the chip just references it.
  const dimPx = (ref: string): number => rp.dimOverrides[ref]?.[mode] ?? rp.dims[ref];
  if (bind.radius && rp.dims[bind.radius] != null) chip.style.borderRadius = `var(${cssVarName(bind.radius)}, ${dimPx(bind.radius)}px)`;
  const padVar = (ref: string): string => `var(${cssVarName(ref)}, ${dimPx(ref)}px)`;
  const pad = bind.pad ? padVar(bind.pad) : bind.padX && bind.padY ? `${padVar(bind.padY)} ${padVar(bind.padX)}` : '';
  if (pad) chip.style.padding = pad;
  const t = bind.type ? rp.type[bind.type] : undefined;
  if (t) {
    chip.style.fontFamily = typeVar(bind.type, 'family');
    chip.style.fontWeight = typeVar(bind.type, 'weight');
    // Visual cap stays inline (min(20px, …)) — the host var carries the true px, which the
    // label already reports; capping the var itself would misreport the resolved size.
    chip.style.fontSize = `min(20px, ${typeVar(bind.type, 'size')})`;
  }
  // Elevation: the resolved per-mode box-shadow, via the host var (dark = reduced). The
  // resolved string rides along as the var() fallback, so the shadow is correct even before
  // a host has applied — and the shadow-softness lever now shows up here live.
  const sh = bind.shadow ? rp.shadows[bind.shadow]?.[mode] : undefined;
  if (sh) chip.style.boxShadow = `var(${cssVarName(bind.shadow)}, ${sh})`;
  return chip;
};

const paintPreview = (host: HTMLElement): void => {
  host.innerHTML = '';
  if (lastError) host.append(el('div', 'errbar', `This combination doesn't resolve: ${lastError} — showing the last valid theme.`));

  const modes = el('div', 'modebar');
  modes.append(el('span', 'mb-cap', 'Preview mode'));
  for (const m of rp.modes) {
    const b = el('button', 'modebtn' + (m === currentMode ? ' on' : ''), MODE_LABEL[m] ?? m) as HTMLButtonElement;
    b.onclick = () => { currentMode = m; paintPreview(host); };
    modes.append(b);
  }
  host.append(modes);

  const surface = el('div', 'preview');
  // Project the resolved model for the active mode onto THIS surface (a fresh element each
  // paint — so a mode switch can't leak stale vars). Chips below inherit the properties and
  // reference them via `var(--…)`; swap `writeHost` and the same chips drive another backend.
  writeHost = makeWriteHost(surface);
  writeHost.apply(rp, currentMode);
  surface.style.background = pageBg(currentMode);
  for (const c of previewSpec.components) {
    const block = el('section', 'pvcomp');
    block.append(el('h4', undefined, c.label));
    const row = el('div', 'chips');
    for (const v of c.variants) row.append(renderChip(`${c.id} · ${v.name}`, v.bindings, currentMode));
    block.append(row);
    // #100: verification AT THE POINT OF EDIT — this component's contrast contracts for the
    // active mode as inline badges (we DERIVE + gate the ratio, so it's authoritative, not a
    // hand-typed number), plus token-path pills for the color roles it binds (dev transparency).
    const cts = rp.contracts.filter((ct) => ct.component === c.id && ct.byMode[currentMode]);
    if (cts.length) {
      const badges = el('div', 'pv-contrasts');
      for (const ct of cts) {
        const r = ct.byMode[currentMode]!;
        const b = el('span', `cbadge ${r.pass ? 'ok' : 'no'}`);
        b.append(el('span', 'cb-lab', ct.label ?? `min ${ct.min}:1`), el('span', 'cb-ratio', `${r.ratio.toFixed(2)}:1`), el('span', 'cb-mark', r.pass ? '✓' : '✗'));
        badges.append(b);
      }
      block.append(badges);
    }
    const roles = [...new Set(c.variants.flatMap((v) => Object.values(v.bindings).filter((t) => t.startsWith('color.')).map((t) => t.replace(/^color\./, ''))))];
    if (roles.length) {
      const pills = el('div', 'pv-paths');
      for (const rref of roles.slice(0, 6)) pills.append(el('span', 'tpill mono', rref));
      if (roles.length > 6) pills.append(el('span', 'tpill more', `+${roles.length - 6}`));
      block.append(pills);
    }
    surface.append(block);
  }
  host.append(surface);

  // The full all-modes table is verification-of-record, not point-of-edit feedback (the per-component
  // badges above already show the ACTIVE mode inline). It repeats on every stage, so it lives in a
  // closed disclosure — one click from the audit view, but no longer dominating each stage.
  const contracts = el('details', 'contracts') as HTMLDetailsElement;
  const sum = el('summary', 'contracts-sum');
  sum.append(el('span', 'contracts-t', 'Contrast contracts'), el('span', 'contracts-hint', `full a11y table · all modes · ${rp.contracts.length} pairs`));
  contracts.append(sum);
  contracts.append(el('p', 'np-note', 'Every declared a11y pair, computed on the resolved colors across all modes — the per-component badges above verify the active mode at the point of edit.'));
  const table = el('table', 'ctable');
  const thead = el('tr');
  thead.append(el('th', undefined, 'Pair'));
  for (const m of rp.modes) thead.append(el('th', 'mcol', MODE_LABEL[m] ?? m));
  table.append(thead);
  for (const ct of rp.contracts) {
    const tr = el('tr');
    tr.append(el('td', 'pair', `${ct.component} · ${ct.variant} — ${ct.label ?? `${ct.min}:1`}`));
    for (const m of rp.modes) {
      const cell = el('td', 'mcol');
      const r = ct.byMode[m];
      if (r) { cell.append(el('span', `dot ${r.pass ? 'ok' : 'no'}`), el('span', 'ratio', r.ratio.toFixed(2))); }
      else cell.textContent = '—';
      tr.append(cell);
    }
    table.append(tr);
  }
  contracts.append(table);
  host.append(contracts);
};

const HERO_COPY: Record<StageKey, [string, string]> = {
  primitives: ['', ''],
  semantic: ['Map roles onto your primitives.', 'Every semantic role aliases a primitive step, resolved per mode. Point actions at the palette that reads best, tune the interactive treatment (hover, inverse, neutral emphasis), and set the accessibility policy — icon contrast + the disabled strategy. (Status hues are edited per-ramp on Primitives.)'],
  type: ['Set the type system.', 'Families, weights, and the type scale that shifts the semantic→primitive size mapping. The rem ladder is brand-invariant; the scale is the dial.'],
  form: ['Dial in the form factor.', 'Density, corner radius, and elevation — the geometry that makes the same colors feel like a different product.'],
};

// Validation-color control (docs/21 + status.*). Lives INLINE on each status ramp (primitives
// stage), not as a standalone section: a designer edits the red/green/amber/blue right where the
// ramp is shown. Two mutually-exclusive engine mechanisms behind one dropdown —
//   • Custom hue → `status.<role>` seeds the ramp from a picked hue (the raw validation color)
//   • Use <ramp> → `roleColors.<role>` borrows a declared palette (a red brand's red for danger)
//   • Auto → clears both (engine default: a synthesised hue, or the danger-red carve)
// Contrast always re-gates on whatever it lands on; a hue mismatch is flagged in the theme notes.
// (A future "lock" gate to unlock editing is deferred.)
const STATUS_ROLES = ['success', 'warning', 'danger', 'info'] as const;
type StatusRole = typeof STATUS_ROLES[number];

/** Seed hex for the custom-hue picker: the current status ramp's mid step if present, else grey. */
const statusSeedHex = (role: string): string => {
  const cur = brandState.status?.[role as StatusRole];
  if (cur) return hex(oklchToRgb(cur));
  const pal = theme.palettes.find((p) => p.palette === role);
  return pal?.steps.find((s) => s.num === 500)?.hex ?? pal?.steps[Math.floor(pal.steps.length / 2)]?.hex ?? '#808080';
};

/** Write `status.<role>` from a hex (seeds hue + chroma), clearing any borrow (they're exclusive). */
const setStatusHue = (role: StatusRole, hexVal: string): void => {
  const rc = { ...(brandState.roleColors ?? {}) } as Record<string, string>; delete rc[role];
  const o = rgbToOklch(hexToRgb(hexVal));
  brandState.roleColors = (Object.keys(rc).length ? rc : undefined) as BrandInput['roleColors'];
  brandState.status = { ...(brandState.status ?? {}), [role]: { l: o.l, c: o.c, h: o.h, chroma: o.c } };
  apply();
};

/** The inline per-ramp control for one status role. */
const statusRampControl = (role: StatusRole): HTMLElement => {
  const wrap = el('div', 'ramp-ctl');
  const borrowed = brandState.roleColors?.[role];
  const custom = !borrowed && !!brandState.status?.[role];
  const borrowSources = ['primary', ...(brandState.brandColors ?? []).map((b) => b.name)];

  const sel = el('select', 'ramp-ctl-sel') as HTMLSelectElement;
  const mkOpt = (v: string, label: string, on: boolean) => { const o = el('option') as HTMLOptionElement; o.value = v; o.textContent = label; if (on) o.selected = true; sel.append(o); };
  mkOpt('auto', 'Auto', !borrowed && !custom);
  mkOpt('custom', 'Custom hue…', custom);
  for (const p of borrowSources) mkOpt('borrow:' + p, `Use ${p}`, borrowed === p);

  const picker = el('input', 'ramp-ctl-pick') as HTMLInputElement;
  picker.type = 'color';
  picker.title = `Seed the ${role} ramp from a hue`;
  picker.value = statusSeedHex(role);
  picker.style.display = custom ? '' : 'none';

  sel.onchange = () => {
    if (sel.value === 'custom') { setStatusHue(role, picker.value); return; }
    const rc = { ...(brandState.roleColors ?? {}) } as Record<string, string>; delete rc[role];
    const st = { ...(brandState.status ?? {}) } as Record<string, unknown>; delete st[role];
    if (sel.value.startsWith('borrow:')) rc[role] = sel.value.slice('borrow:'.length);
    brandState.roleColors = (Object.keys(rc).length ? rc : undefined) as BrandInput['roleColors'];
    brandState.status = (Object.keys(st).length ? st : undefined) as BrandInput['status'];
    apply();
  };
  // `change`, not `oninput`: this control lives in the volatile ramps region, so repainting mid-
  // drag would destroy the open OS color dialog. Change fires when the dialog closes — safe to repaint.
  picker.onchange = () => setStatusHue(role, picker.value);

  wrap.append(sel, picker);
  return wrap;
};

/** A borrowed status role has no own ramp (pruned) — a compact reference row keeps the control
 *  reachable and shows the borrowed ramp inline. */
const borrowedStatusRow = (role: StatusRole): HTMLElement => {
  const src = brandState.roleColors![role]!;
  const wrap = el('section', 'ramp ramp-borrowed');
  const head = el('div', 'ramp-head');
  head.append(el('span', 'ramp-name', role));
  const right = el('div', 'ramp-head-right');
  const meta = el('span', 'ramp-anchor');
  meta.append(document.createTextNode('borrowing '), el('b', 'mono', src));
  right.append(meta, statusRampControl(role));
  head.append(right);
  wrap.append(head);
  const pal = theme.palettes.find((p) => p.palette === src);
  if (pal) {
    const strip = el('div', 'strip strip-mini');
    for (const s of [...pal.steps].sort((a, b) => a.num - b.num)) { const sw = el('div', 'sw sw-mini'); sw.style.background = s.hex; strip.append(sw); }
    wrap.append(strip);
  }
  return wrap;
};

// The Semantic tab groups its 8 controls into intent sub-sections (design review §1) rather
// than one flat panel. `disabledMin` nests under `disabledStrategy` — it only bites when the
// strategy is 'accessible'. A trailing catch-all renders any ungrouped semantic lever so a
// future addition can't be silently dropped.
const SEMANTIC_GROUPS: Array<{ title: string; keys: string[] }> = [
  { title: 'Interactive color', keys: ['actionPalette', 'neutralEmphasis', 'outlineInteraction', 'inverse'] },
  { title: 'Accessibility policy', keys: ['iconContrast', 'disabledStrategy', 'disabledMin'] },
  { title: 'Features', keys: ['gradients'] },
];
const NESTED_KEYS = new Set(['disabledMin']);
const subHead = (title: string): HTMLElement => { const s = el('div', 'sub-lab'); s.append(el('h3', 'sub-t', title)); return s; };

/** #161 — the interactive-color card (owner reference): the primary interactive column shown as a big
 *  fill swatch + a palette/step picker + its token path + a live button example + the derived contrast,
 *  with hover/pressed as sub-cards. The fill anchors on a palette STEP (auto by default; the step select
 *  writes `actionAnchorStep`, the #163 override); on-fill / hover / pressed are engine-derived. Reads the
 *  resolved roles for the active mode (Kind-B, like the other semantic specimens). */
const stepKeyOf = (path: string | undefined): string => (path ? path.split('.').pop()! : '');
const renderInteractivePrimaryCard = (): HTMLElement => {
  const wrap = el('div', 'ic-card');
  const m: Mode = rp.modes.includes('light' as Mode) ? ('light' as Mode) : rp.modes[0];
  const roles = resolveAllModes(theme).find((x) => x.mode === m)?.roles as Record<string, { hex: string; path?: string; ratio?: number; min?: number } | undefined> | undefined;
  const R = (k: string) => roles?.[k];
  const rest = R('interactive.primary.fill.rest'), hover = R('interactive.primary.fill.hover'), pressed = R('interactive.primary.fill.pressed'), onFill = R('interactive.primary.on-fill');
  if (!rest) { wrap.append(el('p', 'obj-lede', 'Primary interactive color unavailable.')); return wrap; }
  const palName = theme.roleToPalette.action;
  const palSteps = (theme.palettes.find((p) => p.palette === palName)?.steps ?? []).map((s) => s.key);

  // Top row: big swatch · title + step select + token pill · button example
  const top = el('div', 'ic-top');
  const big = el('div', 'ic-big'); big.style.background = rest.hex; top.append(big);
  const mid = el('div', 'ic-mid');
  mid.append(el('h4', 'ic-h', 'Surface — rest'));
  const sel = el('select', 'ic-step') as HTMLSelectElement;
  const pinned = brandState.actionAnchorStep;
  const opt = (v: string, label: string, on: boolean) => { const o = el('option') as HTMLOptionElement; o.value = v; o.textContent = label; if (on) o.selected = true; sel.append(o); };
  opt('auto', `Auto · ${palName} ${stepKeyOf(rest.path)}`, pinned == null);
  for (const k of palSteps) opt(k, `${palName} ${k}`, pinned != null && pinned === Number(k));
  sel.onchange = () => { setPath(brandState, 'actionAnchorStep', sel.value === 'auto' ? undefined : Number(sel.value)); applyFull(); };
  mid.append(sel, el('span', 'tpill mono', 'interactive.primary.fill.rest'));
  top.append(mid);
  const ex = el('div', 'ic-example');
  const btn = el('div', 'ic-btn', 'Button example'); btn.style.background = rest.hex; if (onFill) btn.style.color = onFill.hex;
  ex.append(btn); top.append(ex);
  wrap.append(top);

  // Description + the derived contrast badge (fill vs the surface floor)
  const descRow = el('div', 'ic-descrow');
  descRow.append(el('p', 'ic-desc', 'The surface color of your buttons and interactive containers — engine-derived and gated against the page surface; the on-fill ink is auto-picked to stay legible.'));
  if (rest.ratio != null && rest.min != null) {
    const pass = rest.ratio >= rest.min;
    const b = el('span', `cbadge ${pass ? 'ok' : 'no'}`);
    b.append(el('span', 'cb-ratio', `${rest.ratio.toFixed(2)}:1`), el('span', 'cb-mark', pass ? '✓' : '✗'));
    descRow.append(b);
  }
  wrap.append(descRow);

  // Interactive states — hover + pressed as sub-cards (swatch · step · token pill)
  wrap.append(el('h5', 'ic-states-h', 'Interactive states'));
  const states = el('div', 'ic-states');
  const sub = (label: string, role: { hex: string; path?: string } | undefined, path: string) => {
    if (!role) return;
    const c = el('div', 'ic-sub');
    const sw = el('div', 'ic-subsw'); sw.style.background = role.hex;
    const t = el('div', 'ic-subt');
    t.append(el('div', 'ic-sublab', label), el('div', 'ic-substep mono', `${palName} ${stepKeyOf(role.path)}`), el('span', 'tpill mono', path));
    c.append(sw, t); states.append(c);
  };
  sub('Hover', hover, 'interactive.primary.fill.hover');
  sub('Active', pressed, 'interactive.primary.fill.pressed');
  wrap.append(states);
  return wrap;
};

const renderGroupedPanels = (host: HTMLElement, levers: Lever[]): void => {
  const byKey = new Map(levers.map((l) => [l.key, l]));
  const placed = new Set<string>();
  const panelOf = (ls: Lever[]) => {
    const panel = el('div', 'panel');
    for (const l of ls) { const c = renderControl(l); if (NESTED_KEYS.has(l.key)) c.classList.add('nested'); panel.append(c); placed.add(l.key); }
    return panel;
  };
  for (const g of SEMANTIC_GROUPS) {
    const groupLevers = g.keys.map((k) => byKey.get(k)).filter((l): l is Lever => !!l);
    const isInteractive = g.title === 'Interactive color';
    if (!groupLevers.length && !isInteractive) continue;
    host.append(subHead(g.title));
    if (isInteractive) host.append(renderInteractivePrimaryCard());   // #161 — the primary interactive-color card
    if (groupLevers.length) host.append(panelOf(groupLevers));
  }
  const rest = levers.filter((l) => !placed.has(l.key));
  if (rest.length) host.append(subHead('More'), panelOf(rest));
};
const renderLeverStage = (host: HTMLElement, key: StageKey): void => {
  const [title, lede] = HERO_COPY[key];
  host.append(hero(title, lede));
  const levers = leverManifest.filter((l) => !l.advanced && !PRIMITIVE_KEYS.has(l.key) && stageOfLever(l) === key);
  if (key === 'semantic') {
    renderGroupedPanels(host, levers);          // sub-sectioned (Interactive color / Accessibility / Features)
  } else if (key === 'type') {
    // typeScale stays a plain control; the font pool + weight-role map ARE the typography editor
    // (#103 A1 — families finally editable). The per-category assignment table is A2.
    const scale = levers.find((l) => l.key === 'typography.typeScale');
    if (scale) { const p = el('div', 'panel'); p.append(renderControl(scale)); host.append(p); }
    host.append(renderTypographyEditor());
  } else if (key === 'form') {
    // Geometry + motion in the top panel; shadow.softness is pulled out so every shadow control
    // (softness + tint) lives together under the Shadow group below.
    const panel = el('div', 'panel');
    for (const l of levers) if (l.key !== 'shadow.softness') panel.append(renderControl(l));
    host.append(panel);
  } else if (levers.length) {
    const panel = el('div', 'panel');
    for (const l of levers) panel.append(renderControl(l));
    host.append(panel);
  }
  // #97 — bespoke editors for the object levers renderControl can only show read-only:
  // page surfaces on the color stage; the Shadow group (softness + tint) on the form stage.
  if (key === 'semantic') host.append(renderSurfacesEditor());
  if (key === 'form') host.append(renderShadowEditor(levers.find((l) => l.key === 'shadow.softness')));
  // Validation-color editing (status hue + roleColors borrow) now lives INLINE on each status
  // ramp (primitives stage) via statusRampControl — no standalone semantic-stage section.
  // Live preview on every lever stage — the same sample components reflect the axis
  // being tuned: color (semantic), type (type), geometry (form). The type stage also
  // gets a type-scale specimen (the small component chips can't show the scale). The
  // whole region is volatile so an edit (incl. typeScale) repaints it live.
  const vol = el('div', 'stage-vol');
  host.append(vol);
  paintVolatile = () => {
    vol.innerHTML = '';
    if (key === 'type') vol.append(renderTypeSpecimen());
    if (key === 'form') { vol.append(renderRadiusSpecimen()); vol.append(renderShadowSpecimen()); vol.append(renderMotionSpecimen()); }
    if (key === 'semantic') { vol.append(renderNeutralSpecimen()); vol.append(renderInverseSpecimen()); vol.append(renderIconSpecimen()); vol.append(renderGradientSpecimen()); }
    vol.append(sectionHead('Live preview', 'The sample components + contrast overlay, resolved through every mode — they reflect this stage’s axis live.'));
    const pv = el('div', 'pvhost');
    vol.append(pv);
    paintPreview(pv);
  };
  paintVolatile();
};

// #103 Phase B — advisory font-weight availability (#113 advisory model, not a hard gate). A curated,
// best-effort map of common families → the numeric weights they actually ship. Used only to WARN when a
// category ships a weight its family lacks (the font would fall back to the nearest); an unknown/custom
// family is never warned (we can't assert its weights). Mirrors the engine's per-family emit fallbacks
// (#112). Keys are matched case-insensitively against the family's primary name.
const KNOWN_WEIGHTS: Record<string, number[]> = {
  'Inter': [100, 200, 300, 400, 500, 600, 700, 800, 900],
  'Roboto': [100, 300, 400, 500, 700, 900], 'Roboto Mono': [100, 200, 300, 400, 500, 600, 700],
  'Clash Display': [200, 300, 400, 500, 600, 700], 'JetBrains Mono': [100, 200, 300, 400, 500, 600, 700, 800],
  'Helvetica': [400, 700], 'Helvetica Neue': [400, 700], 'Arial': [400, 700],
  'Georgia': [400, 700], 'Times New Roman': [400, 700],
  'Space Grotesk': [300, 400, 500, 600, 700], 'DM Sans': [400, 500, 700], 'DM Mono': [300, 400, 500],
  'IBM Plex Sans': [100, 200, 300, 400, 500, 600, 700], 'IBM Plex Mono': [100, 200, 300, 400, 500, 600, 700],
  'Work Sans': [100, 200, 300, 400, 500, 600, 700, 800, 900], 'Manrope': [200, 300, 400, 500, 600, 700, 800],
  'Poppins': [100, 200, 300, 400, 500, 600, 700, 800, 900], 'Montserrat': [100, 200, 300, 400, 500, 600, 700, 800, 900],
  'Lato': [100, 300, 400, 700, 900], 'Open Sans': [300, 400, 500, 600, 700, 800], 'Nunito': [200, 300, 400, 500, 600, 700, 800, 900],
  'Source Sans 3': [200, 300, 400, 500, 600, 700, 800, 900], 'Source Serif 4': [200, 300, 400, 500, 600, 700, 800, 900],
};
const KNOWN_WEIGHTS_LC: Record<string, number[]> = Object.fromEntries(Object.entries(KNOWN_WEIGHTS).map(([k, v]) => [k.toLowerCase(), v]));
/** The known weight list for a family primary name, or null when the family is unknown (→ no warning). */
const knownWeightsOf = (fontName: string | undefined): number[] | null => (fontName ? KNOWN_WEIGHTS_LC[fontName.trim().toLowerCase()] ?? null : null);

/** The typography editor — #103 Phase A1: the FONT POOL (the three family roles, finally editable)
 *  + the global weight-role→numeric map. Phase A2: the per-category assignment table (family · weights ·
 *  italic · link). Phase B: advisory weight-availability — a category shipping a weight its family lacks
 *  is muted + flagged (soft, never blocked). Reads the resolved `theme.typography`, writes overrides to
 *  `brandState.typography.*`, re-resolves on change. */
const FAMILY_ROLES: Array<['display' | 'text' | 'mono', string, string]> = [
  ['display', 'Display', 'Headings & hero type (display/title/label/eyebrow default here).'],
  ['text', 'Text', 'Reading & UI copy (body/caption default here).'],
  ['mono', 'Mono', 'Code & column-aligned figures.'],
];
const renderTypographyEditor = (): HTMLElement => {
  const wrap = el('div', 'type-editor');
  const ty = theme.typography;
  // Phase B: recomputes the per-category weight-availability markers from the LIVE resolved theme.
  // Assigned once the table exists; A1 (font/weight edits) and A2 (family/weight-role edits) call it
  // after apply(), so a font or weight-numeric change refreshes the warnings without a full re-render.
  let refreshWarnings = (): void => {};
  // --- Font pool: the primary face per family role (a single name auto-pads a fallback stack) ---
  wrap.append(subHead('Font pool'));
  const pool = el('div', 'panel');
  for (const [role, label, desc] of FAMILY_ROLES) {
    const primary = ty.families.find((f) => f.role === role)?.stack[0] ?? '';
    const knob = el('div', 'knob');
    knob.append(el('label', 'knob-label', label));
    const input = el('input') as HTMLInputElement;
    input.type = 'text'; input.className = 'te-font'; input.value = primary; input.placeholder = 'Font family name';
    input.onchange = () => { setPath(brandState, `typography.families.${role}`, input.value.trim() || undefined); apply(); refreshWarnings(); };
    knob.append(input, el('p', 'knob-desc', desc));
    pool.append(knob);
  }
  wrap.append(pool);
  // --- Weight roles → numeric (GLOBAL: one numeric per role, shared across every category) ---
  wrap.append(subHead('Weight roles → numeric'));
  const wr = el('div', 'panel');
  for (const w of ty.weightRoles) {
    const knob = el('div', 'knob te-wrow');
    knob.append(el('label', 'knob-label', w.role));
    const input = el('input') as HTMLInputElement;
    input.type = 'number'; input.min = '100'; input.max = '900'; input.step = '100'; input.value = String(w.value); input.className = 'te-weight';
    input.onchange = () => { const n = Number(input.value); if (n >= 100 && n <= 900) { setPath(brandState, `typography.weightRoles.${w.role}`, n); apply(); refreshWarnings(); } };
    knob.append(input);
    wr.append(knob);
  }
  wrap.append(wr);
  // --- Per-category assignment (A2): family role · which weight-roles ship · italic · link ---
  // Current state is DERIVED from the resolved composites; each control writes the corresponding
  // brandState.typography.* override. Toggles read LIVE checkbox states (never a stale snapshot),
  // so writing the full weights/italics/links list from the DOM stays correct across many edits.
  wrap.append(subHead('Per-category'));
  const roleOrder = ty.weightRoles.map((w) => w.role);
  const italicG = new Set<string>(ty.composites.filter((c) => c.italic).map((c) => c.group));
  const linkG = new Set<string>(ty.composites.filter((c) => c.link).map((c) => c.group));
  const catFamily: Record<string, string> = {};
  const catWeights: Record<string, Set<string>> = {};
  for (const g of TYPE_GROUP_ORDER) {
    const comps = ty.composites.filter((c) => c.group === g);
    catFamily[g] = comps[0]?.family ?? 'text';
    catWeights[g] = new Set(comps.map((c) => c.weightRole));
  }
  const weightCb: Record<string, Record<string, HTMLInputElement>> = {};
  const weightTd: Record<string, Record<string, HTMLElement>> = {};   // Phase B: the cell carrying the availability marker
  const italicCb: Record<string, HTMLInputElement> = {};
  const linkCb: Record<string, HTMLInputElement> = {};
  const cbEl = (checked: boolean): HTMLInputElement => { const c = el('input') as HTMLInputElement; c.type = 'checkbox'; c.checked = checked; return c; };
  const table = el('table', 'te-cat');
  const head = el('tr');
  head.append(el('th', undefined, 'Category'), el('th', undefined, 'Family'));
  for (const r of roleOrder) head.append(el('th', 'te-c', r));
  head.append(el('th', 'te-c', 'italic'), el('th', 'te-c', 'link'));
  table.append(head);
  for (const g of TYPE_GROUP_ORDER) {
    const tr = el('tr');
    tr.append(el('td', 'te-cat-name mono', g));
    const fsel = el('select', 'te-fam') as HTMLSelectElement;
    for (const fr of ['display', 'text', 'mono']) { const o = el('option') as HTMLOptionElement; o.value = fr; o.textContent = fr; if (fr === catFamily[g]) o.selected = true; fsel.append(o); }
    fsel.onchange = () => { setPath(brandState, `typography.familyMap.${g}`, fsel.value); apply(); refreshWarnings(); };
    const ftd = el('td'); ftd.append(fsel); tr.append(ftd);
    weightCb[g] = {}; weightTd[g] = {};
    for (const r of roleOrder) {
      const cb = cbEl(catWeights[g].has(r)); weightCb[g][r] = cb;
      cb.onchange = () => { setPath(brandState, `typography.weights.${g}`, roleOrder.filter((x) => weightCb[g][x].checked)); apply(); refreshWarnings(); };
      const cbw = el('span', 'te-cbwrap'); cbw.append(cb, el('span', 'te-warn', '⚠'));
      const td = el('td', 'te-c'); td.append(cbw); tr.append(td); weightTd[g][r] = td;
    }
    const icb = cbEl(italicG.has(g)); italicCb[g] = icb;
    icb.onchange = () => { setPath(brandState, 'typography.italics', TYPE_GROUP_ORDER.filter((x) => italicCb[x].checked)); apply(); };
    const itd = el('td', 'te-c'); itd.append(icb); tr.append(itd);
    const lcb = cbEl(linkG.has(g)); linkCb[g] = lcb;
    lcb.onchange = () => { setPath(brandState, 'typography.links', TYPE_GROUP_ORDER.filter((x) => linkCb[x].checked)); apply(); };
    const ltd = el('td', 'te-c'); ltd.append(lcb); tr.append(ltd);
    table.append(tr);
  }
  wrap.append(el('div', 'te-cat-wrap'));
  (wrap.lastChild as HTMLElement).append(table);
  // Phase B — mute the weight roles a category's family likely doesn't ship, and flag (⚠) any that are
  // shipped anyway (they fall back to the nearest). Reads the LIVE resolved theme, so a font-name,
  // weight-numeric, or family change refreshes it without a full re-render. Advisory only — never blocks.
  refreshWarnings = () => {
    const t = theme.typography;
    const numOf = (role: string): number | undefined => t.weightRoles.find((w) => w.role === role)?.value;
    const famRoleOf = (g: string): string => t.composites.find((c) => c.group === g)?.family ?? 'text';
    const fontOf = (famRole: string): string | undefined => t.families.find((f) => f.role === famRole)?.stack[0];
    for (const g of TYPE_GROUP_ORDER) {
      const known = knownWeightsOf(fontOf(famRoleOf(g)));
      for (const r of roleOrder) {
        const td = weightTd[g]?.[r]; const cb = weightCb[g]?.[r]; if (!td || !cb) continue;
        const num = numOf(r);
        const unavail = !!known && num !== undefined && !known.includes(num);
        td.classList.toggle('unavail', unavail);
        (td.querySelector('.te-warn') as HTMLElement).style.display = unavail && cb.checked ? 'inline-block' : 'none';
        td.title = unavail ? `This family may not ship weight ${num} — it falls back to the nearest available weight.` : '';
      }
    }
  };
  refreshWarnings();
  wrap.append(el('p', 'te-cat-note', '⚠ = a shipped weight the category’s family may not provide (it falls back to the nearest). Muted cells are weights the family likely lacks — advisory only, never blocked; unknown/custom fonts aren’t flagged.'));
  return wrap;
};

// ---- object-value editors (#97) --------------------------------------------
// Two BrandInput levers are objects (`surfaces`, `shadow.tint`) that renderControl can only
// show read-only as "configured". These bespoke sub-forms make them editable — reading the
// current value from brandState (falling back to the engine default), writing the object
// fields via setPath, and re-resolving so the specimen repaints. (The third object lever,
// typography.families, is covered by the typography editor above.)

/** The neutral ramp steps a page surface / contrast floor can name (base can also be white/black). */
const NEUTRAL_STEPS = [25, 50, 100, 150, 200, 250, 300, 350, 400, 450, 500, 550, 600, 650, 700, 750, 800, 850, 900, 950];
/** Per mode: the engine's default `base` when a brand doesn't declare a surface (light→white, dark→black). */
const SURFACE_MODES: Array<['light' | 'dark', string, 'white' | 'black']> = [
  ['light', 'Light', 'white'],
  ['dark', 'Dark', 'black'],
];
/** #97 — page-surfaces editor. `surfaces.<mode>.{base,floorStep}` sets the primary surface the
 *  preview paints on (and the worst-case neutral the saturated foregrounds validate against).
 *  base = white / black / a tinted neutral step; floorStep is auto (engine-derived) unless pinned. */
const renderSurfacesEditor = (): HTMLElement => {
  const wrap = el('div', 'obj-editor');
  wrap.append(subHead('Page surfaces'));
  wrap.append(el('p', 'obj-lede', 'The primary surface each mode paints on — white/black or a tinted neutral step. The contrast floor follows it.'));
  const panel = el('div', 'panel');
  const opt = (sel: HTMLSelectElement, v: string, t: string, on: boolean): void => { const o = el('option') as HTMLOptionElement; o.value = v; o.textContent = t; if (on) o.selected = true; sel.append(o); };
  for (const [mode, label, dflt] of SURFACE_MODES) {
    const cur = brandState.surfaces?.[mode];
    const knob = el('div', 'knob');
    knob.append(el('label', 'knob-label', label));
    const row = el('div', 'obj-row');
    const base = el('select', 'obj-sel') as HTMLSelectElement;
    const baseVal = cur?.base ?? dflt;
    opt(base, 'white', 'White', baseVal === 'white');
    opt(base, 'black', 'Black', baseVal === 'black');
    for (const s of NEUTRAL_STEPS) opt(base, String(s), `Neutral ${s}`, baseVal === s);
    base.onchange = () => { setPath(brandState, `surfaces.${mode}.base`, base.value === 'white' || base.value === 'black' ? base.value : Number(base.value)); apply(); };
    const floor = el('select', 'obj-sel') as HTMLSelectElement;
    opt(floor, '', 'Floor: auto', cur?.floorStep == null);
    for (const s of NEUTRAL_STEPS) opt(floor, String(s), `Floor ${s}`, cur?.floorStep === s);
    floor.onchange = () => { setPath(brandState, `surfaces.${mode}.floorStep`, floor.value === '' ? undefined : Number(floor.value)); apply(); };
    row.append(base, floor);
    knob.append(row);
    panel.append(knob);
  }
  wrap.append(panel);
  return wrap;
};

/** #97 + #114 tidy — the Shadow group. Gathers every shadow control under one heading: the
 *  `shadow.softness` blur dial (a generic slider lever, passed in so it leaves the geometry panel)
 *  and the `shadow.tint = {hue, amount}` object editor (hue-shifts the base off pure black; amount 0 =
 *  pure black, higher = a richer brand-hued near-black). Reads the resolved default (`theme.shadow.tint`)
 *  when the brand hasn't set one; the elevation specimen recolors live. */
const renderShadowEditor = (softness?: Lever): HTMLElement => {
  const wrap = el('div', 'obj-editor');
  wrap.append(subHead('Shadow'));
  wrap.append(el('p', 'obj-lede', 'Blur softness (crisp/product → soft/marketing) and a hue-shift of the shadow base off pure black. Tint amount 0 = pure black; higher = a richer, brand-hued near-black.'));
  const def = theme.shadow.tint;
  const cur = brandState.shadow?.tint;
  const panel = el('div', 'panel');
  if (softness) panel.append(renderControl(softness));               // the blur dial, pulled out of the geometry panel
  const mk = (key: 'hue' | 'amount', label: string, min: number, max: number, step: number, unit: string): void => {
    const knob = el('div', 'knob');
    knob.append(el('label', 'knob-label', label));
    const input = el('input') as HTMLInputElement;
    input.type = 'range'; input.min = String(min); input.max = String(max); input.step = String(step);
    input.value = String(cur?.[key] ?? def[key]);
    const val = el('span', 'knob-val', `${input.value}${unit}`);
    input.oninput = () => { setPath(brandState, `shadow.tint.${key}`, Number(input.value)); val.textContent = `${input.value}${unit}`; apply(); };
    const body = el('div', 'knob-body'); body.append(input, val);
    knob.append(body);
    panel.append(knob);
  };
  mk('hue', 'Tint hue', 0, 360, 1, '°');
  mk('amount', 'Tint amount', 0, 1, 0.05, '');
  wrap.append(panel);
  return wrap;
};

/** A compact type-scale specimen: one representative composite per group at its resolved
 *  size, so a typeScale/family/weight change is visible (the component chips are too small
 *  to show the scale). Reads the last-good `theme.typography`. */
const TYPE_GROUP_ORDER = ['display', 'title', 'body', 'label', 'caption', 'eyebrow', 'code'];
const renderTypeSpecimen = (): HTMLElement => {
  const wrap = el('div', 'type-spec');
  wrap.append(sectionHead('Type scale', 'Semantic composites at their resolved sizes — the ladder the components draw from.'));
  const ty = theme.typography;
  const byGroup = new Map<string, typeof ty.composites[number]>();
  for (const c of ty.composites) {
    if (c.link) continue;                               // skip link variants
    const cur = byGroup.get(c.group);
    if (!cur || c.sizePx > cur.sizePx) byGroup.set(c.group, c);   // largest variant per group
  }
  const list = el('div', 'ts-list');
  for (const g of TYPE_GROUP_ORDER) {
    const c = byGroup.get(g);
    if (!c) continue;
    const fam = ty.families.find((f) => f.role === c.family)?.stack.join(', ') ?? 'inherit';
    const wt = ty.weightRoles.find((w) => w.role === c.weightRole)?.value ?? 400;
    const row = el('div', 'ts-row');
    const name = c.variant ? `${c.group}.${c.variant}` : c.group;   // eyebrow has an empty variant
    row.append(el('div', 'ts-meta mono', `${name} · ${c.sizePx}px · ${c.weightRole} ${wt}`));
    const sample = el('div', 'ts-sample', 'The spectrum resolves cleanly');
    sample.style.fontFamily = (c.family === 'mono' || g === 'code') ? 'var(--mono)' : fam;
    sample.style.fontWeight = String(wt);
    sample.style.fontSize = `${Math.min(c.sizePx, 60)}px`;   // cap the visual; real px is in the label
    if (c.textCase === 'uppercase' || g === 'eyebrow') { sample.style.textTransform = 'uppercase'; sample.style.letterSpacing = '0.08em'; }
    row.append(sample);
    list.append(row);
  }
  wrap.append(list);
  return wrap;
};

/** The radius specimen: the whole corner-radius ramp, HOLISTICALLY — a swatch per step (the
 *  actual corner) labelled with its px and the component(s) that consume it (button→md, input→sm,
 *  card→lg, badge→round). The single component preview shows one radius each; this shows the ladder
 *  + who uses what, and reacts to the radius lever. Reads `rp.dims` (live per lever); `none` = 0. */
const RADIUS_STEPS = ['none', 'sm', 'md', 'lg', 'round'];
const renderRadiusSpecimen = (): HTMLElement => {
  const wrap = el('div', 'radius-spec');
  wrap.append(sectionHead('Radius', 'The corner-radius ramp, holistic — each step, its px, and the components that consume it. The radius lever shifts the whole ramp.'));
  const consumers: Record<string, Set<string>> = {};
  for (const c of previewSpec.components) for (const v of c.variants) {
    const rref = v.bindings.radius;
    if (rref?.startsWith('radius.')) (consumers[rref.slice(7)] ??= new Set<string>()).add(c.id);
  }
  const list = el('div', 'rad-list');
  for (const step of RADIUS_STEPS) {
    const px = step === 'none' ? 0 : (rp.dims[`radius.${step}`] ?? 0);
    const cell = el('div', 'rad-cell');
    const sw = el('div', 'rad-sw');
    sw.style.borderRadius = `${Math.min(px, 26)}px`;   // cap so `round` reads as a pill without overflowing the swatch
    const cons = [...(consumers[step] ?? [])];
    cell.append(sw, el('div', 'rad-lab mono', `${step} · ${px}px`), el('div', 'rad-cons', cons.length ? cons.join(', ') : '—'));
    list.append(cell);
  }
  wrap.append(list);
  return wrap;
};

/** The elevation ramp specimen: one card per shadow step (xs→2xl) on a light surface, so
 *  the shadow ramp — and the shadow-softness lever that reshapes every step — is visible
 *  (the single card in the component preview only shows one step). Reads `rp.shadows`. */
const SHADOW_STEPS = ['xs', 'sm', 'md', 'lg', 'xl', '2xl'];
const renderShadowSpecimen = (): HTMLElement => {
  const wrap = el('div', 'shadow-spec');
  wrap.append(sectionHead('Elevation', 'The shadow ramp xs→2xl — the softness + tint levers reshape every step. On a light surface (see the preview below for the mode-reduced dark shadow).'));
  const m: Mode = rp.modes.includes('light' as Mode) ? ('light' as Mode) : rp.modes[0];
  const list = el('div', 'sh-list');
  for (const step of SHADOW_STEPS) {
    const css = rp.shadows[`shadow.${step}`]?.[m];
    if (!css) continue;
    const cell = el('div', 'sh-cell');
    const card = el('div', 'sh-card');
    card.style.boxShadow = css;                                   // resolved value inline (specimen reads the model directly)
    cell.append(card, el('div', 'sh-lab mono', step));
    list.append(cell);
  }
  wrap.append(list);
  return wrap;
};

/** The motion specimen (#114): the resolved semantic transitions (default/enter/exit/emphasized), each a
 *  bar that fills at its resolved duration + easing curve. Motion can't show in the static component
 *  preview, so the tempo lever had no payoff; here it does — the bars re-run on every re-render (i.e. the
 *  moment you change the tempo), plus a Replay. `prefers-reduced-motion` is honoured (bars shown filled,
 *  no animation), nodding to the engine's derived reduced ramp. Kind-B specimen: reads `theme.motion`. */
const renderMotionSpecimen = (): HTMLElement => {
  const wrap = el('div', 'motion-spec');
  const mo = theme.motion;
  wrap.append(sectionHead('Motion', `The semantic transitions at tempo '${mo.tempo}' — each bar fills at its resolved duration + easing curve. Adjust the tempo and they re-run; reduce-motion is honoured (the engine also derives a reduced ramp).`));
  const bez = (b: number[]): string => `cubic-bezier(${b.join(', ')})`;
  const list = el('div', 'mo-list');
  const fills: HTMLElement[] = [];
  for (const t of mo.transitions) {
    const ms = mo.duration[t.duration] ?? 0;
    const row = el('div', 'mo-row');
    row.append(el('div', 'mo-meta mono', `${t.name} · ${ms}ms · ${t.easing}`));
    const track = el('div', 'mo-track');
    const fill = el('div', 'mo-fill');
    fill.style.animationDuration = `${ms}ms`;
    fill.style.animationTimingFunction = bez(mo.easing[t.easing] ?? mo.easing.standard);
    track.append(fill);
    fills.push(fill);
    row.append(track);
    list.append(row);
  }
  wrap.append(list);
  const replay = el('button', 'mo-replay', 'Replay') as HTMLButtonElement;
  // Re-trigger by clearing only the animation NAME (the inline duration/easing longhands survive), forcing
  // a reflow between so the browser restarts the keyframes.
  replay.onclick = () => { for (const f of fills) { f.style.animationName = 'none'; void f.offsetWidth; f.style.removeProperty('animation-name'); } };
  wrap.append(replay);
  return wrap;
};

/** The inverse-surface specimen: a dark hero band with on-inverse inks + an outline CTA, so the
 *  `inverse` toggle has a visible payoff (nothing else in the preview shows the on-inverse family).
 *  Resolves roles dashboard-side (it's a dashboard-only specimen, not part of the shared spec). */
const renderInverseSpecimen = (): HTMLElement => {
  const wrap = el('div', 'inverse-spec');
  const m: Mode = rp.modes.includes('light' as Mode) ? ('light' as Mode) : rp.modes[0];
  const roles = resolveAllModes(theme).find((x) => x.mode === m)?.roles ?? {};
  const hx = (k: string): string | undefined => (roles as Record<string, { hex: string } | undefined>)[k]?.hex;
  // Guard on the role the `inverse` toggle actually gates: background.inverse.*/text.on-inverse
  // are generated UNCONDITIONALLY (modes.ts), only interactive.<color>.on-inverse is behind
  // `inverseContext` (modes.ts §inverse) — so this is what's absent when the toggle is off.
  if (!hx('interactive.primary.on-inverse')) {
    wrap.append(sectionHead('Inverse surface', 'Inverse context is off — enable the “Inverse surface-context” toggle to generate the on-inverse interactive inks.'));
    return wrap;
  }
  wrap.append(sectionHead('Inverse surface', 'Controls on a dark hero / inverse section — the on-inverse inks (nothing else in the preview shows them).'));
  const band = el('div', 'inv-band');
  band.style.background = hx('background.inverse.primary')!;
  const h = el('div', 'inv-h', 'Ship your design system with confidence.');
  h.style.color = hx('text.on-inverse')!;
  band.append(h);
  const ink = hx('interactive.primary.on-inverse')!;   // guaranteed by the guard above
  const cta = el('div', 'inv-cta', 'Get started');
  cta.style.color = ink;
  cta.style.border = `2px solid ${ink}`;
  band.append(cta);
  wrap.append(band);
  return wrap;
};

/** The neutral-emphasis comparison specimen: the neutral (default) button rendered BOTH ways —
 *  `neutralEmphasis: 'subtle'` (a light-grey surface) vs `'strong'` (a bold near-black/white fill).
 *  A single lever picks one; the specimen resolves the theme both ways (dashboard-side, from the
 *  last-good input) so the choice is legible side by side. */
const NEUTRAL_EMPHASES: Array<['subtle' | 'strong', string]> = [['subtle', 'subtle · light grey'], ['strong', 'strong · bold fill']];
const renderNeutralSpecimen = (): HTMLElement => {
  const wrap = el('div', 'neutral-spec');
  wrap.append(sectionHead('Neutral emphasis', 'The neutral (default) button both ways — the neutralEmphasis lever as a light-grey surface vs a bold near-black fill. The active choice is outlined.'));
  const m: Mode = rp.modes.includes('light' as Mode) ? ('light' as Mode) : rp.modes[0];
  const active = lastGoodInput.neutralEmphasis ?? 'subtle';
  const row = el('div', 'ne-list');
  for (const [ne, label] of NEUTRAL_EMPHASES) {
    let found: Record<string, { hex: string } | undefined> | undefined;
    try { found = resolveAllModes(brandTheme({ ...lastGoodInput, neutralEmphasis: ne })).find((x) => x.mode === m)?.roles as any; }
    catch { continue; }
    const fill = found?.['interactive.neutral.fill.rest']?.hex, ink = found?.['interactive.neutral.on-fill']?.hex;
    if (!fill || !ink) continue;
    const cell = el('div', 'ne-cell' + (ne === active ? ' on' : ''));
    const btn = el('div', 'ne-btn', 'Cancel');
    btn.style.background = fill; btn.style.color = ink;
    cell.append(btn, el('div', 'ne-lab mono', label));
    row.append(cell);
  }
  wrap.append(row);
  return wrap;
};

/** The gradient specimen: the brand gradient(s) as CSS swatches, so the Gradients toggle has a
 *  visible payoff (nothing else in the preview shows them). Reads `theme.gradient.gradients` (the
 *  last-good theme). Interpolates `in oklch` — the engine's intent — which Chromium (dashboard +
 *  plugin iframe) renders natively. Empty when the toggle is off → a hint. */
const gradientCss = (g: { kind: string; angle?: number; shape?: string; stops: Array<{ hex: string; position: number }> }): string => {
  const stops = g.stops.map((s) => `${s.hex} ${Math.round(s.position * 100)}%`).join(', ');
  return g.kind === 'radial'
    ? `radial-gradient(${g.shape ?? 'ellipse'} in oklch, ${stops})`
    : `linear-gradient(${g.angle ?? 135}deg in oklch, ${stops})`;
};
const renderGradientSpecimen = (): HTMLElement => {
  const wrap = el('div', 'gradient-spec');
  const grads = (theme.gradient?.gradients ?? []) as Array<{ name: string; kind: string; angle?: number; shape?: string; stops: Array<{ hex: string; position: number }> }>;
  if (!grads.length) {
    wrap.append(sectionHead('Gradients', 'Gradients are off — enable the Gradients toggle to ship one or more brand gradients (stop colors alias the ramp; OKLCH-interpolated).'));
    return wrap;
  }
  wrap.append(sectionHead('Gradients', 'The brand gradient(s) — stop colors alias the ramp, interpolated in OKLCH (nothing else in the preview shows them).'));
  const row = el('div', 'gr-list');
  for (const g of grads) {
    const cell = el('div', 'gr-cell');
    const sw = el('div', 'gr-sw');
    sw.style.background = gradientCss(g);
    cell.append(sw, el('div', 'gr-lab mono', `${g.name} · ${g.kind} · ${g.stops.length} stops`));
    row.append(cell);
  }
  wrap.append(row);
  return wrap;
};

/** Inline-SVG icon glyphs (stroke, `currentColor` via the `stroke` attr) — dependency-free line icons,
 *  authored here so the specimen stays buildless. 24×24 viewBox, rounded caps/joins. */
const SVGNS = 'http://www.w3.org/2000/svg';
const ICON_PATH: Record<string, string> = {
  bell: '<path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 01-3.4 0"/>',
  search: '<circle cx="11" cy="11" r="7"/><line x1="20.5" y1="20.5" x2="16" y2="16"/>',
  dot: '<circle cx="12" cy="12" r="8"/>',
  star: '<path d="M12 3l2.6 5.6 6 .7-4.4 4.1 1.2 6L12 16.9 6.6 19.4l1.2-6L3.4 9.3l6-.7z"/>',
  check: '<circle cx="12" cy="12" r="9"/><path d="M8 12.5l2.5 2.5 5-5.5"/>',
  triangle: '<path d="M12 4l9 16H3z"/><line x1="12" y1="10" x2="12" y2="14"/><line x1="12" y1="17" x2="12" y2="17.01"/>',
  x: '<circle cx="12" cy="12" r="9"/><path d="M9 9l6 6M15 9l-6 6"/>',
  info: '<circle cx="12" cy="12" r="9"/><line x1="12" y1="11" x2="12" y2="16"/><line x1="12" y1="8" x2="12" y2="8.01"/>',
};
const iconEl = (name: string, stroke: string): SVGElement => {
  const svg = document.createElementNS(SVGNS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('width', '22'); svg.setAttribute('height', '22');
  svg.setAttribute('fill', 'none'); svg.setAttribute('stroke', stroke); svg.setAttribute('stroke-width', '2');
  svg.setAttribute('stroke-linecap', 'round'); svg.setAttribute('stroke-linejoin', 'round');
  svg.innerHTML = ICON_PATH[name] ?? ICON_PATH.dot;
  return svg;
};

/** The icon specimen (#99 last item): icons on a surface AND reversed out on fills, so the icon-contrast
 *  floor (`iconContrast` lever) has a visible payoff — nothing else in the preview shows the icon roles.
 *  Kind-B (reads `resolveAllModes(theme)`, like the inverse/neutral specimens). On-fill pairings use only
 *  roles backed by a real solid fill (brand/destructive action fills + the inverse surface). */
const ICON_ON_SURFACE: Array<[string, string]> = [
  ['icon.primary', 'bell'], ['icon.secondary', 'search'], ['icon.tertiary', 'dot'],
  ['icon.brand', 'star'], ['icon.success', 'check'], ['icon.warning', 'triangle'], ['icon.danger', 'x'], ['icon.info', 'info'],
];
const ICON_ON_FILL: Array<[string, string, string]> = [
  ['icon.on-brand', 'interactive.primary.fill.rest', 'star'],
  ['icon.on-danger', 'interactive.destructive.fill.rest', 'x'],
  ['icon.on-inverse', 'background.inverse.primary', 'bell'],
];
const renderIconSpecimen = (): HTMLElement => {
  const wrap = el('div', 'icon-spec');
  const m: Mode = rp.modes.includes('light' as Mode) ? ('light' as Mode) : rp.modes[0];
  const roles = resolveAllModes(theme).find((x) => x.mode === m)?.roles ?? {};
  const hx = (k: string): string | undefined => (roles as Record<string, { hex: string } | undefined>)[k]?.hex;
  const floorLabel = theme.iconContrast === 'text' ? '4.5:1 · matches text' : '3:1 · WCAG non-text';
  wrap.append(sectionHead('Icons', `Icons on a surface and reversed out on fills — each validated to the icon-contrast floor (${floorLabel}). The “Icon contrast floor” lever raises or relaxes it.`));
  const tile = (icon: string, color: string, bg: string, label: string, bordered: boolean): HTMLElement => {
    const t = el('div', 'ic-tile');
    const chip = el('div', 'ic-chip'); chip.style.background = bg; if (bordered) chip.style.border = '1px solid var(--line)';
    chip.append(iconEl(icon, color));
    t.append(chip, el('div', 'ic-lab mono', label));
    return t;
  };
  const surfBg = hx('background.primary') ?? '#ffffff';
  const surf = el('div', 'ic-block'); surf.append(el('div', 'ic-cap mono', 'on surface'));
  const sTiles = el('div', 'ic-tiles');
  for (const [role, icon] of ICON_ON_SURFACE) { const c = hx(role); if (c) sTiles.append(tile(icon, c, surfBg, role.replace('icon.', ''), true)); }
  surf.append(sTiles); wrap.append(surf);
  const fill = el('div', 'ic-block'); fill.append(el('div', 'ic-cap mono', 'reversed on fill'));
  const fTiles = el('div', 'ic-tiles');
  for (const [role, bgRole, icon] of ICON_ON_FILL) { const c = hx(role), bg = hx(bgRole); if (c && bg) fTiles.append(tile(icon, c, bg, role.replace('icon.', ''), false)); }
  fill.append(fTiles); wrap.append(fill);
  return wrap;
};

// ---- shared bits -----------------------------------------------------------
const hero = (title: string, lede: string): HTMLElement => {
  const h = el('div', 'hero');
  if (title) h.append(el('h1', undefined, title));
  if (lede) h.append(el('p', 'lede', lede));
  return h;
};
const sectionHead = (title: string, desc: string): HTMLElement => {
  const s = el('div', 'section-lab');
  s.append(el('h2', 'section-t', title), el('p', 'section-d', desc));
  return s;
};

// ---- shell -----------------------------------------------------------------
const app = document.getElementById('app')!;
let workspace: HTMLElement;

function renderWorkspace(): void {
  workspace.innerHTML = '';
  if (stage === 'primitives') renderPrimitives(workspace);
  else renderLeverStage(workspace, stage);
}

// ---- brand setup — selector menu: name + namespace, switch / new / import --------
let barHost: HTMLElement;
let brandMenuOpen = false;
let importOpen = false;
let importErr: string | null = null;
let importText = '';            // M-17: survives re-renders so a failed paste isn't wiped
let outsideBound = false;

/** Replace the working brand wholesale (switch / new / import) and re-render. */
const loadBrand = (input: BrandInput): void => {
  brandState = structuredClone(input);
  brandMenuOpen = false; importOpen = false; importErr = null; importText = '';
  stage = 'primitives';
  rebuild();
  currentMode = rp.modes[0];
  build();
};

/** Set the generated modes from the toggles. Light is always present; HC adds hc-light, plus
 *  hc-dark only when dark is also on; wireframe (greyscale, generate-only) appends last — the
 *  engine's canonical mode order (docs/11 Pillar 1). */
const setModes = (dark: boolean, hc: boolean, wire: boolean): void => {
  const m: Mode[] = ['light'];
  if (dark) m.push('dark');
  if (hc) { m.push('hc-light'); if (dark) m.push('hc-dark'); }
  if (wire) m.push('wireframe');
  brandState.modes = m;
  rebuild();
  if (!rp.modes.includes(currentMode)) currentMode = rp.modes[0];   // dropped the selected mode
  build();                                                          // bar toggles + preview mode selector both change
};

/** Trigger a client-side file download (Blob → object URL → anchor click). */
const download = (filename: string, text: string, mime: string): void => {
  const url = URL.createObjectURL(new Blob([text], { type: mime }));
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
};

// L-11: a design.md pasted with a bare numeric `id:` (e.g. `id: 2026`) parses `id` as a
// number; `.trim()` on a number throws and crashes BOTH exports. Coerce to string first.
const slug = (): string => String(lastGoodInput.id || 'brand').trim().replace(/\s+/g, '-') || 'brand';

// Both exports run off the LAST-GOOD state, never the live one (M-15). Previously tokens.json
// re-ran `brandTheme(brandState)` uncaught — a failing edit threw in the click handler (no
// download, no feedback) — and design.md serialized the failing state into a brief its own
// importer rejects. The last-good input/theme is always valid and is exactly what the ramps +
// preview already show (the errbar tells the user the current edit is what's unresolved).
/** Export the last-good brand as design.md — round-trips straight back into Import. */
const exportDesignMd = (): void => download(`${slug()}.design.md`, toDesignMd(lastGoodInput), 'text/markdown');

/** Export the resolved DTCG token tree (buildTree) of the last-good theme, namespaced under `root`. */
const exportTokens = (): void => {
  const tree = buildTree(theme).tree;   // `theme` is the last-good — always valid, never throws
  download(`${slug()}.tokens.json`, JSON.stringify(tree, null, 2), 'application/json');
};

/** Parse a pasted design.md and load it. Validation is "does the engine accept it":
 *  a parse error or a brandTheme throw is surfaced; the working brand is untouched
 *  until both pass. (The full schema validator is node-bound, so it can't run here —
 *  brandTheme's own guards + the live contract overlay cover the rest.) */
const tryImport = (text: string): void => {
  importText = text;              // M-17: keep the paste so an error re-render doesn't wipe it
  let input: BrandInput;
  try { input = parseDesignMd(text).input; }
  catch (e) { importErr = (e as Error).message; renderBar(); return; }
  try { brandTheme(input); }
  catch (e) { importErr = `Parsed, but the engine rejected it: ${(e as Error).message}`; renderBar(); return; }
  loadBrand(input);
};

const renderBrandMenu = (): HTMLElement => {
  const menu = el('div', 'brandmenu');

  menu.append(el('div', 'bm-cap', 'Current brand'));
  const field = (label: string, value: string, mono: boolean, oninput: (v: string, input: HTMLInputElement) => void): HTMLElement => {
    const f = el('label', 'bm-field');
    f.append(el('span', 'bm-lab', label));
    const inp = el('input', 'bm-in' + (mono ? ' mono' : '')) as HTMLInputElement;
    inp.value = value; inp.spellcheck = false;
    inp.oninput = () => oninput(inp.value, inp);
    f.append(inp);
    return f;
  };
  menu.append(field('Name', brandState.id, false, (v) => {
    brandState.id = v.trim() || 'untitled';
    (barHost.querySelector('.bs-name') as HTMLElement).textContent = brandState.id;
  }));
  const nsHint = el('p', 'bm-hint');
  const setHint = () => { nsHint.textContent = `Tokens emit under ${brandState.root ?? 'prism'}.*`; };
  menu.append(field('Namespace', brandState.root ?? 'prism', true, (v, inp) => {
    const t = v.trim();
    if (ROOT_RE.test(t)) { brandState.root = t; inp.classList.remove('bad'); setHint(); }
    else inp.classList.add('bad');
  }));
  setHint();
  menu.append(nsHint);

  // Modes — light always; dark / high-contrast opt-in (docs/11 Pillar 1).
  const modes = brandState.modes ?? ALL_MODES;
  const darkOn = modes.includes('dark');
  const hcOn = modes.includes('hc-light') || modes.includes('hc-dark');
  const wireOn = modes.includes('wireframe');
  const modeRow = el('div', 'bm-field');
  modeRow.append(el('span', 'bm-lab', 'Modes'));
  const chips = el('div', 'bm-modes');
  chips.append(el('span', 'bm-mode fixed', 'Light'));
  const dChip = el('button', 'bm-mode' + (darkOn ? ' on' : ''), 'Dark') as HTMLButtonElement;
  dChip.onclick = () => setModes(!darkOn, hcOn, wireOn);
  const hChip = el('button', 'bm-mode' + (hcOn ? ' on' : ''), 'HC') as HTMLButtonElement;
  hChip.title = 'High contrast';
  hChip.onclick = () => setModes(darkOn, !hcOn, wireOn);
  const wChip = el('button', 'bm-mode' + (wireOn ? ' on' : ''), 'Wireframe') as HTMLButtonElement;
  wChip.title = 'Greyscale, sharp corners — generate-only';
  wChip.onclick = () => setModes(darkOn, hcOn, !wireOn);
  chips.append(dChip, hChip, wChip);
  modeRow.append(chips);
  menu.append(modeRow);

  menu.append(el('div', 'bm-div'));
  menu.append(el('div', 'bm-cap', 'Examples'));
  for (const name of Object.keys(BRANDS)) {
    const b = el('button', 'bm-item' + (name === brandState.id ? ' cur' : '')) as HTMLButtonElement;
    const d = el('span', 'bm-dot'); d.style.background = hex(oklchToRgb(BRANDS[name].primary));
    b.append(d, el('span', undefined, name));
    b.onclick = () => loadBrand(BRANDS[name]);
    menu.append(b);
  }

  menu.append(el('div', 'bm-div'));
  const nb = el('button', 'bm-item', '+ New brand') as HTMLButtonElement;
  // Web: return to the start moment (the same three paths) rather than silently loading the default.
  // Plugin: keep the direct neutral-default load — this handler is SHARED UI (not host-DCE'd), and the
  // plugin start moment is a deferred cross-lane follow-up, so it must not surface the web start screen.
  nb.onclick = () => {
    brandMenuOpen = false;
    if (PRISM3_HOST !== 'figma') { firstRun = true; build(); } else loadBrand(NEW_BRAND());
  };
  menu.append(nb);
  const imp = el('button', 'bm-item', '↑ Import design.md…') as HTMLButtonElement;
  imp.onclick = () => { importOpen = !importOpen; importErr = null; renderBar(); };
  menu.append(imp);

  if (importOpen) {
    const box = el('div', 'bm-import');
    const ta = el('textarea', 'bm-ta') as HTMLTextAreaElement;
    ta.placeholder = 'Paste a design.md — --- YAML frontmatter --- then prose…';
    ta.spellcheck = false;
    ta.value = importText;                                   // M-17: restore across re-renders
    ta.oninput = () => { importText = ta.value; };           // a mode-toggle mid-paste won't lose it
    box.append(ta);
    if (importErr) box.append(el('p', 'bm-err', importErr));
    const load = el('button', 'bm-load', 'Load') as HTMLButtonElement;
    load.onclick = () => tryImport(ta.value);
    box.append(load);
    menu.append(box);
  }

  menu.append(el('div', 'bm-div'));
  menu.append(el('div', 'bm-cap', 'Export'));
  const expMd = el('button', 'bm-item', '↓ design.md') as HTMLButtonElement;
  expMd.onclick = exportDesignMd;
  const expTok = el('button', 'bm-item', '↓ tokens.json — DTCG') as HTMLButtonElement;
  expTok.onclick = exportTokens;
  menu.append(expMd, expTok);
  menu.append(el('p', 'bm-hint', 'design.md re-imports here; tokens.json is the resolved tree.'));

  // Figma plugin only (docs/22 #110): the COMMIT action — materialise the last-good brand into
  // figma.variables (posts the BrandInput to the main thread → #108). Plus the #109 read-back
  // seed panel reporting any existing Prism3 theme in the file (informational; knob-rehydration
  // is a follow-up). On web this whole block is absent (`commit.isFigma` is false + DCE'd).
  if (commit.isFigma) {
    const applyBtn = el('button', 'bm-item', '↳ Apply to Figma variables') as HTMLButtonElement;
    applyBtn.onclick = () => commit.postTheme(lastGoodInput);
    menu.append(applyBtn);
    if (seedInfo) menu.append(el('p', 'bm-hint' + (seedInfo.ok ? '' : ' bad'), seedInfo.summary));
  }
  return menu;
};

function renderBar(): void {
  barHost.innerHTML = '';
  const mark = el('div', 'brandmark');
  mark.append(el('span', 'logo'), el('span', 'wordmark', 'Prism3'), el('span', 'studio', 'Theme studio'));
  barHost.append(mark);

  const wrap = el('div', 'brandsel-wrap');
  const sel = el('button', 'brandsel' + (brandMenuOpen ? ' open' : '')) as HTMLButtonElement;
  const dot = el('span', 'dot'); dot.style.background = hex(oklchToRgb(brandState.primary));
  sel.append(dot, el('span', 'bs-name', brandState.id), el('span', 'caret', '▾'));
  sel.onclick = (e) => { e.stopPropagation(); brandMenuOpen = !brandMenuOpen; if (!brandMenuOpen) importOpen = false; renderBar(); };
  wrap.append(sel);
  if (brandMenuOpen) wrap.append(renderBrandMenu());
  barHost.append(wrap);

  if (!outsideBound) {
    document.addEventListener('mousedown', (e) => {
      if (brandMenuOpen && !(e.target as HTMLElement).closest('.brandsel-wrap')) { brandMenuOpen = false; importOpen = false; renderBar(); }
    });
    outsideBound = true;
  }
}

/** Seed a fresh brand from a single hex color: the engine grows a full system from one primary, so
 *  the color's OKLCH becomes the primary anchor and the neutral leans to its hue (a subtle brand tint). */
const seedFromColor = (hexVal: string): BrandInput => {
  const o = rgbToOklch(hexToRgb(hexVal));
  return { ...NEW_BRAND(), primary: o, neutral: { hue: o.h, chroma: 0.006 } };
};

/** The first-run START SCREEN (#149 follow-up). Web boots here when nothing is persisted, instead of
 *  silently loading the demo. One brand color bootstraps a full theme, so the paths are: start from
 *  your color, start from a neutral default, or open an example. Each lands in the editor (loadBrand →
 *  rebuild persists it), so a reload restores the working brand and the start screen doesn't reappear. */
const renderStartScreen = (): HTMLElement => {
  const view = el('div', 'startview');
  const col = el('div', 'start-col');
  const mark = el('div', 'start-mark');
  mark.append(el('span', 'logo'), el('span', 'wordmark', 'Prism3'), el('span', 'studio', 'Theme studio'));
  col.append(mark);
  col.append(el('h1', 'start-h', 'Start a new brand.'));
  col.append(el('p', 'start-lede', 'One brand color is enough — the engine grows a full, contrast-checked system you can steer. Pick a starting point.'));

  const enter = (input: BrandInput): void => { firstRun = false; loadBrand(input); };

  // Path 1 — from your color (the hero path: a single primary bootstraps everything).
  const c1 = el('div', 'start-card start-hero');
  c1.append(el('h2', 'start-ct', 'Start from your color'));
  c1.append(el('p', 'start-cd', 'Your primary brand color; everything else takes smart defaults you can tune.'));
  const row = el('div', 'start-color-row');
  const swatch = el('input', 'start-swatch') as HTMLInputElement; swatch.type = 'color'; swatch.value = '#5e4bc3';
  const hexIn = el('input', 'start-hex') as HTMLInputElement; hexIn.type = 'text'; hexIn.value = '#5e4bc3'; hexIn.setAttribute('aria-label', 'Brand color hex');
  const HEX = /^#[0-9a-f]{6}$/i;
  swatch.oninput = () => { hexIn.value = swatch.value; };
  hexIn.oninput = () => { if (HEX.test(hexIn.value)) swatch.value = hexIn.value; };
  const go = el('button', 'start-go', 'Create theme →') as HTMLButtonElement;
  go.onclick = () => enter(seedFromColor(HEX.test(hexIn.value) ? hexIn.value : swatch.value));
  row.append(swatch, hexIn, go);
  c1.append(row);
  col.append(c1);

  // Path 2 — a neutral, unopinionated default (set color later).
  const c2 = el('div', 'start-card start-row2');
  const t2 = el('div', 'start-c2t');
  t2.append(el('h2', 'start-ct', 'Start with a neutral default'), el('p', 'start-cd', 'An unopinionated starting theme — jump in and set your color later.'));
  const b2 = el('button', 'start-alt', 'Start blank') as HTMLButtonElement;
  b2.onclick = () => enter(NEW_BRAND());
  c2.append(t2, b2);
  col.append(c2);

  // Path 3 — open a fully-built example (aurora / harbor), explicitly framed as examples.
  const c3 = el('div', 'start-card');
  c3.append(el('h2', 'start-ct', 'Explore an example'));
  c3.append(el('p', 'start-cd', 'Open a fully-built example to see what the engine produces from a brand.'));
  const chips = el('div', 'start-chips');
  for (const name of Object.keys(BRANDS)) {
    const chip = el('button', 'start-chip') as HTMLButtonElement;
    const d = el('span', 'dot'); d.style.background = hex(oklchToRgb(BRANDS[name].primary));
    chip.append(d, el('span', undefined, name));
    chip.onclick = () => enter(BRANDS[name]);
    chips.append(chip);
  }
  c3.append(chips);
  col.append(c3);

  view.append(col);
  return view;
};

const build = (): void => {
  app.innerHTML = '';
  if (firstRun) { app.append(renderStartScreen()); return; }   // first run: the start moment stands in for the app
  barHost = el('header', 'bar');
  app.append(barHost);
  renderBar();

  const shell = el('div', 'shell');
  const rail = el('nav', 'rail');
  STAGES.forEach((s, i) => {
    const it = el('button', 'stage' + (s.key === stage ? ' active' : '')) as HTMLButtonElement;
    it.append(el('span', 'stage-n mono', String(i + 1)));
    const t = el('span', 'stage-t');
    t.append(el('b', undefined, s.title), el('small', undefined, s.sub));
    it.append(t);
    it.onclick = () => { if (stage !== s.key) { stage = s.key; build(); } };
    rail.append(it);
  });
  rail.append(el('p', 'rail-note', 'A theme builds in order — primitives first, then the semantic roles that alias them, then type, then form.'));
  shell.append(rail);

  workspace = el('section', 'ws');
  shell.append(workspace);
  app.append(shell);
  renderWorkspace();
};

// ---- inlined stylesheet (self-contained bundle) ----------------------------
const STYLE = `
:root{
  --ink:#18181b; --ink2:#3d3d44; --muted:#71717a; --faint:#a1a1aa;
  --paper:#f2f3f6; --panel:#ffffff; --line:#e7e8ec; --line2:#dcdde2;
  --r:10px; --r-sm:7px; --r-xs:6px;
  --sans:-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,Roboto,sans-serif;
  --mono:ui-monospace,'SF Mono','JetBrains Mono',Menlo,Consolas,monospace;
}
*{box-sizing:border-box}
html,body{margin:0}
body{background:var(--paper);color:var(--ink);font-family:var(--sans);-webkit-font-smoothing:antialiased;font-size:14px;line-height:1.55}
.mono{font-family:var(--mono);font-variant-numeric:tabular-nums;letter-spacing:-0.01em}
.faint{color:var(--faint)}
#app{max-width:1200px;margin:0 auto;padding:0 40px 120px}

/* First-run start screen */
.startview{min-height:100vh;display:flex;align-items:center;justify-content:center;padding:48px 24px;background:var(--paper)}
.start-col{width:100%;max-width:560px;display:flex;flex-direction:column;gap:14px}
.start-mark{display:flex;align-items:center;gap:9px;margin-bottom:6px}
.start-h{margin:0;font-size:34px;font-weight:680;letter-spacing:-0.025em;color:var(--ink)}
.start-lede{margin:0 0 6px;font-size:15px;line-height:1.55;color:var(--muted);max-width:48ch}
.start-card{border:1px solid var(--line);border-radius:var(--r);background:var(--panel);padding:20px}
.start-hero{border-color:var(--line2);box-shadow:0 1px 2px rgba(24,24,27,.05)}
.start-ct{margin:0 0 4px;font-size:15px;font-weight:620;color:var(--ink)}
.start-cd{margin:0;font-size:13px;line-height:1.5;color:var(--faint)}
.start-color-row{display:flex;align-items:center;gap:10px;margin-top:15px}
.start-swatch{width:44px;height:38px;padding:0;border:1px solid var(--line2);border-radius:var(--r-xs);background:none;cursor:pointer}
.start-hex{width:108px;padding:8px 10px;border:1px solid var(--line2);border-radius:var(--r-xs);font:inherit;font-variant-numeric:tabular-nums;background:var(--paper);color:var(--ink)}
.start-go{margin-left:auto;padding:9px 16px;border:none;border-radius:var(--r-sm);background:var(--ink);color:#fff;font:inherit;font-size:13px;font-weight:560;cursor:pointer}
.start-go:hover{background:#000}
.start-row2{display:flex;align-items:center;justify-content:space-between;gap:16px}
.start-c2t{min-width:0}
.start-alt{flex:none;padding:9px 15px;border:1px solid var(--line2);border-radius:var(--r-sm);background:var(--panel);color:var(--ink);font:inherit;font-size:13px;font-weight:540;cursor:pointer}
.start-alt:hover{border-color:var(--ink)}
.start-chips{display:flex;flex-wrap:wrap;gap:8px;margin-top:15px}
.start-chip{display:flex;align-items:center;gap:8px;padding:7px 13px 7px 9px;border:1px solid var(--line2);border-radius:999px;background:var(--panel);font:inherit;font-size:13px;color:var(--ink);cursor:pointer}
.start-chip:hover{border-color:var(--ink)}
.start-chip .dot{width:12px;height:12px;border-radius:50%;flex:none}

.bar{display:flex;align-items:center;justify-content:space-between;padding:26px 2px 24px;position:sticky;top:0;background:linear-gradient(var(--paper),var(--paper) 68%,transparent);z-index:20}
.brandmark{display:flex;align-items:center;gap:11px}
.logo{width:18px;height:18px;border-radius:var(--r-xs);background:conic-gradient(from 210deg,#5e4bc3,#0088be,#2f6833,#a13731,#5e4bc3)}
.wordmark{font-weight:640;letter-spacing:-0.02em;font-size:16px}
.studio{color:var(--muted);font-size:13px;border-left:1px solid var(--line2);padding-left:11px}
.brandsel-wrap{position:relative}
.brandsel{display:flex;align-items:center;gap:9px;font:inherit;font-weight:560;border:1px solid var(--line2);background:var(--panel);padding:8px 13px;border-radius:var(--r-sm);font-size:13.5px;cursor:pointer;color:var(--ink)}
.brandsel.open{border-color:var(--ink2)}
.brandsel .dot{width:12px;height:12px;border-radius:4px}
.brandsel .caret{color:var(--faint);margin-left:2px}
.brandmenu{position:absolute;top:calc(100% + 8px);right:0;width:288px;background:var(--panel);border:1px solid var(--line2);border-radius:var(--r);padding:12px;z-index:20;display:flex;flex-direction:column;gap:2px;box-shadow:0 12px 32px -8px rgba(24,24,27,.20),0 4px 12px -4px rgba(24,24,27,.12)}
.bm-cap{font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:var(--faint);font-weight:600;margin:4px 2px 6px}
.bm-field{display:flex;align-items:center;gap:10px;padding:4px 2px}
.bm-lab{font-size:12.5px;color:var(--ink2);width:78px;flex:none}
.bm-in{flex:1;min-width:0;padding:6px 9px;border:1px solid var(--line2);border-radius:var(--r-xs);font:inherit;font-size:13px;background:var(--paper)}
.bm-in.bad{border-color:#d23;background:#fdecec}
.bm-hint{margin:2px 2px 4px;font-size:11px;color:var(--faint);font-family:var(--mono)}
.bm-modes{display:flex;gap:6px;flex:1}
.bm-mode{border:1px solid var(--line2);background:var(--paper);border-radius:var(--r-xs);font:inherit;font-size:12px;color:var(--muted);padding:4px 10px;cursor:pointer}
.bm-mode.on{background:var(--ink);color:#fff;border-color:var(--ink)}
.bm-mode.fixed{cursor:default;background:var(--panel);color:var(--ink2);border-style:dashed}
.bm-div{height:1px;background:var(--line);margin:8px 0}
.bm-item{display:flex;align-items:center;gap:9px;width:100%;text-align:left;border:0;background:none;font:inherit;font-size:13px;color:var(--ink2);padding:8px 8px;border-radius:var(--r-xs);cursor:pointer}
.bm-item:hover{background:var(--paper)}
.bm-item.cur{color:var(--ink);font-weight:600}
.bm-dot{width:11px;height:11px;border-radius:3px;flex:none}
.bm-import{margin-top:6px;display:flex;flex-direction:column;gap:8px}
.bm-ta{width:100%;height:120px;resize:vertical;padding:9px;border:1px solid var(--line2);border-radius:var(--r-xs);font-family:var(--mono);font-size:12px;background:var(--paper);line-height:1.5}
.bm-err{margin:0;font-size:11.5px;color:#a12;line-height:1.5}
.bm-load{align-self:flex-start;border:1px solid var(--ink);background:var(--ink);color:#fff;border-radius:var(--r-xs);padding:7px 16px;font:inherit;font-size:13px;font-weight:560;cursor:pointer}

.shell{display:grid;grid-template-columns:210px minmax(0,1fr);gap:60px;align-items:start;margin-top:20px}
.rail{position:sticky;top:96px;display:flex;flex-direction:column;gap:4px}
.stage{display:flex;align-items:center;gap:13px;text-align:left;border:1px solid transparent;background:none;font:inherit;padding:12px;border-radius:var(--r-sm);cursor:pointer;color:var(--ink2)}
.stage:hover{background:var(--panel)}
.stage.active{background:var(--panel);border-color:var(--line2)}
.stage-n{width:24px;height:24px;flex:none;display:grid;place-items:center;border-radius:var(--r-xs);background:var(--paper);border:1px solid var(--line2);font-size:12px;color:var(--muted)}
.stage.active .stage-n{background:var(--ink);color:#fff;border-color:var(--ink)}
.stage-t{display:flex;flex-direction:column;line-height:1.3;gap:2px}
.stage-t b{font-weight:600;font-size:13.5px}
.stage.active .stage-t b{color:var(--ink)}
.stage-t small{color:var(--faint);font-size:11.5px}
.rail-note{color:var(--muted);font-size:12px;line-height:1.6;margin:22px 8px 0;padding-top:20px;border-top:1px solid var(--line)}

.hero{padding:6px 0 4px}
.hero h1{margin:0;font-size:40px;font-weight:660;letter-spacing:-0.03em;line-height:1.08}
.lede{color:var(--muted);max-width:60ch;margin:18px 0 0;font-size:16px;line-height:1.65}

.panels{display:grid;grid-template-columns:1.7fr 1fr;gap:18px;margin:40px 0 0}
.panel{background:var(--panel);border:1px solid var(--line);border-radius:var(--r);padding:20px 22px}
.panel-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:6px}
.panel-head h2{margin:0;font-size:15px;font-weight:620;letter-spacing:-0.01em}
.seg{display:flex;border:1px solid var(--line2);border-radius:var(--r-sm);padding:2px;gap:2px}
.seg-b{border:0;background:none;font:inherit;font-size:12px;color:var(--muted);padding:4px 12px;border-radius:5px;cursor:pointer}
.seg-b.on{background:var(--ink);color:#fff}

.clist{display:flex;flex-direction:column}
.crow{display:flex;align-items:center;gap:13px;padding:13px 0;border-bottom:1px solid var(--line)}
.rsw{width:40px;height:40px;flex:none;border-radius:var(--r-xs);border:1px solid var(--line2);padding:0;background:none;cursor:pointer;overflow:hidden}
/* Native color inputs: strip the browser's swatch inset so the color fills the whole control (no white gutter). */
input[type=color]::-webkit-color-swatch-wrapper{padding:0}
input[type=color]::-webkit-color-swatch{border:none;border-radius:inherit}
input[type=color]::-moz-color-swatch{border:none;border-radius:inherit}
.rname{font-weight:560;font-size:14px}
.nm{flex:0 1 auto;min-width:0;width:110px;padding:5px 8px;border:1px solid var(--line2);border-radius:var(--r-xs);font-size:13px;background:var(--paper)}
.rhex{color:var(--muted);font-size:13px}
.crow .rhex{margin-left:auto}
.rx{width:28px;height:28px;flex:none;border:1px solid var(--line2);background:var(--panel);border-radius:var(--r-xs);color:var(--faint);cursor:pointer;font-size:15px;line-height:1}
.rx:hover{background:#fdecec;color:#a12;border-color:#f2c6c6}
.addbtn{margin-top:14px;border:1px dashed var(--line2);background:none;border-radius:var(--r-sm);padding:9px 15px;font:inherit;font-size:13px;color:var(--muted);cursor:pointer;width:100%}
.addbtn:hover{border-color:var(--ink);color:var(--ink)}

.slider{margin-top:16px}
.slider-top{display:flex;align-items:baseline;justify-content:space-between;font-size:13px;color:var(--ink2)}
.slider-top .val{color:var(--muted);font-size:12.5px}
.range{width:100%;margin-top:10px;accent-color:var(--ink)}
.np-note{color:var(--faint);font-size:12px;line-height:1.55;margin:16px 0 0}
.pin-row{display:flex;align-items:center;gap:13px;margin-top:14px}
.pin-readout{display:flex;flex-direction:column;gap:3px}
.chip-hex{font-size:15px;font-weight:560}
.inp-meta{color:var(--faint);font-size:11.5px}

.section-lab{margin:56px 0 26px;padding-bottom:16px;border-bottom:1px solid var(--line)}
.section-t{margin:0;font-size:22px;font-weight:640;letter-spacing:-0.025em}
.section-d{margin:6px 0 0;color:var(--muted);font-size:14.5px}

.ramps{display:flex;flex-direction:column;gap:48px}
.ramp-head{display:flex;align-items:flex-end;justify-content:space-between;margin-bottom:16px}
.ramp-name{font-weight:640;font-size:17px;text-transform:capitalize;letter-spacing:-0.02em}
.ramp-anchor{font-size:12.5px;color:var(--muted)}
.ramp-anchor b{color:var(--ink2);font-weight:600}
.band{margin-bottom:16px}
.band:last-child{margin-bottom:0}
.strip{display:flex;border-radius:var(--r-sm);overflow:hidden;border:1px solid var(--line2)}
.sw{flex:1;height:72px;position:relative}
.sw.is-anchor::after{content:"";position:absolute;inset:0;border:2.5px solid var(--ink);border-radius:2px;pointer-events:none}
.flag{position:absolute;top:8px;left:8px;font-size:9px;letter-spacing:.05em;text-transform:uppercase;background:rgba(255,255,255,.94);color:var(--ink);padding:2px 6px;border-radius:4px;font-weight:700}
.labs{display:flex;margin-top:9px}
.lab{flex:1;display:flex;flex-direction:column;gap:2px;padding:0 6px}
.lab-step{font-size:12px;font-weight:600;color:var(--ink2)}
.lab-step.on{color:var(--ink);font-weight:700}
.lab-hex{font-size:11px;color:var(--faint)}
.ramp-head-right{display:flex;align-items:center;gap:14px}
.ramp-ctl{display:flex;align-items:center;gap:8px}
.ramp-ctl-sel{font:inherit;font-size:12.5px;padding:5px 9px;border:1px solid var(--line2);border-radius:var(--r-sm);background:var(--panel);color:var(--ink);cursor:pointer}
.ramp-ctl-pick{width:30px;height:27px;padding:0;border:1px solid var(--line2);border-radius:var(--r-sm);background:none;cursor:pointer}
.ramp-borrowed .strip-mini{display:flex;border-radius:var(--r-sm);overflow:hidden;border:1px solid var(--line2)}
.ramp-borrowed .sw-mini{flex:1;height:30px}

.sub-lab{margin:22px 0 10px}
.sub-lab:first-child{margin-top:6px}
.sub-t{font-size:11.5px;font-weight:600;text-transform:uppercase;letter-spacing:0.07em;color:var(--faint);margin:0}
.knob{padding:14px 0;border-bottom:1px solid var(--line)}
.knob:last-child{border-bottom:0}
.knob.nested{margin-left:16px;padding-left:16px;border-left:2px solid var(--line)}
.knob-label{display:block;font-weight:600;font-size:13.5px}
.knob-body{display:flex;align-items:center;gap:10px;margin-top:8px}
.knob input[type=range]{flex:1;accent-color:var(--ink)}
.knob input.toggle{width:20px;height:20px;accent-color:var(--ink);cursor:pointer}
.knob input:disabled{opacity:.5}
.knob select{margin-top:8px;padding:6px 8px;border:1px solid var(--line2);border-radius:var(--r-xs);font:inherit;background:var(--paper)}
.knob select:disabled{opacity:.6}
.knob-val{font-variant-numeric:tabular-nums;color:var(--muted);font-size:12.5px}
.knob-val.ro{margin-top:6px}
.knob-desc{margin:7px 0 0;font-size:12px;color:var(--faint);line-height:1.5}
.type-editor{margin-bottom:8px}
.te-font{width:100%;margin-top:8px;padding:7px 9px;border:1px solid var(--line2);border-radius:var(--r-xs);font:inherit;background:var(--paper)}
.te-wrow{display:flex;align-items:center;justify-content:space-between;gap:12px}
.te-weight{width:88px;padding:6px 8px;border:1px solid var(--line2);border-radius:var(--r-xs);font:inherit;background:var(--paper);font-variant-numeric:tabular-nums;text-align:right}
.te-cat-wrap{overflow-x:auto;border:1px solid var(--line);border-radius:var(--r);background:var(--panel);margin-top:8px}
.te-cat{border-collapse:collapse;width:100%;font-size:12.5px}
.te-cat th,.te-cat td{padding:8px 10px;border-bottom:1px solid var(--line);text-align:center;white-space:nowrap}
.te-cat th{font-size:11px;font-weight:600;color:var(--muted);text-transform:lowercase;letter-spacing:0.02em}
.te-cat tr:last-child td{border-bottom:none}
.te-cat th:first-child,.te-cat td:first-child,.te-cat th:nth-child(2),.te-cat td:nth-child(2){text-align:left}
.te-cat-name{color:var(--ink);font-size:12px}
.te-c{width:1%}
.te-cat input[type=checkbox]{width:15px;height:15px;accent-color:var(--ink);cursor:pointer}
.te-cbwrap{position:relative;display:inline-flex;align-items:center;justify-content:center}
.te-warn{position:absolute;top:-7px;right:-9px;font-size:10px;line-height:1;pointer-events:none}
.te-cat td.unavail input[type=checkbox]{opacity:.32}
.te-cat td.unavail{background:repeating-linear-gradient(-45deg,transparent,transparent 4px,rgba(120,120,130,.06) 4px,rgba(120,120,130,.06) 5px)}
.te-cat-note{margin:10px 2px 0;font-size:11.5px;line-height:1.5;color:var(--faint)}
.te-fam{padding:5px 7px;border:1px solid var(--line2);border-radius:var(--r-xs);font:inherit;font-size:12px;background:var(--paper);cursor:pointer}
.obj-editor{margin-bottom:8px}
.obj-lede{margin:0 0 8px;font-size:12px;color:var(--faint);line-height:1.5}
.obj-row{display:flex;gap:8px;margin-top:8px}
.obj-sel{flex:1;min-width:0;padding:7px 9px;border:1px solid var(--line2);border-radius:var(--r-xs);font:inherit;font-size:12.5px;background:var(--paper);cursor:pointer}

.stage-vol{display:flex;flex-direction:column}
.pvhost{display:flex;flex-direction:column;gap:16px}
.type-spec{margin-bottom:8px}
.ts-list{display:flex;flex-direction:column;gap:22px;border:1px solid var(--line);border-radius:var(--r);padding:24px;background:var(--panel)}
.ts-row{display:flex;flex-direction:column;gap:8px;min-width:0}
.ts-meta{font-size:11.5px;color:var(--faint)}
.ts-sample{color:var(--ink);letter-spacing:-0.02em;line-height:1.1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.shadow-spec{margin-bottom:8px}
.sh-list{display:flex;flex-wrap:wrap;gap:28px;border:1px solid var(--line);border-radius:var(--r);padding:28px 24px;background:#f4f5f7}
.sh-cell{display:flex;flex-direction:column;align-items:center;gap:10px}
.sh-card{width:64px;height:64px;border-radius:10px;background:#fff}
.sh-lab{font-size:11.5px;color:#5b6472}
.motion-spec{margin-bottom:8px}
.mo-list{display:flex;flex-direction:column;gap:16px;border:1px solid var(--line);border-radius:var(--r);padding:22px 24px;background:var(--panel)}
.mo-row{display:flex;flex-direction:column;gap:7px;min-width:0}
.mo-meta{font-size:11.5px;color:var(--faint)}
.mo-track{position:relative;height:8px;background:var(--line2);border-radius:999px;overflow:hidden}
.mo-fill{height:100%;width:100%;background:var(--ink);border-radius:999px;transform-origin:left;animation-name:mo-fill;animation-iteration-count:1;animation-fill-mode:both}
@keyframes mo-fill{from{transform:scaleX(0.02)}to{transform:scaleX(1)}}
.mo-replay{margin-top:14px;border:1px solid var(--line2);background:var(--panel);border-radius:var(--r-sm);padding:7px 14px;font:inherit;font-size:12.5px;color:var(--ink2);cursor:pointer}
.mo-replay:hover{border-color:var(--ink);color:var(--ink)}
@media (prefers-reduced-motion:reduce){.mo-fill{animation:none;transform:scaleX(1)}}
.radius-spec{margin-bottom:8px}
.rad-list{display:flex;flex-wrap:wrap;gap:24px;border:1px solid var(--line);border-radius:var(--r);padding:24px;background:var(--panel)}
.rad-cell{display:flex;flex-direction:column;align-items:center;gap:9px;min-width:72px}
.rad-sw{width:72px;height:52px;background:var(--ink);opacity:.85}
.rad-lab{font-size:11.5px;color:var(--muted)}
.rad-cons{font-size:11px;color:var(--faint);text-align:center;max-width:88px;line-height:1.35}
.inverse-spec{margin-bottom:8px}
.inv-band{border-radius:var(--r);padding:36px 32px;display:flex;flex-direction:column;align-items:flex-start;gap:20px}
.inv-h{font-size:24px;font-weight:700;letter-spacing:-0.02em;max-width:26ch}
.inv-cta{padding:10px 22px;border-radius:var(--r-xs);font-weight:600;font-size:14px}
.neutral-spec{margin-bottom:8px}
.ne-list{display:flex;flex-wrap:wrap;gap:22px;border:1px solid var(--line);border-radius:var(--r);padding:24px;background:var(--panel)}
.ne-cell{display:flex;flex-direction:column;align-items:center;gap:10px;padding:12px;border-radius:var(--r-xs);border:2px solid transparent}
.ne-cell.on{border-color:var(--ink);background:var(--paper)}
.ne-btn{padding:10px 22px;border-radius:var(--r-xs);font-weight:600;font-size:14px}
.ne-lab{font-size:11.5px;color:var(--muted)}
.gradient-spec{margin-bottom:8px}
.gr-list{display:flex;flex-wrap:wrap;gap:22px;border:1px solid var(--line);border-radius:var(--r);padding:24px;background:var(--panel)}
.gr-cell{display:flex;flex-direction:column;gap:10px}
.gr-sw{width:200px;height:96px;border-radius:var(--r-xs);border:1px solid var(--line)}
.gr-lab{font-size:11.5px;color:var(--muted)}
.icon-spec{margin-bottom:8px}
.ic-block{border:1px solid var(--line);border-radius:var(--r);background:var(--panel);padding:18px 22px;margin-top:10px}
.ic-cap{font-size:11px;color:var(--faint);letter-spacing:0.04em;text-transform:uppercase;margin-bottom:14px}
.ic-tiles{display:flex;flex-wrap:wrap;gap:20px}
.ic-tile{display:flex;flex-direction:column;align-items:center;gap:9px}
.ic-chip{width:48px;height:48px;display:grid;place-items:center;border-radius:11px}
.ic-lab{font-size:11px;color:var(--faint)}
.modebar{display:flex;align-items:center;gap:8px}
.mb-cap{font-size:12px;color:var(--muted);margin-right:4px}
.modebtn{border:1px solid var(--line2);background:var(--panel);border-radius:var(--r-sm);padding:6px 12px;cursor:pointer;font:inherit;font-size:13px;color:var(--muted)}
.modebtn.on{background:var(--ink2);color:#fff;border-color:var(--ink2)}
.preview{border:1px solid var(--line);border-radius:var(--r);padding:20px;background:#fff}
.pvcomp{margin-bottom:18px}
.pvcomp:last-child{margin-bottom:0}
.pvcomp h4{margin:0 0 8px;font-size:13px}
.chips{display:flex;flex-wrap:wrap;gap:10px}
.pv-contrasts{display:flex;flex-wrap:wrap;gap:6px;margin-top:10px}
.cbadge{display:inline-flex;align-items:center;gap:6px;padding:3px 8px;border-radius:999px;font-size:11px;border:1px solid var(--line2)}
.cbadge.ok{background:rgba(26,156,82,.09);border-color:rgba(26,156,82,.35)}
.cbadge.no{background:rgba(221,51,51,.09);border-color:rgba(221,51,51,.4)}
.cb-lab{color:var(--muted)}
.cb-ratio{font-variant-numeric:tabular-nums;font-weight:600}
.cbadge.ok .cb-mark{color:#1a9c52}.cbadge.no .cb-mark{color:#d23}
.pv-paths{display:flex;flex-wrap:wrap;gap:5px;margin-top:8px}
.tpill{font-size:10.5px;padding:2px 7px;border-radius:5px;background:var(--panel);border:1px solid var(--line);color:var(--faint)}
.tpill.more{color:var(--muted);font-style:italic}
/* #161 — interactive-color card */
.ic-card{border:1px solid var(--line);border-radius:var(--r);background:var(--panel);padding:22px;margin-bottom:14px}
.ic-top{display:flex;gap:22px;align-items:flex-start}
.ic-big{width:150px;height:150px;flex:none;border-radius:var(--r-sm);border:1px solid var(--line)}
.ic-mid{flex:1;min-width:0;display:flex;flex-direction:column;gap:12px;align-items:flex-start}
.ic-h{margin:0;font-size:15px;font-weight:620;color:var(--ink)}
.ic-step{max-width:260px;padding:9px 11px;border:1px solid var(--line2);border-radius:var(--r-xs);font:inherit;font-size:13.5px;background:var(--paper);cursor:pointer}
.ic-example{flex:none;width:270px;align-self:stretch;display:grid;place-items:center;background:var(--paper);border:1px solid var(--line);border-radius:var(--r-sm)}
.ic-btn{padding:14px 28px;border-radius:var(--r-sm);font-weight:600;font-size:15px}
.ic-descrow{display:flex;align-items:center;gap:16px;margin-top:18px}
.ic-desc{margin:0;flex:1;font-size:13px;line-height:1.5;color:var(--muted)}
.ic-descrow .cbadge{flex:none;font-size:12.5px;padding:5px 11px}
.ic-states-h{margin:22px 0 12px;font-size:14px;font-weight:620;color:var(--ink)}
.ic-states{display:grid;grid-template-columns:1fr 1fr;gap:14px}
.ic-sub{display:flex;gap:14px;align-items:center;border:1px solid var(--line);border-radius:var(--r-sm);padding:16px;background:var(--paper)}
.ic-subsw{width:64px;height:64px;flex:none;border-radius:var(--r-xs);border:1px solid var(--line)}
.ic-subt{min-width:0;display:flex;flex-direction:column;gap:6px;align-items:flex-start}
.ic-sublab{font-weight:620;font-size:14px;color:var(--ink)}
.ic-substep{font-size:13px;color:var(--muted)}
.chip{padding:8px 14px;border-radius:8px;font-weight:600;font-size:13px}
.contracts{border:1px solid var(--line);border-radius:var(--r);background:var(--panel);padding:18px 20px}
.contracts-sum{list-style:none;cursor:pointer;display:flex;align-items:baseline;gap:10px}
.contracts-sum::-webkit-details-marker{display:none}
.contracts-sum::before{content:'▸';color:var(--faint);font-size:11px;align-self:center;transition:transform .12s ease}
.contracts[open] .contracts-sum::before{transform:rotate(90deg)}
.contracts-t{font-size:15px;font-weight:620;color:var(--ink)}
.contracts-hint{font-size:11.5px;font-weight:500;color:var(--faint)}
.contracts:not([open]) .np-note{display:none}
.ctable{width:100%;border-collapse:collapse;margin-top:12px;font-size:12px}
.ctable th,.ctable td{text-align:left;padding:7px 8px;border-bottom:1px solid var(--line)}
.ctable .mcol{text-align:center}
.pair{color:var(--ink2)}
.dot{display:inline-block;width:8px;height:8px;border-radius:999px;margin-right:5px;vertical-align:middle}
.dot.ok{background:#1a9c52}.dot.no{background:#d23}
.ratio{font-variant-numeric:tabular-nums;color:var(--muted)}
.errbar{border:1px solid #f2c6c6;background:#fdecec;color:#a12;border-radius:var(--r-sm);padding:10px 14px;font-size:13px;margin-bottom:16px}

@media(max-width:900px){.shell{grid-template-columns:1fr;gap:40px}.rail{position:static}.panels{grid-template-columns:1fr}}
`;
const styleEl = document.createElement('style');
styleEl.textContent = STYLE;
document.head.append(styleEl);

build();
