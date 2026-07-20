# 23 — Dashboard IA + component system (plan)

> The web dashboard (`web/src`) grew four broad stages, each carrying its own copy
> of the global live preview. This doc is the **plan** for reorganising it into
> focused, single-concern sections with the overall UI preview promoted to its own
> tab — and for landing an internal **component system** underneath so the reorg is
> declarative config, not more bespoke DOM. Decided in a design session (2026-07-20);
> supersedes the "four-stage build order" described in `web/README.md`. `04` is the
> why (a live theming surface with a contrast-contract overlay); `08` is the
> shared-manifest architecture; this is the IA + build sequence for the web host.

---

## 1. Why change it

Three problems with the current four-stage shell (Brand primitives · Semantic
colours · Typography · Form factor):

1. **The global live preview is duplicated 3×.** The sample-component gallery +
   contrast overlay (`paintPreview`) renders at the bottom of Semantic, Typography,
   *and* Form. Moving between stages re-renders the whole gallery, and it competes
   with the axis you're actually editing for vertical space.
2. **Two stages are catch-alls, not focused sections.** "Form factor" is really
   five axes (radius, size, density, shadow, motion, layout); "Semantic colours" is
   four surface families plus gradient. They read as buckets, not tasks.
3. **There's no single place to just *look* at the whole result** across every
   axis at once — the preview is always fragmented by whichever stage you're on.

The owner's stated preference: **simple, focused, clear tasks with room for a
beautiful, uncluttered UI** — not long-scrolling pages of dense controls. Split the
work into small screens; give the preview its own generous space.

A three-column *pinned-preview* layout was considered and rejected: the horizontal
real-estate cost is too high, and it reintroduces density. A **contextual** preview
per section (a small, axis-specific specimen) plus a **dedicated Preview tab** (the
comprehensive gallery) gives the same feedback without the crowding.

## 2. Target information architecture

Grouped nav — a shallow rail of groups, each opening focused sub-screens. `★` marks
a **derived/contrast** screen (not a free-colour picker — see §3); `⊕` marks a slot
that is **net-new capability** to decide on later, not something shipped today.

```
Palettes
Surfaces / fills
  ├ Backgrounds
  ├ Foregrounds
  ├ Text / ink            ★ auto pick + neutral-step override + live contrast badge
  └ Gradients             (toggle on → reveals options; default off)
Interactive
  ├ Interactive colours
  ├ Disabled
  └ Focus                 ★ derived (follows the action palette) — ⊕ editable = net-new
Typography
  ├ Primitives
  └ Typescales
Elevation
  └ Shadows
Size & radius
  ├ Size
  ├ Density               (scales component size only — see §3)
  ├ Radius
  └ Border width          ⊕ no lever today; slot only
Layout
  └ Breakpoints
Motion
Preview
  ├ UI preview            (comprehensive component gallery)
  ├ Contrast contracts    (all-modes master table)
  └ Token table / list
Output (Figma)            ⊕ new surface — grouped, deferred to its own discovery
  ├ Style guides
  └ Components
```

Ordering follows how a theme actually composes: primitives → how they're applied to
surfaces → interaction → type → refinement (elevation/size/layout/motion) → look at
the whole (Preview) → ship it (Output).

**Decisions locked in this session:**

- **Density lives under Size & radius, not Layout.** It scales the component-size
  tier only (control height + paired padding); the `space.*` reference scale is
  density-free (`scale.ts` `componentSizes`). It is a *size* concern, so it is listed
  once, under Size. Layout is breakpoints + space distribution.
- **Output (Style guides, Components) is a separate group, not inline** with the
  editors, and is **deferred** to its own discovery. Everything above Preview is
  "author the theme"; Preview is "look at it"; Output is "generate/ship it" — keeping
  that boundary keeps the mental model clean. Both are Figma-only generation surfaces.
- **No floating "quick-access preview" CTA.** With an ever-present Preview tab in
  the rail it is redundant.

## 3. Two control patterns (and what is *not* editable)

The screens split into two families, and the distinction drives their UI:

**A. Free-colour screens** — a value the author sets directly (a swatch / picker):
Palettes, Backgrounds, Foregrounds, Interactive colours, gradient stops.

**B. Derived / contrast screens (`★`)** — the value is *computed* to satisfy a
contrast contract; the author's control is limited to accepting the auto pick or
selecting an alternative **primitive step**, with a live pass/fail badge. These are
NOT colour pickers, and the UI must not imply they are:

- **Text / ink.** `text.primary/secondary/tertiary` are chosen from the **neutral
  ramp** as the step that clears a contrast target (`modes.ts`). The author may
  **override which neutral step** a role lands on, per mode (Phase A1 override layer);
  an override is limited to existing neutral steps, never an arbitrary hex. A pick
  below the required ratio is **kept and flagged, never blocked** (`modes.ts` pushes
  a warning; the editor row shows a `ratio:1 ✓/✗` badge). *Decision: text editing
  stays neutral-step-only — confirmed this session.*
