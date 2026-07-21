# 00 — Progress & Status Log

> A living record of where Prism3 is, what was decided and why, and what comes
> next — so the work survives context loss and a fresh agent (or human) can pick
> it up without re-deriving anything. Update this when state or direction
> changes. Most recent entry first.

---

## Latest (2026-07-21) — Remove all "Advanced" disclosures, expose the UI uniformly

**STATUS: web-only, no behaviour change.** Owner decision (code-review finding #2, expanded): drop the
progressive-disclosure "Advanced" affordance entirely — every control is shown at the same level, so a
lever's `advanced` flag in the manifest no longer hides it behind a click.

- **`renderAdvancedPanel`** no longer wraps its levers in a `<details class="adv"><summary>Advanced</summary>`.
  It renders the same `.adv-panel` (manifest-`advanced` scalar/enum controls + the optional bespoke
  object editors) directly into the host as a normal always-visible panel. Signature and call sites
  unchanged — only the wrapper disappeared.
- **CSS removed:** `.adv`, `.adv-sum` (+ `::-webkit-details-marker`, `::before`, `[open]` marker). Kept
  `.adv-panel{margin-top:12px}`. Two stale comments (responsive-editor docstring, breakpoints `commit`
  closure) that reasoned about "the disclosure snapping shut mid-edit" rewritten — the concern is moot
  now, but `commit` still uses `draw()`+`apply()` (not `applyFull()`) to avoid rebuilding the editor
  under the user's cursor.

**Verification:** `tsc` + esbuild clean. Playwright across Typography / Size&radius / Motion / Layout:
`advanced-disclosures = 0` everywhere (was ≥1 per page); previously-hidden levers now visible in a
second panel (e.g. Size&radius shows Radius anchor / Spacing rhythm / Fine grid base); bespoke obj
editors present; no console errors. Screenshots reviewed. No engine files touched.

**Next:** Backgrounds on cards (PR-2d), then the gradient editor. Progress entry rides in this PR.

---

## (2026-07-21) — Neutral as an interactive card (docs/23 §2, retires the specimen)

**STATUS: web-only, additive.** The neutral / default button is now a proper interactive card alongside
Primary / Destructive (owner request #2A), replacing the disconnected standalone "Neutral emphasis"
specimen.

- **`renderNeutralCard`** — same `renderCard` shell + interactive-states section as the other columns,
  but its control is the (global) `neutralEmphasis` toggle (subtle grey vs bold fill) rather than a
  per-mode anchor step. Appended after Primary/Destructive in `renderInteractiveCards`.
- **`neutralEmphasis` moved off the panel onto the card** — removed from `INTERACTIVE_GROUPS` **and**
  filtered out of `leversFor('interactive')` so `renderGroupedPanels`'s catch-all doesn't re-surface it
  under "More" (caught in verification).
- **Removed** the dead `renderNeutralSpecimen` + its `.ne-*` / `.neutral-spec` CSS.

**Verification:** `tsc` + esbuild clean. Playwright drive-through: interactive cards are now
`[Primary, Destructive, Neutral]`; the standalone neutral specimen is gone (0); `neutralEmphasis` no
longer appears in any panel; flipping the card's emphasis re-derives the fill (grey `rgb(206,206,208)` →
bold `rgb(44,44,47)`); no console errors. Screenshot reviewed. No engine files touched.

**Next:** Backgrounds on cards (PR-2d), then the gradient editor. Progress entry rides in this PR.

---

## (2026-07-21) — Foregrounds editor (fills as cards) on the reusable card

**STATUS: web-only, additive feature.** Closes the "Foregrounds" gap from the `docs/23` §2 IA (the fill
roles had no UI control — they were engine-derived only). Owner confirmed exposing **both** families.

- **`renderForegroundsEditor`** on the Surfaces page (between Backgrounds and Text & ink): a grid of
  compact `renderCard`s, one per fill role — the bold semantic fills (`foreground.brand` /
  `.success` / `.warning` / `.info` / `.danger`) and the neutral surface tiers (`foreground.primary` /
  `.secondary` / `.tertiary`). Each card = swatch · an **Auto + palette-step picker** (`stepPicker`,
  audit §8 candidate #3) · the `foreground.*` token pill · a contrast badge (bold fills only; the
  surface tiers aren't contrast-gated so they omit it).
- **Overrides via the A1 layer, no engine change.** The picker writes `brandState.overrides[mode][role]
  = { palette, step }` keyed to each role's own palette (`roleToPalette`), pruning back to Auto — same
  mechanism as Text & ink. Customizable modes only; derived modes stay the read-only note.
- **`renderCard` gained `compactSwatch`** (72px) for the denser fill grid; `stepPicker` is the shared
  Auto+steps select.

**Verification:** `tsc` + esbuild clean. Playwright drive-through: 8 fill cards render with the right
labels/palettes; **overriding Brand to step 950 re-derived the fill** (swatch `rgb(94,75,195)` →
`rgb(13,3,45)`) and the picker held the selection — the override round-trips end-to-end; no console
errors. Screenshot reviewed. No engine files touched.

**Next:** PR-2c — Backgrounds on cards + Neutral as an interactive card; then the gradient editor.
Progress entry rides in this PR.

---

## (2026-07-21) — Reusable color card (foundation) + componentization audit (`docs/23` §8)

**STATUS: web-only, DOM-identical refactor + docs.** First slice of the color-card work (owner request to
reuse the interactive-card styling for fills). Extracts the card into a reusable component and records the
component inventory so later extractions build against an agreed list.

- **`docs/23` §8 — component inventory + componentization audit.** Living list: what's extracted (control
  kit, screen scaffold, rail-as-data, table renderers) and the ranked next-tier candidates
  (`contrastBadge`, `swatch`, the override step-picker, `tpill`, a specimen frame, an obj-editor wrapper).
  Rule: extract only at ≥2 real callers. Feeds Phase 5 self-theming.
- **Card component extracted.** New `renderCard(opts)` shell (header · big swatch · picker + token pill ·
  optional example · desc + optional badge) + shared `contrastBadge(ratio, min, label?)` and
  `swatch(hex, cls?)`. `renderInteractiveCard` now composes through `renderCard` (appending its own
  interactive-states section) instead of hand-rolling the DOM.

**Verification:** `tsc` + esbuild clean. A Playwright DOM-parity harness rendered the **Interactive** and
**Preview** pages on `origin/main` vs. this branch — **byte-identical** (25,872 / 21,456 chars), so the
migration changes nothing visible. No engine files touched.

**Next:** PR-2b — the **Foregrounds** editor + **Backgrounds** on cards + **Neutral** as an interactive
card, all on `renderCard` (the `foreground.*` fills are engine-derived; the A1 override layer repoints
them, no engine change). Then the gradient editor. Progress entry rides in this PR.

---

## (2026-07-21) — UI polish: toggle switch + code-review nits

**STATUS: web-only, additive polish.** First of a UI-refinement series (owner feedback after the reorg):

- **Toggle → switch.** `.knob input.toggle` was a native checkbox; it's now a proper switch (pill track +
  sliding thumb, ink when on) via `appearance:none` + `::after`. Kit-level, so it upgrades every toggle
  lever (gradients + inverse) at once.
- **Rail sticky offset now measured** (code-review nit): `.rail{top:calc(var(--chrome-h,120px)+10px)}`;
  `renderModeStrip()` sets `--chrome-h` from the actual header height. A brand whose mode chips wrap to a
  second row no longer tucks the rail under the sticky header (was a hardcoded `top:130px`).
- **Dead `.stage-view` class removed** (code-review nit) — it was applied to the Preview rail item but had
  no CSS rule after the ordinal was dropped.

**Verification:** `tsc` + esbuild clean; Playwright drive-through confirmed the switch renders + toggles in
both states (grey/thumb-left off, ink/thumb-right on), `--chrome-h` measures live (145px on the example),
no console errors. No engine files touched.

**Next in the series:** PR-2 — a reusable color-card component with the Foregrounds editor + Backgrounds on
cards + Neutral as an interactive card (owner request; the `foreground.*` fills are engine-derived today
with no UI control — the A1 override layer supports repointing them, so no engine change needed). PR-3 —
a gradient editor (stops / angle / kind; UI currently only toggles gradients on/off). Progress entry rides
in this PR.

---

## (2026-07-20) — Dashboard Phase 4b: Preview segmented sub-views + token list (`docs/23` §7)

**STATUS: web-only, additive.** The Preview destination gains a **segmented view-switcher** with three
views, completing the `docs/23` §7 Preview shape:

- **UI preview** — the component gallery (extracted from the old `paintPreview`; unchanged).
- **Contrast contracts** — the full all-modes master table, now a first-class view (was a closed
  disclosure inside the gallery). Reuses `contractTableEl`.
- **Token list** — NEW: the resolved token set, category-grouped (**Color · Dimension · Typography ·
  Shadow**) with values per mode. Colour = every resolved semantic role (`resolveAllModes`) as a
  swatch + hex per mode; Dimension = the px scale (`rp.dims` + per-mode `dimOverrides`); Typography =
  resolved composites (family · weight · size, mode-invariant); Shadow = the elevation ramp's CSS
  `box-shadow` per mode. Built entirely from the resolved read-model — no engine change.

`paintPreview` was split into `renderPreviewGallery` / `renderPreviewContracts` / `renderPreviewTokens`;
`renderPreviewPage` renders the `.pvseg` switcher (state `previewView`, defaults `ui`) and dispatches;
a segment click re-renders the page. Ramp primitives stay on Palettes; the token list is the semantic +
dimension/type/shadow layer.

**Verification:** `tsc` + esbuild clean. Playwright drive-through on Preview: three segments switch with
correct active state; UI preview shows 8 components, Contrast 32 rows (the master table), Token list the
four category sections (4 tables, per-mode swatches); no console errors. Token-list screenshot reviewed.
No engine files touched. This completes Phase 4. Progress entry rides in this PR.

---

## (2026-07-20) — Contrast-table follow-up: token-path labels + exhaustive partition

**STATUS: web-only, refines #201.** Two small changes to the per-section contrast tables:

- **Token-path pair labels (owner request).** The per-section tables now lead with the raw `fg on bg`
  token path (mono, e.g. `text.primary on foreground.primary`) with the human description as a faint
  subtitle — the component context is obvious next to the controls, so the path is the useful primary.
  `contractTableEl(contracts, paths?)` gained the flag; the Preview **master** table keeps its
  descriptive `component · variant — label` (verification-of-record).
