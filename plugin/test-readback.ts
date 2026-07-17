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
import { verifyReadback } from '../Prism3/engine/read-back';
import { nbThemeFrom } from '../Prism3/engine/theme';
import { applyWritePlan } from './src/write-figma';
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

// ---- the in-memory figma.variables shim (same shape as test-write.ts) ----------------------
type Val = { r: number; g: number; b: number; a: number } | { type: 'VARIABLE_ALIAS'; id: string };
class ShimVar {
  scopes: string[] = [];
  description = '';
  hiddenFromPublishing = false;
  valuesByMode: Record<string, Val> = {};
  constructor(public id: string, public name: string, public variableCollectionId: string) {}
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
  async getLocalVariablesAsync(_type?: string): Promise<ShimVar[]> { return this.vars; }
  createVariableCollection(name: string): ShimCollection { const c = new ShimCollection(`c${++this.cseq}`, name); this.collections.push(c); return c; }
  createVariable(name: string, collection: ShimCollection, _t: 'COLOR'): ShimVar { const v = new ShimVar(`v${++this.vseq}`, name, collection.id); this.vars.push(v); return v; }
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

console.log(`\nplugin read-back: ${failed === 0 ? 'ALL PASS' : failed + ' FAILED'}`);
if (failed) process.exit(1);
