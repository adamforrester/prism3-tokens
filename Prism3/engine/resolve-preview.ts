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
 * PURE — no `node:*`, no I/O (sandbox-bundled). It resolves via `resolveAllModes`
 * (which now carries each role's `hex`) + the pure `previewSpec` — NOT `buildTree`
 * (that lives in the I/O shell), so it stays Node-free. Unlike the static spec /
 * lever manifest, this is a per-live-theme read-model, not a committed contract.
 */
import { contrast, hexToRgb } from './color';
import { Theme } from './theme';
import { resolveAllModes, ModeName } from './modes';
import { previewSpec, PreviewSpec } from './preview';

export type PreviewContractResult = {
  component: string; variant: string; fg: string; bg: string; min: number; label?: string;
  byMode: Record<ModeName, { ratio: number; pass: boolean }>;
};
export type ResolvedPreview = {
  modes: ModeName[];
  /** colour role (spec path, e.g. `color.action.default`) → per-mode hex. */
  colors: Record<string, Record<ModeName, string>>;
  /** each declared contract, evaluated on the resolved colours per mode. */
  contracts: PreviewContractResult[];
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
        const ratio = Math.round(contrast(hexToRgb(fg), hexToRgb(bg)) * 100) / 100;
        byMode[m.mode] = { ratio, pass: ratio >= ct.min };
      }
    });
    contracts.push({ component: c.id, variant: v.name, fg: ct.fg, bg: ct.bg, min: ct.min, label: ct.label, byMode });
  }

  return { modes: modes.map((m) => m.mode), colors, contracts };
};
