# 17 — Consumption eval: does an agent given the MCP surface produce compliant output?

> The engine verifies *generation* exhaustively — contrast contracts, alias resolution,
> byte-regression, 248/248 mode contracts. It has had **no way to measure consumption**:
> given an agent the Prism3 MCP surface (`theme_brand` / `list_levers`, `engine/mcp.ts`),
> does it actually produce *compliant* UI? This file specs the harness that turns
> "MCP-first > screenshot-first" (docs/07 §15) and the four-layer-stack payoff from an
> assertion into a number. The steal is ds-brain's eval methodology (docs/13 §2): a rubric,
> an invented-*component* rate, contamination-controlled trials — adapted to tokens.

---

## 1. Why now

The MCP adapter shipped (#64, docs/08 §5) — the agent-facing surface exists, so it can be
tested. And the metric is **cheap** because the name contract is locked (docs/11
names-are-the-API): whether an agent invented a token is a mechanical set-membership check
against the generated tree, no LLM judge required. Build the eval alongside the surface it
tests, while the surface is fresh.

## 2. The scoring core — ✅ BUILT (`engine/eval.ts`)

**Pure, deterministic, no LLM, no `node:`.** Given the token refs an agent's output uses +
the generated tree, `scoreConsumption(refs, tree, root)` returns two metrics:

- **invented-token rate** — refs to token paths that don't exist in the tree (the
  hallucination metric). `refs` are normalised (`normalizeRef`) from brace (`{prism.color.…}`),
  root-qualified (`prism.color.…`), or relative (`color.…`) forms. Rate is occurrence-based;
  the reported `invented[]` list is unique + sorted.
- **primitive-leak rate** — valid refs that reach *past* the semantic layer into a raw
  primitive tier (`palette` / `dimension` / `font` — `PRIMITIVE_TIERS`, exactly the `core-*`
  grouping). A consumer should reach for `color.action.default`, not `palette.primary.600`.
  A *smell* rate, not a hard fail — primitives are occasionally legitimate.

Gated in `test.ts`: clean/invented/leak/normalise/occurrence-rate/empty cases.

## 3. The harness — DEFERRED (edge shell, next increment)

The agent-in-the-loop runner is an **edge shell** (uses the Claude API — an LLM host, never
the pure core; same split as the MCP stdio loop). Shape:

1. **Sample tasks** — a small fixed set of UI briefs ("a primary button + its states", "an
   alert per semantic", "a form field with error", "a card"). Data-only, brand-agnostic.
2. **Run** — for each task × brand, drive a model with *only* the MCP surface (`list_levers`
   to learn the knobs, `theme_brand` to get the tree) and ask it to emit component code /
   token bindings. **Contamination-controlled:** isolated runs, no cross-task memory, so a
   retrial isn't polluted (ds-brain's discipline).
3. **Extract** — pull the token refs out of the model's output (CSS custom properties /
   `{…}` aliases / role paths) → feed to `scoreConsumption`.
4. **Aggregate** — invented-rate + primitive-leak-rate per task/brand, plus the §4 metrics.

Because step 2 needs a model, the harness is opt-in (an API key), not part of the default
`test.ts` gate — the *scoring* is gated, the *runs* are a separate command.

## 4. Further metrics

- **Contract compliance — ✅ BUILT (`scoreContractCompliance`, `eval.ts`).** For the fg/bg colour
  pairs an agent pairs on screen (`UsedPair { fg, bg, kind }`), resolve both roles per mode
  (`resolveAllModes`) and check the **raw** contrast (CR-01) clears the kind's floor — text 4.5,
  `ui`/`large-text` 3 (WCAG 1.4.11 / 1.4.3-large). Returns `{ checked, pass, rate, failures[],
  unresolved[] }`: a pair fails if it's below floor in *any* mode where both roles resolve; a pair
  naming a non-colour role lands in `unresolved` rather than being scored; no pairs → vacuously
  compliant (rate 1). The `resolve-preview` contract math applied to *consumption* — the docs/04
  differentiator turned on the agent's output. Gated in `test.ts` (pass/fail/kind-floor/mixed/
  unresolved/empty). **Still to wire:** eliciting the pairs from the agent — the harness currently
  extracts a flat ref list; a `pairs` output mode (ask the agent which ink sits on which surface) is
  the next harness step, mirroring how `scoreConsumption` preceded `runEval`.
- **Rubric layer — DEFERRED.** Semantic-role vs primitive use (partly the leak rate),
  mode-correctness, did it honour `avoid_when` from the `.ai.json`. Checklist first; an LLM judge
  only if a dimension resists mechanical scoring.

## 5. Success shape — and the first measured run

A baseline number per (task, brand): invented-rate and primitive-leak-rate near 0, contract
compliance near 1. The eval's value is **differential** — run the same tasks with the MCP
surface vs. without (guess-the-names) and show the surface moves the numbers.

### First run (2026-07-04) — the differential holds

Two cold `general-purpose` subagents (fresh context, no repo access beyond what they were
handed) ran the four `SAMPLE_TASKS` against the `atlas` brand. Scored by `scoreConsumption`:

| Arm | Invented-token rate | Primitive-leak | Valid refs |
|---|---|---|---|
| **WITH** the token catalogue | **0%** | 0% | 53 / 53 |
| **WITHOUT** (must guess) | **48%** | 0% | 21 / 40 |

Given the catalogue the agent hallucinated **zero** token names and never reached into a
primitive tier. Without it, **~half** its references were invented — plausible-but-wrong names
(`color.feedback.success.surface`, `color.surface.raised`, `typography.heading.md`,
`focus.ring.color`) where Prism3's naming diverges from generic convention. Notably it guessed
the `color.action.*` states correctly *without* help — the invented rate concentrates exactly
where the system's names are non-obvious, which is where a token surface earns its keep. That is
"MCP-first > screenshot-first" (docs/07 §15) as a number: **48% → 0% hallucination**.

Caveat: WITHOUT-arm invention is partly *stacked* (asked to target a system whose catalogue it
was denied). The honest headline is the **elimination** the surface provides, not the 48% itself
— a stronger baseline (agent works from a rendered screenshot and emits CSS, then we map back)
is a later refinement. The harness (`eval-run.ts`) makes re-running either arm one call.

## 6. Dependency posture

Scoring (`eval.ts`) is pure + gateable + bundlable — own it. The agent run is an edge shell
(Claude API). Never let the LLM into the pure core; the eval is a *consumer* of the core's
output, scored by pure code. Fits docs/15 (pure core, hosts + LLMs at the edges).
