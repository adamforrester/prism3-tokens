/**
 * The write-adapter seam (docs/22, GH #106).
 *
 * The single-UI goal — one UI for the web playground AND the Figma plugin iframe —
 * hinges on a swappable WRITE surface. The UI computes a resolved token model
 * (`ResolvedPreview`, straight off the pure engine) and hands it to ONE `apply(model)`
 * interface, implemented per host:
 *   • web    → CSS custom properties (this file's `cssVarAdapter`)
 *   • plugin → `figma.variables` (the `figmaVarAdapter` stub, wired in the plugin phase)
 *
 * The UI never writes resolved token VALUES itself; it only references them by their
 * stable custom-property NAMES (`cssVar` / `typeVar`) and lets the active host fill
 * them in. Swap the host (see `makeWriteHost`) and the same UI drives a different
 * backend — no UI change. This is the seam that lets `web/src` be reused verbatim
 * inside the plugin.
 *
 * PURE-adjacent: imports only the engine's TYPES + DOM. No `node:*`.
 */
import type { ResolvedPreview } from '../../Prism3/engine/resolve-preview';

type Mode = ResolvedPreview['modes'][number];

/** Deterministic CSS custom-property name for a resolved binding ref. Shared by the
 *  adapter (which SETS it) and the UI (which REFERENCES it via `var()`), so the two
 *  can never drift. The category prefix (`color.` / `radius.` / `space.` / `type.`)
 *  survives sanitisation, so refs across categories can't collide. */
export const cssVarName = (ref: string): string => '--' + ref.replace(/[^a-z0-9]+/gi, '-').toLowerCase();
/** `var(--…)` reference for a colour or dimension binding — what the UI assigns. */
export const cssVar = (ref: string): string => `var(${cssVarName(ref)})`;

/** A typography composite resolves to three atoms; each gets its own property. */
export type TypeAtom = 'family' | 'weight' | 'size';
const typeAtomName = (ref: string, atom: TypeAtom): string => `${cssVarName(ref)}-${atom}`;
export const typeVar = (ref: string, atom: TypeAtom): string => `var(${typeAtomName(ref, atom)})`;

/** The one interface every host implements. `mode` selects which resolved slice of the
 *  (per-mode) model to project — the web preview shows one mode at a time. */
export interface WriteAdapter {
  apply(model: ResolvedPreview, mode: Mode): void;
}

/**
 * Web host — writes the resolved model as CSS custom properties on a scope element.
 * The preview chips (descendants of that scope) inherit the properties, so they read
 * `var(--…)` and never touch the resolved hex/px themselves.
 */
export const cssVarAdapter = (scope: HTMLElement): WriteAdapter => ({
  apply(model, mode) {
    const s = scope.style;
    // Colours — the per-mode slice. Sparse: a narrowed-modes theme only carries the
    // modes it generates, so a ref absent for this mode is simply left unset (the UI's
    // `var(--…, fallback)` handles the gap, mirroring the old presence guards).
    for (const [ref, byMode] of Object.entries(model.colors)) {
      const hex = byMode[mode];
      if (hex) s.setProperty(cssVarName(ref), hex);
    }
    // Dimensions — the effective value for this mode (wireframe zeroes radius, etc.), in px.
    for (const [ref, px] of Object.entries(model.dims)) {
      const eff = model.dimOverrides[ref]?.[mode] ?? px;
      s.setProperty(cssVarName(ref), `${eff}px`);
    }
    // Typography — mode-invariant; three atoms per composite.
    for (const [ref, t] of Object.entries(model.type)) {
      s.setProperty(typeAtomName(ref, 'family'), t.fontFamily);
      s.setProperty(typeAtomName(ref, 'weight'), String(t.fontWeight));
      s.setProperty(typeAtomName(ref, 'size'), `${t.fontSizePx}px`);
    }
    // Shadows — the per-mode CSS box-shadow (dark = reduced). Sparse like colours: a
    // mode without a resolved shadow is left unset (the UI's `var(--…, fallback)` covers it).
    for (const [ref, byMode] of Object.entries(model.shadows)) {
      const css = byMode[mode];
      if (css) s.setProperty(cssVarName(ref), css);
    }
  },
});

