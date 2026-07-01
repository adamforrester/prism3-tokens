# 00 — Progress & Status Log

> A living record of where Prism3 is, what was decided and why, and what comes
> next — so the work survives context loss and a fresh agent (or human) can pick
> it up without re-deriving anything. Update this when state or direction
> changes. Most recent entry first.

---

## Current status (2026-07-01)

**Every token category NB and Prism2 ship is now generated** — colour, dimension,
typography, motion, shadow/elevation, layout, and (opt-in) gradients — proven
against a real brand and proven white-label. From a ~7-input schema the engine generates gamut-aware
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
| Cross-mode contrast contracts | **248/248** | **248/248** |
| **Dimension axis, exact** (Prism2 space + NB radius) | **23/23** | n/a |
| DTCG semantic aliases resolve (color + dim + size + type + layout + gradient) | **627/627** | **628/628** |
| Engine unit tests (colour math + extreme brands + typography + fluid + shadow + layout + gradient + surface-model + harshness + typography-weights/links invariants) | **172/172** | (same engine) |
| Color primitives / dim grid emitted | 122 / 37 | 162 / 36 |
| Brand palettes / action source | red / **action = brand** (red) | primary+accent+… / **action = accent ≠ brand** |
| Form factor | comfortable / radius 1 (sharp) | compact / radius 2 (soft) |
| Emit profile | `nbds.*` / rgb | `prism.*` / hex |

Work now ships as **one PR per feature branch off `main`** (confirmed workflow).
All work through 2026-07-01 is merged to `main`.

**Structural work since the token layer completed (2026-07-01):**
- **Portable pure core.** The theming brain (`theme.ts` + `color`/`ramp`/`scale`/
  `modes`) is now Node-free — the only filesystem coupling (the NB fixture) moved
  to an I/O shell, `nb-fixture.ts`. Precondition for running the engine inside a
  Figma plugin sandbox, an MCP server, or a CLI. See `07-e2e-journey.md` §3.
- **Colour two-tier naming + mode-flattening.** Primitives `color.*` → **`palette.*`**;
  the semantic role layer `semantic.*` → **`color.*`** (the word "semantic" no
  longer appears in any path). Each role is now **one mode-agnostic token**: light
  canonical in `$value`, dark/hc modes as overrides in `$extensions.prism3.modes`
  (same shape as `shadow`; maps 1:1 to a Figma colour variable with modes). Locked
  convention in `06` §7b.
- **Space fidelity fix.** Restored Prism2's `space.150` (12px) and `space.250`
  (20px) — the engine had silently dropped them; dimension axis 21/21 → **23/23**.
- **E2E journey mapped** (`07-e2e-journey.md`): the designer↔developer↔agent
  pipeline, the portable-core architecture, `design.md` authoring brief, and the
  component-library layer (components-as-data + Code Connect) as layers 2–3 of the
  practice's four-layer AI stack.

---

## What exists

