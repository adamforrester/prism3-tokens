/**
 * Prism3 web dashboard — scaffold (docs/08 §7 B3, docs/09).
 *
 * The FIRST rendering host over the engine core. It imports the SAME pure
 * modules the Figma plugin will (`theme`, `levers`, `preview`, `resolve-preview`)
 * and renders two things from the shared contracts:
 *   1. the theming knobs — from the lever manifest (`levers.ts`)
 *   2. a live component preview + per-mode contrast overlay — from `previewSpec`
 *      resolved through `resolvePreview(theme)`
 *
 * This proves the "define once, render everywhere" contract (docs/08 §4) drives a
 * real DOM UI. Scope of the scaffold: knobs render read-only (wiring them to
 * rebuild the theme is the next increment); the mode switch is live. Colours come
 * straight from the resolved read-model; geometry/type binding-from-tree lands
 * with the next increment (needs a pure token-tree accessor in the core).
 */
import { brandTheme } from '../../Prism3/engine/theme';
import type { BrandInput } from '../../Prism3/engine/theme';
import { leverManifest, leverGroups } from '../../Prism3/engine/levers';
import type { Lever } from '../../Prism3/engine/levers';
import { previewSpec } from '../../Prism3/engine/preview';
import { resolvePreview } from '../../Prism3/engine/resolve-preview';
import type { ResolvedPreview } from '../../Prism3/engine/resolve-preview';
import exampleBrands from '../../Prism3/schema/example-brands.json';

type Mode = ResolvedPreview['modes'][number];

// Boot from a VALIDATED example brand — the emitted schema/example-brands.json (a
// test.ts gate asserts every brand there resolves all-green on the preview
// contracts, so the overlay opens green, not on an untuned ad-hoc input). aurora:
// indigo anchor, action DECOUPLED onto an azure accent, tinted page. The knobs
// describe exactly this input; wiring them to mutate it + re-resolve is next.
const defaultBrand = (exampleBrands as Record<string, BrandInput>).aurora;

const theme = brandTheme(defaultBrand);
const rp = resolvePreview(theme);

const MODE_LABEL: Record<string, string> = {
  light: 'Light',
  dark: 'Dark',
  'hc-light': 'HC light',
  'hc-dark': 'HC dark',
};

let currentMode: Mode = rp.modes[0];

// ---- helpers ---------------------------------------------------------------

const el = (tag: string, cls?: string, text?: string): HTMLElement => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text !== undefined) n.textContent = text;
  return n;
};

/** Resolve a binding value to a concrete hex for `mode`, or undefined if it is
 *  not a colour path (geometry/type bindings are resolved in a later increment). */
const hexOf = (binding: string | undefined, mode: Mode): string | undefined =>
  binding && binding.startsWith('color.') ? rp.colors[binding]?.[mode] : undefined;

const pageBg = (mode: Mode): string => rp.colors['color.background.primary']?.[mode] ?? '#ffffff';

// ---- knob rendering (read-only, from the lever manifest) -------------------

const renderControl = (lever: Lever): HTMLElement => {
  const wrap = el('div', 'knob');
  const head = el('div', 'knob-head');
  head.append(el('label', 'knob-label', lever.label));
  if (lever.required) head.append(el('span', 'tag req', 'required'));
  head.append(el('span', 'tag ctrl', lever.control));
  wrap.append(head);

  switch (lever.control) {
    case 'slider': {
      const row = el('div', 'knob-body');
      const input = el('input') as HTMLInputElement;
      input.type = 'range';
      if (lever.min !== undefined) input.min = String(lever.min);
      if (lever.max !== undefined) input.max = String(lever.max);
      if (lever.step !== undefined) input.step = String(lever.step);
      if (typeof lever.default === 'number') input.value = String(lever.default);
      input.disabled = true;
      const val = el('span', 'knob-val', `${lever.default ?? '—'}${lever.unit ?? ''}`);
      row.append(input, val);
      wrap.append(row);
      break;
    }
    case 'enum': {
      const sel = el('select') as HTMLSelectElement;
      for (const o of lever.options ?? []) {
        const opt = el('option') as HTMLOptionElement;
        opt.value = String(o.value);
        opt.textContent = o.label;
        if (o.value === lever.default) opt.selected = true;
        sel.append(opt);
      }
      sel.disabled = true;
      wrap.append(sel);
      break;
    }
    case 'toggle': {
      const cb = el('input') as HTMLInputElement;
      cb.type = 'checkbox';
      cb.checked = lever.default === true;
      cb.disabled = true;
      const l = el('label', 'knob-body');
      l.append(cb, el('span', undefined, lever.default === true ? 'on' : 'off'));
      wrap.append(l);
      break;
    }
    case 'color': {
      const sw = el('div', 'knob-body');
      sw.append(el('span', 'swatch req-dot'), el('span', 'knob-val', lever.required ? 'brand anchor' : 'optional / synthesised'));
      wrap.append(sw);
      break;
    }
    default: {
      wrap.append(el('div', 'knob-val', String(lever.default ?? lever.itemLabel ?? '—')));
    }
  }

  wrap.append(el('p', 'knob-desc', lever.description));
  return wrap;
};

