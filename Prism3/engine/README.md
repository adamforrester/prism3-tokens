# Prism3 engine (prototype)

A thin, dependency-free TypeScript prototype of the Prism3 generation engine.
It does two things:

1. **Proves the color thesis against New Balance** — generates NB's ramps from
   the reverse-engineered schema and diffs them against the real hand-built
   tokens (`nb-regression.ts`).
2. **Proves the white-label claim** — takes a brand input (primary + neutral +
   any number of additional `brandColors[]`) and generates a complete color
   system, *synthesising* status palettes, *carving a dedicated danger red* when
   the brand's primary isn't red, and *decoupling the `action` role from
   `brand`* so the interactive colour need not be the hero colour
   (`emit-dtcg.ts`, second theme `aurora`).

This is not the production engine, and it is well past color-thesis-only: from a
small per-brand input it generates a **complete token layer end-to-end** for two
brands (NB + a synthetic violet brand) across every axis — colour, semantic roles,
dimension (space/radius/sizes), typography, shadow & elevation, motion, layout,
opt-in gradients, and the mode-invariant primitives (border-width, focus,
opacity/alpha) — emitted as
DTCG, validated for alias resolution + contrast contracts + schema conformance, and
rendered to a live HTML style guide. Each axis is driven by a few brand levers; the
rest is derived.

## Run

```bash
npx tsx Prism3/engine/nb-regression.ts   # regression: generated vs real NB
npx tsx Prism3/engine/emit-dtcg.ts       # emit a DTCG token tree + validate aliases + schema
npx tsx Prism3/engine/test.ts            # unit tests: colour math + extreme-brand contracts
npx tsx Prism3/engine/visualize.ts       # render out/tokens.html — a live visual style guide
```

Node ≥ 20. No `npm install` needed — the color math is self-contained
(`color.ts`), so the engine runs without a network.

## Files

- `color.ts` — sRGB ↔ OKLCH, sRGB → CIELAB, CIEDE2000, WCAG contrast + dual-side window, gamut-aware max chroma. No deps.
- `ramp.ts` — ramp generation per spec §5.1–5.2: exact anchor pinning, 20-step scale, chroma **arc** (tapers toward both ends), gamut clamp, 5 tonal bands, contrast-role placement.
- `scale.ts` — the dimension axis: a primitive 4px grid + `space` (density-driven) and `radius` (scale-driven) semantic ramps. Same primitives+aliases shape as color; two levers (density enum, radius scalar) carry all the variance.
- `theme.ts` — builds a brand-agnostic `Theme` (palettes, role→palette map, namespace, color format, dimension axis). Two entry points: `nbTheme()` (measured NB anchors, `nbds.*`/rgb) and `brandTheme(input)` (white-label: synthesises status hues, carves a danger red, applies a form factor, `prism.*`/hex).
- `modes.ts` — appearance modes (light / dark / hc-light / hc-dark). Resolves each semantic role to a primitive step by contrast target against the mode's surface. Brand-agnostic — paths/palette names come from the `Theme`.
- `nb-regression.ts` — diffs generated NB ramps against the real NB tokens (ΔE00 per step), checks the contrast contracts, writes `nb-regression-report.md`.
- `emit-dtcg.ts` — emits a DTCG tree per theme (`out/<id>.tokens.json`), generates the per-mode semantic layer, validates every alias resolves, every mode contrast contract holds, and the BrandInput conforms to the schema; writes `modes-report.md` + the `.ai.json` sidecar.
- `ai-metadata.ts` — generates `out/<id>.ai.json`, the agent-readable metadata sidecar. Two tiers: **semantic** (full schema — `meaning`, `when_to_use`, `avoid_when`, `paired_with`, `contrast_with`, `mode_overrides`, per KB 31-color-systems §9) and **primitive** (simplified — `meaning`, `tier`, `consume`, and `aliased_by`, the reverse index of which tokens resolve to it, **computed transitively** across multi-hop alias chains → a bidirectional graph for impact analysis). Also carries the typography tier (`type.*` composites + `font.weight-role.*`) and, when a brand opts in, the gradient tier (`gradient.*` with stop refs + worst-case-stop a11y). All fields generated/contract-true; keeps `tokens.json` DTCG-pure.
- `visualize.ts` — renders `out/tokens.html`, a single self-contained visual style guide read back from the emitted DTCG (every axis: colour, semantic roles, dimension, typography rendered live, shadow & elevation, motion with animated easing curves, layout, opacity, border-width). No deps; also prints a plain-text taxonomy.
- `test.ts` — colour-math invariants + extreme-brand contract smoke tests + typography/shadow/layout invariants (124 checks).
- generated outputs (committed so results are reviewable without running): `nb-regression-report.md`, `modes-report.md`, `out/nb.tokens.json`, `out/aurora.tokens.json`, `out/tokens.html`.

