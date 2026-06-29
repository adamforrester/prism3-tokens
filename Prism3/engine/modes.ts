/**
 * Prism3 engine — appearance modes (light / dark / high-contrast).
 *
 * Modes do NOT regenerate primitives. The ramps are shared; what changes per
 * mode is which primitive STEP each semantic role resolves to — derived by
 * contrast target against the mode's own surface, not hand-mapped.
 *
 * Semantic model — PROPERTY-LED (decided with the practice, NB-faithful):
 *   color / <property> / <variant> [ / <state> ]
 *   - background  — inert container surfaces (page/raised/sunken/tints).
 *   - foreground  — element FILLS (a component's own solid colour). NB's meaning
 *                   of "foreground": the fill, NOT the text.
 *   - text        — text colours.
 *   - icon        — icon colours. A full peer group; for now it SHARES text's
 *                   values (mirrors text). A future toggle can relax icons to the
 *                   3:1 non-text floor so they diverge — see 03-open-questions.
 *   - border      — border colours.
 * Interactivity is a per-property `interactive` variant carrying STATES
 * (default/hover/pressed/focused/visited/selected/disabled — the applicable
 * subset). Semantic intents are static EXCEPT `danger`, which carries fill states
 * (destructive buttons). Inverse is modest (a primary `inverse` per property),
 * leaning on per-mode resolution for actual dark mode.
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

/** Elevation set for a mode: the non-interactive container fills. An ordinal,
 * use-case-neutral ladder (primary=page … quaternary=floating). In LIGHT the
 * raised tiers converge in colour (elevation is carried by shadow — a deferred
 * effects axis); in DARK they step lighter (the M3 lift pattern). In HIGH
 * CONTRAST the raised tiers + subtle FLATTEN to the base surface: HC separates
 * regions by BORDER (the HC border target is ≥4.5:1), not by near-invisible
 * surface tints, so a false ladder of barely-distinguishable steps is wrong. */
type BgSet = { primary: Cand; secondary: Cand; tertiary: Cand; quaternary: Cand; subtle: Cand; sunken: Cand; inverse: Cand };

export type ModeCfg = {
  surface: Cand;            // base page surface
  floor: Cand; floorName: string;  // contrast floor (worst-case supported surface)
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
      ? { primary: base, secondary: white, tertiary: white, quaternary: white, subtle: floor, sunken: n(floorStep + 150), inverse: n(875) }
      : { primary: base, secondary: n(baseNum - 50), tertiary: n(baseNum - 100), quaternary: n(baseNum - 150), subtle: n(baseNum - 50), sunken: black, inverse: n(125) };
    return { base, floor, bg };
  };

  const light = resolve('light', 'white');
  const dark = resolve('dark', 950);
  // High-contrast elevation: flatten the raised ladder + subtle to the base so HC
  // elevation is carried by BORDER, not by near-invisible surface tints (HC users
  // can't distinguish neutral.900/850/800 on black). `sunken` (a genuinely useful
  // recessed cue) and `inverse` are kept from the family.
  const hcBg = (famBg: BgSet, base: Cand): BgSet => ({ ...famBg, primary: base, secondary: base, tertiary: base, quaternary: base, subtle: base });
  const mk = (r: { base: Cand; floor: Cand; bg: BgSet }, family: 'light' | 'dark', inverseSurface: RGB, mins: Pick<ModeCfg, 'primaryMin' | 'secondaryMin' | 'tertiaryMin' | 'actionMin' | 'borderTarget' | 'nonTextMin'>): ModeCfg =>
    ({ surface: r.base, floor: r.floor, floorName: short(r.floor), bg: r.bg, inverseSurface, family, ...mins });

  return {
    light:      mk(light, 'light', BLACK, { primaryMin: 7,  secondaryMin: 4.5, tertiaryMin: 3, actionMin: 4.5, borderTarget: 1.4, nonTextMin: 3 }),
    dark:       mk(dark,  'dark',  WHITE, { primaryMin: 7,  secondaryMin: 4.5, tertiaryMin: 3, actionMin: 4.5, borderTarget: 1.8, nonTextMin: 3 }),
    'hc-light': mk({ base: cand(`${ns}.white`, WHITE), floor: light.floor, bg: hcBg(light.bg, cand(`${ns}.white`, WHITE)) }, 'light', BLACK, { primaryMin: 15, secondaryMin: 7, tertiaryMin: 4.5, actionMin: 7, borderTarget: 4.5, nonTextMin: 4.5 }),
    'hc-dark':  mk({ base: cand(`${ns}.black`, BLACK), floor: dark.floor, bg: hcBg(dark.bg, cand(`${ns}.black`, BLACK)) }, 'dark', WHITE, { primaryMin: 15, secondaryMin: 7, tertiaryMin: 4.5, actionMin: 7, borderTarget: 4.5, nonTextMin: 4.5 }),
  };
};

