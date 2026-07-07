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
npx tsx Prism3/engine/emit-dtcg.ts       # emit a DTCG token tree + validate aliases + schema (NB + aurora + harbor)
npx tsx Prism3/engine/test.ts            # unit tests: colour math + extreme-brand contracts + design.md/CLI
npx tsx Prism3/engine/visualize.ts       # render out/tokens.html — a live visual style guide

# CLI adapter — compile an arbitrary brand brief (design.md) into tokens.
# Accepts BOTH dialects (auto-detected): engine-native briefs (examples/*.design.md)
# and STANDARD brand-skills / google-labs design.md (flat colours + x-prism3).
npx tsx Prism3/engine/cli.ts Prism3/examples/harbor.design.md [--out <dir>]
npx tsx Prism3/engine/cli.ts Prism3/examples/wendys.design.md --fidelity   # standard dialect + observed-vs-generated report
npx tsx Prism3/engine/emit-levers.ts     # (re)emit schema/lever-manifest.json — the shared-control contract (plugin/playground/MCP)
npx tsx Prism3/engine/emit-preview.ts    # (re)emit schema/preview-spec.json — the shared live-preview spec (plugin/playground)
npx tsx Prism3/engine/emit-brandinput.ts # (re)emit schema/example-brands.json — validated boot brands for the browser hosts
npx tsx Prism3/engine/emit-figma.ts      # (re)emit out/figma/<id>/ — the Figma import artifact (colour axis; see docs/10 §7 for the emitter remit)
```

Note: `buildTree` (the DTCG generator) lives in the **pure** `tree.ts` (no `node:*`), re-exported by
`emit-dtcg.ts`; the browser hosts and `emit-figma.ts` import it directly. See `docs/09`/`docs/10`.

Node ≥ 20. No `npm install` needed — the color math is self-contained
(`color.ts`), so the engine runs without a network.

## Files

- `color.ts` — sRGB ↔ OKLCH, sRGB → CIELAB, CIEDE2000, WCAG contrast + dual-side window, gamut-aware max chroma. No deps.
- `ramp.ts` — ramp generation per spec §5.1–5.2: exact anchor pinning, 20-step scale, chroma **arc** (tapers toward both ends), gamut clamp, 5 tonal bands, contrast-role placement.
- `scale.ts` — the dimension axis: a primitive 4px grid + `space` (density-driven) and `radius` (scale-driven) semantic ramps. Same primitives+aliases shape as color; two levers (density enum, radius scalar) carry all the variance.
- `theme.ts` — builds a brand-agnostic `Theme` (palettes, role→palette map, namespace, color format, dimension axis). Two entry points: `nbTheme()` (measured NB anchors, `nbds.*`/rgb) and `brandTheme(input)` (white-label: synthesises status hues, carves a danger red, applies a form factor, `prism.*`/hex).
- `modes.ts` — appearance modes (light / dark / hc-light / hc-dark). Resolves each semantic role to a primitive step by contrast target against the mode's surface. Brand-agnostic — paths/palette names come from the `Theme`.
- `nb-regression.ts` — diffs generated NB ramps against the real NB tokens (ΔE00 per step), checks the contrast contracts, writes `nb-regression-report.md`.
- `emit-dtcg.ts` — emits a DTCG tree per theme (`out/<id>.tokens.json`), generates the per-mode semantic layer, validates every alias resolves, every mode contrast contract holds, and the BrandInput conforms to the schema; writes `modes-report.md` + the `.ai.json` sidecar. Also **exports the reusable core** (`buildTree` / `emitTheme` / `validateBrandInput`) behind an `isMain` guard, so the CLI is a thin entry point over it, not a second pipeline; the aurora + harbor themes are compiled from `examples/*.design.md`.
- `design-md.ts` — the `design.md` parser (pure, no I/O): a dependency-free block-style YAML-subset parser (indentation nesting + `- ` block sequences + flow `{}`/`[]` leaves + scalar typing) → `BrandInput`, plus the frontmatter/prose split. Scoped to the `BrandInput` shape (owns YAML like `color.ts` owns the colour math).
- `cli.ts` — the CLI adapter (I/O shell): `tsx cli.ts <design.md> [--out <dir>] [--fidelity]`. Auto-detects the dialect (a top-level flat `colors:` map = the standard dialect; otherwise engine-native) and routes to the right reader, then runs the same core: read → BrandInput → `validateBrandInput` → `brandTheme` → `emitTheme`. Exits non-zero on a schema violation, a broken alias, or a failed contrast contract.
- `standard-design-md.ts` — reads the STANDARD brand-skills / google-labs `design.md` (flat `colors` hex map + structured type/dimension maps + an optional `x-prism3` levers block — a different shape from `design-md.ts`, which reads the engine's own `BrandInput` frontmatter) and converts it to a `BrandInput`: `standardToBrandInput` runs the classifier, derives the type families, and applies `x-prism3` (docs/07 §11).
- `classify-colors.ts` — the colour-role classifier: flat `colors:` → engine anchors by naming convention (`primary`→pinned, `secondary`/`tertiary`→brand palettes, `neutral-<step>`→derived hue/chroma, `success`/`warning`/`error`→`danger`→status; `info`/`white`/variants report-only).
- `levers.ts` — the **lever manifest** (docs/08 §4): the presentation contract for the `BrandInput` knobs (group/label/description/control/default/ranges/enum options; 35 levers, 20 `advanced`). **Pure — no `node:*`** (the plugin/playground/MCP bundle it into a browser/Figma sandbox). The Figma plugin, web playground, and MCP tool schema all render from it, so the surfaces stay in continuity. `test.ts` asserts it never drifts from `theme-schema.json` (keys resolve, enums + defaults match, every required field bar host-supplied `id` is a lever).
- `emit-levers.ts` — the I/O shell that writes `schema/lever-manifest.json` from the pure `levers.ts` (kept separate for sandbox portability). Run: `npx tsx Prism3/engine/emit-levers.ts`.
- `preview.ts` — the **preview spec** (docs/08 §7 B1a): a portable, data-only description of sample components (8 components / 22 variants — button + states, input, card, alert per semantic, nav item, badge, type specimen), each binding UI props to semantic token paths + the contrast pairs to overlay. **Pure — no `node:*`.** The Figma plugin and web playground render the same live preview from it. `test.ts` gates it — every referenced token path must resolve to a real leaf in the emitted token tree (binding-validity) and no contract over-claims the engine guarantee. Shell: `emit-preview.ts` → `schema/preview-spec.json`.
- `resolve-preview.ts` — the **resolved-preview projection** (docs/08 §7 B1b): `resolvePreview(theme)`, the runtime read-model the surfaces consume — the preview spec projected to **concrete colours per mode** + **live contrast results** (each contract computed on the real resolved fg-on-bg, per mode, pass/fail — the overlay). **Pure — no `node:*`** (resolves via `resolveAllModes`, which carries each role's `hex`; not `buildTree`). `test.ts` asserts every declared contract holds on the resolved colours in all 4 modes. A per-live-theme read-model, not a committed artifact.
- `fidelity.ts` — the full-parity fidelity report builder (`cli.ts --fidelity`): diffs every observed value against the generated system (colour ΔE00, typography, spacing, radius, elevation) — the Decision-A regression artefact (§11.3). Pure + brand-agnostic. The committed `out/wendys-fidelity-report.md` is generated by `cli.ts ../examples/wendys.design.md --fidelity`.
- `ai-metadata.ts` — generates `out/<id>.ai.json`, the agent-readable metadata sidecar. Two tiers: **semantic** (full schema — `meaning`, `when_to_use`, `avoid_when`, `paired_with`, `contrast_with`, `mode_overrides`, per KB 31-color-systems §9) and **primitive** (simplified — `meaning`, `tier`, `consume`, and `aliased_by`, the reverse index of which tokens resolve to it, **computed transitively** across multi-hop alias chains → a bidirectional graph for impact analysis). Also carries the typography tier (`type.*` composites + `font.weight-role.*`) and, when a brand opts in, the gradient tier (`gradient.*` with stop refs + worst-case-stop a11y). All fields generated/contract-true; keeps `tokens.json` DTCG-pure.
- `visualize.ts` — renders `out/tokens.html`, a single self-contained visual style guide read back from the emitted DTCG (every axis: colour, semantic roles, dimension, typography rendered live, shadow, motion with animated easing curves, layout, opt-in gradients, opacity, border-width). No deps; also prints a plain-text taxonomy.
- `test.ts` — colour-math invariants + extreme-brand contract smoke tests + typography/shadow/layout/gradient/surface-model + harshness + typography-weights/links + design.md-parser/CLI (aurora faithfulness byte-diff + harbor coverage) + standard-dialect/classifier/x-prism3 (Wendy's) invariants (202 checks).
- `../examples/*.design.md` — authored brand briefs (the front door): `aurora.design.md` (engine-native faithfulness — compiles to the aurora golden byte-for-byte), `harbor.design.md` (engine-native net-new coverage), and `wendys.design.md` (a real **standard** brand-skills extraction — the dual-dialect + classifier + fidelity example).
- generated outputs (committed so results are reviewable without running): `nb-regression-report.md`, `modes-report.md`, `out/{nb,aurora,harbor,wendys}.tokens.json`, `out/{nb,aurora,harbor,wendys}.ai.json`, `out/wendys-fidelity-report.md`, `out/tokens.html`.

## Modes (`modes-report.md`)

Modes do **not** regenerate primitives — the ramps are shared. What changes per
mode is which primitive step each semantic role resolves to, and the engine
*derives* that by contrast target against the mode's own surface rather than
hand-mapping it. So `text.primary` is the definition "the strongest neutral
on this surface" and `action.default` is "the step of the *action
palette* nearest its anchor that clears AA on this surface" — both resolve
correctly in any mode for free. The action palette is whatever
`roleToPalette.action` points at (NB: `red`, decoupled-by-default but here same as
brand; aurora: `accent`, a different palette from the violet brand). The run
verifies every mode's contrast contracts (currently 248/248).

**Semantic vocabulary — the surface & content model** (see `docs/06`). Decided
against a nine-system field survey + the practice KB, refined by a UI-designer
review. `background` is the canvas; `foreground` is what sits on it:
- `background.*` — the **canvas** (thin, page-level): `primary`/`secondary`/
  `tertiary` (**tonal in both modes** — light is no longer all white) + an
  `inverse.{primary,secondary,tertiary}` sibling ladder.
- `scrim.default` — semi-transparent modal/drawer backdrop (alpha-based, heavier
  in dark). Backed by an `opacity.*` scale + `black-alpha`/`white-alpha` ramps.
- `foreground.*` — the **surfaces/fills** on the canvas (Prism2's `surface`,
  renamed): a tonal `primary`/`secondary`/`tertiary` ladder + `inverse.*` (dark
  fills in light) + bold semantic fills (`brand`/`success`/`warning`/`danger`/`info`) +
  `{semantic}-subtle` tints. `foreground.primary` sits on `background.primary`.
  (`danger` is a static bold fill like the others — its stateful / interactive
  expression is `interactive.destructive.*` below, not a per-state `danger.*`.)
- `interactive.<colour>.*` — **the interactive colour family** (docs/20): `primary` · `neutral`
  · `destructive` (+ opt-in `accent`), each with `fill` (+ `rest`/hover/pressed/focused/selected
  states), `on-fill`, `text`, `border`, `overlay.*` washes, and an `on-inverse` ink. Cross-cutting
  `disabled.*` (surface/on-disabled/text/icon/border) is one treatment for any intent, and is the
  SOLE disabled family. This is what components bind — the legacy top-level `action.*` fill and the
  scattered per-family disabled states are retired (task #14).
- `text.*` / `icon.*` — **ink**: `primary/secondary/tertiary`, semantic +
  `{semantic}-subtle` (muted), `on-{semantic}`/`on-inverse` pairs, and `link.*`
  (no disabled). Disabled ink is the cross-cutting `disabled.text` / `disabled.icon`;
  the ink on a disabled fill is `disabled.on-disabled` (Carbon's `text-on-color-disabled`,
  resolved against that fill). `icon` mirrors `text` unless `iconContrast: '3:1'`.
- `border.*` — `primary`/`secondary` (neutral), `inverse`, semantic, and `focus`.

Elevation is **not** a colour group: a component composes a `foreground` tier + a
`shadow` step. In high contrast the neutral surface ladders flatten to the base —
HC carries elevation by **border** (escalated to ≥4.5:1), not by faint tints.

**Harshness — no pure extremes in standard modes.** Pure black reads muddy and
pure white halates on a dark ground (KB 31 §halation/§tint-not-black), so the
engine softens the extremes: inverse surfaces resolve to `neutral.950`/`025`
(not `#000`/`#fff`), and the `on-*` contrast pick uses the near-extreme — pure
white survives only as the light **base page** (universal, not harsh), while dark
mode softens white→`025` and black→`950` everywhere. **HC modes keep pure black &
white** for low-vision maximum contrast (with a pure-extreme fallback if a
softened pick can't clear AA on a fill).

Mode-invariant siblings of the dimension axis: **`border-width`** (`none/hairline/
thick/heavy` → dim 0/1/2/4, 1px hairline floor) and **`focus.ring`** (width 2px /
offset 2px / `offset-field` 0px / `style` solid; colour is the per-mode
`border.focus`) — grounded in WCAG 2.2 SC 2.4.13/2.4.11, with the
dual-outline (C40) technique documented for any-background 3:1. Icons can take a
separate **3:1 non-text floor** (SC 1.4.11) via the `iconContrast` theme input
(`'text'` default mirrors text; `'3:1'` lets secondary/semantic icons run lighter).

Interactivity is the top-level `action.*` fill carrying STATES (default/hover/
pressed/focused/selected/disabled), with `text.link.*` and `border.focus` as its
ink/edge expressions — not a duplicated parallel tree per property. Role keys nest
(`action.hover`, `foreground.danger.pressed`, `text.on-action`, `background.inverse.primary`).

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
so the floor is `neutral.100` and `action.default` resolves to `accent.600`
(4.95:1 on that page) — two steps off the naive white-only pick. NB sets no
surface override, so it keeps the white/`neutral.950` defaults unchanged.

## DTCG output (`out/*.tokens.json`)

Two emit profiles prove the same engine serves both regression and product:

- **`out/nb.tokens.json`** — NB's own dialect (primitives `nbds.palette.<name>.<step>`,
  `rgb(r, g, b)`, padded steps) so it is byte-comparable with the hand-built NB
  tokens.
- **`out/aurora.tokens.json`** — the product dialect (`prism.*`, hex,
  DTCG-aligned, Style-Dictionary-ingestible) for a synthetic violet brand that
  declared a primary + neutral + an azure `accent`. The engine added
  `success`/`warning` from canonical hues and a `danger` red carved at hue 27
  (because violet is not red), and — because the brand named `accent` as its
  `actionPalette` — `action.default` → `{prism.palette.accent.600}` while the
  brand hue lives at `foreground.brand` → `{prism.palette.primary.*}` and
  `foreground.danger.default` → `{prism.palette.danger.*}`. Action, brand, and danger are
  three distinct palettes: the white-label requirement, with action decoupled
  from brand.

The colour layer is two tiers: **`palette.*`** — the colour primitives (ramps +
white/black + alpha), private — and **`color.*`** — the semantic role layer
consumers use. Every primitive leaf carries provenance under `$extensions.prism3`
(OKLCH source, hex, tonal band, anchor flag, on-white contrast). Each `color.*`
role is **one mode-agnostic token**: the `light` value is canonical in `$value`,
and `dark`/`hc-light`/`hc-dark` are value overrides in `$extensions.prism3.modes`
(each keeping its own contrast contract) — mapping 1:1 to a single Figma colour
variable with Light/Dark/HC modes. The run validates every alias resolves and
every mode contrast contract holds.

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
equality, not ΔE: **23/23** (18 space + 5 radius) from `spaceBase=8` /
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
tracking (+ baked `textCase` where applicable). **Weight is an axis on every role**
— each role declares its weight set and every composite carries the weight in its
name (`type.body.md.strong`), so adding a weight later is purely additive (never a
rename). Defaults stay lean (display/title `[strong]`, body `[default, strong]`
with `emphasis` opt-in, caption `[default, strong]`); a brand ships a multi-weight
hero ramp with one line (`weights: { display: ['default','strong'] }`). **Links are
a `-link` suffix variant** (e.g. `type.body.md.strong-link`) generated for every
body + caption size×weight, with `textDecoration: underline` **baked** (not
Figma-bindable — a separate text style); the link *colour* stays `text.link.*` and
pairs at apply-time. The link roles are a lever (`links: ['body','caption']`).
**Fluid is size-dependent, not a
flat factor** (the wrong model — research showed bigger shrinks more): `display`
runs a convergent mobile curve toward a ~40–48px hero band, `title` drops ~one rung
floored, `body` stays static; every `clamp()` is rem-floored for WCAG 1.4.4. The
materialization directive carries the export data in `$extensions.prism3`: the
`web` clamp string, the Figma `responsive.figma.modes` (desktop/mobile fontSize),
and the per-mode `lineHeight px = fontSize × multiplier` rule (Figma binds
line-height as px, not unitless). `title` is allowed to bleed into body sizes; a
16px title is an opt-in floor entry (pinned, exempt from the scale shift).
Grounded in KB `23-typography-tokenisation` + a Carbon/Utopia/Material survey.

## Shadow axis (key+ambient · mode-aware)

A six-step `shadow` ladder (`xs…2xl`) plus an `inset`, each a **two-layer**
DTCG `shadow` composite (a tight **key** + a soft **ambient**), colour a **tinted
near-black** (not pure black — pure black reads grey and muddy). One `softness`
lever scales blur/spread. Dark mode is **mode-aware**: the shadow is *reduced*
(carried under `$extensions.prism3.modes.dark`) because **surface lift** does the
dark-mode elevation work — neither NB's heavier-dark shadow nor a null. Emits as a
Figma **Effect Style** (colour + numerics bindable per layer).

**Elevation is not a colour group.** A component composes a `foreground` surface
tier + one of these shadow steps (see `docs/06`). A semantic `elevation.*` colour
ladder was briefly shipped then removed in the surface & content model rework —
the foreground tonal ladder + the shadow ramp carry it without a parallel group.
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
density-driven component sizes, 23/23 exact vs Prism2 space + NB radius); **the
motion axis** (tempo-generated durations + easing/spring/composite-transition +
derived reduce-motion); **the typography axis** (curated rem ladder + weight-role
tier + role composites + size-dependent fluid); **shadow & two-axis elevation**
(key+ambient, tinted, mode-aware reduced-dark); **the layout axis** (t-shirt
breakpoints + grid-as-artifact + spacing-aliased gutter/margin + fluid containers);
**opt-in OKLCH gradients** (DTCG composite + ramp-aliased stops + sRGB pre-sample
for Figma + worst-case-stop contrast); border-width, focus, opacity/alpha + scrim
primitives; three-brand emit in two dialects; a live HTML style guide
(`visualize.ts`); **a `design.md` + CLI authoring front door** (block-style
YAML-subset parser → the pure core, aurora reproduced byte-for-byte + harbor as a
net-new coverage brand). nb 627/627 + aurora 628/628 + harbor 622/622 aliases
resolve, 248/248 mode contracts hold per brand, 189/189 unit tests pass, all
brands schema-conform.

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
