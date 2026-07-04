/**
 * tree.ts — the PURE DTCG token-tree builder (extracted from emit-dtcg.ts).
 *
 * `buildTree(theme)` walks a resolved Theme into the full DTCG token tree (colour
 * primitives + semantic aliases with per-mode `$extensions.prism3.modes`, dimensions,
 * typography composites, shadow/gradient/motion), plus the per-mode contrast results
 * and stats. It is the single generator — the CLI, the regression runner, and the
 * emit shell all persist ITS output; no token logic lives downstream.
 *
 * PURE — no `node:*`, no I/O (depends only on color/ramp/theme/modes). This is what
 * lets the browser hosts resolve geometry/type bindings (docs/09) and the future
 * `emit-figma` adapter read the tree without pulling the file-I/O shell into a
 * sandbox bundle. `emit-dtcg.ts` re-exports `buildTree` for existing importers.
 */
import { RGB, contrast, hex } from './color';
import { Step } from './ramp';
import { Theme, ShadowStep, ShadowLayer, ResolvedGradient } from './theme';
import { resolveAllModes, ModeResult } from './modes';

const WHITE: RGB = { r: 255, g: 255, b: 255 };
const BLACK: RGB = { r: 0, g: 0, b: 0 };
const round = (n: number, d = 4) => Math.round(n * 10 ** d) / 10 ** d;
const rgbStr = ({ r, g, b }: RGB) => `rgb(${r}, ${g}, ${b})`;
const colorValue = (rgb: RGB, fmt: 'rgb' | 'hex') => (fmt === 'hex' ? hex(rgb) : rgbStr(rgb));
const rgbFromHex = (h: string): RGB => ({ r: parseInt(h.slice(1, 3), 16), g: parseInt(h.slice(3, 5), 16), b: parseInt(h.slice(5, 7), 16) });
const colorValueFromHex = (h: string, fmt: 'rgb' | 'hex') => (fmt === 'hex' ? h : rgbStr(rgbFromHex(h)));
const alphaHex = (a: number) => Math.round(a * 255).toString(16).padStart(2, '0');
const alphaColorValue = (rgb: RGB, a: number, fmt: 'rgb' | 'hex') =>
  fmt === 'hex' ? `${hex(rgb)}${alphaHex(a)}` : `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${round(a, 2)})`;
// Shared opacity/alpha step set (percent). Ramps use 5–90; the opacity scale full.
const ALPHA_STEPS = [0, 5, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100];

const bandName: Record<string, string> = {
  Highlights: 'Highlight', Quarter: 'Quarter-Tone', Mid: 'Mid-Tone',
  ThreeQuarter: 'Three-Quarter-Tone', Shadows: 'Shadow',
};

// Elevation is no longer a colour group: it's expressed as a foreground surface
// tier + a shadow step, composed at the component layer (see docs/06). The shadow
// ramp + the tonal foreground ladder carry it; no parallel `elevation.*` tokens.

type Token = { $type: 'color' | 'dimension' | 'number' | 'strokeStyle' | 'duration' | 'cubicBezier' | 'transition' | 'spring' | 'fontFamily' | 'fontWeight' | 'typography' | 'shadow' | 'gradient'; $value: string | number | number[] | string[] | Record<string, unknown> | Record<string, unknown>[]; $description: string; $extensions: { prism3: Record<string, unknown> } };

// ---- colour leaves ----
const primitiveLeaf = (theme: Theme, paletteDesc: string, s: Step, isAnchor: boolean): Token => {
  const role = isAnchor ? 'brand anchor (exact, pinned)' : s.num === 500 ? 'mid-tone AA pivot (≥4.5:1 on white & black)' : '';
  return {
    $type: 'color', $value: colorValue(s.rgb, theme.colorFormat),
    $description: `${paletteDesc} ${s.key} — ${bandName[s.band]} band${role ? ` — ${role}` : ''}`,
    $extensions: { prism3: { generated: true, source: 'oklch', oklch: { l: round(s.oklch.l), c: round(s.oklch.c), h: round(s.oklch.h, 2) }, hex: s.hex, band: s.band, anchor: isAnchor, contrastOnWhite: contrast(s.rgb, WHITE) } },
  };
};
const baseLeaf = (theme: Theme, rgb: RGB, description: string, band: string): Token => ({
  $type: 'color', $value: colorValue(rgb, theme.colorFormat), $description: description,
  $extensions: { prism3: { generated: true, source: 'oklch', hex: hex(rgb), band } },
});
const aliasLeaf = (path: string, description: string, extra: Record<string, unknown>): Token => ({
  $type: 'color', $value: `{${path}}`, $description: description,
  $extensions: { prism3: { role: 'semantic', aliasOf: path, ...extra } },
});
// Alpha colour (composites over any surface — scrims, overlays, shadows).
const alphaLeaf = (theme: Theme, rgb: RGB, a: number, description: string): Token => ({
  $type: 'color', $value: alphaColorValue(rgb, a, theme.colorFormat), $description: description,
  $extensions: { prism3: { generated: true, alpha: a, note: 'composites over any surface' } },
});
// Dimensionless opacity primitive.
const numLeaf = (value: number, description: string): Token => ({
  $type: 'number', $value: value, $description: description,
  $extensions: { prism3: { generated: true } },
});
// strokeStyle is a first-class DTCG type (Style-Dictionary-supported) — used for
// the focus ring style ('solid'), not a generic 'string'.
const strokeStyleLeaf = (value: string, description: string): Token => ({
  $type: 'strokeStyle', $value: value, $description: description,
  $extensions: { prism3: { generated: true } },
});
// ---- motion leaves ----
const durLeaf = (ms: number, description: string): Token => ({
  $type: 'duration', $value: `${ms}ms`, $description: description,
  $extensions: { prism3: { generated: true, ms } },
});
const bezierLeaf = (b: number[], description: string): Token => ({
  $type: 'cubicBezier', $value: b, $description: description,
  $extensions: { prism3: { generated: true } },
});
const springLeaf = (p: { damping: number; stiffness: number }, description: string): Token => ({
  $type: 'spring', $value: p, $description: description,
  // `spring` is an INTENTIONAL custom type — springs have no DTCG type yet
  // (design-tokens CG open issue). Style Dictionary ingests it without error
  // (unknown types pass through) but needs a custom transform to render it; that
  // is expected, since spring → platform (web linear()/CSS, native
  // stiffness/damping/mass) is inherently a per-platform step.
  $extensions: { prism3: { generated: true, customType: 'spring', note: 'no DTCG type for springs yet; provide a platform transform downstream' } },
});
// Composite (DTCG transition): bundles duration + easing by intent.
const transitionLeaf = (durPath: string, easePath: string, description: string): Token => ({
  $type: 'transition', $value: { duration: `{${durPath}}`, timingFunction: `{${easePath}}`, delay: '0ms' },
  $description: description, $extensions: { prism3: { role: 'composite' } },
});

