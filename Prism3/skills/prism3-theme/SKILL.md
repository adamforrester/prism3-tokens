---
name: prism3-theme
description: >-
  Author a Prism3 brand — turn a brand brief into a `design.md` the engine
  compiles into a full, contrast-verified token system. Teaches the input
  contract (pin the brand's exact anchors in OKLCH, let the engine derive
  ramps / modes / contrast), the adjective → lever mapping, and the compile
  loop (run the CLI, read the contract results, fix the input, re-run). The
  authoring counterpart to prism3-consume.
when_to_use: >-
  When creating or refining a Prism3 brand from a brief, brand guidelines, or an
  existing palette — producing the `design.md` that `Prism3/engine/cli.ts`
  compiles. Also when an extraction (brand-skills / a flat hex palette) needs
  turning into a compiling Prism3 input.
---

# prism3-theme — briefing a brand into a compiling `design.md`

Your job is to write a **`design.md`** — a small brand brief whose frontmatter the
Prism3 engine expands into a complete token system (ramps, semantic roles, four
modes, typography, geometry, shadows, gradients) with every accessibility contrast
contract proven at generation time. You **declare the brand's identity**; the engine
**derives the system**. Do not hand-author scale steps, per-mode values, or contrast
math — that's exactly what the engine owns, and hand-authoring it is how systems drift.

> **The contract:** pin the brand's *anchors* (its exact hero colour, any accents, its
> neutral cast) in **OKLCH**, choose **levers** by what the brand *feels* like, then
> **compile and read the results** — the CLI tells you every contract that passed and
> flags every choice worth confirming. Loop until it exits clean.

## The shape of a `design.md`

