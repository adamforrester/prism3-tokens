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
 * bespoke redesign — a scalable brand-colour list, a tunable neutral cast with a
 * Derive⇄Pin toggle (surfacing the engine's `neutral.anchor`), and the generated
 * ramps shown as labelled specimens. Later stages render their lever groups + the
 * live preview/overlay. Colour-axis edits re-resolve the engine and repaint only the
 * volatile region (ramps or preview), so knob focus is never lost; a failed brand
 * combination is caught and surfaced with the last-good render preserved.
 */
import { brandTheme } from '../../Prism3/engine/theme';
import type { BrandInput, Theme } from '../../Prism3/engine/theme';
import { hex, oklchToRgb, hexToRgb, rgbToOklch } from '../../Prism3/engine/color';
import { autoPlaceStep } from '../../Prism3/engine/ramp';
import { leverManifest, leverGroups } from '../../Prism3/engine/levers';
import type { Lever } from '../../Prism3/engine/levers';
import { previewSpec } from '../../Prism3/engine/preview';
import { resolvePreview } from '../../Prism3/engine/resolve-preview';
import type { ResolvedPreview } from '../../Prism3/engine/resolve-preview';
import { parseDesignMd, toDesignMd } from '../../Prism3/engine/design-md';
import { buildTree } from '../../Prism3/engine/tree';
import exampleBrands from '../../Prism3/schema/example-brands.json';

type Mode = ResolvedPreview['modes'][number];

// Boot from a VALIDATED example brand — the emitted schema/example-brands.json (a
// test.ts gate asserts every brand there resolves all-green on the preview
// contracts). aurora: indigo anchor, action DECOUPLED onto an azure accent, tinted
// page. brandState is the mutable working copy the inputs edit.
const BRANDS = exampleBrands as Record<string, BrandInput>;
let brandState: BrandInput = structuredClone(BRANDS.aurora);

// A minimal, known-good starting point for "New brand": one mid-indigo primary + a
// derived neutral, action defaults to primary, namespace at the 'prism' placeholder.
const NEW_BRAND = (): BrandInput => ({
  id: 'untitled', root: 'prism',
  primary: { l: 0.55, c: 0.15, h: 262 },
  neutral: { hue: 262, chroma: 0.006 },
});
const ROOT_RE = /^[a-z][a-z0-9-]*$/;

// Levers that visibly change the preview: the colour axis plus radius/type (the chips
// render real geometry/type from the tree). Density/motion/shadow stay read-only.
const LIVE = new Set(['actionPalette', 'radiusScale', 'typography.typeScale']);

const MODE_LABEL: Record<string, string> = { light: 'Light', dark: 'Dark', 'hc-light': 'HC light', 'hc-dark': 'HC dark' };

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
// axes; the stages slice it by intent). Stage 1's colour primitives get a bespoke UI,
// so they're excluded from the generic knob render here.
const PRIMITIVE_KEYS = new Set(['primary', 'neutral.hue', 'neutral.chroma', 'neutral.anchor', 'brandColors']);
const stageOfLever = (l: Lever): StageKey => {
  if (l.group === 'type') return 'type';
  if (l.group === 'form' || l.group === 'elevation' || l.group === 'layout' || l.group === 'motion') return 'form';
  return 'semantic'; // remaining colour levers: action palette, status, disabled, icon, gradients
};

// ---- engine read-model -----------------------------------------------------
let theme: Theme = brandTheme(brandState);
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
    lastError = null;
  } catch (e) {
    lastError = (e as Error).message;
  }
};

// paint() repaints only the current stage's volatile region (ramps or preview) so
// input focus is never lost; applyFull() re-renders the whole workspace (structural
// edits — add/remove colour, Derive⇄Pin, stage switch); build() re-renders the shell.
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
const hexOf = (binding: string | undefined, mode: Mode): string | undefined =>
  binding && binding.startsWith('color.') ? rp.colors[binding]?.[mode] : undefined;
const pageBg = (mode: Mode): string => rp.colors['color.background.primary']?.[mode] ?? '#ffffff';