- **Focus.** `border.focus` is **derived** from the action palette's rest colour;
  ring geometry (width/offset/style) is a fixed primitive (`tree.ts`). Shown as a
  derived readout ("focus follows your action colour"). Making focus independently
  editable is `⊕` net-new — **not** in this reorg.
- **Border width.** No lever today; widths are fixed primitives (hairline 1 / thick
  2 / heavy 4). The slot is documented under Size & radius for the future; **nothing
  ships now.**

### Contrast anchors (what text is measured against)

- `text.primary` → **`background.primary`** (the page surface), target 7:1.
- `text.secondary/tertiary` → the **worst-case floor surface** (`cfg.floorName`),
  targets 4.5:1 / 3:1.
- `text.on-<role>` (ink on a solid fill) → that fill (`foreground.<role>`).

So it is the **background/surface** that anchors text contrast, not a foreground
token — changing a background is the edit that ripples into text.

### Recalculation + override model (already the engine's behaviour)

Every live edit re-derives the **entire** theme from the mutable input state
(`brandTheme(brandState)` on each change; nothing derived is cached). Consequences,
already true today and to be *surfaced*, not built:

- Change a background → auto text ink **re-picks** to keep contrast passing.
- If the author had **overridden** that text role, the override is **preserved** and
  its badge simply **flips to ✗** (warned, not blocked). This is exactly the desired
  "keep the customisation, flag that it now fails" behaviour.

Because pass/fail is already computed and authoritative (the engine derives and gates
every ratio; the preview badges read it straight), a **small, section-scoped contrast
table** under the relevant screens is nearly free — a re-slice of existing data. The
**full all-modes master table** lives in Preview.

## 4. Build it as a system (the underneath)

The dashboard is currently hand-rolled DOM via an `el()` helper — every control is
bespoke. Eight-to-ten focused screens that must stay visually consistent and scale
need a small **internal component vocabulary** first. This reorg is the moment to
introduce it, because the screen structure is being rewritten anyway.

- **Screen scaffold** — a single shape (title · description · controls region ·
  contextual specimen/contrast region) so every section screen is structurally
  identical and adding one is trivial.
- **Control kit** — labelled field, select, slider, toggle, per-mode row, swatch,
  disclosure. Adding a future lever (e.g. border width) becomes one declaration, not
  40 lines of DOM.
- **Rail-as-data** — the nav is a config object (groups + items), not hand-wired
  `onclick` handlers. This is what makes "change once, applies across all tabs" true.
- **Dashboard self-theming** — the chrome themes itself from a small token set
  (spacing / radius / type / colour) so that when Prism3 components land, we swap the
  primitives and the whole tool re-themes, including a **light/dark toggle** for the
  dashboard itself. Dogfooding: the theming tool, themed by the system it builds.

Doing the IA split on top of the current bespoke DOM would bank the visual win but
not the scalability win — and both are explicitly wanted. The foundation lands first
(§5 Phase 2), invisibly, so the visible reorg is declarative config on a solid base.

## 5. Sequencing (one concern per PR)

0. **Docs backfill — already done.** `#189/#192/#194` progress entries were
   backfilled by `#191/#193/#195` (the reviewer's follow-up PRs). No PR needed.
   **Go-forward discipline:** the `00-progress.md` entry rides *in* each feature PR
   from here on, not a follow-up round-trip.
1. **This design note.** Pins the IA, the two control patterns, the facts, and the
   component vocabulary before any `main.ts` change. Ships on its own.
2. **Foundation (refactor PR).** Introduce the component kit + screen scaffold +
   rail-as-data, and re-express the *current* four stages on top of it. Behaviour
   identical, engine output byte-identical, zero visible change.
3. **IA split + Preview tab (the visible reorg).** Define the grouped rail from §2,
   move the global preview off the editors into its own Preview tab (kills the 3×
   duplication), split Form/Semantic into focused screens.
4. **Per-section contrast tables + polish.** Section-scoped contrast readouts under
   the relevant screens; full master table in Preview.
5. **Later: dashboard self-theming + light/dark.** Deferred until it earns its place;
   unblocks the dashboard's own light/dark toggle. Same bucket as Output.

## 6. Deferred / open

- **Output group (Style guides, Components)** — real, new surface area; its own
  discovery + plan, not part of this reorg.
- **Focus as an editable lever** and **border-width lever** — documented slots; ship
  only if a concrete need appears.
- **Mode-context strip placement** — with a dedicated Preview tab (not a pinned
  pane), the mode selector stays with the preview, where modes are meaningful. If a
  future pinned-preview experiment happens, revisit.
