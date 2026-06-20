/**
 * Prism3 engine — appearance modes (light / dark / high-contrast).
 *
 * Modes do NOT regenerate primitives. The ramps are shared; what changes per
 * mode is which primitive STEP each semantic role resolves to — and the engine
 * derives that by contrast target against the mode's own surface, rather than
 * hand-mapping it. That is the whole point: a role like "primary text" is the
 * definition "the least-extreme neutral that clears AAA on this surface", and
 * it resolves correctly in any mode for free.
 */
import { RGB, contrast } from './color';
import { Step } from './ramp';

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

/** Keep the brand anchor if it clears `min`; otherwise the nearest step that does. */
const pickBrand = (steps: Step[], palette: string, anchorNum: number, surface: RGB, min: number): Rated => {
  const cands = steps.map((s) => ({ path: `nbds.color.${palette}.${s.key}`, rgb: s.rgb, num: s.num }));
  const anchor = cands.find((c) => c.num === anchorNum)!;
  if (contrast(anchor.rgb, surface) >= min) return { ...anchor, ratio: contrast(anchor.rgb, surface) };
  const passing = cands
    .map((c) => ({ ...c, ratio: contrast(c.rgb, surface) }))
    .filter((c) => c.ratio >= min)
    .sort((a, b) => Math.abs(a.num - anchorNum) - Math.abs(b.num - anchorNum));
  return passing[0] ?? { ...anchor, ratio: contrast(anchor.rgb, surface) };
};

export type ModeCfg = {
  surface: Cand;        // default page surface
  sunken: Cand;         // sunken surface (not contrast-critical)
  inverseSurface: RGB;  // the surface inverse text sits on
  primaryMin: number;   // text.primary floor
  secondaryMin: number; // text.secondary floor
  borderTarget: number; // decorative border target ratio
  actionMin: number;    // action / status floor on surface
};

export type ResolvedRole = { path: string; description: string; ratio: number; against: string; min: number };
export type ModeResult = { mode: ModeName; surface: RGB; roles: Record<string, ResolvedRole> };

const cand = (path: string, rgb: RGB): Cand => ({ path, rgb });

export const modeConfigs = (neutral: Step[]): Record<ModeName, ModeCfg> => {
  const n = (num: number) => {
    const s = neutral.find((x) => x.num === num)!;
    return cand(`nbds.color.neutral.${s.key}`, s.rgb);
  };
  return {
    light:     { surface: cand('nbds.color.white', WHITE), sunken: n(50),  inverseSurface: BLACK, primaryMin: 7,  secondaryMin: 4.5, borderTarget: 1.4, actionMin: 4.5 },
    dark:      { surface: n(950),                          sunken: cand('nbds.color.black', BLACK), inverseSurface: WHITE, primaryMin: 7,  secondaryMin: 4.5, borderTarget: 1.8, actionMin: 4.5 },
    'hc-light':{ surface: cand('nbds.color.white', WHITE), sunken: n(50),  inverseSurface: BLACK, primaryMin: 15, secondaryMin: 7,   borderTarget: 4.5, actionMin: 7   },
    'hc-dark': { surface: cand('nbds.color.black', BLACK), sunken: n(950), inverseSurface: WHITE, primaryMin: 15, secondaryMin: 7,   borderTarget: 4.5, actionMin: 7   },
  };
};

export const resolveMode = (
  mode: ModeName,
  cfg: ModeCfg,
  ramps: Map<string, Step[]>,
  anchors: { brand: number; success: number; warning: number }
): ModeResult => {
  const neutral = ramps.get('neutral')!;
  const ramp: Cand[] = neutral.map((s) => cand(`nbds.color.neutral.${s.key}`, s.rgb));
  // Primary text wants the strongest step. In normal modes that is the darkest/
  // lightest RAMP end (a soft black, like NB's neutral.950); HC modes are
  // allowed pure white/black for absolute maximum contrast.
  const hc = mode.startsWith('hc');
  const textCands: Cand[] = hc
    ? [cand('nbds.color.white', WHITE), ...ramp, cand('nbds.color.black', BLACK)]
    : ramp;
  const surfaceRgb = cfg.surface.rgb;

  const role = (r: Rated, description: string, against: string, min: number): ResolvedRole =>
    ({ path: r.path, description, ratio: Math.round(r.ratio * 100) / 100, against, min });

  const primary = pickMostExtreme(textCands, surfaceRgb);
  const secondary = pickMinPass(textCands, surfaceRgb, cfg.secondaryMin);
  const inverse = pickMostExtreme(textCands, cfg.inverseSurface);
  const borderDefault = pickClosest(ramp, surfaceRgb, cfg.borderTarget);
  const borderStrong = pickClosest(ramp, surfaceRgb, cfg.borderTarget * 2.2);
  const action = pickBrand(ramps.get('red')!, 'red', anchors.brand, surfaceRgb, cfg.actionMin);
  const success = pickBrand(ramps.get('green')!, 'green', anchors.success, surfaceRgb, cfg.actionMin);
  const warning = pickBrand(ramps.get('amber')!, 'amber', anchors.warning, surfaceRgb, cfg.actionMin);
  const danger = pickBrand(ramps.get('red')!, 'red', anchors.brand, surfaceRgb, cfg.actionMin);

  return {
    mode, surface: surfaceRgb,
    roles: {
      'text.primary':   role(primary,   `Primary text — strongest neutral for max legibility`, 'surface.default', cfg.primaryMin),
      'text.secondary': role(secondary, `Secondary text — least-extreme neutral clearing ${cfg.secondaryMin}:1`, 'surface.default', cfg.secondaryMin),
      'text.inverse':   role(inverse,   `Inverse text — strongest neutral on the opposite surface`, 'inverseSurface', cfg.secondaryMin),
      'surface.default':{ path: cfg.surface.path,  description: 'Default page surface',  ratio: 1, against: 'self', min: 0 },
      'surface.sunken': { path: cfg.sunken.path,   description: 'Sunken / subtle surface', ratio: 1, against: 'self', min: 0 },
      'border.default': role(borderDefault, `Default border — decorative, ~${cfg.borderTarget}:1`, 'surface.default', 0),
      'border.strong':  role(borderStrong,  `Stronger border / divider`, 'surface.default', 0),
      'action.primary': role(action,  `Primary action — brand, clears ${cfg.actionMin}:1`, 'surface.default', cfg.actionMin),
      'status.success': role(success, `Success — clears ${cfg.actionMin}:1`, 'surface.default', cfg.actionMin),
      'status.warning': role(warning, `Warning — clears ${cfg.actionMin}:1`, 'surface.default', cfg.actionMin),
      'status.danger':  role(danger,  `Danger / destructive — clears ${cfg.actionMin}:1`, 'surface.default', cfg.actionMin),
    },
  };
};

export const resolveAllModes = (
  ramps: Map<string, Step[]>,
  anchors: { brand: number; success: number; warning: number }
): ModeResult[] => {
  const cfgs = modeConfigs(ramps.get('neutral')!);
  return (Object.keys(cfgs) as ModeName[]).map((m) => resolveMode(m, cfgs[m], ramps, anchors));
};
