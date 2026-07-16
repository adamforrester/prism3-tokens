# Web dashboard — design review (hand-off for the editor-UI pass)

A designer's review of the theming dashboard (`web/src/main.ts`), tab by tab. Purpose: a
punch-list for the editor-UI refinement lane. **Findings are documented, not yet actioned.**
Grounded in the aurora brand as rendered on `main` (commit at review time: `68ba632`).

Severity key: 🔴 blocks the tool from working · 🟠 real UX gap · 🟡 polish.

---

## 0. The finding that dominates everything — 🔴 most controls are inert

`web/src/main.ts`:
```ts
const LIVE = new Set(['actionPalette', 'radiusScale', 'typography.typeScale']);
```
**Only three levers in the entire tool are wired to live-edit.** Every other lever renders via
`renderControl`, which sets `input.disabled = !LIVE.has(key)` — so it shows **greyed / disabled**.
A designer who tries to change "Disabled strategy", "Density", "Shadow softness", etc. gets no
response. A control panel where most knobs are dead reads as *broken*, not *minimal*.

Two structural gaps compound it, both in `renderControl`:
- **No `toggle` case.** `inverse` and `gradients` are `control: 'toggle'` but fall through to the
  read-only `else` branch, printing as plain text (`"true"`, `"brand, glow"`). Not editable at all.
- **`object` controls are read-only.** `typography.families`, `surfaces`, `shadow.tint`, etc. render
  the placeholder `"configured"` — no sub-form. So a designer cannot change the font family in the UI.

**This is the highest-leverage fix and a prerequisite for verifying every other item below:** you
can't tell whether a preview reflects a lever if the lever can't move. Recommend doing the `LIVE`
expansion + `toggle`/`object` editors **before** the grouping/example polish.

*(Open question for the owner: was 3-live-levers a deliberate MVP, or just unfinished wiring? The
review assumes the intent is "all levers live.")*

---

## 1. Semantic colors tab

**Renders:** one flat panel, 8 controls — Action palette, Icon contrast floor, Disabled strategy,
Disabled contrast floor, Outline hover, Neutral emphasis, Inverse surface-context, Gradients — then
the live preview + contract table. Only **Action palette** is live (see §0).

### Grouping — 🟠 a flat grab-bag of ~4 families
Break the 8 into labelled sub-groups:

| Group | Controls |
|---|---|
| **Interactive colour** | Action palette · Neutral emphasis · Outline hover · Inverse surface-context |
| **Accessibility policy** | Icon contrast floor · Disabled strategy · Disabled contrast floor |
| **Features (opt-in)** | Gradients *(placement disputed — see Parked)* |

- **Nest "Disabled contrast floor" under "Disabled strategy".** The floor only applies when strategy
  = *accessible*; disable/hide it when strategy = *conventional* so the dependency is visible.
- Accessibility policy is the highest-stakes group on the tab — it deserves its own labelled section,
  not adjacency in a flat list.

### Examples of the change — 🟠 five levers change things the preview never shows
The preview *does* show button rest/hover/pressed/disabled as side-by-side chips (good). But:

| Lever | Shown today? | Needs |
|---|---|---|
| Outline hover | ❌ outline button shows only `default` | hover/pressed/selected chips **for the outline button** — the exact thing this lever controls |
| Inverse surface-context | ❌ no dark section | an inverse specimen: a dark hero band with a light CTA on it |
| Gradients | ❌ nothing | a gradient swatch/hero that appears when on |
| Icon contrast floor | ❌ no standalone icon | an icon row (icon on surface + on fill) so 4.5 vs 3:1 is legible |
| Neutral emphasis | ❌ preview shows only *primary* buttons | a **neutral** filled button so subtle-vs-strong shows |
| Disabled strategy | ✅ disabled chips exist | — fine |
| Action palette | ✅ buttons recolour | — fine |

### Copy — 🟡
The hero lede still says *"override status hues"* — that moved to the **Primitives** tab (the
per-ramp validation-colour control). Update the lede to describe what's actually here.

---

## 2. Typography tab

**Renders:** 2 controls — Type scale (enum, **live**) + Font families (`object`, read-only
`"configured"`) — then a **Type-scale specimen** + the live preview + contracts.

### 🟠 Font families + weights should be a real editor (owner-confirmed direction)
The one thing a designer most wants on a Typography tab — swap the font, pick the weights — renders
as read-only `"configured"` (the `object` gap from §0). **Owner wants real typography customization
here.** Scope:
- **Family editor** — display / text / mono, + the variable-font flag (`typography.families`). A single
  name auto-pads a system fallback stack in the engine.