// ===========================================================================
// STAGE 1 — BRAND PRIMITIVES (bespoke)
// ===========================================================================

/** The per-palette pinned anchor step (null = derived, no anchor). */
const anchorStepFor = (palette: string): number | null => {
  if (palette === 'primary') return autoPlaceStep(brandState.primary.l);
  if (palette === 'neutral') return brandState.neutral.anchor ? autoPlaceStep(brandState.neutral.anchor.l) : null;
  const bc = (brandState.brandColors ?? []).find((b) => b.name === palette);
  return bc ? autoPlaceStep(bc.oklch.l) : null;
};

/** A labelled scale — 10 swatches per row, touching within a row, labels beneath. */
const rampEl = (name: string, steps: { num: number; key: string; hex: string }[], anchorStep: number | null): HTMLElement => {
  const wrap = el('section', 'ramp');
  const head = el('div', 'ramp-head');
  head.append(el('span', 'ramp-name', name));
  const meta = el('span', 'ramp-anchor');
  const aKey = anchorStep != null ? steps.find((s) => s.num === anchorStep)?.key : undefined;
  meta.innerHTML = aKey ? `anchor <b class="mono">${name}/${aKey}</b>` : `<span class="faint">derived scale</span>`;
  head.append(meta);
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
  for (const p of orderedPalettes()) host.append(rampEl(p.palette, p.steps, anchorStepFor(p.palette)));
};

/** Brand colours — a scalable list. Primary is the pinned anchor (editable colour, not
 *  removable); each accent is add / rename / remove and can drive the action palette. */
