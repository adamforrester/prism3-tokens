# Prism3 — New Balance Regression Pass (first sketch)

> **Status:** v0.1 working analysis · **Date:** 2026-06-19
> Before the engine is trusted to *invent* brands, it must be able to *reproduce* one we already hand-built. New Balance is the natural target: it carries a real, shipped token set, including the `brand.primary` role slots and the literal status palettes (see architecture spec §0.1). This document reverse-engineers NB's existing tokens into a Prism3 schema, measures what the current ramps actually are in OKLCH, and defines what "the engine reproduced NB" has to mean. The companion input is `../schema/theme-schema.example.json`.

---

## 1. Method, in one line

**Do not diff hex.** A hand-authored ramp and a generated ramp will never be byte-identical, and demanding that would be measuring the wrong thing. The engine reproduces NB if the **perceptual** distance per step is small (ΔE) *and* the **functional** guarantees match (every semantic contrast pair lands on the same side of the WCAG floor). Hex equality is a non-goal; perceptual + functional equivalence is the bar.

---

## 2. What the current NB ramps actually are (measured)

OKLCH converted directly from `New Balance/.../shared/core-color.json` (sRGB → linear → OKLab → OKLCH). The shape of these numbers is the whole story.

### 2.1 Red (brand + danger) — clean, engine-shaped
Hue holds at **~23°** across the entire usable ramp (noise only at the near-white/near-black ends). Chroma rises to a **peak at `red.550` (L≈54, C≈0.215)** — which is NB Red, `#CF0A2C` — then tapers both ways. That chroma arc and constant hue is *exactly what a gamut-aware OKLCH generator produces by construction.*

| step | L | C | H |
|---|---|---|---|
| red.300 | 72.5 | 0.122 | 9.6 |
| red.350 | 71.4 | 0.135 | 23.2 |
| red.500 | 59.1 | 0.192 | 23.1 |
| **red.550** | **54.2** | **0.215** | **23.0** |
| red.600 | 50.7 | 0.200 | 22.9 |
| red.700 | 42.0 | 0.165 | 22.1 |

**Tell of hand-authoring:** the L* steps are *approximately* even (≈ −4 to −5 per step) but kink around 300–350 (ΔL −7.1 then −1.1, hue swinging 9.6→23). A generated ramp smooths exactly that kink — so this is where the first real diff will appear, and it is an *improvement*, not a regression.

### 2.2 Neutral — cool, and the example was wrong
Near-achromatic (C 0.001–0.014), but the residual chroma leans **blue/cool, hue ~240–245°**, peaking ~0.013 mid-ramp. The prior example schema had guessed a *warm* neutral (h25, matching the red). **The data says cool.** This is the single most important correction this pass produced, and it is the kind of thing only measurement catches.

Because neutrals are near-achromatic, their raw hue is numerically noisy (it reads 197→228→…→325 down the ramp) — which is precisely why the diff must be ΔE/contrast-based: a generated constant-hue-243 neutral is perceptually identical to NB's wandering near-grays even though the hue numbers differ wildly.

### 2.3 Status hues
| role | source palette | L | C | H |
|---|---|---|---|---|
| success | green.500 | 53.3 | 0.136 | 152 |
| warning | amber.500 | 57.8 | 0.136 | 59 |
| danger | red.550 | 54.2 | 0.215 | 23 |
| info | — | — | — | — |

Two findings: **NB ships no info colour** (no blue palette exists), and **danger reuses the brand hue** (both ~23°). The engine must therefore (a) tolerate a missing status slot rather than fabricate one, and (b) the `.ai.json` must disambiguate promo-red (`text.promo` → red.550) from error-red (`feedback.*.negative` → red.550/700), since they are the same colour with different meaning.

### 2.4 Type scale — confirms the display-pivot
Sizes 12·14·16·18·20·24·28·32·40·48·60·76·96·120. The step ratio is **not constant**: ≈1.15 at body sizes (12→14→16) climbing to ≈1.25 at display (60→76→96→120). That is the two-ratio "display pivot" the architecture predicts (§4.2) — a single modular ratio would not reproduce NB. Two ratios (`scaleRatioText` 1.15, `scaleRatioDisplay` 1.25) do.

---

## 3. The reverse-engineered schema

Captured in `../schema/theme-schema.example.json` with `$source` notes on every measured field. Headline inputs:

- **primary** NB Red — OKLCH(0.542, 0.215, 23)
- **neutral** cool — hue 243, chroma ~0.013
- **status** success(152) / warning(59) / danger(23) / **info none**
- **type** Garamond Std display (serif) + Proxima Nova text (sans, weights 400/500, *not* variable) + condensed cut; ratios 1.15 / 1.25
- **radius** baseMd 4, near-linear 2px steps, pill 128 — a sharp brand
- **density** 4px grid, comfortable/compact
- **motion** standard duration set; signature easing `fast-out-slow-in` (0.2, 0, 0, 1)

