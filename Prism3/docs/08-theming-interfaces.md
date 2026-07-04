# 08 — Theming interfaces (the customization surfaces)

> The engine is a **portable core**; a `BrandInput` goes in, a complete verified
> token system comes out (`07 §3`). This doc maps the human- and agent-facing
> **surfaces** that drive that core, locks the decisions for the visual editor, and
> defines the one control contract that keeps the surfaces in continuity instead of
> drifting into N hand-maintained UIs. It extends `07-e2e-journey` (§3–5, the
> portable-core / one-brain-many-targets argument) and supersedes the direction note
> in `04-theming-playground` with a committed shape.

---

## 1. The organising idea: one core, many front-ends

Every surface is just a way to **(a) produce a `BrandInput` and (b) render the
output.** The core's option set is identical across all of them — the knob-turning
designer and the autonomous agent hit the same brain and get the same levers
(`07 §4`, the "no forced LLM" guarantee).

| Surface | Who drives it | Input it produces | LLM? | Status |
|---|---|---|---|---|
| **Figma plugin** | designer | knobs → `BrandInput`; themes the live file | no | to build (new — §2) |
| **Web playground** | designer / anyone | knobs → `BrandInput`; live preview | no | to build (continuity with the plugin — §3) |
| **CLI** | dev / agent | a `design.md` file | optional | ✅ built (dual-dialect) |
| **MCP server** | agent | structured tool-call args | yes (the point) | to build |
| **Figma MCP** | agent | writes variables/styles directly | yes | available now (§5) |

The point of naming them together: they are **not five products**. They are five
adapters over one core, and the work below is about making that literally true —
so a lever added once appears everywhere, and a token generated once materialises
the same way whether a designer or an agent asked for it.

## 2. Decision — a NEW Prism3 plugin, built on the engine core

**Locked.** The Prism3 Figma plugin is a **fresh build on top of the engine core**,
not an evolution of the existing theming plugin. The core is *reused* (never
re-implemented — that would rebuild the brain twice and re-create the drift the KB
round-trip note warns about); the plugin is a new **materialization + control
shell** wrapping it.

Why new over evolve:
- The existing theming plugin carries a **separate brain** and the three pain points
  `07 §5` names — it lacks the engine's richer options, breaks on namespace change,
  and hand-maps font weights. A clean build *is* the engine core wearing a Figma
  face, so it inherits every option automatically and those pain points dissolve
  rather than get patched.
- The dependency-free pure core already runs in a browser/Figma sandbox (the
  precondition, `07 §3`, is met), so folding it in is a bundling step, not a port.

The plugin applies engine output onto a duplicated file's variables/styles using the
`$extensions.prism3.figma` directives + `variableId` linkage already stamped on every
token (`07 §5`).

## 3. Decision — near-continuity between the web playground and the Figma plugin

**Locked.** Strive for **one shared interface**, not two maintained UIs. Do as much
as possible **inside the Figma plugin**; the web playground shares the plugin's
control model and preview logic rather than being a second, independently-built
front-end. Rationale: two hand-maintained visual editors is two surfaces of drift
and double the upkeep; a shared layer is one.

The continuity is **structural, not a manual sync** — see §4. The two hosts differ
only in what's host-specific: the Figma plugin writes to Figma variables/styles and
reads Figma-loaded fonts; the web playground renders to DOM/CSS variables. Everything
above that — the levers, their grouping/labels/ranges, the live-preview composition —
is shared.

## 4. The continuity mechanism: define the levers once, render everywhere

The enabler for §3 (and for the MCP surface) is a portable **lever manifest** in the
core: a machine-readable description of the `BrandInput` controls — grouped, labelled,
typed, ranged, with defaults and enum options — that every surface *renders from*.

```
core: lever manifest  ──renders──▶  Figma plugin knobs
        (one source)   ──renders──▶  web playground knobs
                       ──derives──▶  MCP tool schema (agent-callable)
                       ──validates─▶  design.md / BrandInput (already: theme-schema.json)
```

This is **components-as-data applied to the control layer** — the same "define once,
generate the surfaces" philosophy as the token engine itself (KB §03/30). Continuity
between the playground and the plugin is then guaranteed *by construction*: both read
one manifest, so a new lever (or a changed range) appears in both without touching
either UI. It also gives the MCP its tool schema and an agent its list of what it can
turn — the same knobs, described once.

`schema/theme-schema.json` is the validation half of this and already exists; the
manifest adds the **presentation half** (human labels, groups, UI ranges/steps, the
knob type — swatch / slider / enum / toggle) that a schema alone doesn't carry.

## 5. Materialization has two routes over one output

The engine emits the same tokens + `$extensions.prism3.figma` directives regardless of
who consumes them, so materialising into Figma has two parallel routes:

- **Manual / no-LLM:** the Figma **plugin** — a designer turns knobs, the plugin
  applies variables/modes/styles to the duplicated file.
- **Agentic:** the **Figma MCP** writes variables/modes directly — an agent
  materialises with no plugin UI at all (generate → MCP applies).

Both honour the same directives; they differ only in the driver. **Ceiling to
respect** (from the Figma round-trip research, `07 §11` + KB `_research` figma-
variables-styles-roundtrip): Figma variables are only `COLOR` / `FLOAT` / `STRING`
+ scopes — no composite type — so colour and dimension bind cleanly, **typography
materialises as atoms + a Text Style**, and **shadow/transition are Effect-Style /
code-only**. The engine already carries the per-axis directive for each; the MCP and
plugin routes both live within these limits, and the REST Variables API is
Enterprise-only (plugin/MCP only for styles).

## 6. The two operating modes, restated

