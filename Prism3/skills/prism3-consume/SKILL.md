---
name: prism3-consume
description: >-
  Build accessible, on-brand UI from a Prism3-generated token system. Teaches an
  agent to consume the generated tokens well — reference semantic roles by name
  (never invent, never reach for a raw primitive), let modes resolve themselves,
  honour each role's avoid_when, and self-check every ink-on-surface pair against
  its contrast floor. Portable: the same discipline applies to any Prism3 brand,
  with or without the MCP surface.
when_to_use: >-
  When writing component code or token bindings against a Prism3 token system
  (the `<brand>.tokens.json` DTCG tree + its `<brand>.ai.json` metadata sidecar),
  whether you reach the tokens through the MCP `theme_brand` tool, a committed
  catalogue, or a design.md brief.
---

# prism3-consume — using a Prism3 token system to build compliant UI

You have a **generated** token system: a brand brief was expanded by the Prism3 engine
into a full, contrast-verified token tree. Your job is to bind UI to it **the way the
system intends** — so the accessibility contracts the engine proved at generation time
survive into the rendered component. This skill is the *reasoning*; the per-brand
specifics live in the brand's `.ai.json` sidecar. The rules below hold for every Prism3
brand.

> **The one-line contract:** reference **semantic role tokens by their exact name**, let
> **modes** resolve them, and **verify every colour pair** against its floor. Do that and
> the output is compliant by construction.

## The four layers (reach for the right one)

A Prism3 tree has layers, and you consume them from the top:

1. **Type composites + weight roles** (`type.*`, `font.weight-role.*`) — the typography you apply.
2. **Semantic colour + geometry roles** (`color.*`, `space.*`, `radius.*`, `size.*`, `border-width.*`, `focus.*`) — **this is your layer.** Everything a component needs has a role here.
3. **Metadata sidecar** (`<brand>.ai.json`) — per-role `when_to_use` / `avoid_when` / `contrast_with` / `mode_overrides`. Read it when a name isn't self-evident.
4. **Primitives** (`palette.*`, `dimension.*`, `font.size/weight.*`) — **private.** The engine marks these `consume: "Private primitive — reference a color.* semantic token that aliases this, not the raw step."` Do not bind to them (see the one exception below).

## Rules

**1. Names are the API — never invent a token.**
Every token you reference must exist in the tree. If you don't know the name, look it up
(the catalogue, the MCP `theme_brand` output, or the `.ai.json`) — do **not** guess a
plausible-sounding name. Prism3's naming is deliberate and diverges from generic
convention in exactly the places guessing fails (e.g. it's `color.foreground.success-subtle`
for a tinted success surface, not `color.feedback.success.surface`; it's `focus.ring.width`,
not `focus.ring.size`).

**2. Reach for the semantic role, not the primitive.**
Use `color.action.default`, not `palette.primary.600`. Use `space.400`, not `dimension.16`.
The semantic token aliases the primitive *and* carries the mode behaviour and the contract.
Binding a raw primitive throws all of that away and is the #1 source of drift.
*Exception:* `opacity.*`, `motion.*`, and `shadow.*` are consumable directly — their
semantic layer is thin (the `.ai.json` marks them `consume: "Consumable …"`).

**3. Let modes resolve — don't hardcode a mode's value.**
A colour role resolves differently per mode (`light` / `dark` / `hc-light` / `hc-dark`),
carried in the role's `mode_overrides`. Bind the **role**; the mode drives the value. Never
copy a resolved hex into your component — that pins one mode and breaks the others.

**4. Honour `avoid_when` — it is the highest-value field.**
The sidecar's `avoid_when` encodes the traps the role's *name* can't. The portable ones
that hold across brands:

- **`border.primary` is decorative — not a contrast target.** The engine makes the default
  border intentionally low-contrast (often well under 3:1). If you need a border that must
  read as a UI edge (a 3:1 target), use `border.secondary` or `border.focus`. A decorative
  divider is *exempt* from the 3:1 contract — don't pair it as one.
- **`*.on-*` ink goes on its paired fill, nothing else.** `text.on-action` sits on
  `action.default`; `text.on-danger` on `foreground.danger`. Plain `text.primary` /
  `text.secondary` go on surfaces (`background.*` / `foreground.*`), never on a solid vivid fill.
- **Disabled roles are WCAG-exempt.** `text.disabled`, `action.disabled`, and any
  `*.on-disabled` label are *not* held to 4.5:1 — disabled controls are exempt (WCAG 1.4.3).
  Treat a disabled label as `ui` (3:1 legibility) at most; do not fail your self-check on it.
- **Subtle tints aren't solid fills.** `foreground.*-subtle` is a low-emphasis tint surface;
  body text on it still needs a real 4.5:1 check (pair the matching `text.*`, not `text.on-*`).

**5. Prefer type composites + weight *roles*.**
Apply a `type.*` composite for a text style; reference `font.weight-role.emphasis` (the
role), not the numeric `700`. A brand can re-map its weights and every consumer reflows —
but only if you referenced the role.

## The self-check (do this before you finish)

List every **ink-on-surface colour pairing** your component renders, each as
`{fg, bg, kind}`:

- `kind: "text"` — body copy → needs **4.5:1**
- `kind: "large-text"` — ≥ 24px or ≥ 19px bold → needs **3:1**
- `kind: "ui"` — borders, icons, focus rings, large graphics → needs **3:1**

Resolve `fg` and `bg` **per mode** and confirm the ratio clears the floor **in every mode**.
Only pair colours where a real contrast contract applies — a **decorative** border
(`border.primary`), a **disabled** label, and pure decoration are exempt; don't score them
as if they were text or a 3:1 UI edge. If a pair fails, you reached for the wrong role — the
system has a role that passes (that's what the generation-time contracts guarantee).

## Two worked edges (where the raw name isn't enough)

These are the exact cases where "the catalogue alone" leaves an agent one step short — the
sidecar's `avoid_when` closes them:

- **A card outline.** Tempting: `border.primary` as a 3:1 UI edge. Wrong — it's decorative
  (can be ~1.4:1 on the page). Either drop it from your 3:1 pairs (it's exempt decoration) or,
  if the edge must *read*, use `border.secondary` / `border.focus`.
- **A disabled button's label.** Tempting: score `text.on-disabled` on `action.disabled` as
  `text` (4.5:1). It's ~3:1 by design and **exempt** — classify it `ui`, don't fail on it.

Get those two right and you match the engine's own compliance contract.

## If you have the MCP surface

Call `list_levers` to learn the knobs and `theme_brand` to get the tree + `.ai.json` for the
brand, then apply everything above. The skill and the MCP compose: the MCP gives you the
*data*, this skill is the *discipline* for using it. Without the MCP (a committed catalogue,
a `design.md`), the discipline is identical — you just read the tree from the file.