## Modes (`modes-report.md`)

Modes do **not** regenerate primitives — the ramps are shared. What changes per
mode is which primitive step each semantic role resolves to, and the engine
*derives* that by contrast target against the mode's own surface rather than
hand-mapping it. So `text.primary` is the definition "the strongest neutral
on this surface" and `foreground.interactive.default` is "the step of the *action
palette* nearest its anchor that clears AA on this surface" — both resolve
correctly in any mode for free. The action palette is whatever
`roleToPalette.action` points at (NB: `red`, decoupled-by-default but here same as
brand; aurora: `accent`, a different palette from the violet brand). The run
verifies every mode's contrast contracts (currently 268/268).

**Semantic vocabulary — PROPERTY-LED** (`color / <property> / <variant> [ /
<state> ]`), decided against a nine-system field survey + the practice KB, aligned
to New Balance's real taxonomy. Top level is the *property* you're colouring;
`foreground` is the element **FILL** (NB's meaning — not text):
- `background.*` — inert container surfaces: an ordinal elevation ladder
  `primary`/`secondary`/`tertiary`/`quaternary` (page→floating, use-case-neutral)
  + `subtle`/`sunken`/`inverse` + semantic `*-subtle` tints. Light tiers converge
  in colour (elevation = shadow, deferred); dark tiers step lighter (M3 lift).
- `scrim.default` — semi-transparent modal/drawer backdrop (alpha-based, heavier
  in dark). Backed by new primitives: an `opacity.*` scale and `black-alpha`/
  `white-alpha` ramps that composite correctly over any surface.
- `foreground.*` — element fills: neutral tiers, static semantics, plus the
  stateful `interactive` (action) and `danger` (destructive) fills.
- `text.*` — text: tiers, semantic, `on-*` pair labels, and `interactive` (links).
- `icon.*` — a full peer group; for now it MIRRORS `text` (a future toggle relaxes
  icons to the 3:1 non-text floor so they diverge).
- `border.*` — neutral, semantic validation, and `interactive` (focus = `.focused`).

Mode-invariant siblings of the dimension axis: **`border-width`** (`none/hairline/
thick/heavy` → dim 0/1/2/4, 1px hairline floor) and **`focus.ring`** (width 2px /
offset 2px / `offset-field` 0px / `style` solid; colour is the per-mode
`border.interactive.focused`) — grounded in WCAG 2.2 SC 2.4.13/2.4.11, with the
dual-outline (C40) technique documented for any-background 3:1. Icons can take a
separate **3:1 non-text floor** (SC 1.4.11) via the `iconContrast` theme input
(`'text'` default mirrors text; `'3:1'` lets secondary/semantic icons run lighter).

Interactivity is a per-property `interactive` variant carrying STATES (the
applicable subset of default/hover/pressed/focused/visited/selected/disabled), not
a duplicated parallel tree. Role keys nest (`foreground.interactive.hover`,
`foreground.danger.pressed`, `text.on-interactive`).

**Contrast is measured against the floor surface, not the pure extreme.** The
saturated, contract-bearing foregrounds (action + states, vivid semantic text,
secondary/tertiary text) clear their ratio against the most-tinted supported
surface — `neutral.50` in light/hc-light (a step off white), `neutral.950` in
dark/hc-dark (a step off black) — because pure white is the *most forgiving*
light background and a colour that only passes there fails on a `neutral.50`
card. Passing the floor implies passing the base surface, so colours hold across
the elevation range.

The base surface is configurable: a brand can declare a non-white/black page via
`surfaces` (e.g. `{ light: { base: 50 } }`), and the floor moves with it — a
tinted base floors one step further toward mid, and the engine flags the choice
in notes for confirmation. Aurora exercises this: its light page is `neutral.50`,
so the floor is `neutral.100` and `foreground.interactive.default` resolves to `accent.600`
(4.95:1 on that page) — two steps off the naive white-only pick. NB sets no
surface override, so it keeps the white/`neutral.950` defaults unchanged.

## DTCG output (`out/*.tokens.json`)

Two emit profiles prove the same engine serves both regression and product:

- **`out/nb.tokens.json`** — NB's own dialect (`nbds.color.<palette>.<step>`,
  `rgb(r, g, b)`, padded steps) so it is byte-comparable with the hand-built NB
  tokens.
