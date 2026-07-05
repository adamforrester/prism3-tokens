# 18 — Figma plugin & host architecture (what's shareable, and what the plugin can/can't do)

> `08` locks the *decision* (one shared control layer, the lever manifest is the seam) and
> names the two materialization routes; `10` is the emit contract; `14` is the component
> layer. This doc is the **capability grounding**: exactly how a Figma plugin executes, what
> its API can and cannot do, and how that maps onto Prism3's hosts — so when the plugin build
> starts we're precise about which code is shared and which is adapter-specific. Sourced from
> the current Figma Plugin API docs (developers.figma.com/docs/plugins, fetched 2026-07-05).

---

## 1. How a plugin executes — two contexts, and the split is load-bearing

A Figma plugin runs in **two separate JavaScript contexts that cannot touch each other's
capabilities**. This split *is* the architecture — it decides where each layer of our stack runs.

| | **Main thread (sandbox)** | **UI iframe** (`figma.showUI`) |
|---|---|---|
| Figma document (`figma.*`, canvas, variables, nodes) | ✅ **only here** | ❌ none |
| DOM / rendering | ❌ | ✅ |
| Network (`fetch`/`XHR`) | ❌ **cannot** | ✅ (gated by manifest) |
| `setTimeout`/`setInterval` | ❌ | ✅ |
| JS runtime | minimal (QuickJS-class): ES2020+, `Array/Object/Map/Set/Promise/Proxy/Reflect/JSON/Math/Date/RegExp/structuredClone` | full browser |

They communicate by **message passing only**: main → UI via `figma.ui.postMessage(msg)`; UI → main
via `parent.postMessage({ pluginMessage: msg }, '*')`, received on `figma.ui.onmessage`. Because the
main thread has **no network**, the canonical pattern is: *the UI iframe does any network, then
postMessages results to the main thread, which touches the document.*

**Why this matters for us:** our engine core is pure (no `node:`, no DOM, no network), so it can run
in **either** context. The clean split:

- **UI iframe** runs the **shared control UI + the engine core + the live preview** — literally the
  same code as the web dashboard (an iframe is just HTML/JS). It computes the token tree from the
  `BrandInput` and renders a DOM/CSS preview, exactly as the web host does.
- **Main thread** is a **thin Figma-write adapter** (plugin-only): it receives the resolved tree over
  postMessage and writes `figma.variables` / modes / styles / component nodes.

So the "render adapter" split from `08 §3` lands exactly on the thread boundary: everything above the
write step is shared with the web host; only the main-thread writer is plugin-specific.

## 2. The manifest (the plugin's contract)

Key fields (developers.figma.com/docs/plugins/manifest):

- **`main`** / **`ui`** — the sandbox code file / the iframe HTML.
- **`editorType`** — array of `"figma"` | `"figjam"` | `"dev"` | `"slides"` | `"buzz"` (note: `figjam` +
  `dev` together are unsupported). We target `"figma"` (and likely `"dev"` for a read/inspect surface).
- **`documentAccess: "dynamic-page"`** — **required for new plugins**. It's why the document getters are
  **async** (`getLocalVariableCollectionsAsync`, `getVariableByIdAsync`, …) — pages load on demand.
- **`networkAccess`** — `{ allowedDomains: [...] , reasoning, devAllowedDomains }`. `allowedDomains` is
  required (`"none"` / `"*"` / wildcards / explicit URLs); `"*"` or localhost needs `reasoning`. An
  unlisted request gets a CSP error. **Prism3 needs none of this at runtime** — the engine is bundled
  in, no server call — so we can ship `allowedDomains: ["none"]`, a real trust/reliability win.
- **`permissions`** — `currentuser` / `activeusers` / `fileusers` / `payments` / `teamlibrary`.
- **`capabilities`** — `textreview` / `codegen` / `inspect` / `vscode` (codegen/inspect = Dev-Mode surfaces).

## 3. What the plugin API can write — and what it can't

**Variables** (the v1 theming path — reliable today):
`figma.variables.createVariableCollection(name)` → `createVariable(name, collection, type)` where type ∈
`STRING | FLOAT | COLOR | BOOLEAN`; `collection.addMode(name)` + `variable.setValueForMode(modeId, value)`
for light/dark/HC; `createVariableAlias(variable)` for the semantic→primitive links; bind to nodes via
`node.setBoundVariable(field, v)` (simple) or `figma.variables.setBoundVariableForPaint/Effect/LayoutGrid`
(fills/effects/grids). Cross-file library values load via `importVariableByKeyAsync(key)`. Gotchas: getters
are **async**; fills/strokes/effects are **immutable arrays** (clone → mutate → reassign); the variable type
must match the bound field. This is precisely the shape `emit-figma` already targets (`10`).

