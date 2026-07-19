/**
 * Prism3 engine — emit-figma DIMS + LAYOUT core (pure, node-free).
 *
 * The geometric/dimensional FLOAT axes of the Figma materialisation adapter, split out of
 * `emit-figma.ts` (the I/O-shell CLI) so they can bundle into contexts with NO filesystem — the
 * Figma plugin main thread (#146, extending #108's colour write) and the browser. Mirrors the
 * `emit-figma-color.ts` extraction: `emit-figma.ts` re-exports everything here, so every existing
 * `from './emit-figma'` importer + the `npx tsx Prism3/engine/emit-figma.ts` CLI are unchanged.
 *
 * This module holds:
 *   • `buildFigmaDims(theme)` — the seven FLOAT primitive/semantic collections
 *     (`core-dimension`/`space`/`radius`/`size`/`border-width`/`focus`/`opacity`),
 *   • `buildFigmaLayout(theme)` — the `layout` collection with one mode per breakpoint,
 *   • their local helpers (`pxFromValue`/`aliasFigName`), scope maps, and `LAYOUT_MODES`.
 *
 * PURE — no `node:*`, no `figma.*`, no I/O. Depends only on the pure `theme`/`tree` core + the
 * shared helpers/types in the (also pure) `emit-figma-color`. Every value is a resolved number;
 * cross-axis links are emitted as VARIABLE_ALIAS-by-name (space→dimension, size→dimension/space,
 * radius→dimension, layout grid→space), resolved by the executor's global name map.
 */
import { Theme } from './theme';
import { buildTree, at } from './tree';
import { figName, desc } from './emit-figma-color';
import type { FigmaVar, FigmaCollectionFile } from './emit-figma-color';

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
  /** Per-mode collection files (like the colour axis). Default: `[{$mode:'Default',…}]`
   *  — a single-entry array so a non-wireframe brand's `radius.json` stays byte-identical.
   *  When a brand opts into wireframe (docs/11 Pillar 1b), the array carries a second
   *  entry `{$mode:'wireframe',…}` where every non-zero radius aliases `dimension/0`
   *  — the FIRST non-colour/shadow axis to be mode-varying, and the load-bearing
   *  precedent for any future mode-varying geometry. Non-wireframe brands untouched. */
  radius: FigmaCollectionFile[];
  size: FigmaCollectionFile;
  borderWidth: FigmaCollectionFile;
  focus: FigmaCollectionFile;
  opacity: FigmaCollectionFile;
};

// ---------------------------------------------------------------------------
// DIMS (docs/10 §7 items 1-2). Seven FLOAT collections; every semantic aliases
// into a `dimension/…` (or `space/…`) primitive so the geometric scale is shared.
//   dimension    → fine-grid primitives (REF TIER, hidden from publishing).
//   space        → spacing rhythm, aliased. Scope: GAP.
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

