# 00 — Progress & Status Log

> A living record of where Prism3 is, what was decided and why, and what comes
> next — so the work survives context loss and a fresh agent (or human) can pick
> it up without re-deriving anything. Update this when state or direction
> changes. Most recent entry first.

---

## Latest (2026-07-03) — E2E integration arc

Since the token layer completed, work has been the **designer↔developer↔agent E2E pipeline**
(`07`/`08`/`09`/`10`). Shipped to `main`, newest first (see the decisions log for the why):

### Fresh-agent brief — pick up here

Two threads are live: the **Figma-emitter agent** (owns `emit-figma.ts` + its `test.ts`
gates; materialises axes into Figma via MCP) and the **generator thread** (everything
else — engine core, web dashboard, docs). Coordinate via committed artefacts (docs/10 §6).

- **emit-figma today:** colour + typography + dims + shadow + gradient + **layout**
  axes shipped (#28, #31, #33, #35, #46). Mode-opt-out fix landed (#49) — a light-only
  brand no longer emits dark files with light values. **Generalise** landed (this PR) —
  aurora + wendys now emit through every axis (aurora's alias-driven gradient Paint
  Style is live). Fully specified in `docs/10-figma-materialization.md`.
- **emit-figma next (docs/10 §7 queue post-#50, 2026-07-04):**
  1. ★ **Wireframe mode (from generator thread 1b, #48)** — `'wireframe'` is a valid
     opt-in mode. Two materialization changes when a brand opts in: (a) the `color`
     collection gains a **wireframe** mode (greyscale, every role's
     `$extensions.prism3.modes.wireframe.$value` aliases a `neutral.*` step); (b)
     **geometry becomes mode-varying** — non-zero `radius.*` leaves carry
     `$extensions.prism3.modes.wireframe → {root.dimension.0}`. So the radius variable
     collection needs a **wireframe mode** (radius → 0). This is the first non-colour/
     shadow axis to vary by mode. Only fires when `theme.modes.includes('wireframe')` —
     the default four are untouched. No example brand opts in today, so gate against a
     synthetic wireframe-enabled brand (`brandTheme({ ...input, modes: [..., 'wireframe'] })`
     — same pattern as blocks 18 + 20).
  2. **Motion — STILL DEFERRED.** Probed the Figma Plugin API on 2026-07-03; `TIME`
     scope is not in the FLOAT-var enum yet (Config 2026 hasn't surfaced it). Recheck
     when it lands. easing/spring/transition composites have no Figma variable primitive
     — emit as `motion-styles.json` reference metadata only.
  3. **Follow-ups parked (typography #31):** fix 3b bindable form — `font-tracking`
     FLOAT collection (6 tokens: tighter/tight/snug/normal/wide/wider); rebind
     `letterSpacing` on all 36 text styles.
  4. **Follow-up parked (materialise-to-verify, from #50):** import aurora + wendys
     artifacts into the Prism3 Test File via Figma MCP. figma-console MCP disconnected
     mid-session on 2026-07-03; the structural gates prove alias resolution + gradient
     targets — this is purely visual confirmation.
- **Test file:** the Figma-MCP thread's target is "Prism3 Test File" (fileKey
  `Zrn9YDqrFiwjs2IfKInNY0`). It has 4 specimen pages already (Colour, Typography, Dims,
  Shadow, Gradient) + all the corresponding variable collections + styles imported live.
- **Run commands:** `npx tsx Prism3/engine/emit-figma.ts` writes `out/figma/{nb,aurora,wendys}/*.json`;
  `npx tsx Prism3/engine/test.ts` gates everything (384/384 today).

---

- **Code-review fix CR-05 — design.md parser silently dropped misindented lines** (`design-md.ts`): the
  YAML-subset parser's `map`/`seq` loops run `while lines[pos].indent === indent`, so a line whose indent
  doesn't fit its block (one stray space) — or a no-colon/prose line (`if (ci < 0) break`) — ended the loop
  early and left that line **and everything after it** unparsed, with **zero diagnostics**: a designer's
  lever (or a whole trailing section) just vanished, and if the dropped key was optional the engine emitted
  defaults silently. Fix: track a 1-based source line per `Line`, and after parsing **throw if any line was
  left unconsumed**, naming the offending line number + content ("unparseable frontmatter at line N …").
  Loud failure instead of silent drop. Verified: the finding's exact probes now throw — a `chroma:`
  over-indented one space (drops `chroma` + trailing `radiusScale`) and a stray prose line (truncates the
  rest) — while the correctly-indented equivalents still parse byte-identically. The web import already
  try/catches `parseDesignMd`, so it now surfaces the error and keeps the working brand (better UX, no web
  change). Gate: adversarial parser suite (over-indent / stray-line throw with a line number; valid parses
  clean). test **368/368**, `out/*` byte-identical. **This clears the engine/web HIGH tier** (CR-01/03/04/
  05/06/07); CR-08 + the emit-figma MEDs remain with the Figma-emitter agent.
- **Code-review fix CR-04 — hand-rolled schema validator ignored keyword classes** (`emit-dtcg.ts`
  + `theme-schema.json`): the validator (the boot check for the CLI *and* the sandbox hosts) had no
  `boolean` branch (so `{type:boolean}` matched anything — incl. inside a `oneOf`, which is why
  `gradients:"banana"` passed → `brandTheme` then crashed on `.map`), checked `enum` only under
  `type:string` (numeric `titleFloor:[16,18]` unenforced), and never checked `minItems`/`maxItems`.
  So `[schema] ✓ conforms` actively vouched for inputs the schema rejects. Fix: added `boolean` +
  `integer` branches, moved `enum`/`const` to a **type-independent** check, added `minItems`/`maxItems`,
  and a **loud-fail guard** — an unhandled `type` now throws instead of silently passing, so the
  silent-ignore class can't recur. **The stricter validator immediately exposed a real schema↔engine
  drift** (the finding's 2nd probe): `families.variable` was declared `boolean`, but the engine's
  `BrandInput` accepts `boolean | Partial<Record<'display'|'text'|'mono', boolean>>` and **aurora uses
  the per-face object** — so the schema was mis-describing the contract. Corrected the schema to the
  real `oneOf[boolean, per-face-object]`; all three example brands conform again. Gate: adversarial
  validator suite (`gradients:"banana"` / `titleFloor:17` / short `easingEmphasized` / `variable:"yes"`
  all rejected; valid forms incl. the per-face object accepted). test **364/364**, `out/*`
  byte-identical (validation-only; no token change). *A stronger validator also backstops CR-03/CR-05.*
- **Code-review fix CR-06 — the NB regression can now fail** (`nb-regression.ts`): it was a pure report
  generator — ΔE00 outliers, contract failures, and dimension mismatches rendered as ⚠️/❌ markdown rows and
  it **always exited 0**, so a ramp-math regression shipped green (only a human reading the report noticed),
  and its ≤3 verdict was a *mean-of-means* (a single ΔE-15 step hides under a good aggregate). Fix: a real
  gate that sets `process.exitCode = 1` on any of — (1) a **per-step ΔE00 ceiling** (3.5 bar) with the NB
  hand-nudges enumerated in a `KNOWN_OUTLIERS` allowlist (each with its own ceiling, so a *new* regression at
  those steps still trips; replaces the static "known kink" prose that would have masked a fresh bug with the
  same signature — finding (c)); (2) a **covered-count assertion** (20 steps/palette — a truncated/renamed
  fixture → 0/0 NaN can no longer slip through — finding (a)); (3) any **contrast contract** fail; (4) any
  **dimension** mismatch. Also hardened `specs[0]`/`specs[3]` → lookup-by-palette (L-12) so a spec-order
  change can't point the contract gate at the wrong ramp. **Verified both directions:** current engine PASSES
  (exit 0 — every step within ceiling, 4×20 covered, 11/11 contracts, 23/23 dims); a simulated regression
  (amber.600 ceiling forced below its real 9.15) FAILS with exit 1 and a precise per-step message. test
  355/355 (unaffected — test.ts doesn't run this), `out/*` byte-identical.
- **Code-review fix CR-03 — brandColors palette-name guard (reserved / charset / duplicate)** (`theme.ts`):
  brand-colour names were unvalidated, and the palette map is last-wins (`new Map(palettes)` /
  `palette[name] = node`) — so a brandColor named `neutral`/`primary` silently **replaced** the engine
  ramp the whole surface model builds on, a status name (`success`/`danger`) was itself replaced by the
  later-pushed status ramp, and dotted/spaced/symbol names broke `{root.palette.…}` alias paths; contrast
  picks then recomputed against the corrupted map and passed self-consistently (green gates, nonsense
  output). Fix: `brandTheme()` now validates each `brandColors[].name` up front — rejects the 10 reserved
  engine palette names (`primary`/`neutral`/`success`/`warning`/`info`/`danger`/`white`/`black`/
  `*-alpha`), enforces the `^[a-z][a-z0-9-]*$` slug (also closes CR-07's XSS vector at the source — an
  HTML-metachar name can't validate), and rejects duplicates. Matches the existing `root`/`actionPalette`
  throw-at-boundary pattern, so the web import/rename path inherits it (rebuild fails → last-good kept).
  Added a schema `pattern` on the name (belt-and-suspenders; enforced by `validateBrandInput`). Gate:
  adversarial-name suite in the namespace block (reserved/dotted/spaced/symbol/duplicate all throw; a
  valid slug is accepted; schema half agrees). Gates: test **355/355**, `out/*` byte-identical (aurora's
  `accent` is valid — no valid brand changes), nb-regression clean. *L-06 (gradient names) is the adjacent
  LOW finding — same class, left for its own pass.*
- **Code-review fix CR-07 — web XSS: brand palette name reached `innerHTML`** (`web/src/main.ts:146`):
  the ramp anchor label built its markup with `meta.innerHTML = \`anchor <b>${name}…\``, and `name` is a
  brand-controlled `brandColors[].name` (pasted `design.md` / accent rename, no charset validation — CR-03).
  A name like `x</b><img src=q onerror=…>` executed on the next ramp paint. Fix: build the label with
  `el()`/`textContent` + a text node (the idiom the rest of the file already uses), never `innerHTML`.
  **Verified headless:** added a 2nd accent named with a tag-breaking `<img onerror>` payload (so the theme
  rebuilds cleanly), confirmed it reaches line 146 and renders as **literal text** — `<b>`.textContent is the
  raw string, 0 `<img>` elements in the doc, `window.__xss` never set, no dialog. Web typecheck + build clean.
  *Gate:* the honest gate is a headless web behavioural-smoke harness (gate blind-spot #8, also covers
  M-15/16/17); the repo has no web test runner yet, so that harness is a separate infra task — noted, not
  built here, to keep the fix surgical. The `readout.innerHTML` at `:283` is NOT a sink (`<input type=color>`
  value is browser-constrained `#rrggbb`); `visualize.ts` `esc()` gaps are the separate LOW finding L-10.
- **Code-review fix CR-01 — `contrast()` rounded before threshold comparison** (`color.ts` + emit
  boundaries; first of the project code-review backlog in `docs/16-code-review-findings.md`):
  `contrast()` did `Math.round(x*100)/100` *inside* the function, so every
  WCAG pass/fail compared the rounded ratio — a role at raw 6.9948 read 7.00 and **false-passed** a
  7:1 HC contract. Fix: `contrast()` returns the **raw** ratio; `ResolvedRole.ratio` holds raw (gates
  now compare un-rounded); rounding moved to the emit boundaries only (`tree.ts` role `contrast`/
  `contrastOnWhite`/gradient a11y, `ai-metadata.ts` `contrast_with`/gradient prose, `resolve-preview`
  splits raw-for-pass from rounded-for-display). Caught real shipped false-passes: **harbor** `hc-light`
  `success.700 @ 7.00` (raw 6.99) → corrected to `success.750 @ 8.43`; `on-success` cascaded 9.67→11.65.
  NB roles unaffected → `nb.tokens.json` + emit-figma NB output **byte-identical**; aurora byte-identical
  after the display-round fix. Added a regression gate (raw `#007ea1`/black = 4.4990 must read < 4.5;
  `contrast()` must not be pre-rounded). Gates: test **349/349**, nb-regression clean, emit-dtcg 622/622
  + 248/248, web typecheck clean. *One concern per PR + its gate, per the review's own guidance.*
- **Project code review — findings documented, nothing fixed** (`docs/16-code-review-findings.md`,
  2026-07-03): full-codebase review (engine + web + regression harness), baseline green first
  (336/336, out/* byte-identical). 8 HIGH + 18 MEDIUM + 17 LOW findings, headline: `contrast()`
  rounds before threshold comparison → WCAG false passes structurally invisible to the gates
  (probe-verified: raw 4.49898 reported as 4.50-pass); the contrast floor is two steps shallower
  than the shipped surface ladder; duplicate palette names silently hijack engine ramps; the
  schema validator ignores boolean/enum-on-number/minItems; the YAML parser silently drops
  misindented lines; nb-regression cannot fail (exit 0 always); web XSS via brandColors names;
  emit-figma layout crashes on non-5-breakpoint brands. Four cross-cutting themes: self-referential
  verification, NB-only structural gates, silent degradation over loud failure, validator weaker
  than schema. §5 lists the gate blind spots to close as fixes land — **one fix + its gate per PR**.
- **Pillar 1b — wireframe mode** (`modes.ts`/`theme.ts`/`tree.ts`, docs/11 Pillar 1b): `'wireframe'`
  is now a generated opt-in mode — a mechanical greyscale. `VALID_MODES` (five) splits from `ALL_MODES`
  (the default four, unchanged → four-mode golden byte-identical); wireframe is opt-in only, never a
  default. **Colour:** every *chromatic* role resolves on the **neutral** ramp at the position its colour
  pick would land, then re-nudged to clear the *same* min on neutral — so the greyscale still holds every
  contrast contract (verified: e.g. `foreground.brand` primary.550 → neutral.600, nudged one step to keep
  its 4.5:1 fill contract). Neutral/text/background/white/black roles pass through. **Geometry:** non-zero
  `radius.*` leaves gain `$extensions.prism3.modes.wireframe → {root.dimension.0}` — the *first* mode-varying
  geometry (same override shape colour/shadow use); `radius.none` stays override-free. Emit-figma
  coordination noted in the fresh-agent brief (radius collection needs a wireframe mode). Gates: test
  **344/344** (+8 wireframe: greyscale remap, radius→0, every wireframe contract holds), nb-regression +
  emit-dtcg `out/*` **byte-identical** (no example brand opts in), web typecheck clean.
- **Pillar 1b web — wireframe toggle + per-mode preview geometry** (`web/src/main.ts`,
  `resolve-preview.ts`): the brand menu gains a **Wireframe** toggle beside Dark/HC (`setModes`
  now takes a third flag, appends `wireframe` last = the engine's canonical mode order); the
  preview's mode selector extends to Wireframe automatically. Geometry is now per-mode:
  `resolvePreview` exposes **`dimOverrides`** (sparse — only refs/modes that differ from the
  canonical baseline, mirroring the tree's `$extensions.prism3.modes`), and `renderChip` reads
  `dimOverrides[ref]?.[mode] ?? dims[ref]` so wireframe squares off corners live. Verified
  headless: default 4 modes → enabling wireframe → 5 (Wireframe appended); a saturated Light
  chip `rgb(0,97,136)` collapses to the neutral `rgb(92,92,97)` (chroma spread 136 → 5) with
  radius 8px → 0px; 0 page errors. Gates: test **347/347** (+3 `dimOverrides`), web typecheck
  clean. No engine-value change (dims baseline untouched → nb-regression + `out/*` still
  byte-identical). Completes 1b end-to-end (engine + UI), mirroring the 1a #42→#43 split.
- **Deployment-target neutrality captured** (`docs/15-deployment-neutrality.md`): the owner named the
  likely *delivery* of the north star — an **AWS / Bedrock hosted E2E service** using **LLMs as needed**
  but with the **core staying pure deterministic code**. Recorded as an architectural *constraint*, not a
  build task: three layers (pure core / assistive-LLM edge / host+state edge), and the rule that hosting,
  persistence, auth, transport, and model calls live *outside* the core — LLMs propose inputs to and
  narrate outputs from the engine, never compute a token value inside it. AWS is just the next I/O shell;
  it validates the portable-core bet rather than changing it, and adds a *third* option for the export
  core (a hosted service Token Press calls, vs. a vendored package) — another reason the `12` vendoring
  call is safely deferrable. **The standing review check from here on: does a PR add I/O, state, or a
  model call to a pure module? If yes, it belongs in a shell.** Nothing to build; the line to hold.
- **Component-layer contract locked** (`docs/14-component-layer.md`, 2026-07-03): the owner's
  question — store components as data and build them in Figma on the fly, LLM-free, like
  variables — answered YES and captured as the architecture: definitions as type-checked data
  **seeded from the KB's ~40 component briefs (§15 schemas)** and **bound to the locked token
  names (docs/11)** so structure is brand/mode-invariant; write leg = an `emit-figma` component
  artifact executed by the B2 plugin via the Plugin API (REST can't create nodes; same two-route
  pattern as 08 §5); verify leg = **extraction diff** (Specs CLI verified extraction-only —
  its seat is the component-tier nb-regression, not the builder); ceilings incl. the
  **Figma Motion revision** (timing/easing variables now exist — the "transition = code-only"
  disposition in 05/10 is stale; KB 18–21 flagged for update). Build sequence: schema → 3
  components (Button/Text Field/Card) → artifact → materialize (MCP first, plugin after) →
  round-trip gate → scale. Doc-only; nothing built.
- **Inspirations log started** (`docs/13-inspirations.md`, 2026-07-03): reviews of external
  agent-first DS work — Astryx (Meta; CLI-as-agent-interface, typed `ComponentDoc` data files,
  `agent-docs` index injection, `--compact` tiers), the "ds-brain" practitioner stack map
  (docs-package-as-brain, generated skills/rules/indexes, **consumption-side evals**: rubric +
  invented-component rate + contamination-controlled trials), and Specs CLI (verified
  extraction-only). Convergence table at the end tracks patterns with multiple witnesses;
  identified gaps for us: `.ai.json` discovery layer, retrieval surface (CLI `query` / MCP),
  consumption evals. Doc-only change; no engine code touched.
- **Export-contract sequencing + Token Press eval** (`docs/12-token-press-monorepo-eval.md`): before
  building Pillar 4, two calls settled the order — (1) let the Figma-emitter agent **finish emit-figma**
  so the collection structure is stable (the shared `collections.ts` partition must mirror a settled
  reality), and (2) **decide whether the export *format core* moves into the monorepo** as a shared pure
  `@prism3/tokens-export` module both `emit-dtcg` and Token Press import — killing format drift by
  construction (recommended: **Option B**). `docs/12` is the hypothesis (from the Token Press handoff
  go/no-go. **Repo review complete (§9/§9c, 2026-07-03):** a Token-Press-side agent validated §7 against
  the real v2.3.1 source — Option B is *yellow* (separability/purity/presets ✅; composite *parity*
  ❌ refuted, the two outputs disagree today). Resolution: **pick the canonical shape first** — all five
  §9a shape decisions confirmed expressible against TP's source, with six refinements folded in
  (per-family format options, shared filename sanitizer, Prism3-side unfolder, `propertyAliases` option,
  core-owned `generator` block, +2–3d on the TP migration). Revised effort ≈ 2 weeks + 2–3d. Pillar 4's
  first line of code is gated on this (it sets the module boundary) + emit-figma + the owner's move
  decision; author it *at the shape boundary* regardless. Meanwhile **Wireframe (1b)** is independent and
  proceeds. *Next: build Pillar 4 at the shape boundary once emit-figma clears; Token Press move is a
  deferred, evidence-gated call.*
- **Pillar 1 web toggle — Dark/HC in brand setup** (`web/src/main.ts`): the brand menu gains a
  **Modes** control — `Light` fixed, `Dark`/`HC` toggles that write `brandState.modes` (HC adds
  hc-light, + hc-dark only when dark is on); `New brand` starts light-only. The engine re-resolves
  and the preview's mode selector narrows automatically (it iterates `rp.modes`); a dropped selected
  mode falls back to light. Verified headless: aurora 4 modes → Dark-off 2 → HC-off 1; New brand 1;
  0 page errors. No engine change; completes Pillar 1a end-to-end (engine + UI).
- **Pillar 1a — mode opt-out** (`theme.ts`/`modes.ts`/`tree.ts`, docs/11 Pillar 1): `BrandInput.modes`
  lets a brand decline dark/HC — `light` is the required base, `dark`/`hc-light`/`hc-dark` opt-in.
  `resolveAllModes` filters to `theme.modes`; the DTCG tree emits per-mode colour overrides only for
  opted-in modes (a light-only brand emits none); `resolvePreview`/the web mode switcher narrow
  automatically. Omitted → all four (back-compat, `out/*` byte-identical). Guards: must include light;
  unknown mode rejected (wireframe not yet a mode — that's 1b, spec in docs/11). Gates: test 323/323,
  nb-regression 1.95, emit-dtcg 248/248. *Next: the web toggle UI (Dark/HC in brand setup, light-only
  New-brand default) + wireframe (1b) + the export contract (Pillar 4).*
- **Multi-brand / mode-configurable VISION captured** (`docs/11-multi-brand-vision.md`): the
  enterprise north star — many brands over one *locked token-name contract* (names are the API;
  brands & modes are value-columns over it, swappable at runtime), modes the user can decline
  (light always; dark/HC/wireframe opt-in) or customize (light/dark accept an override layer, incl.
  a different dark CTA; HC/wireframe generate-only), and a **single export contract** so every exit
  (engine package / Figma emit / Token Press) yields the same by-collection × by-mode × by-brand
  artifact. Four pillars, phased: **mode config → export contract (pending Token Press eval) →
  override layer → brand families**. Not built yet — this is the plan. **Next: Pillar 1 (mode
  configurability).**
- **Web dashboard — preview on every stage + type specimen** (`web/src/main.ts`): the live
  component preview + contrast overlay (with the per-mode selector) now render on Semantic,
  Typography, AND Form — each reflects that stage's axis. Typography also gains a **type-scale
  specimen** (one composite per group at its resolved size, from `theme.typography`) so a
  `typeScale`/family/weight change is visible where the small component chips can't show it; the
  whole preview region is volatile so it repaints live. Stages 3–4 are now first-class. Engine
  untouched (312/312); web typecheck + build green; verified headless (specimen updates across
  compact/default/expressive, form preview present, 0 page errors).
- **Web dashboard — export** (`web/src/main.ts`): the brand menu gains an Export section —
  **design.md** (`toDesignMd`, #39) and **tokens.json** (resolved DTCG tree via `buildTree`,
  namespaced under the brand's `root`), both Blob-downloaded. Closes the E2E loop with the #38
  importer: verified in-browser that an exported `design.md` re-imports as the same brand (0 errors).
  Engine untouched (312/312); web typecheck + build green.
- **Web dashboard — brand setup** (`web/src/main.ts`): the brand selector is now a menu —
  switch example brands, **New brand** (minimal known-good starter), **Import design.md** (pasted
  `design.md` → `parseDesignMd` → loaded, guarded by a `brandTheme` accept-check; the working brand
  is untouched until it passes), and per-brand **Name** + **Namespace (`root`, #34)** fields (root
  validated inline). Lights up the `design.md` *import* leg of the E2E loop and gives #34's namespace
  a UI. Engine untouched (307/307); web typecheck + build green; verified headless (menu, new, import,
  namespace-valid/invalid — 0 page errors).
- **Web dashboard — staged four-stage shell + Stage 1 redesign** (`web/src/main.ts`): the approved
  design direction ported to the live app. Build order primitives → semantic → type → form; Stage 1
  is bespoke (scalable brand-colour list, generated ramps off `brandTheme().palettes`, and a neutral
  **Derive⇄Pin** toggle that surfaces the engine's `neutral.anchor`). Contextual per-mode selector on
  the Semantic stage; colour edits repaint only the volatile region. Engine untouched (307/307).
- **`emit-figma` — shadow + gradient** (`engine/emit-figma.ts` + `test.ts` block 14): styles,
  not variables (docs/08 §5 variable-type ceiling). **Shadow emits TWO style sets per step**
  (`shadow/xs..2xl + shadow/inset` for light-mode canonical; `shadow-dark/xs..2xl +
  shadow-dark/inset` for the reduced-alpha dark surface-lift pattern) — Figma Effect Styles
  don't support modes natively, so a plugin/component swaps the pair at mode transition.
  Every effect layer parsed to Figma primitives: DROP_SHADOW / INNER_SHADOW, {r,g,b,a} float32,
  offset/radius/spread, blendMode NORMAL. NB → 14 Effect Styles. **Gradient is opt-in**: NB has
  none (empty styles[], consistent shape), aurora emits 2 Paint Styles (brand + glow), each
  with 2 canonical alias-driven stops + 5 `sampledStops` (sRGB pre-sample of the OKLCH curve,
  since Figma interpolates in sRGB only) + a11y worst-on-white/black ratios (text-on-gradient
  contract). **Materialised to Figma via MCP** — 14 Effect Styles rendered on a two-row
  (light/dark) shadow specimen; 2 Paint Styles rendered as violet-azure linear + violet-glow
  radial swatches (aurora palette not yet imported, so demo uses sampledStops hex values —
  alias-driven form lands with the generalise pass). 14 new gates → `test.ts` **295/295**.
- **`emit-figma` — dims axis** (`engine/emit-figma.ts` + `test.ts` block 13): seven FLOAT
  variable collections (`dimension` primitives + `space`/`radius`/`size`/`border-width`/
  `focus`/`opacity` semantics — 94 vars total, 45 aliases). No fixtures (§2 covers only
  colour + typography), so gated structurally: variable counts match the DTCG tree, every
  alias resolves within the emitted collections, scopes narrow per family (space→GAP,
  radius→CORNER_RADIUS, etc.), opacity as PERCENT 0–100 (Figma OPACITY scope), focus's
  `strokeStyle` leaf skipped (no Figma variable primitive). **Materialised to Figma via MCP**
  — all 7 collections created, 45/45 aliases bound (incl. 3-level chains size→space→dimension);
  dims specimen renders geometry bindings on cornerRadius/width/height/padding*/opacity/
  strokeWeight; container fills bound to `color/background|foreground/*`. 16 new gates →
  `test.ts` **281/281**.
- **`emit-figma` — typography axis** (`engine/emit-figma.ts` + `test.ts` block 12): the
  `font` (38 vars) + `font-fluid.{desktop,mobile}` (10 vars/mode) variable collections
  byte-reproduce the NB fixtures, and 36 text styles apply the six §4 fixes (no `text/`
  wrapper, prescribed collection names, lineHeight PERCENT, letterSpacing PERCENT baked,
  primary family bound + full stack in description, fontStyle derived from weight-role via
  a named-instance table). Corrected the pre-fix `px-from-ratio`/`px-from-em` directive
  notes in `tree.ts` so an ad-hoc reader gets the current contract. **Materialised to Figma
  via MCP** — all 36 corrected styles bind fontFamily/fontSize/fontWeight to the real font
  vars, verification specimen renders on a fresh page with container fills bound to real
  `color/background|foreground/primary` (spike lesson). 25 new gates → `test.ts` **265/265**.
- **`emit-figma` — colour axis** (`engine/emit-figma.ts`): DTCG tree → Figma import artifact
  (`out/figma/nb/`), byte-reproduces the NB Figma fixtures (names/scopes/aliases exact). **Now
  handed off** — the Figma-emitter agent owns the rest (typography → remaining axes); see
  **`10-figma-materialization.md §6–7`** for that agent's remit.
- **Figma materialization contract + fixtures** (`10` + `fixtures/figma/nb/`) — the emit-figma
  spec + regression corpus, from two hand-run Figma-MCP import spikes.
- **Web dashboard** (`web/`, the monorepo's first host): renders knobs from the lever manifest +
  live preview + contrast overlay from `resolvePreview`; **colour + radius + type knobs are live**.
  *This thread's next work: deepen the dashboard, then the MCP adapter.*
- **Pure `tree.ts`** (buildTree extracted from the emit shell) → the browser hosts + emit-figma
  resolve the tree with no `node:`. **Lever manifest, preview spec, resolved-preview** — the shared
  contracts the surfaces render from.
- **`design.md` interchange + CLI** (dual-dialect) + the colour-role classifier + fidelity report.

Engine gates as of 2026-07-04: `test.ts` **405/405** (240 colour + 25 typography + 8 namespace + 16 dims + 14 shadow/gradient + 4 pin-a-neutral + 5 design.md-round-trip + 19 mode-config/wireframe + 13 emit-figma-layout + 3 dim-overrides + 10 emit-figma-mode-opt-out + 27 emit-figma-generalise + 21 code-review-HIGH-fixes CR-01/03/04/05);
`emit-dtcg` 248/248 contracts per brand; `nb-regression` now a real gate (per-step ΔE ceilings + KNOWN_OUTLIERS, exits 1 on a fidelity regression — CR-06). The snapshot below is the
2026-07-01 token-layer baseline.

## Current status (2026-07-01)

**Every token category NB and Prism2 ship is now generated** — colour, dimension,
typography, motion, shadow/elevation, layout, and (opt-in) gradients — proven
against a real brand and proven white-label. From a ~7-input schema the engine generates gamut-aware
OKLCH ramps, places steps by contrast role, generates four contrast-verified
appearance modes, generates the space + radius scales from a primitive grid, and
emits consumable DTCG. It validates all of this against New Balance, and runs a
*second, synthetic* brand (`aurora`) end-to-end — synthesising status palettes,
carving a dedicated danger red the brand never specified, and applying a distinct
form factor (soft corners + compact density). Status, space, and radius
generation are all brand-input-driven, not NB-specific.

Headline numbers (regenerate with the commands below):

| Check | NB | Aurora (white-label) |
|---|---|---|
| Aggregate ΔE00 vs real NB (color) | **1.95** | n/a |
| Tonal-band contrast contracts | **11/11** | (same engine) |
| Cross-mode contrast contracts | **248/248** | **248/248** |
| **Dimension axis, exact** (Prism2 space + NB radius) | **23/23** | n/a |
| DTCG semantic aliases resolve (color + dim + size + type + layout + gradient) | **627/627** | **628/628** |
| Engine unit tests (colour math + extreme brands + typography + fluid + shadow + layout + gradient + surface-model + harshness + typography-weights/links + design.md-parser/CLI + standard-dialect/classifier/x-prism3 + lever-manifest↔schema drift + preview-spec binding-validity + resolved-preview contrast invariants) | **215/215** | (same engine) |
| Color primitives / dim grid emitted | 122 / 37 | 162 / 36 |
| Brand palettes / action source | red / **action = brand** (red) | primary+accent+… / **action = accent ≠ brand** |
| Form factor | comfortable / radius 1 (sharp) | compact / radius 2 (soft) |
| Emit profile | `nbds.*` / rgb | `prism.*` / hex |

Work now ships as **one PR per feature branch off `main`** (confirmed workflow).
All work through 2026-07-01 is merged to `main`.

**Structural work since the token layer completed (2026-07-01):**
- **`design.md` + CLI adapter shipped (build step A — the first adapter over the
  portable core).** A brand brief authored as YAML frontmatter (`engine/design-md.ts`,
  a dependency-free block-style YAML-subset parser + frontmatter/prose split)
  compiled by `engine/cli.ts` (`tsx cli.ts <design.md> [--out <dir>]`): parse →
  schema-validate → `brandTheme` (the pure core) → reuse the existing emit. No new
  token logic — `emit-dtcg.ts` now exports the reusable core (`buildTree` /
  `emitTheme` / `validateBrandInput`) and its two example brands are compiled
  **from** `examples/*.design.md`, so those files are the single source of truth.
  Two examples exercise complementary corners of the input space: `aurora.design.md`
  (**faithfulness** — reproduces the golden `out/aurora.tokens.json` **byte-for-byte**)
  and the net-new `harbor.design.md` (**coverage** — deep-teal, `action = primary`,
  warm-neutral greys + tinted page, measured status, comfortable/sharp, system
  stack + compact scale, gradients off; validated behaviourally: schema-conforms,
  622/622 aliases resolve, 248/248 contrasts hold). See `07-e2e-journey.md` §6.
- **Portable pure core.** The theming brain (`theme.ts` + `color`/`ramp`/`scale`/
  `modes`) is now Node-free — the only filesystem coupling (the NB fixture) moved
  to an I/O shell, `nb-fixture.ts`. Precondition for running the engine inside a
  Figma plugin sandbox, an MCP server, or a CLI. See `07-e2e-journey.md` §3.
- **Colour two-tier naming + mode-flattening.** Primitives `color.*` → **`palette.*`**;
  the semantic role layer `semantic.*` → **`color.*`** (the word "semantic" no
  longer appears in any path). Each role is now **one mode-agnostic token**: light
  canonical in `$value`, dark/hc modes as overrides in `$extensions.prism3.modes`
  (same shape as `shadow`; maps 1:1 to a Figma colour variable with modes). Locked
  convention in `06` §7b.
- **Space fidelity fix.** Restored Prism2's `space.150` (12px) and `space.250`
  (20px) — the engine had silently dropped them; dimension axis 21/21 → **23/23**.
- **E2E journey mapped** (`07-e2e-journey.md`): the designer↔developer↔agent
  pipeline, the portable-core architecture, `design.md` authoring brief, and the
  component-library layer (components-as-data + Code Connect) as layers 2–3 of the
  practice's four-layer AI stack.

---

## What exists

```
Prism3/
├── docs/
│   ├── 00-progress.md              ← this file (status + decisions + next steps)
│   ├── 01-token-architecture.md    ← the architecture spec / Theme Schema contract
│   ├── 02-nb-regression-pass.md    ← the NB regression: method + measured results
│   ├── 03-open-questions.md         ← semantic-layer decision backlog (elevation, scrim/opacity, disabled, white/black)
│   ├── 04-theming-playground.md     ← direction note: live theming dashboard / preview surface (web + Figma)
│   ├── 05-token-coverage-roadmap.md ← build backlog: remaining token categories (type, motion, shadow, layout, …)
│   ├── 06-surface-and-content-color-model.md ← the surface/content colour model + §7b as-built naming (palette/color) & mode encoding
│   ├── 07-e2e-journey.md            ← the designer↔developer↔agent pipeline; portable-core architecture; design.md; component layer (layers 2–3 of the AI stack)
│   ├── 08-theming-interfaces.md     ← the customization surfaces (plugin/playground/CLI/MCP/Figma-MCP); new-plugin + shared-lever-manifest decisions; two-route materialization; revised build sequence
│   ├── 09-architecture-and-repos.md ← platform architecture + repo/packaging (monorepo grown from prism3-tokens; web-dashboard-first); which of the owner's other plugins get absorbed vs stay downstream
│   ├── 10-figma-materialization.md  ← the emit-figma contract: exact Figma variable/style shape (proven by import spikes), colour + typography materialization rules, thread split; fixtures/figma/nb is the regression target
│   ├── 11-multi-brand-vision.md     ← the enterprise north star: many brands over one locked token-name contract; mode config → export contract → override layer → brand families
│   ├── 12-token-press-monorepo-eval.md ← the shared-export-core hypothesis (Option B: pure `@prism3/tokens-export` both emit-dtcg and Token Press import) + the §7 repo-review checklist → go/no-go gates Pillar 4
│   ├── 13-inspirations.md           ← field notes on external agent-first DS work (Astryx, ds-brain map, Specs CLI, …) — takeaways, gaps identified, convergence table
│   ├── 14-component-layer.md        ← the component-layer contract: components-as-data (seeded from the KB briefs, token-name-bound) → deterministic Figma materialization (plugin) + extraction-diff regression; LLM-optional by design
│   ├── 15-deployment-neutrality.md  ← deployment-target neutrality: pure core / assistive-LLM edge / host+state edge; the standing "no I/O, state, or model call in a pure module" review check
│   └── 16-code-review-findings.md   ← 2026-07-03 full-codebase review: the fix backlog (8 HIGH / 18 MED / 17 LOW, per-finding failure scenarios + gate coverage) + the gate blind-spot list (§5)
├── fixtures/
│   └── figma/nb/                    ← the NB import: palette + color×4 modes + font + font-fluid×2 (byte-reproduce targets) + text-styles (as-imported snapshot) — emit-figma's regression corpus (docs/10)
├── schema/
│   ├── theme-schema.json           ← the white-label BrandInput contract (JSON Schema; validated on every emit)
│   ├── theme-schema.example.json   ← a worked BrandInput (aurora) that conforms to the contract
│   ├── lever-manifest.json         ← generated: the shared-control contract (from levers.ts)
│   ├── preview-spec.json           ← generated: the shared live-preview spec (from preview.ts)
│   ├── example-brands.json         ← generated: parsed BrandInputs (aurora/harbor) the browser hosts boot from (from emit-brandinput.ts; the node-only design.md parser can't run in the sandbox)
│   └── nb-measured.json            ← NB regression measurement fixture (reverse-engineered anchors; a DIFFERENT shape, consumed only by nbTheme)
├── examples/                      ← authored brand briefs (design.md front door)
│   ├── aurora.design.md           ← faithfulness example (compiles to the aurora golden, byte-exact)
│   └── harbor.design.md           ← coverage example (net-new brand; behavioural acceptance)
└── engine/                         ← dependency-free TypeScript prototype
    ├── color.ts                    ← sRGB↔OKLCH, CIELAB, CIEDE2000, WCAG contrast, gamut-aware max chroma
    ├── design-md.ts               ← design.md parser: block-style YAML-subset → BrandInput + prose (pure, no I/O)
    ├── cli.ts                     ← CLI adapter: tsx cli.ts <design.md> [--out] — parse → validate → core → emit (I/O shell)
    ├── ramp.ts                     ← color ramp generation: exact anchor, 20 steps, chroma arc, 5 bands, contrast-role placement
    ├── scale.ts                    ← dimension axis: 4px grid + numbered space scale (8px rhythm) + radius + component sizes
    ├── theme.ts                    ← Theme builder: nbTheme() (measured) + brandTheme() (white-label: open brandColors[], action role decoupled from brand, status synthesis + danger carve + form factor)
    ├── modes.ts                    ← light/dark/hc-light/hc-dark, roles resolved by contrast target, brand-agnostic
    ├── nb-fixture.ts               ← I/O shell: reads the NB fixture off disk + defers to the pure core (keeps theme.ts Node-free / portable)
    ├── nb-regression.ts            ← diffs generated vs real NB, checks contracts → nb-regression-report.md
    ├── tree.ts                     ← the PURE DTCG token-tree builder: buildTree(theme) → full token tree (colour primitives + per-mode semantic aliases, dims, typography, shadow/gradient/motion) + contrast results + stats; also the shared PURE tree accessors (at/deref/pxOf/subNode/numOf/remPxOf/familyOf). No node:* (extracted from emit-dtcg so the browser hosts + emit-figma can resolve the tree without the I/O shell; docs/09)
    ├── emit-dtcg.ts                ← I/O shell over tree.ts: emits out/<id>.tokens.json per theme (NB + aurora + harbor, the last two compiled from examples/*.design.md) + modes-report.md; re-exports buildTree; EXPORTS emitTheme/validateBrandInput; validates aliases, mode contracts & BrandInput schema conformance
    ├── cli.ts                      ← CLI adapter: dual-dialect (engine-native + standard brand-skills design.md, auto-detected) → the core; --fidelity writes the report
    ├── standard-design-md.ts       ← reader + classifier→BrandInput (standardToBrandInput) + x-prism3 lever mapping for the STANDARD design.md dialect
    ├── classify-colors.ts          ← colour-role classifier: flat colors: hex map → engine anchors by naming convention
    ├── fidelity.ts                 ← full-parity fidelity report builder (observed vs generated; cli.ts --fidelity)
    ├── levers.ts                   ← the LEVER MANIFEST (PURE, no node:*): presentation contract for the BrandInput knobs (grouped/labelled/typed/ranged; 35 levers, 20 advanced); rendered by plugin/playground/MCP (docs/08 §4)
    ├── emit-levers.ts              ← I/O shell: writes schema/lever-manifest.json from the pure levers.ts (sandbox-portable split)
    ├── preview.ts                  ← the PREVIEW SPEC (PURE): sample components bound to semantic token paths + contrast pairs; plugin + playground render the same live preview from it (docs/08 §7 B1a)
    ├── emit-preview.ts             ← I/O shell: writes schema/preview-spec.json from the pure preview.ts
    ├── resolve-preview.ts          ← the RESOLVED-PREVIEW projection (PURE, docs/08 §7 B1b): resolvePreview(theme) → concrete colours per mode + live contrast overlay + dims (radius/space → px) + type (composite → family/weight/size, via the pure tree.ts buildTree); the runtime read-model surfaces consume
    ├── emit-brandinput.ts          ← I/O shell: writes schema/example-brands.json (parsed aurora/harbor BrandInputs) so the browser hosts boot from a VALIDATED brand without the node-only design.md parser (docs/09)
    ├── emit-figma.ts               ← I/O shell (docs/10): DTCG tree → Figma import artifact (out/figma/<id>/). COLOUR axis built — palette + color×4 modes, aliased, scopes derived from role family; reproduces fixtures/figma/nb exactly (names/scopes/aliases; values to float32 tol). Typography next
    ├── test.ts                     ← unit tests: colour-math invariants + 5 extreme-brand contracts + typography/shadow/layout/gradient/surface-model + harshness + typography + design.md-parser/CLI + standard-dialect/classifier/x-prism3 + lever-manifest↔schema drift + preview-spec binding-validity + resolved-preview contrast invariants + resolved dims/type validity + example-brands drift & all-green + emit-figma colour↔fixture reproduction (240 checks)
    ├── ai-metadata.ts              ← generates the AI-readable metadata sidecar (meaning/when/avoid/paired_with/contrast_with/mode_overrides) for the semantic layer
    ├── README.md                   ← how the engine works / how to run
    ├── nb-regression-report.md     ← generated (committed for review)
    ├── modes-report.md             ← generated, covers both themes (committed for review)
    ├── out/{nb,aurora}.tokens.json ← generated DTCG output per theme (committed for review)
    └── out/{nb,aurora}.ai.json     ← generated AI-readable metadata sidecar per theme (the agent surface)
```

### How to run

```bash
# Node ≥ 20. No npm install — color math is self-contained.
npx tsx Prism3/engine/nb-regression.ts   # regression vs real NB
npx tsx Prism3/engine/emit-dtcg.ts       # emit DTCG + modes, validate (+ schema conformance) — NB + aurora + harbor
npx tsx Prism3/engine/test.ts            # unit tests: colour math + extreme-brand contracts + design.md/CLI + lever-manifest drift
npx tsx Prism3/engine/emit-levers.ts     # (re)emit schema/lever-manifest.json — the shared-control contract
npx tsx Prism3/engine/emit-preview.ts    # (re)emit schema/preview-spec.json — the shared live-preview spec
npx tsx Prism3/engine/emit-brandinput.ts # (re)emit schema/example-brands.json — the browser hosts' validated boot brands
npx tsx Prism3/engine/emit-figma.ts      # (re)emit out/figma/<id>/ — the Figma import artifact (colour axis; docs/10)
npx tsx Prism3/engine/visualize.ts       # regenerate the style-guide HTML (out/tokens.html)

# Web dashboard adapter (the monorepo's first rendering host — docs/09). NEEDS npm install (esbuild).
npm install && npm run -w @prism3/web dev     # esbuild dev server on http://127.0.0.1:5173
npm run -w @prism3/web build                  # bundle to web/dist/

# CLI adapter — theme an arbitrary brand brief:
npx tsx Prism3/engine/cli.ts Prism3/examples/harbor.design.md [--out <dir>]   # engine-native dialect
npx tsx Prism3/engine/cli.ts Prism3/examples/wendys.design.md --fidelity      # standard brand-skills dialect + fidelity report
```

---

## Decisions log (why things are the way they are)

- **`toDesignMd` — the `design.md` serializer (inverse of `parseDesignMd`) (2026-07-02).**
  Export needed a `BrandInput → design.md` direction; the module only had parse. Added `toDesignMd`
  to `design-md.ts` (pure, node-free — same portable-core fence as the parser, so the web bundle can
  import it). It emits each **defined** top-level key as a **one-line flow value** (`primary: { l, c, h }`,
  `brandColors: [{ name, oklch: {…} }]`), which the existing flow parser reads straight back — so
  `parseDesignMd(toDesignMd(x)).input` deep-equals `x`. Only own defined keys are emitted, so an omitted
  optional (no `root`) stays omitted (exact round-trip, no phantom keys). Strings are emitted bare unless
  they'd mis-type (numbers/bools/null) or carry structural chars, in which case quoted. Gated (test.ts
  block 17): round-trip identity for aurora + harbor + a synthetic brand (custom root + `neutral.anchor` +
  `brandColors` + `actionPalette`), omitted-optional stays omitted, prose survives the fence. This is the
  engine half of **export**; the web download UI (design.md + DTCG via `buildTree`) is the paired web PR.
  Pure addition — `out/*` byte-identical. Gates: test 312/312, nb-regression ΔE00 1.95, emit-dtcg 248/248.

- **Pin-a-neutral — a pre-defined brand grey can anchor the neutral ramp (2026-07-02).**
  The white-label neutral was *always* derived from a hue + peak chroma cast (`brandTheme` built it
  with no anchor, unlike primary/brand-colours which pin their exact OKLCH). Some clients ship a
  pre-defined neutral, so `BrandInput.neutral` now takes an optional `anchor: OKLCH`: when set, the
  ramp is built AROUND it — pinned verbatim at `autoPlaceStep(anchor.l)`, hue/chroma taken from the
  anchor — reusing the exact `generateRamp({ …, anchor })` mechanism the brand palettes already use
  (zero new ramp math). `neutral.hue`/`chroma` stay required (the derived readout / the UI's Derive
  mode); the anchor drives when present. `roleAnchorStep.neutral` stays 500 — that's the semantic
  neutral *role's* preferred step for contrast resolution, independent of where the pinned *primitive*
  lands. Surfaced as an optional advanced colour lever (`neutral.anchor`, "Pin a neutral") so the web
  UI can render a Derive⇄Pin toggle. Gated (test.ts block 16): the pinned grey is reproduced at its
  step (ΔE < 1), the derived ramp genuinely differs, and the pin flows through to the DTCG neutral
  primitive. Default output byte-identical (no example sets an anchor; `out/*` unchanged). *Deferred
  outlier:* a neutral kept as its OWN separate palette — expressible today via `brandColors`, no engine
  work, so not built. Gates: test 307/307, nb-regression ΔE00 1.95, emit-dtcg 248/248.
- **Namespace is a customizable lever — `root` on `BrandInput`, default placeholder `prism` (2026-07-02).**
  The emit namespace was hardcoded to `prism` in `brandTheme` (only the NB fixture used its own
  `nbds`). It's now `BrandInput.root` (optional, default `'prism'`): a single, mode-invariant token
  namespace, one segment only — every token emits under `<root>.*` (primitives `<root>.palette`,
  semantics `<root>.color`). Threaded through the one place that had leaked past `theme.root`
  (gradient stop aliases were hardcoded `prism` — fixed) and gated: a custom root re-homes **every**
  alias to `{<root>.…}` with zero `prism` leakage (test.ts block 15), a dotted/spaced root throws at
  the engine boundary *and* fails schema (added `pattern` support to the hand-rolled validator so the
  schema's `^[a-z][a-z0-9-]*$` is enforced, not decorative). `root` joins `id` in `identityFields`
  (host-supplied identity, not a lever-form knob). Default output is **byte-identical** (out/* did not
  change). *Rationale:* `prism` is a placeholder every engagement should override; making it a lever is
  the minimum change and keeps the single-brand-root invariant fully intact (see the "no two-segment /
  no removal *yet*" note below). Decisions: (A) **single segment, no two-segment** namespaces
  (`nbds.pds.*`-style) — the user's call; the legacy two-segment convention is not reproduced.
  (B) **Namespace is forced** — always present. Removing it entirely (un-prefixed `color.*`) is a
  *deferred* option, NOT built. When we revisit, the clean method is an **emit-time flatten**: keep the
  tree namespaced internally (so `Object.keys(tree)[0]`-as-root, the alias resolver, emit-figma, and
  resolve-preview all keep working unchanged), and drop the wrapping key + rewrite `{prism.x}`→`{x}`
  in every alias **at the `emit-dtcg`/`emit-figma` boundary only**. Do *not* model "none" as an empty
  `root` — that yields a `{ '': … }` key and malformed `{.palette.x}` aliases across ~8 sites. Tradeoff
  to weigh then: a namespace prevents collisions and preserves provenance when a brand's tokens are
  consumed alongside others (the multi-brand case this engine serves), and DTCG/Figma consumers expect
  a top group — so "none" is a deliberate, informed opt-out, never a default. (C) UI to set/change the
  namespace is a later web increment (brand-setup surface, alongside `id` — not the primitives page).
- **`emit-figma` colour axis built — byte-reproduces the NB Figma fixtures (2026-07-02).**
  First increment of the materialization adapter (`10 §5`): `engine/emit-figma.ts`, an I/O shell
  over the pure `tree.ts`, walks the DTCG tree → the Figma import artifact
  (`out/figma/nb/{palette,color.<mode>}.json`) — `palette` (122 primitives) + `color` (95
  semantics × 4 modes), every semantic a name-based `VARIABLE_ALIAS` into `palette`. The split
  the contract calls for holds in code: the DTCG carries the *semantic* facts (per-mode
  `aliasOf`), the adapter owns the *Figma-target rendering* (role-family→scopes, name transform,
  `rgb→{r,g,b,a}` via `Math.fround` for Figma's float32, two-pass alias-by-name; ids omitted,
  Figma assigns them). A `test.ts` gate reproduces `fixtures/figma/nb/` exactly — names, scopes,
  and every per-mode alias target (0 mismatches, all 4 modes), values to float32 tol (~5e-7);
  240/240. Scopes are derived in the adapter (the DTCG doesn't emit them) — correct per the
  contract, not a directive gap. *Rationale:* the colour axis was the spike-proven byte-target;
  now owned once + gated. Next: typography (`font`/`font-fluid` vars + text styles with the six
  §4 fixes), then the remaining axes + generalize.
- **Freeze the `emit-figma` contract + NB Figma fixtures as the regression target (2026-07-02).**
  Two hand-run Figma-MCP import spikes (colour, then typography) proved the engine's
  `$extensions.prism3.figma` directives are directly usable, so the DTCG→Figma translation is
  mechanical — the job is to *own it once* (`emit-figma`) rather than re-derive per agent (the
  `09` drift trap). Captured the real NB import as `fixtures/figma/nb/` (Token Press raw export:
  `palette` + `color`×4 modes; `font` + `font-fluid`×2 modes; a Plugin-API `text-styles` dump) and
  wrote the contract in `10-figma-materialization`. Two fixture classes: **byte-reproduce**
  (palette/color/font/font-fluid) and **reference-with-known-deltas** (`text-styles` is the
  *as-imported*/pre-fix snapshot — the six typography fixes are intentional deltas, so gate against
  the *corrected* expectation, not that file). Verified the engine reproduces the colour aliases
  exactly (action 550/450/700/300; background.secondary neutral.050/900) — a genuine
  byte-comparable target, same discipline as `nb-measured.json`. `emit-figma` reads the semantic
  facts (aliases, per-mode values, fluid modes, weight-role numerics) and **derives** the
  Figma-target rendering (scopes from role family, collection/style names, line-height %,
  letter-spacing binding, fontStyle→named-instance); the engine directives don't yet emit per-leaf
  `scopes`/`collection`, which is `emit-figma`'s to own. *Rationale:* the spikes' findings +
  owner's Token Press exports. Full contract + thread split in `10`. PR #27.
- **Platform packaging: monorepo grown from `prism3-tokens`, web dashboard first (2026-07-02).**
  Owner-locked answers to the "one engine, two hosts" packaging question (full shape in
  `09-architecture-and-repos`). (A) The web dashboard and Figma plugin are **two adapters over one
  core** — both import the same engine module and render from the shared lever manifest + preview
  spec + `resolvePreview`; continuity is structural, not a sync. (B) They live as packages **in this
  repo** (`web/`, `figma-plugin/` beside `Prism3/engine/`), not a fresh repo and not three published
  repos — one version, a lever change lands everywhere in one commit; `brand-skills`/`knowledge-base`
  stay their own repos. The "no build" invariant holds for the core (tsx); the *adapters* get a
  bundler (a browser/Figma bundle is a packaging step, not a port). (C) **Web dashboard first** —
  fastest loop, no sandbox constraints, cleanest proof the shared contracts drive a real UI; the
  Figma plugin then reuses the same renderer. **Plugin consolidation:** the three separate Figma
  plugins (theming, text-style, style-guide-generator) get their *function* absorbed into the new
  B2 plugin (never their code — each carries a separate brain); the **style-guide generator lays
  tokens out as frames on the Figma canvas** (canvas documentation — a distinct capability the
  `visualize.ts` HTML preview does *not* replace, so it's a B2 feature, not a retirement). Token
  Press (different org) + the CLI templating system stay **downstream, contract-connected** via DTCG
  output, never merged. *Rationale:* owner decisions — "grow prism3-tokens into a monorepo," "web
  dashboard [first]," + the style-guide-generator correction. Resolves the packaging question `08`
  raised but didn't settle. **Scaffold BUILT the same day:** root `package.json` (workspaces
  `["web"]`, `type: module`) + a `web/` esbuild + vanilla-DOM adapter that imports the pure
  engine modules and renders 15 manifest knobs + 22 preview chips + a 4-mode contrast overlay
  from `resolvePreview`; boots all-green (verified headless). New `emit-brandinput.ts` →
  `schema/example-brands.json` supplies the browser a validated boot brand (test-gated). Engine
  stays buildless (218/218); only the adapter bundles. Full layout in `09 §3`.
  **Interactive loop landed (PR #24):** the colour-axis knobs are LIVE — primary (colour
  picker → OKLCH anchor) + neutral hue/chroma + actionPalette mutate the in-memory `BrandInput`,
  re-run `brandTheme` + `resolvePreview`, and repaint the preview + overlay; a non-resolving
  combination is caught and surfaced.
  **Geometry/type-from-tree landed (PR #25 + B):** `buildTree` extracted to the pure `tree.ts`
  (PR #25); `resolvePreview` now also returns `dims` (radius/space → px) + `type` (composite →
  family/weight/size), resolved from the tree via shared pure accessors (also lifted out of
  `visualize.ts`). The chips render real radius/padding/type, and **`radiusScale` + `typeScale`
  are now live too** (6 live knobs). Density/motion/shadow stay read-only — the current chips
  don't render those axes. A `test.ts` gate asserts every dim → positive px and every type →
  family + positive size (220/220).
- **Dogfood the shared preview model in `visualize.ts` before building the hosts (2026-07-02).**
  Rather than take the leap straight from the B1a/B1b portable model to two new live hosts (DOM
  playground + Figma-node plugin) in a fresh repo, the static style-guide generator was made the
  first consumer of `previewSpec` + `resolvePreview(theme)` — it renders each component/variant from
  the resolved role colours + token-tree dims + resolved type composite, with the per-mode contrast
  overlay driven by the same `byMode.pass` results. *Rationale:* prove the "define once, render
  everywhere" contract composes a real UI + live overlay from one source **in-repo, behind the
  existing gates**, so the host renderers (B1c/B2/B3) start from a validated binding+overlay pattern
  instead of an unproven one. Additive and output-scoped (only `visualize.ts` + regenerated
  `out/tokens.html`; pure core untouched, tokens byte-identical, 215/215). PR #22.
- **Theming interfaces: new plugin + shared lever manifest (2026-07-01).** The customization
  surfaces (Figma plugin, web playground, CLI, MCP, Figma MCP) are five adapters over one core,
  not five products (`08-theming-interfaces`). Decisions: (A) the Prism3 Figma plugin is a **new**
  build on the engine core, not an evolution of the existing theming plugin — the core is reused
  (never re-implemented, the KB round-trip drift trap), the plugin is a fresh materialization +
  control shell that inherits every engine option and dissolves the existing plugin's namespace/
  options/font-weight pain points; (B) the web playground and Figma plugin aim for **near-continuity**
  — one shared **lever manifest** + live-preview model, not two hand-maintained UIs (two visual
  editors = two surfaces of drift). The manifest is the *presentation* half (labels/groups/UI
  ranges/knob type) that `theme-schema.json` (validation half) lacks; the plugin, playground, and
  MCP tool schema all render from it, so continuity is structural, not a manual sync. Materialization
  has two routes over the same output — plugin knobs (manual) and Figma MCP (agentic) — within the
  Figma variable-type ceilings (COLOR/FLOAT/STRING; typography→atoms+Text Style; shadow→Effect/code).
  *Rationale:* owner decisions — "build new on the new engine"; "strive for near-continuity, a lot is
  possible inside a Figma plugin." Resolves `07 §8` open decision #3. Full shape + build sequence in
  `08`; next increment is the lever manifest.
- **`design.md` is the E2E interchange contract; adopt the open spec (2026-07-01).**
  The pipeline tools (all owner-built: `brand-skills` extractor, this engine, Token Press,
  three *separate* Figma plugins, the CLI templating system) connect through **one shared
  format — `google-labs-code/design.md`** — which we follow, not fork. Decisions: (A) the
  engine **regenerates from anchors + emits a fidelity report** (NB-regression pattern) and
  does not trust extracted ramps as final; **one generator** — `brand-skills` *describes*
  (stays standalone-complete, so a brand-skills-only user still gets usable colours), the
  engine *generates* the verified system; the base file stays pure spec, engine-only levers
  via **defaults + an optional `x-prism3:` extension**; **align `brand-skills` type-role names
  to the engine's semantic vocabulary**. The one new parser piece is a **colour-role
  classifier** (flat `colors:` map → anchors by naming convention). Full contract in
  `07-e2e-journey.md` §11. Validated (real Wendy's `design.md`) that every anchor the engine
  needs is present. Next: a Wendy's spike before any step-A rework.
- **`design.md`: block-style YAML frontmatter + hand-rolled parser; the CLI reuses
  the emit core; examples are the single source of truth (2026-07-01).** The locked
  plan called for YAML frontmatter + a minimal parser; on build, a *block-style*
  subset (indentation nesting + `- ` sequences + flow `{}`/`[]` leaves) beat a
  flow-heavy minimal parser because the whole point of `design.md` is human- *and*
  agent-authorability, and the doc's own example uses block-at-top + flow-for-leaves
  (owner chose "what do you recommend"). Rather than let the CLI duplicate the emit
  pipeline, `emit-dtcg.ts` was made the home of the reusable core (`buildTree` /
  `emitTheme` / `validateBrandInput`) behind an `isMain` guard, and its example
  brands are compiled **from** `examples/*.design.md` — so "faithfulness" is
  structural (the golden IS generated from the brief) and the explicit byte-diff
  test is belt-and-suspenders. Harbor uses **warm-neutral greys** (neutral hue ~65)
  against its cool teal brand (owner decision) so the brief's "warm off-white page"
  is honest, not aspirational — the neutral ramp hue is independent of the brand
  hue, a real teal-brand-with-warm-greys pairing, and it genuinely exercises the
  surface floor-shift lever. *Rationale:* user decisions after surfacing both forks
  before building.
- **Portable pure core, not a plugin/CLI (2026-07-01).** The engine is a
  dependency-free *library* wrapped by thin adapters (Figma plugin / CLI / MCP /
  API), not a single app. Kept the core I/O-free so it can run in a Figma sandbox;
  the NB fixture read lives in `nb-fixture.ts`. Same brain everywhere → the plugin
  inherits every engine option, and no forced LLM (knob-turning, a `design.md`
  file, or an agent all feed the same core). Rationale in `07-e2e-journey.md` §3–4.
- **Colour: `palette` primitives + `color` roles, mode as a value (2026-07-01).**
  "semantic" is a tier concept, not a name segment — it left the paths. The tier
  designers use got the intuitive `color.*`; the reference tier got `palette.*`
  (ref-vs-sys split). Mode is no longer nested in the name: one token per role,
  light canonical in `$value`, other modes in `$extensions.prism3.modes` (matches
  `shadow`; maps 1:1 to a Figma colour variable with modes). Rejected mode-in-name
  because it breaks "same name, different value per mode" and fights the Figma
  round-trip. Full note: `06` §7b.
- **Space scale reproduces Prism2 in full (2026-07-01).** An audit for a requested
  12px spacer found `SPACE_KEYS` had silently dropped Prism2's `150` (12px) and
  `250` (20px). Restored both — the "reproduces Prism2's full space scale" claim is
  now true, not aspirational (dimension axis 21/21 → 23/23).
- **Build a real prototype, validate against NB.** The thesis ("a brand is a
  small input set the engine expands") is only credible if the engine can
  reproduce an existing hand-built brand. NB is the regression target.
- **TypeScript / Node, dependency-free.** Color math is owned in `color.ts` so
  the engine runs without a network install and the math is auditable. Run via
  `tsx`/`ts-node`; no build step.
- **Keep our intent grammar** (tonal bands, contrast roles) rather than copying
  a vendor's ramp shape. The engine generates from intent, not from NB's hexes.
- **OKLCH generation with exact-anchor preservation.** The brand value is a
  *pinned* step, never shifted (verified: NB `red.550` reproduced at ΔE00 0.05).
- **Chroma arc, not a flat plateau.** First cut held chroma constant and the
  light tints blew out (green.050 ΔE00 20); the regression falsified it. A
  chroma arc that tapers toward both ends dropped green's mean 6.23 → 1.88.
- **Contrast-role-targeted step placement (gap 1).** Steps are *placed* at the
  luminance their role needs, not on an even-L curve. The Mid-Tone 500 sits at
  the dual-side AA pivot (Y≈0.18, clears 4.5:1 on white *and* black). Took the
  contrast contracts to 11/11 and, because NB is Univers-derived, also tightened
  the perceptual fit (aggregate ΔE00 2.14 → 1.95).
- **Modes are derived, not hand-mapped.** Primitives are shared across modes;
  each semantic role re-resolves to a primitive step by contrast target against
  the mode's surface. The brand anchor is preserved where it can be and
  auto-adjusted where it can't (a dark-mode action lightens when the anchor can't
  clear AA on a near-black surface).
- **Surface & content colour model (2026-06-29 — SUPERSEDES the property-led
  vocabulary entry below).** A UI-designer review of the generated style guide
  reworked the semantic layer (full spec: `01` §4.1 As-built + `06-surface-and-
  content-color-model.md`). `background` = the thin page **canvas** (`primary/
  secondary/tertiary` **tonal in both modes** — light is no longer all-white +
  an `inverse.*` ladder); `foreground` = the **surfaces/fills** on it (Prism2's
  `surface`, renamed: tonal ladder + `inverse.*` + bold semantic + `-subtle`
  tints + stateful `danger`); `text`/`icon` = **ink**; `action.*` = the
  interactive fill (now **top-level**); `border` = `primary/secondary/inverse/
  {semantic}/focus`. Dropped the `elevation.*` colour group (elevation = a
  foreground tier + a shadow), `background.subtle`/`sunken`/`quaternary`. Renamed
  `on-emphasis→on-inverse`, `interactive→action`. Fixed the incoherent
  `foreground.primary=950`/`secondary=200` (now a real tonal ladder; the dark
  fill is `foreground.inverse.primary`). HC carries elevation by **border**.
- **Semantic vocabulary: PROPERTY-LED — `background` / `foreground`(fill) /
  `text` / `icon` / `border`, with per-property interactive states.** *(Historical
  — superseded by the surface & content model entry above.)* Decided
  against a nine-system field survey (M3, Carbon, Atlassian, Fluent, Polaris,
  Primer, Spectrum, Radix, Tailwind/shadcn) cross-referenced with the practice KB,
  and aligned to New Balance's actual taxonomy. Top level is the *property* you're
  colouring; `foreground` is the element **FILL** (NB's meaning — not text).
  Interactivity is a per-property `interactive` variant carrying STATES (the
  applicable subset of default/hover/pressed/focused/visited/selected/disabled),
  not a parallel duplicated tree. `background.*` = inert container surfaces (+
  semantic tints); `foreground.*` = fills (neutral tiers + semantic + `interactive`
  + stateful `danger`); `text.*` = text (tiers + semantic + `on-*` pairs + `link`
  via `interactive`); `icon.*` = a full peer group that for now MIRRORS `text`
  (a future toggle relaxes icons to the 3:1 non-text floor so they diverge — see
  03-open-questions); `border.*` = neutral + semantic validation + `interactive`
  (focus ring = `.focused`). `info` palette newly synthesised. ~96 semantic roles
  × 4 modes. Field evidence: property-led is the field *majority* (Atlassian,
  Polaris, Primer, Carbon, NB all split text/bg/border/icon as peers); `on-*`
  pairing universal. *Rationale:* user decision after research — match NB's real
  structure (foreground=fill; text/icon/border as peers) rather than the
  role-led/content-grab-bag shape an earlier pass shipped. Semantic intents are
  static except `danger` (destructive fills carry states); inverse is modest
  (one `inverse` per property, leaning on per-mode resolution). Text on a vivid
  fill targets AA (gamut-bounded — 7:1 unreachable on a saturated mid), everything
  else escalates in HC.
- **Surface ladder + scrim/opacity primitives (backlog Items 1/2/4).** Decided
  against a 10-system field survey + KB §4. Elevation tiers renamed to an ordinal,
  use-case-neutral ladder `background.{primary,secondary,tertiary,quaternary}`
  (page→floating), plus `subtle`/`sunken`/`inverse` + semantic tints. The
  `overlay` tier name is GONE (it's overloaded across the field — floating surface
  vs scrim); component→tier mapping is documentation, not baked into the name.
  Light tiers converge in colour (elevation = shadow, a deferred effects axis);
  dark tiers step lighter (M3 lift). New primitives: an `opacity.*` scale and
  `black-alpha`/`white-alpha` ramps (composite over any surface — Radix/Fluent),
  and a `scrim.default` semantic token (alpha-based, heavier in dark per
  Spectrum/Fluent/Radix). White/black policy: pure primitives kept, surfaces route
  through the tinted neutral; a white page converges (shadow-carried), a tinted
  page (aurora `neutral.50`) lets cards step to white. *Rationale:* user decision
  after research — numbered ladder honours prior practice + the field's
  use-case-neutral camp; shadows deferred to an effects pass (KB lift pattern).
- **Motion axis — generated from a `tempo` personality lever (backlog roadmap §motion).**
  Decided against a 7-system survey + KB `18-motion-foundations`. The motion analog
  of the density/radius levers: `motionPersonality.tempo` (snappy/standard/relaxed)
  scales a non-linear duration ramp; easing roles (`standard`/`enter`=decelerate/
  `exit`=accelerate/`emphasized` + a `calm` accessibility curve) ship field-verified
  beziers (Carbon/M3); springs (`snappy`/`gentle`/`bouncy`) carry M3 spatial params
  by perceptual outcome; **composite `transition.*` tokens** bundle duration+easing
  (Atlassian model — the AI-trustworthy layer); reduce-motion is a **derived**
  output (Apple "substitute, don't delete": informational preserved/floored,
  vestibular → 0), not a hand list. Where we beat NB's fixed ramp: the personality
  lever, composites, the `calm` a11y curve, and derived reduce-motion. Aurora demos
  `snappy` (ramp compresses 50/100/200… → 40/80/160…). Motion is mode-invariant
  (sibling of the dimension axis), not per-mode colour.
- **AI-readable metadata sidecar — `out/<id>.ai.json` (prototype).** Per KB
  `31-color-systems §9` + `00-principles` ("descriptions = highest-ROI; avoid_when
  > when_to_use"): a generated agent surface for the semantic layer, peer to the
  DTCG `tokens.json`. Each of the 89 semantic roles gets `$description`, `meaning`,
  `when_to_use`, `avoid_when`, `paired_with`, `contrast_with`, and `mode_overrides`
  — all **generated** (prose from a deterministic role→intent model; the relational
  fields reshaped from data the engine already computes: the on-* pairings, the
  floor contract `against`/`min`/`ratio`, and the per-mode resolution). The point:
  *contract-true* metadata that regenerates every build, vs the field's hand-authored
  metadata that rots. `tokens.json` stays DTCG-pure (no non-standard sibling keys);
  the sidecar is the natural input for the planned MCP server + theming playground.
  `avoid_when` correctly redirects (e.g. `foreground.interactive` → "use
  foreground.danger for destructive"). Also fixed a `$description` redundancy bug
  ("…band — Mid-Tone"). `$description` ("what it is") and `meaning` ("what it
  signifies / is for") are distinct — e.g. `text.danger` → "Destructive / error
  text." vs "Destructive / error signalling." A refinement pass made state variants
  informative ("…on pointer hover") and differentiated the neutral-fill tiers.
  **Primitive tier added** (planned-for, not assumed away): every primitive
  (colour ramps, white/black, alpha, opacity, dimension grid, motion) gets a
  simplified set — `$description`, `meaning`, colour-scale **`intent`** (the
  Univers/NB contrast-role of each ramp step, from its band — e.g. 500 = "the
  dual-side AA pivot", anchor steps flagged), `tier`, `consume` (private vs
  consumable per family), and **`aliased_by`**, the reverse index of *which tokens
  resolve to it*. `aliased_by` makes the sidecar a bidirectional graph for impact
  analysis across all families (e.g. `dimension.8` ← `radius.md` + `space.100`;
  `color.accent.600` ← the interactive/link roles) — and it **cannot drift**: it's
  recomputed from the token tree on every build (authoritative at build time, never
  hand-maintained), and re-aliasing in this engine is a recompute, not a manual
  edit. Sidecar now `{ semantic, primitives }` (~89 + ~194–233 entries/brand).
- **Contrast is validated against the floor surface, not the pure extreme.**
  Saturated, contract-bearing foregrounds (action + states, vivid semantic text,
  secondary/tertiary text) clear
  their ratio against the most-tinted supported surface — light/hc-light →
  `neutral.50` (a step off white), dark/hc-dark → `neutral.950` (a step off
  black) — not pure white/black. Pure white is the *most forgiving* light
  background; a colour that only just passes there breaks the moment it sits on a
  `neutral.50` card. Validating against the floor builds in headroom so the
  colour holds across the elevation range, and is symmetric with the dark side
  (which already used `neutral.950`). Without it, a saturated colour that only
  clears 4.5:1 on pure white drops below AA the moment it sits on a `neutral.50`
  card. *Rationale:* user direction — "actions need to meet contrast on surfaces
  that sit on top of white, not just pure white; otherwise it breaks with other
  light neutrals."
- **The primary surface — and therefore the floor — is configurable.** A brand
  can declare a non-white/black page surface per mode via `surfaces` (base =
  `white` | `black` | a neutral step); the contrast floor moves with it (a
  tinted base defaults its floor one step further toward mid), and the engine
  **flags a non-default surface in notes for confirmation**. Defaults reproduce
  the white/`neutral.950` behaviour exactly, so brands that don't set it are
  unaffected. Proof: aurora declares its light page as `neutral.50`, the floor
  auto-moves to `neutral.100`, and `foreground.interactive.default` resolves to `accent.600`
  (4.95:1 on the tinted page) — two steps off the naive white-only pick.
  *Rationale:* user direction — "we may need to allow a user to confirm the
  primary surface colour that's not white, and that would change the floor."
- **Disabled is a selectable strategy; default is contrast-preserving.** A
  `disabledStrategy` input chooses `accessible` (default — disabled text/icon/
  border clears `disabledMin`, default **3:1**, on the floor; escalates to 4.5:1
  in HC) or `conventional` (intentionally sub-AA, leaning on the WCAG 1.4.3/1.4.11
  inactive-component exemption). `disabledMin` is tunable per engagement. Disabled
  *fills* stay a muted neutral (non-text, uncontracted) under both. Decided
  against a 12-system field survey: **0/12 meet 4.5:1 on disabled text**, only
  Primer (~3.45) / USWDS / Tailwind-opacity-50 (~3.5) clear ~3:1, and **none ship
  a selectable accessible-vs-conventional toggle** — so this is a genuine
  differentiator and matches the usability literature (NN/g, Adam Silver, Adrian
  Roselli, GOV.UK: *exempt ≠ unreadable*). Mechanism is flat resolved values, not
  opacity — opacity can't guarantee a floor (it stacks and is non-deterministic
  over colored fills) and would break the engine's computed-contract model.
  Reconciles the KB (`31-color-systems §3`), which already prescribed shipping
  both `inactive` (preserved) and `disabled` (exempt) and defaulting to the
  former — the engine just hadn't implemented it. *Rationale:* user decision after
  research — "an option where disabled just barely meets contrast minimums," as a
  user selection.
- **Status palettes are engine-supplied; danger is carved (white-label).** A
  brand supplies primary + neutral; the engine synthesises success/warning from
  canonical hues. If the primary is in red territory the brand red *is* the
  danger red (NB); otherwise the engine carves a dedicated danger red the brand
  never specified (aurora). Proven by running a second, non-red brand end-to-end.
  *Rationale:* status-from-anchors only worked because NB happened to supply
  them; a real white-label brand won't, and `danger == primary` for a red brand
  is a coincidence that breaks for everyone else (review finding).
- **Open brand-palette set + action decoupled from brand.** The white-label
  input takes `primary` + `neutral` + an arbitrary `brandColors[]` (secondary /
  tertiary / accent — any number), and `action` is now a FIRST-CLASS semantic
  role mapped independently of `brand`. Many brands' hero colour is a poor or
  reserved interactive colour, so `actionPalette` points action wherever the
  brand needs; it defaults to `primary` but the engine **emits a note flagging
  the decision** so it's confirmed, never silently assumed. Proven on aurora: a
  violet hero brand whose `foreground.interactive.default` resolves to a separate azure
  `accent.500`, while NB keeps `action = brand` (red) by design. *Rationale:*
  user direction — "action is not always the primary brand colour; needs
  flexibility built in, and the system should confirm which colour drives
  actions."
- **Two emit profiles, one engine.** `nbds.*`/rgb for the NB regression
  (byte-comparable to real NB) and `prism.*`/hex for product output
  (DTCG-aligned, Style-Dictionary-ingestible). Resolves the namespace + value-format
  review notes without losing NB comparability.
- **NB's per-step hue kinks are NOT reproduced, by design.** Per-step hue drift
  would be a brand input the schema deliberately resists ("resist the seventh").
  The `amber.600`/`red.300` outliers characterise NB's hand-authoring; they are
  not an engine gap (review finding — reframed from an earlier "opt-in feature").
- **Dimension axis mirrors the color architecture: primitives + semantic
  aliases.** A primitive `dimension` grid (4px: 0,1,2,4,6,8,…,128) with `space`,
  `radius`, and component `size` tokens aliasing into it — the same shape as
  color ramps + semantic roles. Reproduces our chosen targets **exactly** (23/23)
  and aurora runs a *different* form factor (compact / scale 2) through the same
  code. Integer px, so the bar is exact equality, not perceptual ΔE.
- **Naming taxonomy POV — numbered-multiplier space, t-shirt only at the
  component layer** (knowledge-base 02/22/24; matches the user's preference and
  the Prism2 house standard). The reasoning, pressure-tested rather than copied
  from NB (which is a *fidelity test*, not the taxonomy authority):
  - **Space** is a numbered-multiplier scale at the *reference* tier:
    `space.100`=1×, `.200`=2× … on an **8px rhythm** (`space.100`=8px). The
    number means "n× base" *invariantly across brands* — the white-label-honest
    encoding the KB calls for. NB ships a legacy t-shirt ramp (`4xs…3xl`), which
    the KB explicitly warns against (t-shirt breaks past ~7 steps); we
    deliberately did **not** follow it. So SPACE validates against **Prism2**
    (16/16), the system whose taxonomy we adopted; radius — t-shirt in both
    systems — still validates against **NB** (5/5).
  - **Two bases, by design:** a 4px *fine grid* backs radius/borders; an 8px
    *space rhythm* backs spacing. Prism2 proves this split (fine 2/4/6 for
    corners, 8-step rhythm for layout).
  - **Density moved to the component tier.** A numbered scale is already
    near-primitive, so remapping `space.400` by density is murky. Instead the
    numbered scale is density-free, and `density` drives the **component `size`**
    layer: each t-shirt size (`xs…xl`) is a *contract* binding a control height
    **and** paired padding from the shared scales, so a `md` button/input/select
    agree. `compact` resolves `size.md` to smaller metrics while the *name*
    stays `md` (name-stable, value-shifts). This is Curtis's three tiers made
    literal: reference (numbered) → component (t-shirt) → (radius, bounded
    semantic).

---

## Open items / next steps (roughly prioritized)

**The token layer is complete; the next phase is the E2E pipeline (`07-e2e-journey.md`).**
The goal is a designer↔developer↔agent workflow ending in production-ready UI —
i.e. completing layers 2–4 of the practice's four-layer AI stack (the engine is
layer 1). Agreed build sequence (owner confirmed "safest path to a working plugin"):

- **★ NOW — E2E integration (`07` §11).** The direction shifted from "build the next
  adapter" to "connect the tools we already own through the `design.md` contract." Two
  active tracks:
  - **Here (prism3-tokens): the Wendy's spike — ✅ DONE, then PROMOTED to the shipped CLI (2026-07-01).**
    A standard-`design.md` reader (`engine/standard-design-md.ts`) + colour-role classifier
    (`engine/classify-colors.ts`, the one genuinely new parser piece), run against a **real
    `brand-skills` Wendy's `design.md`** (`examples/wendys.design.md`, 24 colours + 25 type tokens)
    → a full token system (`out/wendys.tokens.json` + `.ai.json`) + a **full-parity fidelity report**
    (`engine/out/wendys-fidelity-report.md`). **Results:** anchor reproduced **ΔE00 0.00**
    (exact-anchor preservation), 627/627 aliases, 248/248 contrasts, `error`→`danger` carved as a
    distinct palette; primary/secondary/tertiary pin exactly; neutral ramp fits the 11 observed greys at
    mean ΔE00 <1.5 (derived hue/chroma); status hues pinned (L placed by the ramp); aggregate colour ΔE00
    **2.02** across 24 swatches — the ramp/status/neutral divergence is the point (Decision A). Every
    predicted alignment finding confirmed: type roles `mega-*`→`display`/`button-*`→`label`;
    `error`≡`primary-dark`, `info`≡`secondary` (observed dups the engine doesn't propagate); the file's
    stated `primary`-on-white "~4.6:1" is stale for its own `#C8102E` (engine measures **5.88:1**). The
    optional **`x-prism3` block** (§11.4) round-trips: the reader maps its levers → `BrandInput`
    (radiusScale/typeScale/density/motionTempo/actionPalette/iconContrast/surfaces/gradients); Wendy's
    carries no block → engine defaults (the plain-spec guarantee). **Promotion:** the reader + classifier
    are no longer spike-only — `cli.ts` now **auto-detects the dialect** (a top-level flat `colors:` map ⇒
    standard; else engine-native) and runs either through the same core, with `--fidelity` writing the
    report; `standardToBrandInput` (classify + families + x-prism3) and `fidelity.ts` (report builder)
    are the shared modules. The bespoke `spike-wendys.ts` runner was retired; its self-verify folded into
    `test.ts` (189 → **202**). Run: `npx tsx Prism3/engine/cli.ts Prism3/examples/wendys.design.md --fidelity`.
    This closes the round-trip: brand-skills emits `x-prism3`, the shipped engine CLI consumes it.
  - **brand-skills alignment — ✅ DONE (2026-07-01, this thread).** Implemented in `brand-skills`
    (branch `claude/prism3-e2e-integration-8fwul4`), across its three layers (schema → SKILL → CLI):
    (1) **type-role rename** — recommended typography names moved to the engine's vocabulary
    (`display/title/body/label/caption/eyebrow/code`), retiring `headline-*`; custom names still
    allowed + SKILL mapping guidance (`mega-*`→`display-*`, `button-*`→`label-*`). (2) **colour-role
    contract** — documented (no rename): the classifier convention + `error`→`danger` bridge (keep
    emitting `error`). (3) **optional `x-prism3:` block** — hand-authored in `surfaces.md`, passed
    through verbatim by `refresh-design` to a top-level `x-prism3` key; scoring-neutral (no new
    `.brand/` file, no manifest/health impact). Spec: `brand-skills/docs/superpowers/specs/
    2026-07-01-prism3-engine-alignment-design.md`. Tests 159 → 162 green; no version bump.
    **Token Press provisioning deferred** (private, different-org, export-stage — downstream).
- **A. `design.md` + CLI adapter — ✅ DONE (2026-07-01).** A brand brief
  (`design.md` frontmatter → `BrandInput`, prose for agent latitude) compiled by
  the CLI over the pure core. Proves the core-as-a-library and the authoring
  on-ramp in the easy Node environment before the Figma sandbox. No LLM required to
  use it; agent-draftable. **As built:** `engine/design-md.ts` (a dependency-free
  block-style YAML-subset parser — indentation nesting + block sequences + flow
  `{}`/`[]` leaves + scalar typing + frontmatter/prose split) → `BrandInput`,
  validated against `theme-schema.json`; `engine/cli.ts` (`tsx cli.ts <design.md>
  [--out <dir>]`) parses → validates → `brandTheme` → `emitTheme`, exiting non-zero
  on a schema violation, a broken alias, or a failed contrast contract.
  `emit-dtcg.ts` was refactored to **export the reusable core** (`buildTree` /
  `emitTheme` / `validateBrandInput`) behind an `isMain` guard, and now compiles
  both example brands **from** `examples/*.design.md` (single source of truth).
  `examples/aurora.design.md` is the **faithfulness** test — it reproduces
  `out/aurora.tokens.json` **byte-for-byte** (verified: empty `git diff`; the CLI
  path is byte-identical to the regression path); `examples/harbor.design.md` is
  the net-new **coverage** brand (deep-teal, `action = primary`, warm-neutral greys
  + tinted page, measured status, comfortable/sharp, system stack + compact scale,
  gradients off), validated behaviourally (schema-conforms, 622/622 aliases resolve,
  248/248 contrasts hold). Both are wired into `test.ts` (202/202). Full spec + lever
  table in `07-e2e-journey.md` §6. NOTE: the "~30 line parser" estimate in the
  locked plan was optimistic given the nested typography/gradients surface — the
  block-style parser is ~200 lines, still dependency-free and scoped to `BrandInput`.
- **★ NEXT — Theming interfaces (`08-theming-interfaces`, 2026-07-01).** The customization
  surfaces are now a committed shape, not a direction note. Locked: (1) a **NEW** Prism3 Figma
  plugin built on the engine core (not an evolution of the existing theming plugin — the core is
  reused, the plugin is a fresh materialization + control shell); (2) **near-continuity** between
  the Figma plugin and the web playground — one shared **lever manifest** + live-preview model,
  not two hand-maintained UIs. Revised build sequence (`08` §7):
  - **B0. Lever manifest — ✅ DONE (2026-07-01).** `engine/levers.ts` → `schema/lever-manifest.json`:
    the shared-control contract, **35 levers** across 7 groups (20 `advanced`), each with
    group/label/description/control (`color`/`slider`/`enum`/`toggle`/`list`/`palette-ref`/`object`)
    + defaults + UI ranges/enum options. The plugin, playground, and MCP tool schema all render from
    it — the *presentation* half that `theme-schema.json` (validation half) lacks. **Can't drift:**
    `test.ts` asserts every key resolves in the schema, every enum matches the schema enum (as a set),
    every default matches, and the committed JSON is up to date (208/208). **Pure — no `node:*`**
    (the plugin/playground/MCP bundle it into a browser/Figma sandbox); the write step is the
    `emit-levers.ts` I/O shell. `id` is host-supplied identity, not a lever; the gate asserts every
    *other* required field is a lever. Run `npx tsx Prism3/engine/emit-levers.ts`.
  - **B1a. Preview spec — ✅ DONE (2026-07-01).** `engine/preview.ts` → `schema/preview-spec.json`:
    a portable, data-only description of **8 sample components / 22 variants** (button + states,
    secondary button, input, card, alert per semantic, nav item, badge, type specimen), each binding
    UI props to root-relative semantic token paths + the contrast pairs to overlay (52 token refs).
    The plugin and playground render the SAME live preview from it (extracts the binding knowledge
    latent in `visualize.ts`). **Pure — no `node:*`** (write step = `emit-preview.ts`). **Gates
    (`test.ts`):** every referenced token path resolves to a real leaf in the emitted token tree
    (binding-validity), contract mins are sane, **no contract over-claims the engine guarantee**
    (declared min ≤ the engine's min for that role+surface — the PR #20 review hardening), committed
    JSON current (215/215). Run `npx tsx Prism3/engine/emit-preview.ts`.
  - **B1b. Resolved-preview projection — ✅ DONE (2026-07-01).** `engine/resolve-preview.ts`:
    `resolvePreview(theme)` — the runtime read-model the surfaces consume reactively. Projects the
    preview spec to **concrete colours per mode** (every referenced role → its hex in light/dark/
    hc-light/hc-dark) + **live contrast results** (each declared contract computed on the REAL
    resolved fg-on-bg, per mode, with pass/fail — the contrast overlay, `04`'s differentiator).
    **Pure — no `node:*`**: resolves via `resolveAllModes` (which now carries each role's `hex`,
    a small additive enrichment to `modes.ts`) + the pure spec, not `buildTree`. **Gate:** every
    referenced role resolves to a hex in every mode, and **every declared a11y contract actually
    holds on the resolved colours in all 4 modes** — the automated version of the PR #20 manual
    contrast check. 215/215; `out/*` unchanged (the `hex` field is emit-invisible). It's a
    per-live-theme read-model, not a committed artifact.
  - **B1 dogfood — ✅ DONE (2026-07-02, PR #22).** `engine/visualize.ts` now renders the shared
    preview model in-repo before the host renderers exist: for each brand it resolves `previewSpec`
    (B1a) + `resolvePreview(theme)` (B1b) and paints every component/variant as a styled chip —
    bg/text/border from the resolved role colours, radius/padding from the token tree, type from the
    resolved composite — with the per-mode L/D/HL/HD contrast overlay driven by the same `byMode.pass`
    results. Proves the "define once, render everywhere" model composes a real UI + live overlay from
    one source, de-risking the leap to a separate plugin/playground repo. **Additive, output-scoped:**
    only `visualize.ts` (+ regenerated `out/tokens.html`) changed; pure core untouched, `out/*.tokens.json`
    byte-identical, 215/215. **← next: B1c-proper — the host renderers (DOM playground + Figma-node
    plugin) that paint from the same `resolvePreview` output; land with B2/B3.**
  - **B1c. Host renderers** — the DOM (playground) + Figma-node (plugin) renderers that paint the
    components from `resolvePreview`'s output. The binding + overlay logic is now proven via the B1
    dogfood above; B1c ports it to the two live hosts. Land with B2/B3.
  - **B2. New Figma plugin shell** — bundles the core, renders knobs from the manifest,
    materialises via `$extensions.prism3.figma` (`08` §2/§5).
  - **B3. Web playground** — same manifest + preview, DOM/CSS-var host.
  - **Parallel validation:** Style Dictionary consumption (owner-driven) + **Figma-MCP import** of
    `out/*.tokens.json` (validates the Figma directives, de-risks plugin materialization, and
    unblocks Token Press testing — highest-value near-term).
- **C. MCP adapter** over the core — "an agent themes Prism3" as a callable surface
  (the KB's MCP-first payoff). Its tool schema derives from the B0 lever manifest.
- **D. (later) Component library** — components-as-data → Web Components + React +
  Storybook + `.ai.json` + Figma Code Connect (layers 2–3). In scope eventually;
  mapped now so upstream choices don't foreclose it. Heavy per-component research
  already in the KB (UIC series). **Architecture now locked in
  `14-component-layer.md`** (2026-07-03): definitions seeded from the KB's ~40
  component briefs, token-name-bound, deterministically materialized to Figma via
  the B2 plugin (write leg) with an extraction-diff regression (verify leg;
  Specs CLI's seat). Build sequence in `14` §6 — starts with the schema + 3
  components when this activates.

Parked, owner-flagged: **light-grey surface value tuning** — done visually once real
UI layouts exist, not against swatches.

Older backlog (still valid, lower priority than the pipeline above):

1. **"Beyond color" is COMPLETE — see `05-token-coverage-roadmap.md`.** Every token
   category NB + Prism2 ship is now generated: colour + the dimension axis
   (grid/space/radius/sizes), **typography** (the headline font-swap lever +
   composites + fluid), **shadow/elevation** (mode-aware), **motion**
   (`motionPersonality` lever), **layout/breakpoints**, the quick wins
   (**border-width**, **focus** ring dims, **icon 3:1 toggle**), and (opt-in)
   **gradients** (DTCG composite, ramp-aliased stops, OKLCH + sRGB pre-sample,
   Figma Paint Style, worst-case-stop contrast). What's left is plumbing, not new
   categories. Component sizing is still a prototype — values are sensible
   defaults, not yet validated against a real component set; revisit when the
   component layer is real.
2. **Prove downstream consumption.** Feed `out/*.tokens.json` through Style
   Dictionary and/or the Figma MCP — confirm a real tool ingests it and the four
   modes map to Figma variable modes. Turns "generation" into "pipeline".
3. **Round-trip the raw-figma format.** Emit the second parallel format
   (`raw-figma/`) the repo keeps, preserving `variableId` linkage (root `CLAUDE.md`).
4. **Figma binding constraints.** Verify variable/mode constraints via the Figma
   MCP (still outstanding from the architecture review).
5. **Tune status-hue defaults against a reference set** (Tailwind/Radix/Material/
   USWDS + NB's measured green/amber). Current canonical hues (success 145,
   warning 75, danger 27) are plausible but not evidence-derived; functionally
   safe (placed by luminance) but worth grounding. Overrides already wired via
   `BrandInput.status` / schema `statusColors`.
6. **Semantic-layer decision backlog (`03-open-questions.md`).** Items 1–4
   RESOLVED and shipped — elevation/surface naming (ordinal ladder, `overlay`
   dropped), scrim + opacity/alpha primitives, disabled strategy (accessible
   default, 3:1 floor), white/black policy. Remaining: **Item 5** (icon 3:1
   toggle — parked by decision; icons currently mirror text, one-line floor swap
   when wanted). Next non-backlog frontiers: shadows/effects axis (deferred from
   Item 1), typography + motion (item 1 above), downstream consumption (item 2).
7. **Theming playground / dashboard (`04-theming-playground.md`).** Direction
   note only — a live theming dashboard that reskins real components + composed
   pages as tokens change (web app lead; Figma plugin as a second surface). The
   interactive successor to `visualize.ts`; differentiator is a live
   contrast-contract overlay. Not slated for build; documented for direction.
8. **Figma round-trip (code → Figma) (`05-token-coverage-roadmap.md` →
   *Cross-cutting*).** Analysis recorded, build deferred. Figma variables are
   only `COLOR`/`FLOAT`/`STRING` + scopes — no composite type — so typography
   exports as atoms (→ a Text Style binds them) and shadow/transition have **no**
   variable representation (Effect Style / code-only). Pipeline clarified: raw
   Figma → **Adam's custom plugin** → SD-ready DTCG (SD has *not* run on the
   example packages yet). Backlog: a three-tier disposition contract
   (`variable`/`style-part`/`code-only` + scope) as the cheap now-step, then an
   `emit-figma.ts` writer + style manifest + companion plugin. Open decision —
   update an existing template (preserve `VariableID`s) vs build from scratch —
   tracked as `03-open-questions` Item 9. KB POV write-up also backlogged.
   **Verified research** now lives in the knowledge-base repo, run
   `_research/_inbound/2026-06-28-figma-variables-styles-roundtrip` (four
   primary-source agents): the variable type ceiling + 8-field typography binding
   surface, **lineHeight/letterSpacing bind as px only** (unitless `1.5` → 1.5px),
   **text-decoration/case unbindable** (links = separate Text Styles), shadow
   *numerics* bind, Figma Motion (Config 2026) adds timing/easing variables, REST
   Variables API is **Enterprise-only** (styles can only be created via the Plugin
   API). **Materialization decision (locked for the typography build):** canonical
   value in `$value`; a machine-readable directive in `$extensions.prism3.figma`
   for the exporter (e.g. lineHeight `px-from-ratio`); intent *echoed* into
   `.ai.json` as derived narrative — the exporter reads `$extensions` data, never
   the prose sidecar. Generalises to letter-spacing, fluid sizes, etc.
   (`05-token-coverage-roadmap` → Typography + *Cross-cutting: Figma round-trip*).

---

## Constraints to respect (from root CLAUDE.md)

- The base repo is design-tokens-only (JSON, no build). The `Prism3/engine/`
  tool is a new, self-contained addition — don't impose a build system on the
  token data.
- When editing existing brand tokens, change **both** the `raw-figma/` and
  `tokens/` (DTCG) copies and keep `variableId` linkage intact. (The engine
  currently emits a fresh DTCG tree under `engine/out/`; it does not yet write
  back into the brand token dirs.)
- Preserve namespaces (`nbds.*` for NB, `nbds.pds.*` for Prism2). Validate by
  JSON parse + every `{…}` alias resolving.
