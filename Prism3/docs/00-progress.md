# 00 — Progress & Status Log

> A living record of where Prism3 is, what was decided and why, and what comes
> next — so the work survives context loss and a fresh agent (or human) can pick
> it up without re-deriving anything. Update this when state or direction
> changes. Most recent entry first.

---

## Current status (2026-06-20)

**The color axis is built, proven against a real brand, AND proven white-label.**
From a ~7-input schema the engine generates gamut-aware OKLCH ramps, validates
them against New Balance, places steps by contrast role, generates four
contrast-verified appearance modes, and emits consumable DTCG. It now also runs
a *second, synthetic* brand (`aurora`, a violet primary with no status colors)
end-to-end — synthesising status palettes and carving a dedicated danger red the
brand never specified. Status generation no longer depends on brand anchors.

Headline numbers (regenerate with the commands below):

| Check | NB | Aurora (white-label) |
|---|---|---|
| Aggregate ΔE00 vs real NB | **1.95** | n/a |
| Tonal-band contrast contracts | **11/11** | (same engine) |
| Cross-mode contrast contracts | **28/28** | **28/28** |
| DTCG semantic aliases resolve | **44/44** | **44/44** |
| Color leaves emitted | 126 | 146 (5 palettes incl. carved danger) |
| Emit profile | `nbds.color` / rgb | `prism.color` / hex |

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
    ├── theme.ts                    ← Theme builder: nbTheme() (measured) + brandTheme() (white-label, status synthesis + danger carve)
    ├── modes.ts                    ← light/dark/hc-light/hc-dark, roles resolved by contrast target, brand-agnostic
    ├── nb-regression.ts            ← diffs generated vs real NB, checks contracts → nb-regression-report.md
    ├── emit-dtcg.ts                ← emits out/<id>.tokens.json per theme (NB + aurora) + modes-report.md, validates aliases & mode contracts
    ├── README.md                   ← how the engine works / how to run
    ├── nb-regression-report.md     ← generated (committed for review)
    ├── modes-report.md             ← generated, covers both themes (committed for review)
    └── out/{nb,aurora}.tokens.json ← generated DTCG output per theme (committed for review)
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
- **Status palettes are engine-supplied; danger is carved (white-label).** A
  brand supplies primary + neutral; the engine synthesises success/warning from
  canonical hues. If the primary is in red territory the brand red *is* the
  danger red (NB); otherwise the engine carves a dedicated danger red the brand
  never specified (aurora). Proven by running a second, non-red brand end-to-end.
  *Rationale:* status-from-anchors only worked because NB happened to supply
  them; a real white-label brand won't, and `danger == primary` for a red brand
  is a coincidence that breaks for everyone else (review finding).
- **Two emit profiles, one engine.** `nbds.color`/rgb for the NB regression
  (byte-comparable to real NB) and `prism.color`/hex for product output
  (DTCG-standard, Style-Dictionary-safe). Resolves the namespace + value-format
  review notes without losing NB comparability.
- **NB's per-step hue kinks are NOT reproduced, by design.** Per-step hue drift
  would be a brand input the schema deliberately resists ("resist the seventh").
  The `amber.600`/`red.300` outliers characterise NB's hand-authoring; they are
  not an engine gap (review finding — reframed from an earlier "opt-in feature").

---

## Open items / next steps (roughly prioritized)

Reordered per external review: prove breadth (a second brand through the full
stack) before pipeline plumbing — it tests the white-label thesis harder.

1. **Extend beyond color.** Type / space / radius / motion scales from the
   schema, so a second brand can be driven through the *full* stack (font swap +
   radius change), not just color. The schema already specs these (§4); the
   engine doesn't generate them yet. **Biggest remaining gap.**
2. **Prove downstream consumption.** Feed `out/*.tokens.json` through Style
   Dictionary and/or the Figma MCP — confirm a real tool ingests it and the four
   modes map to Figma variable modes. Turns "generation" into "pipeline".
3. **Round-trip the raw-figma format.** Emit the second parallel format
   (`raw-figma/`) the repo keeps, preserving `variableId` linkage (root `CLAUDE.md`).
4. **Figma binding constraints.** Verify variable/mode constraints via the Figma
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