- **`out/aurora.tokens.json`** — the product dialect (`prism.color.*`, hex,
  DTCG-aligned, Style-Dictionary-ingestible) for a synthetic violet brand that
  declared a primary + neutral + an azure `accent`. The engine added
  `success`/`warning` from canonical hues and a `danger` red carved at hue 27
  (because violet is not red), and — because the brand named `accent` as its
  `actionPalette` — `foreground.interactive.default` → `{prism.color.accent.600}` while the
  brand hue lives at `foreground.brand` → `{prism.color.primary.*}` and
  `foreground.danger.default` → `{prism.color.danger.*}`. Action, brand, and danger are
  three distinct palettes: the white-label requirement, with action decoupled
  from brand.

Every primitive leaf carries provenance under `$extensions.prism3` (OKLCH source,
hex, tonal band, anchor flag, on-white contrast). A per-mode `…semantic.<mode>.*`
layer maps the contract roles to primitive steps via DTCG brace aliases; the run
validates every alias resolves and every mode contrast contract holds.

## Dimension axis (space · radius · component sizes)

The non-color scales follow the same architecture as color: a primitive
`dimension` grid (`0,1,2,4,6,8,…,128` px) with semantic tokens aliasing into it,
organised by Curtis's three tiers (knowledge-base 02/22/24):

- **`space`** — *reference* tier, **numbered-multiplier** scale on an **8px
  rhythm**: `space.100`=8px (1×), `.200`=16 (2×) … `.1200`=96 (12×), plus
  `.025/.050/.075` sub-steps. The number means "n× base" invariantly across
  brands — the white-label-honest encoding. Density-free.
- **`radius`** — a small bounded, genuinely-semantic set, so t-shirt naming
  holds: `none/sm/md/lg/round`. One scalar `radius.scale` drives it (`1` = sharp
  `2/4/6`; `2` = soft `4/8/12`; `0` collapses all but the pill).
- **`size`** — *component* tier, t-shirt (`xs…xl`). Each size is a **contract**
  binding a control height **and** paired padding drawn from the shared scales,
  so a `md` button/input/select agree. This is the layer **`density`** acts on:
  `compact` resolves `size.md` to smaller metrics while the name stays `md`.

