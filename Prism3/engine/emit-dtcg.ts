/**
 * Prism3 engine — DTCG emit.
 *
 * Emits a W3C Design Tokens tree per theme, in that theme's dialect:
 *  - NB regression  -> nbds.* / rgb()  (byte-comparable to the real NB tokens)
 *  - Prism product  -> prism.* / hex    (DTCG-aligned, Style-Dictionary-ingestible)
 *
 * Every emitted $type is a standard DTCG type EXCEPT `spring` (3 tokens) — an
 * intentional custom type, since DTCG has no spring type yet. SD ingests it
 * (unknown types pass through) but it needs a downstream platform transform.
 *
 * Two axes: colour (primitive ramps + per-mode semantic aliases) and dimension
 * (a primitive grid + space/radius semantics that alias into it). Each primitive
 * leaf carries engine provenance under $extensions.prism3. The run validates
 * every alias resolves and every mode contrast contract holds. Run:
 *   npx tsx Prism3/engine/emit-dtcg.ts
 */
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { RGB, contrast, hex } from './color';
import { Step } from './ramp';
import { Theme, nbTheme, brandTheme, BrandInput } from './theme';
import { resolveAllModes, ModeResult } from './modes';
import { buildAiMetadata } from './ai-metadata';

const here = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(here, 'out');
mkdirSync(outDir, { recursive: true });

const WHITE: RGB = { r: 255, g: 255, b: 255 };
const BLACK: RGB = { r: 0, g: 0, b: 0 };
const round = (n: number, d = 4) => Math.round(n * 10 ** d) / 10 ** d;
const rgbStr = ({ r, g, b }: RGB) => `rgb(${r}, ${g}, ${b})`;
const colorValue = (rgb: RGB, fmt: 'rgb' | 'hex') => (fmt === 'hex' ? hex(rgb) : rgbStr(rgb));
const alphaHex = (a: number) => Math.round(a * 255).toString(16).padStart(2, '0');
const alphaColorValue = (rgb: RGB, a: number, fmt: 'rgb' | 'hex') =>
  fmt === 'hex' ? `${hex(rgb)}${alphaHex(a)}` : `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${round(a, 2)})`;
// Shared opacity/alpha step set (percent). Ramps use 5–90; the opacity scale full.
const ALPHA_STEPS = [0, 5, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100];

const bandName: Record<string, string> = {
  Highlights: 'Highlight', Quarter: 'Quarter-Tone', Mid: 'Mid-Tone',
  ThreeQuarter: 'Three-Quarter-Tone', Shadows: 'Shadow',
};

