# 13 — Inspirations: field notes on agent-first design systems

> A running review of external systems and practitioner maps that overlap with what
> Prism3 is building — logged so each review's *takeaways* survive context loss and
> feed the build (the component layer, the agent surfaces, the MCP adapter) rather
> than staying chat ephemera. Each entry: what it is, what we take from it, where we
> are already ahead. Convergences across entries get promoted to the summary table
> at the end. **Nothing here is a commitment; steals become commitments when they
> land in `00-progress` as decisions.**

---

## 1. Astryx — Meta's agent-first design system (reviewed 2026-07-03)

**What it is.** Meta's open-source design system (React + StyleX, `astryx.atmeta.com`).
"Agent-first" means something specific and narrower than our four-layer stack: **the
CLI is the agent interface**. Agents don't get docs bulk-loaded into context; they
retrieve on demand:

- `npx astryx search button` — ranked search across components/hooks/templates, every
  result carrying the follow-up command to run next.
- `npx astryx component Button` — the component's docs; `--compact` emits a
  token-budget-optimized rendering for LLMs; `--source` returns the implementation.
- `npx astryx agent-docs` — injects a *compressed component index* into the project's
  agent files (CLAUDE.md and equivalents), so an agent learns that the CLI exists and
  browses from there instead of guessing.

**Component docs are typed data, co-located with the component.** Each component ships
a `{Name}.doc.mjs` exporting a `ComponentDoc` object — description, features, props
(name/type/default/required), runnable examples, theming targets + CSS vars,
accessibility notes, keyboard interaction. This explicitly *replaced* per-component
README.md. A registry (`ComponentEntry`) built from these files drives the docsite
nav, search, playground defaults, and the CLI output — one source, multiple
projections. That is the KB's components-as-data thesis (KB 30: "the component data
file is the source of truth") shipping in production at Meta scale — strong external
validation of the direction `07-e2e-journey` §7 maps for our component layer.

**What we take:**

1. **Typed doc objects, compiler-checked.** The doc file carries a `ComponentDoc`
   type (JSDoc `@type` annotation), so metadata drift is a build error — the same
   "can't drift" philosophy as our lever-manifest / preview-spec gates, applied to
   component metadata. When our component layer lands, the per-component data file
   should be type-checked against a schema the same way, not freestanding JSON.
2. **CLI-as-agent-surface is a cheaper peer to MCP.** A plain CLI works in any agent
   harness with a shell — zero server, zero auth. We already have `cli.ts` for
   theming; a `query` subcommand over the `.ai.json` sidecar is a small step and
   would give the sidecar a retrieval surface before the MCP adapter exists.
3. **The `agent-docs` injection pattern.** A generated, compressed index dropped into
   the consuming project's agent files is the *discovery* layer our `.ai.json`
   currently lacks — the sidecar is only useful to an agent that knows it exists.
4. **`--compact` as a first-class flag.** Explicit token-budget tiers of the same
   metadata (index → summary → full entry). `.ai.json` should think in tiers too.
5. *(Footnote)* Astryx runs an agent-based conformance auditor ("Night Watch")
   enforcing tokens-only styling — agent-as-CI-gate rather than lint rules.

**Where we're ahead — their gaps confirm the engine's POV:**

- **Theming is hand-authored and unverified.** `defineTheme({ tokens:
  { '--color-accent': ['#0077B6', '#48CAE4'] } })` — the consumer supplies light/dark
  hexes themselves. No generation, no ramps, no contrast contracts, no HC modes.
  Prism3's generate-and-verify engine (248/248 contrast contracts, four modes) is a
  different class of thing; Astryx has nothing like it.
- **Their metadata schema is intent-poor.** No `avoid_when`, no `business_context`,
  no relationships graph (`alternativeTo`, `composesWith`) — the fields KB 29/30
  argue are the highest-value authored layer. Theirs is a props-table-plus; ours is
  a decision surface.
- **No Figma story found** — no Code Connect, no variables sync. Single-framework
  (React/StyleX only), so they never face the WC + React problem that motivates our
  neutral-source component definition.

## 2. "ds-brain" — a practitioner's DS × AI stack map (Reddit, r/DesignSystems, reviewed 2026-07-03)

**What it is.** A practitioner's architecture diagram (drawn *before* building, then
iterated) for an AI-powered design system. Three horizontal layers — **DS** (Figma UI
Kit ↔ Component library, with a central **"DS Brain — documentation package (.md +
metadata)"** and Storybook off to the side), **AI Enablement** (an "AI
Context/Guidance" block — structured knowledge for AI: components, props, patterns,
rules, examples, best practices — plus Cursor rules/skills), and **Work** (the
outputs: normal Figma designs, AI-powered static Figma prototypes, AI-generated UI
in IDE/Cursor, AI-powered interactive coded prototypes). The stated bets:

- The **brain sits in the middle** — not Storybook, not the component source files.
- **Maintain docs once** — skills, rules, indexes, and Storybook fragments all fall
  out of a *generator* over the brain.
- **Storybook is a consumer of the brain**, not the other way around.
- The IDE/Cursor path is where they've shipped and measured most; **AI inside Figma
  "still needs love — MCP? CLI?"** (an open frontier for them).
- **They measure**: outputs scored against a rubric; counting when agents *invent
  components that don't exist*; trials run in isolated environments so experiments
  don't contaminate retrials.
- The closing thesis: *"Don't start with the AI box. Start with the documentation
  package. Everything else is plumbing."*

**What we take:**