- **Weight editor** — the subtle/default/emphasis/strong → numeric map (`typography.weightRoles`) and
  which weights each role ships (`typography.weights`). Both currently `advanced` + read-only.

**The load-bearing design question — font availability differs by surface:**
- The **web playground** can only *render* fonts the browser has (system fonts, or web fonts loaded via
  `@font-face` / a Google-Fonts-style link). Picking "Söhne" and previewing it means loading it first.
- The **Figma plugin** picks from Figma's own font list (no loading problem, but a different list).

So the family picker + live preview will likely differ between the web and plugin surfaces — worth
designing the control to degrade gracefully (a text field that accepts any name + previews if available,
vs. a curated picker of loadable fonts).

**Owner is sharing references** to inform this: (1) their existing theming-plugin interface, and (2) a
separate typography text-styles Figma plugin. Fold their font-selection + weight-selection patterns
(and how they handle loading/preview) into this design before building — this is a "better than the
examples" opportunity, not a from-scratch guess. *(This section to be refined once those land.)*

### ✅ The type-scale specimen is the model to copy
The dedicated specimen (display.xl 112px → title.2xl → body.lg → label.md → caption → eyebrow →
code, at resolved sizes) is exactly the "isolate the axis being tuned and show it" pattern the
**Semantic tab is missing**. Replicate this idea per tab: a focused specimen for the axis in play.

### 🟡 Sparse
~8 of the ~10 type levers are `advanced` (weight roles, display ceiling, title floor, responsive,
weights, familyMap, links) and hidden — fine as progressive disclosure, but the tab shows only 2
controls. Consider a lightweight "Advanced typography" disclosure so power users can reach them.

---

## 3. Form factor tab

**Renders:** 4 controls — Corner softness (slider, **live** via `radiusScale`), Density (enum,
disabled), Motion tempo (enum, disabled), Shadow softness (slider, disabled) — then live preview +
contracts. Only **Corner softness** is live.

### Examples of the change
| Lever | Demonstrable in the static preview? |
|---|---|
| Corner softness | ✅ live now — buttons/inputs/cards/badges bind a radius and re-round on change |
| Density | ✅ component sizes (height + padding) — once live |
| Shadow softness | ❌ **shadows are never rendered** — `renderChip` ignores the `shadow` binding (see below) |
| Motion tempo | ❌ **motion cannot be shown in a static preview** — needs an animated specimen |