**Components** (the component layer — `14`): `figma.createComponent()`, `figma.combineAsVariants(nodes,
parent)` → a `ComponentSet`, `addComponentProperty(name, type, default)` where type ∈ `BOOLEAN | TEXT |
INSTANCE_SWAP | VARIANT | **SLOT**`, `createInstance()`, `instance.setProperties({...})`. The **`SLOT`**
property type is the direct Figma expression of the KB `§15` slot contracts (`required_content` /
`optional_content`) — worth noting, it's newer than most plugin code assumes.

**What the API cannot express** (the real boundary — this is the "lossy" line, precisely):
- **Behaviour / interaction logic** — a working focus trap, arrow-key menu nav, a state machine. Figma has
  prototyping, not logic.
- **Accessibility semantics** — ARIA roles, names, live regions, the keyboard contract. Figma has no a11y layer.
- **Motion** beyond Figma's prototype/Smart-Animate.
- **Non-visual config** — an alert's autohide, a debounce.

These are **not a data problem we can solve with a richer spec** — they are *not representable on the Figma
canvas at all*. They live in **code**. So a Figma component is inherently the **visual/structural shell**;
the full component = Figma (visual) + code (behaviour/a11y) + docs + `.ai.json`, all generated from the one
`§15` data spec (`14`). Building the visual shell from data is reliable; expecting the `.fig` to be the whole
component is the mistake.

## 4. Materialization routes — and why offline `.fig` is out

Three ways bits reach a Figma file; two are viable (`08 §5`):

1. **Plugin (manual / no-LLM)** — UI iframe (shared engine + controls) → main thread writes variables /
   modes / styles / component nodes. The designer's journey.
2. **Figma MCP (agentic)** — the MCP writes variables and creates nodes directly (`get_variable_defs`,
   `create_new_file`, `use_figma`, …); no plugin UI. Same document API, different driver.
3. **Offline `.fig` generation — NOT viable.** `.fig` is Figma's **closed, proprietary binary format**;
   there is no public writer and reverse-engineered ones are fragile and break on format changes. The
   *only* reliable way onto the canvas is the Plugin API (routes 1–2), which runs **inside** Figma. Ruled
   out on reliability grounds — exactly the property we're optimizing for.

The reliable component workflow that composes these: **build once** in Figma (LLM + Figma MCP, route 2) →
**extract to `§15` data** (the Specs-CLI-style read leg, `14 §4`) → data is the source of truth → the
plugin **rebuilds any subset** the user picks (or "add all, delete unwanted"). The round-trip is what makes
it reliable — the data is generated from a real, working build, and can regenerate it.

## 5. What's shared vs. adapter-specific (the ecosystem map)

Everything hangs off the **lever manifest** (`08 §4`) — one machine-readable description of the controls,
rendered by every surface:

| Layer | Web dashboard | Figma plugin | Figma MCP | Shared? |
|---|---|---|---|---|
| Engine core (`brandTheme` → tree, preview, contracts) | UI | UI iframe | server-side | **shared, verbatim** (pure, runs anywhere) |
| Control UI (knobs from the lever manifest) | DOM | **same code**, in the iframe | tool schema derived from the manifest | **shared** |
| Live preview | DOM/CSS variables | DOM/CSS in the iframe | n/a | **shared** |
| **Write / apply tier** | CSS custom props on the page | **main thread → `figma.variables` / nodes** | MCP → document API | **adapter-specific** |

Only the bottom row differs. That's the payoff of `08 §3`: refining the web UI now hardens the plugin's UI
by construction, because it's the same control + preview code — only the write adapter is new.

## 6. Terminology guard — two unrelated "primitives"

The word collides across our two domains; keep them apart:

- **Primitive *token*** — a raw base value in the token tree (`palette.red.550`, `dimension.8`), the tier
  we hide behind semantic roles (`10 §3`, the `core-*` collections).
- **Headless *primitive*** — a low-level, **unstyled, behaviour-only component** (the Radix / React-Aria
  sense): keyboard model, focus management, ARIA, state — *no* styling. The base building block of the
  **component** layer, and (per KB `27-adaptive-interfaces`) what an LLM can actually compose against.

They're unrelated. In the component layer the two meet cleanly: a coded component = a **headless primitive**
(behaviour + a11y, the parts Figma can't hold) **skinned with Prism3 tokens** (including primitive tokens,
via semantic roles). The Figma component is that same thing's visual shell.

## 7. Open decisions this grounding surfaces

- **Bundling** — the engine + control UI must bundle into the plugin's iframe HTML (a browser/Figma bundle
  is a packaging step, not a port — `09`). No `npm install` at runtime; `networkAccess: none`.
- **Author our own headless primitives vs. wrap an existing lib** (React Aria / Radix / Ark) — a `14`-layer
  decision, deferred.
- **Dev-Mode surface** — whether the plugin also ships a `dev`/`inspect` capability (read tokens/specs in
  Dev Mode) alongside the design-mode theming surface.
