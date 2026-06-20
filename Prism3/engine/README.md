# Prism3 engine (prototype)

A thin, dependency-free TypeScript prototype of the Prism3 generation engine.
Its only job right now is to **prove the color thesis against New Balance**:
generate NB's ramps from the reverse-engineered schema and diff them against
the real hand-built tokens.

This is not the production engine — it is the smallest thing that turns
`docs/02-nb-regression-pass.md` from a paper prediction into a measured result.

## Run

```bash
npx tsx Prism3/engine/nb-regression.ts
```

Node ≥ 20. No `npm install` needed — the color math is self-contained
(`color.ts`), so the engine runs without a network. The run prints a report
and writes `nb-regression-report.md` next to the script.

## Files

- `color.ts` — sRGB ↔ OKLCH, sRGB → CIELAB, CIEDE2000, WCAG contrast, gamut-aware max chroma. No deps.
- `ramp.ts` — ramp generation per spec §5.1–5.2: exact anchor pinning, 20-step scale, chroma **arc** (tapers toward both ends), gamut clamp, 5 tonal bands.
- `nb-regression.ts` — loads the NB schema + the real NB tokens, generates, diffs (ΔE00 per step), checks the tonal-band contrast contracts, prints a verdict.
- `nb-regression-report.md` — generated output (committed so the result is reviewable without running).

## What it currently does / doesn't

**Does:** exact anchor preservation; anchor-pinned L interpolation; chroma arc;
gamut-aware chroma; **contrast-role-targeted placement** (Mid-Tone 500 pinned to
the dual-side AA luminance pivot so all band contracts pass); band classification;
WCAG contract checks.

**Doesn't yet (next increments):**
- *Optional per-step hue drift* — NB hand-shifts a few steps (amber.600, red.300);
  a constant-hue engine won't follow those unless we add an opt-in drift curve.
  Constant-hue is the right default, so this is opt-in, not a gap.
- Light/dark/HC mode generation, type/space/radius/motion, DTCG + Figma emit.
