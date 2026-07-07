# 10 — Figma materialization (the `emit-figma` contract)

> **⚠️ Collection rename (#66, 2026-07-05, generator thread while the emitter thread was paused):**
> the PRIMITIVE collections are now `core-`-prefixed for at-a-glance scannability in Figma's
> collection list — **`palette` → `core-palette`**, **`dimension` → `core-dimension`**, **`font` →
> `core-font`**, and **`font-fluid` → `type-sets`** (the responsive fluid-size collection). This is a
> **`$collection` label + output-filename** change ONLY: the DTCG tree, the `<root>.*` namespace, and
> the Figma **variable names** (`palette/red/550`, `font/family/*`, `font-fluid/*`) are unchanged — so
> the `variableId` round-trip and every cross-collection alias resolve exactly as before (0 dangling,
> verified). Semantic collections keep bare names. The tables/prose below still show the pre-rename
> labels; treat `palette`↔`core-palette`, `font`↔`core-font`, `font-fluid`↔`type-sets`,
> `dimension`↔`core-dimension` when reading. The `fixtures/figma/nb` byte-repro target keeps the OLD
> labels pending Token Press confirmation (#67) — the gate compares names/scopes/aliases/values, not
> the `$collection` label. Emitter thread: fold the rename through this doc's tables when you resume.

> `07 §11.1` names the owned tools; `08 §5` sets the two materialization routes and the
> Figma variable-type ceiling; `09 §4` decides the plugin absorbs the materialization
> function. This doc is the **contract** that makes it concrete: the exact Figma shape the
> engine's `emit-figma` adapter emits to, proven by two hand-run import spikes (colour +
> typography) and frozen as regression fixtures. It's read by two threads — the **generator**
> (this repo builds `emit-figma`) and the **materializer** (a separate Figma-MCP thread that
> plays the output into a file). They coordinate through the artifacts named here, not live.

---

## 1. Why this exists

The colour and typography spikes proved the engine's `$extensions.prism3.figma` directives are
directly usable — an agent hand-translated DTCG → Figma variables/styles with 0 errors. But
"an agent re-derives the mapping each run" is the drift trap `09` is built to avoid. **`emit-figma`
owns that translation once**: DTCG (`out/*.tokens.json`) + the per-leaf directives → a Figma-ready
artifact every consumer replays. This doc is its spec; the fixtures are its regression target
(**reproduce NB exactly, then generalize** — the same discipline as the token engine's NB regression).

## 2. Regression fixtures (the frozen target)

`Prism3/fixtures/figma/nb/` — the real NB import. Colour + font/font-fluid are raw Figma
variable JSON from **Token Press**; `text-styles.json` is a Plugin-API dump (Token Press doesn't
export styles). Two fixture classes:

**(a) Byte-reproduce targets** — `emit-figma`'s output must match these exactly:

| File | `$collection` | `$mode` | vars | aliased | type |
|---|---|---|---|---|---|
| `palette.json` | `palette` | `Default` | 122 | 0 | COLOR primitives |
| `color.{light,dark,hc-light,hc-dark}.json` | `color` | 4 modes | 95 ea | 95 | COLOR, aliased to palette |
| `font.json` | `font` | `Default` | 38 | 4 | family STRING + size/weight FLOAT; weight-roles aliased to numeric |
| `font-fluid.{desktop,mobile}.json` | `font-fluid` | 2 modes | 10 ea | 0 | FLOAT `FONT_SIZE`, per-mode values |

**(b) Reference-with-known-deltas** — `text-styles.json` (36 styles) is the **as-imported
snapshot**, i.e. the *pre-fix* state: it has the `text/` prefix, line-height in **px**,
letter-spacing baked px, `fontStyle` baked. `emit-figma` intentionally **differs** here by
applying the six §4 fixes — so gate its text-style output against the *corrected* expectation, not
this file byte-for-byte. (The `resolvedByMode` on each property makes it a precise structural
reference regardless.)

Verified the engine already produces the colour aliases exactly: `color/action/default` →
`palette/red/` `550`(light)/`450`(dark)/`700`(hc-light)/`300`(hc-dark); `color/background/`
`secondary` → `neutral/050`(light)/`900`(dark). And the font target confirms fixes already
half-present: `font/family/display` stores the **primary** (`"Inter"`) with the full stack in
its description (fix #4), and weight-roles are FLOAT vars **aliased** to numeric weights
(`emphasis`→`font/weight/600`) — the single-source-of-truth the spike validated.

## 3. The colour contract (proven — reproduce this)

**Two collections.** `palette` (primitives, one `Default` mode, `alias: null`) + `color`
(semantics, four modes, every var an alias into `palette`). Emit the palette first, capture each
variable's Figma id, then emit the `color` vars as `VARIABLE_ALIAS` pointing at those ids — a
**two-pass** write.

**Variable shape** (per entry in `variables[]`):
```jsonc
{ "id": "VariableID:…", "name": "color/background/primary", "resolvedType": "COLOR",
  "scopes": ["FRAME_FILL","SHAPE_FILL"],
  "description": "Page surface — the canvas / base",   // DTCG $description threaded (2026-07-04)
  "value": { "r":…, "g":…, "b":…, "a":1 },             // per-mode resolved {r,g,b,a} 0–1
  "alias": { "type":"VARIABLE_ALIAS", "id":"VariableID:…", "name":"palette/neutral/050" },
  "codeSyntax": {} }
```

**Ref-tier PRIMITIVES also carry `"hiddenFromPublishing": true`** (2026-07-04).
Every var in `palette`, `dimension`, `opacity`, `font/family/*`, `font/size/*`,
`font/weight/*` sets this flag so consumers of the file as a design-token
library only see the semantic layer in the picker. **Limitation:** the flag
narrows the picker only ACROSS a library-consumption boundary; in the file
that defines the primitives they still appear in the local picker. Figma
exposes no scopes-based mechanism to hide from local pickers — the enum
is strictly typed per resolvedType (rejects "bogus" scopes with "Invalid
scope for this variable type"), and `scopes: []` is documented + probe-
verified as ALL_SCOPES (setBoundVariableForPaint succeeds on a var with
scopes=[]). Production discipline: publish tokens as a library, author
components in a separate consumer file. Scopes on primitives stay at
their real role-family targets so, if a component author does need to
bind a raw primitive for a bespoke case (after unhiding), guidance is
still correct.

**Naming transform** (DTCG → Figma): strip the brand namespace (`nbds.`/`prism.`); dots →
slashes; the first segment is the collection (`palette` / `color`); **zero-pad sub-100 scale
steps** (`red.50`→`red/050`, `neutral.25`→`neutral/025`; `red.450` stays `red/450`). Alias
brace refs `{nbds.palette.red.550}` → `palette/red/550`.

**Scopes by role-family** (observed — the engine must carry these per leaf).
`interactive.<colour>.<slot>` (docs/20) and `disabled.<slot>` are **slot-scoped, not
family-scoped** — the slot determines the picker context, not the family. Without their
own slot maps they'd fall through to the fill default and inks would miscase (this is what
the #84 round-trip caught for `disabled/*` — see task #85).

| role family | scopes |
|---|---|
| `background`, `scrim` | `FRAME_FILL, SHAPE_FILL` |
| `foreground` | `FRAME_FILL, SHAPE_FILL, TEXT_FILL` |
| `text` | `TEXT_FILL` |
| `icon` | `FRAME_FILL, SHAPE_FILL, STROKE_COLOR` |
| `border` | `STROKE_COLOR` |
| `interactive.<c>.fill.*`, `.overlay.*` | `FRAME_FILL, SHAPE_FILL` |
| `interactive.<c>.on-fill` | `FRAME_FILL, SHAPE_FILL, TEXT_FILL` |
| `interactive.<c>.text` | `TEXT_FILL` |
| `interactive.<c>.border` | `STROKE_COLOR` |
| `interactive.<c>.on-inverse` | `FRAME_FILL, SHAPE_FILL` |
| `disabled.surface`, `disabled.border` (fill) | `FRAME_FILL, SHAPE_FILL` / `STROKE_COLOR` |
| `disabled.on-disabled` | `FRAME_FILL, SHAPE_FILL, TEXT_FILL` |
| `disabled.text` | `TEXT_FILL` |
| `disabled.icon` | `FRAME_FILL, SHAPE_FILL, STROKE_COLOR` |

**Removed 2026-07-06:** `action` — the family was retired in task #14 (see docs/20).
Components bind `interactive.*` / `disabled.*` instead. The bare `foreground.danger`
replaced the stateful `foreground.danger.*` fills at the same time.

**Values are per-mode.** Each mode file carries the same 95 names with that mode's resolved
`{r,g,b,a}` **and** the same alias — the alias is what actually drives it; the literal value is
belt-and-suspenders. Alpha roles (`scrim` → `black-alpha/60`) alias the alpha palette.

**Colour parsing (`parseColor`, M-08).** `$value` arrives as `rgb()`/`rgba()`, 6-digit `#hex`,
3-digit `#hex`, or — for `colorFormat:'hex'` brands — **8-digit `#RRGGBBAA`** (the `black-alpha`/
`white-alpha` ramp and hex-format shadow colours carry their opacity in the trailing byte). All
four forms parse to `{r,g,b,a}`. Anything else (an unresolvable alias target reaching the emitter,
a malformed value) **throws** — never a silent `{0,0,0,1}` black swatch. (Pre-M-08 there was no
8-digit branch, so hex-format brands' entire alpha ramp shipped as opaque black.)

**API route:** Figma Plugin / MCP only (REST Variables API is Enterprise-only — `08 §5`).

## 4. The typography contract (spec — six fixes from the spike)

The typography import worked but surfaced six corrections `emit-figma` must encode (and, where the
directive text misled, the engine's `$extensions.prism3.figma` should be fixed too, since it's the
contract any ad-hoc reader follows). Full session analysis in the `_research`/chat log; the fixes:

| # | Issue in the hand-run | Fix `emit-figma` encodes |
|---|---|---|
| 1 | Styles nested under a redundant `text/` group | Emit the **exact style name** per composite (`display/lg/strong` — group/size/variant, no wrapper) |
| 2 | Collection name (`font-fluid`) was guessed | **Prescribe collection names** on every axis (`font`, `font-responsive`) — no guessing |
| 3a | Line-height baked as **px** (50.4) | Bake line-height as **PERCENT** (multiplier×100) — unitless, size/mode-independent; unbound (Figma has no unitless line-height variable) |
| 3b | Letter-spacing baked as px | Ship the tracking tokens as **FLOAT variables** (PERCENT = em×100) and **bind** letterSpacing |
| 4 | Family stack stripped to primary by hand | Emit the **primary family** (`stack[0]`) as the bindable value; full fallback stack in the description |
| 5 | `fontStyle` baked, not bindable (no fontStyle primitive) | Emit a **weight-role → named-instance** hint (numeric → the font's real style name, e.g. 600→"Semi Bold"), plugin-resolved from loaded fonts |

Validated and to keep: the responsive collection maps directly from
`$extensions.prism3.responsive.figma.modes` (mobile/desktop); weight-roles as aliased FLOAT
variables (change `emphasis` 600→500, all emphasis styles follow); text styles bind
`fontFamily`/`fontSize`/`fontWeight`, bake the rest, set `textCase: UPPER` (eyebrow) /
`textDecoration: UNDERLINE` (-link).

**Design follow-up (not `emit-figma`):** letter-spacing on `display-3xl`/`2xl` at mobile wants
tighter tracking — points at **size-linked (optical) tracking** rather than a fixed per-composite
value. A separate engine typography refinement.

## 5. `emit-figma` — the build

An I/O shell over the pure `tree.ts` (`buildTree`): walk the DTCG tree → emit
per-`collection`/`mode` `variables[]` files. The DTCG carries the semantic facts; the
Figma-target rendering (role→scopes, name transform, per-mode alias) lives in the adapter.

- **Colour — ✅ BUILT (2026-07-02).** `engine/emit-figma.ts` → `out/figma/nb/{palette,`
  `color.light,color.dark,color.hc-light,color.hc-dark}.json`. Reproduces the fixtures
  **exactly** on variable names (122 palette + 95×4 colour), scopes, and every per-mode
  alias target; values match to float32 tolerance (~5e-7 — Figma stores colour as float32).
  A `test.ts` gate asserts all of that against `fixtures/figma/nb/` (240/240). Scopes are
  **derived here** from the role family (the DTCG doesn't emit them); ids are omitted (Figma
  assigns them and resolves aliases by name at import). Aliases are name-based → the
  materialiser's two-pass (palette first, then colour) resolves them.
- **Typography — ✅ BUILT (2026-07-02).** `engine/emit-figma.ts` → `out/figma/nb/{font,`
  `font-fluid.{desktop,mobile},text-styles}.json`. `font` (38 vars) and `font-fluid.{d,m}`
  (10 vars each) byte-reproduce the NB fixtures exactly (names/scopes/values, weight-role
  aliases target the same numeric weight, family descriptions carry the full fallback stack).
  36 text styles apply the six §4 fixes: (1) no `text/` wrapper; (2) prescribed collection
  names (`font`, `font-fluid`); (3a) lineHeight baked as PERCENT (unitless × 100); (3b)
  letterSpacing baked as PERCENT (em × 100); (4) primary family bound (full stack lives in
  the STRING variable's description); (5) fontStyle derived from the bound weight-role via
  a named-instance table (mono collapses 600 → Medium). `test.ts` block 12 gates all of this
  against the fixtures + the corrected expectation (25 new gates; 265/265 total). Also
  corrected the stale `px-from-ratio`/`px-from-em` line-height/letter-spacing directive
  *notes* in `tree.ts` (§5 "optional cleanup") — values unchanged, prose updated (unit,
  percent, note); nb-regression/emit-dtcg/mode contrasts all still green. Fix 3b bindable
  form (a `font-tracking` FLOAT collection) is deferred to a follow-up so this PR
  byte-reproduces the 38-var `font.json` fixture. **Materialisation loop closed** — the
  Figma-MCP thread imported all 36 corrected styles into a real file, verified they bind
  fontFamily/fontSize/fontWeight to the existing font/font-fluid variables, and rendered
  a typography specimen frame with container/section fills bound to real
  `color/background|foreground/primary` (spike lesson). Next: dims/opacity/border variables;
  shadow→Effect, gradient→Paint specs; and generalize (emit aurora/wendys).
- **Dims — ✅ BUILT (2026-07-02).** `engine/emit-figma.ts` → seven FLOAT collections under
  `out/figma/nb/`: `dimension` (37 primitives — the fine-grid, standalone), `space` (18
  aliased to dimension), `radius` (5), `size` (15 — 5 t-shirts × height/padding-x/padding-y;
  heights alias dimension, paddings alias space — the component tier composes shared
  primitives), `border-width` (4), `focus` (3; the `strokeStyle: 'solid'` leaf is
  intentionally skipped — no Figma variable primitive for strokeStyle), `opacity` (12
  dimensionless in [0,1]). 94 vars total. No fixtures for this axis (§2 covers colour +
  typography only), so the gate is **structural**: variable counts vs the DTCG tree, every
  alias resolves within the emitted collections, scopes narrow per family (space→GAP,
  radius→CORNER_RADIUS, border-width/focus→STROKE_FLOAT, opacity→OPACITY, dimension broad).
  `test.ts` block 13: **14 new gates → 279/279 total**. Materialised into the Figma test
  file via the MCP: all 7 collections created, 45/45 aliases bound (including 3-level chains
  like `size/xs/padding-x → space/100 → dimension/8`), and a dims specimen frame renders
  swatches with `cornerRadius`, `width`, `height`, `padding*`, `opacity`, `strokeWeight`
  bound to their respective FLOAT vars. Container fills bound to `color/background|foreground/*`
  (spike lesson).
- **Wireframe mode — ✅ BUILT (2026-07-04, this PR).** `'wireframe'` is now materialised
  on the two axes it touches in the DTCG tree (docs/11 Pillar 1b, #48). **Colour:**
  `'wireframe'` added to `COLOR_MODES` (canonical position: last). Zero adapter-body
  work — the existing intersection with `theme.modes` picks the mode up and the alias
  target comes straight from `$extensions.prism3.modes.wireframe.$value` (routed to a
  `palette/neutral/*` step by tree.ts). **Radius:** the FIRST non-colour/shadow axis to
  be mode-varying. `buildFigmaDims` returns `radius: FigmaCollectionFile[]` (per-mode
  files, same shape as `color`); a non-wireframe brand emits a single Default-mode
  file `radius.json` (byte-identical to the pre-1b world); a wireframe-opted-in brand
  emits two files (`radius.Default.json` + `radius.wireframe.json`), non-zero radii
  aliasing `dimension/0` in wireframe, `radius.none` untouched. `test.ts` block 22
  gates both changes against a synthetic wireframe brand (no example opts in today);
  16 new gates → **400/400 total**. Default four-mode `out/figma/*` verified
  byte-identical.
- **Shadow + gradient — ✅ BUILT (2026-07-02).** `engine/emit-figma.ts` → `out/figma/nb/`
  `shadow-styles.json` (14 Effect Style specs) + `gradient-styles.json` (0 for NB — opt-in).
  Shadow emits TWO style sets per step (`shadow/xs..2xl + shadow/inset` for light-mode
  canonical; `shadow-dark/xs..2xl + shadow-dark/inset` for the reduced-alpha dark surface-lift
  pattern) because Figma Effect Styles don't support modes — a plugin/component swaps the
  pair at mode transition. Every effect layer parsed to Figma primitives: `type` (INNER_SHADOW
  for `inset`, DROP_SHADOW for the ramp), `{r,g,b,a}` float32 colour, `offset {x,y}`, `radius`,
  `spread`, `visible: true`, `blendMode: 'NORMAL'`. Gradient is opt-in: NB has none (empty
  styles[], consistent shape); aurora emits 2 Paint Styles (brand + glow) each with 2 canonical
  stops + 5 `sampledStops` (sRGB pre-sample of the OKLCH curve — Figma interpolates in sRGB
  only, so plugins can lay down denser stops for OKLCH-authored gradients) + a11y worst-on-
  white/worst-on-black ratios per style (the text-on-gradient contract). `test.ts` block 14:
  **14 new gates → 295/295 total**. Materialised via MCP: 14 Effect Styles on a two-row
  (light-surface / dark-surface) shadow specimen, showing the elevation ramp and the reduced
  dark alphas; 2 Paint Styles on a gradient specimen with `gradientTransform` matrices for
  linear-135° and radial-ellipse, colours applied via native Paint Styles (aurora palette
  not yet imported into this file, so demo swatches use `sampledStops` hex values directly —
  the alias-driven form landed once aurora is materialised in the generalise pass).

Optional cleanup surfaced: correct the now-stale `px-from-ratio`/`px-from-em` line-height/
letter-spacing directive *notes* in `tree.ts` (the contract an ad-hoc reader follows) when the
typography pass lands.

## 6. Ownership (settled 2026-07-02)

- **Figma-emitter agent** — owns **all remaining `emit-figma` work** (this doc's §7): the
  engine adapter code (`engine/emit-figma.ts` + its `test.ts` gates) *and* verifying its output
  by materialising into Figma via the **Figma MCP** (the loop the colour spike opened). It builds
  the emitter and checks each axis renders in a real file. Works in a thread with this repo pulled
  down + the Figma MCPs attached.
- **Generator thread** (the one that built the engine + colour axis) — moves to the **non-Figma
  surfaces**: the web dashboard, then the MCP adapter. It does **not** touch `emit-figma.ts`
  further.

Coordination: both branch off `main`, one PR per increment, independent reviewer, merge in
sequence. **The Figma-emitter agent owns `emit-figma.ts` and all its `test.ts` gates**; the
generator thread stays out of those files (its web work is in `web/`; a later MCP adapter is its
own package). Pull `main` before starting each increment. No live back-and-forth — coordinate
through committed artifacts + PRs (same pattern as the reviewer thread).

## 7. Remit for the Figma-emitter agent (read this first)

**Your role:** own `emit-figma` end-to-end for every axis after colour — write the adapter code,
gate it in `engine/test.ts`, and **materialise your output into Figma via the MCP to verify it
renders**. You have the Figma MCP; use it to close the loop on each axis.

**Start here:** read this whole doc (the contract), then `engine/emit-figma.ts` (the colour axis
— your template) and its gate in `engine/test.ts` (block 11). Run `npx tsx Prism3/engine/test.ts`
(240/240 today) and `npx tsx Prism3/engine/emit-figma.ts` (writes `out/figma/nb/`). Engine runs on
`tsx`, **no build / no `npm install`**.

**The pattern (from the colour axis):** an I/O shell over the **pure** `tree.ts` `buildTree`. Read
the *semantic facts* from the DTCG tree (`$extensions.prism3` — `aliasOf`, per-mode `modes`, the
`figma` field/scope hints, `responsive.figma.modes`); own the *Figma-target rendering* in the
adapter (collection/scope/name/unit decisions). Emit per-`collection`/`mode` files matching the
fixture shape; **omit ids** (Figma assigns them; alias **by name**).

**Coverage (audit 2026-07-03):** of the DTCG tree's 16 top-level groups, emit-figma covers
**12** (palette, color, font, type, shadow, dimension, space, radius, size, focus, opacity,
border-width). The **4** uncovered — `motion`, `breakpoint`, `grid`, `container` — fold into
**2** remaining Figma collections: `layout` (breakpoint + grid + container, item 4) and
`motion` (item 5).

**Queue, in order:**
0. **✅ DONE (2026-07-04, this PR) — Wireframe mode (from Pillar 1b, #48).** `'wireframe'`
   is an opt-in generated greyscale mode; emit-figma materialises it on TWO axes.
   (a) The `color` collection gains a `wireframe` MODE — added `'wireframe'` to
   `COLOR_MODES` (canonical position: last). Every role's
   `$extensions.prism3.modes.wireframe.$value` aliases a `palette/neutral/*` step;
   the emit-figma intersection with `theme.modes` picks it up automatically. (b)
   The `radius` collection becomes MODE-VARYING — non-zero `radius.*` DTCG leaves
   carry `$extensions.prism3.modes.wireframe → {root.dimension.0}` (tree.ts:340–346).
   `buildFigmaDims` now returns `radius: FigmaCollectionFile[]` (per-mode files, same
   shape as `color`): a non-wireframe brand emits a single `radius.json` (Default
   mode, byte-identical to the pre-1b world); a wireframe-opted-in brand emits two
   files (`radius.Default.json` + `radius.wireframe.json`) where non-zero radii alias
   `dimension/0` and `radius.none` stays 0. This is the FIRST non-colour/shadow axis
   to be mode-varying — the load-bearing precedent for future mode-varying geometry.
   No example brand opts into wireframe today, so gated against a SYNTHETIC
   wireframe-enabled brand (same pattern as blocks 18 + 20 — `brandTheme({ …input,
   modes: [..., 'wireframe'] })`). 16 new gates → `test.ts` **400/400 total**. Default
   four-mode `out/figma/*` byte-identical (regenerated + verified).
   **Materialise-to-verify — ✅ DONE (2026-07-04):** the wireframe axis was
   materialised into a live Figma file via the MCP on the specimen slice used
   by the greyscale contract (7 palette primitives + 6 role vars × 2 modes +
   5 radius vars × 2 modes, namespaced `wireframe-demo/*` in the Prism3 Test
   File). A two-column specimen frame flips the SAME layer tree between the
   `light`/`Default` and `wireframe`/`wireframe` modes via
   `setExplicitVariableModeForCollection`: `color/foreground/brand` flips
   `palette/primary/550` (violet) → `palette/neutral/600` (grey);
   `color/action/default` flips `palette/accent/600` (azure) →
   `palette/neutral/600`; every non-zero radius (`sm`/`md`/`lg`/`round`) flips
   its bound `dimension/N` alias → `dimension/0` so corners square off.
   Screenshot at `Prism3/docs/assets/wireframe-specimen.png`. The parked
   **aurora + wendys full-materialise** follow-up from #50 remains open (its
   own PR — end-to-end variable-artefact import for both brands, not just the
   wireframe subset). Once that lands, the [Figma-emitter] queue's only
   remaining spec item is **motion**, still deferred.
1. **Typography — ✅ DONE (2026-07-02, #31).** `font` (38) + `font-fluid` (10 × mobile/desktop)
   byte-reproduce the fixtures; 36 text styles apply the six §4 fixes and gate against the
   corrected expectation (not the pre-fix `text-styles.json` snapshot). `tree.ts` LH/LS
   directive notes corrected (§5). 25 new gates; materialised to Figma via MCP and rendered
   a specimen frame with real container-fill bindings. Fix 3b bindable form (a `font-tracking`
   FLOAT collection) deferred to a follow-up so this PR byte-reproduces the 38-var `font.json`.
2. **Dims / opacity / border — ✅ DONE (2026-07-02, #33).** Seven FLOAT collections
   (dimension + space + radius + size + border-width + focus + opacity — 94 vars, 45 aliases).
   No fixtures for this axis, so gated structurally (16 new gates). Materialised via MCP;
   specimen frame renders geometry bindings. Focus's `strokeStyle: 'solid'` leaf skipped
   (no Figma variable primitive). Opacity emitted as PERCENT 0–100 (Figma OPACITY scope
   expects percent, not fraction — dogfood catch, fixed at the adapter).
3. **Shadow → Effect Style + gradient → Paint Style — ✅ DONE (2026-07-02, #35).** Styles,
   not variables (§08 §5 variable-type ceiling). Shadow emits **two style sets** per step
   because Figma Effect Styles don't support modes: `shadow/xs..2xl + shadow/inset` (light) +
   `shadow-dark/*` (dark, reduced-alpha surface-lift). NB → 14 Effect Styles. Gradient is
   opt-in per brand: NB emits empty (consistent shape), aurora emits 2 Paint Styles (brand +
   glow) with 2 canonical stops + 5 `sampledStops` (sRGB pre-sample of the OKLCH curve;
   Figma interpolates in sRGB only) + a11y worst-on-white/black ratios per style. 14 new
   gates. Materialised via MCP: 14 Effect Styles on a two-row (light/dark) specimen; 2 Paint
   Styles as violet-azure + violet-glow swatches (demo hex; aurora palette import lands with
   the generalise pass for the alias-driven form).
4. **✅ DONE (2026-07-03, #46) — Layout: `breakpoint` + `grid` + `container`.** The DTCG tree already carries
   explicit Figma directives on every `grid.*` leaf: `figma.collection: 'layout', mode: <bp>`.
   That prescribes the target — **one `layout` variable collection with breakpoint modes**
   (`sm`/`md`/`lg`/`xl`/`2xl`), each mode carrying `grid/columns` (FLOAT, 4/8/12/12/12),
   `grid/gutter` + `grid/margin` (FLOAT, aliased to `space/*` — a per-mode alias, since gutter
   and margin change per breakpoint), and `container/max` + `container/narrow` (FLOAT,
   viewport-invariant so same value per mode). `container/fluid` (`100%`) has no scope in
   Figma and stays code-side. `breakpoint/*` (the min-width thresholds themselves) are
   descriptive; emit into `layout` as documentation but they're not directly bindable to
   anything today. Structural gate (no fixture): the layout collection has 5 modes, every
   grid var aliases into `space/*` correctly, every alias resolves. Materialise-to-verify:
   a spread frame renders 4/8/12-column grids at three breakpoints with `gutter` and
   `margin` bound to the layout collection's per-mode values.
5. **Motion.** Figma added motion variables at Config 2026 (TIME scope per the KB
   `_research/2026-06-28-figma-variables-styles-roundtrip` finding). Emit a `motion`
   collection with `motion/duration/*` (6 FLOAT × TIME) + `motion/duration-reduced/*` (the
   reduce-motion companion, same shape) + `motion/stagger` (FLOAT × TIME). `easing.*`
   (cubicBezier), `spring.*`, and `transition.*` composites **have no Figma variable
   representation** — they emit into descriptions or a `motion-styles.json` companion (like
   `shadow-styles.json`) as reference metadata, not bindable primitives. Verify current
   Figma Plugin API surfaces `TIME` scope before implementing; if not landed yet, defer.
   **⏸ DEFERRED (2026-07-04, #50): probed the Plugin API — `TIME` is not in the FLOAT-var
   scope enum yet (only `ALL_SCOPES`/`CORNER_RADIUS`/`WIDTH_HEIGHT`/`GAP`/… surfaced; `TIME`
   rejected). Defer per the rule above; revisit when the scope lands.**
6. **✅ DONE (2026-07-04, #50) — Generalise** — emit aurora + wendys too (prove brand-agnostic).
   No fixtures for those, so gated on structural validity (every axis emits the right shape;
   every colour/dims/layout alias resolves *within each brand*; no namespace leakage — `figName`
   strips whichever root the brand carries). All three brands (nb fixture / aurora engine-native /
   wendys STANDARD-dialect) compile through the same shell with no new adapter code. **The
   alias-driven aurora gradient Paint Style now lands** — `gradient/brand → palette/primary/600` +
   `palette/accent/500`, `gradient/glow → accent/400` + `accent/700`, every stop resolving to a
   colour leaf in aurora's own tree. **Materialise-to-verify (aurora + wendys into Figma via MCP)
   remains the one open follow-up** — deferred because the Figma MCP was disconnected mid-session.

**Follow-up parked from typography (2026-07-02):** §4 fix 3b full form — ship a
`font-tracking` FLOAT variable collection (6 tokens: tighter/tight/snug/normal/wide/wider,
values em × 100), extend `fixtures/figma/nb/font.json` (or a sibling `font-tracking.json`)
to include them, and rebind `letterSpacing` on all 36 text styles. Baking as PERCENT is
intentional (mode/size-independent) and correct — the follow-up moves brand-retunable
tracking off the style layer.

**Follow-up parked from dims (2026-07-02):** `color/foreground/secondary` and
`color/border/primary` resolve to the same primitive step in the DTCG tree. Not an
emit-figma bug; whether the two roles should diverge is a semantic-layer design call
(generator thread), not a materialisation gap. Owner spotted this checking border-widths.

**Follow-up parked from mode-opt-out (2026-07-03, post-#42):** `BrandInput.modes` lets a
brand ship any subset of `{light, dark, hc-light, hc-dark}`. `emit-figma`'s colour axis
still hardcodes all 4 modes: `export const COLOR_MODES = ['light', 'dark', 'hc-light',
'hc-dark']`, and the alias falls back to `leaf.$value` (light) when `ext.modes.<m>` is
absent. Effect: a light-only brand's output would carry `color.dark.json` with light
values, silently misleading the materialiser. Fix: read `theme.modes` (or scan
`ext.modes` keys across all roles) and emit only the modes present. Shadow's dark-mode
style set has the same latent issue (`buildFigmaShadow` iterates `leaf.$extensions.
prism3.modes.dark`; light-only brands correctly emit *no* `shadow-dark/*`, so shadow is
already ok). Fixed with the layout or motion pass, whichever lands first.

**Definition of done per axis:** the `test.ts` gate is green, `out/figma/*` regenerates
byte-identical, the existing engine emits (`emit-dtcg`, `nb-regression`) are unaffected, **and** you
have materialised the axis into a Figma file via the MCP and confirmed it renders (a specimen frame
is the ideal artifact — that's also the `style-guide-generator` absorb target from `09 §4`).

**Reference:** `docs/09 §4` (plugin-absorb map), `08 §5` (variable-type ceiling: colour/dimension →
variables, typography → atoms + Text Style, shadow → Effect Style, gradient → Paint Style, REST is
Enterprise-only). The materialisation container-fill lesson from the spike: bind verification-frame
containers to real `color/foreground/*` surface variables, don't hardcode.

## 8. Materialising into Figma (the plugin-write procedure)

`emit-figma.ts` produces the raw-figma export at `out/figma/<brand>/`; this section is how
that JSON becomes real variables in a live file. The deterministic generator is
**`Prism3/engine/materialise-to-figma.ts`** — a stateless shell that turns the export
into plugin-JS payloads you paste into `figma_execute`. Its header carries the full rule
set; the summary below is a fresh-agent quick-start.

**Why a generator (not `figma_import_tokens` or `figma_batch_create_variables`):** both
"smart" paths silently drop the semantics the §3 contract enforces. `import_tokens` is
DTCG-only (our export is raw-figma-shaped). `batch_create_variables` accepts no scopes /
description / `hiddenFromPublishing`. The only faithful path is executing the Variables
Plugin API directly — which the helper generates.

**The four passes (paste each into `figma_execute` in order):**

```bash
npx tsx Prism3/engine/emit-figma.ts                                       # regen out/figma/
npx tsx Prism3/engine/materialise-to-figma.ts <brand>                     # manifest: byte sizes
npx tsx Prism3/engine/materialise-to-figma.ts <brand> --pass palette      # 1
npx tsx Prism3/engine/materialise-to-figma.ts <brand> --pass color-create # 2
npx tsx Prism3/engine/materialise-to-figma.ts <brand> --pass color-aliases # 3
npx tsx Prism3/engine/materialise-to-figma.ts <brand> --pass verify       # 4
```

1. **`palette`** — creates `core-palette` (primitives, one mode, all
   `hiddenFromPublishing: true`). Must run first: pass 3 aliases target these var IDs.
2. **`color-create`** — creates the `color` collection with all N modes (`light`, `dark`,
   `hc-light`, `hc-dark`; `wireframe` if opted in) and writes the literal fallback
   `{r,g,b,a}` per mode. Every var also carries its slot-scoped `scopes` and `description`.
3. **`color-aliases`** — rebinds each var **per-mode** as a `VARIABLE_ALIAS` into the
   palette. Each row is `[name, [target-per-mode]]`; the helper reads each mode file's
   own alias target, so the mode-collapse bug the hand-rolled script hit in #84 is
   structurally impossible here.
4. **`verify`** — reads back via `getLocalVariablesAsync` (authoritative for scopes,
   aliases, modes, hidden). Reports `colorVars`, `modes`, **`modesDistinct: true`**
   (the collapse guard, probing `color/background/primary` across modes), the
   `interactive/*` and `disabled/*` slot scopes, `retiredRolesAbsent`, and
   `bareDangerPresent`.

**Hard-won rules encoded in the helper (don't relearn these):**

- **Collection ordering.** `core-palette` before `color` — aliases can only bind once
  the target var IDs exist. Enforced by pass order.
- **Two-pass colour write.** Create + literals first; rebind aliases second. Doing both
  in one loop means half the aliases target vars that haven't been created yet.
- **Per-mode alias binding.** Each mode gets its own `createVariableAlias(targetVar)`.
  The hand-rolled first attempt bound light's target to all four modes → every mode
  collapsed to light values. `modesDistinct` in the verify pass exists to catch this.
- **Payload budget.** ~45 KB per `figma_execute` call is comfortable; each pass is a
  separate call. The manifest prints byte sizes and flags anything over budget.
- **API-probe verify, not screenshots.** Variables aren't rendered on the canvas.
  Reading `getLocalVariablesAsync` is authoritative; a screenshot only tells you the
  file opened.

**Scope today:** the `core-palette` + `color` collections (what the round-trip test needs).
Other axes — `dims`, `layout`, `font`, `type-sets`, `shadow`, `gradient` — can be added
the same way as they're needed; the pattern is the shell in
`materialise-to-figma.ts` around `emit-figma`'s corresponding builder output.
