/**
 * Prism3 engine — theme building.
 *
 * Two entry points:
 *  - nbTheme()      — the New Balance regression theme: reads measured anchors
 *                     from the schema, names palettes by hue (red/green/amber),
 *                     emits in NB's dialect (nbds.* / rgb; primitives under palette). Used to prove the
 *                     engine reproduces a real brand.
 *  - brandTheme()   — the white-label path: a brand supplies primary + neutral
 *                     (+ optional status overrides) and the engine SYNTHESISES
 *                     status palettes from canonical hues, carving a separate
 *                     danger red when the primary isn't already red. Names
 *                     palettes by role and emits the product dialect (prism.*
 *                     / hex; primitives under palette). This is what makes the system white-label.
 */
import { generateRamp, peakChromaL, autoPlaceStep, Step } from './ramp';
import { dimensionGrid, spaceScale, radiusScale, componentSizes, SpaceStep, RadiusStep, SizeStep, Density } from './scale';
import { oklchToRgb, RGB, contrast, hex as rgbHex, inGamut, maxChroma } from './color';
import type { ModeName } from './modes';

/** The appearance modes the engine can generate. `light` is the required base; the rest
 *  are opt-in (docs/11 Pillar 1). Wireframe (docs/11 §Pillar 1b) is not yet a mode. */
// The DEFAULT mode set — generated when `input.modes` is omitted (back-compat; the
// four-mode golden is byte-identical). Wireframe is NOT here: it's opt-in only, never
// a default (docs/11 Pillar 1 — "most brands ship light only; dark/HC/wireframe opt-in").
export const ALL_MODES: ModeName[] = ['light', 'dark', 'hc-light', 'hc-dark'];
// The VALID mode set — the allow-list an input may request. Adds `wireframe` (1b): a
// generated greyscale mode (every non-neutral role → its equivalent neutral; radius → 0).
export const VALID_MODES: ModeName[] = [...ALL_MODES, 'wireframe'];

// The NB *measurement* fixture (reverse-engineered NB anchors) — the regression
// input for nbThemeFrom(). A DIFFERENT shape from the white-label BrandInput
// contract (schema/theme-schema.json + .example.json); it carries measured OKLCH
// + $source provenance and is consumed only by the NB regression, never by
// brandTheme(). The engine core stays pure: it takes the *parsed* fixture as an
// argument. File I/O (reading nb-measured.json) lives in the shell — nb-fixture.ts.
export type NbMeasured = {
  primaryColor: { oklch: OKLCH };
  statusColors: { success: { oklch: OKLCH }; warning: { oklch: OKLCH } };
  neutralHue: { hue: number; chroma: number };
  density?: { baseUnit?: number };
  radius?: { baseMd?: number };
};

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
  namespace: string;                 // '<root>.palette' — the colour PRIMITIVE root (ramps live here; the semantic role layer is emitted under '<root>.color')
  colorFormat: 'rgb' | 'hex';
  modes: ModeName[];                 // the appearance modes to generate (light always present)
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
  layout: LayoutAxis;
  gradient: GradientAxis;
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

// Palette names the engine always mints — a brandColor may not collide with these, else
// `new Map(palettes)` / `palette[name] = node` (last-wins) would let a brandColor named
// `neutral`/`primary` REPLACE the ramp the whole surface model is built on, or a status name
// silently replace the brandColor — gates stay green on corrupted output (CR-03). Includes the
// tree.ts base swatches (`white`/`black`/`*-alpha`).
const RESERVED_PALETTES = new Set(['primary', 'neutral', 'success', 'warning', 'info', 'danger', 'white', 'black', 'black-alpha', 'white-alpha']);
// A brandColor name is a palette slug: it becomes a `{root.palette.<name>.<step>}` alias path,
// so it must be a single lowercase kebab segment — no dots (break alias paths), spaces, or
// symbols (also closes the CR-07 XSS vector at the source: an HTML-metachar name can't validate).
const PALETTE_NAME_RE = /^[a-z][a-z0-9-]*$/;

/** Angular distance between two hues (degrees, 0..180). */
const hueDist = (a: number, b: number): number => {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
};
// A hue in the red window still needs enough chroma to READ as red — below this it's a warm
// grey/greige, not a danger signal (M-05). Reusing such a primary for `danger` would collapse
// destructive signalling to a near-neutral. ~0.08 is the floor where a red starts to register.
export const RED_CHROMA_FLOOR = 0.08;
/** Is this primary a SATURATED red — close enough in hue AND chromatic enough to BE the danger
 *  hue? A red-ish but desaturated (greige) primary is not red: danger must carve its own. */
