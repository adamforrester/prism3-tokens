/**
 * Main-thread (sandbox) side of the typed bridge (#107). Thin typed wrappers over
 * `figma.ui.postMessage` / `figma.ui.onmessage` so the controller never touches the raw,
 * untyped message channel. Compiled under `tsconfig.main.json` — has `figma.*`, NO `document`.
 */
import type { MainToUi, UiToMain } from './messages';

/** Send a typed message to the UI iframe. */
export const postToUi = (msg: MainToUi): void => figma.ui.postMessage(msg);

/** Register a typed handler for messages FROM the UI. Figma delivers the object the UI put in
 *  `{ pluginMessage }` as the first arg; the second carries the sender `origin` (unused here,
 *  relevant only for OAuth/network flows — Prism3 ships `allowedDomains:["none"]`). */
export const onUiMessage = (handler: (msg: UiToMain) => void): void => {
  figma.ui.onmessage = (msg: unknown) => handler(msg as UiToMain);
};
