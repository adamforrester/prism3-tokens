# 25 — Output: canvas style-guide (assessment + spec seed)

> The **Output** lane of the dashboard IA (docs/23 §2) — deferred, Figma-only, **channel-gated**: it
> writes an actual style-guide **table onto the Figma canvas** with the resolved token values, distinct
> from the existing plugin write path (which themes a file by writing variables + styles, docs/18).
> The owner has an unfinished plugin ("**Token Press** / style-guide-generator") that already does the
> canvas write; this doc captures a read-only assessment of it + the design worth keeping + the
> port-vs-rebuild decision, so the Output work can start from a spec instead of re-deriving. Assessed at
> external branch `assess/token-press-external` `df38194` (`_external/style-guide-generator/`), which is
> transient and will be deleted — this doc is the durable record.

---

## What the prior art does (Token Press)

A single-purpose Figma plugin. It reads **variables + text styles from the currently-open Figma file**
(the Variables API — not its own `tokens/*.json`, which are DTCG reference exports only) and draws a
**token table as native canvas nodes**. The table is one frame in Figma's **GRID auto-layout** (2px
gaps that read as gridlines, all-`HUG` tracks, 8px radius, clipped); each cell is an instance of a
reusable component set built on a hidden `Style Guide Components` page.

Four generators, all functional (not stubbed):
- **Color** — `[Title?] [Step?] Swatch Value [Alias?] Token [Description?]`; swatch bound to the variable, Value walks the alias chain to a resolved RGBA and formats hex/rgb/hsl/hsb, auto-detects alpha<1 → a checkerboard transparency swatch.
- **Dimension** — `Name Value [REM] [Alias] Token [Description] [Visual]`; sorted by resolved value; optional spacing-ruler / radius-corner specimen.
- **Text styles** — `Name Family Size [REM] Weight LineHeight LetterSpacing [Para] [Decoration] [Description] Example`; per-property alias pills; an "Abc 123" example rendered in the actual style.
- **Font variables** — mixed STRING+FLOAT font-scoped variables with an optional rendered example.

**Architecture.** Standard two-context plugin (sandbox `src/plugin/*` + UI iframe `src/ui/*`, esbuild
one-file bundle). The core `style-guide-generator.ts` is **2,980 lines** with Figma-variable reads and
node drawing **interleaved** in every generator — no data-model seam, no tests.

