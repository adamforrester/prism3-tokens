# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo is

A design-tokens-only repository — no source code, no build pipeline, no package manager. Every file is JSON. Two brands live side-by-side under `Tokens/`:

- `Tokens/Prism2/` — the PRISM design system (`nbds.pds.*` namespace), modes: `light`, `dark`, `wireframe`, plus `shared`.
- `Tokens/New Balance/` — New Balance brand tokens, modes: `desktop`, `mobile`, plus `shared`.

There is no README, no Cursor/Copilot rules. (The above describes the original hand-built `Tokens/` layer; see the Prism3 note below — that layer is now joined by a TypeScript generation engine, and the repo *is* git-tracked.)

## Prism3 — the generation engine (start here for engine work)

This repo now also contains **`Prism3/`** — a dependency-free TypeScript **token generation engine** (run via `tsx`; **no build, no `npm install`**) that *generates* the token layer from a small brand input instead of hand-authoring JSON. It is git-tracked and has its own docs. The `Tokens/` JSON above is the **legacy hand-built source and the engine's regression target** (the engine reproduces New Balance, then generalizes to new brands).

For any engine or token-generation task, read these first (they hold the durable state so work survives a context clear):
- `Prism3/docs/00-progress.md` — status, decisions log, and prioritized next steps.
- `Prism3/docs/07-e2e-journey.md` — the designer↔developer↔agent pipeline + portable-core architecture.
- `Prism3/engine/README.md` — how the engine works and how to run it.

Workflow: one PR per feature branch off `main` → squash-merge → delete branch → sync `main`.

## Two parallel token formats

Each brand contains the **same logical tokens twice**, in two formats. Edits usually need to land in both — they describe the same data for different consumers.

```
<Brand>/tokens/
├── raw-figma/   # Figma plugin export format
└── tokens/      # DTCG (W3C Design Tokens) format
```

### `raw-figma/*.json` — Figma variable export
Flat array under `variables[]`, file-scoped `$collection` + `$mode`. Colors are RGB float objects (`{r, g, b, a}` 0-1). References use `alias` + numeric `VariableID:*`. This is what Figma's Variables plugin reads/writes.

### `tokens/*.json` — DTCG format
Nested object tree (e.g. `nbds.pds.color.blueberry.100`). Each leaf has `$type`, `$value`, `$description`, `$extensions.figma`. Aliases use brace syntax: `"{pds.color.neutral-cool.850}"`. The `$extensions.figma.variableId` round-trips back to the raw-figma IDs.

When editing a value: change it in **both** the raw-figma file and the DTCG file, and keep the `variableId` linkage intact — it's how the two formats stay reconcilable.

## Mode organization differs per brand

- **Prism2** splits by appearance: `light/`, `dark/`, `wireframe/` each carry `brand-theme.json` + `motion.json`; primitives, typography, spacing, etc. live in `shared/`.
- **New Balance** splits by viewport: `desktop/typography.json`, `mobile/typography.json`; everything else (color, motion, focus, radius, layout, shadows, breakpoints, dimensions) lives in `shared/`.

Don't force one brand's structure onto the other.

## Naming conventions

- Prism2 tokens are namespaced `nbds.pds.<category>.<...>` — preserve this prefix.
- Token slugs in DTCG paths use kebab-case for words, dot-separated levels, with numeric scale steps as keys (`blueberry.100`, `blueberry.150`).
- The Figma exports use slash paths (`pds/color/blueberry/050`) — the `0` padding (e.g. `050`) only appears in raw-figma; DTCG drops it.

## Working with this repo

- Path quoting: the working directory contains spaces (`My Drive`, `Design Systems`, `New Balance`) — quote paths in Bash commands.
- `.DS_Store` files are present at every directory level; ignore them.
- There is nothing to build, lint, or test. Validation is by JSON parse + reference resolution; if asked to validate, check that every `{...}` alias in DTCG files resolves to an actual path, and every `alias` ID in raw-figma matches a `VariableID` defined somewhere in that brand's exports. (This applies to the `Tokens/` layer; the `Prism3/` engine has its own tests + regression — see its README.)

## Working principles (agent behavior)

Adapted from the Karpathy coding guidelines (github.com/multica-ai/andrej-karpathy-skills). The point is to turn imperative requests into declarative goals with verification loops.

1. **Think before coding.** State assumptions explicitly; surface ambiguities and tradeoffs *before* writing code. When a choice is genuinely the user's to make, ask — don't guess. (This project runs as a design dialogue; decisions get confirmed before they're built.)
2. **Simple implementation, rigorous correctness.** Write the minimum code that solves the request — no speculative abstractions or features beyond what was asked; stay dependency-free (own the math, don't pull libraries). BUT this is an accessibility / design-system domain: hold the *correctness* bar high — contrast contracts, field research (the knowledge-base + NB/Prism2 examples), and "better than the examples" are the standard, not gold-plating. Simple code, rigorous contracts — the two are not in tension.
3. **Surgical changes.** Edit only what the task needs; don't refactor adjacent code or fix unrelated pre-existing issues unless asked. One concern per PR. Preserve existing patterns, naming, and conventions.
4. **Goal-driven execution with verification.** Define verifiable success up front and loop until green. For the engine: regenerate `out/*`, then confirm the gates hold — `npx tsx Prism3/engine/test.ts` (unit tests), the NB regression, and every DTCG alias resolves + every mode contrast contract passes — before pushing.
