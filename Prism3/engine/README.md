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

This is not the production engine, but it is no longer color-thesis-only: it
generates two brands (NB + a synthetic violet brand) end-to-end.

## Run

```bash
npx tsx Prism3/engine/nb-regression.ts   # regression: generated vs real NB
npx tsx Prism3/engine/emit-dtcg.ts       # emit a DTCG token tree + validate aliases
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
- `emit-dtcg.ts` — emits a DTCG tree per theme (`out/<id>.tokens.json`), generates the per-mode semantic layer, validates every alias resolves and every mode contrast contract holds, writes `modes-report.md`.
- generated outputs (committed so results are reviewable without running): `nb-regression-report.md`, `modes-report.md`, `out/nb.tokens.json`, `out/aurora.tokens.json`.

## Modes (`modes-report.md`)

Modes do **not** regenerate primitives — the ramps are shared. What changes per
mode is which primitive step each semantic role resolves to, and the engine
*derives* that by contrast target against the mode's own surface rather than
hand-mapping it. So `text.primary` is the definition "the strongest neutral on
this surface" and `action.primary` is "the step of the *action palette* nearest
its anchor that clears AA on this surface" — both resolve correctly in any mode
for free. The action palette is whatever `roleToPalette.action` points at
(NB: `red`, decoupled-by-default but here same as brand; aurora: `accent`, a
different palette from the violet brand). The run verifies every mode's contrast
contracts (currently 28/28).

**Contrast is measured against the floor surface, not the pure extreme.** Action,
status, and secondary text clear their ratio against the most-tinted supported
surface — `neutral.50` in light/hc-light (a step off white), `neutral.950` in
dark/hc-dark (a step off black) — because pure white is the *most forgiving*
light background and a colour that only passes there fails on a `neutral.50`
card. Passing the floor implies passing the base surface, so colours hold across
the elevation range. This is why aurora's light `action.primary` is `accent.550`,
not `accent.500`: the extra step is the headroom the tinted surface demands.

## DTCG output (`out/*.tokens.json`)

Two emit profiles prove the same engine serves both regression and product:

- **`out/nb.tokens.json`** — NB's own dialect (`nbds.color.<palette>.<step>`,
  `rgb(r, g, b)`, padded steps) so it is byte-comparable with the hand-built NB
  tokens.
- **`out/aurora.tokens.json`** — the product dialect (`prism.color.*`, hex,
  DTCG-standard, Style-Dictionary-safe) for a synthetic violet brand that
  declared a primary + neutral + an azure `accent`. The engine added
  `success`/`warning` from canonical hues and a `danger` red carved at hue 27
  (because violet is not red), and — because the brand named `accent` as its
  `actionPalette` — `action.primary` → `{prism.color.accent.500}` while the
  brand hue lives at `{prism.color.primary.*}` and `status.danger` →
  `{prism.color.danger.500}`. Action, brand, and danger are three distinct
  palettes: the white-label requirement, with action decoupled from brand.

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

## What it currently does / doesn't

**Does:** exact anchor preservation; anchor-pinned L interpolation; chroma arc;
gamut-aware chroma; **contrast-role-targeted placement** (Mid-Tone 500 pinned to
the dual-side AA luminance pivot so all band contracts pass); band classification;
WCAG contract checks; **the dimension axis** (grid + numbered space + radius +
density-driven component sizes, 21/21 exact vs Prism2 space + NB radius);
two-brand emit in two dialects.

**Deliberately not reproduced:**
- *NB's per-step hue kinks* (amber.600, red.300). Following them would require
  per-step hue drift — effectively letting a brand specify every step's hue,
  which the architecture resists ("resist the seventh"). Constant hue is the
  principled default; these outliers characterise NB's hand-authoring, not an
  engine gap.

**Next increments:**
- Typography (modular scale / weight ladder / fluid triplets) and motion
  (duration / easing ramp) from the schema; raw-figma round-trip; downstream
  pipeline (Style Dictionary / Figma MCP).
