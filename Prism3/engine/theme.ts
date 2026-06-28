/**
 * Prism3 engine — theme building.
 *
 * Two entry points:
 *  - nbTheme()      — the New Balance regression theme: reads measured anchors
 *                     from the schema, names palettes by hue (red/green/amber),
 *                     emits in NB's dialect (nbds.color / rgb). Used to prove the
 *                     engine reproduces a real brand.
 *  - brandTheme()   — the white-label path: a brand supplies primary + neutral
 *                     (+ optional status overrides) and the engine SYNTHESISES
 *                     status palettes from canonical hues, carving a separate
 *                     danger red when the primary isn't already red. Names
 *                     palettes by role and emits the product dialect (prism.color
 *                     / hex). This is what makes the system white-label.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { generateRamp, peakChromaL, autoPlaceStep, Step } from './ramp';
import { dimensionGrid, spaceScale, radiusScale, componentSizes, SpaceStep, RadiusStep, SizeStep, Density } from './scale';
import { oklchToRgb, RGB } from './color';

const here = dirname(fileURLToPath(import.meta.url));
// The NB *measurement* fixture (reverse-engineered NB anchors) — the regression
// input for nbTheme(). This is a DIFFERENT shape from the white-label BrandInput
// contract (schema/theme-schema.json + .example.json); it carries measured OKLCH
// + $source provenance and is consumed only here, never by brandTheme().
export const NB_MEASURED = resolve(here, '../schema/nb-measured.json');

// Semantic colour roles. `action` is FIRST-CLASS and distinct from `brand`:
// the brand's hero colour is not always the right interactive colour (poor
// contrast, or reserved by brand guidelines), so action maps independently.
export type Role = 'brand' | 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'action';
export type OKLCH = { l: number; c: number; h: number };

/** A generated primitive palette. */
export type PaletteBuild = { palette: string; role: Role; steps: Step[]; description: string };

/** The non-color (dimension) axis: a primitive grid + space/radius/size scales. */
export type Dims = {
  grid: number[];
  space: SpaceStep[];        // reference tier — numbered multiplier, density-free
  radius: RadiusStep[];
  sizes: SizeStep[];         // component tier — t-shirt, density acts here
  density: Density;
  radiusScaleValue: number;
  spaceBase: number;
};

/** Everything the emitter and the modes engine need to be brand-agnostic. */
export type Theme = {
  id: string;
  root: string;                      // 'nbds' | 'prism' (brand root namespace)
  namespace: string;                 // '<root>.color'
  colorFormat: 'rgb' | 'hex';
  palettes: PaletteBuild[];
  roleToPalette: Record<Role, string>;
  roleAnchorStep: Record<Role, number>;
  surfaces?: SurfacesConfig;         // optional non-default surfaces (drives the contrast floor)
  // Disabled-state strategy. 'accessible' (default): disabled text/icon/border
  // clears `disabledMin` on the floor, so it stays legible (the KB's `inactive`).
  // 'conventional': intentionally sub-AA, leaning on the WCAG 1.4.3/1.4.11
  // inactive-component exemption (the field-standard dimmed look).
  disabledStrategy: 'accessible' | 'conventional';
  disabledMin: number;               // accessible floor (default 3:1; bumped in HC)
  // Icon contrast floor. 'text' (default): icons mirror text (4.5:1). '3:1':
  // icons resolve against the WCAG SC 1.4.11 non-text floor (3:1) — standards-
  // correct (graphical objects), letting secondary/semantic icons run lighter
  // than text. `icon.primary` stays strong either way.
  iconContrast: 'text' | '3:1';
  dims: Dims;
  motion: MotionAxis;
  typography: Typography;
  shadow: ShadowAxis;
  notes: string[];                   // human-readable record of engine decisions
};

// The page-default surface is not always pure white/black. A brand can declare
// its primary surface per mode; the contrast FLOOR (the worst-case surface
// saturated foregrounds are validated against) follows it. `base` is 'white',
// 'black', or a neutral step number; `floorStep` names the neutral step used as
// the floor (defaults: white→50, black→950, a tinted base→one step more tinted).
export type SurfaceSpec = 'white' | 'black' | number;
export type SurfacesConfig = {
  light?: { base?: SurfaceSpec; floorStep?: number };
  dark?:  { base?: SurfaceSpec; floorStep?: number };
};

// ---- canonical status hues (engine-supplied; a brand need not specify them) ----
const STATUS_DEFAULTS: Record<'success' | 'warning' | 'danger' | 'info', OKLCH & { chroma: number }> = {
  success: { l: 0.55, c: 0.15, h: 145, chroma: 0.15 },
  warning: { l: 0.55, c: 0.15, h: 75, chroma: 0.15 },
  danger: { l: 0.55, c: 0.17, h: 27, chroma: 0.17 },
  info: { l: 0.55, c: 0.13, h: 245, chroma: 0.13 },
};

/** Angular distance between two hues (degrees, 0..180). */
const hueDist = (a: number, b: number): number => {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
};
/** Is this primary hue close enough to the danger red that it IS the danger hue? */
export const inRedTerritory = (hue: number): boolean => hueDist(hue, STATUS_DEFAULTS.danger.h) <= 20;

/** Generate a vivid, unanchored status ramp from a canonical hue. */
const statusRamp = (hue: number, chroma: number): Step[] =>
  generateRamp({ hue, chroma, peakL: peakChromaL(hue) });

