# prism3-tokens

A design-tokens repository with two layers: a **legacy hand-built token set** and a
dependency-free **TypeScript generation engine** that reproduces it and generalizes to new
brands. The engine is the active surface; the hand-built layer is its regression target.

> This is a signpost. The durable state — status, decisions, architecture — lives in the
> docs linked below; this file points, it doesn't restate. For agent/contributor conventions
> read [`CLAUDE.md`](CLAUDE.md).

## Layout

| Path | What it is |
|---|---|
| [`Prism3/`](Prism3/) | The **generation engine** — a brand is a small validated input that expands into a full token tree, AI metadata, and platform outputs (DTCG + Figma). Start here for engine work. See [`Prism3/README.md`](Prism3/README.md). |
| [`Tokens/`](Tokens/) | The **legacy hand-built tokens** — Prism2 (`nbds.pds.*`) and New Balance, in two parallel formats (Figma variable export + DTCG). The engine's regression target, not a build output. |
| [`web/`](web/) | The **dashboard** — a browser host over the engine's shared lever/preview contracts. See [`web/README.md`](web/README.md). |

## Running the engine

No build, no `npm install` — the engine is self-contained TypeScript run via `tsx` (Node ≥ 20):

```bash
npx tsx Prism3/engine/test.ts            # unit tests — colour math + extreme-brand contracts + design.md/CLI
npx tsx Prism3/engine/nb-regression.ts   # regression: generated tokens vs the real New Balance set
npx tsx Prism3/engine/emit-dtcg.ts       # emit the DTCG token tree; validate every alias + mode contrast contract
npx tsx Prism3/engine/emit-figma.ts      # emit the Figma import artifact (out/figma/<brand>/)
```

The full command list (CLI, visualize, the `emit-*` contract writers) is in
[`Prism3/engine/README.md`](Prism3/engine/README.md).

## The gates (the correctness contract)

Validation here isn't a linter — it's a set of contracts every change must keep green before
merge. A PR states their results (see the [PR template](.github/pull_request_template.md)):

- **`test.ts`** — the unit suite (all passing).
- **`nb-regression.ts`** — the New Balance regression (exits non-zero on a new divergence; reports aggregate ΔE00).
- **`emit-dtcg.ts`** — every DTCG `{…}` alias resolves **and** every per-mode contrast contract passes.
- **`out/*` discipline** — regenerate outputs; a validation-only or metadata change leaves them byte-identical, and any intended change to `out/*` is part of the diff.

## Where to go next

- [`Prism3/docs/00-progress.md`](Prism3/docs/00-progress.md) — status, the decisions log, and prioritized next steps (read this for handoff).
- [`Prism3/docs/07-e2e-journey.md`](Prism3/docs/07-e2e-journey.md) — the designer ↔ developer ↔ agent pipeline and the portable-core architecture.
- [`Prism3/docs/10-figma-materialization.md`](Prism3/docs/10-figma-materialization.md) — the `emit-figma` contract (the Figma-target shape).
- [`Prism3/README.md`](Prism3/README.md) — the engine architecture spec + Theme Schema contract.
