/**
 * Prism3 engine — appearance modes (light / dark / high-contrast).
 *
 * Modes do NOT regenerate primitives. The ramps are shared; what changes per
 * mode is which primitive STEP each semantic role resolves to — and the engine
 * derives that by contrast target against the mode's own surface, rather than
 * hand-mapping it. Brand-agnostic: paths and palette names come from the Theme.
 */
import { RGB, contrast } from './color';
import { Step } from './ramp';
import { Theme } from './theme';

export type ModeName = 'light' | 'dark' | 'hc-light' | 'hc-dark';

const WHITE: RGB = { r: 255, g: 255, b: 255 };
const BLACK: RGB = { r: 0, g: 0, b: 0 };

type Cand = { path: string; rgb: RGB };
type Rated = Cand & { ratio: number };

/** Least-extreme candidate that clears `min` against `surface` (closest to the floor). */
const pickMinPass = (cands: Cand[], surface: RGB, min: number): Rated => {
  const rated = cands.map((c) => ({ ...c, ratio: contrast(c.rgb, surface) }));
  const passing = rated.filter((c) => c.ratio >= min).sort((a, b) => a.ratio - b.ratio);
  return passing[0] ?? rated.sort((a, b) => b.ratio - a.ratio)[0]; // fallback: most extreme
};

/** Most-extreme candidate against `surface` — for primary text (max legibility). */
const pickMostExtreme = (cands: Cand[], surface: RGB): Rated =>
  cands.map((c) => ({ ...c, ratio: contrast(c.rgb, surface) })).sort((a, b) => b.ratio - a.ratio)[0];

/** Candidate whose contrast is closest to a target (for decorative borders). */
const pickClosest = (cands: Cand[], surface: RGB, target: number): Rated =>
  cands
    .map((c) => ({ ...c, ratio: contrast(c.rgb, surface) }))
    .sort((a, b) => Math.abs(a.ratio - target) - Math.abs(b.ratio - target))[0];

/** Keep the anchor step if it clears `min`; otherwise the nearest step that does. */
const pickBrand = (steps: Step[], ns: string, palette: string, anchorNum: number, surface: RGB, min: number): Rated => {
  const cands = steps.map((s) => ({ path: `${ns}.${palette}.${s.key}`, rgb: s.rgb, num: s.num }));
  const anchor = cands.find((c) => c.num === anchorNum) ?? cands.find((c) => c.num === 500)!;
  if (contrast(anchor.rgb, surface) >= min) return { ...anchor, ratio: contrast(anchor.rgb, surface) };
  const passing = cands
    .map((c) => ({ ...c, ratio: contrast(c.rgb, surface) }))
    .filter((c) => c.ratio >= min)
    .sort((a, b) => Math.abs(a.num - anchor.num) - Math.abs(b.num - anchor.num));
  return passing[0] ?? { ...anchor, ratio: contrast(anchor.rgb, surface) };
};

export type ModeCfg = {
  surface: Cand; sunken: Cand; inverseSurface: RGB;
  // The contrast FLOOR surface: the most-tinted (closest-to-mid) light/dark
  // surface the system supports — i.e. the worst case for a saturated foreground.
  // Saturated, contract-bearing roles (action, status, secondary text) are
  // validated against this, NOT the pure-white/black base, so they keep their
  // contrast when placed on a card/panel a step off the page extreme. Passing the
  // floor implies passing the base surface. `floorName` is its semantic token.
  floor: Cand; floorName: string;
  primaryMin: number; secondaryMin: number; borderTarget: number; actionMin: number;
};

export type ResolvedRole = { path: string; description: string; ratio: number; against: string; min: number };
export type ModeResult = { mode: ModeName; surface: RGB; roles: Record<string, ResolvedRole> };

const cand = (path: string, rgb: RGB): Cand => ({ path, rgb });

const modeConfigs = (ns: string, neutralPalette: string, neutral: Step[]): Record<ModeName, ModeCfg> => {
  const n = (num: number) => {
    const s = neutral.find((x) => x.num === num)!;
    return cand(`${ns}.${neutralPalette}.${s.key}`, s.rgb);
  };
  // Floor = the supported surface nearest mid-gray (lowest contrast for a
  // saturated fg): light → neutral.50 (a step off white); dark → neutral.950 (a
  // step off black). The "first step off the extreme we actually use as a surface."
  return {
    light:     { surface: cand(`${ns}.white`, WHITE), sunken: n(50),  floor: n(50),  floorName: 'surface.sunken',  inverseSurface: BLACK, primaryMin: 7,  secondaryMin: 4.5, borderTarget: 1.4, actionMin: 4.5 },
    dark:      { surface: n(950),                     sunken: cand(`${ns}.black`, BLACK), floor: n(950), floorName: 'surface.default', inverseSurface: WHITE, primaryMin: 7,  secondaryMin: 4.5, borderTarget: 1.8, actionMin: 4.5 },
    'hc-light':{ surface: cand(`${ns}.white`, WHITE), sunken: n(50),  floor: n(50),  floorName: 'surface.sunken',  inverseSurface: BLACK, primaryMin: 15, secondaryMin: 7,   borderTarget: 4.5, actionMin: 7   },
    'hc-dark': { surface: cand(`${ns}.black`, BLACK), sunken: n(950), floor: n(950), floorName: 'surface.sunken',  inverseSurface: WHITE, primaryMin: 15, secondaryMin: 7,   borderTarget: 4.5, actionMin: 7   },
  };
};