// Per-property interactive state members (the applicable subset of the vocabulary).
// Links (text.interactive) carry NO disabled state: a disabled link is an a11y
// anti-pattern (you remove the href / element, not grey it), and it resolved to the
// exact same value as text.disabled — a duplicate token with no distinct decision.
// Disabled text uses text.disabled; disabled buttons use foreground.interactive.disabled.
const FILL_STATES = ['default', 'hover', 'pressed', 'focused', 'selected', 'disabled'] as const;
const TEXT_STATES = ['default', 'hover', 'visited', 'focused'] as const;
const BORDER_STATES = ['default', 'hover', 'focused', 'disabled'] as const;

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
  const tintStep = cfg.family === 'light' ? 100 : 900;
  const dir = cfg.family === 'light' ? +1 : -1;
  // Text on a SATURATED fill targets AA (4.5), not the mode's escalated bar: a
  // vivid mid-tone is gamut-bounded — no pure black/white text reaches 7:1 on it.
  const onMin = 4.5;

  const roles: Record<string, ResolvedRole> = {};
  const rated = (c: Cand, surf: RGB): Rated => ({ ...c, ratio: contrast(c.rgb, surf) });
  const put = (key: string, r: Rated, description: string, against: string, min: number) =>
    { roles[key] = { path: r.path, description, ratio: Math.round(r.ratio * 100) / 100, against, min }; };
  const putSurf = (key: string, c: Cand, description: string) =>
    { roles[key] = { path: c.path, description, ratio: 1, against: 'self', min: 0 }; };

  const pStep = (palette: string, num: number): Cand => {
    const steps = ramps.get(palette)!;
    const s = steps.reduce((a, b) => (Math.abs(b.num - num) < Math.abs(a.num - num) ? b : a));
    return cand(`${ns}.${palette}.${s.key}`, s.rgb);
  };
  const onColor = (fill: RGB): Rated => pickMostExtreme([cand(`${ns}.white`, WHITE), cand(`${ns}.black`, BLACK)], fill);
  const paletteRole = (r: Role, surf: RGB, min: number): RatedNum =>
    pickBrand(ramps.get(r2p[r])!, ns, r2p[r], theme.roleAnchorStep[r], surf, min);
  const walk = (palette: string, fromNum: number, steps: number): Cand => pStep(palette, fromNum + dir * 50 * steps);
  const neutralLow = (): Cand => pStep(r2p.neutral, cfg.family === 'light' ? 200 : 750);

  // Disabled-state strategy (theme-level). 'accessible' clears a floor so disabled
  // stays legible (KB's `inactive`); 'conventional' is the sub-AA exempt look.
  // The accessible floor escalates to 4.5 in HC so disabled holds for HC users.
  const accessibleDisabled = theme.disabledStrategy === 'accessible';
  const disabledTarget = hc ? Math.max(theme.disabledMin, 4.5) : theme.disabledMin;
  // A disabled text/icon pick + its contract (against the floor when accessible).
  const disabledText = (): { r: Rated; against: string; min: number } =>
    accessibleDisabled
      ? { r: pickMinPass(textCands, floorRgb, disabledTarget), against: cfg.floorName, min: disabledTarget }
      : { r: pickClosest(textCands, baseRgb, 2), against: 'background.primary', min: 0 };
  // A disabled border pick (non-text floor when accessible).
  const disabledBorder = (): { r: Rated; against: string; min: number } =>
    accessibleDisabled
      ? { r: pickMinPass(ramp, baseRgb, Math.min(disabledTarget, cfg.nonTextMin)), against: 'background.primary', min: Math.min(disabledTarget, cfg.nonTextMin) }
      : { r: rated(neutralLow(), baseRgb), against: 'background.primary', min: 0 };

  // ---------------------------------------------------------------- backgrounds
  const bg = cfg.bg;
  // Elevation ladder — ordinal, use-case-neutral (primary=page … quaternary=floating).
  // Light tiers converge in colour (shadow carries elevation — deferred effects axis);
  // dark tiers step lighter. Component→tier mapping (card→secondary, dialog→quaternary)
  // is documentation, not baked into the token name.
  putSurf('background.primary', bg.primary, 'Page surface (elevation 1 — base)');
  putSurf('background.secondary', bg.secondary, 'Raised surface (elevation 2 — cards / panels)');
  putSurf('background.tertiary', bg.tertiary, 'Higher surface (elevation 3 — nested / menus)');
  putSurf('background.quaternary', bg.quaternary, 'Floating surface (elevation 4 — dialogs / popovers)');
  putSurf('background.subtle', bg.subtle, 'Subtle surface — muted grouped fill (off the ladder)');
  putSurf('background.sunken', bg.sunken, 'Sunken surface — wells / insets (below the page)');
  putSurf('background.inverse', bg.inverse, 'Inverse surface');
  for (const r of ['brand', 'success', 'warning', 'danger', 'info'] as const)
    putSurf(`background.${r}-subtle`, pStep(r2p[r], tintStep), `Subtle ${r} tint`);
  // scrim — semi-transparent backdrop behind modals/drawers. Alpha-based
  // (aliases the black-alpha primitive ramp), heavier in dark per the field
  // (Spectrum/Fluent/Radix). Not a contrast contract.
  const scrimStep = hc ? (cfg.family === 'light' ? 60 : 70) : (cfg.family === 'light' ? 40 : 60);
  put('scrim.default', { path: `${ns}.black-alpha.${scrimStep}`, rgb: BLACK, ratio: 1 },
    `Scrim — ${scrimStep}% black backdrop (modals / drawers)`, 'self', 0);

  // ----------------------------------------------------------- foreground FILLS
  // Neutral fills (emphasis tiers used as element fills — e.g. neutral buttons).
  put('foreground.primary', pickMostExtreme(ramp, baseRgb), 'Strong neutral fill — high-emphasis neutral element', 'background.primary', 0);
  put('foreground.secondary', rated(pStep(r2p.neutral, cfg.family === 'light' ? 200 : 700), baseRgb), 'Medium neutral fill', 'background.primary', 0);
  put('foreground.tertiary', rated(pStep(r2p.neutral, cfg.family === 'light' ? 100 : 800), baseRgb), 'Subtle neutral fill', 'background.primary', 0);
  put('foreground.inverse', rated(pStep(r2p.neutral, cfg.family === 'light' ? 50 : 900), baseRgb), 'Inverse neutral fill — for inverse contexts', 'background.inverse', 0);
  // Static semantic fills (filled badges/banners/buttons at rest).
  const fills: Partial<Record<Role, RatedNum>> = {};
  for (const r of ['brand', 'success', 'warning', 'info'] as const) {
    const f = paletteRole(r, floorRgb, cfg.actionMin);
    fills[r] = f;
    put(`foreground.${r}`, f, `${r} fill — clears ${cfg.actionMin}:1 on the floor (${cfg.floorName})`, cfg.floorName, cfg.actionMin);
  }
  // danger fill — the one stateful semantic (destructive buttons).
  const dangerRest = paletteRole('danger', floorRgb, cfg.actionMin);
  fills.danger = dangerRest;
  // interactive (accent/action) fill.
  const intRest = paletteRole('action', floorRgb, cfg.actionMin);
  // Emit the two stateful fills.
  const fillStateCand = (rest: RatedNum, palette: string, st: typeof FILL_STATES[number]): Cand =>
    st === 'default' ? rest
    : st === 'hover' || st === 'focused' ? walk(palette, rest.num, 1)
    : st === 'pressed' || st === 'selected' ? walk(palette, rest.num, 2)
    : neutralLow(); // disabled
  for (const st of FILL_STATES) {
    const c = fillStateCand(intRest, r2p.action, st);
    put(`foreground.interactive.${st}`, rated(c, st === 'disabled' ? baseRgb : floorRgb),
      `Interactive fill (action) — ${st}`, st === 'disabled' ? 'background.primary' : cfg.floorName, st === 'disabled' ? 0 : cfg.actionMin);
    const d = fillStateCand(dangerRest, r2p.danger, st);
    put(`foreground.danger.${st}`, rated(d, st === 'disabled' ? baseRgb : floorRgb),
      `Danger / destructive fill — ${st}`, st === 'disabled' ? 'background.primary' : cfg.floorName, st === 'disabled' ? 0 : cfg.actionMin);
  }

  // -------------------------------------------------------------- text (+ icon)
  // Content specs built from a floor PROFILE so `text` (4.5:1) and `icon` can
  // diverge: with iconContrast '3:1' icons resolve against the WCAG 1.4.11
  // non-text floor (3:1) for secondary/tertiary/semantic/link — `primary` stays
  // strong either way. With 'text' (default) icons mirror text exactly.
  type Spec = { key: string; r: Rated; desc: string; against: string; min: number };
  type Profile = { label: string; secondaryMin: number; tertiaryMin: number; semanticMin: number };
  const buildContent = (p: Profile): Spec[] => {
    const out: Spec[] = [];
    const T = (key: string, r: Rated, desc: string, against: string, min: number) => out.push({ key, r, desc, against, min });
    T('primary', pickMostExtreme(textCands, baseRgb), `Primary ${p.label} — strongest neutral`, 'background.primary', cfg.primaryMin);
    T('secondary', pickMinPass(textCands, floorRgb, p.secondaryMin), `Secondary ${p.label} — ${p.secondaryMin}:1 on the floor`, cfg.floorName, p.secondaryMin);
    T('tertiary', pickMinPass(textCands, floorRgb, p.tertiaryMin), `Tertiary ${p.label} — ${p.tertiaryMin}:1 on the floor`, cfg.floorName, p.tertiaryMin);
    { const d = disabledText(); T('disabled', d.r, accessibleDisabled ? `Disabled ${p.label} — clears ${disabledTarget}:1 (accessible)` : `Disabled ${p.label} — sub-AA (WCAG-exempt)`, d.against, d.min); }
    T('inverse', pickMostExtreme(textCands, invRgb), `Inverse ${p.label} — on the opposite surface`, 'background.inverse', cfg.secondaryMin);
    for (const r of ['brand', 'success', 'warning', 'danger', 'info'] as const)
      T(r, paletteRole(r, floorRgb, p.semanticMin), `${r} ${p.label} — ${p.semanticMin}:1 on the floor`, cfg.floorName, p.semanticMin);
    // on-* pair labels (content on a solid fill) — AA on a vivid fill.
    T('on-interactive', onColor(intRest.rgb), `${p.label} on the interactive fill`, 'foreground.interactive.default', onMin);
    for (const r of ['brand', 'success', 'warning', 'danger', 'info'] as const)
      T(`on-${r}`, onColor(fills[r]!.rgb), `${p.label} on a solid ${r} fill`, `foreground.${r}`, onMin);
    T('on-emphasis', onColor(invRgb), `${p.label} on an emphasis / inverse fill`, 'background.inverse', cfg.secondaryMin);
    // interactive (links) + states.
    const linkRest = paletteRole('action', floorRgb, p.semanticMin);
    const linkStateCand = (st: typeof TEXT_STATES[number]): Cand =>
      st === 'default' || st === 'focused' ? linkRest
      : st === 'hover' ? walk(r2p.action, linkRest.num, 1)
      : st === 'visited' ? walk(r2p.action, linkRest.num, 2)
      : neutralLow();
    for (const st of TEXT_STATES) {
      // No `disabled` for links — see TEXT_STATES note (disabled links are an
      // anti-pattern; disabled text uses text.disabled).
      T(`interactive.${st}`, rated(linkStateCand(st), floorRgb), `Link ${p.label} — ${st}`, cfg.floorName, p.semanticMin);
    }
    return out;
  };

  const textProfile: Profile = { label: 'text', secondaryMin: cfg.secondaryMin, tertiaryMin: cfg.tertiaryMin, semanticMin: cfg.actionMin };
  for (const s of buildContent(textProfile)) put(`text.${s.key}`, s.r, s.desc, s.against, s.min);
  // icon: mirror text, or (iconContrast '3:1') resolve against the non-text floor.
  const iconSpecs = theme.iconContrast === '3:1'
    ? buildContent({ label: 'icon', secondaryMin: cfg.nonTextMin, tertiaryMin: cfg.nonTextMin, semanticMin: cfg.nonTextMin })
    : buildContent({ ...textProfile, label: 'icon' });
  for (const s of iconSpecs) put(`icon.${s.key}`, s.r, s.desc, s.against, s.min);

  // ------------------------------------------------------------------- borders
  put('border.default', pickClosest(ramp, baseRgb, cfg.borderTarget), `Default border — decorative, ~${cfg.borderTarget}:1`, 'background.primary', 0);
  put('border.strong', pickClosest(ramp, baseRgb, cfg.borderTarget * 2.2), 'Stronger border / divider', 'background.primary', 0);
  put('border.inverse', pickClosest(ramp, invRgb, cfg.borderTarget), 'Inverse border', 'background.inverse', 0);
  for (const r of ['brand', 'success', 'warning', 'danger', 'info'] as const)
    put(`border.${r}`, rated(pickBrand(ramps.get(r2p[r])!, ns, r2p[r], 500, baseRgb, cfg.nonTextMin), baseRgb), `${r} border — ${cfg.nonTextMin}:1 (SC 1.4.11)`, 'background.primary', cfg.nonTextMin);
  // interactive (input/control) border + states; focus ring = .focused.
  const borderRest = pickMinPass(ramp, baseRgb, cfg.nonTextMin);
  const borderStateCand = (st: typeof BORDER_STATES[number]): Cand =>
    st === 'default' ? borderRest
    : st === 'hover' ? pickClosest(ramp, baseRgb, cfg.nonTextMin * 1.6)
    : st === 'focused' ? intRest
    : neutralLow(); // disabled
  for (const st of BORDER_STATES) {
    if (st === 'disabled') { const d = disabledBorder(); put('border.interactive.disabled', d.r, 'Form-field / control border — disabled', d.against, d.min); continue; }
    put(`border.interactive.${st}`, rated(borderStateCand(st), baseRgb), `Form-field / control border — ${st}`, 'background.primary', cfg.nonTextMin);
  }

  return { mode, surface: baseRgb, roles };
};

export const resolveAllModes = (theme: Theme): ModeResult[] => {
  const ramps = new Map(theme.palettes.map((p) => [p.palette, p.steps] as const));
  const neutral = ramps.get(theme.roleToPalette.neutral)!;
  const cfgs = modeConfigs(theme.namespace, theme.roleToPalette.neutral, neutral, theme.surfaces);
  return (Object.keys(cfgs) as ModeName[]).map((m) => resolveMode(m, cfgs[m], theme, ramps));
};