The whole surface set collapses to your two intended workflows, both first-class:

- **Manual, LLM-free:** plugin knobs, the web playground, a hand-written `design.md`
  → CLI. A human never has to invoke a model to theme.
- **Agentic:** an agent drafts a `design.md`, or calls the MCP tools, or drives the
  Figma MCP — at any stage it needs. The LLM is an *optional driver of the input*,
  never a gate on the system.

Same core, same levers (the manifest), same verified output and fidelity report
underneath both.

## 7. Build sequence (revised — what's next)

Ordered so each step unblocks the next and the shared-control decision (§3/§4) is
honoured from the start rather than retrofitted:

1. **Lever manifest** in the core (§4). **✅ BUILT (2026-07-01)** — `engine/levers.ts` →
   `schema/lever-manifest.json` (35 levers, 7 groups, 20 `advanced`). A `test.ts` drift
   gate asserts it stays in sync with `theme-schema.json` (keys resolve, enums + defaults
   match, committed JSON current). Serves the plugin, playground, and MCP tool schema.
2. **Live-preview model** — the token→sample-component rendering (`04`'s canvas),
   shared by the plugin and the playground; the interactive successor to
   `engine/visualize.ts`, with the contrast-contract overlay as the differentiator.
   - **B1a ✅ BUILT (2026-07-01)** — `engine/preview.ts` → `schema/preview-spec.json`:
     the portable preview spec (8 components / 22 variants, each binding UI props to
     semantic token paths + contrast pairs; 52 token refs). Pure; a `test.ts`
     binding-validity gate asserts every path resolves in the emitted token tree.
   - **B1b ✅ BUILT (2026-07-01)** — `engine/resolve-preview.ts`: `resolvePreview(theme)`,
     the runtime read-model — concrete colours per mode + each contract computed on the
     real resolved colours (the live overlay). Pure (resolves via `resolveAllModes`, which
     now carries each role's `hex`). A `test.ts` gate asserts every declared contract holds
     on the resolved colours in all 4 modes.
   - **B1 dogfood ✅ BUILT (2026-07-02, PR #22)** — `engine/visualize.ts` now renders the shared
     preview model in-repo: it resolves `previewSpec` + `resolvePreview(theme)` per brand and paints
     each component/variant (bg/text/border from resolved role colours, radius/padding from the token
     tree, type from the resolved composite) with the per-mode contrast overlay. Proves the model
     composes a real UI + live overlay from one source before the host renderers exist — additive,
     output-scoped, 215/215.
   - B1c — the host renderers (DOM playground / Figma-node plugin), with B2/B3. The binding + overlay
     pattern is now proven via the B1 dogfood above; B1c ports it to the two live hosts.
3. **Web dashboard (host) FIRST** — same manifest + preview model, DOM/CSS-var host (§3).
   Fastest loop, no sandbox constraints; the cleanest proof the shared contracts drive a
   real UI before the harder Figma host. *(Ordering + packaging locked in `09` — the web
   host precedes the plugin; both live as packages in this repo's monorepo.)*
   - **✅ Scaffold + live colour/radius/type (PR #23/#24/#25/B)** — `@prism3/web` renders knobs
     from the manifest + preview + overlay from `resolvePreview`; **colour + `radiusScale` +
     `typeScale` knobs are live** (mutate `BrandInput` → re-resolve → repaint). `resolvePreview`
     now also returns `dims` + `type` (from the pure `tree.ts` `buildTree`), so chips render real
     radius/padding/type. Density/motion/shadow stay read-only until the chips render those axes.
4. **New Figma plugin shell** — the same renderer wearing a Figma face: bundles the core,
   renders knobs from the manifest, materialises via `$extensions.prism3.figma` (§2/§5).
   Absorbs the three separate Figma plugins' *function* (`09 §4`).
5. **MCP adapter — ✅ DONE (2026-07-04, `engine/mcp.ts`).** "An agent themes Prism3" as a
   callable surface. **Dependency-free JSON-RPC 2.0 over stdio** (no MCP SDK — owned like the
   YAML parser + colour math). Three tools: `list_levers` (the lever manifest verbatim — the
   knob catalogue, so the agent surface can't drift from the plugin/playground), `theme_brand`
   (`BrandInput` → DTCG tree + `.ai.json` + per-mode contract results + decisions log), and
   `validate_brand` (schema pre-flight). The knob *catalogue* derives from the manifest; the
   input *shape* is `theme-schema.json` (OKLCH-aware). Pure `handleRpc`/`callTool` behind an
   `isMain` stdio loop; gated in `test.ts` (handshake, catalogue, manifest-drift, a full
   round-trip, error paths) + live stdio smoke-test. Run `npx tsx Prism3/engine/mcp.ts`.

**Packaging:** the engine, web dashboard, and Figma plugin are one monorepo grown from
`prism3-tokens`; the core stays buildless (tsx), the adapters get a bundler. Full repo
strategy + the plugin absorb/downstream/leave map is in `09-architecture-and-repos`.

**Parallel validation tracks (no dependency on the above):**
- **Style Dictionary consumption** — run `out/*.tokens.json` through SD to prove a
  real consumer ingests the DTCG + modes cleanly (owner-driven, in progress).
- **Figma-MCP import** — import `out/*.tokens.json` into Figma as variables. Does
  triple duty: validates the engine's Figma directives end-to-end, **de-risks the
  plugin's materialization before it's built**, and **unblocks Token Press testing**
  (which needs tokens present as Figma variables first). Highest-value near-term
  validation using tools already in hand.

**Token Press** (private, different-org export plugin) stays deferred at the export
stage, downstream of materialization (`07 §11.1`).
