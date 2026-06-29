# 06 — Surface & content colour model (proposal)

**Status:** proposal, for red-line. Supersedes parts of the current semantic
layer once accepted. Date: 2026-06-29.

> This rewrites the *semantic colour vocabulary* — the background / foreground /
> text / icon / action / border roles — not the primitive ramps or the generation
> engine. The OKLCH ramps, contrast-targeted step placement, white-label synthesis,
> and computed contracts all stay. What changes is **which roles we emit and what
> they mean**, driven by a UI-designer review of the generated style guide.

---

## 1. Why

The current semantic layer has four problems surfaced in review:

1. **Light surfaces are all white.** `background.primary…quaternary` converge to
   white in light mode (elevation carried by shadow). But designers reach for light
   greys constantly, and the model gave only *one* flat grey (`background.subtle`).
   Dark mode "lifts" to greys, light mode doesn't — an inconsistency with no payoff
   for the most common case.
2. **`foreground` is incoherent.** It means *neutral fill* (NB's quirk), and its
   tiers don't form a ladder: `foreground.primary` = 950 (near-black), `secondary`
   = 200 (light grey). "One strong fill + two subtle fills" sharing an
   emphasis-implying name.
3. **Over-build.** A whole `elevation.*` colour group (`raised/overlay/floating` +
   component aliases) that mostly re-aliases surface tiers; a `sunken` surface; a
   `quaternary` tier; a duplicate disabled-link role.
4. **Naming drift.** The interactive role is the `action` palette but emits as
   `interactive`; `text.on-emphasis` doesn't say which surface it pairs with.

## 2. The mental model (and its lineage)

The container vocabulary has evolved deliberately:

- **Prism1** — `background` only; every fill was a background. CSS-aligned and
  simple, but the single fill set was **not deep enough**.
- **Prism2** — added `surface` for depth, but the `background` ↔ `surface`
  relationship was murky (which goes on which?).
- **Prism3** — keeps Prism2's two-layer depth but renames the second layer so the
  **stacking relationship is legible in the names**: `background` is the canvas,
  `foreground` is what sits on it.

So the committed model is four conceptual layers:

| Layer | Role | What it is |
|---|---|---|
| **`background`** | the canvas | non-functional base surfaces — the page itself |
| **`foreground`** | surfaces on the canvas | the functional fill/surface layer — cards, panels, chips, buttons, semantic fills (Prism2's `surface`, renamed) |
| **`text` / `icon`** | ink | content drawn *on* a surface; split only because they carry different contrast floors (4.5:1 vs an optional 3:1 for icons) |
| **`action`** | interactive | the one interactive fill + its states (kept top-level per Prism2 + KB 31) |
| **`border`** | edges | neutral, semantic, and focus borders |

**The relationship rule:** `foreground.primary` sits on `background.primary`, and
they are different shades. The engine resolves foreground steps to stay legible
against whichever background tier they're placed on.

`foreground` *is* the fills — there is no separate `foreground.fill.*`. Ink is
never `foreground`; it is `text` / `icon`.

## 3. The model in full

### `background.*` — the canvas (thin, page-level)

| token | light | dark | meaning |
|---|---|---|---|
| `background.primary` | white | neutral.950 | the page (the usual default) |
| `background.secondary` | ~neutral.50 | neutral.900 | a slightly greyer page / page band |
| `background.tertiary` | ~neutral.100 | neutral.850 | a third page-level step (reserve) |
| `background.inverse.primary` | neutral.950 | white | inverse page context (a dark band on a light page) |
| `background.inverse.secondary` | neutral.900 | ~neutral.50 | inverse, second step |
| `background.inverse.tertiary` | neutral.850 | ~neutral.100 | inverse, third step |

Capped at tertiary; **no `quaternary`, no `sunken`, no neutral `subtle`.** `inverse`
is a parallel sibling ladder, not a `.default`/`.inverse` split on every leaf.

### `foreground.*` — surfaces & fills on the canvas (the deep layer)

| token | light | dark | meaning |
|---|---|---|---|
| `foreground.primary` | ~white/neutral.25 | neutral.900 | the default surface placed on the page (a card) |
| `foreground.secondary` | ~neutral.50 | neutral.850 | a second surface (a panel / nested) |
| `foreground.tertiary` | ~neutral.100 | neutral.800 | a third surface step |
| `foreground.inverse.primary…tertiary` | neutral.900…700 | … | dark surfaces in light mode (the strong/bold neutral fill; ex-`foreground.primary=950` lands here) |
| `foreground.{brand,success,warning,danger,info}` | semantic.600 | … | **bold** solid semantic fills (filled badge / banner / button) |
| `foreground.{…}-subtle` | semantic.50 | … | **subtle** semantic tints (light-red banner surface, etc.) |

Tonal **in both modes** — surfaces step in tone; **shadow is additive** for things
that genuinely float (a dialog = a foreground surface + `shadow.lg`), not the sole
differentiator. This is what gives light mode its greys and makes light/dark
consistent.

### `text.*` / `icon.*` — ink

| token | meaning |
|---|---|
| `text.primary / secondary / tertiary` | neutral ink, descending emphasis (all legible on the surface) |
| `text.disabled` | disabled / inactive ink |
| `text.{brand,success,warning,danger,info}` | **bold** semantic ink |
| `text.{…}-subtle` | **subtle / muted** semantic ink (the "quiet danger") |
| `text.on-primary / on-{semantic} / on-action` | ink for *on top of* a solid fill (paired contrast) |
| `text.on-inverse` | ink on an inverse surface (renamed from `on-emphasis`) |
| `text.link.{default,hover,visited,focused}` | interactive text (links) — **no `disabled`** (a disabled link is an anti-pattern) |

`icon.*` mirrors `text.*`, diverging only when `iconContrast: '3:1'` lets
secondary/semantic icons resolve against the WCAG 1.4.11 non-text floor.

### `action.*` — interactive (top-level)

`action.{default, hover, pressed, focused, selected, disabled}` — the interactive
fill and its states. Kept top-level (Prism2 + KB 31 both do this). `text.link.*`
and `border.focus` are its text/border expressions.

### `border.*` — edges

`border.primary / secondary` (neutral), `border.{semantic}`, `border.focus`
(the focus ring colour). In **high contrast** the border targets escalate (≥4.5:1)
because borders — not surface tints — carry structure in HC (see §4).

## 4. Per-mode resolution

- **Light & dark are now symmetric:** both step surfaces tonally. Light no longer
  converges to white; dark keeps its lift. Shadow is an additive elevation cue in
  both, strongest in light.
- **High contrast carries elevation by border, not surface.** `background` and
  `foreground` tiers collapse toward the base in HC (they're indistinguishable as
  near-base tints anyway), and the HC-escalated `border.*` does the separating. (This
  generalises the earlier hc-dark fix to the new two-layer model.)
- **The relationship rule is a resolution constraint:** a `foreground` tier is
  resolved to read against the `background` tier it sits on; `text`/`icon` against
  the surface they're on; saturated fills against the most-tinted supported surface
  (the existing floor rule). Contrast contracts continue to gate every step.

## 5. What changes (migration)

| Current | New | Note |
|---|---|---|
| `background.primary…quaternary` (white in light) | `background.primary/secondary/tertiary` **tonal** | cap at tertiary; light gets greys |
| `background.subtle` (neutral) | *removed* | the tonal ladder is the grouping greys |
| `background.sunken` | *removed* | recessed = a tier + `shadow.inset` + border |
| `background.{semantic}-subtle` | `foreground.{semantic}-subtle` | colored container surfaces move to the foreground (fill) layer |
| `background.inverse` | `background.inverse.{primary,secondary,tertiary}` | sibling ladder |
| `foreground.primary=950` ("strong fill") | `foreground.inverse.primary` | it was a dark surface, mislabeled |
| `foreground.secondary/tertiary` (light fills) | `foreground.secondary/tertiary` (coherent tonal ladder) | now a real ladder |
| `foreground.interactive.*` | `action.*` | rename + relocate |
| `foreground.danger.*` | `foreground.danger` (+ states) / `text.danger` | destructive fill stays stateful |
| `elevation.*` (surface + shadow + component aliases) | *removed* | elevation = a tier + a shadow, composed at the component layer |
| `text/icon.interactive.*` (links) | `text/icon.link.*` | rename; `disabled` already dropped |
| `text/icon.on-emphasis` | `text/icon.on-inverse` | clarity |

Already shipped on `claude/semantic-color-refinements` (independent of this rework):
the disabled-link removal and the first hc-elevation fix.

## 6. Decisions (resolved 2026-06-29)

1. **`action` placement** — ✅ **top-level `action.*`** (Prism2 + KB).
2. **`-subtle` syntax** — ✅ **flat suffix** (`foreground.danger-subtle`,
   `text.danger-subtle`).
3. **`background.tertiary`** — ✅ **keep** the third page step.
4. **Exact light surface steps** — go with the engine's recommended values; **tune
   visually** once the style guide renders the new model.

## 7. Engine impact

- **`modes.ts`** — the bulk: rewrite the role set (background/foreground/text/icon/
  action/border), the tonal ladders, the inverse ladders, the per-mode + HC
  resolution. Remove the elevation block.
- **`ai-metadata.ts`** — regenerate the role descriptions / `when_to_use` for the
  new vocabulary; the `aliased_by` graph recomputes automatically.
- **`test.ts`** — update the semantic invariants (role presence, the
  foreground-reads-on-background relationship, the tonal-ladder direction, HC
  border-carries-elevation).
- **`visualize.ts`** — the semantic-roles section reflects the new groups; add a
  light-grey ladder readout.
- **docs** — `01-token-architecture` §4.1 and `00-progress` updated; this file
  becomes the reference once accepted.
- **outputs** — regenerate `out/*` and the modes-report.

## 8. Note back to the KB

This **reaffirms** the KB's committed `background`/`foreground` antonym decision
(31-color-systems §"the semantic role vocabulary") — it does not drop it. Worth
sharing back: the clarification that **`foreground` = the surface/fill layer**
(Prism2's `surface`, not ink), that the elevation/surface split collapses to "tier
+ shadow," and that light-mode surfaces should be tonal (the all-white-light model
under-serves practitioners). Candidate refinement to 31's surface guidance.
