# 20 — The interactive colour system (decision record)

> The `Button` calibration (docs/14 §6, KB `components/button.md`) exposed that the semantic
> layer only had a complete interactive palette for *one* intent (`action` = primary), so the
> Button definition had to scavenge across `foreground` / `border` / `brand` for the rest. This
> doc is the **decision record** for the redesign that fixes it: a single, coherent, generated,
> contrast-verified **interactive colour family**, plus the rules for what lives inside it and
> what deliberately lives outside. Decided through the design dialogue of 2026-07-05; this is the
> source of truth **before** any engine code. Nothing here is built yet — it's the spec to build to.

---

## 1. Why this exists

Three problems, one root:

- **Shallow coverage.** `action.*` existed only for primary; danger borrowed `foreground.danger`, secondary borrowed the `foreground.secondary` *surface*, outline borrowed `brand`/`border`. A button's colours came from four unrelated families — no pattern, and `brand.*` tokens leaking onto buttons (they never should; the brand mapping is the engine's business, not the component's).
- **Interactive states with no consistent home.** Solid hover lived as a darker fill; the ghost/overlay hover lived somewhere else. A designer couldn't answer "where do I find interaction states?" with one answer — the exact ambiguity that pushed the old Prism2 system to keep them together.
- **Neutral was never right** (§12) — the achromatic, hand-authored, doubly-inverse corner that no un-gated system gets consistent.

The fix is one coherent family, generated and gated, with a stated rule for its boundary.

## 2. The family — `interactive.<color>.<slot>.<state>`

Every interactive element (buttons, links, rows, menu items, selectable cards, form-field states) draws its colour from **one** family:

```
interactive.<color>.<slot>.<state>
```

- **`<color>`** — `primary` · `neutral` · `destructive` (always) + `accent` (optional, §3).
- **`<slot>`** — `fill` · `on-fill` (ink on the fill) · `text` (ink for outline/text appearances) · `border` · `icon` · `overlay` (§6).
- **`<state>`** — `rest` · `hover` · `pressed` (+ `selected` where a component needs it). `rest` is the base.

Rest colours + their states all live here. Nothing about how an interactive element behaves lives anywhere else. That single-home rule is the load-bearing decision (§8 is its mirror image).

## 3. Colours — three required, accent optional

`primary` · `neutral` · `destructive` are always generated. **`accent` is generated only when the brand defines an accent colour** (`BrandInput.brandColors` + `actionPalette` — the engine already models this; aurora uses it). No accent colour → no accent column; **never fall back to primary** (that ships two identical-looking "primary" buttons). Most brands run `{primary, neutral, destructive}`; a brand with an accent gets a fourth column for free.

`ghost` and `secondary` are **retired as colours** — `ghost` was an appearance masquerading as a colour (the Prism2 confusion), and emphasis is the *appearance* axis's job (§4), not a colour rung.

## 4. Appearances — the consumer's selection over the family

Components select `filled` · `outline` · `text` (retiring `solid`/`plain`/`ghost` — no room for interpretation):

- **`filled`** → `fill` (+ states) with `on-fill` ink.
- **`outline`** → `border` + `text` ink, no fill.
- **`text`** → `text` ink only.

Emphasis is emergent from `colour × appearance` (a `primary filled` is loudest, a `neutral text` quietest) — so there is no separate emphasis axis.

## 5. States — fill-based by default, overlays as supporting, one home

**Decision (2026-07-05): fill-based interactive states are the default; overlays are the supporting tool where a fill can't adapt.** We did *not* adopt a 100%-overlay ("state layer") model — it isn't established practice for the owner's agency and the tradeoff wasn't worth betting the system on.

What matters is not one *mechanism* but one *home*: both the solid fill-states (`interactive.primary.fill.hover`) **and** the opacity overlays (`interactive.primary.overlay.hover`) live under `interactive.<color>`, side by side. `filled` uses the fill-states; `outline`/`text` use overlays where a solid tint would fail on a dark/coloured/image surface. The mechanism varies by appearance; the **location never does** — a designer finds every interaction state in one place.

## 6. Overlays — adaptive interaction tints, inside the family

