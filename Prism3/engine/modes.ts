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
 *   - interactive — the coherent interactive colour family (docs/20): every
 *                  interactive element's colour, `interactive.<color>.<slot>`.
 *   - disabled   — the one cross-cutting disabled treatment, any intent.
 *   - border     — neutral (`primary`/`secondary`), `inverse`, semantic, `focus`.
 *
 * Light & dark step surfaces tonally and SYMMETRICALLY (light is no longer all
 * white); shadow is an additive elevation cue, not the sole differentiator. In
 * HIGH CONTRAST the neutral surface ladders flatten to the base — HC separates
 * regions by BORDER (the ≥4.5:1 border target), not by near-invisible tints.
 */
import { RGB, contrast, hex, composite } from './color';
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

// `ratio` is the RAW WCAG contrast (un-rounded) — compare it directly against `min`; round
// only when serialising (CR-01). `min` of 0 means "not a contrast-gated role" (surfaces).
export type ResolvedRole = { path: string; description: string; ratio: number; against: string; min: number; hex: string; alpha?: number };
// Per-mode colour override layer (Phase A1). A `PrimitiveRef` repoints a resolved role at an
// EXISTING primitive step in ANY palette (no raw colours); a `ModeOverrides` map is rolePath →
// ref, applied only to the customizable modes (light/dark). An `OverrideWarning` records a
// hand-tuned override that still applies + emits but fails its role's contrast min (WARN, never block).
export type PrimitiveRef = { palette: string; step: string };
export type ModeOverrides = Record<string, PrimitiveRef>;   // rolePath -> primitive step ref
export type OverrideWarning = { role: string; ratio: number; min: number };
export type ModeResult = { mode: ModeName; surface: RGB; roles: Record<string, ResolvedRole>; warnings?: OverrideWarning[] };

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
// (you remove the href / element, not grey it). Disabled uses the cross-cutting disabled.*.
// Interactive fill states (docs/20 §2): rest/hover/pressed + focused/selected. Disabled is
// NOT a per-fill state — it's the one cross-cutting disabled.* family (one treatment, any intent).
const FILL_STATES = ['default', 'hover', 'pressed', 'focused', 'selected'] as const;
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
  // The resolved rgb behind each role key — the override post-pass (Phase A1) reads it to
  // re-derive an overridden role's contrast against its `against` role's actual colour.
  const rgbByRole = new Map<string, RGB>();
  const rated = (c: Cand, surf: RGB): Rated => ({ ...c, ratio: contrast(c.rgb, surf) });
  // ratio is the RAW contrast — every gate/pass check compares it against `min` un-rounded
  // (CR-01). Rounding to 2dp happens only where it's serialised (tree.ts / ai-metadata.ts).
  const put = (key: string, r: Rated, description: string, against: string, min: number) =>
    { roles[key] = { path: r.path, description, ratio: r.ratio, against, min, hex: hex(r.rgb) }; rgbByRole.set(key, r.rgb); };
  const putSurf = (key: string, c: Cand, description: string) =>
    { roles[key] = { path: c.path, description, ratio: 1, against: 'self', min: 0, hex: hex(c.rgb) }; rgbByRole.set(key, c.rgb); };

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
  // Interactive-state direction: hover/pressed step the fill toward MORE contrast with the
  // page it sits on — darker in a light mode (dir +1 = higher/darker step), lighter in a dark
  // mode (dir -1). As the user engages (rest → hover → pressed) the control grows more prominent
  // ("comes forward"), and the same move keeps the on-fill label legible (a darker fill lifts a
  // white label's contrast; a lighter fill lifts a dark label's). At a ramp END the forward walk
  // would overshoot and collapse the states onto one step — `walk` reflects inward there (L-01),
  // i.e. an action colour pinned at the far end steps the OTHER way rather than saturating.
  const dir = cfg.family === 'light' ? +1 : -1;
  const walk = (palette: string, fromNum: number, steps: number): Cand => {
    const pal = palOf(palette);
    const ramp = ramps.get(pal)!;
    const near = (n: number) => ramp.reduce((a, b) => (Math.abs(b.num - n) < Math.abs(a.num - n) ? b : a));
    const lo = ramp.reduce((m, s) => Math.min(m, s.num), Infinity);
    const hi = ramp.reduce((m, s) => Math.max(m, s.num), -Infinity);
    // Distinctness (L-01): the forward walk is fromNum + dir*50*steps. When that
    // OVERSHOOTS the ramp end, `near` clamps it to the terminal step — so two
    // different step-counts (hover=1, pressed=2) collapse onto the SAME terminal
    // step and the interactive states become visually indistinguishable. Each
    // state's contrast is gated, but their mutual distinctness never was. On
    // overshoot, reflect and walk inward the other way, preserving the step-count
    // separation. Inward is toward mid-ramp, so it stays within the gamut the
    // ramp already vetted; the contract gate still guards each state's contrast.
    const fwd = fromNum + dir * 50 * steps;
    const target = fwd < lo || fwd > hi ? fromNum - dir * 50 * steps : fwd;
    const s = near(target);
    return cand(`${ns}.${pal}.${s.key}`, s.rgb);
  };
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
  // The label/ink on a DISABLED fill (disabled.fill, a muted neutral). A dedicated
  // pair — Carbon's `text-on-color-disabled` — resolved against the disabled FILL (not
  // the page), so it stays muted-but-legible on it rather than landing at the wrong
  // contrast like `disabled.text`. Feeds the cross-cutting `disabled.on-fill`.
  const onDisabled = (): { r: Rated; against: string; min: number } => {
    const fill = neutralLow().rgb;                       // the shared disabled-fill colour
    return accessibleDisabled
      ? { r: pickMinPass(textCands, fill, disabledTarget), against: 'disabled.fill', min: disabledTarget }
      : { r: pickClosest(textCands, fill, 2), against: 'disabled.fill', min: 0 };
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
  // danger — a bold semantic fill like the others (kept out of the loop above only to
  // preserve its position + set fills.danger for the on-danger ink pairing). Its stateful /
  // interactive expression now lives in `interactive.destructive.*` (docs/20), so the fill
  // itself is static — there is no per-state danger fill.
  const dangerRest = paletteRole('danger', floorRgb, cfg.actionMin);
  fills.danger = dangerRest;
  put('foreground.danger', dangerRest, `Bold danger fill — clears ${cfg.actionMin}:1 on the floor (${cfg.floorName})`, cfg.floorName, cfg.actionMin);
  // Interactive fill states walk the palette (rest → hover/focused +1 → pressed/selected +2).
  const fillStateCand = (rest: RatedNum, palette: string, st: typeof FILL_STATES[number]): Cand =>
    st === 'default' ? rest
    : st === 'hover' || st === 'focused' ? walk(palette, rest.num, 1)
    : walk(palette, rest.num, 2); // pressed | selected

  // The action palette's rest colour — the source for interactive.primary, the focus ring,
  // and link states. (The legacy top-level `action.*` fill is retired: components bind
  // `interactive.primary.*`, docs/20 §16.) `actionAnchorStep` overrides the resolved anchor
  // (docs/20 §3) — anchor the action rest at an explicit palette step; unset keeps today's pick.
  // A2b — a per-mode interactive anchor (`theme.modeAnchors[mode][col]`) re-anchors the whole
  // column for THIS mode (rest → hover/pressed/on-fill all re-derive from it), still floor-gated;
  // absent → the global anchor, so an unset map is byte-identical. Columns: 'primary'/'destructive'/accent.
  const modeAnchor = (col: string): number | undefined => theme.modeAnchors?.[mode]?.[col];
  const paAnchor = modeAnchor('primary') ?? theme.actionAnchorStep;
  const actionRest = paAnchor !== undefined
    ? chromatic(r2p.action, paAnchor, floorRgb, cfg.actionMin)
    : paletteRole('action', floorRgb, cfg.actionMin);

  // ------------------------------------------------------- interactive family
  // The coherent, generated, contrast-gated interactive colour family (docs/20) — the ONE
  // home for every interactive element's colour: `interactive.<color>.<slot>`. Colours:
  // primary (the action palette) · neutral · destructive; any number of extra columns are opt-in
  // via `interactivePalettes` (docs/20 §3). Slots: fill (+ its rest/hover/pressed/focused/selected states),
  // on-fill (ink), text (outline/text ink), border. Disabled is NOT per-colour here — it is
  // the cross-cutting disabled.* family below. This is what components bind (docs/20 §16.3).
  const iFill = (name: string, rest: RatedNum, palette: string, fillMin: number) => {
    for (const st of FILL_STATES) {
      const c = fillStateCand(rest, palette, st);
      // The interactive family leads with `rest` (docs/20 §2 — rest/hover/pressed);
      // the base-state key `default` is kept only on the non-interactive roles.
      const stKey = st === 'default' ? 'rest' : st;
      put(`interactive.${name}.fill.${stKey}`, rated(c, floorRgb),
        `${name} interactive fill — ${stKey}`, cfg.floorName, fillMin);
    }
    put(`interactive.${name}.on-fill`, onColor(rest.rgb), `Ink on the ${name} interactive fill`, `interactive.${name}.fill.rest`, onMin);
  };
  // Neutral fill anchor — a subtle grey by default (neutralEmphasis lever, later).
  // Returns a RatedNum so its states can walk the neutral ramp like any palette.
  const neutralStepR = (num: number): RatedNum => {
    const steps = ramps.get(r2p.neutral)!;
    const s = steps.reduce((a, b) => (Math.abs(b.num - num) < Math.abs(a.num - num) ? b : a));
    return { path: `${ns}.${r2p.neutral}.${s.key}`, rgb: s.rgb, num: s.num, ratio: contrast(s.rgb, floorRgb) };
  };

  // primary — the action palette, contrast-verified.
  iFill('primary', actionRest, r2p.action, cfg.actionMin);
  put('interactive.primary.text', paletteRole('action', baseRgb, cfg.secondaryMin), 'Primary interactive ink (outline / text appearance)', 'background.primary', cfg.secondaryMin);
  put('interactive.primary.border', rated(chromatic(r2p.action, 500, baseRgb, cfg.nonTextMin), baseRgb), 'Primary interactive border (outline)', 'background.primary', cfg.nonTextMin);

  // destructive — the danger palette (its own interactive column, no scavenging).
  // `destructiveAnchorStep` overrides the resolved anchor (docs/20 §3); unset keeps today's pick.
  const daAnchor = modeAnchor('destructive') ?? theme.destructiveAnchorStep;
  const iDestructiveRest = daAnchor !== undefined
    ? chromatic(r2p.danger, daAnchor, floorRgb, cfg.actionMin)
    : paletteRole('danger', floorRgb, cfg.actionMin);
  iFill('destructive', iDestructiveRest, r2p.danger, cfg.actionMin);
  put('interactive.destructive.text', paletteRole('danger', baseRgb, cfg.secondaryMin), 'Destructive interactive ink (outline / text appearance)', 'background.primary', cfg.secondaryMin);
  put('interactive.destructive.border', rated(chromatic(r2p.danger, 500, baseRgb, cfg.nonTextMin), baseRgb), 'Destructive interactive border (outline)', 'background.primary', cfg.nonTextMin);

  // neutral — the achromatic column that was the historical miss (docs/20 §12). The
  // `neutralEmphasis` lever picks the fill: 'subtle' (default) a light grey (min 0 — a
  // subtle surface); 'strong' a bold near-black (light) / near-white (dark) fill that
  // clears the non-text floor. Either way the LOAD-BEARING contract is the on-fill ink,
  // derived + gated to onMin, so a failing neutral pair can't ship.
  const neutralStrong = theme.neutralEmphasis === 'strong';
  const neutralAnchor = neutralStrong ? (cfg.family === 'light' ? 800 : 150) : (cfg.family === 'light' ? 150 : 850);
  iFill('neutral', neutralStepR(neutralAnchor), r2p.neutral, neutralStrong ? cfg.nonTextMin : 0);
  put('interactive.neutral.text', pickMostExtreme(textCands, baseRgb), 'Neutral interactive ink (outline / text appearance) — strongest neutral', 'background.primary', cfg.secondaryMin);
  put('interactive.neutral.border', pickMinPass(ramp, baseRgb, cfg.nonTextMin), 'Neutral interactive border (outline)', 'background.primary', cfg.nonTextMin);

  // extensible interactive columns (docs/20 §3) — N opt-in `interactive.<name>.*` families, each
  // promoting a declared palette (the generalised accent lever). Same fill+states / text / border
  // generation as the built-ins, anchored at the entry's fill step (default 500). A brand with no
  // extra columns (the common case) runs an empty loop → only primary/neutral/destructive ship.
  // Never falls back to primary — the resolver only lists palettes the brand actually declared.
  for (const entry of theme.interactivePalettes) {
    const anchor = modeAnchor(entry.name) ?? entry.anchorStep ?? 500;
    const rest = chromatic(entry.palette, anchor, floorRgb, cfg.actionMin);
    iFill(entry.name, rest, entry.palette, cfg.actionMin);
    put(`interactive.${entry.name}.text`, rated(chromatic(entry.palette, anchor, baseRgb, cfg.secondaryMin), baseRgb), `${entry.name} interactive ink (outline / text appearance)`, 'background.primary', cfg.secondaryMin);
    put(`interactive.${entry.name}.border`, rated(chromatic(entry.palette, 500, baseRgb, cfg.nonTextMin), baseRgb), `${entry.name} interactive border (outline)`, 'background.primary', cfg.nonTextMin);
  }

  // inverse surface-context (docs/20 §9): the ink for an OUTLINE / TEXT interactive control
  // placed on a dark hero / inverse section — a light CTA on dark, generated + contrast-verified
  // against the inverse surface (not a hand-mirrored -inverse twin). Independent of light/dark
  // theme; a light-only brand still needs it. The `inverse` lever gates it.
  if (theme.inverseContext) {
    const invInk = (name: string, palette: string | null, anchor: number) =>
      put(`interactive.${name}.on-inverse`,
        palette ? rated(chromatic(palette, anchor, invRgb, cfg.secondaryMin), invRgb) : pickMostExtreme(textCands, invRgb),
        `${name} interactive ink on an inverse / dark surface (outline / text on a dark hero)`,
        'background.inverse.primary', cfg.secondaryMin);
    invInk('primary', r2p.action, modeAnchor('primary') ?? theme.actionAnchorStep ?? theme.roleAnchorStep.action);
    invInk('destructive', r2p.danger, modeAnchor('destructive') ?? theme.destructiveAnchorStep ?? theme.roleAnchorStep.danger);
    invInk('neutral', null, 0);
    for (const entry of theme.interactivePalettes) invInk(entry.name, entry.palette, modeAnchor(entry.name) ?? entry.anchorStep ?? 500);
  }

  // interactive overlays (docs/20 §6) — translucent hover/pressed/selected washes that
  // composite over ANY surface (page, dark hero, image), the outline/text-appearance and
  // row/menu/card hover story. `overlay-neutral` (default) uses the mode-adaptive neutral
  // alpha ramp (darken in light, lighten in dark). The composited RESULT is contrast-gated
  // (§13): text.primary must stay ≥ AA on the page once the overlay sits on it — a real
  // contract that fails on too-heavy a wash (notably a lightening overlay in dark mode).
  // `solid-tint` (opaque foreground.<color>-subtle) and `none` opt out — no overlay tokens.
  if (theme.outlineInteraction === 'overlay-neutral') {
    const overlayPal = cfg.family === 'light' ? 'black-alpha' : 'white-alpha';
    const overlayBase = cfg.family === 'light' ? BLACK : WHITE;
    const OVERLAY_ALPHA: [string, number][] = [['hover', 10], ['pressed', 20], ['selected', 20]];
    const contentRgb = pickMostExtreme(textCands, baseRgb).rgb;   // text.primary — the strongest content ink
    const overlayColors = ['primary', 'neutral', 'destructive', ...theme.interactivePalettes.map((p) => p.name)];
    for (const color of overlayColors) {
      for (const [st, step] of OVERLAY_ALPHA) {
        const ratio = contrast(contentRgb, composite(baseRgb, overlayBase, step / 100));
        put(`interactive.${color}.overlay.${st}`,
          { path: `${ns}.${overlayPal}.${step}`, rgb: overlayBase, ratio },
          `${color} interactive overlay — ${st} (${step}% neutral wash; composites over any surface)`,
          'text.primary', cfg.secondaryMin);
        // The wash is TRANSLUCENT (`step`% over the base) — record the alpha so consumers can
        // render the real composite. `hex` stays the opaque base (contrast gates on the composited
        // result separately); a renderer uses hex+alpha.
        roles[`interactive.${color}.overlay.${st}`].alpha = step / 100;
      }
    }
  }

  // ---- disabled — cross-cutting (docs/20 §7): ONE treatment, not per-colour. A disabled
  // control looks disabled regardless of intent (fill / on-fill / text / icon /
  // border), governed by the `disabledStrategy` lever. This is the SOLE disabled family:
  // the per-colour action.disabled / foreground.danger.disabled / interactive.*.fill.disabled
  // are retired — components bind these five roles for any disabled control (docs/20 §16).
  putSurf('disabled.fill', neutralLow(), 'Disabled control fill — one muted neutral, any intent');
  { const d = onDisabled(); put('disabled.on-fill', d.r, `Label / icon on a disabled fill — muted but ${accessibleDisabled ? `clears ${d.min}:1` : 'sub-AA (WCAG-exempt)'}`, 'disabled.fill', d.min); }
  { const d = disabledText(); put('disabled.text', d.r, accessibleDisabled ? `Disabled text — clears ${disabledTarget}:1 (accessible)` : 'Disabled text — sub-AA (WCAG-exempt)', d.against, d.min); }
  { const d = disabledText(); put('disabled.icon', d.r, accessibleDisabled ? `Disabled icon — clears ${disabledTarget}:1 (accessible)` : 'Disabled icon — sub-AA (WCAG-exempt)', d.against, d.min); }
  put('disabled.border', rated(neutralLow(), baseRgb), 'Disabled control border — muted neutral', 'background.primary', 0);

  // ---- field — form-element chrome (docs/20 §17). Deliberately MINIMAL + gated: a field
  // surface, a PERCEIVABLE resting border, and a READABLE placeholder. Everything stateful
  // composes from existing families (focus → border.focus, validation → border.<semantic> +
  // foreground.<semantic>-subtle, disabled → disabled.*), so `field.*` is not re-authored per
  // state or hand-mirrored for inverse — the field research (Prism2 surface/border.input.*)
  // showed those are the tokens generic roles already cover better.
  putSurf('field.fill', cfg.bg.secondary, 'Form field fill — a subtly inset surface for inputs (the value ink is text.primary; it tracks the page tier so text clears)');
  // Border is the one stateful field slot (rest + hover), same shape as interactive.*.fill.<state>.
  // Rest is a perceivable boundary; hover is a subtly STRONGER boundary — never the sole state
  // carrier (KB §4). Focus swaps to border.focus, validation to border.<semantic>, disabled to
  // disabled.border — those compose from generic families, so only rest/hover live in field.*.
  put('field.border.rest', pickMinPass(ramp, baseRgb, cfg.nonTextMin), `Form field resting border — a perceivable boundary, ${cfg.nonTextMin}:1 (SC 1.4.11) — better than a sub-3:1 resting border`, 'background.primary', cfg.nonTextMin);
  put('field.border.hover', pickMinPass(ramp, baseRgb, cfg.secondaryMin), `Form field hover border — a subtly stronger boundary on pointer hover, ${cfg.secondaryMin}:1 (never the sole state carrier — KB §4)`, 'background.primary', cfg.secondaryMin);
  put('field.placeholder', pickMinPass(textCands, cfg.bg.secondary.rgb, cfg.secondaryMin), `Form field placeholder ink — a READABLE hint, ${cfg.secondaryMin}:1 on the field fill (not a sub-AA placeholder)`, 'field.fill', cfg.secondaryMin);

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
    // (disabled ink is the cross-cutting disabled.text / disabled.icon, not a per-family role.)
    // bold semantic ink
    for (const r of SEMANTICS)
      T(r, paletteRole(r, floorRgb, p.semanticMin), `${r} ${p.label} — ${p.semanticMin}:1 on the floor`, cfg.floorName, p.semanticMin);
    // muted semantic ink (the "quiet" variant) — designer's judgment for emphasis.
    for (const r of SEMANTICS)
      T(`${r}-subtle`, rated(pStep(palOf(r2p[r]), mutedStep), baseRgb), `Muted ${r} ${p.label} — low-emphasis accent`, 'background.primary', 0);
    // on-* pairs (ink on a solid fill) — AA on a vivid fill. `on-action` / `on-disabled`
    // are retired: the ink on an interactive fill is interactive.<color>.on-fill, and the
    // ink on a disabled fill is disabled.on-fill (docs/20 §16).
    for (const r of SEMANTICS)
      T(`on-${r}`, onColor(fills[r]!.rgb), `${p.label} on a solid ${r} fill`, `foreground.${r}`, onMin);
    T('on-inverse', pickMostExtreme(textCands, invRgb), `${p.label} on an inverse surface`, 'background.inverse.primary', cfg.secondaryMin);
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

  // ---- per-mode colour override layer (Phase A1) ----
  // A brand may repoint a resolved role at an EXISTING primitive step in ANY palette (no raw
  // colours). Overrides live only on the customizable modes (light/dark) — `theme.overrides`
  // carries none for the generate-only modes. Each override re-derives the role's contrast
  // against its own `against` surface and WARNS (never blocks) when a hand-tuned pick fails the
  // role's contrast min: the generated baseline always passes; a failing tuned override still
  // applies + emits, recorded as a warning. A role absent in this mode is skipped (roles vary by
  // mode). A malformed ref (unknown palette / step) is a hard error.
  const warnings: OverrideWarning[] = [];
  const ov = theme.overrides?.[mode];
  if (ov) {
    for (const [rolePath, ref] of Object.entries(ov)) {
      const existing = roles[rolePath];
      if (!existing) continue;                             // role absent in this mode → skip (no throw)
      const steps = ramps.get(ref.palette);
      if (!steps) throw new Error(`overrides[${mode}]: unknown palette '${ref.palette}' (role '${rolePath}')`);
      const step = steps.find((s) => s.key === ref.step);
      if (!step) throw new Error(`overrides[${mode}]: unknown step '${ref.step}' in palette '${ref.palette}' (role '${rolePath}')`);
      const newRgb = step.rgb;
      const againstRgb = existing.against === 'self' ? newRgb : (rgbByRole.get(existing.against) ?? baseRgb);
      const ratio = contrast(newRgb, againstRgb);
      roles[rolePath] = { ...existing, path: `${ns}.${ref.palette}.${ref.step}`, ratio, hex: hex(newRgb) };
      if (existing.min > 0 && ratio < existing.min) warnings.push({ role: rolePath, ratio, min: existing.min });
    }
  }

  return { mode, surface: baseRgb, roles, ...(warnings.length ? { warnings } : {}) };
};

export const resolveAllModes = (theme: Theme): ModeResult[] => {
  const ramps = new Map(theme.palettes.map((p) => [p.palette, p.steps] as const));
  const neutral = ramps.get(theme.roleToPalette.neutral)!;
  const cfgs = modeConfigs(theme.namespace, theme.roleToPalette.neutral, neutral, theme.surfaces);
  // Only the modes the brand opted into (light always; dark/HC opt-in — docs/11 Pillar 1).
  // Canonical order preserved (Object.keys order), so `rp.modes` is stable regardless of input order.
  return (Object.keys(cfgs) as ModeName[]).filter((m) => theme.modes.includes(m)).map((m) => resolveMode(m, cfgs[m], theme, ramps));
};
