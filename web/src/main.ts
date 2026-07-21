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
import type { BrandInput, Theme, GradientInput } from '../../Prism3/engine/theme';
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
// The rail is data (docs/23 §7): a flat list of focused destinations, each one page. A page's facets
// are sections within it, not separate rail rows. `view:true` marks a non-authoring destination
// (Preview) — it sits after a divider with no ordinal. Order is the sequence a theme composes in:
// primitives → how they're applied (surfaces / interactive) → type → form (elevation/size/layout/motion)
// → look at the whole (Preview).
const NAV = [
  { key: 'palettes', label: 'Palettes', sub: 'Brand hues & neutrals → ramps' },
  { key: 'surfaces', label: 'Surfaces / fills', sub: 'Backgrounds, text & ink, gradients' },
  { key: 'interactive', label: 'Interactive', sub: 'Action colors, states, a11y' },
  { key: 'typography', label: 'Typography', sub: 'Families, weights → type scale' },
  { key: 'elevation', label: 'Elevation', sub: 'Shadows' },
  { key: 'sizeRadius', label: 'Size & radius', sub: 'Size, density, corner radius' },
  { key: 'layout', label: 'Layout', sub: 'Breakpoints & containers' },
  { key: 'motion', label: 'Motion', sub: 'Tempo & easing' },
  { key: 'preview', label: 'Preview', sub: 'Components & contrast, all modes', view: true },
] as const;
type PageKey = (typeof NAV)[number]['key'];
let page: PageKey = 'palettes';

// Which page a lever belongs to. The manifest groups levers under a few axes; the focused pages slice
// finer. Palette colour primitives get a bespoke UI, so they're excluded from the generic knob render.
// Status hues are edited inline on Palettes ramps (they're advanced + colour-control, so they filter
// out of every generic panel anyway). The `color` + `advanced` groups split by key across pages.
const PRIMITIVE_KEYS = new Set(['primary', 'neutral.hue', 'neutral.chroma', 'neutral.anchor', 'brandColors']);
const pageOfLever = (l: Lever): PageKey => {
  if (l.group === 'type') return 'typography';
  if (l.group === 'motion') return 'motion';
  if (l.group === 'elevation') return 'elevation';
  if (l.group === 'layout') return 'layout';
  if (l.group === 'form') return 'sizeRadius';   // radiusScale, density, + advanced grid/space dims
  if (l.key === 'gradients' || l.key === 'surfaces') return 'surfaces';
  return 'interactive';   // remaining colour/advanced: action palette, interactive treatment, disabled, icon, inverse, neutralEmphasis, interactivePalettes
};
const leversFor = (key: PageKey): Lever[] => leverManifest.filter((l) => !l.advanced && !PRIMITIVE_KEYS.has(l.key) && pageOfLever(l) === key);
const leverByKey = (k: string): Lever | undefined => leverManifest.find((l) => l.key === k);

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
// renderModeStrip repaints the persistent header mode-selector (#171 promoted to the global header,
// docs/23 §7) — its per-mode contrast ✓/✗ marks track the theme, so every edit refreshes it too.
const apply = (): void => { rebuild(); renderModeStrip(); paintVolatile(); };
const applyFull = (): void => { rebuild(); renderModeStrip(); renderWorkspace(); };

// ---- DOM helpers -----------------------------------------------------------
const el = (tag: string, cls?: string, text?: string): HTMLElement => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text !== undefined) n.textContent = text;
  return n;
};
const chunk = <T>(a: T[], n: number): T[][] => { const o: T[][] = []; for (let i = 0; i < a.length; i += n) o.push(a.slice(i, i + n)); return o; };

// ---- control kit — the reusable vocabulary every knob + select is built from ----------------------
// Small structural primitives shared by renderControl and the bespoke editors, so a control (or a whole
// screen in the IA reorg) composes from these rather than re-deriving the `knob` scaffold and the
// `<option>` boilerplate each time. Purely structural — they produce exactly the nodes the hand-rolled
// versions did; behaviour and styling are unchanged.
/** An `<option>` with value/text and optional pre-selection — replaces the per-site opt/optE/mkOpt closures. */
const optionEl = (value: string, text: string, selected = false): HTMLOptionElement => {
  const o = document.createElement('option');
  o.value = value; o.textContent = text; if (selected) o.selected = true;
  return o;
};
/** The dashboard `<select>` (doc 24 C1). One `.select` base class owns all dropdown cosmetics — border,
 *  radius, background, and the shared chevron — so a styling tweak lands in one place. Size / context are
 *  additive modifiers: `sm` (compact inline) · `fill` (flex to its row) · `cap` (max-width, for cards).
 *  Callers append their own `<option>`s (option-building varies too much to generalise). */
const selectEl = (mods = ''): HTMLSelectElement => el('select', mods ? `select ${mods}` : 'select') as HTMLSelectElement;
/** A number `<input>` (doc 24 C2). The `.num` base owns the shared field cosmetics (border, radius,
 *  background, padding); the caller passes a context class for width/size and wires its own `onchange`. */
const numberField = (o: { value: string | number; min?: number | string; max?: number | string; step?: number | string; className?: string; title?: string }): HTMLInputElement => {
  const inp = el('input', o.className ? `num ${o.className}` : 'num') as HTMLInputElement;
  inp.type = 'number';
  if (o.min != null) inp.min = String(o.min);
  if (o.max != null) inp.max = String(o.max);
  if (o.step != null) inp.step = String(o.step);
  inp.value = String(o.value);
  if (o.title) inp.title = o.title;
  return inp;
};
/** A range `<input>` (doc 24 C5b). Just the element construction (type/bounds/value/class) — the
 *  readout + wiring stay per-site, since the surrounding layouts genuinely differ (a `.slider-top`
 *  readout, a `.knob-val`, an auto-pruning knob, a label-as-readout). `className` may be omitted for
 *  the knob-context sliders styled by the `.knob input[type=range]` descendant rule. */
const rangeInput = (o: { value: string | number; min?: number | string; max?: number | string; step?: number | string; className?: string }): HTMLInputElement => {
  const inp = el('input', o.className) as HTMLInputElement;
  inp.type = 'range';
  if (o.min != null) inp.min = String(o.min);
  if (o.max != null) inp.max = String(o.max);
  if (o.step != null) inp.step = String(o.step);
  inp.value = String(o.value);
  return inp;
};
/** The on/off toggle switch (doc 24 C3) — a `.toggle` checkbox paired with its On/Off `.knob-val`
 *  readout, returned as a `knobBody`. `onToggle(checked)` fires after the readout updates; the caller
 *  runs its own `apply()` / `applyFull()`. */
const toggleField = (checked: boolean, onToggle: (checked: boolean) => void): HTMLElement => {
  const input = el('input') as HTMLInputElement;
  input.type = 'checkbox'; input.className = 'toggle'; input.checked = checked;
  const val = el('span', 'knob-val', checked ? 'On' : 'Off');
  input.onchange = () => { val.textContent = input.checked ? 'On' : 'Off'; onToggle(input.checked); };
  return knobBody(input, val);
};
/** A token-path chip (doc 24 C4) — the small mono pill that shows a DTCG/role path. */
const tokenPill = (path: string): HTMLElement => el('span', 'tpill mono', path);
/** A dashed "+ add" button (doc 24 C4). `.addbtn` owns the styling; pass context classes (width/margin)
 *  via `cls`. */
const addButton = (label: string, onClick: () => void, cls = ''): HTMLButtonElement => {
  const btn = el('button', cls ? `addbtn ${cls}` : 'addbtn', label) as HTMLButtonElement;
  btn.onclick = onClick;
  return btn;
};
/** A round "×" remove button (doc 24 C4). */
const removeButton = (onClick: () => void, title = 'Remove', cls = ''): HTMLButtonElement => {
  const btn = el('button', cls ? `rx ${cls}` : 'rx', '×') as HTMLButtonElement;
  btn.title = title; btn.onclick = onClick;
  return btn;
};
/** The `div.knob-body` row — a control input paired with its `knob-val` readout (slider / toggle). */
const knobBody = (...kids: Node[]): HTMLElement => { const r = el('div', 'knob-body'); r.append(...kids); return r; };
/** The knob scaffold: `label.knob-label`, the control body (one node or several), then `p.knob-desc`.
 *  Every control — generic or bespoke — shares this shape. */
const knob = (label: string, body: Node | Node[], desc: string): HTMLElement => {
  const wrap = el('div', 'knob');
  wrap.append(el('label', 'knob-label', label));
  wrap.append(...(Array.isArray(body) ? body : [body]));
  wrap.append(el('p', 'knob-desc', desc));
  return wrap;
};
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

// Palette selectors for the three primitive sections — each control card is paired
// with exactly the ramps it drives (#158), so a change is always visible beside it.
const brandPalettes = (): Theme['palettes'] => theme.palettes.filter((p) => p.role === 'brand');
const neutralPalettes = (): Theme['palettes'] => theme.palettes.filter((p) => p.palette === 'neutral');
const statusPalettes = (): Theme['palettes'] => theme.palettes.filter((p) => p.role !== 'brand' && p.palette !== 'neutral');

/** Paint one section's ramps into its own volatile container.
 *  `error`   — surface the last-valid-palettes banner (brand section only).
 *  `borrowed`— append the compact reference row for any status role that borrows a
 *              brand palette (its own ramp is PRUNED from the set, so its control
 *              would otherwise be unreachable). */
const paintRampList = (host: HTMLElement, palettes: Theme['palettes'], opts: { error?: boolean; borrowed?: boolean } = {}): void => {
  host.innerHTML = '';
  if (opts.error && lastError) host.append(el('div', 'errbar', `This combination doesn't resolve: ${lastError} — showing the last valid palettes.`));
  const shown = new Set<string>();
  for (const p of palettes) {
    const isStatus = (STATUS_ROLES as readonly string[]).includes(p.palette);
    if (isStatus) shown.add(p.palette);
    host.append(rampEl(p.palette, p.steps, anchorStepFor(p.palette), isStatus ? statusRampControl(p.palette as StatusRole) : undefined));
  }
  if (opts.borrowed)
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
    if (removable) row.append(removeButton(removable, 'Remove color'));
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

  const add = addButton('+ Add color', () => {
    const names = new Set(list.map((b) => b.name));
    let n = list.length + 1, nm = `accent${n}`;
    while (names.has(nm)) nm = `accent${++n}`;
    list.push({ name: nm, oklch: { l: 0.55, c: 0.15, h: 235 } });
    applyFull();
  });
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
      const input = rangeInput({ className: 'range', min, max, step, value: getPath(brandState, key) as number });
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

/** One primitive section: its control card pinned beside the ramps it drives. */
const primSection = (card: HTMLElement, ramps: HTMLElement): HTMLElement => {
  const row = el('div', 'prim-sec');
  row.append(card, ramps);
  return row;
};

const renderPrimitives = (host: HTMLElement): void => {
  host.append(hero('Start from your brand colors.',
    'Give the engine your exact hues. It grows each into a gamut-aware, contrast-placed ramp and pins your color as the anchor — never shifted. Every semantic role downstream aliases these.'));

  // Brand — the brand-colors card beside the primary + accent ramps it grows.
  host.append(sectionHead('Brand palettes', 'Each brand color grown into a gamut-aware, contrast-placed ramp — your color pinned as the anchor, never shifted.'));
  const brandRamps = el('div', 'ramps');
  host.append(primSection(renderBrandColors(), brandRamps));

  // Neutral — the cast card beside the greyscale ramp it re-tunes, so the effect is visible.
  host.append(sectionHead('Neutral', 'The greyscale ramp carries a trace of the brand hue for cohesion. The cast beside it re-tunes the whole ramp live.'));
  const neutralRamps = el('div', 'ramps');
  host.append(primSection(renderNeutral(), neutralRamps));

  // Validation — the status ramps every semantic role aliases; each carries its own inline control.
  host.append(sectionHead('Validation colors', 'The success / warning / danger / info ramps every semantic role aliases — borrow a brand palette or tune each independently.'));
  const statusRamps = el('div', 'ramps');
  host.append(statusRamps);

  paintVolatile = () => {
    paintRampList(brandRamps, brandPalettes(), { error: true });
    paintRampList(neutralRamps, neutralPalettes());
    paintRampList(statusRamps, statusPalettes(), { borrowed: true });
  };
  paintVolatile();
};

// ===========================================================================
// Generic lever controls + the bespoke editors the focused pages compose from
// ===========================================================================

const renderControl = (lever: Lever): HTMLElement => {
  const live = LIVE_CONTROLS.has(lever.control);
  let body: HTMLElement;

  if (lever.control === 'slider') {
    const input = rangeInput({ min: lever.min, max: lever.max, step: lever.step, value: (getPath(brandState, lever.key) ?? lever.default ?? lever.min ?? 0) as number });
    input.disabled = !live;
    const val = el('span', 'knob-val', `${input.value}${lever.unit ?? ''}`);
    if (live) input.oninput = () => { setPath(brandState, lever.key, Number(input.value)); val.textContent = `${input.value}${lever.unit ?? ''}`; apply(); };
    body = knobBody(input, val);
  } else if (lever.control === 'palette-ref' && live) {
    const sel = selectEl('sm');
    const palettes = ['primary', ...(brandState.brandColors ?? []).map((b) => b.name)];
    const cur = String(getPath(brandState, lever.key) ?? lever.default ?? 'primary');
    for (const p of palettes) sel.append(optionEl(p, p, p === cur));
    sel.onchange = () => { setPath(brandState, lever.key, sel.value); apply(); };
    body = sel;
  } else if (lever.control === 'enum') {
    const sel = selectEl('sm');
    const cur = getPath(brandState, lever.key) ?? lever.default;
    for (const o of lever.options ?? []) sel.append(optionEl(String(o.value), o.label, o.value === cur));
    sel.disabled = !live;
    if (live) sel.onchange = () => { setPath(brandState, lever.key, sel.value); apply(); };
    body = sel;
  } else if (lever.control === 'toggle') {
    // Boolean axis. `checked` reads truthy — so `gradients` renders "on" whether it's `true`
    // or an explicit gradient array (the array is only reset if the user toggles off). Toggling
    // writes a plain boolean: on → the default (single gradient / inverse inks), off → false.
    body = toggleField(!!(getPath(brandState, lever.key) ?? lever.default), (checked) => { setPath(brandState, lever.key, checked); apply(); });
  } else {
    const v = getPath(brandState, lever.key) ?? lever.default;
    let text: string;
    if (Array.isArray(v)) text = v.map((it: any) => it?.name).filter(Boolean).join(', ') || `${v.length} item(s)`;
    else if (v && typeof v === 'object') text = 'configured';
    else text = String(v ?? lever.itemLabel ?? '—');
    body = el('div', 'knob-val ro', text);
  }
  return knob(lever.label, body, lever.description);
};

// ---- per-mode modeLevers read/write (single source for every per-mode editor) ---------------------
// The per-mode lever axes (radius/tempo/density selects, the typography family/weight/leading/tracking
// editors, the shadow softness/tint sliders) all read + write `brandState.modeLevers[mode].<path>` with
// the SAME prune-to-byte-identical invariant: a mode whose overrides are all cleared must revert to
// exactly the no-override state. These three helpers own that so no editor re-implements it (and can't
// drift from it). `path` is a dot path into the mode entry (e.g. 'radius', 'families.display',
// 'shadow.tint.hue').
const getModeLever = (mode: string, path: string): unknown => {
  let node: any = brandState.modeLevers?.[mode];
  for (const p of path.split('.')) { if (node == null) return undefined; node = node[p]; }
  return node;
};
/** Drop empty nested maps and the mode entry (and modeLevers itself) so an all-cleared mode is byte-
 *  identical to never having had an override. */
const pruneModeLevers = (mode: string): void => {
  const ml = brandState.modeLevers; if (!ml) return;
  const e = ml[mode];
  const dropEmpties = (o: any): void => {
    for (const k of Object.keys(o)) {
      const v = o[k];
      if (v && typeof v === 'object' && !Array.isArray(v)) { dropEmpties(v); if (!Object.keys(v).length) delete o[k]; }
    }
  };
  if (e) { dropEmpties(e); if (!Object.keys(e).length) delete ml[mode]; }
  if (!Object.keys(ml).length) brandState.modeLevers = undefined;
};
/** Set `modeLevers[mode].<path>` to `value` (creating the nested maps), or delete it when `value` is
 *  undefined / '' — then prune empties. Does NOT re-render (callers pick apply/applyFull). */
const setModeLever = (mode: string, path: string, value: unknown): void => {
  const ml = brandState.modeLevers ?? (brandState.modeLevers = {});
  const e: any = ml[mode] ?? (ml[mode] = {});
  const parts = path.split('.');
  const last = parts.pop()!;
  let node: any = e;
  for (const p of parts) node = node[p] ?? (node[p] = {});
  if (value !== undefined && value !== '') node[last] = value; else delete node[last];
  pruneModeLevers(mode);
};

/** A per-mode enum select with a natural "Auto" (follows the global lever). Shared by the radius / motion
 *  tempo / density controls — outside the base mode they edit `modeLevers[mode].<key>` instead of the
 *  global. A hand-authored value that matches no discrete option is surfaced as its own "(custom)" option
 *  rather than silently reading as Auto. `parse` maps the selected string to the stored value. */
const renderPerModeSelect = (lever: Lever, key: string, opts: [string, string][], globalOf: () => string, parse: (s: string) => unknown, autoNote: string): HTMLElement => {
  const cur = getModeLever(currentMode, key);
  const sel = selectEl('sm fill');
  sel.append(optionEl('', `Auto — follows global (${globalOf()})`, cur == null));
  let matched = false;
  for (const [v, label] of opts) { const on = String(cur) === v; matched ||= on; sel.append(optionEl(v, label, on)); }
  if (cur != null && !matched) sel.append(optionEl(String(cur), `${cur} (custom)`, true));
  sel.onchange = () => { setModeLever(currentMode, key, sel.value === '' ? undefined : parse(sel.value)); applyFull(); };
  const desc = `${lever.description} — per ${MODE_LABEL[currentMode] ?? currentMode}; “Auto” follows the global ${autoNote}.`;
  return knob(lever.label, sel, desc);
};
const RADIUS_SCALE_OPTS: [string, string][] = [['0', '0 · sharp'], ['0.5', '0.5'], ['1', '1 · default'], ['1.5', '1.5'], ['2', '2 · soft']];
const TEMPO_OPTS: [string, string][] = [['snappy', 'Snappy'], ['standard', 'Standard'], ['relaxed', 'Relaxed']];
const DENSITY_OPTS: [string, string][] = [['compact', 'Compact'], ['comfortable', 'Comfortable'], ['spacious', 'Spacious']];
const renderPerModeRadius = (lever: Lever): HTMLElement =>
  renderPerModeSelect(lever, 'radius', RADIUS_SCALE_OPTS, () => String(brandState.radiusScale ?? (lever.default as number) ?? 1), Number, 'corner softness');
const renderPerModeTempo = (lever: Lever): HTMLElement =>
  renderPerModeSelect(lever, 'tempo', TEMPO_OPTS, () => String(brandState.motionPersonality?.tempo ?? (lever.default as string) ?? 'standard'), (s) => s, 'tempo');
const renderPerModeDensity = (lever: Lever): HTMLElement =>
  renderPerModeSelect(lever, 'density', DENSITY_OPTS, () => String(brandState.density ?? (lever.default as string) ?? 'comfortable'), (s) => s, 'density');

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

/** The all-modes contrast table (Pair · a mode column each · dot + ratio). Shared by the Preview master
 *  table and the per-page section tables (docs/23 §3) — one authoritative renderer, re-sliced by the
 *  caller's contract list. `paths` shows the raw `fg on bg` token paths (the section tables, which sit
 *  next to their controls where the component context is already obvious) with the human label as a
 *  subtitle; the master table keeps the descriptive `component · variant — label`. */
const pairCellEl = (ct: typeof rp.contracts[number], paths: boolean): HTMLElement => {
  const td = el('td', 'pair');
  if (paths) {
    td.append(el('span', 'pair-path mono', `${ct.fg.replace(/^color\./, '')} on ${ct.bg.replace(/^color\./, '')}`));
    if (ct.label) td.append(el('span', 'pair-sub', ct.label));
  } else {
    td.textContent = `${ct.component} · ${ct.variant} — ${ct.label ?? `${ct.min}:1`}`;
  }
  return td;
};
const contractTableEl = (contracts: typeof rp.contracts, paths = false): HTMLElement => {
  const table = el('table', 'ctable');
  const thead = el('tr');
  thead.append(el('th', undefined, paths ? 'Foreground on background' : 'Pair'));
  for (const m of rp.modes) thead.append(el('th', 'mcol', MODE_LABEL[m] ?? m));
  table.append(thead);
  for (const ct of contracts) {
    const tr = el('tr');
    tr.append(pairCellEl(ct, paths));
    for (const m of rp.modes) {
      const cell = el('td', 'mcol');
      const r = ct.byMode[m];
      if (r) { cell.append(el('span', `dot ${r.pass ? 'ok' : 'no'}`), el('span', 'ratio', r.ratio.toFixed(2))); }
      else cell.textContent = '—';
      tr.append(cell);
    }
    table.append(tr);
  }
  return table;
};

// ---- Preview segments (docs/23 §7) ----------------------------------------
// The Preview destination has three views behind a segmented switcher: the component gallery, the
// all-modes contract master table, and a category-grouped token list. All read the mode picked in the
// global header for their per-mode columns/rendering.

/** UI preview — the component gallery for the active mode, with inline per-component contrast badges. */
const renderPreviewGallery = (host: HTMLElement): void => {
  if (lastError) host.append(el('div', 'errbar', `This combination doesn't resolve: ${lastError} — showing the last valid theme.`));
  // Project the resolved model for the active mode onto a fresh surface (so a mode switch can't leak
  // stale vars). Chips inherit the properties and reference them via `var(--…)`.
  const surface = el('div', 'preview');
  writeHost = makeWriteHost(surface);
  writeHost.apply(rp, currentMode);
  surface.style.background = pageBg(currentMode);
  for (const c of previewSpec.components) {
    const block = el('section', 'pvcomp');
    block.append(el('h4', undefined, c.label));
    const row = el('div', 'chips');
    for (const v of c.variants) row.append(renderChip(`${c.id} · ${v.name}`, v.bindings, currentMode));
    block.append(row);
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
      for (const rref of roles.slice(0, 6)) pills.append(tokenPill(rref));
      if (roles.length > 6) pills.append(el('span', 'tpill more', `+${roles.length - 6}`));
      block.append(pills);
    }
    surface.append(block);
  }
  host.append(surface);
};

