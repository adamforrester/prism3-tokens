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

### 🟠 Font families is not editable
The one thing a designer most wants on a Typography tab — swap the font — renders as read-only
`"configured"` (the `object` gap from §0). Highest-value fix on this tab: a real family editor
(display / text / mono + the variable-font flag).

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
| Corner softness | ✅ chips round — and it's live, so it works |
| Density | ✅ component sizes (height + padding) — once live |
| Shadow softness | ✅ the card carries a shadow — once live |
| Motion tempo | ❌ **motion cannot be shown in a static preview** — needs an animated specimen |

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
3. **Example specimens:** add the missing per-axis specimens (outline-hover, inverse band, gradient,
   icon row, neutral button, motion loop), generalizing the Typography specimen pattern.
4. **Placement:** resolve the parked gradients / motion-tempo questions.

*(Tabs reviewed: Semantic, Typography, Form factor. Primitives tab not formally reviewed here — it
was just rebuilt with the per-ramp validation-colour control; a design pass on its Brand-colors /
Neutral / ramp panels is a natural follow-up.)*
