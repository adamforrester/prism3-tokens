/**
 * Prism3 engine — emit-figma COLOUR core (pure, node-free).
 *
 * The colour axis of the Figma materialisation adapter, split out of `emit-figma.ts` so it can
 * be bundled into contexts with NO filesystem — the Figma plugin main thread (#108) and the
 * browser. `emit-figma.ts` remains the full I/O-shell CLI (all axes + `out/figma/<brand>/`
 * writer) and re-exports everything here, so every existing `from './emit-figma'` importer and
 * the documented `npx tsx Prism3/engine/emit-figma.ts` entry are unchanged.
 *
 * This module holds:
 *   • the Figma variable types (`FigmaVar` / `FigmaCollectionFile` / `FigmaColor` …),
 *   • the shared pure helpers every axis uses (`figName` / `parseColor` / `desc` / `leaves` /
 *     `stripNs`) — defined ONCE here, imported back by the shell,
 *   • the colour scope maps + `buildFigmaColor(theme)` — the palette + color×N-modes builder.
 *
 * PURE — no `node:*`, no `figma.*`, no I/O. Depends only on the pure `theme`/`tree` core.
 */
import { Theme } from './theme';
import { buildTree, at } from './tree';

export type FigmaColor = { r: number; g: number; b: number; a: number };
export type FigmaVarValue = FigmaColor | number | string;
export type FigmaResolvedType = 'COLOR' | 'FLOAT' | 'STRING';
export type FigmaVar = {
  name: string;
  resolvedType: FigmaResolvedType;
  scopes: string[];
  description: string;
  value: FigmaVarValue;
  alias: { type: 'VARIABLE_ALIAS'; name: string } | null;
  /** Present + `true` only on ref-tier PRIMITIVE variables (palette, dimension,
   *  font/family, font/size, font/weight). (opacity is directly consumable — #79 —
   *  so it is NOT hidden.) Figma's official mechanism
   *  for "consumers of this file (as a library) shouldn't see this in the
   *  picker." Note the limitation: this only narrows the picker across a
   *  library-consumption boundary; in the file that DEFINES the primitives
   *  they still appear in the local picker (Figma has no scopes-based
   *  local-hide — see the module-level PRIMITIVE marker comment). Omitted on
   *  semantic-tier vars → JSON stays free of the noise field (semantic bytes
   *  are byte-identical to the pre-hide world modulo the new `description`s). */
  hiddenFromPublishing?: boolean;
};
export type FigmaCollectionFile = { $collection: string; $mode: string; variables: FigmaVar[] };

/** Read the DTCG leaf's $description into Figma's `description` field so
 *  designers see the source-of-truth prose in the Variables panel sidebar
 *  (`space.100 — 8px (1× 8px base)` etc.) without polluting the Figma name
 *  (which stays namespace-stripped per §3). */
export const desc = (leaf: any): string => String(leaf?.$description ?? '');

/** Ref-tier PRIMITIVE marker. `hiddenFromPublishing: true` is Figma's OFFICIAL
 *  mechanism for "consumers of this file (as a library) shouldn't pick this."
 *  Applied to palette + dimension + font/family + font/size + font/weight so
 *  cross-file library consumers only see the semantic + directly-consumable layer.
 *  (opacity is NOT hidden — #79 — it has no semantic layer to prefer, so it stays
 *  a visible, directly-consumable collection.)
 *
 *  LIMITATION worth naming: hidden-from-publishing only narrows the picker
 *  ACROSS a library-consumption boundary. In the file that DEFINES the
 *  primitives, they still show in the local picker. Figma DOES NOT expose a
 *  scopes-based way to hide a variable from local pickers — the enum is
 *  strictly typed per resolvedType (COLOR: ALL_FILLS/ALL_SCOPES/FRAME_FILL/
 *  SHAPE_FILL/TEXT_FILL/STROKE_COLOR/EFFECT_COLOR; FLOAT: TEXT_CONTENT/
 *  CORNER_RADIUS/WIDTH_HEIGHT/GAP/OPACITY/STROKE_FLOAT/EFFECT_FLOAT/FONT_*),
 *  and `scopes: []` behaves as ALL_SCOPES (probe-verified 2026-07-04:
 *  setBoundVariableForPaint succeeds on a var with scopes=[]). So a bogus
 *  non-matching scope like TEXT_CONTENT would be rejected by the API
 *  ("Invalid scope for this variable type") — there is no path to a
 *  local-picker hide. The production discipline: publish tokens as a
 *  library, author components in a separate consumer file, and
 *  hidden-from-publishing narrows the picker end-to-end. Definer-file
 *  authoring accepts primitive visibility as the trade. */

