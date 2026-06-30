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
| **Focus** | NB `focus` | ✅ Done | ring width/offset/offset-field/style; colour = `border.focus` | — |
| **Icon 3:1 toggle** | (colour sub-item) | ✅ Done | `iconContrast: 'text' \| '3:1'` theme input | — |
| **Breakpoints** | NB `core-breakpoint` | ✅ Done (with layout) | 5 t-shirt min-width floors; fluid-vs-fixed RESOLVED → fluid-first + cap | — |
| **Motion** | NB `core-motion`, `motion` | ✅ Done | `motionPersonality.tempo` → duration ramp; easing roles + springs + composites + derived reduce-motion | — |
| **Layout** | NB `layout` | ✅ Done | breakpoints + grid (12-col design ladder) + containers; gutter/margin alias the spacing scale; Figma breakpoint-modes | — |
| **Shadow** | NB `shadows` | ✅ Done | 6-step 2-layer shadow ramp + inset (`softness`+`tint` levers, mode-aware lift-primary, Figma Effect Style). Elevation = a foreground tier + a shadow at the component layer (no `elevation.*` colour group — removed in the docs/06 rework) | — |
| **Typography** | NB `core-typography`, `typography` | ✅ Done (primitives + composites + fluid + weight axis + links) | curated rem ladder + weight roles + family triad; semantic composites (display/title/body/label/caption/eyebrow/code), each `type.<group>.<size>.<weight>` with a **per-role weight axis** (display/title `[strong]`, body/caption `[default,strong]`, … — all expandable) + a `-link` underline variant for body+caption; levers typeScale/displayCeiling/titleFloor/familyMap/responsive/**weights**/**links**; fluid clamp() + Figma desktop/mobile modes from one min/max pair | — |
| **Gradients** | Prism2 `color/gradient/*` | ✅ Done (opt-in) | OFF by default (field abstains); `gradients: true` ships one default brand gradient, or an explicit list. DTCG `gradient` composite, stops alias the ramp; kind/angle/interpolation in `$extensions` (DTCG omits them); OKLCH interpolation + N-stop sRGB pre-sample for Figma; Figma Paint Style (only stop colours bind); worst-case-stop contrast for text-on-gradient | — |

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

