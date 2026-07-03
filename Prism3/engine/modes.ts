/**
 * Prism3 engine — appearance modes (light / dark / high-contrast).
 *
 * Modes do NOT regenerate primitives. The ramps are shared; what changes per
 * mode is which primitive STEP each semantic role resolves to — derived by
 * contrast target against the mode's own surface, not hand-mapped.
 *
 * Semantic model — the surface & content vocabulary (see docs/06):
 *   - background — the CANVAS: thin, page-level inert surfaces. `primary`/
 *                  `secondary`/`tertiary` (tonal in BOTH modes) + an `inverse.*`
 *                  sibling ladder. The page you build on.
 *   - foreground — the SURFACES/FILLS placed on the canvas (Prism2's `surface`,
 *                  renamed): a tonal `primary/secondary/tertiary` ladder (cards →
 *                  panels → nested) + `inverse.*` (dark fills in light) + bold
 *                  semantic fills + `-subtle` tints. `foreground.primary` sits on
 *                  `background.primary`, a different shade. NOT ink.
 *   - text/icon  — INK on a surface: neutral emphasis + semantic + `-subtle` +
 *                  `on-*` pairs (ink on a solid fill) + `link` (no disabled).
 *                  Split only by contrast floor (text 4.5 / icon optional 3:1).
 *   - action     — the interactive fill + states (top-level).
 *   - border     — neutral (`primary`/`secondary`), `inverse`, semantic, `focus`.
 *
 * Light & dark step surfaces tonally and SYMMETRICALLY (light is no longer all
 * white); shadow is an additive elevation cue, not the sole differentiator. In
 * HIGH CONTRAST the neutral surface ladders flatten to the base — HC separates
 * regions by BORDER (the ≥4.5:1 border target), not by near-invisible tints.
 */
import { RGB, contrast, hex } from './color';
import { Step } from './ramp';
import { Theme, SurfaceSpec, SurfacesConfig, Role } from './theme';

export type ModeName = 'light' | 'dark' | 'hc-light' | 'hc-dark' | 'wireframe';

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

// A tonal surface ladder for a mode: primary/secondary/tertiary (3 steps).
type SurfSet = { primary: Cand; secondary: Cand; tertiary: Cand };

export type ModeCfg = {
  surface: Cand;                   // base page surface (background.primary)
  floor: Cand; floorName: string;  // contrast floor (worst-case supported surface)
  bg: SurfSet; bgInverse: SurfSet; // background canvas ladders
  fg: SurfSet; fgInverse: SurfSet; // foreground surface ladders
  inverseSurface: RGB;             // the primary inverse surface (for on-inverse / border.inverse)
  family: 'light' | 'dark';
  primaryMin: number; secondaryMin: number; tertiaryMin: number; actionMin: number;
  borderTarget: number; nonTextMin: number;
};

export type ResolvedRole = { path: string; description: string; ratio: number; against: string; min: number; hex: string };
export type ModeResult = { mode: ModeName; surface: RGB; roles: Record<string, ResolvedRole> };

const cand = (path: string, rgb: RGB): Cand => ({ path, rgb });