type Token = { $type: 'color' | 'dimension' | 'number' | 'strokeStyle' | 'duration' | 'cubicBezier' | 'transition' | 'spring' | 'fontFamily' | 'fontWeight' | 'typography'; $value: string | number | number[] | string[] | Record<string, unknown>; $description: string; $extensions: { prism3: Record<string, unknown> } };

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
// can't bind a unitless line-height (a bound FLOAT is read as PIXELS), so the
// directive tells the exporter to materialize px = fontSize × value per mode.
const lineHeightLeaf = (value: number, description: string): Token => ({
  $type: 'number', $value: value, $description: description,
  $extensions: { prism3: { generated: true, unitless: true, figma: { kind: 'style-part', field: 'lineHeight', unit: 'px-from-ratio', basis: 'fontSize', note: 'Figma binds line-height as px; multiply by the bound fontSize per mode' } } },
});
const letterSpacingLeaf = (em: number, description: string): Token => ({
  $type: 'dimension', $value: `${em}em`, $description: description,
  $extensions: { prism3: { generated: true, em, figma: { kind: 'style-part', field: 'letterSpacing', unit: 'px-from-em', basis: 'fontSize', note: 'Figma binds letter-spacing as px; multiply em by the bound fontSize' } } },
});
// Composite (DTCG typography): bundles family/size/weight-role/line-height/tracking
// by intent. Sub-properties alias the primitives (weight via the role → numeric, so
// re-mapping a brand's weights reflows every composite). Materializes as a Figma
// Text Style binding those variables (line-height px = size × multiplier); underline/
// all-caps variants are SEPARATE styles (textDecoration/textCase aren't bindable).
const typographyLeaf = (root: string, c: { group: string; variant: string; sizePx: number; family: string; weightRole: string; lineHeight: string; tracking: string }): Token => {
  const a = (seg: string) => `{${root}.font.${seg}}`;
  return {
    $type: 'typography',
    $value: {
      fontFamily: a(`family.${c.family}`),
      fontSize: a(`size.${c.sizePx}`),
      fontWeight: a(`weight-role.${c.weightRole}`),
      lineHeight: a(`line-height.${c.lineHeight}`),
      letterSpacing: a(`letter-spacing.${c.tracking}`),
    },
    $description: `${c.group}${c.variant ? ' ' + c.variant : ''} — ${c.sizePx}px, ${c.family} family, ${c.lineHeight} line-height, ${c.weightRole} weight, ${c.tracking} tracking`,
    $extensions: { prism3: { role: 'composite', group: c.group, variant: c.variant, sizePx: c.sizePx, figma: { kind: 'text-style', styleType: 'TEXT', binds: ['fontFamily', 'fontSize', 'fontWeight', 'lineHeight', 'letterSpacing'], note: 'Figma Text Style binding these variables; lineHeight px = fontSize × multiplier; underline/all-caps would be separate styles (textDecoration/textCase not bindable)' } } },
  };
};

type Stats = {
  colorLeaves: number; dimLeaves: number; spaceTokens: number; radiusTokens: number; sizeSteps: number;
  fontSizes: number; fontWeights: number; typeComposites: number;
  aliases: number; resolved: number; modeChecks: number; modePass: number; broken: { path: string; ref: string }[];
};

