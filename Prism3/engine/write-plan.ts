/**
 * Prism3 engine — the WRITE PLAN (docs/22 Phase 3 / #108).
 *
 * The single, host-neutral description of "what colour variables to materialise" — a pure
 * data reshape of the already-resolved raw-figma collection files (`buildFigmaColor`'s
 * `{ palette, color[] }`). It is the SOURCE OF TRUTH both write paths consume:
 *   • the CLI string-emitter (`materialise-to-figma.ts`) — the paste-into-`figma_execute` path,
 *   • the live plugin executor (`plugin/src/write-figma.ts` → `figma.variables.*`).
 * Extracting it means the two paths can't drift: the collapse-proof per-mode alias binding, the
 * scopes, and the hidden-primitive flags are decided ONCE, here.
 *
 * The plan encodes the same three passes the materialiser has always run (docs/10 §3):
 *   1. `palette` — the `core-palette` collection: one Default mode, literal RGBA, primitives
 *      hidden from publishing (ref tier).
 *   2. `color.create` — the `color` collection across N modes: literal per-mode fallback RGBA
 *      (every var + value exists before any alias binds — pass A of the two-pass write).
 *   3. `color.aliases` — the semantic→primitive links, ONE TARGET PER MODE. This is the
 *      collapse-guard (the #85 round-trip caught a script that bound light's target to all
 *      modes → every mode identical); the plan carries each mode's OWN target so a faithful
 *      executor can't collapse them.
 *
 * PURE — no `node:*`, no `figma.*`, no I/O (types-only import from `emit-figma`). Bundles into
 * the plugin main thread (which has no filesystem); the disk-read lives in the CLI shell that
 * calls this.
 */
import type { FigmaCollectionFile, FigmaColor, FigmaVar } from './emit-figma-color';
import type { Theme } from './theme';
import { buildFigmaDims, buildFigmaLayout } from './emit-figma-dims';

/** A colour value as Figma's variable API wants it (RGBA floats 0–1). */
export type Rgba = { r: number; g: number; b: number; a: number };

/** One `core-palette` primitive: a literal colour, hidden from library publishing. */
export type PaletteRow = {
  name: string;
  scopes: string[];
  description: string;
  value: Rgba;
  hidden: boolean;
};

/** One `color` variable's literal fallback values — one RGBA per mode, in `modes` order
 *  (pass A: every var exists with a real value before any alias binds). */
export type ColorCreateRow = {
  name: string;
  scopes: string[];
  description: string;
  valuesByMode: Rgba[];
};

/** One `color` variable's alias targets — one target var-name per mode, in `modes` order
 *  (pass B: each mode binds its OWN target; `null` = no alias for that mode). This per-mode
 *  shape is the collapse-guard the `aliasRows` tests lock. */
export type ColorAliasRow = {
  name: string;
  targetsByMode: (string | null)[];
};

/** The full colour materialisation plan — host-neutral, ready for any executor. */
export type WritePlan = {
  palette: PaletteRow[];
  color: {
    modes: string[];
    create: ColorCreateRow[];
    aliases: ColorAliasRow[];
  };
};

// Rounding mirrors the materialiser: keep RGBA compact + deterministic (5 dp), so the plan
// is byte-stable across the CLI-embed path and the live executor.
const round = (n: number): number => Math.round(n * 1e5) / 1e5;
const rgba = (v: FigmaColor): Rgba => ({ r: round(v.r), g: round(v.g), b: round(v.b), a: round(v.a) });

/**
 * Reshape the resolved colour collection files into the host-neutral write plan.
 *
 * Inputs are the OUTPUT of `buildFigmaColor(theme)` (or the equivalent read off disk): the
 * palette file (one mode) + one `color` file per emitted mode, ALL already carrying resolved
 * scopes/values/alias-targets. This function only reprojects them into the pass shape — no
 * theme resolution, no I/O.
 *
 * The `color` files share one variable order (they're the same leaves per mode), so the create
 * + alias rows are built by walking the first mode file's variables and reading each mode's
 * value/alias at the same index — exactly how the materialiser has always done it.
 */
export const buildWritePlan = (
  { palette, color }: { palette: FigmaCollectionFile; color: FigmaCollectionFile[] },
): WritePlan => {
  const paletteRows: PaletteRow[] = palette.variables.map((v) => ({
    name: v.name,
    scopes: v.scopes,
    description: v.description,
    value: rgba(v.value as FigmaColor),
    hidden: !!v.hiddenFromPublishing,
  }));

  const modes = color.map((f) => f.$mode);
  const base = color[0]?.variables ?? [];
  const create: ColorCreateRow[] = base.map((v, i) => ({
    name: v.name,
    scopes: v.scopes,
    description: v.description,
    valuesByMode: color.map((f) => rgba(f.variables[i].value as FigmaColor)),
  }));
  const aliases: ColorAliasRow[] = base.map((v, i) => ({
    name: v.name,
    targetsByMode: color.map((f) => f.variables[i].alias?.name ?? null),
  }));

  return { palette: paletteRows, color: { modes, create, aliases } };
};

