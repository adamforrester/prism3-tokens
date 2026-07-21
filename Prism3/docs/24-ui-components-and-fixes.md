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
| **C7** | **Add / remove buttons** | `.addbtn` (dashed add) ×**11**, `.rx` (remove-×) ×**4** — constructed inline each time | `addButton(label, onClick)`, `removeButton(onClick, title?)` |
| **C8** | **Step picker (Auto + steps)** | `stepPicker()` exists (1 caller: Foregrounds) but the interactive card, neutral card, and (now) background base each roll their own "Auto + palette steps" select | Route interactive/neutral/background through the one `stepPicker`; ≥3 callers converge |

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

1. **PR-C1 — `selectEl` + unified `.select`** (the named pain; 16 call sites, 5 rules → 1). ✅ #212-pending
2. **PR-C2 — `numberField`** (7 sites, 4 classes → `.num` base + deltas). ✅ Scope narrowed on close read:
   **color** wells are *intentionally* different sizes per context (round brand swatch vs. ramp seed vs.
   start swatch) — not style drift, and their `input[type=color]` cosmetics are already element-selector
   centralised — so a `colorField` factory is low value and **dropped**. **range** is coupled to per-site
   label/readout plumbing (the `slider()` helper vs. the LH/LS + gradient-angle hand-rolls), so it moves to
   its own follow-up (**C5b `rangeField`**) rather than riding here.
3. **PR-C3 — `toggleField`** — unify `renderControl` + the gradient section's duplicate switch. ✅
4. **PR-C4 — display atoms** — `tokenPill`, `addButton`, `removeButton`, and route the 5 stray knobs
   through `knob()` (trivial, batched).
5. **PR-C5 — `stepPicker` unification** — interactive / neutral / background converge on one picker.
6. **PR-C6 — `objEditor` scaffold** — the last structural wrapper.

Sequencing note: all edits touch `web/src/main.ts`, so PRs **serialize** (one branch, squash-merge, reset).
The owner files UI fixes into the log below **in parallel**; fix PRs interleave with component PRs as
priority dictates.

---

## UI fix log

> Bugs / polish found during the refinement pass. Append freely (owner or agent). Format:
> `- [ ] <area> — <symptom> → <fix or hypothesis>`  ·  check off when a PR lands it (note the PR #).

_(none logged yet — seed with a bug-hunting drive-through and owner findings)_

---

## Status

| Item | Status |
|---|---|
| Audit (this doc) | ✅ 2026-07-21 |
| C1 select | ✅ 2026-07-21 — `selectEl()` + `.select` (+ `sm`/`fill`/`cap`); 16 sites, 5 rules → 1 |
| C2 numberField | ✅ 2026-07-21 — `numberField()` + `.num` base; 7 sites, 4 classes → base + deltas (no visual change). color dropped (not drift), range → C5b |
| C3 toggle | ✅ 2026-07-21 — `toggleField()`; 2 callers (renderControl `inverse` + gradient section) unified; DOM-identical |
| C5b rangeField | ☐ pending (split from C2 — readout-coupled) |
| C3 toggle | ☐ pending |
| C4 display atoms | ☐ pending |
| C5 step picker | ☐ pending |
| C6 objEditor | ☐ pending |