Two bases by design: a **4px fine grid** backs radius/borders; an **8px rhythm**
backs spacing (Prism2's split). NB is a *fidelity test*, not the taxonomy
authority — so `space` validates against **Prism2** (the numbered scale we
adopted) and `radius` against **NB** (t-shirt in both). Integer px → exact
equality, not ΔE: **21/21** (16 space + 5 radius) from `spaceBase=8` /
`radius.scale=1`. Aurora runs a different form factor (compact / soft) through
the identical code path.

## Motion axis (duration · easing · spring · transition)

Mode-invariant, generated from one personality lever — `motionPersonality.tempo`
(snappy/standard/relaxed) scales a non-linear **duration** ramp; **easing** ships
field-verified beziers by role (`standard`/`enter`=decelerate/`exit`=accelerate/
`emphasized`, plus a `calm` accessibility curve); **spring** tokens
(`snappy`/`gentle`/`bouncy`) carry M3 spatial params by perceptual outcome;
**composite `transition.*`** tokens bundle a duration + easing (the Atlassian
"intent" layer); and **reduce-motion is derived** (`duration-reduced`: informational
motion preserved/floored, vestibular → 0 — Apple "substitute, don't delete").
Beats a fixed single-brand ramp via the lever, composites, the `calm` curve, and
derived reduce-motion. Grounded in KB `18-motion-foundations` + a 7-system survey.

## Typography axis (font primitives · composite text styles)

Same primitives→composites architecture as colour. **Primitives:** a *curated*
rem `font.size` ladder (10→160px, whole/half-rem steps — **not** a modular ratio,
which leaves gaps; Prism2's lesson); a numeric `font.weight` **reference tier**
(100–900) with function-named `font.weight-role.*` aliases
(`subtle`/`default`/`emphasis`/`strong`) so a two-weight brand collapses roles
without touching consumers; unitless `font.line-height.*`; `font.letter-spacing.*`
in em; and `font.family.*` (`display`/`text`/`mono`). **Composites:** DTCG
`typography` tokens grouped by role — `display`/`title`/`body`/`label`/`caption`/
`eyebrow`/`code` — each binding family + size + weight-role + line-height +
tracking (+ baked `textCase` where applicable). **Fluid is size-dependent, not a
flat factor** (the wrong model — research showed bigger shrinks more): `display`
runs a convergent mobile curve toward a ~40–48px hero band, `title` drops ~one rung
floored, `body` stays static; every `clamp()` is rem-floored for WCAG 1.4.4. The
materialization directive carries the export data in `$extensions.prism3`: the
`web` clamp string, the Figma `responsive.figma.modes` (desktop/mobile fontSize),
and the per-mode `lineHeight px = fontSize × multiplier` rule (Figma binds
line-height as px, not unitless). `title` is allowed to bleed into body sizes; a
16px title is an opt-in floor entry (pinned, exempt from the scale shift).
Grounded in KB `23-typography-tokenisation` + a Carbon/Utopia/Material survey.

## Shadow & elevation axis (key+ambient · two-axis elevation)

A six-step `shadow` ladder (`xs…2xl`) plus an `inset`, each a **two-layer**
DTCG `shadow` composite (a tight **key** + a soft **ambient**), colour a **tinted
near-black** (not pure black — pure black reads grey and muddy). One `softness`
lever scales blur/spread. Dark mode is **mode-aware**: the shadow is *reduced*
(carried under `$extensions.prism3.modes.dark`) because **surface lift** does the
dark-mode elevation work — neither NB's heavier-dark shadow nor a null. Elevation
is **two axes joined**: a surface ladder (`background.*`) and the shadow ladder,
bound per mode by semantic `elevation.<level>` tokens (`sunken`/`flat`/`raised`/
`overlay`/`floating`) each carrying a `{surface, shadow}` pair, with component
aliases (`card`/`dropdown`/`dialog`/…) pointing at a level (Atlassian's split).
Emits as a Figma **Effect Style** (colour + numerics bindable per layer).
Grounded in KB `31-color-systems` (lift pattern + the shadow subsection).

## Layout axis (breakpoints · grid · containers)

Five-to-six **t-shirt min-width** breakpoints (mobile-first floors; count-aware
names — ≤5 anchor at `sm`, 6+ prepend `xs` Bootstrap-style). The 12-col `grid` is
emitted as a **design artifact, not the code contract** (build with CSS Grid +
container queries) — a 4/8/12 column ladder per breakpoint. **Gutter and margin
alias the spacing scale** (`{space.*}`, 16/24/32 · 16/24/48), not independent
tokens — the single most load-bearing finding. Containers collapse Prism2's
fluid-vs-fixed duplication into **fluid-first + a `container.max` cap (1280) + a
`narrow` reading container (~720)**. Breakpoint-keyed values are tagged for a
*separate* Figma layout collection (modes = breakpoints, composing independently
with colour light/dark). Lever = the breakpoint floor array + base column count.
Grounded in the `2026-06-28-layout-grid-breakpoints` research + a 11-system survey.

## Gradient axis (opt-in · OKLCH-interpolated)

The one **opt-in** axis: off by default (a brand sets `gradients: true` for one
default brand gradient, or an array for specific ones), because the field
overwhelmingly **abstains** — Material/Carbon/Atlassian/Primer/USWDS ship no
gradient tokens, Polaris/SLDS deprecated theirs, only Fluent ships a real
composite. NB ships none; aurora opts into two (a cross-palette linear brand +
a radial glow). The model takes the most mature field pattern (Fluent) plus the
best rendering practice (Tailwind v4 / CSS Color 4), fixing what others got wrong:

- **DTCG `gradient` composite as the spine** — `$value` is the stops array
  `[{ color, position }]`, and stop **colours alias the colour ramp** (themeable;
  never raw hex — the deprecated Polaris/SLDS trap).
- **DTCG omits kind/angle/interpolation** (issue #101 is still open) → we carry
  them in `$extensions.prism3`: `kind` (linear/radial), `angle` | `center`+`shape`,
  and `interpolation` (**OKLCH by default** — no sRGB grey dead zone). The CSS
  string is emitted `in oklch`.
- **Figma interpolates in sRGB only**, so the engine **pre-samples the OKLCH curve
  into N baked sRGB stops** (`figma.sampledStops`) for the Paint Style — the
  visualiser renders the OKLCH (web) and sampled-sRGB (Figma) versions side by side.
- **Materializes as a Figma Paint Style** (the 4th style class beside effect/text/
  grid): only stop **colours** bind to COLOR variables (Plugin API Update 92);
  kind, angle/transform and stop positions are baked. REST can neither create nor
  read Paint values — plugin-only, matching the export pipeline.
- **Worst-case-stop contrast** is computed for text-on-gradient (the lowest
  contrast across the sampled stops, vs white and black) and flagged in the
  `a11y` extension — text over a gradient must clear its ratio at the *worst*
  point, not the average. No surveyed system does this.

Lever = the gradient list (kind, angle/center, stops as `{palette, step}` ramp
refs). Grounded in a 10-system survey + the DTCG spec (2025.10) + the Figma
gradient round-trip research.

## What it currently does / doesn't

**Does:** exact anchor preservation; anchor-pinned L interpolation; chroma arc;
gamut-aware chroma; **contrast-role-targeted placement** (Mid-Tone 500 pinned to
the dual-side AA luminance pivot so all band contracts pass); band classification;
WCAG contract checks; **the dimension axis** (grid + numbered space + radius +
density-driven component sizes, 21/21 exact vs Prism2 space + NB radius); **the
motion axis** (tempo-generated durations + easing/spring/composite-transition +
derived reduce-motion); **the typography axis** (curated rem ladder + weight-role
tier + role composites + size-dependent fluid); **shadow & two-axis elevation**
(key+ambient, tinted, mode-aware reduced-dark); **the layout axis** (t-shirt
breakpoints + grid-as-artifact + spacing-aliased gutter/margin + fluid containers);
**opt-in OKLCH gradients** (DTCG composite + ramp-aliased stops + sRGB pre-sample
for Figma + worst-case-stop contrast); border-width, focus, opacity/alpha + scrim
primitives; two-brand emit in two dialects; a live HTML style guide
(`visualize.ts`). nb 621/621 + aurora 622/622 aliases resolve, 268/268 mode
contracts hold, 137/137 unit tests pass, both brands schema-conform.

**Deliberately not reproduced:**
- *NB's per-step hue kinks* (amber.600, red.300). Following them would require
  per-step hue drift — effectively letting a brand specify every step's hue,
  which the architecture resists ("resist the seventh"). Constant hue is the
  principled default; these outliers characterise NB's hand-authoring, not an
  engine gap.

**Next increments:**
- The raw-figma / code→Figma round-trip writer (the contract is complete —
  `$extensions.prism3.figma` carries every transform directive across all axes,
  gradients included — but the writer that drives the user's plugin to
  update-in-place vs build-from-scratch is still backlog); downstream pipeline
  (Style Dictionary / Figma MCP); a theming playground (see `docs/04`). All token
  categories are now generated.