// ---------------------------------------------------------------------------
// FLOAT-VARIABLE AXES (#146) — the geometric/dimensional layer beyond colour.
// The engine already builds these as FLOAT `FigmaCollectionFile`s (`buildFigmaDims` +
// `buildFigmaLayout`, both node-free in `emit-figma-dims`); this reshapes them into the SAME
// host-neutral pass shape as the colour plan — create-all-then-alias, one target per mode — so
// the plugin executor (`applyFloatPlan`) can reuse the two-pass structure of `applyWritePlan`.
//
// Each axis is ONE `FloatCollectionPlan`: `core-dimension`/`space`/`size`/`border-width`/`focus`/
// `opacity` are single-mode (`Default`); `radius` is 1 or 2 modes (`Default` [+ `wireframe`]); and
// `layout` carries one mode per breakpoint the brand ships. Cross-collection aliases (space→
// dimension, size→dimension/space, radius→dimension, layout grid→space) bind by NAME across ALL
// float collections — the executor resolves them against one global name map, exactly like the
// colour aliases resolve palette targets.
// ---------------------------------------------------------------------------

/** One FLOAT variable's literal per-mode values (numbers), in `modes` order — pass A. `hidden`
 *  carries `hiddenFromPublishing` (only the `core-dimension` primitives set it). */
export type FloatCreateRow = {
  name: string;
  scopes: string[];
  description: string;
  hidden: boolean;
  valuesByMode: number[];
};

/** One FLOAT variable's alias targets — one target var-name per mode, in `modes` order (pass B;
 *  `null` = literal-only for that mode). Same collapse-safe per-mode shape as the colour plan. */
export type FloatAliasRow = {
  name: string;
  targetsByMode: (string | null)[];
};

/** One FLOAT collection's materialisation plan (a `core-dimension`/`space`/…/`layout` collection). */
export type FloatCollectionPlan = {
  name: string;
  modes: string[];
  create: FloatCreateRow[];
  aliases: FloatAliasRow[];
};

// FLOAT values are integers/px (or 0–100 opacity); round like the colour plan for byte-stability
// (identity here, but keeps the two plans symmetrical).
const roundFloat = (n: number): number => Math.round(n * 1e5) / 1e5;

/** Reshape one axis's per-mode `FigmaCollectionFile[]` (all sharing one variable order) into a
 *  `FloatCollectionPlan`. Mirrors the colour reshape: walk the first mode's vars, read each mode's
 *  value/alias at the same index. A single-mode axis is just a one-element array. */
const floatPlanFor = (name: string, files: FigmaCollectionFile[]): FloatCollectionPlan => {
  const modes = files.map((f) => f.$mode);
  const base = files[0]?.variables ?? [];
  const create: FloatCreateRow[] = base.map((v, i) => ({
    name: v.name,
    scopes: v.scopes,
    description: v.description,
    hidden: !!v.hiddenFromPublishing,
    valuesByMode: files.map((f) => roundFloat(f.variables[i].value as number)),
  }));
  const aliases: FloatAliasRow[] = base.map((v, i) => ({
    name: v.name,
    targetsByMode: files.map((f) => (f.variables[i] as FigmaVar).alias?.name ?? null),
  }));
  return { name, modes, create, aliases };
};

/**
 * The full FLOAT materialisation plan — one `FloatCollectionPlan` per axis, host-neutral and ready
 * for the plugin executor. PURE: calls the node-free `buildFigmaDims`/`buildFigmaLayout` and reshapes
 * — no I/O, so it bundles into the plugin main thread alongside `buildWritePlan`.
 */
export const buildFloatWritePlan = (theme: Theme): FloatCollectionPlan[] => {
  const dims = buildFigmaDims(theme);
  const layout = buildFigmaLayout(theme); // one FigmaCollectionFile per breakpoint mode
  return [
    floatPlanFor('core-dimension', [dims.dimension]),
    floatPlanFor('space', [dims.space]),
    floatPlanFor('radius', dims.radius), // 1 or 2 modes (Default [+ wireframe])
    floatPlanFor('size', [dims.size]),
    floatPlanFor('border-width', [dims.borderWidth]),
    floatPlanFor('focus', [dims.focus]),
    floatPlanFor('opacity', [dims.opacity]),
    floatPlanFor('layout', layout),
  ];
};