// ---------------------------------------------------------------------------
// White-label brand input -> Theme
// ---------------------------------------------------------------------------
export type BrandInput = {
  id: string;
  primary: OKLCH;                    // the exact brand anchor (palette 'primary')
  neutral: { hue: number; chroma: number };
  /** Additional brand colours — secondary, tertiary, accents. Any number; each
   *  becomes its own ramp and can be pointed at by `actionPalette` (or used
   *  decoratively). This is what makes the palette set open-ended. */
  brandColors?: { name: string; oklch: OKLCH }[];
  /** Which palette drives interactive/action colour. Defaults to 'primary', but
   *  brands whose hero colour is unsuitable for actions name another palette
   *  here (e.g. an accent, or even neutral). The engine FLAGS this decision in
   *  notes so it's an explicit, confirmable choice — never a silent assumption. */
  actionPalette?: string;
  /** Non-default primary surfaces per mode (e.g. a warm off-white page). The
   *  contrast floor moves with the declared base, and the engine flags it in
   *  notes so the surface choice is confirmed. Omit for white/black defaults. */
  surfaces?: SurfacesConfig;
  /** Optional measured status overrides; omit to let the engine synthesise. */
  status?: Partial<Record<'success' | 'warning' | 'danger', OKLCH & { chroma: number }>>;
  /** Disabled-state policy. Default 'accessible' (disabled clears `disabledMin`,
   *  the KB's contrast-preserving `inactive`); 'conventional' for the field's
   *  sub-AA exempt look. `disabledMin` is the accessible floor (default 3). */
  disabledStrategy?: 'accessible' | 'conventional';
  disabledMin?: number;
  /** Icon contrast floor. Default 'text' (icons mirror text, 4.5:1). '3:1'
   *  resolves icons against the WCAG 1.4.11 non-text floor so they may diverge. */
  iconContrast?: 'text' | '3:1';
  /** Motion personality (schema-optional #6). `tempo` scales the duration ramp;
   *  `easingEmphasized` overrides the expressive curve. Reduce-motion variants are
   *  always derived. Omit for the 'standard' tempo. */
  motionPersonality?: MotionPersonality;
  /** Typography axis lever. `families` supply the display/text/mono faces (a
   *  single face is auto-padded with a system fallback stack; a full array is
   *  trusted as-is) + a variable-font flag; `weightRoles` map the function-named
   *  roles to the brand's numeric weights; `typeScale` shifts the semantic→
   *  primitive mapping (Phase 2). The rem size ladder is brand-invariant. */
  typography?: TypographyInput;
  /** Shadow / elevation axis lever (Phase A). `softness` is the blur:offset
   *  personality dial (low → crisp/product, high → soft/marketing); `tint` hue-
   *  shifts the shadow base off pure black (default a subtle neutral tint; set a
   *  brand hue + higher amount for brand-hued marketing shadows). */
  shadow?: { softness?: number; tint?: { hue?: number; amount?: number } };
  /** Dimension axis levers (schema-required #4/#5). Defaults reproduce a
   *  conventional 4px-grid / 8px-rhythm, sharp-corner system. */
  baseUnit?: number;                 // fine dimension grid base (px), default 4
  spaceBase?: number;                // spacing rhythm (px), default 8
  density?: Density;                 // default 'comfortable' (drives component sizes)
  radiusScale?: number;              // 0=sharp … 1=default … 2=soft, default 1
  baseMd?: number;                   // radius.md anchor (px) at scale 1, default 4
};

const buildDims = (baseUnit: number, spaceBase: number, density: Density, rScale: number, baseMd: number, extras: number[] = []): Dims => ({
  grid: dimensionGrid(baseUnit, 128, extras),
  space: spaceScale(spaceBase),
  radius: radiusScale(rScale, baseMd, 128),
  sizes: componentSizes(density, spaceBase),
  density,
  radiusScaleValue: rScale,
  spaceBase,
});

// ---------------------------------------------------------------------------
// Motion axis — generated from a single personality lever (`tempo`), the motion
// analog of the density/radius levers. Grounded in 18-motion-foundations + a
// 7-system field survey: a non-linear duration ramp scaled by tempo; the
// convergent easing roles (standard/enter=decelerate/exit=accelerate/emphasized)
// + a `calm` accessibility curve; M3-sourced springs by perceptual outcome;
// Atlassian-style composite transitions; and reduce-motion as a DERIVED output
// (Apple "substitute, don't delete": small informational motion preserved/floored,
// large/vestibular motion eliminated) — not a hand-maintained second list.
export type Bezier = [number, number, number, number];
export type MotionPersonality = {
  tempo?: 'snappy' | 'standard' | 'relaxed';   // scales the base duration ramp
  easingEmphasized?: Bezier;                    // optional override for the expressive curve
};
export type MotionAxis = {
  tempo: 'snappy' | 'standard' | 'relaxed';
  duration: Record<string, number>;            // ms, semantic roles (tempo-scaled)
  durationReduced: Record<string, number>;     // ms, reduce-motion variants (derived)
  easing: Record<string, Bezier>;
  spring: Record<string, { damping: number; stiffness: number }>;
  stagger: number;                             // ms between staggered siblings
  transitions: { name: string; duration: string; easing: string; desc: string }[];
};

const DURATION_BASE: Record<string, number> = { instant: 50, fast: 100, normal: 200, moderate: 300, slow: 500, slower: 800 };
const TEMPO_FACTOR = { snappy: 0.8, standard: 1, relaxed: 1.3 } as const;
const round5 = (n: number) => Math.round(n / 5) * 5;