```
Prism3/
├── docs/
│   ├── 00-progress.md              ← this file (status + decisions + next steps)
│   ├── 01-token-architecture.md    ← the architecture spec / Theme Schema contract
│   ├── 02-nb-regression-pass.md    ← the NB regression: method + measured results
│   ├── 03-open-questions.md         ← semantic-layer decision backlog (elevation, scrim/opacity, disabled, white/black)
│   ├── 04-theming-playground.md     ← direction note: live theming dashboard / preview surface (web + Figma)
│   ├── 05-token-coverage-roadmap.md ← build backlog: remaining token categories (type, motion, shadow, layout, …)
│   ├── 06-surface-and-content-color-model.md ← the surface/content colour model + §7b as-built naming (palette/color) & mode encoding
│   └── 07-e2e-journey.md            ← the designer↔developer↔agent pipeline; portable-core architecture; design.md; component layer (layers 2–3 of the AI stack)
├── schema/
│   ├── theme-schema.json           ← the white-label BrandInput contract (JSON Schema; validated on every emit)
│   ├── theme-schema.example.json   ← a worked BrandInput (aurora) that conforms to the contract
│   └── nb-measured.json            ← NB regression measurement fixture (reverse-engineered anchors; a DIFFERENT shape, consumed only by nbTheme)
└── engine/                         ← dependency-free TypeScript prototype
    ├── color.ts                    ← sRGB↔OKLCH, CIELAB, CIEDE2000, WCAG contrast, gamut-aware max chroma
    ├── ramp.ts                     ← color ramp generation: exact anchor, 20 steps, chroma arc, 5 bands, contrast-role placement
    ├── scale.ts                    ← dimension axis: 4px grid + numbered space scale (8px rhythm) + radius + component sizes
    ├── theme.ts                    ← Theme builder: nbTheme() (measured) + brandTheme() (white-label: open brandColors[], action role decoupled from brand, status synthesis + danger carve + form factor)
    ├── modes.ts                    ← light/dark/hc-light/hc-dark, roles resolved by contrast target, brand-agnostic
    ├── nb-fixture.ts               ← I/O shell: reads the NB fixture off disk + defers to the pure core (keeps theme.ts Node-free / portable)
    ├── nb-regression.ts            ← diffs generated vs real NB, checks contracts → nb-regression-report.md
    ├── emit-dtcg.ts                ← emits out/<id>.tokens.json per theme (NB + aurora) + modes-report.md, validates aliases, mode contracts & BrandInput schema conformance
    ├── test.ts                     ← unit tests: colour-math invariants + 5 extreme-brand contracts + typography/shadow/layout/gradient/surface-model + harshness + typography invariants (172 checks)
    ├── ai-metadata.ts              ← generates the AI-readable metadata sidecar (meaning/when/avoid/paired_with/contrast_with/mode_overrides) for the semantic layer
    ├── README.md                   ← how the engine works / how to run
    ├── nb-regression-report.md     ← generated (committed for review)
    ├── modes-report.md             ← generated, covers both themes (committed for review)
    ├── out/{nb,aurora}.tokens.json ← generated DTCG output per theme (committed for review)
    └── out/{nb,aurora}.ai.json     ← generated AI-readable metadata sidecar per theme (the agent surface)
```

### How to run

```bash
# Node ≥ 20. No npm install — color math is self-contained.
npx tsx Prism3/engine/nb-regression.ts   # regression vs real NB
npx tsx Prism3/engine/emit-dtcg.ts       # emit DTCG + modes, validate (+ schema conformance)
npx tsx Prism3/engine/test.ts            # unit tests: colour math + extreme-brand contracts
```

---

## Decisions log (why things are the way they are)

- **Portable pure core, not a plugin/CLI (2026-07-01).** The engine is a
  dependency-free *library* wrapped by thin adapters (Figma plugin / CLI / MCP /
  API), not a single app. Kept the core I/O-free so it can run in a Figma sandbox;
  the NB fixture read lives in `nb-fixture.ts`. Same brain everywhere → the plugin
  inherits every engine option, and no forced LLM (knob-turning, a `design.md`
  file, or an agent all feed the same core). Rationale in `07-e2e-journey.md` §3–4.
- **Colour: `palette` primitives + `color` roles, mode as a value (2026-07-01).**
  "semantic" is a tier concept, not a name segment — it left the paths. The tier
  designers use got the intuitive `color.*`; the reference tier got `palette.*`
  (ref-vs-sys split). Mode is no longer nested in the name: one token per role,
  light canonical in `$value`, other modes in `$extensions.prism3.modes` (matches
  `shadow`; maps 1:1 to a Figma colour variable with modes). Rejected mode-in-name
  because it breaks "same name, different value per mode" and fights the Figma
  round-trip. Full note: `06` §7b.