- **Exhaustive partition (review nit on #201).** Replaced the two hard-coded component lists with one
  `SURFACE_CONTRACT_COMPONENTS` set + an Interactive catch-all, so the surfaces/interactive split covers
  every contract **by construction** — a component added to the preview spec later can't silently vanish
  from the local tables; it lands on Interactive automatically.

**Verification:** `tsc` + esbuild clean; drive-through unchanged (Surfaces 7 + Interactive 25 = 32 =
master; Motion none; no console errors); screenshot of the token-path table reviewed. No engine files
touched. Progress entry rides in this PR.

---

## (2026-07-20) — Dashboard Phase 4a: per-section contrast tables (`docs/23` §3)

**STATUS: web-only, additive.** The "local proof" half of the hybrid contrast model: each colour page
now carries a scoped **Contrast on this page** table — the same authoritative contracts the Preview
master table shows, re-sliced to the components that page governs.

- Extracted `contractTableEl(contracts)` (the Pair · per-mode dot+ratio table) from `paintPreview`; the
  Preview master table now calls it too — one renderer, two callers.
- `PAGE_CONTRACTS` maps colour pages → their components (`surfaces`: typography + card; `interactive`:
  button / button-secondary / input / nav-item / badge / alert); `renderSectionContrast(page)` re-slices
  `rp.contracts` and renders a collapsed disclosure in the page's volatile region (repaints on edit).
- Only the two colour pages govern contrast pairs, so only they get a table; non-colour pages get none.

**Verification:** `tsc` + esbuild clean. Playwright drive-through: Surfaces shows **7 pairs**, Interactive
**25 pairs**, and **7 + 25 = 32 = the Preview master table** exactly — every contract on precisely one
page's scoped table, none orphaned; Motion (non-colour) has none; no console errors. Screenshot of the
Surfaces table reviewed (card + typography pairs, all four modes, green). No engine files touched.
Progress entry rides in this PR. **Next (4b):** Preview segmented sub-views (UI / contrast / token list).

---

## (2026-07-20) — Dashboard Phase 3b: focused pages + rail-as-data (`docs/23` §7)

**STATUS: web-only, visible reorg (part 2 — completes the Phase 3 IA split).** Splits the two catch-all
editing stages into **focused, single-concern pages** and makes the rail **data-driven**.

- **Rail-as-data.** `STAGES`/`stageOfLever` → a `NAV` config + `pageOfLever`. The rail renders from
  `NAV` (nine destinations), **no ordinals** (top-to-bottom order carries the compose sequence), a
  divider before the `view` destination (Preview).
- **Focused pages.** The old *Semantic* → **Surfaces / fills** (backgrounds · text & ink · gradients)
  + **Interactive** (action colour · states · a11y). The old *Form* → **Elevation** · **Size & radius**
  (size · density · radius) · **Layout** (breakpoints + containers, promoted from Advanced on a
  dedicated page) · **Motion**. *Palettes* (was primitives), *Typography*, *Preview* carry over. Each
  page's facets are **sections within it**, not rail rows.
- **Screen scaffold.** One `renderScreen(host, key, sections, specimens)` all editing pages compose
  through (hero → sections, or the read-only note on a derived mode → the volatile contextual specimens);
  `renderAdvancedPanel` factors the per-page Advanced disclosure. `pageOfLever` routes every lever to a
  page (status hues stay inline on Palettes; the `color`/`advanced` groups split by key). The double
  section headings on Surfaces were resolved (the bespoke editors self-head "Backgrounds" / "Text & ink").

**Verification:** `tsc` + esbuild clean. A Playwright drive-through walked **all nine pages** (example
brand, 1360×1050): rail shows the nine focused labels with one divider before Preview and **no numbers**;
every page renders its hero + controls/editors + contextual specimens (asserted knob/editor/specimen
counts per page — nothing orphaned); a header mode switch on Interactive re-renders in Dark; **no console
errors**. No engine files touched. Screenshots reviewed for Surfaces / Interactive / Size & radius. This
completes the `docs/23` §7 IA; Preview's segmented sub-views + per-section contrast tables are the next
follow-up. Progress entry rides in this PR.

---

## (2026-07-20) — Dashboard Phase 3a: global header + Preview tab (`docs/23` §7)

**STATUS: web-only, visible reorg (part 1 of the Phase 3 split).** Delivers the headline of the reorg —
the overall UI preview moves to **its own destination**, and the mode selector becomes a **persistent
global-header tier** — without yet re-partitioning the editing pages (that's 3b).

- **Two-tier global header.** `build()` now wraps a sticky `.chrome`: tier 1 = the brand bar (identity +
  Export); tier 2 = the mode-context strip, promoted out of the per-stage workspace (#171) into the header
  via a new `modeStripHost` + `renderModeStrip()`. `currentMode` persists across navigation; the strip
  shows on every page (inert where mode doesn't apply). `apply`/`applyFull` refresh it so its per-mode
  contrast ✓/✗ marks track edits; the menu/mode handlers repaint the strip in place.
- **Preview is its own tab.** New `renderPreviewPage` owns the component gallery + contrast contracts
  (the `paintPreview` that used to be **duplicated at the bottom of Semantic / Typography / Form**). The
  editing stages now render **only their contextual specimens** — the 3× duplication is gone. Preview sits
  in the rail after a divider, with no ordinal (a destination, not a build step).
- Deferred to follow-ups: Preview's segmented sub-views (UI / contrast / token list) + a per-section
  contrast table; the focused-page split (3b) and rail-as-data.

**Verification:** `tsc` + esbuild clean. A Playwright drive-through (example brand, 1360×1000) screenshotted
every page + a header mode switch: two-tier header renders, rail shows the 4 numbered stages + un-numbered
Preview after a divider, the Preview page shows the full gallery, **`.pvhost` count on an editing page = 0**
(duplication removed), and switching to Dark in the header re-renders the page in dark. No console errors
(favicon 404 only). No engine files touched. Progress entry rides in this PR.

---

## (2026-07-20) — `docs/23` Phase 3 interaction model (addendum, decided)

**STATUS: docs-only.** Adds §7 to `docs/23` recording the settled Phase 3 interaction model, so the
build runs against a spec. Decisions:

- **Rail** stays a flat clickable list, just re-grouped to the §2 groups (~9 items). Each item is one
  focused page; a page's facets are **sections within the page**, not separate rail rows; long pages may
  get anchor links. **No accordion/collapse** — the catch-all stages splitting across focused pages
  already removes the long-scroll problem.
- **Global header** (the "brand bar", promoted) is **two-tier**: identity + quick Export (tier 1), the
  persistent **mode selector** (tier 2). `currentMode` is global and persists across navigation. Chips
  exposed by default; overflow → active-pinned `More ▾` menu (never scroll), **deferred** until a brand
  needs it.
- **Rail vs header rule:** canvas destination → rail (authoring pages, **Preview**, future **Output**);
  quick action/menu → header (brand, mode, **Export**). **Preview is a rail leaf** with **segmented
  sub-views** (UI / contrast / tokens) in one screen.
- **No numbering**; a section-complete ✓ is **deferred** (needs a real save/done model — a false "done"
  is worse than none). Per-mode contrast ✓/✗ on mode chips stays (accuracy ≠ completeness).
- **Output / Style guides** is Figma-only and an **active canvas write** — it draws a real style-guide
  table onto the Figma canvas with live variable values (an existing owner-built plugin to be brought in
  and finished). Split as **channel-gated** functionality (present in the plugin host, hidden in web).

Phase 3 builds **rail-as-data** + the **screen scaffold** to this spec — now with real callers, per the
Phase 2 decision that shipped the control kit first. Progress entry rides in this PR.

---

## (2026-07-20) — Dashboard control kit (foundation refactor, `docs/23` Phase 2)

**STATUS: web-only refactor, DOM-identical.** First foundation stone of the `docs/23` reorg: a small
reusable **control kit** in `web/src/main.ts`, so a control (or a whole screen in the IA split) composes
from shared primitives instead of re-deriving the same DOM. Three primitives:

- `knob(label, body, desc)` — the `div.knob` scaffold (`label.knob-label` · body · `p.knob-desc`) every
  control shares. `renderControl`, `renderPerModeSelect`, and the read-only type-scale knob now build on it.
- `knobBody(...kids)` — the `div.knob-body` input+readout row (slider / toggle).
- `optionEl(value, text, selected)` — one `<option>` builder replacing the ~9 near-identical local
  `opt`/`optE`/`mkOpt` closures + inline loops (renderControl, per-mode select, interactive card, status
  ramp, surfaces, foreground, add-accent, mode-set base select, typography family select).

Deliberately **minimal** — no rail-as-data or screen-scaffold generalisation yet; those get real callers
only when the IA actually splits (Phase 3), so building them now would be abstraction ahead of use
(root `CLAUDE.md` §3 surgical / §2 no speculative abstraction). This ships the vocabulary Phase 3 clones.

**Verification:** `tsc --noEmit` + esbuild build clean; a Playwright DOM-snapshot harness rendered the
example brand across **all 4 stages × every mode (13 snapshots)** on `origin/main` vs. this branch and
found them **byte-identical** — the refactor changes nothing visible or behavioural. Bundle shrank ~840 B
(duplication removed). No engine files touched; `out/*` untouched. Progress entry rides in this PR.

---

## (2026-07-20) — Dashboard IA + component-system plan (`docs/23`, direction)

**STATUS: docs-only.** Captures a design-session decision to reorganise the web dashboard
(`web/src`) from four broad stages into **focused, single-concern sections** with the overall UI
preview promoted to **its own Preview tab** (today `paintPreview` is duplicated on Semantic /
Typography / Form). New doc `23-dashboard-ia-and-component-system.md` pins:

- **The target IA** — grouped rail: Palettes · Surfaces (Backgrounds / Foregrounds / Text / Gradients)
  · Interactive (colours / Disabled / Focus) · Typography · Elevation · Size & radius (Size / Density /
  Radius / Border-width slot) · Layout · Motion · Preview (UI gallery / all-modes contrast table /
  token list) · Output (Figma: Style guides / Components — deferred, own discovery).
- **Two control patterns** — free-colour screens vs **derived/contrast screens** (Text/ink, Focus):
  Text ink is neutral-ramp-derived with a per-mode **neutral-step override** (never an arbitrary hex),
  kept + flagged when below ratio; Focus is derived from the action palette (independent focus lever =
  net-new, not in scope); border-width has no lever (documented slot only).
- **Facts pinned** — density scales the component-size tier only (→ lives under Size, not Layout);
  contrast anchors (`text.primary`→`background.primary` 7:1, secondary/tertiary→floor surface); the
  engine already **re-derives on every edit and preserves+flags overrides** (behaviour to surface, not
  build); per-section contrast tables are a near-free re-slice of already-authoritative data.
- **Build underneath** — introduce an internal **component system** (screen scaffold + control kit +
  rail-as-data) so the reorg is declarative config, and eventually self-theme the dashboard from Prism3
  tokens (light/dark toggle). Sequencing: this note → foundation refactor (byte-identical) → IA split +
  Preview tab → per-section contrast tables → self-theming (later).

Process note: the `#189/#192/#194` progress entries were backfilled by `#191/#193/#195`; **go-forward,
the `00-progress.md` entry rides in the feature PR** (this entry included) rather than a follow-up round-trip.

---

## (2026-07-19) — Phase D code-review fixes (engine correctness + UI)

**STATUS: MERGED** (#194). Fixes from two independent code reviews of the per-mode override arc.

**Engine (`theme.ts` / `tree.ts`).**
- **Dark-based custom modes now inherit their base's reduced dark shadow** even without a `modeLevers.shadow`
  override. Built-in `dark` gets `modes.dark` unconditionally, but a `customModes: [{base:'dark'}]` mode had
  no such default — so it fell back to the light `$value` (a light shadow under a dark surface). `brandTheme`
  now seeds a `shadowByMode` entry from the global dark layers for every dark-based custom mode lacking an
  override (byte-equal to `modes.dark`; guarded so an explicit lever still wins) → they also emit their own
  `shadow-<mode>/*` Figma effect styles. (This closes the gap noted in the #190 consolidation entry: the
  earlier claim that "dark custom modes keep their entry" only held when they carried an explicit override.)
- **`modeLevers.light` is now rejected** — light IS the global baseline for the non-colour levers, so a
  `modes.light` override would shadow the canonical `$value`. The error points to setting the global levers.
- **Line-height / letter-spacing gained the map-level no-diff suppression** every other axis already had (a
  per-mode ramp equal to the global now leaves `modeLevers` off the Theme → byte-identical).
- Cleanup: one shared `gridStepOverride` (the two grid-override helpers were byte-identical) and one
  `diffAssign` for the JSON-compare no-diff suppression across radius/family/weight/LH/LS.

**Web (`web/src/main.ts`, net −63 lines).**
- The **breakpoints editor no longer collapses the Advanced disclosure** on each edit (`draw() + apply()`
  instead of `applyFull()`, which recreated the `<details>`).
- A shadow slider dragged to **exactly the global** value now prunes the override (no redundant `== global`
  entry); a hand-authored **non-discrete** per-mode value (e.g. `radius 0.7` from import) surfaces as its own
  `"0.7 (custom)"` option instead of misreading as Auto.
- Cleanup: `renderPerModeRadius/Tempo/Density` → one `renderPerModeSelect`; the duplicated per-mode
  `modeLevers` read/write/prune → one `getModeLever` / `setModeLever` / `pruneModeLevers` trio (the UI analog
  of the engine's `diffAssign`; the recursive prune generalises the old bespoke shadow-tint clearing).

Engine tests **909 → 917** (+8: dark-shadow seeding, `modeLevers.light` rejection, LH/LS suppression); NB
regression green; **`out/*` byte-identical** (no example brand exercises a dark-based custom mode or
`modeLevers.light`); web/plugin tsc + builds clean.

---

## (2026-07-19) — lever-UI completeness + interactive-accent manifest reconcile

**STATUS: MERGED** (#192). Closes out the lever-UI-coverage audit: **every manifest lever now has a working
UI control and every axis has a live specimen.**

**Web — remaining specimens + object/list editors.** Adds a **Layout specimen** (breakpoint / column / gutter
/ margin table + base-column strip + container-cap bars, reads `theme.layout`) and a **type-variants strip**
per group (the weights it ships rendered at weight, italic/link samples when shipped, and the size range so
`titleFloor` is visible). The advanced **object/list** levers that `renderControl` could only show read-only
get bespoke editors nested in the Advanced disclosure: **Responsive type** (`typography.responsive` fluid +
min/max viewport), **Breakpoints** (editable `layout.breakpoints` min-width list, dedup+sort+floor), and
**Emphasized easing** (`motionPersonality.easingEmphasized` cubic-bezier). All three write real `BrandInput`
paths (verified flow-through to resolved output).

**Manifest — reconcile the interactive-accent surface split.** The manifest advertised `accentPalette`
(control `palette-ref`) as the interactive-accent control, but it had **no live UI**, while the more capable
`interactivePalettes` (what the interactive cards edit + the preview renders) was **absent from the manifest**
— so the control contract read by the Figma plugin + MCP pointed at the wrong, UI-less lever. Fixed: the
manifest now lists **`interactivePalettes`** (control `list`, advanced) and drops the `accentPalette` lever.
`accentPalette` **stays a valid back-compat input** — its engine field, schema, accent≠action guard, and
byte-identical-to-`interactivePalettes` test are untouched; it's simply no longer advertised as a form control
(`interactivePalettes` wins when both are set). No web double-render (`interactivePalettes` is advanced+list →
excluded from both the lean and Advanced panels; the cards remain its editor). `levers.ts` ↔
`lever-manifest.json` kept in lockstep by the byte-drift guard test.

Engine tests **909/0** (incl. `accentPalette` back-compat + manifest-drift); **`out/*` byte-identical** (no
generation change); NB regression green; DTCG 336/336 + aliases resolve; web/plugin tsc + builds clean.

---

## (2026-07-19) — Phase D: per-mode density lever + Advanced-lever disclosure

**STATUS: MERGED** (#189). Two changes closing out Phase D's non-colour axes.

**Per-mode density (engine + web).** `ModeLevers` gains `density?` — a mode may run a different
component-density tier (`compact`/`comfortable`/`spacious`), re-deriving its `size.*` control heights +
paired padding via the same `componentSizes(density, spaceBase)` the baseline uses. The dimension analog of
the tempo enum. The `space.*` reference scale is **density-free by design**, so it's untouched — only the
`size.*` tier varies. Same seam as radius: a size sub-leaf (`height` / `padding-x` / `padding-y`) whose
per-mode px differs from light carries a `$extensions.prism3.modes.<mode>` override (height aliases the
dimension grid on-grid else literal; padding aliases the space scale on-scale else literal). No-diff
suppression (`lev.density !== density`) composes with the #190 suppression on the other axes → byte-identical
when unused. Validation is engine-side (`brandTheme()` throws on an invalid density or a density on a
generate-only mode); the schema documents it. Web: a per-mode density select (Auto-follows-global, like
tempo) + a new mode-aware **Control-size specimen** so the change is visible.

**Advanced-lever disclosure (web only).** The lean-default lever panels drop every `advanced` manifest
lever, which left eight scalar/enum levers with no UI control at all (`baseMd`, `spaceBase`, `baseUnit`,
`typography.displayCeiling`, `typography.titleFloor`, `layout.columns`, `layout.containerMax`,
`layout.containerNarrow`) — reachable only by hand-editing the brand input. Added the progressive-disclosure
affordance the manifest always intended: a collapsed **"Advanced"** panel per stage rendering that stage's
advanced slider/enum levers via `renderControl` (Form gets 6, Type gets 2). The lean panel (`!l.advanced`)
and the Advanced panel (`l.advanced`) are disjoint on the same filters, so nothing double-renders. Object/
list advanced levers keep their bespoke editors.

Engine tests **897 → 909** (+12 density: seam, density-free `space.*`, validation throws, design.md
round-trip, `validateBrandInput` acceptance, no-diff suppression); NB regression green; **`out/*`
byte-identical**; DTCG 336/336 contracts + all aliases resolve; web/plugin tsc + builds clean.

---

## (2026-07-19) — Phase D consolidation: no-diff suppression across all non-colour mode levers

**STATUS: MERGED.** Follow-up to the per-mode non-colour lever arc (#177–#188). The motion **tempo** lever
(#187) already suppressed its per-mode map when a mode's value equalled the global baseline (`tempo !==
baseTempo` → no `motionByMode` entry → byte-identical output). This extends that same **no-diff suppression**
to the four axes that shipped without it — **radius (#184)**, **font families + weight-roles (#185)**, and
**shadow (#188)** — in `theme.ts`:

- **radius:** an entry is populated only when the mode's re-derived `radiusScale(value, baseMd, 128)` ramp
  differs from the global `radiusScale(rScale, …)` baseline. `radius: 1` on a scale-1 brand now emits no
  redundant per-mode `radius.<mode>.json`.
- **families / weight-roles:** populated only when the merged-then-derived stacks / weight-role numerics
  differ from the global. A mode re-declaring the global family emits no `core-font.<mode>` set; and the
  `extraWeights` union (which mints `font.weight.<num>` leaves) only takes a mode's weights when the entry is
  actually kept.
- **shadow:** a **light-appearance** mode whose re-derived ramp equals the global inherits the canonical
  `shadow/*` styles → no redundant `modes.<mode>` DTCG entry or `shadow-<mode>/*` effect-style set. **Dark-based
  custom modes always keep their entry** — the reduced dark layers are emitted no other way (there's no
  `shadow-dark` default for custom modes), so suppression is scoped to light appearance only.

Pure consolidation — no new behaviour, no schema change. **`out/*` byte-identical** (no example brand sets a
per-mode lever); engine tests **897/0**, NB regression green, DTCG **336/336** contracts + all aliases resolve
per brand. Verified by probe: a mode overriding every axis to exactly the global value now produces empty
`*ByMode` maps (byte-identical), while a genuinely divergent mode still populates all four, and a dark custom
mode keeps its shadow.

---

## (2026-07-18) — extensible interactive palettes (engine → web) + UI polish

**STATUS: MERGED** (#163 engine · #166 + #168 web · #164 + #167 polish). The interactive color model is now
**extensible and directly editable**: a brand can ship the built-in primary/neutral/destructive interactive
columns PLUS N opt-in "accent" columns, each promoting a defined palette to a full `interactive.<name>.*`
family with an optional fill step — surfaced as per-column cards on the Semantic stage (the #161 pass).

- **Engine — #163: `interactivePalettes` (generalises `accentPalette`).** `BrandInput.interactivePalettes?:
  {name?, palette, anchorStep?}[]` — each promotes a *defined palette* (primary or a brandColors name) to a
  full `interactive.<name>.*` column (fill+states / on-fill / text / border / on-inverse / overlay); `name`
  defaults to the palette, validated (slug, unique, no collision with the primary/neutral/destructive
  built-ins). Plus `actionAnchorStep?`/`destructiveAnchorStep?` — optional fill-step overrides for the
  built-ins (unset = today's placement). On-fill inks stay **auto-derived + contrast-gated**; the
  **accessibility floor wins over the step override** (a too-light pick is nudged to the darkest passing
  step). `accentPalette` kept as **byte-identical back-compat**. `docs/20` updated (§3a). *out/\* byte-identical
  (no example brand sets the new fields); engine tests + NB regression green.*
- **Web — #166 → #168: the interactive-color cards (owner reference, #161 inc 1+2).** One card per column:
  big fill swatch · palette/step picker (writes `actionAnchorStep` / `destructiveAnchorStep` /
  `interactivePalettes[i].anchorStep`) · token path · live button example (fill + on-fill) · floor-gated
  contrast badge · hover/pressed sub-cards. Plus an **"add interactive color"** promote flow (a brand color →
  a new column, with a remove ×) — reserved names filtered so the auto-name can't collide (the #168
  should-fix). Neutral is deliberately not carded (it's `neutralEmphasis`-driven). Web-only, reads the
  resolved model.
- **Model:** interactive color = **palette + step (primitives only)**, never a raw color; a bespoke action/
  accent hue is a *named brand color* the whole system aliases. This resolved the owner's "can we pick the
  interactive color?" question — palette+step, not a floating picker.
- **Polish — #164 + #167.** #164: swatches fill their container at 40×40 (native color-input inset stripped),
  darker page bg so cards read as elevated, brand-color count badge removed, section-label + label→select
  spacing, and **US English** (`colour`→`color`) across all *visible* UI text (main.ts + lever labels/
  descriptions; the token-`$description` prose that emits into out/\* is a separate deferred pass). #167:
  replaced the oversized native `<select>` caret with a small consistent chevron across every select.

**Open backlog (captured #155–#162, #165 — most polish/US-English done):** #157 validation-color borrow bugs
(could NOT reproduce on main via headless — awaiting repro), #158 primitives layout (pair the neutral cast /
brand-color cards with the palettes they drive — the cast is invisible today because its greyscale is
off-screen), #159 brand bar (horizontal, replacing the overflowing dropdown), #160 design.md import (post-setup
+ startup upload + validation/error-handling), the remaining #161 sectioning (accessibility/features controls),
and the US-English token-`$description` pass (changes out/\*, so its own PR). **Next up: docs sweep (this), then #158.**

---

## (2026-07-17) — web UI reaches feature-complete: refinement pass, first-run, typography B, icons

**STATUS: MERGED** (#142, #145, #147, #149, #150, #152, #153). The web dashboard is now demo-ready and
feature-complete bar deploy — every lever is editable AND has a live preview, a real first-run experience,
and the typography editor is done. All in shared `web/src`, so the plugin iframe inherits it post-#110.

- **UI refinement pass (polish + light restructure).** #142 collapsed the full all-modes contrast table
  (which repeated on every stage) into a closed disclosure — the per-component badges stay as the
  point-of-edit check, and each lower stage dropped ~25%. #145 added an **animated motion specimen** on the
  Form stage (the semantic transitions fill at their resolved duration + easing; plays on tempo change,
  Replay button, `prefers-reduced-motion` honoured) — resolving the motion half of #114 (a static preview
  couldn't show the tempo lever's effect). #147 grouped shadow softness + tint under one **Shadow** heading.
- **First-run / default-state (#149 + #150).** The silent-demo boot was the bug hiding inside "what's the
  default state?". #149 added **localStorage persistence** — a thin `web/src/persist-local.ts` port over the
  pure `persist-input.ts` core (#131), so web remembers the working brand across reloads (plugin still uses
  Figma shared-data; the path is web-gated via `PRISM3_HOST`). #150 added the **start screen**: on a true
  first run (nothing persisted) the app shows a start moment — start from your colour (one primary bootstraps
  a full theme via `seedFromColor`), a neutral default, or explore an example — instead of the demo. Examples
  reframed as examples; "+ New brand" re-invokes it (web only). Plugin fresh-file start moment deferred.
- **#99 closed — icon specimen (#152).** The final #99 axis: a Kind-B icon specimen (on surface + reversed on
  fill, dependency-free inline SVG) so the `iconContrast` floor lever has a live payoff. All 7 per-axis
  specimens now shipped.
- **#103 closed — typography editor complete.** Phase A (#137/#139: font pool + weight-role map + per-category
  table) + **Phase B (#153): advisory weight availability** — a curated `KNOWN_WEIGHTS` map mutes/flags (⚠)
  weight roles a category's family likely doesn't ship, refreshed live on font/weight/family edits. Advisory
  per the #113 model (never a hard gate; unknown fonts never false-flagged).

**Gates across the arc: web tsc + build clean each PR; plugin both-context build clean where shared `web/src`
changed (0 `node:` builtins, web-only paths runtime-inert in the plugin); no engine/token/`out` change on any
(all reuse the read-model / pure persist core). Each verified live headless (Playwright).**

**Open (web):** a direct **interactive-colour** affordance — action colour is a `palette-ref` (`actionPalette`
→ primary or a named brand colour), so a bespoke action hue today needs the two-step add-brand-colour →
repoint; a picker that creates/updates a brand colour under the hood would close the gap without breaking the
named-palette model (owner deciding). Also: the "set your brand colour" provenance nudge for untitled brands;
#104 static-site deploy (owner not ready). **Cross-lane:** plugin fresh-file start moment; the
`brand-skills` extraction → `BrandInput` as a fourth start path; #111 components-as-data.

---

## (2026-07-17) — shadow/gradient: plugin write scope reaches Figma Styles

**STATUS: MERGED (#151).** The #146 follow-up, and the last write
axis before typography. Shadow + gradient are Figma **Styles** (Effect + Paint), not variables — a
different API (`createEffectStyle`/`createPaintStyle`) — which is why they were carved out of #146.
This lane adds them, so an apply now writes colour + FLOAT vars + shadow/gradient styles. Only
typography remains (its own Styles-based lane, blocked on #112/#113).

- **Node-free extraction — `engine/emit-figma-styles.ts`** (new): `buildFigmaShadow` (→ Effect Styles)
  + `buildFigmaGradient` (→ Paint Styles) + their types/helpers moved out of the I/O-shell
  `emit-figma.ts`, which re-exports them (same pattern as color/dims). `out/*` byte-identical.
- **Pure plan — `write-plan.ts` `buildStylesPlan(theme)`**: reshapes both builders into a
  `StylesPlan` (`effects: EffectStyleRow[]` + `paints: PaintStyleRow[]`). Shadow → BOTH sets
  (`shadow/*` light + `shadow-dark/*` dark, verbatim — Effect Styles can't hold modes). Gradient
  stops → **BAKED resolved RGBA** (owner decision; variable-linked stops are a fast-follow), and the
  emit's `angle`/`center` → Figma's 2×3 `gradientTransform` via a new `gradientTransformFor` helper
  (the one bit of new math: 0°=identity horizontal, rotates about centre).
- **Styles executor — `plugin/src/write-styles.ts`** (new, the FIRST non-variable write): a minimal
  `StylesApi` port (`createEffectStyle`/`createPaintStyle` + the two getters); `applyStylesPlan` does
  idempotent find-by-name → reuse+overwrite, else create. Runs after the FLOAT write in `main.ts`;
  summary widens (`…styles N effects (+M) / K gradients (+L)`).
- **Read-back (light) — `read-figma.ts` + `read-back.ts`**: reads local style NAMES into the snapshot
  (`styles?` field, optional styles-API arg) + a name-level `verifyStylesReadback` (light shadow set
  present, dark set iff brand ships dark, gradients iff brand opts in).

- **Review fix (parity):** the gradient angle is the SAME CSS `linear-gradient(<deg>)` angle the web
  renderer uses, so the two surfaces must agree. The first cut rotated by `angleDeg` directly (0°=
  horizontal), which was 90°-off + endpoint-swapped vs. CSS (0°=to-top). Fixed: `gradientTransformFor`
  now uses `φ = 90 − angleDeg`. Verified LIVE that CSS 90° renders red→blue L→R in Figma (the
  asymmetric check a symmetric 135° render can't distinguish), and 135° puts the start stop top-left as
  CSS does. The `gradientTransformFor` unit cases now encode the CSS convention.

**Gates: engine 767→776 (styles-plan + transform cases); `out/*` byte-identical; plugin two-context
typecheck clean; plugin `npm test` write+read+persist+float+**styles** all green; web tsc+build clean;
`dist/main.js` 0 `node:` builtins. LIVE-DRIVEN via the Desktop Bridge: created Effect Styles
(`shadow/*` + `shadow-dark/*`, multi-layer, DROP/INNER) + Paint Styles (linear + radial gradients);
applied `gradient/brand` + `shadow/md` to a rect and screenshotted — gradient + shadow render correctly
and the angle matches the web preview (CSS 90° → red-left/blue-right); re-apply idempotent (+0, no
duplicate styles); scratch styles + probe rects cleaned up.** Out of scope: typography (#112/#113);
variable-linked gradient stops (fast-follow).

---

## (2026-07-17) — #146: plugin write scope expands to the FLOAT-variable axes

**STATUS: MERGED (#148).** The plugin's live write adapter (#108)
materialised **colour only**. Verified live it still did: an apply wrote `core-palette` + `color` but
nothing geometric. #146 extends the write path to the **FLOAT-variable axes** — `core-dimension`,
`space`, `radius`, `size`, `border-width`, `focus`, `opacity`, and `layout` — so an apply now
materialises the dimensional layer too. Out of scope (own follow-ups): typography + shadow/gradient,
which are Figma *Styles* (a different API), and typography is decision-blocked on #112/#113.

- **Node-free extraction — `engine/emit-figma-dims.ts`** (new): `buildFigmaDims` + `buildFigmaLayout`
  (+ `pxFromValue`/`aliasFigName`/scope maps/`LAYOUT_MODES`/`FigmaDimsCollections`) moved out of the
  I/O-shell `emit-figma.ts`, which now re-exports them — the SAME pattern as `emit-figma-color.ts`.
  Pure functions of `Theme`; **`out/*` byte-identical** after regen (behaviour-preserving).
- **Pure plan — `engine/write-plan.ts` `buildFloatWritePlan(theme)`**: reshapes both builders into a
  uniform `FloatCollectionPlan[]` (create-all-then-alias, one target per mode — the same collapse-safe
  shape as the colour plan). Single-mode dims axes; `radius` 1–2 modes (Default [+ wireframe]); `layout`
  one mode per breakpoint the brand ships.
- **Executor — `plugin/src/write-figma.ts` `applyFloatPlan`**: widened `VariablesApi` (`createVariable`
  `'COLOR' | 'FLOAT'`, `setValueForMode` accepts `number`); two passes generalised over N collections,
  binding aliases against ONE global name map (cross-collection: space→dimension, size→dimension/space,
  radius→dimension, layout grid→space). Idempotent find-by-name. Runs after the colour write in
  `main.ts`; the `apply-result` summary widens (`…dims/layout N collections (+M), K aliases bound`).
- **Read-back (light) — `read-figma.ts` + `read-back.ts`**: reads the FLOAT collections into the
  snapshot (`float?` field, keeps colour-only reads valid) + a modest `verifyFloatReadback` (collections
  present, aliases resolve, dimensions hidden, radius wireframe-mode iff opted in). `ReadValue` widened
  with `number`; `isAlias` hardened for primitives.

- **Review fix (critical):** `getLocalVariablesAsync('COLOR')` returns ONLY COLOR vars — using it for the
  FLOAT idempotency map (`upsertCollection`) + the FLOAT read-back would have made re-apply DUPLICATE every
  FLOAT var and the read-back come back EMPTY. The in-memory shims hid it (they ignored the `type` arg).
  Fixed: both sites fetch UNFILTERED (`getLocalVariablesAsync()`, still scoped by `variableCollectionId`);
  the three test shims now HONOR the type filter so the regression can't hide again.

**Gates: engine 754→767 (float-plan + verify cases); `out/*` byte-identical; plugin two-context
typecheck clean; plugin `npm test` write+read+persist+**float** all green; web tsc+build clean;
`dist/main.js` 0 `node:` builtins. LIVE-DRIVEN via the Desktop Bridge with the REAL semantics: wrote the
FLOAT collections, re-ran → second run created +0 (idempotent, no duplicate vars), unfiltered read saw the
FLOAT vars while a `'COLOR'`-filtered read did NOT (confirming the bug + fix), cross-collection aliases
resolve (space→dimension, grid→space); scratch file cleaned up after.** Out of scope: typography
(#112/#113), shadow/gradient Styles — own issues.

---

## (2026-07-17) — editor lane completes: typography editor + holistic radius + object-value editors (#102, #103 A, #97)

**STATUS: MERGED** (#102 → #136, #103 A1 → #137, #103 A2 → #139, #97 → #140). The web dashboard now has
**no read-only levers left** — every knob in the manifest is editable, and (all in shared `web/src`) the
plugin iframe inherits every one of these post-#110.

- **#102 — holistic radius specimen (Form stage).** A dedicated `renderRadiusSpecimen` reading `rp.dims`
  across the radius steps (none/sm/md/lg/round) on representative component sizes, so the "Corner softness"
  slider has a visible payoff beyond the single component chip. (The slider is a 0–2 softness dial, not an
  enum — the specimen shows the ramp it reshapes.)
- **#103 — typography editor, Phase A (A1 + A2).** The type model is now fully editable on the settled
  engine (post-#105). **A1:** the font *pool* (three family roles → editable primary faces, single name
  auto-pads the fallback stack) + the global weight-role→numeric map (`subtle/default/emphasis/strong/max`).
  **A2:** the per-category assignment table — for each of the 7 groups (display/title/body/label/caption/
  eyebrow/code): family role · which weight-roles ship · italic · link. List writes read LIVE checkbox
  state (never a captured snapshot), so successive toggles stay staleness-free. Writes only existing
  `TypographyInput` fields → no `PERSIST_VERSION` bump. **Phase B (availability-aware weight pickers) is
  parked on #113** (font availability/resolution research).
- **#97 — object-value editors.** `renderControl` could only show `object` levers read-only as "configured".
  Bespoke sub-forms now edit the two that were still stuck: **page surfaces** (`surfaces.<mode>.{base,
  floorStep}` — white/black/neutral-step ground + optional contrast floor, on the Semantic stage) and
  **shadow tint** (`shadow.tint.{hue,amount}` hue-shifting the shadow base off pure black, on the Form
  stage). The third object lever (`typography.families`) is covered by the #103 editor. Each reads
  brandState (falling back to the engine default), writes via `setPath`, re-resolves.

**Gates across the three PRs: web tsc + build clean each time; 0 `node:` builtins; no engine/token/`out`
change (all reuse the read-model). Each verified live headless (Playwright): the typography table renders
7 category rows with family selects + weight/italic/link checkboxes matching resolved state; the surfaces
editor moves the preview ground; the shadow-tint sliders recolour the elevation ramp.**

**Open editor backlog:** #99 icon row (needs icon rendering in the preview — the one remaining #99 specimen;
the other six shipped in the sweep), #103 Phase B (blocked on #113), #104 static-site deploy (platform TBD —
owner not ready). **Decisions pending:** #113 (font availability — gates Phase B), #114 (gradients + motion
tab placement). **Plugin/MCP lane:** #111 (build Prism3 components in Figma from ComponentDefs via MCP) is
the next unstarted spike; the plugin itself is functionally complete through #110 + persist (#131/#138).

---

## (2026-07-17) — #131: persist `BrandInput` in shared-data → true knob round-trip

**STATUS: MERGED (#138).** The #110 follow-up, and the last open
plugin phase. #110's boot seed was *informational only* — a `ReadbackSnapshot` is resolved colour
values, so the `BrandInput` knobs can't be reverse-engineered from it; re-opening a themed file always
reset the UI to the default `aurora`. #131 closes the loop: the plugin now persists the exact
`BrandInput` alongside the variables it writes, and rehydrates the UI from it on boot.

- **Pure core — `engine/persist-input.ts`** (node-free, engine-tested): `PERSIST_VERSION = 1`,
  `serializeBrandInput` → `{ v, input }` JSON, `deserializeBrandInput` → the input or **`null`** on
  parse error / version drift / missing input. `null` is the single "start from defaults" signal, so
  absence and drift are indistinguishable to the caller (both → the unthemed path).
- **Plugin port — `plugin/src/persist-figma.ts`** (main-thread, shim-testable): a minimal
  `SharedDataPort` (`get/setSharedPluginData`) that `figma.root` structurally satisfies; `persistInput`
  / `restoreInput` under namespace `prism3` / key `brandInput`. Same pure-core-behind-thin-port split as
  `write-plan.ts`←`write-figma.ts`.
- **Wiring:** `plugin/src/main.ts` calls `persistInput(figma.root, input)` after a successful
  `applyWritePlan`, and `restoreToUi()` on `ui-ready` (independent of the #109 seed). New `restore-input`
  message on the `MainToUi` union; `web/src/write-adapter.ts` widens `HostCommit.onHostMessage` to carry
  it; the shared UI handles it via the existing `loadBrand` (wholesale replace + rebuild).
- **Restore repopulates KNOBS ONLY** — it does not re-write `figma.variables` (they already live in the
  file; auto-writing on boot would be redundant/surprising).

**Gates: engine 745→752 (7 persist cases — round-trip + garbage/drift/absence → null); plugin
typecheck clean (two-context split holds); plugin `npm test` write+read+persist green; web tsc+build
clean; `plugin/dist/main.js` 0 `node:` builtins. LIVE-DRIVEN against real `figma.root` shared-data via
the Desktop Bridge: unset key → `''`, persist→restore exact, v-drift + corrupt blob → null, scratch file
left untouched (the one thing the in-memory shim can't prove).** Out of scope: schema-v2 migration
(a future `PERSIST_VERSION` bump); pre-#131 files (none exist).

---

## (2026-07-17) — editor lane sweep: the web dashboard becomes demonstrative (#96–#101)

**STATUS: MERGED** (#96, #98, #99×5 slices, #100, #101; the `#122` type nit). Batched here because these
web-lane entries were deliberately deferred while the plugin lane held the shared log — now captured. The
dashboard went from a mostly read-only preview to genuinely *showing what each control does*, and — since
it's all in the shared `web/src` — **the plugin iframe inherits every one of these post-#110**.

- **#96 — controls live + toggle renderer.** Liveness is now by control TYPE (`slider/enum/palette-ref/toggle`),
  not a 3-key allowlist; added the missing `toggle` renderer. Every atomic lever now edits `brandState` and
  re-runs the engine (a bad value surfaces the error bar, never crashes). Object/list editors stay for #97.
- **#98 — box-shadow in the preview + `shadows` in the read-model.** `ResolvedPreview` gains `shadows`
  (`resolve-preview.ts`): each shadow → a per-mode CSS `box-shadow` string, dark = the reduced lift-primary
  override, folded through the write-adapter seam. Done via the seam so the plugin inherits shadow rendering.
- **#99 — per-axis specimens (5 slices).** Elevation ramp (Form) + on Semantic: outline hover/pressed,
  inverse hero band, neutral subtle-vs-strong comparison, gradient swatches. **A/B split (owner-approved):**
  genuine *missing preview states* (outline hover/pressed) went into the shared `previewSpec` (contrast-gated,
  plugin inherits); *axis-isolating comparisons* (inverse/neutral/gradient) are dashboard-only Kind-B specimens
  reading `resolveAllModes`/`theme` directly. The icon row is deferred (needs icon rendering).
- **FOUNDATIONAL (in #99 2a) — translucent roles now render.** Overlay washes resolved to their OPAQUE base
  hex (the wash alpha was computed for the contrast gate but never stored), so *any* translucent role rendered
  solid black. Fix: `modes.ts` records `alpha` on the overlay roles (additive, optional — `hex` unchanged, so
  contracts still gate on the opaque base); `resolve-preview` folds `hex+alpha` into an 8-digit hex for
  `colors`. Unblocks overlays, the inverse band, and any future translucent role. **`out/*` untouched — alpha
  stays in the read-model/contrast path, never the emitted DTCG.**
- **#100 — contrast-at-point-of-edit.** Per-component contrast badges (active mode) + token-path pills under
  each preview component. The badge ratio is DERIVED/gated at the core (not hand-typed — the design-review
  divergence: borrow the v2-plugin presentation, keep our derivation). Full all-modes table stays below.
- **#101 — Semantic tab regrouped** into Interactive colour / Accessibility policy (disabled floor nested under
  strategy) / Features; stale "override status hues" lede fixed (that moved to the Primitives per-ramp control).
- **`#122` nit cleared** (landed with #130): `gradients?: true | GradientInput[]` → `boolean | GradientInput[]`,
  so a UI toggle's `false` is type-honest (already schema-aligned + runtime-safe; no output change).

**Gates across the sweep: engine tests grew 723→745 (specimen + alpha + ramp assertions), nb-regression exit 0,
DTCG 336/336 per brand, `out/*` byte-identical on every web PR (all reuse the read-model — no emitted-token
change), web tsc + build clean each time. Each slice verified live headless (Playwright).**

**Open editor backlog:** #102 (holistic radius view), #103 (typography editor — unblocked by #105), #104
(static-site deploy — platform TBD), #97 (object-value editors), #99 icon row. **Cross-lane follow-up owed:**
persist a *versioned* `BrandInput` in Figma shared-data for true knob round-trip (generation is lossy — #109's
snapshot can't rehydrate knobs; engine-lane owns the version contract).

---

## (2026-07-17) — #110: one build, two outputs (shared `web/src` UI → plugin iframe)

**STATUS: MERGED (#132).** Phase 5, the CAPSTONE of the plugin lane and
the proof of its thesis: **one UI, one engine, no fork.** The plugin iframe now runs the SAME
`web/src/main.ts` the standalone web app does — not a second UI. Only the write adapter + manifest
differ per host, selected at BUILD time.

- **Host selection is a build-time constant.** New `PRISM3_HOST` (`web/src/prism3-host.d.ts`, esbuild
  `--define`); `makeWriteHost` returns `cssVarAdapter` for BOTH hosts (the iframe is a full DOM context,
  so the preview paints CSS vars identically). What differs is the COMMIT seam (`hostCommit` in
  `write-adapter.ts`): web → the export bar (download design.md / tokens.json); figma → `figmaCommit`
  posts the live `BrandInput` to the main thread. esbuild dead-code-eliminates the unused branch (web
  bundle: 0 `parent.postMessage`; plugin bundle: bridge present).
- **`plugin/build.mjs`** now bundles `../web/src/main.ts` (host=figma) into `dist/ui.html`, retiring the
  placeholder (deleted `plugin/src/ui/ui.ts` + `bridge-ui.ts`). `tsconfig.ui.json` repointed at the shared
  UI — so the no-plugin-typings DOM-clean check runs on what's actually bundled.
- **Write path reuses #108 verbatim** — only the theme SOURCE changed (bundled NB → the live UI knobs):
  `apply-theme` now carries a `BrandInput`; `main.ts` runs `buildWritePlan(buildFigmaColor(brandTheme(input)))`
  → `applyWritePlan`. On boot it runs #109 read-back → an informational `seed-info` panel.
- **Read-SEED is informational only (deferred).** A `ReadbackSnapshot` is resolved values; the knobs
  (`BrandInput`) can't be reverse-engineered from it, so full rehydration needs `BrandInput` persisted in
  Figma shared-data — filed as a follow-up. #110 reports the existing theme's contract, doesn't repopulate.

**Gates: engine 745/745 (untouched); web tsc+build clean, cssVarAdapter only (bundle has 0 bridge refs);
plugin both-context tsc clean, build inlines the SHARED UI into `dist/ui.html` (0 `node:` builtins,
figma bridge present); `npm test` write+read shims green. Validated LIVE: served `dist/ui.html` in a
headless browser — the full Theme studio renders from the plugin bundle (4-stage nav, generated aurora
ramps, knobs), and the brand menu shows the "↳ Apply to Figma variables" commit action that appears
ONLY in the figma build (screenshot `110-shared-ui-in-plugin.png`). The write/read executors themselves
were proven live against a real document in #108/#109; #110 changed only the theme source.**

---

## (2026-07-17) — #109: plugin read-back (`getLocalVariablesAsync` → snapshot + verify)

**STATUS: merged (#127, `e179324`)** — Phase 4 of docs/22, the read leg complementing
#108's write leg. The plugin now READS the current file's colour variables back into host-neutral
plain data and verifies the materialisation contract live — the same checks the `materialise-to-figma`
`verifyPass` string-emitter has always encoded, now a live executor + a pure verify.

- **`engine/read-back.ts`** (NEW, pure/node-free) — `ReadbackSnapshot` (plain-data mirror: collections
  + palette rows + colour roles whose per-mode value is the alias TARGET NAME or a literal) +
  `verifyReadback(snapshot)`. Ports the verify contract: `modesDistinct` (background/primary distinct
  per mode — the collapse-guard), `aliasesResolve`, slot `scopes`, `fieldFamilyPresent`,
  `retiredRolesAbsent`, `renamedRolesAbsent`, `bareDangerPresent`, `primitivesHidden`. The snapshot is
  what #110's UI will consume to SEED itself from an existing themed file.
- **`plugin/src/read-figma.ts`** (NEW) — `readFigmaVariables(figma.variables)`, the inverse of
  `applyWritePlan`: reads `core-palette` + `color` via the async getters, resolves each alias to its
  target var NAME (id→name map). Shares the `VariablesApi` port with the write executor (widened with a
  `ReadVarValue` superset of Figma's `VariableValue` + a `valuesByMode` field, so `figma.variables`
  still structurally satisfies it).
- **Bridge + trigger** — `read-theme` / `read-result` variants; a "Read current file" placeholder-UI
  button. The full snapshot stays main-side until #110 hands it up to seed the UI.

**Gates: engine 742/742 (735 + 7 new `verifyReadback` tests incl. a NEGATIVE collapse test — a
snapshot with background/primary collapsed to one target per mode fails `modesDistinct`); the read-back
round-trip harness (`plugin/test-readback.ts`, `npm test`) drives write→read→verify on the shim — 122/122
palette + 123/123 colour round-trip, 492 alias targets matched, contract `ok:true`; both plugin contexts
`tsc` clean; build 0 `node:` builtins. Validated LIVE in Figma via the Desktop Bridge: read the doc #108
wrote → verify `ok:true` (8/8 checks). En route it EARNED ITS KEEP — the first live read flagged a real
stale `color/field/border` (a pre-#86 flat leaf the idempotent writer correctly left untouched), exactly
the drift the verify contract exists to catch; removing it → clean pass.**

---

## (2026-07-16) — #108: plugin main-thread write adapter (live `figma.variables`)

**STATUS: merged (#125, `59f7ef4`)** — Phase 3 of docs/22. The plugin now WRITES: same
pure colour-materialisation core the CLI paste-path uses, driven by a real executor against
`figma.variables.*` on the main thread instead of emitting plugin-JS strings. Colour only
(`core-palette` + `color`), matching `materialise-to-figma` today. API re-verified current against live
Figma docs (Context7 `/websites/developers_figma`) before building — no drift from docs/18 §3.

- **`WritePlan` — the host-neutral write contract** (`engine/write-plan.ts`, pure/node-free).
  `buildWritePlan({palette, color})` reshapes the already-resolved `buildFigmaColor` collections into the
  three passes as DATA: palette rows (scopes + literal RGBA + hidden), colour create-rows (one literal
  value per mode), colour alias-rows (**one target per mode** — the collapse-guard). It is the SINGLE
  source of truth both write paths consume, so they can't drift.
- **`materialise-to-figma.ts` routed through it.** The disk-read shell + the four CLI string passes +
  `aliasRows` all now project `buildWritePlan(collections)` instead of re-deriving rows inline. All four
  CLI passes verified **byte-identical** to pre-refactor; the `aliasRows` collapse-guard tests stay green.
- **The live executor** (`plugin/src/write-figma.ts`): `applyWritePlan(plan, figma.variables)`, async,
  **idempotent** (find-by-name → update in place via `getLocalVariablesAsync` /
  `getLocalVariableCollectionsAsync` — the async getters required under `documentAccess:"dynamic-page"`).
  Three passes: palette (Default mode, hidden primitives) → colour create (rename mode[0] + addMode the
  rest; literal per-mode fallbacks) → colour aliases (per-mode `createVariableAlias`, targets resolved
  across BOTH collections). Depends only on a minimal `VariablesApi` port, so it's unit-testable with an
  in-memory shim.
- **Node-free extraction** (the flagged risk, resolved). `buildFigmaColor` + the shared pure helpers
  (`figName`/`parseColor`/`desc`/`leaves`/`stripNs`) + the Figma var types moved to a new node-free
  **`engine/emit-figma-color.ts`**; `emit-figma.ts` re-exports them (every existing importer + the
  documented CLI unchanged, output byte-identical). Lets the plugin bundle `buildFigmaColor` with **zero
  `node:` builtins** in `dist/main.js`. The theme is the bundled NB fixture: `nbThemeFrom(nbMeasured)`
  (JSON inlined by esbuild) — #110 swaps that one call for the shared UI's live knobs.
- **Bridge + trigger:** two message variants (`apply-theme` / `apply-result`); a placeholder-UI button
  fires the write (whole UI is still #110's to replace).

**Gates: engine 735/735 (728 + 7 new `buildWritePlan` tests incl. the plan-level collapse probe); all
four materialise CLI passes byte-identical + `emit-figma` output unchanged (NB regression intact); both
plugin contexts `tsc` clean; build emits main.js + inlined ui.html with 0 `node:` builtins; the executor
harness (`plugin/test-write.ts`, in-memory `figma.variables` shim) drives `applyWritePlan` twice — 245
vars stable (idempotent), 492/492 aliases bound, 0 misses, primitives hidden+scoped, background/primary
distinct per mode. Live-in-Figma validation via the Desktop Bridge is the one manual step (see PR).**

---

## (2026-07-16) — #107: Figma plugin scaffold (two-context split + typed bridge)

**STATUS: merged (#120, `0c5442b`)** — Phase 2 of docs/22. Vanilla scaffold under a new **`plugin/`** workspace
(`@prism3/plugin`); no `figma.variables` writes yet (that's #108) and the placeholder iframe UI is what
#110 swaps for the shared `web/src`. Manifest verified against the current Figma plugin docs (2026-07,
via Context7) — no drift from the docs/18 §2 grounding.

- **The two contexts are split by TYPE, not convention** (docs/18 §1): `tsconfig.main.json` gives the
  main thread `@figma/plugin-typings` but **no `dom` lib**; `tsconfig.ui.json` gives the iframe DOM but
  **no plugin-typings**. Proven load-bearing — a `document` ref in `main.ts` fails **TS2584** and a
  `figma.*` ref in `ui.ts` fails **TS2304**. `src/figma-env.d.ts` declares the `__html__` sandbox global.
- **Typed postMessage bridge.** `src/messages.ts` is the pure shared wire contract — two discriminated
  unions (`UiToMain` / `MainToUi`) + an `assertNever` exhaustiveness guard, compiling under both tsconfigs.
  `bridge-main.ts` / `bridge-ui.ts` are thin typed wrappers over the raw channel; the skill's React
  `usePluginMessage` hook is adapted to a vanilla `addEventListener` wrapper (returns an unsubscribe), per
  docs/22 §3.
- **Manifest:** `documentAccess: "dynamic-page"`, `networkAccess.allowedDomains: ["none"]` (engine bundled,
  zero runtime network — a real trust win), `editorType: ["figma"]`, `api: "1.0.0"`.
- **Build (`build.mjs`, esbuild):** `main.ts → dist/main.js` (iife); `ui/ui.ts` bundled and **inlined into
  a single `dist/ui.html`** (a plugin iframe has no server to fetch a separate JS from, and we ship
  no-network). `dist/` is gitignored alongside `web/dist/`.

**Gates: both plugin contexts `tsc` clean; split-enforcement proven (TS2584 / TS2304 on deliberate
violations); build emits main.js + inlined ui.html; a Node harness stubbing the two contexts drove the
real bundled bridge end-to-end — `ui-ready → main-ready` handshake + `ping → main-pong` nonce match both
PASS. Web tsc clean + engine 723/723 (both untouched).**

---

## (2026-07-16) — #106: write-adapter seam (`apply(model)`)

**STATUS: merged (#119, `37a485b`)** — landed on fresh `main` (`264f579`); Phase 1 of docs/22 complete.
The single-UI prerequisite: the shared UI reused verbatim in the Figma plugin iframe hinges on a swappable
**write surface**, so the UI computes a resolved token model and hands it to **one `apply(model)` interface**,
implemented per host.

- **`WriteAdapter` contract** (`web/src/write-adapter.ts`): `apply(model: ResolvedPreview, mode)`. The model is
  reused as-is — no new engine type. Two implementations: **`cssVarAdapter`** (web → sets CSS custom properties
  on a scope element from `model.colors[ref][mode]` / `model.dims` incl. per-mode overrides / `model.type`),
  and **`figmaVarAdapter`** — a **stub** with the same signature that no-ops with a `console.warn` until the
  plugin phase, proving the interface is host-swappable today.
- **The load-bearing rule:** the UI **references tokens by `var(--…)` name and never writes resolved values**.
  `renderChip` + the page background assign `var(--…, <resolved fallback>)`; the active host fills the vars in.
  Shared `cssVarName`/`typeVar` name helpers keep the setter and the references from drifting. The host is
  re-scoped to the **fresh** preview surface each paint, so a mode switch can't leak stale vars.
- **Scope (deliberately tight):** token-valued writes only (chip `bg/fg/border/radius/pad/type` + surface bg).
  Pure-layout inline styles (picker show/hide, brand-menu dots, ramp swatch fills) are not tokens — left as-is.

**Gates: engine 723/723 (untouched); web tsc + build clean; 0 `node:` builtins in the bundle; drove the dev
server — 65 adapter-set CSS vars on the surface, Light→Dark repaint with no leakage, live action-palette edit
re-projects through the adapter.**

---

## (2026-07-16) — #105.3: single-family `$value` + `fallbackStack` extension

**STATUS: MERGED (#118)** — re-landed on fresh `main` after #117/#105.2 merged (`c22f22e`), so the
merge-base is linear and the golden movement was re-verified on the clean base. Third and final brick of #105.

- **Family primitive `$value` is now the SINGLE brand family** (`stack[0]`, a string) — the DTCG- and
  round-trippable form Token Press / Figma consume directly, instead of the baked `string[]` fallback
  stack. (`tree.ts` `fontFamilyLeaf`.)
- **The curated fallback stack moved to `$extensions.prism3.fallbackStack`** (the tail after the primary).
  A consumer reassembles the CSS `font-family` value as `[$value, ...fallbackStack]` — a Style Dictionary
  consumption transform (TP ships the shorthand in its SD starter; **the engine's half is the extension +
  the documented reassembly rule**). The engine applies the same reassembly itself in two places so nothing
  downstream regressed: `familyOf` (the resolved-preview font-family — byte-identical) and the Figma family
  emit (variable value = primary, description = the full reassembled stack — NB fixture byte-identical).
- **⚠️ Token-shape change:** this drops the `string[]` stack from every family primitive's `$value`. The
  `out/*.tokens.json` family leaves move (array → string + `fallbackStack`); **no Figma output moved** and
  no fixture moved (reconstruction keeps them stable).

**Gates: test 723/723, nb-regression exit 0, emit-dtcg all aliases resolve + 336/336 contracts per brand,
emit-figma (byte-identical) + web tsc clean; out/* regenerated.**

**Open cross-lane loop (before finalizing #105):** confirm the engine's canonical forward-emit weight
spellings resolve in TP's `FONT_WEIGHT_MAP` (100 Thin · 200 ExtraLight · 300 Light · 400 Regular · 500
Medium · 600 Semi Bold · 700 Bold · 800 ExtraBold · 900 Black; italic → `<Weight> Italic`, 400→`Italic`).
To be posted on #105 for the TP agent.

---

## (2026-07-16) — #105.2: italic axis (weight-paired modifier)

**STATUS: MERGED (#117)** — built on branch `claude/prism3-e2e-integration-8fwul4` (fresh from `main`, post-#116).
Second brick of #105; the DTCG encoding is the one Token Press locked on #115 (closed).

- **Italic modelled as an orthogonal modifier PAIRED with each weight** (`strong` + `strong-italic`),
  not a weight role. It's a hyphenated suffix on the weight, in a fixed order
  `type.<group>.<size>.<weight>[-italic][-link]`, so italic and link cross cleanly (a role that ships
  both gets bare / italic / link / italic-link). (`theme.ts` `buildComposites`.)
- **Emits `fontStyle: 'italic'` on the composite `$value`** — off-core-DTCG but the shared Token-Press
  contract (#115). Omitted when normal. (`tree.ts`.) The Figma text style names the italic named-instance:
  `fontStyleName(role, numeric, italic)` → `Bold Italic`, and `400 → Italic` (not `Regular Italic`) per
  Figma's convention. (`emit-figma.ts`.)
- **Opt-in per role via `typography.italics`** (parallel to `links`), **default `[]`.** Italics are a
  deliberate brand choice, so default output ships **zero** italic composites — goldens stay byte-identical
  (same lean-default discipline as `max`). Surfaces: `levers.ts` (`typography.italics`), `theme-schema.json`,
  `ai-metadata.ts` (fontStyle in `resolves_to`).

**out/* impact:** the only default-output change is the reworded per-composite `fontStyle` note in
`$extensions.prism3.figma.note` (36 lines in NB — metadata text, no value/structure change). Italic
composites appear only when a brand opts in. End-to-end verified: a `italics:['body'],links:['body']` brand
emits the full 8-way `body.md.*` cross with correct Figma style names.

**Gates: test 717/717, nb-regression exit 0, emit-dtcg all aliases resolve + 336/336 contracts per brand,
emit-figma + web tsc clean; lever-manifest.json + out/* regenerated.**

---

## (2026-07-16) — #105.1: extensible weight-role set + `max`

**STATUS: MERGED (#116)** — built on branch `claude/prism3-e2e-integration-8fwul4` (fresh from `main`, post-#95).
First brick of the #105 typography type-model expansion; self-contained, no Token-Press round needed.

- **Data-driven role set.** The four hardcoded weight-role names became one ordered canonical array
  `WEIGHT_ROLE_ORDER` (lightest→heaviest); `WeightRoleName` now *derives* from it (`typeof […][number]`),
  the defaults map keys off it, and the build emits one `font.weight-role.*` primitive per entry. Adding a
  role later is a one-line array edit + a default value — no consumer hardcodes the old four names
  (`tree`/`emit-figma`/`emit-dtcg`/`ai-metadata`/`test` all already iterate the array). (`theme.ts`.)
- **`max` added (default 900).** The canonical heaviest slot — a black/display hero weight brands bind to.
  It stays **defined-but-unused by default categories** (exactly like `subtle`), so default output is
  byte-identical bar one additive `font/weight-role/max` primitive; a brand opts in via
  `weights: { display: ['strong','max'] }`. Owner-requested (the "optional 5th — Max" decision on #105).
- **Surfaces updated:** `theme-schema.json` (weightRoles + per-role `weights` enums gain `max`),
  `levers.ts` description, the NB figma fixture (`font.json` → 39 vars / 5 weight-roles), docs/10 table.

**Gates: test 707/707, nb-regression exit 0, emit-dtcg 753/753 aliases + 336/336 contracts per brand,
emit-figma (font 39) + web tsc clean; lever-manifest.json + out/* regenerated.**

---

## (2026-07-11) — housekeeping: #63 resolved (Option 3) + PR-review audit

**STATUS: in progress** on branch `claude/prism3-e2e-integration-8fwul4` (fresh from `main`, post-#91).

- **Audited all 29 merged PRs (57–90)** for missed should-fix / unresolved review items → **clean**: zero
  outstanding, zero unresolved threads. The one #90 should-fix (stale `field.border` sidecar ref) was already
  fixed (`4528982` + the sidecar-reference gate). Deferrals were all tracked as issues, not silently merged.
- **#63 resolved — Option 3 (owner-decided).** nb's hand-authored semantic text on the `-subtle` tint lands
  ~4.0–4.2:1 in LIGHT (under AA 4.5) for 4 banner/badge pairings. **Investigation ruled out Option 1**
  (large-text 3:1): measured, the alert text is body **16px regular** and the badge is label **12px** — neither
  qualifies. This exists ONLY in the hand-authored NB reproduction (the regression fixture); engine-GENERATED
  brands (aurora/harbor) clear 4.5. Option 2 (re-target the inks) would move NB tokens + the regression baseline.
  Owner chose **accept as a documented NB-source divergence** — the engine is already correct. Formalized: the
  loose `L-10` characterization (`nbLightFails.length > 0`) is now a **can't-drift KNOWN-outliers gate** pinning
  the exact 4 labels + a `[4.0, 4.5)` band, so a NEW shortfall (regression) or a VANISHED known one (fixed →
  re-review/close) both fail the suite. `test.ts (10b)`. **Closes #63.**

**Open issues remaining:** #79 (opacity hidden from Figma consumers — emit-figma lane, next), #67 (token-press:
did the #66/#73 collection rename break ingestion — cross-lane, needs the Token-Press lane / owner).

**Gates: test 702/702, nb-regression exit 0, emit-dtcg 336/336 per brand, web tsc clean.** No token/out change.

---

## (2026-07-11) — `status.info` + orphan-ramp pruning (validation-colour completeness)

**STATUS: in progress** on branch `claude/prism3-e2e-integration-8fwul4` (fresh from `main`). Completes the
validation-colour override set so a designer can change all four (red/green/orange/blue) directly.

- **`status.info`** — info was synthesise-only (canonical blue, the docs/21 §2 gap); now it takes a direct hue
  override like `success`/`warning`/`danger`. Symmetric: a measured hue seeds a vivid ramp, contrast re-gates.
  Exposed as a `status.info` colour lever. (`theme.ts` type + `status()`, `levers.ts`, `theme-schema.json`.)
- **Orphan-ramp pruning** — `success`/`warning`/`info` are minted unconditionally, so a `roleColors` rebase left
  the now-unused ramp shipping as a dead one. It's now pruned (keyed off the final `roleToPalette` + `accentPalette`
  so a ramp survives if `action`/`accent` still point at it) — symmetric with the danger carve's no-orphan behaviour.

**Why:** the two validation-colour mechanisms now cover all four colours cleanly — `status.*` sets the raw hue,
`roleColors.*` borrows another ramp (a red brand's red for danger, a blue brand's blue for info), and a borrowed
status ramp no longer duplicates. This is the engine half of the "change validation colours contextually per-ramp"
UI vision; the contextual per-ramp dashboard control (own-hue + borrow-from-a-ramp-above, deferred "lock") is the
UI-lane follow-up (the `status.*` levers are still `advanced:true`, so unsurfaced until that lands).

**Gates: test 700/700, nb-regression exit 0, emit-dtcg 336/336 per brand, emit-figma + web tsc clean;
lever-manifest.json + out/* regenerated.**

---

## (2026-07-10) — the Text Field FAMILY: `field.border` hover split + three ComponentDefs

**STATUS: in progress** on branch `claude/prism3-e2e-integration-8fwul4` (fresh from `main`). Scoped the
**Text Field** grounded in `knowledge-base/components/text-field.md`, and the owner-confirmed shape is a small
**field family**, not one monolith — the KB's "composed slots" hybrid expressed in the data model.

**One engine change:** `field.border` became the one **stateful** field slot, nested `field.border.rest` +
`field.border.hover` (same shape as `interactive.*.fill.<state>`). Rest is the perceivable boundary (gated 3:1
vs the page); hover is a subtly *stronger* boundary (gated 4.5, asserted ≥ rest) — a perceptible, never-sole
state cue (KB §4). All other field states still compose (focus→`border.focus`, error→`border.danger`,
disabled→`disabled.*`). This is a flat-leaf → nested rename: `modes.ts`, `emit-figma` (scope keys on `seg[2]`,
unchanged), `test.ts` (scope + shape + a hover≥rest gate), `preview.ts` (rebound + a new `hover` variant),
`materialise-to-figma` verify (field-family names + the old flat leaf asserted gone).

**Three ComponentDefs (the family):**
- **`components/field-label.ts`** — the accessible name: `size` {small, medium} + required/optional indicator +
  disabled dim. A shared part reused above every field control (static top-aligned; floating out of favour).
- **`components/field-message.ts`** — the **Prism2 "Helper message" successor**: a `tone` axis
  {default, error, warning, success}, each tone re-pointing **both** caption ink + status icon at the matching
  role (`text.<role>` + `icon.<role>`) — icon + text, never colour-only. Presentational; the host owns the
  `aria-describedby` + `aria-invalid` wiring.
- **`components/text-field.ts`** — the HOST. Composes the two parts (`composesWith`) and binds **input chrome
  only** — so label/message tokens live in the parts and Select/NumberField reuse them. Encodes the KB's live
  edges: read-only ≠ disabled (read-only stays full-contrast `text.primary` + `border.secondary`, not dimmed);
  error is a **border-only** swap; validation is **presentational** (form lib owns timing); base field only
  (NumberField separate, Search/Password thin specialisations, email/url/tel = `type`+attrs).

**Decisions (owner-confirmed):** base-only (credit-card field is a compose-of-fields *pattern*, out of scope);
add the `field.border.hover` token (owner leaned yes); error = border-only; read-only = full-contrast. The
nested-component question resolved to: shared **parts** are their own defs when state/tone-bearing + reused
(FieldLabel, FieldMessage); truly-primitive parts (Icon) stay **slots**, not defs.

**Gates: test 691/691 (+16: field hover-gate, +3 def validations × 2 brands, family assertions), nb-regression
exit 0, emit-dtcg 336/336 per brand, emit-figma clean, web tsc clean.** `out/*` + `preview-spec.json` regenerated.

---

## (2026-07-08) — `roleColors`: general semantic-role rebasing (docs/21)

**STATUS: in progress** on branch `claude/prism3-e2e-integration-8fwul4` (fresh from `main`). A general lever
that lets a brand **re-base any semantic role on a declared palette** — the client-driven need: a red brand
reuses its brand red for `danger`, a blue brand its blue for `info`, or any role points at a custom colour.

**The lever:** `roleColors?: Partial<Record<Role, string>>` on `BrandInput` (value = a palette name: a status,
`primary`/`neutral`, or a `brandColors` entry). It's the **general form of `actionPalette`** (which stays as an
ergonomic alias for `roleColors.action`). Covers `success`/`warning`/`danger`/`info`/`action`; `brand`/`neutral`
are rejected (they define the surface model). `accent` is unchanged — it's an *added* interactive column, not a
rebasable role, so it keeps `accentPalette`.

**Why it existed as four special cases before:** `action`/`accent` had their own levers; `danger` had an
auto-carve *heuristic* (a saturated-red brand already reuses `primary` for danger — `test.ts` M-05); and
`success`/`warning` could hue-tune via `status` but `info` had **no override at all**. `roleColors` unifies them
— the explicit danger override wins over the heuristic (and mints no orphan danger ramp), and info rebasing is
finally possible.

**Guarantees:** contrast **always re-gates** on the target ramp (verified: a rebased brand clears every contract
in all four modes; `text.info` resolves onto the primary ramp and still passes). Semantic-signal appropriateness
is the user's call but **flagged** — a hue mismatch (danger not red, info not blue) pushes a design.md `CONFIRM…`
note rather than blocking. Validation: unknown target palette throws; `brand`/`neutral` rebase throws.

**Wiring:** `theme.ts` (input field + a general rebasing pass after the danger carve, with `paletteHue` +
hue-mismatch note), `schema/theme-schema.json` (the `roleColors` object). **Additive + optional** — NB/aurora/
harbor declare no overrides, so `out/*` is byte-identical. Not exposed as a dashboard lever (it's a structured
map, not a scalar toggle — `lever-manifest` unchanged).

**Gates: test 671/671 (+8 roleColors: gap-closer, explicit-danger-no-orphan, action-alias, the all-modes contract
guarantee, hue-mismatch flag, both guards), nb-regression exit 0, emit-dtcg 332/332 per brand, web tsc clean.**

---

## (2026-07-07) — the `field.*` category (form-element chrome, docs/20 §17)

**STATUS: in progress** on branch `claude/prism3-e2e-integration-8fwul4` (fresh from `main`). Field research on
the Prism2 input tokens (`surface.input.*` / `border.input.*`) confirmed most of them are already covered
*better* by the generated families — so `field.*` is deliberately **minimal**: three roles, everything stateful
composed from existing gated families (per docs/20 §15: the field's states come from `interactive.*`).

**Generated `field.*` (three roles):**
- `field.fill` — the field fill (a subtly inset neutral, tracks the page tier so `text.primary` clears). Surface, min 0.
- `field.border` — the **resting** boundary, **gated `nonTextMin` (3:1) against `background.primary`** (SC 1.4.11). This is the improvement over Prism2, whose resting input border sat sub-3:1 and leaned entirely on focus. NB: neutral.400, 3.27:1.
- `field.placeholder` — placeholder ink, **gated `secondaryMin` (4.5) against `field.fill`** — a *readable* hint, not the sub-AA placeholder Prism2/most systems ship. NB: neutral.550, 4.52:1.

**Composed, NOT re-authored:** focus → `border.focus`; validation → `border.<semantic>` + `foreground.<semantic>-subtle`;
disabled → `disabled.{fill,border,on-fill}`; hover → `interactive.*` overlays; value ink → `text.primary`;
inverse → the generated inverse surface-context (no hand-mirrored `field.*-inverse` twins — Prism2's biggest spend).

**Taxonomy decision (owner) — a control's fill is `.fill`, the ink on it is `.on-fill`, everywhere.** Introducing
`field.surface` surfaced an inconsistency: the retired top-level word `surface` (Prism2's `surface.*` → `foreground.*`)
had quietly survived as a slot in `disabled.surface` (#83), while the interactive family used `.fill` / `.on-fill`.
Resolved to the interactive convention: **`field.surface` → `field.fill`**, and the merged disabled family aligned
(**`disabled.surface` → `disabled.fill`**, **`disabled.on-disabled` → `disabled.on-fill`**). No `.surface` token
segment remains anywhere. (We considered flattening `interactive.<c>.fill.*` to bare states, but per-colour overlay-tint
means `fill` + `overlay` are both stateful slots, so the `.fill` segment is load-bearing — kept as-is.)

**Wiring:** `modes.ts` generates the three roles; `ai-metadata.ts` describes the `field` group; `emit-figma.ts`
gets `FIELD_SLOT_SCOPES` (fill→paint, border→stroke, placeholder→text); the eval-preview `input` component is
rebound onto `field.*` (+ `border.focus` / `disabled.*` for its states). `test.ts` allow-lists `color/field/` out
of the figma `extra` check, gates the field slot scopes, and pins the family contracts (border ≥3:1 on the page,
placeholder ≥4.5 on the fill). A formal Text Field `ComponentDef` (like Button) is a **follow-on**, not in this increment.

**Gates: test 663/663, nb-regression exit 0, emit-dtcg 332/332 contracts per brand (was 324 — +2/mode for the
gated field border + placeholder), web tsc clean, `out/*` regenerated.**

---

## (2026-07-07) — legacy colour-role removal + NB figma-fixture reconciliation (task #14)

**STATUS: in progress** on branch `claude/prism3-e2e-integration-8fwul4` (reset from fresh `main` after PR #83
merged). The cleanup increment that #83 deliberately deferred: now that components bind `interactive.*` /
`disabled.*`, the superseded legacy scaffolding is **removed**.

**What was removed (engine):**
- `action.*` (the top-level interactive fill + states) → `interactive.primary.*`.
- The **stateful** `foreground.danger.*` fill → `interactive.destructive.*`. **`danger` is now a bare bold
  `foreground.danger` fill** like `brand`/`success`/`warning`/`info` (its `on-danger` ink pairing resolves
  cleanly against it). `foreground.danger-subtle` is unchanged.
- Per-colour `interactive.*.fill.disabled` → the cross-cutting `disabled.*` is the SOLE disabled family.
- `text/icon.{disabled, on-action, on-disabled}` → `disabled.text` / `disabled.icon`,
  `interactive.<c>.on-fill`, `disabled.on-fill`. Preview `input.disabled` rebound to `disabled.text`.
- ai-metadata branches, the emit-figma `action` scope entry, and the test suite retargeted off the removed roles.

**NB-fidelity reconciliation (the fixture re-baseline).** Removing those roles deletes vars from the frozen
real-NB figma fixture (`fixtures/figma/nb/color.*`), so the fixture was **modernised to the engine's evolved
layer** (owner-approved: "modernise the reference"): dropped the **17 retired vars/mode** and renamed
`foreground/danger/default` → bare `foreground/danger` (**95 → 78 real vars/mode**). The DTCG colour-fidelity
gate (`nb-regression`, ΔE) is **unaffected** — only the Figma variable *naming* changed. The figma name-match
gate keeps `missing === 0` on the real families + the `interactive/` / `disabled/` allowlist for engine-added
families.

**⚠️ The "#67" mislabel — corrected.** Earlier progress/docs called this "the #67 NB-fidelity reconciliation."
**GitHub #67 is actually the unrelated Token Press *collection-rename* question** (`palette`→`core-palette`,
tied to #66). There was never a dedicated issue for this legacy-var fixture re-baseline; it's simply task #14.
(docs/10's `#67` note about the `$collection` label rename is a genuinely different concern — left as-is.)

**Gates: test 655/655, nb-regression exit 0, emit-dtcg 324/324 contracts per brand (was 384 — the removed
roles carried contracts), web tsc clean, `out/*` regenerated.** Also parked (unchanged): `overlay-tint` lever.

---

## (2026-07-06) — interactive colour family (docs/20), increments 1–4 + component rebind

**STATUS: shipped as [PR #83](https://github.com/adamforrester/prism3-tokens/pull/83)** (branch `claude/prism3-e2e-integration-8fwul4`,
8 commits `f1d8804..73dbcbd`, base `main`). Independent reviewer **approved** increments 1–4 + rebind — both prior
findings (fixture character, intent tests) implemented; verdict "correct, additive, fully gated, no blocking/should-fix."
A second reviewer pass is in progress; not yet merged. Gates: **test 655/655, nb-regression ΔE00 1.95, emit-dtcg 384/384
contracts per brand, web tsc clean, out/\* regenerated + committed.**

**The one open thread (tracked, task #14) — the legacy-role removal.** The PR is deliberately additive: `action.*` /
`foreground.danger.*` (stateful) / per-colour `interactive.*.fill.disabled` / `text.disabled` / `icon.disabled` +
their `on-disabled` still coexist beside the new `interactive.*` / `disabled.*` families. Components have rebound, so
the clean-up increment (drop the legacy roles + contracts + ai-metadata branches, full `action`→`interactive` doc
sweep) is all that remains — but it **deletes `color/action/*` + `color/foreground/danger/*` vars present in the frozen
real-NB figma fixture**, so it MUST land with the **#67** NB-fidelity reconciliation (update the fixture to the engine's
evolved semantic layer). Also deferred: `overlay-tint` (needs per-colour alpha ramps). Do NOT remove the legacy roles
without doing #67 in the same change — the fixture `missing===0` gate will fail otherwise.

**Component rebind (Button / IconButton / eval preview).** Rebound to the reconciled two-axis model —
appearance `{filled, outline, text}` × intent `{primary, neutral, destructive}` — bound to `interactive.<intent>.*`
+ cross-cutting `disabled.*`. **This closes the v1 HIGH finding**: neutral (was the stateless
`foreground.secondary`) now carries hover/pressed/on-fill like every colour, so the default button is no
longer hover-less; the matrix is uniform. `ghost`/`secondary`/`solid`/`plain` retired to the reconciled
vocabulary; default intent = neutral, appearance = filled. `preview.ts` rebound too (removing the
`brand.*`-on-buttons leak docs/20 §1 flagged); outline/text hover uses the overlay wash. Component defs
still validate against both nb + aurora; web tsc clean. test 654→**655**.

**Increment 4 — inverse surface-context + `neutralEmphasis` + opt-in `accentPalette` (additive).**
- `interactive.<color>.on-inverse` (docs/20 §9): the ink for an outline/text control on a dark hero /
  inverse section — a light CTA on dark, generated + contrast-verified against the inverse surface (not a
  hand-mirrored twin). Gated by the `inverse` lever (default on). NB: primary/destructive 5.05:1, neutral 18:1.
- `neutralEmphasis` lever (`subtle` default / `strong`): strong gives a bold near-black/near-white neutral
  fill (neutral.800 light) that clears the non-text floor; on-fill still gated.
- Opt-in `accentPalette` lever (docs/20 §3): names a declared palette (≠ action) → a full `interactive.accent.*`
  column (fill/on-fill/text/border/on-inverse/overlays), all gated. Rejected if it equals the action palette
  (never falls back to primary). Absent by default. All wired through input/Theme/schema/lever-manifest/.ai.json.
- Contract count 372→**384** per brand (inverse inks). test 648→**654**. Fixtures untouched (all under the
  `color/interactive/` allowlist).

**Increment 3 — cross-cutting `disabled.*` (additive).** One disabled treatment regardless of intent
(docs/20 §7): `disabled.{surface, on-disabled, text, icon, border}`, governed by `disabledStrategy`.
`disabled.on-fill` is gated against `disabled.fill` (accessible: 3:1). Contract count 360→**372**.
Kept **additive** — the scattered `action.disabled` / `foreground.danger.disabled` / `interactive.*.fill.disabled`
remain generated so NB byte-repro holds; components rebind to `disabled.*` in the migration step. `color/disabled/`
is a new engine-added family, added to the figma fixture allowlist. **Important scoping note:** removing the
legacy `action.*` roles (the docs/20 §11 rename) would delete `color/action/*` vars that ARE in the frozen
real-NB fixture — that's the NB-fidelity reconciliation the review tied to **#67**, so this PR keeps the legacy
roles and defers their removal there. test 646→**648**.

**Increment 2 — overlays + composited-contrast gate + `outlineInteraction` lever (additive).**
- `interactive.<color>.overlay.{hover,pressed,selected}` — translucent washes that composite over
  ANY surface (page, dark hero, image): the outline/text-appearance hover + rows/menus/cards story.
  `overlay-neutral` (default) uses the mode-adaptive neutral alpha ramp (black-alpha light / white-alpha
  dark), hover 10% / pressed 20% / selected 20%.
- **Composited-contrast gate (docs/20 §13):** each overlay is a real contract — `text.primary` must stay
  ≥ AA on the page *once the overlay sits on it* (`color.ts` gains a `composite()` alpha-over helper).
  This can fail (a too-heavy lightening wash in dark mode) so it genuinely constrains the alphas; all hold
  (NB ratios 12–16). Contract count 324→**360** per brand.
- **`outlineInteraction` lever** (`overlay-neutral` | `solid-tint` | `none`) wired through the input model,
  schema, lever manifest, and `.ai.json`. `solid-tint`/`none` emit no overlays (opaque `foreground.<color>-
  subtle` / no hover). `overlay-tint` (per-colour hue at alpha) is scheduled — it needs per-colour alpha ramps.
- Figma: `overlay` slot scoped FRAME/SHAPE_FILL, aliases the alpha ramp. Fixtures unchanged (overlays are
  `color/interactive/*`, already allow-listed). test 644→**646** (overlay presence/gate/mode-adaptive + lever opt-out).

Gates: test 646/646, nb-regression ΔE00 1.95, emit-dtcg 360/360 per brand, web tsc clean, `out/*` regenerated.

### Increment 1 — the `interactive.<color>` family (additive)

Building the redesign specced in `docs/20-interactive-color-system.md` as gated increments on
`claude/prism3-e2e-integration-8fwul4` (one PR when the family is complete). **Increment 1 (this
checkpoint): the generated `interactive.<color>.<slot>` family**, ADDITIVE alongside the legacy
`action.*` / `foreground.danger.*` roles so no contract goes red mid-migration.

- **`modes.ts`** now generates `interactive.{primary,neutral,destructive}` with slots `fill`
  (+ the six fill-states), `on-fill`, `text`, `border`. `primary` walks the action palette,
  `destructive` the danger palette, `neutral` a subtle grey (emphasis lever comes in inc-4).
  Fill-states lead with **`rest`** (the interactive family's own convention, docs/20 §2:
  rest/hover/pressed) — `default` stays only on the non-interactive roles (`action.default`,
  `text.link.default`), no systemwide rename.
  The load-bearing neutral pair (`neutral.on-fill` on `neutral.fill.rest`) is now a
  **generated + gated contract** — the historical miss (docs/20 §12) can't ship silently.
  Contract count rises automatically (tree.ts counts every `min>0` role); nb/wendys/aurora/harbor
  all hold (e.g. harbor 324/324).
- **`emit-figma.ts`** — `interactive` is scoped by its SLOT (fill→FRAME/SHAPE_FILL, on-fill→+TEXT_FILL,
  text→TEXT_FILL, border→STROKE_COLOR), not the family.
- **Fixture-character decision (2026-07-06, post-review; pairs with #67):** the NB figma colour
  fixtures stay the **frozen real Token Press export** (95 vars/mode) — engine-invented families
  (`interactive.*`) NB never shipped are **allow-listed** out of the exact-match gate (`missing===0`
  keeps the byte-repro; a spurious var inside a *real* family still fails). The interactive family's
  shape/scopes/gating is pinned in a dedicated `test.ts` block instead (test 639→**644**), so the
  fixture doesn't quietly become an engine snapshot.
- **`ai-metadata.ts`** — a depth-aware `describeInteractive` for the 4-segment keys (the generic
  `[group, variant, state]` split dropped the state); every `interactive.*` token now carries proper
  `when_to_use` / `avoid_when` / `paired_with` / `contrast_with`.

Gates: test **639/639**, nb-regression ΔE00 1.95, emit-dtcg contracts hold per brand, `out/*` regenerated.
Accent is deferred to inc-4 (opt-in `accentPalette` lever). Next: inc-2 overlays + composited-contrast
check + `outlineInteraction`; inc-3 cross-cutting `disabled.*`; inc-4 inverse surface-context +
`neutralEmphasis` + `accentPalette`; then rebind Button/IconButton (§16.3).

## 2026-07-03 — E2E integration arc

Since the token layer completed, work has been the **designer↔developer↔agent E2E pipeline**
(`07`/`08`/`09`/`10`). Shipped to `main`, newest first (see the decisions log for the why):

### Fresh-agent brief — pick up here

Two threads are live: the **Figma-emitter agent** (owns `emit-figma.ts` + its `test.ts`
gates; materialises axes into Figma via MCP) and the **generator thread** (everything
else — engine core, web dashboard, docs). Coordinate via committed artefacts (docs/10 §6).

- **emit-figma today:** colour + typography + dims + shadow + gradient + **layout**
  axes shipped (#28, #31, #33, #35, #46). Mode-opt-out fix landed (#49) — a light-only
  brand no longer emits dark files with light values. **Generalise** landed (#50) —
  aurora + wendys emit through every axis (aurora's alias-driven gradient Paint Style
  is live). **Wireframe mode** landed (this PR) — `'wireframe'` is now materialised on
  the two axes it touches in the DTCG tree: colour gets a fifth mode (greyscale, every
  role's `$extensions.prism3.modes.wireframe.$value` routes to a `palette/neutral/*`
  step), and **radius becomes the first mode-varying non-colour/shadow axis** —
  `buildFigmaDims` returns `radius: FigmaCollectionFile[]` (per-mode, same shape as
  `color`); a non-wireframe brand ships a single Default-mode `radius.json`
  (byte-identical to the pre-1b world), a wireframe-opted brand ships two files where
  non-zero radii alias `dimension/0`. Fully specified in `docs/10-figma-materialization.md`.
- **emit-figma next (docs/10 §7 queue post-this-PR, 2026-07-04):**
  1. **Motion — STILL DEFERRED.** Re-probed the Figma Plugin API 2026-07-04 (via
     WebFetch of the current VariableScope docs): FLOAT scopes are
     `ALL_SCOPES / TEXT_CONTENT / CORNER_RADIUS / WIDTH_HEIGHT / GAP / OPACITY /
     STROKE_FLOAT / EFFECT_FLOAT / FONT_WEIGHT / FONT_SIZE / LINE_HEIGHT /
     LETTER_SPACING / PARAGRAPH_SPACING / PARAGRAPH_INDENT` — no `TIME` scope,
     no motion/duration/animation scope. Config 2026 hasn't surfaced it. Recheck
     when it lands. easing/spring/transition composites have no Figma variable
     primitive — emit as `motion-styles.json` reference metadata only.
  2. **Follow-ups parked (typography #31):** fix 3b bindable form — `font-tracking`
     FLOAT collection (6 tokens: tighter/tight/snug/normal/wide/wider); rebind
     `letterSpacing` on all 36 text styles.
  3. **Follow-up parked (aurora + wendys full-materialise, from #50):** import the
     full aurora + wendys variable-artefact set into the Prism3 Test File via
     Figma MCP so their palette / color-×4-modes / typography / dims / layout /
     shadow / gradient collections all render live (structural gates already
     prove correctness; this is end-to-end visual confirmation). Separate PR —
     scope is heavier than a doc update.
- **Test file:** the Figma-MCP thread's target is "Prism3 Test File" (fileKey
  `Zrn9YDqrFiwjs2IfKInNY0`). It has 4 specimen pages already (Colour, Typography, Dims,
  Shadow, Gradient) + all the corresponding variable collections + styles imported live.
- **Run commands:** `npx tsx Prism3/engine/emit-figma.ts` writes `out/figma/{nb,aurora,wendys}/*.json`;
  `npx tsx Prism3/engine/test.ts` gates everything (400/400 today).

### Discussion backlog (2026-07-04) — owner-raised, awaiting decisions

Five items surfaced by the owner once the code-review sweep (HIGH+MED+LOW, generator/web lane)
closed. Logged so they survive context loss; **none is a commitment** until it lands as a decision
here or a merged PR. Test count is **542/542** as of the sweep close.

1. **Motion-in-Figma — what it unlocks (deferred, low urgency, NOT on the critical path).**
   Motion is **doubly** blocked in Figma, not just once: (a) the Variable API has no `TIME`/duration
   FLOAT scope (re-verified 2026-07-04), so a duration could only be a scope-less FLOAT; and (b) even
   if it existed, Figma has **no binding consumer** — prototype transitions / smart-animate don't read
   variables for duration or easing, so a motion variable would drive nothing. So the "unlock" is
   currently theoretical. *When both land* it unlocks: the last generated axis (duration/easing/spring)
   materialising into Figma → "every axis in Figma" complete; a **`reduced-motion` mode** (durations→0,
   the motion analogue of wireframe — a `prefers-reduced-motion` accessibility win); and motion
   round-tripping like colour/dimension. **But motion already flows to CODE consumers** (CSS
   transitions/animations) through the DTCG / `design.md` layer, where it's actually consumed — Figma is
   only a viewer, so this gap affects Figma-side *completeness*, not the E2E code pipeline. **Decision:**
   keep deferred; recheck when Figma ships a `TIME` scope AND a prototype/animation binding target
   (watch Config announcements). Already parked in the emit-figma-next queue (item 1 above) — this entry
   adds the "what it unlocks" rationale. **Verified 2026-07-04** against the *live* Figma developer docs
   (`developers.figma.com/docs/plugins/api/VariableScope`): the enum still has 14 FLOAT scopes, none for
   time/duration/motion. `VariableScope` is **platform-defined** (returned to the auto-updating plugin
   runtime), so updating the local Figma desktop app does NOT surface a missing scope — it's a genuine
   Figma-platform gap, not a stale local install.

2. **Independent emitter review (offered — owner to greenlight; Figma-emitter lane).** A *broad* re-read
   would largely re-surface what the code review already catalogued (M-07/08/09 + L-13/14 are the known
   emit-figma findings). Higher-value and non-duplicative: the **targeted adversarial pass docs/16
   gate-blind-spot #2 already names** — run a *second brand* (aurora/harbor + the extreme white-label
   fixtures: non-5-breakpoint, narrowed modes, gradients) through *every* emit-figma axis and diff the
   output against docs/10–11 spec + expectations. That catches CR-08 / M-07/08/09-class bugs by
   *generation*, not code-read. Would be **read-only** (produces findings handed to the Figma-emitter
   thread; no edits to `emit-figma.ts`/`out/figma`), coordinated so it doesn't collide with in-flight
   emitter work. **Open:** owner to greenlight scope (targeted second-brand pass vs full review).

3. **`core/` prefix on primitive Figma collections (open decision — Figma-emitter lane + web export).**
   Owner prefixed the primitive collections in the NB example with `core` to scan primitives-vs-semantics
   at a glance. **Assessment:** it touches **only `$collection` names in the raw-figma format** — the DTCG
   token paths, the `nbds.pds.*` / `prism.*` namespace, and the `{a.b.c}` aliases are all unchanged — so
   it's low-risk and does **not** move the token taxonomy (owner's read confirmed). It's a sound, common
   convention (Tokens Studio / many systems group `core`/`global`/`primitive` apart from `semantic`).
   Today the emitter names primitive collections `palette`, `dimension`, `font`(family/size/weight) and
   semantics `color`, `space`, `radius`, `size`, `border-width`, `focus`, `layout`, `opacity`, etc.
   **Recommendation: adopt it** — but decide it as a convention so the *generated* output matches the
   hand-authored NB file (else they drift). **Empirically resolved from the NB example** (`Tokens/New
   Balance/**/raw-figma`, 2026-07-04): the owner used **hyphen**, `core-<axis>` — primitives are
   `core-color`, `core-dimension`, `core-typography`, `core-breakpoint`, `core-motion`; semantics are bare
   (`color`, `radius`, `space-size`, `layout`, `motion`). So the form question is settled (hyphen, matches
   the file already tested importing into Figma). **The bigger implication:** this is a RENAME, not a bare
   prefix — the engine currently names its primitive collections `palette` / `dimension` / `font`, so
   adopting the convention means the emitter renames them to `core-color` / `core-dimension` /
   `core-typography` (+ `core-breakpoint`, and `core-motion` when motion lands). There's also deeper
   taxonomy divergence to decide separately (engine `space`/`size`/`border-width` vs NB `space-size`;
   engine `text-styles` vs NB `typography`) — align the whole Figma collection taxonomy onto NB, or just
   the `core-` primitive grouping? **Confirmed by owner:** `font-fluid` is SEMANTIC (not `core-`), and the
   primitive set = `palette`/`dimension`/`font` → `core-color`/`core-dimension`/`core-typography`. **Still
   open:** whole-taxonomy-align vs core-grouping-only; and the emitter's `variableId` round-trip must be
   verified name-insensitive (expected — IDs are per-variable). **Implementation is the Figma-emitter
   thread's** (emit-figma + out/figma), with a matching web-export tweak in the generator lane so the
   playground and CLI/engine agree. The emitter review now running will report the exact current collection
   names per brand to scope the rename.

4. **Interactive-state DIRECTION rationale (settled — now documented).** *Q: do hover/pressed go darker
   in light mode and lighter in dark mode?* **Yes** — `dir = family==='light' ? +1 : -1` (`modes.ts`):
   light steps to higher step numbers (darker), dark steps to lower (lighter). **Thought process:** an
   interactive state moves the fill toward **more contrast with the page it sits on** — light page →
   darker fill, dark page → lighter fill — so as the user engages (rest→hover→pressed) the control grows
   more prominent ("comes forward"), and the *same* move keeps the on-fill label legible (a darker fill
   lifts a white label's contrast; a lighter fill lifts a dark label's). Matches the step-based source
   systems (NB/Prism2) and mainstream convention (Carbon/Material darken-on-light). **The top-of-scale
   case the owner solved before** — action colour at the far end, so hover/pressed must step *down*
   instead of up — is now the **generalised L-01 fix (#60)**: on overshoot `walk` reflects inward,
   keeping the states distinct; the trade-off at the extreme is that distinctness (a soft goal) wins over
   the contrast-direction preference, while each state's hard contrast *contract* is still gated. Code
   comment enriched in `modes.ts` alongside this entry. **No open question** — captured for the record.

5. **Inspirations (`docs/13`) follow-through (tracked there; promote on decision).** Reviewed the
   owner-supplied research: **Astryx** (Meta's agent-first DS — CLI-as-agent-surface, typed component
   doc objects), **ds-brain** (a practitioner's DS×AI stack map — the *consumption-side eval harness* is
   the genuinely new idea for us), **Specs CLI** (DirectedEdges — extraction-only; the read-back verifier
   seat for a component-tier regression). `docs/13` already holds the convergence table + the "steal
   becomes a commitment only when it lands in `00-progress`" rule, so the actionable candidates are
   logged there, not duplicated here. **Candidates worth promoting when the agent-surface work starts:**
   a `cli.ts query` subcommand over `.ai.json` (retrieval surface before MCP), an `.ai.json` *discovery*
   layer (the sidecar is only useful to an agent that knows it exists), token-budget *tiers* for
   `.ai.json`, and a **consumption eval** (rubric + invented-token rate) built alongside the MCP adapter.
   **Open:** owner to say which (if any) to promote into the next-steps queue now vs. hold for the
   component/agent-surface phase.

6. **LLM skills in the agentic workflow (owner-raised, note for future discussion — 2026-07-04).**
   *Would building Claude/LLM "skills" (packaged SKILL.md instruction bundles, like the `brand-skills`
   repo ships) help the Prism3 agentic workflow?* **Take: yes, at two points, and they're complementary
   to — not a replacement for — the MCP surface.** The MCP adapter is the callable *tools*; a skill is the
   *instructions + discovery* layer that teaches an agent WHEN/HOW to drive them. (a) An **authoring skill**
   (`prism3-theme`) — teach an agent to brief a brand → drive `theme_brand`/the CLI → read the contract
   results → emit `design.md`. (b) A **consumption skill** (`prism3-consume`) — teach a *downstream* agent
   to use the generated tokens well: semantic roles not primitives, respect modes, honour `avoid_when`.
   Two nice ties: **(i)** a consumption skill's value is directly **measurable by the eval we just built** —
   add a "with-skill" arm and see if it moves invented/leak/contract-compliance (the same differential shape
   as with/without-surface); **(ii)** a skill fills the exact **docs/13 gap** — Astryx's `agent-docs`
   injection + the `.ai.json` "no discovery layer; the sidecar is only useful to an agent that knows it
   exists" note. And it slots into the existing chain: `brand-skills` (extract → `design.md`) → Prism3
   (tokens) → a `prism3-consume` skill (tokens → compliant UI). **✅ BOTH BUILT (2026-07-05):**
   `prism3-consume` (a) — measured by the eval's with-skill arm (100% compliance, see the decisions log +
   docs/17 §5); `prism3-theme` (b) — verified by the cold-agent compile loop (two fresh briefs compiled
   first-try clean, all 248 contracts holding). Skill placement (this repo vs. distributable) remains open.**

---

- **Figma plugin & host architecture grounding (`docs/18-plugin-and-host-architecture.md`, 2026-07-05).**
  A capability-grounding doc ahead of the plugin build (owner deferred the build itself past the long
  weekend; wants the web UI QA'd + the architecture pinned first). Sourced from the current Figma Plugin
  API docs. Nails: the **two-context execution model** (sandbox main thread = `figma.*` + document but no
  DOM/network; UI iframe = DOM/network but no `figma.*`; message-passing between) and how it maps onto our
  hosts — the engine core + control UI + preview run in the **iframe** (same code as the web dashboard),
  the **main thread is a thin variable/node writer** (the only plugin-specific tier), so `08 §3`'s shared
  layer lands exactly on the thread boundary. Documents the writable API surface (variables: create /
  addMode / setValueForMode / alias / bind; components: createComponent / combineAsVariants /
  `SLOT` property = the KB §15 slot contract) and the hard boundary (behaviour / a11y / motion / non-visual
  config are **not canvas-representable** — they live in code, which is what "lossy" actually meant; the
  canvas *build* from data is reliable). **Offline `.fig` ruled OUT** (closed format, no reliable writer) —
  the only reliable route onto the canvas is the Plugin API / Figma MCP. Adds the primitive-token vs.
  headless-primitive terminology guard. Cross-ref added from `08 §5`. Pure docs — no code, `out/*`
  untouched, `test.ts` unchanged (626). Complements `14` (component layer) — this is the *host capability*
  half, `14` is the *component-data* half.

---

- **`prism3-theme` authoring skill + cold-agent compile verification (`Prism3/skills/prism3-theme/SKILL.md`,
  2026-07-05).** Backlog #6 **(b)** built and verified — the *authoring* counterpart to `prism3-consume`,
  completing the two-skill story. A portable SKILL teaches an agent to turn a brand brief into a compiling
  `design.md`: the input contract (required `id`/`primary`(OKLCH)/`neutral`; the lever table with schema
  enums), the **discipline** (pin the brand's exact anchors in OKLCH and let the engine derive
  ramps/modes/contrast — never hand-author steps; omit a lever → its default = the plain-spec guarantee;
  adjective → lever mapping), and the **compile loop** (run `cli.ts`, read the contract results
  `aliases N/N | contracts M/M` + the notes, fix the *input* on a failed contract, re-run). Grounds itself
  in `schema/theme-schema.json` + the two example briefs (aurora maximal / harbor minimal) rather than
  duplicating them. **Verified with a hard pass/fail:** two cold `general-purpose` subagents, each given
  only the skill + the referenced examples/schema, authored a `design.md` from a fresh brief (**ember** —
  warm red-orange food-delivery, action-on-hero, one gradient; **sage** — muted-green wellness, tinted
  warm canvas, brand-supplied status, system fonts). Both **compiled first-try clean via `cli.ts`, exit 0,
  all 248 mode-contrast contracts holding** (ember 651/651 aliases, sage 640/640). Notably ember's warm
  red-orange landed in red territory so the engine folded `danger` into the primary palette + noted it —
  the "declare identity, engine derives system" contract working without the agent needing to know.
  **Pure docs/skill — no engine code, `out/*` byte-identical, `test.ts` unchanged (626).** The ember/sage
  briefs were throwaway verification (not committed as gated examples — that'd be a separate scope change
  to `emit-dtcg`; aurora/harbor already gate the CLI). **Placement OPEN** (same as #6a, flagged in the PR):
  the skill lives in `prism3-tokens` for now. Closes backlog #6 (both skills built); a larger multi-brand
  eval sample + wiring the authoring loop into a measured harness remain the refinements.

---

- **`prism3-consume` skill + the with-skill eval differential (`Prism3/skills/prism3-consume/SKILL.md`,
  `eval-run.ts`, docs/17 §4/§5, 2026-07-05).** Backlog #6 (a) built and measured — the agent-facing
  *consumption* layer of the four-layer stack. A portable, **brand-agnostic** SKILL packages the
  consumption discipline (semantic-role-not-primitive, respect modes, the decorative-border /
  disabled-exempt edges, the ink-on-surface pairs self-check) as instructions for any downstream agent —
  MCP or not. Wired into the eval as a `skill` arm (`buildPrompt(…, guidance, skill)` / `runEval({ skill })`),
  the portable sibling of the per-brand `guidance` (`.ai.json`) arm; the two **compose** (the skill teaches
  an agent to *read* the sidecar's `avoid_when`). **Measured (aurora, 4 tasks, 2 cold subagents/arm, pairs
  mode):** catalogue-only 93/86% compliance (always leaks `palette.success.050`); +`.ai.json` 94/97%;
  **+skill 100%/100%, 0% invented, 0% leak** — the portable skill matches-or-beats the per-brand sidecar,
  fixing both the leak (→`foreground.success-subtle`) and the two compliance edges (on-disabled→`ui`,
  decorative border dropped) that the raw metadata didn't reliably close. Honest limits: n=2, one brand,
  four tasks — directional. **Placement is an OPEN question** (flagged in the PR): the skill lives in
  `prism3-tokens` for now (co-located with the eval that proves it + the `.ai.json` it packages); whether it
  eventually ships as a distributable skill (its own repo / into `brand-skills`) is undecided — moving a
  markdown file later is cheap. Gates: `test.ts` **621→626** (skill embedded / absent / composes-with-guidance /
  back-compat byte-identity / threaded through runEval). Purely additive — `out/*` byte-identical, DTCG
  untouched. Closes the consumption-eval arc's final layer; the authoring skill (`prism3-theme`, backlog #6b)
  and a larger multi-brand sample remain the obvious next refinements.

---

- **emit-figma: the MED batch — M-08 silent-black + M-09 space-alias guard (`emit-figma.ts` + `out/figma`,
  2026-07-05).** Taken by the generator thread (emitter thread paused, owner-authorised); the two emit-figma
  MED findings the review named, each a *silent-degradation → loud-fail* hardening. **M-08 (a real shipping
  bug):** `parseColor` returned a silent `{0,0,0,1}` (opaque BLACK) for anything it couldn't parse, and it
  had **no 8-digit-hex branch** — so for `colorFormat:'hex'` brands the entire `black-alpha`/`white-alpha`
  transparency ramp (`#0000000d`…) and the shadow colours (`#060411xx`) were shipped to Figma as opaque
  pure black: the alpha ramp flattened, shadow colour wrong (black, not the brand navy) *and* opaque. Now
  it expands 3-digit hex like CSS (`#f00`→`#ff0000`), carries the alpha byte on 8-digit `#RRGGBBAA`, and
  **throws** on genuinely unparseable input (incl. the `parseColor(undefined)` unresolvable-alias path)
  rather than degrading to black. Regenerating corrected **aurora + wendys** `out/figma` (both hex-format);
  **nb** (`colorFormat:'rgb'`) untouched — the rgba path never regressed. **M-09 (latent):** `buildFigmaDims`
  emitted the `space` alias UNCONDITIONALLY, unlike every sibling axis (radius/size/border-width/focus),
  which guard with `isAlias ? {…} : null`. A space leaf carrying a raw px value (not a `{…}` ref) would ship
  `alias: { name: '' }` — a dangling empty-named binding Figma drops the link for. Space now matches the
  sibling contract; byte-identical for engine brands (space always aliases into dimension), so `out/figma`
  is unchanged by M-09. Two commits (one finding each). Gates: `test.ts` **600→614** (M-08: hex forms +
  alpha + rgb()/rgba() no-regress + the throw on undefined/unresolved-alias/garbage; M-09: no empty-named
  alias, every space aliases `dimension/*`, alias is null-or-nonempty), nb-regression exit 0, DTCG aliases
  647/647, mode contracts 248/248. `out/*.tokens.json` untouched. Closes the emit-figma MED tier; L-13/L-14
  (emitter LOW) still queued for that thread.

---

- **emit-figma: CR-08 layout-breakpoint fix (#65; `emit-figma.ts` + `out/figma`, 2026-07-05).** Taken by
  the generator thread (emitter thread paused, owner-authorised) — a real *shipping* bug the emitter review
  surfaced. `buildFigmaLayout` iterated a hardcoded `LAYOUT_MODES` (sm..2xl, 5) and read `gridNode[mode]`
  by name, so aurora's **six** breakpoints (xs..2xl) silently **dropped the base `xs` grid** (0px, 4-col
  mobile-first) on every regen — while still emitting `breakpoint/xs` as a constant, an internally
  inconsistent artifact; a ≤3-bp brand would have read `undefined` and crashed. **Fix:** derive the layout
  modes from the brand's actual grid keys (`Object.keys(gridNode)`, already ascending), not the hardcoded
  set. `LAYOUT_MODES` stays exported as the default breakpoint-name set. `out/figma/aurora/` now carries
  the previously-missing `layout.xs.json`; nb/wendys unchanged (5 bp). **Gate (the emit-layer blind spot
  the review named):** a new aurora (6-bp) block asserts one layout mode per breakpoint incl. `xs`, the xs
  grid carries the real base column count, every alias resolves across all 6 modes; the nb + generalise
  assertions are now breakpoint-derived (aurora 6 / wendys 5), not hardcoded 5. `test.ts` **595→600**,
  DTCG untouched. Closes #65; #67 (Token Press) still for that thread.

---

- **emit-figma: `core-` collection rename (#66; `emit-figma.ts` + `out/figma`, 2026-07-05).** Taken by the
  **generator thread while the emitter thread was paused** (owner-authorised). The Figma PRIMITIVE
  collections now carry a `core-` prefix for at-a-glance scannability in Figma's collection list:
  `palette→core-palette`, `dimension→core-dimension`, `font→core-font`, and `font-fluid→type-sets` (the
  responsive fluid-size collection). **Label-only, by design:** changed the four `$collection` labels, the
  text-style binding `collection` fields, and the output filenames (now `$collection`-derived). **Unchanged:**
  the DTCG tree, the `<root>.*` namespace, and every Figma **variable name** (`palette/red/550`,
  `font/family/*`, `font-fluid/*`) — they still mirror the DTCG paths, so the `variableId` round-trip and
  all cross-collection aliases resolve exactly as before (verified: **0 dangling** across nb/aurora/wendys,
  369/408/428 vars). Semantic collections keep bare names. `out/figma/*` regenerated (files renamed
  `core-*`/`type-sets`, old ones removed). **Fixture stance (#67):** `fixtures/figma/nb` keeps the OLD
  `$collection` labels — the byte-repro gate compares variable names/scopes/aliases/values (unchanged), NOT
  the label; the fixture is the Token Press byte-repro target and stays put until Token Press confirms the
  new labels. Deliberately did NOT adopt NB's `core-color`/`core-typography` base words nor merge
  `space`/`size` — the engine keeps its scope-per-collection split (better than the hand-file), per the
  narrow-scope decision. docs/10 carries a rename callout for the emitter thread to fold through on resume.
  Gates: `test.ts` **595/595** (text-styles collection assertion updated to `core-font`/`type-sets`),
  0 dangling aliases. `out/*.tokens.json` untouched (DTCG unchanged). Coordination: #66 (this), #67 (Token
  Press), #65 (CR-08 still queued for the emitter thread).

---

- **Consumption eval — the `.ai.json` guidance differential: 95% → 100% (`engine/eval-run.ts`, docs/17 §5,
  2026-07-04).** The experiment the pairs-mode gap called for, and the payoff of the whole arc. Added a
  `guidance` arm to the harness (`buildPrompt(..., guidance)` / `runEval({ guidance })`): the cold agent
  gets the catalogue AND each colour role's `.ai.json` `when_to_use | avoid_when | contrast`. **Live result
  — the three-arm differential:** WITHOUT surface → 48% invented; WITH catalogue (names) → 0% invented /
  **95%** compliance; WITH catalogue + `.ai.json` (semantics) → 0% invented / **100%** compliance (68/68).
  The guided agent did exactly what the metadata directed — **dropped** the decorative `border.primary`
  from its contrast pairs (its `avoid_when`: *"not a 3:1 target"*), **reclassified** `on-disabled` to the
  3:1 it declares, and moved to proper surfaces. **Each layer earns its keep as a number:** names kill
  hallucination (48→0), the `.ai.json` semantics kill mis-classification (95→100) — the four-layer stack
  (raw hex → names → metadata) demonstrated, one metric per layer. Directly motivates a **consumption
  skill** (backlog #6): it would package the same guidance portably, measured the identical way. Gates:
  `test.ts` **592→595** (guidance embedded / absent / threaded through runEval). Purely additive — `out/*`
  byte-identical. *This closes the consumption-eval arc: three metrics, the full with/without-surface AND
  with/without-guidance differentials, live.*

---

- **Consumption eval — pairs-mode harness + first live compliance number (`engine/eval-run.ts`, docs/17
  §4/§5, 2026-07-04).** Wired contract-compliance onto real agent output: passing a `theme` to `runEval`
  flips the prompt to **pairs mode** (`buildPrompt(..., wantPairs)`) — the agent returns
  `{task:{refs,pairs}}`, `extractPairs` pulls the `{fg,bg,kind}` pairings, and `runEval` scores
  `complianceByTask`/`complianceAggregate` alongside consumption (back-compat: no `theme` → refs-only).
  **First live run** (cold subagent, WITH catalogue, `atlas`): invented **0%** / leak **0%** / contract
  compliance **72/76 = 95%**. The 4 failures are the *interesting* part — **semantic-intent edges the token
  names can't carry**: `text.on-disabled` on `action.disabled` (3.05:1, the agent didn't know disabled is
  WCAG-exempt) and `border.primary` on `background.primary` (1.4:1, it used the *decorative* border as a
  3:1 `ui` element). Both are where the raw surface is insufficient and the agent needs `.ai.json`
  `avoid_when` / a consumption skill (backlog #6) — so the 5% gap is a measured argument for the metadata
  layer + the natural next differential (with vs. without `.ai.json`). Implies two metric refinements: a
  `disabled`/exempt kind, and honouring decorative-vs-functional role intent. Gates: `test.ts` **585→592**
  (pairs prompt/extractPairs/runEval-compliance/back-compat). Purely additive — `out/*` byte-identical.
  Rubric layer still deferred (docs/17 §4).

---

- **Consumption eval — contract-compliance metric (`engine/eval.ts` `scoreContractCompliance`, docs/17 §4,
  2026-07-04).** The third consumption metric, and the docs/04 contrast differentiator turned on the
  *agent's* output: for the fg/bg colour pairs an agent pairs on screen (`UsedPair { fg, bg, kind }`),
  resolve both roles per mode (`resolveAllModes`) and check the **raw** contrast (CR-01) clears the kind's
  floor — text 4.5, `ui`/`large-text` 3 (WCAG 1.4.11 / 1.4.3-large). Returns `{ checked, pass, rate,
  failures[], unresolved[] }`; fails if below floor in *any* mode where both roles resolve, a non-colour
  role lands in `unresolved` (not scored), no pairs → vacuously compliant (rate 1). Pure — reuses the
  existing mode/colour core, no new deps. Gated in `test.ts` (**578→585**: pass/fail/kind-floor/mixed/
  unresolved/empty). **Still to wire (docs/17 §4):** eliciting the pairs from the agent — the harness
  extracts a flat ref list today; a `pairs` output mode is the next harness step (mirrors how
  `scoreConsumption` preceded `runEval`). Rubric layer still deferred. Purely additive — `out/*` byte-identical.

---

- **Consumption eval — harness + first measured run (`engine/eval-run.ts`, docs/17 §3/§5, 2026-07-04).**
  The agent-in-the-loop harness on top of the scoring core: `SAMPLE_TASKS` (4 fixed component briefs),
  `buildPrompt` (WITH-catalogue vs WITHOUT-guess arms), `extractRefs` (JSON `{task:[refs]}`, tolerating
  ```json fences + prose fallback), and `runEval(tree, root, runner, {catalog})` → per-task + aggregate
  `ConsumptionScore`. **Pure orchestration — the model call is an INJECTED `ModelRunner`**, so the whole
  pipeline (prompt → model → extract → score) is deterministic + gated with a mock; a keyed environment
  swaps in a real Claude client (no script-usable API key exists in the dev sandbox — Claude access is the
  harness's managed OAuth, so real runs use the injected runner or, as here, subagents). **First measured
  run** (two cold `general-purpose` subagents, `atlas` brand): **WITH** the token catalogue → **0% invented
  / 0% primitive-leak** (53/53 valid); **WITHOUT** → **48% invented** (21/40 valid). The surface eliminated
  token hallucination — "MCP-first > screenshot-first" as a number (48%→0%). Invention concentrated where
  Prism3's names diverge from generic convention (`color.feedback.*`, `color.surface.raised`,
  `typography.heading.md`); the agent guessed the guessable `color.action.*` states unaided. Caveat noted
  in docs/17 §5: the WITHOUT baseline is partly stacked (denied the catalogue it was told to target) — the
  honest headline is the *elimination*, and a screenshot→CSS→map-back baseline is a later refinement.
  Deferred still: contract-compliance + rubric metrics (docs/17 §4). Gates: `test.ts` **567→578** (prompt/
  extract/mock-run/arm-selection). Purely additive — `out/*` byte-identical.

---

- **Consumption eval — scoring core (`engine/eval.ts` + `docs/17`, roadmap C follow-on, 2026-07-04).**
  First increment of the ds-brain steal (docs/13 §2): measure whether an agent handed the MCP surface
  produces *compliant* output — the consumption side the engine never measured (it verifies generation
  exhaustively but had no read on consumption). Built the **pure, deterministic scoring half**:
  `scoreConsumption(refs, tree, root)` → **invented-token rate** (refs to token paths that don't exist —
  the hallucination metric; cheap because the name contract is locked, docs/11) + **primitive-leak rate**
  (valid refs reaching past the semantic layer into `palette`/`dimension`/`font` — `PRIMITIVE_TIERS`,
  exactly the `core-*` grouping). `normalizeRef` accepts brace / root-qualified / relative forms; rates are
  occurrence-based, reported lists unique+sorted. **Pure — no `node:`, no LLM** — the agent-in-the-loop
  runner (drive a model on sample tasks against the MCP server, extract its refs, score them) is a deferred
  **edge shell** using the Claude API (docs/17 §3), opt-in, never the pure core. Contract-compliance +
  rubric metrics deferred to that phase (§4). The eval's payoff is *differential* — same tasks with the MCP
  surface vs. without, showing the surface moves the numbers (the four-layer thesis, measured). Gated in
  `test.ts` (558→567; clean/invented/leak/normalise/occurrence-rate/empty). Purely additive — `out/*`
  byte-identical. Design in `docs/17-consumption-eval.md`.

---

- **MCP adapter — layer C, "an agent themes Prism3" (`engine/mcp.ts`, docs/08 §5 / roadmap C, 2026-07-04).**
  The agent-callable surface over the pure core is live: a **dependency-free JSON-RPC 2.0 server over
  stdio** — deliberately NO `@modelcontextprotocol/sdk` (MCP is JSON-RPC + a 3-method core; owned the
  transport like the YAML parser + colour math, keeping the no-`npm install` invariant). It's an **I/O
  shell** (`node:` allowed; the pure core is imported, never touched) — the request handler
  `handleRpc`/`callTool` are pure + unit-tested directly, only the stdio loop behind `isMain` touches the
  process. **Three tools:** `list_levers` (returns the lever manifest verbatim — the knob catalogue the
  plugin + playground also render from, so the agent surface can't drift from them), `theme_brand`
  (a `BrandInput` → the DTCG token tree + `.ai.json` metadata + per-mode contract results + decisions
  log — the generate-and-verify payoff in one call), and `validate_brand` (schema pre-flight). **Design
  split:** the knob *catalogue* derives from the lever manifest (`list_levers`); the input *shape* is
  `theme-schema.json` (the precise, OKLCH-aware validation half — a `control:'color'` lever is an OKLCH
  object, not a string, so the manifest alone would be lossy). **Gates (`test.ts` 542→558):** the
  handshake (`initialize`/notification-silence/`-32601`), the tool catalogue, `list_levers` ≡ the manifest
  (drift gate), a full `theme_brand` round-trip (248/248 contracts + 647/647 aliases on the probe brand),
  and error paths (invalid brand → `isError`, unknown tool/method). **Live stdio smoke-tested** end-to-end.
  Purely additive — `out/*` byte-identical, pure core untouched. Run: `npx tsx Prism3/engine/mcp.ts`.
  *Next candidates (deferred): richer tools (`preview_brand` → resolved colours + overlay; `describe_token`
  → `.ai.json` query), and the consumption-eval harness (docs/13 ds-brain steal) alongside it.*

---

- **Code-review fixes L-10 — visualiser honesty + a surfaced nb gap (batch C, closes my LOW lane)**
  (`visualize.ts`, `docs/16` LOW tier). Three visualiser fixes: (a) the semantic-role table + preview
  render the modes the tree ACTUALLY carries (derived from `$extensions.prism3.modes`, canonical order)
  instead of a hardcoded four — a narrowed-modes brand no longer draws empty columns; (b) a failing light
  contract now prints its ACTUAL relation (`4.22<4.5` + a `no` class) instead of the literally-false
  `4.22≥4.5` the old code always printed; (c) the brand-controlled palette name is `esc`-ed
  (defence-in-depth — CR-03/L-06 already constrain it to a slug, so byte-identical for a valid brand).
  `out/*.tokens.json` + `out/figma` byte-identical; only `out/tokens.html` regenerated (which also picked
  up ~6 lines of pre-existing staleness — the committed html was behind the committed tokens.json on main).
  **Surfaced finding (flagged, NOT fixed here):** making the visualiser honest revealed 4 pre-existing
  light-mode shortfalls in **hand-authored nb** — `text.{success,danger,info}` and `badge info-subtle` on
  the `-subtle` tint surface land ~4.0–4.2:1, under AA 4.5. It's a CR-02-sibling (the role is contracted
  against the floor but used on a specific tint surface) and/or a preview-spec min-calibration question
  (alert body text is often large-text 3:1). Engine-GENERATED brands (aurora/harbor) clear it all-green;
  only the hand-authored NB reproduction shows it. Captured as a tested fact (test §10b) — a colour/spec
  fix would move nb token values + the regression baseline + is a design decision, so it's left for a
  follow-up call, not folded into this LOW visualiser PR. **L-12 was already resolved** during CR-06
  (`nb-regression` looks contracts up by palette name via `rampByPalette`, not positional `specs[0]/[3]`).
  **L-17 documented, not implemented:** the web rebuild runs `brandTheme`+`buildTree`+DOM synchronously per
  input event with no debounce — the review verified it has NO re-entry bug (all synchronous); a debounce
  is an optional perf enhancement with a small UX behaviour change and no web test harness, so it's left
  deferred rather than gold-plated. Gates: `test.ts` **542/542**, nb-regression exit 0, `out/*.tokens.json`
  + `out/figma` byte-identical. This **closes the LOW tier in the generator/web lane**; remaining LOW work is
  L-13/L-14 (`emit-figma`, the Figma-emitter thread's lane).

---

- **Code-review fixes L-06/07/08/09/11/15/16 — theme/parser/CLI LOW (batch B)** (`theme.ts` / `design-md.ts`
  / `cli.ts` / `standard-design-md.ts` / `resolve-preview.ts` / `web/main.ts`, `docs/16` LOW tier; second
  LOW batch). Seven input-boundary hardenings — token *values* unchanged everywhere; the only `out/*` delta
  is two lines of harbor's **decisions-log prose** (L-07, additive rationale, same class as the M-03/05/06
  notes) + the regenerated `modes-report.md`; `out/figma` untouched. **L-06** — gradient names now get the
  same slug charset + uniqueness guard palette names got in CR-03 (a dotted/spaced gradient name would break
  the `{a.b.c}` alias convention, caught only at emit if at all); RESERVED_PALETTES doesn't apply (gradients
  live in their own namespace). **L-07** — a brand-supplied status override seeds a **vivid, unanchored**
  ramp from its hue+chroma (not pinned at its measured lightness, unlike a brandColors accent). This is by
  design (a status role needs a full accessible ramp, not one swatch) but wasn't said; the note now flags
  that the measured swatch may not appear verbatim (harbor's success/warning notes gained the clause — the
  only shipped-brand output delta). **L-08** — two `design-md` parser gaps: the closing frontmatter fence is
  now an **exact** `---` line (the old `indexOf('\n---')` prefix match let a `--- x ---` value line close the
  block early and silently truncate the rest), and a **duplicate key** at one level now throws instead of
  silently last-winning. **L-09** — `--out` no longer swallows a following flag (`--out --fidelity` used to
  create a directory literally named `--fidelity`); a flag-like value fails loud. **L-11** — the web `slug()`
  string-coerces `id`, so a design.md pasted with a bare numeric `id:` no longer crashes both exports on
  `.trim()`. **L-15** — an unquoted `#hex` colour in a standard design.md (read as a YAML comment → null) now
  throws an actionable "quote it" error at the reader instead of a baffling `invalid hex 'null'` two layers
  down. **L-16** — `resolve-preview`'s `colors`/`byMode` are now typed `Partial<Record<ModeName,…>>` (matching
  the existing `dimOverrides`), so a consumer can't assume `.dark` exists on a narrowed-modes brand; every
  consumer already guarded with `?.`, so it's a type-honesty fix (web `tsc --noEmit` clean). Gates: `test.ts`
  **540/540** (528→540), emit-dtcg 647/646/640 aliases resolve + 248/248 contracts, nb-regression exit 0,
  web tsc clean, `out/figma` byte-identical, L-09 verified by driving the CLI both ways.

---

- **Code-review fixes L-01/02/03/05 — engine-core LOW (batch A)** (`modes.ts` / `color.ts` / `scale.ts` /
  `tree.ts`, `docs/16` LOW tier; starts the LOW-tier sweep after the MED tier completed at #59). Four
  silent-degradation guards, each byte-identical on the shipped brands (only `test.ts` gates + the four
  source files change; `out/*` untouched). **L-01** — the interactive-state `walk` clamped an overshoot
  to the ramp's terminal step, so at a ramp end hover(+1) and pressed(+2) collapsed onto the SAME step:
  visually indistinguishable states (each state's contrast was gated, their mutual distinctness never
  was). It now reflects inward on overshoot, preserving the step-count separation; a new invariant asserts
  default≠hover≠pressed for every fill/action/link group across all extreme brands × modes — only the
  near-black `t-dark` brand's HC modes actually saturated, and reflection kept every contrast contract
  green. **L-02** — `dualContrastWindow(r)` returned an inverted `[min>max]` window for r>√21≈4.58 (the
  max ratio any single luminance clears on BOTH extremes); it now throws, so a future HC-7:1 caller
  fails loud instead of reading an empty range as valid. **L-03** — `radiusScale` gained a weak-
  monotonicity tripwire (none≤sm≤md≤lg); equality stays legal (scale=0 collapses to sharp by design, small
  scales quantise onto the 2px grid), but a future non-monotone ladder edit throws. **L-05** — `pxOf` is
  now rem-aware (a `1.5rem` leaf scales ×16 instead of `parseInt`→1px), and `deref` returns `undefined` on
  a cyclic/runaway alias chain (reports missing) rather than a mid-chain alias node. Gates: `test.ts`
  **528/528** (452→528, +76 mostly the cross-brand distinctness invariant), nb-regression exit 0, `out/*`
  + `out/figma` byte-identical. **L-04 deferred (documented):** semantic borders' SC 1.4.11 contract is
  against `background.primary` only (narrower sibling of the fixed CR-02) — extending it to the worst-case
  tinted surface would change emitted border colours and touch `out/figma` (the Figma-emitter thread's
  surface), so it's left as a documented gap, consistent with the byte-identity + coordination discipline.

---

- **Code-review fixes M-10/M-11 — metadata / gate completeness** (`ai-metadata.ts` / `tree.ts`, `docs/16`
  MED tier; **completes the code-review MED tier in the generator/web lane**): two "the index/gate doesn't
  see non-`$value` refs" blind spots. **M-11** — buildTree's alias-resolution walk validated `$value`,
  composite sub-values, and mode-override `$value` refs, but NOT a fluid composite's
  `$extensions.prism3.responsive.{min,max}.ref`, so a ladder edit could ship a dangling
  `{root.font.size.NN}` while the alias gate reported clean. The walk now collects fluid refs too (alias
  totals rose to nb 647 / aurora 646 / harbor 640, all resolve); gate: an independent full-tree ref-count
  must equal `stats.aliases`. **M-10** — the `.ai.json` `aliased_by` reverse index was built from `$value`
  refs only, so a primitive consumed SOLELY by a dark/HC override showed zero consumers (contradicting the
  sidecar's own "cannot drift" note). An `allRefsOf` now collects `$value` + mode-override + fluid refs;
  purely additive (new `aliased_by` ⊇ old for every primitive — 0 dropped, 53 grew on nb). First tests of
  the previously-ungated sidecar. Gates: test **452/452**, nb-regression exit 0, token colours +
  `out/figma` byte-identical (M-11 validation-only; M-10 enriches `*.ai.json` only).
- **`emit-figma` — hide primitives from library consumers + thread DTCG
  descriptions into every Figma variable** (`engine/emit-figma.ts` +
  `engine/test.ts` block 23, 2026-07-04). Primitives (palette + dimension +
  opacity + font/family + font/size + font/weight — 217 variables in NB)
  now carry `hiddenFromPublishing: true`, so a file that subscribes to this
  as a design-token library only sees the SEMANTIC layer in the picker
  (color/space/radius/size/border-width/focus/layout/font-fluid/
  font/weight-role — 349 variables in NB). Scopes stay at their real
  role-family targets across every tier — Figma's Plugin API rejects
  non-matching scopes ("Invalid scope for this variable type" if you try
  `TEXT_CONTENT` on a COLOR/FLOAT var), and `scopes: []` is documented +
  probe-verified as ALL_SCOPES (setBoundVariableForPaint succeeds on a var
  with scopes=[]), so there is NO scopes-based mechanism to hide primitives
  from LOCAL pickers in the definer file. Production discipline: publish
  tokens as a library, author components in a separate consumer file, and
  hidden-from-publishing narrows the picker end-to-end. Also **threads
  `$description`**: every emit-figma variable's `description` now reads
  from the DTCG leaf's `$description` (the source-of-truth prose that
  already lived in `nb.tokens.json` + `nb.ai.json`). Font/family
  descriptions retain the fixture's stack line (fix #4) and append the
  DTCG description. Semantic-tier bytes are unchanged except the new
  descriptions; primitive-tier bytes gain `hiddenFromPublishing: true` +
  descriptions. Fixture-match gates hold (scopes match the frozen Token
  Press export exactly; the fixture never carried hide/description fields,
  and emit-figma now adds them separately-tracked). New block 23 gates
  the intent: 217 primitives hidden + 349 semantics not hidden + zero
  empty descriptions + spot-check descriptions equal their DTCG source +
  emit determinism. **Materialised to Figma via MCP (2026-07-04):**
  re-imported `wireframe-demo/*` with the new policy — palette flagged
  hidden, all 18 vars carrying prose descriptions — and re-rendered the
  two-column light↔wireframe specimen (screenshot at
  `Prism3/docs/assets/hidden-primitives-specimen.png`). Gates: test
  **621/621** (rebased onto the emitter-thread merges — #73 `core-*`
  collection rename, #74 CR-08 layout-per-breakpoint, #75 M-08/M-09
  parseColor + space-alias — so the primitive collections read
  `core-palette`/`core-dimension`/`core-font`, the aurora layout keeps its
  `xs` breakpoint, and the hex-brand alpha ramps stay correct; block-23's
  7 intent gates union with the consumption-eval blocks);
  nb-regression clean (ΔE00 1.95); emit-dtcg 248/248 contrasts per brand,
  every alias resolves; `out/figma/*` regenerated from scratch on the new
  baseline (primitives gain `hiddenFromPublishing` + descriptions; semantics
  gain descriptions), byte-identical on regen.
- **`emit-figma` wireframe axis — materialise-to-verify** (`Prism3/docs/assets/
  wireframe-specimen.png`, 2026-07-04): closes the parked visual-verification
  follow-up from #53 (Pillar 1b wireframe axis). Motion re-probed first —
  `TIME` still absent from the Figma FLOAT-var scope enum
  (`ALL_SCOPES / CORNER_RADIUS / WIDTH_HEIGHT / GAP / OPACITY / STROKE_FLOAT /
  EFFECT_FLOAT / FONT_WEIGHT / FONT_SIZE / LINE_HEIGHT / LETTER_SPACING /
  PARAGRAPH_SPACING / PARAGRAPH_INDENT / TEXT_CONTENT`); motion stays deferred.
  Materialised the wireframe axis into the Prism3 Test File via figma-console
  MCP on a specimen slice (7 palette primitives + 6 role vars × 2 modes + 5
  radius vars × 2 modes, namespaced `wireframe-demo/*`). A two-column frame
  flips the SAME structural layer tree between `light` and `wireframe` via
  `setExplicitVariableModeForCollection`, and Figma's alias engine resolves
  the flip live: `color/foreground/brand` violet → grey,
  `color/action/default` azure → grey, `radius.md/lg/round` positive → 0. The
  neutral roles (`background`, `text/primary`, `foreground/primary`, `border/
  primary`) stay identical in both columns as expected (Pillar 1b passthrough
  rule). This is the first end-to-end visual proof of the wireframe axis —
  the structural gates (test.ts block 22) prove the artefact shape, the
  specimen proves Figma's runtime resolves them. Docs-only: `docs/00` +
  `docs/10` updated; screenshot added under `docs/assets/`; engine untouched
  (test **448/448**, `out/*` byte-identical). The aurora + wendys
  full-materialise from #50 remains parked (separate PR — heavier scope).
- **Code-review fixes M-15/16/17 — web failing-state robustness** (`web/src/main.ts`, `docs/16` MED tier):
  three UX defects when a live edit doesn't resolve. **M-15** — exports ran off the live `brandState`, so
  tokens.json re-ran `brandTheme` uncaught (a failing edit threw in the click handler → no download, no
  feedback) and design.md serialized a brief its own importer rejects; both now export the **last-good**
  input/theme (always valid, re-importable, and exactly what the ramps already show). **M-16** — ramps
  paint from the last-good theme but the anchor badge computed from the live (maybe-failing) state → wrong
  swatch flagged; now a `lastGoodInput` (cloned on each successful rebuild) drives `anchorStepFor`.
  **M-17** — an import error rebuilt the menu with a fresh empty textarea (and a mode-toggle mid-paste did
  too), wiping the paste; `importText` now survives re-renders, cleared only on a successful load.
  **Verified headless** (forced failing state = accent renamed to reserved `neutral`): both exports
  download without crashing, the accent ramp keeps its anchor badge, a garbage paste shows the error +
  retains the text across a re-render; web typecheck + build clean, 0 page errors. No automated gate — the
  honest gate is a headless web-smoke harness, still the pending infra task first flagged for CR-07.
- **Code-review fixes M-12/13/14 — parser/CLI hardening** (`classify-colors.ts` / `color.ts` / `cli.ts`
  / `standard-design-md.ts` / `emit-dtcg.ts`, `docs/16` MED tier): three silent-crash / silent-drop paths
  in the standard-`design.md` ingest. **M-12** — the colour classifier lowercased for *classification*
  (`roleOf`) but extracted anchors with literal lowercase keys, so `{ Primary: … }` / `{ Error: … }`
  classified right yet dropped the anchor (or threw "no primary"). Now a lowercase-role→hex map (with the
  original token kept for mark/log) drives extraction — case-insensitive end to end. **M-13** — `hexToRgb`
  rejected 8-digit alpha hex (`#C8102EFF`, common in real extractions) as "invalid hex", and `cli.ts`'s
  `standardToBrandInput` call sat outside any try/catch → raw stack trace. Now `hexToRgb` accepts
  `#RGBA`/`#RRGGBBAA` and drops the (opaque-anchor-irrelevant) alpha, and the CLI wraps the classify call
  → readable diagnosis + exit 1 (verified: a no-primary brief prints "✖ could not classify …" and exits 1).
  **M-14** — `Number('soft')` → NaN passed `typeof === 'number'` + every min/max compare → NaNpx radius.
  Rejected at ingest (specific message) *and* hardened the validator's number/integer branch to require
  `Number.isFinite` (backstop for any number field). Gates: test **448/448**, nb-regression exit 0, `out/*`
  byte-identical (all three are CLI-ingest paths, not the committed brands).
- **Code-review fixes M-05/M-06 — theme-layer semantics** (`theme.ts`, `docs/16` MED tier): two
  brand-semantic defects in the danger/action carve. **M-05** — `inRedTerritory` was hue-only, so a
  warm greige primary (`c:0.03, h:30`) counted as "red" and `danger` reused the near-grey primary ramp
  → destructive signalling collapsed to a near-neutral (and `h:47` vs `h:47.5` flipped the strategy with
  no note). Fix: `inRedTerritory(hue, chroma)` now also requires `chroma ≥ RED_CHROMA_FLOOR (0.08)` — a
  red-ish-but-desaturated primary carves a real saturated red; the two carve reasons + a knife-edge
  boundary note are logged. **M-06** — `roleAnchorStep.action` was `primary ? anchorStep : 500`, so a
  non-primary `actionPalette` (a named accent) got the hardcoded 500 pivot, never its own pinned shade,
  while `nbTheme` anchors action at 550 (its accent step) — the white-label path diverged from the
  regression's own semantics. Fix: a brandColor `actionPalette` anchors the action at that accent's own
  step (`autoPlaceStep` of its L); `pickBrand` still nudges to clear AA, so a11y is preserved. Investigated
  the finding's "needs an owner ruling" flag → **byte-identical for committed brand colours** (aurora's
  accent coincidentally pins at 500; only decisions notes added), no a11y downside, aligns the engine with
  itself — a strict improvement, applied. Gates: test **439/439**, nb-regression exit 0, `out/*` colours
  byte-identical.
- **Code-review fixes M-01/02/03 — adversarial-anchor ramp hardening** (`ramp.ts`/`theme.ts`,
  `docs/16` MED tier): three ramp-generation edge cases where a pathological anchor produced silent
  garbage. **M-01** — `chromaForL` divided by `(lMax−peakL)`/`(peakL−lMin)`; an anchor L at lMax pinned
  at a non-top step made the top steps hit 0/0 → `#NaNNaNNaN` (10 steps in the probe). Guarded both
  spans; added a hex-shape gate (every step is `#rrggbb`). **M-02** — the anchor L is written verbatim
  *after* the knot monotonic-clamp, so an anchor whose lightness disagrees with its step (e.g. L=0.985 at
  step 50) left the ramp non-monotonic (step 50 lighter than 25), which the mode pickers misread. Added a
  post-generation guard that throws on any light→dark inversion (a consistent anchor via autoPlaceStep
  never trips it). **M-03** — an out-of-gamut anchor can't render exactly; `oklchToRgb`'s independent
  channel clamp silently shifts L *and* hue (aurora accent drifts h 2.5°, L +0.04), and the old
  anchor-ΔE gate compared two identically-clipped values (tautological). Fixed **coordination-safe**:
  `brandTheme` now surfaces every out-of-gamut pinned anchor in the decisions log (aurora `accent`,
  harbor `primary`) — rendering unchanged, no colour or `out/figma` ripple, only the note added; gate
  measures real rendered-vs-requested drift. **Deferred upgrade:** a constant-hue chroma *projection*
  (preserve L+hue, project C to the boundary) is the stronger fix but changes those brand colours and
  needs an all-emitter regen incl. `out/figma` — the Figma agent's surface with #53 in flight — so it's
  held for a coordinated change. Gates: test **414/414**, nb-regression exit 0, `out/*` colours
  byte-identical.
- **`emit-figma` — wireframe axis** (`engine/emit-figma.ts` + `test.ts` block 22, 2026-07-04):
  first mode-varying materialisation post-#50; unlocks Pillar 1b end-to-end in the Figma
  target. **Colour:** `'wireframe'` added to `COLOR_MODES` (canonical position: last); the
  existing intersection with `theme.modes` picks it up and the per-role alias comes from
  `$extensions.prism3.modes.wireframe.$value` — zero extra adapter body. **Radius:** first
  non-colour/shadow axis to be mode-varying — `buildFigmaDims` returns
  `radius: FigmaCollectionFile[]` (per-mode files, same shape as `color`). A non-wireframe
  brand emits a single `radius.json` (byte-identical to the pre-1b world); a
  wireframe-opted brand emits `radius.Default.json` + `radius.wireframe.json`, non-zero
  radii aliasing `dimension/0` and `radius.none` unchanged. No example brand opts in
  today; gated against a synthetic wireframe brand (same pattern as blocks 18 + 20).
  Gates: **400/400** (+16 wireframe: five colour-axis + eleven radius-axis + one drift
  fence), nb-regression ΔE00 1.95, emit-dtcg 248/248, default `out/figma/*`
  byte-identical (verified). Load-bearing precedent for any future mode-varying geometry.
- **Code-review fix CR-05 — design.md parser silently dropped misindented lines** (`design-md.ts`): the
  YAML-subset parser's `map`/`seq` loops run `while lines[pos].indent === indent`, so a line whose indent
  doesn't fit its block (one stray space) — or a no-colon/prose line (`if (ci < 0) break`) — ended the loop
  early and left that line **and everything after it** unparsed, with **zero diagnostics**: a designer's
  lever (or a whole trailing section) just vanished, and if the dropped key was optional the engine emitted
  defaults silently. Fix: track a 1-based source line per `Line`, and after parsing **throw if any line was
  left unconsumed**, naming the offending line number + content ("unparseable frontmatter at line N …").
  Loud failure instead of silent drop. Verified: the finding's exact probes now throw — a `chroma:`
  over-indented one space (drops `chroma` + trailing `radiusScale`) and a stray prose line (truncates the
  rest) — while the correctly-indented equivalents still parse byte-identically. The web import already
  try/catches `parseDesignMd`, so it now surfaces the error and keeps the working brand (better UX, no web
  change). Gate: adversarial parser suite (over-indent / stray-line throw with a line number; valid parses
  clean). test **368/368**, `out/*` byte-identical. **This clears the engine/web HIGH tier** (CR-01/03/04/
  05/06/07); CR-08 + the emit-figma MEDs remain with the Figma-emitter agent.
- **Code-review fix CR-04 — hand-rolled schema validator ignored keyword classes** (`emit-dtcg.ts`
  + `theme-schema.json`): the validator (the boot check for the CLI *and* the sandbox hosts) had no
  `boolean` branch (so `{type:boolean}` matched anything — incl. inside a `oneOf`, which is why
  `gradients:"banana"` passed → `brandTheme` then crashed on `.map`), checked `enum` only under
  `type:string` (numeric `titleFloor:[16,18]` unenforced), and never checked `minItems`/`maxItems`.
  So `[schema] ✓ conforms` actively vouched for inputs the schema rejects. Fix: added `boolean` +
  `integer` branches, moved `enum`/`const` to a **type-independent** check, added `minItems`/`maxItems`,
  and a **loud-fail guard** — an unhandled `type` now throws instead of silently passing, so the
  silent-ignore class can't recur. **The stricter validator immediately exposed a real schema↔engine
  drift** (the finding's 2nd probe): `families.variable` was declared `boolean`, but the engine's
  `BrandInput` accepts `boolean | Partial<Record<'display'|'text'|'mono', boolean>>` and **aurora uses
  the per-face object** — so the schema was mis-describing the contract. Corrected the schema to the
  real `oneOf[boolean, per-face-object]`; all three example brands conform again. Gate: adversarial
  validator suite (`gradients:"banana"` / `titleFloor:17` / short `easingEmphasized` / `variable:"yes"`
  all rejected; valid forms incl. the per-face object accepted). test **364/364**, `out/*`
  byte-identical (validation-only; no token change). *A stronger validator also backstops CR-03/CR-05.*
- **Code-review fix CR-06 — the NB regression can now fail** (`nb-regression.ts`): it was a pure report
  generator — ΔE00 outliers, contract failures, and dimension mismatches rendered as ⚠️/❌ markdown rows and
  it **always exited 0**, so a ramp-math regression shipped green (only a human reading the report noticed),
  and its ≤3 verdict was a *mean-of-means* (a single ΔE-15 step hides under a good aggregate). Fix: a real
  gate that sets `process.exitCode = 1` on any of — (1) a **per-step ΔE00 ceiling** (3.5 bar) with the NB
  hand-nudges enumerated in a `KNOWN_OUTLIERS` allowlist (each with its own ceiling, so a *new* regression at
  those steps still trips; replaces the static "known kink" prose that would have masked a fresh bug with the
  same signature — finding (c)); (2) a **covered-count assertion** (20 steps/palette — a truncated/renamed
  fixture → 0/0 NaN can no longer slip through — finding (a)); (3) any **contrast contract** fail; (4) any
  **dimension** mismatch. Also hardened `specs[0]`/`specs[3]` → lookup-by-palette (L-12) so a spec-order
  change can't point the contract gate at the wrong ramp. **Verified both directions:** current engine PASSES
  (exit 0 — every step within ceiling, 4×20 covered, 11/11 contracts, 23/23 dims); a simulated regression
  (amber.600 ceiling forced below its real 9.15) FAILS with exit 1 and a precise per-step message. test
  355/355 (unaffected — test.ts doesn't run this), `out/*` byte-identical.
- **Code-review fix CR-03 — brandColors palette-name guard (reserved / charset / duplicate)** (`theme.ts`):
  brand-colour names were unvalidated, and the palette map is last-wins (`new Map(palettes)` /
  `palette[name] = node`) — so a brandColor named `neutral`/`primary` silently **replaced** the engine
  ramp the whole surface model builds on, a status name (`success`/`danger`) was itself replaced by the
  later-pushed status ramp, and dotted/spaced/symbol names broke `{root.palette.…}` alias paths; contrast
  picks then recomputed against the corrupted map and passed self-consistently (green gates, nonsense
  output). Fix: `brandTheme()` now validates each `brandColors[].name` up front — rejects the 10 reserved
  engine palette names (`primary`/`neutral`/`success`/`warning`/`info`/`danger`/`white`/`black`/
  `*-alpha`), enforces the `^[a-z][a-z0-9-]*$` slug (also closes CR-07's XSS vector at the source — an
  HTML-metachar name can't validate), and rejects duplicates. Matches the existing `root`/`actionPalette`
  throw-at-boundary pattern, so the web import/rename path inherits it (rebuild fails → last-good kept).
  Added a schema `pattern` on the name (belt-and-suspenders; enforced by `validateBrandInput`). Gate:
  adversarial-name suite in the namespace block (reserved/dotted/spaced/symbol/duplicate all throw; a
  valid slug is accepted; schema half agrees). Gates: test **355/355**, `out/*` byte-identical (aurora's
  `accent` is valid — no valid brand changes), nb-regression clean. *L-06 (gradient names) is the adjacent
  LOW finding — same class, left for its own pass.*
- **Code-review fix CR-07 — web XSS: brand palette name reached `innerHTML`** (`web/src/main.ts:146`):
  the ramp anchor label built its markup with `meta.innerHTML = \`anchor <b>${name}…\``, and `name` is a
  brand-controlled `brandColors[].name` (pasted `design.md` / accent rename, no charset validation — CR-03).
  A name like `x</b><img src=q onerror=…>` executed on the next ramp paint. Fix: build the label with
  `el()`/`textContent` + a text node (the idiom the rest of the file already uses), never `innerHTML`.
  **Verified headless:** added a 2nd accent named with a tag-breaking `<img onerror>` payload (so the theme
  rebuilds cleanly), confirmed it reaches line 146 and renders as **literal text** — `<b>`.textContent is the
  raw string, 0 `<img>` elements in the doc, `window.__xss` never set, no dialog. Web typecheck + build clean.
  *Gate:* the honest gate is a headless web behavioural-smoke harness (gate blind-spot #8, also covers
  M-15/16/17); the repo has no web test runner yet, so that harness is a separate infra task — noted, not
  built here, to keep the fix surgical. The `readout.innerHTML` at `:283` is NOT a sink (`<input type=color>`
  value is browser-constrained `#rrggbb`); `visualize.ts` `esc()` gaps are the separate LOW finding L-10.
- **Code-review fix CR-01 — `contrast()` rounded before threshold comparison** (`color.ts` + emit
  boundaries; first of the project code-review backlog in `docs/16-code-review-findings.md`):
  `contrast()` did `Math.round(x*100)/100` *inside* the function, so every
  WCAG pass/fail compared the rounded ratio — a role at raw 6.9948 read 7.00 and **false-passed** a
  7:1 HC contract. Fix: `contrast()` returns the **raw** ratio; `ResolvedRole.ratio` holds raw (gates
  now compare un-rounded); rounding moved to the emit boundaries only (`tree.ts` role `contrast`/
  `contrastOnWhite`/gradient a11y, `ai-metadata.ts` `contrast_with`/gradient prose, `resolve-preview`
  splits raw-for-pass from rounded-for-display). Caught real shipped false-passes: **harbor** `hc-light`
  `success.700 @ 7.00` (raw 6.99) → corrected to `success.750 @ 8.43`; `on-success` cascaded 9.67→11.65.
  NB roles unaffected → `nb.tokens.json` + emit-figma NB output **byte-identical**; aurora byte-identical
  after the display-round fix. Added a regression gate (raw `#007ea1`/black = 4.4990 must read < 4.5;
  `contrast()` must not be pre-rounded). Gates: test **349/349**, nb-regression clean, emit-dtcg 622/622
  + 248/248, web typecheck clean. *One concern per PR + its gate, per the review's own guidance.*
- **Project code review — findings documented, nothing fixed** (`docs/16-code-review-findings.md`,
  2026-07-03): full-codebase review (engine + web + regression harness), baseline green first
  (336/336, out/* byte-identical). 8 HIGH + 18 MEDIUM + 17 LOW findings, headline: `contrast()`
  rounds before threshold comparison → WCAG false passes structurally invisible to the gates
  (probe-verified: raw 4.49898 reported as 4.50-pass); the contrast floor is two steps shallower
  than the shipped surface ladder; duplicate palette names silently hijack engine ramps; the
  schema validator ignores boolean/enum-on-number/minItems; the YAML parser silently drops
  misindented lines; nb-regression cannot fail (exit 0 always); web XSS via brandColors names;
  emit-figma layout crashes on non-5-breakpoint brands. Four cross-cutting themes: self-referential
  verification, NB-only structural gates, silent degradation over loud failure, validator weaker
  than schema. §5 lists the gate blind spots to close as fixes land — **one fix + its gate per PR**.
- **Pillar 1b — wireframe mode** (`modes.ts`/`theme.ts`/`tree.ts`, docs/11 Pillar 1b): `'wireframe'`
  is now a generated opt-in mode — a mechanical greyscale. `VALID_MODES` (five) splits from `ALL_MODES`
  (the default four, unchanged → four-mode golden byte-identical); wireframe is opt-in only, never a
  default. **Colour:** every *chromatic* role resolves on the **neutral** ramp at the position its colour
  pick would land, then re-nudged to clear the *same* min on neutral — so the greyscale still holds every
  contrast contract (verified: e.g. `foreground.brand` primary.550 → neutral.600, nudged one step to keep
  its 4.5:1 fill contract). Neutral/text/background/white/black roles pass through. **Geometry:** non-zero
  `radius.*` leaves gain `$extensions.prism3.modes.wireframe → {root.dimension.0}` — the *first* mode-varying
  geometry (same override shape colour/shadow use); `radius.none` stays override-free. Emit-figma
  coordination noted in the fresh-agent brief (radius collection needs a wireframe mode). Gates: test
  **344/344** (+8 wireframe: greyscale remap, radius→0, every wireframe contract holds), nb-regression +
  emit-dtcg `out/*` **byte-identical** (no example brand opts in), web typecheck clean.
- **Pillar 1b web — wireframe toggle + per-mode preview geometry** (`web/src/main.ts`,
  `resolve-preview.ts`): the brand menu gains a **Wireframe** toggle beside Dark/HC (`setModes`
  now takes a third flag, appends `wireframe` last = the engine's canonical mode order); the
  preview's mode selector extends to Wireframe automatically. Geometry is now per-mode:
  `resolvePreview` exposes **`dimOverrides`** (sparse — only refs/modes that differ from the
  canonical baseline, mirroring the tree's `$extensions.prism3.modes`), and `renderChip` reads
  `dimOverrides[ref]?.[mode] ?? dims[ref]` so wireframe squares off corners live. Verified
  headless: default 4 modes → enabling wireframe → 5 (Wireframe appended); a saturated Light
  chip `rgb(0,97,136)` collapses to the neutral `rgb(92,92,97)` (chroma spread 136 → 5) with
  radius 8px → 0px; 0 page errors. Gates: test **347/347** (+3 `dimOverrides`), web typecheck
  clean. No engine-value change (dims baseline untouched → nb-regression + `out/*` still
  byte-identical). Completes 1b end-to-end (engine + UI), mirroring the 1a #42→#43 split.
- **Deployment-target neutrality captured** (`docs/15-deployment-neutrality.md`): the owner named the
  likely *delivery* of the north star — an **AWS / Bedrock hosted E2E service** using **LLMs as needed**
  but with the **core staying pure deterministic code**. Recorded as an architectural *constraint*, not a
  build task: three layers (pure core / assistive-LLM edge / host+state edge), and the rule that hosting,
  persistence, auth, transport, and model calls live *outside* the core — LLMs propose inputs to and
  narrate outputs from the engine, never compute a token value inside it. AWS is just the next I/O shell;
  it validates the portable-core bet rather than changing it, and adds a *third* option for the export
  core (a hosted service Token Press calls, vs. a vendored package) — another reason the `12` vendoring
  call is safely deferrable. **The standing review check from here on: does a PR add I/O, state, or a
  model call to a pure module? If yes, it belongs in a shell.** Nothing to build; the line to hold.
- **Component-layer contract locked** (`docs/14-component-layer.md`, 2026-07-03): the owner's
  question — store components as data and build them in Figma on the fly, LLM-free, like
  variables — answered YES and captured as the architecture: definitions as type-checked data
  **seeded from the KB's ~40 component briefs (§15 schemas)** and **bound to the locked token
  names (docs/11)** so structure is brand/mode-invariant; write leg = an `emit-figma` component
  artifact executed by the B2 plugin via the Plugin API (REST can't create nodes; same two-route
  pattern as 08 §5); verify leg = **extraction diff** (Specs CLI verified extraction-only —
  its seat is the component-tier nb-regression, not the builder); ceilings incl. the
  **Figma Motion revision** (timing/easing variables now exist — the "transition = code-only"
  disposition in 05/10 is stale; KB 18–21 flagged for update). Build sequence: schema → 3
  components (Button/Text Field/Card) → artifact → materialize (MCP first, plugin after) →
  round-trip gate → scale. Doc-only; nothing built.
- **Inspirations log started** (`docs/13-inspirations.md`, 2026-07-03): reviews of external
  agent-first DS work — Astryx (Meta; CLI-as-agent-interface, typed `ComponentDoc` data files,
  `agent-docs` index injection, `--compact` tiers), the "ds-brain" practitioner stack map
  (docs-package-as-brain, generated skills/rules/indexes, **consumption-side evals**: rubric +
  invented-component rate + contamination-controlled trials), and Specs CLI (verified
  extraction-only). Convergence table at the end tracks patterns with multiple witnesses;
  identified gaps for us: `.ai.json` discovery layer, retrieval surface (CLI `query` / MCP),
  consumption evals. Doc-only change; no engine code touched.
- **Export-contract sequencing + Token Press eval** (`docs/12-token-press-monorepo-eval.md`): before
  building Pillar 4, two calls settled the order — (1) let the Figma-emitter agent **finish emit-figma**
  so the collection structure is stable (the shared `collections.ts` partition must mirror a settled
  reality), and (2) **decide whether the export *format core* moves into the monorepo** as a shared pure
  `@prism3/tokens-export` module both `emit-dtcg` and Token Press import — killing format drift by
  construction (recommended: **Option B**). `docs/12` is the hypothesis (from the Token Press handoff
  go/no-go. **Repo review complete (§9/§9c, 2026-07-03):** a Token-Press-side agent validated §7 against
  the real v2.3.1 source — Option B is *yellow* (separability/purity/presets ✅; composite *parity*
  ❌ refuted, the two outputs disagree today). Resolution: **pick the canonical shape first** — all five
  §9a shape decisions confirmed expressible against TP's source, with six refinements folded in
  (per-family format options, shared filename sanitizer, Prism3-side unfolder, `propertyAliases` option,
  core-owned `generator` block, +2–3d on the TP migration). Revised effort ≈ 2 weeks + 2–3d. Pillar 4's
  first line of code is gated on this (it sets the module boundary) + emit-figma + the owner's move
  decision; author it *at the shape boundary* regardless. Meanwhile **Wireframe (1b)** is independent and
  proceeds. *Next: build Pillar 4 at the shape boundary once emit-figma clears; Token Press move is a
  deferred, evidence-gated call.*
- **Pillar 1 web toggle — Dark/HC in brand setup** (`web/src/main.ts`): the brand menu gains a
  **Modes** control — `Light` fixed, `Dark`/`HC` toggles that write `brandState.modes` (HC adds
  hc-light, + hc-dark only when dark is on); `New brand` starts light-only. The engine re-resolves
  and the preview's mode selector narrows automatically (it iterates `rp.modes`); a dropped selected
  mode falls back to light. Verified headless: aurora 4 modes → Dark-off 2 → HC-off 1; New brand 1;
  0 page errors. No engine change; completes Pillar 1a end-to-end (engine + UI).
- **Pillar 1a — mode opt-out** (`theme.ts`/`modes.ts`/`tree.ts`, docs/11 Pillar 1): `BrandInput.modes`
  lets a brand decline dark/HC — `light` is the required base, `dark`/`hc-light`/`hc-dark` opt-in.
  `resolveAllModes` filters to `theme.modes`; the DTCG tree emits per-mode colour overrides only for
  opted-in modes (a light-only brand emits none); `resolvePreview`/the web mode switcher narrow
  automatically. Omitted → all four (back-compat, `out/*` byte-identical). Guards: must include light;
  unknown mode rejected (wireframe not yet a mode — that's 1b, spec in docs/11). Gates: test 323/323,
  nb-regression 1.95, emit-dtcg 248/248. *Next: the web toggle UI (Dark/HC in brand setup, light-only
  New-brand default) + wireframe (1b) + the export contract (Pillar 4).*
- **Multi-brand / mode-configurable VISION captured** (`docs/11-multi-brand-vision.md`): the
  enterprise north star — many brands over one *locked token-name contract* (names are the API;
  brands & modes are value-columns over it, swappable at runtime), modes the user can decline
  (light always; dark/HC/wireframe opt-in) or customize (light/dark accept an override layer, incl.
  a different dark CTA; HC/wireframe generate-only), and a **single export contract** so every exit
  (engine package / Figma emit / Token Press) yields the same by-collection × by-mode × by-brand
  artifact. Four pillars, phased: **mode config → export contract (pending Token Press eval) →
  override layer → brand families**. Not built yet — this is the plan. **Next: Pillar 1 (mode
  configurability).**
- **Web dashboard — preview on every stage + type specimen** (`web/src/main.ts`): the live
  component preview + contrast overlay (with the per-mode selector) now render on Semantic,
  Typography, AND Form — each reflects that stage's axis. Typography also gains a **type-scale
  specimen** (one composite per group at its resolved size, from `theme.typography`) so a
  `typeScale`/family/weight change is visible where the small component chips can't show it; the
  whole preview region is volatile so it repaints live. Stages 3–4 are now first-class. Engine
  untouched (312/312); web typecheck + build green; verified headless (specimen updates across
  compact/default/expressive, form preview present, 0 page errors).
- **Web dashboard — export** (`web/src/main.ts`): the brand menu gains an Export section —
  **design.md** (`toDesignMd`, #39) and **tokens.json** (resolved DTCG tree via `buildTree`,
  namespaced under the brand's `root`), both Blob-downloaded. Closes the E2E loop with the #38
  importer: verified in-browser that an exported `design.md` re-imports as the same brand (0 errors).
  Engine untouched (312/312); web typecheck + build green.
- **Web dashboard — brand setup** (`web/src/main.ts`): the brand selector is now a menu —
  switch example brands, **New brand** (minimal known-good starter), **Import design.md** (pasted
  `design.md` → `parseDesignMd` → loaded, guarded by a `brandTheme` accept-check; the working brand
  is untouched until it passes), and per-brand **Name** + **Namespace (`root`, #34)** fields (root
  validated inline). Lights up the `design.md` *import* leg of the E2E loop and gives #34's namespace
  a UI. Engine untouched (307/307); web typecheck + build green; verified headless (menu, new, import,
  namespace-valid/invalid — 0 page errors).
- **Web dashboard — staged four-stage shell + Stage 1 redesign** (`web/src/main.ts`): the approved
  design direction ported to the live app. Build order primitives → semantic → type → form; Stage 1
  is bespoke (scalable brand-colour list, generated ramps off `brandTheme().palettes`, and a neutral
  **Derive⇄Pin** toggle that surfaces the engine's `neutral.anchor`). Contextual per-mode selector on
  the Semantic stage; colour edits repaint only the volatile region. Engine untouched (307/307).
- **`emit-figma` — shadow + gradient** (`engine/emit-figma.ts` + `test.ts` block 14): styles,
  not variables (docs/08 §5 variable-type ceiling). **Shadow emits TWO style sets per step**
  (`shadow/xs..2xl + shadow/inset` for light-mode canonical; `shadow-dark/xs..2xl +
  shadow-dark/inset` for the reduced-alpha dark surface-lift pattern) — Figma Effect Styles
  don't support modes natively, so a plugin/component swaps the pair at mode transition.
  Every effect layer parsed to Figma primitives: DROP_SHADOW / INNER_SHADOW, {r,g,b,a} float32,
  offset/radius/spread, blendMode NORMAL. NB → 14 Effect Styles. **Gradient is opt-in**: NB has
  none (empty styles[], consistent shape), aurora emits 2 Paint Styles (brand + glow), each
  with 2 canonical alias-driven stops + 5 `sampledStops` (sRGB pre-sample of the OKLCH curve,
  since Figma interpolates in sRGB only) + a11y worst-on-white/black ratios (text-on-gradient
  contract). **Materialised to Figma via MCP** — 14 Effect Styles rendered on a two-row
  (light/dark) shadow specimen; 2 Paint Styles rendered as violet-azure linear + violet-glow
  radial swatches (aurora palette not yet imported, so demo uses sampledStops hex values —
  alias-driven form lands with the generalise pass). 14 new gates → `test.ts` **295/295**.
- **`emit-figma` — dims axis** (`engine/emit-figma.ts` + `test.ts` block 13): seven FLOAT
  variable collections (`dimension` primitives + `space`/`radius`/`size`/`border-width`/
  `focus`/`opacity` semantics — 94 vars total, 45 aliases). No fixtures (§2 covers only
  colour + typography), so gated structurally: variable counts match the DTCG tree, every
  alias resolves within the emitted collections, scopes narrow per family (space→GAP,
  radius→CORNER_RADIUS, etc.), opacity as PERCENT 0–100 (Figma OPACITY scope), focus's
  `strokeStyle` leaf skipped (no Figma variable primitive). **Materialised to Figma via MCP**
  — all 7 collections created, 45/45 aliases bound (incl. 3-level chains size→space→dimension);
  dims specimen renders geometry bindings on cornerRadius/width/height/padding*/opacity/
  strokeWeight; container fills bound to `color/background|foreground/*`. 16 new gates →
  `test.ts` **281/281**.
- **`emit-figma` — typography axis** (`engine/emit-figma.ts` + `test.ts` block 12): the
  `font` (38 vars) + `font-fluid.{desktop,mobile}` (10 vars/mode) variable collections
  byte-reproduce the NB fixtures, and 36 text styles apply the six §4 fixes (no `text/`
  wrapper, prescribed collection names, lineHeight PERCENT, letterSpacing PERCENT baked,
  primary family bound + full stack in description, fontStyle derived from weight-role via
  a named-instance table). Corrected the pre-fix `px-from-ratio`/`px-from-em` directive
  notes in `tree.ts` so an ad-hoc reader gets the current contract. **Materialised to Figma
  via MCP** — all 36 corrected styles bind fontFamily/fontSize/fontWeight to the real font
  vars, verification specimen renders on a fresh page with container fills bound to real
  `color/background|foreground/primary` (spike lesson). 25 new gates → `test.ts` **265/265**.
- **`emit-figma` — colour axis** (`engine/emit-figma.ts`): DTCG tree → Figma import artifact
  (`out/figma/nb/`), byte-reproduces the NB Figma fixtures (names/scopes/aliases exact). **Now
  handed off** — the Figma-emitter agent owns the rest (typography → remaining axes); see
  **`10-figma-materialization.md §6–7`** for that agent's remit.
- **Figma materialization contract + fixtures** (`10` + `fixtures/figma/nb/`) — the emit-figma
  spec + regression corpus, from two hand-run Figma-MCP import spikes.
- **Web dashboard** (`web/`, the monorepo's first host): renders knobs from the lever manifest +
  live preview + contrast overlay from `resolvePreview`; **colour + radius + type knobs are live**.
  *This thread's next work: deepen the dashboard, then the MCP adapter.*
- **Pure `tree.ts`** (buildTree extracted from the emit shell) → the browser hosts + emit-figma
  resolve the tree with no `node:`. **Lever manifest, preview spec, resolved-preview** — the shared
  contracts the surfaces render from.
- **`design.md` interchange + CLI** (dual-dialect) + the colour-role classifier + fidelity report.

Engine gates as of 2026-07-04: `test.ts` **430/430** (240 colour + 25 typography + 8 namespace + 16 dims + 14 shadow/gradient + 4 pin-a-neutral + 5 design.md-round-trip + 19 mode-config/wireframe + 13 emit-figma-layout + 3 dim-overrides + 10 emit-figma-mode-opt-out + 27 emit-figma-generalise + 21 code-review-HIGH-fixes CR-01/03/04/05 + 16 emit-figma-wireframe + 9 code-review-MED ramp-hardening M-01/02/03);
`emit-dtcg` 248/248 contracts per brand; `nb-regression` now a real gate (per-step ΔE ceilings + KNOWN_OUTLIERS, exits 1 on a fidelity regression — CR-06). The snapshot below is the
2026-07-01 token-layer baseline.

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
| Engine unit tests (colour math + extreme brands + typography + fluid + shadow + layout + gradient + surface-model + harshness + typography-weights/links + design.md-parser/CLI + standard-dialect/classifier/x-prism3 + lever-manifest↔schema drift + preview-spec binding-validity + resolved-preview contrast invariants) | **215/215** | (same engine) |
| Color primitives / dim grid emitted | 122 / 37 | 162 / 36 |
| Brand palettes / action source | red / **action = brand** (red) | primary+accent+… / **action = accent ≠ brand** |
| Form factor | comfortable / radius 1 (sharp) | compact / radius 2 (soft) |
| Emit profile | `nbds.*` / rgb | `prism.*` / hex |

Work now ships as **one PR per feature branch off `main`** (confirmed workflow).
All work through 2026-07-01 is merged to `main`.

**Structural work since the token layer completed (2026-07-01):**
- **`design.md` + CLI adapter shipped (build step A — the first adapter over the
  portable core).** A brand brief authored as YAML frontmatter (`engine/design-md.ts`,
  a dependency-free block-style YAML-subset parser + frontmatter/prose split)
  compiled by `engine/cli.ts` (`tsx cli.ts <design.md> [--out <dir>]`): parse →
  schema-validate → `brandTheme` (the pure core) → reuse the existing emit. No new
  token logic — `emit-dtcg.ts` now exports the reusable core (`buildTree` /
  `emitTheme` / `validateBrandInput`) and its two example brands are compiled
  **from** `examples/*.design.md`, so those files are the single source of truth.
  Two examples exercise complementary corners of the input space: `aurora.design.md`
  (**faithfulness** — reproduces the golden `out/aurora.tokens.json` **byte-for-byte**)
  and the net-new `harbor.design.md` (**coverage** — deep-teal, `action = primary`,
  warm-neutral greys + tinted page, measured status, comfortable/sharp, system
  stack + compact scale, gradients off; validated behaviourally: schema-conforms,
  622/622 aliases resolve, 248/248 contrasts hold). See `07-e2e-journey.md` §6.
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
│   ├── 07-e2e-journey.md            ← the designer↔developer↔agent pipeline; portable-core architecture; design.md; component layer (layers 2–3 of the AI stack)
│   ├── 08-theming-interfaces.md     ← the customization surfaces (plugin/playground/CLI/MCP/Figma-MCP); new-plugin + shared-lever-manifest decisions; two-route materialization; revised build sequence
│   ├── 09-architecture-and-repos.md ← platform architecture + repo/packaging (monorepo grown from prism3-tokens; web-dashboard-first); which of the owner's other plugins get absorbed vs stay downstream
│   ├── 10-figma-materialization.md  ← the emit-figma contract: exact Figma variable/style shape (proven by import spikes), colour + typography materialization rules, thread split; fixtures/figma/nb is the regression target
│   ├── 11-multi-brand-vision.md     ← the enterprise north star: many brands over one locked token-name contract; mode config → export contract → override layer → brand families
│   ├── 12-token-press-monorepo-eval.md ← the shared-export-core hypothesis (Option B: pure `@prism3/tokens-export` both emit-dtcg and Token Press import) + the §7 repo-review checklist → go/no-go gates Pillar 4
│   ├── 13-inspirations.md           ← field notes on external agent-first DS work (Astryx, ds-brain map, Specs CLI, …) — takeaways, gaps identified, convergence table
│   ├── 14-component-layer.md        ← the component-layer contract: components-as-data (seeded from the KB briefs, token-name-bound) → deterministic Figma materialization (plugin) + extraction-diff regression; LLM-optional by design
│   ├── 15-deployment-neutrality.md  ← deployment-target neutrality: pure core / assistive-LLM edge / host+state edge; the standing "no I/O, state, or model call in a pure module" review check
│   └── 16-code-review-findings.md   ← 2026-07-03 full-codebase review: the fix backlog (8 HIGH / 18 MED / 17 LOW, per-finding failure scenarios + gate coverage) + the gate blind-spot list (§5)
├── fixtures/
│   └── figma/nb/                    ← the NB import: palette + color×4 modes + font + font-fluid×2 (byte-reproduce targets) + text-styles (as-imported snapshot) — emit-figma's regression corpus (docs/10)
├── schema/
│   ├── theme-schema.json           ← the white-label BrandInput contract (JSON Schema; validated on every emit)
│   ├── theme-schema.example.json   ← a worked BrandInput (aurora) that conforms to the contract
│   ├── lever-manifest.json         ← generated: the shared-control contract (from levers.ts)
│   ├── preview-spec.json           ← generated: the shared live-preview spec (from preview.ts)
│   ├── example-brands.json         ← generated: parsed BrandInputs (aurora/harbor) the browser hosts boot from (from emit-brandinput.ts; the node-only design.md parser can't run in the sandbox)
│   └── nb-measured.json            ← NB regression measurement fixture (reverse-engineered anchors; a DIFFERENT shape, consumed only by nbTheme)
├── examples/                      ← authored brand briefs (design.md front door)
│   ├── aurora.design.md           ← faithfulness example (compiles to the aurora golden, byte-exact)
│   └── harbor.design.md           ← coverage example (net-new brand; behavioural acceptance)
└── engine/                         ← dependency-free TypeScript prototype
    ├── color.ts                    ← sRGB↔OKLCH, CIELAB, CIEDE2000, WCAG contrast, gamut-aware max chroma
    ├── design-md.ts               ← design.md parser: block-style YAML-subset → BrandInput + prose (pure, no I/O)
    ├── cli.ts                     ← CLI adapter: tsx cli.ts <design.md> [--out] — parse → validate → core → emit (I/O shell)
    ├── ramp.ts                     ← color ramp generation: exact anchor, 20 steps, chroma arc, 5 bands, contrast-role placement
    ├── scale.ts                    ← dimension axis: 4px grid + numbered space scale (8px rhythm) + radius + component sizes
    ├── theme.ts                    ← Theme builder: nbTheme() (measured) + brandTheme() (white-label: open brandColors[], action role decoupled from brand, status synthesis + danger carve + form factor)
    ├── modes.ts                    ← light/dark/hc-light/hc-dark, roles resolved by contrast target, brand-agnostic
    ├── nb-fixture.ts               ← I/O shell: reads the NB fixture off disk + defers to the pure core (keeps theme.ts Node-free / portable)
    ├── nb-regression.ts            ← diffs generated vs real NB, checks contracts → nb-regression-report.md
    ├── tree.ts                     ← the PURE DTCG token-tree builder: buildTree(theme) → full token tree (colour primitives + per-mode semantic aliases, dims, typography, shadow/gradient/motion) + contrast results + stats; also the shared PURE tree accessors (at/deref/pxOf/subNode/numOf/remPxOf/familyOf). No node:* (extracted from emit-dtcg so the browser hosts + emit-figma can resolve the tree without the I/O shell; docs/09)
    ├── emit-dtcg.ts                ← I/O shell over tree.ts: emits out/<id>.tokens.json per theme (NB + aurora + harbor, the last two compiled from examples/*.design.md) + modes-report.md; re-exports buildTree; EXPORTS emitTheme/validateBrandInput; validates aliases, mode contracts & BrandInput schema conformance
    ├── cli.ts                      ← CLI adapter: dual-dialect (engine-native + standard brand-skills design.md, auto-detected) → the core; --fidelity writes the report
    ├── standard-design-md.ts       ← reader + classifier→BrandInput (standardToBrandInput) + x-prism3 lever mapping for the STANDARD design.md dialect
    ├── classify-colors.ts          ← colour-role classifier: flat colors: hex map → engine anchors by naming convention
    ├── fidelity.ts                 ← full-parity fidelity report builder (observed vs generated; cli.ts --fidelity)
    ├── levers.ts                   ← the LEVER MANIFEST (PURE, no node:*): presentation contract for the BrandInput knobs (grouped/labelled/typed/ranged; 35 levers, 20 advanced); rendered by plugin/playground/MCP (docs/08 §4)
    ├── emit-levers.ts              ← I/O shell: writes schema/lever-manifest.json from the pure levers.ts (sandbox-portable split)
    ├── preview.ts                  ← the PREVIEW SPEC (PURE): sample components bound to semantic token paths + contrast pairs; plugin + playground render the same live preview from it (docs/08 §7 B1a)
    ├── emit-preview.ts             ← I/O shell: writes schema/preview-spec.json from the pure preview.ts
    ├── resolve-preview.ts          ← the RESOLVED-PREVIEW projection (PURE, docs/08 §7 B1b): resolvePreview(theme) → concrete colours per mode + live contrast overlay + dims (radius/space → px) + type (composite → family/weight/size, via the pure tree.ts buildTree); the runtime read-model surfaces consume
    ├── emit-brandinput.ts          ← I/O shell: writes schema/example-brands.json (parsed aurora/harbor BrandInputs) so the browser hosts boot from a VALIDATED brand without the node-only design.md parser (docs/09)
    ├── emit-figma.ts               ← I/O shell (docs/10): DTCG tree → Figma import artifact (out/figma/<id>/). COLOUR axis built — palette + color×4 modes, aliased, scopes derived from role family; reproduces fixtures/figma/nb exactly (names/scopes/aliases; values to float32 tol). Typography next
    ├── test.ts                     ← unit tests: colour-math invariants + 5 extreme-brand contracts + typography/shadow/layout/gradient/surface-model + harshness + typography + design.md-parser/CLI + standard-dialect/classifier/x-prism3 + lever-manifest↔schema drift + preview-spec binding-validity + resolved-preview contrast invariants + resolved dims/type validity + example-brands drift & all-green + emit-figma colour↔fixture reproduction (240 checks)
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
npx tsx Prism3/engine/emit-dtcg.ts       # emit DTCG + modes, validate (+ schema conformance) — NB + aurora + harbor
npx tsx Prism3/engine/test.ts            # unit tests: colour math + extreme-brand contracts + design.md/CLI + lever-manifest drift
npx tsx Prism3/engine/emit-levers.ts     # (re)emit schema/lever-manifest.json — the shared-control contract
npx tsx Prism3/engine/emit-preview.ts    # (re)emit schema/preview-spec.json — the shared live-preview spec
npx tsx Prism3/engine/emit-brandinput.ts # (re)emit schema/example-brands.json — the browser hosts' validated boot brands
npx tsx Prism3/engine/emit-figma.ts      # (re)emit out/figma/<id>/ — the Figma import artifact (colour axis; docs/10)
npx tsx Prism3/engine/visualize.ts       # regenerate the style-guide HTML (out/tokens.html)

# Web dashboard adapter (the monorepo's first rendering host — docs/09). NEEDS npm install (esbuild).
npm install && npm run -w @prism3/web dev     # esbuild dev server on http://127.0.0.1:5173
npm run -w @prism3/web build                  # bundle to web/dist/

# CLI adapter — theme an arbitrary brand brief:
npx tsx Prism3/engine/cli.ts Prism3/examples/harbor.design.md [--out <dir>]   # engine-native dialect
npx tsx Prism3/engine/cli.ts Prism3/examples/wendys.design.md --fidelity      # standard brand-skills dialect + fidelity report
```

---

## Decisions log (why things are the way they are)

- **`toDesignMd` — the `design.md` serializer (inverse of `parseDesignMd`) (2026-07-02).**
  Export needed a `BrandInput → design.md` direction; the module only had parse. Added `toDesignMd`
  to `design-md.ts` (pure, node-free — same portable-core fence as the parser, so the web bundle can
  import it). It emits each **defined** top-level key as a **one-line flow value** (`primary: { l, c, h }`,
  `brandColors: [{ name, oklch: {…} }]`), which the existing flow parser reads straight back — so
  `parseDesignMd(toDesignMd(x)).input` deep-equals `x`. Only own defined keys are emitted, so an omitted
  optional (no `root`) stays omitted (exact round-trip, no phantom keys). Strings are emitted bare unless
  they'd mis-type (numbers/bools/null) or carry structural chars, in which case quoted. Gated (test.ts
  block 17): round-trip identity for aurora + harbor + a synthetic brand (custom root + `neutral.anchor` +
  `brandColors` + `actionPalette`), omitted-optional stays omitted, prose survives the fence. This is the
  engine half of **export**; the web download UI (design.md + DTCG via `buildTree`) is the paired web PR.
  Pure addition — `out/*` byte-identical. Gates: test 312/312, nb-regression ΔE00 1.95, emit-dtcg 248/248.

- **Pin-a-neutral — a pre-defined brand grey can anchor the neutral ramp (2026-07-02).**
  The white-label neutral was *always* derived from a hue + peak chroma cast (`brandTheme` built it
  with no anchor, unlike primary/brand-colours which pin their exact OKLCH). Some clients ship a
  pre-defined neutral, so `BrandInput.neutral` now takes an optional `anchor: OKLCH`: when set, the
  ramp is built AROUND it — pinned verbatim at `autoPlaceStep(anchor.l)`, hue/chroma taken from the
  anchor — reusing the exact `generateRamp({ …, anchor })` mechanism the brand palettes already use
  (zero new ramp math). `neutral.hue`/`chroma` stay required (the derived readout / the UI's Derive
  mode); the anchor drives when present. `roleAnchorStep.neutral` stays 500 — that's the semantic
  neutral *role's* preferred step for contrast resolution, independent of where the pinned *primitive*
  lands. Surfaced as an optional advanced colour lever (`neutral.anchor`, "Pin a neutral") so the web
  UI can render a Derive⇄Pin toggle. Gated (test.ts block 16): the pinned grey is reproduced at its
  step (ΔE < 1), the derived ramp genuinely differs, and the pin flows through to the DTCG neutral
  primitive. Default output byte-identical (no example sets an anchor; `out/*` unchanged). *Deferred
  outlier:* a neutral kept as its OWN separate palette — expressible today via `brandColors`, no engine
  work, so not built. Gates: test 307/307, nb-regression ΔE00 1.95, emit-dtcg 248/248.
- **Namespace is a customizable lever — `root` on `BrandInput`, default placeholder `prism` (2026-07-02).**
  The emit namespace was hardcoded to `prism` in `brandTheme` (only the NB fixture used its own
  `nbds`). It's now `BrandInput.root` (optional, default `'prism'`): a single, mode-invariant token
  namespace, one segment only — every token emits under `<root>.*` (primitives `<root>.palette`,
  semantics `<root>.color`). Threaded through the one place that had leaked past `theme.root`
  (gradient stop aliases were hardcoded `prism` — fixed) and gated: a custom root re-homes **every**
  alias to `{<root>.…}` with zero `prism` leakage (test.ts block 15), a dotted/spaced root throws at
  the engine boundary *and* fails schema (added `pattern` support to the hand-rolled validator so the
  schema's `^[a-z][a-z0-9-]*$` is enforced, not decorative). `root` joins `id` in `identityFields`
  (host-supplied identity, not a lever-form knob). Default output is **byte-identical** (out/* did not
  change). *Rationale:* `prism` is a placeholder every engagement should override; making it a lever is
  the minimum change and keeps the single-brand-root invariant fully intact (see the "no two-segment /
  no removal *yet*" note below). Decisions: (A) **single segment, no two-segment** namespaces
  (`nbds.pds.*`-style) — the user's call; the legacy two-segment convention is not reproduced.
  (B) **Namespace is forced** — always present. Removing it entirely (un-prefixed `color.*`) is a
  *deferred* option, NOT built. When we revisit, the clean method is an **emit-time flatten**: keep the
  tree namespaced internally (so `Object.keys(tree)[0]`-as-root, the alias resolver, emit-figma, and
  resolve-preview all keep working unchanged), and drop the wrapping key + rewrite `{prism.x}`→`{x}`
  in every alias **at the `emit-dtcg`/`emit-figma` boundary only**. Do *not* model "none" as an empty
  `root` — that yields a `{ '': … }` key and malformed `{.palette.x}` aliases across ~8 sites. Tradeoff
  to weigh then: a namespace prevents collisions and preserves provenance when a brand's tokens are
  consumed alongside others (the multi-brand case this engine serves), and DTCG/Figma consumers expect
  a top group — so "none" is a deliberate, informed opt-out, never a default. (C) UI to set/change the
  namespace is a later web increment (brand-setup surface, alongside `id` — not the primitives page).
- **`emit-figma` colour axis built — byte-reproduces the NB Figma fixtures (2026-07-02).**
  First increment of the materialization adapter (`10 §5`): `engine/emit-figma.ts`, an I/O shell
  over the pure `tree.ts`, walks the DTCG tree → the Figma import artifact
  (`out/figma/nb/{palette,color.<mode>}.json`) — `palette` (122 primitives) + `color` (95
  semantics × 4 modes), every semantic a name-based `VARIABLE_ALIAS` into `palette`. The split
  the contract calls for holds in code: the DTCG carries the *semantic* facts (per-mode
  `aliasOf`), the adapter owns the *Figma-target rendering* (role-family→scopes, name transform,
  `rgb→{r,g,b,a}` via `Math.fround` for Figma's float32, two-pass alias-by-name; ids omitted,
  Figma assigns them). A `test.ts` gate reproduces `fixtures/figma/nb/` exactly — names, scopes,
  and every per-mode alias target (0 mismatches, all 4 modes), values to float32 tol (~5e-7);
  240/240. Scopes are derived in the adapter (the DTCG doesn't emit them) — correct per the
  contract, not a directive gap. *Rationale:* the colour axis was the spike-proven byte-target;
  now owned once + gated. Next: typography (`font`/`font-fluid` vars + text styles with the six
  §4 fixes), then the remaining axes + generalize.
- **Freeze the `emit-figma` contract + NB Figma fixtures as the regression target (2026-07-02).**
  Two hand-run Figma-MCP import spikes (colour, then typography) proved the engine's
  `$extensions.prism3.figma` directives are directly usable, so the DTCG→Figma translation is
  mechanical — the job is to *own it once* (`emit-figma`) rather than re-derive per agent (the
  `09` drift trap). Captured the real NB import as `fixtures/figma/nb/` (Token Press raw export:
  `palette` + `color`×4 modes; `font` + `font-fluid`×2 modes; a Plugin-API `text-styles` dump) and
  wrote the contract in `10-figma-materialization`. Two fixture classes: **byte-reproduce**
  (palette/color/font/font-fluid) and **reference-with-known-deltas** (`text-styles` is the
  *as-imported*/pre-fix snapshot — the six typography fixes are intentional deltas, so gate against
  the *corrected* expectation, not that file). Verified the engine reproduces the colour aliases
  exactly (action 550/450/700/300; background.secondary neutral.050/900) — a genuine
  byte-comparable target, same discipline as `nb-measured.json`. `emit-figma` reads the semantic
  facts (aliases, per-mode values, fluid modes, weight-role numerics) and **derives** the
  Figma-target rendering (scopes from role family, collection/style names, line-height %,
  letter-spacing binding, fontStyle→named-instance); the engine directives don't yet emit per-leaf
  `scopes`/`collection`, which is `emit-figma`'s to own. *Rationale:* the spikes' findings +
  owner's Token Press exports. Full contract + thread split in `10`. PR #27.
- **Platform packaging: monorepo grown from `prism3-tokens`, web dashboard first (2026-07-02).**
  Owner-locked answers to the "one engine, two hosts" packaging question (full shape in
  `09-architecture-and-repos`). (A) The web dashboard and Figma plugin are **two adapters over one
  core** — both import the same engine module and render from the shared lever manifest + preview
  spec + `resolvePreview`; continuity is structural, not a sync. (B) They live as packages **in this
  repo** (`web/`, `figma-plugin/` beside `Prism3/engine/`), not a fresh repo and not three published
  repos — one version, a lever change lands everywhere in one commit; `brand-skills`/`knowledge-base`
  stay their own repos. The "no build" invariant holds for the core (tsx); the *adapters* get a
  bundler (a browser/Figma bundle is a packaging step, not a port). (C) **Web dashboard first** —
  fastest loop, no sandbox constraints, cleanest proof the shared contracts drive a real UI; the
  Figma plugin then reuses the same renderer. **Plugin consolidation:** the three separate Figma
  plugins (theming, text-style, style-guide-generator) get their *function* absorbed into the new
  B2 plugin (never their code — each carries a separate brain); the **style-guide generator lays
  tokens out as frames on the Figma canvas** (canvas documentation — a distinct capability the
  `visualize.ts` HTML preview does *not* replace, so it's a B2 feature, not a retirement). Token
  Press (different org) + the CLI templating system stay **downstream, contract-connected** via DTCG
  output, never merged. *Rationale:* owner decisions — "grow prism3-tokens into a monorepo," "web
  dashboard [first]," + the style-guide-generator correction. Resolves the packaging question `08`
  raised but didn't settle. **Scaffold BUILT the same day:** root `package.json` (workspaces
  `["web"]`, `type: module`) + a `web/` esbuild + vanilla-DOM adapter that imports the pure
  engine modules and renders 15 manifest knobs + 22 preview chips + a 4-mode contrast overlay
  from `resolvePreview`; boots all-green (verified headless). New `emit-brandinput.ts` →
  `schema/example-brands.json` supplies the browser a validated boot brand (test-gated). Engine
  stays buildless (218/218); only the adapter bundles. Full layout in `09 §3`.
  **Interactive loop landed (PR #24):** the colour-axis knobs are LIVE — primary (colour
  picker → OKLCH anchor) + neutral hue/chroma + actionPalette mutate the in-memory `BrandInput`,
  re-run `brandTheme` + `resolvePreview`, and repaint the preview + overlay; a non-resolving
  combination is caught and surfaced.
  **Geometry/type-from-tree landed (PR #25 + B):** `buildTree` extracted to the pure `tree.ts`
  (PR #25); `resolvePreview` now also returns `dims` (radius/space → px) + `type` (composite →
  family/weight/size), resolved from the tree via shared pure accessors (also lifted out of
  `visualize.ts`). The chips render real radius/padding/type, and **`radiusScale` + `typeScale`
  are now live too** (6 live knobs). Density/motion/shadow stay read-only — the current chips
  don't render those axes. A `test.ts` gate asserts every dim → positive px and every type →
  family + positive size (220/220).
- **Dogfood the shared preview model in `visualize.ts` before building the hosts (2026-07-02).**
  Rather than take the leap straight from the B1a/B1b portable model to two new live hosts (DOM
  playground + Figma-node plugin) in a fresh repo, the static style-guide generator was made the
  first consumer of `previewSpec` + `resolvePreview(theme)` — it renders each component/variant from
  the resolved role colours + token-tree dims + resolved type composite, with the per-mode contrast
  overlay driven by the same `byMode.pass` results. *Rationale:* prove the "define once, render
  everywhere" contract composes a real UI + live overlay from one source **in-repo, behind the
  existing gates**, so the host renderers (B1c/B2/B3) start from a validated binding+overlay pattern
  instead of an unproven one. Additive and output-scoped (only `visualize.ts` + regenerated
  `out/tokens.html`; pure core untouched, tokens byte-identical, 215/215). PR #22.
- **Theming interfaces: new plugin + shared lever manifest (2026-07-01).** The customization
  surfaces (Figma plugin, web playground, CLI, MCP, Figma MCP) are five adapters over one core,
  not five products (`08-theming-interfaces`). Decisions: (A) the Prism3 Figma plugin is a **new**
  build on the engine core, not an evolution of the existing theming plugin — the core is reused
  (never re-implemented, the KB round-trip drift trap), the plugin is a fresh materialization +
  control shell that inherits every engine option and dissolves the existing plugin's namespace/
  options/font-weight pain points; (B) the web playground and Figma plugin aim for **near-continuity**
  — one shared **lever manifest** + live-preview model, not two hand-maintained UIs (two visual
  editors = two surfaces of drift). The manifest is the *presentation* half (labels/groups/UI
  ranges/knob type) that `theme-schema.json` (validation half) lacks; the plugin, playground, and
  MCP tool schema all render from it, so continuity is structural, not a manual sync. Materialization
  has two routes over the same output — plugin knobs (manual) and Figma MCP (agentic) — within the
  Figma variable-type ceilings (COLOR/FLOAT/STRING; typography→atoms+Text Style; shadow→Effect/code).
  *Rationale:* owner decisions — "build new on the new engine"; "strive for near-continuity, a lot is
  possible inside a Figma plugin." Resolves `07 §8` open decision #3. Full shape + build sequence in
  `08`; next increment is the lever manifest.
- **`design.md` is the E2E interchange contract; adopt the open spec (2026-07-01).**
  The pipeline tools (all owner-built: `brand-skills` extractor, this engine, Token Press,
  three *separate* Figma plugins, the CLI templating system) connect through **one shared
  format — `google-labs-code/design.md`** — which we follow, not fork. Decisions: (A) the
  engine **regenerates from anchors + emits a fidelity report** (NB-regression pattern) and
  does not trust extracted ramps as final; **one generator** — `brand-skills` *describes*
  (stays standalone-complete, so a brand-skills-only user still gets usable colours), the
  engine *generates* the verified system; the base file stays pure spec, engine-only levers
  via **defaults + an optional `x-prism3:` extension**; **align `brand-skills` type-role names
  to the engine's semantic vocabulary**. The one new parser piece is a **colour-role
  classifier** (flat `colors:` map → anchors by naming convention). Full contract in
  `07-e2e-journey.md` §11. Validated (real Wendy's `design.md`) that every anchor the engine
  needs is present. Next: a Wendy's spike before any step-A rework.
- **`design.md`: block-style YAML frontmatter + hand-rolled parser; the CLI reuses
  the emit core; examples are the single source of truth (2026-07-01).** The locked
  plan called for YAML frontmatter + a minimal parser; on build, a *block-style*
  subset (indentation nesting + `- ` sequences + flow `{}`/`[]` leaves) beat a
  flow-heavy minimal parser because the whole point of `design.md` is human- *and*
  agent-authorability, and the doc's own example uses block-at-top + flow-for-leaves
  (owner chose "what do you recommend"). Rather than let the CLI duplicate the emit
  pipeline, `emit-dtcg.ts` was made the home of the reusable core (`buildTree` /
  `emitTheme` / `validateBrandInput`) behind an `isMain` guard, and its example
  brands are compiled **from** `examples/*.design.md` — so "faithfulness" is
  structural (the golden IS generated from the brief) and the explicit byte-diff
  test is belt-and-suspenders. Harbor uses **warm-neutral greys** (neutral hue ~65)
  against its cool teal brand (owner decision) so the brief's "warm off-white page"
  is honest, not aspirational — the neutral ramp hue is independent of the brand
  hue, a real teal-brand-with-warm-greys pairing, and it genuinely exercises the
  surface floor-shift lever. *Rationale:* user decisions after surfacing both forks
  before building.
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

- **★ NOW — E2E integration (`07` §11).** The direction shifted from "build the next
  adapter" to "connect the tools we already own through the `design.md` contract." Two
  active tracks:
  - **Here (prism3-tokens): the Wendy's spike — ✅ DONE, then PROMOTED to the shipped CLI (2026-07-01).**
    A standard-`design.md` reader (`engine/standard-design-md.ts`) + colour-role classifier
    (`engine/classify-colors.ts`, the one genuinely new parser piece), run against a **real
    `brand-skills` Wendy's `design.md`** (`examples/wendys.design.md`, 24 colours + 25 type tokens)
    → a full token system (`out/wendys.tokens.json` + `.ai.json`) + a **full-parity fidelity report**
    (`engine/out/wendys-fidelity-report.md`). **Results:** anchor reproduced **ΔE00 0.00**
    (exact-anchor preservation), 627/627 aliases, 248/248 contrasts, `error`→`danger` carved as a
    distinct palette; primary/secondary/tertiary pin exactly; neutral ramp fits the 11 observed greys at
    mean ΔE00 <1.5 (derived hue/chroma); status hues pinned (L placed by the ramp); aggregate colour ΔE00
    **2.02** across 24 swatches — the ramp/status/neutral divergence is the point (Decision A). Every
    predicted alignment finding confirmed: type roles `mega-*`→`display`/`button-*`→`label`;
    `error`≡`primary-dark`, `info`≡`secondary` (observed dups the engine doesn't propagate); the file's
    stated `primary`-on-white "~4.6:1" is stale for its own `#C8102E` (engine measures **5.88:1**). The
    optional **`x-prism3` block** (§11.4) round-trips: the reader maps its levers → `BrandInput`
    (radiusScale/typeScale/density/motionTempo/actionPalette/iconContrast/surfaces/gradients); Wendy's
    carries no block → engine defaults (the plain-spec guarantee). **Promotion:** the reader + classifier
    are no longer spike-only — `cli.ts` now **auto-detects the dialect** (a top-level flat `colors:` map ⇒
    standard; else engine-native) and runs either through the same core, with `--fidelity` writing the
    report; `standardToBrandInput` (classify + families + x-prism3) and `fidelity.ts` (report builder)
    are the shared modules. The bespoke `spike-wendys.ts` runner was retired; its self-verify folded into
    `test.ts` (189 → **202**). Run: `npx tsx Prism3/engine/cli.ts Prism3/examples/wendys.design.md --fidelity`.
    This closes the round-trip: brand-skills emits `x-prism3`, the shipped engine CLI consumes it.
  - **brand-skills alignment — ✅ DONE (2026-07-01, this thread).** Implemented in `brand-skills`
    (branch `claude/prism3-e2e-integration-8fwul4`), across its three layers (schema → SKILL → CLI):
    (1) **type-role rename** — recommended typography names moved to the engine's vocabulary
    (`display/title/body/label/caption/eyebrow/code`), retiring `headline-*`; custom names still
    allowed + SKILL mapping guidance (`mega-*`→`display-*`, `button-*`→`label-*`). (2) **colour-role
    contract** — documented (no rename): the classifier convention + `error`→`danger` bridge (keep
    emitting `error`). (3) **optional `x-prism3:` block** — hand-authored in `surfaces.md`, passed
    through verbatim by `refresh-design` to a top-level `x-prism3` key; scoring-neutral (no new
    `.brand/` file, no manifest/health impact). Spec: `brand-skills/docs/superpowers/specs/
    2026-07-01-prism3-engine-alignment-design.md`. Tests 159 → 162 green; no version bump.
    **Token Press provisioning deferred** (private, different-org, export-stage — downstream).
- **A. `design.md` + CLI adapter — ✅ DONE (2026-07-01).** A brand brief
  (`design.md` frontmatter → `BrandInput`, prose for agent latitude) compiled by
  the CLI over the pure core. Proves the core-as-a-library and the authoring
  on-ramp in the easy Node environment before the Figma sandbox. No LLM required to
  use it; agent-draftable. **As built:** `engine/design-md.ts` (a dependency-free
  block-style YAML-subset parser — indentation nesting + block sequences + flow
  `{}`/`[]` leaves + scalar typing + frontmatter/prose split) → `BrandInput`,
  validated against `theme-schema.json`; `engine/cli.ts` (`tsx cli.ts <design.md>
  [--out <dir>]`) parses → validates → `brandTheme` → `emitTheme`, exiting non-zero
  on a schema violation, a broken alias, or a failed contrast contract.
  `emit-dtcg.ts` was refactored to **export the reusable core** (`buildTree` /
  `emitTheme` / `validateBrandInput`) behind an `isMain` guard, and now compiles
  both example brands **from** `examples/*.design.md` (single source of truth).
  `examples/aurora.design.md` is the **faithfulness** test — it reproduces
  `out/aurora.tokens.json` **byte-for-byte** (verified: empty `git diff`; the CLI
  path is byte-identical to the regression path); `examples/harbor.design.md` is
  the net-new **coverage** brand (deep-teal, `action = primary`, warm-neutral greys
  + tinted page, measured status, comfortable/sharp, system stack + compact scale,
  gradients off), validated behaviourally (schema-conforms, 622/622 aliases resolve,
  248/248 contrasts hold). Both are wired into `test.ts` (202/202). Full spec + lever
  table in `07-e2e-journey.md` §6. NOTE: the "~30 line parser" estimate in the
  locked plan was optimistic given the nested typography/gradients surface — the
  block-style parser is ~200 lines, still dependency-free and scoped to `BrandInput`.
- **★ NEXT — Theming interfaces (`08-theming-interfaces`, 2026-07-01).** The customization
  surfaces are now a committed shape, not a direction note. Locked: (1) a **NEW** Prism3 Figma
  plugin built on the engine core (not an evolution of the existing theming plugin — the core is
  reused, the plugin is a fresh materialization + control shell); (2) **near-continuity** between
  the Figma plugin and the web playground — one shared **lever manifest** + live-preview model,
  not two hand-maintained UIs. Revised build sequence (`08` §7):
  - **B0. Lever manifest — ✅ DONE (2026-07-01).** `engine/levers.ts` → `schema/lever-manifest.json`:
    the shared-control contract, **35 levers** across 7 groups (20 `advanced`), each with
    group/label/description/control (`color`/`slider`/`enum`/`toggle`/`list`/`palette-ref`/`object`)
    + defaults + UI ranges/enum options. The plugin, playground, and MCP tool schema all render from
    it — the *presentation* half that `theme-schema.json` (validation half) lacks. **Can't drift:**
    `test.ts` asserts every key resolves in the schema, every enum matches the schema enum (as a set),
    every default matches, and the committed JSON is up to date (208/208). **Pure — no `node:*`**
    (the plugin/playground/MCP bundle it into a browser/Figma sandbox); the write step is the
    `emit-levers.ts` I/O shell. `id` is host-supplied identity, not a lever; the gate asserts every
    *other* required field is a lever. Run `npx tsx Prism3/engine/emit-levers.ts`.
  - **B1a. Preview spec — ✅ DONE (2026-07-01).** `engine/preview.ts` → `schema/preview-spec.json`:
    a portable, data-only description of **8 sample components / 22 variants** (button + states,
    secondary button, input, card, alert per semantic, nav item, badge, type specimen), each binding
    UI props to root-relative semantic token paths + the contrast pairs to overlay (52 token refs).
    The plugin and playground render the SAME live preview from it (extracts the binding knowledge
    latent in `visualize.ts`). **Pure — no `node:*`** (write step = `emit-preview.ts`). **Gates
    (`test.ts`):** every referenced token path resolves to a real leaf in the emitted token tree
    (binding-validity), contract mins are sane, **no contract over-claims the engine guarantee**
    (declared min ≤ the engine's min for that role+surface — the PR #20 review hardening), committed
    JSON current (215/215). Run `npx tsx Prism3/engine/emit-preview.ts`.
  - **B1b. Resolved-preview projection — ✅ DONE (2026-07-01).** `engine/resolve-preview.ts`:
    `resolvePreview(theme)` — the runtime read-model the surfaces consume reactively. Projects the
    preview spec to **concrete colours per mode** (every referenced role → its hex in light/dark/
    hc-light/hc-dark) + **live contrast results** (each declared contract computed on the REAL
    resolved fg-on-bg, per mode, with pass/fail — the contrast overlay, `04`'s differentiator).
    **Pure — no `node:*`**: resolves via `resolveAllModes` (which now carries each role's `hex`,
    a small additive enrichment to `modes.ts`) + the pure spec, not `buildTree`. **Gate:** every
    referenced role resolves to a hex in every mode, and **every declared a11y contract actually
    holds on the resolved colours in all 4 modes** — the automated version of the PR #20 manual
    contrast check. 215/215; `out/*` unchanged (the `hex` field is emit-invisible). It's a
    per-live-theme read-model, not a committed artifact.
  - **B1 dogfood — ✅ DONE (2026-07-02, PR #22).** `engine/visualize.ts` now renders the shared
    preview model in-repo before the host renderers exist: for each brand it resolves `previewSpec`
    (B1a) + `resolvePreview(theme)` (B1b) and paints every component/variant as a styled chip —
    bg/text/border from the resolved role colours, radius/padding from the token tree, type from the
    resolved composite — with the per-mode L/D/HL/HD contrast overlay driven by the same `byMode.pass`
    results. Proves the "define once, render everywhere" model composes a real UI + live overlay from
    one source, de-risking the leap to a separate plugin/playground repo. **Additive, output-scoped:**
    only `visualize.ts` (+ regenerated `out/tokens.html`) changed; pure core untouched, `out/*.tokens.json`
    byte-identical, 215/215. **← next: B1c-proper — the host renderers (DOM playground + Figma-node
    plugin) that paint from the same `resolvePreview` output; land with B2/B3.**
  - **B1c. Host renderers** — the DOM (playground) + Figma-node (plugin) renderers that paint the
    components from `resolvePreview`'s output. The binding + overlay logic is now proven via the B1
    dogfood above; B1c ports it to the two live hosts. Land with B2/B3.
  - **B2. New Figma plugin shell** — bundles the core, renders knobs from the manifest,
    materialises via `$extensions.prism3.figma` (`08` §2/§5).
  - **B3. Web playground** — same manifest + preview, DOM/CSS-var host.
  - **Parallel validation:** Style Dictionary consumption (owner-driven) + **Figma-MCP import** of
    `out/*.tokens.json` (validates the Figma directives, de-risks plugin materialization, and
    unblocks Token Press testing — highest-value near-term).
- **C. MCP adapter** over the core — "an agent themes Prism3" as a callable surface
  (the KB's MCP-first payoff). Its tool schema derives from the B0 lever manifest.
- **D. (later) Component library** — components-as-data → Web Components + React +
  Storybook + `.ai.json` + Figma Code Connect (layers 2–3). In scope eventually;
  mapped now so upstream choices don't foreclose it. Heavy per-component research
  already in the KB (UIC series). **Architecture now locked in
  `14-component-layer.md`** (2026-07-03): definitions seeded from the KB's ~40
  component briefs, token-name-bound, deterministically materialized to Figma via
  the B2 plugin (write leg) with an extraction-diff regression (verify leg;
  Specs CLI's seat). Build sequence in `14` §6 — starts with the schema + 3
  components when this activates.

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