const buildMotion = (p: MotionPersonality = {}): MotionAxis => {
  const tempo = p.tempo ?? 'standard';
  const f = TEMPO_FACTOR[tempo];
  const duration: Record<string, number> = {};
  for (const [k, v] of Object.entries(DURATION_BASE)) duration[k] = round5(v * f);
  // reduce-motion: ≤100ms (informational) preserved; ≤200ms floored to 50; larger
  // (vestibular/decorative) → 0 (substituted by an instant cross-fade downstream).
  const durationReduced: Record<string, number> = {};
  for (const [k, v] of Object.entries(duration)) durationReduced[k] = v <= 100 ? v : v <= 200 ? 50 : 0;
  const easing: Record<string, Bezier> = {
    linear: [0, 0, 1, 1],
    standard: [0.2, 0, 0, 1],          // symmetric in-place (M3 standard)
    enter: [0, 0, 0.2, 1],             // decelerate — settles into place
    exit: [0.4, 0, 1, 1],              // accelerate — gets out of the way
    emphasized: p.easingEmphasized ?? [0.4, 0.14, 0.3, 1],  // expressive (Carbon expressive-standard)
    calm: [0.4, 0, 0.6, 1],            // a11y: soft onset for long/involuntary motion
  };
  const spring = {
    snappy: { damping: 0.9, stiffness: 700 },   // M3 standard spatial — fast settle, no overshoot
    gentle: { damping: 0.8, stiffness: 380 },   // M3 expressive spatial — natural settle
    bouncy: { damping: 0.6, stiffness: 800 },   // M3 expressive fast — overshoot (expressive layer)
  };
  return {
    tempo, duration, durationReduced, easing, spring, stagger: round5(40 * f),
    transitions: [
      { name: 'default', duration: 'normal', easing: 'standard', desc: 'standard in-place transition' },
      { name: 'enter', duration: 'normal', easing: 'enter', desc: 'entrance — element settles in' },
      { name: 'exit', duration: 'fast', easing: 'exit', desc: 'exit — element accelerates out' },
      { name: 'emphasized', duration: 'moderate', easing: 'emphasized', desc: 'expressive / hero moment' },
    ],
  };
};

// ---------------------------------------------------------------------------
// Typography axis (Phase 1 — primitive tier). Grounded in 23-typography-
// tokenisation + the Prism2 reference scale. Deliberate deviation from the KB's
// modular-ratio recommendation: the size ladder is a CURATED rem scale, not a
// ratio. A single ratio leaves gaps (1.25 off 16px skips 24/28/36 — the sizes
// designers reach for) and yields non-round values; the curated ladder has
// variable step density (fine for text, coarse for display) and covers all bases
// with clean values. Font-size primitives are brand-INVARIANT (16px is 16px in
// any brand, like the spacing scale); the white-label lever is the families, the
// weight role→numeric map, and the `typeScale` preset (consumed at the semantic
// tier in Phase 2). Weight roles are FUNCTION-named (subtle/default/emphasis/
// strong over a numeric reference tier) — the white-label-safe answer to "one
// brand's bold is 700, another's 600": the role is the stable contract, the
// numeric is the brand-variable part (23 §"Naming the weight ladder").
export type FontFamilyRole = { role: 'display' | 'text' | 'mono'; stack: string[]; variable: boolean };
export type WeightRole = { role: 'subtle' | 'default' | 'emphasis' | 'strong'; value: number };
export type FamilyRoleName = 'display' | 'text' | 'mono';
export type WeightRoleName = 'subtle' | 'default' | 'emphasis' | 'strong';
export type TypeGroup = 'display' | 'title' | 'body' | 'label' | 'caption' | 'eyebrow' | 'code';
// A semantic composite: a (group, variant) bundling family + size + weight role +
// line-height + tracking. Two composites may share a size primitive (e.g. title.xs
// and body.lg both at 18px) — they differ on family/line-height/weight/intent;
// family is a property of the GROUP, not the size. The size ladder underneath is
// single-source.
export type TypeComposite = {
  group: TypeGroup; variant: string; path: string; sizePx: number;   // desktop / max
  sizeMinPx: number;                               // mobile / min (== sizePx when static)
  family: FamilyRoleName; lineHeight: string; weightRole: WeightRoleName; tracking: string;
  textCase: 'none' | 'uppercase' | 'lowercase';   // baked style (not Figma-bindable; code/style-side)
};
export type Typography = {
  families: FontFamilyRole[];
  sizesPx: number[];                                  // curated ladder (px; rem = px/16)
  weightsRef: number[];                               // 100..900 numeric reference tier
  weightRoles: WeightRole[];                          // function-named roles → numeric
  lineHeights: { key: string; value: number }[];      // unitless multipliers
  letterSpacings: { key: string; em: number }[];      // em-relative tracking
  typeScale: 'compact' | 'default' | 'expressive';    // shifts heading sizes up/down the ladder
  composites: TypeComposite[];                        // semantic tier (Phase 2)
  fluid: boolean;                                     // responsive sizing on (Phase 3)
  minViewport: number;                                // px — fluid clamp() interpolation floor
  maxViewport: number;                                // px — fluid clamp() interpolation ceiling
};

const SANS_FALLBACK = ['system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'Helvetica', 'Arial', 'sans-serif'];
const MONO_FALLBACK = ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'Liberation Mono', 'monospace'];
const LINE_HEIGHTS = [
  { key: 'tight', value: 1.05 }, { key: 'snug', value: 1.15 }, { key: 'compact', value: 1.25 },
  { key: 'normal', value: 1.5 }, { key: 'relaxed', value: 1.65 }, { key: 'loose', value: 1.75 },
];
const LETTER_SPACINGS = [
  { key: 'tighter', em: -0.03 }, { key: 'tight', em: -0.02 }, { key: 'snug', em: -0.01 }, { key: 'normal', em: 0 },
  { key: 'wide', em: 0.02 }, { key: 'wider', em: 0.05 },
];
const WEIGHT_ROLE_DEFAULT = { subtle: 300, default: 400, emphasis: 600, strong: 700 } as const;

