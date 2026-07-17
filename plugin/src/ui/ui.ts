/**
 * Prism3 Figma plugin — UI IFRAME entry (scaffold), docs/22 Phase 2 / #107.
 *
 * This context has the DOM but NO `figma.*` (enforced by `tsconfig.ui.json`). In the scaffold
 * it's a placeholder that exercises the typed bridge both directions: on load it announces
 * `ui-ready` and renders the `main-ready` host context; a button fires a `ping` and shows the
 * matched `main-pong`. In #110 this whole file is replaced by the shared `web/src` UI verbatim —
 * the bridge (bridge-ui.ts / messages.ts) is what survives.
 *
 * Compiled under `tsconfig.ui.json` (DOM lib, no plugin-typings), so a stray `figma.*` here is
 * a COMPILE error — the mirror of main.ts's no-DOM rule.
 */
import { onMainMessage, postToMain } from '../bridge-ui';
import { assertNever } from '../messages';
import type { MainToUi } from '../messages';

const log = (line: string): void => {
  const el = document.getElementById('log');
  if (el) el.textContent = `${line}\n${el.textContent ?? ''}`.trimEnd();
};

onMainMessage((msg: MainToUi) => {
  switch (msg.type) {
    case 'main-ready':
      log(`✓ bridge up — editor: ${msg.editorType}, api: ${msg.apiVersion}`);
      return;
    case 'main-pong':
      log(`← main-pong (nonce ${msg.nonce})`);
      return;
    case 'apply-result':
      log(`${msg.ok ? '✓' : '✗'} apply → ${msg.summary}`);
      return;
    default:
      assertNever(msg); // compile error if a MainToUi variant is added but not handled here
  }
});

// A monotonically increasing nonce lets a reply be matched to its request.
let nonce = 0;
document.getElementById('ping')?.addEventListener('click', () => {
  const n = ++nonce;
  postToMain({ type: 'ping', nonce: n });
  log(`→ ping (nonce ${n})`);
});

// Trigger the #108 write adapter — the main thread owns the theme (bundled NB today).
document.getElementById('apply')?.addEventListener('click', () => {
  postToMain({ type: 'apply-theme' });
  log('→ apply-theme');
});

// Announce readiness only once the handler above is attached, so no main→UI message is missed.
postToMain({ type: 'ui-ready' });
