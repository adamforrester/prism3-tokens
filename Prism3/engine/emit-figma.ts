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
    console.log(`[figma] ${id}: palette ${palette.variables.length} + color ${color.length}×${color[0].variables.length} + font ${font.variables.length} + font-fluid ${fluid.length}×${fluid[0].variables.length} + text-styles ${textStyles.styles.length}`);
  }
}