// Curated rem ladder: text [10–18] in 1–2px steps; ¼rem (4px) 20→40; ½rem (8px)
// 48→80; 1rem (16px) 96→160. 22 steps, all clean rem values (matches Prism2).
const fontSizeLadder = (): number[] => {
  const px = [10, 11, 12, 14, 16, 18];
  for (let p = 20; p <= 40; p += 4) px.push(p);
  for (let p = 48; p <= 80; p += 8) px.push(p);
  for (let p = 96; p <= 160; p += 16) px.push(p);
  return px;
};

const asStack = (fam: string | string[] | undefined, fallbackFace: string, fallback: string[]): string[] => {
  if (!fam) return [fallbackFace, ...fallback];
  const arr = Array.isArray(fam) ? fam : [fam];
  return arr.length > 1 ? arr : [...arr, ...fallback];   // single face → append fallback; full stack → trust it
};

export type TypographyInput = {
  families?: { display?: string | string[]; text?: string | string[]; mono?: string | string[]; variable?: boolean | Partial<Record<FamilyRoleName, boolean>> };
  weightRoles?: Partial<Record<'subtle' | 'default' | 'emphasis' | 'strong', number>>;
  typeScale?: 'compact' | 'default' | 'expressive';
  /** Which family role each semantic group consumes. Defaults: display/title/
   *  label/eyebrow → display (brand); body/caption → text; code → mono. Override
   *  per group (e.g. neutral buttons: `{ label: 'text' }`). Family is a property
   *  of the GROUP, not the size — this is what lets a small brand-font title share
   *  a size with body while staying a distinct token. */
  familyMap?: Partial<Record<TypeGroup, FamilyRoleName>>;
  /** Cap the display tier (px). Brands that don't need mega heroes stop lower
   *  (e.g. 96); the ladder is unchanged, the engine just omits display composites
   *  above the cap. Default 160 (full). */
  displayCeiling?: number;
  /** Smallest title size. Default 18 (`title.xs`). Set 16 to add `title.2xs` — a
   *  16px brand-font heading that deliberately overlaps `body.md`. */
  titleFloor?: 16 | 18;
  /** Responsive sizing (Phase 3). `fluid` (default true) gives heading groups a
   *  mobile endpoint (= desktop × a per-group factor, snapped to the ladder); the
   *  same min/max pair drives the web `clamp()` and the Figma desktop/mobile modes.
   *  Reading/UI text stays static. `minViewport`/`maxViewport` (px, default
   *  375/1280) bound the clamp interpolation. */
  responsive?: { fluid?: boolean; minViewport?: number; maxViewport?: number };
};

// Semantic catalogue defaults (the 'default' typeScale, before levers). Family/
// weight/tracking are per-GROUP; line-height is size-derived for headings.
const TYPE_FAMILY_DEFAULT: Record<TypeGroup, FamilyRoleName> = {
  display: 'display', title: 'display', label: 'display', eyebrow: 'display',
  body: 'text', caption: 'text', code: 'mono',
};
const TYPE_WEIGHT_DEFAULT: Record<TypeGroup, WeightRoleName> = {
  display: 'strong', title: 'strong', label: 'emphasis', eyebrow: 'emphasis',
  body: 'default', caption: 'default', code: 'default',
};
const TYPE_TRACK_DEFAULT: Record<TypeGroup, string> = {
  display: 'tight', title: 'snug', label: 'normal', eyebrow: 'wider',
  body: 'normal', caption: 'normal', code: 'normal',
};
// Mega display tightens further (-0.03em): large type needs tighter tracking.
const trackingFor = (group: TypeGroup, px: number): string =>
  group === 'display' && px >= 96 ? 'tighter' : TYPE_TRACK_DEFAULT[group];
// base variant → px (default scale). title floor 18; 16 (title.2xs) is opt-in.
const TYPE_VARIANTS: Record<TypeGroup, [string, number][]> = {
  display: [['sm', 48], ['md', 64], ['lg', 80], ['xl', 96], ['2xl', 128], ['3xl', 160]],
  title: [['xs', 18], ['sm', 20], ['md', 24], ['lg', 28], ['xl', 32], ['2xl', 40]],
  body: [['sm', 14], ['md', 16], ['lg', 18]],
  label: [['sm', 12], ['md', 14]],
  caption: [['', 12]],
  eyebrow: [['', 12]],
  code: [['inline', 14]],
};
const TYPE_SCALE_SHIFT = { compact: -1, default: 0, expressive: 1 } as const;
// Desktop → mobile endpoint — RESEARCH-VALIDATED (not a flat factor). The field
// (IBM Carbon fluid-display, Utopia, practitioner consensus) shrinks BIGGER sizes
// MORE: body/UI static, titles ~1 rung, display converging to a ~40–48px mobile
// "hero band" no matter how large desktop goes (Carbon fluid-display-04 is
// 40→176px ≈ 23%). A flat factor shrank a 96px hero and a 28px heading by the same
// proportion — the opposite of how systems behave, and it left a 160px hero at
// 120px (≈3 chars/line on a 360px phone) instead of ~48px (≈9–11 chars/line).
const oneRungDown = (ladder: number[], px: number): number => {
  const i = ladder.indexOf(px);
  return i > 0 ? ladder[i - 1] : px;
};
// Display mobile endpoints, anchored to Carbon's fluid-display curve (floor ~40–48px).
// Keyed by desktop px (always a ladder value); fallback ≈ one rung down.
const DISPLAY_MOBILE: Record<number, number> = {
  36: 32, 40: 32, 48: 36, 56: 40, 64: 40, 72: 40, 80: 40,
  96: 48, 112: 48, 128: 48, 144: 48, 160: 48,
};
const mobileEndpoint = (ladder: number[], group: TypeGroup, desktopPx: number): number => {
  if (group === 'display') return Math.min(desktopPx, DISPLAY_MOBILE[desktopPx] ?? Math.max(oneRungDown(ladder, desktopPx), 32));
  if (group === 'title') return desktopPx <= 20 ? desktopPx : Math.min(desktopPx, Math.max(oneRungDown(ladder, desktopPx), 20));
  return desktopPx;   // body / label / caption / eyebrow / code — static (field consensus)
};
// Bigger heading → tighter line-height (display tightest; small titles open up).
const lineHeightFor = (group: TypeGroup, px: number): string => {
  if (group === 'display') return 'tight';
  if (group === 'title') return px >= 56 ? 'tight' : px >= 28 ? 'snug' : 'compact';
  if (group === 'label' || group === 'eyebrow') return 'snug';
  return 'normal';                                       // body, caption, code
};

