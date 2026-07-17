/**
 * Prism3 Figma plugin — the MAIN-THREAD write adapter (docs/22 Phase 3 / #108).
 *
 * The live executor for the host-neutral `WritePlan` (engine `write-plan.ts`). Where the CLI
 * path (`materialise-to-figma.ts`) emits plugin-JS strings to paste into `figma_execute`, this
 * runs the SAME three passes directly against `figma.variables.*` on the main thread. Same pure
 * core, real executor.
 *
 * Faithful to the materialisation contract (docs/10 §3):
 *   1. `core-palette` — one Default mode, literal RGBA, primitives hidden from publishing.
 *   2. `color` create — rename mode[0] + add the rest; every var gets a literal per-mode
 *      fallback value (pass A: every alias TARGET exists before any alias binds).
 *   3. `color` aliases — bind each mode to its OWN target (pass B — the collapse-guard).
 *
 * IDEMPOTENT: find-by-name → update in place. Re-running on a themed file mutates the existing
 * collections/variables rather than duplicating them (so the designer can re-apply after a knob
 * change without cleanup). Uses the async getters required under `documentAccess:"dynamic-page"`
 * (`getLocalVariableCollectionsAsync` / `getLocalVariablesAsync`).
 *
 * Compiled under `tsconfig.main.json` — has `figma.*`, NO `document`. The `VariablesApi` port is
 * the minimal slice of `figma.variables` the executor touches, so the whole pass sequence is
 * unit-testable against an in-memory shim (see `plugin/test-write.mjs`) with no real Figma.
 */
import type { WritePlan, Rgba, FloatCollectionPlan } from '../../Prism3/engine/write-plan';

/** The minimal `figma.variables` surface the executor needs. Declaring it as a port (rather than
 *  reaching for the global `figma`) is what lets the Node harness drive `applyWritePlan` with a
 *  shim. In the real plugin, `figma.variables` structurally satisfies this. */
export interface VariablesApi {
  getLocalVariableCollectionsAsync(): Promise<VarCollection[]>;
  getLocalVariablesAsync(type?: string): Promise<Variable[]>;
  createVariableCollection(name: string): VarCollection;
  createVariable(name: string, collection: VarCollection, resolvedType: 'COLOR' | 'FLOAT'): Variable;
  createVariableAlias(target: Variable): VariableAlias;
}
export interface VarMode { modeId: string; name: string }
export interface VarCollection {
  id: string;
  name: string;
  modes: VarMode[];
  renameMode(modeId: string, newName: string): void;
  addMode(name: string): string;
}
export interface VariableAlias { type: 'VARIABLE_ALIAS'; id: string }
/** The value a variable can hold in a mode, as the READ executor sees it (#109). A SUPERSET of the
 *  real Figma `VariableValue` union (alias | RGB(A) | number | string | boolean), so `figma.variables`
 *  structurally satisfies this port; `{ r; g; b; a? }` covers both RGB and RGBA. The write path only
 *  ever sets `Rgba | VariableAlias` (a subset), which is assignable here. */
export type ReadVarValue = VariableAlias | { r: number; g: number; b: number; a?: number } | number | string | boolean;
export interface Variable {
  id: string;
  name: string;
  variableCollectionId: string;
  scopes: string[];
  description: string;
  hiddenFromPublishing: boolean;
  // Per-mode values as Figma stores them — read by the READ executor (#109); the write path sets
  // them via setValueForMode (which takes the narrow Rgba | VariableAlias the writer produces).
  valuesByMode: Record<string, ReadVarValue>;
  setValueForMode(modeId: string, value: Rgba | VariableAlias | number): void;
}

/** What the executor did — surfaced to the UI + asserted by the harness. */
export type ApplyResult = {
  paletteTotal: number;
  paletteCreated: number;
  colorTotal: number;
  colorCreated: number;
  /** alias bindings written = colour vars × modes (minus any skipped null targets). */
  bound: number;
  /** unresolved bindings: a colour var or its alias target that wasn't found (should be empty). */
  misses: string[];
};