/** The canonical, ordered set of appearance modes emit-figma can produce. A
 *  given brand may opt out of `dark`/`hc-*` via `BrandInput.modes` — the
 *  adapter iterates the intersection of THIS list and `theme.modes`, so a
 *  light-only brand emits only `color.light.json` (not four files with dark
 *  values silently falling back to light). Canonical order is preserved
 *  regardless of the order the user typed modes into their brief.
 *  `wireframe` (docs/11 Pillar 1b, #48) is an opt-in generated greyscale
 *  mode — every chromatic role's `$extensions.prism3.modes.wireframe.$value`
 *  aliases a neutral step, so the color axis emits `color.wireframe.json`
 *  automatically for any brand that opts in. Canonical position is last
 *  (after hc-dark) so file order stays deterministic; the default four
 *  brands don't include it → their output is byte-identical. */
export const COLOR_MODES = ['light', 'dark', 'hc-light', 'hc-dark', 'wireframe'] as const;

// role family (first segment after `color`) → Figma variable scopes (docs/10 §3).
const COLOR_SCOPES: Record<string, string[]> = {
  background: ['FRAME_FILL', 'SHAPE_FILL'],
  scrim: ['FRAME_FILL', 'SHAPE_FILL'],
  foreground: ['FRAME_FILL', 'SHAPE_FILL', 'TEXT_FILL'],
  text: ['TEXT_FILL'],
  icon: ['FRAME_FILL', 'SHAPE_FILL', 'STROKE_COLOR'],
  border: ['STROKE_COLOR'],
};
// `interactive.<color>.<slot>` (docs/20) is scoped by its SLOT, not the family —
// fill/on-fill paint, text inks, border strokes, icon glyphs each want a
// different picker context. Falls back to fill scopes for an unknown slot.
const INTERACTIVE_SLOT_SCOPES: Record<string, string[]> = {
  fill: ['FRAME_FILL', 'SHAPE_FILL'],
  'on-fill': ['FRAME_FILL', 'SHAPE_FILL', 'TEXT_FILL'],
  text: ['TEXT_FILL'],
  border: ['STROKE_COLOR'],
  icon: ['FRAME_FILL', 'SHAPE_FILL', 'STROKE_COLOR'],
  overlay: ['FRAME_FILL', 'SHAPE_FILL'], // a translucent wash painted over a surface
};
// `disabled.<slot>` (docs/20) is also slot-scoped — the same picker-context reasoning
// as interactive. Without this map the family fell through to fill scopes, so
// text/icon/border miscased. `on-fill` = label/icon on a disabled fill,
// mirrors interactive `on-fill`.
const DISABLED_SLOT_SCOPES: Record<string, string[]> = {
  fill: ['FRAME_FILL', 'SHAPE_FILL'],
  'on-fill': ['FRAME_FILL', 'SHAPE_FILL', 'TEXT_FILL'],
  text: ['TEXT_FILL'],
  icon: ['FRAME_FILL', 'SHAPE_FILL', 'STROKE_COLOR'],
  border: ['STROKE_COLOR'],
};
// `field.<slot>` (docs/20 §17) — form-element chrome, scoped by slot: the field fill paints,
// the resting border strokes, the placeholder is text.
const FIELD_SLOT_SCOPES: Record<string, string[]> = {
  fill: ['FRAME_FILL', 'SHAPE_FILL'],
  border: ['STROKE_COLOR'],
  placeholder: ['TEXT_FILL'],
};

// color.<family>.… → scopes. `interactive` defers to its slot (segment[3]),
// `disabled` / `field` to their slot (segment[2]).
const colorScopes = (dotted: string): string[] => {
  const seg = stripNs(dotted).split('.'); // ['color', family, …]
  if (seg[1] === 'interactive') return INTERACTIVE_SLOT_SCOPES[seg[3]] ?? INTERACTIVE_SLOT_SCOPES.fill;
  if (seg[1] === 'disabled') return DISABLED_SLOT_SCOPES[seg[2]] ?? ['FRAME_FILL', 'SHAPE_FILL'];
  if (seg[1] === 'field') return FIELD_SLOT_SCOPES[seg[2]] ?? ['FRAME_FILL', 'SHAPE_FILL'];
  return COLOR_SCOPES[seg[1]] ?? ['FRAME_FILL', 'SHAPE_FILL'];
};
const PALETTE_SCOPES = ['FRAME_FILL', 'SHAPE_FILL', 'TEXT_FILL', 'STROKE_COLOR'];

