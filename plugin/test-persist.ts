/**
 * Plugin persistence round-trip test (#131) — drives the REAL persist/restore adapter against an
 * in-memory shared-data shim, so the whole knob-rehydration path is verified with no live Figma.
 *
 *   npx tsx plugin/test-persist.ts
 *
 * The shim implements the minimal `SharedDataPort` (`getSharedPluginData`/`setSharedPluginData`) as
 * a Map keyed by `namespace\x00key`, modelling Figma's contract that an unset key reads back as ''.
 * Then: restore before any persist → null (unthemed file → defaults); persist a brand then restore →
 * the EXACT input back (the round-trip that closes #110's informational-only seed); and the blob
 * lands under the documented `prism3`/`brandInput` namespace/key. Mirrors test-write.ts's `ok(...)`
 * style; exits non-zero on any failure.
 */
import { persistInput, restoreInput, NS, KEY, type SharedDataPort } from './src/persist-figma';
import { serializeBrandInput } from '../Prism3/engine/persist-input';
import { exampleBrands } from '../Prism3/engine/emit-brandinput';
import type { BrandInput } from '../Prism3/engine/theme';

let failed = 0;
const ok = (cond: boolean, label: string): void => {
  if (cond) console.log(`  ✓ ${label}`);
  else { failed++; console.error(`  ✗ ${label}`); }
};

// ---- the in-memory shared-data shim ---------------------------------------------------------
class SharedDataShim implements SharedDataPort {
  private store = new Map<string, string>();
  private k(ns: string, key: string): string { return `${ns}\x00${key}`; }
  getSharedPluginData(ns: string, key: string): string { return this.store.get(this.k(ns, key)) ?? ''; }
  setSharedPluginData(ns: string, key: string, value: string): void { this.store.set(this.k(ns, key), value); }
}

const brand = exampleBrands()['aurora'] as BrandInput;

// (1) restore before any persist — an unthemed file reads back null (→ UI keeps its defaults).
const fresh = new SharedDataShim();
ok(restoreInput(fresh) === null, 'persist: restore on a fresh file → null (start from defaults)');

// (2) persist → restore round-trips the exact brand (the knob rehydration #110 couldn't do).
persistInput(fresh, brand);
const back = restoreInput(fresh);
ok(back !== null && JSON.stringify(back) === JSON.stringify(brand), 'persist: persist→restore returns the exact BrandInput (round-trip closed)');

// (3) the blob is stored under the documented namespace/key, as the serialised version-tagged JSON.
ok(fresh.getSharedPluginData(NS, KEY) === serializeBrandInput(brand), `persist: blob stored under ${NS}/${KEY} as the versioned serialisation`);

// (4) a corrupt blob at the key restores to null (defensive: won't crash the boot path).
const dirty = new SharedDataShim();
dirty.setSharedPluginData(NS, KEY, '{ broken');
ok(restoreInput(dirty) === null, 'persist: corrupt stored blob → null (boot falls back to defaults)');

console.log(`\nPlugin persist test: ${failed === 0 ? 'all passed' : failed + ' FAILED'}`);
if (failed) process.exitCode = 1;
