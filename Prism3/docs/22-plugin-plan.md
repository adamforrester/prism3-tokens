# 22 — Figma plugin build plan (the single-UI plan)

> `18` is the *capability grounding* (how a plugin executes, what the API can/can't do). This doc is
> the **build plan** for the actual plugin, decided in a planning session. The organizing goal:
> **one UI, one engine, three surfaces — no fork.** Backlog is filed as GH issues (#96–#114).

---

## 1. The vision — one UI, many front doors

A designer's knobs, a standalone web playground, and an agent's MCP calls all drive the **same**
engine through the **same** UI. We maintain **one** web UI (`web/src`) and reuse it verbatim inside
the Figma plugin — not two near-identical UIs. This is the owner's explicit goal, and it's the
architecture the pure-core design already affords (`18 §5`).

```
Engine core (pure TS, no deps) ─── runs anywhere: browser, plugin iframe, Node
        │
   UI layer (vanilla web/src) ─── shared VERBATIM in web + plugin iframe
        │  computes a resolved token model, calls apply(model)
   ┌────┴───────────────┬─────────────────────┐
  Web adapter            Plugin adapter          MCP adapter
  static host            main thread →           mcp.ts (exists)
  CSS vars / download     figma.variables         tool return
```

The **write-adapter seam** (`apply(model)`) is the load-bearing abstraction: same UI above it, a
per-host writer below. Defining it cleanly is what makes single-UI real (issue #106).

## 2. Decisions locked (planning session)

- **Vanilla, not React.** ✅ Reuse the existing vanilla-TS web UI verbatim; zero rewrite; keeps the
  dependency-free ethos. The figma-plugin-dev skill assumes React, but its *architecture* is ~95%
  framework-agnostic (two-context split, postMessage, split tsconfig, CSS tokens) — we keep the rules,
  drop the framework (the React `usePluginMessage` hook → a vanilla `addEventListener` bridge).
- **Plugin UI = the web bundle in the iframe.** ✅ One source, two build outputs (#110).
- **Standalone web = a static site.** ✅ The engine runs client-side (esbuild bundles it into the
  browser) — no backend. Vercel/Netlify static deploy (#104). Low effort.
- **MCP** — `mcp.ts` already exposes the engine; local (stdio) is trivial, a hosted/remote MCP is a
  later Node deploy if needed.
- **No code-library lane here** — the component code library lives in a separate repo.

## 3. Reconciling the figma-plugin-dev skill

The owner's skill (authored months ago, never installed) is a strong scaffold and maps onto `18`.
**Take:** the message-passing protocol, the **split tsconfig that makes context violations compile
errors** (plugin = no `dom` lib), project structure, and the gotchas (loadFontAsync, clientStorage,
teamLibrary-async, mixed fonts, readonly selection).
**Adapt:** the React specifics → vanilla.
**Age-correct + verify against live Figma docs before building:** the skill's sync
`figma.variables.getLocalVariables()` is superseded — new plugins require
`manifest.documentAccess: "dynamic-page"`, which makes the document getters **async**
(`getLocalVariablesAsync`); `18 §2` already has this. Validate the current variables *write* API +
manifest fields via Context7 / the Figma MCP skill when the build starts.

## 4. Phased plan → issues

| Phase | Issue | What |
|---|---|---|
| 1 ✅ | #106 | **Done (#119).** Extract the write-adapter seam (`apply(model)`) in the web UI — single-UI prerequisite |
| 2 ✅ | #107 | **Done (#120).** Plugin scaffold — manifest + two-context split + typed postMessage bridge (vanilla) |
| 3 ✅ | #108 | **Done.** Main-thread write adapter — pure `WritePlan` (`buildWritePlan`) → live `figma.variables`, idempotent; colour axis (`core-palette` + `color`) |
| 4 ✅ | #109 | **Done.** Read-back — `readFigmaVariables` → host-neutral `ReadbackSnapshot` + pure `verifyReadback` (contract check); seeds theming an existing file at #110 |
| 5 ✅ | #110 | **Done.** One build, two outputs — the shared `web/src` UI bundles into the plugin iframe (host selected at build time via `PRISM3_HOST`); live knobs → #108 write, boot read-back → #109 seed panel. The no-fork thesis, proven. |

Related lanes filed alongside: web functional-foundation + editor work (#96–#104), the engine
type-model expansion (#105), and the components-as-data → Figma spike (#111).

## 5. Open decisions (owner)

- **#112** — typography category-set reconciliation (Display/Title/Body/Button/Detail vs our 7 roles).
- **#114** — Gradients + Motion-tempo tab placement.
- **#113** — font availability + name resolution across surfaces (research).

## 6. Sequencing note

The web functional-foundation work (#96–#101) and the plugin phases are largely independent — the
foundation improves the *shared* UI, which the plugin inherits for free; it doesn't reshape the plugin
architecture. So they can proceed in parallel. The one hard dependency is #106 (the seam) before the
plugin can reuse the UI cleanly.

*Cross-refs: `18` (capability grounding), `07` (the E2E journey / portable core), `web/DESIGN-REVIEW.md`
(the UI review + the two reference plugins studied), the engine's `mcp.ts` / `materialise-to-figma.ts`.*
