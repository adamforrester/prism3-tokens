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
- ⏭ **Next:** the main-thread write adapter — resolved token model → live `figma.variables`
  (#108); read-back to seed an existing file (#109); and bundling the shared `web/src` UI into the
  iframe in place of the placeholder (#110). The bridge (`messages.ts` / `bridge-*.ts`) is what
  survives that swap.

## Run

```bash
npm install          # from the repo root (workspaces) — installs @figma/plugin-typings
npm run build -w @prism3/plugin      # → plugin/dist/main.js + plugin/dist/ui.html
npm run watch -w @prism3/plugin      # rebuild on change
npm run typecheck -w @prism3/plugin  # both contexts (main + ui)
```

Then in Figma: **Plugins → Development → Import plugin from manifest…** → pick `plugin/manifest.json`.
The UI iframe is a single self-contained HTML file (the bundled JS is inlined) — required because the
iframe has no server to fetch from and ships with no network access.
