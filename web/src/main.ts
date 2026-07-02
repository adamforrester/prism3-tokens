/**
 * Prism3 web dashboard (docs/08 §7 B3, docs/09).
 *
 * The FIRST rendering host over the engine core. It imports the SAME pure modules
 * the Figma plugin will (`theme`, `levers`, `preview`, `resolve-preview`, `color`)
 * and renders from the shared contracts:
 *   1. the theming knobs — from the lever manifest (`levers.ts`)
 *   2. a live component preview + per-mode contrast overlay — from `previewSpec`
 *      resolved through `resolvePreview(theme)`
 *
 * Interactive loop: the COLOUR-axis knobs are live — turning one mutates the
 * in-memory `BrandInput`, re-runs `brandTheme` + `resolvePreview`, and repaints the
 * preview + overlay. (Form/type/motion knobs stay read-only until geometry/type
 * bindings render from the token tree — the next increment; wiring dials that
 * produce no visible change would read as broken.) Colours come straight from the
 * resolved read-model; a failed brand combination is caught and surfaced, last-good
 * preview preserved.
 */
import { brandTheme } from '../../Prism3/engine/theme';
import type { BrandInput } from '../../Prism3/engine/theme';
import { hex, oklchToRgb, hexToRgb, rgbToOklch } from '../../Prism3/engine/color';
import { leverManifest, leverGroups } from '../../Prism3/engine/levers';
import type { Lever } from '../../Prism3/engine/levers';
import { previewSpec } from '../../Prism3/engine/preview';
import { resolvePreview } from '../../Prism3/engine/resolve-preview';
import type { ResolvedPreview } from '../../Prism3/engine/resolve-preview';
import exampleBrands from '../../Prism3/schema/example-brands.json';

type Mode = ResolvedPreview['modes'][number];

// Boot from a VALIDATED example brand — the emitted schema/example-brands.json (a
// test.ts gate asserts every brand there resolves all-green on the preview
// contracts). aurora: indigo anchor, action DECOUPLED onto an azure accent, tinted
// page. brandState is the mutable working copy the knobs edit.
const defaultBrand = (exampleBrands as Record<string, BrandInput>).aurora;
const brandState: BrandInput = structuredClone(defaultBrand);

// The levers that visibly change the preview: the colour axis (re-themes chips +
// overlay) plus radius/type (now that chips render real geometry/type from the tree).
// Density/motion/shadow stay read-only — the current chips don't render those axes.
const LIVE = new Set(['primary', 'neutral.hue', 'neutral.chroma', 'actionPalette', 'radiusScale', 'typography.typeScale']);

const MODE_LABEL: Record<string, string> = { light: 'Light', dark: 'Dark', 'hc-light': 'HC light', 'hc-dark': 'HC dark' };

let currentMode: Mode;
let rp: ResolvedPreview = resolvePreview(brandTheme(brandState));
let lastError: string | null = null;
currentMode = rp.modes[0];

// ---- state helpers ---------------------------------------------------------

const getPath = (o: any, p: string): any => p.split('.').reduce((a, k) => (a == null ? undefined : a[k]), o);
const setPath = (o: any, p: string, v: unknown): void => {
  const ks = p.split('.');
  const last = ks.pop()!;
  let cur = o;
  for (const k of ks) { if (cur[k] == null || typeof cur[k] !== 'object') cur[k] = {}; cur = cur[k]; }
  cur[last] = v;
};

/** Re-resolve from the current brandState. On failure keep the last-good `rp` and
 *  record the message (the overlay stays coherent; the knob edit is what's flagged). */
const rebuild = (): void => {
  try {
    rp = resolvePreview(brandTheme(brandState));
    lastError = null;
  } catch (e) {
    lastError = (e as Error).message;
  }
};

const apply = (): void => { rebuild(); repaint(); };

// ---- DOM helpers -----------------------------------------------------------

const el = (tag: string, cls?: string, text?: string): HTMLElement => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text !== undefined) n.textContent = text;
  return n;
};

const hexOf = (binding: string | undefined, mode: Mode): string | undefined =>
  binding && binding.startsWith('color.') ? rp.colors[binding]?.[mode] : undefined;

const pageBg = (mode: Mode): string => rp.colors['color.background.primary']?.[mode] ?? '#ffffff';

// ---- knob rendering --------------------------------------------------------