`interactive.<color>.overlay.{hover, pressed, selected}` are **alpha-based** layers (built on the existing `palette.black-alpha` / `white-alpha` ramps, or the colour hue at low alpha), so they **composite over any surface** — the ghost advantage, without a ghost category. They cover:

- an `outline`/`text` button's hover on a dark hero or image (a solid tint can't adapt; an overlay can);
- neutral hover/pressed/selected on rows, menu items, cards — the *same* overlays, reused.

`outlineInteraction` (§10) selects whether a component uses a neutral overlay, its own colour's overlay, or none. **Opaque** subtle surfaces (a subtle banner, a solid selected-row background) are *not* overlays — they stay on the existing `foreground.<color>-subtle` roles. Translucent-interaction vs opaque-surface is a clean split.

## 7. Disabled — cross-cutting, its own family

`disabled.*` (fill / text / icon / border / on-fill) is **one treatment, not per-colour** — a disabled button looks disabled regardless of intent. This adopts Prism2's pattern (which Prism3 currently does *not* follow — it has `action.disabled` + `foreground.danger.disabled` scattered per-colour) and pulls disabled fully out of the interactive family. The `disabledStrategy` lever (`accessible` / `conventional`) still governs whether disabled clears a legibility floor.

## 8. Scrim + non-interactive veils — outside, by rule

The boundary rule, stated once: **is the layer triggered by interaction *with the element*?**

- **Yes → inside `interactive`** (hover / pressed / selected / dragged, including the opacity overlays of §6).
- **No → its own family, outside.** A **scrim** is triggered by a *modal opening*, not by interacting with the scrim; it's a contextual backdrop, not a state.

Non-interactive veils that live outside: the modal/drawer **`scrim`**, a **hero/image dim** (a veil over an image so text stays legible), a **loading veil** over a busy region. They share a small non-interactive-overlay home (`scrim.*` + kin), kept separate from `interactive`. (This is why an `overlay`-umbrella that swallowed scrim was *rejected* — it would drag a non-interactive layer into the interactive story and re-muddy the divide.)

## 9. Inverse — a generated surface-context, not a hand-mirrored set

The real need: a **light CTA on a dark hero / dark section**, which a light-only brand still requires (so it is *not* a dark-mode concern). Prism2 modelled this by hand-mirroring every token with an `-inverse` twin — **60 of its 122 action tokens** — which was a top complexity driver and a top neutral-miss contributor.

Prism3 keeps inverse but reframes it as a **surface *context*** ("this control sits on an inverse/dark surface"), independent of light/dark theme, **generated and contrast-verified** rather than hand-authored. Generation absorbs the volume that made it painful; it's applied consistently (primary certainly; destructive too if opted, for consistency). "Usually resolves to white, but not always" becomes a per-brand derivation the engine gates.

## 10. Levers (brand inputs)

