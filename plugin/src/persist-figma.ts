/**
 * Prism3 Figma plugin — the MAIN-THREAD persistence adapter (docs/22 / #131).
 *
 * The knob-rehydration half of the round-trip: on every apply the controller stores the live
 * `BrandInput` in the file's shared plugin-data; on boot it reads it back so the shared UI opens on
 * the persisted brand instead of the default. This is the thin port over `figma.root` around the
 * pure `persist-input.ts` core (serialise + version guard) — the same pure-core / thin-port split as
 * `write-plan.ts` behind `write-figma.ts`.
 *
 * Shared-data (not private plugin-data) so a companion tool could read the brand too; the payload is
 * public by design (no secrets — it's the same knobs the UI shows). Stored on `figma.root` (one blob
 * per file, document-scoped), keyed by a fixed namespace/key.
 *
 * Compiled under `tsconfig.main.json` — has `figma.*`, NO `document`. `SharedDataPort` is the minimal
 * slice of the node API the adapter touches, so it's unit-testable against an in-memory shim
 * (`plugin/test-persist.ts`) with no live Figma; `figma.root` structurally satisfies it.
 */
import type { BrandInput } from '../../Prism3/engine/theme';
import { serializeBrandInput, deserializeBrandInput } from '../../Prism3/engine/persist-input';

/** The minimal shared-plugin-data surface the adapter needs — the slice of Figma's `PluginDataMixin`
 *  that `figma.root` exposes. Declaring it as a port is what lets the Node harness drive persist/
 *  restore with a `Map`-backed shim. `getSharedPluginData` returns `''` for an unset key. */
export interface SharedDataPort {
  getSharedPluginData(namespace: string, key: string): string;
  setSharedPluginData(namespace: string, key: string, value: string): void;
}

/** Shared-data namespace — must be ≥3 alphanumerics (Figma requirement). Key holds the brand blob. */
export const NS = 'prism3';
export const KEY = 'brandInput';

/** Persist the live brand into the file's shared-data (called after a successful apply). */
export const persistInput = (root: SharedDataPort, input: BrandInput): void =>
  root.setSharedPluginData(NS, KEY, serializeBrandInput(input));

/**
 * Read the persisted brand back, or `null` if none is stored / the blob can't be trusted (absence,
 * corruption, or schema drift all collapse to `null` via the pure guard) — the "start from defaults"
 * signal. `getSharedPluginData` returns `''` when unset, which short-circuits to `null`.
 */
export const restoreInput = (root: SharedDataPort): BrandInput | null => {
  const raw = root.getSharedPluginData(NS, KEY);
  return raw ? deserializeBrandInput(raw) : null;
};
