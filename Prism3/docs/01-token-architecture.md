# Prism3 — Token Architecture

> **Status:** v0.1 draft for review · **Date:** 2026-06-19
> Prism3 is a white-label design system delivered as a **brand-generation engine**: a brand is a small, validated input set that the engine expands into a complete, contract-compliant token layer for design, code, docs, and AI agents. This document is the architecture spec. The companion contract lives in `../schema/theme-schema.json`.

---

## 0. What changed from Prism2 (and why)

Prism2 is a clean three-tier alias system, but it was built as a **starter kit** — one known brand, hand-authored ramps, brand identity (`nbds.pds.*`) baked into every token path, and theming done by repointing aliases by hand. Prism3 is a different shape: **one product, N unknown future brands**, where adding a brand should cost a fraction of the first and be performable by an agent or a non-expert from a short input.

The economic north star, stated plainly: **the tenth brand should cost ~10% of the first.** Everything below is in service of that.

Three structural moves carry over the best of what exists and discard the rest:

| Decision | Prism2 | New Balance | Prism3 |
|---|---|---|---|
| Primitive tier | implicit in `shared/` | **explicit `core-*`** ✓ | explicit `core.*` (adopt NB) |
| Brand identity in token path | `nbds.pds.*` baked in | `nbds.*` baked in | **brand removed**; stable `prism.*` product root kept |
| Color ramps | hand-picked | Univers L*-aligned, not tuned | **generated, OKLCH, contrast-anchored, ~20 steps, brand value pinned exactly, multi-anchor fit-or-split** |
| Brand as an axis | a mode | n/a (single brand) | **a collection / output package** |
| Focus / breakpoint / layout / reduced-motion | missing | **present** ✓ | present (adopt NB) |
| Typography composites | display/title/body/button/detail ✓ | viewport-split (desktop/mobile) ✓ | **both ideas merged** |
| AI metadata | none | none | **`.ai.json` generated per brand** |

### 0.1 Why this isn't just "what we already do" — the generic-primitive trap

The most reasonable objection from anyone who knows Prism2: *we already theme by adjusting primitives and pointing semantics at brand colours — how is this different?* It's the right question, because Prism2's semantics already alias two kinds of primitive at once:

- `{pds.color.brand.primary.650}` / `brand.secondary.650` — **generic role slots**, the instinct to make brand colour swappable without renaming.
- `{pds.color.strawberry.600}`, `{pds.color.blueberry.600}`, `{pds.color.pumpkin.600}` — **literal-named palettes**, used for status/accent and hard-wired to a hue.

The generic-slot instinct is correct, and it solved exactly one thing — the **rename**. But renaming was never the real cost, and the slot left two costs untouched:

1. **Values stay hand-authored.** `brand.primary.650` still has to be a specific hex that passes contrast against `neutral-cool.850/200` across light *and* dark *and* wireframe. The slot is generic; the value behind it is bespoke and tuned by hand per brand. The label moved; the labour didn't.
2. **There is no boundary.** Every value lives in one mutable `shared/primitives.json`. "Multi-brand" therefore means *overwriting* that file (only one brand live at a time) or *branching* it (brand-in-disguise). A generic **name** can't create a parallel axis — only a separate generated **artifact** can. This is precisely why the generic-slot approach "doesn't work great for multi-brand": names went generic, storage stayed singular and mutable.

So theming today is a **destructive edit to a shared file, spot-checked by eye.** The three-tier layering is sound; the economics and the safety are not.

Prism3 keeps the shape and changes exactly those two things:

- **Generation replaces hand-authoring.** A ~5-input schema → engine derives the OKLCH ramp, the semantic aliases, and the on-colours, and pins WCAG across the whole light/dark/HC/wireframe × comfortable/compact matrix (§5, §10). This is the *missing half* of the generic-slot idea: role slots only pay off when something fills them with correct, contrast-valid values per brand. Without a generator, slots merely relocate the tuning.
- **Brand becomes an artifact boundary.** Each brand is a separately generated package/library that coexists and versions independently (§3, §11). The swap is *loading a different artifact*, never mutating `shared/primitives.json`.

