# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo is

A design-tokens-only repository — no source code, no build pipeline, no package manager. Every file is JSON. Two brands live side-by-side under `Tokens/`:

- `Tokens/Prism2/` — the PRISM design system (`nbds.pds.*` namespace), modes: `light`, `dark`, `wireframe`, plus `shared`.
- `Tokens/New Balance/` — New Balance brand tokens, modes: `desktop`, `mobile`, plus `shared`.

There is no README, no Cursor/Copilot rules, and no git history (this is not a git repo).

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
- There is nothing to build, lint, or test. Validation is by JSON parse + reference resolution; if asked to validate, check that every `{...}` alias in DTCG files resolves to an actual path, and every `alias` ID in raw-figma matches a `VariableID` defined somewhere in that brand's exports.