const resolveMode = (mode: ModeName, cfg: ModeCfg, theme: Theme, ramps: Map<string, Step[]>): ModeResult => {
  const ns = theme.namespace;
  const r2p = theme.roleToPalette;
  const neutral = ramps.get(r2p.neutral)!;
  const ramp: Cand[] = neutral.map((s) => cand(`${ns}.${r2p.neutral}.${s.key}`, s.rgb));
  const hc = mode.startsWith('hc');
  const textCands: Cand[] = hc
    ? [cand(`${ns}.white`, WHITE), ...ramp, cand(`${ns}.black`, BLACK)]
    : ramp;
  const surfaceRgb = cfg.surface.rgb;
  const floorRgb = cfg.floor.rgb; // worst-case supported surface (see ModeCfg)

  const role = (r: Rated, description: string, against: string, min: number): ResolvedRole =>
    ({ path: r.path, description, ratio: Math.round(r.ratio * 100) / 100, against, min });

  // Primary text & borders resolve against the literal base surface (primary
  // text is the darkest/lightest neutral and clears any light surface trivially).
  const primary = pickMostExtreme(textCands, surfaceRgb);
  const inverse = pickMostExtreme(textCands, cfg.inverseSurface);
  const borderDefault = pickClosest(ramp, surfaceRgb, cfg.borderTarget);
  const borderStrong = pickClosest(ramp, surfaceRgb, cfg.borderTarget * 2.2);
  // Contract-bearing foregrounds resolve against the FLOOR surface, so they hold
  // on tinted surfaces (cards/panels) a step off white/black, not just the base.
  const secondary = pickMinPass(textCands, floorRgb, cfg.secondaryMin);
  const brandRole = (r: Role): Rated =>
    pickBrand(ramps.get(r2p[r])!, ns, r2p[r], theme.roleAnchorStep[r], floorRgb, cfg.actionMin);

  return {
    mode, surface: surfaceRgb,
    roles: {
      'text.primary':   role(primary,   `Primary text — strongest neutral for max legibility`, 'surface.default', cfg.primaryMin),
      'text.secondary': role(secondary, `Secondary text — least-extreme neutral clearing ${cfg.secondaryMin}:1 on the floor surface (${cfg.floorName})`, cfg.floorName, cfg.secondaryMin),
      'text.inverse':   role(inverse,   `Inverse text — strongest neutral on the opposite surface`, 'inverseSurface', cfg.secondaryMin),
      'surface.default':{ path: cfg.surface.path, description: 'Default page surface', ratio: 1, against: 'self', min: 0 },
      'surface.sunken': { path: cfg.sunken.path,  description: 'Sunken / subtle surface', ratio: 1, against: 'self', min: 0 },
      'border.default': role(borderDefault, `Default border — decorative, ~${cfg.borderTarget}:1`, 'surface.default', 0),
      'border.strong':  role(borderStrong,  `Stronger border / divider`, 'surface.default', 0),
      'action.primary': role(brandRole('action'),  `Primary action — clears ${cfg.actionMin}:1 on the floor surface (${cfg.floorName}), so it holds on the base surface too (palette: ${theme.roleToPalette.action})`, cfg.floorName, cfg.actionMin),
      'status.success': role(brandRole('success'), `Success — clears ${cfg.actionMin}:1 on the floor surface (${cfg.floorName})`, cfg.floorName, cfg.actionMin),
      'status.warning': role(brandRole('warning'), `Warning — clears ${cfg.actionMin}:1 on the floor surface (${cfg.floorName})`, cfg.floorName, cfg.actionMin),
      'status.danger':  role(brandRole('danger'),  `Danger / destructive — clears ${cfg.actionMin}:1 on the floor surface (${cfg.floorName})`, cfg.floorName, cfg.actionMin),
    },
  };
};

type Role = 'brand' | 'neutral' | 'success' | 'warning' | 'danger' | 'action';

export const resolveAllModes = (theme: Theme): ModeResult[] => {
  const ramps = new Map(theme.palettes.map((p) => [p.palette, p.steps] as const));
  const neutral = ramps.get(theme.roleToPalette.neutral)!;
  const cfgs = modeConfigs(theme.namespace, theme.roleToPalette.neutral, neutral);
  return (Object.keys(cfgs) as ModeName[]).map((m) => resolveMode(m, cfgs[m], theme, ramps));
};
