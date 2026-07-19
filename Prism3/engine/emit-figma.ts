/**
 * emit-figma.ts — I/O shell: the DTCG token tree → a Figma import artifact (docs/10).
 *
 * COLLECTION NAMING (#66, 2026-07-05): the PRIMITIVE collections carry a `core-` prefix so a
 * designer scans primitives-vs-semantics at a glance in Figma's collection list —
 * `core-palette` / `core-dimension` / `core-font`, and `type-sets` (the responsive fluid-size
 * collection, ex-`font-fluid`). This is a **collection-label** convention only: the DTCG token
 * tree, the `<root>.*` namespace, and — crucially — the Figma VARIABLE NAMES are unchanged. Every
 * variable name still mirrors its DTCG path (`palette/red/550`, `font/family/display`,
 * `font-fluid/…`), so the `variableId` round-trip and every cross-collection alias resolve
 * exactly as before. Semantic collections keep their bare names (`color`, `space`, `radius`,
 * `size`, `border-width`, `focus`, `opacity`, `layout`). See docs/00 + issue #66/#67 (Token Press).
 *
 * Axes shipped:
 *   • COLOUR — `core-palette` primitives (Default mode) + `color` semantics (4 modes),
 *     every semantic a VARIABLE_ALIAS into a `palette/…` variable. Byte-reproduces
 *     `fixtures/figma/nb/{palette,color.<mode>}.json` (variable names/scopes/aliases/values).
 *   • TYPOGRAPHY — `core-font` primitives (family STRING + size/weight FLOAT + weight-role
 *     FLOAT aliased) + `type-sets` (per-mode FLOATs for the fluid composites) +
 *     text styles for every composite, applying the six §4 fixes: (1) no wrapper
 *     `text/` prefix; (2) prescribed collection names (`core-font`, `type-sets`);
 *     (3a) lineHeight baked as PERCENT (unitless × 100 — mode/size-independent);
 *     (3b) letterSpacing baked as PERCENT (em × 100 — this PR bakes; a follow-up
 *     lands bindable tracking FLOATs); (4) primary family bound + full stack in
 *     description; (5) fontStyle derived from the weight-role via a named-instance
 *     table (mono falls back for weights it lacks).
 *   • DIMS — the whole geometric layer emitted as SEVEN FLOAT collections:
 *     `core-dimension` (fine-grid primitives), `space`/`radius`/`size`/`border-width`/
 *     `focus` (all aliased into a `dimension/…` variable — the primitives are shared) + `opacity`
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
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { Theme, brandTheme } from './theme';
import { nbTheme } from './nb-fixture';
import { parseDesignMd } from './design-md';
import { parseStandardDesignMd, standardToBrandInput } from './standard-design-md';
import { buildTree, subNode } from './tree';
// Colour axis + the shared pure helpers/types live in the node-free `emit-figma-color`
// module (so they can bundle into the Figma plugin main thread + the browser — #108). This
// shell re-exports them, so every existing `from './emit-figma'` importer + the CLI below are
// unchanged; the non-colour axes (font/dims/layout/shadow/gradient) still live here and reuse
// `figName` / `parseColor` / `desc` / `leaves` / `stripNs` imported back from that module.
import type {
  FigmaColor, FigmaVarValue, FigmaResolvedType, FigmaVar, FigmaCollectionFile,
} from './emit-figma-color';
import { COLOR_MODES, figName, parseColor, desc, leaves, stripNs, buildFigmaColor } from './emit-figma-color';
export type {
  FigmaColor, FigmaVarValue, FigmaResolvedType, FigmaVar, FigmaCollectionFile,
} from './emit-figma-color';
export { COLOR_MODES, figName, parseColor, buildFigmaColor } from './emit-figma-color';
// DIMS + LAYOUT FLOAT axes — extracted node-free (#146) so they bundle into the Figma plugin
// (like the colour core). Imported for the CLI below + re-exported so every `from './emit-figma'`
// importer (and `test.ts`) stay unchanged.
import { buildFigmaDims, buildFigmaLayout } from './emit-figma-dims';
import type { FigmaDimsCollections } from './emit-figma-dims';
export type { FigmaDimsCollections } from './emit-figma-dims';
export { buildFigmaDims, buildFigmaLayout, LAYOUT_MODES } from './emit-figma-dims';
// SHADOW (Effect Styles) + GRADIENT (Paint Styles) — extracted node-free (shadow/gradient lane) so
// they bundle into the plugin. Imported for the CLI below + re-exported so every `from './emit-figma'`
// importer (and `test.ts`) stay unchanged.
import { buildFigmaShadow, buildFigmaGradient } from './emit-figma-styles';
export type {
  FigmaEffect, FigmaEffectStyle, FigmaEffectStylesFile,
  FigmaPaintStop, FigmaPaintStyle, FigmaPaintStylesFile,
} from './emit-figma-styles';
export { buildFigmaShadow, buildFigmaGradient } from './emit-figma-styles';
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

/** Style name for a given family role + numeric weight (+ italic). `family` is a
 *  DTCG family-role name (`display`/`text`/`mono`), NOT the font face; mono maps via
 *  the mono-specific table because the mono family lacks certain weights. Italic
 *  follows Figma's naming: Regular→`Italic` (not `Regular Italic`), otherwise
 *  `<Weight> Italic` (e.g. `Bold Italic`, `Semi Bold Italic`). */
