# 03 — Open Questions & Decision Backlog

> A running backlog of semantic-layer decisions that aren't settled yet. Each
> item carries the field evidence (a nine-system survey: M3, Carbon, Atlassian,
> Fluent, Polaris, Primer, Spectrum, Radix, Tailwind/shadcn), the current Prism3
> state, the options, and a recommendation to react to. These are *to discuss* —
> nothing here is implemented until it graduates to a decision in `00-progress`.

---

## Audit findings (2026-06-27)

A consistency/accuracy/quality pass over everything built so far. **Fixed in
place:** a stale contract count in the README (248→268), and `focus.ring.style`
emitting a non-standard `$type:"string"` → now DTCG `strokeStyle` (Style-Dictionary
-supported, confirmed via the Style Dictionary docs). **Strong:** cross-mode role
parity 89/89 in both brands, 0 contract failures, *identical* top-level groups and
semantic role sets across NB and aurora (a real white-label signal), no stubs/TODOs,
clean renames, regression stable (ΔE00 1.95, 11/11, 23/23) across all the churn.
Three findings left to decide:

### Item 6 — Schema ↔ BrandInput drift  ·  **RESOLVED (2026-06-27)**

> **Resolved:** `theme-schema.json` rewritten to faithfully describe the actual
> `BrandInput` (the documented "brand input contract" is now true); the NB
> measurement fixture renamed `theme-schema.example.json` → `nb-measured.json`
> (it's a different shape, consumed only by `nbTheme`); a new
> `theme-schema.example.json` is a worked BrandInput (aurora). A dependency-free
> conformance validator now runs on every emit — both the aurora input and the
> example file are validated against the contract, so the schema and the input
> type can't silently drift again (verified: the validator catches unknown
> properties, missing required fields, and bad enums). Original finding below.

`theme-schema.json` (labelled "brand input contract" in `00-progress`) and the
engine's actual `BrandInput` type have diverged. The schema uses `primaryColor` /
`neutralHue` / `statusColors` / `brand` / `accentColor` / `secondaryColor` /
`displayP3` / `typography`; `BrandInput` uses `primary` / `neutral` / `status` /
open `brandColors[]` / `actionPalette` / `surfaces` / `baseUnit…`. Only the newest
fields (`disabledStrategy`, `disabledMin`, `iconContrast`, `motionPersonality`) and
`density` are shared by name. The schema is in fact only consumed for NB's
*measured anchors* (`loadSpecs`); the white-label path (aurora) is hand-authored as
`BrandInput` and never validated against the schema. So the documented contract and
the real contract are two different shapes. **Why it matters:** the engine's whole
thesis is "a brand is a small input set" — that set needs ONE canonical definition.
**Options:** (a) regenerate the schema from `BrandInput` so it's the faithful
contract + validate the white-label path against it; (b) keep them as two named
artifacts (NB-measurement vs engine API) with an explicit mapping + corrected doc
labels. Lean: (a).

### Item 7 — `spring` is a non-standard DTCG type  ·  **RESOLVED (2026-06-27)**

> **Resolved (kept `spring`, corrected the claim):** we did NOT remove it —
> springs are the KB-endorsed default for interactive motion, and Style Dictionary
> *ingests* unknown types without error (they pass through; only a custom transform
> to render is needed, which is unavoidable for spring physics anyway). Fix: the
> "DTCG-standard" header is now "DTCG-aligned, Style-Dictionary-ingestible," each
> `spring` token is explicitly flagged (`$extensions.prism3.customType`) with a
> note that DTCG has no spring type yet, and the emit header states `spring` is the
> one intentional custom type. *(Alternative not taken — re-typing springs to an
> overshoot `cubicBezier` with params in `$extensions` for 100% standard types +
> out-of-box SD rendering — remains available if zero-custom-types is ever required;
> rejected for now as a lossy approximation of a distinct concept.)* Original below.

The motion axis emits 3 `spring` tokens with `$type:"spring"`, which is *not* in
the DTCG spec or Style Dictionary's type map (verified). SD won't error (unknown
types pass through untransformed), but the aurora emit header still claims
*"DTCG-standard, Style-Dictionary-safe."* **Options:** (a) keep `spring` as a
documented custom extension and soften the header to "DTCG-aligned (one custom
type: `spring` — springs have no DTCG type yet)"; (b) drop the spring `$value` to a
`cubicBezier` approximation, keep params in `$extensions`. Lean: (a) — springs are
the right cross-platform contract (KB `18-motion-foundations`); just be honest.

