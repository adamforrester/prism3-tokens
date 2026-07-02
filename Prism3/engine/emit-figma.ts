/**
 * emit-figma.ts — I/O shell: the DTCG token tree → a Figma import artifact (docs/10).
 *
 * This pass: the COLOUR axis — the `palette` primitives collection (one Default mode)
 * + the `color` semantics collection (four modes), every semantic a VARIABLE_ALIAS into
 * `palette`. Output matches the Token Press export shape frozen in
 * `fixtures/figma/nb/` (the regression target: reproduce NB, then generalize).
 *
 * The engine's DTCG carries the *semantic* facts (aliases, per-mode targets); the
 * *Figma-target rendering* lives HERE, not in the DTCG: role-family → scopes, the
 * name transform (strip namespace, dots→slashes; DTCG steps are already zero-padded),
 * and the per-mode alias resolution. Reads the pure `tree.ts` `buildTree`, so no engine
 * output is touched. Materialiser (the Figma-MCP thread) plays this artifact in; Figma
 * assigns the real variable ids and resolves aliases by name, so we emit no ids.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { Theme } from './theme';
import { nbTheme } from './nb-fixture';
import { buildTree, at } from './tree';

export type FigmaColor = { r: number; g: number; b: number; a: number };
export type FigmaVar = {
  name: string;
  resolvedType: 'COLOR';
  scopes: string[];
  description: string;
  value: FigmaColor;
  alias: { type: 'VARIABLE_ALIAS'; name: string } | null;
};
export type FigmaCollectionFile = { $collection: string; $mode: string; variables: FigmaVar[] };

export const COLOR_MODES = ['light', 'dark', 'hc-light', 'hc-dark'] as const;

// role family (first segment after `color`) → Figma variable scopes (docs/10 §3).
const COLOR_SCOPES: Record<string, string[]> = {
  background: ['FRAME_FILL', 'SHAPE_FILL'],
  scrim: ['FRAME_FILL', 'SHAPE_FILL'],
  foreground: ['FRAME_FILL', 'SHAPE_FILL', 'TEXT_FILL'],
  text: ['TEXT_FILL'],
  icon: ['FRAME_FILL', 'SHAPE_FILL', 'STROKE_COLOR'],
  action: ['FRAME_FILL', 'SHAPE_FILL', 'STROKE_COLOR'],
  border: ['STROKE_COLOR'],
};
const PALETTE_SCOPES = ['FRAME_FILL', 'SHAPE_FILL', 'TEXT_FILL', 'STROKE_COLOR'];

const stripNs = (dotted: string): string => dotted.replace(/^[^.]+\./, '');
/** `nbds.palette.red.550` → `palette/red/550`; `nbds.color.background.primary` →
 *  `color/background/primary`. DTCG step keys are already zero-padded (`050`, `025`)
 *  and alpha steps are unpadded (`black-alpha.60`), so this is a pure separator swap. */
export const figName = (dotted: string): string => stripNs(dotted).replace(/\./g, '/');

/** DTCG colour `$value` ("rgb(247, 229, 228)" / "rgba(0,0,0,0.6)" / "#f7e5e4") → Figma
 *  {r,g,b,a} 0–1. Figma stores colour as float32, so round each channel with fround. */
export const parseColor = (v: unknown): FigmaColor => {
  const s = String(v);
  const m = s.match(/rgba?\(([^)]+)\)/i);
  if (m) {
    const p = m[1].split(',').map((x) => parseFloat(x.trim()));
    return { r: Math.fround(p[0] / 255), g: Math.fround(p[1] / 255), b: Math.fround(p[2] / 255), a: Math.fround(p[3] ?? 1) };
  }
  const h = s.replace(/^#/, '');
  if (/^[0-9a-f]{6}$/i.test(h)) {
    return { r: Math.fround(parseInt(h.slice(0, 2), 16) / 255), g: Math.fround(parseInt(h.slice(2, 4), 16) / 255), b: Math.fround(parseInt(h.slice(4, 6), 16) / 255), a: 1 };
  }
  return { r: 0, g: 0, b: 0, a: 1 };
};

/** Every leaf under a subtree, as [dotted-path-from-tree-root, leaf]. */
const leaves = (node: any, prefix: string): Array<[string, any]> => {
  const out: Array<[string, any]> = [];
  for (const k in node) {
    if (k[0] === '$') continue;
    const child = node[k];
    if (child && child.$value !== undefined) out.push([`${prefix}.${k}`, child]);
    else if (child && typeof child === 'object') out.push(...leaves(child, `${prefix}.${k}`));
  }
  return out;
};

export const buildFigmaColor = (theme: Theme): { palette: FigmaCollectionFile; color: FigmaCollectionFile[] } => {
  const { tree } = buildTree(theme);
  const root = Object.keys(tree)[0];

  const palette: FigmaCollectionFile = {
    $collection: 'palette',
    $mode: 'Default',
    variables: leaves(tree[root].palette, `${root}.palette`).map(([dotted, leaf]) => ({
      name: figName(dotted),
      resolvedType: 'COLOR',
      scopes: PALETTE_SCOPES,
      description: '',
      value: parseColor(leaf.$value),
      alias: null,
    })),
  };

  const colLeaves = leaves(tree[root].color, `${root}.color`);
  const color: FigmaCollectionFile[] = COLOR_MODES.map((mode) => ({
    $collection: 'color',
    $mode: mode,
    variables: colLeaves.map(([dotted, leaf]) => {
      const family = stripNs(dotted).split('.')[1]; // color.<family>.…
      const ext = leaf.$extensions?.prism3 ?? {};
      const modeVal = mode === 'light' ? leaf.$value : ext.modes?.[mode]?.$value ?? leaf.$value;
      const targetDotted = String(modeVal).replace(/^\{|\}$/g, '');
      const targetLeaf = at(tree, targetDotted);
      return {
        name: figName(dotted),
        resolvedType: 'COLOR' as const,
        scopes: COLOR_SCOPES[family] ?? ['FRAME_FILL', 'SHAPE_FILL'],
        description: '',
        value: parseColor(targetLeaf?.$value),
        alias: { type: 'VARIABLE_ALIAS' as const, name: figName(targetDotted) },
      };
    }),
  }));

  return { palette, color };
};

// ---------------------------------------------------------------------- I/O
const here = dirname(fileURLToPath(import.meta.url));
const isMain = process.argv[1] ? resolve(process.argv[1]) === fileURLToPath(import.meta.url) : false;
if (isMain) {
  const brands: Array<{ id: string; theme: Theme }> = [{ id: 'nb', theme: nbTheme() }];
  for (const { id, theme } of brands) {
    const dir = resolve(here, 'out/figma', id);
    mkdirSync(dir, { recursive: true });
    const { palette, color } = buildFigmaColor(theme);
    writeFileSync(resolve(dir, 'palette.json'), JSON.stringify(palette, null, 2) + '\n');
    for (const c of color) writeFileSync(resolve(dir, `color.${c.$mode}.json`), JSON.stringify(c, null, 2) + '\n');
    console.log(`[figma] ${id}: palette ${palette.variables.length} + color ${color.length} modes × ${color[0].variables.length}`);
  }
}