const buildComposites = (ladder: number[], t: TypographyInput, fluid: boolean): TypeComposite[] => {
  const familyMap = { ...TYPE_FAMILY_DEFAULT, ...(t.familyMap ?? {}) };
  const shift = TYPE_SCALE_SHIFT[t.typeScale ?? 'default'];
  const ceiling = t.displayCeiling ?? 160;
  const titleFloor = t.titleFloor ?? 18;
  const shiftPx = (px: number): number => {
    const i = ladder.indexOf(px);
    if (i < 0) return px;
    return ladder[Math.max(0, Math.min(ladder.length - 1, i + shift))];
  };
  const out: TypeComposite[] = [];
  const push = (group: TypeGroup, variant: string, sizePx: number) => {
    const sizeMinPx = fluid ? mobileEndpoint(ladder, group, sizePx) : sizePx;
    out.push({
      group, variant, path: variant ? `${group}.${variant}` : group, sizePx, sizeMinPx,
      family: familyMap[group], lineHeight: lineHeightFor(group, sizePx),
      weightRole: TYPE_WEIGHT_DEFAULT[group], tracking: trackingFor(group, sizePx),
      textCase: group === 'eyebrow' ? 'uppercase' : 'none',
    });
  };
  for (const group of Object.keys(TYPE_VARIANTS) as TypeGroup[]) {
    const isHeading = group === 'display' || group === 'title';
    let prev = -Infinity;
    // title floor: a fixed 16px brand-font heading, PINNED (exempt from the
    // typeScale shift) so titleFloor:16 always delivers a literal 16px title that
    // overlaps body.md — the documented contract — regardless of typeScale.
    if (group === 'title' && titleFloor === 16) { push('title', '2xs', 16); prev = 16; }
    for (const [variant, base] of TYPE_VARIANTS[group]) {
      // typeScale shifts headings only (display + title); reading/UI text stays put.
      let sizePx = isHeading ? shiftPx(base) : base;
      if (group === 'title') sizePx = Math.max(sizePx, titleFloor);  // never below the floor
      if (group === 'display' && sizePx > ceiling) continue;         // displayCeiling trims the top
      if (sizePx <= prev) continue;                                  // monotonic + dedupe (clamp/shift collisions)
      push(group, variant, sizePx);
      prev = sizePx;
    }
  }
  return out;
};

const buildTypography = (t: TypographyInput = {}): Typography => {
  const fam = t.families ?? {};
  const textFace = Array.isArray(fam.text) ? fam.text[0] : fam.text;
  // `variable` may be a single flag (applies to all) or per-family — the build
  // reads it per family to decide weight emission (KB 23 §Variable fonts).
  const isVar = (role: FamilyRoleName): boolean =>
    typeof fam.variable === 'object' ? fam.variable[role] ?? false : fam.variable ?? false;
  const families: FontFamilyRole[] = [
    { role: 'display', stack: asStack(fam.display ?? textFace, 'Inter', SANS_FALLBACK), variable: isVar('display') },
    { role: 'text', stack: asStack(fam.text, 'Inter', SANS_FALLBACK), variable: isVar('text') },
    { role: 'mono', stack: asStack(fam.mono, 'JetBrains Mono', MONO_FALLBACK), variable: isVar('mono') },
  ];
  const wr = { ...WEIGHT_ROLE_DEFAULT, ...(t.weightRoles ?? {}) };
  const fluid = t.responsive?.fluid ?? true;
  return {
    families,
    sizesPx: fontSizeLadder(),
    weightsRef: [100, 200, 300, 400, 500, 600, 700, 800, 900],
    weightRoles: (['subtle', 'default', 'emphasis', 'strong'] as const).map((role) => ({ role, value: wr[role] })),
    lineHeights: LINE_HEIGHTS,
    letterSpacings: LETTER_SPACINGS,
    typeScale: t.typeScale ?? 'default',
    composites: buildComposites(fontSizeLadder(), t, fluid),
    fluid,
    minViewport: t.responsive?.minViewport ?? 375,
    maxViewport: t.responsive?.maxViewport ?? 1280,
  };
};

