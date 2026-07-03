# 11 — Multi-brand, mode-configurable vision (the enterprise north star)

> `07`–`10` build a single brand: one `BrandInput` → one namespaced token set with four
> generated modes. This doc records the **next architectural layer**, articulated by the
> owner: a design system that serves **many brands over one locked token-name contract**,
> with **modes the user can decline or customize**, and a **single export contract** so
> every exit path (engine package, Figma emit, Token Press) produces the same artifact.
> It is the north star the mode/brand/override/export work builds toward — captured here
> so it survives context loss and every surface (web, MCP, the Figma-emitter track) aims
> at the same target. **Nothing here is built yet; this is the plan, phased.**

---

## 1. The load-bearing insight — names are the contract, values are the fill

A component binds to **token names** — `color.action.default`, `space.md`, `radius.lg`,
`font.family.display`. Those names are a **locked semantic contract**. Everything else —
light vs dark, Brand A vs Brand B — is a different **column of values over the same rows
of names**.

- A **mode** (light / dark / HC / wireframe) is one value-column of a single brand.
- A **brand** (Aurora, or Colgate vs Hills) is *also* just a value-column — a fully
  independent set of inputs (colour, type, space, radius, shadow) that resolves the
  **same locked names** to different values.

So **a brand is structurally like a mode**: same interface, different fill. That is what
lets a UI switch Colgate ⇄ Hills — or light ⇄ dark — *fluidly at runtime*: the names a
component is bound to never change; only which column is selected.

