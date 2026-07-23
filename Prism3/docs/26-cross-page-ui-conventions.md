# 26 — Cross-page UI conventions (dashboard rollout checklist)

> A **living checklist** of the page-agnostic decisions that came out of the Palettes restructure
> (#230–#232) and are being rolled out **page by page** across `web/src/main.ts`. The point: decide
> once here, then each page's rewrite follows the list instead of re-deriving (or re-litigating) the
> same calls. **Append freely** as new universal decisions surface. Design rationale lives in
> `23-dashboard-ia-and-component-system.md`; the component inventory + fix log in
> `24-ui-components-and-fixes.md`; this doc is the executable "apply this everywhere" contract.

Format: `- [ ] <rule> — <why / spec>`. Three tiers: **Universal** (every page), **Conditional** (only
where a value is authored/derived), and **Not-universal** (Palettes-specific — do *not* blanket-apply).

---

## Universal — apply to every page

### Structure
- **Section containers.** Each logical section sits in its own panel — `.psec`: `background:var(--panel)`,
  `1px solid var(--line)` border, `var(--r)` radius, subtle `box-shadow`, `20px 24px 22px` padding,
  `margin-top` between sections (`8px` for the first). This is the "containers around each section" the
  owner called out.
- **Section headers.** `.psec-t` (uppercase, 13px, weight 680, `--muted`) + a `.psec-d` sub-line (13px,
  `--faint`). One heading treatment everywhere — retires the older `sectionHead` / `.section-lab`
  divider style on restructured pages.
- **Full-width content; controls in a header *above*, never a side-car card *beside* it.** The fixed
  ~340px side-car (`primSection`) was what forced the 1120px overflow — removing it is the structural
  fix, not shrinking anything. Applies anywhere a page pairs controls with a specimen / ramp / table.
- **Overflow discipline.** Nothing bleeds past the 1120px content pane; wide content (tables, ramps)
  scrolls inside its own `overflow-x:auto` container — the page body never scrolls sideways.
- **Contrast checks live *in context*, with their section — not deferred to one table at the bottom.**
  Any section that carries contrast relationships shows its own contrast readout / mini-table right
  there, so the accessibility verdict sits beside the thing it judges (doc 23 §, per-section contrast
  work). The **Preview** tab's master contrast table is the *consolidated, cross-system* view —
  complementary to the in-context checks, **not** a substitute for them. (Palettes was the exception:
  primitives have no contrast pairs to judge, so no in-context table there — but every color/component
  page that does have contrast relationships gets them per-section.)

### Controls & labels
- **Labeled control fields.** Every control carries a small uppercase micro-label (`.pfk`: 9.5px,
  `letter-spacing`, `--faint`) — SOURCE, ANCHOR, HUE, … No bare, unlabeled controls.
- **Source-as-select.** A control with 3+ mutually-exclusive sources/modes uses a `select`; a binary may
  be a segmented control. (Palettes/Validation are the template.)
- **Reuse the component kit** (doc 24) — `selectEl`, `tokenPill`, `addButton`, `removeButton`,
  `renderCard`, `objEditor`. Don't hand-roll a one-off variant; extend the shared component.
- **Human-readable copy.** No internal jargon in the UI (`ink`→`text`, `action`→"default interactive
  color"). Labels name what the user recognizes, not how the system is built.

### Token paths
- **Every token-bearing row/card shows its real, resolvable path via `tokenPill`, in the correct
  namespace** — `color.*` for semantic roles, `palette.*` for the raw ramp primitives, `gradient.*` for
  paint styles, and (on the ramp pages) `radius.*` / `shadow.*` / `font.*` / `duration.*`. Verify the
  string against the emitted token tree (`buildTree`) — never invent a path. (#232 lesson: `color.primary`
  was never a leaf; the primitives live at `palette.*`.)

### Technical (any live-updating page)
- **Stable-head / volatile-bands split.** Controls are built once and survive `apply()`; only the
  derived readouts + specimens repaint. This keeps open OS color dialogs and mid-drag sliders alive.
  Structural changes (which control is live) → `applyFull()`; value changes → `apply()`.

---

## Conditional — apply where a value is *authored / derived* (color & value editors, not every page)

- **Origin-left / readout-right** reading order: identity + the controls that *set* the value on the
  left; the derived verdict / anchor on the right.
- **Input-vs-readout + value-when-authored.** The editable control (swatch / field) is an *input* only
  when the value is author-chosen, a *read-out* otherwise; show the concrete value (hex) only then.
- **Auto / Custom / Pinned source model** where a value can follow-the-brand vs be tuned vs be locked —
  **Auto** as the hands-off default; a **padlock** badge marks a pinned/locked value; only one control
  is ever live at a time (no two editable inputs for the same value).
- **Minimal readouts** — show the value, not name+value (an anchor reads `◆ 550`, not `primary/550`).

---

## Not-universal — Palettes-specific, do NOT blanket-apply

- The **three-source neutral** model and the **anchor** (pinned-seed) concept are ramp-primitive
  specific. Don't force them onto pages that aren't authoring a seeded ramp.

---

## Decide per page (not a blanket rule, but a conscious call each time)

- **Mode-scoping** (Surfaces #61): a page whose content differs per mode shows the **active** mode and
  switches with the mode strip, rather than all modes side-by-side. Decide per page whether it's
  mode-scoped or mode-agnostic.
- **Theme of the tool chrome:** the dashboard chrome stays **light** by deliberate choice (confirmed
  during the palette mock) — not an oversight. Don't add a dark tool-chrome per page.

---

## Rollout status (per page)

| Page | Containers | Section headers | Token pills | Notes |
|---|---|---|---|---|
| Palettes | ✅ | ✅ | ✅ `palette.*` | #230–#232 — the reference implementation |
| Surfaces & fills | partial (cards) | — | ✅ `color.*` (#232) | swept for pills; container/header pass TBD |
| Interactive | — | — | ✅ `color.interactive.*` (#232) | pills swept; layout pass TBD |
| Typography | — | — | — | TBD |
| Elevation | — | — | — | TBD |
| Size & radius | — | — | — | ramp-page pills deferred |
| Layout | — | — | — | TBD |
| Motion | — | — | — | ramp-page pills deferred |
| Preview | — | — | ✅ full `color.*` (#232) | tables; layout pass TBD |

Update this table as each page lands.
