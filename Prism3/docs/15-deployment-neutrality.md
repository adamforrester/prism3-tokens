# 15 — Deployment-target neutrality (pure core, hosts and LLMs at the edges)

> The engine so far assumes no deployment target on purpose. The owner has named a likely
> one: an **E2E solution hosted on AWS / Bedrock**, using **LLMs as needed** — but with the
> **core staying pure, deterministic code**. This doc records that as an architectural
> *constraint*, not a build task: how to keep everything we make deployable to *any* host
> (browser, Figma plugin, AWS service) and *any* assistive-LLM arrangement, without a single
> hosting or model assumption leaking into the core. It exists so the constraint survives a
> context clear and every surface keeps aiming at a portable target. **Nothing here is a
> feature to build; it's the line to hold while building everything else.**

---

## 1. The load-bearing rule — three layers, and the middle one is pure

Everything we ship sorts into exactly three layers, and the value of the whole thing depends
on keeping them from bleeding into each other:

1. **Pure core** — `theme` / `ramp` / `color` / `modes` / `tree` / `design-md` / `levers` /
   `preview` / `resolve-preview`. Deterministic, dependency-free, `node:`-free. Given the same
   `BrandInput` it produces the same tokens, byte-for-byte, forever. **No I/O, no state, no
   network, no model calls.** This is the asset.
2. **Assistive LLM layer (edge)** — anything an LLM helps with: turning a brand brief into a
   `BrandInput`, suggesting a palette, drafting `design.md` prose, explaining a contrast
   failure. LLMs *propose inputs to* the core and *narrate outputs from* it — they never sit
   *inside* the deterministic path. A model's output is always fed back through the pure core,
   which is what makes the result reproducible and auditable.
3. **Host + state layer (edge)** — where it runs and what it remembers: the browser bundle
   today; an AWS service tomorrow; persistence, auth, multi-tenancy, secrets, transport. This
   layer *wraps* the core; it does not reach into it.

The core never knows which host invoked it or whether an LLM authored its input. That
ignorance is the portability.

## 2. Why AWS / Bedrock changes nothing structural

A host is a host. The browser is one; the Figma plugin is another; an AWS Lambda / Fargate /
Bedrock-fronted API is the next — each is an **I/O shell** wrapping the same untouched core,
exactly like `cli` / `emit-dtcg` / `emit-figma` already are (`09`). We deliberately refused to
bet on a deployment target; AWS being on the table is the bet *paying off*, not a redirection.

What is genuinely **new** — and additive, living entirely in layer 3:

- **Persistence + multi-tenancy + auth.** Brands, versions, engagements stored (DB / S3) and
  served to many clients. Real new surface, but it wraps the core — the core stays a pure
  function; the AWS layer owns storage, tenancy, secrets, access. This is the delivery
  mechanism for the "enterprise clients at scale" north star already written in `11`.

What does **not** change: the `§9a` shape decisions (`12`) — DTCG is DTCG whether it exits as a
browser blob-download or an S3 presigned URL — the purity gates, the format contract, the NB
regression. None of it is host-coupled.

## 3. LLMs as needed — assistive, never in the deterministic path

"Utilize LLMs as needed but the core is pure coding" (owner) is the sharpest version of the
layer-1/layer-2 split, and it is a **correctness stance**, not just an architecture preference:

- **LLMs at the input edge** — brief → `BrandInput`, "make me a warmer neutral," image →
  seed palette. The model's job is to *fill the input form*; the deterministic engine then
  generates. Two identical `BrandInput`s always yield identical tokens regardless of which
  model (or human) produced them.
- **LLMs at the output edge** — narrate a diff, explain why `dark` failed a contrast contract,
  draft `design.md` prose around the generated facts. The tokens are already fixed; the model
  describes, it does not compute them.
- **Never in the middle.** A ramp step, a contrast ratio, a mode override, an alias resolution
  is *never* an LLM call. Those are math and must stay math — reproducible, testable, and gated
  (`test.ts` + NB regression). The moment a token *value* depends on a model call, the audit
  trail and the "names are the contract" guarantee (`11`) break.

Bedrock is simply the managed way to run layer 2 next to layer 3 — the same assistive role,
hosted. It earns its place at the edges; it does not enter the core.

## 4. The two decisions this eventually forces (both deferrable)

1. **Generation: client or server?** Today web/ runs the core in the browser. Hosted, we'll
   likely want *both* — interactive preview stays client-side (no round-trip per knob turn);
   *authoritative* generation + export moves server-side (one source of truth, persistence,
   secrets). The portable core makes this a call site choice, not a migration: same code, two
   hosts. No need to pick now.
2. **A third option for the export core (`12`).** An AWS backend means the shared export core
   could live **server-side as a service** that Token Press *calls*, rather than a package it
   *vendors*. That's strictly better for "one producer of truth" — but it only exists if the
   backend exists. Another reason not to force the Token Press vendoring decision today: the
   best answer may be "call the hosted core," unknowable until the AWS path is real. Authoring
   Pillar 4 as a clean standalone module (already the plan) is exactly what keeps it deployable
   as *either* a package *or* a service.

## 5. The one discipline to hold now

Keep persistence, auth, transport, and model calls **outside** the core; keep the export core
a standalone module with **no host assumptions**. We already do both (the browser bundle
enforces the first — the I/O shells don't bundle; `web/README.md`). The single failure mode to
guard is **leakage**: a DB call, an env secret, a Bedrock invocation, or a Lambda-ism creeping
into a layer-1 module. If that line holds, the AWS decision — whenever it firms up — costs a
new shell and a storage layer, not an architecture change.

Concretely, when reviewing any engine PR from here on, one extra check: *does this add I/O,
state, or a model call to a pure module?* If yes, it belongs in a shell, not the core.
