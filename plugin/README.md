# @prism3/plugin — the Figma plugin

The Figma **write host** over the Prism3 engine (see `../Prism3/docs/18-plugin-and-host-architecture.md`
and `22-plugin-plan.md`). The organizing goal is **one UI, many front doors**: the same vanilla
`web/src` control UI that drives the web dashboard runs verbatim inside this plugin's iframe; only
the write step below it is plugin-specific.

## Two contexts (the load-bearing split)

A Figma plugin runs in two isolated JS contexts that talk **only** by message passing (docs/18 §1):

| | Main thread (sandbox) | UI iframe |
|---|---|---|
| `figma.*` (document, variables, nodes) | ✅ only here | ❌ |
| DOM / rendering | ❌ | ✅ |
| entry | `src/main.ts` → `dist/main.js` (`manifest.main`) | `src/ui/` → `dist/ui.html` (`manifest.ui`) |
| tsconfig | `tsconfig.main.json` — plugin-typings, **no `dom` lib** | `tsconfig.ui.json` — DOM, **no plugin-typings** |

The split tsconfigs make context violations **compile errors**: a `document` reference in the main
thread or a `figma.*` reference in the UI won't typecheck. `src/messages.ts` is the pure shared wire
contract (two discriminated unions, one per direction) that compiles under both.

## The typed bridge

`src/bridge-main.ts` / `src/bridge-ui.ts` are thin typed wrappers over the raw channel — the
figma-plugin-dev skill's React `usePluginMessage` hook adapted to a vanilla `addEventListener`
wrapper (docs/22 §3). Every message is a variant of `UiToMain` / `MainToUi`; `assertNever` makes
each handler's `switch` exhaustive, so a new message type can't be silently dropped.

## Scope (#107 — the scaffold)

- ✅ `manifest.json` — `documentAccess: "dynamic-page"`, `networkAccess.allowedDomains: ["none"]`
  (the engine is bundled; nothing loads at runtime), `editorType: ["figma"]`, `api: "1.0.0"`.
  Verified against the current Figma plugin docs (2026-07).
- ✅ Two-context split + split tsconfigs (violations proven to fail compilation).
- ✅ Typed `postMessage` bridge with a placeholder UI that exercises the round-trip both ways
  (`ui-ready` → `main-ready`; button `ping` → `main-pong`).

## Scope (#108 — the write adapter)

- ✅ **`src/write-figma.ts` — `applyWritePlan(plan, figma.variables)`**: the live executor for the
  engine's host-neutral `WritePlan` (`../Prism3/engine/write-plan.ts`). Same pure colour-materialisation
  core the CLI paste-path (`materialise-to-figma.ts`) uses; a real executor instead of a JS-string emitter.
- ✅ **Idempotent** find-by-name → update in place (via the async `getLocalVariables*Async` getters
  required under `dynamic-page`). Three passes: `core-palette` (hidden primitives) → `color` create
  (N modes, literal fallbacks) → `color` aliases (**per-mode** binding — the collapse-guard).
- ✅ **Colour only** (`core-palette` + `color`), matching the CLI today. The theme is the bundled NB
  fixture (`nbThemeFrom(nbMeasured)`, JSON inlined) — `buildFigmaColor` bundles with **zero `node:`
  builtins** thanks to the node-free `engine/emit-figma-color.ts`. A UI button fires `apply-theme`.
- ✅ **Tested** without a live Figma: `test-write.ts` drives the executor against an in-memory
  `figma.variables` shim (twice — idempotency), asserting the materialisation contract. `npm test`.

## Scope (#109 — the read adapter)

- ✅ **`src/read-figma.ts` — `readFigmaVariables(figma.variables)`**: the inverse of `applyWritePlan`.
  Reads `core-palette` + `color` back into the engine's host-neutral `ReadbackSnapshot`
  (`../Prism3/engine/read-back.ts`), resolving each alias to its target variable NAME. Uses the same
  async getters, and shares the `VariablesApi` port with the write executor.
- ✅ **`verifyReadback(snapshot)`** (pure, engine) — ports the `materialise-to-figma` verify contract:
  modes distinct (collapse-guard), aliases resolve, slot scopes, field family present, retired/renamed
  roles absent, bare `foreground/danger` present, primitives hidden. A live health-check for a themed file.
- ✅ **Bridge + trigger** — `read-theme` / `read-result`; a "Read current file" button. The snapshot
  stays main-side until #110 hands it up to **seed the shared UI** from an existing themed file.
- ✅ **Tested**: `test-readback.ts` drives write→read→verify on the shim (`npm test` runs both harnesses).

## Scope (#110 — one build, two outputs: the no-fork capstone)

- ✅ **The iframe IS the shared `web/src` UI** — `plugin/build.mjs` bundles `../web/src/main.ts` into
  `dist/ui.html` (host=figma), retiring the placeholder. The same source the standalone web app builds;
  not a second UI. `tsconfig.ui.json` repoints at the shared UI so the DOM-clean/no-plugin-typings check
  runs on what's bundled.
- ✅ **Host selected at BUILD time** via `PRISM3_HOST` (esbuild `--define`; `web/src/prism3-host.d.ts`).
  `makeWriteHost` → `cssVarAdapter` for both (the preview paints CSS vars in either host); the COMMIT
  seam (`hostCommit`) differs — web downloads via the export bar, figma posts the live `BrandInput` to
  the main thread. esbuild DCEs the unused branch.
- ✅ **Write path = #108 verbatim**, only the theme source changed (bundled NB → live UI knobs):
  `apply-theme` carries a `BrandInput`; the main thread runs `buildWritePlan(buildFigmaColor(brandTheme(input)))`
  → `applyWritePlan`. On boot it runs #109 read-back → a `seed-info` panel.
- ⏭ **Read-SEED is informational** — full knob-rehydration needs `BrandInput` persisted in Figma
  shared-data (a `ReadbackSnapshot` is resolved values; the knobs can't be reverse-engineered). Follow-up.

## Run

```bash
npm install          # from the repo root (workspaces) — installs @figma/plugin-typings
npm run build -w @prism3/plugin      # → plugin/dist/main.js + plugin/dist/ui.html (shared UI inlined)
npm run watch -w @prism3/plugin      # rebuild on change (watches plugin/src + web/src)
npm run typecheck -w @prism3/plugin  # both contexts (main + ui)
npm test -w @prism3/plugin           # write + read executors against an in-memory figma.variables shim
```

Then in Figma: **Plugins → Development → Import plugin from manifest…** → pick `plugin/manifest.json`.
The UI iframe is a single self-contained HTML file (the bundled shared UI is inlined) — required because
the iframe has no server to fetch from and ships with no network access. Tune the brand with the knobs,
then open the brand menu → **↳ Apply to Figma variables** to materialise `core-palette` + `color` into
the current file; the panel reports any existing Prism3 theme found on boot.
