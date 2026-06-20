# Prism3 engine (prototype)

A thin, dependency-free TypeScript prototype of the Prism3 generation engine.
Its only job right now is to **prove the color thesis against New Balance**:
generate NB's ramps from the reverse-engineered schema and diff them against
the real hand-built tokens.

This is not the production engine — it is the smallest thing that turns
`docs/02-nb-regression-pass.md` from a paper prediction into a measured result.

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
- `theme.ts` — loads the schema into ramp specs (one source of truth for the regression and the emitter).
- `nb-regression.ts` — diffs generated ramps against the real NB tokens (ΔE00 per step), checks the contrast contracts, writes `nb-regression-report.md`.
- `emit-dtcg.ts` — emits `out/nb.tokens.json` (see below) and validates every alias resolves.
- `nb-regression-report.md`, `out/nb.tokens.json` — generated outputs (committed so results are reviewable without running).

## DTCG output (`out/nb.tokens.json`)

Emitted in NB's own DTCG dialect — `nbds.color.<palette>.<step>`, `rgb(r, g, b)`
values, 3-digit padded steps — so it is drop-in comparable with the hand-built
NB tokens. Beyond parity, every primitive leaf carries the engine's provenance
under `$extensions.prism3`: the OKLCH source, hex, tonal band, whether it is the
exact pinned anchor, and its on-white contrast. A `nbds.semantic.*` layer maps
the contract roles (text, surface, border, action, status) to primitive steps
via DTCG brace aliases (e.g. `action.primary` → `{nbds.color.red.550}`), and the
run validates that all of them resolve. This is the artifact downstream
consumers (Style Dictionary, Figma import) actually read.

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
