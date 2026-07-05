# 19 — The code library, delivery & DX (components-as-data, realized as shipping code)

> `14` is the component-*data* layer (definitions bound to the token contract, the write/verify
> legs into Figma). `18` is the plugin/host *capability* grounding. This doc is the **code-library
> and delivery** half: how the one component-definition set becomes shipping code + Storybook +
> docs + Code Connect, how it's packaged and delivered (dependency **or** ejected accelerator), and
> the DX we're aiming past `prism2`'s fork-per-brand model. Planning altitude — decisions are
> flagged, not all locked. Companion artifact: the ecosystem map (`claude.ai/code/artifact/…`,
> 2026-07-05).

---

## 1. The unifying thesis — one data set, everything else a projection

A single **component-definition set** (seeded from the KB `§15` briefs, **bound to the locked token
names** — `14 §2`) is the source of truth. Every other artifact is a *generated projection* of it:

```
component definitions (data, bound to token names)
   ├─▶ Figma component library      (visual shell; via plugin / MCP — 18)
   ├─▶ code: Web Components + React  (headless behaviour + token skin)
   ├─▶ Storybook stories            (workbench + verification + theme demo)
   ├─▶ usage docs                   (themed, markdown/MDX)
   ├─▶ .ai.json registry            (agent selection surface)
   └─▶ Code Connect mapping         (Figma ↔ code, auto-maintained)
```

Because definitions bind to *names* not *values*, structure is built **once**; brands and modes are
value-columns the engine supplies. This is the coherence engine — no parallel truths to drift, and
it's the practice's named 2026 differentiator (KB `03 §6`).

## 2. Packaging & delivery — one monorepo, an ejectable package, two modes

**Repo:** the code library + Storybook are a **package inside the Prism3 monorepo** (the repo the
web dashboard and plugin already share — `09`), **not a separate repo**. The monorepo buys dev-time
coherence: atomic changes across token contract ↔ definitions ↔ code, shared tooling and evals.

