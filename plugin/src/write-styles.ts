/**
 * Prism3 Figma plugin — the MAIN-THREAD STYLES write adapter (shadow/gradient lane).
 *
 * The first NON-VARIABLE write: shadow → Effect Styles, gradient → Paint Styles (Figma *Styles*, a
 * different API from `figma.variables` — `createEffectStyle` / `createPaintStyle`). The live executor
 * for the host-neutral `StylesPlan` (engine `write-plan.ts` `buildStylesPlan`), the sibling of
 * `applyWritePlan` (colour) + `applyFloatPlan` (dims/layout).
 *
 * Faithful to the emit contract:
 *   • BOTH shadow style sets — `shadow/*` (light) + `shadow-dark/*` (dark) — as separate Effect
 *     Styles (Effect Styles can't carry Figma modes; a component swaps the pair by mode).
 *   • Gradients as a single `GRADIENT_LINEAR`/`GRADIENT_RADIAL` Paint with BAKED resolved stops +
 *     the plan's `gradientTransform`.
 *
 * IDEMPOTENT: find-by-name (get locals → Map) → reuse + overwrite, else create. Re-running mutates
 * the existing styles rather than duplicating.
 *
 * Compiled under `tsconfig.main.json` — has `figma.*`, NO `document`. The `StylesApi` port is the
 * minimal slice of `figma.*` the executor touches, so it's unit-testable against an in-memory shim
 * (see `plugin/test-write-styles.ts`); the real `figma` object structurally satisfies it.
 */
import type { StylesPlan, GradientTransform } from '../../Prism3/engine/write-plan';
import type { FigmaEffect } from '../../Prism3/engine/emit-figma-styles';

/** A colour as Figma stores it on an effect/stop — RGBA floats 0–1 (matches the engine's `FigmaColor`). */
type Rgba = { r: number; g: number; b: number; a: number };

/** A Figma gradient Paint (the subset the executor sets). `gradientStops` carry baked RGBA. */
type GradientPaint = {
  type: 'GRADIENT_LINEAR' | 'GRADIENT_RADIAL';
  gradientTransform: GradientTransform;
  gradientStops: { position: number; color: Rgba }[];
};

// The Style nodes' `effects`/`paints` are WRITE-ONLY here (the executor assigns them; it never reads
// them back). Figma's real `EffectStyle.effects` / `PaintStyle.paints` are `readonly Effect[]` /
// `readonly Paint[]` supersets (e.g. `Effect.spread` is optional, and there are non-shadow effect
// kinds), so typing these fields as our narrow write shape would make `figma` fail to satisfy the
// port. We type them as `readonly unknown[]` (assignable-from our shapes, satisfied-by Figma's) — the
// value we WRITE is validated by `StylesPlan`, and the shim asserts what landed.
/** Minimal Effect Style surface — mutable name/description + a write-only effects array. */
export interface EffectStyleNode {
  name: string;
  description: string;
  effects: readonly unknown[];
}
/** Minimal Paint Style surface — mutable name/description + a write-only paints array. */
export interface PaintStyleNode {
  name: string;
  description: string;
  paints: readonly unknown[];
}

/** The minimal `figma` styles surface the executor needs — declared as a port so the Node harness can
 *  drive it with a shim. In the real plugin, the global `figma` structurally satisfies this. */
export interface StylesApi {
  getLocalEffectStylesAsync(): Promise<EffectStyleNode[]>;
  getLocalPaintStylesAsync(): Promise<PaintStyleNode[]>;
  createEffectStyle(): EffectStyleNode;
  createPaintStyle(): PaintStyleNode;
}

/** What the styles executor did — surfaced to the UI + asserted by the harness. */
export type StylesApplyResult = {
  effects: { total: number; created: number };
  paints: { total: number; created: number };
};

/**
 * Materialise the styles plan into Figma Effect + Paint Styles. Idempotent find-by-name for each:
 * reuse an existing style with the same name (overwrite its props), else create one.
 */
export const applyStylesPlan = async (plan: StylesPlan, styles: StylesApi): Promise<StylesApplyResult> => {
  // ---- Effect Styles (shadows — both light `shadow/*` and dark `shadow-dark/*`) ----
  const effectByName = new Map((await styles.getLocalEffectStylesAsync()).map((s) => [s.name, s] as const));
  let effectsCreated = 0;
  for (const row of plan.effects) {
    let s = effectByName.get(row.name);
    if (!s) { s = styles.createEffectStyle(); s.name = row.name; effectByName.set(row.name, s); effectsCreated++; }
    s.description = row.description;
    s.effects = row.effects;
  }

  // ---- Paint Styles (gradients — single GradientPaint per style, baked stops) ----
  const paintByName = new Map((await styles.getLocalPaintStylesAsync()).map((s) => [s.name, s] as const));
  let paintsCreated = 0;
  for (const row of plan.paints) {
    let s = paintByName.get(row.name);
    if (!s) { s = styles.createPaintStyle(); s.name = row.name; paintByName.set(row.name, s); paintsCreated++; }
    s.description = row.description;
    s.paints = [{
      type: row.paintType,
      gradientTransform: row.gradientTransform,
      gradientStops: row.stops,
    }];
  }

  return {
    effects: { total: plan.effects.length, created: effectsCreated },
    paints: { total: plan.paints.length, created: paintsCreated },
  };
};
