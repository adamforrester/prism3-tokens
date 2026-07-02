# @prism3/web — the web dashboard

The first **rendering host** over the Prism3 engine core (see `../Prism3/docs/09-architecture-and-repos.md`
and `08-theming-interfaces.md`). It imports the same pure engine modules the Figma
plugin will, and renders from the shared contracts:

- **Knobs** from the lever manifest (`Prism3/engine/levers.ts`).
- **Live component preview + per-mode contrast overlay** from `previewSpec`
  (`preview.ts`) resolved through `resolvePreview(theme)` (`resolve-preview.ts`).

The point is continuity: a lever added once in the core appears here and in the
Figma plugin without touching either UI (docs/08 §4).

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

## Scaffold scope (what's here vs. next)

- ✅ Knobs render read-only from the manifest; the mode switch is live.
- ✅ Preview colours + contrast overlay are resolved live per mode.
- ⏭ **Next:** wire the knobs to mutate the `BrandInput` and re-resolve (the real
  interactive loop); resolve geometry/type bindings from the token tree (needs a
  pure tree accessor in the core); promote the engine to a named `@prism3/engine`
  workspace package so imports read by name instead of relative path.