// ---- shadow leaves (Phase A) ----
// DTCG `shadow` composite — an array of layers (key + ambient). Mode-aware via the
// locked materialization pattern: $value carries the LIGHT shadow (canonical);
// $extensions.prism3.modes.dark carries the REDUCED dark shadow (lift-primary — the
// surface ladder does dark elevation). Materializes as a Figma Effect Style (colour
// + numerics bindable per layer; verified in the Figma round-trip research).
const shadowLayerValue = (theme: Theme, l: ShadowLayer) => ({
  color: alphaColorValue(theme.shadow.colorRgb, l.alpha, theme.colorFormat),
  offsetX: `${l.offsetX}px`, offsetY: `${l.offsetY}px`, blur: `${l.blur}px`, spread: `${l.spread}px`,
});
const shadowLeaf = (theme: Theme, step: ShadowStep, description: string): Token => ({
  $type: 'shadow',
  $value: step.light.map((l) => shadowLayerValue(theme, l)),
  $description: description,
  $extensions: { prism3: { generated: true, role: 'composite', layers: step.light.length,
    // dark shadow reduction only when the brand generates dark (docs/11 Pillar 1) — a
    // light-only brand carries no mode overrides on shadow either.
    modes: theme.modes.includes('dark') ? { dark: step.dark.map((l) => shadowLayerValue(theme, l)) } : {},
    figma: { kind: 'effect-style', styleType: 'EFFECT', binds: ['color', 'radius', 'spread', 'offsetX', 'offsetY'], note: 'Figma Effect Style (drop-shadow layers); colour + numerics bindable per layer; mode-aware — dark shadow is reduced (surface lift carries dark elevation), see modes.dark' } } },
});

// ---- gradient leaves (brand-opt-in) ----
// DTCG `gradient` composite — $value is an array of stops [{ color, position }],
// stop COLOUR an alias into the colour ramp (themeable; the Fluent/Carbon model).
// DTCG omits kind/angle/interpolation (issue #101), so those live in $extensions
// alongside the materialization directive: a Figma PAINT STYLE (4th style class)
// where only stop colours bind (kind/angle/positions baked), plus an N-stop sRGB
// pre-sample of the OKLCH curve (Figma interpolates in sRGB only) and the CSS
// `in oklch` string. A worst-case-stop contrast pair gates text-on-gradient use.
const round3 = (n: number) => Math.round(n * 1000) / 1000;
const gradientCss = (g: ResolvedGradient, fmt: 'rgb' | 'hex'): string => {
  const stopList = g.stops.map((s) => `${colorValueFromHex(s.hex, fmt)} ${round3(s.position * 100)}%`).join(', ');
  const space = g.interpolation === 'oklch' ? ' in oklch' : '';
  if (g.kind === 'radial') return `radial-gradient(${g.shape} at ${round3(g.center[0] * 100)}% ${round3(g.center[1] * 100)}%${space}, ${stopList})`;
  return `linear-gradient(${g.angle}deg${space}, ${stopList})`;
};
const gradientLeaf = (g: ResolvedGradient, fmt: 'rgb' | 'hex'): Token => {
  const paintType = g.kind === 'radial' ? 'GRADIENT_RADIAL' : 'GRADIENT_LINEAR';
  const geom = g.kind === 'radial' ? { center: g.center, shape: g.shape } : { angle: g.angle };
  const aa = Math.min(g.worstOnWhite, g.worstOnBlack);
  return {
    $type: 'gradient',
    $value: g.stops.map((s) => ({ color: `{${s.aliasOf}}`, position: round3(s.position) })),
    $description: `gradient ${g.name} — ${g.kind}${g.kind === 'linear' ? ` ${g.angle}°` : ` (${g.shape})`}, ${g.stops.length} stops, ${g.interpolation} interpolation — brand gradient (opt-in)`,
    $extensions: { prism3: { generated: true, role: 'composite', kind: g.kind, ...geom, interpolation: g.interpolation,
      css: gradientCss(g, fmt),
      a11y: { worstOnWhite: g.worstOnWhite, worstOnBlack: g.worstOnBlack,
        note: `text-on-gradient: white text clears ${g.worstOnWhite}:1 at the lightest stop, black text ${g.worstOnBlack}:1 at the darkest — a text overlay must meet its ratio at the worst-case point (constrain the lightness range or add a scrim)${aa < 4.5 ? '; NEITHER plain overlay clears 4.5:1 body text — use a scrim or a solid container' : ''}` },
      figma: { kind: 'paint-style', styleType: 'PAINT', paintType, binds: ['gradientStops[].color'], baked: ['type', g.kind === 'radial' ? 'center/shape' : 'angle', 'positions'],
        sampledStops: g.sampled,
        note: 'Figma Paint Style (gradient fill) — created via the Plugin API only (REST cannot write/read Paint values). Only stop COLOURS bind to COLOR variables (Plugin API Update 92); kind, angle/transform and stop positions are baked. Figma interpolates in sRGB only, so bind the canonical stop colours AND lay down sampledStops to approximate the OKLCH curve.' } } },
  };
};