A consequence: the literal `strawberry/blueberry/pumpkin` status palettes stop being hard-wired hues — status *meaning* stays invariant while the colour is brand-derived or explicitly overridden (§5.2), instead of every brand inheriting fruit names.

**New Balance is the natural regression test.** NB already carries the `brand.primary` slots *and* the fruit palettes; re-generating NB from a schema and diffing against today's hand-authored values is the cleanest proof that the engine reproduces an existing brand before it invents new ones. A first pass — NB's tokens reverse-engineered into a schema, measured in OKLCH, with predicted diffs and acceptance criteria — is worked through in `02-nb-regression-pass.md`. Headline finding: NB's neutral is **cool (~243°)**, not warm, and its **brand hue equals its danger hue** (both red ~23°).

---

## 1. Principles (the laws Prism3 is built on)

These are non-negotiable. They come directly from the practice POV and they constrain every decision downstream.

1. **Brand is a collection axis, not a mode axis.** Theme (light/dark/HC) and density are modes; they *compose*. Brand axes *multiply*, so brand is expressed as a separate generated package/collection, never as another mode.
2. **Naming is intent-based, not brand-bound.** A token is `color.text.primary`, never `color.text.primary.acme`. The same component code resolves to the right brand's value because the brand layer is swapped, not because the name changed.
3. **Compute at authoring time, ship literals at runtime.** Ramps, modular scales, density math, OKLCH derivations are all build-time. The runtime artifact is a resolved literal. Agents reason over literals, never over expressions.
4. **Composites are an authoring convenience, not a runtime contract.** Typography, shadow, border, transition are authored as DTCG composites (source of truth) and **flattened to per-platform atomic outputs** at build.
5. **Every token carries `$description` + AI metadata.** The token tree is a queryable contract. A value without intent is something humans and agents must guess at.
6. **Ship a *complete* semantic tier.** Consumers reach for semantics, never primitives. A primitive reference in consumer code (`var(--blue-9)`) is a **lint error**. A growing component tier is an architectural failure signal, not a feature.
7. **Contrast is baked into the ramp, not computed at the consumer.** A ramp step is a *contrast role*, not a lightness coordinate. WCAG 2 is the CI floor; APCA is the quality warning.
8. **The behaviour layer is system-owned; only the visual layer is themeable.** Resellers/brands theme color, type, space, radius, motion, elevation. They never touch keyboard model, focus management, ARIA, state machines, RTL, or i18n.
9. **DTCG is an interchange format, not the architecture.** Modes, brand resolution, and math live in the layer above the spec (Style Dictionary + the engine), forward-compatible to the W3C Resolver module.

---

## 2. Tier model

Four conceptual layers. The first three are the classic taxonomy; composites sit across the semantic tier as authoring sugar.

```
core.*          PRIMITIVE   raw, generated, zero intent       (blue ramp step 9, dimension 16, font size step 4)
  ↓ alias
<category>.*    SEMANTIC    intent bound to a primitive        (color.text.primary, space.inline.md, radius.action)
  ↓ alias (only when divergence is real)
component.*     COMPONENT   one component, < ~10 total color   (component.button.primary.bg.hover)

typography.* / elevation.* / border.* / motion.*   COMPOSITE (multi-property, reference the above)
```

### 2.1 Core (primitive) tier — `core.*`

Generated, brand-specific in *value* but brand-agnostic in *structure*. Carries zero contextual meaning. This is the **only** tier where color space, gamut, ramp math, and modular scales live.

- `core.color.<hue>.<step>` — OKLCH-authored ramps; steps are **contrast roles** (see §5).
- `core.dimension.<step>` — unitless modular scale, the spine of space/radius/size.
- `core.font.family|size|weight|lineheight|tracking.<…>` — atomic type primitives.
- `core.duration.<step>` / `core.easing.<name>` — motion primitives.
- `core.breakpoint.<step>` — viewport anchors.

