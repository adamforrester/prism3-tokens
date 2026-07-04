/**
 * emit-figma.ts — I/O shell: the DTCG token tree → a Figma import artifact (docs/10).
 *
 * Axes shipped:
 *   • COLOUR — `palette` primitives (Default mode) + `color` semantics (4 modes),
 *     every semantic a VARIABLE_ALIAS into `palette`. Byte-reproduces
 *     `fixtures/figma/nb/{palette,color.<mode>}.json`.
 *   • TYPOGRAPHY — `font` primitives (family STRING + size/weight FLOAT + weight-role
 *     FLOAT aliased) + `font-fluid` (per-mode FLOATs for the fluid composites) +
 *     text styles for every composite, applying the six §4 fixes: (1) no wrapper
 *     `text/` prefix; (2) prescribed collection names (`font`, `font-fluid`);
 *     (3a) lineHeight baked as PERCENT (unitless × 100 — mode/size-independent);
 *     (3b) letterSpacing baked as PERCENT (em × 100 — this PR bakes; a follow-up
 *     lands bindable tracking FLOATs); (4) primary family bound + full stack in
 *     description; (5) fontStyle derived from the weight-role via a named-instance
 *     table (mono falls back for weights it lacks).
 *   • DIMS — the whole geometric layer emitted as SEVEN FLOAT collections:
 *     `dimension` (fine-grid primitives), `space`/`radius`/`size`/`border-width`/
 *     `focus` (all aliased into `dimension` — the primitives are shared) + `opacity`
 *     (0–100 percent for Figma OPACITY scope, converted from the DTCG 0–1). No
 *     fixtures for this axis (§2 covers colour + typography only), so the gate is
 *     structural: counts match the DTCG tree, every alias target resolves within
 *     the emitted collections, scopes/resolvedType consistent per family.
 *     `focus.ring.style` (`strokeStyle: 'solid'`) is skipped — Figma has no
 *     `strokeStyle` variable primitive; it stays a code-side literal.
 *   • LAYOUT — one `layout` variable collection with FIVE breakpoint modes
 *     (`sm`/`md`/`lg`/`xl`/`2xl`). Each mode carries the same variable names
 *     (`breakpoint/*`, `grid/columns`, `grid/gutter`, `grid/margin`,
 *     `container/max`, `container/narrow`) with different values/aliases per
 *     mode; gutter/margin per-mode alias into `space/*`. Composes independently
 *     with the colour light/dark collection: `mode` here is the *viewport*,
 *     over there it's the *theme*. `container/fluid` (100%) skipped — no Figma
 *     variable primitive for percentage-of-parent.
 *   • SHADOW + GRADIENT — Effect Styles + Paint Styles (not variables — docs/08
 *     §5 variable-type ceiling). Shadow emits TWO style sets per step (light in
 *     `shadow/*`, dark in `shadow-dark/*`) because Figma Effect Styles don't
 *     support modes — a plugin/component swaps the pair by mode. Gradient emits
 *     Paint Styles for brands that opt in (empty for NB, populated for Aurora).
 *     Only stop COLOURS bind to palette variables; kind/angle/positions bake
 *     into the style. `sampledStops` (5-point sRGB pre-sample of the OKLCH
 *     curve) rides alongside so plugins can approximate OKLCH interpolation
 *     with denser sRGB stops (Figma interpolates in sRGB only).
 *
 * The engine's DTCG carries the *semantic* facts (aliases, per-mode targets, fluid
 * `responsive.figma.modes`, weight-role → numeric); the *Figma-target rendering*
 * lives HERE, not in the DTCG: role-family → scopes, the name transform (strip
 * namespace, dots→slashes; DTCG steps are already zero-padded), per-mode alias
 * resolution, fontStyle derivation, letter-spacing/line-height baking. Reads the
 * pure `tree.ts` `buildTree`, so no engine output is touched. Materialiser (the
 * Figma-MCP thread) plays this artifact in; Figma assigns the real variable ids
 * and resolves aliases by name, so we emit no ids.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { Theme } from './theme';
import { nbTheme } from './nb-fixture';
import { buildTree, at, subNode } from './tree';

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
};
export type FigmaCollectionFile = { $collection: string; $mode: string; variables: FigmaVar[] };

/** The canonical, ordered set of appearance modes emit-figma can produce. A
 *  given brand may opt out of `dark`/`hc-*` via `BrandInput.modes` — the
 *  adapter iterates the intersection of THIS list and `theme.modes`, so a
 *  light-only brand emits only `color.light.json` (not four files with dark
 *  values silently falling back to light). Canonical order is preserved
 *  regardless of the order the user typed modes into their brief. */
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
  // Iterate only the modes THIS brand ships (respects BrandInput.modes opt-out —
  // Pillar 1a). Preserve the canonical order from COLOR_MODES so file order is
  // deterministic regardless of the order the user typed modes into their brief.
  const emittedModes = COLOR_MODES.filter((m) => theme.modes.includes(m));
  const color: FigmaCollectionFile[] = emittedModes.map((mode) => ({
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

// ---------------------------------------------------------------------------
// TYPOGRAPHY (docs/10 §4). Two variable collections + one text-styles artifact:
//   font        → family STRING (primary; full stack in description — fix #4),
//                 size FLOAT (22 static steps), weight FLOAT (100..900),
//                 weight-role FLOAT (subtle/default/emphasis/strong) aliased to
//                 the numeric weight (fix #5 anchor — the weight-role bind is
//                 what lets fontStyle be derived per style).
//   font-fluid  → per-composite fontSize FLOAT, two modes (mobile/desktop). One
//                 var per fluid composite; the text style binds to it.
//   text styles → one style per composite, applying the six §4 fixes.
// ---------------------------------------------------------------------------

// Named-instance derivation for fontStyle (fix #5). Numeric weight → the family's
// real style name, plugin-resolved from loaded fonts. Mono families lack Semi Bold,
// so 600 falls back to Medium (matches the fixture note). Style names are Figma's
// canonical strings, not CSS — plugins call figma.loadFontAsync({ family, style }).
const WEIGHT_STYLE_NAME: Record<number, string> = {
  100: 'Thin', 200: 'ExtraLight', 300: 'Light', 400: 'Regular', 500: 'Medium',
  600: 'Semi Bold', 700: 'Bold', 800: 'ExtraBold', 900: 'Black',
};
const WEIGHT_STYLE_NAME_MONO: Record<number, string> = {
  ...WEIGHT_STYLE_NAME,
  600: 'Medium', // JetBrains Mono / most mono families lack Semi Bold → collapse
};

/** Style name for a given family role + numeric weight. `family` is a DTCG
 *  family-role name (`display`/`text`/`mono`), NOT the font face; mono maps via
 *  the mono-specific table because the mono family lacks certain weights. */
export const fontStyleName = (familyRole: string, numericWeight: number): string => {
  const table = familyRole === 'mono' ? WEIGHT_STYLE_NAME_MONO : WEIGHT_STYLE_NAME;
  return table[numericWeight] ?? 'Regular';
};

/** Turn a DTCG font-family stack into the "stack: A, B, C" description Figma sees
 *  in the fixture (fix #4 — the full stack lives in the STRING variable's
 *  description, only the primary face is bound as the value). */
const stackDescription = (stack: string[]): string => `stack: ${stack.join(', ')}`;

export const buildFigmaFont = (theme: Theme): FigmaCollectionFile => {
  const { tree } = buildTree(theme);
  const root = Object.keys(tree)[0];
  const font = tree[root].font;
  const variables: FigmaVar[] = [];

  // font/family/* — STRING primitives, primary face bound, full stack in description.
  for (const familyRole of Object.keys(font.family)) {
    const leaf = font.family[familyRole];
    const stack: string[] = Array.isArray(leaf.$value) ? leaf.$value : [String(leaf.$value)];
    variables.push({
      name: `font/family/${familyRole}`,
      resolvedType: 'STRING',
      scopes: ['FONT_FAMILY'],
      description: stackDescription(stack),
      value: stack[0],
      alias: null,
    });
  }

  // font/size/N — FLOAT primitives (curated ladder; static, not per-mode).
  for (const key of Object.keys(font.size)) {
    variables.push({
      name: `font/size/${key}`,
      resolvedType: 'FLOAT',
      scopes: ['FONT_SIZE'],
      description: '',
      value: Number(key),
      alias: null,
    });
  }

  // font/weight/N — FLOAT numeric reference tier (100..900).
  for (const key of Object.keys(font.weight)) {
    variables.push({
      name: `font/weight/${key}`,
      resolvedType: 'FLOAT',
      scopes: ['FONT_WEIGHT'],
      description: '',
      value: Number(key),
      alias: null,
    });
  }

  // font/weight-role/{role} — FLOAT aliased to the numeric weight. The DTCG
  // encodes the numeric target under $extensions.prism3.numeric and the alias
  // path under aliasOf; the Figma-target name is `font/weight/<numeric>`.
  for (const roleKey of Object.keys(font['weight-role'])) {
    const leaf = font['weight-role'][roleKey];
    const numeric = leaf.$extensions?.prism3?.numeric as number;
    variables.push({
      name: `font/weight-role/${roleKey}`,
      resolvedType: 'FLOAT',
      scopes: ['FONT_WEIGHT'],
      description: '',
      value: numeric,
      alias: { type: 'VARIABLE_ALIAS', name: `font/weight/${numeric}` },
    });
  }

  return { $collection: 'font', $mode: 'Default', variables };
};

// Fluid composites — walk the type tree and pick composites whose responsive
// entry says fluid, then read `responsive.figma.modes.{mobile,desktop}` for the
// per-mode FLOAT values. Composite path (dot-joined below `type.`) is the Figma
// variable name suffix under `font-fluid/`.
type FluidRow = { name: string; mobile: number; desktop: number };
const collectFluidRows = (typeNode: any, prefix: string, out: FluidRow[] = []): FluidRow[] => {
  for (const k in typeNode) {
    if (k[0] === '$') continue;
    const child = typeNode[k];
    if (child && child.$type === 'typography') {
      const r = child.$extensions?.prism3?.responsive;
      if (r?.fluid && r?.figma?.modes) {
        out.push({ name: `${prefix}${k}`, mobile: r.figma.modes.mobile, desktop: r.figma.modes.desktop });
      }
    } else if (child && typeof child === 'object') {
      collectFluidRows(child, `${prefix}${k}/`, out);
    }
  }
  return out;
};

export const FONT_FLUID_MODES = ['mobile', 'desktop'] as const;

export const buildFigmaFontFluid = (theme: Theme): FigmaCollectionFile[] => {
  const { tree } = buildTree(theme);
  const root = Object.keys(tree)[0];
  const rows = collectFluidRows(tree[root].type, '');

  return FONT_FLUID_MODES.map((mode) => ({
    $collection: 'font-fluid',
    $mode: mode,
    variables: rows.map((r) => ({
      name: `font-fluid/${r.name}`,
      resolvedType: 'FLOAT' as const,
      scopes: ['FONT_SIZE'],
      description: '',
      value: mode === 'mobile' ? r.mobile : r.desktop,
      alias: null,
    })),
  }));
};

// ---- text styles (six §4 fixes) --------------------------------------------

export type FigmaTextStyleProp =
  | { bound: true; variable: string; collection: string; resolvedType: FigmaResolvedType }
  | { bound: false; value: string | number | { unit: 'PERCENT' | 'PIXELS'; value: number } };
export type FigmaTextStyle = {
  name: string;
  description: string;
  properties: {
    fontFamily: FigmaTextStyleProp;
    fontStyle: FigmaTextStyleProp;      // baked — derived from weight-role numeric
    fontSize: FigmaTextStyleProp;       // bound (font or font-fluid)
    fontWeight: FigmaTextStyleProp;     // bound (font/weight-role/*)
    lineHeight: FigmaTextStyleProp;     // baked PERCENT (fix 3a)
    letterSpacing: FigmaTextStyleProp;  // baked PERCENT (fix 3b partial)
    textCase: { bindable: false; value: 'ORIGINAL' | 'UPPER' | 'LOWER' };
    textDecoration: { bindable: false; value: 'NONE' | 'UNDERLINE' };
  };
};
export type FigmaTextStylesFile = { $collection: 'text-styles'; styles: FigmaTextStyle[] };

// Resolve a composite's family-role by dereferencing its fontFamily alias
// (`{root.font.family.<role>}`) — the role, not the face, is what determines
// fontStyle-name resolution and the bound STRING variable name.
const familyRoleFromAlias = (aliasStr: string): string => {
  const m = /font\.family\.([^.}]+)\}?$/.exec(aliasStr);
  return m ? m[1] : 'text';
};
// Resolve a composite's size — bound to `font/<size>` (static) or
// `font-fluid/<path>` (fluid). Returns { variable, collection } for the bind.
const sizeBinding = (compositePath: string, sizeAlias: string, fluid: boolean): { variable: string; collection: 'font' | 'font-fluid' } => {
  if (fluid) return { variable: `font-fluid/${compositePath}`, collection: 'font-fluid' };
  const m = /font\.size\.([^.}]+)\}?$/.exec(sizeAlias);
  return { variable: `font/size/${m ? m[1] : ''}`, collection: 'font' };
};
const weightRoleFromAlias = (aliasStr: string): string => {
  const m = /font\.weight-role\.([^.}]+)\}?$/.exec(aliasStr);
  return m ? m[1] : 'default';
};

