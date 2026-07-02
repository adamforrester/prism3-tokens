# 10 — Figma materialization (the `emit-figma` contract)

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
  "scopes": ["FRAME_FILL","SHAPE_FILL"], "description": "",
  "value": { "r":…, "g":…, "b":…, "a":1 },              // per-mode resolved {r,g,b,a} 0–1
  "alias": { "type":"VARIABLE_ALIAS", "id":"VariableID:…", "name":"palette/neutral/050" },
  "codeSyntax": {} }
```

**Naming transform** (DTCG → Figma): strip the brand namespace (`nbds.`/`prism.`); dots →
slashes; the first segment is the collection (`palette` / `color`); **zero-pad sub-100 scale
steps** (`red.50`→`red/050`, `neutral.25`→`neutral/025`; `red.450` stays `red/450`). Alias
brace refs `{nbds.palette.red.550}` → `palette/red/550`.

**Scopes by role-family** (observed — the engine must carry these per leaf):

| role family | scopes |
|---|---|
| `background`, `scrim` | `FRAME_FILL, SHAPE_FILL` |
| `foreground` | `FRAME_FILL, SHAPE_FILL, TEXT_FILL` |
| `text` | `TEXT_FILL` |
| `icon`, `action` | `FRAME_FILL, SHAPE_FILL, STROKE_COLOR` |
| `border` | `STROKE_COLOR` |

**Values are per-mode.** Each mode file carries the same 95 names with that mode's resolved
`{r,g,b,a}` **and** the same alias — the alias is what actually drives it; the literal value is
belt-and-suspenders. Alpha roles (`scrim` → `black-alpha/60`) alias the alpha palette.

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
- **Typography — next.** `font` + `font-fluid` variable collections (byte-reproduce targets)
  + the 36 text styles with the six §4 fixes applied (so they *differ* from the as-imported
  `text-styles.json` snapshot by design). Then dims/opacity/border variables; shadow→Effect,
  gradient→Paint specs; and generalize (emit aurora/wendys).

Optional cleanup surfaced: correct the now-stale `px-from-ratio`/`px-from-em` line-height/
letter-spacing directive *notes* in `tree.ts` (the contract an ad-hoc reader follows) when the
typography pass lands.

## 6. Thread split

- **This repo (generator):** builds `emit-figma`; owns the contract above.
- **Figma thread (materializer):** replays `emit-figma`'s artifact via the Figma MCP, builds
  specimens, reports findings; emits the text-styles fixture. Coordinates via these artifacts +
  PRs, not live back-and-forth (same pattern as the reviewer thread).
