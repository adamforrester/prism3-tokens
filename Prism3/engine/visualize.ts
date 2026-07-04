/**
 * Prism3 engine — token visualiser.
 *
 * Reads the emitted DTCG files (out/*.tokens.json) and renders a single
 * self-contained HTML page covering every generated axis: colour swatches per
 * palette, the per-mode semantic roles (resolved colour + contrast), the
 * dimension axis (grid / space / radius / component sizes), typography (the
 * composite text styles rendered live + the font primitives), shadow (on a
 * light panel), motion (durations + animated easing curves +
 * springs), layout (breakpoints / grid / containers), gradient (opt-in — OKLCH
 * web vs sRGB-sampled Figma side by side), and opacity + border-width. Each brand
 * section also renders a **live component preview** from the shared preview spec
 * (`preview.ts`) + `resolvePreview` (docs/08 §7, B1b) — the same model the Figma
 * plugin and web playground render from — with a per-mode contrast overlay. No
 * dependencies, no network — open the file in any browser.
 * Also prints a plain-text taxonomy to stdout.
 *
 *   npx tsx Prism3/engine/visualize.ts   # writes out/tokens.html
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { brandTheme, Theme } from './theme';
import { nbTheme } from './nb-fixture';
import { readExampleBrand } from './emit-dtcg';
import { resolvePreview } from './resolve-preview';
import { previewSpec } from './preview';
import { at, deref, pxOf, subNode, numOf, remPxOf, familyOf } from './tree';

const here = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(here, 'out');

// Themes for the live component preview (B1b): the preview renders from the shared
// preview spec + resolvePreview, dogfooding the same model the plugin/playground use.
const themeFor: Record<string, Theme> = {
  nb: nbTheme(),
  aurora: brandTheme(readExampleBrand('../examples/aurora.design.md')),
  harbor: brandTheme(readExampleBrand('../examples/harbor.design.md')),
};

type Node = any;

const hexOf = (tree: Node, node: Node): string => {
  const t = deref(tree, node);
  return t?.$extensions?.prism3?.hex ?? (typeof t?.$value === 'string' && t.$value.startsWith('#') ? t.$value : '#000');
};
const aliasTarget = (node: Node): string => (typeof node.$value === 'string' && /^\{.+\}$/.test(node.$value) ? node.$value.slice(1, -1) : '');

type Brand = { id: string; root: string; tree: Node; data: Node };
const load = (id: string, root: string): Brand => {
  const tree = JSON.parse(readFileSync(resolve(outDir, `${id}.tokens.json`), 'utf8'));
  return { id, root, tree, data: tree[root] };
};

const esc = (s: string) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]!));
const textOn = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 140 ? '#111' : '#fff';
};

// ---------------------------------------------------------------------------
const brands = [load('nb', 'nbds'), load('aurora', 'prism'), load('harbor', 'prism')];
const txt: string[] = [];
const html: string[] = [];

const STEP_ORDER = (keys: string[]) => keys.sort((a, b) => Number(a) - Number(b));

for (const b of brands) {
  const { data, tree, id, root } = b;
  const profile = `${root}.* / ${tree.$extensions.prism3.colorFormat}`;
  txt.push(`\n${'='.repeat(64)}\n  ${id.toUpperCase()}   (${profile})\n${'='.repeat(64)}`);
  html.push(`<section><h2>${id} <span class="muted">${profile}</span></h2>`);

  // ---- colour primitives ----
  txt.push('\n— COLOUR PRIMITIVES —');
  html.push('<h3>Colour primitives</h3>');
  const palettes = Object.keys(data.palette).filter((k) => k !== 'white' && k !== 'black');
  for (const pal of palettes) {
    const steps = STEP_ORDER(Object.keys(data.palette[pal]));
    txt.push(`\n  ${pal}`);
    html.push(`<div class="palette"><div class="plabel">${esc(pal)}</div><div class="ramp">`);
    for (const k of steps) {
      const node = data.palette[pal][k];
      const hex = hexOf(tree, node);
      const anchor = node.$extensions?.prism3?.anchor;
      txt.push(`    ${(pal + '.' + k).padEnd(18)} ${hex}${anchor ? '   ← brand anchor' : ''}`);
      // L-10: esc the brand-controlled palette name (defence-in-depth — CR-03/L-06 already
      // constrain it to a slug, so this is byte-identical for a valid brand).
      html.push(`<div class="sw" style="background:${hex};color:${textOn(hex)}" title="${esc(pal)}.${k} ${hex}"><span>${k}${anchor ? ' ★' : ''}</span><small>${hex}</small></div>`);
    }
    html.push('</div></div>');
  }

  // ---- semantic colour roles (one mode-agnostic token, resolved per mode) ----
  // Each `color.*` role token carries the canonical `light` value in `$value` and
  // the dark / hc-light / hc-dark values as overrides in `$extensions.prism3.modes`.
  txt.push('\n— SEMANTIC COLOUR ROLES (per mode) —');
  html.push('<h3>Semantic roles <span class="muted">(one token · resolved per mode)</span></h3>');
  // Role keys are property-led and nest (group / variant / state); flatten to
  // dotted paths that point at leaves (`$value`-bearing nodes).
  const roleKeys: string[] = [];
  const flatten = (o: any, prefix: string) => {
    for (const k of Object.keys(o)) {
      if (k.startsWith('$')) continue;
      const node = o[k]; const path = prefix ? `${prefix}.${k}` : k;
      if (node && typeof node === 'object' && '$value' in node) roleKeys.push(path);
      else if (node && typeof node === 'object') flatten(node, path);
    }
  };
  flatten(data.color, '');
  // L-10: render the modes the tree ACTUALLY carries, not a hardcoded four — a narrowed-modes
  // brand (light only, or one that ships wireframe) would otherwise draw empty/omitted columns.
  // `light` is the canonical `$value`; the rest live in `$extensions.prism3.modes`. Canonical
  // order preserved so the shipped (all-four) brands stay byte-identical.
  const MODE_ORDER = ['light', 'dark', 'hc-light', 'hc-dark', 'wireframe'];
  const present = new Set<string>(['light']);
  for (const rk of roleKeys) {
    const rn = rk.split('.').reduce((acc: any, s) => acc?.[s], data.color);
    for (const m of Object.keys(rn.$extensions?.prism3?.modes ?? {})) present.add(m);
  }
  const MODES = MODE_ORDER.filter((m) => present.has(m));
  html.push('<table class="sem"><thead><tr><th>role</th>' + MODES.map((m) => `<th>${m}</th>`).join('') + '</tr></thead><tbody>');
  for (const rk of roleKeys) {
    const roleNode = rk.split('.').reduce((acc: any, s) => acc?.[s], data.color);
    const overrides = roleNode.$extensions?.prism3?.modes ?? {};
    txt.push(`\n  ${rk}`);
    html.push(`<tr><td class="rk">${rk}</td>`);
    for (const m of MODES) {
      const node = m === 'light' ? roleNode : overrides[m];       // light = canonical $value; others in $extensions.modes
      if (!node) { html.push('<td class="cell"><small>—</small></td>'); continue; }
      const hex = hexOf(tree, node);
      const tgt = aliasTarget(node).replace(`${root}.palette.`, '');
      const ratio = m === 'light' ? roleNode.$extensions?.prism3?.contrast : node.contrast;
      txt.push(`    ${m.padEnd(9)} → ${tgt.padEnd(14)} ${hex}${ratio ? `  (${ratio}:1)` : ''}`);
      html.push(`<td class="cell" style="background:${hex};color:${textOn(hex)}"><span>${tgt}</span><small>${hex}${ratio ? ` · ${ratio}:1` : ''}</small></td>`);
    }
    html.push('</tr>');
  }
  html.push('</tbody></table>');

  // ---- dimension axis ----
  const grid = STEP_ORDER(Object.keys(data.dimension)).map(Number);
  txt.push('\n— DIMENSION GRID (px) —\n  ' + grid.join(', '));
  html.push(`<h3>Dimension grid <span class="muted">${grid.length} primitives</span></h3><div class="bars">`);
  for (const px of grid) html.push(`<div class="barrow"><span class="bk">${px}</span><div class="bar" style="width:${Math.min(px, 200)}px"></div></div>`);
  html.push('</div>');

  // space (numbered multiplier, reference tier)
  txt.push('\n— SPACE (numbered ×base, reference tier) —');
  html.push('<h3>Space <span class="muted">numbered multiplier · reference tier</span></h3><div class="bars">');
  for (const k of Object.keys(data.space)) {
    const px = pxOf(tree, data.space[k]);
    const mult = data.space[k].$extensions.prism3.mult;
    txt.push(`  space.${k.padEnd(4)} ${String(px).padStart(3)}px  (${mult}× base)`);
    html.push(`<div class="barrow"><span class="bk">${k}</span><div class="bar sp" style="width:${Math.min(px, 200)}px"></div><span class="bv">${px}px · ${mult}×</span></div>`);
  }
  html.push('</div>');

  // radius
  const rScale = data.radius[Object.keys(data.radius).find((k) => data.radius[k].$extensions.prism3.radiusScale !== undefined)!]?.$extensions.prism3.radiusScale ?? '—';
  txt.push(`\n— RADIUS (scale: ${rScale}) —`);
  html.push(`<h3>Radius <span class="muted">scale: ${rScale}</span></h3><div class="radii">`);
  for (const k of Object.keys(data.radius)) {
    const px = pxOf(tree, data.radius[k]);
    txt.push(`  radius.${k.padEnd(5)} ${String(px).padStart(3)}px`);
    const shown = Math.min(px, 48);
    html.push(`<div class="rcell"><div class="rbox" style="border-radius:${shown}px"></div><span>${k}</span><small>${px}px</small></div>`);
  }
  html.push('</div>');

  // component sizes (component tier — density acts here)
  const sizeDensity = data.size[Object.keys(data.size)[0]].height.$extensions.prism3.density;
  txt.push(`\n— COMPONENT SIZES (density: ${sizeDensity}) —`);
  html.push(`<h3>Component sizes <span class="muted">density: ${sizeDensity} · height + paired padding</span></h3><div class="sizes">`);
  for (const k of Object.keys(data.size)) {
    const h = pxOf(tree, data.size[k].height);
    const px2 = pxOf(tree, data.size[k]['padding-x']);
    const py = pxOf(tree, data.size[k]['padding-y']);
    txt.push(`  size.${k.padEnd(3)} height ${String(h).padStart(2)}px · pad ${px2}×${py}px`);
    // a mock control: fixed-width box at the real height, with real inset shown as an inner fill
    html.push(`<div class="scell"><div class="control" style="height:${h}px;padding:${py}px ${px2}px"><div class="ctext">${k}</div></div><small>${h}h · ${px2}×${py}</small></div>`);
  }
  html.push('</div>');

  // ---- typography (composite text styles) ----
  txt.push('\n— TYPOGRAPHY (composite text styles) —');
  html.push('<h3>Typography <span class="muted">composite text styles · fluid range shown · capped to 64px</span></h3><div class="type">');
  const renderType = (path: string, node: Node) => {
    const v = node.$value;
    const ext = node.$extensions?.prism3 ?? {};
    const family = familyOf(tree, subNode(tree, v.fontFamily));
    const weight = numOf(tree, subNode(tree, v.fontWeight));
    const lh = numOf(tree, subNode(tree, v.lineHeight));
    const ls = String(deref(tree, subNode(tree, v.letterSpacing))?.$value ?? '0');
    const tc = v.textCase ?? ext.textCase ?? 'none';
    const deco = v.textDecoration === 'underline' || ext.link ? 'underline' : 'none';
    const sizePx = ext.sizePx ?? remPxOf(tree, subNode(tree, v.fontSize));
    const r = ext.responsive ?? {};
    const range = r.fluid ? `${r.min.px}→${r.max.px}px fluid` : `${r.px ?? sizePx}px`;
    const shown = Math.min(sizePx, 64);
    const style = `font-family:${family};font-size:${shown}px;font-weight:${weight};line-height:${lh};letter-spacing:${ls};text-transform:${tc};text-decoration:${deco}`;
    txt.push(`  ${path.padEnd(24)} ${range} · w${weight} · lh${lh}${deco === 'underline' ? ' · link' : ''} · ${family.split(',')[0]}`);
    html.push(`<div class="trow"><div class="tmeta"><b>${path.replace(/^type\./, '')}</b><span>${range} · w${weight} · lh ${lh} · ls ${ls}${tc !== 'none' ? ' · ' + tc : ''}${deco === 'underline' ? ' · link' : ''}</span><span class="tfam">${esc(family.split(',')[0])}</span></div><div class="tsample" style="${style}">${esc(path.split('.').slice(1).join(' '))}</div></div>`);
  };
  // Recurse to every composite leaf ($value-bearing); the tree is now group/size/weight[-link].
  const walkType = (node: Node, path: string) => {
    if (node && typeof node === 'object') {
      if ('$value' in node) { renderType(path, node); return; }
      for (const k of Object.keys(node)) walkType(node[k], `${path}.${k}`);
    }
  };
  for (const g of Object.keys(data.type)) walkType(data.type[g], `type.${g}`);
  html.push('</div>');

  // type primitives: families, weight roles, line-height, tracking, size ladder
  html.push('<h3>Font primitives <span class="muted">families · weight roles · line-height · tracking · size ladder</span></h3>');
  html.push('<div class="fontprim">');
  html.push('<div class="fpcol"><div class="fplabel">families</div>');
  for (const k of Object.keys(data.font.family)) {
    const fam = familyOf(tree, data.font.family[k]);
    html.push(`<div class="fpline" style="font-family:${fam}">${k} — ${esc(fam.split(',')[0])}</div>`);
  }
  html.push('</div>');
  html.push('<div class="fpcol"><div class="fplabel">weight roles</div>');
  for (const k of Object.keys(data.font['weight-role'])) {
    const w = numOf(tree, data.font['weight-role'][k]);
    html.push(`<div class="fpline" style="font-weight:${w}">${k} — ${w}</div>`);
  }
  html.push('</div>');
  html.push('<div class="fpcol"><div class="fplabel">line-height</div>');
  for (const k of Object.keys(data.font['line-height'])) html.push(`<div class="fpline">${k} — ${data.font['line-height'][k].$value}</div>`);
  html.push('</div>');
  html.push('<div class="fpcol"><div class="fplabel">tracking</div>');
  for (const k of Object.keys(data.font['letter-spacing'])) html.push(`<div class="fpline">${k} — ${data.font['letter-spacing'][k].$value}</div>`);
  html.push('</div></div>');
  html.push('<div class="bars" style="margin-top:8px">');
  for (const k of Object.keys(data.font.size)) {
    const px = data.font.size[k].$extensions?.prism3?.px ?? remPxOf(tree, data.font.size[k]);
    html.push(`<div class="barrow"><span class="bk">${k}</span><div class="bar fs" style="width:${Math.min(px, 200)}px"></div><span class="bv">${px}px</span></div>`);
  }
  html.push('</div>');

  // ---- shadow (light panel) ----
  // Elevation is no longer a colour group — it's a foreground surface tier + one of
  // these shadow steps, composed at the component layer (see docs/06).
  txt.push('\n— SHADOW (elevation ladder) —');
  html.push('<h3>Shadow <span class="muted">light mode · 2-layer key+ambient · elevation = a foreground tier + a shadow</span></h3>');
  html.push('<div class="lightpanel"><div class="lpsub">shadow ladder</div><div class="shrow">');
  for (const k of Object.keys(data.shadow)) {
    const layers = data.shadow[k].$value;
    const n = data.shadow[k].$extensions?.prism3?.layers ?? layers.length;
    const css = layers.map((l: any) => `${k === 'inset' ? 'inset ' : ''}${l.offsetX} ${l.offsetY} ${l.blur} ${l.spread} ${l.color}`).join(', ');
    txt.push(`  shadow.${k.padEnd(5)} ${n} layer(s)`);
    html.push(`<div class="shcell"><div class="shbox" style="box-shadow:${css}"></div><span>${k}</span><small>${n} layer${n > 1 ? 's' : ''}</small></div>`);
  }
  html.push('</div></div>');

  // ---- gradient (opt-in brand gradients) ----
  if (data.gradient) {
    txt.push('\n— GRADIENT (opt-in) —');
    html.push('<h3>Gradient <span class="muted">opt-in · stops alias the ramp · OKLCH-interpolated (web) vs sRGB-sampled (Figma)</span></h3><div class="grad">');
    for (const k of Object.keys(data.gradient)) {
      const node = data.gradient[k];
      const ext = node.$extensions?.prism3 ?? {};
      const css = ext.css as string;
      // Build the baked sRGB approximation Figma would render, from sampledStops.
      const samp = ext.figma?.sampledStops ?? [];
      const stopList = samp.map((s: any) => `${s.hex} ${Math.round(s.position * 100)}%`).join(', ');
      const srgbCss = ext.kind === 'radial'
        ? `radial-gradient(${ext.shape} at ${Math.round(ext.center[0] * 100)}% ${Math.round(ext.center[1] * 100)}%, ${stopList})`
        : `linear-gradient(${ext.angle}deg, ${stopList})`;
      const aa = ext.a11y ?? {};
      const stopAliases = (node.$value as any[]).map((s) => `${String(s.color).replace(/^\{|\}$/g, '').replace(`${root}.palette.`, '')} ${Math.round(s.position * 100)}%`).join(' → ');
      txt.push(`  gradient.${k.padEnd(8)} ${ext.kind}${ext.kind === 'linear' ? ` ${ext.angle}°` : ''} · ${stopAliases} · worst-on-white ${aa.worstOnWhite}:1`);
      html.push(`<div class="gradrow"><div class="gradmeta"><b>${k}</b><span>${ext.kind}${ext.kind === 'linear' ? ` · ${ext.angle}°` : ` · ${ext.shape}`} · ${ext.interpolation}</span><span class="tfam">${esc(stopAliases)}</span><span class="gradaa">text-on: white ${aa.worstOnWhite}:1 · black ${aa.worstOnBlack}:1${Math.min(aa.worstOnWhite, aa.worstOnBlack) < 4.5 ? ' · scrim for body text' : ''}</span></div>`);
      html.push(`<div class="gradpair"><div class="gradcell"><div class="gradbox" style="background:${css}"></div><small>OKLCH (web)</small></div><div class="gradcell"><div class="gradbox" style="background:${srgbCss}"></div><small>sRGB ${samp.length}-stop (Figma)</small></div></div>`);
      html.push('</div>');
    }
    html.push('</div>');
  }

  // ---- motion ----
  txt.push('\n— MOTION (duration · easing · spring) —');
  html.push('<h3>Motion <span class="muted">durations · easing curves (animated) · springs</span></h3>');
  html.push('<div class="bars">');
  for (const k of Object.keys(data.motion.duration)) {
    const ms = data.motion.duration[k].$extensions?.prism3?.ms ?? parseInt(String(data.motion.duration[k].$value), 10);
    txt.push(`  duration.${k.padEnd(8)} ${ms}ms`);
    html.push(`<div class="barrow"><span class="bk2">${k}</span><div class="bar mo" style="width:${Math.max(2, Math.min(ms, 600) / 2)}px"></div><span class="bv">${ms}ms</span></div>`);
  }
  html.push('</div><div class="eases">');
  for (const k of Object.keys(data.motion.easing)) {
    const bz = data.motion.easing[k].$value;
    const cb = `cubic-bezier(${bz.join(', ')})`;
    html.push(`<div class="ecell"><div class="etrack"><div class="edot" style="animation-timing-function:${cb}"></div></div><span>${k}</span><small>${cb}</small></div>`);
  }
  html.push('</div>');
  if (data.motion.spring) {
    html.push('<div class="springs">');
    for (const k of Object.keys(data.motion.spring)) {
      const s = data.motion.spring[k].$value;
      html.push(`<div class="spcell"><b>${k}</b><small>damping ${s.damping} · stiffness ${s.stiffness}</small></div>`);
    }
    html.push('</div>');
  }

  // ---- layout (breakpoints · grid · containers) ----
  txt.push('\n— LAYOUT (breakpoints · grid · containers) —');
  html.push('<h3>Layout <span class="muted">breakpoint floors · grid (design artifact) · containers</span></h3>');
  html.push('<div class="bps">');
  for (const k of Object.keys(data.breakpoint)) {
    const px = data.breakpoint[k].$extensions?.prism3?.px ?? parseInt(String(data.breakpoint[k].$value), 10);
    txt.push(`  breakpoint.${k.padEnd(4)} ${px === 0 ? '0 (base)' : '>=' + px + 'px'}`);
    html.push(`<div class="bp"><b>${k}</b><small>${px === 0 ? '0 · base' : '≥' + px + 'px'}</small></div>`);
  }
  html.push('</div>');
  html.push('<table class="grid"><thead><tr><th>bp</th><th>columns</th><th>gutter</th><th>margin</th></tr></thead><tbody>');
  for (const k of Object.keys(data.grid)) {
    const g = data.grid[k];
    const cols = g.columns.$value;
    const gut = g.gutter.$extensions?.prism3?.px ?? '';
    const mar = g.margin.$extensions?.prism3?.px ?? '';
    txt.push(`  grid.${k.padEnd(4)} ${cols} cols · gutter ${gut} · margin ${mar}`);
    html.push(`<tr><td>${k}</td><td>${cols}</td><td>${gut}px</td><td>${mar}px</td></tr>`);
  }
  html.push('</tbody></table>');
  html.push('<div class="bars">');
  for (const k of Object.keys(data.container)) {
    const node = data.container[k];
    const px = node.$extensions?.prism3?.px;
    const w = px ? Math.min(px / 6, 240) : 240;
    html.push(`<div class="barrow"><span class="bk2">${k}</span><div class="bar ct" style="width:${w}px"></div><span class="bv">${node.$value}</span></div>`);
  }
  html.push('</div>');

  // ---- opacity + border-width ----
  html.push('<h3>Opacity</h3><div class="ops">');
  for (const k of Object.keys(data.opacity)) {
    html.push(`<div class="opcell"><div class="opwrap"><div class="opbox" style="opacity:${data.opacity[k].$value}"></div></div><span>${k}</span></div>`);
  }
  html.push('</div>');
  html.push('<h3>Border width</h3><div class="bws">');
  for (const k of Object.keys(data['border-width'])) {
    const px = data['border-width'][k].$extensions?.prism3?.px ?? pxOf(tree, data['border-width'][k]);
    html.push(`<div class="bwcell"><div class="bwline" style="border-top-width:${px}px"></div><span>${k}</span><small>${px}px</small></div>`);
  }
  html.push('</div>');

  // ---- full taxonomy table (every token, full path, filterable) ----
  txt.push('\n— FULL TAXONOMY —');
  html.push('<h3>Full taxonomy <span class="muted">every token · full path · type one to filter · click a path to copy</span></h3>');
  html.push(`<input class="taxfilter" type="text" placeholder="filter ${root}.* by path…" autocomplete="off">`);
  const leaves: { path: string; type: string; node: Node }[] = [];
  const collect = (node: Node, segs: string[]) => {
    if (node && typeof node === 'object') {
      if (node.$type !== undefined) { leaves.push({ path: segs.join('.'), type: String(node.$type), node }); return; }
      for (const k of Object.keys(node)) if (!k.startsWith('$')) collect(node[k], [...segs, k]);
    }
  };
  collect(data, [root]);
  const byCat: Record<string, typeof leaves> = {};
  for (const lf of leaves) (byCat[lf.path.split('.')[1]] ??= []).push(lf);
  txt.push(`  ${leaves.length} tokens across ${Object.keys(byCat).length} categories`);
  for (const cat of Object.keys(byCat)) {
    html.push(`<details class="taxgroup"><summary>${cat} <span class="muted">${byCat[cat].length}</span></summary><table class="tax"><thead><tr><th>path</th><th>type</th><th>value</th><th>description</th></tr></thead><tbody>`);
    for (const lf of byCat[cat]) {
      const v = lf.node.$value;
      const isAlias = typeof v === 'string' && /^\{.+\}$/.test(v);
      let valCell: string;
      if (lf.type === 'color') {
        const hx = hexOf(tree, lf.node);
        valCell = `<span class="taxsw" style="background:${hx}"></span>${isAlias ? '<span class="taxal">→ ' + esc(aliasTarget(lf.node).replace(root + '.', '')) + '</span> ' : ''}<code>${hx}</code>`;
      } else if (isAlias) {
        valCell = `<span class="taxal">→ ${esc(aliasTarget(lf.node).replace(root + '.', ''))}</span>`;
      } else {
        const s = typeof v === 'object' ? (Array.isArray(v) ? `[${v.length}-layer]` : '{composite}') : String(v);
        valCell = `<code>${esc(s.length > 44 ? s.slice(0, 44) + '…' : s)}</code>`;
      }
      const desc = lf.node.$description ? esc(String(lf.node.$description).split(' — ')[0].slice(0, 72)) : '';
      txt.push(`    ${lf.path.padEnd(46)} ${lf.type}`);
      html.push(`<tr class="taxrow"><td class="taxpath"><code class="copy" title="click to copy">${esc(lf.path)}</code></td><td class="taxtype">${lf.type}</td><td class="taxval">${valCell}</td><td class="taxdesc">${desc}</td></tr>`);
    }
    html.push('</tbody></table></details>');
  }

  // ---- component preview (live, from the shared preview spec + resolvePreview) ----
  // Dogfoods B1a/B1b: the SAME model the plugin/playground render from. Chips are
  // light mode; the overlay shows each declared contract's ratio + pass across all 4 modes.
  const rp = resolvePreview(themeFor[id]);
  const cAt = (p: string, mode = 'light'): string => rp.colors[p]?.[mode as keyof (typeof rp.colors)[string]] ?? '#000';
  const dpx = (p: string): number => pxOf(tree, at(data, p));
  const typeCss = (p: string): string => {
    const node = at(data, p); if (!node?.$value) return '';
    const v = node.$value; const ext = node.$extensions?.prism3 ?? {};
    const fam = familyOf(tree, subNode(tree, v.fontFamily));
    const w = numOf(tree, subNode(tree, v.fontWeight));
    const sz = Math.min(ext.sizePx ?? remPxOf(tree, subNode(tree, v.fontSize)), 20);
    return `font-family:${fam};font-weight:${w};font-size:${sz}px`;
  };
  const PVMODES = ['light', 'dark', 'hc-light', 'hc-dark'] as const;
  const PVABBR: Record<string, string> = { light: 'L', dark: 'D', 'hc-light': 'HL', 'hc-dark': 'HD' };
  txt.push('\n— COMPONENT PREVIEW (from the preview spec) —');
  html.push('<h3>Component preview <span class="muted">rendered live from the preview spec + resolvePreview — chips: light mode · overlay: each contract’s ratio + pass across all 4 modes</span></h3>');
  html.push('<div class="preview">');
  for (const comp of previewSpec.components) {
    html.push(`<div class="pvcomp"><div class="pvhead">${esc(comp.label)}</div>`);
    for (const v of comp.variants) {
      const b = v.bindings;
      const bg = b.bg ? cAt(b.bg) : cAt('color.background.primary');
      const fg = cAt(b.text || b.titleText || b.bodyText || 'color.text.primary');
      const border = b.border ? `1px solid ${cAt(b.border)}` : '1px solid transparent';
      const radius = b.radius ? dpx(b.radius) : 6;
      const pad = b.pad ? `${dpx(b.pad)}px` : (b.padX && b.padY ? `${dpx(b.padY)}px ${dpx(b.padX)}px` : '8px 12px');
      const font = b.type ? typeCss(b.type) : '';
      const chipStyle = `background:${bg};color:${fg};border:${border};border-radius:${radius}px;padding:${pad};${font}`;
      const cs = rp.contracts.filter((c) => c.component === comp.id && c.variant === v.name);
      const rows = cs.map((c) => {
        const dots = PVMODES.map((m) => { const r = c.byMode[m]; return r ? `<i class="${r.pass ? 'ok' : 'no'}" title="${m}: ${r.ratio}:1 (min ${c.min})">${PVABBR[m]}</i>` : ''; }).join('');
        const lr = c.byMode.light;
        // L-10: show the ACTUAL relation — a failing light contract used to print `3.20≥4.5`,
        // literally false. Use `<` + a fail class when it doesn't clear the min.
        const ratioCell = lr ? `${lr.ratio}${lr.pass ? '≥' : '<'}${c.min}` : `—≥${c.min}`;
        return `<div class="ccrow"><span class="cclabel">${esc(c.label ?? '')}</span><span class="ccratio${lr && !lr.pass ? ' no' : ''}">${ratioCell}</span><span class="ccdots">${dots}</span></div>`;
      }).join('');
      html.push(`<div class="pvrow"><div class="pvchip" style="${chipStyle}">${esc(v.name)}</div><div class="pvcc">${rows}</div></div>`);
    }
    html.push('</div>');
  }
  html.push('</div>');

  html.push('</section>');
}

const page = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Prism3 tokens</title>
<style>
  :root{font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,sans-serif}
  body{margin:0;background:#0f1115;color:#e6e7eb;padding:28px 32px 80px}
  h1{font-size:22px;margin:0 0 4px} h2{font-size:19px;margin:40px 0 6px;border-bottom:1px solid #2a2e37;padding-bottom:8px}
  h3{font-size:13px;text-transform:uppercase;letter-spacing:.06em;color:#aeb4c0;margin:24px 0 10px;font-weight:600}
  .muted{color:#6b7280;font-weight:400;text-transform:none;letter-spacing:0;font-size:12px}
  .lead{color:#9aa1ad;max-width:70ch;font-size:14px;line-height:1.5}
  .palette{display:flex;align-items:center;gap:14px;margin:6px 0}
  .plabel{width:80px;font-size:13px;color:#cbd1db;text-align:right;flex:0 0 auto}
  .ramp{display:flex;flex-wrap:wrap;gap:3px}
  .sw{width:62px;height:54px;border-radius:6px;display:flex;flex-direction:column;justify-content:flex-end;padding:5px;box-sizing:border-box}
  .sw span{font-size:11px;font-weight:600} .sw small{font-size:9px;opacity:.85;font-variant-numeric:tabular-nums}
  table.sem{border-collapse:separate;border-spacing:3px;margin-top:6px}
  table.sem th{font-size:11px;color:#9aa1ad;font-weight:600;text-align:left;padding:2px 6px}
  td.rk{font-size:12px;color:#cbd1db;white-space:nowrap;padding-right:10px;font-variant-numeric:tabular-nums}
  td.cell{width:140px;height:46px;border-radius:6px;vertical-align:top;padding:6px 8px}
  td.cell span{font-size:11px;font-weight:600;display:block} td.cell small{font-size:9px;opacity:.85}
  .bars{display:flex;flex-direction:column;gap:3px}
  .barrow{display:flex;align-items:center;gap:10px;font-size:11px}
  .bk{width:38px;text-align:right;color:#9aa1ad;font-variant-numeric:tabular-nums}
  .bar{height:14px;background:#4f8cff;border-radius:3px;min-width:2px}
  .bar.sp{background:#36c08f} .bv{color:#6b7280}
  .radii{display:flex;gap:18px;flex-wrap:wrap}
  .rcell{display:flex;flex-direction:column;align-items:center;gap:6px;font-size:11px;color:#cbd1db}
  .rbox{width:56px;height:56px;background:linear-gradient(135deg,#4f8cff,#9b6bff)}
  .rcell small{color:#6b7280}
  .sizes{display:flex;gap:16px;flex-wrap:wrap;align-items:flex-end}
  .preview{display:flex;flex-wrap:wrap;gap:18px}
  .pvcomp{background:#151821;border:1px solid #2a2e37;border-radius:8px;padding:12px 14px;min-width:230px}
  .pvhead{font-size:12px;font-weight:600;color:#cbd1db;margin-bottom:10px}
  .pvrow{display:flex;align-items:center;gap:12px;margin:8px 0}
  .pvchip{min-width:64px;text-align:center;font-size:12px;box-sizing:border-box}
  .pvcc{display:flex;flex-direction:column;gap:3px;flex:1}
  .ccrow{display:flex;align-items:center;gap:6px;font-size:10px;color:#9aa1ad}
  .cclabel{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .ccratio{font-variant-numeric:tabular-nums;color:#cbd1db}
  .ccdots{display:flex;gap:2px}
  .ccdots i{font-style:normal;font-size:8px;font-weight:700;padding:1px 3px;border-radius:3px;line-height:1.2}
  .ccdots i.ok{background:#12341f;color:#4ade80} .ccdots i.no{background:#3a1518;color:#f87171}
  .scell{display:flex;flex-direction:column;align-items:center;gap:6px;font-size:11px;color:#6b7280}
  .control{box-sizing:border-box;min-width:64px;background:#2a2e37;border:1px solid #3a3f4a;border-radius:6px;display:flex;align-items:center;justify-content:center}
  .ctext{background:#4f8cff33;border:1px solid #4f8cff;color:#cdd9ff;border-radius:3px;font-size:11px;font-weight:600;padding:1px 8px;height:100%;display:flex;align-items:center}
  .bar.fs{background:#d98ad0}
  /* typography */
  .type{display:flex;flex-direction:column;gap:0}
  .trow{display:flex;align-items:baseline;gap:20px;padding:9px 0;border-bottom:1px solid #1c2027}
  .tmeta{width:240px;flex:0 0 auto;display:flex;flex-direction:column;gap:1px;align-self:center}
  .tmeta b{font-size:12px;color:#cbd1db;font-variant-numeric:tabular-nums}
  .tmeta span{font-size:10px;color:#6b7280}
  .tmeta .tfam{color:#808894}
  .tsample{color:#e6e7eb;overflow:hidden;white-space:nowrap;flex:1 1 auto}
  .fontprim{display:flex;gap:34px;flex-wrap:wrap}
  .fpcol{display:flex;flex-direction:column;gap:3px;font-size:12px;color:#cbd1db}
  .fplabel{font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:#6b7280;margin-bottom:2px}
  .fpline{font-variant-numeric:tabular-nums}
  /* shadow + elevation */
  .lightpanel{background:#f4f5f7;border-radius:10px;padding:22px 24px;margin:6px 0}
  .lpsub{font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:#5b6270;font-weight:600;margin:6px 0 14px}
  .lpsub:not(:first-child){margin-top:26px} .lpmuted{color:#9aa1ad;font-weight:400;text-transform:none;letter-spacing:0}
  .shrow{display:flex;gap:26px;flex-wrap:wrap;align-items:flex-end}
  .shcell{display:flex;flex-direction:column;align-items:center;gap:8px;font-size:11px;color:#5b6270}
  .shbox{width:78px;height:60px;background:#fff;border-radius:8px}
  .shcell small{color:#9aa1ad}
  /* gradient */
  .grad{display:flex;flex-direction:column;gap:14px}
  .gradrow{display:flex;align-items:center;gap:22px;flex-wrap:wrap}
  .gradmeta{width:300px;flex:0 0 auto;display:flex;flex-direction:column;gap:2px}
  .gradmeta b{font-size:13px;color:#cbd1db}
  .gradmeta span{font-size:10px;color:#6b7280}
  .gradmeta .gradaa{color:#8089a0;font-variant-numeric:tabular-nums}
  .gradpair{display:flex;gap:14px}
  .gradcell{display:flex;flex-direction:column;gap:5px;align-items:center;font-size:10px;color:#9aa1ad}
  .gradbox{width:180px;height:84px;border-radius:8px;border:1px solid #2a2e37}
  /* motion */
  .bk2{width:56px;text-align:right;color:#9aa1ad;font-size:11px;font-variant-numeric:tabular-nums}
  .bar.mo{background:#e0a93b} .bar.ct{background:#c879d9}
  .eases{display:flex;gap:18px;flex-wrap:wrap;margin-top:12px}
  .ecell{display:flex;flex-direction:column;gap:6px;font-size:10px;color:#9aa1ad;width:160px}
  .etrack{position:relative;height:14px;background:#1c2027;border-radius:7px;overflow:hidden}
  .edot{position:absolute;top:1px;left:1px;width:12px;height:12px;border-radius:50%;background:#4f8cff;animation:edot 1.8s infinite alternate}
  @keyframes edot{from{left:1px}to{left:calc(100% - 13px)}}
  .springs{display:flex;gap:20px;flex-wrap:wrap;margin-top:14px}
  .spcell{display:flex;flex-direction:column;gap:2px;font-size:12px;color:#cbd1db}
  .spcell small{color:#6b7280;font-size:10px}
  /* layout */
  .bps{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px}
  .bp{background:#1c2027;border:1px solid #2a2e37;border-radius:6px;padding:6px 12px;display:flex;flex-direction:column;gap:2px}
  .bp b{font-size:12px;color:#cbd1db} .bp small{font-size:10px;color:#6b7280;font-variant-numeric:tabular-nums}
  table.grid{border-collapse:collapse;font-size:12px;margin:4px 0 16px}
  table.grid th{text-align:left;color:#9aa1ad;font-weight:600;padding:4px 22px 4px 0;font-size:11px}
  table.grid td{padding:3px 22px 3px 0;color:#cbd1db;font-variant-numeric:tabular-nums;border-top:1px solid #1c2027}
  /* opacity + border-width */
  .ops{display:flex;gap:6px;flex-wrap:wrap}
  .opcell{display:flex;flex-direction:column;align-items:center;gap:4px;font-size:10px;color:#9aa1ad}
  .opwrap{width:46px;height:40px;border-radius:5px;overflow:hidden;background:repeating-conic-gradient(#3a3f4a 0% 25%,#2a2e37 0% 50%) 0/14px 14px}
  .opbox{width:100%;height:100%;background:#4f8cff}
  .bws{display:flex;gap:22px;flex-wrap:wrap;align-items:flex-end;margin-top:4px}
  .bwcell{display:flex;flex-direction:column;align-items:center;gap:6px;font-size:11px;color:#9aa1ad;width:96px}
  .bwline{width:96px;border-top-style:solid;border-top-color:#4f8cff}
  .bwcell small{color:#6b7280}
  /* full taxonomy table */
  .taxfilter{width:100%;max-width:520px;box-sizing:border-box;margin:0 0 12px;padding:8px 12px;background:#1c2027;border:1px solid #2a2e37;border-radius:7px;color:#e6e7eb;font-size:13px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace}
  .taxfilter:focus{outline:none;border-color:#4f8cff}
  details.taxgroup{border:1px solid #1c2027;border-radius:7px;margin:0 0 6px;overflow:hidden}
  details.taxgroup summary{cursor:pointer;padding:8px 12px;background:#161922;font-size:12px;font-weight:600;color:#cbd1db;text-transform:uppercase;letter-spacing:.04em;user-select:none}
  details.taxgroup summary .muted{margin-left:6px}
  table.tax{border-collapse:collapse;width:100%;font-size:11.5px}
  table.tax thead th{position:sticky;top:0;text-align:left;color:#6b7280;font-weight:600;padding:6px 12px;background:#0f1115;font-size:10px;text-transform:uppercase;letter-spacing:.05em}
  table.tax td{padding:4px 12px;border-top:1px solid #15181f;vertical-align:middle}
  .taxpath code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;color:#cbd1db;white-space:nowrap}
  code.copy{cursor:pointer;border-radius:3px;padding:1px 3px;transition:background .12s}
  code.copy:hover{background:#2a2e37;color:#fff} code.copy.copied{background:#36c08f33;color:#36c08f}
  .taxtype{color:#8089a0;font-size:10px;white-space:nowrap}
  .taxval code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;color:#aeb4c0;font-variant-numeric:tabular-nums}
  .taxval .taxal{color:#d98ad0;font-family:ui-monospace,SFMono-Regular,Menlo,monospace}
  .taxsw{display:inline-block;width:13px;height:13px;border-radius:3px;border:1px solid #ffffff22;vertical-align:-2px;margin-right:6px}
  .taxdesc{color:#6b7280;max-width:48ch}
</style></head><body>
<h1>Prism3 — generated token taxonomy</h1>
<p class="lead">Every value below is engine-generated from a small theme input and read back from the emitted DTCG files (<code>out/*.tokens.json</code>) — colour, semantic roles, dimension, typography, shadow, motion, layout, gradient (opt-in), opacity and border-width. ★ marks the exact brand anchor. Type styles, shadows and easing curves are rendered live from the resolved tokens. Each brand section includes a <b>live component preview</b> — sample components rendered from the shared preview spec + <code>resolvePreview</code> (the same model the Figma plugin and web playground use), with a per-mode contrast overlay (L/D/HL/HD, green = passes its declared min). Each brand section ends with a <b>full taxonomy table</b> — every token with its complete path (filter by typing, click a path to copy). Regenerate with <code>npx tsx Prism3/engine/visualize.ts</code>.</p>
${html.join('\n')}
<script>
  // taxonomy filter — scoped to each brand section; opens groups while filtering
  document.querySelectorAll('.taxfilter').forEach(function(f){
    f.addEventListener('input', function(){
      var q = f.value.toLowerCase(), scope = f.closest('section');
      scope.querySelectorAll('.taxrow').forEach(function(r){
        r.style.display = r.querySelector('.taxpath').textContent.toLowerCase().indexOf(q) >= 0 ? '' : 'none';
      });
      if (q) scope.querySelectorAll('details.taxgroup').forEach(function(d){ d.open = true; });
    });
  });
  // click a path to copy it
  document.querySelectorAll('code.copy').forEach(function(c){
    c.addEventListener('click', function(){
      if (navigator.clipboard) navigator.clipboard.writeText(c.textContent);
      c.classList.add('copied'); setTimeout(function(){ c.classList.remove('copied'); }, 800);
    });
  });
</script>
</body></html>`;

writeFileSync(resolve(outDir, 'tokens.html'), page);
console.log(txt.join('\n'));
console.log(`\n[written] ${resolve(outDir, 'tokens.html')}`);