- **Typography** — *the headline white-label lever.* **Phase 1 (primitive tier) SHIPPED (2026-06-28):**
  a **curated rem size ladder** (22 steps 10–160px — deliberately NOT ratio-derived;
  variable density, clean values, covers all bases, reproduces the Prism2 scale),
  a numeric **weight reference tier** (100–900) + **function-named weight roles**
  (`subtle/default/emphasis/strong` aliasing into it — the white-label-safe answer
  to "one brand's bold is 700, another's 600"), **family triad** (display/text/mono
  with auto-padded fallback stacks + variable-font flag), unitless **line-height**
  multipliers, and **em letter-spacing**. Each leaf carries a Figma materialization
  directive in `$extensions.prism3.figma` (line-height `px-from-ratio`, size px,
  scopes). Lever wired into `BrandInput.typography` (families / weightRoles /
  typeScale) + schema; aurora exercises it (Clash Display variable, emphasis→500,
  expressive scale). **Phase 2 (semantic composites) SHIPPED (2026-06-28):** a
  `type.*` group — `display` (sm→3xl), `title` (xs→2xl, opt-in 2xs=16), `body`
  (sm/md/lg), `label` (sm/md), `caption`, `eyebrow`, `code.inline` — each a DTCG
  composite bundling family + size + weight *role* (two-hop → numeric, so a brand
  weight re-map reflows every composite) + line-height + tracking, materializing as
  a Figma Text Style. Field-survey-grounded naming (11-system survey in the KB
  research run): **"title" not "heading"** (dodges the H-tag collision), **button
  folded into `label`** (M3 precedent — not its own type group), **`detail` retired**
  → caption + label, **`eyebrow`** added for marketing kickers, **`code`** for mono;
  **`link` deliberately omitted** (colour/decoration, not a type role). Levers:
  `typeScale` (shifts heading sizes ±1 rung), `displayCeiling` (caps the hero tier —
  "not everyone needs the high end"), `titleFloor` (opt-in 16px brand-font title),
  `familyMap` (per-group family role — family is a property of the group, not the
  size, so `title.xs`@18 and `body.lg`@18 share a size primitive but stay distinct
  tokens; the overlap is visible in `font.size.18.aliased_by`). 511/511 aliases,
  268/268 contracts. **Phase 3 (responsive) SHIPPED (2026-06-28):** each heading
  composite (display + title) gets a **mobile endpoint**
  via a **research-validated size-dependent curve** (not a flat factor): body/UI
  static, titles ~1 rung down (floored at 20px), display shrinking *progressively*
  — converging to a ~40–48px mobile "hero band" no matter how large desktop goes
  (`160→48`, ≈Carbon fluid-display-04 `40→176`). A flat factor was the first cut;
  field research (Carbon fluid-display, Utopia, the body-stays-constant consensus)
  showed bigger sizes must shrink *more*. The **one min/max pair drives both
  outputs** — `$extensions.prism3.
  responsive` carries the web `clamp(min, preferred, max)` (rem-floored per WCAG
  1.4.4) **and** the Figma `figma.modes.{mobile,desktop}` for desktop/mobile
  collection modes — while `$value.fontSize` stays the desktop canonical/fallback
  (the locked materialization pattern: exporter reads `$extensions`). Lever
  `responsive: { fluid, minViewport, maxViewport }` (default on, 375–1280px); aurora
  runs 360–1440. Line-height stays a unitless multiplier (scales on web; per-mode px
  in Figma). 103/103 tests (incl. fluid-endpoint invariants), 511/511 aliases,
  268/268 contracts. **Typography is now complete (primitives + composites + fluid).**
  Original plan: Two layers like colour:
  primitives `font/{family,weight,size,lineheight}` → composite styles
  `typography/{display,heading,body,…}/* = {fontFamily, fontSize, fontWeight,
  letterSpacing, lineHeight}`. Lever: declared families + weights + a **modular
  scale ratio** + base size → size ramp; line-heights bind per tier; optional
  fluid `clamp()` triplets. Schema input `typography` is stubbed. This is the
  "swap the font, regenerate the system" proof — highest value of the remaining set.
  **Figma binding constraints to design for** (verified — see KB research run
  `2026-06-28-figma-variables-styles-roundtrip`): the bindable text-style surface
  is exactly **8 fields** (family, style, weight, size, lineHeight, letterSpacing,
  paragraphSpacing, paragraphIndent). **`lineHeight`/`letterSpacing` bind as px
  only** — a bound unitless FLOAT is read as pixels, so `1.5` → 1.5px, not 150%.
  **`textDecoration`/`textCase` can't bind at all** → underlined links and all-caps
  roles must be **separate Text Styles** with the property baked in (emit `body` +
  `body-link`; handle `text-decoration` at generation, not as a variable toggle).
  **`desktop`/`mobile` = collection modes** on the size *and* line-height
  variables (line-height must be a moded px var to scale with size); note Figma's
  styles picker doesn't reflect modes, so write per-mode values into the style
  description.
  - **Metadata / materialization decision (locked for the build):** the canonical
    line-height stays a **unitless ratio in `$value`** (DTCG-correct, ships to
    code as-is); a machine-readable **materialization directive** lives in
    `$extensions.prism3.figma` for the exporter (e.g. `{kind:"style-part",
    field:"lineHeight", unit:"px-from-ratio", basis:"fontSize"}`); the **intent is
    *echoed* into `.ai.json`** as narrative, generated from the directive. The
    exporter reads `$extensions` (data), never the prose sidecar — the sidecar
    stays descriptive/regenerated and never becomes build input. Same pattern
    applies to letter-spacing (% → px), fluid `clamp()` sizes (one fixed px per
    mode), and any other case where the DTCG-canonical value ≠ the Figma-bindable
    value. See the materialization directive under *Cross-cutting: Figma
    round-trip*.
- **Shadow / elevation** — composite, **mode-aware**. **Phase A SHIPPED
  (2026-06-28):** `shadow.{xs..2xl}` + `shadow.inset`, each a **2-layer (key +
  ambient)** DTCG `shadow` composite; **tinted near-black** base (Polaris/Comeau —
  not pure black; `tint` hue+amount lever, amount 0 = pure black for the NB
  dialect); **`softness`** = the blur:offset personality dial (crisp product → soft
  marketing); offsetX 0, spread negative-and-growing. **Mode-aware, lift-primary**
  (field-validated, 10-system survey): full shadow in light (canonical `$value`),
  **reduced** shadow in dark (`$extensions.prism3.modes.dark`, top-weighted) — the
  surface ladder carries dark elevation; rejected NB's heavier-`inverse` as the
  default. Materializes as a Figma **Effect Style** (colour + numerics bindable).
  112/112 tests (incl. shadow invariants). **Phase B (semantic `elevation.*`
  colour ladder) was SHIPPED 2026-06-28 then REMOVED 2026-06-29** by the surface
  & content model rework (`06-surface-and-content-color-model.md`): a UI-designer
  review found the `elevation.*` group (`sunken/flat/raised/overlay/floating` +
  component aliases) mostly re-aliased the surface tiers. Elevation is now **a
  `foreground` surface tier + a `shadow` step, composed at the component layer** —
  no parallel colour group. The shadow ramp itself (Phase A) stands. *Research:* KB
  `_research/_inbound/2026-06-28-shadow-elevation-tokens` (10-system survey) +
  31-color-systems §"Shadow tokens — shape, colour, and the elevation lever".
  Original note:
  NB ships `shadow/{xs..xl}/{default,inverse}`; the split is the light/dark variant.
