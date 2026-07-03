# 15 — Project code review: findings (2026-07-03)

> A full-codebase review of the engine (`Prism3/engine/*`), the web adapter
> (`web/src/main.ts`), and the regression harness — **findings only, nothing
> fixed**. This doc is the fix backlog: each finding carries location, a concrete
> failure scenario, whether an existing gate would catch it, and confidence.
> Method: baseline gates confirmed green first (test.ts **336/336**, nb-regression
> report clean, emit-dtcg 622/622 aliases + 248/248 contrasts, regenerated `out/*`
> byte-identical), then five independent review passes over partitions (core
> colour math / theme+tree+emit / emit-figma+regression / parsers+contracts /
> web+visualize), several findings verified empirically with `tsx` probes, and the
> highest-severity claims re-verified independently before writing. Severity is
> product impact, not code style. **When fixing: one concern per PR, and add the
> missing gate with each fix — most findings below exist precisely because the
> gate surface has a blind spot.**

---

## 0. The headline

The engine's core math is in excellent shape — OKLab matrices, CIEDE2000 edge
cases, and the WCAG luminance formula all verified correct against their specs,
purity fences hold everywhere, and several suspected hazards (float-vs-emitted-hex
divergence, alias-name collisions in emit-figma, DOM listener leaks) were checked
and cleanly disproven. The serious problems cluster in four cross-cutting themes:

1. **Self-referential verification.** In three places the gates validate the code
   *with* the code under test: contrast contracts compare the pre-rounded ratio
   (CR-01), the anchor-preservation ΔE compares against the already-gamut-clipped
   value (CR-12), and the emit-figma mode test iterates the same hardcoded mode
   list the emitter uses (CR-09). Green gates, wrong behaviour.
2. **NB-only structural gates.** Every emit-figma structural gate runs `nbTheme()`
   only — aurora/harbor/wendys (different breakpoints, modes, spaceBase, gradient
   presence) never pass through the Figma emit path, which is exactly where the
   brand-shape bugs live (CR-08, CR-09, CR-22, CR-23).
3. **Silent degradation over loud failure.** The adapters' house pattern under
   unexpected input is a quiet fallback: the YAML parser drops lines (CR-05), the
   emitter falls back to black (CR-22) or `Regular` (L-14), the regression harness
   always exits 0 (CR-06), unknown anchors become phantom knots (CR-13). In an
   accessibility-contract product, silent wrong output is the worst failure mode.
4. **The validator enforces less than the schema declares.** The hand-rolled
   JSON-Schema validator silently ignores whole keyword classes (CR-04), so
   "[schema] ✓ conforms" actively vouches for inputs the schema rejects.

---

## 1. High severity

### CR-01 — `contrast()` rounds before every threshold comparison: WCAG false passes
- **Where:** `engine/color.ts:112-114`; consumed by `engine/modes.ts:44,65,187-188` and every contract check in `test.ts`.
- **What:** the ratio is `Math.round(x*100)/100` *inside* `contrast()`, and all pass/fail decisions compare the rounded value. WCAG conformance is defined on the un-rounded ratio.
- **Failure (verified by probe):** `#007ea1` on black → true ratio **4.49898** → engine reports **4.50** → passes an AA 4.5:1 contract it fails. Same class at 3:1 and 7:1. Because `pickMinPass` deliberately selects the *least*-extreme passing candidate, resolved roles sit exactly in this marginal zone by design — the bug targets the engine's own sweet spot. The rounded value also lands in `ResolvedRole.ratio` and every emitted description, so shipped claims inherit it.
- **Gate coverage:** none possible as-is — the gates compare the same rounded value (theme 1 above). **Confidence:** certain.
- **Fix shape (for later):** compare raw, round only at display/emit boundaries; add a gate with a known 4.49-raw pair.