/** Contrast contracts — the full all-modes master table (verification of record). */
const renderPreviewContracts = (host: HTMLElement): void => {
  host.append(el('p', 'np-note', `Every declared a11y pair (${rp.contracts.length}), computed on the resolved colors across all modes. The per-control badges on each editing page verify the active mode at the point of edit; the per-page tables scope this to what that page governs.`));
  host.append(contractTableEl(rp.contracts));
};

// Token list — the resolved token set, grouped by category, value(s) per mode where they vary.
const tokenTableEl = (rows: Array<{ name: string; cells: Array<HTMLElement | string> }>, cols: string[]): HTMLElement => {
  const table = el('table', 'ctable');
  const thead = el('tr'); thead.append(el('th', undefined, 'Token'));
  for (const c of cols) thead.append(el('th', 'mcol', c));
  table.append(thead);
  for (const r of rows) {
    const tr = el('tr'); tr.append(el('td', 'pair mono', r.name));
    for (const c of r.cells) { const td = el('td', 'mcol'); if (typeof c === 'string') td.textContent = c; else td.append(c); tr.append(td); }
    table.append(tr);
  }
  return table;
};
const swatchCell = (hex: string | undefined): HTMLElement => {
  const wrap = el('span', 'tok-val');
  if (hex) { const sw = el('span', 'tok-sw'); sw.style.background = hex; wrap.append(sw, el('span', 'mono', hex)); }
  else wrap.append(document.createTextNode('—'));
  return wrap;
};
const renderPreviewTokens = (host: HTMLElement): void => {
  const modes = rp.modes;
  const modeLabels = modes.map((m) => MODE_LABEL[m] ?? m);
  const rolesByMode = new Map(resolveAllModes(theme).map((x) => [x.mode, x.roles as Record<string, { hex: string } | undefined>]));

  // Color — every resolved semantic role, hex per mode. (Ramp primitives live on Palettes.)
  host.append(subHead('Color'));
  host.append(el('p', 'np-note', 'The resolved semantic color roles, per mode. Brand / neutral / status ramp primitives live on the Palettes page.'));
  const roleNames = [...new Set(modes.flatMap((m) => Object.keys(rolesByMode.get(m) ?? {})))].sort();
  host.append(tokenTableEl(roleNames.map((role) => ({ name: role, cells: modes.map((m) => swatchCell(rolesByMode.get(m)?.[role]?.hex)) })), modeLabels));

  // Dimension — the px scale (space / size / radius); baseline + per-mode overrides where they differ.
  host.append(subHead('Dimension'));
  const dimRefs = Object.keys(rp.dims).sort();
  host.append(tokenTableEl(dimRefs.map((ref) => ({ name: ref, cells: modes.map((m) => `${rp.dimOverrides[ref]?.[m] ?? rp.dims[ref]}px`) })), modeLabels));

  // Typography — resolved composites (mode-invariant): family · weight · size.
  host.append(subHead('Typography'));
  const typeRefs = Object.keys(rp.type).sort();
  host.append(tokenTableEl(typeRefs.map((ref) => { const t = rp.type[ref]; return { name: ref, cells: [`${t.fontFamily} · ${t.fontWeight} · ${Math.round(t.fontSizePx)}px`] }; }), ['Resolved · shared across modes']));

  // Shadow — the elevation ramp, CSS box-shadow per mode (dark = the reduced set).
  host.append(subHead('Shadow'));
  const shRefs = Object.keys(rp.shadows).sort();
  host.append(tokenTableEl(shRefs.map((ref) => ({ name: ref, cells: modes.map((m) => { const s = rp.shadows[ref]?.[m]; if (!s) return '—'; const sp = el('span', 'tok-shadow mono', s); sp.title = s; return sp; }) })), modeLabels));
};