**The ejectability discipline** is what serves the accelerator use case (owner: *primary* delivery is
"scaffold, then disconnect into a client's repo"). The package is authored with **no monorepo-internal
runtime coupling** — it depends only on the *published token output* (a brand's generated token set),
never on sibling packages' internals. That yields two delivery modes from one source:

- **Core library — npm package.** Client installs `@prism3/components` + their generated tokens;
  stays connected to upstream (updates flow).
- **Accelerator — eject to client repo.** Copy the self-contained package + the brand's tokens into
  the client's repo and cut the cord. This is the `prism2` "disconnect" — but from a **clean package**,
  not a forked repo, so no upstream baggage or drift history rides along.

The eject is a *packaging* operation, not a repo split; both modes ship from the same package.

## 3. Output target — WC primary, React fast-follow, framework-agnostic headless core

`14 §6` already plans WC + React + Storybook + `.ai.json` + Code Connect from one definition, so
"primary output" is a **sequencing** call. The shape that keeps every target cheap:

- **Behaviour = framework-agnostic headless** — state machines / a11y / keyboard model with no
  styling (Zag-style; the "headless *primitive*" of `18 §6`, *not* a token primitive). Author our own
  or wrap an existing lib (React-Aria / Radix / Ark) — an open sub-decision.
- **Styling = token-bound** — the visual skin resolves through the token contract, so it re-themes by
  input.
- **Emit WC as the neutral primary** (matches deployment-neutrality, `15`), **React as a thin
  wrapper** over the same headless core. Because behaviour lives in the framework-agnostic core,
  adding a target is a wrapper, not a re-implementation.

Per KB `27` (adaptive interfaces): open primitives + rich intent metadata are what an LLM composes
against — so we generate *primitives + metadata*, not a sealed catalogue.

## 4. The DX leap — kill the fork-per-brand model

`prism2` today: duplicate the repo, set the brand, drop in tokens/fonts, run Storybook. That's a
**fork per brand** — every brand diverges from upstream and every fix must be re-propagated. The new
architecture removes the fork:

- **One library; brands are token *inputs*, not repo copies.** Theming = data injection.
- Onboarding becomes: generate the brand's tokens (CLI / plugin / MCP) → the *same* library consumes
  them → **Storybook themed instantly**, no fork, no re-clone.
- **Storybook theme-switch via token-set globals** (a brand / light / dark toolbar), one set of
  **generated** stories themed by input — not a rebuilt fork.

Net: no drift, no per-brand maintenance, instant re-theme. The eject mode still exists for clients who
want ownership — but it's now the *exception path*, from a clean package, not the default fork.

## 5. Code Connect, the AI surface, Storybook — all generated projections

- **Code Connect (missing today) → generated from the definition.** The spec knows both the Figma
  component and the code component, so the mapping is derived and auto-maintained; Dev Mode shows real,
  current code with zero hand-authoring.
- **AI surface — mirror the token-layer win.** A rich component **`.ai.json` registry** (toward
  Wolosin's 12 fields — `when_to_use` / `avoid_when` / `common_partners` / `trigger_keywords`, KB
  `03 §7`) + **one portable `component-consume` skill** (the analog of `prism3-consume`), measured by the
  same eval discipline. Lesson carried from the token result: the *portable skill beat the per-role data
  dump* — so **one strong skill + a rich registry over 40 thin per-component skills**; per-item skills
  only where a component is genuinely idiosyncratic.
- **Storybook (a requirement) is three things:** the **workbench**, the **verification surface** (a11y
  addon + visual regression, per component per theme), and the **theme-switch demo** — and its stories
  are **generated** from the definitions. Another projection, and another gate.

## 6. Usage docs — markdown is the store; generated baseline + authored overlay

Two audiences, one pipeline (KB `29`/`30`, docs-from-data):

- **Client design docs** — brand-themed, designer-customizable; ship with the eject.
- **Prism3 product docs** — how the framework works; live with the framework.

The low-overhead, ejectable, themeable path:

- **Structural docs generate from the definition** (props / states / a11y / do-don't) — zero
  hand-maintenance.
- **Designer customization in markdown/MDX** with a **generated-vs-authored merge discipline** — the
  same additive/preserve pattern brand-skills uses for `voice.md` (regenerated sections vs. preserved
  hand-authored ones).
- **Themed automatically** — the docs render with the brand's tokens/components, so they look like the
  brand.
- **CMS, if any, is a thin git-backed editor over the markdown** (Decap / Tina-style), **never the
  store** — or we lose ejectability and versioning.

Architectural implications *now* (even though the docs build is later): (a) the **definition schema
must carry the doc fields** (usage, do/don't, content guidelines) so docs are a projection, not a
re-author; (b) **commit to markdown/MDX as the source of truth** so we never get CMS-locked.

## 7. Open decisions (pin over time, not now)

1. **Repo boundary** — monorepo-package (decided lean) vs. separate repo. *Leaning monorepo-package
   with ejectability discipline.*
2. **WC-first vs. React-first**, and **author-headless vs. wrap** (React-Aria / Radix / Ark / Zag).
3. **Definition format** — largely settled in `14` (`component.yaml`, mapped to
   `@directededges/specs-schema`); confirm when the layer activates.
4. **Brand-token flow into the library** — a per-brand token package vs. a runtime token loader.
5. **Docs surface** — Storybook autodocs vs. a static-site generator (Astro/Starlight, Nextra) for the
   client design docs; markdown-as-truth either way.

## 8. First slice (endorsed, from `14 §6`)

Definition schema + **three components** (Button, Text Field, Card — already the preview-spec core) →
generate Figma + WC + one Storybook + `.ai.json` for those three → prove the whole projection chain
end-to-end before scaling to the ~40. Same "small first increment" discipline every engine axis used.

---

*Cross-refs: `14` (component-data layer + build sequence), `18` (plugin/host capability), `08`
(shared control layer / lever manifest), `09` (monorepo), `15` (deployment neutrality). KB: `03 §6/§7`
(components-as-data + the .ai.json fields), `27` (headless primitives + intent metadata for LLM
composition), `29`/`30` (docs-from-data), `components/_schema.md` (the §15 seed corpus).*