### 🔴 Shadows are not rendered at all
`renderChip` applies bg / fg / border / radius / padding / type — but **not `bind.shadow`**. The card's
`shadow: 'shadow.sm'` is silently dropped, so the preview shows zero elevation. So Shadow softness (and
the tint lever) would be invisible even once live. Two fixes:
1. Teach the preview to apply `box-shadow` from the resolved shadow token.
2. Add a **focused elevation specimen** — a row of surfaces at each shadow step (sm/md/lg) that updates
   live with softness + tint. This is the type-scale-specimen pattern applied to elevation, and it's the
   right home for showing shadows (the single card can't show the ramp).

### 🟡 A focused corner-radius specimen too
Corner softness already works live in the general preview, so it's lower priority — but a focused radius
specimen (samples at none / sm / md / lg / round) would isolate the axis the same way, for consistency.

### 🟠 Motion tempo is misplaced *and* invisible
Motion isn't form/geometry (the tab is "Density, radius, elevation"), and a static preview can never
show it. Either give it an animated specimen (a small looping transition demo) or move it out of Form.
See Parked.

---

## Cross-cutting patterns

1. **`LIVE`-gating (§0) is on every tab** — the single dominant issue.
2. **Every tab is one flat panel.** Multi-family tabs (Semantic especially) need sub-group headings.
   Reuse `leverGroups` labels or introduce finer sub-groups.
3. **The specimen pattern (Typography) should generalize.** Each tab wants a focused specimen that
   isolates its axis — outline-hover states, an inverse band, a gradient, an icon row, a motion loop.
4. **Some levers live on the wrong tab** and/or can't be previewed — see Parked.
5. **The contract table repeats identically on all three lever tabs.** It's the same full table every
   time; consider whether it should filter to the axis in play, or collapse by default.

---

## Parked decisions (owner to decide)

- **Gradients placement.** Odd on "Semantic colors"; owner agrees it's also odd on Form. Park until
  we decide — candidate: a "Features / opt-ins" area, or its own surface.
- **Motion tempo placement.** Not really form factor, and unpreviewable statically. Park with
  gradients as a "where does this belong + how do we show it" decision.

---

## Recommended sequence

1. **Functional first (§0):** expand `LIVE` to all levers + add `toggle` and `object` editors to
   `renderControl`. Nothing else can be visually verified until controls move.
2. **Grouping:** sub-group each tab; nest the disabled-floor dependency; update stale Semantic copy.
3. **Example specimens:** add the missing per-axis specimens — outline-hover states, inverse band,
   gradient, icon row, neutral button (Semantic); **elevation/shadow ramp + box-shadow rendering**,
   radius samples, motion loop (Form) — generalizing the Typography specimen pattern. The
   elevation specimen also requires the preview to actually render `box-shadow` (§3).
4. **Placement:** resolve the parked gradients / motion-tempo questions.

*(Tabs reviewed: Semantic, Typography, Form factor. Primitives tab not formally reviewed here — it
was just rebuilt with the per-ramp validation-colour control; a design pass on its Brand-colors /
Neutral / ramp panels is a natural follow-up.)*

---

## Appendix — Reference: existing VML plugins (field study)

Two existing plugins the owner shared as reference (VML Design System Practice, v2.0). **We borrow
patterns, not the whole model** — Prism3's differentiator is that it *derives* the token layer with
contrast gating, where these tools have the designer *assign* it by hand.

**A. Prism Theme Builder v2** — a theme generator; 5 tabs: Palettes / Surfaces / Actions / Typography / Radius.
**B. Text Style Variables Pro** — a Figma text-style bulk editor/binder; one two-panel screen.

### Patterns to borrow
- **A focused example beside every control.** Every colour role shows a live **Button example** /
  **Text link example** (and Radius shows a **Button Preview**) — the control's *own* change, not one
  shared preview. This is the single biggest thing our dashboard lacks (see §0/§1).
- **Inline contrast badge at the point of edit** (`7.36:1 ✓`, `17.21:1 ✓`) — verification where the
  choice is made. Directly answers our "show me the a11y consequence" gap.
- **Availability-aware weight selection.** Font Weight *depends on* Font Family — it populates from the
  chosen family's real weights ("Select a font family first…"), and flags missing weights/styles (⚠️).
  Steal this outright for the typography editor.
- **Variable-binding transparency** — when bound, show the alias chain (`font/family/body → …/inter`),
  grouped Brand-Theme (semantic) vs Primitives (raw). Good for our token-aware audience.
- **Token-path pills** on every role (`pds/color/action/primary/surface/rest`) — cheap dev transparency.
- **Unit toggles (px/%) + conversion** for letter-spacing / line-height.
- **Filter / search + multi-select** over long lists (text styles). Explicit **apply + Preview + Reset** per screen.
- **Per-mode editing** via a Mode selector.

### Divergences to hold (Prism3's value-add — do NOT copy)
- **Assign vs derive.** Both tools have the designer manually map surfaces/actions to palette steps via
  dropdowns. Prism3 *derives* these with contrast gating — that's the whole point. Borrow the *presentation*
  (per-role example + badge + token pill), keep the *derivation*.
- **Radius.** Theirs is a single Button Radius; ours is a full ramp — don't regress.
- **Weight naming.** Their `thinnest→thickest` scale is genuinely confusing; keep our
  `subtle/default/emphasis/strong`. (Borrow the structure, improve the naming — the "better than the
  examples" bar.)

### Typography editor — synthesized design (the active open item)
Combining both tools + our engine, the target model:
1. **Two levels** — a font *pool* (add families) → per-category *assignment* (family + weights). The
   Theme Builder splits this as Typography Primitives (pool) → Typography Semantics (assignment).
2. **Categories** — Theme Builder uses Display / Title / Body / Button / Detail. Our engine's roles are
   display / title / body / label / caption / eyebrow / code. **Reconcile the two category sets.**
3. **Weight selection populated from the family's real weights** (availability-aware), with an **italic**
   parallel axis. Per-category, per-weight — *more granular than our engine models today*.
4. **Font availability differs by surface:** the **plugin** picks from Figma's full font list; the **web
   playground** must load web fonts (a Google-Fonts-style subset) and degrade gracefully when a named
   font can't be loaded/previewed. Design the family control for both.

**⚠️ Engine-reconciliation decision (owner):** matching the per-category weight grids + italic axis is
*more than our engine's current type model* (`weightRoles` = subtle/default/emphasis/strong, a `familyMap`,
per-role `weights`). Adopting the plugin's granularity would pull **engine work**, not just UI. Decide how
far to match before building the editor.

### Parked (added from this study)
- Category-set reconciliation (Display/Title/Body/Button/Detail vs our type roles) — see above.
- Web-surface font loading strategy (which fonts are loadable/previewable in the browser playground).