/**
 * The live PREVIEW seam is host-invariant: BOTH hosts paint the preview via CSS custom
 * properties, because the plugin iframe is a full DOM context too — the same chips render
 * identically in the browser and the iframe. So `makeWriteHost` returns `cssVarAdapter` for
 * every host; the plugin does NOT paint the preview into `figma.variables`.
 *
 * What differs per host is the COMMIT action (docs/22 #110) — "materialise this theme":
 *   • web    → download design.md / tokens.json (the UI's existing export bar)
 *   • figma  → post the live `BrandInput` to the plugin main thread, which runs #108's
 *              `applyWritePlan` against `figma.variables`.
 * That's the `HostCommit` seam below, selected at BUILD time by `PRISM3_HOST` (esbuild
 * `--define`), so the shared UI bundle never carries the other host's code.
 */
export const makeWriteHost = (scope: HTMLElement): WriteAdapter => cssVarAdapter(scope);

/** The commit seam: the per-host "apply this theme" action, distinct from the preview.
 *  `web` implementations are the UI's own exporters; `figma` posts to the main thread. */
export interface HostCommit {
  /** True only in the Figma plugin — the UI shows an "Apply to Figma variables" action + the
   *  read-back seed panel. `false` on web (the export bar is the commit path there). */
  readonly isFigma: boolean;
  /** Post the current brand to the host for materialisation (Figma only; no-op on web). The
   *  payload is the `BrandInput` — the main thread rebuilds the write plan + runs the executor,
   *  reusing #108 verbatim. Typed loosely (`unknown`) here to avoid a web→engine type import in
   *  the DOM layer; the plugin bridge + main thread carry the real `BrandInput` type. */
  postTheme(input: unknown): void;
  /** Register a callback for host→UI notifications: the #109 read-back seed summary, and the #131
   *  knob-rehydration (the persisted `BrandInput`, typed `unknown` here to keep this DOM layer free
   *  of the engine type import — the UI casts it to `BrandInput`). */
  onHostMessage(
    cb: (
      msg:
        | { kind: 'seed-info'; ok: boolean; summary: string }
        | { kind: 'restore-input'; input: unknown },
    ) => void,
  ): void;
}

/** The wire shape the iframe posts to the main thread. Kept in sync with the plugin's
 *  `messages.ts` `UiToMain` (`apply-theme`) — the bridge unwraps `{ pluginMessage }`. */
type UiApplyMsg = { type: 'apply-theme'; input: unknown };

/** Figma commit — the DOM-only bridge half (no `figma.*`; lives in the iframe). Posts to the
 *  main thread via `parent.postMessage` and listens for the main thread's replies. */
const figmaCommit = (): HostCommit => ({
  isFigma: true,
  postTheme(input) {
    parent.postMessage({ pluginMessage: { type: 'apply-theme', input } as UiApplyMsg }, '*');
  },
  onHostMessage(cb) {
    window.addEventListener('message', (e: MessageEvent) => {
      const m = (e.data && e.data.pluginMessage) as
        | { type?: string; ok?: boolean; summary?: string; input?: unknown }
        | undefined;
      if (!m) return;
      if (m.type === 'seed-info' || m.type === 'apply-result') {
        cb({ kind: 'seed-info', ok: !!m.ok, summary: String(m.summary ?? '') });
      } else if (m.type === 'restore-input' && m.input) {
        cb({ kind: 'restore-input', input: m.input });
      }
    });
    // Listener attached — signal the main thread it can post (and run the boot read-back, #109).
    parent.postMessage({ pluginMessage: { type: 'ui-ready' } }, '*');
  },
});

/** Web commit — the export bar IS the commit path, so this is inert (the UI wires its own
 *  download handlers). Present for signature parity so the UI can branch on `isFigma`. */
const webCommit = (): HostCommit => ({
  isFigma: false,
  postTheme() {/* web commits via the export bar (download design.md / tokens.json) */},
  onHostMessage() {/* no host messages on web */},
});

/** The single BUILD-TIME swap point. `PRISM3_HOST` is substituted by esbuild `--define`
 *  (`'web'` for the static site, `'figma'` for the plugin bundle); the unused branch is
 *  dead-code-eliminated, so neither bundle ships the other host's code. */
export const hostCommit = (): HostCommit => (PRISM3_HOST === 'figma' ? figmaCommit() : webCommit());