**What already exists toward this:** the engine's semantic role layer is *brand-agnostic
by construction* (docs/07 portable core) — every brand today generates the **same**
semantic name structure. The locked contract is already there. Modes are already
generated per brand. Namespace (`root`, #34) is already per-brand. The vision is an
*extension* of this foundation, not a rebuild.

---

## 2. The generate / customize matrix

Which layers exist, whether the engine generates them, and whether the user can then
tweak the generated result:

| Layer | Generated? | Customizable? | Notes |
|---|---|---|---|
| **Light** | ✅ base, always on | ✅ tweak values | The required column. |
| **Dark** | ✅ optional | ✅ tweak values | Users will override — incl. a *different CTA hue* than light. |
| **Additional brands** | ✅ optional | ✅ fully independent inputs | colour / type / space / radius / shadow all free; names locked. |
| **HC (light + dark)** | ✅ optional | ❌ generate-only | Contrast rules are strict; no hand-authoring. |
| **Wireframe** | ✅ optional | ❌ generate-only | A *new* generated mode (engine does light/dark/HC today, not wireframe). |

Two facts fall out of this table:

- **Most brands ship light only.** Dark / HC / wireframe are opt-in, not default. The
  engine keeps generating all four when unspecified (back-compat), but the *New brand*
  UX starts light-only and you toggle the rest on.
- **"Generative but customizable" is a real second layer.** The generated values are a
  *baseline*; a customizable mode (light, dark) accepts per-token **overrides** on top.
  This is also what makes the mode selector a genuine *authoring* context for those modes
  (not just a preview toggle) — you select dark, you edit dark's CTA.

---

## 3. The four pillars (what's missing, phased)

### Pillar 1 — Mode configurability *(smallest; unblocks "decline dark/HC")*
Light always; dark / HC / wireframe opt-in. `BrandInput` gains a `modes` set; the engine
resolves + emits only the requested modes; `resolvePreview` returns only those (the web
mode switcher already narrows, since it iterates `rp.modes`). Engine default stays all-four
(light/dark/hc-light/hc-dark) when unspecified; the *New brand* template is light-only.
Split into **1a — opt-out over the existing four modes** (the immediate need) and **1b —
wireframe** (a *new* generated mode).

**Wireframe resolution (spec, for 1b):** a purely mechanical desaturation —
- every **non-neutral** role resolves to its **equivalent neutral** (the neutral-ramp step
  at the same position: e.g. `action.default = accent/600` → `neutral/600`), so the whole
  theme collapses to greyscale;
- **all radius → 0px** (sharp corners).
Generate-only (no override layer), per the matrix.

### Pillar 2 — Override layer *("generative but customizable")*
Generated values are the baseline; a per-brand, per-mode **override map** lets the user
tweak specific tokens (the different dark CTA). Overrides are **re-validated against the
contrast contracts** — an override can't silently break a11y (warn / block). Applies to
the customizable modes (light, dark), never to HC / wireframe. In the UI, this is where
the mode selector becomes an authoring context (docs/… the earlier "mode switcher on the
controls" instinct is correct *once overrides exist*).

### Pillar 3 — Brand families *(largest; the enterprise headline)*
A **system** defines the locked token-name contract (already what the engine emits,
formalized). **N brands** each carry fully independent inputs but conform to the system's
names, emitted so they're **swappable** (brand as a selectable axis alongside mode —
Figma-variable-mode-style). Colgate ⇄ Hills at runtime. Composition: a family's system
defines the default mode set and the locked names; each brand's overrides are
per-brand-per-mode.

**Open sub-decision (revisit when we build it):** how the shared layer is *serialized* —
(A) **merge model**: each brand emits a self-contained token set (shared values duplicated
across brands, one source of truth in the inputs); (B) **reference model**: a shared
`system.*` layer emitted once + per-brand tokens that alias into it (DTCG-native, exactly
the legacy `nbds.pds.*` `shared/` + `brand-theme.json` shape). Recommendation: A first
(delivers the value, is the prerequisite for B), B as a later emit-mode when output
duplication actually bites.

### Pillar 4 — Unified export contract *(cross-cutting)*
See §4. The export format is the ecosystem's interoperability contract; it must
accommodate optional modes (Pillar 1) and multiple brands (Pillar 3), so it's designed
alongside them and implemented after mode-config.

---

## 4. The export contract — one shape, every exit

**The invariant:** whoever presses export — a dev pulling a package straight from the
engine, a vibe-coder with no Figma, or a designer exporting from Figma through **Token
Press** — gets the **same artifact shape**. Consistent output is what makes the ecosystem
compose instead of fracture.

**Today: three exits, two shapes.**

| Exit path | Today |
|---|---|
| Web UI export (#40) / `emit-dtcg` | **single** `tokens.json` |
| `emit-figma` (Figma-emitter track) | **multi-file, by collection × mode** |
| Token Press (downstream, in Figma) | **multi-file, by collection × mode** |

Our own DTCG/UI export is the odd one out. **The fix:** a **canonical partitioning** every
emitter conforms to — **by collection × by mode × (with families) by brand**. The
*partitioning* is identical across formats; only the leaf encoding differs (DTCG JSON for
the package path, Figma RGB for the plugin path). Then a dev's direct package and a
designer's Token-Press export are structurally the same artifact. The #40 single-file
export is a v1 stepping-stone that evolves into this.

**The contract, grounded in Token Press v2.3.1** (evaluated 2026-07-03 against the plugin's
agent brief AND its real output — the in-repo `Tokens/` layer *is* Token Press output, so it
doubles as the format reference and the engine's regression target).

**Layout** (Token Press §7): a ZIP of DTCG JSON, **one file per collection**, in a
**directory-per-mode** structure that a collection opts into *only when it is multi-mode*:
```
tokens/
├── shared/      <collection>.json   ← mode-invariant collections (primitives, radius, motion, …)
├── <modeA>/     <collection>.json   ← a collection that varies by mode (e.g. color light/dark)
└── <modeB>/     <collection>.json
```
Confirmed in-repo: NB's single-mode `color` sits in `shared/`; its desktop/mobile `typography`
splits into per-mode dirs. **So the export layout is a direct function of the mode config
(Pillar 1)** — a light-only brand emits flat/shared; enabling dark pushes the color collection
into `light/`+`dark/`. (The reason is SD's file-globber: two files with the same DTCG path and
different `$value` per mode → last-write-wins / stack overflow. Per-mode dirs keep each mode's
source set collision-free.)

**Leaf + file shape** (confirmed against `Tokens/New Balance/tokens/tokens/shared/radius.json`):
- Leaf: `{ $type, $value, $extensions.figma: { variableId, collection, scopes, codeSyntax } }`.
  `$value` is a raw value **or** a `{namespace.path}` alias.
- File-level `$extensions`: `generator { name, version }` + `figma { collection {id,name,defaultModeId}, mode }`.
- **Namespace is a single segment** (`nbds` in this export) — *aligns with #34*. The plugin's
  `namespace` option supports dotted (`nbds.pds` for Prism2), but the engine emits single-segment.

**Presets** (Token Press §3.1) the engine's export should mirror so a dev's package and a
designer's export agree byte-for-byte:
- **DTCG-spec** (default) — object dimensions/letter-spacing/duration (`{value, unit}`), DTCGColor
  `{colorSpace, components, alpha}`, ratio line-height.
- **Style Dictionary** — string forms (`"16px"`, `"50ms"`, `"rgba(…)"`) for SD 3.x/4.x built-in
  transforms. A one-click recipe, not a different token set.
- Extra bundled files (independent toggles): **CSS** custom properties, **raw Figma** variable dump
  (≈ our `emit-figma`), **dot-notation** JSON.

**The engine delta (Pillar 4 work):** `emit-dtcg` today emits a *single* `<id>.tokens.json` tree.
Aligning = split it into per-collection files under the shared/per-mode layout, stamp the file-level
`generator`+`figma` extensions, and expose the DTCG-spec / Style-Dictionary presets + extra-file
toggles. Values already match (that's the NB regression); this aligns the *packaging*. `emit-figma`
is the raw-Figma sibling and should share the same collection/mode partitioning.

**Deferred (decide when building Pillar 4):** whether a single **pure, shared export module** can
serve both the engine and Token Press (the ecosystem ideal). Token Press's *scan* half is
Figma-API-coupled (reads live variables), but its *convert/emit* half (DTCG shaping, dimension/color
formatting, the transition-composite compiler) is largely pure and ES2018 — a plausible shared core.
Evaluate extractability before committing to share vs. merely align output.

---

## 5. Sequence

1. **`docs/11` (this doc)** — capture the north star. ✅
2. **Pillar 1 — mode configurability** — small, self-contained, unblocks "decline
   dark/HC". Start here.
3. **Evaluate Token Press** (owner shares a sample export into `Prism3/reference/`) →
   finalize the §4 export contract.
4. **Pillar 4 — align the exporters** to the contract (multi-file by collection × mode).
5. **Pillar 2 — override layer** — generated baseline + per-mode overrides, contract-re-validated.
6. **Pillar 3 — brand families** — system + brands over locked names; merge model first.

Each composes with the last. "We don't have to do it all at once" — but every increment
aims at this target so nothing is built that has to be un-built.

---

## 6. What this changes about earlier docs (reconcile, don't rewrite)

- **`09` repo strategy** stands; this is the *capability* layer over that packaging.
- The **mode model** in the engine (`modes.ts`, 4 modes always) becomes *configurable* —
  Pillar 1 is the first edit there.
- The **"modes are derived, not authored"** framing (correct today) gains a nuance:
  derived is the *baseline*; the customizable modes (light, dark) accept an override layer
  on top (Pillar 2).
- **`10` Figma materialization** is one consumer of the §4 export contract; its
  by-collection/by-mode partitioning is the reference the DTCG export aligns to.
