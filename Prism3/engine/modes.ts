/**
 * Prism3 engine — appearance modes (light / dark / high-contrast).
 *
 * Modes do NOT regenerate primitives. The ramps are shared; what changes per
 * mode is which primitive STEP each semantic role resolves to — and the engine
 * derives that by contrast target against the mode's own surface, rather than
 * hand-mapping it. Brand-agnostic: paths and palette names come from the Theme.
 *
 * Semantic vocabulary (decided against the field + the practice KB):
 *  - `background.*` — NON-interactive container fills (page, cards, overlays,
 *    wells, semantic tints). Backgrounds are never interactive.
 *  - `foreground.*` — content on top (text/icon), which MAY be interactive
 *    (links). Includes `on-*` pair tokens (content on a solid fill).
 *  - `action.*` — the interactive fill role, expressed as STATES on the role
 *    (default/hover/pressed/focus/inactive), not a separate `interactive/` tree.
 *  - `border.*` — edges. `status.*` is folded into background/foreground/border
 *    by role (success/warning/danger/info), the field-consistent shape.
 * Every role key stays two-level (`group.name`); state/qualifier lives in the
 * name via hyphens (`action.hover`, `background.brand-subtle`, `foreground.on-action`).
 */
import { RGB, contrast } from './color';
import { Step } from './ramp';
import { Theme, SurfaceSpec, SurfacesConfig, Role } from './theme';

export type ModeName = 'light' | 'dark' | 'hc-light' | 'hc-dark';

const WHITE: RGB = { r: 255, g: 255, b: 255 };
const BLACK: RGB = { r: 0, g: 0, b: 0 };

type Cand = { path: string; rgb: RGB };
type Rated = Cand & { ratio: number };
type RatedNum = Rated & { num: number };

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
const pickBrand = (steps: Step[], ns: string, palette: string, anchorNum: number, surface: RGB, min: number): RatedNum => {
  const cands = steps.map((s) => ({ path: `${ns}.${palette}.${s.key}`, rgb: s.rgb, num: s.num }));
  const anchor = cands.find((c) => c.num === anchorNum) ?? cands.find((c) => c.num === 500)!;
  if (contrast(anchor.rgb, surface) >= min) return { ...anchor, ratio: contrast(anchor.rgb, surface) };
  const passing = cands
    .map((c) => ({ ...c, ratio: contrast(c.rgb, surface) }))
    .filter((c) => c.ratio >= min)
    .sort((a, b) => Math.abs(a.num - anchor.num) - Math.abs(b.num - anchor.num));
  return passing[0] ?? { ...anchor, ratio: contrast(anchor.rgb, surface) };
};

/** Elevation set for a mode: the non-interactive container fills. */
type BgSet = { default: Cand; raised: Cand; overlay: Cand; sunken: Cand; subtle: Cand; inverse: Cand };

export type ModeCfg = {
  surface: Cand;            // base page surface
  // Contrast FLOOR: the most-tinted (closest-to-mid) supported surface — the
  // worst case for a saturated foreground. Contract-bearing roles validate
  // against this, not pure white/black, so they hold on tinted cards. Passing
  // the floor implies passing the base. `floorName` is its short token path.
  floor: Cand; floorName: string;
  bg: BgSet;
  inverseSurface: RGB;
  family: 'light' | 'dark';
  primaryMin: number; secondaryMin: number; tertiaryMin: number; actionMin: number;
  borderTarget: number; nonTextMin: number;
};

export type ResolvedRole = { path: string; description: string; ratio: number; against: string; min: number };
export type ModeResult = { mode: ModeName; surface: RGB; roles: Record<string, ResolvedRole> };

const cand = (path: string, rgb: RGB): Cand => ({ path, rgb });

