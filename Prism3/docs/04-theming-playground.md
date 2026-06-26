# 04 — Theming Playground / Dashboard (direction)

> A backlog **direction note**, not a spec or a commitment. Captures the intended
> consumer-facing surface for the engine: a simple theming dashboard that reskins
> real components and composed pages live as token values change. Prompted by a
> r/DesignSystems playground (below) that mirrors where we want to go. Not slated
> for build yet — documented so the direction survives.

---

## The reference

A r/DesignSystems post (June 2026) shared a token playground
(`dlbcodes-playground.vercel.app`) for a Vue 3 / Tailwind v4 / Headless UI
library. The shape we want to borrow:

- A left **"Customize"** panel: presets + per-token swatches (their labels —
  Brand/Accent, primary/secondary/tertiary/inverse, base/surface/inverse —
  independently land on the same **ordinal naming** we chose for our ladder).
- A right canvas of **real composed pages** (login, pricing, settings,
  notifications, usage) and components, all built from the *same* library
  primitives, **reskinning live** as you edit.
- Their stated architecture: *"a primitive palette feeds semantic tokens; you
  theme by overriding the semantic layer; runtime CSS variables, no rebuild."*

That architecture **is** ours (primitive ramps → per-mode semantic aliases). The
playground is the interactive evolution of what `engine/visualize.ts` already
produces as a static HTML report.

## Why this fits Prism3 — and goes further

The reference edits **one** layer (override semantic tokens). Prism3 *generates*
the primitives from a ~7-field brand input, so our dashboard edits **two** levels:

1. **Brand inputs** — primary OKLCH, neutral, `brandColors[]`, `actionPalette`,
   `surfaces`, `density`, `radiusScale`, `disabledStrategy`/`disabledMin`, status
   hues → re-run the engine, regenerate the whole system live.
2. **Semantic overrides** — nudge a specific resolved token after generation.

Reskin by *brand intent*, not just by hand-editing tokens. The engine is
dependency-free TypeScript, so it can run **in the browser** — generation + live
preview in one client, no backend.

## The differentiator: a live contract overlay

The engine already validates contrast contracts (currently 268/268). The
playground can surface **pass/fail badges live as you theme** —
`text.secondary 4.6:1 ✓`, `foreground.interactive.default` AA on the floor,
`scrim 40%`, disabled-floor status. The reference reskins but can't tell you if a
custom palette is still accessible; ours can, in real time. This is the feature
that makes it more than a swatch toy and showcases the engine's whole thesis.

## Platform: lead web, Figma plugin later

- **Web dashboard (lead).** Closest match to "real components + composed pages
  updating live." Live reskin = updating CSS variables (the reference's approach).
  Engine runs client-side; pick a component framework for the preview
  (React/Vue/Svelte) themed entirely through CSS custom properties.
- **Figma plugin (complementary, later).** A different job — push generated tokens
  into Figma **Variables**, mapping our four modes (light/dark/hc-light/hc-dark)
  to Figma variable modes, for design handoff. Same engine output, design-side
  surface. Not an either/or with the web app.

## Sketch of the feature set (when built)

- Brand-input controls (the engine's levers) + preset themes (NB, aurora, …).
- Semantic-token override panel.
- Mode switcher across the four generated modes.
- A canvas of **composed pages** (login, pricing, settings, a data table, an
  empty/error state) + a component gallery — all from one primitive set,
  CSS-variable-themed.
- **Live contract overlay** (the differentiator above).
- Export: download DTCG `tokens.json` + a CSS-variables sheet (and, via the Figma
  surface, sync to Variables).
- Builds on `visualize.ts` (already renders ramps + per-mode roles); the
  playground is its interactive successor.

## Open decisions (for when this graduates from backlog)

1. **Platform order** — web first (recommended), Figma second; or both.
2. **Edit level** — ship brand-input editing (our edge) and/or semantic overrides.
3. **Preview framework + component set** — which framework, which pages/components
   to build as the live canvas.
4. **Naming** — the app/playground needs a name (the engine is "Prism3"; the
   surface may want its own).
5. **Hosting/distribution** — static web deploy vs embedded in docs vs plugin.
