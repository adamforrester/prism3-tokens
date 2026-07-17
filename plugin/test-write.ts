/**
 * Plugin write-adapter test (#108) — drives the REAL executor against an in-memory
 * `figma.variables` shim, so the whole three-pass materialisation is verified with no live Figma.
 *
 *   npx tsx plugin/test-write.ts
 *
 * The shim implements the minimal `VariablesApi` port `applyWritePlan` depends on, modelling the
 * behaviour that matters for the contract: collections have modes (mode[0] renamable, addMode
 * appends), variables hold per-mode values, and an alias is a `{type:'VARIABLE_ALIAS', id}` that
 * resolves back to a target var. Then it runs the executor TWICE on the same file to prove
 * idempotency (find-by-name → update, not duplicate) and asserts the materialisation contract:
 * primitives hidden + scoped, colour modes distinct (the collapse-guard), every alias bound, zero
 * misses.
 *
 * Mirrors the engine suite's dependency-free `ok(...)` style; exits non-zero on any failure.
 */
import { buildFigmaColor } from '../Prism3/engine/emit-figma-color';
import { buildWritePlan } from '../Prism3/engine/write-plan';
import { nbThemeFrom } from '../Prism3/engine/theme';
import { applyWritePlan } from './src/write-figma';
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

// ---- the in-memory figma.variables shim ----------------------------------------------------
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
  constructor(public id: string, public name: string) {
    this.modes = [{ modeId: `${id}:m0`, name: 'Mode 1' }];
  }
  renameMode(modeId: string, name: string): void {
    const m = this.modes.find((x) => x.modeId === modeId);
    if (m) m.name = name;
  }
  addMode(name: string): string { const modeId = `${this.id}:m${++this.seq + 0}`; this.modes.push({ modeId, name }); return modeId; }
}
class VariablesShim {
  collections: ShimCollection[] = [];
  vars: ShimVar[] = [];
  private cseq = 0;
  private vseq = 0;
  async getLocalVariableCollectionsAsync(): Promise<ShimCollection[]> { return this.collections; }
  async getLocalVariablesAsync(_type?: string): Promise<ShimVar[]> { return this.vars; }
  createVariableCollection(name: string): ShimCollection {
    const c = new ShimCollection(`c${++this.cseq}`, name); this.collections.push(c); return c;
  }
  createVariable(name: string, collection: ShimCollection, _t: 'COLOR'): ShimVar {
    const v = new ShimVar(`v${++this.vseq}`, name, collection.id); this.vars.push(v); return v;
  }
  createVariableAlias(target: ShimVar): { type: 'VARIABLE_ALIAS'; id: string } {
    return { type: 'VARIABLE_ALIAS', id: target.id };
  }
}

// ---- drive it -----------------------------------------------------------------------------
const plan = buildWritePlan(buildFigmaColor(nbThemeFrom(nbMeasured)));
const shim = new VariablesShim();

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- structural: the shim satisfies VariablesApi
const run = () => applyWritePlan(plan, shim as any);

const r1 = await run();
const varsAfterFirst = shim.vars.length;
const r2 = await run();

console.log('plugin write-adapter (#108) — executor against in-memory figma.variables shim\n');

// pass counts + idempotency
ok(r1.paletteCreated === plan.palette.length && r1.colorCreated === plan.color.create.length,
  `first run creates all vars (palette ${r1.paletteCreated}/${plan.palette.length}, color ${r1.colorCreated}/${plan.color.create.length})`);
ok(r2.paletteCreated === 0 && r2.colorCreated === 0,
  `second run creates 0 (idempotent find-by-name → update): palette +${r2.paletteCreated}, color +${r2.colorCreated}`);
ok(shim.vars.length === varsAfterFirst,
  `no duplicate vars across re-run (${shim.vars.length} total, stable)`);

// bindings + no misses
const expectedBound = plan.color.create.length * plan.color.modes.length;
ok(r1.bound === expectedBound && r2.bound === expectedBound,
  `every colour var aliased in every mode: ${r1.bound}/${expectedBound}`);
ok(r1.misses.length === 0 && r2.misses.length === 0,
  `zero unresolved bindings${r1.misses.length ? ' — ' + r1.misses.slice(0, 3).join(',') : ''}`);

// collections + modes
const palCol = shim.collections.find((c) => c.name === 'core-palette')!;
const colCol = shim.collections.find((c) => c.name === 'color')!;
ok(shim.collections.length === 2 && !!palCol && !!colCol, 'exactly two collections: core-palette + color');
ok(colCol.modes.map((m) => m.name).join(',') === plan.color.modes.join(','),
  `color collection modes match the plan (${colCol.modes.map((m) => m.name).join('/')})`);

// primitives hidden + scoped
const palVars = shim.vars.filter((v) => v.variableCollectionId === palCol.id);
ok(palVars.length > 0 && palVars.every((v) => v.hiddenFromPublishing && v.scopes.length > 0),
  'every core-palette primitive hidden from publishing + scoped');

// the collapse-guard: background/primary resolves to a DIFFERENT palette target per mode
const colVars = new Map(shim.vars.filter((v) => v.variableCollectionId === colCol.id).map((v) => [v.name, v]));
const byId = new Map(shim.vars.map((v) => [v.id, v]));
const bg = colVars.get('color/background/primary')!;
const bgTargets = colCol.modes.map((m) => {
  const val = bg.valuesByMode[m.modeId];
  return val && 'type' in val ? byId.get(val.id)?.name : undefined;
});
ok(!!bg && new Set(bgTargets).size > 1,
  `background/primary aliases a distinct palette step per mode (collapse-guard: ${bgTargets.join(' / ')})`);
ok(bgTargets.every((t) => typeof t === 'string' && t.startsWith('palette/')),
  'background/primary alias targets are palette primitives (cross-collection resolution)');

console.log(`\nplugin write-adapter: ${failed === 0 ? 'ALL PASS' : failed + ' FAILED'}`);
if (failed) process.exit(1);