const renderControl = (lever: Lever): HTMLElement => {
  const live = LIVE.has(lever.key);
  const wrap = el('div', `knob${live ? ' live' : ''}`);
  const head = el('div', 'knob-head');
  head.append(el('label', 'knob-label', lever.label));
  if (lever.required) head.append(el('span', 'tag req', 'required'));
  head.append(el('span', 'tag ctrl', lever.control));
  if (live) head.append(el('span', 'tag on', 'live'));
  wrap.append(head);

  if (lever.control === 'color' && lever.key === 'primary') {
    const row = el('div', 'knob-body');
    const picker = el('input') as HTMLInputElement;
    picker.type = 'color';
    picker.value = hex(oklchToRgb(brandState.primary));
    const val = el('span', 'knob-val', picker.value);
    picker.oninput = () => {
      setPath(brandState, 'primary', rgbToOklch(hexToRgb(picker.value)));
      val.textContent = picker.value;
      apply();
    };
    row.append(picker, val);
    wrap.append(row);
  } else if (lever.control === 'slider' && live) {
    const row = el('div', 'knob-body');
    const input = el('input') as HTMLInputElement;
    input.type = 'range';
    if (lever.min !== undefined) input.min = String(lever.min);
    if (lever.max !== undefined) input.max = String(lever.max);
    if (lever.step !== undefined) input.step = String(lever.step);
    input.value = String(getPath(brandState, lever.key) ?? lever.default ?? lever.min ?? 0);
    const val = el('span', 'knob-val', `${input.value}${lever.unit ?? ''}`);
    input.oninput = () => {
      setPath(brandState, lever.key, Number(input.value));
      val.textContent = `${input.value}${lever.unit ?? ''}`;
      apply();
    };
    row.append(input, val);
    wrap.append(row);
  } else if (lever.control === 'palette-ref' && live) {
    const sel = el('select') as HTMLSelectElement;
    const palettes = ['primary', ...(brandState.brandColors ?? []).map((b) => b.name)];
    const cur = String(getPath(brandState, lever.key) ?? lever.default ?? 'primary');
    for (const p of palettes) {
      const opt = el('option') as HTMLOptionElement;
      opt.value = p; opt.textContent = p; if (p === cur) opt.selected = true;
      sel.append(opt);
    }
    sel.onchange = () => { setPath(brandState, lever.key, sel.value); apply(); };
    wrap.append(sel);
  } else if (lever.control === 'enum' && live) {
    const sel = el('select') as HTMLSelectElement;
    const cur = getPath(brandState, lever.key) ?? lever.default;
    for (const o of lever.options ?? []) {
      const opt = el('option') as HTMLOptionElement;
      opt.value = String(o.value); opt.textContent = o.label; if (o.value === cur) opt.selected = true;
      sel.append(opt);
    }
    sel.onchange = () => { setPath(brandState, lever.key, sel.value); apply(); };
    wrap.append(sel);
  } else {
    // read-only render (form/type/motion/elevation + list/object) — reflects the
    // boot value; goes live once its axis renders in the preview.
    renderReadonly(wrap, lever);
  }

  wrap.append(el('p', 'knob-desc', lever.description));
  return wrap;
};

const renderReadonly = (wrap: HTMLElement, lever: Lever): void => {
  switch (lever.control) {
    case 'slider': {
      const row = el('div', 'knob-body');
      const input = el('input') as HTMLInputElement;
      input.type = 'range';
      if (lever.min !== undefined) input.min = String(lever.min);
      if (lever.max !== undefined) input.max = String(lever.max);
      if (lever.step !== undefined) input.step = String(lever.step);
      const v = getPath(brandState, lever.key) ?? lever.default;
      if (v !== undefined) input.value = String(v);
      input.disabled = true;
      row.append(input, el('span', 'knob-val', `${v ?? '—'}${lever.unit ?? ''}`));
      wrap.append(row);
      break;
    }
    case 'enum': {
      const sel = el('select') as HTMLSelectElement;
      const cur = getPath(brandState, lever.key) ?? lever.default;
      for (const o of lever.options ?? []) {
        const opt = el('option') as HTMLOptionElement;
        opt.value = String(o.value); opt.textContent = o.label; if (o.value === cur) opt.selected = true;
        sel.append(opt);
      }
      sel.disabled = true;
      wrap.append(sel);
      break;
    }
    case 'color': {
      const sw = el('div', 'knob-body');
      sw.append(el('span', 'swatch'), el('span', 'knob-val', lever.required ? 'brand anchor' : 'optional / synthesised'));
      wrap.append(sw);
      break;
    }
    default: {
      const v = getPath(brandState, lever.key) ?? lever.default;
      let text: string;
      if (Array.isArray(v)) text = v.map((it: any) => it?.name).filter(Boolean).join(', ') || `${v.length} item(s)`;
      else if (v && typeof v === 'object') text = 'configured';
      else text = String(v ?? lever.itemLabel ?? '—');
      wrap.append(el('div', 'knob-val', text));
    }
  }
};