// One text style per composite. Walks tree[root].type; each typography leaf
// becomes a style whose path is `group/variant/weight-role[-link]`.
const compositeToStyleName = (compositePath: string): string => compositePath;

const collectComposites = (typeNode: any, prefix: string, out: Array<{ path: string; leaf: any }> = []): Array<{ path: string; leaf: any }> => {
  for (const k in typeNode) {
    if (k[0] === '$') continue;
    const child = typeNode[k];
    if (child && child.$type === 'typography') {
      out.push({ path: `${prefix}${k}`, leaf: child });
    } else if (child && typeof child === 'object') {
      collectComposites(child, `${prefix}${k}/`, out);
    }
  }
  return out;
};

/** Numeric weight (100..900) for a weight-role by reading the weight-role leaf. */
const numericWeightForRole = (fontNode: any, role: string): number => {
  const leaf = fontNode['weight-role']?.[role];
  return (leaf?.$extensions?.prism3?.numeric as number) ?? 400;
};
export const buildFigmaTextStyles = (theme: Theme): FigmaTextStylesFile => {
  const { tree } = buildTree(theme);
  const root = Object.keys(tree)[0];
  const font = tree[root].font;
  const composites = collectComposites(tree[root].type, '');

  const styles: FigmaTextStyle[] = composites.map(({ path, leaf }) => {
    const v = leaf.$value as Record<string, string>;
    const ext = leaf.$extensions?.prism3 ?? {};
    const familyRole = familyRoleFromAlias(v.fontFamily);
    const weightRole = weightRoleFromAlias(v.fontWeight);
    const numeric = numericWeightForRole(font, weightRole);
    const styleName = fontStyleName(familyRole, numeric);
    const fluid: boolean = !!ext.responsive?.fluid;
    const sb = sizeBinding(path, v.fontSize, fluid);
    // Line-height: PERCENT = unitless × 100 (fix 3a). Unbound — Figma has no
    // unitless line-height primitive, but PERCENT is mode/size-independent so
    // this bake is invariant across desktop/mobile fluid modes.
    const lhLeaf = subNode(tree, v.lineHeight);
    const lhMult: number = typeof lhLeaf?.$value === 'number' ? lhLeaf.$value : 1;
    // Letter-spacing: PERCENT = em × 100 (fix 3b — partial: baked, not yet
    // bindable via a tracking var collection).
    const lsLeaf = subNode(tree, v.letterSpacing);
    const lsEm: number = lsLeaf?.$extensions?.prism3?.em ?? 0;
    const textCase = v.textCase === 'uppercase' ? 'UPPER' : v.textCase === 'lowercase' ? 'LOWER' : 'ORIGINAL';
    const textDecoration = v.textDecoration === 'underline' ? 'UNDERLINE' : 'NONE';
    const description = `${ext.group}${ext.variant ? ' ' + ext.variant : ''} ${weightRole}${ext.link ? ' link' : ''}`;

    return {
      name: compositeToStyleName(path),
      description,
      properties: {
        fontFamily: { bound: true, variable: `font/family/${familyRole}`, collection: 'font', resolvedType: 'STRING' },
        // fontStyle baked — derived from weight-role via the named-instance table.
        // Mono families collapse Semi Bold → Medium (see fontStyleName).
        fontStyle: { bound: false, value: styleName },
        fontSize: { bound: true, variable: sb.variable, collection: sb.collection, resolvedType: 'FLOAT' },
        fontWeight: { bound: true, variable: `font/weight-role/${weightRole}`, collection: 'font', resolvedType: 'FLOAT' },
        lineHeight: { bound: false, value: { unit: 'PERCENT', value: Math.round(lhMult * 100) } },
        letterSpacing: { bound: false, value: { unit: 'PERCENT', value: Math.round(lsEm * 10000) / 100 } },
        textCase: { bindable: false, value: textCase },
        textDecoration: { bindable: false, value: textDecoration },
      },
    };
  });

  return { $collection: 'text-styles', styles };
};

