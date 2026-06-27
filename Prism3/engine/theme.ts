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

const here = dirname(fileURLToPath(import.meta.url));
export const SCHEMA = resolve(here, '../schema/theme-schema.example.json');

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
  const s = JSON.parse(readFileSync(SCHEMA, 'utf8'));
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
  const s = JSON.parse(readFileSync(SCHEMA, 'utf8'));
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
    notes: [
      'NB regression: measured anchors; brand red also serves as danger (NB brand hue is its danger hue).',
      `dimension axis: ${baseUnit}px grid, 8px space rhythm (Prism2 numbered scale), comfortable density, radius scale 1 (baseMd ${baseMd}px).`,
    ],
  };
};