// ---- dimension leaves ----
const dimLeaf = (px: number, description?: string): Token => ({
  $type: 'dimension', $value: `${px}px`, $description: description ?? `${px}px — dimension primitive`,
  $extensions: { prism3: { generated: true, px } },
});
const dimAlias = (path: string, description: string, extra: Record<string, unknown>): Token => ({
  $type: 'dimension', $value: `{${path}}`, $description: description,
  $extensions: { prism3: { role: 'semantic', aliasOf: path, ...extra } },
});

// ---- typography leaves (Phase 1 primitives) ----
// Each leaf carries a `figma` materialization directive in $extensions.prism3:
// the exporter reads it (never the .ai.json prose). DTCG-canonical value lives in
// $value (rem / unitless multiplier / em); the bindable Figma form is derived.
const fontFamilyLeaf = (stack: string[], variable: boolean, description: string): Token => ({
  $type: 'fontFamily', $value: stack, $description: description,
  $extensions: { prism3: { generated: true, variable, figma: { kind: 'style-part', field: 'fontFamily', scope: 'FONT_FAMILY' } } },
});
// Font size: $value in rem (accessibility — scales with the user base size, KB 23);
// px carried for the Figma exporter (Figma binds FONT_SIZE as a px FLOAT variable).
const fontSizeLeaf = (px: number, description: string): Token => {
  const rem = round(px / 16, 4);
  return {
    $type: 'dimension', $value: `${rem}rem`, $description: description,
    $extensions: { prism3: { generated: true, px, rem, figma: { kind: 'variable', field: 'fontSize', scope: 'FONT_SIZE', unit: 'px', value: px } } },
  };
};
const fontWeightLeaf = (value: number, description: string): Token => ({
  $type: 'fontWeight', $value: value, $description: description,
  $extensions: { prism3: { generated: true, figma: { kind: 'variable', field: 'fontWeight', scope: 'FONT_WEIGHT' } } },
});
const weightRoleAlias = (path: string, numeric: number, description: string): Token => ({
  $type: 'fontWeight', $value: `{${path}}`, $description: description,
  $extensions: { prism3: { role: 'semantic', aliasOf: path, numeric } },
});
// Line height: unitless multiplier in $value (DTCG-correct, CSS-correct). Figma
// has no unitless line-height variable, but PERCENT (multiplier×100) is
// mode/size-independent — the exporter bakes lineHeight as { unit: 'PERCENT' }
// so a fluid style with two fontSize modes gets one line-height value.
const lineHeightLeaf = (value: number, description: string): Token => ({
  $type: 'number', $value: value, $description: description,
  $extensions: { prism3: { generated: true, unitless: true, figma: { kind: 'style-part', field: 'lineHeight', unit: 'PERCENT', percent: Math.round(value * 100), note: 'Figma has no unitless line-height variable; the exporter bakes lineHeight as PERCENT (multiplier × 100) — mode/size-independent, so one bake covers desktop + mobile fluid modes' } } },
});
// Letter spacing: em-relative in $value (CSS-correct). Figma binds letter-
// spacing as either PIXELS or PERCENT; the exporter bakes as PERCENT (em×100)
// so a fluid style's tracking is size-independent. A future PR ships a tracking
// FLOAT collection (per §4 fix 3b — bindable form).
const letterSpacingLeaf = (em: number, description: string): Token => ({
  $type: 'dimension', $value: `${em}em`, $description: description,
  $extensions: { prism3: { generated: true, em, figma: { kind: 'style-part', field: 'letterSpacing', unit: 'PERCENT', percent: Math.round(em * 10000) / 100, note: 'Figma binds letter-spacing as PERCENT or PIXELS; the exporter bakes as PERCENT (em × 100) — mode/size-independent. A future pass ships FLOAT tracking variables so brands can retune tracking without style edits (§4 fix 3b bindable form)' } } },
});
// Composite (DTCG typography): bundles family/size/weight-role/line-height/tracking
// by intent. Sub-properties alias the primitives (weight via the role → numeric, so
// re-mapping a brand's weights reflows every composite). `textCase` is a literal
// (uppercase for eyebrow) — a baked style property, NOT a variable (textCase isn't
// Figma-bindable; verified in the KB Figma round-trip research). Materializes as a
// Figma Text Style binding the variable sub-properties; the case treatment and any
// underline variant are baked into the style (separate styles), not bound.
//   NOTE on aliasing: DTCG 2025.10 mandates JSON-Pointer ($ref) for property-level
//   aliases inside a composite, not brace syntax; we use brace syntax (our own
//   validator resolves it, and the Figma round-trip plan FLATTENS composites at
//   build — see 05 roadmap). A downstream SD/Tokens-Studio consumer may not honor
//   brace property-level aliases; flatten-at-build is the mitigation.
// Fluid interpolation: clamp(min, preferred, max) where preferred = a rem
// intercept + a vw slope, solved so it hits minPx at minVW and maxPx at maxVW. The
// rem term is mandatory (WCAG 1.4.4 — vw-only defeats user zoom).
const fluidClamp = (minPx: number, maxPx: number, minVW: number, maxVW: number): { clamp: string; preferred: string } => {
  const slope = (maxPx - minPx) / (maxVW - minVW);             // px per px of viewport
  const slopeVw = round(slope * 100, 4);                       // → vw units
  const interceptRem = round((minPx - slope * minVW) / 16, 4); // rem (carries user zoom)
  const preferred = `${interceptRem}rem + ${slopeVw}vw`;
  return { clamp: `clamp(${round(minPx / 16, 4)}rem, ${preferred}, ${round(maxPx / 16, 4)}rem)`, preferred };
};
const typographyLeaf = (root: string, c: { group: string; variant: string; sizePx: number; sizeMinPx: number; family: string; weightRole: string; lineHeight: string; tracking: string; textCase: string; link: boolean }, face: string, minVW: number, maxVW: number): Token => {
  const a = (seg: string) => `{${root}.font.${seg}}`;
  const value: Record<string, unknown> = {
    fontFamily: a(`family.${c.family}`),
    fontSize: a(`size.${c.sizePx}`),                            // canonical = desktop/max (fallback)
    fontWeight: a(`weight-role.${c.weightRole}`),
    lineHeight: a(`line-height.${c.lineHeight}`),
    letterSpacing: a(`letter-spacing.${c.tracking}`),
  };
  if (c.textCase !== 'none') value.textCase = c.textCase;          // literal, baked (not a variable)
  if (c.link) value.textDecoration = 'underline';                 // link variant — baked (not Figma-bindable)
  // Responsive directive (Phase 3): one min/max pair → web clamp() + Figma modes.
  // Canonical $value.fontSize stays the desktop alias; the exporter reads this.
  const isFluid = c.sizeMinPx !== c.sizePx;
  const responsive = isFluid
    ? {
        fluid: true,
        min: { px: c.sizeMinPx, rem: round(c.sizeMinPx / 16, 4), ref: `{${root}.font.size.${c.sizeMinPx}}` },
        max: { px: c.sizePx, rem: round(c.sizePx / 16, 4), ref: `{${root}.font.size.${c.sizePx}}` },
        web: fluidClamp(c.sizeMinPx, c.sizePx, minVW, maxVW).clamp,
        figma: { field: 'fontSize', scope: 'FONT_SIZE', modes: { mobile: c.sizeMinPx, desktop: c.sizePx } },
      }
    : { fluid: false, px: c.sizePx };
  return {
    $type: 'typography', $value: value,
    $description: `${c.group}${c.variant ? ' ' + c.variant : ''} ${c.weightRole}${c.link ? ' link' : ''} — ${isFluid ? `${c.sizeMinPx}→${c.sizePx}px fluid` : `${c.sizePx}px`} ${face} (${c.family} role), ${c.lineHeight} line-height, ${c.weightRole} weight, ${c.tracking} tracking${c.textCase !== 'none' ? `, ${c.textCase}` : ''}${c.link ? ', underlined (link — pair with text.link.* colour)' : ''} — consumer-facing type style`,
    $extensions: { prism3: { role: 'composite', group: c.group, variant: c.variant, weightRole: c.weightRole, sizePx: c.sizePx, ...(c.link ? { link: true } : {}), ...(c.textCase !== 'none' ? { textCase: c.textCase } : {}), responsive, figma: { kind: 'text-style', styleType: 'TEXT', binds: ['fontFamily', 'fontSize', 'fontWeight'], baked: ['lineHeight', 'letterSpacing', ...(c.textCase !== 'none' ? ['textCase'] : []), ...(c.link ? ['textDecoration'] : [])], note: 'Figma Text Style; fontFamily/fontSize/fontWeight bind their primitives (fontSize can bind a font-fluid var with desktop/mobile modes — see responsive.figma.modes); lineHeight + letterSpacing baked as PERCENT (mode/size-independent); textCase/underline baked (not bindable). fontStyle is derived from the bound fontWeight at import via a weight→style-name table.' } } },
  };
};