YAML frontmatter (the part the engine reads) + a prose body (authoring intent —
latitude for judgment the frontmatter can't encode; the MVP CLI does not parse it, but
write it: it's the brief's rationale and the next author's context).

**Required — the minimum brand:**

```yaml
id: <brand-slug>
primary: { l: 0.50, c: 0.18, h: 285 }   # the hero colour, in OKLCH
neutral: { hue: 285, chroma: 0.008 }      # the grey cast (a hint of the brand hue)
```

That alone compiles to a full system on sensible defaults. Everything below is optional
and **omitting a lever selects its default** — a plain brief is a valid brief (the
"plain-spec guarantee"). Add a lever only when the brand actually calls for it.

**The levers** (authoritative list + constraints: `Prism3/schema/theme-schema.json`;
two worked briefs: `Prism3/examples/aurora.design.md` maximal, `harbor.design.md`
minimal — read both, they are the reference):

| Lever | Shape / values | Use it when |
|---|---|---|
| `root` | string (default `prism`) | the brand needs its own token namespace (`nbds`, …) |
| `brandColors` | `[{ name, oklch: {l,c,h} }]` | the brand has accents beyond the hero |
| `actionPalette` | a `brandColors` name | interactive UI runs on an **accent**, not the hero (decouple) |
| `status` | `{ success/warning/danger: {l,c,h,chroma} }` | the brand *specifies* status hues; omit to let the engine synthesise + carve a danger red |
| `surfaces` | `{ light: { base: 50 } }` | the page is a **tinted off-white**, not pure white (the contrast floor moves with it) |
| `density` | `comfortable` \| `compact` \| `spacious` | a dense tool vs a roomy reading product |
| `radiusScale` | number (`1` sharp-ish, `2` soft) | corner softness |
| `iconContrast` | `text` \| `3:1` | let non-text icons run lighter (WCAG 1.4.11 floor) |
| `motionPersonality` | `{ tempo: snappy \| standard \| relaxed }` | brand energy → motion pace |
| `typography` | `{ families, weightRoles, typeScale: compact\|default\|expressive, familyMap, displayCeiling, titleFloor, responsive: { fluid, minViewport, maxViewport } }` | custom faces / weight remap / fluid type; **omit `families` → a system-font stack** |
| `shadow` | `{ softness, tint: { hue, amount } }` | softer marketing elevation, tinted to the brand |
| `layout` | `{ breakpoints: [...], containerMax }` | a non-default breakpoint ladder / content cap |
| `gradients` | `[{ name, kind: linear\|radial, angle/center/shape, stops: [{ palette, step, position }] }]` | opt-in brand gradients (most systems ship none — omit) |
| `disabledStrategy` | `accessible` \| `conventional` | `accessible` (default) keeps disabled ink legible; `conventional` for the sub-AA exempt look |

## How to author

1. **Pin the anchors in OKLCH.** Convert the brand's exact hero hex to OKLCH and set
   `primary`. Do the same for accents (`brandColors`). Pin the brand's *real* colours —
   the engine reproduces an anchor exactly (ΔE00 ~0) and grows the ramp around it, so
   fidelity to the brand comes from accurate anchors, not from you placing steps.
2. **Choose the neutral cast.** `neutral: { hue, chroma }` derives a grey with a hint of
   the brand (low chroma — 0.004–0.01). If the brand ships a *specific* grey, pin it with
   `neutral: { anchor: {l,c,h} }` instead.
3. **Decide action.** If the brand's interactive colour *is* the hero, do nothing
   (`action` defaults to `primary` — the engine notes it so it stays a confirmed choice).
   If interactive UI uses an accent, set `actionPalette: <accent-name>`.
4. **Map adjectives → levers.** This is the judgment the brief pays for: "energetic" →
   `tempo: snappy`; "calm / considered" → `relaxed`; "a dense dashboard" → `density:
   compact`; "premium, expansive headlines" → `typeScale: expressive` + a display face;
   "warm, approachable" → a warm `neutral.hue` even under a cool brand. Leave everything
   the brief doesn't speak to at its default.
5. **Write the prose body.** One or two paragraphs of intent — what the brand feels like,
   why action is (de)coupled, why the page is tinted. It's the rationale, and downstream
   authoring agents read it.

## The compile loop (verification — do this, don't guess)

```bash
npx tsx Prism3/engine/cli.ts <your-design.md> --out <a-scratch-dir>
```

Read the output — it is the contract:

- **`aliases: N/N resolve | mode contracts: M/M pass`** — every reference resolved and
  every per-mode contrast contract held. This is the pass bar.
- **`notes`** — confirmed choices and warnings: `action ← primary (default)`, a pinned
  anchor that fell **out of gamut** (the engine clamps + flags it — nudge the anchor's
  chroma down if you meant it to be exact), the tinted-surface floor, etc. Read every
  note; each is a decision to confirm or fix.
- **Exit 0** = clean. **Exit 1** = a schema violation, a broken alias, or a **failed
  contrast contract** — the message names it. Fix the *input* and re-run: a failing
  action-on-surface contrast usually means nudging the primary's lightness or moving the
  surface base; an out-of-gamut anchor means lowering its chroma.

Loop until it exits 0 with all contracts passing. That closing loop **is** the
deliverable — a `design.md` that compiles clean is a brand the engine can carry to every
platform.

## Two dialects (know which you're writing)

- **Engine-native** (this skill) — frontmatter that maps 1:1 to the engine's input, as
  above. The direct on-ramp; what you author from a brief.
- **Standard** (a brand-skills / extraction export) — a flat top-level `colors:` hex map +
  structured type/dimension maps + an optional `x-prism3:` levers block. The same CLI
  auto-detects it (a top-level `colors:` map ⇒ standard) and runs a colour-role classifier
  to derive the anchors. When you're *starting from an extraction*, keep that shape and add
  an `x-prism3:` block for the levers; run with `--fidelity` to get an observed-vs-generated
  report (which brand values the engine reproduced vs. intentionally regularised).

## If you have the MCP surface

`list_levers` enumerates the knobs (the same contract this table is drawn from) and
`theme_brand` compiles a `BrandInput` and returns the tree + `.ai.json` + the contract
results — the programmatic form of the compile loop. `validate_brand` checks an input
against the schema without emitting. Same discipline either way; the CLI is the
file-based path, the MCP the callable one.