const PAGE_COPY: Record<PageKey, [string, string]> = {
  palettes: ['', ''],   // Palettes has its own hero in renderPrimitives
  surfaces: ['Surfaces & fills.', 'The page backgrounds every role sits on, the text/ink derived to stay readable on them, and an optional brand gradient. Text is contrast-placed — override to a specific neutral step and the badge tells you whether it still clears. (Status hues are edited per-ramp on Palettes.)'],
  interactive: ['Interactive color & states.', 'Point actions at the palette that reads best, tune the interactive treatment (hover, inverse, neutral emphasis), and set the accessibility policy — icon contrast + the disabled strategy.'],
  typography: ['Set the type system.', 'Families, weights, and the type scale that shifts the semantic→primitive size mapping. The rem ladder is brand-invariant; the scale is the dial.'],
  elevation: ['Elevation.', 'The shadow ramp — blur/offset softness and an optional brand-hued tint on the shadow base. Dark modes get a reduced set automatically.'],
  sizeRadius: ['Size & radius.', 'Component sizing (control height + paired padding, driven by density) and corner radius. Both go per-mode outside Light.'],
  layout: ['Layout.', 'Breakpoints, grid columns, and container widths — the responsive frame the system lays out within.'],
  motion: ['Motion.', 'Tempo (the duration ramp) and the emphasized easing curve. Reduce-motion is derived.'],
  preview: ['Preview your system.', 'Every sample component and the full contrast-contract table, resolved through each mode. Switch modes above to preview them — this is the one place the whole system renders together.'],
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

  const sel = selectEl('sm');
  const mkOpt = (v: string, label: string, on: boolean) => sel.append(optionEl(v, label, on));
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
// The Interactive page groups its controls into intent sub-sections. (Gradients — formerly a "Features"
// group here — now lives on the Surfaces page; page surfaces + text/ink are bespoke editors there.)
const INTERACTIVE_GROUPS: Array<{ title: string; keys: string[] }> = [
  { title: 'Interactive color', keys: ['actionPalette', 'outlineInteraction', 'inverse'] },   // neutralEmphasis moved onto the Neutral card
  { title: 'Accessibility policy', keys: ['iconContrast', 'disabledStrategy', 'disabledMin'] },
];
const NESTED_KEYS = new Set(['disabledMin']);
const subHead = (title: string): HTMLElement => { const s = el('div', 'sub-lab'); s.append(el('h3', 'sub-t', title)); return s; };
/** A bespoke object-editor section (doc 24 C6) — the `.obj-editor` wrap pre-headed with a `subHead` and,
 *  when given, an `.obj-lede` intro paragraph. Callers append their controls to the returned node. */
const objEditor = (title: string, lede?: string): HTMLElement => {
  const wrap = el('div', 'obj-editor');
  wrap.append(subHead(title));
  if (lede) wrap.append(el('p', 'obj-lede', lede));
  return wrap;
};

/** #161 — the interactive-color cards: one card per interactive column (primary + destructive + each
 *  promoted accent), each shown as a big fill swatch + a palette/step picker + its token path + a live
 *  button example + the derived contrast, with hover/pressed as sub-cards. The fill anchors on a palette
 *  STEP (auto by default; the step select writes the column's #163 anchor override); on-fill / hover /
 *  pressed are engine-derived. Reads the resolved roles for the active mode (Kind-B, like the other
 *  semantic specimens). `renderInteractiveCard` is the generic renderer; `renderInteractiveCards` builds
 *  the ordered column list + the add-accent promote row. */
const stepKeyOf = (path: string | undefined): string => (path ? path.split('.').pop()! : '');

// ---- color card component (audit §8) --------------------------------------
// The reusable card the interactive columns, the fill (foreground/background) editors, and the neutral
// card all compose from. Variants differ only in what the caller passes (a picker element, an optional
// example, an optional badge) + whether the caller appends an interactive-states section afterward.

/** "ratio:1 ✓/✗", pass/fail coloured, with an optional leading label. Shared by the cards + the preview
 *  gallery (audit §8 candidate #1). */
const contrastBadge = (ratio: number, min: number, label?: string): HTMLElement => {
  const b = el('span', `cbadge ${ratio >= min ? 'ok' : 'no'}`);
  if (label) b.append(el('span', 'cb-lab', label));
  b.append(el('span', 'cb-ratio', `${ratio.toFixed(2)}:1`), el('span', 'cb-mark', ratio >= min ? '✓' : '✗'));
  return b;
};
/** A colour swatch element with an inline background (audit §8 candidate #2). */
const swatch = (hex: string, cls = 'sw'): HTMLElement => { const s = el('div', cls); s.style.background = hex; return s; };

/** The card shell: header (label + optional remove) · top row (big swatch · mid = title + picker + token
 *  pill · optional example) · description row (+ optional contrast badge). Interactive columns append a
 *  states section to the returned node; stateless fill cards don't. */
type CardOpts = {
  label: string; onRemove?: () => void; removeTitle?: string;
  fillHex: string; midTitle: string; picker: HTMLElement; tokenPath: string;
  example?: HTMLElement; desc: string; badge?: HTMLElement;
  compactSwatch?: boolean;   // a smaller swatch for the denser fill-card grid (no example / states)
};
const renderCard = (o: CardOpts): HTMLElement => {
  const wrap = el('div', 'ic-card');
  const head = el('div', 'ic-head');
  head.append(el('h4', 'ic-headt', o.label));
  if (o.onRemove) head.append(removeButton(o.onRemove, o.removeTitle ?? 'Remove'));
  wrap.append(head);
  const top = el('div', 'ic-top');
  top.append(swatch(o.fillHex, o.compactSwatch ? 'ic-big ic-big-sm' : 'ic-big'));
  const mid = el('div', 'ic-mid');
  mid.append(el('h4', 'ic-h', o.midTitle), o.picker, tokenPill(o.tokenPath));
  top.append(mid);
  if (o.example) { const ex = el('div', 'ic-example'); ex.append(o.example); top.append(ex); }
  wrap.append(top);
  const descRow = el('div', 'ic-descrow');
  descRow.append(el('p', 'ic-desc', o.desc));
  if (o.badge) descRow.append(o.badge);
  wrap.append(descRow);
  return wrap;
};

/** A single interactive column to render as a card. `name` is the `interactive.<name>.*` role suffix
 *  (must match the engine's column naming: built-ins primary/destructive, accents `name ?? palette`). */
type ICol = {
  name: string;
  label: string;
  palette: string;
  stepValue: number | undefined;              // current anchor override (undefined = Auto)
  setStep: (v: number | undefined) => void;   // writes the right brandState field + applyFull()
  onRemove?: () => void;                        // accents only: splice + applyFull()
};

const renderInteractiveCard = (col: ICol): HTMLElement | null => {
  const m: Mode = currentMode;   // #171 — every specimen reflects the mode-context selection
  const roles = resolveAllModes(theme).find((x) => x.mode === m)?.roles as Record<string, { hex: string; path?: string; ratio?: number; min?: number } | undefined> | undefined;
  const R = (k: string) => roles?.[k];
  const rest = R(`interactive.${col.name}.fill.rest`), hover = R(`interactive.${col.name}.fill.hover`), pressed = R(`interactive.${col.name}.fill.pressed`), onFill = R(`interactive.${col.name}.on-fill`);
  if (!rest) return null;   // column's fill role doesn't resolve → render nothing for it
  const palName = col.palette;
  const palSteps = (theme.palettes.find((p) => p.palette === palName)?.steps ?? []).map((s) => s.key);

  // Step picker — the shared stepPicker (docs/24 C5). It works in palette-step KEY strings while the
  // card carries a numeric anchor, so bridge: current = the key whose number matches, and onPick maps
  // the picked key back to a number for setStep.
  const sel = stepPicker(palName, palSteps, stepKeyOf(rest.path), palSteps.find((k) => Number(k) === col.stepValue), (step) => col.setStep(step === undefined ? undefined : Number(step)));
  const btn = el('div', 'ic-btn', 'Button example'); btn.style.background = rest.hex; if (onFill) btn.style.color = onFill.hex;

  const wrap = renderCard({
    label: col.label, onRemove: col.onRemove, removeTitle: 'Remove interactive color',
    fillHex: rest.hex, midTitle: 'Surface — rest', picker: sel, tokenPath: `interactive.${col.name}.fill.rest`,
    example: btn,
    desc: 'The surface color of your buttons and interactive containers — engine-derived and gated against the page surface; the on-fill ink is auto-picked to stay legible.',
    badge: rest.ratio != null && rest.min != null ? contrastBadge(rest.ratio, rest.min) : undefined,
  });

  // Interactive states — hover + pressed as sub-cards (swatch · step · token pill). Interactive-only, so
  // it's appended by this variant rather than owned by the shared shell.
  wrap.append(el('h5', 'ic-states-h', 'Interactive states'));
  const states = el('div', 'ic-states');
  const sub = (label: string, role: { hex: string; path?: string } | undefined, path: string) => {
    if (!role) return;
    const c = el('div', 'ic-sub');
    const t = el('div', 'ic-subt');
    t.append(el('div', 'ic-sublab', label), el('div', 'ic-substep mono', `${palName} ${stepKeyOf(role.path)}`), tokenPill(path));
    c.append(swatch(role.hex, 'ic-subsw'), t); states.append(c);
  };
  sub('Hover', hover, `interactive.${col.name}.fill.hover`);
  sub('Active', pressed, `interactive.${col.name}.fill.pressed`);
  wrap.append(states);
  return wrap;
};

/** The add-accent promote row — a select of promotable palettes (`primary` + brand colors, minus any
 *  already promoted and minus the action palette, which the primary column already owns) + an add
 *  button. Pushes `{ palette }`; the engine defaults the column name to the palette. */
const renderAddAccentRow = (): HTMLElement => {
  const row = el('div', 'ic-add');
  const brandNames = (brandState.brandColors ?? []).map((b) => b.name);
  const already = new Set((brandState.interactivePalettes ?? []).map((e) => e.palette));
  const actionPal = theme.roleToPalette.action;
  // Exclude palettes whose auto-name (= the palette name) would collide with a built-in interactive
  // column — the engine rejects those. (A primary-palette accent when action is elsewhere would need a
  // custom name so it isn't auto-named 'primary'; deferred.) Also skips a brand color named neutral/destructive.
  const RESERVED_ICOL = new Set(['primary', 'neutral', 'destructive']);
  const promotable = ['primary', ...brandNames].filter((p) => !already.has(p) && p !== actionPal && !RESERVED_ICOL.has(p));
  if (!promotable.length) {
    row.append(el('span', 'ic-addhint', 'Add a brand color on Primitives to create another interactive column.'));
    return row;
  }
  const sel = selectEl('cap');
  for (const p of promotable) sel.append(optionEl(p, p));
  const btn = addButton('+ Add interactive color', () => {
    const arr = brandState.interactivePalettes ?? (brandState.interactivePalettes = []);
    arr.push({ palette: sel.value });
    applyFull();
  }, 'ic-addbtn');
  row.append(sel, btn);
  return row;
};

/** Render all interactive-color cards in order — primary, destructive, then each promoted accent —
 *  followed by the add-accent row. Replaces the single primary card (#161 increment 2). */
/** The neutral / default button as a proper interactive card (docs/23 §2, owner request) — same shell as
 *  the other columns, but its control is the (global) `neutralEmphasis` toggle (subtle grey vs bold fill)
 *  rather than a per-mode anchor step. Replaces the standalone Neutral-emphasis specimen. */
const renderNeutralCard = (): HTMLElement | null => {
  const roles = resolveAllModes(theme).find((x) => x.mode === currentMode)?.roles as Record<string, { hex: string; path?: string; ratio?: number; min?: number } | undefined> | undefined;
  const rest = roles?.['interactive.neutral.fill.rest'], hover = roles?.['interactive.neutral.fill.hover'], pressed = roles?.['interactive.neutral.fill.pressed'], onFill = roles?.['interactive.neutral.on-fill'];
  if (!rest) return null;
  const nPal = theme.roleToPalette.neutral;
  const sel = selectEl('cap');
  const cur = lastGoodInput.neutralEmphasis ?? 'subtle';
  for (const [ne, label] of NEUTRAL_EMPHASES) sel.append(optionEl(ne, label, ne === cur));
  sel.onchange = () => { setPath(brandState, 'neutralEmphasis', sel.value); applyFull(); };
  const btn = el('div', 'ic-btn', 'Button example'); btn.style.background = rest.hex; if (onFill) btn.style.color = onFill.hex;
  const wrap = renderCard({
    label: 'Neutral', fillHex: rest.hex, midTitle: 'Emphasis', picker: sel, tokenPath: 'interactive.neutral.fill.rest',
    example: btn,
    desc: 'The neutral / default button — a subtle light-grey surface or a bold near-black/white fill. The emphasis choice is shared across modes.',
    badge: rest.ratio != null && rest.min != null ? contrastBadge(rest.ratio, rest.min) : undefined,
  });
  wrap.append(el('h5', 'ic-states-h', 'Interactive states'));
  const states = el('div', 'ic-states');
  const sub = (label: string, role: { hex: string; path?: string } | undefined, path: string) => {
    if (!role) return;
    const c = el('div', 'ic-sub');
    const t = el('div', 'ic-subt');
    t.append(el('div', 'ic-sublab', label), el('div', 'ic-substep mono', `${nPal} ${stepKeyOf(role.path)}`), tokenPill(path));
    c.append(swatch(role.hex, 'ic-subsw'), t); states.append(c);
  };
  sub('Hover', hover, 'interactive.neutral.fill.hover');
  sub('Active', pressed, 'interactive.neutral.fill.pressed');
  wrap.append(states);
  return wrap;
};

const renderInteractiveCards = (host: HTMLElement): void => {
  // A2b — the interactive anchor is per-mode outside the base mode. Light edits the global baseline
  // (actionAnchorStep etc.); dark/custom edit `modeAnchors[mode][col]` — “Auto” follows the generated
  // baseline, pick a step to re-anchor just this mode (the whole column re-derives from it, floor-gated).
  // Structural edits (add / remove an interactive column) stay base-only — they define the brand, not a mode.
  const perMode = currentMode !== 'light';
  const colAnchor = (name: string, get: () => number | undefined, set: (v: number | undefined) => void): Pick<ICol, 'stepValue' | 'setStep'> => {
    if (!perMode) return { stepValue: get(), setStep: (v) => { set(v); applyFull(); } };
    return {
      stepValue: brandState.modeAnchors?.[currentMode]?.[name],
      setStep: (v) => {
        const ma = brandState.modeAnchors ?? (brandState.modeAnchors = {});
        const forMode = ma[currentMode] ?? (ma[currentMode] = {});
        if (v === undefined) {                                  // revert to the generated baseline
          delete forMode[name];
          if (!Object.keys(forMode).length) delete ma[currentMode];
          if (!Object.keys(ma).length) brandState.modeAnchors = undefined;
        } else forMode[name] = v;
        applyFull();
      },
    };
  };

  if (perMode)
    host.append(el('p', 'ic-modenote', `Editing ${MODE_LABEL[currentMode] ?? currentMode}’s interactive colors — “Auto” follows the generated baseline; pick a step to override just this mode.`));

  const cols: ICol[] = [
    { name: 'primary', label: 'Primary', palette: theme.roleToPalette.action,
      ...colAnchor('primary', () => brandState.actionAnchorStep, (v) => setPath(brandState, 'actionAnchorStep', v)) },
    { name: 'destructive', label: 'Destructive', palette: theme.roleToPalette.danger,
      ...colAnchor('destructive', () => brandState.destructiveAnchorStep, (v) => setPath(brandState, 'destructiveAnchorStep', v)) },
  ];
  (brandState.interactivePalettes ?? []).forEach((entry, i) => {
    const nm = entry.name ?? entry.palette;
    cols.push({
      name: nm, label: nm, palette: entry.palette,
      ...colAnchor(nm, () => entry.anchorStep, (v) => setPath(brandState, `interactivePalettes.${i}.anchorStep`, v)),
      ...(perMode ? {} : { onRemove: () => { brandState.interactivePalettes!.splice(i, 1); if (!brandState.interactivePalettes!.length) brandState.interactivePalettes = undefined; applyFull(); } }),
    });
  });
  for (const col of cols) { const card = renderInteractiveCard(col); if (card) host.append(card); }
  const neutral = renderNeutralCard(); if (neutral) host.append(neutral);   // the default button as a card (docs/23 §2)
  if (!perMode) host.append(renderAddAccentRow());
};

const renderGroupedPanels = (host: HTMLElement, levers: Lever[], groups: Array<{ title: string; keys: string[] }>): void => {
  const byKey = new Map(levers.map((l) => [l.key, l]));
  const placed = new Set<string>();
  const panelOf = (ls: Lever[]) => {
    const panel = el('div', 'panel');
    for (const l of ls) { const c = renderControl(l); if (NESTED_KEYS.has(l.key)) c.classList.add('nested'); panel.append(c); placed.add(l.key); }
    return panel;
  };
  for (const g of groups) {
    const groupLevers = g.keys.map((k) => byKey.get(k)).filter((l): l is Lever => !!l);
    const isInteractive = g.title === 'Interactive color';
    if (!groupLevers.length && !isInteractive) continue;
    host.append(subHead(g.title));
    if (isInteractive) renderInteractiveCards(host);   // #161 — one card per interactive column + add-accent row
    if (groupLevers.length) host.append(panelOf(groupLevers));
  }
  const rest = levers.filter((l) => !placed.has(l.key));
  if (rest.length) host.append(subHead('More'), panelOf(rest));
};
// === Mode context control (#171) ==========================================================
// A workspace-level single-select switcher that puts the WHOLE stage into ONE mode at a time —
// editing one mode at a time (docs/11 Pillar 2 authoring context; view-only until the override
// layer exists). Three tiers by how a mode's values are produced: light/dark are GENERATED (and,
// once Pillar 2 lands, editable); hc-light/hc-dark/wireframe are DERIVED-only (auto from the
// contrast contracts, read-only verification views); primitives are mode-independent so this
// control never renders on that stage. Replaces the mode chips that used to overflow the brand
// dropdown — the set-config (which modes exist) now lives in the "Edit modes" popover here.
let modeMenuOpen = false;
let outsideBoundMode = false;
let addModeOpen = false;         // C2 — the "+ Add mode" inline form is expanded
let addModeName = '';            // C2 — survives popover re-renders
const DERIVED_MODES = new Set<string>(['hc-light', 'hc-dark', 'wireframe']);
const RESERVED_MODE_NAMES = new Set<string>(['light', 'dark', 'hc-light', 'hc-dark', 'wireframe']);
const modeAllPass = (m: Mode): boolean => rp.contracts.every((ct) => !ct.byMode[m] || ct.byMode[m]!.pass);

/** The mode-SET config — which modes this brand generates/exports (relocated out of the brand
 *  dropdown). Light always; dark / HC / wireframe opt-in (docs/11 Pillar 1). `+ Add mode` (a custom
 *  mode seeded from a chosen base, then tuned) is gated until the override-layer engine work lands. */
const renderModeSetMenu = (): HTMLElement => {
  const menu = el('div', 'mctx-menu');
  const modes = brandState.modes ?? ALL_MODES;
  const darkOn = modes.includes('dark');
  const hcOn = modes.includes('hc-light') || modes.includes('hc-dark');
  const wireOn = modes.includes('wireframe');
  menu.append(el('div', 'mctx-mcap', 'Modes this brand generates'));

  const lightRow = el('div', 'mctx-opt on fixed');
  lightRow.append(el('span', 'mctx-box', '✓'), el('span', undefined, 'Light'), el('span', 'mctx-always', 'always'));
  menu.append(lightRow);

  const opt = (label: string, on: boolean, title: string, toggle: () => void): void => {
    const row = el('button', 'mctx-opt' + (on ? ' on' : '')) as HTMLButtonElement;
    row.title = title;
    row.append(el('span', 'mctx-box', on ? '✓' : ''), el('span', undefined, label));
    row.onclick = toggle;
    menu.append(row);
  };
  opt('Dark', darkOn, 'A dark appearance — generated, editable', () => setModes(!darkOn, hcOn, wireOn));
  opt('High contrast', hcOn, 'AAA contrast floors — auto-derived, read-only', () => setModes(darkOn, !hcOn, wireOn));
  opt('Wireframe', wireOn, 'Greyscale, sharp corners — auto-derived, generate-only', () => setModes(darkOn, hcOn, !wireOn));

  // Custom modes (C2) — each seeds (live-inherits) a customizable base (light/dark), then tunes via
  // its own overrides/anchors. Listed with a remove; the add form validates the name client-side
  // (the engine re-validates on rebuild). Base options are the generated customizable modes.
  menu.append(el('div', 'mctx-div'));
  const customs = brandState.customModes ?? [];
  if (customs.length) {
    menu.append(el('div', 'mctx-mcap', 'Custom modes'));
    customs.forEach((cm, i) => {
      const row = el('div', 'mctx-custom');
      row.append(el('span', 'mctx-cname', cm.name), el('span', 'mctx-cbase', `↳ ${cm.base}`));
      const rm = el('button', 'mctx-crm', '×') as HTMLButtonElement;
      rm.title = 'Remove custom mode';
      rm.onclick = () => {
        brandState.customModes!.splice(i, 1);
        if (!brandState.customModes!.length) brandState.customModes = undefined;
        if (currentMode === cm.name) currentMode = 'light';   // don't strand the view on a gone mode
        applyFull();
      };
      row.append(rm);
      menu.append(row);
    });
  }

  if (!addModeOpen) {
    const add = el('button', 'mctx-opt') as HTMLButtonElement;
    add.append(el('span', 'mctx-box'), el('span', undefined, '+ Add mode…'));
    add.onclick = () => { addModeOpen = true; renderModeStrip(); };
    menu.append(add);
  } else {
    const form = el('div', 'mctx-addform');
    const nameIn = el('input', 'mctx-addname') as HTMLInputElement;
    nameIn.type = 'text'; nameIn.placeholder = 'name — e.g. marketing-dark'; nameIn.value = addModeName; nameIn.spellcheck = false;
    nameIn.oninput = () => { addModeName = nameIn.value; };
    const baseSel = selectEl('sm fill');
    for (const b of ['light', ...(darkOn ? ['dark'] : [])]) baseSel.append(optionEl(b, `base: ${b}`));
    const err = el('p', 'mctx-adderr');
    const doAdd = () => {
      const nm = addModeName.trim();
      if (!/^[a-z0-9][a-z0-9-]*$/.test(nm)) { err.textContent = 'Lowercase letters, digits, hyphens; start with a letter or digit.'; return; }
      if (RESERVED_MODE_NAMES.has(nm) || (brandState.customModes ?? []).some((c) => c.name === nm)) { err.textContent = 'That name is taken (a built-in or existing custom mode).'; return; }
      (brandState.customModes ?? (brandState.customModes = [])).push({ name: nm, base: baseSel.value as 'light' | 'dark' });
      addModeOpen = false; addModeName = '';
      currentMode = nm as Mode;                               // jump into the new mode to tune it
      applyFull();
    };
    const addBtn = el('button', 'mctx-addbtn', 'Add mode') as HTMLButtonElement;
    addBtn.onclick = doAdd;
    const cancel = el('button', 'mctx-addcancel', 'Cancel') as HTMLButtonElement;
    cancel.onclick = () => { addModeOpen = false; addModeName = ''; renderModeStrip(); };
    const btns = el('div', 'mctx-addbtns'); btns.append(addBtn, cancel);
    form.append(nameIn, baseSel, err, btns);
    menu.append(form);
  }
  menu.append(el('p', 'mctx-note', 'A custom mode seeds from its base every build, then deviates via the per-mode colour controls (interactive, foreground).'));
  return menu;
};

const renderModeContext = (): HTMLElement => {
  const strip = el('div', 'modectx');
  const left = el('div', 'mctx-modes');
  left.append(el('span', 'mctx-cap', 'Mode'));
  for (const m of rp.modes) {
    const derived = DERIVED_MODES.has(m);
    const b = el('button', 'mctx-b' + (m === currentMode ? ' on' : '') + (derived ? ' derived' : '')) as HTMLButtonElement;
    if (derived) b.title = 'Auto-derived from the contrast contracts — a read-only verification view';
    b.append(el('span', 'mctx-name', MODE_LABEL[m] ?? m));
    if (derived) b.append(el('span', 'mctx-auto', 'auto'));
    const ok = modeAllPass(m);
    b.append(el('span', 'mctx-mark ' + (ok ? 'ok' : 'no'), ok ? '✓' : '✗'));
    b.onclick = () => { modeMenuOpen = false; if (currentMode !== m) { currentMode = m; renderModeStrip(); renderWorkspace(); } else { renderModeStrip(); } };
    left.append(b);
  }
  strip.append(left);

  const editWrap = el('div', 'mctx-edit-wrap');
  const edit = el('button', 'mctx-edit' + (modeMenuOpen ? ' open' : ''), '⚙ Edit modes') as HTMLButtonElement;
  edit.onclick = (e) => { e.stopPropagation(); modeMenuOpen = !modeMenuOpen; if (!modeMenuOpen) { addModeOpen = false; addModeName = ''; } renderModeStrip(); };
  editWrap.append(edit);
  if (modeMenuOpen) editWrap.append(renderModeSetMenu());
  strip.append(editWrap);

  if (!outsideBoundMode) {
    document.addEventListener('click', (e) => {
      if (modeMenuOpen && !(e.target as HTMLElement).closest('.modectx')) { modeMenuOpen = false; addModeOpen = false; addModeName = ''; renderModeStrip(); }
    });
    outsideBoundMode = true;
  }
  return strip;
};

/** A2a — the read-only view shown when a GENERATED mode (HC / wireframe) is selected. These modes are
 *  auto-derived and never hand-tuned, so the editing controls are replaced by an explanation + a
 *  per-mode contract verdict; the verification preview below still renders the mode on real components. */
const renderGeneratedNote = (): HTMLElement => {
  const wf = currentMode === 'wireframe';
  const label = MODE_LABEL[currentMode] ?? currentMode;
  const box = el('div', 'genview');
  box.append(el('h3', 'genview-t', `${label} is auto-derived — read-only`));
  box.append(el('p', 'genview-d', wf
    ? 'Wireframe is a mechanical greyscale: every non-neutral role collapses to its neutral equivalent and corners go sharp. It’s generated from your theme, not hand-tuned — edit Light or Dark and it follows.'
    : 'High contrast pushes every role to meet the AAA contrast floors. It’s derived from your contrast contracts, not hand-tuned — edit Light or Dark and it follows. Verifying it here is the point: confirm it holds before you ship.'));
  const ok = modeAllPass(currentMode);
  const chip = el('div', 'genview-chip ' + (ok ? 'ok' : 'no'));
  chip.append(el('span', 'gv-mark', ok ? '✓' : '✗'),
    el('span', undefined, ok ? 'Every contrast contract passes in this mode' : 'Some contracts fail in this mode — see the preview below'));
  box.append(chip);
  box.append(el('p', 'genview-hint', 'Toggle which modes generate in the mode strip’s “Edit modes”. The preview below shows this mode applied to real components.'));
  return box;
};

/** Bespoke editors for the object/list levers renderControl can't edit (it only shows them read-only).
 *  Rendered alongside the manifest-advanced slider/enum controls in the (always-visible) extras panel. */
const renderResponsiveEditor = (): HTMLElement => {
  const wrap = el('div', 'adv-obj');
  wrap.append(el('div', 'adv-obj-h', 'Responsive type'));
  const cb = el('input') as HTMLInputElement;
  cb.type = 'checkbox'; cb.checked = brandState.typography?.responsive?.fluid ?? theme.typography.fluid;
  cb.onchange = () => { setPath(brandState, 'typography.responsive.fluid', cb.checked); apply(); };
  const fl = el('label', 'adv-row'); fl.append(cb, el('span', 'adv-row-lab', 'Fluid heading sizing (clamp between viewports)'));
  wrap.append(fl);
  const mk = (key: 'minViewport' | 'maxViewport', label: string, fallback: number): void => {
    const inp = numberField({ className: 'adv-num', value: String(getPath(brandState, `typography.responsive.${key}`) ?? fallback) });
    inp.onchange = () => { const n = Number(inp.value); if (Number.isFinite(n)) { setPath(brandState, `typography.responsive.${key}`, n); apply(); } };
    const row = el('div', 'adv-row'); row.append(el('span', 'adv-row-lab', label), inp, el('span', 'adv-unit', 'px'));
    wrap.append(row);
  };
  mk('minViewport', 'Min viewport', theme.typography.minViewport);
  mk('maxViewport', 'Max viewport', theme.typography.maxViewport);
  return wrap;
};

const renderBreakpointsEditor = (): HTMLElement => {
  const wrap = el('div', 'adv-obj');
  wrap.append(el('div', 'adv-obj-h', 'Breakpoints (min-width px, ascending)'));
  const listEl = el('div', 'adv-bplist');
  const commit = (arr: number[]): void => {
    const clean = [...new Set(arr.filter((n) => Number.isFinite(n) && n >= 0))].sort((a, b) => a - b);
    // Refresh THIS editor's list (count/order may change) + repaint the layout specimen — but NOT a full
    // workspace re-render (applyFull), which would rebuild this editor mid-edit and lose focus/scroll.
    // draw() re-renders the list locally; apply() rebuilds the theme + the volatile specimens.
    setPath(brandState, 'layout.breakpoints', clean); draw(); apply();
  };
  const draw = (): void => {
    listEl.innerHTML = '';
    const bps = (brandState.layout?.breakpoints ?? theme.layout.breakpoints.map((b) => b.px)) as number[];
    bps.forEach((px, i) => {
      const cell = el('div', 'adv-bp');
      const inp = numberField({ className: 'adv-num', value: String(px) });
      inp.onchange = () => { const next = [...bps]; next[i] = Number(inp.value); commit(next); };
      const rm = el('button', 'adv-x', '×') as HTMLButtonElement;
      rm.onclick = () => commit(bps.filter((_, j) => j !== i));
      cell.append(inp, rm); listEl.append(cell);
    });
    const add = el('button', 'adv-add', '+ Add') as HTMLButtonElement;
    add.onclick = () => { const bps2 = (brandState.layout?.breakpoints ?? theme.layout.breakpoints.map((b) => b.px)) as number[]; commit([...bps2, (Math.max(0, ...bps2) + 256)]); };
    listEl.append(add);
  };
  draw();
  wrap.append(listEl);
  return wrap;
};

const renderEasingEditor = (): HTMLElement => {
  const wrap = el('div', 'adv-obj');
  wrap.append(el('div', 'adv-obj-h', 'Emphasized easing (cubic-bezier)'));
  const cur = (brandState.motionPersonality?.easingEmphasized ?? theme.motion.easing.emphasized) as number[];
  const row = el('div', 'adv-bez');
  const inputs: HTMLInputElement[] = [];
  const commit = (): void => { const vals = inputs.map((x) => Number(x.value)); if (vals.length === 4 && vals.every((v) => Number.isFinite(v))) { setPath(brandState, 'motionPersonality.easingEmphasized', vals); apply(); } };
  ['x1', 'y1', 'x2', 'y2'].forEach((lab, i) => {
    const inp = numberField({ className: 'adv-num', step: '0.01', value: String(cur[i] ?? [0.4, 0.14, 0.3, 1][i]) });
    inp.onchange = commit; inputs.push(inp);
    row.append(el('span', 'adv-bez-lab mono', lab), inp);
  });
  wrap.append(row);
  wrap.append(el('p', 'adv-obj-note', 'The expressive curve for the emphasized transition (see the Motion specimen’s emphasized bar).'));
  return wrap;
};

// ---- focused pages (docs/23 §7) -------------------------------------------
// Each editing page composes through one scaffold: hero → sections (or a read-only note on a derived
// mode) → the volatile contextual specimens for that axis. The heavy global preview lives on its own
// Preview tab (3a); these are the tight, single-axis specimens that stay with their editor.

/** The shared screen scaffold. `sections` builds the controls/editors; `specimens` returns the
 *  contextual specimen nodes, repainted on every edit. A derived mode (HC / wireframe) is auto-derived
 *  + read-only, so the controls are replaced by an explanatory note — the specimens still render it. */
const renderScreen = (
  host: HTMLElement, key: PageKey,
  sections: (h: HTMLElement) => void,
  specimens: () => Array<HTMLElement | null>,
): void => {
  const [title, lede] = PAGE_COPY[key];
  host.append(hero(title, lede));
  if (DERIVED_MODES.has(currentMode)) host.append(renderGeneratedNote());
  else sections(host);
  const vol = el('div', 'stage-vol');
  host.append(vol);
  paintVolatile = () => { vol.innerHTML = ''; for (const s of specimens()) if (s) vol.append(s); };
  paintVolatile();
};
const panelOfLevers = (levers: Lever[]): HTMLElement => { const p = el('div', 'panel'); for (const l of levers) p.append(renderControl(l)); return p; };
/** A page's manifest-`advanced` scalar levers (+ optional bespoke editors), exposed as a normal
 *  always-visible panel. (Owner decision: no "Advanced" disclosure — all UI is shown uniformly.) */
const renderAdvancedPanel = (host: HTMLElement, key: PageKey, extras?: (ap: HTMLElement) => void): void => {
  const adv = leverManifest.filter((l) => l.advanced && (l.control === 'slider' || l.control === 'enum') && !PRIMITIVE_KEYS.has(l.key) && pageOfLever(l) === key);
  if (!adv.length && !extras) return;
  const ap = el('div', 'panel adv-panel');
  for (const l of adv) ap.append(renderControl(l));
  if (extras) extras(ap);
  host.append(ap);
};

// Per-page contrast table (docs/23 §3) — a re-slice of the same authoritative contracts the Preview
// master table shows, scoped to the components this page governs. "Local proof" without leaving the
// page; the full system table stays on Preview. Only the two colour pages govern contrast pairs, and
// the split is EXHAUSTIVE BY CONSTRUCTION: Surfaces owns the text-on-surface components; Interactive is
// the catch-all for everything else. So a component added to the preview spec later can never silently
// vanish from the local tables — it lands on Interactive automatically. (Review nit on #201.)
const SURFACE_CONTRACT_COMPONENTS = new Set(['typography', 'card']);
const renderSectionContrast = (key: PageKey): HTMLElement | null => {
  if (key !== 'surfaces' && key !== 'interactive') return null;
  const cts = rp.contracts.filter((ct) => SURFACE_CONTRACT_COMPONENTS.has(ct.component) === (key === 'surfaces'));
  if (!cts.length) return null;
  const det = el('details', 'contracts') as HTMLDetailsElement;
  const sum = el('summary', 'contracts-sum');
  sum.append(el('span', 'contracts-t', 'Contrast on this page'), el('span', 'contracts-hint', `${cts.length} pairs · all modes · the full system table lives in Preview`));
  det.append(sum);
  det.append(el('p', 'np-note', 'The a11y pairs this page governs, computed on the resolved colors across every mode — the per-control badges above verify the active mode at the point of edit.'));
  det.append(contractTableEl(cts, true));   // token paths — the component context is obvious next to the controls
  return det;
};

// Surfaces / fills — backgrounds, derived text/ink, an optional gradient.
const renderSurfacesPage = (host: HTMLElement): void => renderScreen(host, 'surfaces', (h) => {
  h.append(renderSurfacesEditor());     // self-heads "Backgrounds"
  h.append(renderForegroundsEditor());  // self-heads "Foreground fills" — the bold/surface fills (docs/23 §2)
  h.append(renderForegroundEditor());   // self-heads "Text & ink"
  h.append(subHead('Gradients'));
  renderGradientsSection(h);
}, () => [renderGradientSpecimen(), renderSectionContrast('surfaces')]);

// Interactive — action palette, interactive treatment, and the accessibility policy.
const renderInteractivePage = (host: HTMLElement): void => renderScreen(host, 'interactive', (h) => {
  // neutralEmphasis is edited on the Neutral card now — keep it out of the panels (incl. the catch-all).
  renderGroupedPanels(h, leversFor('interactive').filter((l) => l.key !== 'neutralEmphasis'), INTERACTIVE_GROUPS);
}, () => [renderInverseSpecimen(), renderIconSpecimen(), renderSectionContrast('interactive')]);

// Typography — type scale (shared, read-only outside Light) + the family/weight/leading editor.
const renderTypographyPage = (host: HTMLElement): void => renderScreen(host, 'typography', (h) => {
  const scale = leverByKey('typography.typeScale');
  if (scale) {
    const p = el('div', 'panel');
    if (currentMode !== 'light') {                          // D — type scale is shared; read-only outside Light
      const cur = getPath(brandState, scale.key) ?? scale.default;
      p.append(knob(scale.label, el('div', 'te-shared-ro', `${cur} · shared across modes — edit in Light`), scale.description));
    } else p.append(renderControl(scale));
    h.append(p);
  }
  h.append(renderTypographyEditor());
  renderAdvancedPanel(h, 'typography', (ap) => ap.append(renderResponsiveEditor()));
}, () => [renderTypeSpecimen()]);

// Elevation — the shadow ramp (softness + tint live together in the bespoke editor).
const renderElevationPage = (host: HTMLElement): void => renderScreen(host, 'elevation', (h) => {
  h.append(renderShadowEditor(leverByKey('shadow.softness')));
}, () => [renderShadowSpecimen()]);

// Size & radius — component sizing (density) + corner radius; both go per-mode outside Light.
const renderSizeRadiusPage = (host: HTMLElement): void => renderScreen(host, 'sizeRadius', (h) => {
  const perMode = currentMode !== 'light';
  const panel = el('div', 'panel');
  for (const l of leversFor('sizeRadius')) {
    if (l.key === 'radiusScale' && perMode) { panel.append(renderPerModeRadius(l)); continue; }
    if (l.key === 'density' && perMode) { panel.append(renderPerModeDensity(l)); continue; }
    panel.append(renderControl(l));
  }
  h.append(panel);
  renderAdvancedPanel(h, 'sizeRadius');
}, () => [renderRadiusSpecimen(), renderSizeSpecimen()]);

// Layout — on a dedicated page the breakpoints editor + container/column sliders are primary content.
const renderLayoutPage = (host: HTMLElement): void => renderScreen(host, 'layout', (h) => {
  h.append(renderBreakpointsEditor());
  const sliders = leverManifest.filter((l) => l.group === 'layout' && l.control === 'slider');
  if (sliders.length) h.append(panelOfLevers(sliders));
}, () => [renderLayoutSpecimen()]);

// Motion — tempo (per-mode outside Light) + the emphasized easing curve (advanced).
const renderMotionPage = (host: HTMLElement): void => renderScreen(host, 'motion', (h) => {
  const perMode = currentMode !== 'light';
  const panel = el('div', 'panel');
  for (const l of leversFor('motion')) {
    if (l.key === 'motionPersonality.tempo' && perMode) { panel.append(renderPerModeTempo(l)); continue; }
    panel.append(renderControl(l));
  }
  h.append(panel);
  renderAdvancedPanel(h, 'motion', (ap) => ap.append(renderEasingEditor()));
}, () => [renderMotionSpecimen()]);

/** The Preview destination (docs/23 §7) — the overall UI preview + contrast contracts, resolved
 *  through the mode picked in the global header. Owns the component gallery that used to be duplicated
 *  on every editing stage. (Segmented UI / contrast / token-list sub-views + a per-section contrast
 *  table land in a follow-up; this is the extraction.) */
type PreviewView = 'ui' | 'contrast' | 'tokens';
let previewView: PreviewView = 'ui';
const PREVIEW_VIEWS: Array<[PreviewView, string]> = [['ui', 'UI preview'], ['contrast', 'Contrast contracts'], ['tokens', 'Token list']];
const renderPreviewPage = (host: HTMLElement): void => {
  const [title, lede] = PAGE_COPY.preview;
  host.append(hero(title, lede));
  // Segmented view-switcher (docs/23 §7) — the three "look at the result" views in one destination.
  const seg = el('div', 'pvseg');
  for (const [k, label] of PREVIEW_VIEWS) {
    const b = el('button', 'pvseg-b' + (previewView === k ? ' on' : ''), label) as HTMLButtonElement;
    b.onclick = () => { if (previewView !== k) { previewView = k; renderWorkspace(); } };
    seg.append(b);
  }
  host.append(seg);
  const vol = el('div', 'stage-vol');
  host.append(vol);
  paintVolatile = () => {
    vol.innerHTML = '';
    const pv = el('div', 'pvhost');
    vol.append(pv);
    if (previewView === 'ui') renderPreviewGallery(pv);
    else if (previewView === 'contrast') renderPreviewContracts(pv);
    else renderPreviewTokens(pv);
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
  // D (typography) — outside the base mode, font FAMILY + WEIGHT go per-mode (modeLevers[mode]);
  // the shared skeleton (type scale, categories, which weights each category ships) is authored in
  // Light and shown read-only here. "Auto" = follow the global baseline.
  const perMode = currentMode !== 'light';
  const modeLabel = MODE_LABEL[currentMode] ?? currentMode;
  // Per-mode family / weight / leading / tracking all read+write modeLevers[mode] via the shared
  // getModeLever/setModeLever (which own the prune-to-byte-identical invariant). A blank/undefined value
  // clears the override. Font family may be stored as a string or a stack array — famGet returns the primary.
  const famGet = (role: string): string | undefined => { const f = getModeLever(currentMode, `families.${role}`); return Array.isArray(f) ? f[0] : (f as string | undefined); };
  const wGet = (role: string): number | undefined => getModeLever(currentMode, `weights.${role}`) as number | undefined;
  const lhGet = (key: string): number | undefined => getModeLever(currentMode, `lineHeights.${key}`) as number | undefined;
  const lsGet = (key: string): number | undefined => getModeLever(currentMode, `letterSpacings.${key}`) as number | undefined;
  const famSet = (role: string, v: string | undefined): void => { setModeLever(currentMode, `families.${role}`, v); applyFull(); };
  const wSet = (role: string, v: number | undefined): void => { setModeLever(currentMode, `weights.${role}`, v); applyFull(); };
  const lhSet = (key: string, v: number | undefined): void => { setModeLever(currentMode, `lineHeights.${key}`, v); applyFull(); };
  const lsSet = (key: string, v: number | undefined): void => { setModeLever(currentMode, `letterSpacings.${key}`, v); applyFull(); };
  if (perMode) wrap.append(el('p', 'te-modenote', `Editing ${modeLabel}’s font family + weight — “Auto” follows the global baseline. Type scale, categories, and which weights each category ships are shared across modes (edit them in Light).`));
  // Phase B: recomputes the per-category weight-availability markers from the LIVE resolved theme.
  // Assigned once the table exists; A1 (font/weight edits) and A2 (family/weight-role edits) call it
  // after apply(), so a font or weight-numeric change refreshes the warnings without a full re-render.
  let refreshWarnings = (): void => {};
  // --- Font pool: the primary face per family role (a single name auto-pads a fallback stack) ---
  wrap.append(subHead('Font pool'));
  const pool = el('div', 'panel');
  for (const [role, label, desc] of FAMILY_ROLES) {
    const globalPrimary = ty.families.find((f) => f.role === role)?.stack[0] ?? '';
    const knob = el('div', 'knob');
    knob.append(el('label', 'knob-label', label));
    const input = el('input') as HTMLInputElement;
    input.type = 'text'; input.className = 'te-font';
    if (perMode) {
      const ov = famGet(role);
      input.value = ov ?? '';
      input.placeholder = `Auto — ${globalPrimary}`;
      input.onchange = () => famSet(role, input.value.trim() || undefined);
    } else {
      input.value = globalPrimary; input.placeholder = 'Font family name';
      input.onchange = () => { setPath(brandState, `typography.families.${role}`, input.value.trim() || undefined); apply(); refreshWarnings(); };
    }
    knob.append(input, el('p', 'knob-desc', perMode ? `${desc} — per ${modeLabel}; blank = Auto (global).` : desc));
    pool.append(knob);
  }
  wrap.append(pool);
  // --- Weight roles → numeric (GLOBAL: one numeric per role, shared across every category) ---
  wrap.append(subHead('Weight roles → numeric'));
  const wr = el('div', 'panel');
  for (const w of ty.weightRoles) {
    const knob = el('div', 'knob te-wrow');
    knob.append(el('label', 'knob-label', w.role));
    const input = numberField({ className: 'te-weight', min: 100, max: 900, step: 100, value: '' });
    if (perMode) {
      const ov = wGet(w.role);
      input.value = ov !== undefined ? String(ov) : '';
      input.placeholder = `Auto ${w.value}`;
      input.onchange = () => { const raw = input.value.trim(); if (raw === '') { wSet(w.role, undefined); return; } const n = Number(raw); if (n >= 100 && n <= 900) wSet(w.role, n); };
    } else {
      input.value = String(w.value);
      input.onchange = () => { const n = Number(input.value); if (n >= 100 && n <= 900) { setPath(brandState, `typography.weightRoles.${w.role}`, n); apply(); refreshWarnings(); } };
    }
    knob.append(input);
    wr.append(knob);
  }
  wrap.append(wr);
  // Ordering nudge (D) — the weight roles are a relative-emphasis ladder (subtle ≤ … ≤ strong); a mode
  // shifts the whole scale but shouldn't INVERT a role. Warn (never block) if the effective values dip.
  const effWeights = ty.weightRoles.map((w) => (perMode ? (wGet(w.role) ?? w.value) : w.value));
  const inverted = effWeights.some((v, i) => i > 0 && v < effWeights[i - 1]);
  if (inverted) wrap.append(el('p', 'te-order-warn', '⚠ A heavier role now resolves lighter than a lower one — the weight names read as relative emphasis (subtle → strong), so keeping them in order stays honest. This is a warning, not a block.'));
  // --- Line height + letter spacing (D): the leading/tracking ramps, adjustable PER MODE only. ---
  // The named steps (tight/snug/… · tighter/tight/…) are shared across modes; a mode re-anchors a step's
  // VALUE (blank = Auto/global). Composites reference a step by key, so a bump reflows every composite
  // that uses it. In Light the ramps are read-only reference (there's no global lever — per-mode is the
  // control); in a mode they become editable. Rendered compactly to keep the stage tight.
  const rampSection = (
    title: string, note: string, steps: { key: string; val: number }[],
    getOv: (k: string) => number | undefined, setOv: (k: string, v: number | undefined) => void,
    fmt: (v: number) => string, min: number, max: number, step: number,
  ): void => {
    wrap.append(subHead(title));
    wrap.append(el('p', perMode ? 'te-shared-note' : 'te-shared-ro-note', note));
    const grid = el('div', 'te-ramp');
    for (const s of steps) {
      const cell = el('div', 'te-ramp-cell');
      cell.append(el('label', 'te-ramp-key mono', s.key));
      if (perMode) {
        const input = numberField({ className: 'te-ramp-in', min, max, step, value: '' });
        const ov = getOv(s.key);
        input.value = ov !== undefined ? String(ov) : '';
        input.placeholder = `Auto ${fmt(s.val)}`;
        input.onchange = () => { const raw = input.value.trim(); if (raw === '') { setOv(s.key, undefined); return; } const n = Number(raw); if (n >= min && n <= max) setOv(s.key, n); else input.value = ov !== undefined ? String(ov) : ''; };
        cell.append(input);
      } else cell.append(el('div', 'te-ramp-ro mono', fmt(s.val)));
      grid.append(cell);
    }
    wrap.append(grid);
  };
  const lhNote = perMode
    ? `Per-mode leading — blank = Auto (global). Open ${modeLabel} up a touch for legibility, or tighten it.`
    : 'The leading ramp — unitless multipliers. Per-mode adjustable: switch to a mode to retune leading there.';
  const lsNote = perMode
    ? `Per-mode tracking (em) — blank = Auto (global). Loosen ${modeLabel} for small text on dark, or tighten it.`
    : 'The tracking ramp — em-relative. Per-mode adjustable: switch to a mode to retune tracking there.';
  rampSection('Line height', lhNote, ty.lineHeights.map((l) => ({ key: l.key, val: l.value })), lhGet, lhSet, (v) => `${v}×`, 0.8, 3, 0.05);
  rampSection('Letter spacing', lsNote, ty.letterSpacings.map((l) => ({ key: l.key, val: l.em })), lsGet, lsSet, (v) => `${v}em`, -0.5, 0.5, 0.005);
  // --- Per-category assignment (A2): family role · which weight-roles ship · italic · link ---
  // Current state is DERIVED from the resolved composites; each control writes the corresponding
  // brandState.typography.* override. Toggles read LIVE checkbox states (never a stale snapshot),
  // so writing the full weights/italics/links list from the DOM stays correct across many edits.
  wrap.append(subHead('Per-category'));
  if (perMode) wrap.append(el('p', 'te-shared-note', `Shared across all modes — the family map, which weight roles each category ships, and italic/link are the composite skeleton. Edit them in Light; ${modeLabel} inherits the structure and just overrides the font + weight values above.`));
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
  const cbEl = (checked: boolean): HTMLInputElement => { const c = el('input') as HTMLInputElement; c.type = 'checkbox'; c.checked = checked; c.disabled = perMode; return c; };
  const table = el('table', 'te-cat');
  const head = el('tr');
  head.append(el('th', undefined, 'Category'), el('th', undefined, 'Family'));
  for (const r of roleOrder) head.append(el('th', 'te-c', r));
  head.append(el('th', 'te-c', 'italic'), el('th', 'te-c', 'link'));
  table.append(head);
  for (const g of TYPE_GROUP_ORDER) {
    const tr = el('tr');
    tr.append(el('td', 'te-cat-name mono', g));
    const fsel = selectEl('sm');
    for (const fr of ['display', 'text', 'mono']) fsel.append(optionEl(fr, fr, fr === catFamily[g]));
    fsel.onchange = () => { setPath(brandState, `typography.familyMap.${g}`, fsel.value); apply(); refreshWarnings(); };
    fsel.disabled = perMode;   // shared skeleton — edit in Light
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
  const wrap = objEditor('Backgrounds', 'The primary surface each mode paints on — white/black or a tinted neutral step. The contrast floor follows it.');
  const grid = el('div', 'fill-grid');
  const opt = (sel: HTMLSelectElement, v: string, t: string, on: boolean): void => { sel.append(optionEl(v, t, on)); };
  for (const [mode, label, dflt] of SURFACE_MODES) {
    const cur = brandState.surfaces?.[mode];
    // Base surface picker — white / black / a tinted neutral step. `applyFull` (not `apply`) so the card's
    // swatch re-renders to the new resolved surface; the fills/text cards use the same rebuild.
    const baseVal = cur?.base ?? dflt;
    const base = selectEl('cap');
    opt(base, 'white', 'White', baseVal === 'white');
    opt(base, 'black', 'Black', baseVal === 'black');
    for (const s of NEUTRAL_STEPS) opt(base, String(s), `Neutral ${s}`, baseVal === s);
    base.onchange = () => { setPath(brandState, `surfaces.${mode}.base`, base.value === 'white' || base.value === 'black' ? base.value : Number(base.value)); applyFull(); };
    const hex = rp.colors['color.background.primary']?.[mode] ?? (dflt === 'white' ? '#ffffff' : '#000000');
    const card = renderCard({
      label, fillHex: hex, midTitle: 'Base surface', picker: base, tokenPath: 'background.primary',
      desc: 'The primary surface this mode paints on — white, black, or a tinted neutral step.', compactSwatch: true,
    });
    // Contrast floor — the worst-case neutral the saturated foregrounds validate against (auto unless pinned).
    // Appended as a secondary control, mirroring the interactive card's states row.
    const floorRow = el('div', 'bg-floor');
    floorRow.append(el('label', 'bg-floor-lab', 'Contrast floor'));
    const floor = selectEl('cap');
    opt(floor, '', 'Auto', cur?.floorStep == null);
    for (const s of NEUTRAL_STEPS) opt(floor, String(s), `Neutral ${s}`, cur?.floorStep === s);
    floor.onchange = () => { setPath(brandState, `surfaces.${mode}.floorStep`, floor.value === '' ? undefined : Number(floor.value)); applyFull(); };
    floorRow.append(floor);
    card.append(floorRow);
    grid.append(card);
  }
  wrap.append(grid);
  return wrap;
};

/** A2c — per-mode foreground/text override. The text ink ladder (text.primary/secondary/tertiary) is
 *  engine-derived and contrast-placed; this repoints a role to a specific NEUTRAL step for the current
 *  mode via the A1 override layer. Symmetric across customizable modes (light + dark both write their
 *  own override); "Auto" = the generated default; a pick below the text floor warns (never blocks). */
const FG_ROLES: [string, string][] = [['text.primary', 'Primary text'], ['text.secondary', 'Secondary text'], ['text.tertiary', 'Tertiary text']];
const renderForegroundEditor = (): HTMLElement => {
  const wrap = objEditor('Text & ink', `The neutral ink ladder for ${MODE_LABEL[currentMode] ?? currentMode} — “Auto” follows the generated, contrast-placed default; pick a neutral step to override just this mode (a pick below the text floor is warned, not blocked).`);
  const nPal = theme.roleToPalette.neutral;
  const nSteps = (theme.palettes.find((p) => p.palette === nPal)?.steps ?? []).map((s) => s.key);
  const roles = resolveAllModes(theme).find((x) => x.mode === currentMode)?.roles ?? {};
  const panel = el('div', 'panel');
  for (const [role, label] of FG_ROLES) {
    const r = roles[role]; if (!r) continue;
    const knob = el('div', 'knob');
    knob.append(el('label', 'knob-label', label));
    const row = el('div', 'fg-row');
    const sw = el('span', 'fg-sw'); sw.style.background = r.hex;
    const sel = selectEl('sm fill');
    const cur = brandState.overrides?.[currentMode]?.[role]?.step;
    const optE = (v: string, t: string, on: boolean) => sel.append(optionEl(v, t, on));
    optE('', 'Auto', cur == null);
    for (const s of nSteps) optE(s, `Neutral ${s}`, cur === s);
    sel.onchange = () => {
      const v = sel.value;
      const ov = brandState.overrides ?? (brandState.overrides = {});
      const forMode = ov[currentMode] ?? (ov[currentMode] = {});
      if (v === '') {                                          // revert to the generated baseline
        delete forMode[role];
        if (!Object.keys(forMode).length) delete ov[currentMode];
        if (!Object.keys(ov).length) brandState.overrides = undefined;
      } else forMode[role] = { palette: nPal, step: v };
      applyFull();
    };
    const pass = r.min <= 0 || r.ratio >= r.min;
    const badge = el('span', 'fg-badge ' + (pass ? 'ok' : 'no'));
    badge.textContent = r.min > 0 ? `${r.ratio.toFixed(2)}:1 ${pass ? '✓' : '✗'}` : '—';
    row.append(sw, sel, badge);
    knob.append(row);
    panel.append(knob);
  }
  wrap.append(panel);
  return wrap;
};

// ---- Foreground fills editor (docs/23 §2 "Foregrounds") -------------------
// The bold semantic fills + the neutral surface tiers as cards, each repointable per mode via the A1
// override layer (`theme.overrides`), same mechanism as Text & ink above but keyed to each role's own
// palette. Distinct from Text & ink (the neutral INK ladder). Customizable modes only — on a derived
// mode the whole page is the read-only note (renderScreen), so this never renders there.
/** A palette step select with an "Auto" (the generated baseline) option — audit §8 candidate #3. `''` is
 *  Auto; other values are step keys. */
const stepPicker = (paletteName: string, steps: string[], autoStep: string, current: string | undefined, onPick: (step: string | undefined) => void): HTMLSelectElement => {
  const sel = selectEl('cap');
  sel.append(optionEl('', `Auto · ${paletteName} ${autoStep}`, current == null));
  for (const s of steps) sel.append(optionEl(s, `${paletteName} ${s}`, current === s));
  sel.onchange = () => onPick(sel.value === '' ? undefined : sel.value);
  return sel;
};
const FILL_ROLES: Array<{ role: string; label: string; paletteKey: string; desc: string }> = [
  { role: 'foreground.brand', label: 'Brand', paletteKey: 'brand', desc: 'The bold brand fill — filled badges, nav indicators, brand accents.' },
  { role: 'foreground.success', label: 'Success', paletteKey: 'success', desc: 'The bold success fill.' },
  { role: 'foreground.warning', label: 'Warning', paletteKey: 'warning', desc: 'The bold warning fill.' },
  { role: 'foreground.info', label: 'Info', paletteKey: 'info', desc: 'The bold info fill.' },
  { role: 'foreground.danger', label: 'Danger', paletteKey: 'danger', desc: 'The bold danger fill.' },
  { role: 'foreground.primary', label: 'Surface — card', paletteKey: 'neutral', desc: 'The default raised surface — a card.' },
  { role: 'foreground.secondary', label: 'Surface — panel', paletteKey: 'neutral', desc: 'The second surface tier — a panel.' },
  { role: 'foreground.tertiary', label: 'Surface — nested', paletteKey: 'neutral', desc: 'The third surface tier — a nested container.' },
];
const setFillOverride = (role: string, palette: string, step: string | undefined): void => {
  const ov = brandState.overrides ?? (brandState.overrides = {});
  const forMode = ov[currentMode] ?? (ov[currentMode] = {});
  if (step === undefined) {                                   // revert to the generated baseline
    delete forMode[role];
    if (!Object.keys(forMode).length) delete ov[currentMode];
    if (!Object.keys(ov).length) brandState.overrides = undefined;
  } else forMode[role] = { palette, step };
  applyFull();
};
const renderForegroundsEditor = (): HTMLElement => {
  const wrap = objEditor('Foreground fills', `Bold semantic fills + neutral surface tiers for ${MODE_LABEL[currentMode] ?? currentMode} — “Auto” follows the generated, contrast-gated default; pick a step to override just this mode (a pick below the fill's floor is warned, not blocked).`);
  const roles = (resolveAllModes(theme).find((x) => x.mode === currentMode)?.roles ?? {}) as Record<string, { hex: string; path?: string; ratio?: number; min?: number } | undefined>;
  const grid = el('div', 'fill-grid');
  for (const { role, label, paletteKey, desc } of FILL_ROLES) {
    const r = roles[role]; if (!r) continue;
    const palette = (theme.roleToPalette as Record<string, string>)[paletteKey] ?? paletteKey;
    const steps = (theme.palettes.find((p) => p.palette === palette)?.steps ?? []).map((s) => s.key);
    if (!steps.length) continue;
    const cur = brandState.overrides?.[currentMode]?.[role]?.step;
    const picker = stepPicker(palette, steps, stepKeyOf(r.path), typeof cur === 'string' ? cur : undefined, (step) => setFillOverride(role, palette, step));
    grid.append(renderCard({
      label, fillHex: r.hex, midTitle: 'Fill', picker, tokenPath: role, desc, compactSwatch: true,
      badge: r.min != null && r.min > 0 && r.ratio != null ? contrastBadge(r.ratio, r.min) : undefined,
    }));
  }
  wrap.append(grid);
  return wrap;
};

/** #97 + #114 tidy — the Shadow group. Gathers every shadow control under one heading: the
 *  `shadow.softness` blur dial (a generic slider lever, passed in so it leaves the geometry panel)
 *  and the `shadow.tint = {hue, amount}` object editor (hue-shifts the base off pure black; amount 0 =
 *  pure black, higher = a richer brand-hued near-black). Reads the resolved default (`theme.shadow.tint`)
 *  when the brand hasn't set one; the elevation specimen recolors live. */
const renderShadowEditor = (softness?: Lever): HTMLElement => {
  const wrap = objEditor('Shadow');
  // D (shadow) — outside the base mode, softness + tint go per-mode (modeLevers[mode].shadow); the
  // slider shows the EFFECTIVE value (override ?? global) and moving it creates an override, with a
  // "↺ Auto" reset that clears it (blank-slider has no natural Auto state, so the reset is explicit).
  const perMode = currentMode !== 'light';
  const modeLabel = MODE_LABEL[currentMode] ?? currentMode;
  wrap.append(el('p', 'obj-lede', perMode
    ? `Blur softness + tint for ${modeLabel} — “Auto” follows the global shadow; a value overrides just this mode (crisper/softer, warmer/cooler). The light↔dark reduction still applies on top.`
    : 'Blur softness (crisp/product → soft/marketing) and a hue-shift of the shadow base off pure black. Tint amount 0 = pure black; higher = a richer, brand-hued near-black.'));
  const gTint = theme.shadow.tint;         // resolved global tint (what a mode inherits under Auto)
  const gSoft = theme.shadow.softness;     // resolved global softness
  const panel = el('div', 'panel');
  if (perMode) {
    // A per-mode slider: effective = override ?? global; moving it writes modeLevers[mode].shadow.<path>
    // via the shared setModeLever (prunes to byte-identical). Dragging back to EXACTLY the global value
    // clears the override (no redundant "== global" override lingers), and the ↺ Auto reset clears it too.
    const mkPer = (label: string, min: number, max: number, step: number, unit: string, path: string, global: number): void => {
      const ov = getModeLever(currentMode, path) as number | undefined;
      const eff = ov ?? global;
      const knob = el('div', 'knob');
      const head = el('div', 'sh-knob-head');
      head.append(el('label', 'knob-label', label));
      const auto = el('button', 'sh-auto') as HTMLButtonElement;
      const setAuto = (overriding: boolean): void => { auto.textContent = overriding ? '↺ Auto' : `Auto (${global}${unit})`; auto.className = overriding ? 'sh-auto on' : 'sh-auto'; auto.disabled = !overriding; };
      setAuto(ov !== undefined);
      auto.onclick = () => { setModeLever(currentMode, path, undefined); applyFull(); };
      head.append(auto);
      knob.append(head);
      const input = rangeInput({ min, max, step, value: eff });
      const val = el('span', 'knob-val', `${eff}${unit}${ov !== undefined ? '' : ' · auto'}`);
      input.oninput = () => {
        const nv = Number(input.value);
        const overriding = nv !== global;                    // landing back on the global prunes the override
        setModeLever(currentMode, path, overriding ? nv : undefined);
        val.textContent = `${input.value}${unit}${overriding ? '' : ' · auto'}`;
        // update the ↺ Auto reset in place (no full re-render, so dragging stays smooth).
        setAuto(overriding);
        apply();
      };
      const body = el('div', 'knob-body'); body.append(input, val);
      knob.append(body);
      panel.append(knob);
    };
    const sLever = softness;
    mkPer(sLever?.label ?? 'Shadow softness', (sLever?.min as number) ?? 0, (sLever?.max as number) ?? 2, (sLever?.step as number) ?? 0.1, '', 'shadow.softness', gSoft);
    mkPer('Tint hue', 0, 360, 1, '°', 'shadow.tint.hue', gTint.hue);
    mkPer('Tint amount', 0, 1, 0.05, '', 'shadow.tint.amount', gTint.amount);
  } else {
    const cur = brandState.shadow?.tint;
    if (softness) panel.append(renderControl(softness));             // the blur dial, pulled out of the geometry panel
    const mk = (key: 'hue' | 'amount', label: string, min: number, max: number, step: number, unit: string): void => {
      const knob = el('div', 'knob');
      knob.append(el('label', 'knob-label', label));
      const input = rangeInput({ min, max, step, value: cur?.[key] ?? gTint[key] });
      const val = el('span', 'knob-val', `${input.value}${unit}`);
      input.oninput = () => { setPath(brandState, `shadow.tint.${key}`, Number(input.value)); val.textContent = `${input.value}${unit}`; apply(); };
      const body = el('div', 'knob-body'); body.append(input, val);
      knob.append(body);
      panel.append(knob);
    };
    mk('hue', 'Tint hue', 0, 360, 1, '°');
    mk('amount', 'Tint amount', 0, 1, 0.05, '');
  }
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
  // D — reflect the current mode's per-mode font family + weight (modeLevers.families/weights) when
  // they deviate, so the swap is visible here rather than only in the export (the #158 lesson). Falls
  // back to the global families/weightRoles.
  const famsByMode = ty.familiesByMode?.[currentMode];
  const wrByMode = ty.weightRolesByMode?.[currentMode];
  const lhByMode = ty.lineHeightsByMode?.[currentMode];
  const lsByMode = ty.letterSpacingsByMode?.[currentMode];
  const list = el('div', 'ts-list');
  for (const g of TYPE_GROUP_ORDER) {
    const c = byGroup.get(g);
    if (!c) continue;
    const famList = famsByMode ?? ty.families;
    const wrList = wrByMode ?? ty.weightRoles;
    const fam = famList.find((f) => f.role === c.family)?.stack.join(', ') ?? 'inherit';
    const wt = wrList.find((w) => w.role === c.weightRole)?.value ?? 400;
    // Per-mode leading + tracking resolve through the composite's line-height/tracking key (the seam);
    // tracking is visible even on one line, so the per-mode swap shows here (the #158 lesson).
    const lsVal = (lsByMode ?? ty.letterSpacings).find((x) => x.key === c.tracking)?.em ?? 0;
    const lhVal = (lhByMode ?? ty.lineHeights).find((x) => x.key === c.lineHeight)?.value ?? 1.4;
    const row = el('div', 'ts-row');
    const name = c.variant ? `${c.group}.${c.variant}` : c.group;   // eyebrow has an empty variant
    row.append(el('div', 'ts-meta mono', `${name} · ${c.sizePx}px · ${c.weightRole} ${wt}`));
    const sample = el('div', 'ts-sample', 'The spectrum resolves cleanly');
    sample.style.fontFamily = (c.family === 'mono' || g === 'code') ? 'var(--mono)' : fam;
    sample.style.fontWeight = String(wt);
    sample.style.fontSize = `${Math.min(c.sizePx, 60)}px`;   // cap the visual; real px is in the label
    sample.style.lineHeight = String(lhVal);
    sample.style.letterSpacing = `${lsVal}em`;
    if (c.textCase === 'uppercase' || g === 'eyebrow') { sample.style.textTransform = 'uppercase'; sample.style.letterSpacing = '0.08em'; }
    row.append(sample);
    // Variants strip — surfaces the type sub-levers that otherwise have no visible payoff: the WEIGHTS
    // each group ships (rendered at their weight), plus ITALIC / LINK samples when the group ships them,
    // and the group's size RANGE (so lowering titleFloor / adding title.2xs is visible). All read the
    // resolved composites, so a `weights`/`italics`/`links`/`titleFloor` edit shows here live.
    const groupComps = ty.composites.filter((cc) => cc.group === g);
    const chipFam = (c.family === 'mono' || g === 'code') ? 'var(--mono)' : fam;
    const weightsShipped = [...new Set(groupComps.map((cc) => cc.weightRole))]
      .sort((a, b) => wrList.findIndex((w) => w.role === a) - wrList.findIndex((w) => w.role === b));
    const strip = el('div', 'ts-variants');
    for (const role of weightsShipped) {
      const w = wrList.find((x) => x.role === role)?.value ?? 400;
      const chip = el('div', 'ts-var', `${role} ${w}`);
      chip.style.fontFamily = chipFam; chip.style.fontWeight = String(w);
      strip.append(chip);
    }
    if (groupComps.some((cc) => cc.italic)) { const ic = el('div', 'ts-var', 'italic'); ic.style.fontFamily = chipFam; ic.style.fontStyle = 'italic'; ic.style.fontWeight = String(wt); strip.append(ic); }
    if (groupComps.some((cc) => cc.link)) { const lc = el('div', 'ts-var', 'link'); lc.style.fontFamily = chipFam; lc.style.fontWeight = String(wt); lc.style.textDecoration = 'underline'; strip.append(lc); }
    const sizes = [...new Set(groupComps.map((cc) => cc.sizePx))].sort((a, b) => a - b);
    if (sizes.length > 1) strip.append(el('div', 'ts-var ts-var-range mono', `${sizes[0]}–${sizes[sizes.length - 1]}px`));
    row.append(strip);
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
  // D — reflect the current mode's per-mode radius ramp (modeLevers.radius) when it deviates, so the
  // change is visible here rather than off in the export (the #158 lesson). Falls back to the global.
  const byMode = theme.dims.radiusByMode?.[currentMode];
  const list = el('div', 'rad-list');
  for (const step of RADIUS_STEPS) {
    const overridePx = byMode?.find((s) => s.name === step)?.px;
    const px = step === 'none' ? 0 : (overridePx ?? rp.dims[`radius.${step}`] ?? 0);
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
  wrap.append(sectionHead('Elevation', 'The shadow ramp xs→2xl — the softness + tint levers reshape every step, resolved for the mode in view (see the preview below for the mode-reduced dark shadow).'));
  const m: Mode = currentMode;   // #171 — every specimen reflects the mode-context selection
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

/** The control-size specimen: the component-size tier (sm→xl) as mini control boxes at their resolved
 *  height + horizontal padding, so the DENSITY lever has a visible payoff (the preview components bind
 *  the space scale directly, not `size.*`, so nothing else shows the size tier). Mode-aware (D): reflects
 *  the current mode's per-mode density (`theme.dims.sizesByMode`) when it deviates, else the global tier. */
const renderSizeSpecimen = (): HTMLElement => {
  const wrap = el('div', 'size-spec');
  const byMode = theme.dims.sizesByMode?.[currentMode];
  const sizes = byMode ?? theme.dims.sizes;
  wrap.append(sectionHead('Control size', `The component-size tier — control height + paired padding per step${byMode ? ` (${MODE_LABEL[currentMode] ?? currentMode} density)` : ''}. The density lever reshapes the whole ramp; per-mode density retunes it for the mode in view.`));
  const list = el('div', 'sz-list');
  for (const z of sizes) {
    const cell = el('div', 'sz-cell');
    const box = el('div', 'sz-box', z.name);
    box.style.height = `${z.height}px`;
    box.style.padding = `0 ${z.padX}px`;
    cell.append(box, el('div', 'sz-lab mono', `${z.name} · ${z.height}px · pad ${z.padX}/${z.padY}`));
    list.append(cell);
  }
  wrap.append(list);
  return wrap;
};

/** The layout specimen: the responsive-grid axis — breakpoints (min-widths) with their column/gutter/
 *  margin grid, a base-column preview strip, and the container caps as proportional bars. The layout
 *  levers (breakpoints / columns / containers, all in the Advanced panel) have no other visible payoff.
 *  Reads `theme.layout` (not per-mode — layout composes with colour modes as a separate Figma axis). */
const renderLayoutSpecimen = (): HTMLElement => {
  const wrap = el('div', 'layout-spec');
  const ly = theme.layout;
  wrap.append(sectionHead('Layout grid', 'Breakpoints, the responsive column grid, and container caps — the layout scaffolding (breakpoints / columns / containers live in Advanced above).'));
  const table = el('table', 'ly-table');
  const head = el('tr');
  head.append(el('th', undefined, 'Breakpoint'), el('th', undefined, 'Min-width'), el('th', undefined, 'Columns'), el('th', undefined, 'Gutter'), el('th', undefined, 'Margin'));
  table.append(head);
  for (const g of ly.grid) {
    const bp = ly.breakpoints.find((b) => b.name === g.bp);
    const tr = el('tr');
    tr.append(el('td', 'mono', g.bp), el('td', 'mono', `${bp?.px ?? 0}px`), el('td', 'mono', String(g.columns)), el('td', 'mono', `${g.gutterPx}px`), el('td', 'mono', `${g.marginPx}px`));
    table.append(tr);
  }
  wrap.append(table);
  wrap.append(el('div', 'ly-cap', `${ly.baseColumns}-column base grid`));
  const cols = el('div', 'ly-cols');
  for (let i = 0; i < ly.baseColumns; i++) cols.append(el('div', 'ly-col'));
  wrap.append(cols);
  wrap.append(el('div', 'ly-cap', 'Container caps (fluid below the cap)'));
  const cont = el('div', 'ly-cont');
  const maxW = Math.max(ly.containerMax, ly.containerNarrow, 1);
  const bar = (label: string, px: number): HTMLElement => {
    const row = el('div', 'ly-cont-row');
    const b = el('div', 'ly-cont-bar');
    b.style.width = `${Math.max(6, (px / maxW) * 100)}%`;
    row.append(el('div', 'ly-cont-lab mono', `${label} · ${px}px`), b);
    return row;
  };
  cont.append(bar('container.max', ly.containerMax), bar('container.narrow', ly.containerNarrow));
  wrap.append(cont);
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
  // D — reflect the current mode's per-mode tempo (modeLevers.tempo) when it deviates, so the ramp
  // re-runs at the mode's speed here rather than only in the export (the #158 lesson). Duration is the
  // mode-varying part; easing/transitions are tempo-invariant. Falls back to the global ramp.
  const moByMode = mo.motionByMode?.[currentMode];
  const durOf = (role: string): number => (moByMode?.duration ?? mo.duration)[role] ?? 0;
  const tempoLabel = moByMode?.tempo ?? mo.tempo;
  wrap.append(sectionHead('Motion', `The semantic transitions at tempo '${tempoLabel}' — each bar fills at its resolved duration + easing curve. Adjust the tempo and they re-run; reduce-motion is honoured (the engine also derives a reduced ramp).`));
  const bez = (b: number[]): string => `cubic-bezier(${b.join(', ')})`;
  const list = el('div', 'mo-list');
  const fills: HTMLElement[] = [];
  for (const t of mo.transitions) {
    const ms = durOf(t.duration);
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
  const m: Mode = currentMode;   // #171 — every specimen reflects the mode-context selection
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
// The neutral emphasis (subtle grey vs bold fill) now lives on the Neutral interactive card
// (renderNeutralCard) rather than a standalone specimen — docs/23 §2, owner request.
const NEUTRAL_EMPHASES: Array<['subtle' | 'strong', string]> = [['subtle', 'subtle · light grey'], ['strong', 'strong · bold fill']];

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

// ---- Gradient editor (docs/23 §2 "Gradients") -----------------------------
// The gradient axis was on/off only; this edits the DEFINITION — kind (linear/radial), angle or
// centre+shape, interpolation, and the ramp-aliased stops — writing an explicit `GradientInput[]`
// to `brandState.gradients` (the engine's opt-in axis, `boolean | GradientInput[]`). `true` (the
// toggle default) materialises to the engine's default single brand gradient for display; the first
// edit writes it out explicitly. Stops alias the ramp (palette + step), never raw hex.
const DEFAULT_GRADIENT = (): GradientInput => ({
  name: 'brand', kind: 'linear', angle: 135, interpolation: 'oklch',
  stops: [{ palette: 'primary', step: 600, position: 0 }, { palette: 'primary', step: 350, position: 1 }],
});
/** The editable gradient array — materialising the `true` default and treating `false`/absent as empty. */
const readGradients = (): GradientInput[] => {
  const g = brandState.gradients;
  if (Array.isArray(g)) return g;
  if (g === true) return [DEFAULT_GRADIENT()];
  return [];
};
/** Write the array back; an empty array collapses to `false` (off) so the toggle + specimen agree. */
const writeGradients = (arr: GradientInput[]): void => { brandState.gradients = arr.length ? arr : false; applyFull(); };
/** Resolve a stop's `{palette, step}` alias to its ramp hex (for the live preview). */
const gradStopHex = (palette: string, step: number): string =>
  theme.palettes.find((p) => p.palette === palette)?.steps.find((s) => s.num === step)?.hex ?? '#888888';
/** Build the CSS gradient from an INPUT gradient (stops resolved through the ramp). Mirrors `gradientCss`
 *  but reads palette/step aliases rather than pre-resolved hexes. */
const inputGradientCss = (g: GradientInput): string => {
  const stops = g.stops.slice().sort((a, b) => a.position - b.position)
    .map((s) => `${gradStopHex(s.palette, s.step)} ${Math.round(s.position * 100)}%`).join(', ');
  return (g.kind ?? 'linear') === 'radial'
    ? `radial-gradient(${g.shape ?? 'ellipse'} at ${Math.round((g.center?.[0] ?? 0.5) * 100)}% ${Math.round((g.center?.[1] ?? 0.5) * 100)}% in oklch, ${stops})`
    : `linear-gradient(${g.angle ?? 135}deg in oklch, ${stops})`;
};

/** The Gradients section — a bespoke on/off toggle (own `applyFull` so the editor mounts/unmounts) plus,
 *  when on, one editor card per gradient. */
const renderGradientsSection = (host: HTMLElement): void => {
  const on = !!brandState.gradients;
  // On/off toggle — the shared toggleField, but its callback rebuilds the workspace (applyFull) so the
  // editor mounts/unmounts (it lives in the sections layer, not the volatile specimens).
  const desc = leverByKey('gradients')?.description ?? 'Ship one or more decorative brand gradients (opt-in). Stop colors alias the ramp and interpolate in OKLCH.';
  host.append(knob('Gradients', toggleField(on, (checked) => { brandState.gradients = checked; applyFull(); }), desc));
  if (!on) return;

  const grads = readGradients();
  const palNames = theme.palettes.map((p) => p.palette);
  const grid = el('div', 'gr-ed-list');
  grads.forEach((g, gi) => grid.append(renderGradientCard(g, gi, grads, palNames)));
  host.append(grid);
  // Add gradient — a fresh linear gradient with a unique slug name (name is a token path segment).
  const add = addButton('+ Add gradient', () => {
    const arr = readGradients();
    const used = new Set(arr.map((x) => x.name));
    let n = arr.length + 1, name = `gradient-${n}`;
    while (used.has(name)) name = `gradient-${++n}`;
    arr.push({ ...DEFAULT_GRADIENT(), name });
    writeGradients(arr);
  }, 'gr-ed-add');
  host.append(add);
};

/** One gradient's editor card — preview · kind/geometry/interpolation · ramp-aliased stops. */
const renderGradientCard = (g: GradientInput, gi: number, all: GradientInput[], palNames: string[]): HTMLElement => {
  const kind = g.kind ?? 'linear';
  const card = el('div', 'gr-ed-card');
  // Header — the gradient name (a token path segment; not renamed here) + remove.
  const head = el('div', 'gr-ed-head');
  head.append(el('h4', 'gr-ed-name', g.name), tokenPill(`gradient.${g.name}`));
  head.append(removeButton(() => { const arr = readGradients(); arr.splice(gi, 1); writeGradients(arr); }, 'Remove gradient'));
  card.append(head);
  // Live preview.
  const sw = el('div', 'gr-ed-sw'); sw.style.background = inputGradientCss(g);
  card.append(sw);

  // Geometry controls — kind, then angle (linear) or shape + centre (radial), then interpolation.
  const ctrls = el('div', 'gr-ed-ctrls');
  const mut = (fn: (gg: GradientInput) => void): void => { const arr = readGradients(); fn(arr[gi]); writeGradients(arr); };
  const labeledSelect = (label: string, opts: [string, string][], cur: string, onPick: (v: string) => void): HTMLElement => {
    const wrap = el('div', 'gr-ed-field');
    wrap.append(el('label', 'gr-ed-lab', label));
    const sel = selectEl('cap');
    for (const [v, t] of opts) sel.append(optionEl(v, t, v === cur));
    sel.onchange = () => onPick(sel.value);
    wrap.append(sel);
    return wrap;
  };
  ctrls.append(labeledSelect('Kind', [['linear', 'Linear'], ['radial', 'Radial']], kind, (v) => mut((gg) => { gg.kind = v as 'linear' | 'radial'; })));
  if (kind === 'linear') {
    const f = el('div', 'gr-ed-field');
    f.append(el('label', 'gr-ed-lab', `Angle · ${g.angle ?? 135}°`));
    const range = rangeInput({ className: 'gr-ed-range', min: 0, max: 360, step: 5, value: g.angle ?? 135 });
    range.oninput = () => { (f.firstChild as HTMLElement).textContent = `Angle · ${range.value}°`; sw.style.background = inputGradientCss({ ...g, angle: Number(range.value) }); };
    range.onchange = () => mut((gg) => { gg.angle = Number(range.value); });
    f.append(range);
    ctrls.append(f);
  } else {
    ctrls.append(labeledSelect('Shape', [['ellipse', 'Ellipse'], ['circle', 'Circle']], g.shape ?? 'ellipse', (v) => mut((gg) => { gg.shape = v as 'circle' | 'ellipse'; })));
    const center = g.center ?? [0.5, 0.5];
    const centerField = (label: string, idx: 0 | 1): HTMLElement => {
      const f = el('div', 'gr-ed-field');
      f.append(el('label', 'gr-ed-lab', label));
      const num = numberField({ className: 'gr-ed-num', min: 0, max: 100, step: 5, value: Math.round(center[idx] * 100) });
      num.onchange = () => mut((gg) => { const c: [number, number] = [...(gg.center ?? [0.5, 0.5])] as [number, number]; c[idx] = clampUnit(Number(num.value) / 100); gg.center = c; });
      f.append(num);
      return f;
    };
    ctrls.append(centerField('Center X %', 0), centerField('Center Y %', 1));
  }
  ctrls.append(labeledSelect('Interpolation', [['oklch', 'OKLCH'], ['srgb', 'sRGB']], g.interpolation ?? 'oklch', (v) => mut((gg) => { gg.interpolation = v as 'oklch' | 'srgb'; })));
  card.append(ctrls);

  // Stops — each aliases the ramp (palette + step) with a position; add/remove.
  card.append(el('h5', 'gr-ed-stopsh', 'Stops'));
  const stopsWrap = el('div', 'gr-ed-stops');
  g.stops.forEach((st, si) => stopsWrap.append(renderGradientStop(g, gi, st, si, palNames, mut)));
  card.append(stopsWrap);
  const addStop = addButton('+ Add stop', () => mut((gg) => {
    const last = gg.stops[gg.stops.length - 1];
    gg.stops = [...gg.stops, { palette: last?.palette ?? palNames[0], step: last?.step ?? 500, position: 1 }];
  }), 'gr-ed-addstop');
  card.append(addStop);
  return card;
};

/** A single gradient stop row — swatch · palette · step · position % · remove (kept ≥2 stops). */
const renderGradientStop = (g: GradientInput, gi: number, st: { palette: string; step: number; position: number }, si: number, palNames: string[], mut: (fn: (gg: GradientInput) => void) => void): HTMLElement => {
  const row = el('div', 'gr-ed-stop');
  row.append(swatch(gradStopHex(st.palette, st.step), 'gr-ed-stopsw'));
  const palSel = selectEl('fill');
  for (const p of palNames) palSel.append(optionEl(p, p, p === st.palette));
  // Changing palette re-homes the step to the nearest valid step in the new palette.
  palSel.onchange = () => mut((gg) => {
    const steps = theme.palettes.find((p) => p.palette === palSel.value)?.steps ?? [];
    const keep = steps.find((s) => s.num === gg.stops[si].step)?.num ?? steps.find((s) => s.num === 500)?.num ?? steps[Math.floor(steps.length / 2)]?.num ?? gg.stops[si].step;
    gg.stops[si] = { ...gg.stops[si], palette: palSel.value, step: keep };
  });
  const stepSel = selectEl('fill');
  const steps = theme.palettes.find((p) => p.palette === st.palette)?.steps ?? [];
  for (const s of steps) stepSel.append(optionEl(String(s.num), s.key, s.num === st.step));
  stepSel.onchange = () => mut((gg) => { gg.stops[si] = { ...gg.stops[si], step: Number(stepSel.value) }; });
  const pos = numberField({ className: 'gr-ed-num', min: 0, max: 100, step: 5, value: Math.round(st.position * 100), title: 'Position %' });
  pos.onchange = () => mut((gg) => { gg.stops[si] = { ...gg.stops[si], position: clampUnit(Number(pos.value) / 100) }; });
  row.append(palSel, stepSel, pos);
  if (g.stops.length > 2) {
    row.append(removeButton(() => mut((gg) => { gg.stops = gg.stops.filter((_, i) => i !== si); }), 'Remove stop', 'gr-ed-stoprm'));
  }
  return row;
};
const clampUnit = (n: number): number => Math.max(0, Math.min(1, Number.isFinite(n) ? n : 0));

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
  const m: Mode = currentMode;   // #171 — every specimen reflects the mode-context selection
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
let modeStripHost: HTMLElement;   // tier 2 of the global header — the persistent mode selector (docs/23 §7)

/** Repaint the persistent mode-selector strip in the global header. Called on mode change, on menu
 *  toggles, and by apply/applyFull (the per-mode contrast marks track the theme). No-op before the
 *  first build (the start screen has no header). */
function renderModeStrip(): void {
  if (!modeStripHost) return;
  modeStripHost.innerHTML = '';
  if (!firstRun) modeStripHost.append(renderModeContext());
  // Keep the sticky rail's offset tied to the ACTUAL header height — the mode chips can wrap to a
  // second row when a brand has many modes, and a fixed offset would tuck the rail under the header.
  const chrome = modeStripHost.parentElement;
  if (chrome) document.documentElement.style.setProperty('--chrome-h', `${chrome.offsetHeight}px`);
}

const PAGE_RENDERERS: Record<PageKey, (host: HTMLElement) => void> = {
  palettes: renderPrimitives,
  surfaces: renderSurfacesPage,
  interactive: renderInteractivePage,
  typography: renderTypographyPage,
  elevation: renderElevationPage,
  sizeRadius: renderSizeRadiusPage,
  layout: renderLayoutPage,
  motion: renderMotionPage,
  preview: renderPreviewPage,
};
function renderWorkspace(): void {
  workspace.innerHTML = '';
  PAGE_RENDERERS[page](workspace);
}

// ---- brand setup — selector menu: name + namespace, switch / new / import --------
let barHost: HTMLElement;
let brandMenuOpen = false;
let exportMenuOpen = false;
let importOpen = false;
let importErr: string | null = null;
let importText = '';            // M-17: survives re-renders so a failed paste isn't wiped
let importPending: BrandInput | null = null;   // #160: validated import awaiting confirm-overwrite
let outsideBound = false;

/** Replace the working brand wholesale (switch / new / import) and re-render. */
const loadBrand = (input: BrandInput): void => {
  brandState = structuredClone(input);
  brandMenuOpen = false; importOpen = false; importErr = null; importText = ''; importPending = null;
  page = 'palettes';
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

// design.md import (#160) — one validation path shared by the start-screen upload card and the
// post-setup import, so both reject the same off-spec input with the same friendly errors.
const MD_FILE_RE = /\.(md|markdown|txt)$/i;
const IMPORT_ACCEPT = '.md,.markdown,.txt,text/markdown,text/plain';

/** Engine acceptance IS the validation: parse the design.md, then confirm the engine builds it.
 *  Returns the BrandInput or a friendly error — the working brand is never touched here. (The full
 *  schema validator is node-bound, so it can't run here; brandTheme's guards cover the rest.) */
const validateDesignMd = (text: string): { input: BrandInput } | { error: string } => {
  if (!text.trim()) return { error: 'Nothing to import — the file is empty.' };
  let input: BrandInput;
  try { input = parseDesignMd(text).input; }
  catch (e) { return { error: `That doesn't read as a design.md: ${(e as Error).message}` }; }
  try { brandTheme(input); }
  catch (e) { return { error: `Parsed, but the engine rejected it: ${(e as Error).message}` }; }
  return { input };
};

/** Read an uploaded File as design.md text, rejecting non-markdown/text file types up front (#160). */
const readDesignMdFile = (file: File): Promise<{ text: string } | { error: string }> => {
  const okType = MD_FILE_RE.test(file.name) || /^text\//.test(file.type || '');
  if (!okType) return Promise.resolve({ error: `That's not a design.md — upload a .md file (got "${file.name}").` });
  return new Promise((resolve) => {
    const r = new FileReader();
    r.onload = () => resolve({ text: String(r.result ?? '') });
    r.onerror = () => resolve({ error: `Couldn't read "${file.name}".` });
    r.readAsText(file);
  });
};

/** Post-setup import: validate, then STAGE for confirm-overwrite — loadBrand replaces the working
 *  brand, so we never overwrite current edits without an explicit Replace (#160). */
const stageImport = (text: string): void => {
  importText = text;              // M-17: keep the paste so an error re-render doesn't wipe it
  const res = validateDesignMd(text);
  if ('error' in res) { importErr = res.error; importPending = null; renderBar(); return; }
  importErr = null; importPending = res.input; renderBar();
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

  // Modes moved OUT of this dropdown (#171) — the mode set now lives in the workspace
  // mode-context strip's "Edit modes" popover, next to the mode you're viewing.

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
  imp.onclick = () => { importOpen = !importOpen; importErr = null; importPending = null; renderBar(); };
  menu.append(imp);

  if (importOpen) {
    const box = el('div', 'bm-import');
    if (importPending) {
      // Validated already — confirm before overwriting the working brand (#160).
      box.append(el('p', 'bm-confirm', `Replace the current brand with “${importPending.id}”? This overwrites your current edits.`));
      const row = el('div', 'bm-confirm-row');
      const rep = el('button', 'bm-load', 'Replace brand') as HTMLButtonElement;
      rep.onclick = () => { const inp = importPending!; importPending = null; loadBrand(inp); };
      const can = el('button', 'bm-cancel', 'Cancel') as HTMLButtonElement;
      can.onclick = () => { importPending = null; renderBar(); };
      row.append(rep, can);
      box.append(row);
    } else {
      const ta = el('textarea', 'bm-ta') as HTMLTextAreaElement;
      ta.placeholder = 'Paste a design.md — --- YAML frontmatter --- then prose…';
      ta.spellcheck = false;
      ta.value = importText;                                   // M-17: restore across re-renders
      ta.oninput = () => { importText = ta.value; };           // a mode-toggle mid-paste won't lose it
      box.append(ta);
      if (importErr) box.append(el('p', 'bm-err', importErr));
      const row = el('div', 'bm-import-row');
      const up = el('label', 'bm-upload');
      const fi = el('input', 'bm-file') as HTMLInputElement;
      fi.type = 'file'; fi.accept = IMPORT_ACCEPT;
      fi.onchange = async () => {
        const f = fi.files?.[0]; if (!f) return;
        const read = await readDesignMdFile(f);
        if ('error' in read) { importErr = read.error; importPending = null; renderBar(); return; }
        stageImport(read.text);
      };
      up.append(el('span', undefined, '↑ Upload .md'), fi);
      const load = el('button', 'bm-load', 'Load') as HTMLButtonElement;
      load.onclick = () => stageImport(ta.value);
      row.append(up, load);
      box.append(row);
    }
    menu.append(box);
  }

  // Export + Apply-to-Figma moved OUT of this dropdown (#159) — they're their own bar affordances
  // now (Export is an artifact output, not a brand source; Apply is the plugin's primary CTA).
  return menu;
};

/** Export dropdown (#159) — the two download artifacts. design.md round-trips back into Import;
 *  tokens.json is the resolved DTCG tree. A pure output menu, split from the brand switcher. */
const renderExportMenu = (): HTMLElement => {
  const menu = el('div', 'brandmenu exportmenu');
  menu.append(el('div', 'bm-cap', 'Export'));
  const closeThen = (fn: () => void) => () => { exportMenuOpen = false; renderBar(); fn(); };
  const expMd = el('button', 'bm-item', '↓ design.md') as HTMLButtonElement;
  expMd.onclick = closeThen(exportDesignMd);
  const expTok = el('button', 'bm-item', '↓ tokens.json — DTCG') as HTMLButtonElement;
  expTok.onclick = closeThen(exportTokens);
  menu.append(expMd, expTok);
  menu.append(el('p', 'bm-hint', 'design.md re-imports here; tokens.json is the resolved tree.'));
  return menu;
};

/** The brand bar (#159) — a horizontal row of brand-level utilities, replacing the single
 *  overloaded dropdown. Left: brandmark. Right: brand switcher (identity + examples + new +
 *  import — a brand *source*), Export (artifact *output*), and, in the plugin only, the primary
 *  Apply-to-Figma CTA (the terminal action of the plugin flow). Modes live in the workspace
 *  mode-context strip (#171), not here. The bar is sticky (see `.bar`). */
function renderBar(): void {
  barHost.innerHTML = '';
  const mark = el('div', 'brandmark');
  mark.append(el('span', 'logo'), el('span', 'wordmark', 'Prism3'), el('span', 'studio', 'Theme studio'));
  barHost.append(mark);

  const actions = el('div', 'bar-actions');

  // Brand switcher — identity, examples, new, import.
  const bWrap = el('div', 'barmenu-wrap');
  const sel = el('button', 'brandsel' + (brandMenuOpen ? ' open' : '')) as HTMLButtonElement;
  const dot = el('span', 'dot'); dot.style.background = hex(oklchToRgb(brandState.primary));
  sel.append(dot, el('span', 'bs-name', brandState.id), el('span', 'caret', '▾'));
  sel.onclick = (e) => { e.stopPropagation(); brandMenuOpen = !brandMenuOpen; exportMenuOpen = false; if (!brandMenuOpen) importOpen = false; renderBar(); };
  bWrap.append(sel);
  if (brandMenuOpen) bWrap.append(renderBrandMenu());
  actions.append(bWrap);

  // Export — the download artifacts.
  const eWrap = el('div', 'barmenu-wrap');
  const exp = el('button', 'barbtn' + (exportMenuOpen ? ' open' : '')) as HTMLButtonElement;
  exp.append(el('span', undefined, '↓ Export'), el('span', 'caret', '▾'));
  exp.onclick = (e) => { e.stopPropagation(); exportMenuOpen = !exportMenuOpen; brandMenuOpen = false; importOpen = false; renderBar(); };
  eWrap.append(exp);
  if (exportMenuOpen) eWrap.append(renderExportMenu());
  actions.append(eWrap);

  // Apply to Figma — plugin-only, the primary CTA (the plugin's terminal action). Absent + DCE'd
  // on web (`commit.isFigma` false). The #109 read-back seed status rides alongside as a pill.
  if (commit.isFigma) {
    if (seedInfo) actions.append(el('span', 'bar-seed' + (seedInfo.ok ? '' : ' bad'), seedInfo.summary));
    const applyBtn = el('button', 'barbtn primary', '↳ Apply to Figma') as HTMLButtonElement;
    applyBtn.onclick = () => commit.postTheme(lastGoodInput);
    actions.append(applyBtn);
  }

  barHost.append(actions);

  if (!outsideBound) {
    document.addEventListener('mousedown', (e) => {
      if ((brandMenuOpen || exportMenuOpen) && !(e.target as HTMLElement).closest('.barmenu-wrap')) {
        brandMenuOpen = false; exportMenuOpen = false; importOpen = false; renderBar();
      }
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

  // Path 4 — import an existing design.md by upload (#160). No overwrite confirm: it's the first-run
  // screen, there's no brand to replace. File type + engine-acceptance are both validated first.
  const c4 = el('div', 'start-card start-row2');
  const t4 = el('div', 'start-c2t');
  t4.append(el('h2', 'start-ct', 'Import a design.md'), el('p', 'start-cd', 'Already have a design.md? Upload it to load the full brand.'));
  const err4 = el('p', 'start-imp-err');
  t4.append(err4);
  const up4 = el('label', 'start-alt start-upload');
  const fi4 = el('input', 'start-file') as HTMLInputElement;
  fi4.type = 'file'; fi4.accept = IMPORT_ACCEPT;
  fi4.onchange = async () => {
    err4.textContent = '';
    const f = fi4.files?.[0]; if (!f) return;
    const read = await readDesignMdFile(f);
    if ('error' in read) { err4.textContent = read.error; return; }
    const res = validateDesignMd(read.text);
    if ('error' in res) { err4.textContent = res.error; return; }
    enter(res.input);
  };
  up4.append(el('span', undefined, '↑ Upload…'), fi4);
  c4.append(t4, up4);
  col.append(c4);

  view.append(col);
  return view;
};

const build = (): void => {
  app.innerHTML = '';
  if (firstRun) { app.append(renderStartScreen()); return; }   // first run: the start moment stands in for the app
  // Two-tier global header (docs/23 §7): tier 1 = brand identity + Export (the "brand bar"); tier 2 =
  // the persistent mode selector. Both sticky together so the mode context never scrolls away.
  const chrome = el('header', 'chrome');
  barHost = el('div', 'bar');
  chrome.append(barHost);
  modeStripHost = el('div', 'modebar');
  chrome.append(modeStripHost);
  app.append(chrome);
  renderBar();
  renderModeStrip();

  const shell = el('div', 'shell');
  const rail = el('nav', 'rail');
  // Rail-as-data (docs/23 §7): a flat list of focused destinations, no ordinals — top-to-bottom order
  // carries the compose sequence. A `view` destination (Preview) sits after a divider.
  NAV.forEach((s) => {
    if ('view' in s && s.view) rail.append(el('div', 'rail-div'));
    const it = el('button', 'stage' + (s.key === page ? ' active' : '')) as HTMLButtonElement;
    const t = el('span', 'stage-t');
    t.append(el('b', undefined, s.label), el('small', undefined, s.sub));
    it.append(t);
    it.onclick = () => { if (page !== s.key) { page = s.key; build(); } };
    rail.append(it);
  });
  rail.append(el('p', 'rail-note', 'Ordered the way a theme composes — palettes first, then how they’re applied to surfaces and interaction, then type and form. Preview renders the whole system.'));
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

.chrome{position:sticky;top:0;z-index:20;background:var(--paper)}
.bar{display:flex;align-items:center;justify-content:space-between;padding:26px 2px 12px}
.modebar{padding:0 2px 14px}
.brandmark{display:flex;align-items:center;gap:11px}
.logo{width:18px;height:18px;border-radius:var(--r-xs);background:conic-gradient(from 210deg,#5e4bc3,#0088be,#2f6833,#a13731,#5e4bc3)}
.wordmark{font-weight:640;letter-spacing:-0.02em;font-size:16px}
.studio{color:var(--muted);font-size:13px;border-left:1px solid var(--line2);padding-left:11px}
.bar-actions{display:flex;align-items:center;gap:10px}
.barmenu-wrap{position:relative}
.brandsel,.barbtn{display:flex;align-items:center;gap:9px;font:inherit;font-weight:560;border:1px solid var(--line2);background:var(--panel);padding:8px 13px;border-radius:var(--r-sm);font-size:13.5px;cursor:pointer;color:var(--ink);white-space:nowrap}
.brandsel.open,.barbtn.open,.barbtn:hover,.brandsel:hover{border-color:var(--ink2)}
.brandsel .dot{width:12px;height:12px;border-radius:4px}
.brandsel .caret,.barbtn .caret{color:var(--faint);margin-left:2px}
.barbtn.primary{background:var(--ink);color:#fff;border-color:var(--ink)}
.barbtn.primary:hover{background:var(--ink2);border-color:var(--ink2)}
.bar-seed{font-size:11.5px;color:var(--muted);max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.bar-seed.bad{color:#a12}
.brandmenu{position:absolute;top:calc(100% + 8px);right:0;width:288px;background:var(--panel);border:1px solid var(--line2);border-radius:var(--r);padding:12px;z-index:20;display:flex;flex-direction:column;gap:2px;box-shadow:0 12px 32px -8px rgba(24,24,27,.20),0 4px 12px -4px rgba(24,24,27,.12)}
.exportmenu{width:232px}
.bm-cap{font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:var(--faint);font-weight:600;margin:4px 2px 6px}
.bm-field{display:flex;align-items:center;gap:10px;padding:4px 2px}
.bm-lab{font-size:12.5px;color:var(--ink2);width:78px;flex:none}
.bm-in{flex:1;min-width:0;padding:6px 9px;border:1px solid var(--line2);border-radius:var(--r-xs);font:inherit;font-size:13px;background:var(--paper)}
.bm-in.bad{border-color:#d23;background:#fdecec}
.bm-hint{margin:2px 2px 4px;font-size:11px;color:var(--faint);font-family:var(--mono)}
.bm-div{height:1px;background:var(--line);margin:8px 0}
.bm-item{display:flex;align-items:center;gap:9px;width:100%;text-align:left;border:0;background:none;font:inherit;font-size:13px;color:var(--ink2);padding:8px 8px;border-radius:var(--r-xs);cursor:pointer}
.bm-item:hover{background:var(--paper)}
.bm-item.cur{color:var(--ink);font-weight:600}
.bm-dot{width:11px;height:11px;border-radius:3px;flex:none}
.bm-import{margin-top:6px;display:flex;flex-direction:column;gap:8px}
.bm-ta{width:100%;height:120px;resize:vertical;padding:9px;border:1px solid var(--line2);border-radius:var(--r-xs);font-family:var(--mono);font-size:12px;background:var(--paper);line-height:1.5}
.bm-err{margin:0;font-size:11.5px;color:#a12;line-height:1.5}
.bm-load{align-self:flex-start;border:1px solid var(--ink);background:var(--ink);color:#fff;border-radius:var(--r-xs);padding:7px 16px;font:inherit;font-size:13px;font-weight:560;cursor:pointer}
.bm-file,.start-file{display:none}
.bm-import-row,.bm-confirm-row{display:flex;align-items:center;gap:8px}
.bm-upload{display:inline-flex;align-items:center;gap:6px;border:1px solid var(--line2);background:var(--paper);border-radius:var(--r-xs);padding:7px 12px;font-size:12.5px;color:var(--muted);cursor:pointer;white-space:nowrap}
.bm-upload:hover{border-color:var(--ink);color:var(--ink)}
.bm-cancel{border:1px solid var(--line2);background:var(--panel);border-radius:var(--r-xs);padding:7px 14px;font:inherit;font-size:13px;color:var(--ink2);cursor:pointer}
.bm-cancel:hover{border-color:var(--ink)}
.bm-confirm{margin:2px 2px 8px;font-size:12.5px;line-height:1.55;color:var(--ink2)}
.start-upload{display:inline-flex;align-items:center;gap:6px}
.start-imp-err{margin:9px 0 0;font-size:12px;color:#a12;line-height:1.5}

.shell{display:grid;grid-template-columns:210px minmax(0,1fr);gap:60px;align-items:start;margin-top:20px}
.rail{position:sticky;top:calc(var(--chrome-h, 120px) + 10px);display:flex;flex-direction:column;gap:4px}
.rail-div{height:1px;background:var(--line);margin:10px 10px}
.stage{display:flex;align-items:center;gap:13px;text-align:left;border:1px solid transparent;background:none;font:inherit;padding:11px 12px;border-radius:var(--r-sm);cursor:pointer;color:var(--ink2)}
.stage:hover{background:var(--panel)}
.stage.active{background:var(--panel);border-color:var(--line2)}
.stage-t{display:flex;flex-direction:column;line-height:1.3;gap:2px}
.stage-t b{font-weight:600;font-size:13.5px}
.stage.active .stage-t b{color:var(--ink)}
.stage-t small{color:var(--faint);font-size:11.5px}
.rail-note{color:var(--muted);font-size:12px;line-height:1.6;margin:22px 8px 0;padding-top:20px;border-top:1px solid var(--line)}

.hero{padding:6px 0 4px}
.hero h1{margin:0;font-size:40px;font-weight:660;letter-spacing:-0.03em;line-height:1.08}
.lede{color:var(--muted);max-width:60ch;margin:18px 0 0;font-size:16px;line-height:1.65}

/* Each primitive section pairs its control card (left) with the ramps it drives (right),
   so a change to the card is always visible in the palette beside it (#158). */
.prim-sec{display:grid;grid-template-columns:340px 1fr;gap:40px;align-items:start}
.prim-sec>.panel{position:sticky;top:24px}
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
/* The dashboard <select> component (doc 24 C1) — one base class owns every dropdown's cosmetics + the
   consistent chevron; sm / fill / cap are additive size/context modifiers. */
.select{appearance:none;-webkit-appearance:none;font:inherit;font-size:13.5px;padding:9px 11px;padding-right:28px;border:1px solid var(--line2);border-radius:var(--r-xs);background:var(--paper);color:var(--ink);cursor:pointer;
  background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 12'%3E%3Cpath d='M2.5 4.5 6 8l3.5-3.5' fill='none' stroke='%2371717a' stroke-width='1.6' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
  background-repeat:no-repeat;background-position:right 9px center;background-size:11px}
.select:disabled{opacity:.6}
.select.sm{font-size:12.5px;padding:6px 9px;padding-right:26px}
.select.fill{flex:1;min-width:0}
.select.cap{max-width:260px}
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
/* Toggle rendered as a switch (pill track + sliding thumb), not a native checkbox. */
.knob input.toggle{appearance:none;-webkit-appearance:none;flex:none;width:38px;height:22px;margin:0;border-radius:999px;background:var(--line2);position:relative;cursor:pointer;transition:background .15s ease}
.knob input.toggle::after{content:'';position:absolute;top:2px;left:2px;width:18px;height:18px;border-radius:50%;background:#fff;box-shadow:0 1px 2px rgba(0,0,0,.25);transition:transform .15s ease}
.knob input.toggle:checked{background:var(--ink)}
.knob input.toggle:checked::after{transform:translateX(16px)}
.knob input.toggle:disabled{opacity:.5;cursor:default}
.knob input:disabled{opacity:.5}
.knob .select{margin-top:8px}
.knob-val{font-variant-numeric:tabular-nums;color:var(--muted);font-size:12.5px}
.knob-val.ro{margin-top:6px}
.knob-desc{margin:7px 0 0;font-size:12px;color:var(--faint);line-height:1.5}
.type-editor{margin-bottom:8px}
.te-font{width:100%;margin-top:8px;padding:7px 9px;border:1px solid var(--line2);border-radius:var(--r-xs);font:inherit;background:var(--paper)}
.te-wrow{display:flex;align-items:center;justify-content:space-between;gap:12px}
/* The number-input component (doc 24 C2) — .num owns the shared field cosmetics; the context classes
   below carry only width / size / alignment deltas. */
.num{padding:6px 8px;border:1px solid var(--line2);border-radius:var(--r-xs);font:inherit;background:var(--paper)}
.te-weight{width:88px;font-variant-numeric:tabular-nums;text-align:right}
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
/* D (typography) — per-mode notes + shared read-only markers. */
.te-modenote{margin:0 0 16px;font-size:12.5px;color:var(--muted);line-height:1.55;padding:10px 13px;background:var(--paper);border:1px solid var(--line);border-radius:var(--r-sm)}
.te-order-warn{margin:10px 2px 0;font-size:12px;color:#a12;line-height:1.5}
.te-shared-note{margin:4px 2px 10px;font-size:12px;color:var(--faint);line-height:1.5}
.te-shared-ro{margin:6px 0 0;font-size:13.5px;font-weight:560;color:var(--ink2)}
.te-cat select:disabled,.te-cat input:disabled{opacity:.55;cursor:not-allowed}
/* D (typography) — the per-mode leading/tracking ramps (read-only chips in Light, inputs in a mode). */
.te-shared-ro-note{margin:4px 2px 10px;font-size:12px;color:var(--faint);line-height:1.5}
.te-ramp{display:flex;flex-wrap:wrap;gap:8px}
.te-ramp-cell{display:flex;flex-direction:column;gap:4px;min-width:74px}
.te-ramp-key{font-size:11px;color:var(--muted)}
.te-ramp-in{width:74px;padding:5px 7px;font-size:12px}
.te-ramp-ro{font-size:13px;color:var(--ink2);padding:5px 0}
/* D (shadow) — per-mode softness/tint: the knob header carries an Auto/reset affordance. */
.sh-knob-head{display:flex;align-items:baseline;justify-content:space-between;gap:8px}
.sh-auto{font:inherit;font-size:11px;color:var(--muted);background:none;border:none;padding:0;cursor:default}
.sh-auto.on{color:var(--ink2);cursor:pointer;text-decoration:underline}
.obj-editor{margin-bottom:8px}
.obj-lede{margin:0 0 8px;font-size:12px;color:var(--faint);line-height:1.5}
.obj-row{display:flex;gap:8px;margin-top:8px}

.stage-vol{display:flex;flex-direction:column}
.pvhost{display:flex;flex-direction:column;gap:16px}
.type-spec{margin-bottom:8px}
.ts-list{display:flex;flex-direction:column;gap:22px;border:1px solid var(--line);border-radius:var(--r);padding:24px;background:var(--panel)}
.ts-row{display:flex;flex-direction:column;gap:8px;min-width:0}
.ts-meta{font-size:11.5px;color:var(--faint)}
.ts-sample{color:var(--ink);letter-spacing:-0.02em;line-height:1.1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
/* Type-specimen variants strip — the weights each group ships + italic/link/size-range (the type sub-levers). */
.ts-variants{display:flex;flex-wrap:wrap;align-items:baseline;gap:6px 14px;margin-top:2px}
.ts-var{font-size:14px;color:var(--ink2);line-height:1.2}
.ts-var-range{font-size:11px;color:var(--faint);align-self:center}
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
/* D (density) — the control-size specimen: mini controls at their resolved height + padding. */
.sz-list{display:flex;flex-wrap:wrap;align-items:flex-end;gap:20px;border:1px solid var(--line);border-radius:var(--r);padding:24px;background:var(--panel)}
.sz-cell{display:flex;flex-direction:column;align-items:center;gap:9px}
.sz-box{display:flex;align-items:center;justify-content:center;min-width:44px;background:var(--ink);color:var(--panel);border-radius:6px;font-size:12px;font-weight:560}
.sz-lab{font-size:11px;color:var(--muted);white-space:nowrap}
/* Manifest-advanced scalar/enum levers — exposed as a normal panel (no disclosure). */
.adv-panel{margin-top:12px}
/* Advanced object/list bespoke editors (responsive type, breakpoints, emphasized easing). */
.adv-obj{margin-top:16px;padding-top:14px;border-top:1px dashed var(--line)}
.adv-obj-h{font-size:12px;font-weight:600;color:var(--ink2);margin-bottom:10px}
.adv-obj-note{margin:8px 2px 0;font-size:11px;color:var(--faint);line-height:1.5}
.adv-row{display:flex;align-items:center;gap:10px;margin-top:8px;font-size:12.5px;color:var(--ink2)}
.adv-row-lab{min-width:150px}
.adv-num{width:88px;padding:5px 7px;font-size:12px}
.adv-unit{font-size:11px;color:var(--faint)}
.adv-bplist{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
.adv-bp{display:flex;align-items:center;gap:2px}
.adv-x{border:none;background:none;color:var(--faint);cursor:pointer;font-size:15px;line-height:1;padding:0 2px}
.adv-x:hover{color:#a12}
.adv-add{border:1px dashed var(--line2);background:none;color:var(--muted);cursor:pointer;font:inherit;font-size:12px;border-radius:var(--r-xs);padding:5px 10px}
.adv-bez{display:flex;flex-wrap:wrap;gap:6px 10px;align-items:center}
.adv-bez-lab{font-size:11px;color:var(--faint)}
/* Layout specimen — breakpoint/grid table + column preview + container bars. */
.layout-spec{margin-bottom:8px}
.ly-table{border-collapse:collapse;width:100%;font-size:12px;border:1px solid var(--line);border-radius:var(--r);overflow:hidden;margin-bottom:16px}
.ly-table th,.ly-table td{padding:7px 12px;border-bottom:1px solid var(--line);text-align:right}
.ly-table th:first-child,.ly-table td:first-child{text-align:left}
.ly-table th{font-size:11px;font-weight:600;color:var(--muted);text-transform:lowercase;letter-spacing:.02em;background:var(--panel)}
.ly-table tr:last-child td{border-bottom:none}
.ly-cap{font-size:11.5px;color:var(--muted);margin:0 2px 8px}
.ly-cols{display:grid;grid-auto-flow:column;grid-auto-columns:1fr;gap:6px;height:44px;margin-bottom:18px}
.ly-col{background:var(--ink);opacity:.14;border-radius:3px}
.ly-cont{display:flex;flex-direction:column;gap:8px}
.ly-cont-row{display:flex;align-items:center;gap:12px}
.ly-cont-lab{font-size:11.5px;color:var(--muted);min-width:150px}
.ly-cont-bar{height:16px;background:var(--ink);opacity:.55;border-radius:3px}
.inverse-spec{margin-bottom:8px}
.inv-band{border-radius:var(--r);padding:36px 32px;display:flex;flex-direction:column;align-items:flex-start;gap:20px}
.inv-h{font-size:24px;font-weight:700;letter-spacing:-0.02em;max-width:26ch}
.inv-cta{padding:10px 22px;border-radius:var(--r-xs);font-weight:600;font-size:14px}
.gradient-spec{margin-bottom:8px}
.gr-list{display:flex;flex-wrap:wrap;gap:22px;border:1px solid var(--line);border-radius:var(--r);padding:24px;background:var(--panel)}
.gr-cell{display:flex;flex-direction:column;gap:10px}
.gr-sw{width:200px;height:96px;border-radius:var(--r-xs);border:1px solid var(--line)}
.gr-lab{font-size:11.5px;color:var(--muted)}
/* Gradient editor (docs/23 §2) — one card per gradient. */
.gr-ed-list{display:flex;flex-direction:column;gap:14px;margin-top:12px}
.gr-ed-card{border:1px solid var(--line);border-radius:var(--r);background:var(--panel);padding:22px}
.gr-ed-head{display:flex;align-items:center;gap:10px;margin-bottom:14px}
.gr-ed-name{margin:0;font-size:15px;font-weight:620;color:var(--ink)}
.gr-ed-head .rx{margin-left:auto}
.gr-ed-sw{width:100%;height:120px;border-radius:var(--r-sm);border:1px solid var(--line);margin-bottom:16px}
.gr-ed-ctrls{display:flex;flex-wrap:wrap;gap:16px 20px;align-items:flex-end}
.gr-ed-field{display:flex;flex-direction:column;gap:6px}
.gr-ed-lab{font-size:12px;font-weight:560;color:var(--muted)}
.gr-ed-range{width:180px;accent-color:var(--ink)}
.gr-ed-num{width:96px;padding:9px 11px;font-size:13.5px}
.gr-ed-stopsh{margin:20px 0 10px;font-size:12.5px;font-weight:600;color:var(--muted);letter-spacing:.02em}
.gr-ed-stops{display:flex;flex-direction:column;gap:10px}
.gr-ed-stop{display:flex;align-items:center;gap:10px}
.gr-ed-stopsw{width:34px;height:34px;flex:none;border-radius:var(--r-xs);border:1px solid var(--line2)}
.gr-ed-stop .gr-ed-num{flex:none}
.gr-ed-stoprm{flex:none}
.gr-ed-addstop{margin-top:12px}
.gr-ed-add{margin-top:14px}
.icon-spec{margin-bottom:8px}
.ic-block{border:1px solid var(--line);border-radius:var(--r);background:var(--panel);padding:18px 22px;margin-top:10px}
.ic-cap{font-size:11px;color:var(--faint);letter-spacing:0.04em;text-transform:uppercase;margin-bottom:14px}
.ic-tiles{display:flex;flex-wrap:wrap;gap:20px}
.ic-tile{display:flex;flex-direction:column;align-items:center;gap:9px}
.ic-chip{width:48px;height:48px;display:grid;place-items:center;border-radius:11px}
.ic-lab{font-size:11px;color:var(--faint)}
/* Mode-context strip (#171) — one mode at a time; sticky so the context stays reachable while
   scrolling the stage. The whole stage below reflects the selected mode. */
.modectx{display:flex;align-items:center;justify-content:space-between;gap:16px;margin:0;padding:9px 12px;background:var(--panel);border:1px solid var(--line);border-radius:var(--r)}
.mctx-modes{display:flex;align-items:center;gap:6px;flex-wrap:wrap}
.mctx-cap{font-size:11px;font-weight:640;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;margin-right:6px}
.mctx-b{display:inline-flex;align-items:center;gap:7px;border:1px solid var(--line2);background:var(--paper);border-radius:var(--r-sm);padding:5px 11px;font:inherit;font-size:13px;color:var(--ink2);cursor:pointer}
.mctx-b:hover{border-color:var(--ink)}
.mctx-b.on{background:var(--ink);color:#fff;border-color:var(--ink)}
.mctx-auto{font-size:9.5px;text-transform:uppercase;letter-spacing:.04em;color:var(--faint);border:1px solid var(--line2);border-radius:4px;padding:0 4px;line-height:1.5}
.mctx-b.on .mctx-auto{color:rgba(255,255,255,.85);border-color:rgba(255,255,255,.4)}
.mctx-mark{font-size:12px;font-weight:700}
.mctx-mark.ok{color:#1f9d63}
.mctx-mark.no{color:#c9342f}
.mctx-b.on .mctx-mark.ok{color:#7fe0ac}
.mctx-b.on .mctx-mark.no{color:#ff9d97}
.mctx-edit-wrap{position:relative;flex:none}
.mctx-edit{border:1px solid var(--line2);background:var(--paper);border-radius:var(--r-sm);padding:6px 12px;font:inherit;font-size:13px;color:var(--muted);cursor:pointer;white-space:nowrap}
.mctx-edit:hover,.mctx-edit.open{border-color:var(--ink);color:var(--ink)}
.mctx-menu{position:absolute;right:0;top:calc(100% + 7px);width:264px;background:var(--panel);border:1px solid var(--line2);border-radius:var(--r);box-shadow:0 10px 30px rgba(20,22,30,.14);padding:10px;z-index:20}
.mctx-mcap{font-size:11px;font-weight:640;text-transform:uppercase;letter-spacing:.045em;color:var(--faint);padding:4px 6px 8px}
.mctx-opt{display:flex;align-items:center;gap:9px;width:100%;border:0;background:none;font:inherit;font-size:13.5px;color:var(--ink2);padding:7px 6px;border-radius:var(--r-xs);cursor:pointer;text-align:left}
.mctx-opt:hover{background:var(--paper)}
.mctx-box{width:16px;height:16px;flex:none;border:1px solid var(--line2);border-radius:4px;display:inline-flex;align-items:center;justify-content:center;font-size:11px;color:#fff}
.mctx-opt.on .mctx-box{background:var(--ink);border-color:var(--ink)}
.mctx-opt.fixed{cursor:default}
.mctx-always{margin-left:auto;font-size:10px;text-transform:uppercase;letter-spacing:.03em;color:var(--faint)}
.mctx-opt.disabled{color:var(--faint);cursor:not-allowed}
.mctx-opt.disabled:hover{background:none}
.mctx-div{height:1px;background:var(--line);margin:8px 4px}
.mctx-note{font-size:11.5px;line-height:1.5;color:var(--faint);margin:6px 6px 2px}
/* C2 — custom-mode rows + add form in the Edit-modes popover. */
.mctx-custom{display:flex;align-items:center;gap:8px;padding:6px 6px;font-size:13px;color:var(--ink2)}
.mctx-cname{font-weight:560}
.mctx-cbase{font-size:11px;color:var(--faint)}
.mctx-crm{margin-left:auto;width:22px;height:22px;flex:none;border:1px solid var(--line2);background:var(--panel);border-radius:var(--r-xs);color:var(--faint);cursor:pointer;font-size:14px;line-height:1}
.mctx-crm:hover{background:#fdecec;color:#a12;border-color:#f2c6c6}
.mctx-addform{display:flex;flex-direction:column;gap:8px;padding:8px 6px}
.mctx-addname{padding:7px 9px;border:1px solid var(--line2);border-radius:var(--r-xs);font:inherit;font-size:13px;background:var(--paper)}
.mctx-adderr{margin:0;font-size:11.5px;color:#a12;line-height:1.4}
.mctx-adderr:empty{display:none}
.mctx-addbtns{display:flex;gap:8px}
.mctx-addbtn{border:1px solid var(--ink);background:var(--ink);color:#fff;border-radius:var(--r-xs);padding:6px 14px;font:inherit;font-size:13px;font-weight:560;cursor:pointer}
.mctx-addcancel{border:1px solid var(--line2);background:var(--panel);border-radius:var(--r-xs);padding:6px 12px;font:inherit;font-size:13px;color:var(--ink2);cursor:pointer}
/* A2a — generated-mode (HC/wireframe) read-only view: an explanation + a per-mode contract verdict. */
.genview{background:var(--panel);border:1px solid var(--line);border-radius:var(--r);padding:22px 24px;margin:8px 0 0}
.genview-t{margin:0;font-size:16px;font-weight:640;letter-spacing:-0.01em}
.genview-d{margin:10px 0 0;color:var(--muted);font-size:14px;line-height:1.6;max-width:64ch}
.genview-chip{display:inline-flex;align-items:center;gap:8px;margin-top:16px;padding:7px 12px;border-radius:var(--r-sm);font-size:13px;font-weight:540}
.genview-chip.ok{background:#eaf7f0;color:#1f7a4d;border:1px solid #bfe6d0}
.genview-chip.no{background:#fdecec;color:#a12;border:1px solid #f2c6c6}
.gv-mark{font-weight:700}
.genview-hint{margin:14px 0 0;color:var(--faint);font-size:12.5px;line-height:1.55}
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
.ic-modenote{margin:0 0 14px;font-size:12.5px;color:var(--muted);line-height:1.55;padding:10px 13px;background:var(--paper);border:1px solid var(--line);border-radius:var(--r-sm)}
/* A2c — per-mode foreground/text override rows. */
.fg-row{display:flex;align-items:center;gap:12px;margin-top:10px}
.fg-sw{width:34px;height:34px;flex:none;border-radius:var(--r-xs);border:1px solid var(--line2)}
.fg-badge{margin-left:auto;font-size:12.5px;font-weight:560;padding:5px 10px;border-radius:var(--r-sm)}
.fg-badge.ok{background:#eaf7f0;color:#1f7a4d}
.fg-badge.no{background:#fdecec;color:#a12}
.ic-card{border:1px solid var(--line);border-radius:var(--r);background:var(--panel);padding:22px;margin-bottom:14px}
.ic-head{display:flex;align-items:center;gap:12px;margin-bottom:16px}
.ic-headt{margin:0;flex:1;font-size:15px;font-weight:620;color:var(--ink)}
.ic-add{display:flex;align-items:center;gap:12px;margin-bottom:14px}
.ic-addbtn{width:auto;margin-top:0;flex:none}
.ic-addhint{font-size:13px;color:var(--muted)}
.ic-top{display:flex;gap:22px;align-items:flex-start}
.ic-big{width:150px;height:150px;flex:none;border-radius:var(--r-sm);border:1px solid var(--line)}
.ic-big-sm{width:72px;height:72px}
.fill-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:14px;margin-top:4px}
.fill-grid .ic-card{margin-bottom:0}
.fill-grid .ic-top{gap:14px}
/* Backgrounds card — the contrast-floor sub-control appended below the card body. */
.bg-floor{display:flex;align-items:center;gap:10px;margin-top:14px;padding-top:14px;border-top:1px solid var(--line)}
.bg-floor-lab{font-size:12.5px;font-weight:560;color:var(--muted)}
.bg-floor .select{margin-left:auto}
.ic-mid{flex:1;min-width:0;display:flex;flex-direction:column;gap:12px;align-items:flex-start}
.ic-h{margin:0;font-size:15px;font-weight:620;color:var(--ink)}
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
.pair-path{display:block;color:var(--ink2)}
.pair-sub{display:block;font-size:11px;color:var(--faint);margin-top:1px}
.pvseg{display:inline-flex;gap:2px;padding:3px;background:var(--panel);border:1px solid var(--line);border-radius:var(--r-sm);margin:2px 0 22px}
.pvseg-b{font:inherit;font-size:13px;padding:7px 15px;border:none;background:none;color:var(--ink2);border-radius:var(--r-xs);cursor:pointer}
.pvseg-b:hover{color:var(--ink)}
.pvseg-b.on{background:var(--paper);color:var(--ink);box-shadow:0 1px 2px rgba(0,0,0,.06)}
.tok-val{display:inline-flex;align-items:center;gap:7px}
.tok-sw{display:inline-block;width:14px;height:14px;border-radius:3px;border:1px solid var(--line2);flex:none}
.tok-shadow{display:inline-block;max-width:240px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;vertical-align:bottom;color:var(--muted)}
.dot{display:inline-block;width:8px;height:8px;border-radius:999px;margin-right:5px;vertical-align:middle}
.dot.ok{background:#1a9c52}.dot.no{background:#d23}
.ratio{font-variant-numeric:tabular-nums;color:var(--muted)}
.errbar{border:1px solid #f2c6c6;background:#fdecec;color:#a12;border-radius:var(--r-sm);padding:10px 14px;font-size:13px;margin-bottom:16px}

@media(max-width:900px){.shell{grid-template-columns:1fr;gap:40px}.rail{position:static}.prim-sec{grid-template-columns:1fr}.prim-sec>.panel{position:static}}
`;
const styleEl = document.createElement('style');
styleEl.textContent = STYLE;
document.head.append(styleEl);

build();