### CR-02 — The contrast floor is two steps shallower than the shipped surface ladder
- **Where:** `engine/modes.ts:96-109` (floor = base±50) vs the emitted `background.tertiary` (base±100) and `foreground.secondary/tertiary` (base±100/150).
- **What:** the floor comment claims "worst-case supported surface", but minimum-passing text picked against `neutral.050` sits on `foreground.tertiary` (`neutral.150`) in real UI.
- **Failure (verified numerically):** default light brand — `text.secondary` = 4.56:1 on the floor but **3.52:1** on `foreground.tertiary`; `text.tertiary` = 3.18:1 on the floor but **2.46:1** there — below even its own 3:1 min. `border.*` has the same shape one tier down (contracted against `background.primary` only; L-04).
- **Gate coverage:** none — contracts are only measured against the recorded `against` surface. **Confidence:** certain on numbers; the *intent* question (is text-on-fg.tertiary a supported pairing?) is an owner decision — either move the floor to base±150 or document the pairing restriction and encode it in the preview contracts + `.ai.json` `avoid_when`.

### CR-03 — No duplicate/reserved palette-name guard: `brandColors` silently hijacks engine ramps
- **Where:** `engine/theme.ts:784-822` (no name validation) with last-wins consumers `engine/tree.ts:277` and `engine/modes.ts:332`; also reachable from the web accent-rename input (`web/src/main.ts:218-222`) and any imported `design.md`.
- **What:** `brandColors: [{ name: 'neutral', … }]` produces two `neutral` palettes; `new Map(...)` and `palette[p.palette] = node` both keep the last one. Order effects cut both ways: a brandColor named `neutral`/`primary` **replaces** the engine ramp the whole surface model is built on; one named `success`/`danger` is itself **replaced** by the later-pushed status ramp (so `actionPalette` binds to the synthesized status colour, not the brand's).
- **Failure:** contrast picks are recomputed against the corrupted ramp and pass self-consistently — **gates stay green on nonsense output**. No error anywhere.
- **Gate coverage:** no. **Confidence:** certain (two review passes found it independently).
- **Related (L-06):** `brandColors[].name` / gradient names have no charset rule (schema bare string) — a dotted or spaced name breaks `{a.b.c}` path conventions; caught at emit only if referenced.

### CR-04 — The hand-rolled schema validator silently ignores whole keyword classes
- **Where:** `engine/emit-dtcg.ts:55-78` (`validate`), used by `validateBrandInput` — the boot check for CLI **and** the sandbox hosts.
- **What:** no `boolean` branch (a `{"type":"boolean"}` subschema matches *anything*, including inside `oneOf`); `enum` checked only under `type:"string"`; `minItems`/`maxItems` never. The schema uses all three. Also unenforced: `integer`, `minLength`, `const`, `anyOf`/`allOf`.
- **Failure (verified by probe):** `gradients: "banana"` → `validateBrandInput` returns `[]` → `brandTheme` crashes at `inputs.map` (CLI catches; the plugin/playground, which boot from "validated" input, would crash uncaught). `typography.families.variable: "yes"` validates and truthy-coerces → wrong Figma weight emission, fully silent. `titleFloor: 17` passes its `enum:[16,18]`. `easingEmphasized: [0.2, 0]` passes `minItems:4` → invalid `cubic-bezier()` downstream.
- **Gate coverage:** negative tests exist only for the `modes` string-enum and the `root` pattern. **Confidence:** certain (probe-verified; two passes found it independently).

### CR-05 — The design.md parser silently discards misindented lines *and everything after them*
- **Where:** `engine/design-md.ts:157-173` (exact-indent match; `if (ci < 0) break`), tabs counted as 1 char at `:211`.
- **Failure (verified by probe):** one extra leading space on `chroma:` inside `neutral:` → `chroma` **and the following top-level `primary`** vanish from the parse, no error. If the dropped keys are optional (`radiusScale` one space off), validation passes and the engine emits defaults — the designer's lever is ignored with zero diagnostics. A stray prose line inside frontmatter truncates the rest of the frontmatter.
- **Gate coverage:** parser gates are happy-path only. **Confidence:** certain.
- **Related (M-18, L-08):** the serializer escapes `"` as `\"` but the parser never unescapes — `parseDesignMd(toDesignMd(x)) ≡ x` breaks for any string containing a quote (e.g. font stack `'Font "Display", serif'`); the round-trip gate only exercises quote-free inputs. Closing-fence detection is prefix-based (`--- levers ---` closes the frontmatter early); duplicate keys last-win silently.

### CR-06 — The NB regression cannot fail
- **Where:** `engine/nb-regression.ts:170-188` (no `process.exitCode` anywhere — verified); denominator shrink at `:68,146-153`; mean-of-means verdict at `:170-182`.
- **What:** it is a report generator. ΔE00 outliers, contract failures, and dimension mismatches render as ⚠️/❌ *rows in markdown* and exit 0. Additionally: (a) generated steps missing from the reference file are silently `continue`d, so a truncated/renamed fixture shrinks the comparison to nothing (0/0 → `NaN` mean flows into the verdict); (b) the ≤3 tolerance is on the mean-of-means — a single catastrophic step (ΔE 15) hides under a good aggregate; (c) the amber.600/red.300 "NB hand kinks" explanation is static prose that would keep printing over a *new* engine bug with the same signature; (d) the contract block indexes `specs[0]`/`specs[3]` positionally under hardcoded "red"/"neutral" labels (L-12).
- **Failure:** a ramp-math regression ships while CI (or the CLAUDE.md gate ritual `a && b && c`) stays green; only a human reading the report notices.
- **Gate coverage:** test.ts re-implements the *contrast* contracts but nothing gates the ΔE00 fidelity measurement itself. **Confidence:** certain.

### CR-07 — Web: brand-controlled palette name reaches `innerHTML` (XSS)
- **Where:** `web/src/main.ts:146` (`meta.innerHTML = \`anchor <b class="mono">${name}/${aKey}</b>\``); `name` is verbatim `brandColors[].name` (no validation, CR-03), reachable via pasted `design.md` import and the accent rename input.
- **Failure:** paste a design.md with `brandColors: [{ name: "<img src=x onerror=…>", … }]` — parser handles the quoted string, `brandTheme` accepts it, script fires on the next ramp paint. Everything else in main.ts correctly uses `textContent`; this is the one data-bearing `innerHTML` sink. (Same injection class, lower risk: `visualize.ts` skips `esc()` for palette names/alias targets/titles — L-10.)
- **Gate coverage:** web has typecheck+build only; no behavioural tests. **Confidence:** certain.

### CR-08 — emit-figma layout axis breaks for any non-5-breakpoint brand
- **Where:** `engine/emit-figma.ts:647,686` (hardcoded 5 `LAYOUT_MODES`) vs `engine/theme.ts:632-645` (`breakpoints` is variable-length, 1–7 names).
- **Failure:** 3 breakpoints → `gridNode['xl']` undefined → TypeError (loud crash). 6–7 breakpoints → `xs`/`3xl` grid **modes** silently dropped while their `breakpoint/*` **variables** are still emitted — an internally inconsistent artifact.
- **Gate coverage:** test block 19 runs `nbTheme()` only (always 5). **Confidence:** certain.

---

## 2. Medium severity

### Engine core (colour/ramp)
- **M-01 — NaN hex at anchor L extremes.** `ramp.ts:84-88`: `chromaForL` divides by `(lMax − peakL)`; an anchor with `l = 0.975` (== lMax) at a non-top step → 0/0 → `#NaNNaNNaN` emitted (probe-verified). Symmetric at lMin. No hex-shape gate exists for ramp output. *Certain.*
- **M-02 — Verbatim anchor override re-breaks monotonic L.** `ramp.ts:152-161`: the monotonicity clamp runs on knots, then the anchor is written verbatim after — anchor `l:0.985` at step 50 makes step 25 *darker* than step 50 (probe-verified). Mode pickers assume number↔lightness ordering. Also: conflicting knots flatten the 500 dual-AA pivot silently. No monotonicity/distinctness gate. *Certain.*
- **M-03 — Out-of-gamut anchors silently hue/lightness-shift.** `color.ts:67-75` clamps channels independently; anchor `{l:.55,c:.32,h:145}` ships as ΔL +0.04, ΔC −0.12, Δh −2.5° — "exact anchor preservation" fails silently, and the ΔE gate compares against the already-clipped value (tautological). Needs boundary validation or documented chroma projection. *Certain mechanism; likely occurrence.*
- **M-04 — Unknown `anchor.stepNum` → phantom knot.** `ramp.ts:130,140`: `indexOf` −1 means the anchor is never emitted and a `{i:-1}` knot distorts the curve, silently (probe-verified). One `throw` fixes it. *Certain.*

### Theme / semantic layer
- **M-05 — `inRedTerritory` is chroma-blind and knife-edged.** `theme.ts:115,812`: hue 7–47 with no chroma floor — a warm greige primary (`c:0.03,h:30`) "is red", so danger reuses a near-grey ramp (destructive signalling gone); `h:47` vs `h:47.5` brands get categorically different danger systems with no note. Needs a chroma floor (~0.08) and boundary notes. *Certain logic; likely severity.*
- **M-06 — Non-primary `actionPalette` ignores the brand's pinned accent.** `theme.ts:868`: `roleAnchorStep.action = 500` unless action=primary, so the brand's exact supplied accent (pinned at, say, 650) is never the action colour — engine-invented `accent.500` renders instead, while the note claims the decision was honoured. The NB fixture sets `danger: 550 = anchor`, so the white-label path diverges from the regression's own semantics. *Likely (may be a deliberate AA-pivot choice; needs an owner ruling).*

### Emit / metadata
- **M-07 — emit-figma fabricates modes for opt-out brands** *(KNOWN — docs/10 §7, confirmed; elevated here because the test asserts the wrong behaviour)*. `emit-figma.ts:73,145,876-882`: hardcoded `COLOR_MODES` + `?? leaf.$value` fallback → a `modes:['light']` brand emits four colour files, dark/HC being relabelled light values; a `[light,dark]` brand's hc-* files look plausible but are unverified light. test.ts:577 iterates the same hardcoded list — the gate *asserts* the fabrication. *Certain.*
- **M-08 — Unresolvable alias target → silent black + dangling alias.** `emit-figma.ts:95-107,146-154`: `at()` miss → `parseColor(undefined)` → `{0,0,0,1}` with an alias name Figma can't resolve; same fallback for 3/8-digit hex and modern `rgb()` syntax. Colour emit never runs on non-NB brands, so nothing would catch it. *Certain mechanism; likely trigger.*
- **M-09 — `space` vars alias unconditionally.** `emit-figma.ts:503-513` (no `isAlias` guard, unlike radius/size/etc.); upstream, `brandTheme` never passes `extras` to `buildDims`, so a brand with `spaceBase` off the 4px grid (e.g. 12/4 → px 3, 9, 18) mints space aliases into dimension steps that don't exist → dangling by-name aliases in the artifact. *Likely.*
- **M-10 — `.ai.json` `aliased_by` misses mode-override consumers.** `ai-metadata.ts:220` builds the reverse index from `$value` refs only — a primitive consumed solely by dark/HC overrides shows **no** consumers, while the sidecar's own prose claims the index "cannot drift". Impact-analysis agents get told nothing consumes a load-bearing dark-side step. The whole sidecar is ungated (zero test references). *Certain.*
- **M-11 — Fluid-typography refs are invisible to the alias gate.** `tree.ts:485-521` validates `$value` and `modes.*.$value` but not `$extensions.prism3.responsive.min/max.ref` (minted at `:245-246`) — a ladder edit ships a dangling `{prism.font.size.44}` while the 622/622 gate reports clean. *Certain (blind spot; current output resolves).*

### Parsers / CLI
- **M-12 — Classifier is case-sensitive where classification isn't.** `classify-colors.ts:87-101` vs `:119,127,159`: `Error: '#f00'` classifies as role `error` but the anchor lookup (`colors['error']`) misses → `status.danger` unset, logged as "unrecognised token"; a map with only `Primary` throws "no 'primary'". *Certain (probe-verified).*
- **M-13 — Standard-dialect path can crash raw through the CLI.** `cli.ts:106` sits outside the try/catch; `classifyColors` throws ("no primary") and `hexToRgb` rejects **8-digit alpha hex** (`#C8102EFF` — common in real extractions, probe-verified) → raw stack trace instead of the promised readable diagnosis (exit code still 1). CLI main (argv, routing, exit codes) has zero test execution. *Certain.*
- **M-14 — `x-prism3.radiusScale` NaN passes validation.** `standard-design-md.ts:122` `Number('soft')` → NaN; `typeof NaN === 'number'` and NaN comparisons are false, so min/max never fire → `NaNpx` radius tokens. *Certain validation-pass; likely NaNpx emission.*

### Web adapter
- **M-15 — Exports unguarded in failing state.** `main.ts:556`: while `lastError` is set, tokens.json export re-runs `brandTheme(brandState)` uncaught → handler throws, no download, no feedback; design.md export (`:552`) silently emits a brief its own importer rejects. *Certain.*
- **M-16 — Half-updated render after failed rebuild.** `main.ts:132-137,179-182`: ramps paint from last-good `theme` but anchor badges compute from the live (failing) `brandState` — wrong swatch flagged, contradicting the errbar's "last valid palettes" claim. *Certain data-flow.*
- **M-17 — A malformed paste destroys the pasted text.** `main.ts:564-567,635-645`: error paths rebuild the menu with a fresh empty textarea (only `importErr` survives); a mode-toggle click mid-paste also wipes it. Working brand correctly untouched — UI-destructive only. *Certain.*
- **M-18 — Modes toggles are a lossy projection of legal mode sets.** `main.ts:530-538,601-613`: the engine accepts e.g. `['light','dark','hc-dark']`; the two-toggle UI displays it wrong and the first click canonicalizes it (drops hc-dark, adds hc-light unasked). Preview bar (honest, from `rp.modes`) and toggles disagree. Whether hc-dark-without-dark is *meant* to be supported is an owner call (docs/11). *Certain behaviour.*

---

## 3. Low severity

- **L-01** `modes.ts:255-258,302-305` — state `walk()` saturates at ramp ends: hover/pressed can equal default (indistinguishable interactive states); contrast is gated per-state, distinctness never.
- **L-02** `color.ts:125-129` — `dualContrastWindow(r)` returns an inverted window for r > √21 ≈ 4.58; safe for the sole 4.5 caller, a trap for an HC 7:1 caller.
- **L-03** `scale.ts:82-88` — small `radiusScale` values collapse rungs (0.25 → sm=0=none, md=lg=2); no monotonicity gate.
- **L-04** `modes.ts:325` — semantic borders' SC 1.4.11 contract is against `background.primary` only (floor-gap sibling of CR-02, narrower blast radius).
- **L-05** `tree.ts:538-546` — `deref` is cycle-safe but fail-silent (returns the alias node; `pxOf` coerces to 0px geometry); `pxOf` also parses rem values as px.
- **L-06** `theme.ts:755` vs `:784-787` — `root` is pattern-enforced; palette/gradient names aren't (see CR-03).
- **L-07** `theme.ts:789-793` — brand-supplied status overrides discard `l`/`c` (hue+chroma only); a "measured" status green never round-trips exactly. Possibly intended ("vivid, unanchored") — flag in notes if so.
- **L-08** `design-md.ts:230-231` — closing-fence prefix match; duplicate keys last-win (see CR-05 family).
- **L-09** `cli.ts:78,102` — `--out` consumes the next token unconditionally (`--out --fidelity` writes to a dir named `--fidelity`); dialect detection misroutes empty `colors:{}` (native errors on a standard file) and stray `colors:` maps (routes standard, hits M-13).
- **L-10** `visualize.ts:97,388,408` — hardcoded 4-mode lists ignore `theme.modes` (degrades to empty columns, latent); a failing light contract still prints `3.20≥4.5` as text; `esc()` skipped for palette names/titles. Output entirely ungated.
- **L-11** `main.ts:549` + `design-md.ts:54` — numeric `id:` from a pasted design.md loads fine but crashes both exports (`slug()` calls `.trim()` on a number).
- **L-12** `nb-regression.ts:87-88` — positional `specs[0]`/`specs[3]` with hardcoded labels (see CR-06).
- **L-13** `emit-figma.ts:151,588,405-406` — scope fall-through default is fill-only (wrong for a future text-ish family, silent); PERCENT bakes round to integers (0.125 opacity → 13%; lineHeight 1.375 → 138%), masked by the ±1 test tolerance.
- **L-14** `emit-figma.ts:329-343,363-365,190-193` — text-style derivation regexes fail to plausible defaults ('text', 'default', `font/size/` dangling bind, weight 400/'Regular' for e.g. 450) instead of erroring.
- **L-15** `standard-design-md.ts:81-82` via `design-md.ts:54` — scalar written-form loss (`1.0`→'1', `0700`→'700'); unquoted `#hex` becomes a comment → `'null'` value with a confusing error (YAML-consistent but sharp).
- **L-16** `resolve-preview.ts` typing nit — `byMode` typed `Record<ModeName,…>` but sparsely populated for narrowed-modes themes; compiler promises `byMode.dark` exists when it's undefined (consumer foot-gun).
- **L-17** `web` perf note — every input event runs `brandTheme` + full `buildTree` + DOM rebuild synchronously (no debounce). No re-entry bug (all synchronous — verified clean).

---

## 4. Verified solid (checked, no defect — for the record)

- **Colour science:** OKLab↔linear-sRGB matrices match Ottosson exactly; CIEDE2000 correct on the hard edges (hue wraparound, achromatic conventions, RT term) per Sharma 2005; WCAG luminance uses the 2.2-correct 0.04045 threshold; `maxChroma`/`solveLForLuminance` converge far below the 8-bit quantum.
- **Measured == shipped:** `Step.rgb` is quantised to 8-bit *before* contrast measurement and hex is emitted from the same integers — the suspected float-pass/hex-fail divergence does not exist (CR-01's rounding is the only measure/claim gap).
- **Purity fences hold everywhere:** no `node:*` in the transitive core (color/ramp/scale/modes/theme/tree/design-md/levers/preview/resolve-preview/ai-metadata); I/O confined to the emit shells.
- **Mode opt-out inside the engine is correct and gated:** `resolveAllModes` filters by `theme.modes`; tree overrides and `.ai.json` `mode_overrides` inherit it; the web export respects root + narrowed modes; design.md round-trips `modes`. The leak is only at the Figma emit layer (M-07).
- **emit-figma structure:** 3-level cross-collection alias chains sound; `figName` collisions impossible for generator-produced trees; `Math.fround` float32 handling correct; no PERCENT double-conversion.
- **Web:** no DOM listener leaks (nodes discarded wholesale; the one document-level listener is bind-once); no synchronous re-entry hazard; the import accept-check genuinely protects the working brand.
- **Lever manifest:** the drift gate (keys/enums/defaults vs schema) does what it claims — the weakness is the validator behind it (CR-04), not the manifest.

## 5. Gate blind spots (the meta-finding)

New gates worth adding when fixes land, in rough order of leverage:

1. **Raw-ratio contract checks** (kills CR-01's class) + a known-marginal fixture pair.
2. **A second brand through emit-figma** (aurora or harbor: non-5 breakpoints, narrowed modes, gradients) — would have caught CR-08, M-07, M-08, M-09.
3. **`nb-regression` exit criteria** (per-step ΔE ceiling + denominator count assertion + non-zero exit) — CR-06.
4. **Adversarial BrandInput suite:** duplicate/reserved/dotted palette names (CR-03), out-of-gamut + extreme-L anchors (M-01/02/03), off-STEP anchor (M-04), boolean/enum/minItems schema violations (CR-04), NaN levers (M-14).
5. **Parser property tests:** misindentation (CR-05), quotes round-trip (M-18-family), fence edge cases.
6. **Ramp invariants:** monotone L, distinct adjacent steps, hex shape `#[0-9a-f]{6}` (M-01/02).
7. **`.ai.json` gates:** `aliased_by` completeness incl. mode refs (M-10), CONSUME family coverage (L-family).
8. **Web behavioural smoke** (headless): import-error paths, failing-state exports, XSS probe string (CR-07, M-15–17).

---

*Review inputs: five partition passes (2026-07-03) + independent re-verification
of CR-01/03/04/06/07 by probe and code-read. Baseline: `main` @ 253f2be. Nothing
in this document has been fixed; every fix should land as its own PR with its
gate, per the working principles in the root CLAUDE.md.*
