# 00 — Progress & Status Log

> A living record of where Prism3 is, what was decided and why, and what comes
> next — so the work survives context loss and a fresh agent (or human) can pick
> it up without re-deriving anything. Update this when state or direction
> changes. Most recent entry first.

---

## Current status (2026-06-20)

**The color axis is built and proven end-to-end.** From a ~7-input theme schema
the engine generates gamut-aware OKLCH ramps, validates them against a real
shipped brand (New Balance), places steps by contrast role, emits a consumable
DTCG token file, and generates four contrast-verified appearance modes.

Headline numbers (regenerate with the commands below):

| Check | Result |
|---|---|
| NB color regression, aggregate ΔE00 (generated vs real NB) | **1.95** |
| Tonal-band contrast contracts (single ramp) | **11/11 pass** |
| Cross-mode contrast contracts (light/dark/hc-light/hc-dark) | **28/28 pass** |
| DTCG semantic aliases resolve | **44/44** |
| Color leaves emitted | 126 |

Work lives on branch `claude/prism3-token-architecture-leipq2` and is merged to
`main` for review.

---

## What exists

```
Prism3/
├── docs/
│   ├── 00-progress.md              ← this file (status + decisions + next steps)
│   ├── 01-token-architecture.md    ← the architecture spec / Theme Schema contract
│   └── 02-nb-regression-pass.md    ← the NB regression: method + measured results
├── schema/
│   ├── theme-schema.json           ← brand input contract (JSON Schema)
│   └── theme-schema.example.json   ← worked NB input (anchors, hues, etc.)
└── engine/                         ← dependency-free TypeScript prototype
    ├── color.ts                    ← sRGB↔OKLCH, CIELAB, CIEDE2000, WCAG contrast, gamut-aware max chroma
    ├── ramp.ts                     ← ramp generation: exact anchor, 20 steps, chroma arc, 5 bands, contrast-role placement
    ├── theme.ts                    ← schema → ramp specs (one source of truth)
    ├── modes.ts                    ← light/dark/hc-light/hc-dark, roles resolved by contrast target
    ├── nb-regression.ts            ← diffs generated vs real NB, checks contracts → nb-regression-report.md
    ├── emit-dtcg.ts                ← emits out/nb.tokens.json + modes-report.md, validates aliases & mode contracts
    ├── README.md                   ← how the engine works / how to run
    ├── nb-regression-report.md     ← generated (committed for review)
    ├── modes-report.md             ← generated (committed for review)
    └── out/nb.tokens.json          ← generated DTCG output (committed for review)
```

### How to run

```bash
# Node ≥ 20. No npm install — color math is self-contained.
npx tsx Prism3/engine/nb-regression.ts   # regression vs real NB
npx tsx Prism3/engine/emit-dtcg.ts       # emit DTCG + modes, validate
```

---

## Decisions log (why things are the way they are)

- **Build a real prototype, validate against NB.** The thesis ("a brand is a
  small input set the engine expands") is only credible if the engine can
  reproduce an existing hand-built brand. NB is the regression target.
- **TypeScript / Node, dependency-free.** Color math is owned in `color.ts` so
  the engine runs without a network install and the math is auditable. Run via
  `tsx`/`ts-node`; no build step.
- **Keep our intent grammar** (tonal bands, contrast roles) rather than copying
  a vendor's ramp shape. The engine generates from intent, not from NB's hexes.
- **OKLCH generation with exact-anchor preservation.** The brand value is a
  *pinned* step, never shifted (verified: NB `red.550` reproduced at ΔE00 0.05).
- **Chroma arc, not a flat plateau.** First cut held chroma constant and the
  light tints blew out (green.050 ΔE00 20); the regression falsified it. A
  chroma arc that tapers toward both ends dropped green's mean 6.23 → 1.88.
- **Contrast-role-targeted step placement (gap 1).** Steps are *placed* at the
  luminance their role needs, not on an even-L curve. The Mid-Tone 500 sits at
  the dual-side AA pivot (Y≈0.18, clears 4.5:1 on white *and* black). Took the
  contrast contracts to 11/11 and, because NB is Univers-derived, also tightened
  the perceptual fit (aggregate ΔE00 2.14 → 1.95).
- **Modes are derived, not hand-mapped.** Primitives are shared across modes;
  each semantic role re-resolves to a primitive step by contrast target against
  the mode's surface. The brand anchor is preserved where it can be (light
  `action.primary` = `red.550`) and auto-adjusted where it can't (dark → `red.450`).

---

## Open items / next steps (roughly prioritized)

1. **Prove downstream consumption.** Feed `out/nb.tokens.json` through Style
   Dictionary and/or the Figma MCP — confirm a real tool ingests it and the four
   modes map to Figma variable modes. This turns "generation" into "pipeline".
2. **Round-trip the raw-figma format.** Emit the second parallel format
   (`raw-figma/`) the repo keeps, preserving `variableId` linkage so the two
   formats stay reconcilable (see root `CLAUDE.md`).
3. **Extend beyond color.** Type / space / radius / motion scales from the
   schema (the schema already gestures at these).
4. **Opt-in per-step hue drift.** Reproduce brand hand-kinks (NB `amber.600`,
   `red.300` — the only remaining ΔE00 outliers). Constant-hue stays the default.
5. **Figma binding constraints.** Verify variable/mode constraints via the Figma
   MCP (still outstanding from the architecture review).

---

## Constraints to respect (from root CLAUDE.md)

- The base repo is design-tokens-only (JSON, no build). The `Prism3/engine/`
  tool is a new, self-contained addition — don't impose a build system on the
  token data.
- When editing existing brand tokens, change **both** the `raw-figma/` and
  `tokens/` (DTCG) copies and keep `variableId` linkage intact. (The engine
  currently emits a fresh DTCG tree under `engine/out/`; it does not yet write
  back into the brand token dirs.)
- Preserve namespaces (`nbds.*` for NB, `nbds.pds.*` for Prism2). Validate by
  JSON parse + every `{…}` alias resolving.