Primitives are **never published** to consumers and never referenced from component code.

### 2.2 Semantic tier — the public contract

Intent bound to primitives via aliasing. This is what components, docs, and agents reach for. Categories (§4). Mode/brand resolution happens *here*, at the alias, never at the consumer.

### 2.3 Component tier — minimal by design

Only where a component genuinely diverges from the semantic layer and no semantic exists. **Rule of three** governs promotion: used by 1 component → stays component-scoped; needed by 2+ → promote to semantic. Target: < 10 component-tier color tokens across the whole system. Growth here triggers a semantic-tier review.

---

## 3. Axes & composition (brand × theme × density × viewport)

Four orthogonal axes, each resolved at a different layer so cost stays **additive, not multiplicative**. Crucially, each axis is a **separate Figma collection** (one mode-dimension per collection — see §11), so a frame composes them independently.

| Axis | Values | Mechanism (code) | Mechanism (Figma) |
|---|---|---|---|
| **Brand** | acme, globex, … (open set) | generated output package | one generated **library per brand**, swapped |
| **Theme** | light, dark, high-contrast, wireframe | `data-theme` attribute | modes in the **colour/semantic** collection |
| **Density** | comfortable, compact | `data-density` attribute | modes in the **spacing/sizing** collection |
| **Viewport** | narrow ↔ wide (type endpoints) | `clamp()` (fluid) | modes in the **typography** collection |

The viewport axis exists because **Figma cannot render fluid type.** The same `{min, preferred, max}` source triplet (§4.2) feeds both: code gets a real `clamp()`; Figma gets the `min` and `max` *endpoints as discrete modes* designers swap on a frame. Code and Figma stay reconcilable because they share one source.

Runtime composition (code) is attribute switching on the root; the brand package is loaded as a unit:

```html
<html data-brand="acme" data-theme="dark" data-density="compact">
```

**Authoring model (Figma / source):**
- **Global Foundations** — one read-only collection of brand-*invariants*: the spacing scale *steps* (not values), timing functions, target-size floors, status-color *meaning*, the naming taxonomy itself. Brand teams cannot edit this.
- **Brand layer (per brand)** — generated. Holds the brand's `core.*` values + the semantic aliases derived from them. Theme and density live as modes *inside* this layer.
- **Components** — reference the generic semantic contract; the brand layer is swapped in at render.

**Runtime model:** the engine emits **resolved per-brand packages** (no cross-brand lookup at runtime). Theme and density remain as CSS-variable mode blocks toggled by attribute. One brand = one self-contained output; loading a second brand never disturbs the first.

---

## 4. Category architecture

Every category lists its **core** (primitive) shape and its **semantic** contract. Semantic names follow the grammar `<category>.<concept>.<variant>.<state>` (§6).

### 4.1 Color
- **Core:** `core.color.<hue>.<step>` — generated OKLCH ramps, ~20 steps each (§5.1). Hues: `brand` (primary) plus any number of additional brand scales from `brandColors[]` (each either a multi-anchor extension of an existing ramp or its own named scale — fit-or-split, §5.1a), optional `brand-secondary` / `accent`, `neutral` (from neutralHue), and the **system status hues** `success` / `warning` / `danger` / `info` (stable across brands). Steps are contrast roles, and every supplied brand value is pinned exactly (§5.1–5.2).
- **Semantic:** the role taxonomy, ported and tightened from Prism2:
  - `color.text.{primary,secondary,disabled,brand,on-{surface}}.{default,inverse}`
  - `color.surface.{base,raised,sunken,brand,inverse}` and `color.background.*`
  - `color.border.{default,subtle,strong,focus,brand}`
  - `color.icon.{primary,secondary,brand,disabled}`
  - `color.action.{primary,secondary,neutral,danger}.{rest,hover,active,disabled}` + `color.action.<x>.on` (foreground)
  - `color.feedback.{success,warning,danger,info}.{text,surface-bold,surface-subtle,border}`
  - `color.focus.ring`
  - `color.link.{rest,hover,active,visited}`
