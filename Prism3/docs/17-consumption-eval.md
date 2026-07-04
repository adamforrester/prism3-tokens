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

## 4. Deferred metrics (add with the harness)

- **Contract compliance** — for the fg/bg token pairs the agent's output actually pairs
  (e.g. a text role on a surface role), resolve both per mode and check the contrast clears
  the pair's implied floor. This reuses `resolve-preview`'s contract math; the open design
  question is inferring the *expected min* for an agent-chosen pair (text→4.5, non-text→3,
  large-text→3) — likely a small classifier over the role names.
- **Rubric layer** — semantic-role vs primitive use (partly the leak rate), mode-correctness,
  did it honour `avoid_when` from the `.ai.json`. Checklist first; an LLM judge only if a
  dimension resists mechanical scoring.

## 5. Success shape

A baseline number per (task, brand): invented-rate and primitive-leak-rate near 0, contract
compliance near 1. The eval's value is **differential** — run the same tasks with the MCP
surface vs. without (screenshot / raw-hex only) and show the surface moves the numbers. That
is the four-layer-stack thesis, measured.

## 6. Dependency posture

Scoring (`eval.ts`) is pure + gateable + bundlable — own it. The agent run is an edge shell
(Claude API). Never let the LLM into the pure core; the eval is a *consumer* of the core's
output, scored by pure code. Fits docs/15 (pure core, hosts + LLMs at the edges).