const renderLevers = (): HTMLElement => {
  const aside = el('aside', 'levers');
  aside.append(el('h2', undefined, 'Levers'));
  aside.append(el('p', 'muted', 'Rendered from the shared lever manifest. Knobs marked live (colour, corner radius, type scale) re-resolve the preview on change; density/motion/shadow stay read-only until the chips render those axes.'));
  for (const g of leverGroups) {
    const levers = leverManifest.filter((l) => l.group === g.group && !l.advanced);
    if (!levers.length) continue;
    const group = el('section', 'lever-group');
    group.append(el('h3', undefined, g.label));
    for (const l of levers) group.append(renderControl(l));
    aside.append(group);
  }
  return aside;
};

// ---- preview rendering -----------------------------------------------------

const renderChip = (label: string, bind: Record<string, string>, mode: Mode): HTMLElement => {
  const bg = hexOf(bind.bg, mode);
  const fg = hexOf(bind.text ?? bind.titleText ?? bind.bodyText, mode);
  const border = hexOf(bind.border, mode);
  const chip = el('div', 'chip', label);
  if (bg) chip.style.background = bg;
  if (fg) chip.style.color = fg;
  chip.style.border = `2px solid ${border ?? 'transparent'}`;
  // geometry + type from the resolved read-model (mode-invariant)
  if (bind.radius && rp.dims[bind.radius] != null) chip.style.borderRadius = `${rp.dims[bind.radius]}px`;
  const pad = bind.pad ? `${rp.dims[bind.pad]}px`
    : bind.padX && bind.padY ? `${rp.dims[bind.padY]}px ${rp.dims[bind.padX]}px` : '';
  if (pad) chip.style.padding = pad;
  const t = bind.type ? rp.type[bind.type] : undefined;
  if (t) {
    chip.style.fontFamily = t.fontFamily;
    chip.style.fontWeight = String(t.fontWeight);
    chip.style.fontSize = `${Math.min(t.fontSizePx, 20)}px`; // cap for the chip; true size is in rp.type
  }
  return chip;
};

const renderPreview = (mode: Mode): HTMLElement => {
  const main = el('div', 'preview');
  main.style.background = pageBg(mode);
  for (const c of previewSpec.components) {
    const block = el('section', 'pvcomp');
    block.append(el('h4', undefined, c.label));
    const row = el('div', 'chips');
    for (const v of c.variants) row.append(renderChip(`${c.id} · ${v.name}`, v.bindings, mode));
    block.append(row);
    main.append(block);
  }
  return main;
};

const renderContracts = (): HTMLElement => {
  const wrap = el('section', 'contracts');
  wrap.append(el('h3', undefined, 'Contrast contracts'));
  wrap.append(el('p', 'muted', 'Every declared a11y pair, computed on the resolved colours across all modes — the live overlay.'));
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
      if (r) { cell.append(el('span', `dot ${r.pass ? 'ok' : 'no'}`)); cell.append(el('span', 'ratio', r.ratio.toFixed(2))); }
      else cell.textContent = '—';
      tr.append(cell);
    }
    table.append(tr);
  }
  wrap.append(table);
  return wrap;
};

// ---- shell -----------------------------------------------------------------

const app = document.getElementById('app')!;
let rightcol: HTMLElement;
let modeBtns: HTMLButtonElement[] = [];

/** Repaint only the preview + overlay (the knobs persist so edits don't lose focus). */
function repaint(): void {
  rightcol.innerHTML = '';
  if (lastError) {
    const bar = el('div', 'errbar', `This combination doesn't resolve: ${lastError} — showing the last valid theme.`);
    rightcol.append(bar);
  }
  rightcol.append(renderPreview(currentMode));
  rightcol.append(renderContracts());
}

const build = (): void => {
  app.innerHTML = '';

  const header = el('header', 'top');
  header.append(el('h1', undefined, 'Prism3'));
  header.append(el('p', 'muted', 'Web dashboard — one engine, rendered to the DOM. Turn a colour knob; the preview + contrast overlay re-resolve live.'));
  header.append(el('span', 'brand-badge', `brand: ${brandState.id}`));
  app.append(header);

  const modes = el('div', 'modebar');
  modes.append(el('span', 'muted', 'Preview mode:'));
  modeBtns = [];
  for (const m of rp.modes) {
    const b = el('button', `modebtn${m === currentMode ? ' on' : ''}`, MODE_LABEL[m] ?? m) as HTMLButtonElement;
    b.onclick = () => {
      currentMode = m;
      modeBtns.forEach((btn, i) => btn.classList.toggle('on', rp.modes[i] === currentMode));
      repaint();
    };
    modeBtns.push(b);
    modes.append(b);
  }
  app.append(modes);

  const layout = el('div', 'layout');
  layout.append(renderLevers());
  rightcol = el('div', 'rightcol');
  layout.append(rightcol);
  app.append(layout);

  repaint();
};

