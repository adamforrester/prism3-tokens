/**
 * Prism3 engine — DTCG emit.
 *
 * Emits a W3C Design Tokens tree per theme, in that theme's dialect:
 *  - NB regression  -> nbds.* / rgb()  (byte-comparable to the real NB tokens)
 *  - Prism product  -> prism.* / hex    (DTCG-standard, Style-Dictionary-safe)
 *
 * Two axes: colour (primitive ramps + per-mode semantic aliases) and dimension
 * (a primitive grid + space/radius semantics that alias into it). Each primitive
 * leaf carries engine provenance under $extensions.prism3. The run validates
 * every alias resolves and every mode contrast contract holds. Run:
 *   npx tsx Prism3/engine/emit-dtcg.ts
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { RGB, contrast, hex } from './color';
import { Step } from './ramp';
import { Theme, nbTheme, brandTheme, BrandInput } from './theme';
import { resolveAllModes, ModeResult } from './modes';

const here = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(here, 'out');
mkdirSync(outDir, { recursive: true });

const WHITE: RGB = { r: 255, g: 255, b: 255 };
const BLACK: RGB = { r: 0, g: 0, b: 0 };
const round = (n: number, d = 4) => Math.round(n * 10 ** d) / 10 ** d;
const rgbStr = ({ r, g, b }: RGB) => `rgb(${r}, ${g}, ${b})`;
const colorValue = (rgb: RGB, fmt: 'rgb' | 'hex') => (fmt === 'hex' ? hex(rgb) : rgbStr(rgb));

const bandName: Record<string, string> = {
  Highlights: 'Highlight', Quarter: 'Quarter-Tone', Mid: 'Mid-Tone',
  ThreeQuarter: 'Three-Quarter-Tone', Shadows: 'Shadow',
};

type Token = { $type: 'color' | 'dimension'; $value: string; $description: string; $extensions: { prism3: Record<string, unknown> } };

// ---- colour leaves ----
const primitiveLeaf = (theme: Theme, paletteDesc: string, s: Step, isAnchor: boolean): Token => {
  const role = isAnchor ? 'brand anchor (exact, pinned)' : s.num === 500 ? 'mid-tone AA pivot (≥4.5:1 on white & black)' : bandName[s.band];
  return {
    $type: 'color', $value: colorValue(s.rgb, theme.colorFormat),
    $description: `${paletteDesc} ${s.key} — ${bandName[s.band]} band — ${role}`,
    $extensions: { prism3: { generated: true, source: 'oklch', oklch: { l: round(s.oklch.l), c: round(s.oklch.c), h: round(s.oklch.h, 2) }, hex: s.hex, band: s.band, anchor: isAnchor, contrastOnWhite: contrast(s.rgb, WHITE) } },
  };
};
const baseLeaf = (theme: Theme, rgb: RGB, description: string, band: string): Token => ({
  $type: 'color', $value: colorValue(rgb, theme.colorFormat), $description: description,
  $extensions: { prism3: { generated: true, source: 'oklch', hex: hex(rgb), band } },
});
const aliasLeaf = (path: string, description: string, extra: Record<string, unknown>): Token => ({
  $type: 'color', $value: `{${path}}`, $description: description,
  $extensions: { prism3: { role: 'semantic', aliasOf: path, ...extra } },
});

// ---- dimension leaves ----
const dimLeaf = (px: number, description?: string): Token => ({
  $type: 'dimension', $value: `${px}px`, $description: description ?? `${px}px — dimension primitive`,
  $extensions: { prism3: { generated: true, px } },
});
const dimAlias = (path: string, description: string, extra: Record<string, unknown>): Token => ({
  $type: 'dimension', $value: `{${path}}`, $description: description,
  $extensions: { prism3: { role: 'semantic', aliasOf: path, ...extra } },
});

type Stats = {
  colorLeaves: number; dimLeaves: number; spaceTokens: number; radiusTokens: number;
  aliases: number; resolved: number; modeChecks: number; modePass: number; broken: { path: string; ref: string }[];
};

const buildTree = (theme: Theme): { tree: any; modes: ModeResult[]; stats: Stats } => {
  const root = theme.root;

  // ---- colour primitives ----
  const color: Record<string, any> = {
    white: baseLeaf(theme, WHITE, 'Pure white — Highlight base / default surface', 'Highlights'),
    black: baseLeaf(theme, BLACK, 'Pure black — Shadow base', 'Shadows'),
  };
  const brandPalette = theme.roleToPalette.brand;
  const brandAnchorStep = theme.roleAnchorStep.brand;
  for (const p of theme.palettes) {
    const node: Record<string, Token> = {};
    for (const s of p.steps) node[s.key] = primitiveLeaf(theme, p.description, s, p.palette === brandPalette && s.num === brandAnchorStep);
    color[p.palette] = node;
  }

  // ---- colour semantic layer (per mode) ----
  const modes = resolveAllModes(theme);
  const semantic: Record<string, any> = {};
  for (const mr of modes) {
    const modeTree: Record<string, any> = {};
    for (const [roleKey, r] of Object.entries(mr.roles)) {
      const [group, name] = roleKey.split('.');
      (modeTree[group] ??= {})[name] = aliasLeaf(r.path, r.description, { mode: mr.mode, contrast: r.ratio, against: r.against, ...(r.min > 0 ? { min: r.min } : {}) });
    }
    semantic[mr.mode] = modeTree;
  }

  // ---- dimension axis (grid primitives + space/radius semantics) ----
  const gridSet = new Set(theme.dims.grid);
  const dimension: Record<string, Token> = {};
  for (const px of theme.dims.grid) dimension[String(px)] = dimLeaf(px);
  const space: Record<string, Token> = {};
  for (const s of theme.dims.space) space[s.name] = dimAlias(`${root}.dimension.${s.px}`, `space ${s.name} — ${s.px}px (density: ${theme.dims.density})`, { px: s.px, density: theme.dims.density });
  const radius: Record<string, Token> = {};
  for (const r of theme.dims.radius) {
    radius[r.name] = gridSet.has(r.px)
      ? dimAlias(`${root}.dimension.${r.px}`, `radius ${r.name} — ${r.px}px${r.pill ? ' (pill)' : ''}`, { px: r.px, radiusScale: theme.dims.radiusScaleValue })
      : dimLeaf(r.px, `radius ${r.name} — ${r.px}px (off-grid literal)`);
  }

  // ---- assemble under the brand root ----
  const brand = { color, semantic, dimension, space, radius };
  const tree = {
    [root]: brand,
    $extensions: {
      generator: { name: 'Prism3 engine', method: 'OKLCH colour + grid-derived dimension generation' },
      prism3: { theme: theme.id, root, colorFormat: theme.colorFormat, decisions: theme.notes },
    },
  };

  // ---- validate aliases + count ----
  const resolvePath = (path: string): boolean => {
    let node: any = tree;
    for (const seg of path.split('.')) { node = node?.[seg]; if (node === undefined) return false; }
    return node && node.$type !== undefined;
  };
  const aliases: { path: string; ref: string }[] = [];
  const walk = (node: any, path: string[]) => {
    if (node && typeof node === 'object') {
      if (node.$type !== undefined) {
        const m = typeof node.$value === 'string' && node.$value.match(/^\{(.+)\}$/);
        if (m) aliases.push({ path: path.join('.'), ref: m[1] });
        return;
      }
      for (const [k, v] of Object.entries(node)) if (!k.startsWith('$')) walk(v, [...path, k]);
    }
  };
  walk(brand, [root]);
  const broken = aliases.filter((a) => !resolvePath(a.ref));

  let modeChecks = 0, modePass = 0;
  for (const mr of modes) for (const r of Object.values(mr.roles)) if (r.min > 0) { modeChecks++; if (r.ratio >= r.min) modePass++; }

  const colorLeaves = 2 + theme.palettes.reduce((n, p) => n + p.steps.length, 0);
  return { tree, modes, stats: { colorLeaves, dimLeaves: theme.dims.grid.length, spaceTokens: theme.dims.space.length, radiusTokens: theme.dims.radius.length, aliases: aliases.length, resolved: aliases.length - broken.length, broken, modeChecks, modePass } };
};

// ---------------------------------------------------------------------------
// Aurora: an indigo/violet brand (deliberately NOT red) with a DIFFERENT form
// factor from NB — soft corners (radius scale 2) and compact density — to
// exercise the dimension levers, not just colour.
const aurora: BrandInput = {
  id: 'aurora',
  primary: { l: 0.5, c: 0.18, h: 285 },
  neutral: { hue: 285, chroma: 0.008 },
  radiusScale: 2,
  density: 'compact',
};

const themes: Theme[] = [nbTheme(), brandTheme(aurora)];
const md: string[] = ['# Prism3 modes & scales — generated mappings, contrast contracts, dimension axis', ''];
let ok = true;

for (const theme of themes) {
  const { tree, modes, stats } = buildTree(theme);
  const outPath = resolve(outDir, `${theme.id}.tokens.json`);
  writeFileSync(outPath, JSON.stringify(tree, null, 2) + '\n');

  console.log(`\n[${theme.id}] ${theme.root}.* / ${theme.colorFormat}`);
  for (const n of theme.notes) console.log(`   · ${n}`);
  console.log(`  colour: ${stats.colorLeaves} leaves, palettes ${theme.palettes.map((p) => p.palette).join(', ')} (danger ← ${theme.roleToPalette.danger})`);
  console.log(`  dimension: ${stats.dimLeaves} grid primitives, ${stats.spaceTokens} space + ${stats.radiusTokens} radius semantics`);
  console.log(`    space (${theme.dims.density}): ${theme.dims.space.map((s) => `${s.name}=${s.px}`).join(' ')}`);
  console.log(`    radius (scale ${theme.dims.radiusScaleValue}): ${theme.dims.radius.map((r) => `${r.name}=${r.px}`).join(' ')}`);
  console.log(`  aliases: ${stats.resolved}/${stats.aliases} resolve | mode contracts: ${stats.modePass}/${stats.modeChecks} pass`);
  console.log(`  [written] ${outPath}`);
  if (stats.broken.length) { ok = false; stats.broken.forEach((b) => console.log(`   ❌ ${b.path} -> {${b.ref}}`)); }
  if (stats.modePass < stats.modeChecks) ok = false;

  md.push(`# Theme: ${theme.id} (${theme.root}.* / ${theme.colorFormat})`, '');
  for (const n of theme.notes) md.push(`- ${n}`);
  md.push('', `Palettes: ${theme.palettes.map((p) => p.palette).join(', ')}. Danger draws from \`${theme.roleToPalette.danger}\`.`, '');
  for (const mr of modes) {
    md.push(`## ${theme.id} — colour mode: ${mr.mode}`, '', '| role | → step | contrast | floor | result |', '|---|---|---|---|---|');
    for (const [roleKey, r] of Object.entries(mr.roles)) {
      const checked = r.min > 0, pass = !checked || r.ratio >= r.min;
      md.push(`| ${roleKey} | ${r.path.replace(theme.namespace + '.', '')} | ${checked ? r.ratio.toFixed(2) : '—'} | ${checked ? r.min : '—'} | ${checked ? (pass ? '✅' : '❌') : '·'} |`);
    }
    md.push('');
  }
  md.push(`## ${theme.id} — dimension axis`, '', `Grid (${stats.dimLeaves} primitives, px): ${theme.dims.grid.join(', ')}`, '');
  md.push(`Space — density \`${theme.dims.density}\`:`, '', '| token | px | × base |', '|---|---|---|');
  for (const s of theme.dims.space) md.push(`| space.${s.name} | ${s.px} | ${s.mult} |`);
  md.push('', `Radius — scale \`${theme.dims.radiusScaleValue}\`:`, '', '| token | px |', '|---|---|');
  for (const r of theme.dims.radius) md.push(`| radius.${r.name} | ${r.px}${r.pill ? ' (pill)' : ''} |`);
  md.push('');
}

writeFileSync(resolve(here, 'modes-report.md'), md.join('\n') + '\n');
console.log(`\n[written] ${resolve(here, 'modes-report.md')}`);
if (!ok) process.exitCode = 1;
