/**
 * UI-iframe side of the typed bridge (#107). The figma-plugin-dev skill exposes this as a
 * React `usePluginMessage` hook; per docs/22 §3 we keep the PROTOCOL and drop the framework —
 * this is the vanilla `addEventListener` equivalent. Compiled under `tsconfig.ui.json` — has
 * `document`/`window`, NO `figma.*`.
 *
 * Wire shape (docs/18 §1): the iframe posts to its parent as `{ pluginMessage }`; the main
 * thread's message arrives on `window.message` as `event.data.pluginMessage`.
 */
import type { MainToUi, UiToMain } from './messages';

/** Send a typed message to the main thread. Figma unwraps `pluginMessage` on the sandbox side. */
export const postToMain = (msg: UiToMain): void => parent.postMessage({ pluginMessage: msg }, '*');

/** Subscribe to typed messages FROM the main thread. Returns an unsubscribe fn (the hook's
 *  cleanup, as a plain closure). Guards against foreign `postMessage`s that lack our envelope. */
export const onMainMessage = (handler: (msg: MainToUi) => void): (() => void) => {
  const listener = (event: MessageEvent): void => {
    const data = event.data?.pluginMessage;
    if (data && typeof data.type === 'string') handler(data as MainToUi);
  };
  window.addEventListener('message', listener);
  return () => window.removeEventListener('message', listener);
};