// ---------------------------------------------------------------------------
// Shadow / elevation axis (Phase A — the shadow ramp). Grounded in
// 31-color-systems §lift pattern + a 10-system field survey. Decisions:
//  - 6 steps (xs–2xl), the convergent count; + a single inset.
//  - 2 LAYERS per step (key + ambient — the field's physical model: a tight
//    directional key shadow for the edge, a soft diffuse ambient for distance).
//  - TINTED near-black, not pure black (Polaris/Radix/Comeau): a shadow base
//    colour from the neutral (or a brand) hue at low chroma. `shadow.tint` is the
//    expressive lever; `softness` (blur:offset ratio) is the personality lever.
//  - MODE-AWARE, LIFT-PRIMARY: full shadow in light; in dark the surface ladder
//    lift carries elevation and the shadow is REDUCED (faded, more present only at
//    the top steps) — NOT nulled (M3/Atlassian retain it), NOT heavier (rejecting
//    NB's `inverse`). The semantic surface↔shadow pairing is Phase B.
//  - offsetX = 0 (light directly above — the field-universal assumption); spread
//    negative-and-growing to keep large shadows tight (Tailwind/Polaris/Radix).
export type ShadowLayer = { offsetX: number; offsetY: number; blur: number; spread: number; alpha: number };
export type ShadowStep = { name: string; light: ShadowLayer[]; dark: ShadowLayer[] };
export type ShadowAxis = {
  steps: ShadowStep[];
  inset: ShadowStep;
  colorRgb: RGB;                 // the tinted shadow base (layers vary only alpha)
  softness: number;
  tint: { hue: number; amount: number };
};
// Base ramp at softness 1 — [keyY, keyBlur, keySpread, keyAlpha, ambY, ambBlur, ambSpread, ambAlpha].
// Anchored to Tailwind/Polaris/NB curves; offsetY≈blur×0.6–0.7, spread tightens with size.
const SHADOW_BASE: { name: string; key: number[]; amb: number[] }[] = [
  { name: 'xs', key: [1, 2, 0, 0.10], amb: [1, 3, 0, 0.06] },
  { name: 'sm', key: [1, 2, -1, 0.10], amb: [2, 6, -1, 0.07] },
  { name: 'md', key: [2, 4, -2, 0.12], amb: [4, 12, -3, 0.08] },
  { name: 'lg', key: [3, 6, -3, 0.12], amb: [8, 20, -5, 0.08] },
  { name: 'xl', key: [4, 8, -4, 0.14], amb: [14, 32, -8, 0.10] },
  { name: '2xl', key: [6, 12, -6, 0.14], amb: [22, 52, -12, 0.12] },
];

const buildShadow = (neutralHue: number, input: BrandInput['shadow'] = {}): ShadowAxis => {
  const softness = input.softness ?? 1;
  const tint = { hue: input.tint?.hue ?? neutralHue, amount: input.tint?.amount ?? 0.15 };
  // Shadow base colour: amount 0 = pure black (the NB dialect); any tint lifts it
  // to a hue-tinted near-black (l 0.13, chroma scaled by amount — Polaris/Comeau:
  // a tinted near-black reads richer than dead grey). Layers reuse this RGB and
  // vary only alpha — one shadow colour per theme.
  const colorRgb = tint.amount === 0 ? { r: 0, g: 0, b: 0 } : oklchToRgb({ l: 0.13, c: 0.05 * tint.amount, h: tint.hue });
  const layer = (a: number[]): ShadowLayer => ({ offsetX: 0, offsetY: a[0], blur: Math.round(a[1] * softness), spread: a[2], alpha: a[3] });
  // Dark: same geometry, alpha reduced and ramping UP with elevation (lower steps
  // nearly disappear — the surface lift does the work; top steps keep a whisper).
  const darkAlpha = (a: number, i: number): number => Math.round(a * (0.3 + 0.09 * i) * 100) / 100;
  const darkLayer = (a: number[], i: number): ShadowLayer => ({ offsetX: 0, offsetY: a[0], blur: Math.round(a[1] * softness), spread: a[2], alpha: darkAlpha(a[3], i) });
  const steps: ShadowStep[] = SHADOW_BASE.map((s, i) => ({
    name: s.name,
    light: [layer(s.key), layer(s.amb)],
    dark: [darkLayer(s.key, i), darkLayer(s.amb, i)],
  }));
  // Inset (wells, pressed states, inputs) — a single inner shadow, light/dark.
  const inset: ShadowStep = {
    name: 'inset',
    light: [{ offsetX: 0, offsetY: 2, blur: Math.round(4 * softness), spread: 0, alpha: 0.08 }],
    dark: [{ offsetX: 0, offsetY: 2, blur: Math.round(4 * softness), spread: 0, alpha: 0.3 }],
  };
  return { steps, inset, colorRgb, softness, tint };
};

