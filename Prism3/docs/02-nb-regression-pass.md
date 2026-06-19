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

*Companion files: `../schema/theme-schema.example.json` (the measured NB input), `01-token-architecture.md` (the architecture this tests). Source data: `Tokens/New Balance/tokens/tokens/shared/core-color.json` and siblings.*