- **Space scale reproduces Prism2 in full (2026-07-01).** An audit for a requested
  12px spacer found `SPACE_KEYS` had silently dropped Prism2's `150` (12px) and
  `250` (20px). Restored both — the "reproduces Prism2's full space scale" claim is
  now true, not aspirational (dimension axis 21/21 → 23/23).
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
- **Surface & content colour model (2026-06-29 — SUPERSEDES the property-led
  vocabulary entry below).** A UI-designer review of the generated style guide
  reworked the semantic layer (full spec: `01` §4.1 As-built + `06-surface-and-
  content-color-model.md`). `background` = the thin page **canvas** (`primary/
  secondary/tertiary` **tonal in both modes** — light is no longer all-white +
  an `inverse.*` ladder); `foreground` = the **surfaces/fills** on it (Prism2's
  `surface`, renamed: tonal ladder + `inverse.*` + bold semantic + `-subtle`
  tints + stateful `danger`); `text`/`icon` = **ink**; `action.*` = the
  interactive fill (now **top-level**); `border` = `primary/secondary/inverse/
  {semantic}/focus`. Dropped the `elevation.*` colour group (elevation = a
  foreground tier + a shadow), `background.subtle`/`sunken`/`quaternary`. Renamed
  `on-emphasis→on-inverse`, `interactive→action`. Fixed the incoherent
  `foreground.primary=950`/`secondary=200` (now a real tonal ladder; the dark
  fill is `foreground.inverse.primary`). HC carries elevation by **border**.
