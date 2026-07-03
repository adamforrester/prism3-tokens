/**
 * Prism3 engine — the RESOLVED-PREVIEW projection (docs/08 §7, B1b).
 *
 * The runtime read-model the visual surfaces consume: given a live theme, project the
 * preview spec (B1a, `preview.ts`) to CONCRETE values + live contrast results —
 *   • every referenced colour role → its resolved hex per mode, and
 *   • every declared contract pair → the actual contrast of the resolved fg on the
 *     resolved bg, per mode, with pass/fail.
 * The Figma plugin and web playground call this reactively as the knobs move, paint
 * the components from `colors`, and drive the contrast overlay from `contracts`. The
 * overlay's differentiator (docs/04) is exactly this: the a11y verdict computed on the
 * real resolved colours, live.
 *
 * PURE — no `node:*`, no I/O (sandbox-bundled). Colour resolves via `resolveAllModes`
 * (which carries each role's `hex`); geometry/type resolve via `buildTree` — now that
 * it lives in the pure `tree.ts` (extracted from the I/O shell), the whole read-model
 * stays Node-free. Unlike the static spec / lever manifest, this is a per-live-theme
 * read-model, not a committed contract.
 */
import { contrast, hexToRgb } from './color';
import { Theme } from './theme';
import { resolveAllModes, ModeName } from './modes';
import { previewSpec, PreviewSpec } from './preview';
import { buildTree, at, subNode, pxOf, numOf, remPxOf, familyOf } from './tree';

export type PreviewContractResult = {
  component: string; variant: string; fg: string; bg: string; min: number; label?: string;
  byMode: Record<ModeName, { ratio: number; pass: boolean }>;
};
/** A resolved typography composite (mode-invariant) — the atoms a chip / Text Style needs. */
export type ResolvedType = { fontFamily: string; fontWeight: number; fontSizePx: number };
export type ResolvedPreview = {
  modes: ModeName[];
  /** colour role (spec path, e.g. `color.action.default`) → per-mode hex. */
  colors: Record<string, Record<ModeName, string>>;
  /** each declared contract, evaluated on the resolved colours per mode. */
  contracts: PreviewContractResult[];
  /** dimension binding (e.g. `radius.md`, `space.300`) → px. The canonical (light) baseline. */
  dims: Record<string, number>;
  /** sparse per-mode dimension overrides (e.g. wireframe zeroes radius). Only refs that vary
   *  by mode appear, and only the modes that differ from the baseline — mirroring the tree's
   *  `$extensions.prism3.modes`. A consumer reads `dimOverrides[ref]?.[mode] ?? dims[ref]`. */
  dimOverrides: Record<string, Partial<Record<ModeName, number>>>;
  /** typography binding (e.g. `type.label.md.emphasis`) → resolved composite. Mode-invariant. */
  type: Record<string, ResolvedType>;
};

const strip = (p: string) => p.replace(/^color\./, '');

export const resolvePreview = (theme: Theme, spec: PreviewSpec = previewSpec): ResolvedPreview => {
  const modes = resolveAllModes(theme);
  const hexOf = (rolePath: string, i: number): string | undefined => modes[i].roles[strip(rolePath)]?.hex;

  // Every colour role the spec references (bindings + contract endpoints) → per-mode hex.
  const refs = new Set<string>();
  for (const c of spec.components) for (const v of c.variants) {
    for (const t of Object.values(v.bindings)) if (t.startsWith('color.')) refs.add(t);
    for (const ct of v.contracts ?? []) { refs.add(ct.fg); refs.add(ct.bg); }
  }
  const colors: ResolvedPreview['colors'] = {};
  for (const ref of [...refs].sort()) {
    const byMode = {} as Record<ModeName, string>;
    modes.forEach((m, i) => { const h = hexOf(ref, i); if (h) byMode[m.mode] = h; });
    colors[ref] = byMode;
  }

  // Each declared contract, computed on the RESOLVED colours (real fg on real bg).
  const contracts: PreviewContractResult[] = [];
  for (const c of spec.components) for (const v of c.variants) for (const ct of v.contracts ?? []) {
    const byMode = {} as Record<ModeName, { ratio: number; pass: boolean }>;
    modes.forEach((m, i) => {
      const fg = hexOf(ct.fg, i), bg = hexOf(ct.bg, i);
      if (fg && bg) {
        // CR-01: decide pass on the RAW ratio; round only the displayed value.
        const raw = contrast(hexToRgb(fg), hexToRgb(bg));
        byMode[m.mode] = { ratio: Math.round(raw * 100) / 100, pass: raw >= ct.min };
      }
    });
    contracts.push({ component: c.id, variant: v.name, fg: ct.fg, bg: ct.bg, min: ct.min, label: ct.label, byMode });
  }

  // Geometry + type — resolved from the token tree (mode-invariant). Colour lives in
  // `colors` (per mode); dimensions and typography don't shift by mode, so they're
  // single values. Only radius/space (→ px) and type (→ composite) bindings are
  // resolved here; shadow/motion aren't rendered by the current preview.
  const { tree } = buildTree(theme);
  const data = tree[Object.keys(tree)[0]]; // the brand-namespace root (nbds / prism)
  const dimRefs = new Set<string>(), typeRefs = new Set<string>();
  for (const c of spec.components) for (const v of c.variants) for (const t of Object.values(v.bindings)) {
    if (t.startsWith('type.')) typeRefs.add(t);
    else if (t.startsWith('radius.') || t.startsWith('space.')) dimRefs.add(t);
  }
  const dims: ResolvedPreview['dims'] = {};
  const dimOverrides: ResolvedPreview['dimOverrides'] = {};
  for (const ref of [...dimRefs].sort()) {
    const node = at(data, ref);
    dims[ref] = pxOf(tree, node);
    // Per-mode geometry (docs/11 1b — wireframe radius → 0): read the leaf's mode overrides,
    // resolving each override's alias to px, so the preview renders the right value per mode.
    const mo = node?.$extensions?.prism3?.modes;
    if (mo && typeof mo === 'object' && !Array.isArray(mo)) {
      const perMode: Partial<Record<ModeName, number>> = {};
      for (const [mode, ov] of Object.entries(mo)) {
        const v = (ov as { $value?: unknown })?.$value;
        if (typeof v === 'string') perMode[mode as ModeName] = pxOf(tree, subNode(tree, v));
      }
      if (Object.keys(perMode).length) dimOverrides[ref] = perMode;
    }
  }
  const type: ResolvedPreview['type'] = {};
  for (const ref of [...typeRefs].sort()) {
    const node = at(data, ref);
    const val = node?.$value ?? {};
    const sizePx = node?.$extensions?.prism3?.sizePx ?? remPxOf(tree, subNode(tree, val.fontSize));
    type[ref] = {
      fontFamily: familyOf(tree, subNode(tree, val.fontFamily)),
      fontWeight: numOf(tree, subNode(tree, val.fontWeight)),
      fontSizePx: sizePx,
    };
  }

  return { modes: modes.map((m) => m.mode), colors, contracts, dims, dimOverrides, type };
};
