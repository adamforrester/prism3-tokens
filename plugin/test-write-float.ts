/**
 * Plugin FLOAT write-adapter test (#146) — drives the REAL `applyFloatPlan` executor against an
 * in-memory `figma.variables` shim, so the whole FLOAT materialisation is verified with no live Figma.
 *
 *   npx tsx plugin/test-write-float.ts
 *
 * Same shim shape as `test-write.ts`, widened for FLOAT vars (numeric per-mode values). Asserts the
 * eight FLOAT collections (`core-dimension`/`space`/`radius`/`size`/`border-width`/`focus`/`opacity`/
 * `layout`) materialise: all vars created, cross-collection aliases bound (space→dimension, size→…,
 * layout grid→space) with ZERO misses, opacity stored as 0–100, `core-dimension` primitives hidden,
 * and a re-run is idempotent (+0 created, no duplicates). Also drives a wireframe brand to prove the
 * two-mode `radius` collection (every radius aliases `dimension/0` in the wireframe mode).
 *
 * Mirrors the engine suite's dependency-free `ok(...)` style; exits non-zero on any failure.
 */
import { buildFloatWritePlan } from '../Prism3/engine/write-plan';
import { brandTheme } from '../Prism3/engine/theme';
import { applyFloatPlan } from './src/write-figma';
import exampleBrands from '../Prism3/schema/example-brands.json';
import type { BrandInput } from '../Prism3/engine/theme';

let failed = 0;
const ok = (cond: boolean, label: string): void => {
  if (cond) console.log(`  ✓ ${label}`);
  else { failed++; console.error(`  ✗ ${label}`); }
};

// ---- the in-memory figma.variables shim (FLOAT-capable) ------------------------------------
type Val = { r: number; g: number; b: number; a: number } | { type: 'VARIABLE_ALIAS'; id: string } | number;
class ShimVar {
  scopes: string[] = [];
  description = '';
  hiddenFromPublishing = false;
  valuesByMode: Record<string, Val> = {};
  constructor(public id: string, public name: string, public variableCollectionId: string, public resolvedType: 'COLOR' | 'FLOAT' = 'COLOR') {}
  setValueForMode(modeId: string, value: Val): void { this.valuesByMode[modeId] = value; }
}
class ShimCollection {
  modes: { modeId: string; name: string }[];
  private seq = 0;
  constructor(public id: string, public name: string) { this.modes = [{ modeId: `${id}:m0`, name: 'Mode 1' }]; }
  renameMode(modeId: string, name: string): void { const m = this.modes.find((x) => x.modeId === modeId); if (m) m.name = name; }
  addMode(name: string): string { const modeId = `${this.id}:m${++this.seq}`; this.modes.push({ modeId, name }); return modeId; }
}
class VariablesShim {
  collections: ShimCollection[] = [];
  vars: ShimVar[] = [];
  private cseq = 0;
  private vseq = 0;
  async getLocalVariableCollectionsAsync(): Promise<ShimCollection[]> { return this.collections; }
  // Honor the type filter like the real API (`getLocalVariablesAsync('COLOR')` returns ONLY COLOR
  // vars) — so an idempotency regression from a wrong type filter can't hide (#146 review).
  async getLocalVariablesAsync(type?: string): Promise<ShimVar[]> { return type ? this.vars.filter((v) => v.resolvedType === type) : this.vars; }
  createVariableCollection(name: string): ShimCollection { const c = new ShimCollection(`c${++this.cseq}`, name); this.collections.push(c); return c; }
  createVariable(name: string, collection: ShimCollection, t: 'COLOR' | 'FLOAT' = 'COLOR'): ShimVar { const v = new ShimVar(`v${++this.vseq}`, name, collection.id, t); this.vars.push(v); return v; }
  createVariableAlias(target: ShimVar): { type: 'VARIABLE_ALIAS'; id: string } { return { type: 'VARIABLE_ALIAS', id: target.id }; }
}

// ---- drive it: aurora (6 breakpoints, no wireframe) ----------------------------------------
const aurora = brandTheme(exampleBrands['aurora'] as unknown as BrandInput);
const plan = buildFloatWritePlan(aurora);
const shim = new VariablesShim();
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- structural: the shim satisfies VariablesApi
const run = () => applyFloatPlan(plan, shim as any);

const r1 = await run();
const varsAfterFirst = shim.vars.length;
const r2 = await run();

console.log('plugin FLOAT write-adapter (#146) — executor against in-memory figma.variables shim\n');

// collections present — the eight FLOAT axes
const EXPECTED = ['core-dimension', 'space', 'radius', 'size', 'border-width', 'focus', 'opacity', 'layout'];
ok(EXPECTED.every((n) => shim.collections.some((c) => c.name === n)),
  `all eight FLOAT collections created: ${EXPECTED.join(', ')}`);

