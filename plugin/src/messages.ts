/**
 * The typed postMessage bridge contract (docs/18 §1, docs/22 Phase 2 / #107).
 *
 * The plugin runs in TWO isolated JS contexts (main-thread sandbox + UI iframe) that can
 * only communicate by message passing. This module is the SHARED wire contract between
 * them: two discriminated unions, one per direction. It is deliberately PURE — no `figma.*`,
 * no `document`, no `node:` — so it compiles under BOTH tsconfigs (main = no DOM, ui = no
 * plugin API) and neither side can smuggle a context-specific type across the seam.
 *
 * Adding a message = add a variant here; the `type` discriminant makes every handler
 * exhaustively checkable (see `assertNever`). The real theming payloads (resolved token
 * model → figma.variables) arrive in #108; #107 ships only the scaffold + a ready/ping
 * round-trip that proves the bridge works both ways.
 */

/** Messages the UI iframe sends TO the main thread. Wrapped in `{ pluginMessage }` on the wire. */
export type UiToMain =
  /** UI booted and its handler is attached — main can now safely postMessage. */
  | { type: 'ui-ready' }
  /** Round-trip probe (scaffold self-test): main echoes it back as `main-pong`. */
  | { type: 'ping'; nonce: number }
  /** Materialise the theme into `figma.variables` (#108). Bare trigger — the main thread owns
   *  the theme (bundled `nbTheme()` today); #110 makes the theme live from the shared UI's knobs
   *  without reshaping this message. */
  | { type: 'apply-theme' }
  /** Read the current file's variables back + verify the materialisation contract (#109). Bare
   *  trigger; the full snapshot stays main-side until #110 needs to hand it up to seed the UI. */
  | { type: 'read-theme' };

/** Messages the main thread sends TO the UI iframe. */
export type MainToUi =
  /** Handshake ack + the host context the UI is running in (figma editor type / api version). */
  | { type: 'main-ready'; editorType: string; apiVersion: string }
  /** Reply to `ping`, echoing the nonce so the UI can match request↔response. */
  | { type: 'main-pong'; nonce: number }
  /** Result of an `apply-theme` write: ok + a human summary (counts / any misses) for the UI. */
  | { type: 'apply-result'; ok: boolean; summary: string }
  /** Result of a `read-theme` read-back + verify: ok (contract holds) + a human summary. */
  | { type: 'read-result'; ok: boolean; summary: string };

/** Narrow a discriminated union by its `type` tag — the payload a handler actually receives. */
export type OfType<U extends { type: string }, T extends U['type']> = Extract<U, { type: T }>;

/** Exhaustiveness guard: a `default:` branch calling this is a COMPILE error if a union
 *  variant is left unhandled — so a new message type can't be silently dropped. */
export const assertNever = (x: never): never => {
  throw new Error(`Unhandled message variant: ${JSON.stringify(x)}`);
};
