# 05 — Token Coverage Roadmap (backlog)

> The full token surface the engine should ultimately generate, mapped against
> what New Balance and Prism2 **actually ship**, with status, the generation lever,
> effort, and priority. This is the build backlog for "beyond colour + dimension."
> Decision-level questions live in `03-open-questions`; this is what's left to
> *build*, not what's left to *decide*.

---

## Status at a glance

| Category | Brand source | Status | Generation lever | Effort |
|---|---|---|---|---|
| Colour (primitives + property-led semantic + alpha/scrim/opacity) | NB `color`, Prism2 | ✅ Done | OKLCH ramps + contrast roles | — |
| Dimension grid · space · radius · sizes | NB `core-dimension`, `space-size`, `radius` | ✅ Done | 4px grid + density + radius scale | — |
| **Border width** | NB `border-width` (in `space-size`) | ✅ Done | `none/hairline/thick/heavy` → dim 0/1/2/4 | — |
| **Focus** | NB `focus` | ✅ Done | ring width/offset/offset-field/style; colour = `border.interactive.focused` | — |
| **Icon 3:1 toggle** | (colour sub-item) | ✅ Done | `iconContrast: 'text' \| '3:1'` theme input | — |
| **Breakpoints** | NB `core-breakpoint` | ⏸ Parked for discussion | fluid vs fixed + grid coupling — needs a decision | **low** |
| **Motion** | NB `core-motion`, `motion` | ✅ Done | `motionPersonality.tempo` → duration ramp; easing roles + springs + composites + derived reduce-motion | — |
| **Layout** | NB `layout` | ❌ Missing | grid columns/gutter/margin per breakpoint | **low–med** |
| **Shadow / elevation** | NB `shadows` | ❌ Missing | elevation lever → ramp, mode-aware | **medium** |
| **Typography** | NB `core-typography`, `typography` | ❌ Missing | families + modular ratio + base (schema stub) | **large** |
| **Gradients** | Prism2 `color/gradient/*` | ❌ Missing | brand-artistic (stops/angle) — not a clean lever | **medium** |

---

## Backlog items (detail)

### Quick wins (trivial → low)

> **Shipped (2026-06-27):** border-width, focus ring dims, and the icon 3:1 toggle
> — all research-grounded (WCAG 2.2 SC 2.4.13/2.4.11, SC 1.4.11), beating the NB
> single-brand defaults (offset-field=0 for inputs, dual-outline guidance, a
> separate non-text icon floor). **Breakpoints parked** for the fluid-vs-fixed +
> grid-coupling discussion. Detail below kept for the record.

- **Border width.** NB ships `border-width/{none,hairline,thin,thick}`. Emit a
  small semantic set aliasing the dimension grid (e.g. hairline→`dimension.1`,
  thin→`dimension.2`, thick→`dimension.4`). ~4 aliases.
- **Focus (finish it).** Colour is done (`border.interactive.focused`). Add
  `focus.ring.width` + `focus.ring.offset` as dimension aliases and group them.
  ~30 min.
- **Icon 3:1 toggle.** Parked by decision (icons mirror text today). One-line
  floor swap in `modes.ts`: resolve `icon.*` against `nonTextMin` (3:1) instead of
  reusing the text picks. Make it a theme input (`iconContrast: 'text' | '3:1'`).
- **Breakpoints.** `breakpoint/{0,1024,1920}` + semantic `mobile`/`desktop`.
  Mostly declared values; a thin generated layer.
- **Motion.** `motion/duration/{0,50,100,…}` ramp + easing curves. Single-lever
  generation from `motionPersonality` (already a schema stub) — same shape as the
  density/radius levers. Quick once the lever is wired.

### Larger builds

- **Typography** — *the headline white-label lever.* Two layers like colour:
  primitives `font/{family,weight,size,lineheight}` → composite styles
  `typography/{display,heading,body,…}/* = {fontFamily, fontSize, fontWeight,
  letterSpacing, lineHeight}`. Lever: declared families + weights + a **modular
  scale ratio** + base size → size ramp; line-heights bind per tier; optional
  fluid `clamp()` triplets. Schema input `typography` is stubbed. This is the
  "swap the font, regenerate the system" proof — highest value of the remaining set.
- **Shadow / elevation** — composite, **mode-aware**. NB ships
  `shadow/{xs..xl}/{default,inverse}`, and that `default`/`inverse` split *is* the
  light/dark variant (KB §4 lift pattern). Two synergies: it **reuses the
  `black-alpha` primitives** (shadow colours are rgba-black) and **pairs with the
  surface ladder** to complete the elevation story (light = shadow, dark = lift +
  fainter shadow). Lever: an elevation/personality scalar → a shadow ramp keyed to
  the ladder tiers.
- **Layout** — `container/{max,narrow}` + `grid/{mobile,desktop}/{columns,
  gutter,margin}`. Builds on breakpoints + the dimension grid (the 720 container
  outlier is already in the grid). A small responsive-grid lever.

### Brand-specific / harder to generate

