# 14 — The component layer: components as data, materialized without an LLM

> `07` §7 mapped the component library as downstream future work ("mapped now so
> upstream choices don't foreclose it"). This doc locks the **architectural shape** of
> that layer, answered from the owner's question (2026-07-03): *could we store
> components as data and build them in Figma on the fly — the way we already write
> Figma variables — without needing an LLM or MCP?* The answer is yes, and the
> mechanism is the same one the token layer already proved: **data source →
> deterministic emit → dumb materializer → extraction-diff regression**. Nothing here
> is built; this is the contract the build follows, captured with the same intent as
> `11` (survive context loss; every future thread aims at the same target).

---

## 1. The thesis — carry the engine's philosophy up one tier

The engine's whole posture is that agents are *optional consumers* of a verified
system, never its mechanism: a `BrandInput` compiles deterministically to tokens,
gates prove the output, and an LLM can drive the levers but is never required.
The component layer gets the identical posture:

- A **component definition is structured data** (KB 03 §6, Curtis's
  *Components as Data*; three external witnesses logged in `13`).
- **Figma component sets, code (WC + React), Storybook, and `.ai.json` are all
  outputs** generated from it — Figma is one target among many, never the source.
- The **write leg into Figma is deterministic** (a plugin executing an emitted
  artifact — exactly how variables are materialized), and the **verify leg is an
  extraction diff** (the component-tier `nb-regression`).
- Agents (MCP route, Figma MCP) remain available as the *agentic* alternative over
  the same artifacts — the `08` §5 two-route pattern, unchanged.

## 2. The source: component definitions bound to the locked name contract

**The definition format.** One data file per component (working shape:
`component.yaml`-style — final format is a build-time decision), carrying the KB's
anatomy vocabulary: `anatomy / props / default / variants` plus the intent layer
(`when_to_use`, `avoid_when`, slot contracts, a11y metadata). Two format
disciplines, both already proven elsewhere:

- **Type-checked, not freestanding** — the Astryx lesson (`13` §1): the definition
  validates against a schema at build time, so metadata drift is a gate failure,
  the same "can't drift" mechanism as the lever manifest and preview spec.
- **Conformant-or-mappable to public shapes, not forked** — the `design.md` posture.
  The reference schema to track is `@directededges/specs-schema` (Curtis's Specs
  CLI schema package: JSON Schema + TS types — `Component`, `Element`, `AnyProp`);
  our source will carry fields it can't (see §4), but the structural core should
  map cleanly.

**The binding insight — why this composes with the engine.** A component definition
binds its visual props to the **locked token names** (`11`): `color.action.default`,
`radius.md`, `space.100`, `font.label`. That makes the definition **brand- and
mode-invariant structure**; brands and modes are value-columns the engine already
supplies. Build the Button set *once* and every brand/mode materializes correctly,
because the bindings resolve through variables. This is a property none of the
reviewed external systems have (`13`): their specs capture *observed values*; ours
bind to a *verified contract*.

**The proto-layer already in the repo.** `preview.ts` is a miniature of exactly this
— 8 components / 22 variants as pure data, props bound to semantic token paths,
declared contrast contracts, rendered identically by three surfaces from one
definition. The component layer is the preview spec grown up; the format extends a
proven in-repo contract, not a greenfield invention.

**The seed corpus: the knowledge-base component briefs.** The KB carries **~40
per-component field-truth briefs** (`knowledge-base/components/`, web-primary, on a
locked 15-section spine), each ending in a **§15 agent-consumable schema** — a
formalised, key-order-locked YAML projection of the brief (`components/_schema.md`).
KB 30 defines the relationship we adopt verbatim: *the brief is upstream and
prescriptive; the engagement's data file is downstream and authoritative.* For
Prism3, component definitions are **instantiated from the §15 schemas** — anatomy,
props, states, a11y contracts arrive pre-researched against the leading systems,
then get bound to our token names. This is the payoff the KB investment was made
for: the Figma library and the code library built 1:1 and fast, from research
that already exists.

## 3. The write leg: deterministic materialization into Figma

**The API constraint (verified, KB round-trip research + docs/10):** the REST API
cannot create components — or any nodes. The **Plugin API can do all of it,
deterministically**: `createComponent()`, `combineAsVariants()`, component property
definitions, auto-layout, and `setBoundVariable()` binding fills / radii / spacing /
type atoms **to the variables `emit-figma` already writes**. No LLM anywhere — a
plugin mechanically executing a data file, which is precisely how variables get
into Figma today (Token Press pattern).

So the pipeline is:

```
component definitions (from KB §15 seeds, token-name-bound)
        │
        ▼
emit-figma grows a COMPONENT artifact        ← out/figma/<id>/components/…
  (structure, variants, property defs,
   auto-layout, variable bindings by name)
        │
        ├── route A (deterministic): the B2 plugin executes the artifact
        │     via the Plugin API — zero LLM, zero MCP
        └── route B (agentic): Figma MCP materializes the same artifact
              — the existing 08 §5 two-route pattern, unchanged
```

**Honest limit on "on the fly":** Plugin-API-only means materialization happens
inside a plugin run in an open file — not headless in CI. Route B exists for
agent-driven runs; route A is the production path.

**Figma's component ceilings** (the component-tier analogue of the `08` §5
variable-type ceiling — the artifact must respect them, same discipline):