export const fontStyleName = (familyRole: string, numericWeight: number, italic = false): string => {
  const table = familyRole === 'mono' ? WEIGHT_STYLE_NAME_MONO : WEIGHT_STYLE_NAME;
  const base = table[numericWeight] ?? 'Regular';
  if (!italic) return base;
  return base === 'Regular' ? 'Italic' : `${base} Italic`;
};

/** Turn a DTCG font-family stack into the "stack: A, B, C" description Figma sees
 *  in the fixture (fix #4 — the full stack lives in the STRING variable's
 *  description, only the primary face is bound as the value). */
const stackDescription = (stack: string[]): string => `stack: ${stack.join(', ')}`;

// `core-font` is now a PER-MODE collection (Phase D — same convention as `radius`): a customizable
// mode that overrides the font FAMILY (`font/family/*`) or WEIGHT (`font/weight-role/*`) via
// `modeLevers` gets its own mode file. A brand with no per-mode typography returns a single
// `[{$mode:'Default',…}]` entry — byte-identical to the pre-D world. Each mode file carries the FULL
// variable set (family/size/weight/weight-role); a variable with no override for a mode falls through
// to its canonical (light) value, satisfying Figma's mode-completeness requirement — exactly like
// `radius` per mode. The per-mode family/weight overrides are read from the DTCG leaf's
// `$extensions.prism3.modes.<mode>` the tree emits.
export const buildFigmaFont = (theme: Theme): FigmaCollectionFile[] => {
  const { tree } = buildTree(theme);
  const root = Object.keys(tree)[0];
  const font = tree[root].font;
  const familiesByMode = theme.typography.familiesByMode ?? {};
  const weightRolesByMode = theme.typography.weightRolesByMode ?? {};
  const fontModes = [...new Set([...Object.keys(familiesByMode), ...Object.keys(weightRolesByMode)])];

  const varsFor = (mode: string): FigmaVar[] => {
    const variables: FigmaVar[] = [];
    // font/family/* — STRING PRIMITIVES (ref tier). Primary face is the bound value; full
    // fallback stack lives in the description (fix #4). A per-mode family override supplies its
    // own $value (primary) + fallbackStack; else the canonical (light) leaf. hiddenFromPublishing
    // hides them from library consumers.
    for (const familyRole of Object.keys(font.family)) {
      const leaf = font.family[familyRole];
      const ov = mode === 'Default' ? undefined : (leaf.$extensions?.prism3?.modes as any)?.[mode];
      const primary = ov ? String(ov.$value)
        : Array.isArray(leaf.$value) ? String(leaf.$value[0]) : String(leaf.$value);
      const fallback: string[] = ov
        ? ((ov.fallbackStack as string[] | undefined) ?? [])
        : Array.isArray(leaf.$value) ? leaf.$value.slice(1).map(String)
          : ((leaf.$extensions?.prism3?.fallbackStack as string[] | undefined) ?? []);
      const stack: string[] = [primary, ...fallback];
      variables.push({
        name: `font/family/${familyRole}`,
        resolvedType: 'STRING',
        scopes: ['FONT_FAMILY'],
        description: [stackDescription(stack), desc(leaf)].filter(Boolean).join(' — '),
        value: stack[0],
        alias: null,
        hiddenFromPublishing: true,
      });
    }

    // font/size/N — FLOAT PRIMITIVES (curated ladder; static, never per-mode).
    for (const key of Object.keys(font.size)) {
      const leaf = font.size[key];
      variables.push({
        name: `font/size/${key}`,
        resolvedType: 'FLOAT',
        scopes: ['FONT_SIZE'],
        description: desc(leaf),
        value: Number(key),
        alias: null,
        hiddenFromPublishing: true,
      });
    }

    // font/weight/N — FLOAT numeric reference tier (union of the global tier + every per-mode
    // weight value, so a per-mode weight-role alias always lands). PRIMITIVES; brand-facing
    // consumers pick `font/weight-role/*`. hiddenFromPublishing hides from library consumers.
    for (const key of Object.keys(font.weight)) {
      const leaf = font.weight[key];
      variables.push({
        name: `font/weight/${key}`,
        resolvedType: 'FLOAT',
        scopes: ['FONT_WEIGHT'],
        description: desc(leaf),
        value: Number(key),
        alias: null,
        hiddenFromPublishing: true,
      });
    }

    // font/weight-role/{role} — SEMANTIC. FLOAT aliased to the numeric weight. This IS the
    // brand-facing lever; a per-mode weight override re-anchors it at `font/weight/<value>` for
    // that mode (e.g. dark's `strong` → 600). Else the canonical (light) numeric.
    for (const roleKey of Object.keys(font['weight-role'])) {
      const leaf = font['weight-role'][roleKey];
      const ov = mode === 'Default' ? undefined : (leaf.$extensions?.prism3?.modes as any)?.[mode];
      const numeric = ov ? (ov.weight as number) : (leaf.$extensions?.prism3?.numeric as number);
      variables.push({
        name: `font/weight-role/${roleKey}`,
        resolvedType: 'FLOAT',
        scopes: ['FONT_WEIGHT'],
        description: desc(leaf),
        value: numeric,
        alias: { type: 'VARIABLE_ALIAS', name: `font/weight/${numeric}` },
      });
    }
    return variables;
  };

  return [
    { $collection: 'core-font', $mode: 'Default', variables: varsFor('Default') },
    ...fontModes.map((mode) => ({ $collection: 'core-font' as const, $mode: mode, variables: varsFor(mode) })),
  ];
};