export const inRedTerritory = (hue: number, chroma: number): boolean =>
  hueDist(hue, STATUS_DEFAULTS.danger.h) <= 20 && chroma >= RED_CHROMA_FLOOR;

/** Generate a vivid, unanchored status ramp from a canonical hue. */
const statusRamp = (hue: number, chroma: number): Step[] =>
  generateRamp({ hue, chroma, peakL: peakChromaL(hue) });

// ---------------------------------------------------------------------------
// White-label brand input -> Theme
// ---------------------------------------------------------------------------
export type BrandInput = {
  id: string;
  /** The single, mode-invariant token namespace. Every token emits under `<root>.*`
   *  (colour primitives at `<root>.palette`, semantic roles at `<root>.color`).
   *  Per-engagement/brand; defaults to the placeholder 'prism'. One segment only —
   *  no dots (two-segment namespaces are intentionally unsupported). A namespace is
   *  always present today; a future "no namespace" mode would flatten it at the emit
   *  boundary (see docs/00-progress "Namespace" note) — not by emptying `root`. */
  root?: string;
  /** Which appearance modes to generate. `light` is always emitted (the required base);
   *  `dark` / `hc-light` / `hc-dark` are opt-in. Omit for all four (back-compat); a brand
   *  that ships light only sets `['light']`. The export layout follows this — a collection
   *  only splits into per-mode files when it's multi-mode (docs/11 §4, Pillar 1). */
  modes?: ModeName[];
  primary: OKLCH;                    // the exact brand anchor (palette 'primary')
  /** The neutral ramp generator. By default the greys are *derived* from a hue + peak
   *  chroma (a small cast toward the brand for cohesion). A brand that ships a
   *  pre-defined neutral instead sets `anchor` — the exact grey, pinned verbatim at its
   *  lightness step, with the whole ramp built around it (hue/chroma taken from the
   *  anchor). `hue`/`chroma` stay present (the derived readout) but the anchor drives the
   *  ramp when set. (A neutral kept as its own *separate* palette is the outlier case —
   *  express it as an entry in `brandColors`, not here.) */
  neutral: { hue: number; chroma: number; anchor?: OKLCH };
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
  /** Layout axis lever. `breakpoints` is the min-width floor array (the real
   *  per-brand variable; names are auto sm/md/lg/xl/2xl); `columns` the base
   *  count (12 default; 16/24 for dense-data brands); `containerMax`/
   *  `containerNarrow` the content caps. Gutter/margin alias the spacing scale. */
  layout?: { breakpoints?: number[]; columns?: number; containerMax?: number; containerNarrow?: number };
  /** Gradient axis lever — OPT-IN (off by default; most systems abstain and
   *  gradients are contextual). `true` ships one default brand gradient
   *  (primary.600→primary.350, linear); an explicit array ships exactly those.
   *  Stop colours alias the colour ramp; OKLCH interpolation by default. */
  gradients?: true | GradientInput[];
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
  link: boolean;                                   // underlined link variant (textDecoration baked)
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
  /** Per-role weight set. Weight is an axis on every type role (every composite
   *  carries the weight in its name). Defaults: display/title `[strong]`, body
   *  `[default, strong]` (add `emphasis` for a 3rd), caption `[default, strong]`,
   *  label/eyebrow `[emphasis]`, code `[default]`. Override a role to ship a
   *  multi-weight ramp (e.g. `display: ['default','strong']`). Roles use the 4
   *  weight-role names (subtle/default/emphasis/strong). */
  weights?: Partial<Record<TypeGroup, WeightRoleName[]>>;
  /** Which roles get an underlined `.link` variant for every size×weight. Default
   *  `['body','caption']`. Underline is baked; the link colour stays `text.link.*`. */
  links?: TypeGroup[];
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
// Weight is a CONFIGURABLE AXIS on every role (not a single baked weight): each
// role declares which weight roles it ships, and every composite carries the
// weight in its name (`type.body.md.strong`) so adding weights later never
// renames. Defaults stay lean — display/title single-weight (expandable: brands
// that ship multi-weight hero ramps just list more), body 2 (default + strong;
// `emphasis` is the opt-in 3rd), caption 2. Override per role via `weights`.
const TYPE_WEIGHTS_DEFAULT: Record<TypeGroup, WeightRoleName[]> = {
  display: ['strong'], title: ['strong'], label: ['emphasis'], eyebrow: ['emphasis'],
  body: ['default', 'strong'], caption: ['default', 'strong'], code: ['default'],
};
// Which roles get an underlined `.link` variant for EVERY size×weight (inline
// links inherit the surrounding text's size + weight). Underline is baked
// (textDecoration isn't Figma-bindable — a separate text style); the link COLOUR
// stays `text.link.*` and is applied alongside.
const TYPE_LINK_DEFAULT: TypeGroup[] = ['body', 'caption'];
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
  caption: [['md', 11], ['lg', 12]],          // small print; lg=12 (standard), md=11 (denser). sm=10 (fine print) is a future opt-in.
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
  const weightsMap = { ...TYPE_WEIGHTS_DEFAULT, ...(t.weights ?? {}) };
  const linkGroups = new Set(t.links ?? TYPE_LINK_DEFAULT);
  const out: TypeComposite[] = [];
  // One (group, size) fans out to every weight the role ships, and — for link
  // roles — an underlined variant of each. The weight (and `link`) are the trailing
  // name segments: `type.<group>.<size>.<weight>[.link]` (size omitted for sizeless
  // roles like eyebrow). Adding a weight later is purely additive — no renames.
  const push = (group: TypeGroup, variant: string, sizePx: number) => {
    const sizeMinPx = fluid ? mobileEndpoint(ladder, group, sizePx) : sizePx;
    const emit = (weightRole: WeightRoleName, link: boolean) => {
      // Link is a hyphenated suffix on the weight (`strong-link`), a clean SIBLING
      // leaf of the bare weight — not a `.link` child (that would make `strong` a
      // token-with-children, non-DTCG). Matches the `-subtle`/`on-disabled` convention.
      const weightSeg = link ? `${weightRole}-link` : weightRole;
      const segs = [group, variant, weightSeg].filter(Boolean);
      out.push({
        group, variant, weightRole, link, path: segs.join('.'), sizePx, sizeMinPx,
        family: familyMap[group], lineHeight: lineHeightFor(group, sizePx),
        tracking: trackingFor(group, sizePx), textCase: group === 'eyebrow' ? 'uppercase' : 'none',
      });
    };
    for (const weightRole of weightsMap[group]) {
      emit(weightRole, false);
      if (linkGroups.has(group)) emit(weightRole, true);
    }
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

// ---------------------------------------------------------------------------
// Layout axis (breakpoints + responsive grid + containers). Grounded in a
// 10-system survey. Decisions:
//  - 5 breakpoints, t-shirt named, min-width/mobile-first (the convergent shape);
//    ranges are derived (next − 1). The brand authors the floor ARRAY (the real
//    per-brand variable); names are constant.
//  - The 12-col grid is a DESIGN ARTIFACT (Figma layout-grid + mental model), not
//    the load-bearing code contract — modern layout is CSS Grid + container
//    queries. Columns emit as a 4/8/12 ladder (the design convention); base count
//    is one knob (12 default; 16/24 for dense-data brands).
//  - Gutter/margin are NOT independent tokens — they ALIAS the 8px spacing scale
//    (16→24→32 / 16→24→48), keyed to breakpoint index. Reuses the spacing engine.
//  - Containers: FLUID-first + a `container.max` cap (the 2026 default) + a
//    `narrow` reading container (~720). The fluid-vs-fixed duplication Prism2
//    shipped is collapsed; fixed-stepped is an opt-in modifier (deferred).
export type Breakpoint = { name: string; px: number };
export type GridStep = { bp: string; columns: number; gutterPx: number; marginPx: number };
export type LayoutAxis = {
  breakpoints: Breakpoint[];
  grid: GridStep[];
  baseColumns: number;
  containerMax: number;
  containerNarrow: number;
};
// Count-aware names: ≤5 tiers anchor at sm (sm/md/lg/xl/2xl — Tailwind); 6+ prepend
// xs (xs/sm/md/lg/xl/2xl — Bootstrap), so a small-phone tier is labelled correctly.
const bpNames = (n: number): string[] =>
  n <= 5 ? ['sm', 'md', 'lg', 'xl', '2xl'].slice(0, n) : ['xs', 'sm', 'md', 'lg', 'xl', '2xl', '3xl'].slice(0, n);
// Shallow gutter/margin ramps (px), anchored to Atlassian/Prism2; margin runs a
// step larger at the top. Sliced/clamped to the breakpoint count.
const GUTTER_PX = [16, 16, 24, 24, 32, 32];
const MARGIN_PX = [16, 24, 24, 32, 48, 48];

const buildLayout = (input: BrandInput['layout'] = {}): LayoutAxis => {
  const floors = input.breakpoints ?? [0, 768, 1024, 1440, 1920];
  const base = input.columns ?? 12;
  const n = floors.length;
  const names = bpNames(n);
  const breakpoints: Breakpoint[] = floors.map((px, i) => ({ name: names[i] ?? `bp${i}`, px }));
  // column ladder: smallest = 4, next = 8, top reaches the base count.
  const cols = (i: number): number => i === 0 ? Math.min(4, base) : i === n - 1 ? base : i === 1 ? Math.min(8, base) : base;
  const grid: GridStep[] = breakpoints.map((b, i) => ({
    bp: b.name, columns: cols(i),
    gutterPx: GUTTER_PX[Math.min(i, GUTTER_PX.length - 1)],
    marginPx: MARGIN_PX[Math.min(i, MARGIN_PX.length - 1)],
  }));
  return { breakpoints, grid, baseColumns: base, containerMax: input.containerMax ?? 1440, containerNarrow: input.containerNarrow ?? 720 };
};

// ---------------------------------------------------------------------------
// Gradient axis (brand-opt-in). Grounded in a 10-system survey + the DTCG
// gradient spec (2025.10) + the Figma round-trip research. Decisions:
//  - OFF by default: most mature systems abstain (Material/Carbon/Atlassian/
//    Primer/USWDS), and gradients are contextual. A brand opts in — `true` ships
//    ONE default brand gradient; an explicit array ships exactly those. NB ships
//    none (it had none). This is NOT a derived-for-everyone axis like colour.
//  - DTCG `gradient` composite is the spine: $value = stops [{color, position}],
//    and stop COLOURS ALIAS the colour ramp (the Fluent/Carbon model; themeable),
//    never raw hex (the deprecated Polaris/SLDS trap).
//  - DTCG omits kind/angle/interpolation (issue #101 — still open); we carry them
//    in $extensions, the way the spec's own proposals would: kind (linear/radial),
//    angle | center+shape, interpolation (OKLCH default).
//  - OKLCH interpolation avoids the sRGB "grey dead zone". Figma interpolates in
//    sRGB ONLY, so we PRE-SAMPLE the OKLCH curve into N baked sRGB stops for the
//    Figma Paint Style (the one renderer that needs them); CSS keeps `in oklch`.
//  - Materializes as a Figma PAINT STYLE (the 4th style class beside effect/text/
//    grid); only stop COLOURS bind to variables — kind/angle/positions are baked.
//  - Worst-case-stop contrast is computed: text over a gradient must clear its
//    ratio at the LOWEST-contrast point, not the average (none of the surveyed
//    systems do this — our contract-checking ethos extended to gradients).
export type GradientStopInput = { palette: string; step: number; position: number };
export type GradientInput = {
  name: string;
  kind?: 'linear' | 'radial';
  angle?: number;                 // linear only — degrees (default 135, a brand diagonal)
  center?: [number, number];      // radial only — 0..1 (default [0.5, 0.5])
  shape?: 'circle' | 'ellipse';   // radial only (default 'ellipse')
  interpolation?: 'oklch' | 'srgb';
  samples?: number;               // sRGB pre-sample count for Figma (default 5)
  stops: GradientStopInput[];
};
export type GradientStop = { aliasOf: string; position: number; rgb: RGB; hex: string; oklch: OKLCH };
export type ResolvedGradient = {
  name: string; kind: 'linear' | 'radial'; angle: number; center: [number, number];
  shape: 'circle' | 'ellipse'; interpolation: 'oklch' | 'srgb';
  stops: GradientStop[];
  sampled: { hex: string; position: number }[];  // baked sRGB approximation (Figma)
  worstOnWhite: number; worstOnBlack: number;     // lowest contrast of any sampled stop
};
export type GradientAxis = { gradients: ResolvedGradient[] };

const DEFAULT_BRAND_GRADIENT = (brandPalette: string): GradientInput => ({
  name: 'brand', kind: 'linear', angle: 135,
  stops: [{ palette: brandPalette, step: 600, position: 0 }, { palette: brandPalette, step: 350, position: 1 }],
});
// Shortest-arc hue interpolation (degrees) — the perceptually correct path.
const lerpHue = (h1: number, h2: number, t: number): number => {
  const dh = (((h2 - h1) % 360) + 540) % 360 - 180;
  return (h1 + t * dh + 360) % 360;
};
const lerpOklch = (a: OKLCH, b: OKLCH, t: number): OKLCH => ({ l: a.l + (b.l - a.l) * t, c: a.c + (b.c - a.c) * t, h: lerpHue(a.h, b.h, t) });
const lerpRgb = (a: RGB, b: RGB, t: number): RGB => ({ r: Math.round(a.r + (b.r - a.r) * t), g: Math.round(a.g + (b.g - a.g) * t), b: Math.round(a.b + (b.b - a.b) * t) });

const buildGradient = (spec: BrandInput['gradients'], palettes: PaletteBuild[], root: string): GradientAxis => {
  if (!spec) return { gradients: [] };
  const inputs: GradientInput[] = spec === true ? [DEFAULT_BRAND_GRADIENT('primary')] : spec;
  const stepOf = (palette: string, step: number): Step => {
    const p = palettes.find((pp) => pp.palette === palette);
    if (!p) throw new Error(`gradient: palette '${palette}' is not defined (have: ${palettes.map((x) => x.palette).join(', ')})`);
    const s = p.steps.find((st) => st.num === step);
    if (!s) throw new Error(`gradient: '${palette}.${step}' is not a valid ramp step`);
    return s;
  };
  const gradients: ResolvedGradient[] = inputs.map((g) => {
    const kind = g.kind ?? 'linear';
    const interpolation = g.interpolation ?? 'oklch';
    const samples = Math.max(2, g.samples ?? 5);
    const stops: GradientStop[] = g.stops
      .slice().sort((a, b) => a.position - b.position)
      .map((st) => {
        const s = stepOf(st.palette, st.step);
        return { aliasOf: `${root}.palette.${st.palette}.${s.key}`, position: st.position, rgb: s.rgb, hex: s.hex, oklch: s.oklch };
      });
    // Pre-sample the curve at N evenly-spaced positions (the chosen interpolation
    // space), output sRGB — the baked stops Figma needs (it can't interpolate OKLCH).
    const sampleRgb = (p: number): RGB => {
      if (p <= stops[0].position) return stops[0].rgb;
      if (p >= stops[stops.length - 1].position) return stops[stops.length - 1].rgb;
      for (let i = 0; i < stops.length - 1; i++) {
        const a = stops[i], b = stops[i + 1];
        if (p >= a.position && p <= b.position) {
          const t = (p - a.position) / (b.position - a.position || 1);
          return interpolation === 'oklch' ? oklchToRgb(lerpOklch(a.oklch, b.oklch, t)) : lerpRgb(a.rgb, b.rgb, t);
        }
      }
      return stops[stops.length - 1].rgb;
    };
    const sampledRgb = Array.from({ length: samples }, (_, i) => sampleRgb(i / (samples - 1)));
    const sampled = sampledRgb.map((rgb, i) => ({ hex: rgbHex(rgb), position: Math.round((i / (samples - 1)) * 1000) / 1000 }));
    const WHITE: RGB = { r: 255, g: 255, b: 255 }, BLACK: RGB = { r: 0, g: 0, b: 0 };
    const worstOnWhite = Math.min(...sampledRgb.map((c) => contrast(c, WHITE)));
    const worstOnBlack = Math.min(...sampledRgb.map((c) => contrast(c, BLACK)));
    return {
      name: g.name, kind, angle: g.angle ?? 135, center: g.center ?? [0.5, 0.5],
      shape: g.shape ?? 'ellipse', interpolation, stops, sampled, worstOnWhite, worstOnBlack,
    };
  });
  return { gradients };
};

export const brandTheme = (input: BrandInput): Theme => {
  const notes: string[] = [];
  const root = input.root ?? 'prism';
  // Single lowercase segment — enforce the "no two-segment namespaces" contract here
  // too (not only in the schema), since brandTheme is also called with in-memory
  // BrandInput that never touched schema validation (the web app builds it directly).
  if (!/^[a-z][a-z0-9-]*$/.test(root)) {
    throw new Error(`root namespace '${root}' must be a single lowercase segment (letters/digits/hyphen, no dots or spaces)`);
  }
  // Appearance modes — light is the required base; dark/HC are opt-in. Validate here too
  // (in-memory BrandInput skips schema validation).
  const modes = input.modes ?? ALL_MODES;
  const badMode = modes.find((m) => !VALID_MODES.includes(m));
  if (badMode) throw new Error(`unknown mode '${badMode}' (valid: ${VALID_MODES.join(', ')})`);
  if (!modes.includes('light')) throw new Error('modes must include "light" (the required base mode)');
  // Note only the default (light/dark/HC) opt-out; wireframe is an opt-IN addition, noted separately.
  const stdModes = modes.filter((m) => m !== 'wireframe');
  if (stdModes.length < ALL_MODES.length) notes.push(`modes: generating ${stdModes.join(', ')} only (dark/HC opt-out)`);
  if (modes.includes('wireframe')) notes.push('modes: wireframe generated (greyscale — non-neutral roles → equivalent neutral; radius → 0)');
  if (root !== 'prism') notes.push(`namespace: tokens emit under '${root}.*' (custom, not the 'prism' default)`);
  const anchorStep = autoPlaceStep(input.primary.l);
  notes.push(`primary anchor (h${input.primary.h}) pinned exactly at step ${anchorStep}`);

  // M-03: a pinned anchor whose chroma is out of sRGB gamut can't be rendered exactly — the
  // engine clamps toward the boundary, which silently nudges lightness AND hue (independent-
  // channel clip). Surface it in the decisions log so the shift isn't invisible (the designer
  // can lower the chroma). Rendering is unchanged here; a constant-hue chroma projection is the
  // available upgrade (needs an all-emitter regen incl. emit-figma — see docs/00).
  const gamutNote = (name: string, o: { l: number; c: number; h: number }) => {
    if (inGamut(o)) return;
    const mc = Math.round(maxChroma(o.l, o.h, o.c) * 1000) / 1000;
    notes.push(`anchor '${name}' (L${o.l} C${o.c} h${o.h}) is OUT of sRGB gamut — max renderable chroma at this L/hue is ~${mc}; it ships clamped toward the boundary, so its lightness and hue may drift. Lower its chroma to ~${mc} for an exact match.`);
  };
  gamutNote('primary', input.primary);
  for (const bc of input.brandColors ?? []) gamutNote(bc.name, bc.oklch);
  if (input.neutral.anchor) gamutNote('neutral', input.neutral.anchor);

  // Neutral ramp: pinned around a pre-defined grey when `neutral.anchor` is set (built
  // from the anchor's hue/chroma, pinned verbatim at its lightness step — same mechanism
  // as the brand palettes), else derived from hue + peak chroma.
  const nAnchor = input.neutral.anchor;
  const neutralSteps = nAnchor
    ? generateRamp({ hue: nAnchor.h, chroma: nAnchor.c, anchor: { oklch: nAnchor, stepNum: autoPlaceStep(nAnchor.l) } })
    : generateRamp({ hue: input.neutral.hue, chroma: input.neutral.chroma });
  if (nAnchor) notes.push(`neutral pinned around a pre-defined grey (L${nAnchor.l}) at step ${autoPlaceStep(nAnchor.l)} — ramp built from the anchor, not the hue/chroma cast`);

  const palettes: PaletteBuild[] = [
    { palette: 'primary', role: 'brand', description: 'Brand primary', steps: generateRamp({ hue: input.primary.h, chroma: input.primary.c, anchor: { oklch: input.primary, stepNum: anchorStep } }) },
    { palette: 'neutral', role: 'neutral', description: 'Neutral', steps: neutralSteps },
  ];

  // Additional brand colours (secondary / tertiary / accents) — arbitrary count.
  // Validate names first (CR-03): reject reserved collisions, bad charset, and duplicates —
  // all of which would otherwise silently corrupt the palette map with green gates.
  const seenNames = new Set<string>();
  for (const bc of input.brandColors ?? []) {
    if (!PALETTE_NAME_RE.test(bc.name))
      throw new Error(`brand colour name '${bc.name}' must be a single lowercase slug (letters/digits/hyphen, start with a letter — no dots, spaces, or symbols)`);
    if (RESERVED_PALETTES.has(bc.name))
      throw new Error(`brand colour name '${bc.name}' is reserved (an engine-generated palette) — it would overwrite that ramp; pick a distinct name`);
    if (seenNames.has(bc.name))
      throw new Error(`duplicate brand colour name '${bc.name}' — brand colour names must be unique`);
    seenNames.add(bc.name);
  }
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
  } else if (inRedTerritory(input.primary.h, input.primary.c)) {
    // The brand's own colour IS a saturated red — reuse the primary palette rather
    // than minting a near-duplicate red.
    roleToPalette.danger = 'primary';
    notes.push(`danger: primary hue ${input.primary.h} (chroma ${input.primary.c}) is a saturated red → danger reuses the primary palette (no separate red)`);
  } else {
    // Primary is not a saturated red, so carve a dedicated danger red the brand never gave us.
    const d = STATUS_DEFAULTS.danger;
    palettes.push({ palette: 'danger', role: 'danger', description: 'danger status (engine-carved red — primary is not red)', steps: statusRamp(d.h, d.chroma) });
    // Distinguish the two carve reasons (M-05): a red-ish-but-greige primary must NOT be reused
    // for danger (a near-grey can't signal destruction), even though its hue is in the window.
    const hueIsRed = hueDist(input.primary.h, STATUS_DEFAULTS.danger.h) <= 20;
    notes.push(hueIsRed
      ? `danger: primary hue ${input.primary.h} is red-ish but its chroma ${input.primary.c} is below the ${RED_CHROMA_FLOOR} floor to read as danger → carved a dedicated saturated red at hue ${d.h} (a near-grey warm primary can't signal destructive actions)`
      : `danger: primary hue ${input.primary.h} is NOT red → carved a dedicated danger red at hue ${d.h}`);
  }
  // Knife-edge note (M-05): flag when the primary hue sits within 3° of the ±20° red boundary —
  // a small hue shift would flip danger between reuse-primary and carve-red.
  if (Math.abs(hueDist(input.primary.h, STATUS_DEFAULTS.danger.h) - 20) <= 3 && input.primary.c >= RED_CHROMA_FLOOR)
    notes.push(`danger: primary hue ${input.primary.h} is near the red-territory boundary (±20° of ${STATUS_DEFAULTS.danger.h}) — a small hue shift would flip the danger strategy`);

  const baseUnit = input.baseUnit ?? 4;
  const spaceBase = input.spaceBase ?? 8;
  const density = input.density ?? 'comfortable';
  const rScale = input.radiusScale ?? 1;
  const baseMd = input.baseMd ?? 4;
  notes.push(`dimension axis: ${baseUnit}px grid, ${spaceBase}px space rhythm, density '${density}' (drives component sizes), radius scale ${rScale} (baseMd ${baseMd}px)`);
  notes.push(`motion: tempo '${input.motionPersonality?.tempo ?? 'standard'}' scales the duration ramp; easing roles + springs + composite transitions generated; reduce-motion variants derived (informational preserved, vestibular → 0)`);
  const shadow = buildShadow(input.neutral.hue, input.shadow);
  notes.push(`shadow: 6-step ramp (xs–2xl) + inset, 2-layer (key+ambient), softness ${shadow.softness}; tinted base (hue ${shadow.tint.hue}, amount ${shadow.tint.amount}${shadow.tint.amount === 0 ? ' = pure black' : ''}). Mode-aware, LIFT-primary: full shadow in light; reduced (faded, top-weighted) in dark — the surface ladder carries dark elevation. Composite shadow → Figma Effect Style.`);
  const gradient = buildGradient(input.gradients, palettes, root);
  if (gradient.gradients.length) {
    notes.push(`gradient: ${gradient.gradients.length} brand gradient(s) [${gradient.gradients.map((g) => `${g.name} ${g.kind}${g.kind === 'linear' ? ` ${g.angle}°` : ''} ${g.stops.length}-stop`).join(', ')}] — OPT-IN. DTCG composite spine, stop colours alias the ramp; kind/angle/${gradient.gradients[0].interpolation} interpolation in \$extensions (DTCG omits them — issue #101). OKLCH-interpolated + ${gradient.gradients[0].sampled.length}-stop sRGB pre-sample for Figma (sRGB-only); materializes as a Figma Paint Style (only stop colours bind). Worst-case-stop contrast computed for text-on-gradient.`);
  } else {
    notes.push('gradient: none (opt-in axis; brand declared no gradients — the field-common default).');
  }
  const layout = buildLayout(input.layout);
  notes.push(`layout: ${layout.breakpoints.length} breakpoints (${layout.breakpoints.map((b) => `${b.name} ${b.px}`).join(', ')}); grid base ${layout.baseColumns} cols (ladder ${layout.grid.map((g) => g.columns).join('/')}); gutter/margin alias the spacing scale (${layout.grid.map((g) => g.gutterPx).join('/')} · ${layout.grid.map((g) => g.marginPx).join('/')}); container max ${layout.containerMax}px + narrow ${layout.containerNarrow}px (fluid-first + cap). Breakpoints → a separate Figma layout collection (modes), composing with colour light/dark.`);
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

  // Action anchor step (M-06): honour the brand's PINNED accent when `actionPalette` names a
  // brandColor — resolve the action role at that accent's own step (matching the nbTheme fixture's
  // semantics, action=550=accent step), not the hardcoded 500 pivot which silently discarded the
  // brand's chosen shade while the note claimed the decision was honoured. `pickBrand` still nudges
  // to clear AA on the floor, so accessibility is preserved regardless. 'primary' → the primary
  // anchor; an unanchored palette (neutral / status) has no pinned step → the 500 mid pivot.
  const actionBrandColor = (input.brandColors ?? []).find((b) => b.name === actionPalette);
  const actionAnchorStep = actionPalette === 'primary' ? anchorStep
    : actionBrandColor ? autoPlaceStep(actionBrandColor.oklch.l)
    : 500;
  if (actionBrandColor) notes.push(`action anchored at accent '${actionPalette}' step ${actionAnchorStep} (its pinned lightness) — the brand's own shade, nudged only if it fails AA on the floor`);

  return {
    id: input.id, root, namespace: `${root}.palette`, colorFormat: 'hex', modes, palettes, roleToPalette, notes,
    roleAnchorStep: { brand: anchorStep, neutral: 500, success: 500, warning: 500, danger: 500, info: 500, action: actionAnchorStep },
    surfaces: input.surfaces,
    disabledStrategy: input.disabledStrategy ?? 'accessible',
    disabledMin: input.disabledMin ?? 3,
    iconContrast: input.iconContrast ?? 'text',
    dims: buildDims(baseUnit, spaceBase, density, rScale, baseMd),
    motion: buildMotion(input.motionPersonality),
    typography,
    shadow,
    layout,
    gradient,
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

/** NB regression specs from parsed measured data (kept stable so the regression stays comparable). */
export const nbSpecsFrom = (s: NbMeasured): RampSpec[] => {
  return [
    { name: 'brand (red)', palette: 'red', role: 'brand', hue: s.primaryColor.oklch.h, chroma: s.primaryColor.oklch.c, anchor: { oklch: oklchOf(s.primaryColor.oklch), stepNum: 550 } },
    { name: 'success (green)', palette: 'green', role: 'success', hue: s.statusColors.success.oklch.h, chroma: s.statusColors.success.oklch.c, anchor: { oklch: oklchOf(s.statusColors.success.oklch), stepNum: 500 } },
    { name: 'warning (amber)', palette: 'amber', role: 'warning', hue: s.statusColors.warning.oklch.h, chroma: s.statusColors.warning.oklch.c, anchor: { oklch: oklchOf(s.statusColors.warning.oklch), stepNum: 500 } },
    { name: 'neutral', palette: 'neutral', role: 'neutral', hue: s.neutralHue.hue, chroma: s.neutralHue.chroma },
  ];
};

export const buildRamp = (spec: RampSpec): Step[] =>
  generateRamp({ hue: spec.hue, chroma: spec.chroma, anchor: spec.anchor });

export const nbThemeFrom = (s: NbMeasured): Theme => {
  const specs = nbSpecsFrom(s);
  const palettes: PaletteBuild[] = specs.map((spec) => ({
    palette: spec.palette, role: spec.role, description: spec.name, steps: buildRamp(spec),
  }));
  // NB ships no blue; synthesise an info palette so the semantic layer is complete.
  palettes.push({ palette: 'info', role: 'info', description: 'info status (engine-synthesised — NB has no blue)', steps: statusRamp(STATUS_DEFAULTS.info.h, STATUS_DEFAULTS.info.chroma) });
  const baseUnit = s.density?.baseUnit ?? 4;
  const baseMd = s.radius?.baseMd ?? 4;
  // Engine taxonomy (not NB's): 8px space rhythm reproducing Prism2's numbered
  // scale; NB's 4px grid still backs radius/borders. NB ships radius scale=1 and
  // a 720px layout outlier.
  const dims = buildDims(baseUnit, 8, 'comfortable', 1, baseMd, [720]);
  return {
    id: 'nb', root: 'nbds', namespace: 'nbds.palette', colorFormat: 'rgb', modes: ALL_MODES, palettes,
    roleToPalette: { brand: 'red', neutral: 'neutral', success: 'green', warning: 'amber', danger: 'red', info: 'info', action: 'red' },
    roleAnchorStep: { brand: 550, neutral: 500, success: 500, warning: 500, danger: 550, info: 500, action: 550 },
    disabledStrategy: 'accessible', disabledMin: 3, iconContrast: 'text',
    dims, motion: buildMotion(),
    typography: buildTypography(),
    shadow: buildShadow(s.neutralHue.hue, { tint: { amount: 0 } }),  // NB ships pure-black shadows
    layout: buildLayout({ containerMax: 1920 }),                     // NB caps at 1920 + narrow 720
    gradient: { gradients: [] },                                     // NB ships no gradients (it had none)
    notes: [
      'NB regression: measured anchors; brand red also serves as danger (NB brand hue is its danger hue).',
      `dimension axis: ${baseUnit}px grid, 8px space rhythm (Prism2 numbered scale), comfortable density, radius scale 1 (baseMd ${baseMd}px).`,
      'typography: curated rem size ladder (22 steps, 10–160px) reproducing the Prism2 reference scale; weight roles subtle/default/emphasis/strong → 300/400/600/700.',
      'shadow: 6-step ramp + inset, 2-layer, pure-black (NB dialect); mode-aware lift-primary (reduced in dark, NOT NB\'s heavier inverse — the field-correct choice).',
      'layout: 5 breakpoints (engine default) + 12-col grid (4/8/12 ladder) + container max 1920 / narrow 720 (NB caps); gutter/margin alias the spacing scale.',
    ],
  };
};
