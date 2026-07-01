---
# Harbor — brand brief (frontmatter compiles 1:1 to BrandInput; see docs/07 §6).
# The net-new COVERAGE brand for the CLI: authored from scratch through the CLI,
# never seen by the engine via a golden file. It deliberately exercises the
# COMPLEMENTARY corner of the input space from Aurora — see the lever table in
# docs/07 §6. Its acceptance test is behavioural: it runs, schema-conforms, every
# alias resolves, and all 248 contrast contracts hold.
id: harbor

# Hero brand: a restrained, deep teal (low chroma, deep lightness). No accent —
# the bare-input path.
primary: { l: 0.46, c: 0.08, h: 195 }

# Warm-neutral greys (hue ~65) — independent of the cool teal brand. Paired with
# the tinted page below, this gives a genuinely WARM off-white canvas.
neutral: { hue: 65, chroma: 0.006 }

# action = primary (the DEFAULT — no actionPalette). The engine flags the default
# in notes so it stays a confirmed choice. (Aurora decouples action to an accent;
# Harbor covers the default path.)

# Warm off-white page (neutral.50), NOT pure white — the contrast floor moves to
# neutral.100 and actions/semantics are validated there.
surfaces:
  light: { base: 50 }

# MEASURED status hues (vs Aurora's synthesised status). A calm sea-green success,
# an amber warning, and a dedicated danger red — the brand supplies all three
# rather than letting the engine carve them.
status:
  success: { l: 0.52, c: 0.13, h: 150, chroma: 0.13 }
  warning: { l: 0.7, c: 0.15, h: 70, chroma: 0.15 }
  danger: { l: 0.52, c: 0.18, h: 27, chroma: 0.18 }

# Conventional form factor: comfortable density, sharp-ish corners (radius 1).
density: comfortable
radiusScale: 1

# A compact type scale on a plain SYSTEM stack (families omitted → the engine's
# system fallback stacks). No custom face — the pragmatic, license-free default.
typography:
  typeScale: compact

# A relaxed tempo — the third tempo (Aurora is snappy, NB standard), so the two
# examples plus NB cover the whole motion lever.
motionPersonality: { tempo: relaxed }

# Gradients OFF (omitted) — the field-default abstain. Most systems ship none.
---

# Harbor — brand brief

Trustworthy, calm, maritime. Harbor is infrastructure software: a deep-teal
identity that reads as dependable rather than loud. The palette is restrained on
purpose — low chroma, nothing that fights the content. Unlike a consumer brand,
the hero colour *is* the action colour here: there is one confident interactive
teal and everything leans on it, so `action` stays on the primary palette.

The canvas is a warm off-white, not a cold white — the greys lean warm even though
the brand runs cool, which keeps long working sessions easy on the eyes. Corners
are modest and the density is comfortable: this is a product people read and
review in, not a dense dashboard. Motion is unhurried (relaxed) — considered
transitions, never frantic. No gradients; flat, honest surfaces.

Status colours are specified by the brand, not synthesised: a calm sea-green for
success, a clear amber for warning, and a dedicated red for danger that the teal
identity would never otherwise imply.

*(Prose is authoring latitude — the MVP CLI consumes the frontmatter only.)*