- **Semantic vocabulary: PROPERTY-LED — `background` / `foreground`(fill) /
  `text` / `icon` / `border`, with per-property interactive states.** *(Historical
  — superseded by the surface & content model entry above.)* Decided
  against a nine-system field survey (M3, Carbon, Atlassian, Fluent, Polaris,
  Primer, Spectrum, Radix, Tailwind/shadcn) cross-referenced with the practice KB,
  and aligned to New Balance's actual taxonomy. Top level is the *property* you're
  colouring; `foreground` is the element **FILL** (NB's meaning — not text).
  Interactivity is a per-property `interactive` variant carrying STATES (the
  applicable subset of default/hover/pressed/focused/visited/selected/disabled),
  not a parallel duplicated tree. `background.*` = inert container surfaces (+
  semantic tints); `foreground.*` = fills (neutral tiers + semantic + `interactive`
  + stateful `danger`); `text.*` = text (tiers + semantic + `on-*` pairs + `link`
  via `interactive`); `icon.*` = a full peer group that for now MIRRORS `text`
  (a future toggle relaxes icons to the 3:1 non-text floor so they diverge — see
  03-open-questions); `border.*` = neutral + semantic validation + `interactive`
  (focus ring = `.focused`). `info` palette newly synthesised. ~96 semantic roles
  × 4 modes. Field evidence: property-led is the field *majority* (Atlassian,
  Polaris, Primer, Carbon, NB all split text/bg/border/icon as peers); `on-*`
  pairing universal. *Rationale:* user decision after research — match NB's real
  structure (foreground=fill; text/icon/border as peers) rather than the
  role-led/content-grab-bag shape an earlier pass shipped. Semantic intents are
  static except `danger` (destructive fills carry states); inverse is modest
  (one `inverse` per property, leaning on per-mode resolution). Text on a vivid
  fill targets AA (gamut-bounded — 7:1 unreachable on a saturated mid), everything
  else escalates in HC.
- **Surface ladder + scrim/opacity primitives (backlog Items 1/2/4).** Decided
  against a 10-system field survey + KB §4. Elevation tiers renamed to an ordinal,
  use-case-neutral ladder `background.{primary,secondary,tertiary,quaternary}`
  (page→floating), plus `subtle`/`sunken`/`inverse` + semantic tints. The
  `overlay` tier name is GONE (it's overloaded across the field — floating surface
  vs scrim); component→tier mapping is documentation, not baked into the name.
  Light tiers converge in colour (elevation = shadow, a deferred effects axis);
  dark tiers step lighter (M3 lift). New primitives: an `opacity.*` scale and
  `black-alpha`/`white-alpha` ramps (composite over any surface — Radix/Fluent),
  and a `scrim.default` semantic token (alpha-based, heavier in dark per
  Spectrum/Fluent/Radix). White/black policy: pure primitives kept, surfaces route
  through the tinted neutral; a white page converges (shadow-carried), a tinted
  page (aurora `neutral.50`) lets cards step to white. *Rationale:* user decision
  after research — numbered ladder honours prior practice + the field's
  use-case-neutral camp; shadows deferred to an effects pass (KB lift pattern).
- **Motion axis — generated from a `tempo` personality lever (backlog roadmap §motion).**
  Decided against a 7-system survey + KB `18-motion-foundations`. The motion analog
  of the density/radius levers: `motionPersonality.tempo` (snappy/standard/relaxed)
  scales a non-linear duration ramp; easing roles (`standard`/`enter`=decelerate/
  `exit`=accelerate/`emphasized` + a `calm` accessibility curve) ship field-verified
  beziers (Carbon/M3); springs (`snappy`/`gentle`/`bouncy`) carry M3 spatial params
  by perceptual outcome; **composite `transition.*` tokens** bundle duration+easing
  (Atlassian model — the AI-trustworthy layer); reduce-motion is a **derived**
  output (Apple "substitute, don't delete": informational preserved/floored,
  vestibular → 0), not a hand list. Where we beat NB's fixed ramp: the personality
  lever, composites, the `calm` a11y curve, and derived reduce-motion. Aurora demos
  `snappy` (ramp compresses 50/100/200… → 40/80/160…). Motion is mode-invariant
  (sibling of the dimension axis), not per-mode colour.
- **AI-readable metadata sidecar — `out/<id>.ai.json` (prototype).** Per KB
  `31-color-systems §9` + `00-principles` ("descriptions = highest-ROI; avoid_when
  > when_to_use"): a generated agent surface for the semantic layer, peer to the
  DTCG `tokens.json`. Each of the 89 semantic roles gets `$description`, `meaning`,
  `when_to_use`, `avoid_when`, `paired_with`, `contrast_with`, and `mode_overrides`
  — all **generated** (prose from a deterministic role→intent model; the relational
  fields reshaped from data the engine already computes: the on-* pairings, the
  floor contract `against`/`min`/`ratio`, and the per-mode resolution). The point:
  *contract-true* metadata that regenerates every build, vs the field's hand-authored
  metadata that rots. `tokens.json` stays DTCG-pure (no non-standard sibling keys);
  the sidecar is the natural input for the planned MCP server + theming playground.
  `avoid_when` correctly redirects (e.g. `foreground.interactive` → "use
  foreground.danger for destructive"). Also fixed a `$description` redundancy bug
  ("…band — Mid-Tone"). `$description` ("what it is") and `meaning` ("what it
  signifies / is for") are distinct — e.g. `text.danger` → "Destructive / error
  text." vs "Destructive / error signalling." A refinement pass made state variants
  informative ("…on pointer hover") and differentiated the neutral-fill tiers.
  **Primitive tier added** (planned-for, not assumed away): every primitive
  (colour ramps, white/black, alpha, opacity, dimension grid, motion) gets a
  simplified set — `$description`, `meaning`, colour-scale **`intent`** (the
  Univers/NB contrast-role of each ramp step, from its band — e.g. 500 = "the
  dual-side AA pivot", anchor steps flagged), `tier`, `consume` (private vs
  consumable per family), and **`aliased_by`**, the reverse index of *which tokens
  resolve to it*. `aliased_by` makes the sidecar a bidirectional graph for impact
  analysis across all families (e.g. `dimension.8` ← `radius.md` + `space.100`;
  `color.accent.600` ← the interactive/link roles) — and it **cannot drift**: it's
  recomputed from the token tree on every build (authoritative at build time, never
  hand-maintained), and re-aliasing in this engine is a recompute, not a manual
  edit. Sidecar now `{ semantic, primitives }` (~89 + ~194–233 entries/brand).
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
  auto-moves to `neutral.100`, and `foreground.interactive.default` resolves to `accent.600`
  (4.95:1 on the tinted page) — two steps off the naive white-only pick.
  *Rationale:* user direction — "we may need to allow a user to confirm the
  primary surface colour that's not white, and that would change the floor."
- **Disabled is a selectable strategy; default is contrast-preserving.** A
  `disabledStrategy` input chooses `accessible` (default — disabled text/icon/
  border clears `disabledMin`, default **3:1**, on the floor; escalates to 4.5:1
  in HC) or `conventional` (intentionally sub-AA, leaning on the WCAG 1.4.3/1.4.11
  inactive-component exemption). `disabledMin` is tunable per engagement. Disabled
  *fills* stay a muted neutral (non-text, uncontracted) under both. Decided
  against a 12-system field survey: **0/12 meet 4.5:1 on disabled text**, only
  Primer (~3.45) / USWDS / Tailwind-opacity-50 (~3.5) clear ~3:1, and **none ship
  a selectable accessible-vs-conventional toggle** — so this is a genuine
  differentiator and matches the usability literature (NN/g, Adam Silver, Adrian
  Roselli, GOV.UK: *exempt ≠ unreadable*). Mechanism is flat resolved values, not
  opacity — opacity can't guarantee a floor (it stacks and is non-deterministic
  over colored fills) and would break the engine's computed-contract model.
  Reconciles the KB (`31-color-systems §3`), which already prescribed shipping
  both `inactive` (preserved) and `disabled` (exempt) and defaulting to the
  former — the engine just hadn't implemented it. *Rationale:* user decision after
  research — "an option where disabled just barely meets contrast minimums," as a
  user selection.
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
  violet hero brand whose `foreground.interactive.default` resolves to a separate azure
  `accent.500`, while NB keeps `action = brand` (red) by design. *Rationale:*
  user direction — "action is not always the primary brand colour; needs
  flexibility built in, and the system should confirm which colour drives
  actions."
- **Two emit profiles, one engine.** `nbds.*`/rgb for the NB regression
  (byte-comparable to real NB) and `prism.*`/hex for product output
  (DTCG-aligned, Style-Dictionary-ingestible). Resolves the namespace + value-format
  review notes without losing NB comparability.
- **NB's per-step hue kinks are NOT reproduced, by design.** Per-step hue drift
  would be a brand input the schema deliberately resists ("resist the seventh").
  The `amber.600`/`red.300` outliers characterise NB's hand-authoring; they are
  not an engine gap (review finding — reframed from an earlier "opt-in feature").
- **Dimension axis mirrors the color architecture: primitives + semantic
  aliases.** A primitive `dimension` grid (4px: 0,1,2,4,6,8,…,128) with `space`,
  `radius`, and component `size` tokens aliasing into it — the same shape as
  color ramps + semantic roles. Reproduces our chosen targets **exactly** (23/23)
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

**The token layer is complete; the next phase is the E2E pipeline (`07-e2e-journey.md`).**
The goal is a designer↔developer↔agent workflow ending in production-ready UI —
i.e. completing layers 2–4 of the practice's four-layer AI stack (the engine is
layer 1). Agreed build sequence (owner confirmed "safest path to a working plugin"):

- **A. `design.md` + CLI adapter (next).** A brand brief (`design.md` frontmatter →
  `BrandInput`, prose for agent latitude) compiled by the CLI over the pure core.
  Proves the core-as-a-library and the authoring on-ramp in the easy Node
  environment before the Figma sandbox. No LLM required to use it; agent-draftable.
  **Locked (2026-07-01):** YAML frontmatter + a hand-rolled minimal parser (~30
  lines, dependency-free) validated against `theme-schema.json`. Build shape:
  `engine/design-md.ts` (parser) + `engine/cli.ts` (entry point reusing the
  existing emit) + `examples/aurora.design.md` (reproduces the current aurora
  `BrandInput` → diff against `out/aurora.tokens.json` as the byte-exact
  **faithfulness** test) **plus a second, net-new brand** authored through the CLI
  (e.g. "Harbor" — teal, `action = primary`, warm off-white surface, gradients off,
  comfortable/sharp) as the **coverage** test: no golden file, so it's validated
  behaviourally (runs, schema-conforms, all aliases resolve, 248/248 contrasts hold).
  The two exercise complementary corners of the input space. Full spec + lever table
  in `07-e2e-journey.md` §6.
- **B. Figma plugin.** Fold the pure core in as the Figma *materialization adapter*
  (one brain, two targets — `07` §5). The plugin becomes a consumer of engine
  output, resolving today's pain points (missing options, namespace lock, font-weight
  mapping). The colour output is already shaped like Figma's variable-with-modes, so
  this is a direct mapping. NB: Figma component work does **not** depend on the plugin.
- **C. MCP adapter** over the core — "an agent themes Prism3" as a callable surface
  (the KB's MCP-first payoff).
- **D. (later) Component library** — components-as-data → Web Components + React +
  Storybook + `.ai.json` + Figma Code Connect (layers 2–3). In scope eventually;
  mapped now so upstream choices don't foreclose it. Heavy per-component research
  already in the KB (UIC series).

Parked, owner-flagged: **light-grey surface value tuning** — done visually once real
UI layouts exist, not against swatches.

Older backlog (still valid, lower priority than the pipeline above):

1. **"Beyond color" is COMPLETE — see `05-token-coverage-roadmap.md`.** Every token
   category NB + Prism2 ship is now generated: colour + the dimension axis
   (grid/space/radius/sizes), **typography** (the headline font-swap lever +
   composites + fluid), **shadow/elevation** (mode-aware), **motion**
   (`motionPersonality` lever), **layout/breakpoints**, the quick wins
   (**border-width**, **focus** ring dims, **icon 3:1 toggle**), and (opt-in)
   **gradients** (DTCG composite, ramp-aliased stops, OKLCH + sRGB pre-sample,
   Figma Paint Style, worst-case-stop contrast). What's left is plumbing, not new
   categories. Component sizing is still a prototype — values are sensible
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
6. **Semantic-layer decision backlog (`03-open-questions.md`).** Items 1–4
   RESOLVED and shipped — elevation/surface naming (ordinal ladder, `overlay`
   dropped), scrim + opacity/alpha primitives, disabled strategy (accessible
   default, 3:1 floor), white/black policy. Remaining: **Item 5** (icon 3:1
   toggle — parked by decision; icons currently mirror text, one-line floor swap
   when wanted). Next non-backlog frontiers: shadows/effects axis (deferred from
   Item 1), typography + motion (item 1 above), downstream consumption (item 2).
7. **Theming playground / dashboard (`04-theming-playground.md`).** Direction
   note only — a live theming dashboard that reskins real components + composed
   pages as tokens change (web app lead; Figma plugin as a second surface). The
   interactive successor to `visualize.ts`; differentiator is a live
   contrast-contract overlay. Not slated for build; documented for direction.
8. **Figma round-trip (code → Figma) (`05-token-coverage-roadmap.md` →
   *Cross-cutting*).** Analysis recorded, build deferred. Figma variables are
   only `COLOR`/`FLOAT`/`STRING` + scopes — no composite type — so typography
   exports as atoms (→ a Text Style binds them) and shadow/transition have **no**
   variable representation (Effect Style / code-only). Pipeline clarified: raw
   Figma → **Adam's custom plugin** → SD-ready DTCG (SD has *not* run on the
   example packages yet). Backlog: a three-tier disposition contract
   (`variable`/`style-part`/`code-only` + scope) as the cheap now-step, then an
   `emit-figma.ts` writer + style manifest + companion plugin. Open decision —
   update an existing template (preserve `VariableID`s) vs build from scratch —
   tracked as `03-open-questions` Item 9. KB POV write-up also backlogged.
   **Verified research** now lives in the knowledge-base repo, run
   `_research/_inbound/2026-06-28-figma-variables-styles-roundtrip` (four
   primary-source agents): the variable type ceiling + 8-field typography binding
   surface, **lineHeight/letterSpacing bind as px only** (unitless `1.5` → 1.5px),
   **text-decoration/case unbindable** (links = separate Text Styles), shadow
   *numerics* bind, Figma Motion (Config 2026) adds timing/easing variables, REST
   Variables API is **Enterprise-only** (styles can only be created via the Plugin
   API). **Materialization decision (locked for the typography build):** canonical
   value in `$value`; a machine-readable directive in `$extensions.prism3.figma`
   for the exporter (e.g. lineHeight `px-from-ratio`); intent *echoed* into
   `.ai.json` as derived narrative — the exporter reads `$extensions` data, never
   the prose sidecar. Generalises to letter-spacing, fluid sizes, etc.
   (`05-token-coverage-roadmap` → Typography + *Cross-cutting: Figma round-trip*).

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