const modeConfigs = (ns: string, neutralPalette: string, neutral: Step[], surfaces: SurfacesConfig = {}): Record<ModeName, ModeCfg> => {
  const nNear = (num: number): Step => neutral.reduce((a, b) => (Math.abs(b.num - num) < Math.abs(a.num - num) ? b : a));
  const n = (num: number) => { const s = nNear(num); return cand(`${ns}.${neutralPalette}.${s.key}`, s.rgb); };
  const white = cand(`${ns}.white`, WHITE);
  const black = cand(`${ns}.black`, BLACK);
  const spec = (s: SurfaceSpec): Cand => (s === 'white' ? white : s === 'black' ? black : n(s));
  const short = (c: Cand) => c.path.replace(`${ns}.`, '');

  // Resolve base + contrast floor + elevation set per family. Defaults reproduce
  // the prior behaviour (light: white base, floor neutral.50; dark: neutral.950
  // base, floor neutral.950). Elevation: light lifts toward white + tints down
  // for sunken; dark lifts toward mid (M3 lighter-is-higher) + black for sunken.
  const resolve = (family: 'light' | 'dark', defBase: SurfaceSpec): { base: Cand; floor: Cand; bg: BgSet } => {
    const cfg = surfaces[family] ?? {};
    const baseSpec = cfg.base ?? defBase;
    const baseNum = baseSpec === 'white' ? 0 : baseSpec === 'black' ? 1000 : baseSpec;
    const defFloor = typeof baseSpec === 'number' ? (family === 'light' ? baseSpec + 50 : baseSpec - 50)
      : baseSpec === 'white' ? 50 : 950;
    const floorStep = cfg.floorStep ?? defFloor;
    const base = spec(baseSpec);
    const floor = n(floorStep);
    const bg: BgSet = family === 'light'
      ? { default: base, raised: white, overlay: white, subtle: floor, sunken: n(floorStep + 150), inverse: n(875) }
      : { default: base, raised: n(baseNum - 50), overlay: n(baseNum - 100), subtle: n(baseNum - 50), sunken: black, inverse: n(125) };
    return { base, floor, bg };
  };

  const light = resolve('light', 'white');
  const dark = resolve('dark', 950);
  const mk = (r: { base: Cand; floor: Cand; bg: BgSet }, family: 'light' | 'dark', inverseSurface: RGB, mins: Pick<ModeCfg, 'primaryMin' | 'secondaryMin' | 'tertiaryMin' | 'actionMin' | 'borderTarget' | 'nonTextMin'>): ModeCfg =>
    ({ surface: r.base, floor: r.floor, floorName: short(r.floor), bg: r.bg, inverseSurface, family, ...mins });

  return {
    light:      mk(light, 'light', BLACK, { primaryMin: 7,  secondaryMin: 4.5, tertiaryMin: 3, actionMin: 4.5, borderTarget: 1.4, nonTextMin: 3 }),
    dark:       mk(dark,  'dark',  WHITE, { primaryMin: 7,  secondaryMin: 4.5, tertiaryMin: 3, actionMin: 4.5, borderTarget: 1.8, nonTextMin: 3 }),
    // High-contrast: base goes to the pure extreme, but the floor (and so the
    // contract surface) stays the tinted neutral, and thresholds ratchet up.
    'hc-light': mk({ base: cand(`${ns}.white`, WHITE), floor: light.floor, bg: { ...light.bg, default: cand(`${ns}.white`, WHITE) } }, 'light', BLACK, { primaryMin: 15, secondaryMin: 7, tertiaryMin: 4.5, actionMin: 7, borderTarget: 4.5, nonTextMin: 4.5 }),
    'hc-dark':  mk({ base: cand(`${ns}.black`, BLACK), floor: dark.floor, bg: { ...dark.bg, default: cand(`${ns}.black`, BLACK), sunken: cand(`${ns}.black`, BLACK) } }, 'dark', WHITE, { primaryMin: 15, secondaryMin: 7, tertiaryMin: 4.5, actionMin: 7, borderTarget: 4.5, nonTextMin: 4.5 }),
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
  const baseRgb = cfg.surface.rgb;
  const floorRgb = cfg.floor.rgb;
  const tintStep = cfg.family === 'light' ? 100 : 900; // subtle container fill step

  const role = (r: Rated, description: string, against: string, min: number): ResolvedRole =>
    ({ path: r.path, description, ratio: Math.round(r.ratio * 100) / 100, against, min });
  const surfRole = (c: Cand, description: string): ResolvedRole =>
    ({ path: c.path, description, ratio: 1, against: 'self', min: 0 });

  // A specific palette step as a candidate (nearest available num).
  const pStep = (palette: string, num: number): Cand => {
    const steps = ramps.get(palette)!;
    const s = steps.reduce((a, b) => (Math.abs(b.num - num) < Math.abs(a.num - num) ? b : a));
    return cand(`${ns}.${palette}.${s.key}`, s.rgb);
  };
  // Content colour (black/white) that is most legible ON a solid fill.
  const onColor = (fill: RGB): Rated => pickMostExtreme([cand(`${ns}.white`, WHITE), cand(`${ns}.black`, BLACK)], fill);
  // A semantic role's vivid foreground: the palette step clearing actionMin on the floor.
  const fgRole = (r: Role): RatedNum => pickBrand(ramps.get(r2p[r])!, ns, r2p[r], theme.roleAnchorStep[r], floorRgb, cfg.actionMin);
  // Walk the action palette by N steps toward the more-extreme end (darker in
  // light, lighter in dark) — for hover/pressed state derivation.
  const dir = cfg.family === 'light' ? +1 : -1;
  // Text on a SATURATED fill targets AA (4.5), not the mode's escalated bar: a
  // vivid mid-tone is gamut-bounded — no pure black/white text can reach 7:1 on
  // it. HC escalation applies to text-on-neutral-surface, not text-on-vivid-fill.
  const onMin = 4.5;

  // ---- non-interactive backgrounds ----
  const bg = cfg.bg;
  // ---- foreground content ----
  const primary = pickMostExtreme(textCands, baseRgb);
  const secondary = pickMinPass(textCands, floorRgb, cfg.secondaryMin);
  const tertiary = pickMinPass(textCands, floorRgb, cfg.tertiaryMin);
  const disabled = pickClosest(textCands, baseRgb, 2);          // intentionally sub-AA (disabled exempt)
  const inverseFg = pickMostExtreme(textCands, cfg.inverseSurface);
  // ---- interactive action role + states ----
  const action = fgRole('action');
  const actHover = pStep(r2p.action, action.num + dir * 50);
  const actPressed = pStep(r2p.action, action.num + dir * 100);
  const actInactive = pStep(r2p.neutral, cfg.family === 'light' ? 200 : 750);
  const link = fgRole('action');
  const linkHover = pStep(r2p.action, link.num + dir * 50);
  // ---- borders ----
  const borderDefault = pickClosest(ramp, baseRgb, cfg.borderTarget);
  const borderStrong = pickClosest(ramp, baseRgb, cfg.borderTarget * 2.2);
  const borderField = pickMinPass(ramp, baseRgb, cfg.nonTextMin);
  const borderInverse = pickClosest(ramp, cfg.inverseSurface, cfg.borderTarget);
  // Semantic borders: nearest palette step clearing the non-text minimum on the
  // base (a light hue like amber needs a darker step to reach 3:1 on white).
  const semBorder = (r: Role): RatedNum => pickBrand(ramps.get(r2p[r])!, ns, r2p[r], 500, baseRgb, cfg.nonTextMin);

  const roles: Record<string, ResolvedRole> = {
    // backgrounds (non-interactive container fills)
    'background.default': surfRole(bg.default, 'Default page surface'),
    'background.raised':  surfRole(bg.raised,  'Raised surface — cards / panels (shadow-lifted in light, lighter primitive in dark)'),
    'background.overlay': surfRole(bg.overlay, 'Overlay surface — menus / dialogs / popovers / sheets'),
    'background.sunken':  surfRole(bg.sunken,  'Sunken surface — wells / insets'),
    'background.subtle':  surfRole(bg.subtle,  'Subtle surface — secondary muted fill'),
    'background.inverse': surfRole(bg.inverse, 'Inverse surface'),
    'background.brand-subtle':   surfRole(pStep(r2p.brand, tintStep),   'Subtle brand tint — selected rows / brand banners'),
    'background.success-subtle': surfRole(pStep(r2p.success, tintStep), 'Subtle success tint — positive banners / badges'),
    'background.warning-subtle': surfRole(pStep(r2p.warning, tintStep), 'Subtle warning tint'),
    'background.danger-subtle':  surfRole(pStep(r2p.danger, tintStep),  'Subtle danger tint'),
    'background.info-subtle':    surfRole(pStep(r2p.info, tintStep),    'Subtle info tint'),

    // foreground content (text/icon; links are interactive foregrounds)
    'foreground.primary':   role(primary,   'Primary text — strongest neutral for max legibility', 'background.default', cfg.primaryMin),
    'foreground.secondary': role(secondary, `Secondary text — clears ${cfg.secondaryMin}:1 on the floor (${cfg.floorName})`, cfg.floorName, cfg.secondaryMin),
    'foreground.tertiary':  role(tertiary,  `Tertiary text — placeholder/hint, clears ${cfg.tertiaryMin}:1 on the floor`, cfg.floorName, cfg.tertiaryMin),
    'foreground.disabled':  role(disabled,  'Disabled text — intentionally low-contrast (WCAG-exempt)', 'background.default', 0),
    'foreground.inverse':   role(inverseFg, 'Inverse text — strongest neutral on the opposite surface', 'background.inverse', cfg.secondaryMin),
    'foreground.brand':     role(fgRole('brand'),   `Brand text/icon — clears ${cfg.actionMin}:1 on the floor`, cfg.floorName, cfg.actionMin),
    'foreground.success':   role(fgRole('success'), `Success text/icon — clears ${cfg.actionMin}:1 on the floor`, cfg.floorName, cfg.actionMin),
    'foreground.warning':   role(fgRole('warning'), `Warning text/icon — clears ${cfg.actionMin}:1 on the floor`, cfg.floorName, cfg.actionMin),
    'foreground.danger':    role(fgRole('danger'),  `Danger text/icon — clears ${cfg.actionMin}:1 on the floor`, cfg.floorName, cfg.actionMin),
    'foreground.info':      role(fgRole('info'),    `Info text/icon — clears ${cfg.actionMin}:1 on the floor`, cfg.floorName, cfg.actionMin),
    'foreground.link':       role(link,        `Link — interactive foreground, clears ${cfg.actionMin}:1 on the floor (palette: ${r2p.action})`, cfg.floorName, cfg.actionMin),
    'foreground.link-hover': role({ ...linkHover, ratio: contrast(linkHover.rgb, floorRgb) }, 'Link hover — one step more extreme', cfg.floorName, cfg.actionMin),
    // on-* pair tokens (content on a solid fill)
    'foreground.on-action':  role(onColor(action.rgb), 'Label on the action fill (AA on a vivid fill)', 'action.default', onMin),
    'foreground.on-brand':   role(onColor(pStep(r2p.brand, theme.roleAnchorStep.brand).rgb), 'Content on a solid brand fill (AA on a vivid fill)', 'brand.solid', onMin),
    'foreground.on-emphasis':role(onColor(cfg.inverseSurface), 'Content on an emphasis / inverse fill', 'background.inverse', cfg.secondaryMin),
    'foreground.on-success': role(onColor(pStep(r2p.success, 500).rgb), 'Content on a solid success fill (AA on a vivid fill)', 'success.solid', onMin),
    'foreground.on-warning': role(onColor(pStep(r2p.warning, 500).rgb), 'Content on a solid warning fill (AA on a vivid fill)', 'warning.solid', onMin),
    'foreground.on-danger':  role(onColor(pStep(r2p.danger, 500).rgb),  'Content on a solid danger fill (AA on a vivid fill)', 'danger.solid', onMin),
    'foreground.on-info':    role(onColor(pStep(r2p.info, 500).rgb),    'Content on a solid info fill (AA on a vivid fill)', 'info.solid', onMin),

    // action (interactive fill) — states on the role
    'action.default':  role(action, `Primary action fill (rest) — clears ${cfg.actionMin}:1 on the floor (${cfg.floorName}), so it holds on the base surface (palette: ${r2p.action})`, cfg.floorName, cfg.actionMin),
    'action.hover':    role({ ...actHover, ratio: contrast(actHover.rgb, floorRgb) }, 'Action fill — hover (one step more extreme)', cfg.floorName, cfg.actionMin),
    'action.pressed':  role({ ...actPressed, ratio: contrast(actPressed.rgb, floorRgb) }, 'Action fill — pressed (two steps more extreme)', cfg.floorName, cfg.actionMin),
    'action.focus':    role({ ...actHover, ratio: contrast(actHover.rgb, floorRgb) }, 'Action fill — focus', cfg.floorName, cfg.actionMin),
    'action.inactive': role({ ...actInactive, ratio: contrast(actInactive.rgb, baseRgb) }, 'Action fill — inactive/disabled (neutral)', 'background.default', 0),

    // borders
    'border.default': role(borderDefault, `Default border — decorative, ~${cfg.borderTarget}:1`, 'background.default', 0),
    'border.strong':  role(borderStrong,  'Stronger border / divider', 'background.default', 0),
    'border.field':   role(borderField,   `Form-field border — clears ${cfg.nonTextMin}:1 (SC 1.4.11)`, 'background.default', cfg.nonTextMin),
    'border.focus':   role({ ...action, ratio: contrast(action.rgb, baseRgb) }, `Focus ring — action colour, clears ${cfg.nonTextMin}:1`, 'background.default', cfg.nonTextMin),
    'border.success': role(semBorder('success'), `Success border — clears ${cfg.nonTextMin}:1`, 'background.default', cfg.nonTextMin),
    'border.warning': role(semBorder('warning'), `Warning border — clears ${cfg.nonTextMin}:1`, 'background.default', cfg.nonTextMin),
    'border.danger':  role(semBorder('danger'),  `Danger border — clears ${cfg.nonTextMin}:1`, 'background.default', cfg.nonTextMin),
    'border.inverse': role(borderInverse, 'Inverse border', 'background.inverse', 0),
  };

  return { mode, surface: baseRgb, roles };
};

export const resolveAllModes = (theme: Theme): ModeResult[] => {
  const ramps = new Map(theme.palettes.map((p) => [p.palette, p.steps] as const));
  const neutral = ramps.get(theme.roleToPalette.neutral)!;
  const cfgs = modeConfigs(theme.namespace, theme.roleToPalette.neutral, neutral, theme.surfaces);
  return (Object.keys(cfgs) as ModeName[]).map((m) => resolveMode(m, cfgs[m], theme, ramps));
};