### Item 8 — No unit tests / single white-label fixture  ·  **RESOLVED (2026-06-27)**

> **Resolved:** added `engine/test.ts` (dependency-free, run via tsx) — 65 checks
> covering the previously-untested `color.ts` math (OKLCH↔sRGB round-trips, hex,
> WCAG contrast incl. white/black=21 + symmetry, relative luminance bounds,
> gamut-aware maxChroma boundary, ΔE2000 identity/symmetry, autoPlaceStep, and
> anchor preservation) PLUS **five extreme synthetic brands** run end-to-end
> (near-black primary, red primary w/ action decoupled to neutral, light
> high-chroma yellow, bare-minimum, and an all-levers brand). Every brand clears
> EVERY mode contract — real evidence the engine generalises beyond the two
> hand-checked brands. Wired into the run commands + headline (65/65). Original below.

Validation today is functional and strong (alias resolution, mode contracts, ΔE
regression, dimension exactness) but there are **no unit tests** for the colour
math in `color.ts` (OKLCH round-trips, contrast, gamut clamping) and only **one**
synthetic white-label brand (aurora). A near-black primary, an extreme-chroma
brand, or an action-palette = neutral could expose edge cases the two current
brands don't. **Recommend:** a minimal test file (colour round-trip + contract
invariants) + a second synthetic brand fixture as a smoke test.

### Minor (noted, not blocking)
- Light elevation tiers (`background.secondary/tertiary/quaternary`) converge to
  one value in light (shadow-carried) — honest + documented; gains distinction
  when the shadow axis lands. Keep.
- `icon.*` mirrors `text.*` when `iconContrast:"text"` (aliases to the same
  primitives) — intended peer namespace, low cost. Keep.
- Survey-size wording varies across docs ("nine-system" vs "7-system") — accurate
  per each survey but reads inconsistent; cosmetic.

---

## The one reframe that cuts across most of these

**Surface colour and elevation are two different axes, and the rigorous systems keep them as separate token families.** M3 explicitly decoupled tone-based surfaces from elevation (`surface-container-*` for fill, a separate `level0–5` for depth; the old "+1..+5 elevation overlay" was retired). Atlassian splits `elevation.surface.*` (fill) from `elevation.shadow.*` (depth) and tells you to pair them. Fluent ships `neutralBackground1–6` *and* a parallel `shadow2–64`. Carbon's layers carry no tonal overlay — shadow carries depth. Spectrum pairs surface aliases with a separate `drop-shadow-*` family.

So "elevation" is a **shadow** decision; "which fill" is a **surface ladder** decision. Our engine currently conflates them into one `background.*` group whose names (`raised`, `overlay`, `sunken`) smuggle a depth/use-case meaning into what is really just a fill ladder. Most of Item 1 falls out of separating them.

---

## Item 1 — Elevation / surface naming  ·  **RESOLVED (2026-06-25)**

