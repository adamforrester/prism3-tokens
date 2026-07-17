/**
 * Prism3 engine — emit-figma SHADOW + GRADIENT core (pure, node-free).
 *
 * The Figma *Style* axes of the materialisation adapter — split out of the I/O-shell `emit-figma.ts`
 * so they bundle into contexts with NO filesystem: the Figma plugin main thread (the shadow/gradient
 * write, extending #108's colour + #146's FLOAT-variable writes) and the browser. Mirrors the
 * `emit-figma-color.ts` / `emit-figma-dims.ts` extractions: `emit-figma.ts` re-exports everything
 * here, so every `from './emit-figma'` importer + the `npx tsx Prism3/engine/emit-figma.ts` CLI are
 * unchanged.
 *
 * Shadow → Effect Styles, gradient → Paint Styles (NOT variables — docs/08 §5 variable-type ceiling).
 *
 * PURE — no `node:*`, no `figma.*`, no I/O. Depends only on the pure `theme`/`tree` core + the shared
 * helpers/types in the (also pure) `emit-figma-color`.
 */
import { Theme } from './theme';
import { buildTree, at } from './tree';
import { figName, parseColor } from './emit-figma-color';
import type { FigmaColor } from './emit-figma-color';

// ---------------------------------------------------------------------------
// SHADOW — Effect Style specs (docs/10 §7 item 3; docs/08 §5 variable-type
// ceiling). Shadows are STYLES in Figma, not variables — the Effect Style has a
// per-layer array of drop-shadow effects (color/offsetX/offsetY/blur/spread).
// Effect Styles don't currently support Figma modes, so mode-awareness is
// expressed by emitting TWO style sets:
//   shadow/<step>       — LIGHT-mode shadow (canonical $value)
//   shadow-dark/<step>  — DARK-mode shadow (from $extensions.prism3.modes.dark;
//                          reduced-per-layer alpha — the surface-lift dark model)
// A component's plugin/code swap picks the pair by mode. Colour channels parsed
// to Figma {r,g,b,a} float32; numerics carry the DTCG px.
// ---------------------------------------------------------------------------

export type FigmaEffect = { type: 'DROP_SHADOW' | 'INNER_SHADOW'; color: FigmaColor; offset: { x: number; y: number }; radius: number; spread: number; visible: boolean; blendMode: 'NORMAL' };
export type FigmaEffectStyle = { name: string; description: string; effects: FigmaEffect[] };
export type FigmaEffectStylesFile = { $collection: 'shadow-styles'; styles: FigmaEffectStyle[] };

const pxToNum = (v: unknown): number => parseFloat(String(v).replace('px', '')) || 0;

/** DTCG shadow layer → Figma effect. `inset` shadow becomes INNER_SHADOW; the
 *  rest are DROP_SHADOW. `blur` in DTCG maps to `radius` on the Figma effect. */
const shadowLayerToEffect = (layer: any, inset: boolean): FigmaEffect => ({
  type: inset ? 'INNER_SHADOW' : 'DROP_SHADOW',
  color: parseColor(layer.color),
  offset: { x: pxToNum(layer.offsetX), y: pxToNum(layer.offsetY) },
  radius: pxToNum(layer.blur),
  spread: pxToNum(layer.spread),
  visible: true,
  blendMode: 'NORMAL',
});

export const buildFigmaShadow = (theme: Theme): FigmaEffectStylesFile => {
  const { tree } = buildTree(theme);
  const root = Object.keys(tree)[0];
  const shadowNode = tree[root].shadow ?? {};
  const styles: FigmaEffectStyle[] = [];

  // Emit ordered: shadow/<step> first (light), then shadow-dark/<step> (dark).
  // Iterating twice on the same key order keeps materialise-side pairing simple.
  const keys = Object.keys(shadowNode);
  for (const key of keys) {
    const leaf = shadowNode[key];
    const inset = key === 'inset';
    const lightLayers = (leaf.$value as any[]).map((l: any) => shadowLayerToEffect(l, inset));
    styles.push({
      name: `shadow/${key}`,
      description: String(leaf.$description ?? '') + ' — light mode',
      effects: lightLayers,
    });
  }
  for (const key of keys) {
    const leaf = shadowNode[key];
    const inset = key === 'inset';
    const darkLayerData = leaf.$extensions?.prism3?.modes?.dark;
    if (!darkLayerData) continue;
    const darkLayers = (darkLayerData as any[]).map((l: any) => shadowLayerToEffect(l, inset));
    styles.push({
      name: `shadow-dark/${key}`,
      description: String(leaf.$description ?? '') + ' — dark mode (reduced; surface-lift pattern)',
      effects: darkLayers,
    });
  }

  return { $collection: 'shadow-styles', styles };
};

