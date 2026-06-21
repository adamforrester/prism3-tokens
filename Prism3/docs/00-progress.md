# 00 — Progress & Status Log

> A living record of where Prism3 is, what was decided and why, and what comes
> next — so the work survives context loss and a fresh agent (or human) can pick
> it up without re-deriving anything. Update this when state or direction
> changes. Most recent entry first.

---

## Current status (2026-06-21)

**The color AND dimension axes are built, proven against a real brand, and
proven white-label.** From a ~7-input schema the engine generates gamut-aware
OKLCH ramps, places steps by contrast role, generates four contrast-verified
appearance modes, generates the space + radius scales from a primitive grid, and
emits consumable DTCG. It validates all of this against New Balance, and runs a
*second, synthetic* brand (`aurora`) end-to-end — synthesising status palettes,
carving a dedicated danger red the brand never specified, and applying a distinct
form factor (soft corners + compact density). Status, space, and radius
generation are all brand-input-driven, not NB-specific.

Headline numbers (regenerate with the commands below):

| Check | NB | Aurora (white-label) |
|---|---|---|
| Aggregate ΔE00 vs real NB (color) | **1.95** | n/a |
| Tonal-band contrast contracts | **11/11** | (same engine) |
| Cross-mode contrast contracts | **108/108** | **108/108** |
| **Dimension axis, exact** (Prism2 space + NB radius) | **21/21** | n/a |
| DTCG semantic aliases resolve (color + dim + size) | **208/208** | **208/208** |
| Color primitives / dim grid emitted | 102 / 37 | 142 / 36 |
| Brand palettes / action source | red / **action = brand** (red) | primary+accent+… / **action = accent ≠ brand** |
| Form factor | comfortable / radius 1 (sharp) | compact / radius 2 (soft) |
| Emit profile | `nbds.*` / rgb | `prism.*` / hex |

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
    ├── ramp.ts                     ← color ramp generation: exact anchor, 20 steps, chroma arc, 5 bands, contrast-role placement
    ├── scale.ts                    ← dimension axis: 4px grid + numbered space scale (8px rhythm) + radius + component sizes
    ├── theme.ts                    ← Theme builder: nbTheme() (measured) + brandTheme() (white-label: open brandColors[], action role decoupled from brand, status synthesis + danger carve + form factor)
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
  the mode's surface. The brand anchor is preserved where it can be and
  auto-adjusted where it can't (a dark-mode action lightens when the anchor can't
  clear AA on a near-black surface).