export const brandTheme = (input: BrandInput): Theme => {
  const notes: string[] = [];
  const anchorStep = autoPlaceStep(input.primary.l);
  notes.push(`primary anchor (h${input.primary.h}) pinned exactly at step ${anchorStep}`);

  const palettes: PaletteBuild[] = [
    { palette: 'primary', role: 'brand', description: 'Brand primary', steps: generateRamp({ hue: input.primary.h, chroma: input.primary.c, anchor: { oklch: input.primary, stepNum: anchorStep } }) },
    { palette: 'neutral', role: 'neutral', description: 'Neutral', steps: generateRamp({ hue: input.neutral.hue, chroma: input.neutral.chroma }) },
  ];

  // Additional brand colours (secondary / tertiary / accents) — arbitrary count.
  for (const bc of input.brandColors ?? []) {
    palettes.push({ palette: bc.name, role: 'brand', description: `Brand ${bc.name}`, steps: generateRamp({ hue: bc.oklch.h, chroma: bc.oklch.c, anchor: { oklch: bc.oklch, stepNum: autoPlaceStep(bc.oklch.l) } }) });
    notes.push(`brand colour '${bc.name}' (h${bc.oklch.h}) added`);
  }

  const status = (k: 'success' | 'warning' | 'info') => {
    const s = (k !== 'info' && input.status?.[k]) ? input.status[k]! : STATUS_DEFAULTS[k];
    notes.push(`${k}: ${k !== 'info' && input.status?.[k] ? 'brand-supplied' : 'engine default'} hue ${s.h}`);
    return { palette: k, role: k as Role, description: `${k} status`, steps: statusRamp(s.h, s.chroma) };
  };
  palettes.push(status('success'), status('warning'), status('info'));

  // ---- action role (decoupled from brand) ----
  const actionPalette = input.actionPalette ?? 'primary';
  if (!palettes.some((p) => p.palette === actionPalette)) {
    throw new Error(`actionPalette '${actionPalette}' is not a defined palette (have: ${palettes.map((p) => p.palette).join(', ')})`);
  }
  notes.push(actionPalette === 'primary'
    ? `action colour defaults to the PRIMARY brand palette — CONFIRM this hue is the intended interactive colour for this brand`
    : `action colour is decoupled: uses palette '${actionPalette}', NOT the primary brand palette — explicit brand decision`);

  // ---- danger carve ----
  const roleToPalette: Record<Role, string> = {
    brand: 'primary', neutral: 'neutral', success: 'success', warning: 'warning', danger: 'danger', info: 'info', action: actionPalette,
  };
  if (input.status?.danger) {
    palettes.push({ palette: 'danger', role: 'danger', description: 'danger status (brand-supplied)', steps: statusRamp(input.status.danger.h, input.status.danger.chroma) });
    notes.push(`danger: brand-supplied hue ${input.status.danger.h}`);
  } else if (inRedTerritory(input.primary.h)) {
    // The brand's own hue IS the danger hue — reuse the primary palette rather
    // than minting a near-duplicate red.
    roleToPalette.danger = 'primary';
    notes.push(`danger: primary hue ${input.primary.h} is in red territory → danger reuses the primary palette (no separate red)`);
  } else {
    // Primary is not red, so carve a dedicated danger red the brand never gave us.
    const d = STATUS_DEFAULTS.danger;
    palettes.push({ palette: 'danger', role: 'danger', description: 'danger status (engine-carved red — primary is not red)', steps: statusRamp(d.h, d.chroma) });
    notes.push(`danger: primary hue ${input.primary.h} is NOT red → carved a dedicated danger red at hue ${d.h}`);
  }

  const baseUnit = input.baseUnit ?? 4;
  const spaceBase = input.spaceBase ?? 8;
  const density = input.density ?? 'comfortable';
  const rScale = input.radiusScale ?? 1;
  const baseMd = input.baseMd ?? 4;
  notes.push(`dimension axis: ${baseUnit}px grid, ${spaceBase}px space rhythm, density '${density}' (drives component sizes), radius scale ${rScale} (baseMd ${baseMd}px)`);
  notes.push(`motion: tempo '${input.motionPersonality?.tempo ?? 'standard'}' scales the duration ramp; easing roles + springs + composite transitions generated; reduce-motion variants derived (informational preserved, vestibular → 0)`);
  const shadow = buildShadow(input.neutral.hue, input.shadow);
  notes.push(`shadow: 6-step ramp (xs–2xl) + inset, 2-layer (key+ambient), softness ${shadow.softness}; tinted base (hue ${shadow.tint.hue}, amount ${shadow.tint.amount}${shadow.tint.amount === 0 ? ' = pure black' : ''}). Mode-aware, LIFT-primary: full shadow in light; reduced (faded, top-weighted) in dark — the surface ladder carries dark elevation. Composite shadow → Figma Effect Style.`);
  const typography = buildTypography(input.typography);
  const dispSizes = typography.composites.filter((c) => c.group === 'display').map((c) => c.sizePx);
  const reqCeiling = input.typography?.displayCeiling ?? 160;
  const effCap = dispSizes.length ? Math.max(...dispSizes) : 0;
  const capNote = dispSizes.length === 0
    ? ` — NOTE: display tier fully trimmed (ceiling ${reqCeiling}px is below the smallest display step); composite count is below the 15–25 norm`
    : effCap !== reqCeiling
      ? ` — NOTE: requested ceiling ${reqCeiling}px; effective top display is ${effCap}px (typeScale shifts sizes off the exact ladder rung)`
      : '';
  const varFams = typography.families.filter((f) => f.variable).map((f) => f.role);
  notes.push(`typography: curated rem size ladder (${typography.sizesPx.length} steps, ${typography.sizesPx[0]}–${typography.sizesPx[typography.sizesPx.length - 1]}px — NOT ratio-derived; covers all bases, clean values); weight roles subtle/default/emphasis/strong → ${typography.weightRoles.map((w) => w.value).join('/')}; families ${typography.families.map((f) => `${f.role}=${f.stack[0]}`).join(', ')}${varFams.length ? ` (variable: ${varFams.join('/')})` : ''}; typeScale '${typography.typeScale}'. ${typography.composites.length} semantic composites (title/display sizes shifted by typeScale; display capped at ${reqCeiling}px; title floor ${input.typography?.titleFloor ?? 18}px)${capNote}. ${typography.fluid ? `responsive: ${typography.composites.filter((c) => c.sizeMinPx !== c.sizePx).length} fluid composites (size-dependent mobile shrink — research-validated, Carbon fluid-display curve: body static, titles ~1 rung, display converges to ~40–48px; one min/max pair → web clamp() ${typography.minViewport}–${typography.maxViewport}px + Figma desktop/mobile modes)` : 'responsive: OFF (all sizes static)'}. Line-height unitless multiplier in \$value; px-from-ratio materialization for Figma in \$extensions.`);
  const dStrat = input.disabledStrategy ?? 'accessible';
  notes.push(dStrat === 'accessible'
    ? `disabled: 'accessible' — disabled text/icon/border clears ${input.disabledMin ?? 3}:1 on the floor (legible, contrast-preserving; the field-rare default). Set disabledStrategy:'conventional' for the sub-AA exempt look.`
    : `disabled: 'conventional' — disabled is intentionally sub-AA (WCAG 1.4.3/1.4.11 inactive-component exemption); CONFIRM this engagement accepts the reduced legibility`);

  // ---- surface confirmation ----
  for (const [mode, sf] of Object.entries(input.surfaces ?? {})) {
    if (sf?.base !== undefined && sf.base !== 'white' && sf.base !== 'black') {
      notes.push(`${mode} primary surface is NON-default (neutral.${sf.base}) — CONFIRM this is the page colour; the contrast floor moves with it${sf.floorStep ? ` (floor neutral.${sf.floorStep})` : ''}`);
    } else if (sf?.floorStep !== undefined) {
      notes.push(`${mode} contrast floor overridden to neutral.${sf.floorStep}`);
    }
  }

  return {
    id: input.id, root: 'prism', namespace: 'prism.color', colorFormat: 'hex', palettes, roleToPalette, notes,
    roleAnchorStep: { brand: anchorStep, neutral: 500, success: 500, warning: 500, danger: 500, info: 500, action: actionPalette === 'primary' ? anchorStep : 500 },
    surfaces: input.surfaces,
    disabledStrategy: input.disabledStrategy ?? 'accessible',
    disabledMin: input.disabledMin ?? 3,
    iconContrast: input.iconContrast ?? 'text',
    dims: buildDims(baseUnit, spaceBase, density, rScale, baseMd),
    motion: buildMotion(input.motionPersonality),
    typography,
    shadow,
  };
};

