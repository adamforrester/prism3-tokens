/**
 * Prism3 engine — token visualiser.
 *
 * Reads the emitted DTCG files (out/*.tokens.json) and renders a single
 * self-contained HTML page: colour swatches per palette, the per-mode semantic
 * roles (with their resolved colour + contrast), and the dimension axis (grid /
 * space / radius) as visual previews. No dependencies, no network — open the
 * file in any browser. Also prints a plain-text taxonomy to stdout.
 *
 *   npx tsx Prism3/engine/visualize.ts   # writes out/tokens.html
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(here, 'out');

type Node = any;
const isToken = (n: Node) => n && typeof n === 'object' && n.$type !== undefined;

/** Resolve a dotted token path to its node. */
const at = (tree: Node, path: string): Node => path.split('.').reduce((n, s) => n?.[s], tree);

/** Follow `{alias}` chains to the concrete token. */
const deref = (tree: Node, node: Node): Node => {
  let cur = node, guard = 0;
  while (cur && typeof cur.$value === 'string' && /^\{.+\}$/.test(cur.$value) && guard++ < 10) {
    cur = at(tree, cur.$value.slice(1, -1));
  }
  return cur;
};

const hexOf = (tree: Node, node: Node): string => {
  const t = deref(tree, node);
  return t?.$extensions?.prism3?.hex ?? (typeof t?.$value === 'string' && t.$value.startsWith('#') ? t.$value : '#000');
};
const pxOf = (tree: Node, node: Node): number => {
  const t = deref(tree, node);
  return parseInt(String(t?.$value).replace('px', ''), 10) || 0;
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
const brands = [load('nb', 'nbds'), load('aurora', 'prism')];
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
  const palettes = Object.keys(data.color).filter((k) => k !== 'white' && k !== 'black');
  for (const pal of palettes) {
    const steps = STEP_ORDER(Object.keys(data.color[pal]));
    txt.push(`\n  ${pal}`);
    html.push(`<div class="palette"><div class="plabel">${pal}</div><div class="ramp">`);
    for (const k of steps) {
      const node = data.color[pal][k];
      const hex = hexOf(tree, node);
      const anchor = node.$extensions?.prism3?.anchor;
      txt.push(`    ${(pal + '.' + k).padEnd(18)} ${hex}${anchor ? '   ← brand anchor' : ''}`);
      html.push(`<div class="sw" style="background:${hex};color:${textOn(hex)}" title="${pal}.${k} ${hex}"><span>${k}${anchor ? ' ★' : ''}</span><small>${hex}</small></div>`);
    }
    html.push('</div></div>');
  }

  // ---- semantic colour per mode ----
  txt.push('\n— SEMANTIC COLOUR (per mode) —');
  html.push('<h3>Semantic roles <span class="muted">(resolved per mode)</span></h3>');
  const modes = Object.keys(data.semantic);
  const roleKeys: string[] = [];
  for (const g of Object.keys(data.semantic[modes[0]])) for (const n of Object.keys(data.semantic[modes[0]][g])) roleKeys.push(`${g}.${n}`);
  // text table
  html.push('<table class="sem"><thead><tr><th>role</th>' + modes.map((m) => `<th>${m}</th>`).join('') + '</tr></thead><tbody>');
  for (const rk of roleKeys) {
    const [g, n] = rk.split('.');
    txt.push(`\n  ${rk}`);
    html.push(`<tr><td class="rk">${rk}</td>`);
    for (const m of modes) {
      const node = data.semantic[m][g][n];
      const hex = hexOf(tree, node);
      const tgt = aliasTarget(node).replace(`${root}.color.`, '');
      const ratio = node.$extensions?.prism3?.contrast;
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
  .scell{display:flex;flex-direction:column;align-items:center;gap:6px;font-size:11px;color:#6b7280}
  .control{box-sizing:border-box;min-width:64px;background:#2a2e37;border:1px solid #3a3f4a;border-radius:6px;display:flex;align-items:center;justify-content:center}
  .ctext{background:#4f8cff33;border:1px solid #4f8cff;color:#cdd9ff;border-radius:3px;font-size:11px;font-weight:600;padding:1px 8px;height:100%;display:flex;align-items:center}
</style></head><body>
<h1>Prism3 — generated token taxonomy</h1>
<p class="lead">Every value below is engine-generated from a small theme input and read back from the emitted DTCG files (<code>out/*.tokens.json</code>). ★ marks the exact brand anchor. Regenerate with <code>npx tsx Prism3/engine/visualize.ts</code>.</p>
${html.join('\n')}
</body></html>`;

writeFileSync(resolve(outDir, 'tokens.html'), page);
console.log(txt.join('\n'));
console.log(`\n[written] ${resolve(outDir, 'tokens.html')}`);