- **Semantic vocabulary: `background` / `foreground` / `action` / `border`,
  states-on-roles.** Decided against a 7-system field survey + the practice KB.
  `background.*` = non-interactive container fills (default/raised/overlay/sunken/
  subtle/inverse + semantic tints); `foreground.*` = content incl. text tiers,
  vivid semantic text, links, and `on-*` pair tokens; `action.*` = the
  interactive fill role as states (default/hover/pressed/focus/inactive) — NOT a
  dedicated `interactive/` tree; `border.*` = edges incl. focus ring + validation.
  `status` is folded into background/foreground/border by role (success/warning/
  danger/**info**, info newly synthesised). 36 semantic roles × 4 modes. Field
  evidence: background-vs-surface split ~5:3 (tie-broken toward the brand's NB
  vocabulary), `on-*` pairing universal (7/7), states-on-roles 6/7 (only Carbon
  ships a dedicated interactive namespace). *Rationale:* user decision after
  research — keep NB's background/foreground words, drop NB's interactive bucket
  in favour of the field-standard states-on-roles. Text on a vivid fill targets
  AA (gamut-bounded — 7:1 is unreachable on a saturated mid), everything else
  escalates in HC.
- **Contrast is validated against the floor surface, not the pure extreme.**
  Saturated, contract-bearing foregrounds (action + states, vivid semantic text,
  secondary/tertiary text) clear
  their ratio against the most-tinted supported surface — light/hc-light →
  `neutral.50` (a step off white), dark/hc-dark → `neutral.950` (a step off
  black) — not pure white/black. Pure white is the *most forgiving* light
  background; a colour that only just passes there breaks the moment it sits on a
  `neutral.50` card. Validating against the floor builds in headroom so the
  colour holds across the elevation range, and is symmetric with the dark side
  (which already used `neutral.950`). Without it, a saturated colour that only
  clears 4.5:1 on pure white drops below AA the moment it sits on a `neutral.50`
  card. *Rationale:* user direction — "actions need to meet contrast on surfaces
  that sit on top of white, not just pure white; otherwise it breaks with other
  light neutrals."
- **The primary surface — and therefore the floor — is configurable.** A brand
  can declare a non-white/black page surface per mode via `surfaces` (base =
  `white` | `black` | a neutral step); the contrast floor moves with it (a
  tinted base defaults its floor one step further toward mid), and the engine
  **flags a non-default surface in notes for confirmation**. Defaults reproduce
  the white/`neutral.950` behaviour exactly, so brands that don't set it are
  unaffected. Proof: aurora declares its light page as `neutral.50`, the floor
  auto-moves to `neutral.100`, and `action.default` resolves to `accent.600`
  (4.95:1 on the tinted page) — two steps off the naive white-only pick.
  *Rationale:* user direction — "we may need to allow a user to confirm the
  primary surface colour that's not white, and that would change the floor."
- **Status palettes are engine-supplied; danger is carved (white-label).** A
  brand supplies primary + neutral; the engine synthesises success/warning from
  canonical hues. If the primary is in red territory the brand red *is* the
  danger red (NB); otherwise the engine carves a dedicated danger red the brand
  never specified (aurora). Proven by running a second, non-red brand end-to-end.
  *Rationale:* status-from-anchors only worked because NB happened to supply
  them; a real white-label brand won't, and `danger == primary` for a red brand
  is a coincidence that breaks for everyone else (review finding).
- **Open brand-palette set + action decoupled from brand.** The white-label
  input takes `primary` + `neutral` + an arbitrary `brandColors[]` (secondary /
  tertiary / accent — any number), and `action` is now a FIRST-CLASS semantic
  role mapped independently of `brand`. Many brands' hero colour is a poor or
  reserved interactive colour, so `actionPalette` points action wherever the
  brand needs; it defaults to `primary` but the engine **emits a note flagging
  the decision** so it's confirmed, never silently assumed. Proven on aurora: a
  violet hero brand whose `action.default` resolves to a separate azure
  `accent.500`, while NB keeps `action = brand` (red) by design. *Rationale:*
  user direction — "action is not always the primary brand colour; needs
  flexibility built in, and the system should confirm which colour drives
  actions."
- **Two emit profiles, one engine.** `nbds.color`/rgb for the NB regression
  (byte-comparable to real NB) and `prism.color`/hex for product output
  (DTCG-standard, Style-Dictionary-safe). Resolves the namespace + value-format
  review notes without losing NB comparability.
- **NB's per-step hue kinks are NOT reproduced, by design.** Per-step hue drift
  would be a brand input the schema deliberately resists ("resist the seventh").
  The `amber.600`/`red.300` outliers characterise NB's hand-authoring; they are
  not an engine gap (review finding — reframed from an earlier "opt-in feature").
- **Dimension axis mirrors the color architecture: primitives + semantic
  aliases.** A primitive `dimension` grid (4px: 0,1,2,4,6,8,…,128) with `space`,
  `radius`, and component `size` tokens aliasing into it — the same shape as
  color ramps + semantic roles. Reproduces our chosen targets **exactly** (21/21)
  and aurora runs a *different* form factor (compact / scale 2) through the same
  code. Integer px, so the bar is exact equality, not perceptual ΔE.
- **Naming taxonomy POV — numbered-multiplier space, t-shirt only at the
  component layer** (knowledge-base 02/22/24; matches the user's preference and
  the Prism2 house standard). The reasoning, pressure-tested rather than copied
  from NB (which is a *fidelity test*, not the taxonomy authority):
  - **Space** is a numbered-multiplier scale at the *reference* tier:
    `space.100`=1×, `.200`=2× … on an **8px rhythm** (`space.100`=8px). The
    number means "n× base" *invariantly across brands* — the white-label-honest
    encoding the KB calls for. NB ships a legacy t-shirt ramp (`4xs…3xl`), which
    the KB explicitly warns against (t-shirt breaks past ~7 steps); we
    deliberately did **not** follow it. So SPACE validates against **Prism2**
    (16/16), the system whose taxonomy we adopted; radius — t-shirt in both
    systems — still validates against **NB** (5/5).
  - **Two bases, by design:** a 4px *fine grid* backs radius/borders; an 8px
    *space rhythm* backs spacing. Prism2 proves this split (fine 2/4/6 for
    corners, 8-step rhythm for layout).
  - **Density moved to the component tier.** A numbered scale is already
    near-primitive, so remapping `space.400` by density is murky. Instead the
    numbered scale is density-free, and `density` drives the **component `size`**
    layer: each t-shirt size (`xs…xl`) is a *contract* binding a control height
    **and** paired padding from the shared scales, so a `md` button/input/select
    agree. `compact` resolves `size.md` to smaller metrics while the *name*
    stays `md` (name-stable, value-shifts). This is Curtis's three tiers made
    literal: reference (numbered) → component (t-shirt) → (radius, bounded
    semantic).

---

## Open items / next steps (roughly prioritized)

Reordered per external review: prove breadth (a second brand through the full
stack) before pipeline plumbing — it tests the white-label thesis harder.

1. **Finish "beyond color": typography + motion.** Space, radius, and a first
   component-size layer are DONE (the dimension axis above). Still to do: the
   modular type scale / weight ladder / fluid triplets from `typography`, and the
   motion duration/easing ramp from `motionPersonality`. Typography is the bigger
   lever (the font-swap white-label claim) and the larger remaining gap.
   Component sizing is a prototype — the height/padding *values* are sensible
   defaults, not yet validated against a real component set; revisit when the
   component layer is real.
2. **Prove downstream consumption.** Feed `out/*.tokens.json` through Style
   Dictionary and/or the Figma MCP — confirm a real tool ingests it and the four
   modes map to Figma variable modes. Turns "generation" into "pipeline".
3. **Round-trip the raw-figma format.** Emit the second parallel format
   (`raw-figma/`) the repo keeps, preserving `variableId` linkage (root `CLAUDE.md`).
4. **Figma binding constraints.** Verify variable/mode constraints via the Figma
   MCP (still outstanding from the architecture review).
5. **Tune status-hue defaults against a reference set** (Tailwind/Radix/Material/
   USWDS + NB's measured green/amber). Current canonical hues (success 145,
   warning 75, danger 27) are plausible but not evidence-derived; functionally
   safe (placed by luminance) but worth grounding. Overrides already wired via
   `BrandInput.status` / schema `statusColors`.

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
