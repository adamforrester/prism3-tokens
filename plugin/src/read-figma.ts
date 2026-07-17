/**
 * Prism3 Figma plugin — the MAIN-THREAD read adapter (docs/22 Phase 4 / #109).
 *
 * The inverse of `write-figma.ts`'s `applyWritePlan`: reads the current file's `core-palette` +
 * `color` collections back out of `figma.variables.*` into a host-neutral `ReadbackSnapshot`
 * (engine `read-back.ts`). Two uses: (a) seed the shared UI from an existing themed file at #110,
 * and (b) feed the pure `verifyReadback` so the materialisation contract can be checked live.
 *
 * Uses the async getters required under `documentAccess:"dynamic-page"`
 * (`getLocalVariableCollectionsAsync` / `getLocalVariablesAsync`) — the same ones `applyWritePlan`
 * proved live in #108. Alias values are resolved to the TARGET VARIABLE'S NAME (via an id→name map
 * over all vars), so the snapshot is pure, serialisable, and diffable against the write-side plan.
 *
 * Compiled under `tsconfig.main.json` — has `figma.*`, NO `document`. Shares the minimal
 * `VariablesApi` port with the write executor, so it's unit-testable against the same in-memory
 * shim (see `plugin/test-readback.ts`).
 */
import type { ReadbackSnapshot, ReadValue } from '../../Prism3/engine/read-back';
import type { VariablesApi, VariableAlias, ReadVarValue } from './write-figma';

const isAlias = (v: ReadVarValue): v is VariableAlias =>
  typeof v === 'object' && v !== null && (v as VariableAlias).type === 'VARIABLE_ALIAS';
const isRgb = (v: ReadVarValue): v is { r: number; g: number; b: number; a?: number } =>
  typeof v === 'object' && v !== null && 'r' in v;

/**
 * Read the live colour variables into a `ReadbackSnapshot`. Only the two colour collections
 * (`core-palette` + `color`) are read — the scope this lane materialises. Vars in other collections
 * are ignored. An alias whose target var can't be found is surfaced as `{ alias: null }` rather than
 * a fabricated name, so `verifyReadback`'s dangling-alias check stays honest.
 */
export const readFigmaVariables = async (vars: VariablesApi): Promise<ReadbackSnapshot> => {
  const collections = await vars.getLocalVariableCollectionsAsync();
  const allVars = await vars.getLocalVariablesAsync('COLOR');
  const nameById = new Map(allVars.map((v) => [v.id, v.name] as const));

  const palCol = collections.find((c) => c.name === 'core-palette');
  const colCol = collections.find((c) => c.name === 'color');

  const palette = palCol
    ? allVars
        .filter((v) => v.variableCollectionId === palCol.id)
        .map((v) => ({ name: v.name, scopes: v.scopes, hidden: v.hiddenFromPublishing }))
    : [];

  // modeId → mode name, so the snapshot is keyed by human mode names (light/dark/…), not Figma ids.
  const modeName = new Map((colCol?.modes ?? []).map((m) => [m.modeId, m.name] as const));
  const color = colCol
    ? allVars
        .filter((v) => v.variableCollectionId === colCol.id)
        .map((v) => {
          const valuesByMode: Record<string, ReadValue> = {};
          for (const [modeId, name] of modeName) {
            const raw = v.valuesByMode[modeId];
            if (raw === undefined) continue; // mode carries no value for this var
            if (isAlias(raw)) valuesByMode[name] = { alias: nameById.get(raw.id) ?? null };
            else if (isRgb(raw)) valuesByMode[name] = { r: raw.r, g: raw.g, b: raw.b, a: raw.a ?? 1 };
            // non-colour literals (string/number/boolean) can't occur on a COLOR var — skip defensively
          }
          return { name: v.name, scopes: v.scopes, valuesByMode };
        })
    : [];

  return {
    collections: collections.map((c) => ({ name: c.name, modes: c.modes.map((m) => m.name) })),
    palette,
    color,
  };
};