const modeConfigs = (ns: string, neutralPalette: string, neutral: Step[], surfaces: SurfacesConfig = {}): Record<ModeName, ModeCfg> => {
  const nNear = (num: number): Step => neutral.reduce((a, b) => (Math.abs(b.num - num) < Math.abs(a.num - num) ? b : a));
  const n = (num: number) => { const s = nNear(num); return cand(`${ns}.${neutralPalette}.${s.key}`, s.rgb); };
  const white = cand(`${ns}.white`, WHITE);
  const black = cand(`${ns}.black`, BLACK);
  const short = (c: Cand) => c.path.replace(`${ns}.`, '');
  // A neutral surface step by number, snapping the extremes to pure white/black.
  const surfAt = (num: number): Cand => (num <= 0 ? white : num >= 1000 ? black : n(num));
  // Background ladder: base → +1 → +2 steps (50 each), in the mode's tonal direction.
  const bgLadder = (baseNum: number, dir: number): SurfSet => ({ primary: surfAt(baseNum), secondary: surfAt(baseNum + dir * 50), tertiary: surfAt(baseNum + dir * 100) });
  // Foreground ladder: surfaces placed on the canvas — offset one step deeper than
  // the page so a card reads against the default page, then stepping on.
  const fgLadder = (baseNum: number, dir: number): SurfSet => ({ primary: surfAt(baseNum + dir * 50), secondary: surfAt(baseNum + dir * 100), tertiary: surfAt(baseNum + dir * 150) });

  const resolve = (family: 'light' | 'dark', defBase: SurfaceSpec): { base: Cand; floor: Cand; bg: SurfSet; fg: SurfSet; bgInverse: SurfSet; fgInverse: SurfSet; invRgb: RGB } => {
    const cfg = surfaces[family] ?? {};
    const baseSpec = cfg.base ?? defBase;
    const baseNum = baseSpec === 'white' ? 0 : baseSpec === 'black' ? 1000 : baseSpec;
    const defFloor = typeof baseSpec === 'number' ? (family === 'light' ? baseSpec + 50 : baseSpec - 50)
      : baseSpec === 'white' ? 50 : 950;
    const floorStep = cfg.floorStep ?? defFloor;
    const dir = family === 'light' ? +1 : -1;           // light steps darker; dark steps lighter
    // Inverse anchors NEAR the opposite extreme, not AT it — pure black reads
    // harsh/muddy and pure white halates in dark UIs (KB 31 §halation, §tint-not-
    // black). Light inverse = near-black 950; dark inverse = near-white 25. HC
    // restores the pure extremes (below) for low-vision max contrast.
    const invBaseNum = family === 'light' ? 950 : 25;
    const invDir = -dir;
    return {
      base: surfAt(baseNum), floor: n(floorStep),
      bg: bgLadder(baseNum, dir), fg: fgLadder(baseNum, dir),
      bgInverse: bgLadder(invBaseNum, invDir), fgInverse: fgLadder(invBaseNum, invDir),
      invRgb: surfAt(invBaseNum).rgb,
    };
  };

  const light = resolve('light', 'white');
  const dark = resolve('dark', 950);
  // High contrast flattens the neutral surface ladders to a single base — HC carries
  // elevation by BORDER (escalated to ≥4.5:1), not by near-invisible surface tints.
  const flat = (c: Cand): SurfSet => ({ primary: c, secondary: c, tertiary: c });

  const mk = (r: ReturnType<typeof resolve>, family: 'light' | 'dark', mins: Pick<ModeCfg, 'primaryMin' | 'secondaryMin' | 'tertiaryMin' | 'actionMin' | 'borderTarget' | 'nonTextMin'>): ModeCfg =>
    ({ surface: r.base, floor: r.floor, floorName: short(r.floor), bg: r.bg, bgInverse: r.bgInverse, fg: r.fg, fgInverse: r.fgInverse, inverseSurface: r.invRgb, family, ...mins });
  const hcMk = (base: Cand, inv: Cand, floor: Cand, family: 'light' | 'dark', mins: Pick<ModeCfg, 'primaryMin' | 'secondaryMin' | 'tertiaryMin' | 'actionMin' | 'borderTarget' | 'nonTextMin'>): ModeCfg =>
    ({ surface: base, floor, floorName: short(floor), bg: flat(base), bgInverse: flat(inv), fg: flat(base), fgInverse: flat(inv), inverseSurface: inv.rgb, family, ...mins });

  return {
    light:      mk(light, 'light', { primaryMin: 7,  secondaryMin: 4.5, tertiaryMin: 3, actionMin: 4.5, borderTarget: 1.4, nonTextMin: 3 }),
    dark:       mk(dark,  'dark',  { primaryMin: 7,  secondaryMin: 4.5, tertiaryMin: 3, actionMin: 4.5, borderTarget: 1.8, nonTextMin: 3 }),
    'hc-light': hcMk(white, black, light.floor, 'light', { primaryMin: 15, secondaryMin: 7, tertiaryMin: 4.5, actionMin: 7, borderTarget: 4.5, nonTextMin: 4.5 }),
    'hc-dark':  hcMk(black, white, dark.floor,  'dark',  { primaryMin: 15, secondaryMin: 7, tertiaryMin: 4.5, actionMin: 7, borderTarget: 4.5, nonTextMin: 4.5 }),
    // Wireframe (docs/11 Pillar 1b): the LIGHT surfaces + mins, but resolveMode redirects
    // every chromatic role to the neutral ramp (greyscale). A light-family greyscale mode —
    // its own contrast contract still holds (the neutral pick is nudged to clear each min).
    wireframe:  mk(light, 'light', { primaryMin: 7,  secondaryMin: 4.5, tertiaryMin: 3, actionMin: 4.5, borderTarget: 1.4, nonTextMin: 3 }),
  };
};

