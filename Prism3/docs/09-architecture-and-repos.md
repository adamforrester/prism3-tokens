# 09 — Platform architecture & repo strategy (how the pieces are packaged)

> `07` argues *why* the engine is a portable core; `08` maps the *surfaces* that drive
> it. This doc answers the packaging question those two raise but don't settle: **which
> code lives in which repo, how the web dashboard and Figma plugin both consume one
> engine, and which of the owner's existing plugins get absorbed, kept downstream, or
> left alone.** It records the locked repo/packaging decision so the host-renderer work
> (`08 §7` B1c/B2/B3) starts from a settled shape instead of an implicit one.

---

## 1. The decision, up front

**Locked (2026-07-02, owner):**

1. **One engine, two rendering hosts.** The web dashboard and the Figma plugin are
   **two adapters over one core** — they import the same engine module and render from the
   same shared contracts (lever manifest + preview spec + `resolvePreview`). Not two
   products; two faces (`08 §1`). This is already ~40% true: the core is pure/`node:`-free,
   and B0/B1a/B1b built the shared contracts both hosts read from.
2. **Monorepo, grown from `prism3-tokens`.** The engine, the web dashboard, and the Figma
   plugin live as packages in **this repo** (not a fresh `prism3-platform` repo, not three
   published repos). The core becomes a workspace package both hosts import; a lever change
   lands everywhere in one commit. `brand-skills` and `knowledge-base` stay their own repos
   (upstream *extract* + reference; different lifecycles, brand-skills is separately
   versioned and public).
3. **Web dashboard first.** Fastest loop (DOM/CSS, no sandbox/font/variable-API
   constraints) and the cleanest proof that the shared contracts drive a real UI. The
   Figma plugin then becomes "the same renderer wearing a Figma face," not a first-of-its-
   kind build.

*Reassess trigger for (2):* if the monorepo's build tooling collides with the legacy
`Tokens/` corpus or the space-containing working paths, splitting the engine into a fresh
repo is cheaper later than merging repos would be now — so we start here and revisit only
if it hurts.

## 2. The layered architecture

```
Layer 0  PURE CORE            color · ramp · scale · modes · theme
         (no I/O, no node:)   ── runs identically in node, browser, Figma sandbox
                │
Layer 1  SHARED CONTRACTS     lever-manifest · preview-spec · resolve-preview
         (define once)        ── every surface renders FROM these; continuity is
                │                structural (both hosts read one source), not a manual sync
                │
Layer 2  ADAPTERS      ┌────────────┬──────────────┬───────────────┬──────────┐
         (thin)        CLI ✅       Web dashboard   Figma plugin     MCP server
                       design.md    knobs+preview   knobs+preview    tool calls
                │                        │               │
Layer 3  MATERIALIZE                DOM/CSS vars   Figma vars+styles   DTCG/SD · code
```

The load-bearing rule: **adapters never re-implement the brain.** Every historical pain
point (plugin missing engine options, namespace breakage, hand-mapped font weights) is a
symptom of a *second* brain; one core dissolves them (`07 §5`). The `node:`-free purity of
Layer 0 is the precondition — it's what lets the same module bundle into a browser and a
Figma sandbox with no port.

## 3. Repo & package layout

```
prism3-tokens/                     (this repo — grows into the monorepo)
├── Tokens/                        legacy hand-built layer + regression target (unchanged)
├── Prism3/
│   ├── engine/                    → the core, promoted to a workspace package
│   ├── schema/                    lever-manifest.json · preview-spec.json · theme-schema.json
│   └── docs/
├── web/                           NEW — the dashboard adapter (DOM/CSS host)
└── figma-plugin/                  NEW — the plugin adapter (Figma sandbox host)

brand-skills/      own repo — EXTRACT (assets → design.md)   [upstream, public]
knowledge-base/    own repo — the practice POV / reference    [reference]
```

**Build boundary.** The "no build, run via `tsx`" invariant applies to the **core's dev
loop** and stays intact. The **adapters** (`web/`, `figma-plugin/`) get a bundler for the
first time — a browser/Figma bundle is a packaging step, not a port (`08 §2`). Keep the
bundler at the adapter layer; the core is imported as source, never pre-built.

## 4. The owner's other tools: absorb / downstream / leave alone

The owner built several pipeline tools (`07 §11.1`). They do **not** all get pulled in —
they split by role:

| Tool | Function | Disposition | Trigger |
|---|---|---|---|
| **Theming plugin** (Figma) | themes a duplicated file's variables | **Absorb** into the new Prism3 plugin (B2) | when B2 reaches variable-theming parity |
| **Text-style plugin** (Figma) | binds variables into text styles | **Absorb** into B2 | when B2 binds text styles |
| **Style-guide generator** (Figma) | lays out **all tokens as frames on the Figma canvas** — canvas documentation, *not* HTML | **Absorb as a B2 feature** (a distinct canvas-render capability; the `visualize.ts` HTML preview does **not** cover it) | when B2 can render token frames to canvas |
| **Token Press** (Figma; private, **different org**) | Figma → Style Dictionary / DTCG export | **Downstream, contract-connected** — consumes engine DTCG output; never shared code | after materialization works (Figma-MCP import unblocks testing it) |
| **CLI templating system** | dupes component library, drops tokens/fonts → SD → Storybook | **Downstream consumer** via DTCG/SD | Layer-D component-library stage |

Two principles behind the split:

- **Absorb function, never code.** The three Figma plugins each carry a *separate brain* —
  pulling their source in re-creates the drift we're eliminating. Rebuild their capability
  on the shared core inside B2. The consolidation is real: **three Figma plugins collapse
  into one** (`07 §5`).
- **Connect downstream tools through the interchange contract, not the codebase.** Token
  Press (different org) and the CLI templating system sit at the export/consume ends; they
  read the engine's DTCG output. Integration = format conformance, not a merge.

## 5. Sequencing & triggers

1. **Record this** (done — this doc + `00-progress`).
2. **Scaffold the monorepo workspace + `web/` package** — **✅ DONE (2026-07-02).** Root
   `package.json` (workspaces `["web"]`, `type: module` — safe, the engine is already fully
   ESM); `web/` is an esbuild + vanilla-DOM adapter (one dev-dependency; no framework) that
   imports the pure engine modules by relative path and renders **15 knobs from the lever
   manifest + 22 preview chips + a 4-mode contrast overlay from `resolvePreview`**. Verified
   by headless Chromium: boots all-green. The engine stays buildless; only the adapter bundles.
   New I/O shell `engine/emit-brandinput.ts` → `schema/example-brands.json` gives the browser a
   **validated** boot brand without the node-only `design.md` parser (a `test.ts` gate keeps it
   current + asserts every example resolves all-green; 218/218).
3. **B1c/B3 — web dashboard host (in progress)**: knobs render (read-only) + preview + overlay
   are live. **Next:** wire the knobs to mutate the `BrandInput` and re-resolve (the real
   interactive loop); resolve geometry/type bindings from the token tree (needs a pure tree
   accessor in the core); promote the engine to a named `@prism3/engine` workspace package.
4. **B2 — Figma plugin host**: same renderer, Figma face; begins absorbing the three Figma
   plugins (variables → text styles → canvas style-guide, in that order of parity).
5. **C — MCP adapter**: tool schema derived from the same lever manifest.

**Parallel, no new repo (start anytime):**
- **Figma-MCP import** of `out/*.tokens.json` — de-risks B2's materialization before it's
  built and unblocks Token Press testing. Highest-value near-term validation.
- **Style Dictionary consumption** — proves the export edge (owner-driven).
