/**
 * Prism3 engine — DTCG emit.
 *
 * Emits a W3C Design Tokens tree per theme, in that theme's dialect:
 *  - NB regression  -> nbds.color / rgb()  (byte-comparable to the real NB tokens)
 *  - Prism product  -> prism.color / hex   (DTCG-standard, Style-Dictionary-safe)
 *
 * Each primitive leaf carries engine provenance under $extensions.prism3 (OKLCH
 * source, hex, tonal band, anchor flag, contrast). A per-mode semantic layer
 * (light/dark/hc-light/hc-dark) maps the contract roles to primitive steps via
 * DTCG brace aliases; the run validates every alias resolves and every mode
 * contrast contract holds. Run:  npx tsx Prism3/engine/emit-dtcg.ts
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { RGB, contrast, hex } from './color';
import { bandOf, Step } from './ramp';
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

type Leaf = { $type: 'color'; $value: string; $description: string; $extensions: { prism3: Record<string, unknown> } };

const primitiveLeaf = (theme: Theme, paletteDesc: string, s: Step, isAnchor: boolean): Leaf => {
  const role = isAnchor ? 'brand anchor (exact, pinned)' : s.num === 500 ? 'mid-tone AA pivot (≥4.5:1 on white & black)' : bandName[s.band];
  return {
    $type: 'color',
    $value: colorValue(s.rgb, theme.colorFormat),
    $description: `${paletteDesc} ${s.key} — ${bandName[s.band]} band — ${role}`,
    $extensions: {
      prism3: {
        generated: true, source: 'oklch',
        oklch: { l: round(s.oklch.l), c: round(s.oklch.c), h: round(s.oklch.h, 2) },
        hex: s.hex, band: s.band, anchor: isAnchor, contrastOnWhite: contrast(s.rgb, WHITE),
      },
    },
  };
};

const baseLeaf = (theme: Theme, rgb: RGB, description: string, band: string): Leaf => ({
  $type: 'color', $value: colorValue(rgb, theme.colorFormat), $description: description,
  $extensions: { prism3: { generated: true, source: 'oklch', hex: hex(rgb), band } },
});

const aliasLeaf = (path: string, description: string, extra: Record<string, unknown>): Leaf => ({
  $type: 'color', $value: `{${path}}`, $description: description,
  $extensions: { prism3: { role: 'semantic', aliasOf: path, ...extra } },
});

type Stats = { leaves: number; aliases: number; resolved: number; modeChecks: number; modePass: number; broken: { path: string; ref: string }[] };

const buildTree = (theme: Theme): { tree: any; modes: ModeResult[]; stats: Stats } => {
  // ---- primitives ----
  const color: Record<string, any> = {
    white: baseLeaf(theme, WHITE, 'Pure white — Highlight base / default surface', 'Highlights'),
    black: baseLeaf(theme, BLACK, 'Pure black — Shadow base', 'Shadows'),
  };
  const brandAnchorStep = theme.roleAnchorStep.brand;
  const brandPalette = theme.roleToPalette.brand;
  for (const p of theme.palettes) {
    const node: Record<string, Leaf> = {};
    for (const s of p.steps) {
      const isAnchor = p.palette === brandPalette && s.num === brandAnchorStep;
      node[s.key] = primitiveLeaf(theme, p.description, s, isAnchor);
    }
    color[p.palette] = node;
  }

  // ---- semantic layer, one mapping per mode ----
  const modes = resolveAllModes(theme);
  const semantic: Record<string, any> = {};
  for (const mr of modes) {
    const modeTree: Record<string, any> = {};
    for (const [roleKey, r] of Object.entries(mr.roles)) {
      const [group, name] = roleKey.split('.');
      (modeTree[group] ??= {})[name] = aliasLeaf(r.path, r.description, {
        mode: mr.mode, contrast: r.ratio, against: r.against, ...(r.min > 0 ? { min: r.min } : {}),
      });
    }
    semantic[mr.mode] = modeTree;
  }

  // namespace -> nested object (e.g. 'prism.color' -> { prism: { color: {...} } })
  const segs = theme.namespace.split('.');
  const root: any = {};
  let cursor = root;
  segs.forEach((seg, i) => { cursor[seg] = i === segs.length - 1 ? color : {}; if (i < segs.length - 1) cursor = cursor[seg]; });
  // semantic lives as a sibling of `color` under the same parent
  let parent = root;
  for (let i = 0; i < segs.length - 1; i++) parent = parent[segs[i]];
  parent.semantic = semantic;

  const tree = {
    ...root,
    $extensions: {
      generator: { name: 'Prism3 engine', method: 'OKLCH generation from theme schema' },
      prism3: { theme: theme.id, namespace: theme.namespace, colorFormat: theme.colorFormat, decisions: theme.notes },
    },
  };

  // ---- validate aliases + count ----
  const resolvePath = (path: string): boolean => {
    let node: any = tree;
    for (const seg of path.split('.')) { node = node?.[seg]; if (node === undefined) return false; }
    return node && node.$type === 'color';
  };
  const aliases: { path: string; ref: string }[] = [];
  let leaves = 0;
  const walk = (node: any, path: string[]) => {
    if (node && typeof node === 'object') {
      if (node.$type === 'color') {
        leaves++;
        const m = typeof node.$value === 'string' && node.$value.match(/^\{(.+)\}$/);
        if (m) aliases.push({ path: path.join('.'), ref: m[1] });
        return;
      }
      for (const [k, v] of Object.entries(node)) if (!k.startsWith('$')) walk(v, [...path, k]);
    }
  };
  walk(parent, segs.slice(0, -1)); // walk from the root namespace parent
  const broken = aliases.filter((a) => !resolvePath(a.ref));

  let modeChecks = 0, modePass = 0;
  for (const mr of modes) for (const r of Object.values(mr.roles)) if (r.min > 0) { modeChecks++; if (r.ratio >= r.min) modePass++; }

  return { tree, modes, stats: { leaves, aliases: aliases.length, resolved: aliases.length - broken.length, broken, modeChecks, modePass } };
};

// ---------------------------------------------------------------------------
const aurora: BrandInput = {
  id: 'aurora',
  primary: { l: 0.5, c: 0.18, h: 285 }, // an indigo/violet brand — deliberately NOT red
  neutral: { hue: 285, chroma: 0.008 },
};

const themes: Theme[] = [nbTheme(), brandTheme(aurora)];
const md: string[] = ['# Prism3 modes — generated semantic mappings & contrast contracts', ''];
let ok = true;

for (const theme of themes) {
  const { tree, modes, stats } = buildTree(theme);
  const outPath = resolve(outDir, `${theme.id}.tokens.json`);
  writeFileSync(outPath, JSON.stringify(tree, null, 2) + '\n');

  console.log(`\n[${theme.id}] ${theme.namespace} / ${theme.colorFormat}`);
  for (const n of theme.notes) console.log(`   · ${n}`);
  console.log(`  palettes: ${theme.palettes.map((p) => p.palette).join(', ')}  (danger ← ${theme.roleToPalette.danger})`);
  console.log(`  color leaves: ${stats.leaves}`);
  console.log(`  semantic aliases: ${stats.resolved}/${stats.aliases} resolve`);
  console.log(`  mode contrast contracts: ${stats.modePass}/${stats.modeChecks} pass`);
  console.log(`  [written] ${outPath}`);
  if (stats.broken.length) { ok = false; stats.broken.forEach((b) => console.log(`   ❌ ${b.path} -> {${b.ref}}`)); }
  if (stats.modePass < stats.modeChecks) ok = false;

  md.push(`# Theme: ${theme.id} (${theme.namespace} / ${theme.colorFormat})`, '');
  for (const n of theme.notes) md.push(`- ${n}`);
  md.push('', `Palettes: ${theme.palettes.map((p) => p.palette).join(', ')}. Danger draws from \`${theme.roleToPalette.danger}\`.`, '');
  for (const mr of modes) {
    md.push(`## ${theme.id} — ${mr.mode}`, '', '| role | → step | contrast | floor | result |', '|---|---|---|---|---|');
    for (const [roleKey, r] of Object.entries(mr.roles)) {
      const checked = r.min > 0, pass = !checked || r.ratio >= r.min;
      md.push(`| ${roleKey} | ${r.path.replace(theme.namespace + '.', '')} | ${checked ? r.ratio.toFixed(2) : '—'} | ${checked ? r.min : '—'} | ${checked ? (pass ? '✅' : '❌') : '·'} |`);
    }
    md.push('');
  }
}

writeFileSync(resolve(here, 'modes-report.md'), md.join('\n') + '\n');
console.log(`\n[written] ${resolve(here, 'modes-report.md')}`);
if (!ok) process.exitCode = 1;