// Per-property interactive state members (the applicable subset of the vocabulary).
// Links (text.link) carry NO disabled state: a disabled link is an a11y anti-pattern
// (you remove the href / element, not grey it). Disabled text uses text.disabled.
const FILL_STATES = ['default', 'hover', 'pressed', 'focused', 'selected', 'disabled'] as const;
const LINK_STATES = ['default', 'hover', 'visited', 'focused'] as const;
const SEMANTICS = ['brand', 'success', 'warning', 'danger', 'info'] as const;

const resolveMode = (mode: ModeName, cfg: ModeCfg, theme: Theme, ramps: Map<string, Step[]>): ModeResult => {
  const ns = theme.namespace;
  const r2p = theme.roleToPalette;
  const neutral = ramps.get(r2p.neutral)!;
  const ramp: Cand[] = neutral.map((s) => cand(`${ns}.${r2p.neutral}.${s.key}`, s.rgb));
  const hc = mode.startsWith('hc');
  const textCands: Cand[] = hc ? [cand(`${ns}.white`, WHITE), ...ramp, cand(`${ns}.black`, BLACK)] : ramp;
  const baseRgb = cfg.surface.rgb;
  const floorRgb = cfg.floor.rgb;
  const invRgb = cfg.inverseSurface;
  const onMin = 4.5; // text on a saturated fill targets AA (a vivid mid-tone is gamut-bounded)

  const roles: Record<string, ResolvedRole> = {};
  const rated = (c: Cand, surf: RGB): Rated => ({ ...c, ratio: contrast(c.rgb, surf) });
  const put = (key: string, r: Rated, description: string, against: string, min: number) =>
    { roles[key] = { path: r.path, description, ratio: Math.round(r.ratio * 100) / 100, against, min, hex: hex(r.rgb) }; };
  const putSurf = (key: string, c: Cand, description: string) =>
    { roles[key] = { path: c.path, description, ratio: 1, against: 'self', min: 0, hex: hex(c.rgb) }; };

  const pStep = (palette: string, num: number): Cand => {
    const steps = ramps.get(palette)!;
    const s = steps.reduce((a, b) => (Math.abs(b.num - num) < Math.abs(a.num - num) ? b : a));
    return cand(`${ns}.${palette}.${s.key}`, s.rgb);
  };
  // Ink on a solid fill. The pure black/white extremes are softened to near-
  // extremes in standard modes (pure black reads harsh; pure white halates on a
  // dark ground) — but only where it applies: pure white survives in LIGHT mode
  // (the light fill isn't a dark ground), while DARK mode softens white → 025.
  // Black always softens → 950. HC keeps the pure extremes (low-vision contrast).
  // A pure-extreme fallback fires only if the softened pick can't clear `onMin`.
  const N025 = (): Cand => pStep(r2p.neutral, 25);
  const N950 = (): Cand => pStep(r2p.neutral, 950);
  const onColor = (fill: RGB): Rated => {
    if (hc) return pickMostExtreme([cand(`${ns}.white`, WHITE), cand(`${ns}.black`, BLACK)], fill);
    const lightCand = cfg.family === 'light' ? cand(`${ns}.white`, WHITE) : N025();  // light side: pure white in light, soft in dark
    const cL = rated(lightCand, fill), cD = rated(N950(), fill);
    const win = cL.ratio >= cD.ratio ? cL : cD;
    if (win.ratio >= onMin) return win;
    return rated(win === cL ? cand(`${ns}.white`, WHITE) : cand(`${ns}.black`, BLACK), fill); // pure fallback
  };
  // Wireframe (docs/11 Pillar 1b): a mechanical greyscale. Every CHROMATIC role resolves on
  // the NEUTRAL ramp at the position its colour pick would land — then re-nudged to clear the
  // same min on the neutral ramp, so the greyscale still holds each contrast contract. Roles
  // already neutral (backgrounds, text, borders) + white/black/alpha pass through untouched.
  const wf = mode === 'wireframe';
  const neutralPal = r2p.neutral;
  const palOf = (palette: string): string => (wf && palette !== neutralPal ? neutralPal : palette);
  const chromatic = (palette: string, anchorNum: number, surf: RGB, min: number): RatedNum => {
    const pick = pickBrand(ramps.get(palette)!, ns, palette, anchorNum, surf, min);
    return wf && palette !== neutralPal
      ? pickBrand(ramps.get(neutralPal)!, ns, neutralPal, pick.num, surf, min) // same position, greyscaled
      : pick;
  };
  const paletteRole = (r: Role, surf: RGB, min: number): RatedNum =>
    chromatic(r2p[r], theme.roleAnchorStep[r], surf, min);
  const dir = cfg.family === 'light' ? +1 : -1;
  const walk = (palette: string, fromNum: number, steps: number): Cand => pStep(palOf(palette), fromNum + dir * 50 * steps);
  const neutralLow = (): Cand => pStep(r2p.neutral, cfg.family === 'light' ? 200 : 750);
  const tintStep = cfg.family === 'light' ? 100 : 900;       // subtle semantic SURFACE tint
  const mutedStep = cfg.family === 'light' ? 450 : 350;      // muted semantic INK

  // Disabled-state strategy (theme-level). 'accessible' clears a floor so disabled
  // stays legible (KB's `inactive`); 'conventional' is the sub-AA exempt look.
  const accessibleDisabled = theme.disabledStrategy === 'accessible';
  const disabledTarget = hc ? Math.max(theme.disabledMin, 4.5) : theme.disabledMin;
  const disabledText = (): { r: Rated; against: string; min: number } =>
    accessibleDisabled
      ? { r: pickMinPass(textCands, floorRgb, disabledTarget), against: cfg.floorName, min: disabledTarget }
      : { r: pickClosest(textCands, baseRgb, 2), against: 'background.primary', min: 0 };
  // The label/ink on a DISABLED fill (action.disabled / foreground.danger.disabled,
  // both a muted neutral). A dedicated pair — Carbon's `text-on-color-disabled` —
  // resolved against the disabled FILL (not the page), so it stays muted-but-
  // legible on it rather than landing at the wrong contrast like `text.disabled`.
  const onDisabled = (): { r: Rated; against: string; min: number } => {
    const fill = neutralLow().rgb;                       // the shared disabled-fill colour
    return accessibleDisabled
      ? { r: pickMinPass(textCands, fill, disabledTarget), against: 'action.disabled', min: disabledTarget }
      : { r: pickClosest(textCands, fill, 2), against: 'action.disabled', min: 0 };
  };

  // -------------------------------------------------------------- backgrounds
  // The canvas: thin, page-level, tonal in both modes. `inverse.*` is the opposite-
  // polarity ladder (a dark band on a light page). In HC every tier == the base.
  putSurf('background.primary', cfg.bg.primary, 'Page surface — the canvas / base');
  putSurf('background.secondary', cfg.bg.secondary, 'Page surface, second tier — a slightly tinted page / band');
  putSurf('background.tertiary', cfg.bg.tertiary, 'Page surface, third tier');
  putSurf('background.inverse.primary', cfg.bgInverse.primary, 'Inverse page surface — a dark band in light mode');
  putSurf('background.inverse.secondary', cfg.bgInverse.secondary, 'Inverse page surface, second tier');
  putSurf('background.inverse.tertiary', cfg.bgInverse.tertiary, 'Inverse page surface, third tier');
  // scrim — semi-transparent backdrop behind modals/drawers (alpha; heavier in dark).
  const scrimStep = hc ? (cfg.family === 'light' ? 60 : 70) : (cfg.family === 'light' ? 40 : 60);
  put('scrim.default', { path: `${ns}.black-alpha.${scrimStep}`, rgb: BLACK, ratio: 1 },
    `Scrim — ${scrimStep}% black backdrop (modals / drawers)`, 'self', 0);

  // -------------------------------------------------------------- foregrounds
  // Surfaces & fills placed on the canvas. Neutral tonal ladder + inverse + bold
  // semantic fills + `-subtle` tints + the stateful `danger` fill. (`action` is
  // top-level, below.) `foreground.primary` sits on `background.primary`.
  putSurf('foreground.primary', cfg.fg.primary, 'Default surface placed on the page — a card');
  putSurf('foreground.secondary', cfg.fg.secondary, 'A second surface — a panel / nested container');
  putSurf('foreground.tertiary', cfg.fg.tertiary, 'A third surface step');
  putSurf('foreground.inverse.primary', cfg.fgInverse.primary, 'Inverse / bold surface — a dark fill in light mode');
  putSurf('foreground.inverse.secondary', cfg.fgInverse.secondary, 'Inverse surface, second tier');
  putSurf('foreground.inverse.tertiary', cfg.fgInverse.tertiary, 'Inverse surface, third tier');
  // bold semantic fills (filled badge / banner / button at rest) — static.
  const fills: Partial<Record<Role, RatedNum>> = {};
  for (const r of ['brand', 'success', 'warning', 'info'] as const) {
    const f = paletteRole(r, floorRgb, cfg.actionMin);
    fills[r] = f;
    put(`foreground.${r}`, f, `Bold ${r} fill — clears ${cfg.actionMin}:1 on the floor (${cfg.floorName})`, cfg.floorName, cfg.actionMin);
  }
  // subtle semantic tint SURFACES (light banner/badge fills) — pair with text.{r}.
  for (const r of SEMANTICS)
    putSurf(`foreground.${r}-subtle`, pStep(palOf(r2p[r]), tintStep), `Subtle ${r} tint surface — banners, badges, selected rows`);
  // danger — the one stateful semantic fill (destructive buttons).
  const dangerRest = paletteRole('danger', floorRgb, cfg.actionMin);
  fills.danger = dangerRest;
  const fillStateCand = (rest: RatedNum, palette: string, st: typeof FILL_STATES[number]): Cand =>
    st === 'default' ? rest
    : st === 'hover' || st === 'focused' ? walk(palette, rest.num, 1)
    : st === 'pressed' || st === 'selected' ? walk(palette, rest.num, 2)
    : neutralLow(); // disabled
  for (const st of FILL_STATES) {
    const d = fillStateCand(dangerRest, r2p.danger, st);
    put(`foreground.danger.${st}`, rated(d, st === 'disabled' ? baseRgb : floorRgb),
      `Danger / destructive fill — ${st}`, st === 'disabled' ? 'background.primary' : cfg.floorName, st === 'disabled' ? 0 : cfg.actionMin);
  }

  // ------------------------------------------------------------------- action
  // The interactive fill + states (top-level — Prism2 + KB). Its text/border
  // expressions are text.link.* and border.focus.
  const actionRest = paletteRole('action', floorRgb, cfg.actionMin);
  for (const st of FILL_STATES) {
    const c = fillStateCand(actionRest, r2p.action, st);
    put(`action.${st}`, rated(c, st === 'disabled' ? baseRgb : floorRgb),
      `Interactive (action) fill — ${st}`, st === 'disabled' ? 'background.primary' : cfg.floorName, st === 'disabled' ? 0 : cfg.actionMin);
  }

  // -------------------------------------------------------------- text (+ icon)
  // Ink. Built from a floor PROFILE so `text` (4.5:1) and `icon` can diverge: with
  // iconContrast '3:1' icons resolve against the WCAG 1.4.11 non-text floor for
  // secondary/tertiary/semantic — `primary` stays strong either way.
  type Spec = { key: string; r: Rated; desc: string; against: string; min: number };
  type Profile = { label: string; secondaryMin: number; tertiaryMin: number; semanticMin: number };
  const buildContent = (p: Profile): Spec[] => {
    const out: Spec[] = [];
    const T = (key: string, r: Rated, desc: string, against: string, min: number) => out.push({ key, r, desc, against, min });
    T('primary', pickMostExtreme(textCands, baseRgb), `Primary ${p.label} — strongest neutral`, 'background.primary', cfg.primaryMin);
    T('secondary', pickMinPass(textCands, floorRgb, p.secondaryMin), `Secondary ${p.label} — ${p.secondaryMin}:1 on the floor`, cfg.floorName, p.secondaryMin);
    T('tertiary', pickMinPass(textCands, floorRgb, p.tertiaryMin), `Tertiary ${p.label} — ${p.tertiaryMin}:1 on the floor`, cfg.floorName, p.tertiaryMin);
    { const d = disabledText(); T('disabled', d.r, accessibleDisabled ? `Disabled ${p.label} — clears ${disabledTarget}:1 (accessible)` : `Disabled ${p.label} — sub-AA (WCAG-exempt)`, d.against, d.min); }
    // bold semantic ink
    for (const r of SEMANTICS)
      T(r, paletteRole(r, floorRgb, p.semanticMin), `${r} ${p.label} — ${p.semanticMin}:1 on the floor`, cfg.floorName, p.semanticMin);
    // muted semantic ink (the "quiet" variant) — designer's judgment for emphasis.
    for (const r of SEMANTICS)
      T(`${r}-subtle`, rated(pStep(palOf(r2p[r]), mutedStep), baseRgb), `Muted ${r} ${p.label} — low-emphasis accent`, 'background.primary', 0);
    // on-* pairs (ink on a solid fill) — AA on a vivid fill.
    T('on-action', onColor(actionRest.rgb), `${p.label} on the action fill`, 'action.default', onMin);
    for (const r of SEMANTICS)
      T(`on-${r}`, onColor(fills[r]!.rgb), `${p.label} on a solid ${r} fill`, `foreground.${r}`, onMin);
    T('on-inverse', pickMostExtreme(textCands, invRgb), `${p.label} on an inverse surface`, 'background.inverse.primary', cfg.secondaryMin);
    { const d = onDisabled(); T('on-disabled', d.r, `${p.label} on a disabled fill — muted, clears ${d.min}:1`, d.against, d.min); }
    // link (interactive text) + states — no disabled.
    const linkStateCand = (st: typeof LINK_STATES[number]): Cand =>
      st === 'default' || st === 'focused' ? actionRest
      : st === 'hover' ? walk(r2p.action, actionRest.num, 1)
      : walk(r2p.action, actionRest.num, 2); // visited
    for (const st of LINK_STATES)
      T(`link.${st}`, rated(linkStateCand(st), floorRgb), `Link ${p.label} — ${st}`, cfg.floorName, p.semanticMin);
    return out;
  };

  const textProfile: Profile = { label: 'text', secondaryMin: cfg.secondaryMin, tertiaryMin: cfg.tertiaryMin, semanticMin: cfg.actionMin };
  for (const s of buildContent(textProfile)) put(`text.${s.key}`, s.r, s.desc, s.against, s.min);
  const iconSpecs = theme.iconContrast === '3:1'
    ? buildContent({ label: 'icon', secondaryMin: cfg.nonTextMin, tertiaryMin: cfg.nonTextMin, semanticMin: cfg.nonTextMin })
    : buildContent({ ...textProfile, label: 'icon' });
  for (const s of iconSpecs) put(`icon.${s.key}`, s.r, s.desc, s.against, s.min);

  // ------------------------------------------------------------------- borders
  // Neutral (primary/secondary), inverse, semantic, and the focus ring. In HC the
  // border targets escalate — borders carry structure when surfaces flatten.
  put('border.primary', pickClosest(ramp, baseRgb, cfg.borderTarget), `Default border — decorative, ~${cfg.borderTarget}:1`, 'background.primary', 0);
  put('border.secondary', pickClosest(ramp, baseRgb, cfg.borderTarget * 2.2), 'Stronger border / divider', 'background.primary', 0);
  put('border.inverse', pickClosest(ramp, invRgb, cfg.borderTarget), 'Border on inverse surfaces', 'background.inverse.primary', 0);
  for (const r of SEMANTICS)
    put(`border.${r}`, rated(chromatic(r2p[r], 500, baseRgb, cfg.nonTextMin), baseRgb), `${r} border — ${cfg.nonTextMin}:1 (SC 1.4.11)`, 'background.primary', cfg.nonTextMin);
  put('border.focus', rated(actionRest, baseRgb), 'Focus ring colour (keyboard focus)', 'background.primary', cfg.nonTextMin);

  return { mode, surface: baseRgb, roles };
};

export const resolveAllModes = (theme: Theme): ModeResult[] => {
  const ramps = new Map(theme.palettes.map((p) => [p.palette, p.steps] as const));
  const neutral = ramps.get(theme.roleToPalette.neutral)!;
  const cfgs = modeConfigs(theme.namespace, theme.roleToPalette.neutral, neutral, theme.surfaces);
  // Only the modes the brand opted into (light always; dark/HC opt-in — docs/11 Pillar 1).
  // Canonical order preserved (Object.keys order), so `rp.modes` is stable regardless of input order.
  return (Object.keys(cfgs) as ModeName[]).filter((m) => theme.modes.includes(m)).map((m) => resolveMode(m, cfgs[m], theme, ramps));
};
