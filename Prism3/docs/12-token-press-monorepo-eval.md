# 12 — Token Press → monorepo: shared-export-core evaluation

> **Status: proposal / hypothesis — not a decision.** Written from the Token Press v2.3.1
> *agent handoff brief*, NOT its source (Token Press lives in a private org repo outside
> this session's scope). Everything here about Token Press internals is a claim to
> **verify against the real repo** — see §7, the checklist for the repo-reviewing agent.
> The question: should the export *format core* move into this monorepo so the engine's
> `emit-dtcg` and Token Press's exporter share **one** definition of "how a token becomes
> DTCG" — killing format drift by construction? Feeds `11 §4` (the export contract) and
> `09` (one core, many surfaces).

---

## 1. Why this, why now

The export format is the ecosystem's interoperability contract (`11 §4`). Today "how a
token becomes DTCG JSON" is defined **twice**:

- **`Prism3/engine/emit-dtcg.ts`** — generate → DTCG (the engine knows its token facts
  because it produced them).
- **Token Press `exporter.ts`** — Figma variables → DTCG (it reads facts from a live
  Figma file).

Those two outputs *must* agree — a dev's package and a designer's Figma export are
supposed to be the same artifact. Today they agree only because a human (me) matches a
spec. That's drift waiting to happen: any change to leaf shape, preset, or layout has to
be mirrored by hand in two codebases with different owners and release cadences.

**One shared pure module both consume ⇒ they agree by construction.** That is the prize.

## 2. The precise split — share the *shaping*, not the *sourcing*

The instinct "move Token Press in" is right in spirit but too coarse. Three layers, only
the middle one is shared:

| Layer | Engine side | Token Press side | Shared? |
|---|---|---|---|
| **Source the facts** | `brandTheme` + ramps *generate* tokens | `scanner.ts` *reads* live Figma variables (Figma API) | ❌ each owns its own |
| **Shape → DTCG** | value formatting, presets, composites, collection partition, file layout | same | ✅ **THE SHARED CORE** |
| **Deliver** | write files / web ZIP | plugin UI + `clientStorage` + ZIP + community release | ❌ each owns its own |

So the shared core (`@prism3/tokens-export`, pure, ES2018) is the **DTCG shaper**: given
already-resolved token facts, produce spec-compliant DTCG — and it owns exactly the things
that must not drift:

- **Value formatters + presets** — `dimensionFormat` object↔string, `durationFormat`,
  `colorFormat` dtcg↔css, `lineHeightOutput`, letter-spacing units; the **DTCG-spec /
  Style-Dictionary / Off-spec** preset fingerprints (`11 §4`).
- **Composite shaping** — typography / shadow / transition composites (same field shapes
  both sides must emit).
- **Collection partition + output layout** — the `collections.ts` partition (§`11 §4`
  mapping) + `shared/` + per-mode-directory rule + file-level `$extensions`
  (`generator`, `figma { collection, mode }`).

Explicitly **NOT shared:**
- Token Press's `scanner.ts` (Figma-API-coupled) and `mapVariableTypeToDTCG` **type
  inference** (FLOAT + scope/name heuristics + alias-walking) — the engine needs **no**
  inference; it *knows* every token's `$type` because it generated it. Type inference is a
  Figma→DTCG concern only.
- The engine's generation (`theme`/`ramp`/`modes` …) — Token Press never generates.

This narrower framing is what makes the move tractable: we're extracting the ~"format &
layout" half, not entangling generation with Figma scanning.

## 3. Options

- **A — Do nothing (status quo).** Keep two definitions; match by spec + review. *Cost:*
  permanent hand-sync risk; the `collections.ts` I build stays engine-internal and Token
  Press stays a separate spec-match target. *Cheapest now, most drift later.*
- **B — Extract a shared pure `@prism3/tokens-export` core; both import it.** ✅
  **recommended.** The engine's `emit-dtcg` routes its final serialization (formatters +
  partition + file layout) through the shared core; Token Press's `exporter.ts` does the
  same for its scanned facts. One preset table, one partition, one layout — forever.
- **C — Move the whole Token Press plugin into the monorepo.** Superset of B: also brings
  the plugin shell (UI, scanner, Vite build, release). *Reasonable if we also want
  centralized oversight of the plugin itself* — but the shell has no shared value with the
  engine, so it's optional and can follow B.

**Recommendation: B now, C optional-later.** B captures 100% of the anti-drift value; C is
about org convenience (one repo to watch) and can be a follow-on once B proves the seam.

## 4. Impact on the export contract (Pillar 4) — why decide this first

The export contract's shape *depends on this decision*:

- If **B**, `collections.ts` + the formatters I was about to build should be authored **as
  the shared core** (`@prism3/tokens-export`) from the start — not as engine-private code I
  later have to re-extract.
- If **A**, I build them engine-internal and Token Press stays a spec-match.

So this eval gates Pillar 4's *first line of code*. Building Pillar 4 before deciding =
building the wrong module boundary. (Meanwhile Wireframe/1b is independent and proceeds.)

## 5. Build & packaging mechanics (for B)

- **Where:** a pure package — `packages/tokens-export/` or `Prism3/export/`. Must be
  **ES2018** (Figma sandbox: no `?.`, `??`, object spread, top-level await) so Token Press
  can run it; the engine (higher target) importing an ES2018 module is fine (subset).
- **No `node:` and no `figma.*`** inside it — it takes plain fact objects, returns JSON
  structures. (Same portable-core discipline as `theme`/`tree`, docs/07 §3.)
- **Engine wiring:** `emit-dtcg` keeps `buildTree` (the nested tree is the engine's IR) but
  hands leaf values + the tree to the shared partitioner/formatters for the multi-file,
  preset-aware output. The single-tree golden stays as a regression artifact.
- **Token Press wiring:** `exporter.ts` keeps `scanner.ts` + `mapVariableTypeToDTCG`, then
  feeds resolved facts into the shared shaper instead of its inline formatting.
- **Second build system:** the monorepo gains Vite (plugin) alongside engine-tsx +
  web-esbuild. The *shared core itself* stays buildless/tsx-importable; only the plugin
  shell needs Vite. Manageable but real.

## 6. Risks / costs to weigh

- **Refactor surface in a shipping plugin.** Token Press is v2.3.1 in the Figma community;
  re-pointing its exporter at a shared core is real work with a real user base. Sequence it
  so the plugin's output is byte-identical across the refactor (golden its own ZIP first).
- **ES2018 tax on the shared core** — the engine would import a module written in an older
  dialect. Cosmetic, but a constraint to honor.
- **Ownership / release** — keeping the community plugin publishable from the monorepo;
  org/licensing constraints on relocating the private repo (owner's call, outside my scope).
- **Two-mode-axis correctness** — the shared partitioner must handle *both* appearance
  (light/dark/hc → `color`) and viewport (desktop/mobile → fluid `font`) mode axes, since
  both drive per-mode directories (confirmed against NB's real Token Press output, `11 §4`).

## 7. Checklist for the repo-reviewing agent (validate against real Token Press source)

This doc assumes the handoff brief is accurate. **Confirm or refute each — these determine
whether B is feasible and how much effort it is:**

1. **Separability.** In `src/plugin/converters/*` and `exporter.ts`, do the converters
   operate on **plain fact objects** or directly on `figma.*` variable objects? (The brief
   says "Strategy pattern per token family + shared helpers" — verify they don't reach into
   the Figma API mid-conversion.) *This is the make-or-break question.*
2. **Purity / ES2018.** Are the formatters (`formatDimensionValue`, `formatDurationValue`,
   composite builders) free of `figma.*`, `node:*`, and network? Already ES2018?
3. **Preset surface.** Does the `ExportOptions` + preset logic (`applySDCompatPreset`,
   `presetFingerprint`, `detectActivePreset` in `ui.html`; `DEFAULT_OPTIONS` in `code.ts`)
   cleanly separate the *option values* from the *plugin UI*? The engine needs the option
   table + fingerprints, not the UI.
4. **Layout logic.** Where does the `shared/` + per-mode-directory decision live, and is it
   pure? (`docs/known-issues/SD-PER-MODE-MERGE.md` + the exporter.) Can it be lifted as-is?
5. **Type inference boundary.** Confirm `mapVariableTypeToDTCG` + `type-detection.ts` are
   *only* needed for the Figma→DTCG direction (they infer `$type` from FLOAT+scopes) and
   have **no** role the engine would need — so they stay Token-Press-side.
6. **Composite parity.** Do Token Press's typography/shadow/transition composite shapes
   match what `Prism3/engine/tree.ts` emits today? List any divergence (that's the drift the
   shared core must reconcile).
7. **Build/release.** Vite config, ES2018 target, `manifest.json`, clientStorage,
   community-release process — what has to move vs. stay for the plugin to keep shipping?
8. **Licensing/ownership** — any constraint on relocating the private repo into
   `adamforrester/*` or vendoring the shared half.

**Deliverable from that review:** a go/no-go on B, an effort estimate, and the exact module
boundary (which files/functions become `@prism3/tokens-export`).

## 8. Recommendation

Pursue **B** — extract a shared pure `@prism3/tokens-export` core. It is the only option
that makes the two DTCG definitions agree *by construction* rather than by vigilance, and
it's the natural extension of the monorepo's "one core, many surfaces" thesis (`09`). Gate
the export-contract build (Pillar 4) on this decision so the format code is authored in the
right place once. Do the repo-review (§7) next to convert this hypothesis into a plan.

---

## 9. Repo-review verdict (2026-07-03) — Option B is **yellow**; decide the shape first

A Token-Press-side agent ran §7 against **both** real repos. Verdicts:

- **§7.1 Separability — ✅ confirmed, cleaner than assumed.** Zero `figma.*` runtime calls in
  `converters/*`, `type-detection.ts`, `cache-manager.ts`, `validator.ts`, or the shaping half
  of `exporter.ts`; only `scanner.ts` touches Figma. *Caveat:* converters **type** against
  Figma ambient globals (declaration-only) — the shared package needs a small plain-interface
  boundary (~1 day).
- **§7.2 Purity/ES2018 — ✅.** The seam falls between `tree.ts` (generation, engine-side) and
  `formatDimensionValue`-style leaf formatting (→ shared core).
- **§7.3 Presets — ✅ with nuance.** Preset logic is DOM-coupled in `ui.html`; lift the
  fingerprints + `detectActivePreset`/`isSpecConformant` to pure fns (~½ day).
- **§7.4 Layout — pure, but shapes diverge (see §7.6).**
- **§7.5 Type inference — ✅ stays Token-Press-side** (Figma→DTCG only).
- **§7.6 Composite parity — ❌ REFUTED.** The load-bearing finding: the two outputs disagree
  *today* — dimensions/durations object (TP default) vs string (Prism3 always); multi-mode as
  per-mode files (TP) vs inline `$extensions.prism3.modes` (Prism3); brace aliases both sides
  (both off-spec); Prism3 emits `spring`/`strokeStyle` TP doesn't; `$extensions` `prism3.*` vs
  `figma.*`.
- **§7.7 Build/release — real, manageable.** Under B the plugin shell stays in its repo; only
  the shaping half publishes as `@prism3/tokens-export`.
- **§7.8 Licensing — owner call** (`VMLYR/token-forge`, private).

**The reviewer's central correction, adopted:** a shared core doesn't *force* agreement — it
*enables* it. **Pick the canonical shape before extracting**, else drift just moves from "two
codebases" to "one codebase with two configs."

### 9a. Shape decisions (proposed — owner to confirm; this is the gate on Pillar 4)

Most divergences dissolve once the shared core takes **normalized facts + options**, not
either side's native output. The core's input contract is a normalized
`collection × mode × token-facts`; each caller adapts *into* it.

| Decision | Proposed canonical | Rationale |
|---|---|---|
| Dimension / duration | **object** (`{value,unit}`, DTCG-spec); **string via SD preset** | Not a fork — it's the `dimensionFormat`/`durationFormat` option TP already has; the engine just hardcodes string today. Feed raw `{16,'px'}`; core formats per preset. |
| Multi-mode representation | **multi-file per-mode is the EXPORT; inline `modes` stays the engine's IR** | The engine's single tree feeds resolve-preview/ai-metadata/golden — keep it. The export core *unfolds* it to per-mode files (clean projection; every mode value is already present). TP is multi-file natively. Engine doesn't migrate; multi-file wins as the *artifact*. |
| Property-level aliases | **`$ref`** (spec), flatten-at-build fallback | Both sides emit brace today (both off-spec, both acknowledge it). Fix once in the core. |
| `$extensions` namespace | **pass-through, no opinion** | `prism3.*` and `figma.*` are provenance each caller owns; the core never rewrites them. |
| Engine-only types (`spring`, `strokeStyle`) | **core supports/passes through** | Engine is the richer producer; TP simply won't emit them (no Figma source). |

### 9b. Revised plan / effort (from the review)

Gate = the §9a decisions (a ~½-day call, not a spike). Then extract, ES2018-pure, no ambient
Figma types: (1) `@prism3/tokens-format` — leaf formatters + preset fingerprints (~3d);
(2) composite builders taking fact objects (~3d); (3) the multi-mode partitioner + file layout
in the chosen shape (~2d); (4) migrate TP's `exporter.ts` shaping → core, golden its ZIP
byte-for-byte (~3d); (5) migrate the engine's `emit-dtcg` serialization → core, golden
`tokens.json` (~3d). **≈ 2 weeks**, +1 if multi-mode ever has to migrate (it doesn't, per 9a).

**Standing guidance for Pillar 4 (both docs agree):** do **not** author `collections.ts` +
formatters engine-internal. Author them at the chosen shape boundary, in the extracted package
location — even if the package still lives inside this repo pre-move — so they're already in
the right module when B lands.