- **Key mechanism:** every "on-X" foreground is a **luminance-flip computed token** (§5.3) so `color.action.primary` and `color.action.primary.on` stay a compliant pair as the brand primitive swaps.

### 4.2 Typography
Merges Prism2's role/weight composites with NB's viewport handling. Three-tier (atomic + composite + component), per the typography POV.
- **Core (atomic):** `core.font.family.{display,text,mono}`, `core.font.size.<step>` (modular scale with a **display pivot** — separate ratio for text vs display), `core.font.weight.<named-instance>` (variable-font ladder frozen to names: `regular`=400, `medium`=500, `semibold`=600, `bold`=700), `core.font.lineheight.<step>` (unitless), `core.font.tracking.<step>` (em-relative).
- **Semantic (composite):** `typography.{display,heading,body,label,code}.{xs…xl}` — DTCG `typography` composites referencing atomics by family *role* (never literal family). 15–25 composites is the target volume.
- **Responsive:** fluid sizes encoded as a **`{min, preferred, max}` triplet** primitive; build emits `clamp()` for web (preferred **must** carry a `rem` term — WCAG 1.4.4) and a static fallback for native. The triplet's **`min`/`max` endpoints become the two Figma viewport modes** (`narrow`/`wide`) so designers can see and swap both ends of each style — Figma can't render the fluid middle. (Open: whether code also ships parallel `vw` *and* container `cqi` sets — see §12.)
- **Family-role indirection is the white-label lever:** a font swap is a single `core.font.family.*` change; no composite is rewritten.
- **Decouple DOM level from visual size:** composites are named `heading.lg`, never `h2`.

