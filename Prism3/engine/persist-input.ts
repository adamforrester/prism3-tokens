/**
 * Prism3 engine — BRANDINPUT PERSISTENCE (serialise + version guard), docs/22 / #131.
 *
 * #110 seeds the shared UI from an existing themed file only INFORMATIONALLY: a `ReadbackSnapshot`
 * is resolved colour values, and the `BrandInput` knobs (primary OKLCH, neutral cast, levers) can't
 * be reverse-engineered from them. To truly round-trip, the plugin persists the exact `BrandInput`
 * alongside the variables it writes (in Figma shared-data) and rehydrates the UI from it on boot.
 *
 * This module is the pure half of that: the on-the-wire shape (`{ v, input }`) + the version guard.
 * A stored blob is only accepted when it parses AND its schema version matches — an old/foreign/
 * corrupt blob deserialises to `null`, so the UI falls back to defaults exactly as an unthemed file
 * does. Bump `PERSIST_VERSION` when the `BrandInput` shape changes incompatibly (and add a migration
 * here if old blobs should be upgraded rather than dropped).
 *
 * PURE — no `node:*`, no `figma.*`, no I/O. The plugin's `persist-figma.ts` port binds it to
 * `figma.root`; the engine suite tests it directly. `BrandInput` is plain JSON (OKLCH objects,
 * strings, numbers, arrays, booleans), so `JSON.stringify`/`parse` round-trips it losslessly and it
 * stays far under Figma's 100 kB shared-data entry cap.
 */
import type { BrandInput } from './theme';

/** Schema version of the persisted blob. Bump on an incompatible `BrandInput` change — a stored
 *  blob whose `v` differs is ignored (deserialises to `null`), never mis-read. */
export const PERSIST_VERSION = 1;

/** The wire shape written to shared-data: the version tag + the verbatim `BrandInput`. */
type Persisted = { v: number; input: BrandInput };

/** Serialise a `BrandInput` for storage — the version-tagged JSON blob. */
export const serializeBrandInput = (input: BrandInput): string =>
  JSON.stringify({ v: PERSIST_VERSION, input } satisfies Persisted);

/**
 * Parse a stored blob back into a `BrandInput`, or `null` if it can't be trusted: unparseable JSON,
 * a version mismatch (schema drift), or a missing `input`. `null` is the "start from defaults"
 * signal — identical to an unthemed file, so the caller never branches on absence vs. drift.
 */
export const deserializeBrandInput = (raw: string): BrandInput | null => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null; // corrupt / non-JSON blob
  }
  if (typeof parsed !== 'object' || parsed === null) return null;
  const { v, input } = parsed as Partial<Persisted>;
  if (v !== PERSIST_VERSION) return null; // absence of, or drift from, the current schema
  if (typeof input !== 'object' || input === null) return null;
  return input as BrandInput;
};
