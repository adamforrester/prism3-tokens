/**
 * The typed postMessage bridge contract (docs/18 §1, docs/22).
 *
 * The plugin runs in TWO isolated JS contexts (main-thread sandbox + UI iframe) that can
 * only communicate by message passing. This module is the SHARED wire contract between
 * them: two discriminated unions, one per direction. It is deliberately near-PURE — a
 * type-only import of `BrandInput` (erased at compile) — so it compiles under BOTH tsconfigs
 * (main = no DOM, ui = no plugin API) and neither side can smuggle a context-specific type
 * across the seam.
 *
 * Since #110 the iframe UI IS the shared `web/src` app (one UI, no fork). Its commit path posts
 * `apply-theme` (carrying the live `BrandInput`); the main thread rebuilds the write plan and runs
 * #108's `applyWritePlan`, then reports `apply-result`. On boot the main thread runs #109's
 * read-back and posts `seed-info` (informational — an existing themed file's contract summary).
 */
import type { BrandInput } from '../../Prism3/engine/theme';

/** Messages the UI iframe sends TO the main thread. Wrapped in `{ pluginMessage }` on the wire. */
export type UiToMain =
  /** UI booted and its message listener is attached — main can now safely postMessage (and it's
   *  the cue for the boot read-back). Posted by the figma commit adapter, not the shared UI body. */
  | { type: 'ui-ready' }
  /** Materialise this brand into `figma.variables` (#108). Carries the live `BrandInput` from the
   *  shared UI's knobs; the main thread rebuilds the plan + runs the executor. */
  | { type: 'apply-theme'; input: BrandInput };

/** Messages the main thread sends TO the UI iframe. */
export type MainToUi =
  /** Result of an `apply-theme` write: ok + a human summary (counts / any misses) for the UI. */
  | { type: 'apply-result'; ok: boolean; summary: string }
  /** Boot read-back (#109): whether an existing Prism3 theme in the file passes the contract, plus a
   *  human summary. Informational — the actual knob-rehydration is `restore-input` below. */
  | { type: 'seed-info'; ok: boolean; summary: string }
  /** Boot knob-rehydration (#131): the `BrandInput` persisted by the last apply, read back from the
   *  file's shared-data. The UI loads it wholesale so it opens on the persisted brand, not defaults.
   *  Sent only when a trusted blob exists (absence / drift → not sent → UI keeps defaults). */
  | { type: 'restore-input'; input: BrandInput };

/** Narrow a discriminated union by its `type` tag — the payload a handler actually receives. */
export type OfType<U extends { type: string }, T extends U['type']> = Extract<U, { type: T }>;

/** Exhaustiveness guard: a `default:` branch calling this is a COMPILE error if a union
 *  variant is left unhandled — so a new message type can't be silently dropped. */
export const assertNever = (x: never): never => {
  throw new Error(`Unhandled message variant: ${JSON.stringify(x)}`);
};