type Stats = {
  colorLeaves: number; dimLeaves: number; spaceTokens: number; radiusTokens: number; sizeSteps: number;
  fontSizes: number; fontWeights: number; typeComposites: number;
  aliases: number; resolved: number; modeChecks: number; modePass: number; broken: { path: string; ref: string }[];
};

export const buildTree = (theme: Theme): { tree: any; modes: ModeResult[]; stats: Stats } => {
  const root = theme.root;

  // ---- colour primitives (the reference tier) → `palette.*` ----
  const palette: Record<string, any> = {
    white: baseLeaf(theme, WHITE, 'Pure white — Highlight base / default surface', 'Highlights'),
    black: baseLeaf(theme, BLACK, 'Pure black — Shadow base', 'Shadows'),
  };
  const brandPalette = theme.roleToPalette.brand;
  const brandAnchorStep = theme.roleAnchorStep.brand;
  for (const p of theme.palettes) {
    const node: Record<string, Token> = {};
    for (const s of p.steps) node[s.key] = primitiveLeaf(theme, p.description, s, p.palette === brandPalette && s.num === brandAnchorStep);
    palette[p.palette] = node;
  }
  // alpha colour ramps — black/white at increasing opacity, for scrims/overlays
  // that must composite correctly over ANY surface (the Radix/Fluent pattern).
  const alphaRamp = (rgb: RGB, label: string) => {
    const node: Record<string, Token> = {};
    for (const s of ALPHA_STEPS) if (s > 0 && s < 100) node[String(s)] = alphaLeaf(theme, rgb, s / 100, `${label} ${s}% — alpha, composites over any surface`);
    return node;
  };
  palette['black-alpha'] = alphaRamp(BLACK, 'Black alpha');
  palette['white-alpha'] = alphaRamp(WHITE, 'White alpha');

  // ---- opacity primitive scale (dimensionless 0..1) ----
  const opacity: Record<string, Token> = {};
  for (const s of ALPHA_STEPS) opacity[String(s)] = numLeaf(round(s / 100, 2), `opacity ${s}% (${round(s / 100, 2)})`);

  // ---- colour semantic (role) layer → `color.*` ----
  // Mode-AGNOSTIC token names: one token per role, `light` is the canonical
  // `$value`, and dark / hc-light / hc-dark are value overrides in
  // `$extensions.prism3.modes` (each keeping its own contrast contract). This is
  // the same shape `shadow` already uses, and it maps 1:1 to a single Figma
  // colour variable with Light/Dark/HC modes. See docs/06 + docs/07.
  const modes = resolveAllModes(theme);
  // light is canonical ($value); the rest carry per-mode overrides — only those the brand
  // opted into (docs/11 Pillar 1). A light-only brand emits no mode overrides.
  const OVERRIDE_MODES = theme.modes.filter((m) => m !== 'light');
  const byMode = new Map(modes.map((m) => [m.mode, m]));
  const lightMode = byMode.get('light')!;
  const colorRoles: Record<string, any> = {};
  for (const [roleKey, lr] of Object.entries(lightMode.roles)) {
    const modeOverrides: Record<string, any> = {};
    for (const m of OVERRIDE_MODES) {
      const rr = byMode.get(m)?.roles[roleKey];
      if (!rr) continue; // defensive — every mode resolves the same role set today
      modeOverrides[m] = { $value: `{${rr.path}}`, contrast: rr.ratio, against: rr.against, ...(rr.min > 0 ? { min: rr.min } : {}) };
    }
    // Elevation is not a colour group — a component composes a foreground tier +
    // a shadow step (see docs/06). No parallel `elevation.*` tree is emitted.
    const leaf = aliasLeaf(lr.path, lr.description, {
      contrast: lr.ratio, against: lr.against, ...(lr.min > 0 ? { min: lr.min } : {}),
      modes: modeOverrides,
      figma: { collection: 'color', modes: ['light', ...OVERRIDE_MODES], note: 'one Figma colour variable; light is $value, other modes in $extensions.prism3.modes.*' },
    });
    const parts = roleKey.split('.'); // property-led, may nest (group / variant / state)
    let node = colorRoles;
    for (let i = 0; i < parts.length - 1; i++) node = (node[parts[i]] ??= {});
    node[parts[parts.length - 1]] = leaf;
  }

  // ---- dimension axis ----
  const gridSet = new Set(theme.dims.grid);
  // reference: fine grid primitives
  const dimension: Record<string, Token> = {};
  for (const px of theme.dims.grid) dimension[String(px)] = dimLeaf(px);
  // reference: numbered-multiplier space scale (density-free)
  const space: Record<string, Token> = {};
  const spaceKeyOf = new Map<number, string>(theme.dims.space.map((s) => [s.px, s.key]));
  for (const s of theme.dims.space) space[s.key] = dimAlias(`${root}.dimension.${s.px}`, `space.${s.key} — ${s.px}px (${s.mult}× ${theme.dims.spaceBase}px base)`, { px: s.px, mult: s.mult });
  // radius ramp (t-shirt)
  // Wireframe (docs/11 Pillar 1b) zeroes every radius: geometry becomes mode-varying, so a
  // non-zero radius carries a `modes.wireframe` override aliasing `dimension.0` — the same
  // per-mode override shape colour/shadow use. Only when the brand opted into wireframe.
  const radius: Record<string, Token> = {};
  const wireframe = theme.modes.includes('wireframe');
  for (const r of theme.dims.radius) {
    const leaf = gridSet.has(r.px)
      ? dimAlias(`${root}.dimension.${r.px}`, `radius ${r.name} — ${r.px}px${r.pill ? ' (pill)' : ''}`, { px: r.px, radiusScale: theme.dims.radiusScaleValue })
      : dimLeaf(r.px, `radius ${r.name} — ${r.px}px (off-grid literal)`);
    if (wireframe && r.px !== 0)
      leaf.$extensions.prism3.modes = { wireframe: { $value: `{${root}.dimension.0}`, px: 0, note: 'wireframe zeroes all radius (sharp corners)' } };
    radius[r.name] = leaf;
  }
  // component tier: each size binds a height + paired padding from the shared
  // scales, so a `md` control is identical across components. DENSITY acts here.
  const spacePad = (px: number, name: string): Token => {
    const key = spaceKeyOf.get(px);
    return key ? dimAlias(`${root}.space.${key}`, name, { px }) : dimLeaf(px, name);
  };
  const size: Record<string, any> = {};
  for (const z of theme.dims.sizes) {
    size[z.name] = {
      height: gridSet.has(z.height)
        ? dimAlias(`${root}.dimension.${z.height}`, `size.${z.name} control height — ${z.height}px (density: ${theme.dims.density})`, { px: z.height, density: theme.dims.density })
        : dimLeaf(z.height, `size.${z.name} control height — ${z.height}px`),
      'padding-x': spacePad(z.padX, `size.${z.name} horizontal inset — ${z.padX}px (density: ${theme.dims.density})`),
      'padding-y': spacePad(z.padY, `size.${z.name} vertical inset — ${z.padY}px (density: ${theme.dims.density})`),
    };
  }

  // ---- border-width — numeric primitives via the dimension grid (0/1/2/4) ----
  // 1px hairline floor; no sub-px tokens (unreliable on hi-dpi). Field consensus
  // clusters here (Tailwind 0/1/2/4/8, Atlassian 1/2, Fluent thin/thick).
  const bwAlias = (px: number, name: string): Token =>
    gridSet.has(px) ? dimAlias(`${root}.dimension.${px}`, name, { px }) : dimLeaf(px, name);
  const borderWidth: Record<string, Token> = {
    none: bwAlias(0, 'border-width none — 0px'),
    hairline: bwAlias(1, 'border-width hairline — 1px (default border floor)'),
    thick: bwAlias(2, 'border-width thick — 2px (emphasis / selected)'),
    heavy: bwAlias(4, 'border-width heavy — 4px'),
  };
  // ---- focus ring — WCAG 2.2 SC 2.4.13 (AAA) / 2.4.11 (AA) ----
  // width ≥2px floor (bump to 3 for clarity); offset separates the ring from the
  // element edge (0 for form fields, per Primer); style solid. Ring COLOUR is the
  // `color.border.focus` role (surface-aware; resolved per mode in $extensions). For an
  // any-background 3:1 guarantee, pair with a ≥9:1-contrasting outer band (W3C C40).
  const focus = {
    ring: {
      width: bwAlias(2, 'focus ring width — 2px (WCAG 2.4.13 floor; 3px for extra clarity)'),
      offset: bwAlias(2, 'focus ring offset — 2px (separates ring from the element edge)'),
      'offset-field': bwAlias(0, 'focus ring offset, form fields — 0px (ring hugs the field; Primer)'),
      style: strokeStyleLeaf('solid', 'focus ring style — solid (dashed/dotted fail at small sizes)'),
    },
  };

  // ---- motion axis — generated from the `tempo` personality lever ----
  const m = theme.motion;
  const motion: Record<string, any> = { duration: {}, 'duration-reduced': {}, easing: {}, spring: {}, transition: {} };
  for (const [k, v] of Object.entries(m.duration)) motion.duration[k] = durLeaf(v, `motion duration ${k} — ${v}ms (tempo: ${m.tempo})`);
  for (const [k, v] of Object.entries(m.durationReduced)) motion['duration-reduced'][k] = durLeaf(v, `reduce-motion ${k} — ${v}ms${v === 0 ? ' (eliminated — substitute a cross-fade)' : ''}`);
  for (const [k, v] of Object.entries(m.easing)) motion.easing[k] = bezierLeaf(v, `easing ${k}${k === 'calm' ? ' — accessibility: soft onset for long/involuntary motion' : ''}`);
  for (const [k, v] of Object.entries(m.spring)) motion.spring[k] = springLeaf(v, `spring ${k} — damping ${v.damping}, stiffness ${v.stiffness}`);
  for (const t of m.transitions) motion.transition[t.name] = transitionLeaf(`${root}.motion.duration.${t.duration}`, `${root}.motion.easing.${t.easing}`, `motion ${t.name} — ${t.desc} (${t.duration} + ${t.easing})`);
  motion.stagger = durLeaf(m.stagger, `stagger standard — ${m.stagger}ms between siblings`);

  // ---- typography axis — primitive tier (Phase 1) ----
  // Curated rem size ladder (brand-invariant, not ratio-derived); numeric weight
  // reference tier + function-named weight roles aliasing into it (the white-
  // label-safe weight model); unitless line-height multipliers; em letter-spacing.
  const ty = theme.typography;
  const family: Record<string, Token> = {};
  for (const f of ty.families) family[f.role] = fontFamilyLeaf(f.stack, f.variable, `font family — ${f.role} (${f.stack[0]})${f.variable ? ' [variable font]' : ''}`);
  const fsize: Record<string, Token> = {};
  for (const px of ty.sizesPx) fsize[String(px)] = fontSizeLeaf(px, `font size ${px}px (${round(px / 16, 4)}rem) — curated ladder primitive`);
  const fweight: Record<string, Token> = {};
  for (const w of ty.weightsRef) fweight[String(w)] = fontWeightLeaf(w, `font weight ${w} — numeric reference (the brand's literal axis value)`);
  const weightRole: Record<string, Token> = {};
  for (const r of ty.weightRoles) weightRole[r.role] = weightRoleAlias(`${root}.font.weight.${r.value}`, r.value, `weight role '${r.role}' → ${r.value} — function-named, white-label-stable (the brand maps the numeric; a 2-weight brand collapses roles)`);
  const lineHeight: Record<string, Token> = {};
  for (const lh of ty.lineHeights) lineHeight[lh.key] = lineHeightLeaf(lh.value, `line height ${lh.key} — ${lh.value}× (unitless multiplier)`);
  const letterSpacing: Record<string, Token> = {};
  for (const ls of ty.letterSpacings) letterSpacing[ls.key] = letterSpacingLeaf(ls.em, `letter spacing ${ls.key} — ${ls.em}em`);
  const font = { family, size: fsize, weight: fweight, 'weight-role': weightRole, 'line-height': lineHeight, 'letter-spacing': letterSpacing };

  // ---- typography semantic composites (Phase 2) ----
  // Consumer-facing type styles under `type.*`. Two composites may share a size
  // primitive (title.xs and body.lg at 18px) — distinct by family/line-height/
  // weight, resolved via the composite, not the size. The shared ladder stays
  // single-source; font.size.* aliased_by then shows the overlap explicitly.
  const faceOf: Record<string, string> = Object.fromEntries(ty.families.map((f) => [f.role, f.stack[0]]));
  const typeGroup: Record<string, any> = {};
  for (const c of ty.composites) {
    const leaf = typographyLeaf(root, c, faceOf[c.family], ty.minViewport, ty.maxViewport);
    // Nest by the full composite path (group / size? / weight / link?).
    const parts = c.path.split('.');
    let node: Record<string, any> = typeGroup;
    for (let i = 0; i < parts.length - 1; i++) node = (node[parts[i]] ??= {});
    node[parts[parts.length - 1]] = leaf;
  }

  // ---- shadow / elevation axis (Phase A) ----
  const sh = theme.shadow;
  const shadow: Record<string, any> = {};
  sh.steps.forEach((s, i) => { shadow[s.name] = shadowLeaf(theme, s, `shadow ${s.name} — elevation ${i + 1} of ${sh.steps.length}, ${s.light.length}-layer (key+ambient)`); });
  shadow.inset = shadowLeaf(theme, sh.inset, 'shadow inset — inner shadow for wells / pressed states / inputs');

  // ---- gradient axis (brand-opt-in; empty for brands that declare none) ----
  const gradient: Record<string, Token> = {};
  for (const g of theme.gradient.gradients) gradient[g.name] = gradientLeaf(g, theme.colorFormat);

  // ---- layout axis: breakpoints + responsive grid + containers ----
  // Breakpoints = min-width floors; grid columns/gutter/margin per breakpoint
  // (gutter/margin ALIAS the spacing scale). Each breakpoint-keyed value carries a
  // figma directive mapping it to a SEPARATE layout collection whose modes are the
  // breakpoints (composes independently with the colour light/dark collection).
  const ly = theme.layout;
  const breakpoint: Record<string, Token> = {};
  for (const b of ly.breakpoints) breakpoint[b.name] = dimLeaf(b.px, `breakpoint ${b.name} — min-width ${b.px}px (mobile-first)`);
  const gridSpaceAlias = (px: number, desc: string, bp: string, variable: string): Token => {
    const key = spaceKeyOf.get(px);
    const fig = { figma: { collection: 'layout', mode: bp, variable, note: 'breakpoint = Figma mode (separate layout collection; composes with colour light/dark)' } };
    return key ? dimAlias(`${root}.space.${key}`, desc, { px, ...fig }) : dimLeaf(px, desc);
  };
  const grid: Record<string, any> = {};
  for (const g of ly.grid) {
    grid[g.bp] = {
      columns: { $type: 'number', $value: g.columns, $description: `grid ${g.bp} — ${g.columns} columns (design grid / Figma layout-grid; build with CSS Grid)`, $extensions: { prism3: { generated: true, figma: { collection: 'layout', mode: g.bp, variable: 'grid.columns', note: 'breakpoint = Figma mode' } } } },
      gutter: gridSpaceAlias(g.gutterPx, `grid ${g.bp} gutter — ${g.gutterPx}px (spacing-scale alias)`, g.bp, 'grid.gutter'),
      margin: gridSpaceAlias(g.marginPx, `grid ${g.bp} margin — ${g.marginPx}px (spacing-scale alias)`, g.bp, 'grid.margin'),
    };
  }
  const container = {
    max: dimLeaf(ly.containerMax, `container max — ${ly.containerMax}px content cap (fluid below it)`),
    narrow: dimLeaf(ly.containerNarrow, `container narrow — ${ly.containerNarrow}px reading measure (~65–75ch)`),
    fluid: { $type: 'dimension', $value: '100%', $description: 'container fluid — full width with margins (the default)', $extensions: { prism3: { generated: true } } },
  };

  // ---- assemble under the brand root ----
  // `gradient` is included only when the brand opted in (kept off the tree for
  // brands that declare none — gradients are an opt-in axis, not a default group).
  const brand = { palette, color: colorRoles, opacity, motion, font, type: typeGroup, shadow, ...(Object.keys(gradient).length ? { gradient } : {}), breakpoint, grid, container, dimension, space, radius, 'border-width': borderWidth, focus, size };
  const tree = {
    [root]: brand,
    $extensions: {
      generator: { name: 'Prism3 engine', method: 'OKLCH colour + grid-derived dimension generation' },
      prism3: { theme: theme.id, root, colorFormat: theme.colorFormat, decisions: theme.notes },
    },
  };

  // ---- validate aliases + count ----
  const resolvePath = (path: string): boolean => {
    let node: any = tree;
    for (const seg of path.split('.')) { node = node?.[seg]; if (node === undefined) return false; }
    return node && node.$type !== undefined;
  };
  const aliases: { path: string; ref: string }[] = [];
  const walk = (node: any, path: string[]) => {
    if (node && typeof node === 'object') {
      if (node.$type !== undefined) {
        const v = node.$value;
        if (typeof v === 'string') {
          const m = v.match(/^\{(.+)\}$/);
          if (m) aliases.push({ path: path.join('.'), ref: m[1] });
        } else if (v && typeof v === 'object' && !Array.isArray(v)) {
          // composite token (e.g. transition): validate aliases in sub-values
          for (const sv of Object.values(v)) if (typeof sv === 'string') {
            const m = sv.match(/^\{(.+)\}$/);
            if (m) aliases.push({ path: path.join('.'), ref: m[1] });
          }
        } else if (Array.isArray(v)) {
          // composite-array token (gradient stops): validate aliases in each entry's
          // sub-values (shadow layer arrays carry raw colours → no brace matches).
          for (const item of v) if (item && typeof item === 'object') for (const sv of Object.values(item)) if (typeof sv === 'string') {
            const m = sv.match(/^\{(.+)\}$/);
            if (m) aliases.push({ path: path.join('.'), ref: m[1] });
          }
        }
        // Per-mode value overrides (colour role layer): each $extensions.prism3.modes.<m>
        // carries a `$value` alias for that mode. (shadow's modes.* is a layer ARRAY with
        // raw colours — no `$value` string — so it's correctly skipped here.)
        const modeOv = node.$extensions?.prism3?.modes;
        if (modeOv && typeof modeOv === 'object' && !Array.isArray(modeOv)) {
          for (const mv of Object.values(modeOv)) {
            const sv = (mv as any)?.$value;
            if (typeof sv === 'string') { const m = sv.match(/^\{(.+)\}$/); if (m) aliases.push({ path: path.join('.'), ref: m[1] }); }
          }
        }
        return;
      }
      for (const [k, v] of Object.entries(node)) if (!k.startsWith('$')) walk(v, [...path, k]);
    }
  };
  walk(brand, [root]);
  const broken = aliases.filter((a) => !resolvePath(a.ref));

  let modeChecks = 0, modePass = 0;
  for (const mr of modes) for (const r of Object.values(mr.roles)) if (r.min > 0) { modeChecks++; if (r.ratio >= r.min) modePass++; }

  const alphaLeaves = 2 * ALPHA_STEPS.filter((s) => s > 0 && s < 100).length;
  const colorLeaves = 2 + theme.palettes.reduce((n, p) => n + p.steps.length, 0) + alphaLeaves;
  return { tree, modes, stats: { colorLeaves, dimLeaves: theme.dims.grid.length, spaceTokens: theme.dims.space.length, radiusTokens: theme.dims.radius.length, sizeSteps: theme.dims.sizes.length, fontSizes: theme.typography.sizesPx.length, fontWeights: theme.typography.weightsRef.length, typeComposites: theme.typography.composites.length, aliases: aliases.length, resolved: aliases.length - broken.length, broken, modeChecks, modePass } };
};