// ---------------------------------------------------------------------------
// DIMS — the geometric axis. Seven FLOAT collections in the Figma target:
//   dimension    → the fine-grid primitives (0/1/2/4/6/8/12/…) — the shared step
//                  set every dims token aliases into. Standalone (no aliases).
//   space        → numbered-multiplier scale (`025`/`050`/`075`/`100`/`150`/…) —
//                  each var aliases `dimension/<px>`. Scope: GAP.
//   radius       → t-shirt ramp (none/sm/md/lg/round). Scope: CORNER_RADIUS.
//   size         → component tier — one FLOAT per (t-shirt, prop) pair. `<t>/height`
//                  aliases dimension (WIDTH_HEIGHT scope); `<t>/padding-x` and
//                  `<t>/padding-y` alias space (GAP scope). Names use `/` between
//                  t-shirt and prop (`md/height`), matching the colour/font convention.
//   border-width → hairline/thick/heavy + none, aliased. Scope: STROKE_FLOAT.
//   focus        → ring.width / ring.offset / ring.offset-field (STROKE_FLOAT). The
//                  fourth `focus.ring.style` DTCG token (a `strokeStyle: 'solid'`
//                  literal) is intentionally SKIPPED — Figma has no strokeStyle
//                  variable primitive; the literal stays code-side.
//   opacity      → dimensionless 0–1 (0/5/10/…/100 as percent keys). Scope: OPACITY.
//
// No fixtures — the DTCG tree IS the source of truth (docs/10 §2 only freezes
// colour + typography). Gate is structural: variable counts vs the tree, every
// alias resolves within the emitted collections, scopes consistent per family.
// ---------------------------------------------------------------------------