export const stripNs = (dotted: string): string => dotted.replace(/^[^.]+\./, '');
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
  let h = s.replace(/^#/, '').toLowerCase();
  if (/^[0-9a-f]{3}$/.test(h)) h = h.split('').map((c) => c + c).join('');   // #f00 → ff0000 (M-08)
  const byte = (i: number) => Math.fround(parseInt(h.slice(i, i + 2), 16) / 255);
  if (/^[0-9a-f]{6}$/.test(h)) return { r: byte(0), g: byte(2), b: byte(4), a: 1 };
  if (/^[0-9a-f]{8}$/.test(h)) return { r: byte(0), g: byte(2), b: byte(4), a: byte(6) }; // #RRGGBBAA
  // M-08: loud-fail instead of a silent {0,0,0,1}. An unresolvable alias target
  // (`parseColor(undefined)`) or a malformed colour would otherwise ship as a BLACK
  // swatch carrying a dangling alias — exactly the silent degradation the emitter must not do.
  throw new Error(`emit-figma parseColor: cannot parse colour '${s}' — expected #hex (3/6/8) or rgb()/rgba(); an unresolved alias or malformed value reached the emitter`);
};

/** Every leaf under a subtree, as [dotted-path-from-tree-root, leaf]. */
export const leaves = (node: any, prefix: string): Array<[string, any]> => {
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
    $collection: 'core-palette',
    $mode: 'Default',
    // Palette primitives are REF TIER — designers should reach for `color/*`
    // semantics that alias these steps, not the raw palette. Set
    // `hiddenFromPublishing: true` so consumers of this file as a library
    // don't see them in the picker; the local picker in the definer file
    // still shows them (Figma has no scopes-based local-hide — see the
    // module-level PRIMITIVE marker comment for the API limitation).
    // Scopes stay at the four colour fill/stroke targets so, if a component
    // author does need to bind a raw primitive for a bespoke case, the
    // picker guidance is still correct per role family.
    variables: leaves(tree[root].palette, `${root}.palette`).map(([dotted, leaf]) => ({
      name: figName(dotted),
      resolvedType: 'COLOR',
      scopes: PALETTE_SCOPES,
      description: desc(leaf),
      value: parseColor(leaf.$value),
      alias: null,
      hiddenFromPublishing: true,
    })),
  };

  const colLeaves = leaves(tree[root].color, `${root}.color`);
  // Iterate only the modes THIS brand ships (respects BrandInput.modes opt-out — Pillar 1a).
  // Canonical order: the built-ins in their fixed COLOR_MODES order first, then any user-added
  // custom modes (C1 — the modes in theme.modes that aren't built-ins) in declaration order. For a
  // brand with NO custom modes this is byte-identical to the old fixed-list filter.
  const builtinModes = COLOR_MODES.filter((m) => theme.modes.includes(m));
  const customModes = theme.modes.filter((m) => !(COLOR_MODES as readonly string[]).includes(m));
  const emittedModes = [...builtinModes, ...customModes];
  const color: FigmaCollectionFile[] = emittedModes.map((mode) => ({
    $collection: 'color',
    $mode: mode,
    variables: colLeaves.map(([dotted, leaf]) => {
      const ext = leaf.$extensions?.prism3 ?? {};
      const modeVal = mode === 'light' ? leaf.$value : ext.modes?.[mode]?.$value ?? leaf.$value;
      const targetDotted = String(modeVal).replace(/^\{|\}$/g, '');
      const targetLeaf = at(tree, targetDotted);
      return {
        name: figName(dotted),
        resolvedType: 'COLOR' as const,
        scopes: colorScopes(dotted),
        description: desc(leaf),
        value: parseColor(targetLeaf?.$value),
        alias: { type: 'VARIABLE_ALIAS' as const, name: figName(targetDotted) },
      };
    }),
  }));

  return { palette, color };
};
