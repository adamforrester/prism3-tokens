/**
 * Prism3 engine — non-color scales: the dimension grid, and the space + radius
 * semantic ramps derived from it.
 *
 * Same architecture as the color axis: a primitive grid + semantic tokens that
 * alias into it. Two brand levers carry all the variance, per the schema's
 * "resist the seventh" discipline:
 *   - density (one enum) shifts the space mapping up/down the grid;
 *   - radius.scale (one scalar) scales the corner ramp from sharp to soft.
 * Everything else (the grid shape, the semantic ladder) is an engine constant.
 *
 * base = 4 reproduces New Balance exactly:
 *   grid    0,1,2,4,6,8,12,16,…,128
 *   space   4xs..3xl = 4,8,12,16,24,32,48,64,96,128
 *   radius  none/sm/md/lg/round = 0,2,4,6,128
 */

export type SpaceStep = { name: string; mult: number; px: number };
export type RadiusStep = { name: string; px: number; pill?: boolean };
export type Density = 'comfortable' | 'compact' | 'spacious';

/** The primitive dimension grid (px): fine sub-steps for borders/hairlines, a
 *  base / 1.5×base / 2×base shoulder, then a `base`-spaced ladder to `max`. */
export const dimensionGrid = (base = 4, max = 128, extras: number[] = []): number[] => {
  const g = new Set<number>([0, 1, 2, base, base * 1.5, base * 2]);
  for (let v = base * 3; v <= max; v += base) g.add(v);
  for (const e of extras) g.add(e);
  return [...g].filter((v) => Number.isInteger(v) && v >= 0).sort((a, b) => a - b);
};

// Semantic space ladder in base-units (the comfortable density). NB measured:
// 4xs..3xl = 1,2,3,4,6,8,12,16,24,32 × base.
const SPACE_LADDER: { name: string; mult: number }[] = [
  { name: '4xs', mult: 1 }, { name: '3xs', mult: 2 }, { name: '2xs', mult: 3 },
  { name: 'xs', mult: 4 }, { name: 'sm', mult: 6 }, { name: 'md', mult: 8 },
  { name: 'lg', mult: 12 }, { name: 'xl', mult: 16 }, { name: '2xl', mult: 24 },
  { name: '3xl', mult: 32 },
];

/** Space ramp for a density. 'compact' steps each token one rung DOWN the grid,
 *  'spacious' one rung up; values stay snapped to grid primitives. */
export const spaceScale = (density: Density, grid: number[], base = 4): SpaceStep[] => {
  const shift = density === 'compact' ? -1 : density === 'spacious' ? 1 : 0;
  return SPACE_LADDER.map(({ name, mult }) => {
    const comfPx = mult * base;
    let i = grid.indexOf(comfPx);
    if (i < 0) i = Math.max(0, grid.findIndex((v) => v >= comfPx));
    const j = Math.min(grid.length - 1, Math.max(0, i + shift));
    const px = grid[j];
    return { name, mult: px / base, px };
  });
};

// Radius base ramp (px at scale=1) — the "linear-2px" shape NB ships.
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
  ramp.push({ name: 'round', px: pill, pill: true });
  return ramp;
};