export const buildFigmaDims = (theme: Theme): FigmaDimsCollections => {
  const { tree } = buildTree(theme);
  const root = Object.keys(tree)[0];
  const brand = tree[root];

  // dimension primitives — REF TIER. Value is the numeric px; no alias.
  // hiddenFromPublishing hides from library consumers who should reach
  // `space`/`radius`/`size`/`border-width`/`focus` semantics (all of which
  // alias into this scale). Scopes stay at the four dim targets so, if a
  // component author needs a raw primitive for a bespoke case, the picker
  // guidance is still correct.
  const dimVars: FigmaVar[] = Object.keys(brand.dimension).map((key) => ({
    name: `dimension/${key}`,
    resolvedType: 'FLOAT' as const,
    scopes: DIMENSION_SCOPES,
    description: desc(brand.dimension[key]),
    value: pxFromValue(tree, brand.dimension[key].$value),
    alias: null,
    hiddenFromPublishing: true,
  }));

  // space — aliases into dimension. Value = resolved px (belt-and-suspenders).
  // M-09: guard the alias like every sibling axis (radius/size/border/focus). Space
  // is the one axis that emitted `alias` UNCONDITIONALLY — so a leaf carrying a raw px
  // value (not a `{…}` alias) would ship `alias.name: ''` (aliasFigName returns '' off
  // a non-brace value): a dangling, empty-named binding Figma silently drops the link
  // for. Emit an alias only when the value IS a brace reference; otherwise null.
  const spaceVars: FigmaVar[] = Object.keys(brand.space).map((key) => {
    const leaf = brand.space[key];
    const isAlias = typeof leaf.$value === 'string' && /^\{.+\}$/.test(leaf.$value);
    return {
      name: `space/${key}`,
      resolvedType: 'FLOAT' as const,
      scopes: SPACE_SCOPES,
      description: desc(leaf),
      value: pxFromValue(tree, leaf.$value),
      alias: isAlias ? { type: 'VARIABLE_ALIAS' as const, name: aliasFigName(leaf.$value) } : null,
    };
  });

  // Radius is the FIRST non-colour/shadow axis to be MODE-VARYING (docs/11 Pillar 1b).
  // When the brand opts into `wireframe`, non-zero radius leaves carry a
  // `$extensions.prism3.modes.wireframe → {root.dimension.0}` override in the DTCG tree
  // (tree.ts:340–346) — the same per-mode override shape colour/shadow use. Materialise
  // that here as a wireframe MODE on the `radius` variable collection: in the wireframe
  // mode file every non-zero radius var aliases `dimension/0`; radius.none stays 0 with
  // no redundant override (matches tree.ts behaviour). Non-wireframe brands emit a
  // single Default-mode file (byte-identical to the pre-1b world).
  // Two families of radius modes coexist on the SAME per-mode file convention: the wireframe mode
  // (not lever-driven — zeroes every radius) and, per Phase D, one mode per `modeLevers.radius`
  // entry (a customizable mode that RE-DERIVES its radius ramp). Both read the DTCG leaf's
  // `$extensions.prism3.modes.<mode>` override the tree emitted; `Default` uses the canonical value.
  const wireframe = theme.modes.includes('wireframe');
  const radiusModes = Object.keys(theme.dims.radiusByMode ?? {});
  const radiusVarsFor = (mode: string): FigmaVar[] =>
    Object.keys(brand.radius).map((key) => {
      const leaf = brand.radius[key];
      // Mode leaves are DTCG-only until the brand opts in; a rung that carries no override for this
      // mode (e.g. `radius.none`, already 0, or a rung whose per-mode px equals light) falls through
      // to the canonical leaf — byte-identical to Default for that rung.
      const override = mode === 'Default' ? undefined : leaf.$extensions?.prism3?.modes?.[mode];
      const source: any = override ?? leaf;
      const isAlias = typeof source.$value === 'string' && /^\{.+\}$/.test(source.$value);
      return {
        name: `radius/${key}`,
        resolvedType: 'FLOAT' as const,
        scopes: RADIUS_SCOPES,
        description: desc(leaf),
        value: pxFromValue(tree, source.$value),
        alias: isAlias ? { type: 'VARIABLE_ALIAS' as const, name: aliasFigName(source.$value) } : null,
      };
    });
  const radiusFiles: FigmaCollectionFile[] = [
    { $collection: 'radius', $mode: 'Default', variables: radiusVarsFor('Default') },
    ...(wireframe ? [{ $collection: 'radius', $mode: 'wireframe', variables: radiusVarsFor('wireframe') }] : []),
    ...radiusModes.map((mode) => ({ $collection: 'radius', $mode: mode, variables: radiusVarsFor(mode) })),
  ];

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

  // Opacity — REF TIER PRIMITIVES. Figma's OPACITY-scoped FLOAT is interpreted
  // as PERCENT (0–100), not fraction. The DTCG tree stores the CSS-correct
  // fraction (`0.9`), so the adapter multiplies by 100 for the Figma target.
  // Verified live: passing 0.9 renders as 0.9% (nearly invisible), not 90%.
  // This is a Figma-target rendering decision, so it lives here — the DTCG
  // stays 0–1 for CSS. opacity is DIRECTLY CONSUMABLE (#79): unlike the ref-tier
  // primitives (palette/dimension/font), there is no semantic layer to reach for
  // instead, so it is NOT hidden from publishing — it stays visible in the library
  // picker with its OPACITY scope, matching the sidecar (`consume: Consumable`),
  // eval (excluded from PRIMITIVE_TIERS), and the prism3-consume skill.
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
    dimension: c('core-dimension', dimVars),
    space: c('space', spaceVars),
    radius: radiusFiles,
    size: c('size', sizeVars),
    borderWidth: c('border-width', borderVars),
    focus: c('focus', focusVars),
    opacity: c('opacity', opacityVars),
  };
};

// ---------------------------------------------------------------------------
// LAYOUT (docs/10 §7 item 4). ONE `layout` variable collection with breakpoint
// modes (`sm`/`md`/`lg`/`xl`/`2xl` by default — the brand's actual grid keys).
// Each mode carries the SAME variable names with different values/aliases per
// mode — the mode column IS the breakpoint, exactly the way colour modes carry
// the same semantic names with different palette-aliased values per light/dark.
// Composes independently with the colour light/dark collection: a component can
// bind background to a `color` var (respects theme mode) AND padding to a
// `layout` var (respects viewport mode), and Figma resolves each per its own
// collection.
//   breakpoint/{name}   — FLOAT, the min-width threshold (mode-invariant).
//   grid/columns        — FLOAT, per-mode count. ALL_SCOPES (no count scope).
//   grid/gutter,margin  — FLOAT, PER-MODE alias into `space/*`. Scope: GAP.
//   container/max,narrow— FLOAT, viewport-invariant. Scope: WIDTH_HEIGHT.
// `container/fluid` (`"100%"`) skipped — Figma has no percentage FLOAT primitive.
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

  // CR-08 (#74): emit one layout mode per breakpoint the brand ACTUALLY ships (the grid node's
  // keys, already in ascending order) — NOT a hardcoded 5. A 6-breakpoint brand (aurora: xs..2xl)
  // otherwise silently drops its base `xs` grid, and a ≤3-breakpoint brand would read
  // `gridNode[mode]` undefined and crash. `LAYOUT_MODES` stays the DEFAULT breakpoint-name set
  // (a 4-floor brief auto-names them sm..2xl); the emit follows whatever the brand generated.
  // (`desc` is now the module-level helper hoisted for the #76 description threading.)
  const modes = Object.keys(gridNode);

  return modes.map((mode) => {
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