// Scopes by Figma convention. `dimension` primitives get the broad set (they can
// bind anywhere a FLOAT is expected); each semantic collection narrows to its
// intended surface, so the picker in Figma only shows relevant vars.
const DIMENSION_SCOPES = ['WIDTH_HEIGHT', 'GAP', 'CORNER_RADIUS', 'STROKE_FLOAT'];
const SPACE_SCOPES = ['GAP'];
const RADIUS_SCOPES = ['CORNER_RADIUS'];
const BORDER_WIDTH_SCOPES = ['STROKE_FLOAT'];
const FOCUS_SCOPES = ['STROKE_FLOAT'];
const OPACITY_SCOPES = ['OPACITY'];
const SIZE_HEIGHT_SCOPES = ['WIDTH_HEIGHT'];
const SIZE_PADDING_SCOPES = ['GAP'];

/** Numeric px from a `12px` or `"{alias}"` value. For alias targets we resolve via
 *  the DTCG tree — the resolved leaf's $value is `12px`. */
const pxFromValue = (tree: any, v: unknown): number => {
  if (typeof v === 'number') return v;
  if (typeof v === 'string') {
    const m = /^\{(.+)\}$/.exec(v);
    if (m) {
      const target = at(tree, m[1]);
      return pxFromValue(tree, target?.$value);
    }
    return parseFloat(v.replace('px', '')) || 0;
  }
  return 0;
};
/** DTCG alias `{nbds.dimension.8}` → Figma name `dimension/8`. Uses figName. */
const aliasFigName = (aliasStr: string): string => {
  const m = /^\{(.+)\}$/.exec(String(aliasStr));
  return m ? figName(m[1]) : '';
};

