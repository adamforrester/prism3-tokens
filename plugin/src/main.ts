/**
 * Prism3 Figma plugin — MAIN-THREAD controller (sandbox side), docs/22.
 *
 * The thin, plugin-only context: it has the Figma document API (`figma.*`) but NO DOM. Since #110
 * the iframe runs the SHARED `web/src` UI (one UI, no fork); this controller is the write/read
 * adapter below it:
 *   • `apply-theme` (carries the live `BrandInput` from the UI's knobs) → build the colour write
 *     plan + run #108's `applyWritePlan` against `figma.variables`.
 *   • on `ui-ready` → run #109's read-back + verify and post `seed-info` (informational: does an
 *     existing Prism3 theme in this file pass the contract).
 *
 * Compiled under `tsconfig.main.json` (plugin-typings, `lib` WITHOUT `dom`), so any accidental
 * `document`/`window` reference is a COMPILE error — the two-context split is enforced by types.
 */
import { onUiMessage, postToUi } from './bridge-main';
import { assertNever } from './messages';
import type { UiToMain } from './messages';
import { applyWritePlan } from './write-figma';
import { readFigmaVariables } from './read-figma';
import { buildFigmaColor } from '../../Prism3/engine/emit-figma-color';
import { buildWritePlan } from '../../Prism3/engine/write-plan';
import { verifyReadback } from '../../Prism3/engine/read-back';
import { persistInput, restoreInput } from './persist-figma';
import { brandTheme } from '../../Prism3/engine/theme';
import type { BrandInput } from '../../Prism3/engine/theme';

// Show the UI iframe. `__html__` is the bundled shared-UI HTML Figma injects from `manifest.ui`
// (the inlined `web/src` app; declared for the sandbox global in `figma-env.d.ts`). The shared
// `web/src` UI is laid out desktop-first (wide hero, 40px gutters), so a narrow plugin window
// clips it horizontally; 640×800 gives that content room. A proper narrow-viewport responsive
// pass on the shared UI (+ a resizable window) is tracked separately — this is the quick win.
figma.showUI(__html__, { width: 640, height: 800, themeColors: true });

/**
 * Materialise a brand into `figma.variables` (#108) — the theme now comes LIVE from the shared UI's
 * knobs (a `BrandInput`), not a bundled fixture. Same pure core, same executor: only the source of
 * the theme changed (#110). Idempotent find-by-name; colour axis (`core-palette` + `color`).
 */
const applyTheme = async (input: BrandInput): Promise<void> => {
  try {
    const plan = buildWritePlan(buildFigmaColor(brandTheme(input)));
    const r = await applyWritePlan(plan, figma.variables);
    // Persist the exact knobs alongside the variables (#131) — so re-opening this file rehydrates
    // the UI to THIS brand, not the default. Only after a real materialisation (inside the try).
    persistInput(figma.root, input);
    const summary =
      `palette ${r.paletteTotal} (+${r.paletteCreated}), color ${r.colorTotal} (+${r.colorCreated}), ` +
      `${r.bound} aliases bound` + (r.misses.length ? `, ${r.misses.length} misses` : '');
    postToUi({ type: 'apply-result', ok: r.misses.length === 0, summary });
  } catch (e) {
    postToUi({ type: 'apply-result', ok: false, summary: `write failed: ${(e as Error).message}` });
  }
};

/**
 * Boot read-back (#109): read the current file's colour variables + verify the materialisation
 * contract, and hand the UI a summary. Informational — reports that an existing themed file's
 * contract holds; the actual knob-rehydration is `restoreToUi` (#131), which is independent.
 */
const seedFromFile = async (): Promise<void> => {
  try {
    const snap = await readFigmaVariables(figma.variables);
    if (snap.color.length === 0) {
      postToUi({ type: 'seed-info', ok: true, summary: 'No existing Prism3 theme in this file — start from the knobs.' });
      return;
    }
    const v = verifyReadback(snap);
    const failed = Object.entries(v.checks).filter(([, ok]) => !ok).map(([k]) => k);
    const summary =
      `Existing theme: ${v.details.colorVars} colour vars, modes ${v.details.modes.join('/') || '—'}` +
      (v.ok ? ' — contract holds ✓' : ` — FAILED: ${failed.join(', ')}`);
    postToUi({ type: 'seed-info', ok: v.ok, summary });
  } catch (e) {
    postToUi({ type: 'seed-info', ok: false, summary: `read-back failed: ${(e as Error).message}` });
  }
};

/**
 * Boot knob-rehydration (#131): read the `BrandInput` the last apply persisted in shared-data and,
 * if a trusted blob exists, hand it to the UI so it opens on the persisted brand. Absence / drift /
 * corruption → `null` → nothing posted → the UI keeps its defaults (same as an unthemed file).
 * Independent of `seedFromFile` — the read-back verdict and the knob restore don't gate each other.
 */
const restoreToUi = (): void => {
  const input = restoreInput(figma.root);
  if (input) postToUi({ type: 'restore-input', input });
};

onUiMessage((msg: UiToMain) => {
  switch (msg.type) {
    case 'ui-ready':
      // UI's listener is attached — run the boot read-back (seed summary) + rehydrate the knobs.
      void seedFromFile();
      restoreToUi();
      return;
    case 'apply-theme':
      void applyTheme(msg.input);
      return;
    default:
      assertNever(msg); // compile error if a UiToMain variant is added but not handled here
  }
});