### 4.3 Space & size
- **Core:** `core.dimension.<step>` — unitless modular scale (NB's explicit dimension tier, generalized).
- **Semantic:** `space.{inline,stack,inset}.{xs…3xl}` aliasing dimension steps. **Density** parameterizes which dimension step each semantic step maps to (compact = one step tighter), generated and committed as literals — not a runtime expression.

### 4.4 Radius
- **Core:** `core.dimension.*` (shared spine).
- **Semantic:** `radius.{none,sm,md,lg,pill,full}` and role aliases `radius.{action,surface,control,input}`. **Brand radius** (the form-factor input) scales the whole set; a sharp brand collapses `sm/md/lg` toward 0, a soft brand expands them.

### 4.5 Border
- **Semantic composite:** `border.{default,subtle,strong,focus}` = `{ width, style, color }` referencing `core.dimension.*` + `color.border.*`. Flattened at build.

### 4.6 Elevation / shadow
- **Semantic composite:** `elevation.{0,1,2,3,4}` multi-layer shadows, with `default` and `inverse` (dark-surface) variants. Generated from a tier curve, not hand-placed. Figma sync via effect `styleId` (variables can't hold shadow objects).

### 4.7 Focus (adopt NB)
- `focus.ring.{width,offset,color,color-inverse}` — first-class, not an afterthought. Width/offset from `core.dimension.*`; color is the luminance-aware focus token.

### 4.8 Motion (adopt + extend NB)
- **Core:** `core.duration.<step>`, `core.easing.{standard,enter,exit,emphasized,linear}`.
- **Semantic:** `motion.duration.{instant,fast,normal,moderate,slow}` + **`*-reduced` variants** (non-vestibular halved; vestibular → 0ms). `motion.easing.*`. Optional brand **motion personality** as a 6th-input override.

### 4.9 Layout & breakpoint (adopt NB)
- **Core:** `core.breakpoint.<step>`.
- **Semantic:** `layout.container.{narrow,default,max}`, `layout.grid.{columns,gutter,margin}` per breakpoint, `layout.breakpoint.*`.

### 4.10 Utility
- `core.opacity.<step>`, `z-index.<role>` (`base,raised,overlay,modal,toast,tooltip`), `target-size.min` (a11y floor — an invariant, lives in Global Foundations).

---

## 5. The generation engine

The heart of Prism3. A brand input (§7) is expanded into the full `core.*` + semantic tree by standardized computation. No hand-authoring per brand.

### 5.1 Color authoring space
- **OKLCH is the authoring space.** HSL is not used for ramp generation (its lightness is a mechanical RGB midpoint, not perceptual).
- **Source-anchored, and the anchor is preserved *exactly*.** The brand color is a *fixed point*: it appears verbatim as a ramp step, never normalized to a generator's nearest lightness target. This is the explicit lesson from the Univers methodology — most palette tools emit an even ramp that *omits* the real brand value, forcing a manual re-insertion. Prism3 inverts that: the anchor defines its own step's lightness, and the rest of the ramp is generated *around* it. The brand color is always present, always correct, by construction.
- **~20 steps per ramp (the Univers step density).** The default ramp is the NB-style 20-step scale (`025, 050, 100, 150 … 950`) — enough shades to always have a usable tint/shade to hand without manual interpolation. This is an engine constant (not a per-brand input — it stays out of the schema to honor input minimalism), aligned to what NB already ships.
- **Per-hue chroma ceilings are mandatory** (e.g. yellow caps far lower than blue) so vivid hues don't clamp to mud. OKLCH is a space, not a gamut. Per-brand override via `chromaCeiling`.
- **Render targets:** author in OKLCH; emit sRGB (hex fallback) + optional Display-P3 for brand-critical surfaces. Declare a per-platform fidelity contract; **test converted native colors against the design source.** DTCG Color Module `colorSpace` carries this.

### 5.1a Multiple brand colors — fit or split
Brands rarely have exactly one brand color. A client may run **two brand blues** (e.g. a light and a dark), or several distinct hues. The engine intakes any number of brand colors (`primaryColor` + `brandColors[]`) and decides, per pair, whether they **share one ramp** or **spin into separate scales**:

- **Fit one ramp (multi-anchor):** colors of a **compatible hue** (ΔH within ~15–20°) that sit at **distinct lightness positions** become *multiple pinned anchors on a single ramp*. The ramp is generated to pass through **all** of them exactly (L/C/H interpolated between anchors, extrapolated beyond). Two brand blues at L≈70 and L≈40, both hue ≈250, are one `brand-blue` scale with two preserved anchors.
- **Split into separate scales:** colors that **diverge in hue**, or that **collide at the same lightness step** (can't both be pinned on a monotonic-L ramp), or whose chroma demands conflict, each get their **own named scale** (`brand-blue`, `brand-blue-2`). The user keeps both exact values; the engine just stops pretending they're one ramp.

The decision is automatic by default; `scale` on a brand color forces grouping or separation when the designer knows better. Either way, **every supplied brand value is preserved exactly** (per §5.1) — fit-or-split only changes *how many ramps* carry them, never the values.

### 5.2 Ramp = contrast roles
Steps are generated so that **each step is a guaranteed contrast role**, not an arbitrary lightness. Semantic tokens reference *role names* ("the step where Lc 60 on light is guaranteed"), so every brand aligns contrast at the same role even with different hues. This is what lets a brand swap without re-checking every pair by hand.

**Reconciling exact anchors with contrast roles:** the two are not in tension. The ~20 role-steps are generated, and the brand anchor(s) define the lightness of the step(s) they land on — the anchor's measured L *is* that step's target, and neighbors interpolate to keep the role guarantees intact across the rest of the ramp. NB demonstrates this already: `red.550` is simultaneously the exact NB Red **and** a functioning contrast-role step. Where an anchor falls between two role steps, the engine nudges that step's target L to the anchor (value exact, role preserved) rather than shifting the anchor.

### 5.3 Forced-foreground (`on-X`) luminance flip
Every `on-X` token is **computed to flip black/white (or near-) based on the swapped primitive's luminance.** This is the load-bearing multi-brand technique: `color.action.primary` and `color.action.primary.on` stay compliant as the underlying primitive changes. Adopt as default.

### 5.4 Status colors are infrastructure
`success/warning/danger/info` are **system-stable** across brands (perceptually consistent meaning). They are *optional* schema overrides, defaulted, never collapsed into the brand palette. When a brand's primary sits in red territory, the engine **carves a separate destructive red** distinct from the brand token. Same pattern for the "brand-against-its-own-system" trap: if the brand color can't pass contrast as the primary *action*, the engine carves a separate **system-interaction** token distinct from the **brand** token.

### 5.5 Appearance modes (light · dark · high-contrast · wireframe)
Standard appearance set, generated per brand, expressed as modes in the colour collection.
- **Light / dark:** semantic aliases re-point across the contrast-role steps (text↔surface invert); the contrast-role ramp makes this mechanical rather than hand-tuned.
- **High-contrast:** generated for free from the contrast engine — semantics snap to the highest-contrast role steps; validated against an elevated WCAG floor.
- **Wireframe:** generated by **desaturating** the brand + status hues toward the neutral ramp (chroma → ~0) and flattening elevation, for low-fidelity/blueprint work. It is a *generated* mode, not a hand-built one (unlike Prism2's wireframe).

### 5.6 Non-color generation
- **Spacing/size:** density step parameterizes the modular scale → resolved literals per density mode.
- **Radius:** brand radius scales the corner set.
- **Type:** family roles fill from the typeface stack; modular scale with display pivot; weight ladder frozen to named instances; fluid triplets emitted to `clamp()`/static.
- **Elevation/motion:** tier curves → resolved literals; reduced-motion variants generated.
- **Data-vis:** if requested, `color.viz.*` is an **isolated** OKLCH sequential/categorical ramp that **never aliases UI tokens.**

---

## 6. Naming taxonomy

The grammar, read as a compressed sentence. Every path carries the stable **`prism` product root** (shown below; omitted from examples elsewhere for brevity), and the tier is explicit in the path — `prism.core.*` for primitives, `prism.<category>.*` for semantics:

```
prism . <category> . <concept> . <variant> . <state>
prism . color      . action    . primary   . hover
prism . color      . text      . on-action . default
prism . space      . inline    . md
prism . typography . heading    . lg
prism . core       . color      . blue      . 500       ← primitive tier
```

Rules:
- **Keep the `prism` root prefix** (decided). It is a *product* prefix, not a brand — it disambiguates Prism tokens from host-app and third-party tokens in both the Figma Variables panel and in code, where similarly-named tokens otherwise collide. Brand is still never in the path; it is the library/package axis.
- **Intent only below the root.** No brand, no raw colour name, no DOM level in semantic paths.
- **Three vocabularies, composited:** mathematical at primitives (`step-0`), numeric internal (`scale-100`), semantic/T-shirt at the public surface (`space.inline.md`).
- **kebab-case words, dot-separated levels.** Numeric scale steps as keys (`100`, `150`). Figma variables use slash paths (`prism/color/action/primary/hover`); DTCG uses dots — the export bridges the two.
- **Units never in the value.** Unitless primitives; units applied at the transform layer (`16` → `16px`/`16dp`/`16pt`). Units may appear in the per-platform **Code Syntax** field (Figma) / code-syntax mapping, never in the JSON value.
- **CSS prefix follows the root:** `--prism-color-action-primary-hover`.

---

## 7. The Theme Schema contract

A brand is defined by a **small validated input set**. Below five inputs, brands suffer *visual collapse* (become indistinguishable). The discipline: **start at five, expand to six on a strong need, resist the seventh.** Full JSON Schema in `../schema/theme-schema.json`; worked example in `../schema/theme-schema.example.json`.

**Required (the five):**
1. **`primaryColor`** — OKLCH seed. Engine generates the full ramp, contrast-pinned text-on-primary pairs, and accent semantics by formula.
2. **`neutralHue`** — gray-ramp seed; carries brand temperature.
3. **`typography`** — typeface stack by role (`display` / `text` / `mono`) + optional script fallbacks.
4. **`radius`** — form-factor scalar (sharp ↔ soft); scales the corner system.
5. **`density`** — spacing-rhythm step; parameterizes the spacing scale.

**Optional (the disciplined extensions):**
- `secondaryColor` / `accentColor` — additional brand hues.
- `statusColors` — override system `success/warning/danger/info` (defaulted; overriding is discouraged).
- `displayP3` — emit P3 render targets for brand-critical surfaces.
- `motionPersonality` — the 6th input; brand easing/duration character.
- `brand` — id, name, logo URI, voice notes (metadata, drives docs/`.ai.json`, not values).

The engine validates the input against this contract *before* generating. Invalid or under-specified input fails fast.

---

## 8. AI-readable layer (`.ai.json`)

Generated per brand alongside the token JSON — the **apex deliverable** for "theming by agents." Each token is enriched beyond `$value`/`$type`/`$description`:

| Field | Purpose |
|---|---|
| `meaning` | what it signifies ("destructive action", "elevated surface in dark mode") |
| `paired_with` | which tokens compose with it (the validated foreground for a surface) |
| `contrast_with` | explicit guaranteed-accessible pairings + min ratio — turns a computed check into a lookup |
| `when_to_use` / `avoid_when` | affirmative + **exclusionary** guidance ("do not use for X") — exclusionary language is what produces system-compliant generation |
| `mode_overrides` | how it resolves across light/dark/HC/forced-colors |

There is **no per-brand authoring overhead** — docs, code, `.ai.json`, and design-tool bindings all flow from one schema input through one engine.

---

## 9. Outputs & pipeline

```
Theme Schema input (validated)
  → Generation engine (OKLCH ramps · contrast pinning · on-X flip · density · type · motion)
  → DTCG token tree  (source of truth, composites intact)
  → Style Dictionary v4 (brand overrides · platform units · flatten composites)
  → Per-brand outputs:
       • CSS custom properties (per theme/density mode block)
       • SCSS / JS / TS types
       • iOS (Swift) · Android (XML/Kotlin) · Dart
       • .ai.json registry
       • Code Connect mappings
       • per-brand MCP server config
```

- **Composites flatten at build**, never at runtime (most tools don't preserve property-level aliases on round-trip anyway).
- **Build order is architecture:** cross-file resolution is array-order merge, last declaration wins. Brand overrides must resolve to brand values — validated in CI.
- **MCP surface:** a platform-level MCP (invariants, schema, composition rules) + a per-brand MCP (that brand's components-as-data and token catalog). Canonical tools: `list_components`, `get_component`, `search_components`, `get_token_catalog`, `get_composition_rules`, `get_usage_guidelines`, `validate_implementation`.

---

## 10. Validation & governance

- **Validation is executable architecture** — bad tokens fail the build.
- **Block** only on: DTCG schema violations, broken aliases, type mismatches, and **WCAG contrast failures across the full brand × theme × density matrix.** Every brand re-validates on every schema release (brand-validation drift is a named failure mode).
- **Warn** (dashboard, non-blocking): APCA quality, naming drift, dead tokens, relationship violations. Over-blocking becomes a discoverable workaround.
- **Cascade report:** before a schema change lands, simulate it against every existing brand and surface which generated assets shift.
- **Semver, honestly:** a `$value` change that breaks a contrast pair in *any* combination is a **major** bump, even if the token shape is unchanged.
- **Deprecation is a window, not a switch:** introduce → coexist → warn → remove.
- **Blast-radius RACI:** primitive/schema changes get heavy review; a brand overriding `color.surface.brand` needs none.

---

## 11. Figma representation

Figma is a first-class target, not a downstream export. The architecture is designed to live as Figma Variables + Styles and round-trip back to DTCG. The governing constraint is Figma's: **one mode-dimension per collection** — so each axis is its own collection, and a frame sets each axis independently.

### 11.1 Libraries & collections

A **brand = one generated Figma library.** Components live in a separate **Blueprint** library that references the semantic contract; at render, the brand library is swapped in. Within a brand library:

| Collection | Tier | Modes | Published? |
|---|---|---|---|
| `Prism Primitives` | `prism.core.*` | single (`Value`) | no (hidden via `_` / `.` prefix) |
| `Prism Color` | semantic colour, border, icon, focus | **light · dark · high-contrast · wireframe** | yes (semantic only) |
| `Prism Spacing` | space, size, radius, layout | **comfortable · compact** | yes |
| `Prism Typography` | type size/lineheight/tracking primitives | **narrow · wide** (clamp endpoints) | yes |
| `Prism Motion` | duration, easing | single | yes |

A shared, read-only **`Prism Foundations`** library carries the brand-*invariants* (timing functions, target-size floor, breakpoint anchors, status-colour *meaning*) referenced by every brand library.

### 11.2 Variables vs Styles
- **Colour, dimension, number, duration** → **Variables** (`variableId`), mode-bound, alias across collections.
- **Typography** → **Text Styles** (`styleId`), with size/lineheight/tracking **bound to the Typography collection's variables** so the narrow/wide modes drive them. (Figma's text-style→variable binding is partial; where a property can't bind, the generated style carries the resolved per-mode value and the plugin reconciles on export. *Flag to verify against current Figma capabilities — candidate for a Figma MCP check.*)
- **Shadow/elevation** → **Effect Styles** (`styleId`); Figma variables can't hold shadow objects.

### 11.3 Round-trip
The export bridges Figma slash-paths (`prism/color/action/primary/hover`) ↔ DTCG dot-paths, preserving `variableId`/`styleId` linkage (the Prism2/NB dual-format discipline, generalized). Figma scoping (`TEXT_FILL`, `STROKE_COLOR`) is captured into `$extensions.figma.scopes` and doubles as an AI "where is this valid" signal. Pipeline direction is one-way **Figma-or-engine → DTCG → platforms**; the engine and Figma are *both* generated from the same Theme Schema, so they don't fight over source-of-truth.

> Several Figma binding details above (text-style variable binding, mode inheritance across swapped libraries) should be verified against the live product via the Figma MCP before we build the reference brand.

---

## 12. Decisions made & still open

**Decided (this pass):**
1. **Root prefix:** keep `prism.*` — disambiguates in Figma panel and code; brand stays out of the path (§6).
2. **Appearance modes:** light · dark · high-contrast · **wireframe** (generated by desaturation) (§5.5, §11.1).
3. **Density:** two modes — comfortable · compact (§3, §4.3).
4. **Typography responsive:** fluid `{min,preferred,max}` is the source; **endpoints become Figma `narrow`/`wide` modes** (§3, §4.2).
5. **Figma is first-class:** axis-per-collection mapping defined (§11).

**Still open (next pass):**
1. **Reference brand:** New Balance (real regression target) is the working first pick — first pass done in `02-nb-regression-pass.md`; we'll pressure-test multiple brands after.
2. **Typography code detail:** do we also ship parallel `vw` *and* container-`cqi` fluid sets, or viewport-only for now? How many endpoints beyond min/max?
3. **Engine implementation stack** — deferred with the tool-surface decision; constrains §9.
4. **Hue count & per-hue chroma ceilings** — the engine's default palette breadth (how many generated hues beyond brand/neutral/status).

---

*Companion files: `../schema/theme-schema.json` (the contract), `../schema/theme-schema.example.json` (a worked brand input). Knowledge-base sources: 02, 12, 15, 22, 23, 24, 31, 33, 34.*