// Idempotent get-or-create for a collection by name (find-by-name → reuse). Scopes the returned
// var index to that collection so a name collision across collections can't cross-wire.
const upsertCollection = async (
  vars: VariablesApi,
  name: string,
): Promise<{ collection: VarCollection; byName: Map<string, Variable> }> => {
  const collection =
    (await vars.getLocalVariableCollectionsAsync()).find((c) => c.name === name) ??
    vars.createVariableCollection(name);
  // NB: fetch ALL local variables (no type filter) — `getLocalVariablesAsync('COLOR')` returns ONLY
  // COLOR-typed vars, which would make `byName` empty for a FLOAT collection and break idempotency
  // (re-apply would re-create every FLOAT var → duplicates). We scope by `variableCollectionId`
  // anyway, so the unfiltered fetch is correct for both the colour and FLOAT (#146) executors.
  const byName = new Map(
    (await vars.getLocalVariablesAsync())
      .filter((v) => v.variableCollectionId === collection.id)
      .map((v) => [v.name, v] as const),
  );
  return { collection, byName };
};

/**
 * Materialise the colour write-plan into `figma.variables`. Runs the three passes in order —
 * palette first (the colour aliases target it), then the two-pass colour write.
 */
export const applyWritePlan = async (plan: WritePlan, vars: VariablesApi): Promise<ApplyResult> => {
  // ---- pass 1: core-palette (one Default mode, literal RGBA, hidden primitives) ----
  const pal = await upsertCollection(vars, 'core-palette');
  const palModeId = pal.collection.modes[0].modeId;
  let paletteCreated = 0;
  for (const row of plan.palette) {
    let v = pal.byName.get(row.name);
    if (!v) { v = vars.createVariable(row.name, pal.collection, 'COLOR'); pal.byName.set(row.name, v); paletteCreated++; }
    v.scopes = row.scopes;
    v.description = row.description;
    v.hiddenFromPublishing = row.hidden;
    v.setValueForMode(palModeId, row.value);
  }

  // ---- pass 2: color create (N modes, literal per-mode fallback values) ----
  const { modes, create, aliases } = plan.color;
  const col = await upsertCollection(vars, 'color');
  // Mode[0] is the collection's initial mode (rename it); the rest are added or reused by name.
  col.collection.renameMode(col.collection.modes[0].modeId, modes[0]);
  const modeIds: Record<string, string> = { [modes[0]]: col.collection.modes[0].modeId };
  for (let i = 1; i < modes.length; i++) {
    const existing = col.collection.modes.find((m) => m.name === modes[i]);
    modeIds[modes[i]] = existing ? existing.modeId : col.collection.addMode(modes[i]);
  }
  let colorCreated = 0;
  for (const row of create) {
    let v = col.byName.get(row.name);
    if (!v) { v = vars.createVariable(row.name, col.collection, 'COLOR'); col.byName.set(row.name, v); colorCreated++; }
    v.scopes = row.scopes;
    v.description = row.description;
    modes.forEach((m, i) => v!.setValueForMode(modeIds[m], row.valuesByMode[i]));
  }

  // ---- pass 3: color aliases (bind PER MODE — each mode to its OWN target) ----
  // Alias TARGETS are palette primitives (in core-palette), so resolve against BOTH collections'
  // vars, not just the colour collection — mirrors the CLI pass's unscoped global name map.
  const targetByName = new Map<string, Variable>([...pal.byName, ...col.byName]);
  let bound = 0;
  const misses: string[] = [];
  for (const row of aliases) {
    const v = col.byName.get(row.name);
    if (!v) { misses.push(`var:${row.name}`); continue; }
    modes.forEach((m, i) => {
      const target = row.targetsByMode[i];
      if (!target) return; // no alias for this mode (literal-only) — leave the pass-A value
      const tv = targetByName.get(target);
      if (!tv) { misses.push(`${row.name} @${m} -> ${target}`); return; }
      v.setValueForMode(modeIds[m], vars.createVariableAlias(tv));
      bound++;
    });
  }

  return {
    paletteTotal: plan.palette.length,
    paletteCreated,
    colorTotal: create.length,
    colorCreated,
    bound,
    misses,
  };
};