- **`outlineInteraction`** — `overlay-neutral` · `overlay-tint` (the colour's hue at low alpha) · `solid-tint` · `none`. How an outline/text control expresses hover (the "what do we fill it with" question, answered per brand). *(inc-2: `overlay-neutral` (default) generates the neutral washes + composited-contrast gate; `solid-tint`/`none` opt out. `overlay-tint` is scheduled — needs per-colour alpha ramps.)*
- **`neutralEmphasis`** — `subtle` (light-grey, the default) · `strong` (bold near-black neutral). The neutral button's boldness.
- **`accent`** — implicit: present iff the brand declares an accent colour (§3).
- **`inverse`** — whether the brand ships the inverse surface-context (§9).

## 11. Naming — one reconciled Prism3 scheme, no mixing

**The family is `interactive`, not `action`.** It covers *all* interactive elements and their states (not just "actions"/CTAs), and it has precedent (IBM Carbon's family is literally `$interactive`). This **renames the current Prism3 `action.*` role to `interactive.*`.**

Constraint: we borrow Prism2's *taxonomy shape* (`<color>.<slot>.<state>`, cross-cutting disabled, the on-ink concept) but **normalise every name to one Prism3 convention** — not a Frankenstein of Prism2 (`surface`, `active`, `onprimary`), the field, and Prism3's current terms. `surface`→`fill`, `active`→`pressed`, `on<color>`→`on-fill`. The existing semantic tokens align to this scheme; we do not layer a second pattern beside it.

## 12. Why neutral was the miss — and why it won't recur

The root cause is structural, not a values problem:

1. **Achromatic has the least contrast headroom** — grey-on-grey is a razor-thin AA margin; chromatic colours lean on hue.
2. **The `-inverse` doubling doubled the neutral work** — every value solved and kept consistent twice.
3. **Cross-mode hand-authoring** — light + dark + wireframe each re-declared it by hand, all interdependent (fill can't be picked without its text).
4. **No generation, no contract** — hand-picked pairs with nothing verifying them, so a neutral-hover-text that slipped under AA just shipped. "Never quite right" is where un-gated interdependent contrast always lands.

**Prism3 removes each:** the neutral fill is *picked per mode* by the engine; its on-ink is *derived and verified* against it by the 248-contract gate; inverse and cross-mode become *generated resolutions*, not hand-work. The failure mode was "manual interdependent achromatic contrast at scale"; it is now a **generated, gated contract — a failing neutral pair cannot pass the build.** That gate is the durable safeguard against the miss recurring.

## 13. Generation + verification (the engine's job)

Every `interactive.*` token is **generated** (walk the intent's palette for fill states; derive `on-fill`/`text` for legibility) and **contrast-verified** per mode — including the *composited* result where an overlay sits on a base. This is the same machinery already passing 248 mode contracts; the interactive family becomes more generated output under the same gate, not more hand-authoring.

## 14. Alignment to Prism2 — borrow the shape, fix the rot

| Kept from Prism2 | Fixed in Prism3 |
|---|---|
| `<color>.<slot>.<state>` shape | `action`→`interactive`; names normalised; no pattern-mixing |
| slots surface/text/border/icon | `surface`→`fill`; `active`→`pressed`; `on<color>`→`on-fill` |
| cross-cutting disabled (`disabled.*`) | adopt it (Prism3 currently scatters disabled per-colour) |
| the on-ink concept | `on-fill`, contrast-derived + gated |
| ghost's opacity insight | becomes reusable `overlay.*` (alpha), not a `ghost` colour |
| inverse for CTAs on dark | generated surface-context, not 60 hand-mirrored tokens |
| — | **subtle action hues added** (primary/accent/destructive) — the gap Prism2 lacked |
| — | **everything generated + contrast-gated** — the un-gated hand-authoring that broke neutral is gone |

## 15. Deferred (scheduled, not lost)

- **`field.*` — form-element chrome.** Prism2 needed dedicated input tokens (`surface.input.*`, `border.input.*`) because generic surfaces/borders don't supply a field background, a field border with a validation-state model, or placeholder ink. In Prism3 a **`field` semantic category** holds that chrome; the field's interaction *states* still come from `interactive.*`. This is the **Text Field** calibration component's job (Button surfaced the interactive family; Text Field surfaces `field`; Card surfaces surface/elevation).
- **Component tokens.** Thin, themeable aliases *over* `interactive.*` (`button.*`) for genuinely button-specific overrides — a later tier, only where a component diverges. The load-bearing tier is the generated + verified `interactive` family; if it's complete, component tokens are trivial.

## 16. Next steps

1. ✅ Reconcile the KB `button.md` §15 to this vocabulary (`filled/outline/text` + the four colours) so brief and engine agree.
2. Engine PR (branch `claude/prism3-e2e-integration-8fwul4`, additive-first):
   - ✅ inc-1 `interactive.{primary,neutral,destructive}` family (fill/on-fill/text/border; `rest`/hover/pressed states).
   - ✅ inc-2 `overlay.*` washes + the composited-overlay contrast check + `outlineInteraction` lever.
   - ✅ inc-3 cross-cutting `disabled.*`.
   - ✅ inc-4 inverse surface-context (`interactive.<color>.on-inverse`) + `neutralEmphasis` + opt-in `accentPalette`.
   - ✅ **Legacy-role removal (task #14)** — dropped `action.*`, the stateful `foreground.danger.*` (danger is now a bare bold `foreground.danger` fill), per-colour `interactive.*.fill.disabled`, and `text/icon.{disabled, on-action, on-disabled}`. Components bind `interactive.*` / `disabled.*`. This deletes vars from the frozen real-NB figma fixture, so it was paired with an **NB-fidelity reconciliation**: the fixture was modernised to the engine's evolved layer (dropped the 17 retired vars/mode, renamed `foreground/danger/default` → bare `foreground/danger`, 95 → 78 real vars/mode). The DTCG colour-fidelity gate (nb-regression, ΔE) is unaffected — only the Figma variable naming changed. *(Note: earlier drafts called this "the #67 reconciliation"; GitHub #67 is actually the unrelated Token Press collection-rename question — there was no dedicated issue for this fixture re-baseline.)*
   - ⏳ `overlay-tint` lever value (per-colour hue at alpha) — needs per-colour alpha ramps.
3. ✅ Rebind Button/IconButton (and the eval preview) to `interactive.*` / `disabled.*` — reconciled to
   `filled/outline/text × primary/neutral/destructive`; the v1 HIGH finding (hover-less default button)
   is closed because neutral now carries states. `brand.*`-on-buttons leak removed from the preview.
4. ⏳ `field.*` with the Text Field calibration component — **design in §17 below**; increment in progress.

## 17. The `field.*` category (form-element chrome)

Field research (`Tokens/Prism2` `surface.input.*` / `border.input.*`) shows what a field genuinely
needs that generic roles don't supply — but most of Prism2's input tokens are **already covered
better** by Prism3's generated families and must **not** be duplicated. So `field.*` is deliberately
**minimal**: only the chrome that is genuinely field-specific. Everything stateful is composed from
the existing gated families (per §15: *the field's interaction states come from `interactive.*`*).

**Generated `field.*` roles (three):**

| role | what | contract |
|---|---|---|
| `field.fill` | the field fill — a subtly *inset* neutral so the field reads as an input even before focus | surface (min 0); the value ink `text.primary` clears on it (it tracks the page tier) |
| `field.border` | the resting boundary | **gated `nonTextMin` (3:1 / 4.5 HC) against `background.primary`** — SC 1.4.11. **This is the improvement over Prism2**, whose resting input border sat sub-3:1 and leaned entirely on focus |
| `field.placeholder` | placeholder / hint ink on the field fill | **gated `secondaryMin` (4.5) against `field.fill`** — a *readable* hint, not the sub-AA placeholder Prism2 (and most systems) ship |

**Composed from existing families — NOT re-authored in `field.*`:**
- **focus** → `border.focus` (already gated 3:1). Prism2 had *no* input-focus token.
- **validation** (error / warning / success field) → `border.{semantic}` + `foreground.{semantic}-subtle` (both already gated). Prism2 reused the shared `border.danger` anyway.
- **disabled field** → the cross-cutting `disabled.{surface,border,text}`. Prism2 had no disabled input token.
- **hover / pressed** → `interactive.*` overlays.
- **filled value ink** → `text.primary`. **inverse** → the generated inverse surface-context (a component concern; no hand-mirrored `field.*-inverse` twins — the thing Prism2 spent the most tokens on).

**Text Field calibration component** binds: `field.fill` (fill) · `field.border` (rest) → `border.focus` (focus) → `border.danger` + `foreground.danger-subtle` (error) → `disabled.*` (disabled) · `text.primary` (value) · `field.placeholder` (placeholder). The layout-shift-prevention trick (an invisible resting border sized to the focus border) is a **component** detail, not a token.

*Increment scope:* the three `field.*` roles + rebinding the eval-preview `input` component onto them + gates. A formal Text Field `ComponentDef` (like Button) is a follow-on.

---

*Cross-refs: `14` (component-data layer + calibration components), `19` (code library / delivery), `10` (Figma materialisation — the interactive family emits like any colour axis). KB: `components/button.md` (the calibration brief this redesign answers), `components/_schema.md` (§15 shape), `03 §7` (component `.ai.json`). Supersedes the ad-hoc scavenged bindings recorded as findings in `components/button.ts`.*