> **Resolved (then SUPERSEDED — see `06-surface-and-content-color-model.md`):** the first cut shipped an ordinal `background.{primary,secondary,tertiary,quaternary}` ladder + `subtle`/`sunken`/`inverse` + tints with light tiers shadow-carried. A later UI-designer review reworked it: the surface ladder is split into **`background`** (thin page canvas) + **`foreground`** (the surfaces/fills on it, Prism2's `surface`), both **tonal in light and dark**; `quaternary`/`subtle`/`sunken` and the `elevation.*` colour group are dropped (elevation = a foreground tier + a shadow). This item is resolved by that rework.

**The question.** How do we name non-interactive container fills? Numbered depth (`primary/secondary/tertiary/quaternary`, the shape you've used before) vs semantic-role (`raised/overlay/sunken`) vs component-specific (`card`, `popover`)? How many tiers? And is `overlay` a surface at all?

**Field evidence — genuinely split, along a clean line:**
- **Numbered-by-depth:** Carbon (`background`, `layer-01/02/03`, `field-01/02/03`; you nest by incrementing the number), Fluent (`neutralBackground1–6`), Spectrum (`background-base` → `layer-1` → `layer-2` + an `elevated` role), Tailwind (50→950 lightness).
- **Semantic emphasis/role:** M3 (`surface-container-lowest/low/high/highest`, 5 tiers, named by *emphasis* not depth), Atlassian (`surface`/`raised`/`overlay`/`sunken`), Polaris (`bg-surface` + `-secondary`/`-tertiary`), Primer (`bgColor-default`/`muted`/`inset`).
- **Component-specific:** shadcn (`background`/`card`/`popover`/`sidebar`).

**"overlay" is overloaded — this directly confirms your worry.** It means opposite things across systems: Atlassian's `surface.overlay` is the *floating surface* (the dialog/menu fill), but Radix's `--color-overlay`, Fluent's `colorBackgroundOverlay`, and Spectrum's `overlay-color` are all the *scrim* (the dim layer behind the dialog). One word, two concepts — exactly the "pre-applied use case" trap. M3 sidesteps it by having no `overlay` surface token at all.

**Tier count.** 3–5 distinct fills is the norm: Carbon 3+base, Polaris 3, Atlassian 4, M3 5, Fluent 6. Your `primary/secondary/tertiary` (+ optional `quaternary`) sits comfortably inside that; past four, only Fluent/M3 go further and most engagements never use it.

**Current Prism3 state.** One `background.*` group: `default/raised/overlay/sunken/subtle/inverse` + semantic `*-subtle` tints. Conflates fill ladder with depth; `overlay` and `sunken` bake in use-cases; no separate shadow family exists.

**Recommendation.**
1. **Adopt a numbered/role-neutral fill ladder** — `background.default` (page) → `background.secondary` → `background.tertiary` (+ `quaternary` only if a brand needs it). This validates your prior instinct and dodges the `overlay` ambiguity entirely.
2. **Drop `raised`/`overlay`/`sunken` as surface tiers.** A dialog or menu is just the top of the ladder; the *lift* is a shadow, not a different fill name.
3. **Keep the orthogonal roles** that aren't depth: `background.inverse` and the `background.{brand,success,warning,danger,info}-subtle` role tints stay.
4. **Spin out elevation as its own concern** — a future `shadow.*` (or `elevation.*`) token family, paired with the ladder (Item linked to 2/3). Tracked here, not built yet.
5. *If* self-documenting component surfaces are wanted, add them as **aliases** that point at a ladder step (`surface.dialog → background.tertiary`), the M3/Atlassian move — names without new values.

---

## Item 2 — Scrim / backdrop + opacity primitives  ·  **RESOLVED (2026-06-25)**

> **Resolved (full scope):** added an `opacity.*` primitive scale, `black-alpha`/`white-alpha` ramps (composite over any surface), and a `scrim.default` semantic token (alpha-based, heavier in dark: 40% light / 60% dark, escalating in HC). Shipped.

**The question.** The dim layer behind modals/drawers is a distinct concept from the dialog surface (you flagged this correctly). How do we tokenise it, and does it need light/dark variants? And do we need an opacity/alpha primitive layer to express it (plus state layers, disabled)?

**Field evidence — scrim is universal, and it's black-alpha:**
- M3 `scrim` = `#000` @ **32%** (same both schemes — opacity multiplies the resolved colour).
- Carbon `$overlay` = black @ **60%**, uniform across themes.
- Spectrum splits it cleanly: `overlay-color` = black + `overlay-opacity` = **0.4 light / 0.6 dark**.
- Fluent `colorBackgroundOverlay` = **40% light / 50% dark**.
- Radix `--color-overlay` = `blackA6` light / `blackA8` dark (≈40% / 60%).
- Polaris `backdrop-bg` = black @ 71%; shadcn `bg-black/50`.
- Atlassian `color.blanket` (+ `.selected`, `.danger`) — a dedicated scrim *family*.

**Light vs dark: split, but the "differ" camp is principled.** M3/Carbon hold one value; Spectrum/Fluent/Radix dim *harder* in dark mode to keep separation over an already-dark UI. Worth honouring.

**Opacity primitives — also split:**
- **Alpha ramps as primitives:** Fluent (`blackAlpha`/`whiteAlpha`), Radix (`blackA`/`whiteA` *and* a per-colour alpha variant of every hue).
- **Opacity constants:** M3 (`state-layer` hover 0.08 / focus 0.12 / pressed 0.12 / dragged 0.16).
- **Alpha baked into tokens, no general ramp:** Carbon, Atlassian, Polaris.

**Radix's insight worth stealing:** alpha colours "appear visually the same over any background," so a single token composites correctly in light *and* dark. That's the elegant answer to "the same overlay reads differently per mode."

**Current Prism3 state.** No scrim token. No opacity/alpha primitives at all. This is a genuine gap — scrims, state layers, and (depending on Item 4) disabled all want alpha.

**Recommendation.**
1. **Introduce an opacity primitive scale** (e.g. `opacity.{5,10,20,40,60,80}`) as the base unit, feeding scrim/state/focus.
2. **Mint `black-alpha` + `white-alpha` ramps** (the Fluent/Radix move) — they solve scrims, shadows, and overlay tints that must sit over *any* surface, in one token per step.
3. **Add `scrim`** (not "overlay") = black-alpha at a chosen step, with **distinct light/dark values** (lean Spectrum's color+opacity split: cleaner to reason about than a baked rgba). Optionally `scrim.danger` later (Atlassian blanket).
4. State-layer opacities (hover/pressed/focus) likely belong here too — ties into the interactive states we already emit under `action.*`.

---

## Item 5 — Icon contrast floor (3:1 toggle)  ·  **OPEN (parked by decision)**

The property-led model ships `icon.*` as a full peer group, but for now icons
**mirror `text` values** (same 4.5:1 resolution) — a deliberate starting point.
Icons are *non-text* under WCAG (graphical objects, SC 1.4.11), so their floor is
**3:1**, not 4.5:1; relaxing icons to 3:1 would let them use lighter/more-saturated
steps than text and legitimately diverge. **Decision needed:** is the 3:1 floor a
global default, or a per-engagement/user-selected toggle (some brands prefer
icon=text for simplicity)? Until decided, `icon` = `text` byte-for-byte. Wiring is
a one-line floor swap in `modes.ts` (resolve `icon.*` against `nonTextMin` instead
of reusing the text picks).

---

## Item 9 — Code → Figma: update a template vs build from scratch  ·  **OPEN (later)**

When the engine eventually writes generated tokens back into Figma (the round-trip
build in `05-token-coverage-roadmap` → *Cross-cutting: Figma round-trip*), there are
two target modes, and they're not the same job:

- **Update an existing Figma template** — patch the variables/styles in a prepared file,
  **preserving and matching existing `VariableID`s** so aliases and component bindings
  survive. Lower disruption; needs a stable id-reconciliation strategy (our
  `$extensions.figma.variableId` linkage is the hook). The harder correctness problem.
- **Build from scratch** — create the collection/modes/variables (and styles) new each
  time. Simpler to generate, but throws away ids → breaks anything already bound in
  Figma, and re-importing becomes a replace, not a merge.

**Why it matters:** it changes the writer's contract (idempotent patch vs generate) and
whether we must round-trip ids at all. **Not deciding now** — flagged so the writer is
designed for the chosen mode rather than retrofitted. Lean (unverified): support
*update-in-place* as the primary path (it's what a living design system needs), with
from-scratch as the bootstrap case.

---

## Item 3 — Disabled colouring  ·  **RESOLVED (2026-06-24)**

> **Decision (implemented).** Disabled is a **selectable `disabledStrategy`**:
> `accessible` (default) clears `disabledMin` (default **3:1**, tunable; escalates
> to 4.5:1 in HC) on the floor for disabled text/icon/border — the KB's
> contrast-preserving `inactive`; `conventional` is the field-standard sub-AA
> exempt look. Single switch (no opacity axis — flat resolved values keep the
> floor guaranteed). Disabled *fills* stay a muted neutral (non-text). Backed by
> the 12-system survey below — **0/12 meet 4.5:1, none offer a toggle**, so this
> is a differentiator. There was no contradiction in the KB POV (it already
> prescribed both tokens, defaulting to preserved); the engine simply hadn't built
> it. The deeper KB stance — *prefer `aria-disabled` + a visible reason over a
> greyed control* — remains a component-layer concern, out of the engine's scope.
> *The field research below is retained as the evidence base.*

---

**The question.** How is disabled coloured — global opacity, dedicated tokens, or a contrast-preserved neutral? And what's our accessibility position?

**Field evidence — two camps:**
- **Opacity-based:** M3 (content `on-surface` @ **38%**, container @ **12%** — system-wide constants), Radix (component-level opacity).
- **Dedicated tokens:** Carbon (`text-disabled` etc. ≈ **25%** alpha baked into a named token), Fluent (solid greys — `colorNeutralForegroundDisabled` `#bdbdbd`), Atlassian (`color.text.disabled` = `#091E424F`, alpha-hex), Polaris (`*-disabled`, rgba 0.05 fills).
- The rigorous/enterprise systems lean **dedicated tokens**; M3 is the notable opacity holdout. Opacity-based compounds badly (disabled-on-disabled, fails over images) — the main reason the dedicated camp exists.
- **Accessibility:** all lean on WCAG 1.4.3 *exempting* disabled controls from contrast minima; none of the surveyed docs state it explicitly (verified absence, not oversight).

**Current Prism3 state.** Dedicated tokens per property — `text.disabled` / `icon.disabled` (low-contrast neutral, ~`neutral.300`, intentionally sub-AA), the `*.disabled` state on every interactive variant (`foreground.interactive.disabled`, `foreground.danger.disabled`, `border.interactive.disabled` → a neutral low fill). This matches the *majority* (dedicated) camp. **But** KB `28-web-accessibility-implementation §3` stakes out "the practice's harder line": disabled should be **contrast-preserved**. Those two positions can't both stand.

**Recommendation — resolve toward a documented floor (option c).** Keep dedicated tokens (correct, and field-aligned), but reconcile the contradiction by giving disabled an **explicit, documented contrast floor** (~2.5–3:1 perceptible) rather than either "exempt, anything goes" (M3's 38% can fall below that) or "full AA" (almost nobody does this, and it makes disabled indistinguishable from enabled). This honours the KB's spirit — don't make disabled *invisible* — while staying realistic and matching how the field actually ships. **Action:** pick the floor, then either soften KB §3's wording to match, or hold the stricter line and re-tune the engine. Needs your call.

---

## Item 4 — White / black token policy  ·  **RESOLVED (2026-06-25)**

> **Resolved:** pure `.white`/`.black` primitives kept; surfaces route through the tinted neutral ramp; a white page converges (shadow-carried elevation), a tinted page (aurora `neutral.50`) lets cards step to white. Pure white/black reserved for the page base, scrim/alpha ramps, and on-colour text. Shipped.

**The question.** Do we expose pure `white`/`black` to consumers, and where (if ever) should surfaces resolve to them vs the tinted neutral ramp ends?

**Field evidence:**
- **Exposure split:** Fluent and Carbon *do* ship raw `white`/`black` primitives; M3, Atlassian, Radix, Primer do *not* expose them as consumable roles (tinted neutral + `scrim`=`#000`).
- **Usage is near-universal, though:** dark bases are **tinted near-black, not pure** — Carbon `#161616`, Fluent dark base `#292929`, Spectrum dark `gray-25` `#111`, M3 tonal. Pure black dark surfaces cause eye strain and kill elevation legibility.
- **Pure-white cards on a tinted page is a blessed pattern:** Polaris page `bg` = `#f1f1f1` with `bg-surface` = `#fff`; Spectrum/Fluent/Carbon light *bases* are `#fff`. So white *is* used — for the base or top card, not for every tier.

**Current Prism3 state.** We ship both pure `.white`/`.black` *and* tinted ramp ends (`neutral.025` `#f7f7f7`, `neutral.950` `#0d0d0e`). Light `raised`/`overlay` resolve to pure `.white`; dark base is the tinted `neutral.950` (good). Aurora's config (page `neutral.050`, cards white) actually *is* the blessed Polaris pattern; NB's (white page + white cards) is the degenerate case where the tier collapses.

**Recommendation.**
1. **Keep exposing pure `.white`/`.black` as primitives** (Fluent/Carbon precedent) — they're needed for scrim, shadow, and on-colour text regardless.
2. **Policy: surfaces route through the neutral ramp by default.** Reserve pure white/black for: the page base *when a brand chooses a white page*, scrim/shadow (black), and on-colour text. **Never** pure black for dark surfaces (we already use tinted `neutral.950` — good).
3. **Reconsider `raised` = pure white when the page is also white** (the NB degenerate case): either step it to `neutral.025`, or accept that in a white-page system the lift is shadow-only (no colour change) — which loops back to Item 1's surface/elevation split.

---

## Suggested sequencing

1, 2, and 4 are entangled (the surface ladder, the scrim/alpha primitives that elevation needs, and the white/black policy all touch the same `background.*` rework) — worth deciding together. Item 3 (disabled) is independent and can be resolved on its own; it's the one with an active KB contradiction, so arguably first.