export type FigmaDimsCollections = {
  dimension: FigmaCollectionFile;
  space: FigmaCollectionFile;
  radius: FigmaCollectionFile;
  size: FigmaCollectionFile;
  borderWidth: FigmaCollectionFile;
  focus: FigmaCollectionFile;
  opacity: FigmaCollectionFile;
};

export const buildFigmaDims = (theme: Theme): FigmaDimsCollections => {
  const { tree } = buildTree(theme);
  const root = Object.keys(tree)[0];
  const brand = tree[root];

  // Every dims var carries the DTCG leaf's $description into Figma's `description`
  // field — so designers see the source-of-truth prose in the Variables panel
  // sidebar (`space.100 — 8px (1× 8px base)` etc.) without polluting the Figma
  // name (which stays namespace-stripped per §3).
  const desc = (leaf: any): string => String(leaf?.$description ?? '');

  // dimension primitives — value is the numeric px; no alias.
  const dimVars: FigmaVar[] = Object.keys(brand.dimension).map((key) => ({
    name: `dimension/${key}`,
    resolvedType: 'FLOAT' as const,
    scopes: DIMENSION_SCOPES,
    description: desc(brand.dimension[key]),
    value: pxFromValue(tree, brand.dimension[key].$value),
    alias: null,
  }));

  // space — aliases into dimension. Value = resolved px (belt-and-suspenders).
  const spaceVars: FigmaVar[] = Object.keys(brand.space).map((key) => {
    const leaf = brand.space[key];
    return {
      name: `space/${key}`,
      resolvedType: 'FLOAT' as const,
      scopes: SPACE_SCOPES,
      description: desc(leaf),
      value: pxFromValue(tree, leaf.$value),
      alias: { type: 'VARIABLE_ALIAS' as const, name: aliasFigName(leaf.$value) },
    };
  });

  const radiusVars: FigmaVar[] = Object.keys(brand.radius).map((key) => {
    const leaf = brand.radius[key];
    const isAlias = typeof leaf.$value === 'string' && /^\{.+\}$/.test(leaf.$value);
    return {
      name: `radius/${key}`,
      resolvedType: 'FLOAT' as const,
      scopes: RADIUS_SCOPES,
      description: desc(leaf),
      value: pxFromValue(tree, leaf.$value),
      alias: isAlias ? { type: 'VARIABLE_ALIAS' as const, name: aliasFigName(leaf.$value) } : null,
    };
  });

  // size — nested { <tShirt>: { height, padding-x, padding-y } }. Emit one FLOAT
  // per leaf; height aliases dimension, padding aliases space.
  const sizeVars: FigmaVar[] = [];
  for (const t of Object.keys(brand.size)) {
    for (const prop of ['height', 'padding-x', 'padding-y']) {
      const leaf = brand.size[t][prop];
      if (!leaf) continue;
      const isAlias = typeof leaf.$value === 'string' && /^\{.+\}$/.test(leaf.$value);
      sizeVars.push({
        name: `size/${t}/${prop}`,
        resolvedType: 'FLOAT',
        scopes: prop === 'height' ? SIZE_HEIGHT_SCOPES : SIZE_PADDING_SCOPES,
        description: desc(leaf),
        value: pxFromValue(tree, leaf.$value),
        alias: isAlias ? { type: 'VARIABLE_ALIAS', name: aliasFigName(leaf.$value) } : null,
      });
    }
  }

  const borderVars: FigmaVar[] = Object.keys(brand['border-width']).map((key) => {
    const leaf = brand['border-width'][key];
    const isAlias = typeof leaf.$value === 'string' && /^\{.+\}$/.test(leaf.$value);
    return {
      name: `border-width/${key}`,
      resolvedType: 'FLOAT' as const,
      scopes: BORDER_WIDTH_SCOPES,
      description: desc(leaf),
      value: pxFromValue(tree, leaf.$value),
      alias: isAlias ? { type: 'VARIABLE_ALIAS' as const, name: aliasFigName(leaf.$value) } : null,
    };
  });

  // focus — nested `ring.width` / `ring.offset` / `ring.offset-field` all
  // FLOAT; skip `ring.style` (strokeStyle — no Figma primitive).
  const focusVars: FigmaVar[] = [];
  const ring = brand.focus?.ring ?? {};
  for (const key of Object.keys(ring)) {
    const leaf = ring[key];
    if (leaf.$type !== 'dimension') continue; // skip strokeStyle
    const isAlias = typeof leaf.$value === 'string' && /^\{.+\}$/.test(leaf.$value);
    focusVars.push({
      name: `focus/ring/${key}`,
      resolvedType: 'FLOAT',
      scopes: FOCUS_SCOPES,
      description: desc(leaf),
      value: pxFromValue(tree, leaf.$value),
      alias: isAlias ? { type: 'VARIABLE_ALIAS', name: aliasFigName(leaf.$value) } : null,
    });
  }

  // Opacity — Figma's OPACITY-scoped FLOAT is interpreted as PERCENT (0–100),
  // not fraction. The DTCG tree stores the CSS-correct fraction (`0.9`), so the
  // adapter multiplies by 100 for the Figma target. Verified live: passing 0.9
  // renders as 0.9% (nearly invisible), not 90%. This is a Figma-target
  // rendering decision, so it lives here — the DTCG stays 0–1 for CSS.
  const opacityVars: FigmaVar[] = Object.keys(brand.opacity).map((key) => ({
    name: `opacity/${key}`,
    resolvedType: 'FLOAT' as const,
    scopes: OPACITY_SCOPES,
    description: desc(brand.opacity[key]),
    value: Math.round((brand.opacity[key].$value as number) * 100),
    alias: null,
  }));

  const c = (name: string, variables: FigmaVar[]): FigmaCollectionFile => ({ $collection: name, $mode: 'Default', variables });
  return {
    dimension: c('dimension', dimVars),
    space: c('space', spaceVars),
    radius: c('radius', radiusVars),
    size: c('size', sizeVars),
    borderWidth: c('border-width', borderVars),
    focus: c('focus', focusVars),
    opacity: c('opacity', opacityVars),
  };
};

