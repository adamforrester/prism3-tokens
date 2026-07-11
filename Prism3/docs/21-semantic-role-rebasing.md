# 21 — Semantic-role rebasing (the `roleColors` override)

> **Status: implemented** (`theme.ts` `roleColors`, schema, tests; docs/00). A general lever to
> re-base any semantic role on a chosen palette — so a red-brand reuses its brand red for danger,
> a blue-brand its blue for info, and a client can point any role at a custom colour. Generalises
> `action` (via `actionPalette`), the danger-carve heuristic, and the previously-impossible info
> reuse into one mechanism, with the contrast guarantee preserved. **Scope:** the `Role` set —
> `success` / `warning` / `danger` / `info` / `action` (`brand`/`neutral` define the surface model
> and are rejected). `accent` is *not* a rebasable role — it's an opt-in *added* interactive column
> and keeps its own `accentPalette` lever.

---

## 1. The need

Two real client asks, one shape:

- *"Our brand is red — use our red for danger, don't introduce a second red."*
- *"Our brand is blue — use it for info."*

Both are **re-basing a semantic role on a brand/custom colour** instead of a synthesised one.

## 2. What the engine does today (and the asymmetry)

The engine already computes an internal `roleToPalette` map (`theme.ts`) — every semantic role
points at a palette. But only *some* of it is user-steerable, so the four semantic colours are
handled four different ways:

| role | today | user control? |
|---|---|---|
| `action` | `actionPalette` lever → any declared palette (default `primary`) | ✅ first-class |
| `accent` | `accentPalette` lever → a declared palette → `interactive.accent.*` | ✅ first-class |
| `danger` | **auto-carve heuristic**: a *saturated-red* brand reuses `primary`; a greige "red" carves a dedicated red | ⚠️ automatic only (hue heuristic, not a choice) |
| `success` / `warning` / `info` | synthesised from a canonical hue; `status:{…}` can override the **hue** (keeps a11y ramp) | ⚠️ hue-tune (all four incl. `info` as of `status.info`) |

> **Update:** the `info` "no override at all" gap this doc named is **closed** — `status.info` now takes a
> direct hue override like `success`/`warning`/`danger` (all four validation colours are hue-settable), and
> `roleColors.info` rebases it onto a palette. Two mechanisms, both covering info: `status.*` sets the raw hue,
> `roleColors.*` borrows another ramp. When a status role is rebased via `roleColors`, its now-unused synthesized
> ramp is **pruned** (no dead ramp), symmetric with the danger carve.

So the red-brand→danger case *already works* — but only because of a heuristic, and only for
danger. The blue-brand→info case **doesn't work at all**. The pattern is identical; the coverage
isn't. (Detail: the danger carve is why "would the reds be the same?" is *yes* for a genuinely red
brand — `roleToPalette.danger` resolves to `primary`. See `test.ts` M-05.)

## 3. The design — one general override

Expose the internal map as a single input lever:

```ts
/** Re-base a semantic role on a declared palette. Value = any palette name:
 *  a status ('success'…), 'primary'/'neutral', or a `brandColors` entry.
 *  Custom colours are supplied via `brandColors` and named here. */
roleColors?: Partial<Record<Role, string>>;
```

Examples:

```jsonc
// red brand → danger reuses the brand red (explicit, not left to the heuristic)
{ "roleColors": { "danger": "primary" } }

// blue brand → info reuses the brand blue (the gap this closes)
{ "roleColors": { "info": "primary" } }

// a client's bespoke colour, re-based onto info
{ "brandColors": [{ "name": "sky", "oklch": { … } }],
  "roleColors": { "info": "sky" } }
```

**What it does.** For each override, `roleToPalette[role]` is set to the named palette, and the
role's **entire family re-derives on that ramp** — `foreground.<role>`, `foreground.<role>-subtle`,
`text.<role>`, `border.<role>`, `icon.<role>`, and (for `danger`) the whole `interactive.destructive`
column — each placed at the contrast-appropriate step for its contract.

**It generalises `actionPalette`.** `action` is one entry in this map; `actionPalette` stays as an
ergonomic alias (a `roleColors.action` view), so nothing breaks. `accent` is **not** in the map — it
isn't a rebasable role but an opt-in *added* interactive column, so it keeps its own `accentPalette`
lever. The danger-carve heuristic becomes the **default** when no `roleColors.danger` is given; an
explicit override wins (and mints no orphan danger ramp).

## 4. The guarantees (and the one guardrail)

- **Contrast is always preserved.** Whatever palette a role lands on, the engine places each of the
  role's steps to clear its contract (fill on floor, text/ink at its `min`, border at non-text 3:1…).
  A palette that can't produce an accessible step for a role fails that role's gate loudly — it never
  ships a silent sub-AA token. This is the whole reason re-basing is safe to expose.
- **Semantic appropriateness is the user's call — but flagged.** Contrast ≠ signal: a green pointed
  at `danger` passes every contract yet reads wrong. So on a **hue mismatch** (danger not red-ish,
  success not green-ish, warning not amber-ish, info not blue-ish) the resolver pushes a
  **design.md note** — *allowed, but surfaced*. The danger-carve heuristic exists precisely to protect
  the danger signal; the override lets a user opt out of it, so the warning keeps that protection
  visible rather than silent.

## 5. Validation + edges

- The named palette must exist (same check as `actionPalette` today) → throw with the available list.
- `neutral` / `primary` as override *targets* are fine (a status reusing the brand); overriding the
  `neutral` or `brand` *role itself* is out of scope (those define the surface model — separate concern).
- `status:{…}` (hue-tune) and `roleColors` (palette-reuse) coexist: `status` seeds a fresh synthesised
  ramp from a measured hue; `roleColors` points the role at an *existing* palette. If both are given for
  one role, `roleColors` (explicit palette) wins — decision to confirm.

## 6. Increment scope

Small — it mostly *exposes* a map the resolver already computes:
1. Add `roleColors` to `BrandInput` + the schema; validate palette names.
2. Merge it over the computed `roleToPalette` (after the danger carve, before role placement).
3. The hue-mismatch note (compare the target palette's anchor hue to the role's canonical hue; push a design.md note past a threshold).
4. `actionPalette` stays as an alias (`roleColors.action` wins if both are given); `accentPalette` stays its own separate lever (accent is an added column, not a rebased role).
5. Tests: a red-brand danger→primary reuse (explicit), a blue-brand info→primary reuse, a bespoke-colour rebasing, the hue-mismatch note, and the contract gates still pass on every remap across all modes.

Gates as always: `test.ts`, `nb-regression` (unaffected — NB declares no overrides), `emit-dtcg` contracts hold per brand, web tsc.

## 7. Dashboard surface — ✅ built

The web dashboard exposes `roleColors` as a **bespoke "Semantic role palettes" control** on the
semantic stage (`web/src/main.ts` `renderRoleColors`): a `success`/`warning`/`danger`/`info` dropdown
each offering `auto (engine default)` + the declared palettes (`primary`/`neutral`/`brandColors`).
It's *not* a lever (a structured map, not a scalar), so it doesn't come from the lever manifest.
Verified live — re-basing `danger → primary` repaints the danger alert to the brand hue while its
contracts stay green in every mode. Action stays on its existing `actionPalette` lever.

---

*Cross-refs: `theme.ts` (`roleToPalette`, the danger carve, `actionPalette`/`accentPalette`), `20 §3` (the accent lever), `06` (the surface/content model — why `neutral`/`brand` roles are out of scope here). Supersedes the four special-cased paths with one general, gated lever.*