1. **The eval harness is the genuinely new idea for us.** Rubric-scored agent
   outputs, an *invented-component rate* (the component-tier hallucination metric —
   ours would add an invented-token rate), and contamination-controlled trials.
   Prism3 verifies *generation* exhaustively (contrast contracts, alias resolution,
   byte-regression) but has **no methodology for measuring agent *consumption*** —
   "did an agent given our `.ai.json` / MCP surface produce compliant UI?". When the
   component layer / MCP adapter lands, build the eval alongside it: a rubric, an
   invented-name counter (checkable mechanically against the locked name contract —
   `11`'s names-are-the-API makes this cheap), and isolated re-runs.
2. **"Everything falls out of a generator" now has three independent witnesses** —
   this map (brain → skills/rules/indexes/Storybook fragments), Astryx
   (`agent-docs` injection + registry projections), and our own engine (one
   `BrandInput` → every artifact). The per-harness *discovery* artifacts (Cursor
   rules, skills, CLAUDE.md indexes) are themselves generated projections — that's
   the same steal as Astryx #3, now a confirmed pattern, not one system's habit.
3. **The sequencing lesson matches ours.** "Don't start with the AI box; start with
   the documentation package" is the consumption-side restatement of our build
   order (token layer verified first, agent surfaces after). Comforting, and
   quotable for the KB's commercial argument.

**Where we're ahead / what the map is missing:**

- **No generation layer.** The diagram assumes the DS exists and the brain documents
  it. Prism3 sits *upstream*: the engine generates the system the brain would
  describe. Their stack starts where our layer 1 ends — the maps compose rather
  than compete.
- **Docs-as-source is the third position in the source-of-truth debate** — code-first
  (Astryx: typed doc objects beside the implementation), data-first (KB 30 /
  Spectrum / our component-layer plan: neutral definition, everything projects), and
  now docs-first (`.md` + metadata as the brain, even component source downstream in
  spirit). Docs-first has a drift problem the map doesn't answer: what keeps the
  brain true to the shipped component source? (KB 30's freshness-hash CI is our
  answer; the brain diagram has no equivalent.) Our data-first position stands.
- **"AI inside Figma still needs love"** — the frontier they're stuck on is the one
  we're actively building (`emit-figma` + the MCP materialization route, `10`).
  Single-brand, too: no white-label / multi-brand dimension anywhere in the map.

## 3. Specs CLI — DirectedEdges (Nathan Curtis), verified 2026-07-03

**What it is.** The public tool operationalizing the components-as-data POV
(github.com/DirectedEdges/specs; KB GLOSSARY + 15). Reviewed here to answer the
owner's question: could it be leveraged to *build* components in Figma from data,
LLM-free? **Verified against the repo: it is extraction-only.** `init` → `fetch` →
`scan` → `generate` reads a Figma file via the REST API (PAT auth) and emits
schema-valid YAML/MD specs *from* it; its stated workflow is "Update Figma →
Generate specs → Agents refine → Update component." There is no
build-Figma-from-specs direction. Its virtue is determinism: scripted, **"0 AI
tokens per component"** (vs ~25k for agentic extraction).

**What we take:**

1. **The read-back-verifier seat.** Extraction-diff as the component-tier
   regression gate: materialize components from our data → extract specs from the
   resulting file → diff against the source. Deterministic, zero-LLM round-trip —
   the `nb-regression` pattern at the component tier. Full contract in `14` §4.
2. **`@directededges/specs-schema` as the reference schema** (JSON Schema + TS
   types — `Component`, `Element`, `AnyProp`): the shape to stay
   conformant-or-mappable to, same follow-don't-fork posture as `design.md`.
3. **The correction itself is the finding** — KB 15's "produces (or assists in
   producing) Figma component sets" read was optimistic; its own "verify the
   current scope at the repo" caveat did its job. KB-side correction flagged.

**Where we're ahead:** the write leg. Specs CLI's world keeps Figma as the
authoring surface; ours makes Figma an *output* — the deterministic
data→plugin materialization (`14` §3) is the direction it doesn't have.

---

## 4. Convergences so far (updated as entries land)

| Pattern | Witnesses | Status in Prism3 |
|---|---|---|
| Component metadata as structured data, one source → many projections | Astryx (`.doc.mjs` → registry/CLI/docsite), ds-brain (brain → skills/rules/fragments), KB 30 | Planned — component layer (`07` §7); engine already does this at the token tier |
| Generated per-harness discovery artifacts (agent-file index, Cursor rules, skills) | Astryx `agent-docs`, ds-brain generated outputs | **Gap** — `.ai.json` has no discovery layer; steal when agent surfaces land |
| Retrieval-first agent access (search → fetch-on-demand, compact tiers) | Astryx CLI; ds-brain "AI index" | **Gap** — candidate `cli.ts query` subcommand; MCP adapter tool schema later |
| Metadata that cannot drift (type-checked / CI-enforced) | Astryx typed `ComponentDoc`; KB 30 freshness hash | Engine gates prove the philosophy at the token tier; carry into the component layer |
| Consumption-side evals (rubric, invented-name rate, isolated trials) | ds-brain | **Gap** — nothing measures agent consumption; build alongside the MCP adapter |
| Deterministic zero-LLM tooling as the differentiator over agentic equivalents | Specs CLI ("0 AI tokens" extraction), our engine + planned plugin write leg | Core posture — `14` extends it to the component tier (write leg ours, verify leg Specs-CLI-shaped) |
| Verified *generation* (contrast contracts, regression, modes) | — none reviewed has it | **Prism3's differentiator holds** |
| Figma as the underserved agent surface | ds-brain (open question), Astryx (absent) | Actively building — `emit-figma` (`10`), MCP materialization route |