// ---------------------------------------------------------------------------
// Tree accessors — PURE readers over a built tree. Shared by resolve-preview.ts
// (the browser read-model) and visualize.ts. `at` walks a dotted path; `deref`
// follows `{alias}` chains; the rest coerce a leaf to px / number / family.
export type TreeNode = any;
export const at = (tree: TreeNode, path: string): TreeNode => path.split('.').reduce((n, s) => n?.[s], tree);
export const deref = (tree: TreeNode, node: TreeNode): TreeNode => {
  let cur = node, guard = 0;
  while (cur && typeof cur.$value === 'string' && /^\{.+\}$/.test(cur.$value) && guard++ < 10) cur = at(tree, cur.$value.slice(1, -1));
  return cur;
};
export const pxOf = (tree: TreeNode, node: TreeNode): number => { const t = deref(tree, node); return parseInt(String(t?.$value).replace('px', ''), 10) || 0; };
export const subNode = (tree: TreeNode, aliasStr: any): TreeNode => at(tree, String(aliasStr).replace(/^\{|\}$/g, ''));
export const numOf = (tree: TreeNode, node: TreeNode): number => { const t = deref(tree, node); return typeof t?.$value === 'number' ? t.$value : parseFloat(String(t?.$value)) || 0; };
export const remPxOf = (tree: TreeNode, node: TreeNode): number => { const t = deref(tree, node); const px = t?.$extensions?.prism3?.px; if (px) return px; const v = String(t?.$value); return v.endsWith('rem') ? parseFloat(v) * 16 : parseFloat(v) || 0; };
export const familyOf = (tree: TreeNode, node: TreeNode): string => { const t = deref(tree, node); return Array.isArray(t?.$value) ? t.$value.join(', ') : String(t?.$value ?? 'sans-serif'); };