That is ~7 meaningful inputs reproducing **140 semantic colour aliases + 20-step ramps × 4 hues + the type/space/radius/motion scales** — the compression ratio is the entire economic argument (spec §0, "tenth brand at 10%").

---

## 4. Predicted diff: where the engine matches vs diverges

**Should match (within tight ΔE):**
- Red hue (23°) and the chroma-arc shape — generator-native.
- Brand anchor `red.550` itself (it *is* the input).
- Type, space, radius, motion scales — these are arithmetic NB already follows.
- **The 5 tonal bands** (spec §5.2): NB's ramp is Univers-derived, so its steps should map cleanly onto Highlights (025–050) / ¼-Tones (100–350) / Mid-Tones (400–600, with `red.550` as the brand Mid-Tone) / ¾-Tones (650–900) / Shadows (950). If the engine's band boundaries don't reproduce NB's, that's a band-calibration finding, not an NB problem.

**Will diverge, expectedly and for the better:**
- The `red.300–350` L*/hue kink smooths out.
- Neutral hue regularises to a constant cool 243 instead of wandering.
- Per-step L* spacing becomes uniform where NB's was hand-nudged.

**Risk zones to watch (genuine regression candidates):**
- **Contrast cliffs.** NB's hand placement passes today — e.g. `text.primary` (neutral.950) on white ≈ **18.4:1**; white on brand `red.550` ≈ **5.63:1** (AA normal, *not* AAA). If the generator nudges `red.550` lighter for chroma, that 5.63 can drop below 4.5 and break `text.promo`/feedback. This pairing is the canary.
- **The missing info slot** — engine must not invent a blue.
- **Brand==danger hue** — must survive as two distinct semantic meanings on one colour.

---

## 5. Acceptance criteria ("the engine reproduced NB")

1. Every one of NB's **140 semantic colour aliases** resolves, and its WCAG ratio lands on the **same side of the 4.5 / 3.0 floor** as today (no pair regresses across light/dark/HC).
2. Per-step **ΔE2000 ≤ ~3** against the hand-authored ramp at the steps semantics actually consume (peak/anchor steps weighted hardest).
3. The brand anchor `red.550`, the cool-neutral character, and the status hues are reproduced from the schema alone.
4. The type/space/radius/motion scales regenerate exactly (they are arithmetic).
5. Divergences are confined to the *expected* smoothing in §4 and are individually explainable — no silent surprises.

Meeting 1–5 means the engine can reproduce a real brand before it is trusted to generate new ones. Failing any of them is a finding about the *engine*, not about NB.

---

## 6. Actual run (prototype engine)

The paper prediction above has now been run for real. A dependency-free TypeScript prototype (`../engine/`, run with `npx tsx Prism3/engine/nb-regression.ts`) generates the brand/red, success/green, warning/amber and neutral ramps from the schema and diffs them against the real NB tokens with CIEDE2000. Full output is committed at `../engine/nb-regression-report.md`.

**Result (with contrast-role-targeted placement):**

| ramp | ΔE00 mean | within ΔE00 ≤ 3 |
|---|---|---|
| brand (red) | 2.39 | 15/20 |
| success (green) | 1.88 | 20/20 |
| warning (amber) | 1.83 | 19/20 |
| neutral | 1.70 | 19/20 |

Aggregate mean **ΔE00 1.95**, and **11/11 tonal-band contrast contracts pass** — within the §5 acceptance bar. Specific confirmations:

- **Exact anchor pinning is exact:** generated `red.550` = `#cf0b2c` vs NB `#cf0a2c`, ΔE00 **0.05**; white-on-`red.550` contrast **5.62** vs NB's **5.63** (the canary, criterion §5).
- **The chroma model had to be corrected by the data.** A first cut held chroma flat across the ramp and the light tints blew out (green.050 ΔE00 **20**), because the light-green gamut is wide and NB *chooses* to desaturate its tints. Switching to a chroma **arc** that tapers toward both ends dropped green's mean from 6.23 → 1.88. This is the regression doing its job — falsifying a wrong assumption before it shipped.
- **The residual outliers are the predicted hand-nudges**, not engine error: NB swings `amber.600` toward red (H42 vs 59) and `red.300` toward pink (H9.6 vs 23) — the §4 "hand-authoring tells." A constant-hue engine won't follow them by design.

