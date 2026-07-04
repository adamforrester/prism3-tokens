/**
 * Prism3 engine — non-color scales: the dimension grid, the space scale, the
 * radius ramp, and the component-size layer.
 *
 * Three Curtis tiers show up here:
 *   - reference : `dimension` grid (fine substrate) + `space` scale (8px rhythm,
 *                 numbered by multiplier — space.100 = 1×spaceBase, density-free)
 *   - component : `size` (control heights + paired padding) — t-shirt named,
 *                 the layer DENSITY acts on (compact `md` resolves smaller, name
 *                 unchanged), the layer that gives cross-component consistency
 *   - radius    : a small bounded ramp, t-shirt named (genuinely semantic there)
 *
 * Taxonomy POV (knowledge-base 02/22/24): numbered-multiplier beats t-shirt for
 * a *scale* (handles "between" sizes, extends, and the number means "n×base"
 * invariantly across brands — white-label-honest). T-shirt is reserved for the
 * *component* layer, where it maps to a `size="md"` prop. spaceBase=8 reproduces
 * Prism2's full space scale (18 keys, incl. the 12px/20px half-steps); the 4px
 * grid still backs radius/borders.
 */

export type Density = 'comfortable' | 'compact' | 'spacious';
export type SpaceStep = { key: string; mult: number; px: number };
export type RadiusStep = { name: string; px: number; pill?: boolean };
export type SizeStep = { name: string; height: number; padX: number; padY: number };

/** The primitive dimension grid (px): fine sub-steps for borders/hairlines, a
 *  base / 1.5×base / 2×base shoulder, then a `base`-spaced ladder to `max`. */
export const dimensionGrid = (base = 4, max = 128, extras: number[] = []): number[] => {
  const g = new Set<number>([0, 1, 2, base, base * 1.5, base * 2]);
  for (let v = base * 3; v <= max; v += base) g.add(v);
  for (const e of extras) g.add(e);
  return [...g].filter((v) => Number.isInteger(v) && v >= 0).sort((a, b) => a - b);
};

// Numbered-multiplier space scale (reference tier). key/100 = multiplier of
// spaceBase: 025=0.25× … 100=1× … 150=1.5× … 250=2.5× … 1200=12×. Linear, density-free.
// 150 (=12px) and 250 (=20px) are the UI-critical half-steps in the 8→16 and 16→24
// gaps; Prism2 ships both and the engine had been omitting them — restoring them
// makes the Prism2 space reproduction complete (18/18 keys).
const SPACE_KEYS = ['0', '025', '050', '075', '100', '150', '200', '250', '300', '400', '500', '600', '700', '800', '900', '1000', '1100', '1200'];

/** The space scale for a given rhythm. spaceBase=8 reproduces Prism2 exactly. */
export const spaceScale = (spaceBase = 8): SpaceStep[] =>
  SPACE_KEYS.map((k) => {
    const mult = Number(k) / 100;
    return { key: k, mult, px: Math.round(mult * spaceBase) };
  });

// Component-size ladder (comfortable), expressed in spaceBase multiples so a
// "size" is a CONTRACT (height + horizontal/vertical padding) every component
// opts into — guaranteeing a `md` button, input and select agree. Heights and
// paddings both land on the shared scales.
const SIZE_LADDER: { name: string; h: number; x: number; y: number }[] = [
  { name: 'xs', h: 4, x: 1, y: 0.5 },
  { name: 'sm', h: 5, x: 2, y: 0.75 },
  { name: 'md', h: 6, x: 2, y: 1 },
  { name: 'lg', h: 7, x: 3, y: 1 },
  { name: 'xl', h: 8, x: 3, y: 2 },
];

/** Component sizes for a density. DENSITY lives here, not on the space scale:
 *  'compact' resolves each step to the next-smaller rung's metrics while keeping
 *  the name — so `size.md` stays `md` but renders tighter. */
export const componentSizes = (density: Density, spaceBase = 8): SizeStep[] => {
  const shift = density === 'compact' ? -1 : density === 'spacious' ? 1 : 0;
  return SIZE_LADDER.map((s, i) => {
    const src = SIZE_LADDER[Math.min(SIZE_LADDER.length - 1, Math.max(0, i + shift))];
    return { name: s.name, height: Math.round(src.h * spaceBase), padX: Math.round(src.x * spaceBase), padY: Math.round(src.y * spaceBase) };
  });
};

// Radius base ramp (px at scale=1) — a small bounded, genuinely-semantic set, so
// t-shirt naming holds (both NB and Prism2 name it this way).
const RADIUS_LADDER: { name: string; factor: number }[] = [
  { name: 'none', factor: 0 }, { name: 'sm', factor: 0.5 },
  { name: 'md', factor: 1 }, { name: 'lg', factor: 1.5 },
];
const snap2 = (v: number) => Math.round(v / 2) * 2; // radius rides a 2px sub-grid

/** Radius ramp from one scalar. scale=0 → all corners sharp except the pill;
 *  scale=1 → system default; up to 2 → very soft. `round` is always the pill. */
export const radiusScale = (scale: number, baseMd = 4, pill = 128): RadiusStep[] => {
  const ramp: RadiusStep[] = RADIUS_LADDER.map(({ name, factor }) => ({
    name, px: name === 'none' ? 0 : Math.max(0, snap2(baseMd * factor * scale)),
  }));
  // Weak-monotonicity gate (L-03): radii must never DECREASE as the rung grows
  // (none ≤ sm ≤ md ≤ lg). Equality is allowed by design — small scales snap
  // adjacent rungs onto the same 2px sub-grid, and scale=0 collapses all to sharp
  // — but a rung smaller than its predecessor means a non-monotone (NaN/negative
  // scale, or a broken ladder edit) slipped the Number.isFinite guard upstream.
  for (let i = 1; i < ramp.length; i++)
    if (ramp[i].px < ramp[i - 1].px)
      throw new Error(`radiusScale: non-monotone rung ${ramp[i].name}=${ramp[i].px}px < ${ramp[i - 1].name}=${ramp[i - 1].px}px (scale=${scale})`);
  ramp.push({ name: 'round', px: pill, pill: true });
  return ramp;
};
