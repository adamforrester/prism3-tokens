/**
 * Prism3 Figma plugin — MAIN-THREAD controller (sandbox side), docs/22 Phase 2 / #107.
 *
 * This is the thin, plugin-only context: it has the Figma document API (`figma.*`) but NO DOM.
 * Its job in the scaffold is only to open the UI iframe and prove the typed bridge round-trips.
 * The real work — receiving a resolved token model and writing `figma.variables` / modes /
 * styles — is the write adapter in #108; nothing document-mutating lives here yet.
 *
 * Compiled under `tsconfig.main.json` (plugin-typings, `lib` WITHOUT `dom`), so any accidental
 * `document`/`window` reference is a COMPILE error — the two-context split is enforced by types.
 */
import { onUiMessage, postToUi } from './bridge-main';
import { assertNever } from './messages';
import type { UiToMain } from './messages';

// Show the UI iframe. `__html__` is the bundled UI HTML Figma injects from `manifest.ui`
// (declared for the sandbox global in `figma-env.d.ts`). Sizing is provisional — the real
// shared web UI (#110) will set its own.
figma.showUI(__html__, { width: 480, height: 720, themeColors: true });

onUiMessage((msg: UiToMain) => {
  switch (msg.type) {
    case 'ui-ready':
      // UI's listener is attached — safe to hand it the host context.
      postToUi({ type: 'main-ready', editorType: figma.editorType, apiVersion: figma.apiVersion });
      return;
    case 'ping':
      postToUi({ type: 'main-pong', nonce: msg.nonce });
      return;
    default:
      assertNever(msg); // compile error if a UiToMain variant is added but not handled here
  }
});