// ---------------------------------------------------------------------------
// LAYOUT (docs/10 §7 item 4). ONE `layout` variable collection with FIVE
// breakpoint modes (`sm`/`md`/`lg`/`xl`/`2xl`). Each mode carries the SAME
// variable names with different values/aliases per mode — the mode column IS
// the breakpoint, exactly the way colour modes carry the same semantic names
// with different palette-aliased values per light/dark/hc-light/hc-dark. This
// composes independently with the colour light/dark collection: a component
// can bind background to a `color` var (respects theme mode) AND padding to a
// `layout` var (respects viewport mode), and Figma resolves each per its own
// collection.
//
//   breakpoint/{name}   — FLOAT, the min-width threshold (0/768/1024/1440/1920
//                          for NB). Descriptive: not directly bindable to any
//                          Figma property today (there's no "breakpoint" scope),
//                          but shipped in-collection as reference constants so
//                          the materialiser has the numbers where it needs them.
//                          Same value in every mode (viewport-invariant).
//   grid/columns        — FLOAT, per-mode count (4/8/12/12/12 for NB). Not a
//                          dimension — no narrow scope fits; ALL_SCOPES so it
//                          picks nowhere by default but is always available.
//   grid/gutter         — FLOAT, PER-MODE alias into `space/*` (the spacing
//                          scale — gutter grows per breakpoint: sm 16 / md 16 /
//                          lg 24 / xl 24 / 2xl 32 for NB). Scope: GAP, matching
//                          the space collection it aliases.
//   grid/margin         — FLOAT, PER-MODE alias into `space/*` (margin grows per
//                          breakpoint: sm 16 / md 24 / lg 24 / xl 32 / 2xl 48).
//                          Scope: GAP.
//   container/max       — FLOAT, viewport-invariant (same value in every mode).
//                          Content-cap width. Scope: WIDTH_HEIGHT.
//   container/narrow    — FLOAT, viewport-invariant. Reading-measure width
//                          (~65-75ch). Scope: WIDTH_HEIGHT.
//
// `container/fluid` (`"100%"`) is INTENTIONALLY SKIPPED — Figma has no `100%`
// FLOAT primitive (percentage values aren't a variable type; layout auto-sizing
// solves fluid width, not variables), so it stays code-side. Same class of
// "no Figma primitive" skip as `focus.ring.style` in the dims axis.
//
// No fixtures for this axis (§2 covers colour + typography only), so the gate
// is structural: 5 mode files, same variable names across modes, per-mode
// alias resolution into space/*, scopes per family, breakpoint + container
// values invariant across modes.
// ---------------------------------------------------------------------------

export const LAYOUT_MODES = ['sm', 'md', 'lg', 'xl', '2xl'] as const;

// grid/columns is a count, not a dimension — none of the FLOAT scopes fit
// (WIDTH_HEIGHT/GAP/CORNER_RADIUS/STROKE_FLOAT/OPACITY/FONT_*). Figma has no
// layoutGrid.count scope. ALL_SCOPES keeps it available everywhere without
// wrongly claiming a narrower binding target.
const LAYOUT_COLUMNS_SCOPES = ['ALL_SCOPES'];
const LAYOUT_GAP_SCOPES = ['GAP']; // gutter + margin — same as the space collection they alias
const LAYOUT_CONTAINER_SCOPES = ['WIDTH_HEIGHT'];
const LAYOUT_BREAKPOINT_SCOPES = ['WIDTH_HEIGHT']; // min-width threshold