// ---- inlined stylesheet (self-contained bundle) ----------------------------
const STYLE = `
:root { color-scheme: light dark; --ink:#1c1c22; --line:#e3e3ea; --bg:#f6f6f9; --muted:#6b6b78; }
* { box-sizing: border-box; }
body { margin:0; font:14px/1.5 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; color:var(--ink); background:var(--bg); }
#app { max-width:1200px; margin:0 auto; padding:32px 24px 64px; }
.top h1 { margin:0; font-size:28px; letter-spacing:-0.02em; }
.muted { color:var(--muted); margin:4px 0; }
.brand-badge { display:inline-block; margin-top:8px; padding:3px 10px; border-radius:999px; background:#ececf3; font-weight:600; font-size:12px; }
.modebar { display:flex; align-items:center; gap:8px; margin:20px 0; }
.modebtn { border:1px solid var(--line); background:#fff; border-radius:8px; padding:6px 12px; cursor:pointer; font:inherit; }
.modebtn.on { background:var(--ink); color:#fff; border-color:var(--ink); }
.layout { display:grid; grid-template-columns:300px 1fr; gap:24px; align-items:start; }
.levers { border:1px solid var(--line); border-radius:12px; background:#fff; padding:16px; }
.levers h2 { margin:0 0 4px; font-size:16px; }
.lever-group { margin-top:18px; }
.lever-group h3 { margin:0 0 8px; font-size:11px; text-transform:uppercase; letter-spacing:0.06em; color:var(--muted); }
.knob { padding:10px 0; border-top:1px solid var(--line); }
.knob.live { }
.knob-head { display:flex; align-items:center; gap:6px; flex-wrap:wrap; }
.knob-label { font-weight:600; }
.tag { font-size:10px; padding:1px 6px; border-radius:4px; background:#eee; color:#555; }
.tag.req { background:#fde8e8; color:#a12; }
.tag.ctrl { background:#e8eefd; color:#2647a1; }
.tag.on { background:#e3f6ea; color:#1a7a43; }
.knob-body { display:flex; align-items:center; gap:8px; margin-top:6px; }
.knob input[type=range] { flex:1; }
.knob input[type=color] { width:44px; height:28px; padding:0; border:1px solid var(--line); border-radius:6px; background:none; cursor:pointer; }
.knob input:disabled { opacity:0.55; }
.knob select { width:100%; margin-top:6px; padding:4px; }
.knob select:not(:disabled) { cursor:pointer; }
.knob-val { font-variant-numeric:tabular-nums; color:var(--muted); font-size:12px; }
.knob-desc { margin:6px 0 0; font-size:12px; color:var(--muted); }
.swatch { width:16px; height:16px; border-radius:4px; background:linear-gradient(135deg,#5b4bd6,#3aa0d6); display:inline-block; }
.rightcol { display:flex; flex-direction:column; gap:24px; }
.errbar { border:1px solid #f2c6c6; background:#fdecec; color:#a12; border-radius:10px; padding:10px 14px; font-size:13px; }
.preview { border:1px solid var(--line); border-radius:12px; padding:20px; }
.pvcomp { margin-bottom:18px; }
.pvcomp h4 { margin:0 0 8px; font-size:13px; }
.chips { display:flex; flex-wrap:wrap; gap:10px; }
.chip { padding:8px 14px; border-radius:8px; font-weight:600; font-size:13px; }
.contracts { border:1px solid var(--line); border-radius:12px; background:#fff; padding:16px 20px; }
.contracts h3 { margin:0 0 4px; font-size:16px; }
.ctable { width:100%; border-collapse:collapse; margin-top:10px; font-size:12px; }
.ctable th, .ctable td { text-align:left; padding:6px 8px; border-bottom:1px solid var(--line); }
.ctable .mcol { text-align:center; }
.pair { color:var(--ink); }
.dot { display:inline-block; width:8px; height:8px; border-radius:999px; margin-right:5px; vertical-align:middle; }
.dot.ok { background:#1a9c52; }
.dot.no { background:#d23; }
.ratio { font-variant-numeric:tabular-nums; color:var(--muted); }
`;
const styleEl = document.createElement('style');
styleEl.textContent = STYLE;
document.head.append(styleEl);

build();