const renderLevers = (): HTMLElement => {
  const aside = el('aside', 'levers');
  aside.append(el('h2', undefined, 'Levers'));
  aside.append(el('p', 'muted', 'Rendered from the shared lever manifest. Display-only in this scaffold — wiring them to re-resolve the theme is the next increment.'));

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

// ---- preview rendering (live, from resolvePreview) -------------------------

const renderChip = (label: string, bind: Record<string, string>, mode: Mode): HTMLElement => {
  const bg = hexOf(bind.bg, mode);
  const fg = hexOf(bind.text ?? bind.titleText ?? bind.bodyText, mode);
  const border = hexOf(bind.border, mode);
  const chip = el('div', 'chip', label);
  if (bg) chip.style.background = bg;
  if (fg) chip.style.color = fg;
  chip.style.border = `2px solid ${border ?? 'transparent'}`;
  return chip;
};

const renderPreview = (mode: Mode): HTMLElement => {
  const main = el('div', 'preview');
  main.style.background = pageBg(mode);

  for (const c of previewSpec.components) {
    const block = el('section', 'pvcomp');
    block.append(el('h4', undefined, c.label));
    const row = el('div', 'chips');
    for (const v of c.variants) {
      row.append(renderChip(`${c.id} · ${v.name}`, v.bindings, mode));
    }
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
      if (r) {
        cell.append(el('span', `dot ${r.pass ? 'ok' : 'no'}`));
        cell.append(el('span', 'ratio', r.ratio.toFixed(2)));
      } else {
        cell.textContent = '—';
      }
      tr.append(cell);
    }
    table.append(tr);
  }
  wrap.append(table);
  return wrap;
};

// ---- shell -----------------------------------------------------------------

const app = document.getElementById('app')!;

const render = () => {
  app.innerHTML = '';

  const header = el('header', 'top');
  header.append(el('h1', undefined, 'Prism3'));
  const sub = el('p', 'muted', 'Web dashboard — one engine, rendered to the DOM. Knobs from the lever manifest; preview + contrast overlay from resolvePreview.');
  header.append(sub);
  const badge = el('span', 'brand-badge', `brand: ${defaultBrand.id}`);
  header.append(badge);
  app.append(header);

  const modes = el('div', 'modebar');
  modes.append(el('span', 'muted', 'Preview mode:'));
  for (const m of rp.modes) {
    const b = el('button', `modebtn${m === currentMode ? ' on' : ''}`, MODE_LABEL[m] ?? m) as HTMLButtonElement;
    b.onclick = () => { currentMode = m; render(); };
    modes.append(b);
  }
  app.append(modes);

  const layout = el('div', 'layout');
  layout.append(renderLevers());
  const rightCol = el('div', 'rightcol');
  rightCol.append(renderPreview(currentMode));
  rightCol.append(renderContracts());
  layout.append(rightCol);
  app.append(layout);
};

// ---- inlined stylesheet (self-contained bundle, matches visualize.ts house style)
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
.knob-head { display:flex; align-items:center; gap:6px; flex-wrap:wrap; }
.knob-label { font-weight:600; }
.tag { font-size:10px; padding:1px 6px; border-radius:4px; background:#eee; color:#555; }
.tag.req { background:#fde8e8; color:#a12; }
.tag.ctrl { background:#e8eefd; color:#2647a1; }
.knob-body { display:flex; align-items:center; gap:8px; margin-top:6px; }
.knob input[type=range] { flex:1; }
.knob select { width:100%; margin-top:6px; padding:4px; }
.knob-val { font-variant-numeric:tabular-nums; color:var(--muted); font-size:12px; }
.knob-desc { margin:6px 0 0; font-size:12px; color:var(--muted); }
.swatch { width:16px; height:16px; border-radius:4px; background:linear-gradient(135deg,#5b4bd6,#3aa0d6); display:inline-block; }
.rightcol { display:flex; flex-direction:column; gap:24px; }
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

render();
