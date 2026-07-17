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
import { applyWritePlan } from './write-figma';
import { buildFigmaColor } from '../../Prism3/engine/emit-figma-color';
import { buildWritePlan } from '../../Prism3/engine/write-plan';
import { nbThemeFrom } from '../../Prism3/engine/theme';
import nbMeasured from '../../Prism3/schema/nb-measured.json';

// Show the UI iframe. `__html__` is the bundled UI HTML Figma injects from `manifest.ui`
// (declared for the sandbox global in `figma-env.d.ts`). Sizing is provisional — the real
// shared web UI (#110) will set its own.
figma.showUI(__html__, { width: 480, height: 720, themeColors: true });

/**
 * Materialise the theme into `figma.variables` (#108). The main thread owns the theme: it builds
 * the NB regression theme from the bundled measurement fixture (the engine's pure core — no disk,
 * esbuild inlines the JSON), resolves it to the colour collections, reshapes to the host-neutral
 * WritePlan, and hands it to the live executor. #110 swaps `nbThemeFrom(nbMeasured)` for the
 * shared UI's live knob state — nothing else here changes.
 */
const applyTheme = async (): Promise<void> => {
  try {
    const theme = nbThemeFrom(nbMeasured);
    const plan = buildWritePlan(buildFigmaColor(theme));
    const r = await applyWritePlan(plan, figma.variables);
    const summary =
      `palette ${r.paletteTotal} (+${r.paletteCreated}), color ${r.colorTotal} (+${r.colorCreated}), ` +
      `${r.bound} aliases bound` + (r.misses.length ? `, ${r.misses.length} misses` : '');
    postToUi({ type: 'apply-result', ok: r.misses.length === 0, summary });
  } catch (e) {
    postToUi({ type: 'apply-result', ok: false, summary: `write failed: ${(e as Error).message}` });
  }
};

onUiMessage((msg: UiToMain) => {
  switch (msg.type) {
    case 'ui-ready':
      // UI's listener is attached — safe to hand it the host context.
      postToUi({ type: 'main-ready', editorType: figma.editorType, apiVersion: figma.apiVersion });
      return;
    case 'ping':
      postToUi({ type: 'main-pong', nonce: msg.nonce });
      return;
    case 'apply-theme':
      void applyTheme();
      return;
    default:
      assertNever(msg); // compile error if a UiToMain variant is added but not handled here
  }
});
