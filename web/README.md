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
2. **Semantic colours** — the action-palette / status / disabled / icon levers.
3. **Typography** — the type lever group + a **type-scale specimen** (one composite per
   group at its resolved size, so a `typeScale`/family/weight change is visible where the
   small component chips can't show it).
4. **Form factor** — density / radius / elevation / layout / motion levers.

The **live preview + contrast overlay** (sample components, per-mode selector) render on
every lever stage (2–4), reflecting that stage's axis — colour on Semantic, type on
Typography, geometry on Form. The mode selector lives with the preview (modes only matter
once colour resolves, so it's not global).

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
- ✅ **Export** — from the menu: **design.md** (`toDesignMd`, re-imports here — the loop
  closes) and **tokens.json** (the resolved DTCG tree via `buildTree`, namespaced under the
  brand's `root`). Both are pure engine functions; the browser just Blob-downloads them.
- ✅ **Preview on every lever stage** — Semantic / Typography / Form each show the live
  component preview + overlay reflecting their axis; Typography also has a type-scale specimen.
- ⏭ **Next:** promote the engine to a named `@prism3/engine` workspace package so imports
  read by name instead of relative path; a browser-safe schema-validator export (import
  validation currently leans on `brandTheme` throwing, since the full validator is node-bound
  in `emit-dtcg`). *Type specimen:* the visual sample size is capped at 60px for layout — the
  real px is shown in each row's label.