- **Gradients.** Prism2 ships `color/gradient/brand/primary/{type,angle,stops[]}`.
  A real category, but **artistic** — angle and stop positions are brand design
  choices, not a contrast-derived lever. Options: pass-through brand-authored
  gradients, or derive a simple two-stop gradient from the primary ramp. Lower
  priority; revisit when a brand needs it.

---

## Cross-cutting: Figma round-trip (code → Figma export)  ·  backlog

> Not a token category — an **export target**. The engine emits DTCG today; getting
> generated tokens *back into Figma* is unbuilt, and composites don't survive a naive
> export. Captured here so the contract can shape composite design as we add more of
> them (typography, shadow). **Build deferred; analysis recorded.**

**The pipeline (as it actually is in the example packages).** Raw Figma variable
export → **a custom plugin (Adam's)** that preps it into DTCG / SD-ready JSON →
*(Style Dictionary downstream — has **not** run on these examples yet)*. So the DTCG
files in `Tokens/*/tokens/` are the **plugin's** output, not SD output; the composites
are assembled by that plugin, not by SD.

**Why composites don't map 1:1 (proven from the raw Figma JSON).** Figma variables
have only three resolved types — `COLOR` / `FLOAT` / `STRING` — plus a fixed `scopes`
vocabulary (the NB export uses 17: `FONT_SIZE`, `LINE_HEIGHT`, `LETTER_SPACING`,
`FONT_FAMILY`, `CORNER_RADIUS`, `GAP`, `OPACITY`, `STROKE_FLOAT`, `TEXT_FILL`, …).
There is **no composite variable type**. The composites only exist on the DTCG side:

| concept | raw Figma (native) | DTCG (post-plugin) |
|---|---|---|
| typography | atoms only — FLOAT `font/size`, `lineheight`; STRING `family` | composite `typography` ×120 |
| shadow | **absent** — it's an Effect *Style*, not a variable | composite `shadow` ×24 |
| transition | **absent** — no Figma type | composite `transition` ×15 |
| easing | STRING `"cubic-bezier(…)"` (binds to nothing) | `cubicBezier` ×15 |
| duration | FLOAT ms | `duration` ×56 |
| color / dims / opacity | variables 1:1 | same |

**The three-tier mapping contract** (each engine leaf gets a Figma disposition):

| disposition | meaning | examples |
|---|---|---|
| `variable` + `scope` | 1:1 Figma variable | color, radius, spacing, size, border-width, opacity |
| `style-part` + `scope` + style ref | atom a Figma **Style** binds | typography atoms → Text Style; shadow color/offsets → Effect Style |
| `code-only` | no Figma home; one-way from code | transition, spring, strokeStyle, easing |

**Two ways to beat the example packages, not copy them:** (1) **no dead variables** —
NB ships easing/duration as STRING/FLOAT "tokens" that bind to nothing; we tag those
`code-only` honestly. (2) **a generated style manifest** — NB's text/effect styles are
reassembled by hand in Figma (drifts); we'd emit the composite *and* its decomposition
*and* a manifest telling a companion plugin how to rebuild the Style, so the composite
survives the trip instead of silently dropping (shadow/transition have **no** variable
representation at all — without the manifest they vanish on the way back).

**Split of work.** *Now-step (cheap, deferred by decision):* tag every leaf with its
`$extensions.prism3.figma` disposition + scope, so composites are born knowing how they
decompose. *Backlog (large):* the `emit-figma.ts` writer producing `variables[]` (Tier A
+ Tier B atoms) **and** a style manifest, plus the companion Figma plugin to apply it.
Open decision (update-in-place vs build-from-scratch) tracked in `03-open-questions` Item 9.

**KB write-up (backlog).** No POV in the vault yet on composite tokens surviving the
Figma round-trip (closest: `05-development-support`, `22-token-architecture-extensions`).
Worth a practice note — styles-vs-variables, decompose-to-atoms, the manifest pattern —
when this graduates from analysis to build.

---

## Also considered — *not* shipped by either brand (optional / future)

- **Blur / backdrop-filter** (frosted overlays/glassmorphism) — niche; not in NB
  or Prism2. (The 108 `blur` hits in the tokens are the `blur` field *inside*
  shadow layers, not a standalone category.)
- **Z-index / layering** — neither brand ships it; add only if a consuming product
  needs a tokenised stacking order (would pair with the surface ladder).
- **Aspect ratio**, **border style** (solid/dashed) — rarely tokenised; skip until
  asked.

---

## Suggested sequence

1. ~~**Quick-win batch** — border width + focus dims + icon toggle~~ ✅ done
   (2026-06-27). Breakpoints split out — parked for discussion (fluid vs fixed).
2. ~~**Motion** — wire the `motionPersonality` lever~~ ✅ done (2026-06-27):
   `tempo`-scaled duration ramp, easing roles (+ `calm` a11y curve), M3 springs,
   Atlassian-style composite transitions, derived informational/vestibular
   reduce-motion. Aurora demos `snappy`.
3. **Typography** — the headline lever (largest value).
4. **Shadow** — completes elevation; reuses alpha primitives + the surface ladder.
5. **Layout** — responsive grid on top of breakpoints.
6. **Gradients** — only when a brand needs it (brand-artistic, no clean lever).

After 1–5 the engine covers every category NB and Prism2 ship except brand-artistic
gradients.