// ---------------------------------------------------------------------------
// GRADIENT — Paint Style specs (docs/10 §7 item 3; docs/08 §5).
// Gradient fills are STYLES in Figma (Paint Styles), not variables. Only stop
// COLOURS bind to colour variables (Plugin API Update 92); kind, angle/transform,
// and stop positions are baked into the style. Figma interpolates in sRGB only,
// so we ship BOTH the canonical alias-driven stops AND the DTCG `sampledStops`
// (5-point sRGB pre-sample of the OKLCH curve) so plugins can lay down denser
// stops when the DTCG interpolation is oklch. Empty for brands with no
// gradients (opt-in axis).
// ---------------------------------------------------------------------------

export type FigmaPaintStop = { position: number; color: FigmaColor; alias: string | null };
export type FigmaPaintStyle = {
  name: string;
  description: string;
  paintType: 'GRADIENT_LINEAR' | 'GRADIENT_RADIAL';
  angle?: number;
  center?: [number, number];
  shape?: string;
  interpolation: 'oklch' | 'srgb';
  stops: FigmaPaintStop[];
  sampledStops: FigmaPaintStop[];
  a11y: { worstOnWhite: number; worstOnBlack: number; note: string };
};
export type FigmaPaintStylesFile = { $collection: 'gradient-styles'; styles: FigmaPaintStyle[] };

/** Resolve `{prism.palette.primary.600}` → Figma name `palette/primary/600` and
 *  the leaf's resolved {r,g,b,a}. */
const stopFromAlias = (tree: any, aliasStr: string, position: number): FigmaPaintStop => {
  const m = /^\{(.+)\}$/.exec(aliasStr);
  const path = m ? m[1] : '';
  const leaf = path ? at(tree, path) : null;
  return {
    position,
    color: parseColor(leaf?.$value),
    alias: path ? figName(path) : null,
  };
};
const stopFromHex = (hex: string, position: number): FigmaPaintStop => ({
  position,
  color: parseColor(hex),
  alias: null,
});

export const buildFigmaGradient = (theme: Theme): FigmaPaintStylesFile => {
  const { tree } = buildTree(theme);
  const root = Object.keys(tree)[0];
  const gradientNode = tree[root].gradient;
  const styles: FigmaPaintStyle[] = [];

  if (!gradientNode) return { $collection: 'gradient-styles', styles };

  for (const key of Object.keys(gradientNode)) {
    const leaf = gradientNode[key];
    const ext = leaf.$extensions?.prism3 ?? {};
    const kind = ext.kind as 'linear' | 'radial';
    const paintType: 'GRADIENT_LINEAR' | 'GRADIENT_RADIAL' = kind === 'radial' ? 'GRADIENT_RADIAL' : 'GRADIENT_LINEAR';
    const stops: FigmaPaintStop[] = (leaf.$value as any[]).map((s: any) => stopFromAlias(tree, s.color, s.position));
    const sampledStops: FigmaPaintStop[] = ((ext.figma?.sampledStops as any[]) ?? []).map((s: any) => stopFromHex(s.hex, s.position));

    const style: FigmaPaintStyle = {
      name: `gradient/${key}`,
      description: String(leaf.$description ?? ''),
      paintType,
      interpolation: ext.interpolation ?? 'srgb',
      stops,
      sampledStops,
      a11y: {
        worstOnWhite: ext.a11y?.worstOnWhite ?? 0,
        worstOnBlack: ext.a11y?.worstOnBlack ?? 0,
        note: String(ext.a11y?.note ?? ''),
      },
    };
    if (kind === 'linear') style.angle = ext.angle ?? 0;
    else { style.center = ext.center ?? [0.5, 0.5]; style.shape = ext.shape ?? 'ellipse'; }
    styles.push(style);
  }

  return { $collection: 'gradient-styles', styles };
};