// first run creates all vars; second is idempotent
const totalVars = plan.reduce((n, p) => n + p.create.length, 0);
const firstCreated = r1.collections.reduce((n, c) => n + c.created, 0);
const secondCreated = r2.collections.reduce((n, c) => n + c.created, 0);
ok(firstCreated === totalVars, `first run creates every FLOAT var (${firstCreated}/${totalVars})`);
ok(secondCreated === 0, `second run creates 0 (idempotent find-by-name → update): +${secondCreated}`);
ok(shim.vars.length === varsAfterFirst, `no duplicate vars across re-run (${shim.vars.length} total, stable)`);

// aliases bound across collections, zero misses
const expectedBound = plan.reduce((n, p) => n + p.aliases.reduce((m, a) => m + a.targetsByMode.filter((t) => t).length, 0), 0);
ok(r1.bound === expectedBound && r2.bound === expectedBound, `every FLOAT alias bound in every mode: ${r1.bound}/${expectedBound}`);
ok(r1.misses.length === 0 && r2.misses.length === 0,
  `zero unresolved bindings${r1.misses.length ? ' — ' + r1.misses.slice(0, 3).join(',') : ''}`);

// cross-collection alias: space/* aliases a core-dimension var (resolved to a different collection)
const dimCol = shim.collections.find((c) => c.name === 'core-dimension')!;
const spaceCol = shim.collections.find((c) => c.name === 'space')!;
const byId = new Map(shim.vars.map((v) => [v.id, v]));
const aSpace = shim.vars.find((v) => v.variableCollectionId === spaceCol.id && Object.values(v.valuesByMode).some((val) => typeof val === 'object' && 'type' in val))!;
const spaceTargetVal = aSpace && Object.values(aSpace.valuesByMode)[0];
const spaceTarget = spaceTargetVal && typeof spaceTargetVal === 'object' && 'type' in spaceTargetVal ? byId.get(spaceTargetVal.id) : undefined;
ok(!!spaceTarget && spaceTarget.variableCollectionId === dimCol.id && spaceTarget.name.startsWith('dimension/'),
  `space var aliases a core-dimension primitive across collections (${aSpace?.name} -> ${spaceTarget?.name})`);

// opacity stored as 0–100 (Figma OPACITY scope percent), not 0–1
const opCol = shim.collections.find((c) => c.name === 'opacity')!;
const opVals = shim.vars.filter((v) => v.variableCollectionId === opCol.id).flatMap((v) => Object.values(v.valuesByMode)).filter((v): v is number => typeof v === 'number');
ok(opVals.length > 0 && opVals.every((n) => n >= 0 && n <= 100) && opVals.some((n) => n > 1),
  `opacity values are 0–100 percent (max ${Math.max(...opVals)})`);

// core-dimension primitives hidden from publishing + scoped
const dimVars = shim.vars.filter((v) => v.variableCollectionId === dimCol.id);
ok(dimVars.length > 0 && dimVars.every((v) => v.hiddenFromPublishing && v.scopes.length > 0),
  'every core-dimension primitive hidden from publishing + scoped');

// layout carries one mode per breakpoint the brand ships (aurora: xs..2xl = 6)
const layoutCol = shim.collections.find((c) => c.name === 'layout')!;
ok(layoutCol.modes.length === plan.find((p) => p.name === 'layout')!.modes.length && layoutCol.modes.length >= 4,
  `layout collection has one mode per breakpoint (${layoutCol.modes.map((m) => m.name).join('/')})`);

// ---- wireframe brand: two-mode radius, every radius aliases dimension/0 in the wireframe mode ----
const wf = brandTheme({ ...(exampleBrands['aurora'] as unknown as BrandInput), modes: ['light', 'dark', 'wireframe'] });
const wfPlan = buildFloatWritePlan(wf);
const wfShim = new VariablesShim();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
await applyFloatPlan(wfPlan, wfShim as any);
const wfRadiusCol = wfShim.collections.find((c) => c.name === 'radius')!;
ok(wfRadiusCol.modes.some((m) => m.name === 'wireframe') && wfRadiusCol.modes.some((m) => m.name === 'Default'),
  `wireframe brand: radius collection has Default + wireframe modes (${wfRadiusCol.modes.map((m) => m.name).join('/')})`);
const wfById = new Map(wfShim.vars.map((v) => [v.id, v]));
const wfMode = wfRadiusCol.modes.find((m) => m.name === 'wireframe')!;
const radiusVars = wfShim.vars.filter((v) => v.variableCollectionId === wfRadiusCol.id);
const allWireToDim0 = radiusVars.every((v) => {
  const val = v.valuesByMode[wfMode.modeId];
  if (typeof val !== 'object' || !('type' in val)) return false;
  return wfById.get(val.id)?.name === 'dimension/0';
});
ok(radiusVars.length > 0 && allWireToDim0, 'wireframe mode: every radius aliases dimension/0 (sharp corners)');

console.log(`\nplugin FLOAT write-adapter: ${failed === 0 ? 'ALL PASS' : failed + ' FAILED'}`);
if (failed) process.exit(1);