export const buildFigmaLayout = (theme: Theme): FigmaCollectionFile[] => {
  const { tree } = buildTree(theme);
  const root = Object.keys(tree)[0];
  const brand = tree[root];
  const bpNode = brand.breakpoint;
  const gridNode = brand.grid;
  const containerNode = brand.container;

  const desc = (leaf: any): string => String(leaf?.$description ?? '');

  return LAYOUT_MODES.map((mode) => {
    const variables: FigmaVar[] = [];

    // breakpoint/* — mode-invariant reference constants (same value in every
    // mode file; the materialiser handles the dedup by-name).
    for (const bpKey of Object.keys(bpNode)) {
      const leaf = bpNode[bpKey];
      variables.push({
        name: `breakpoint/${bpKey}`,
        resolvedType: 'FLOAT',
        scopes: LAYOUT_BREAKPOINT_SCOPES,
        description: desc(leaf),
        value: pxFromValue(tree, leaf.$value),
        alias: null,
      });
    }

    // grid/* — per-mode. columns is a plain FLOAT; gutter/margin alias space/*.
    const g = gridNode[mode];
    variables.push({
      name: 'grid/columns',
      resolvedType: 'FLOAT',
      scopes: LAYOUT_COLUMNS_SCOPES,
      description: desc(g.columns),
      value: g.columns.$value as number,
      alias: null,
    });
    for (const key of ['gutter', 'margin'] as const) {
      const leaf = g[key];
      const isAlias = typeof leaf.$value === 'string' && /^\{.+\}$/.test(leaf.$value);
      variables.push({
        name: `grid/${key}`,
        resolvedType: 'FLOAT',
        scopes: LAYOUT_GAP_SCOPES,
        description: desc(leaf),
        value: pxFromValue(tree, leaf.$value),
        alias: isAlias ? { type: 'VARIABLE_ALIAS', name: aliasFigName(leaf.$value) } : null,
      });
    }

    // container/max + container/narrow — viewport-invariant. Skip fluid (100%).
    for (const cKey of ['max', 'narrow'] as const) {
      const leaf = containerNode[cKey];
      variables.push({
        name: `container/${cKey}`,
        resolvedType: 'FLOAT',
        scopes: LAYOUT_CONTAINER_SCOPES,
        description: desc(leaf),
        value: pxFromValue(tree, leaf.$value),
        alias: null,
      });
    }

    return { $collection: 'layout', $mode: mode, variables };
  });
};

// ---------------------------------------------------------------------------
// SHADOW — Effect Style specs (docs/10 §7 item 3; docs/08 §5 variable-type
// ceiling). Shadows are STYLES in Figma, not variables — the Effect Style has a
// per-layer array of drop-shadow effects (color/offsetX/offsetY/blur/spread).
// Effect Styles don't currently support Figma modes, so mode-awareness is
// expressed by emitting TWO style sets:
//   shadow/<step>       — LIGHT-mode shadow (canonical $value)
//   shadow-dark/<step>  — DARK-mode shadow (from $extensions.prism3.modes.dark;
//                          reduced-per-layer alpha — the surface-lift dark model)
// A component's plugin/code swap picks the pair by mode. Colour channels parsed
// to Figma {r,g,b,a} float32; numerics carry the DTCG px.
// ---------------------------------------------------------------------------

export type FigmaEffect = { type: 'DROP_SHADOW' | 'INNER_SHADOW'; color: FigmaColor; offset: { x: number; y: number }; radius: number; spread: number; visible: boolean; blendMode: 'NORMAL' };
export type FigmaEffectStyle = { name: string; description: string; effects: FigmaEffect[] };
export type FigmaEffectStylesFile = { $collection: 'shadow-styles'; styles: FigmaEffectStyle[] };

const pxToNum = (v: unknown): number => parseFloat(String(v).replace('px', '')) || 0;

/** DTCG shadow layer → Figma effect. `inset` shadow becomes INNER_SHADOW; the
 *  rest are DROP_SHADOW. `blur` in DTCG maps to `radius` on the Figma effect. */
const shadowLayerToEffect = (layer: any, inset: boolean): FigmaEffect => ({
  type: inset ? 'INNER_SHADOW' : 'DROP_SHADOW',
  color: parseColor(layer.color),
  offset: { x: pxToNum(layer.offsetX), y: pxToNum(layer.offsetY) },
  radius: pxToNum(layer.blur),
  spread: pxToNum(layer.spread),
  visible: true,
  blendMode: 'NORMAL',
});

export const buildFigmaShadow = (theme: Theme): FigmaEffectStylesFile => {
  const { tree } = buildTree(theme);
  const root = Object.keys(tree)[0];
  const shadowNode = tree[root].shadow ?? {};
  const styles: FigmaEffectStyle[] = [];

  // Emit ordered: shadow/<step> first (light), then shadow-dark/<step> (dark).
  // Iterating twice on the same key order keeps materialise-side pairing simple.
  const keys = Object.keys(shadowNode);
  for (const key of keys) {
    const leaf = shadowNode[key];
    const inset = key === 'inset';
    const lightLayers = (leaf.$value as any[]).map((l: any) => shadowLayerToEffect(l, inset));
    styles.push({
      name: `shadow/${key}`,
      description: String(leaf.$description ?? '') + ' — light mode',
      effects: lightLayers,
    });
  }
  for (const key of keys) {
    const leaf = shadowNode[key];
    const inset = key === 'inset';
    const darkLayerData = leaf.$extensions?.prism3?.modes?.dark;
    if (!darkLayerData) continue;
    const darkLayers = (darkLayerData as any[]).map((l: any) => shadowLayerToEffect(l, inset));
    styles.push({
      name: `shadow-dark/${key}`,
      description: String(leaf.$description ?? '') + ' — dark mode (reduced; surface-lift pattern)',
      effects: darkLayers,
    });
  }

  return { $collection: 'shadow-styles', styles };
};

// ---------------------------------------------------------------------------
// GRADIENT — Paint Style specs (docs/10 §7 item 3; docs/08 §5).
// Gradient fills are STYLES in Figma (Paint Styles), not variables. Only stop
// COLOURS bind to colour variables (Plugin API Update 92); kind, angle/transform,
// and stop positions are baked into the style. Figma interpolates in sRGB only,
// so we ship BOTH the canonical alias-driven stops AND the DTCG `sampledStops`
// (5-point sRGB pre-sample of the OKLCH curve) so plugins can lay down denser
// stops when the DTCG interpolation is oklch. Empty for brands with no
// gradients (opt-in axis).
// ---------------------------------------------------------------------------