/** What the FLOAT executor did — surfaced to the UI + asserted by the harness (#146). */
export type FloatApplyResult = {
  /** one entry per axis collection: name + total vars + how many were newly created. */
  collections: { name: string; total: number; created: number }[];
  /** alias bindings written across all float collections (space→dimension, size→…, etc.). */
  bound: number;
  /** unresolved bindings — a var or alias target not found (should be empty). */
  misses: string[];
};

/**
 * Materialise the FLOAT-variable axes into `figma.variables` (#146) — `core-dimension`, `space`,
 * `radius`, `size`, `border-width`, `focus`, `opacity`, and `layout`. Runs the SAME two-pass shape
 * as the colour `applyWritePlan`, generalised over N collections:
 *   • pass A — per collection: upsert, set up its modes (rename mode[0], add/reuse the rest by name),
 *     then create-or-update each FLOAT var (scopes, description, hidden, literal per-mode values).
 *   • pass B — build ONE global name→Variable map across ALL float collections (the cross-collection
 *     aliases: space→dimension, size→dimension/space, radius→dimension, layout grid→space), then bind
 *     each alias per mode against it.
 * Idempotent find-by-name → update in place (re-apply = +0 created). Uses the same async getters +
 * `upsertCollection` helper as the colour path, so it drives the in-memory shim identically.
 */
export const applyFloatPlan = async (
  plans: FloatCollectionPlan[],
  vars: VariablesApi,
): Promise<FloatApplyResult> => {
  const collections: FloatApplyResult['collections'] = [];
  // Per-collection modeId maps, kept for pass B; and the global name→Variable map across all axes.
  const modeIdsByCollection = new Map<string, Record<string, string>>();
  const byNameGlobal = new Map<string, Variable>();

  // ---- pass A: create/update every FLOAT var in every collection (literal per-mode values) ----
  for (const p of plans) {
    const { collection, byName } = await upsertCollection(vars, p.name);
    // Mode[0] is the collection's initial mode (rename it); the rest are added or reused by name.
    collection.renameMode(collection.modes[0].modeId, p.modes[0]);
    const modeIds: Record<string, string> = { [p.modes[0]]: collection.modes[0].modeId };
    for (let i = 1; i < p.modes.length; i++) {
      const existing = collection.modes.find((m) => m.name === p.modes[i]);
      modeIds[p.modes[i]] = existing ? existing.modeId : collection.addMode(p.modes[i]);
    }
    modeIdsByCollection.set(p.name, modeIds);

    let created = 0;
    for (const row of p.create) {
      let v = byName.get(row.name);
      if (!v) { v = vars.createVariable(row.name, collection, 'FLOAT'); byName.set(row.name, v); created++; }
      v.scopes = row.scopes;
      v.description = row.description;
      v.hiddenFromPublishing = row.hidden;
      p.modes.forEach((m, i) => v!.setValueForMode(modeIds[m], row.valuesByMode[i]));
    }
    collections.push({ name: p.name, total: p.create.length, created });
    // Fold this collection's vars into the global map (alias targets span collections).
    for (const [name, v] of byName) byNameGlobal.set(name, v);
  }

  // ---- pass B: bind aliases PER MODE against the global name map (targets exist after pass A) ----
  let bound = 0;
  const misses: string[] = [];
  for (const p of plans) {
    const modeIds = modeIdsByCollection.get(p.name)!;
    for (const row of p.aliases) {
      const v = byNameGlobal.get(row.name);
      if (!v) { misses.push(`var:${row.name}`); continue; }
      p.modes.forEach((m, i) => {
        const target = row.targetsByMode[i];
        if (!target) return; // literal-only for this mode — leave the pass-A value
        const tv = byNameGlobal.get(target);
        if (!tv) { misses.push(`${row.name} @${m} -> ${target}`); return; }
        v.setValueForMode(modeIds[m], vars.createVariableAlias(tv));
        bound++;
      });
    }
  }

  return { collections, bound, misses };
};
