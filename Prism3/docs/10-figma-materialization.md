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

`Prism3/fixtures/figma/nb/` — the real NB import, exported from **Token Press** (raw Figma
variable JSON). `emit-figma`'s colour output must reproduce these:

| File | `$collection` | `$mode` | vars | aliased |
|---|---|---|---|---|
| `palette.json` | `palette` | `Default` | 122 | 0 (primitives) |
| `color.light.json` | `color` | `light` | 95 | 95 |
| `color.dark.json` | `color` | `dark` | 95 | 95 |
| `color.hc-light.json` | `color` | `hc-light` | 95 | 95 |
| `color.hc-dark.json` | `color` | `hc-dark` | 95 | 95 |

**Not yet captured:** the 36 **text styles** + the `font` / `font-fluid` variable collections
(Token Press doesn't export styles; the Figma thread will emit a JSON dump). Until then the
typography contract below is the spec, not a frozen fixture.

Verified the engine already produces these aliases: `color/action/default` → `palette/red/`
`550`(light)/`450`(dark)/`700`(hc-light)/`300`(hc-dark); `color/background/secondary` →
`neutral/050`(light)/`900`(dark) — identical to `out/nb.tokens.json`'s per-mode `$value`s.

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

An I/O shell over the pure `tree.ts` (`buildTree`): walk the DTCG tree + directives → emit
per-`collection`/`mode` `variables[]` files (colour/dims/opacity/border as variables; typography
as `font`+`font-responsive` variables + text-style specs; shadow→Effect, gradient→Paint specs).
Gate: the colour output **byte-reproduces `fixtures/figma/nb/`** (then aurora/wendys prove
brand-agnostic). Open engine tasks it exposes: add per-leaf **scopes** + **collection** to the
colour directives (verify what's emitted today); apply the six typography fixes.

## 6. Thread split

- **This repo (generator):** builds `emit-figma`; owns the contract above.
- **Figma thread (materializer):** replays `emit-figma`'s artifact via the Figma MCP, builds
  specimens, reports findings; emits the text-styles fixture. Coordinates via these artifacts +
  PRs, not live back-and-forth (same pattern as the reviewer thread).