export type FigmaPaintStop = { position: number; color: FigmaColor; alias: string | null };
export type FigmaPaintStyle = {
  name: string;
  description: string;
  paintType: 'GRADIENT_LINEAR' | 'GRADIENT_RADIAL';
  angle?: number;
  center?: [number, number];
  shape?: string;
  interpolation: 'oklch' | 'srgb';
  stops: FigmaPaintStop[];
  sampledStops: FigmaPaintStop[];
  a11y: { worstOnWhite: number; worstOnBlack: number; note: string };
};
export type FigmaPaintStylesFile = { $collection: 'gradient-styles'; styles: FigmaPaintStyle[] };

/** Resolve `{prism.palette.primary.600}` → Figma name `palette/primary/600` and
 *  the leaf's resolved {r,g,b,a}. */
const stopFromAlias = (tree: any, aliasStr: string, position: number): FigmaPaintStop => {
  const m = /^\{(.+)\}$/.exec(aliasStr);
  const path = m ? m[1] : '';
  const leaf = path ? at(tree, path) : null;
  return {
    position,
    color: parseColor(leaf?.$value),
    alias: path ? figName(path) : null,
  };
};
const stopFromHex = (hex: string, position: number): FigmaPaintStop => ({
  position,
  color: parseColor(hex),
  alias: null,
});

export const buildFigmaGradient = (theme: Theme): FigmaPaintStylesFile => {
  const { tree } = buildTree(theme);
  const root = Object.keys(tree)[0];
  const gradientNode = tree[root].gradient;
  const styles: FigmaPaintStyle[] = [];

  if (!gradientNode) return { $collection: 'gradient-styles', styles };

  for (const key of Object.keys(gradientNode)) {
    const leaf = gradientNode[key];
    const ext = leaf.$extensions?.prism3 ?? {};
    const kind = ext.kind as 'linear' | 'radial';
    const paintType: 'GRADIENT_LINEAR' | 'GRADIENT_RADIAL' = kind === 'radial' ? 'GRADIENT_RADIAL' : 'GRADIENT_LINEAR';
    const stops: FigmaPaintStop[] = (leaf.$value as any[]).map((s: any) => stopFromAlias(tree, s.color, s.position));
    const sampledStops: FigmaPaintStop[] = ((ext.figma?.sampledStops as any[]) ?? []).map((s: any) => stopFromHex(s.hex, s.position));

    const style: FigmaPaintStyle = {
      name: `gradient/${key}`,
      description: String(leaf.$description ?? ''),
      paintType,
      interpolation: ext.interpolation ?? 'srgb',
      stops,
      sampledStops,
      a11y: {
        worstOnWhite: ext.a11y?.worstOnWhite ?? 0,
        worstOnBlack: ext.a11y?.worstOnBlack ?? 0,
        note: String(ext.a11y?.note ?? ''),
      },
    };
    if (kind === 'linear') style.angle = ext.angle ?? 0;
    else { style.center = ext.center ?? [0.5, 0.5]; style.shape = ext.shape ?? 'ellipse'; }
    styles.push(style);
  }

  return { $collection: 'gradient-styles', styles };
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
    const font = buildFigmaFont(theme);
    writeFileSync(resolve(dir, 'font.json'), JSON.stringify(font, null, 2) + '\n');
    const fluid = buildFigmaFontFluid(theme);
    for (const f of fluid) writeFileSync(resolve(dir, `font-fluid.${f.$mode}.json`), JSON.stringify(f, null, 2) + '\n');
    const textStyles = buildFigmaTextStyles(theme);
    writeFileSync(resolve(dir, 'text-styles.json'), JSON.stringify(textStyles, null, 2) + '\n');
    const dims = buildFigmaDims(theme);
    for (const [_key, coll] of Object.entries(dims)) {
      writeFileSync(resolve(dir, `${coll.$collection}.json`), JSON.stringify(coll, null, 2) + '\n');
    }
    const dimsCount = (Object.values(dims) as FigmaCollectionFile[]).reduce((n, c) => n + c.variables.length, 0);
    const layout = buildFigmaLayout(theme);
    for (const l of layout) writeFileSync(resolve(dir, `layout.${l.$mode}.json`), JSON.stringify(l, null, 2) + '\n');
    const shadows = buildFigmaShadow(theme);
    writeFileSync(resolve(dir, 'shadow-styles.json'), JSON.stringify(shadows, null, 2) + '\n');
    const gradients = buildFigmaGradient(theme);
    writeFileSync(resolve(dir, 'gradient-styles.json'), JSON.stringify(gradients, null, 2) + '\n');
    console.log(`[figma] ${id}: palette ${palette.variables.length} + color ${color.length}×${color[0].variables.length} + font ${font.variables.length} + font-fluid ${fluid.length}×${fluid[0].variables.length} + text-styles ${textStyles.styles.length} + dims ${dimsCount} (${Object.keys(dims).length} colls) + layout ${layout.length}×${layout[0].variables.length} + shadow ${shadows.styles.length} + gradient ${gradients.styles.length}`);
  }
}