const buildTree = (theme: Theme): { tree: any; modes: ModeResult[]; stats: Stats } => {
  const root = theme.root;

  // ---- colour primitives ----
  const color: Record<string, any> = {
    white: baseLeaf(theme, WHITE, 'Pure white — Highlight base / default surface', 'Highlights'),
    black: baseLeaf(theme, BLACK, 'Pure black — Shadow base', 'Shadows'),
  };
  const brandPalette = theme.roleToPalette.brand;
  const brandAnchorStep = theme.roleAnchorStep.brand;
  for (const p of theme.palettes) {
    const node: Record<string, Token> = {};
    for (const s of p.steps) node[s.key] = primitiveLeaf(theme, p.description, s, p.palette === brandPalette && s.num === brandAnchorStep);
    color[p.palette] = node;
  }
  // alpha colour ramps — black/white at increasing opacity, for scrims/overlays
  // that must composite correctly over ANY surface (the Radix/Fluent pattern).
  const alphaRamp = (rgb: RGB, label: string) => {
    const node: Record<string, Token> = {};
    for (const s of ALPHA_STEPS) if (s > 0 && s < 100) node[String(s)] = alphaLeaf(theme, rgb, s / 100, `${label} ${s}% — alpha, composites over any surface`);
    return node;
  };
  color['black-alpha'] = alphaRamp(BLACK, 'Black alpha');
  color['white-alpha'] = alphaRamp(WHITE, 'White alpha');

  // ---- opacity primitive scale (dimensionless 0..1) ----
  const opacity: Record<string, Token> = {};
  for (const s of ALPHA_STEPS) opacity[String(s)] = numLeaf(round(s / 100, 2), `opacity ${s}% (${round(s / 100, 2)})`);

  // ---- colour semantic layer (per mode) ----
  const modes = resolveAllModes(theme);
  const semantic: Record<string, any> = {};
  for (const mr of modes) {
    const modeTree: Record<string, any> = {};
    for (const [roleKey, r] of Object.entries(mr.roles)) {
      // Role keys are property-led and may nest (group / variant / state).
      const parts = roleKey.split('.');
      let node = modeTree;
      for (let i = 0; i < parts.length - 1; i++) node = (node[parts[i]] ??= {});
      node[parts[parts.length - 1]] = aliasLeaf(r.path, r.description, { mode: mr.mode, contrast: r.ratio, against: r.against, ...(r.min > 0 ? { min: r.min } : {}) });
    }
    semantic[mr.mode] = modeTree;
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
  const radius: Record<string, Token> = {};
  for (const r of theme.dims.radius) {
    radius[r.name] = gridSet.has(r.px)
      ? dimAlias(`${root}.dimension.${r.px}`, `radius ${r.name} — ${r.px}px${r.pill ? ' (pill)' : ''}`, { px: r.px, radiusScale: theme.dims.radiusScaleValue })
      : dimLeaf(r.px, `radius ${r.name} — ${r.px}px (off-grid literal)`);
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
  // per-mode `semantic.<mode>.border.interactive.focused` (surface-aware). For an
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
  const typeGroup: Record<string, any> = {};
  for (const c of ty.composites) {
    const leaf = typographyLeaf(root, c);
    if (c.variant) (typeGroup[c.group] ??= {})[c.variant] = leaf;
    else typeGroup[c.group] = leaf;
  }

  // ---- assemble under the brand root ----
  const brand = { color, semantic, opacity, motion, font, type: typeGroup, dimension, space, radius, 'border-width': borderWidth, focus, size };
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
// Aurora: an indigo/violet brand (deliberately NOT red) with a DIFFERENT form
// factor from NB — soft corners (radius scale 2) and compact density — to
// exercise the dimension levers, not just colour.
const aurora: BrandInput = {
  id: 'aurora',
  primary: { l: 0.5, c: 0.18, h: 285 },          // hero brand: violet
  neutral: { hue: 285, chroma: 0.008 },
  // Extra brand colours (open-ended set) + action DECOUPLED from the hero:
  // aurora's violet is its identity, but interactive UI uses the azure accent.
  brandColors: [{ name: 'accent', oklch: { l: 0.55, c: 0.15, h: 235 } }],
  actionPalette: 'accent',
  // Primary light surface is a tinted off-white (neutral.50), NOT pure white, so
  // the contrast floor moves to neutral.100 — actions are validated there.
  surfaces: { light: { base: 50 } },
  radiusScale: 2,
  density: 'compact',
  // Exercise the icon-contrast lever: aurora's icons use the WCAG 1.4.11 non-text
  // floor (3:1), so secondary/semantic icons run lighter than the matching text.
  iconContrast: '3:1',
  // Exercise the motion lever: a snappy tempo compresses the duration ramp vs NB's standard.
  motionPersonality: { tempo: 'snappy' },
  // Exercise the typography lever: a distinct variable display face, a remapped
  // emphasis weight (500, not the default 600), and the expressive type scale.
  typography: {
    families: { display: 'Clash Display', text: 'Inter', mono: 'JetBrains Mono', variable: true },
    weightRoles: { subtle: 300, default: 400, emphasis: 500, strong: 700 },
    typeScale: 'expressive',
    // Exercise the Phase 2 levers: cap heroes at 128px (no mega tier), include the
    // 16px brand-font title (overlaps body.md), and put labels on the text face.
    displayCeiling: 128,
    titleFloor: 16,
    familyMap: { label: 'text' },
  },
};

const themes: Theme[] = [nbTheme(), brandTheme(aurora)];
const md: string[] = ['# Prism3 modes & scales — generated mappings, contrast contracts, dimension axis', ''];
let ok = true;

for (const theme of themes) {
  const { tree, modes, stats } = buildTree(theme);
  const outPath = resolve(outDir, `${theme.id}.tokens.json`);
  writeFileSync(outPath, JSON.stringify(tree, null, 2) + '\n');
  // AI-readable metadata sidecar (agent surface for the semantic layer).
  const ai = buildAiMetadata(theme, tree);
  writeFileSync(resolve(outDir, `${theme.id}.ai.json`), JSON.stringify(ai, null, 2) + '\n');

  console.log(`\n[${theme.id}] ${theme.root}.* / ${theme.colorFormat}`);
  for (const n of theme.notes) console.log(`   · ${n}`);
  console.log(`  colour: ${stats.colorLeaves} leaves, palettes ${theme.palettes.map((p) => p.palette).join(', ')} (danger ← ${theme.roleToPalette.danger})`);
  console.log(`  dimension: ${stats.dimLeaves} grid primitives, ${stats.spaceTokens} space + ${stats.radiusTokens} radius + ${stats.sizeSteps} component sizes`);
  console.log(`    space (${theme.dims.spaceBase}px rhythm): ${theme.dims.space.filter((s) => s.key !== '0').map((s) => `${s.key}=${s.px}`).join(' ')}`);
  console.log(`    radius (scale ${theme.dims.radiusScaleValue}): ${theme.dims.radius.map((r) => `${r.name}=${r.px}`).join(' ')}`);
  console.log(`    sizes (${theme.dims.density}): ${theme.dims.sizes.map((z) => `${z.name}=${z.height}h/${z.padX}×${z.padY}pad`).join(' ')}`);
  console.log(`  typography: ${stats.fontSizes} size primitives (${theme.typography.sizesPx[0]}–${theme.typography.sizesPx[theme.typography.sizesPx.length - 1]}px, rem), ${stats.fontWeights} weights + ${theme.typography.weightRoles.length} roles (${theme.typography.weightRoles.map((w) => `${w.role}=${w.value}`).join(' ')}), ${theme.typography.lineHeights.length} line-heights, ${theme.typography.letterSpacings.length} tracking`);
  console.log(`    families: ${theme.typography.families.map((f) => `${f.role}=${f.stack[0]}`).join(' ')}${theme.typography.families[0].variable ? ' [variable]' : ''} · scale '${theme.typography.typeScale}'`);
  {
    const byGroup: Record<string, string[]> = {};
    for (const c of theme.typography.composites) (byGroup[c.group] ??= []).push(c.variant ? `${c.variant}=${c.sizePx}` : String(c.sizePx));
    console.log(`  type: ${stats.typeComposites} composites — ${Object.entries(byGroup).map(([g, v]) => `${g}[${v.join(' ')}]`).join(' ')}`);
  }
  console.log(`  aliases: ${stats.resolved}/${stats.aliases} resolve | mode contracts: ${stats.modePass}/${stats.modeChecks} pass`);
  console.log(`  [written] ${outPath}`);
  if (stats.broken.length) { ok = false; stats.broken.forEach((b) => console.log(`   ❌ ${b.path} -> {${b.ref}}`)); }
  if (stats.modePass < stats.modeChecks) ok = false;

  md.push(`# Theme: ${theme.id} (${theme.root}.* / ${theme.colorFormat})`, '');
  for (const n of theme.notes) md.push(`- ${n}`);
  md.push('', `Palettes: ${theme.palettes.map((p) => p.palette).join(', ')}. Danger draws from \`${theme.roleToPalette.danger}\`.`, '');
  for (const mr of modes) {
    md.push(`## ${theme.id} — colour mode: ${mr.mode}`, '', '| role | → step | contrast | floor | result |', '|---|---|---|---|---|');
    for (const [roleKey, r] of Object.entries(mr.roles)) {
      const checked = r.min > 0, pass = !checked || r.ratio >= r.min;
      md.push(`| ${roleKey} | ${r.path.replace(theme.namespace + '.', '')} | ${checked ? r.ratio.toFixed(2) : '—'} | ${checked ? r.min : '—'} | ${checked ? (pass ? '✅' : '❌') : '·'} |`);
    }
    md.push('');
  }
  md.push(`## ${theme.id} — dimension axis`, '', `Grid (${stats.dimLeaves} primitives, px): ${theme.dims.grid.join(', ')}`, '');
  md.push(`Space — numbered multiplier, \`${theme.dims.spaceBase}px\` rhythm (reference tier, density-free):`, '', '| token | px | × base |', '|---|---|---|');
  for (const s of theme.dims.space) md.push(`| space.${s.key} | ${s.px} | ${s.mult}× |`);
  md.push('', `Radius — scale \`${theme.dims.radiusScaleValue}\`:`, '', '| token | px |', '|---|---|');
  for (const r of theme.dims.radius) md.push(`| radius.${r.name} | ${r.px}${r.pill ? ' (pill)' : ''} |`);
  md.push('', `Component sizes — t-shirt, density \`${theme.dims.density}\` (height + paired padding from the shared scales):`, '', '| size | height | padding-x | padding-y |', '|---|---|---|---|');
  for (const z of theme.dims.sizes) md.push(`| size.${z.name} | ${z.height}px | ${z.padX}px | ${z.padY}px |`);
  md.push('');
}

// ---------------------------------------------------------------------------
// BrandInput ↔ schema conformance — guards the documented contract
// (schema/theme-schema.json) against drift from the actual white-label input.
// Dependency-free validator for the JSON-Schema subset this contract uses.
const validate = (data: any, schema: any, defs: any, path = ''): string[] => {
  if (schema.$ref) return validate(data, defs[schema.$ref.split('/').pop()!], defs, path);
  if (schema.oneOf) return schema.oneOf.some((s: any) => validate(data, s, defs, path).length === 0) ? [] : [`${path || '(root)'}: matches none of oneOf`];
  const e: string[] = [];
  const t = schema.type;
  if (t === 'object') {
    if (typeof data !== 'object' || data === null || Array.isArray(data)) return [`${path || '(root)'}: expected object`];
    const props = schema.properties ?? {};
    for (const req of schema.required ?? []) if (!(req in data)) e.push(`${path || '(root)'}: missing required '${req}'`);
    if (schema.additionalProperties === false) for (const k of Object.keys(data)) if (!(k in props)) e.push(`${path ? path + '.' : ''}${k}: unknown property (not in contract)`);
    for (const [k, v] of Object.entries(data)) if (props[k]) e.push(...validate(v, props[k], defs, path ? `${path}.${k}` : k));
  } else if (t === 'array') {
    if (!Array.isArray(data)) return [`${path}: expected array`];
    if (schema.items) data.forEach((it, i) => e.push(...validate(it, schema.items, defs, `${path}[${i}]`)));
  } else if (t === 'number') {
    if (typeof data !== 'number') e.push(`${path}: expected number`);
    else { if (schema.minimum !== undefined && data < schema.minimum) e.push(`${path}: ${data} < ${schema.minimum}`); if (schema.maximum !== undefined && data > schema.maximum) e.push(`${path}: ${data} > ${schema.maximum}`); }
  } else if (t === 'string') {
    if (typeof data !== 'string') e.push(`${path}: expected string`);
    else if (schema.enum && !schema.enum.includes(data)) e.push(`${path}: '${data}' not in [${schema.enum.join(', ')}]`);
  }
  return e;
};
const brandSchema = JSON.parse(readFileSync(resolve(here, '../schema/theme-schema.json'), 'utf8'));
const exampleInput = JSON.parse(readFileSync(resolve(here, '../schema/theme-schema.example.json'), 'utf8'));
console.log('');
for (const [label, input] of [['aurora (white-label input)', aurora], ['theme-schema.example.json', exampleInput]] as const) {
  const errs = validate(input, brandSchema, brandSchema.$defs ?? {});
  if (errs.length) { ok = false; console.log(`[schema] ❌ ${label} violates theme-schema.json:`); errs.forEach((x) => console.log(`   ${x}`)); }
  else console.log(`[schema] ✓ ${label} conforms to the BrandInput contract`);
}

writeFileSync(resolve(here, 'modes-report.md'), md.join('\n') + '\n');
console.log(`\n[written] ${resolve(here, 'modes-report.md')}`);
if (!ok) process.exitCode = 1;
