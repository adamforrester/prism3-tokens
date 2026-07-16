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
  },
});

/**
 * Figma host — STUB (docs/22, #106). Same seam; in the plugin phase this writes the
 * resolved model into `figma.variables` (a collection per mode). Not wired yet — it
 * no-ops with a warning so the interface is provably swappable today. `scope` is
 * accepted for signature parity with `cssVarAdapter` and ignored.
 */
export const figmaVarAdapter = (_scope?: HTMLElement): WriteAdapter => ({
  apply() {
    console.warn('[prism3] figmaVarAdapter.apply — not wired yet (plugin phase, docs/22 §write-adapter).');
  },
});

/** The single swap point that selects the active backend. Web today; point this at
 *  `figmaVarAdapter` inside the plugin iframe. Scope is injected per render. */
export const makeWriteHost = (scope: HTMLElement): WriteAdapter => cssVarAdapter(scope);
