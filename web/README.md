# @prism3/web — the web dashboard

The first **rendering host** over the Prism3 engine core (see `../Prism3/docs/09-architecture-and-repos.md`
and `08-theming-interfaces.md`). It imports the same pure engine modules the Figma
plugin will, and renders from the shared contracts:

- **Knobs** from the lever manifest (`Prism3/engine/levers.ts`).
- **Live component preview + per-mode contrast overlay** from `previewSpec`
  (`preview.ts`) resolved through `resolvePreview(theme)` (`resolve-preview.ts`).
- **Generated palette ramps** straight off `brandTheme(input).palettes`.

The point is continuity: a lever added once in the core appears here and in the
Figma plugin without touching either UI (docs/08 §4).

## Shell — a four-stage build order

Organised as the order a theme actually composes:

1. **Brand primitives** — the bespoke Stage 1: a scalable brand-colour list (primary
   pinned + any number of accents), a tunable **neutral cast** with a **Derive⇄Pin**
   toggle (Pin surfaces the engine's `neutral.anchor` — a pre-defined grey the ramp is
   built around), and the generated ramps shown as labelled specimens.
2. **Semantic colours** — the action-palette / status / disabled / icon levers + the
   live preview and contrast overlay, with the per-mode selector (modes only matter
   once colour resolves, so the selector lives here, not globally).
3. **Typography** — the type lever group.
4. **Form factor** — density / radius / elevation / layout / motion levers.

Colour-axis edits re-resolve the engine and repaint only the volatile region (ramps or
preview), so knob focus is never lost; a failed combination is caught and the last-good
render preserved.

## Run

```bash
npm install          # from the repo root (workspaces) or from web/
npm run dev          # esbuild dev server on http://127.0.0.1:5173
npm run build        # bundle to web/dist/
npm run typecheck    # tsc --noEmit
```

The engine core stays **buildless** (run via `tsx`); only this adapter bundles it.
Imports reach the engine by relative path (`../../Prism3/engine/…`) and pull in
**pure modules only** — never the I/O shells (`nb-fixture`, `emit-*`, `cli`), which
touch `node:` and would not bundle for the browser.

## Scope (what's here vs. next)

- ✅ Four-stage shell; the colour axis is the live interactive loop (edit a brand
  colour / neutral → the engine re-resolves and the ramps + preview repaint).
- ✅ Stage 1 bespoke: brand-colour list (add / rename / remove), neutral Derive⇄Pin
  (`neutral.anchor`), generated ramps with the pinned-anchor marker.
- ✅ Preview colours + contrast overlay resolved live per mode; chips render real
  geometry/type from the token tree.
- ✅ **Brand setup** — the selector is a menu: switch example brands, **New brand**
  (minimal known-good starter), **Import design.md** (pasted `design.md` → `parseDesignMd`
  → loaded; a parse error or `brandTheme` rejection is surfaced, working brand untouched
  until both pass), and the per-brand **Name** + **Namespace (`root`)** fields (`root`
  validated inline against `^[a-z][a-z0-9-]*$`).
- ⏭ **Next:** **export tokens** from the UI (the other half of the `design.md`
  round-trip); move the live preview onto the type/form stages; promote the engine to a
  named `@prism3/engine` workspace package so imports read by name instead of relative
  path. *Note:* import validation leans on `brandTheme` throwing — the full schema
  validator is node-bound (`emit-dtcg`), so a browser-safe validator export is a
  prerequisite for stricter inline import checks.
