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
  that boundary keeps the mental model clean. Both are Figma-only surfaces, and Style
  guides in particular is an *active canvas write* (§7), not a passive view.
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
  discovery + plan, not part of this reorg. Channel-gated (Figma-only) and an active
  canvas write — see §7 for the settled framing.
- **Focus as an editable lever** and **border-width lever** — documented slots; ship
  only if a concrete need appears.
- **Rail overflow for many modes** and the **rail accordion** — both deferred; the
  intended solutions are recorded in §7 so Phase 3 lays out for them without building
  them.
- **Section-complete indicator** — deferred; needs a real save/done model (§7).

(The mode-context strip placement, listed open in the first draft, is now settled — a
persistent global-header strip; see §7.)

## 7. Phase 3 interaction model (decided 2026-07-20)

Settled in a design session; supersedes the first-draft hints in §2/§6. Phase 3 builds
to this.

**Rail — flat, re-grouped, no collapsing.**
- The left rail stays a flat clickable list (as today), re-grouped to the §2 groups —
  ~9 items: Palettes · Surfaces/fills · Interactive · Typography · Elevation ·
  Size & radius · Layout · Motion · Preview (Output added later).
- Each rail item is **one focused page**. A page's facets are plain **sections within
  the page** (in-page headers), *not* separate rail rows. Long pages (realistically
  Surfaces, maybe Palettes) may get **anchor links** at the top to jump between
  sections.
- **No accordion / collapse** — start simple. The old long-scroll problem is solved by
  splitting the two catch-all stages (Semantic, Form) across focused pages, so most
  pages end up shorter than today. Revisit collapsing only if a page ever warrants it.

**Global header (the "brand bar", promoted) — two tiers.**
- **Tier 1 — identity + I/O:** brand mark · brand selector (switch / new / import) on
  the left; quick **Export** (design.md / tokens.json) on the right.
- **Tier 2 — context:** the persistent **mode selector** strip (mode chips with their
  pass/fail marks + ⚙ Edit modes), always visible under tier 1.
- Mode is a single global (`currentMode`) that **persists across navigation**; on a
  page where mode doesn't apply the selector just sits inert.
- Chips **exposed by default**. Overflow (many custom modes) → **active-pinned chips +
  a `More ▾` menu** for the rest — never horizontal scroll (the active mode must always
  be on screen). **Deferred:** build overflow only when a brand hits it; lay the strip
  out so it can be added without rework.

**Rail vs header — the rule.** *Canvas destination → rail* (authoring pages, **Preview**,
future **Output**). *Quick action / menu that doesn't need the canvas → header* (brand
switch, mode, **Export**). So **Preview is a rail leaf** (after a divider) with
**segmented sub-views inside one screen** — UI preview / Contrast contracts / Token list
— not three rail rows.

**Numbering + completeness.** **No numbers** on rail items; top-to-bottom order carries
the compose sequence (keep the rail footnote). A **"section complete" ✓ is deferred** —
it needs a real save/done gesture to mean anything, and a false "done" is worse than
none. The per-mode contrast ✓/✗ on the mode chips stays (an *accuracy* signal, distinct
from *completeness*).

**Output / Style guides — channel-gated, an active canvas write.** Output is
**Figma-only** and **not passive**: the Style-guides surface **writes a real
style-guide table onto the Figma canvas** with live variable values (an existing
owner-built plugin, to be brought in and finished). Because it only makes sense in the
Figma channel, Output is **split as channel-gated functionality** — present in the Figma
plugin host, absent/hidden in the web host — so it's easy to turn on/off per surface.
The web rail simply omits it; the rule (§ above) still places it in the rail *where it
renders*.

**Build note.** Phase 3 is where **rail-as-data** (the nav config the flat rail renders
from) and the **screen scaffold** (title · sections · contextual specimens) land — now
with real callers (every page), per the Phase 2 scoping decision that shipped the
control kit first.

## 8. Component inventory + componentization audit (living)

The dashboard is hand-rolled DOM via `el()`. §4 committed to building it as a system; this
section is the **living inventory** of what's been componentized and what's next, so each PR
extracts against an agreed list rather than re-deciding. **Extraction rule (from root
`CLAUDE.md` §2/§3): componentize only where there are ≥2 real callers today** — no speculative
abstraction. This tier feeds the Phase 5 goal of self-theming the dashboard from Prism3 tokens
(and, eventually, Prism3 components).

**Extracted (the spine).**
- **Control kit** — `knob(label, body, desc)`, `knobBody`, `optionEl` (PR #197).
- **Screen scaffold** — `renderScreen(host, key, sections, specimens)` + `renderAdvancedPanel`
  (Phase 3b); every editing page composes through it.
- **Rail-as-data** — `NAV` + `pageOfLever` (Phase 3b).
- **Table renderers** — `contractTableEl` (contrast) + `tokenTableEl` (token list) (Phase 4).
- **Color card** — reusable card shell + variants (interactive / stateless bg-fg / neutral),
  **PR-2, in progress**.

**Candidates (ranked by present-tense duplication — the next tier).**
1. **`contrastBadge(ratio, min)`** — "show ratio + pass/fail" is rebuilt in ≥3 shapes: the
   interactive card (`cbadge`), the foreground editor's badge, and the tables' `dot` + ratio.
   Highest-value dedup; PR-2 will need it for the fill cards, so extract it there.
2. **`swatch(hex, size?)`** — color-square construction repeats across ramp swatches (`.sw`),
   the interactive big swatch (`.ic-big`), the token-list swatch (`.tok-sw`), and the foreground
   swatch. Extract alongside PR-2 (the cards are swatch-heavy).
3. **Override / "Auto · palette step" picker** — the foreground editor and the interactive card
   each build the same "Auto + palette steps" select independently. PR-2 unifies this for the
   card path; generalise into one `stepPicker(role, palette, current, onPick)`.
4. **`tpill(path)`** — the token-path pill (`tpill mono`) repeats in the interactive card and the
   preview gallery. Trivial, do opportunistically.
5. **`specimen(title, desc, body)` frame** — every `render*Specimen` rebuilds `sectionHead` + a
   display container. A thin frame would DRY the ~9 specimens; extract when a specimen PR touches them.
6. **`objEditor(title, lede, body)` wrapper** — `subHead` + `obj-lede` + panel, repeated across the
   bespoke editors (surfaces / foreground / shadow / typography). Low urgency.

**Sequencing.** #1–#3 land with **PR-2** (the card work needs them). #4–#6 are opportunistic —
extract when a PR already touches that surface; don't do a standalone "refactor everything" pass.
Revisit this list before the Phase 5 self-theming work, which will want these primitives themed
from tokens.
