/**
 * Prism3 engine — DTCG emit.
 *
 * Emits a W3C Design Tokens tree per theme, in that theme's dialect:
 *  - NB regression  -> nbds.* / rgb()  (byte-comparable to the real NB tokens)
 *  - Prism product  -> prism.* / hex    (DTCG-standard, Style-Dictionary-safe)
 *
 * Two axes: colour (primitive ramps + per-mode semantic aliases) and dimension
 * (a primitive grid + space/radius semantics that alias into it). Each primitive
 * leaf carries engine provenance under $extensions.prism3. The run validates
 * every alias resolves and every mode contrast contract holds. Run:
 *   npx tsx Prism3/engine/emit-dtcg.ts
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { RGB, contrast, hex } from './color';
import { Step } from './ramp';
import { Theme, nbTheme, brandTheme, BrandInput } from './theme';
import { resolveAllModes, ModeResult } from './modes';

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

type Token = { $type: 'color' | 'dimension' | 'number' | 'strokeStyle' | 'duration' | 'cubicBezier' | 'transition' | 'spring'; $value: string | number | number[] | Record<string, unknown>; $description: string; $extensions: { prism3: Record<string, unknown> } };

// ---- colour leaves ----
const primitiveLeaf = (theme: Theme, paletteDesc: string, s: Step, isAnchor: boolean): Token => {
  const role = isAnchor ? 'brand anchor (exact, pinned)' : s.num === 500 ? 'mid-tone AA pivot (≥4.5:1 on white & black)' : bandName[s.band];
  return {
    $type: 'color', $value: colorValue(s.rgb, theme.colorFormat),
    $description: `${paletteDesc} ${s.key} — ${bandName[s.band]} band — ${role}`,
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
  $extensions: { prism3: { generated: true, note: 'non-standard DTCG type; web → linear()/CSS, native → stiffness/damping/mass' } },
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

type Stats = {
  colorLeaves: number; dimLeaves: number; spaceTokens: number; radiusTokens: number; sizeSteps: number;
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

  // ---- assemble under the brand root ----
  const brand = { color, semantic, opacity, motion, dimension, space, radius, 'border-width': borderWidth, focus, size };
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
  return { tree, modes, stats: { colorLeaves, dimLeaves: theme.dims.grid.length, spaceTokens: theme.dims.space.length, radiusTokens: theme.dims.radius.length, sizeSteps: theme.dims.sizes.length, aliases: aliases.length, resolved: aliases.length - broken.length, broken, modeChecks, modePass } };
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
};

const themes: Theme[] = [nbTheme(), brandTheme(aurora)];
const md: string[] = ['# Prism3 modes & scales — generated mappings, contrast contracts, dimension axis', ''];
let ok = true;

for (const theme of themes) {
  const { tree, modes, stats } = buildTree(theme);
  const outPath = resolve(outDir, `${theme.id}.tokens.json`);
  writeFileSync(outPath, JSON.stringify(tree, null, 2) + '\n');

  console.log(`\n[${theme.id}] ${theme.root}.* / ${theme.colorFormat}`);
  for (const n of theme.notes) console.log(`   · ${n}`);
  console.log(`  colour: ${stats.colorLeaves} leaves, palettes ${theme.palettes.map((p) => p.palette).join(', ')} (danger ← ${theme.roleToPalette.danger})`);
  console.log(`  dimension: ${stats.dimLeaves} grid primitives, ${stats.spaceTokens} space + ${stats.radiusTokens} radius + ${stats.sizeSteps} component sizes`);
  console.log(`    space (${theme.dims.spaceBase}px rhythm): ${theme.dims.space.filter((s) => s.key !== '0').map((s) => `${s.key}=${s.px}`).join(' ')}`);
  console.log(`    radius (scale ${theme.dims.radiusScaleValue}): ${theme.dims.radius.map((r) => `${r.name}=${r.px}`).join(' ')}`);
  console.log(`    sizes (${theme.dims.density}): ${theme.dims.sizes.map((z) => `${z.name}=${z.height}h/${z.padX}×${z.padY}pad`).join(' ')}`);
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

writeFileSync(resolve(here, 'modes-report.md'), md.join('\n') + '\n');
console.log(`\n[written] ${resolve(here, 'modes-report.md')}`);
if (!ok) process.exitCode = 1;