// ---------------------------------------------------------------------------
// New Balance regression theme (measured anchors, NB dialect)
// ---------------------------------------------------------------------------
const oklchOf = (o: any): OKLCH => ({ l: o.l, c: o.c, h: o.h });

export type RampSpec = {
  name: string; palette: string; role: Role; hue: number; chroma: number;
  anchor?: { oklch: OKLCH; stepNum: number };
};

/** NB regression specs (kept stable so the regression stays comparable). */
export const loadSpecs = (): RampSpec[] => {
  const s = JSON.parse(readFileSync(NB_MEASURED, 'utf8'));
  return [
    { name: 'brand (red)', palette: 'red', role: 'brand', hue: s.primaryColor.oklch.h, chroma: s.primaryColor.oklch.c, anchor: { oklch: oklchOf(s.primaryColor.oklch), stepNum: 550 } },
    { name: 'success (green)', palette: 'green', role: 'success', hue: s.statusColors.success.oklch.h, chroma: s.statusColors.success.oklch.c, anchor: { oklch: oklchOf(s.statusColors.success.oklch), stepNum: 500 } },
    { name: 'warning (amber)', palette: 'amber', role: 'warning', hue: s.statusColors.warning.oklch.h, chroma: s.statusColors.warning.oklch.c, anchor: { oklch: oklchOf(s.statusColors.warning.oklch), stepNum: 500 } },
    { name: 'neutral', palette: 'neutral', role: 'neutral', hue: s.neutralHue.hue, chroma: s.neutralHue.chroma },
  ];
};

export const buildRamp = (spec: RampSpec): Step[] =>
  generateRamp({ hue: spec.hue, chroma: spec.chroma, anchor: spec.anchor });

export const nbTheme = (): Theme => {
  const specs = loadSpecs();
  const palettes: PaletteBuild[] = specs.map((s) => ({
    palette: s.palette, role: s.role, description: s.name, steps: buildRamp(s),
  }));
  // NB ships no blue; synthesise an info palette so the semantic layer is complete.
  palettes.push({ palette: 'info', role: 'info', description: 'info status (engine-synthesised — NB has no blue)', steps: statusRamp(STATUS_DEFAULTS.info.h, STATUS_DEFAULTS.info.chroma) });
  const s = JSON.parse(readFileSync(NB_MEASURED, 'utf8'));
  const baseUnit = s.density?.baseUnit ?? 4;
  const baseMd = s.radius?.baseMd ?? 4;
  // Engine taxonomy (not NB's): 8px space rhythm reproducing Prism2's numbered
  // scale; NB's 4px grid still backs radius/borders. NB ships radius scale=1 and
  // a 720px layout outlier.
  const dims = buildDims(baseUnit, 8, 'comfortable', 1, baseMd, [720]);
  return {
    id: 'nb', root: 'nbds', namespace: 'nbds.color', colorFormat: 'rgb', palettes,
    roleToPalette: { brand: 'red', neutral: 'neutral', success: 'green', warning: 'amber', danger: 'red', info: 'info', action: 'red' },
    roleAnchorStep: { brand: 550, neutral: 500, success: 500, warning: 500, danger: 550, info: 500, action: 550 },
    disabledStrategy: 'accessible', disabledMin: 3, iconContrast: 'text',
    dims, motion: buildMotion(),
    typography: buildTypography(),
    shadow: buildShadow(s.neutralHue.hue, { tint: { amount: 0 } }),  // NB ships pure-black shadows
    notes: [
      'NB regression: measured anchors; brand red also serves as danger (NB brand hue is its danger hue).',
      `dimension axis: ${baseUnit}px grid, 8px space rhythm (Prism2 numbered scale), comfortable density, radius scale 1 (baseMd ${baseMd}px).`,
      'typography: curated rem size ladder (22 steps, 10–160px) reproducing the Prism2 reference scale; weight roles subtle/default/emphasis/strong → 300/400/600/700.',
      'shadow: 6-step ramp + inset, 2-layer, pure-black (NB dialect); mode-aware lift-primary (reduced in dark, NOT NB\'s heavier inverse — the field-correct choice).',
    ],
  };
};
