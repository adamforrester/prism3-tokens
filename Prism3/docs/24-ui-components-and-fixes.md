# 24 — Dashboard UI: componentization tracker & fix log

> A **living working doc** for the web dashboard (`web/src/main.ts`) refinement pass. Two jobs: (1) the
> componentization backlog — which repeated UI patterns become shared components, ranked by real usage,
> so a stylistic change lands in one place; (2) a running **UI fix log** for bugs/polish found along the
> way. The design-note rationale lives in `23-dashboard-ia-and-component-system.md` §8; this doc is the
> executable tracker that survives context clears. Newest status at the top of each section.

Rule (unchanged from doc 23 §8): **extract at ≥2 callers.** One component per PR (or a tight family per
PR); pure refactors are verified with the **DOM-parity harness** (base vs. branch bundle diff → no
visual change), so they're provably safe. `web/src/main.ts` is buildless-bundled by esbuild; manual DOM
via `el(tag, cls?, text?)`.

---

## Method

Usage counts are grepped from `web/src/main.ts` (2026-07-21, at `main` after #210). "Callers" = distinct
construction sites; "forms" = how many divergent CSS/markup variants exist for the same logical control.

---

## Componentization backlog (ranked)

### Tier 1 — form controls (highest churn + active drift; start here)

| # | Component | Today (forms · callers) | Drift risk | Proposed API |
|---|---|---|---|---|
| **C1** | **Select / dropdown** | **5 forms · 16 callers** — `.ic-step`×9, `.obj-sel`×3, `.ramp-ctl-sel`×1, `.te-fam`×1, bare `<select>`×2; five CSS rules (one shared chevron rule already unifies the arrow, but padding/font-size/radius still drift) | **High** — "tweak the dropdown" = edit 5 rules today (the owner's named pain) | `selectEl(options, {value, onChange, size?})` → one `.select` class + a `.select--sm` size variant. Every `el('select', …)` routes through it. |
| **C2** | **Number field** | 1 form · **7 callers** — `.type='number'` hand-built each time (min/max/step/value/onchange + border styling), e.g. `.gr-ed-num`×2, centre X/Y, position, breakpoints | Medium | `numberField({value, min, max, step, onChange, title?})` |
| **C3** | **Toggle switch** | **2 forms · 4 checkboxes** — `renderControl`'s toggle knob **and** the gradient section's hand-rebuilt copy (#210) both construct the same `.toggle` switch | **High** — already duplicated once; the switch style (PR-1 #204) must not fork | `toggleField(checked, onChange, {onLabel?, offLabel?})` |
| **C4** | **Color field** | 1 form · **4 callers** — `.type='color'` swatch+hex row | Medium | `colorField(hex, onChange)` |
| **C5** | **Range / slider** | **2 forms · 5 callers** — a `slider()` helper already exists inside `renderControl` (~L388) but the gradient angle hand-rolled its own `<input type=range>` | Medium — helper exists, not shared | promote to `rangeField({value, min, max, step, fmt, onInput?, onChange})` |

### Tier 2 — display atoms & button families (clean, low-risk wins)

| # | Component | Today (callers) | Proposed API |
|---|---|---|---|
| **C6** | **Token pill** | `el('span', 'tpill mono', path)` inline — 5× `.tpill mono` (+ ~13 bare `.mono` chips, some are token pills) | `tokenPill(path)` |
| **C7** | **Add / remove buttons** | `.addbtn` (dashed add) ×**4** element sites (the "11" grep hit counted CSS rules + compound classes too), `.rx` (remove-×) ×**4** — constructed inline each time | `addButton(label, onClick, cls?)`, `removeButton(onClick, title?, cls?)` |
| **C8** | **Step picker (Auto + steps)** | `stepPicker()` exists (1 caller: Foregrounds); the **interactive card** rolled its own identical "Auto + palette steps" select. ✅ Reassessed: the **neutral card**'s picker is the *emphasis* toggle (subtle/strong), not steps, and the **background base** is white/black/neutral-steps — a different shape — so only the interactive card genuinely matched | Routed the interactive card through the one `stepPicker` (→ 2 callers); bridges the card's numeric anchor ↔ the picker's key strings |

### Tier 3 — structural scaffolds (do last)

| # | Component | Today (callers) | Proposed API |
|---|---|---|---|
| **C9** | **Object-editor scaffold** | `el('div','obj-editor')` + `subHead` + `.obj-lede` — 4 callers (foreground text, responsive, breakpoints; surfaces now cards) | `objEditor(title, lede?)` → returns the wrap pre-headed |
| **C10** | **Knob helper routing** | 5 direct `el('div','knob')` bypass the `knob()` helper (which 4 sites use) | Route the 5 stragglers through `knob()` |

**Already extracted** (doc 23 §8, for reference): `renderCard` (4), `contrastBadge` (3), `swatch` (4),
`optionEl` (18), `subHead` (15), `sectionHead` (14), `tokenTableEl` (4), the rail-as-data config, the
control kit (`renderControl`), `renderScreen` scaffold.

---

## Recommended PR sequence

Most are **pure refactors** → DOM-parity verified (no visual change), one concern per PR. C1 is the
exception: collapsing 5 divergent styles into one base **normalises** the small size deltas, so it's a
deliberate consolidation verified by a **cross-page drive-through** (every select styled + no breakage),
not DOM-parity.

1. **PR-C1 — `selectEl` + unified `.select`** (the named pain; 16 call sites, 5 rules → 1). ✅ #212
2. **PR-C2 — `numberField`** (7 sites, 4 classes → `.num` base + deltas). ✅ Scope narrowed on close read:
   **color** wells are *intentionally* different sizes per context (round brand swatch vs. ramp seed vs.
   start swatch) — not style drift, and their `input[type=color]` cosmetics are already element-selector
   centralised — so a `colorField` factory is low value and **dropped**. **range** is coupled to per-site
   label/readout plumbing (the `slider()` helper vs. the LH/LS + gradient-angle hand-rolls), so it moves to
   its own follow-up (**C5b `rangeField`**) rather than riding here.
3. **PR-C3 — `toggleField`** — unify `renderControl` + the gradient section's duplicate switch. ✅
4. **PR-C4 — display atoms** — `tokenPill` (5), `addButton` (4), `removeButton` (4). ✅ **knob-routing
   dropped**: the 4 direct `el('div','knob')` sites build bespoke structures (custom heads, no
   `knob-desc`, conditional per-mode bodies) that don't fit `knob(label, body, desc)` — routing them
   would change structure for no gain, so they stay as-is.
5. **PR-C5 — `stepPicker` unification** — the interactive card converges on the shared picker (→ 2 callers).
   ✅ neutral (emphasis toggle, not steps) + background (white/black/steps, different shape) don't fit — left as-is.
6. **PR-C6 — `objEditor` scaffold** — the last structural wrapper. ✅ 4 callers (Backgrounds, Text & ink,
   Foreground fills, Shadow — the `.obj-editor` sites; the responsive/breakpoints editors use `.adv-obj`,
   not this scaffold).

**Arc complete (2026-07-21):** C1–C6 all landed. The dashboard's repeated controls (select, number,
range, toggle, step picker) and atoms (token pill, add/remove buttons, object-editor scaffold) each now
have a single definition — a styling or behavior change lands in one place. Remaining follow-ups are
deliberately-scoped-out items, not gaps: `colorField` (intentional per-context sizing), knob-routing (bespoke
structures), and neutral/background pickers (different shapes).

Sequencing note: all edits touch `web/src/main.ts`, so PRs **serialize** (one branch, squash-merge, reset).
The owner files UI fixes into the log below **in parallel**; fix PRs interleave with component PRs as
priority dictates.

---

## UI fix log

> Bugs / polish found during the refinement pass. Append freely (owner or agent). Format:
> `- [ ] <area> — <symptom> → <fix or hypothesis>`  ·  check off when a PR lands it (note the PR #).

Owner review pass (2026-07-21). Fixes batch into area PRs (F1, F2, …); functional bugs stand alone.

**Palettes**
- [x] Renaming a borrowed brand color (e.g. `accent`→`secondary`) breaks role refs → **fixed** (F5): rename now **cascades** to every name reference (`actionPalette`, `roleColors` borrows, `interactivePalettes` columns, gradient stops), with a collision guard (revert if the new name is taken). Remove gets the same treatment (clears borrows / drops columns / repoints gradient stops to primary).
- [x] Validation ramp jumps to the bottom + cuts off when borrowing a scale → **fixed** (F4): borrowed status roles now render as a **full ramp in place** (step labels / hex / anchor, "borrowing <src>" meta) via `rampEl`, not a cut-off `strip-mini` at the bottom. Retired the dead `borrowedStatusRow`.
- [x] ANCHOR badge clipped on the anchor swatch → **fixed** (F4): the flag was 58px in a ~57px swatch; shrank it (8px / padding 2px 4px) to 47px so it fits with room to spare.
- [x] Palettes bleed past the 1120px content pane → **fixed** (#59): retired the 340px side-car control card (`primSection`) that squeezed the ramps. Every palette is now a **full-width row** — a stable head (identity swatch + name/path + origin control + `◆`-step anchor readout) above a full-width ramp — grouped in **per-role section containers** (Brand / Neutral / Validation). Design-led restructure agreed over an iterated mockup. Also folded in: **origin-left / anchor-right** across all three kinds; `color.*` **path tags**; the **"default interactive color"** badge (renamed from "action") on the action palette; **hex-by-name only when author-chosen** (swatch is an input then, a read-out otherwise); Source as a **select** everywhere. Neutral gains **Custom tint** (hue/chroma) vs **Pinned color** (locked hex + padlock, disabled tint read-outs); Validation joins the same structural model (Source select left, swatch-picker on Custom hue). Stable-head / volatile-bands split preserved (open color dialogs + slider drags survive `apply()`).
- [x] Neutral **Auto** source (the deferred third source) → **landed**: `BrandInput.neutral.auto` — when set, the neutral hue live-follows the brand `primary` at build (re-tracks on recolour) instead of a frozen stored hue; precedence **Pinned > Auto > Custom tint**. Default-on for brands with no neutral (classify no-neutral path + the blank `DEFAULT_INPUT`), which is **byte-identical** to the old snapshot (the hue was already `primary.h`) — only the link becomes live. Brands that author a neutral (NB swatches, an explicit hue, a pin) are untouched. UI: the neutral Source select gains **Auto**, with read-only Hue/Chroma that track the primary; switching Auto→Custom snapshots the effective hue so the slider doesn't jump.

**Mode strip**
- [x] Pill ✓/✗ (per-mode contrast pass/fail) reads as remove/close → `✗`→`!` for fail + an explanatory `title` on every pill ("Contrast: all/some pairs pass/fail in this mode") (F3).
- [x] Edit-Modes dialog: name field + base select have no external labels → added "Mode name" / "Base mode" labels; base options now "Light"/"Dark" (not "base: light") (F3).
- [x] Light "always" shows a dead checkbox → rendered as a **locked** row (muted, greyed check, no hover) + lock tooltip — clearly non-interactive (F3, chose disable-not-remove to keep alignment).

**Surfaces & fills**
- [x] Rail label `Surfaces / fills` → `Surfaces & fills` (F1).
- [x] Drop the word "ink" everywhere (subhead `Text & ink`→`Text`, ledes, card desc, inverse specimen) (F1) + the engine-sourced `inverse` lever description (F1b — `levers.ts` + regenerated `lever-manifest.json`). Zero standalone "ink" across all 9 pages.
- [x] Contrast-floor control unclear → added an inline tooltip explaining it (F1).
- [x] Section headers (`subHead`) too light/small + top spacing too tight → bumped `.sub-t` to 12.5px / weight 680 / `--muted` (from 11.5px / 600 / `--faint`) + `.sub-lab` top margin 22→34px. One `subHead` fix, every section header.
- [x] Backgrounds reads as two surfaces in one mode → made it **mode-scoped** (F2): the active mode's `background.primary` (editable base + floor) + `background.inverse.primary` (derived, read-only); switch modes to set each. Consistent with Text below.
- [ ] Text-color rows have very wide selects → add a color example, narrow the select.

**Cross-page**
- [x] Token-path tags inconsistent — Palettes accents were bare (primary/neutral/status pathed), and the card editors dropped the `color.` prefix (`background.primary`, `interactive.…`, `foreground.…`) while Palettes kept it (`color.primary`) → **path-tag sweep (owner scope A: color surfaces)**: every color-surface pill now shows the full `color.*` path — accents (`color.<name>`), Text (`color.text.*`), Foreground fills (`color.foreground.*`), Backgrounds (`color.background.*`), Interactive (`color.interactive.*`), and the Preview stops stripping the prefix. Gradients stay `gradient.*` (Figma paint styles — a distinct namespace, not `color.*`). Non-color ramp pages (radius/elevation/size/type/motion) deferred.

---

## Status

| Item | Status |
|---|---|
| Audit (this doc) | ✅ 2026-07-21 |
| C1 select | ✅ 2026-07-21 — `selectEl()` + `.select` (+ `sm`/`fill`/`cap`); 16 sites, 5 rules → 1 |
| C2 numberField | ✅ 2026-07-21 — `numberField()` + `.num` base; 7 sites, 4 classes → base + deltas (no visual change). color dropped (not drift), range → C5b |
| C3 toggle | ✅ 2026-07-21 — `toggleField()`; 2 callers (renderControl `inverse` + gradient section) unified; DOM-identical |
| C4 display atoms | ✅ 2026-07-21 — `tokenPill` (5) + `addButton` (4) + `removeButton` (4); DOM-identical. knob-routing dropped (no clean fit) |
| C5 stepPicker | ✅ 2026-07-21 — interactive card routed through shared `stepPicker` (→ 2 callers); neutral/background reassessed as different shapes, left as-is |
| C5b rangeInput | ✅ 2026-07-21 — `rangeInput()` element factory across 5 sites (byte-identical). Scoped to construction only — the readouts (`.slider-top` / `.knob-val` / auto-pruning knob / label-as-readout) stay per-site; no full slider+readout component |
| C6 objEditor | ✅ 2026-07-21 — `objEditor(title, lede?)`; 4 callers (Backgrounds / Text & ink / Foreground fills / Shadow); DOM-identical |
| **Arc** | ✅ **complete** — C1–C6 landed; scoped-out items (colorField, knob-routing, neutral/background pickers) documented above |
