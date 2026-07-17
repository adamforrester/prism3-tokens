/**
 * Plugin read-back round-trip test (#109) — drives the REAL write + read executors against one
 * in-memory `figma.variables` shim, with no live Figma.
 *
 *   npx tsx plugin/test-readback.ts
 *
 * The write→read round-trip is the whole point: `applyWritePlan(plan)` materialises the NB colour
 * variables into the shim, then `readFigmaVariables(shim)` reads them back into a `ReadbackSnapshot`,
 * and `verifyReadback(snap)` checks the materialisation contract holds on what was actually written.
 * Asserts the snapshot round-trips (colour var count + alias targets match the plan) and every
 * contract check passes. Mirrors `test-write.ts`'s shim + dependency-free `ok(...)` style.
 */
import { buildFigmaColor } from '../Prism3/engine/emit-figma-color';
import { buildWritePlan } from '../Prism3/engine/write-plan';
import { verifyReadback, verifyFloatReadback } from '../Prism3/engine/read-back';
import { buildFloatWritePlan } from '../Prism3/engine/write-plan';
import { nbThemeFrom } from '../Prism3/engine/theme';
import { applyWritePlan, applyFloatPlan } from './src/write-figma';
import { readFigmaVariables } from './src/read-figma';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const nbMeasured = JSON.parse(readFileSync(resolve(HERE, '../Prism3/schema/nb-measured.json'), 'utf8'));

let failed = 0;
const ok = (cond: boolean, label: string): void => {
  if (cond) console.log(`  ✓ ${label}`);
  else { failed++; console.error(`  ✗ ${label}`); }
};

// ---- the in-memory figma.variables shim (same shape as test-write.ts; FLOAT-capable for #146) ----
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
  // Honor the type filter like the real API — so the FLOAT round-trip can't be masked by an
  // all-returning shim (#146 review): a COLOR-filtered fetch must NOT surface FLOAT vars.
  async getLocalVariablesAsync(type?: string): Promise<ShimVar[]> { return type ? this.vars.filter((v) => v.resolvedType === type) : this.vars; }
  createVariableCollection(name: string): ShimCollection { const c = new ShimCollection(`c${++this.cseq}`, name); this.collections.push(c); return c; }
  createVariable(name: string, collection: ShimCollection, t: 'COLOR' | 'FLOAT' = 'COLOR'): ShimVar { const v = new ShimVar(`v${++this.vseq}`, name, collection.id, t); this.vars.push(v); return v; }
  createVariableAlias(target: ShimVar): { type: 'VARIABLE_ALIAS'; id: string } { return { type: 'VARIABLE_ALIAS', id: target.id }; }
}

// ---- write → read → verify ----------------------------------------------------------------
const plan = buildWritePlan(buildFigmaColor(nbThemeFrom(nbMeasured)));
const shim = new VariablesShim();
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- structural: shim satisfies VariablesApi
const api = shim as any;

await applyWritePlan(plan, api);
const snap = await readFigmaVariables(api);
const verdict = verifyReadback(snap);

console.log('plugin read-back (#109) — write → read → verify round-trip on the shim\n');

// snapshot round-trips the plan
ok(snap.collections.some((c) => c.name === 'core-palette') && snap.collections.some((c) => c.name === 'color'),
  'snapshot carries both collections (core-palette + color)');
ok(snap.palette.length === plan.palette.length,
  `palette round-trips: ${snap.palette.length}/${plan.palette.length} primitives`);
ok(snap.color.length === plan.color.create.length,
  `colour roles round-trip: ${snap.color.length}/${plan.color.create.length}`);

// alias targets read back match the plan's per-mode targets
const planAlias = new Map(plan.color.aliases.map((r) => [r.name, r.targetsByMode]));
let aliasMatch = 0, aliasWrong = 0;
for (const v of snap.color) {
  const want = planAlias.get(v.name);
  if (!want) continue;
  plan.color.modes.forEach((m, i) => {
    const got = v.valuesByMode[m];
    const gotTarget = got && 'alias' in got ? got.alias : null;
    if (gotTarget === want[i]) aliasMatch++; else aliasWrong++;
  });
}
ok(aliasWrong === 0 && aliasMatch === plan.color.create.length * plan.color.modes.length,
  `every alias target read back matches the plan: ${aliasMatch} matched, ${aliasWrong} wrong`);

// verify contract
ok(verdict.ok, 'verifyReadback: contract holds on the written file' + (verdict.ok ? '' : ` — ${Object.entries(verdict.checks).filter(([, v]) => !v).map(([k]) => k).join(',')}`));
ok(verdict.checks.modesDistinct, `collapse-guard: background/primary distinct per mode (${Object.values(verdict.details.backgroundPrimaryByMode).join(' / ')})`);
ok(verdict.checks.aliasesResolve && verdict.details.danglingAliases.length === 0, 'every alias resolves — 0 dangling');
ok(verdict.checks.slotScopes && verdict.checks.fieldFamilyPresent, 'slot scopes + field family match the contract');
ok(verdict.checks.primitivesHidden, 'core-palette primitives hidden from publishing');

// FLOAT axes (#146) — write the geometric collections into the SAME shim, read them back, verify.
const nbTheme = nbThemeFrom(nbMeasured);
await applyFloatPlan(buildFloatWritePlan(nbTheme), api);
const snap2 = await readFigmaVariables(api);
const fverdict = verifyFloatReadback(snap2, nbTheme.modes.includes('wireframe'));

ok(!!snap2.float && ['core-dimension', 'space', 'radius', 'size', 'border-width', 'focus', 'opacity'].every((n) => !!snap2.float![n]),
  'snapshot carries the FLOAT collections after the float write');
ok(fverdict.ok, 'verifyFloatReadback: contract holds' + (fverdict.ok ? '' : ` — ${Object.entries(fverdict.checks).filter(([, v]) => !v).map(([k]) => k).join(',')}`));
ok(fverdict.checks.aliasesResolve && fverdict.details.danglingAliases.length === 0, 'every FLOAT alias resolves — 0 dangling');
ok(fverdict.checks.dimensionsHidden, 'core-dimension primitives hidden from publishing');
ok(fverdict.checks.collectionsPresent, 'all expected FLOAT collections present in the read-back');

console.log(`\nplugin read-back: ${failed === 0 ? 'ALL PASS' : failed + ' FAILED'}`);
if (failed) process.exit(1);