const renderBrandColors = (): HTMLElement => {
  const panel = el('div', 'panel');
  const list = brandState.brandColors ?? (brandState.brandColors = []);
  const head = el('div', 'panel-head');
  head.append(el('h2', undefined, 'Brand colors'), el('span', 'count', String(1 + list.length)));
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

  // primary — editable colour, fixed name, not removable
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

/** Neutral cast — a Derive⇄Pin toggle. Derive: hue + chroma sliders. Pin: a colour
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
  const live = LIVE.has(lever.key);
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
  const bg = hexOf(bind.bg, mode);
  const fg = hexOf(bind.text ?? bind.titleText ?? bind.bodyText, mode);
  const border = hexOf(bind.border, mode);
  const chip = el('div', 'chip', label);
  if (bg) chip.style.background = bg;
  if (fg) chip.style.color = fg;
  chip.style.border = `2px solid ${border ?? 'transparent'}`;
  if (bind.radius && rp.dims[bind.radius] != null) chip.style.borderRadius = `${rp.dims[bind.radius]}px`;
  const pad = bind.pad ? `${rp.dims[bind.pad]}px` : bind.padX && bind.padY ? `${rp.dims[bind.padY]}px ${rp.dims[bind.padX]}px` : '';
  if (pad) chip.style.padding = pad;
  const t = bind.type ? rp.type[bind.type] : undefined;
  if (t) { chip.style.fontFamily = t.fontFamily; chip.style.fontWeight = String(t.fontWeight); chip.style.fontSize = `${Math.min(t.fontSizePx, 20)}px`; }
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
  surface.style.background = pageBg(currentMode);
  for (const c of previewSpec.components) {
    const block = el('section', 'pvcomp');
    block.append(el('h4', undefined, c.label));
    const row = el('div', 'chips');
    for (const v of c.variants) row.append(renderChip(`${c.id} · ${v.name}`, v.bindings, currentMode));
    block.append(row);
    surface.append(block);
  }
  host.append(surface);

  const contracts = el('section', 'contracts');
  contracts.append(el('h3', undefined, 'Contrast contracts'));
  contracts.append(el('p', 'np-note', 'Every declared a11y pair, computed on the resolved colours across all modes.'));
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
  semantic: ['Map roles onto your primitives.', 'Every semantic role aliases a primitive step, resolved per mode. Point actions at the palette that reads best, override status hues, set the disabled and icon-contrast policy.'],
  type: ['Set the type system.', 'Families, weights, and the type scale that shifts the semantic→primitive size mapping. The rem ladder is brand-invariant; the scale is the dial.'],
  form: ['Dial in the form factor.', 'Density, corner radius, and elevation — the geometry that makes the same colours feel like a different product.'],
};

const renderLeverStage = (host: HTMLElement, key: StageKey): void => {
  const [title, lede] = HERO_COPY[key];
  host.append(hero(title, lede));
  const levers = leverManifest.filter((l) => !l.advanced && !PRIMITIVE_KEYS.has(l.key) && stageOfLever(l) === key);
  if (levers.length) {
    const panel = el('div', 'panel');
    for (const l of levers) panel.append(renderControl(l));
    host.append(panel);
  }
  if (key === 'semantic') {
    host.append(sectionHead('Live preview', 'Sample components + the contrast overlay, resolved through every mode.'));
    const pv = el('div', 'pvhost');
    host.append(pv);
    paintVolatile = () => paintPreview(pv);
    paintVolatile();
  } else {
    paintVolatile = () => {};
    host.append(el('p', 'np-note', 'The live preview lives on the Semantic colors stage; these knobs re-resolve it there.'));
  }
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
let outsideBound = false;

/** Replace the working brand wholesale (switch / new / import) and re-render. */
const loadBrand = (input: BrandInput): void => {
  brandState = structuredClone(input);
  brandMenuOpen = false; importOpen = false; importErr = null;
  stage = 'primitives';
  rebuild();
  currentMode = rp.modes[0];
  build();
};

/** Trigger a client-side file download (Blob → object URL → anchor click). */
const download = (filename: string, text: string, mime: string): void => {
  const url = URL.createObjectURL(new Blob([text], { type: mime }));
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
};

const slug = (): string => (brandState.id || 'brand').trim().replace(/\s+/g, '-') || 'brand';

/** Export the current brand as design.md — round-trips straight back into Import. */
const exportDesignMd = (): void => download(`${slug()}.design.md`, toDesignMd(brandState), 'text/markdown');

/** Export the resolved DTCG token tree (buildTree), namespaced under the brand's root. */
const exportTokens = (): void => {
  const tree = buildTree(brandTheme(brandState)).tree;
  download(`${slug()}.tokens.json`, JSON.stringify(tree, null, 2), 'application/json');
};

/** Parse a pasted design.md and load it. Validation is "does the engine accept it":
 *  a parse error or a brandTheme throw is surfaced; the working brand is untouched
 *  until both pass. (The full schema validator is node-bound, so it can't run here —
 *  brandTheme's own guards + the live contract overlay cover the rest.) */
const tryImport = (text: string): void => {
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

  menu.append(el('div', 'bm-div'));
  menu.append(el('div', 'bm-cap', 'Switch brand'));
  for (const name of Object.keys(BRANDS)) {
    const b = el('button', 'bm-item' + (name === brandState.id ? ' cur' : '')) as HTMLButtonElement;
    const d = el('span', 'bm-dot'); d.style.background = hex(oklchToRgb(BRANDS[name].primary));
    b.append(d, el('span', undefined, name));
    b.onclick = () => loadBrand(BRANDS[name]);
    menu.append(b);
  }

  menu.append(el('div', 'bm-div'));
  const nb = el('button', 'bm-item', '+ New brand') as HTMLButtonElement;
  nb.onclick = () => loadBrand(NEW_BRAND());
  menu.append(nb);
  const imp = el('button', 'bm-item', '↑ Import design.md…') as HTMLButtonElement;
  imp.onclick = () => { importOpen = !importOpen; importErr = null; renderBar(); };
  menu.append(imp);

  if (importOpen) {
    const box = el('div', 'bm-import');
    const ta = el('textarea', 'bm-ta') as HTMLTextAreaElement;
    ta.placeholder = 'Paste a design.md — --- YAML frontmatter --- then prose…';
    ta.spellcheck = false;
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

const build = (): void => {
  app.innerHTML = '';
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
  --paper:#fbfbfc; --panel:#ffffff; --line:#ededf0; --line2:#e2e2e6;
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

.bar{display:flex;align-items:center;justify-content:space-between;padding:26px 2px 24px;position:sticky;top:0;background:linear-gradient(var(--paper),var(--paper) 68%,transparent);z-index:5}
.brandmark{display:flex;align-items:center;gap:11px}
.logo{width:18px;height:18px;border-radius:var(--r-xs);background:conic-gradient(from 210deg,#5e4bc3,#0088be,#2f6833,#a13731,#5e4bc3)}
.wordmark{font-weight:640;letter-spacing:-0.02em;font-size:16px}
.studio{color:var(--muted);font-size:13px;border-left:1px solid var(--line2);padding-left:11px}
.brandsel-wrap{position:relative}
.brandsel{display:flex;align-items:center;gap:9px;font:inherit;font-weight:560;border:1px solid var(--line2);background:var(--panel);padding:8px 13px;border-radius:var(--r-sm);font-size:13.5px;cursor:pointer;color:var(--ink)}
.brandsel.open{border-color:var(--ink2)}
.brandsel .dot{width:12px;height:12px;border-radius:4px}
.brandsel .caret{color:var(--faint);margin-left:2px}
.brandmenu{position:absolute;top:calc(100% + 8px);right:0;width:288px;background:var(--panel);border:1px solid var(--line2);border-radius:var(--r);padding:12px;z-index:20;display:flex;flex-direction:column;gap:2px}
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
.count{font-size:12px;color:var(--muted);background:var(--paper);border:1px solid var(--line2);border-radius:999px;min-width:20px;height:20px;display:grid;place-items:center;padding:0 6px}
.seg{display:flex;border:1px solid var(--line2);border-radius:var(--r-sm);padding:2px;gap:2px}
.seg-b{border:0;background:none;font:inherit;font-size:12px;color:var(--muted);padding:4px 12px;border-radius:5px;cursor:pointer}
.seg-b.on{background:var(--ink);color:#fff}

.clist{display:flex;flex-direction:column}
.crow{display:flex;align-items:center;gap:13px;padding:13px 0;border-bottom:1px solid var(--line)}
.rsw{width:28px;height:28px;flex:none;border-radius:var(--r-xs);border:1px solid rgba(0,0,0,.08);padding:0;background:none;cursor:pointer}
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

.knob{padding:14px 0;border-bottom:1px solid var(--line)}
.knob:last-child{border-bottom:0}
.knob-label{font-weight:600;font-size:13.5px}
.knob-body{display:flex;align-items:center;gap:10px;margin-top:8px}
.knob input[type=range]{flex:1;accent-color:var(--ink)}
.knob input:disabled{opacity:.5}
.knob select{margin-top:8px;padding:6px 8px;border:1px solid var(--line2);border-radius:var(--r-xs);font:inherit;background:var(--paper)}
.knob select:disabled{opacity:.6}
.knob-val{font-variant-numeric:tabular-nums;color:var(--muted);font-size:12.5px}
.knob-val.ro{margin-top:6px}
.knob-desc{margin:7px 0 0;font-size:12px;color:var(--faint);line-height:1.5}

.pvhost{display:flex;flex-direction:column;gap:16px}
.modebar{display:flex;align-items:center;gap:8px}
.mb-cap{font-size:12px;color:var(--muted);margin-right:4px}
.modebtn{border:1px solid var(--line2);background:var(--panel);border-radius:var(--r-sm);padding:6px 12px;cursor:pointer;font:inherit;font-size:13px;color:var(--muted)}
.modebtn.on{background:var(--ink2);color:#fff;border-color:var(--ink2)}
.preview{border:1px solid var(--line);border-radius:var(--r);padding:20px;background:#fff}
.pvcomp{margin-bottom:18px}
.pvcomp:last-child{margin-bottom:0}
.pvcomp h4{margin:0 0 8px;font-size:13px}
.chips{display:flex;flex-wrap:wrap;gap:10px}
.chip{padding:8px 14px;border-radius:8px;font-weight:600;font-size:13px}
.contracts{border:1px solid var(--line);border-radius:var(--r);background:var(--panel);padding:18px 20px}
.contracts h3{margin:0 0 4px;font-size:15px;font-weight:620}
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