**Completeness (author's backlog):** core table drawing works; **missing**: effects/shadows, gradients,
color-styles, export (CSS/JSON/SCSS), search/filter, persistence, tests. Known rough spots: fragile
GRID placement in the dim/text/font paths (rely on append-order auto-flow), a fixed-180px alias pill
that truncates long names, hard dependency on Figma's newer GRID auto-layout API.

---

## The design worth keeping (the IP)

This is the reason to assess rather than start blank — the **category-aware layout** is thoughtful and
should be lifted verbatim into a Prism3 `StyleGuidePlan` spec, even though the drawing code gets
rewritten (see recommendation):

- **Per-category column sets** (color / dimension / type / font) + header and column-visibility rules.
- **Specimen catalog**: swatch types (`default` solid · `text` "Aa" · `icon` diamond · `border` stroked · `transparency` checkerboard · `radius` corner), the spacing ruler (`filled`/`line`, width = resolved value), the radius-corner specimen, the "Abc 123" type example, and a numeric-weight → style-name map.
- **Alias treatment**: the alias-as-pill (link icon + target name) and the **value + alias side-by-side** cell.
- **Dark/light header** option.
- **GRID-frame-as-table** technique (2px-gap gridlines, all-`HUG` tracks) — a clean generic way to lay a token table on canvas. (Confirm the Figma GRID API is an acceptable dependency; else fall back to nested auto-layout rows.)
- The three link-icon SVG paths (small, reusable).

**Drop** (bespoke / tied to its assumptions): the live-Figma alias-chain walkers, the component-set
create/repair/dedup housekeeping, `Inter`-only font assumptions, `ui-tokens.ts` (its own chrome theming),
and the entire tab/UI (Prism3 has its shared web UI).

---

## Read-model mapping (the crux)

A style-guide row needs, per token: **name/slug + group path, per-mode resolved value, alias-target
name, description, type (color/float/string)**, and for type rows the **composite family/size/weight**.

- **`resolvePreview` (`ResolvedPreview`) is the WRONG feed.** It is a *curated subset* keyed to
  preview-spec paths — only the color roles / dims / type composites the preview components + contracts
  reference. It carries **no descriptions, no alias-target names, no full token catalog, no STRING
  tokens, no whole palette**. A style guide wants *every* token in a collection.
- **The RIGHT feed is the emit projection.** `emit-figma-color.ts`'s `FigmaVar { name (slash path),
  resolvedType, scopes, description, per-mode value, alias {type, name} }` (≈ `:24-43`) is almost
  exactly the per-token record the cells consume — the **whole** catalog, namespace-stripped to slash
  paths, alias-resolved to target names, per mode. Add `emit-figma-dims.ts` (FLOAT axes) and
  `emit-figma-styles.ts` (shadow/gradient **styles** — which the prior-art plugin can't render at all).
- **Bonus differentiator:** Prism3 has **live contrast** (`resolvePreview.contracts`). A Prism3 style
  guide can show a contrast column the prior art has no notion of.

**Concrete gaps to bridge when feeding from Prism3 instead of live Figma:**
1. Value is **per-file-per-mode** (`buildFigmaColor` returns one `FigmaCollectionFile` per mode) rather than `valuesByMode[modeId]` — pick the file for the chosen mode (easy shim).
2. `FigmaVar.value` is `FigmaColor {r,g,b,a}` or an alias record; alias rows resolve by looking up `alias.name` in the emitted set (replaces the live Figma chain-walk).
3. **Typography**: family/size/weight come from `resolvePreview.type` or the DTCG typography leaves, but **line-height / letter-spacing / paragraph / decoration** live in the DTCG typography `$value` (partly) and aren't all in `ResolvedPreview` — a Prism3 type table reads the **DTCG typography leaves directly**.
4. Grouping: the prior art splits `name` on `/`; `figName` slash paths preserve that — no gap.

Net: the cell/table layer is data-shape-agnostic once fed a `{name, group, perModeValue, aliasName,
description, type}` record. Prism3 produces that from the emit projections; the work is the **adapter**,
not bending `ResolvedPreview`.

---

## Recommendation: rebuild, don't port

**Rebuild the canvas renderer fresh in the existing Prism3 plugin, using this plugin's layout/section
design as the spec to hit.** Reasoning:

- **Architecture mismatch.** Prism3's plugin is a **pure host-neutral plan → thin tested executor**
  (`engine/write-plan.ts` + `emit-figma-*` build the plan; `plugin/src/write-figma.ts` / `write-styles.ts`
  execute it against a mockable `VariablesApi` / `StylesApi`, unit-tested with an in-memory shim). The
  prior art is the **opposite shape** — 2,980 lines of interleaved live-Figma reads + drawing, no seam,
  no tests. Porting it wholesale imports an untested monolith that reads the file live, contradicting
  the read-model-driven contract.
- **The valuable IP is the design, not the code.** The drawing primitives (createFrame/text/rect, GRID
  setup, color math — which `engine/color.ts` already owns) are ~200 lines and cheap to rewrite clean;
  the ~2,800 lines of Figma-variable reading + component-set housekeeping are exactly what *not* to carry.
- **Channel-gating fits the rebuild.** Add a pure `StyleGuidePlan` (engine, built from the emit
  projections) + a `plugin/src/write-style-guide.ts` executor invoked behind a new `apply-style-guide`
  message, mirroring `apply-theme` (`plugin/src/main.ts` ~`:107`) and gated like the other Output lanes.

**Shape to build:**
```
engine/   build-style-guide-plan.ts  → StyleGuidePlan (rows + column spec + specimen kinds, per category)
                                        fed by buildFigmaColor / buildFloatWritePlan / buildStylesPlan
                                        + DTCG typography leaves; pure, unit-testable
plugin/src/write-style-guide.ts       → applyStyleGuidePlan(plan, figma) — GRID frame + cell drawing;
                                        idempotent find-by-name; tested against the in-memory shim
                                        message: apply-style-guide (channel/Figma-only, docs/18 §gating)
```

**Keep from the prior art** (into the spec, not re-derived): the per-category column layouts, the
specimen catalog, the alias-pill + value/alias cell (fix the truncation — HUG the pill, drop the fixed
180px clip), the GRID-frame table technique, the link-icon SVGs.

---

## Red flags — clean

`manifest.json` declares **no `networkAccess`** (no network calls anywhere); `package.json` has **zero
runtime dependencies** (3 dev-only: plugin-typings, esbuild, typescript); **no secrets, telemetry,
`eval`, or detection-evasion flags**. Only note: no LICENSE file — a non-issue for porting the owner's
own work, but there's no license to cite if code is copied verbatim (another reason the rebuild, which
takes the *design* not the code, is cleaner).

---

## Status / next

- **Assessment complete** (this doc). No code written; the prior art was read-only.
- **Not scheduled** — Output remains deferred (docs/23 §2). When it starts, begin from the "Shape to
  build" above: engine `StyleGuidePlan` first (pure + tested), then the `write-style-guide` executor,
  then the channel-gated message.
- The `assess/token-press-external` branch (`_external/style-guide-generator/`) is transient; delete
  after this capture. The plugin's home is its own future repo, not `prism3-tokens/main`.