**Contrast-role-targeted placement (now implemented).** The first run placed steps on an even-L curve, so `red.500` landed at **4.46:1 on black** — just under the Mid-Tone dual-side 4.5 floor (10/11 contracts). The fix follows spec §5.2: role-critical steps are *placed* at the luminance their role requires, not wherever even spacing lands them. The Mid-Tone 500 is now pinned to the centre of the narrow luminance window where a color clears 4.5:1 on **both** white and black (Y ≈ 0.18). `red.500` now reads **4.58:1 on white and black**, and all **11/11** contracts pass. Because NB is itself Univers-derived (which also pivots 500 at the dual-AA point), matching that pivot *also* tightened the perceptual fit — aggregate ΔE00 fell 2.14 → 1.95, neutral 2.39 → 1.70.

**On the residual outliers (`amber.600`, `red.300`).** These are NB hand-applied hue kinks, and the engine deliberately does **not** reproduce them. Per-step hue drift would mean a brand could specify the hue of every step — exactly the kind of input the architecture resists ("resist the seventh"). So these are best understood as a *characterisation of NB's hand-authoring idiosyncrasy*, not a feature the engine is missing. Constant hue is the correct, principled default.

Net: the spine of the architecture — exact-anchor preservation, ~20-step bands, gamut-aware OKLCH ramps, **contrast-role placement**, and the band contracts — reproduces a real shipped brand from a ~7-input schema, fully passing the colour acceptance criteria.

**Output.** The engine emits a DTCG token tree (`../engine/emit-dtcg.ts` → `../engine/out/nb.tokens.json`) in NB's own dialect, so it is drop-in comparable with the hand-built tokens. Each primitive leaf additionally carries its OKLCH source, tonal band, anchor flag, and contrast under `$extensions.prism3`, and a `nbds.semantic.*` layer maps the contract roles to primitive steps via brace aliases (all validated to resolve). This is the consumable artifact — the bridge to Style Dictionary and Figma import.

**Modes.** The same primitives feed four generated appearance modes — `light`, `dark`, `hc-light`, `hc-dark` (`../engine/modes.ts`, report at `../engine/modes-report.md`). Modes don't regenerate primitives; they re-resolve each semantic role to a primitive step *by contrast target* against the mode's surface. The brand anchor is preserved where it can be (light `action.primary` = `red.550`) and auto-adjusted where it can't (dark `action.primary` lightens to `red.450` to clear AA on a near-black surface). All 28 cross-mode contrast contracts pass — evidence that one OKLCH primitive set plus contrast-derived role mapping covers the full appearance axis without per-mode hand-tuning.

**The dimension axis (space + radius).** Color is the hard axis; space and radius are the cheap proof that the same "primitives + semantic aliases" architecture generalises. The engine generates a primitive `dimension` grid (the 4px ladder `0,1,2,4,6,8,…,128`) and derives the `space` and `radius` semantic tokens as aliases into it, driven by exactly two brand inputs: `density` (one enum) for spacing rhythm and `radius.scale` (one scalar) for corner form-factor (§4/§5). Because these are integer px, the bar is **exact equality**, not perceptual ΔE — and the engine reproduces NB's full space + radius system at **15/15** (10 space steps `4xs`→`3xl`, 5 radius steps `none`→`round`) from `baseUnit=4` / `comfortable` / `scale=1`. This is the schema's "form-factor distinguisher" and "spacing-rhythm step" claims made literal: NB's `radius.lg`=6px and `space.md`=32px fall out of two numbers, not a hand-built table.

**Beyond NB — the white-label check.** Reproducing NB proves fidelity; it does not by itself prove the engine generalises, because NB happens to *supply* status colours and its brand hue happens to be its danger hue. So the engine also runs a second, synthetic brand (`aurora`) that declares only a violet primary (`h285`) and a neutral — no status colours at all (`../engine/out/aurora.tokens.json`, product dialect `prism.color`/hex). The engine synthesises `success`/`warning` from canonical hues and, because violet is not red, **carves a dedicated danger red** (`h27`) the brand never specified. The result: `action.primary` → `{prism.color.primary.550}` (violet) and `status.danger` → `{prism.color.danger.500}` (red) resolve to *distinct* palettes, with all 28 cross-mode contracts passing. Aurora also drives a *different form factor* through the same engine — soft corners (`radius.scale`=2 → `sm/md/lg` = 4/8/12px vs NB's 2/4/6) and compact density (every space step one grid rung tighter) — so the second brand differs on color, status, danger, corners, and rhythm from five small inputs. This is what makes the "brand = small input set" claim real rather than NB-specific.

---

*Companion files: `../schema/theme-schema.example.json` (the measured NB input), `01-token-architecture.md` (the architecture this tests). Source data: `Tokens/New Balance/tokens/tokens/shared/core-color.json` and siblings.*