- **Property types:** variant / boolean / text / instance-swap only. Anything
  richer stays in the data + code outputs.
- **Interactions:** reactions are partially scriptable; complex behaviour is
  code-only.
- **A11y contracts:** not representable in Figma at all — they live in the
  definition, the `.ai.json`, and the code outputs; Figma carries only the visual
  projection. (Curtis's own caveat, KB 03 §6 — data can't capture everything
  *in Figma*; the data still carries it for the other targets.)
- **Motion — ceiling revised (2026-07-03):** Figma Motion (Config 2026) added
  **timing/easing variables**, so the `05`/`10` disposition "transition =
  code-only" is stale — duration and easing can now bind as variables; the
  *composite* transition remains style/code-tier. Fold into the `emit-figma`
  motion axis when it lands. ⚠ The KB motion files (18–21) and 12-figma-practice
  predate this and need a KB-side update — flagged, not done here.

**The hard second-order problem: update-in-place.** Regenerating a component set
with fresh node IDs breaks stickiness for every file already consuming the library
— the same open question as variables (`03-open-questions` Item 9: update an
existing template preserving IDs vs build from scratch). The artifact eventually
needs a **keyed update strategy** (match by name/path, mutate in place, create only
the genuinely new). Create-from-scratch is the correct v1; keyed update is the
committed direction before real consumers exist.

## 4. The verify leg: extraction diff — where Specs CLI actually fits

**Specs CLI is extraction-only (verified against the repo, 2026-07-03).** Its
pipeline — `init` → `fetch` → `scan` → `generate` — reads a Figma file via the REST
API (PAT auth) and emits schema-valid YAML/MD specs *from* it. Scripted,
deterministic, **"0 AI tokens per component"** (vs ~25k for agentic extraction).
Its own workflow statement is "Update Figma → Generate specs → Agents refine →
Update component" — Figma stays the authoring surface. **There is no
build-Figma-from-specs direction**, so it cannot be the write leg. (This corrects
the ambiguous "produces or assists in producing Figma component sets" reading in
KB 15 — the KB's own "verify the current scope at the repo" caveat did its job.)

Its real seat in our pipeline is the **read-back verifier**:

```
materialize (route A/B) → Specs CLI extracts specs from the resulting file
                        → diff extracted structure vs our source definition
                        = the component-tier nb-regression
```

A deterministic, zero-LLM round-trip gate, matching the engine's existing
discipline (the token layer's byte-reproduction of `fixtures/figma/nb`). Two
sharpenings:

- **The diff compares the structural projection only.** Our source is richer than
  any extract can be — `when_to_use` / `avoid_when` / a11y contracts / slot
  intent don't render in Figma, so they can't come back out. The gate covers
  anatomy, variants, properties, bindings; the intent layer is validated by the
  schema check at the source instead.
- **Alternative:** a thin reader of our own over the same REST surface, if Specs
  CLI's manifest shape fights ours. Decide at build time; either way the *pattern*
  (extract → diff) is the commitment, the tool is fungible. Specs CLI's maturity
  (recent, evolving — KB 15) is acceptable for an internal gate in a way it might
  not be for a client deliverable.

## 5. Verification & evals (the gates this layer ships with)

Same posture as every engine axis — define verifiable success before building:

1. **Schema gate** — every component definition validates; every token-name binding
   resolves to a real leaf in the emitted tree (the preview-spec binding-validity
   gate, generalized).
2. **Contrast gate** — every definition's declared contract pairs hold on resolved
   colours in all modes (resolve-preview's gate, generalized).
3. **Round-trip gate** — materialize → extract → diff (§4). Structural equality on
   anatomy/variants/props/bindings.
4. **Consumption evals** — the `13` §2 steal: rubric-scored agent output over the
   layer, an **invented-name rate** (components *and* tokens — mechanically
   checkable against the locked contract), contamination-isolated re-runs. Built
   alongside the MCP adapter, not after it.

## 6. Build sequence sketch (when this layer activates)

Deliberately small first increment, mirroring how every engine axis landed:

1. **Format decision + schema** — define the component-definition schema (seeded
   from the KB §15 shape, mapped against `@directededges/specs-schema`), type-checked
   in `test.ts`. The format decision is the week-1 decision (KB 30).
2. **Three components, not forty** — Button, Text Field, Card (the calibration
   briefs; already the preview spec's core). Instantiate from their §15 schemas,
   bind to token names.
3. **`emit-figma` component artifact** for those three — respecting the §3 ceilings.
4. **Materialize** via route B first (MCP — no plugin exists yet; same way the
   colour/typography axes were spiked), then route A when the B2 plugin lands.
5. **Extraction-diff gate** (§4) closes the loop; then scale across the corpus.
6. Code outputs (WC + React + Storybook + `.ai.json` + Code Connect) follow the
   same definitions — the `07` §7 mapped shape, now with its Figma leg proven.

---

*Cross-refs: `07` §7 (the layer's place in the E2E journey), `08` §5 (two-route
materialization + ceilings discipline), `10` (emit-figma contract this extends),
`11` (the locked name contract that makes definitions brand-portable), `13`
(inspirations: Astryx typed-doc lesson, ds-brain evals, Specs CLI verification).
KB: 03 §6 (components-as-data), 29/30 (docs-from-data + the brief→data-file
relationship), `components/` + `_schema.md` (the ~40-brief seed corpus), 15 (Specs
CLI + AI context architecture).*