// Fluid composites — walk the type tree and pick composites whose responsive
// entry says fluid, then read `responsive.figma.modes.{mobile,desktop}` for the
// per-mode FLOAT values. Composite path (dot-joined below `type.`) is the Figma
// variable name suffix under `font-fluid/`.
type FluidRow = { name: string; mobile: number; desktop: number; description: string };
const collectFluidRows = (typeNode: any, prefix: string, out: FluidRow[] = []): FluidRow[] => {
  for (const k in typeNode) {
    if (k[0] === '$') continue;
    const child = typeNode[k];
    if (child && child.$type === 'typography') {
      const r = child.$extensions?.prism3?.responsive;
      if (r?.fluid && r?.figma?.modes) {
        out.push({
          name: `${prefix}${k}`,
          mobile: r.figma.modes.mobile,
          desktop: r.figma.modes.desktop,
          description: desc(child),
        });
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
    $collection: 'type-sets',
    $mode: mode,
    variables: rows.map((r) => ({
      name: `font-fluid/${r.name}`,
      resolvedType: 'FLOAT' as const,
      scopes: ['FONT_SIZE'],
      description: r.description,
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
const sizeBinding = (compositePath: string, sizeAlias: string, fluid: boolean): { variable: string; collection: 'core-font' | 'type-sets' } => {
  if (fluid) return { variable: `font-fluid/${compositePath}`, collection: 'type-sets' };
  const m = /font\.size\.([^.}]+)\}?$/.exec(sizeAlias);
  return { variable: `font/size/${m ? m[1] : ''}`, collection: 'core-font' };
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
    const italic = !!ext.italic || v.fontStyle === 'italic';
    const styleName = fontStyleName(familyRole, numeric, italic);
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
    const description = `${ext.group}${ext.variant ? ' ' + ext.variant : ''} ${weightRole}${italic ? ' italic' : ''}${ext.link ? ' link' : ''}`;

    return {
      name: compositeToStyleName(path),
      description,
      properties: {
        fontFamily: { bound: true, variable: `font/family/${familyRole}`, collection: 'core-font', resolvedType: 'STRING' },
        // fontStyle baked — derived from weight-role (+ italic modifier) via the
        // named-instance table (e.g. Bold, Bold Italic). Mono families collapse
        // Semi Bold → Medium (see fontStyleName).
        fontStyle: { bound: false, value: styleName },
        fontSize: { bound: true, variable: sb.variable, collection: sb.collection, resolvedType: 'FLOAT' },
        fontWeight: { bound: true, variable: `font/weight-role/${weightRole}`, collection: 'core-font', resolvedType: 'FLOAT' },
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
// DIMS + LAYOUT — the geometric FLOAT axes. `pxFromValue` / `aliasFigName`, the scope
// maps, `FigmaDimsCollections`, `buildFigmaDims`, `buildFigmaLayout`, and `LAYOUT_MODES`
// are extracted to the node-free `emit-figma-dims.ts` (#146 — so they bundle into the
// Figma plugin main thread, exactly as the colour core did in `emit-figma-color.ts`).
// This shell re-exports them (below the shadow/gradient axes), so the CLI + every
// `from './emit-figma'` importer are unchanged. The seven dims collections
// (`core-dimension`/`space`/`radius`/`size`/`border-width`/`focus`/`opacity`) + the
// per-breakpoint `layout` collection now live there.
// ---------------------------------------------------------------------------


// ---------------------------------------------------------------------- I/O
const here = dirname(fileURLToPath(import.meta.url));
const isMain = process.argv[1] ? resolve(process.argv[1]) === fileURLToPath(import.meta.url) : false;
/** Compile an engine-native design.md at `<engine>/../examples/<file>` → Theme. */
const compileNative = (file: string): Theme =>
  brandTheme(parseDesignMd(readFileSync(resolve(here, `../examples/${file}`), 'utf8')).input);
/** Compile a STANDARD-dialect design.md (brand-skills / google-labs) → Theme via
 *  the reader + colour-role classifier + x-prism3 lever mapping. */
const compileStandard = (file: string): Theme =>
  brandTheme(standardToBrandInput(parseStandardDesignMd(readFileSync(resolve(here, `../examples/${file}`), 'utf8'))).input);

if (isMain) {
  // Generalise (docs/10 §7 item 6). NB is the byte-fixture regression target;
  // AURORA proves the alias-driven Paint Style path (it opts into gradients and
  // sets `action = accent`, so its colour axis exercises a decoupled action
  // palette); WENDYS proves the standard-dialect front door (parseStandard +
  // classifier + brandTheme → the same emit-figma shell). All three write to
  // out/figma/<id>/. No new adapter code — the axes are already brand-agnostic;
  // this is where that claim gets exercised.
  const brands: Array<{ id: string; theme: Theme }> = [
    { id: 'nb', theme: nbTheme() },
    { id: 'aurora', theme: compileNative('aurora.design.md') },
    { id: 'wendys', theme: compileStandard('wendys.design.md') },
  ];
  for (const { id, theme } of brands) {
    const dir = resolve(here, 'out/figma', id);
    mkdirSync(dir, { recursive: true });
    const { palette, color } = buildFigmaColor(theme);
    // Filenames follow the $collection label (so the core-*/type-sets rename carries through).
    writeFileSync(resolve(dir, `${palette.$collection}.json`), JSON.stringify(palette, null, 2) + '\n');
    for (const c of color) writeFileSync(resolve(dir, `${c.$collection}.${c.$mode}.json`), JSON.stringify(c, null, 2) + '\n');
    // core-font is per-mode (Phase D): a brand with no per-mode typography emits ONE `core-font.json`
    // (byte-identical to pre-D); a brand overriding font family/weight per mode emits per-mode
    // filenames `core-font.<mode>.json`, matching the colour/radius per-mode convention.
    const fontFiles = buildFigmaFont(theme);
    if (fontFiles.length === 1) writeFileSync(resolve(dir, `core-font.json`), JSON.stringify(fontFiles[0], null, 2) + '\n');
    else for (const f of fontFiles) writeFileSync(resolve(dir, `core-font.${f.$mode}.json`), JSON.stringify(f, null, 2) + '\n');
    const fluid = buildFigmaFontFluid(theme);
    for (const f of fluid) writeFileSync(resolve(dir, `${f.$collection}.${f.$mode}.json`), JSON.stringify(f, null, 2) + '\n');
    const textStyles = buildFigmaTextStyles(theme);
    writeFileSync(resolve(dir, 'text-styles.json'), JSON.stringify(textStyles, null, 2) + '\n');
    const dims = buildFigmaDims(theme);
    // Radius is per-mode (docs/11 Pillar 1b): a non-wireframe brand emits ONE
    // Default-mode file at `radius.json` (byte-identical to the pre-1b world);
    // a wireframe-opted-in brand emits per-mode filenames `radius.Default.json`
    // + `radius.wireframe.json`, matching the colour axis convention.
    for (const [key, val] of Object.entries(dims)) {
      if (key === 'radius') {
        const arr = val as FigmaCollectionFile[];
        if (arr.length === 1) writeFileSync(resolve(dir, `radius.json`), JSON.stringify(arr[0], null, 2) + '\n');
        else for (const c of arr) writeFileSync(resolve(dir, `radius.${c.$mode}.json`), JSON.stringify(c, null, 2) + '\n');
      } else {
        const coll = val as FigmaCollectionFile;
        writeFileSync(resolve(dir, `${coll.$collection}.json`), JSON.stringify(coll, null, 2) + '\n');
      }
    }
    const dimsCount = (Object.values(dims) as (FigmaCollectionFile | FigmaCollectionFile[])[]).reduce((n, v) => {
      if (Array.isArray(v)) return n + v[0].variables.length; // radius: count once (same names across modes)
      return n + v.variables.length;
    }, 0);
    const layout = buildFigmaLayout(theme);
    for (const l of layout) writeFileSync(resolve(dir, `layout.${l.$mode}.json`), JSON.stringify(l, null, 2) + '\n');
    const shadows = buildFigmaShadow(theme);
    writeFileSync(resolve(dir, 'shadow-styles.json'), JSON.stringify(shadows, null, 2) + '\n');
    const gradients = buildFigmaGradient(theme);
    writeFileSync(resolve(dir, 'gradient-styles.json'), JSON.stringify(gradients, null, 2) + '\n');
    console.log(`[figma] ${id}: palette ${palette.variables.length} + color ${color.length}×${color[0].variables.length} + font ${fontFiles[0].variables.length}${fontFiles.length > 1 ? `×${fontFiles.length}modes` : ''} + font-fluid ${fluid.length}×${fluid[0].variables.length} + text-styles ${textStyles.styles.length} + dims ${dimsCount} (${Object.keys(dims).length} colls) + layout ${layout.length}×${layout[0].variables.length} + shadow ${shadows.styles.length} + gradient ${gradients.styles.length}`);
  }
}