- **Layout** — **SHIPPED (2026-06-28).** `breakpoint.{sm..2xl}` (5 min-width
  floors, count-aware names — `xs` prepended at 6+) + `grid.{bp}.{columns,gutter,
  margin}` + `container.{max,narrow,fluid}`. Columns emit a **4/8/12 design ladder**
  (base count is one knob; the column grid is a Figma layout-grid / design artifact,
  not the load-bearing code contract — build with CSS Grid). **Gutter/margin ALIAS
  the spacing scale** (16/24/32 · 16/24/48) — not independent tokens. **Containers:
  fluid-first + a `container.max` cap + a `narrow`≈720 reading measure** — the
  parked fluid-vs-fixed decision RESOLVED by collapsing it (no Prism2-style dual
  tree; fixed-stepped is a deferred opt-in). Breakpoint-keyed values carry a Figma
  directive mapping them to a **separate layout collection (modes = breakpoints)**
  that composes with the colour light/dark collection. Lever: breakpoint floor
  array + base column count (+ container caps); everything else derived. 621/621
  (nb) / 618/618 (aurora) aliases, 124/124 tests. *Research:* KB `_research`
  10-system survey (pending filing).

### Brand-specific / harder to generate

- **Gradients.** ✅ **Done (opt-in).** Prism2 shipped
  `color/gradient/brand/primary/{type,angle,stops[]}` — shredded into 6 scalar
  Figma variables (round-trippable, but non-rendering data). The engine does
  better: a single **DTCG `gradient` composite** whose stops **alias the colour
  ramp** (the Fluent/Carbon model), with the kind/angle/interpolation DTCG omits
  (issue #101) carried in `$extensions`. OKLCH interpolation by default (no sRGB
  grey dead zone) with an **N-stop sRGB pre-sample** for Figma (which interpolates
  in sRGB only); materializes as a **Figma Paint Style** (only stop colours bind);
  a **worst-case-stop contrast** check gates text-on-gradient. Brand-authored and
  **OFF by default** — the field overwhelmingly abstains (Material/Carbon/
  Atlassian/Primer/USWDS ship none; Polaris/SLDS deprecated theirs; only Fluent
  ships a real composite), so this is opt-in, not a derived-for-everyone axis.
  `true` ships one default brand gradient; an explicit list ships exactly those.
  Linear + radial supported (conic/diamond skipped — rare, no clean CSS↔Figma
  parity). Grounded in a 10-system survey + the DTCG spec (2025.10) + the Figma
  gradient round-trip research.

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

**The materialization directive (where DTCG-canonical ≠ Figma-bindable).** Some
tokens can't bind their canonical value directly: Figma reads a bound unitless
line-height as px (`1.5` → 1.5px), can't bind `%` line-height/letter-spacing,
can't bind text-decoration/case at all, and needs a fixed px per mode where code
uses a fluid `clamp()`. The locked decision: keep the **canonical value in
`$value`** (code-correct), put a **machine-readable directive in
`$extensions.prism3.figma`** that the exporter reads to materialize the bindable
form (e.g. `{kind:"style-part", field:"lineHeight", unit:"px-from-ratio",
basis:"fontSize"}`), and **echo the intent into `.ai.json`** as derived narrative.
Rule of thumb: *if the exporter must read it to produce correct output, it's
`$extensions` data; if it explains why to a reader, it's `.ai.json`.* The prose
sidecar stays descriptive and regenerated — never build input, so it can't drift.

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
3. ~~**Typography**~~ ✅ done — the headline lever (largest value).
4. ~~**Shadow**~~ ✅ done — completes elevation; reuses alpha primitives + the surface ladder.
5. ~~**Layout**~~ ✅ done — responsive grid on top of breakpoints.
6. ~~**Gradients**~~ ✅ done (2026-06-29) — opt-in (off by default; the field abstains).
   DTCG composite, ramp-aliased stops, OKLCH interpolation + sRGB pre-sample for
   Figma, Paint Style materialization, worst-case-stop contrast. Aurora demos a
   linear brand + a radial glow.

The engine now covers **every token category** NB and Prism2 ship. What remains is
cross-cutting plumbing (the Figma round-trip writer) and a theming playground, not
new token categories.
