/**
 * Prism3 engine — test suite (dependency-free, run via tsx).
 *
 *   npx tsx Prism3/engine/test.ts
 *
 * Two layers the functional checks (nb-regression, emit-dtcg) don't cover:
 *  1. colour-math invariants in color.ts (round-trips, contrast, gamut, ΔE).
 *  2. extreme white-label brands run end-to-end — a near-black primary, a red
 *     primary (danger-reuse), a light high-chroma yellow (hard-to-make-accessible
 *     action), an action palette decoupled to neutral, and a bare-minimum brand.
 *     Each must build and clear EVERY mode contract — the real robustness test.
 * Exits non-zero on any failure.
 */
import { rgbToOklch, oklchToRgb, hex, hexToRgb, contrast, luminance, maxChroma, inGamut, deltaE2000, RGB } from './color';
import { generateRamp, autoPlaceStep, STEP_NUMS } from './ramp';
import { brandTheme, BrandInput } from './theme';
import { nbTheme } from './nb-fixture';
import { resolveAllModes } from './modes';
import { parseDesignMd, parseYamlSubset, toDesignMd } from './design-md';
import { parseStandardDesignMd, standardToBrandInput, applyXPrism3 } from './standard-design-md';
import { classifyColors } from './classify-colors';
import { leverManifest, leverGroups, buildLeverManifest, identityFields } from './levers';
import { previewSpec, previewTokenRefs, buildPreviewSpec } from './preview';
import { resolvePreview } from './resolve-preview';
import { exampleBrands, exampleBrandsJson, EXAMPLE_IDS } from './emit-brandinput';
import { buildFigmaColor, buildFigmaFont, buildFigmaFontFluid, buildFigmaTextStyles, buildFigmaDims, buildFigmaShadow, buildFigmaGradient, fontStyleName, COLOR_MODES, FONT_FLUID_MODES } from './emit-figma';
import { buildTree, validateBrandInput } from './emit-dtcg';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
const HERE = dirname(fileURLToPath(import.meta.url));

let pass = 0; const fails: string[] = [];
const ok = (cond: boolean, msg: string) => { if (cond) pass++; else fails.push(msg); };
const approx = (a: number, b: number, eps: number) => Math.abs(a - b) <= eps;

// ---------------------------------------------------------------- colour math
const WHITE: RGB = { r: 255, g: 255, b: 255 };
const BLACK: RGB = { r: 0, g: 0, b: 0 };

// round-trip sRGB → OKLCH → sRGB (within ±2/255)
for (const rgb of [WHITE, BLACK, { r: 207, g: 10, b: 44 }, { r: 18, g: 120, b: 200 }, { r: 120, g: 200, b: 30 }, { r: 250, g: 240, b: 5 }]) {
  const rt = oklchToRgb(rgbToOklch(rgb));
  ok(approx(rt.r, rgb.r, 2) && approx(rt.g, rgb.g, 2) && approx(rt.b, rgb.b, 2), `round-trip ${hex(rgb)} → ${hex(rt)}`);
}

// hex formatting
ok(hex(WHITE) === '#ffffff', 'hex(white)');
ok(hex(BLACK) === '#000000', 'hex(black)');
ok(hex({ r: 207, g: 10, b: 44 }) === '#cf0a2c', 'hex(nb red)');

// WCAG contrast: white/black = 21; identical = 1; symmetric
ok(approx(contrast(WHITE, BLACK), 21, 0.05), `contrast(white,black)=${contrast(WHITE, BLACK)}`);
ok(approx(contrast(WHITE, WHITE), 1, 0.001), 'contrast(white,white)=1');
ok(approx(contrast({ r: 80, g: 80, b: 80 }, WHITE), contrast(WHITE, { r: 80, g: 80, b: 80 }), 1e-9), 'contrast symmetric');
ok(contrast({ r: 117, g: 117, b: 117 }, WHITE) >= 4.4 && contrast({ r: 117, g: 117, b: 117 }, WHITE) <= 4.7, 'contrast grey/white ≈ 4.5 (AA pivot)');

// relative luminance bounds
ok(approx(luminance(WHITE), 1, 1e-6), 'luminance(white)=1');
ok(approx(luminance(BLACK), 0, 1e-6), 'luminance(black)=0');

// gamut: maxChroma returns an in-gamut boundary; a hair past it is out
for (const l of [0.3, 0.5, 0.7]) for (const h of [0, 120, 240]) {
  const c = maxChroma(l, h);
  ok(inGamut({ l, c, h }), `maxChroma in-gamut l${l} h${h} (c=${c.toFixed(3)})`);
  ok(!inGamut({ l, c: c + 0.05, h }), `maxChroma+0.05 out-of-gamut l${l} h${h}`);
}

// ΔE2000: identity 0, symmetric, white/black large
ok(approx(deltaE2000(WHITE, WHITE), 0, 1e-9), 'ΔE(x,x)=0');
ok(approx(deltaE2000(WHITE, BLACK), deltaE2000(BLACK, WHITE), 1e-9), 'ΔE symmetric');
ok(deltaE2000(WHITE, BLACK) > 95, 'ΔE(white,black) large');

// autoPlaceStep: lighter → lower step number, darker → higher; always a valid step
ok(STEP_NUMS.includes(autoPlaceStep(0.5)), 'autoPlaceStep returns a valid step');
ok(autoPlaceStep(0.9) < autoPlaceStep(0.3), 'autoPlaceStep: lighter < darker');

// anchor preservation: a pinned step reproduces the anchor OKLCH (the thesis)
{
  const anchorOklch = { l: 0.542, c: 0.215, h: 23 };
  const ramp = generateRamp({ hue: 23, chroma: 0.215, anchor: { oklch: anchorOklch, stepNum: 550 } });
  const step = ramp.find((s) => s.num === 550)!;
  ok(deltaE2000(step.rgb, oklchToRgb(anchorOklch)) < 1, `anchor preserved (ΔE ${deltaE2000(step.rgb, oklchToRgb(anchorOklch)).toFixed(2)})`);
}

// ------------------------------------------------ extreme white-label brands
const brands: BrandInput[] = [
  { id: 't-dark', primary: { l: 0.22, c: 0.06, h: 264 }, neutral: { hue: 264, chroma: 0.01 } },                 // near-black primary
  { id: 't-red', primary: { l: 0.55, c: 0.2, h: 25 }, neutral: { hue: 25, chroma: 0.01 }, actionPalette: 'neutral' }, // red (danger-reuse) + action≠brand→neutral
  { id: 't-yellow', primary: { l: 0.85, c: 0.18, h: 95 }, neutral: { hue: 95, chroma: 0.015 } },                // light high-chroma yellow (hard accessible action)
  { id: 't-min', primary: { l: 0.5, c: 0.15, h: 200 }, neutral: { hue: 200, chroma: 0.008 } },                  // bare minimum (all defaults)
  { id: 't-hcdark', primary: { l: 0.5, c: 0.12, h: 300 }, neutral: { hue: 300, chroma: 0.01 }, surfaces: { light: { base: 100 }, dark: { base: 950 } }, motionPersonality: { tempo: 'relaxed' }, iconContrast: '3:1', disabledStrategy: 'conventional' }, // every lever exercised
];

for (const b of brands) {
  let theme;
  try { theme = brandTheme(b); } catch (e) { fails.push(`[${b.id}] brandTheme threw: ${(e as Error).message}`); continue; }
  const modes = resolveAllModes(theme);
  ok(modes.length === 4, `[${b.id}] 4 modes`);
  for (const m of modes) {
    const checked = Object.entries(m.roles).filter(([, r]) => r.min > 0);
    const broken = checked.filter(([, r]) => r.ratio < r.min);
    ok(broken.length === 0, `[${b.id}/${m.mode}] all ${checked.length} contracts pass` + (broken.length ? ` — FAILED: ${broken.map(([k, r]) => `${k} ${r.ratio}<${r.min}`).join(', ')}` : ''));
  }
}

// nbTheme regression theme also clears every contract
{
  const modes = resolveAllModes(nbTheme());
  const broken = modes.flatMap((m) => Object.entries(m.roles).filter(([, r]) => r.min > 0 && r.ratio < r.min).map(([k]) => `${m.mode}.${k}`));
  ok(broken.length === 0, 'nbTheme all contracts pass' + (broken.length ? ` — FAILED: ${broken.join(', ')}` : ''));
}

// ------------------------------------------- typography composite invariants
// Guard the composite generator across lever combos: every sub-reference must
// resolve to a real primitive, sizes stay on the ladder, no duplicate size within
// a group, monotonic per group, count inside the KB's 15–25 (12 floor when a brand
// caps display), and the floor/ceiling levers behave.
const FAM = new Set(['display', 'text', 'mono']);
const tBrand = (id: string, ty: any) => brandTheme({ id, primary: { l: 0.5, c: 0.15, h: 250 }, neutral: { hue: 250, chroma: 0.01 }, typography: ty });
const typeCases: [string, any][] = [
  ['default', {}],
  ['expressive', { typeScale: 'expressive' }],
  ['compact+floor16', { typeScale: 'compact', titleFloor: 16 }],
  ['ceiling96', { displayCeiling: 96 }],
  ['ceiling18-kills-display', { displayCeiling: 18 }],
  ['familyMap+singleface', { families: { text: 'Foo' }, familyMap: { label: 'text', title: 'text' } }],
];
for (const [label, ty] of typeCases) {
  const t = tBrand('ty-' + label, ty);
  const comps = t.typography.composites;
  const ladder = new Set(t.typography.sizesPx);
  const lh = new Set(t.typography.lineHeights.map((x) => x.key));
  const ls = new Set(t.typography.letterSpacings.map((x) => x.key));
  const wr = new Set(t.typography.weightRoles.map((x) => x.role));
  // base "style slots" = unique (group, variant); each fans out to weights (× link).
  const slots = new Set(comps.map((c) => `${c.group}.${c.variant}`));
  ok(slots.size >= 12 && slots.size <= 30, `[type/${label}] ${slots.size} style slots in 12..30 (×weights×link = ${comps.length} composites)`);
  ok(new Set(comps.map((c) => c.path)).size === comps.length, `[type/${label}] all composite paths unique`);
  let bad = '', mono = '';
  const byGroup: Record<string, number[]> = {};
  for (const c of comps) {
    (byGroup[c.group] ??= []).push(c.sizePx);
    if (!ladder.has(c.sizePx)) bad ||= `${c.path} off-ladder ${c.sizePx}`;
    if (!FAM.has(c.family)) bad ||= `${c.path} bad family ${c.family}`;
    if (!wr.has(c.weightRole)) bad ||= `${c.path} bad weight ${c.weightRole}`;
    if (!lh.has(c.lineHeight)) bad ||= `${c.path} bad line-height ${c.lineHeight}`;
    if (!ls.has(c.tracking)) bad ||= `${c.path} bad tracking ${c.tracking}`;
    // the weight role is always the trailing name segment (minus an optional -link)
    if (c.path.split('.').pop()!.replace('-link', '') !== c.weightRole) bad ||= `${c.path} weight not in name`;
  }
  // sizes are size-major within a group (weights repeat a size); DISTINCT sizes ascend.
  for (const [g, sizes] of Object.entries(byGroup)) {
    for (let i = 1; i < sizes.length; i++) if (sizes[i] < sizes[i - 1]) mono ||= `${g}:${sizes[i - 1]}->${sizes[i]}`;
  }
  ok(!bad, `[type/${label}] all composite refs resolve + weight in name${bad ? ` — ${bad}` : ''}`);
  ok(!mono, `[type/${label}] sizes non-decreasing within group${mono ? ` — ${mono}` : ''}`);
  // fluid (Phase 3): mobile endpoint never above desktop, always a real ladder rung,
  // and only heading groups (display/title) ever go fluid.
  let flbad = '';
  for (const c of comps) {
    if (c.sizeMinPx > c.sizePx) flbad ||= `${c.path} min>${c.sizePx}`;
    if (!ladder.has(c.sizeMinPx)) flbad ||= `${c.path} min off-ladder ${c.sizeMinPx}`;
    if (c.sizeMinPx !== c.sizePx && c.group !== 'display' && c.group !== 'title') flbad ||= `${c.path} non-heading is fluid`;
  }
  ok(!flbad, `[type/${label}] fluid endpoints valid${flbad ? ` — ${flbad}` : ''}`);
}
// responsive OFF → every composite static (min == max)
ok(tBrand('static', { responsive: { fluid: false } }).typography.composites.every((c) => c.sizeMinPx === c.sizePx), 'responsive:{fluid:false} → all composites static');
// default fluid → at least the display tier is fluid (min < max somewhere)
ok(tBrand('fl', {}).typography.composites.some((c) => c.group === 'display' && c.sizeMinPx < c.sizePx), 'default fluid → display tier shrinks on mobile');
ok(!tBrand('tf-d', {}).typography.composites.some((c) => c.group === 'title' && c.variant === '2xs'), 'titleFloor default 18 → no title.2xs');
// C1: titleFloor 16 delivers a LITERAL 16px title.2xs under EVERY typeScale (pinned, exempt from the shift).
for (const scale of ['compact', 'default', 'expressive'] as const) {
  const c = tBrand('tf16-' + scale, { titleFloor: 16, typeScale: scale }).typography.composites.find((x) => x.group === 'title' && x.variant === '2xs');
  ok(!!c && c.sizePx === 16, `titleFloor 16 + ${scale} → title.2xs pinned at 16px (got ${c?.sizePx})`);
}
ok(tBrand('dc', { displayCeiling: 96 }).typography.composites.filter((c) => c.group === 'display').every((c) => c.sizePx <= 96), 'displayCeiling 96 → no display composite above 96px');
ok(tBrand('eb', {}).typography.composites.find((c) => c.group === 'eyebrow')?.textCase === 'uppercase', 'eyebrow carries uppercase textCase');

// ---- weight axis + link modifier ----
{
  const d = tBrand('w', {}).typography.composites;
  const at = (path: string) => d.find((c) => c.path === path);
  // default body weights: default + strong (2), each with a -link sibling
  ok(at('body.md.default') && at('body.md.strong'), 'body ships default + strong weights by default');
  ok(at('body.md.default-link')?.link === true && at('body.md.strong-link')?.link === true, 'body has a -link variant per weight (link=true)');
  ok(!at('body.md.emphasis'), 'body emphasis is opt-in (not default)');
  // caption: 2 sizes (md=11, lg=12), 2 weights, + link
  ok(at('caption.md.default')?.sizePx === 11 && at('caption.lg.default')?.sizePx === 12, 'caption has md=11 + lg=12 sizes');
  ok(at('caption.lg.strong-link')?.link === true, 'caption gets link variants');
  // single-weight roles still carry the weight in the name (consistency)
  ok(at('display.lg.strong') && at('title.md.strong'), 'single-weight roles carry the weight in the name');
  ok(!d.some((c) => c.group === 'display' && c.link), 'display has no link variants (not a link role)');
  // weights lever: add emphasis to body, multi-weight display
  const lev = tBrand('wl', { weights: { body: ['default', 'emphasis', 'strong'], display: ['default', 'strong'] }, links: ['body'] }).typography.composites;
  ok(lev.some((c) => c.path === 'body.md.emphasis'), 'weights lever → body gains emphasis');
  ok(lev.some((c) => c.path === 'display.lg.default') && lev.some((c) => c.path === 'display.lg.strong'), 'weights lever → multi-weight display ramp');
  ok(!lev.some((c) => c.group === 'caption' && c.link), 'links lever → caption link variants removed when not listed');
}

// ------------------------------------------------- shadow / elevation invariants
{
  const shBrand = (id: string, shadow: any) => brandTheme({ id, primary: { l: 0.5, c: 0.15, h: 250 }, neutral: { hue: 250, chroma: 0.01 }, shadow });
  const sh = shBrand('sh', undefined).shadow;
  ok(sh.steps.length === 6, `shadow ramp is 6 steps (got ${sh.steps.length})`);
  ok(!!sh.inset, 'shadow ramp has an inset step');
  ok(sh.steps.every((s) => s.light.length === 2 && s.dark.length === 2), 'every shadow step is 2-layer (key+ambient), light+dark');
  ok(sh.steps.every((s) => [...s.light, ...s.dark].every((l) => l.offsetX === 0)), 'all shadow layers have offsetX 0 (light from above)');
  // monotonic ambient offsetY/blur across steps (elevation grows)
  let mono = true;
  for (let i = 1; i < sh.steps.length; i++) { const a = sh.steps[i].light[1], b = sh.steps[i - 1].light[1]; if (a.offsetY < b.offsetY || a.blur < b.blur) mono = false; }
  ok(mono, 'shadow ambient layer offsetY + blur grow monotonically with elevation');
  // dark is REDUCED vs light (lift-primary), never heavier
  ok(sh.steps.every((s) => s.light.every((l, j) => s.dark[j].alpha <= l.alpha)), 'dark shadow alpha ≤ light (reduced, lift-primary — not NB-heavier)');
  // softness scales blur
  const soft = shBrand('sh-soft', { softness: 2 }).shadow;
  ok(soft.steps[3].light[1].blur > sh.steps[3].light[1].blur, 'higher softness → larger blur');
  // tint amount 0 → pure black base
  const black = shBrand('sh-blk', { tint: { amount: 0 } }).shadow;
  ok(black.colorRgb.r === 0 && black.colorRgb.g === 0 && black.colorRgb.b === 0, 'tint amount 0 → pure-black shadow base');
  // tinted base is non-black
  const tinted = shBrand('sh-tint', { tint: { hue: 285, amount: 0.6 } }).shadow;
  ok(tinted.colorRgb.r + tinted.colorRgb.g + tinted.colorRgb.b > 0, 'tinted shadow base is not pure black');
}

// ------------------------------------------------- layout / breakpoint invariants
{
  const lyBrand = (id: string, layout: any) => brandTheme({ id, primary: { l: 0.5, c: 0.15, h: 250 }, neutral: { hue: 250, chroma: 0.01 }, layout });
  const d = lyBrand('ly', undefined).layout;
  ok(d.breakpoints.length === 5, `default layout is 5 breakpoints (got ${d.breakpoints.length})`);
  ok(d.breakpoints[0].px === 0, 'breakpoints start at 0 (mobile-first)');
  let asc = true;
  for (let i = 1; i < d.breakpoints.length; i++) if (d.breakpoints[i].px <= d.breakpoints[i - 1].px) asc = false;
  ok(asc, 'breakpoint floors strictly ascending');
  ok(d.breakpoints.map((b) => b.name).join(',') === 'sm,md,lg,xl,2xl', '5-tier names are sm/md/lg/xl/2xl');
  // column ladder: starts at ≤4, never exceeds base, top reaches base, monotonic
  ok(d.grid[0].columns <= 4 && d.grid[d.grid.length - 1].columns === d.baseColumns, 'column ladder: small ≤4, top = base');
  ok(d.grid.every((g) => g.columns <= d.baseColumns), 'no breakpoint exceeds the base column count');
  let cmono = true; for (let i = 1; i < d.grid.length; i++) if (d.grid[i].columns < d.grid[i - 1].columns) cmono = false;
  ok(cmono, 'column ladder is non-decreasing');
  // gutter/margin grow (shallow) and stay on the spacing scale (multiples of 8 or 4)
  ok(d.grid.every((g) => g.gutterPx % 4 === 0 && g.marginPx % 4 === 0), 'gutter/margin land on the 4px grid (spacing-scale aliases)');
  ok(d.grid[d.grid.length - 1].gutterPx >= d.grid[0].gutterPx, 'gutter grows toward the top breakpoint');
  // 6-tier prepends xs (Bootstrap convention)
  const six = lyBrand('ly6', { breakpoints: [0, 480, 768, 1024, 1440, 1920] }).layout;
  ok(six.breakpoints[0].name === 'xs' && six.breakpoints.map((b) => b.name).join(',') === 'xs,sm,md,lg,xl,2xl', '6-tier names prepend xs');
  // base column lever
  ok(lyBrand('ly16', { columns: 16 }).layout.grid.some((g) => g.columns === 16), 'columns lever → base 16 reachable');
  // 2-tier (NB-style minimal): smallest 4, top = base
  const two = lyBrand('ly2', { breakpoints: [0, 1024] }).layout;
  ok(two.grid[0].columns === 4 && two.grid[1].columns === two.baseColumns, '2-tier ladder = [4, base]');
}

// ------------------------------------------------- gradient invariants (opt-in)
{
  const grBrand = (id: string, gradients: any) => brandTheme({ id, primary: { l: 0.5, c: 0.18, h: 285 }, neutral: { hue: 285, chroma: 0.01 }, brandColors: [{ name: 'accent', oklch: { l: 0.55, c: 0.15, h: 235 } }], gradients });
  // OFF by default: no opt-in → no gradients (the field-common default).
  ok(grBrand('gr-off', undefined).gradient.gradients.length === 0, 'gradients OFF by default (no opt-in → none)');
  // `true` → exactly one default brand gradient (primary.600→primary.350, linear).
  const def = grBrand('gr-true', true).gradient.gradients;
  ok(def.length === 1 && def[0].name === 'brand' && def[0].kind === 'linear', '`gradients: true` ships one default linear brand gradient');
  ok(def[0].stops.length === 2 && def[0].stops[0].aliasOf === 'prism.palette.primary.600' && def[0].stops[1].aliasOf === 'prism.palette.primary.350', 'default gradient stops alias primary.600 → primary.350');
  // explicit array: linear + radial, cross-palette, stop colours alias the ramp.
  const ex = grBrand('gr-ex', [
    { name: 'brand', kind: 'linear', angle: 135, stops: [{ palette: 'primary', step: 600, position: 0 }, { palette: 'accent', step: 500, position: 1 }] },
    { name: 'glow', kind: 'radial', center: [0.5, 0.4], shape: 'circle', stops: [{ palette: 'accent', step: 400, position: 0 }, { palette: 'accent', step: 700, position: 1 }] },
  ]).gradient.gradients;
  ok(ex.length === 2 && ex[0].kind === 'linear' && ex[1].kind === 'radial', 'explicit array → both linear + radial kinds');
  ok(ex.every((g) => g.stops.every((s) => s.aliasOf.startsWith('prism.palette.'))), 'every gradient stop aliases the colour ramp (never raw hex)');
  // stops sorted ascending by position; positions in [0,1].
  ok(ex.every((g) => g.stops.every((s, i) => i === 0 || s.position >= g.stops[i - 1].position)), 'stops are ordered ascending by position');
  ok(ex.every((g) => g.stops.every((s) => s.position >= 0 && s.position <= 1)), 'stop positions are within [0,1]');
  // OKLCH pre-sampling for Figma: N≥2 sRGB stops, endpoints hex, p 0→1.
  ok(ex.every((g) => g.sampled.length >= 2 && g.sampled[0].position === 0 && g.sampled[g.sampled.length - 1].position === 1), 'sampled sRGB stops span positions 0→1');
  ok(ex.every((g) => g.sampled.every((s) => /^#[0-9a-f]{6}$/.test(s.hex))), 'sampled stops are 6-digit hex (baked sRGB for Figma)');
  // OKLCH midpoint is more chromatic than the naive sRGB midpoint (no grey dead zone).
  const oklchG = grBrand('gr-ok', [{ name: 'g', kind: 'linear', samples: 3, interpolation: 'oklch', stops: [{ palette: 'primary', step: 600, position: 0 }, { palette: 'accent', step: 500, position: 1 }] }]).gradient.gradients[0];
  const srgbG = grBrand('gr-sr', [{ name: 'g', kind: 'linear', samples: 3, interpolation: 'srgb', stops: [{ palette: 'primary', step: 600, position: 0 }, { palette: 'accent', step: 500, position: 1 }] }]).gradient.gradients[0];
  const chroma = (hexStr: string) => { const r = parseInt(hexStr.slice(1, 3), 16), g = parseInt(hexStr.slice(3, 5), 16), b = parseInt(hexStr.slice(5, 7), 16); return Math.max(r, g, b) - Math.min(r, g, b); };
  ok(chroma(oklchG.sampled[1].hex) >= chroma(srgbG.sampled[1].hex), 'OKLCH midpoint is no less chromatic than the sRGB midpoint (avoids the grey dead zone)');
  // worst-case-stop contrast is computed and is the MIN across sampled stops.
  ok(ex.every((g) => g.worstOnWhite > 0 && g.worstOnBlack > 0), 'worst-case-stop contrast computed for both white and black text');
  // invalid stop reference throws a clear error.
  let threw = false;
  try { grBrand('gr-bad', [{ name: 'x', stops: [{ palette: 'nope', step: 600, position: 0 }, { palette: 'primary', step: 600, position: 1 }] }]); } catch { threw = true; }
  ok(threw, 'gradient referencing an undefined palette throws');
  // NB ships no gradients.
  ok(nbTheme().gradient.gradients.length === 0, 'NB ships no gradients (it had none)');
}

// ------------------------------------------- surface/content model invariants
{
  const th = brandTheme({ id: 'sm', primary: { l: 0.5, c: 0.15, h: 250 }, neutral: { hue: 250, chroma: 0.01 } });
  const modes = resolveAllModes(th);
  const byMode = Object.fromEntries(modes.map((m) => [m.mode, m.roles] as const));
  const L = byMode['light'], D = byMode['dark'], HCD = byMode['hc-dark'];
  const p = (roles: any, k: string) => roles[k]?.path;
  // tonal ladders — the all-white-light complaint is fixed; dark lifts too
  ok(p(L, 'background.primary') !== p(L, 'background.secondary'), 'light background tiers are tonal (primary != secondary)');
  ok(p(L, 'foreground.primary') !== p(L, 'foreground.secondary'), 'light foreground tiers are tonal');
  ok(p(D, 'background.primary') !== p(D, 'background.secondary'), 'dark background tiers are tonal (lift)');
  // the relationship rule: a foreground surface differs from the page under it
  ok(p(L, 'foreground.primary') !== p(L, 'background.primary'), 'foreground.primary differs from background.primary');
  // inverse ladders on both layers
  ok(p(L, 'background.inverse.primary') && p(L, 'foreground.inverse.primary'), 'inverse ladders present on both layers');
  // action top-level; legacy foreground.interactive gone
  ok(p(L, 'action.default') !== undefined, 'action.* is top-level');
  ok(L['foreground.interactive.default'] === undefined, 'legacy foreground.interactive removed');
  // elevation colour group + dropped surfaces gone
  ok(!Object.keys(L).some((k) => k.startsWith('elevation')), 'no elevation.* colour group');
  ok(L['background.subtle'] === undefined && L['background.sunken'] === undefined && L['background.quaternary'] === undefined, 'background.subtle/sunken/quaternary removed');
  // renames
  ok(L['text.on-inverse'] !== undefined && L['text.on-emphasis'] === undefined, 'text.on-emphasis → on-inverse');
  ok(L['text.link.default'] !== undefined && L['text.interactive.default'] === undefined, 'links use text.link.*');
  // subtle semantic foreground + ink present (suffix form)
  ok(L['foreground.danger-subtle'] !== undefined && L['text.danger-subtle'] !== undefined, 'subtle semantic foreground + ink present');
  // HC carries elevation by border: raised tiers collapse to the base
  ok(p(HCD, 'background.secondary') === p(HCD, 'background.primary'), 'HC flattens background tiers to the base');
  ok(p(HCD, 'foreground.secondary') === p(HCD, 'foreground.primary'), 'HC flattens foreground tiers to the base');
  // harshness: no pure black anywhere in STANDARD modes; inverse surfaces softened
  const HCL = byMode['hc-light'];
  const isBlack = (path?: string) => /\.black$/.test(path ?? '');
  const isWhite = (path?: string) => /\.white$/.test(path ?? '');
  for (const m of ['light', 'dark'] as const) {
    const roles = byMode[m];
    const blacks = Object.entries(roles).filter(([, r]: any) => isBlack(r.path)).map(([k]) => k);
    ok(blacks.length === 0, `${m}: no pure black in standard mode (found: ${blacks.join(', ') || 'none'})`);
  }
  ok(!isBlack(p(L, 'background.inverse.primary')), 'light inverse surface is near-black, not pure black');
  ok(!isWhite(p(D, 'background.inverse.primary')), 'dark inverse surface is near-white, not pure white');
  ok(isWhite(p(L, 'background.primary')), 'light base page stays pure white (the one allowed pure extreme)');
  // on-* softening: dark on-action is near-black (950), light keeps pure white; HC keeps pure
  ok(p(D, 'text.on-action') === p(D, 'icon.on-action') && !isBlack(p(D, 'text.on-action')), 'dark on-action is softened (near-black, not pure)');
  ok(isWhite(p(L, 'text.on-action')), 'light on-action stays pure white (user preference)');
  ok(isWhite(p(HCD, 'text.on-action')) || isBlack(p(HCD, 'text.on-action')), 'HC keeps pure extremes for on-* (max contrast)');
  ok(isBlack(p(HCL, 'background.inverse.primary')), 'HC inverse stays a pure extreme (max contrast)');
  // on-disabled exists for text + icon and is contracted against the disabled fill
  ok(p(L, 'text.on-disabled') !== undefined && p(L, 'icon.on-disabled') !== undefined, 'text/icon.on-disabled exist');
  ok(L['text.on-disabled'].against === 'action.disabled', 'on-disabled is resolved against the disabled fill');
}

// -------------------------------------------------- design.md + CLI adapter
// The authoring front door (docs/07 §6): the YAML-subset parser, then the two
// example briefs as regressions on the CLI path — Aurora (faithfulness: byte-
// exact vs the committed golden) and Harbor (coverage: net-new, behavioural).

// (1) YAML-subset parser — every shape BrandInput actually uses.
{
  const y = parseYamlSubset([
    'id: demo',
    'primary: { l: 0.5, c: 0.18, h: 285 }',
    'flag: true',
    'count: 3',
    'name: "3:1"',
    'list: [0, 480, 768]',
    'brandColors:',
    '  - name: accent',
    '    oklch: { l: 0.55, c: 0.15, h: 235 }',
    'nested:',
    '  a: 1',
    '  b: two words',
  ].join('\n')) as any;
  ok(y.id === 'demo' && typeof y.id === 'string', 'parser: bare string scalar');
  ok(y.primary && y.primary.l === 0.5 && y.primary.h === 285, 'parser: flow map of numbers');
  ok(y.flag === true && typeof y.flag === 'boolean', 'parser: boolean scalar');
  ok(y.count === 3 && typeof y.count === 'number', 'parser: number scalar');
  ok(y.name === '3:1', 'parser: quoted string keeps its colon (3:1)');
  ok(Array.isArray(y.list) && y.list.length === 3 && y.list[1] === 480, 'parser: flow sequence of numbers');
  ok(Array.isArray(y.brandColors) && y.brandColors.length === 1 && y.brandColors[0].name === 'accent' && y.brandColors[0].oklch.h === 235,
    'parser: block sequence of maps + nested flow map');
  ok(y.nested && y.nested.a === 1 && y.nested.b === 'two words', 'parser: nested block map + multi-word bare string');
}
// (2) parseDesignMd — frontmatter/prose split; a missing fence is an error.
{
  const { input, prose } = parseDesignMd('---\nid: x\nprimary: { l: 0.5, c: 0.1, h: 200 }\n---\n\n# Title\n\nBody prose.\n');
  ok((input as any).id === 'x' && (input as any).primary.h === 200, 'parseDesignMd: frontmatter → BrandInput');
  ok(prose.includes('Body prose.') && !prose.includes('id: x'), 'parseDesignMd: prose separated from frontmatter');
  let threw = false;
  try { parseDesignMd('no fence here\nid: x\n'); } catch { threw = true; }
  ok(threw, 'parseDesignMd: missing frontmatter fence throws');
}
// (3) FAITHFULNESS — aurora.design.md compiles to the committed golden, byte-for-byte.
{
  const { input } = parseDesignMd(readFileSync(resolve(HERE, '../examples/aurora.design.md'), 'utf8'));
  ok(validateBrandInput(input).length === 0, 'aurora.design.md: schema-conforms');
  const generated = JSON.stringify(buildTree(brandTheme(input)).tree, null, 2) + '\n';
  const committed = readFileSync(resolve(HERE, 'out/aurora.tokens.json'), 'utf8');
  ok(generated === committed, 'aurora.design.md → byte-identical to out/aurora.tokens.json (CLI path ≡ hardcoded path)');
}
// (4) COVERAGE — harbor.design.md (net-new, no golden): conforms, resolves, all contracts hold.
{
  const { input } = parseDesignMd(readFileSync(resolve(HERE, '../examples/harbor.design.md'), 'utf8'));
  ok(validateBrandInput(input).length === 0, 'harbor.design.md: schema-conforms');
  const theme = brandTheme(input);
  const modes = resolveAllModes(theme);
  const broken = modes.flatMap((m) => Object.entries(m.roles).filter(([, r]) => r.min > 0 && r.ratio < r.min).map(([k]) => `${m.mode}.${k}`));
  ok(broken.length === 0, 'harbor: all mode contrast contracts hold' + (broken.length ? ` — FAILED: ${broken.join(', ')}` : ''));
  const built = buildTree(theme);
  ok(built.stats.broken.length === 0 && built.stats.aliases > 0, `harbor: all ${built.stats.aliases} aliases resolve`);
  ok(theme.notes.some((n) => n.toLowerCase().includes('action colour defaults to the primary')), 'harbor: default action=primary flagged in notes');
}
// (5) STANDARD dialect — the brand-skills / google-labs design.md path (docs/07 §11):
// the reader + colour-role classifier + x-prism3 levers, on the real Wendy's file.
{
  const std = parseStandardDesignMd(readFileSync(resolve(HERE, '../examples/wendys.design.md'), 'utf8'));
  ok(Object.keys(std.colors).length === 24 && Object.keys(std.typography).length === 25, 'wendys standard: reader sees 24 colours + 25 type tokens');
  const cls = classifyColors(std.colors);
  ok(!!cls.input.status.danger, 'classifier: error → status.danger (the one rename)');
  ok(!!cls.input.status.success && !!cls.input.status.warning, 'classifier: success + warning classified from the flat map');
  ok(cls.input.brandColors.some((b) => b.name === 'secondary') && cls.input.brandColors.some((b) => b.name === 'tertiary'), 'classifier: secondary + tertiary → brandColors[]');
  const { input, xApplied } = standardToBrandInput(std);
  ok(input.id === 'wendys', "standardToBrandInput: id derived from name (Wendy's → wendys)");
  ok(xApplied.length === 0, 'wendys: no x-prism3 block → engine defaults (the plain-spec guarantee)');
  ok(validateBrandInput(input).length === 0, 'wendys standard: classified BrandInput schema-conforms');
  const theme = brandTheme(input);
  ok(theme.roleToPalette.danger === 'danger', 'wendys: error→danger carved as a distinct palette');
  const built = buildTree(theme);
  ok(built.stats.broken.length === 0 && built.stats.aliases > 0, `wendys: all ${built.stats.aliases} aliases resolve`);
  const broken = resolveAllModes(theme).flatMap((m) => Object.entries(m.roles).filter(([, r]) => r.min > 0 && r.ratio < r.min).map(([k]) => `${m.mode}.${k}`));
  ok(broken.length === 0, 'wendys: all mode contrast contracts hold' + (broken.length ? ` — FAILED: ${broken.join(', ')}` : ''));
  // exact-anchor preservation: the generated primary ramp contains the observed hex at ΔE00 ~0.
  const pPal = theme.palettes.find((p) => p.palette === 'primary')!;
  const bestDe = Math.min(...pPal.steps.map((s) => deltaE2000(s.rgb, hexToRgb(std.colors.primary))));
  ok(bestDe < 0.5, `wendys: primary anchor reproduced at ΔE00 ${bestDe.toFixed(2)} (< 0.5, exact-anchor preservation)`);
}
// (6) x-prism3 lever mapping + dialect detection.
{
  const probe = { id: 'p', primary: { l: 0.5, c: 0.1, h: 20 }, neutral: { hue: 20, chroma: 0.01 } } as BrandInput;
  const applied = applyXPrism3(probe, { radiusScale: 2, typeScale: 'expressive', motionTempo: 'snappy', density: 'compact' });
  ok(probe.radiusScale === 2 && probe.typography?.typeScale === 'expressive' && probe.motionPersonality?.tempo === 'snappy' && probe.density === 'compact' && applied.length === 4,
    'applyXPrism3: levers map onto BrandInput (brand-skills → engine round-trip)');
  const nativeStd = parseStandardDesignMd(readFileSync(resolve(HERE, '../examples/harbor.design.md'), 'utf8'));
  ok(Object.keys(nativeStd.colors).length === 0, 'dialect detection: an engine-native brief has no top-level colors map (routes native)');
}
// (7) LEVER MANIFEST — the shared-control contract (docs/08 §4). The presentation
// half must NOT drift from theme-schema.json (the validation half): every key
// resolves, every enum's options match the schema enum (as a set), every default
// matches the schema default, and the committed JSON is up to date.
{
  const schema = JSON.parse(readFileSync(resolve(HERE, '../schema/theme-schema.json'), 'utf8'));
  const resolveNode = (key: string): any => {
    let node: any = schema;
    for (const p of key.split('.')) { const props = node?.properties; if (!props || !props[p]) return undefined; node = props[p]; }
    return node;
  };
  const setEq = (a: unknown[], b: unknown[]) => JSON.stringify([...a].map(String).sort()) === JSON.stringify([...b].map(String).sort());
  const groups = new Set(leverGroups.map((g) => g.group));
  const controls = new Set(['color', 'slider', 'enum', 'toggle', 'list', 'palette-ref', 'object', 'text']);

  const unresolved = leverManifest.filter((l) => !resolveNode(l.key)).map((l) => l.key);
  ok(unresolved.length === 0, 'lever manifest: every key resolves in theme-schema.json' + (unresolved.length ? ` — MISSING: ${unresolved.join(', ')}` : ''));

  const badGC = leverManifest.filter((l) => !groups.has(l.group) || !controls.has(l.control)).map((l) => l.key);
  ok(badGC.length === 0, 'lever manifest: every group + control is from the allowed set' + (badGC.length ? ` — BAD: ${badGC.join(', ')}` : ''));

  const enumDrift = leverManifest.filter((l) => l.control === 'enum').filter((l) => {
    const e = resolveNode(l.key)?.enum;
    return !e || !setEq(e, (l.options ?? []).map((o) => o.value));
  }).map((l) => l.key);
  ok(enumDrift.length === 0, 'lever manifest: every enum lever’s options match the schema enum (as a set)' + (enumDrift.length ? ` — DRIFT: ${enumDrift.join(', ')}` : ''));

  const defDrift = leverManifest.filter((l) => {
    const n = resolveNode(l.key);
    return n && n.default !== undefined && l.default !== undefined && JSON.stringify(n.default) !== JSON.stringify(l.default);
  }).map((l) => l.key);
  ok(defDrift.length === 0, 'lever manifest: every lever default matches the schema default' + (defDrift.length ? ` — DRIFT: ${defDrift.join(', ')}` : ''));

  // Every schema-root-required field (minus host-supplied identity, e.g. `id`) must be
  // covered by a required lever — as an exact key, or (for object fields like `neutral`)
  // by a required lever nested under it. Catches a NEW required field or a dropped one.
  const req = new Set(leverManifest.filter((l) => l.required).map((l) => l.key));
  const schemaRequired: string[] = (schema.required ?? []).filter((k: string) => !(identityFields as readonly string[]).includes(k));
  const uncovered = schemaRequired.filter((k) => !req.has(k) && ![...req].some((rk) => rk.startsWith(k + '.')));
  ok(uncovered.length === 0, 'lever manifest: every required BrandInput field (minus identity) is a required lever' + (uncovered.length ? ` — UNCOVERED: ${uncovered.join(', ')}` : ''));

  const committed = readFileSync(resolve(HERE, '../schema/lever-manifest.json'), 'utf8');
  ok(committed === JSON.stringify(buildLeverManifest(), null, 2) + '\n',
    'lever manifest: schema/lever-manifest.json is up to date (run `npx tsx engine/emit-levers.ts`)');
}
// (8) PREVIEW SPEC — the shared live-preview contract (docs/08 §7, B1a). Every bound
// token path (bindings + contract endpoints) must resolve to a real leaf in the
// emitted token tree (binding-validity), contract mins are sane, and the committed
// JSON stays current. The semantic role layer is brand-agnostic, so harbor's tree
// is representative.
{
  const previewTheme = brandTheme(parseDesignMd(readFileSync(resolve(HERE, '../examples/harbor.design.md'), 'utf8')).input);
  const tree = buildTree(previewTheme).tree;
  const root = Object.keys(tree)[0];
  const isLeaf = (path: string): boolean => {
    let node: any = tree[root];
    for (const seg of path.split('.')) { node = node?.[seg]; if (node == null) return false; }
    return node.$value !== undefined;
  };
  const missing = previewTokenRefs().filter((p) => !isLeaf(p));
  ok(missing.length === 0, 'preview spec: every bound token path resolves to a leaf in the token tree' + (missing.length ? ` — MISSING: ${missing.join(', ')}` : ''));

  const badContracts: string[] = [];
  for (const c of previewSpec.components) for (const v of c.variants) for (const ct of v.contracts ?? []) {
    if (![3, 4.5].includes(ct.min) || ct.fg === ct.bg) badContracts.push(`${c.id}/${v.name}`);
  }
  ok(badContracts.length === 0, 'preview spec: every contract has a sane min (3|4.5) and distinct fg/bg' + (badContracts.length ? ` — BAD: ${badContracts.join(', ')}` : ''));

  // A declared contract must not CLAIM MORE than the engine guarantees. For any pair
  // whose (fg role, bg) equals an engine role's (path key, `against`), require
  // declared min ≤ the engine's min — so a component can't assert a 3:1 boundary on a
  // role the engine ships decorative (the input/border.primary defect, PR #20 review).
  const modes = resolveAllModes(previewTheme);
  const strip = (p: string) => p.replace(/^color\./, '');
  const overclaims: string[] = [];
  for (const c of previewSpec.components) for (const v of c.variants) for (const ct of v.contracts ?? []) {
    const fgRole = strip(ct.fg), bgRole = strip(ct.bg);
    for (const m of modes) {
      const role = m.roles[fgRole];
      if (role && role.against === bgRole && ct.min > role.min) overclaims.push(`${c.id}/${v.name} ${fgRole}-on-${bgRole} ${m.mode}: declares ${ct.min} > engine ${role.min}`);
    }
  }
  ok(overclaims.length === 0, 'preview spec: no contract over-claims the engine guarantee' + (overclaims.length ? ` — ${overclaims.join('; ')}` : ''));

  const committedPreview = readFileSync(resolve(HERE, '../schema/preview-spec.json'), 'utf8');
  ok(committedPreview === JSON.stringify(buildPreviewSpec(), null, 2) + '\n',
    'preview spec: schema/preview-spec.json is up to date (run `npx tsx engine/emit-preview.ts`)');
}
// (9) RESOLVED PREVIEW (docs/08 §7, B1b) — project the spec to concrete colours per
// mode + compute each declared contract on the REAL resolved colours. Gates: every
// referenced colour role resolves to a hex in every mode, and every declared a11y
// contract actually HOLDS in every mode — the automated version of the PR #20 manual
// contrast check (the overlay's claims are true on the resolved colours, not assumed).
{
  const rp = resolvePreview(brandTheme(parseDesignMd(readFileSync(resolve(HERE, '../examples/harbor.design.md'), 'utf8')).input));
  ok(rp.modes.length === 4, 'resolved preview: all four modes projected' + (rp.modes.length !== 4 ? ` — got ${rp.modes.length}` : ''));

  const noHex = Object.entries(rp.colors).filter(([, byMode]) => rp.modes.some((m) => !byMode[m])).map(([k]) => k);
  ok(noHex.length === 0, 'resolved preview: every referenced colour role resolves to a hex in every mode' + (noHex.length ? ` — MISSING: ${noHex.join(', ')}` : ''));

  const failures = rp.contracts.flatMap((c) =>
    rp.modes.filter((m) => c.byMode[m] && !c.byMode[m].pass).map((m) => `${c.component}/${c.variant} ${c.fg.replace('color.', '')}-on-${c.bg.replace('color.', '')} ${m}: ${c.byMode[m].ratio}<${c.min}`));
  ok(failures.length === 0, 'resolved preview: every declared contract holds on the resolved colours (all 4 modes)' + (failures.length ? ` — FAIL: ${failures.join('; ')}` : ''));

  // Geometry/type read-model (docs/09 PR B): every dimension binding resolves to a
  // positive px, every type binding to a real family + positive size — so the hosts
  // render real radius/padding/type, not fallbacks.
  const badDim = Object.entries(rp.dims).filter(([, px]) => !(px > 0)).map(([k, px]) => `${k}=${px}`);
  ok(Object.keys(rp.dims).length > 0 && badDim.length === 0, 'resolved preview: every dimension binding → positive px' + (badDim.length ? ` — BAD: ${badDim.join(', ')}` : ''));
  const badType = Object.entries(rp.type).filter(([, t]) => !t.fontFamily || !(t.fontSizePx > 0)).map(([k]) => k);
  ok(Object.keys(rp.type).length > 0 && badType.length === 0, 'resolved preview: every type binding → family + positive size' + (badType.length ? ` — BAD: ${badType.join(', ')}` : ''));
}
// (10) EXAMPLE-BRANDS ARTIFACT (docs/09) — the browser hosts boot from
// schema/example-brands.json (the design.md parser is node-only). Gate that the
// committed JSON is current AND that EVERY emitted brand resolves all-green on the
// preview contracts — so a host can trust whatever it boots from (extends the B1b
// check beyond harbor to every host-facing example, incl. the web's aurora default).
{
  const committed = readFileSync(resolve(HERE, '../schema/example-brands.json'), 'utf8');
  ok(committed === exampleBrandsJson(), 'example brands: schema/example-brands.json is up to date (run `npx tsx engine/emit-brandinput.ts`)');

  const brands = exampleBrands();
  for (const id of EXAMPLE_IDS) {
    const rp = resolvePreview(brandTheme(brands[id] as BrandInput));
    const broken = rp.contracts.flatMap((c) =>
      rp.modes.filter((m) => c.byMode[m] && !c.byMode[m].pass).map((m) => `${c.component}/${c.variant} ${m}:${c.byMode[m].ratio}<${c.min}`));
    ok(broken.length === 0, `example brand '${id}': every preview contract holds (all 4 modes)` + (broken.length ? ` — FAIL: ${broken.join('; ')}` : ''));
  }
}

// (11) EMIT-FIGMA COLOUR (docs/10) — buildFigmaColor(nbTheme) must reproduce the frozen
// Token Press export (fixtures/figma/nb): same variable names per collection/mode, same
// scopes, and — the load-bearing property — every semantic aliases the SAME palette
// variable by name in every mode (0 broken/mismatched). Values compared to float32
// tolerance (Figma stores colour as float32; the importer's rounding differs by ~5e-7).
{
  const FIXDIR = resolve(HERE, '../fixtures/figma/nb');
  const { palette, color } = buildFigmaColor(nbTheme());
  const emitted: Record<string, any> = { palette };
  for (const c of color) emitted[`color.${c.$mode}`] = c;

  for (const key of ['palette', ...COLOR_MODES.map((m) => `color.${m}`)]) {
    const fix = JSON.parse(readFileSync(resolve(FIXDIR, `${key}.json`), 'utf8'));
    const out = emitted[key];
    const fixByName = new Map<string, any>(fix.variables.map((v: any) => [v.name, v]));
    const outByName = new Map<string, any>(out.variables.map((v: any) => [v.name, v]));
    const missing = [...fixByName.keys()].filter((n) => !outByName.has(n));
    const extra = [...outByName.keys()].filter((n) => !fixByName.has(n));
    ok(missing.length === 0 && extra.length === 0, `figma ${key}: variable names match fixture (${fix.variables.length})` + (missing.length ? ` — MISSING ${missing.slice(0, 3).join(',')}` : '') + (extra.length ? ` — EXTRA ${extra.slice(0, 3).join(',')}` : ''));

    const scopeBad: string[] = [], aliasBad: string[] = [], valBad: string[] = [];
    for (const [name, fv] of fixByName) {
      const ov = outByName.get(name); if (!ov) continue;
      if (JSON.stringify([...fv.scopes].sort()) !== JSON.stringify([...ov.scopes].sort())) scopeBad.push(name);
      if ((fv.alias?.name ?? null) !== (ov.alias?.name ?? null)) aliasBad.push(name);
      for (const ch of ['r', 'g', 'b', 'a']) if (Math.abs((fv.value?.[ch] ?? 0) - (ov.value?.[ch] ?? 0)) > 1e-5) valBad.push(`${name}.${ch}`);
    }
    ok(scopeBad.length === 0, `figma ${key}: scopes match fixture` + (scopeBad.length ? ` — ${scopeBad.slice(0, 3).join(',')}` : ''));
    ok(aliasBad.length === 0, `figma ${key}: every alias targets the same palette var as the fixture` + (aliasBad.length ? ` — ${aliasBad.slice(0, 3).join(',')}` : ''));
    ok(valBad.length === 0, `figma ${key}: resolved values match fixture (float32 tol)` + (valBad.length ? ` — ${valBad.slice(0, 3).join(',')}` : ''));
  }
}

// (12) EMIT-FIGMA TYPOGRAPHY (docs/10 §4) — byte-reproduce the frozen font.json +
// font-fluid.{desktop,mobile}.json (names/scopes/values/aliases exact), and gate
// the 36 text styles against the CORRECTED expectation (NOT the pre-fix
// text-styles.json fixture — that's a structural reference only; the six §4
// fixes intentionally diverge). Fixes checked: (1) no `text/` wrapper prefix;
// (2) prescribed collection names (`font`, `font-fluid`); (3a) lineHeight
// PERCENT; (3b) letterSpacing PERCENT baked; (4) primary family bound; (5)
// fontStyle derived from weight-role via the named-instance table.
{
  const FIXDIR = resolve(HERE, '../fixtures/figma/nb');
  const theme = nbTheme();

  // (a) font.json — byte-reproduce (38 vars: 3 family + 22 size + 9 weight + 4 weight-role).
  const font = buildFigmaFont(theme);
  const fontFix = JSON.parse(readFileSync(resolve(FIXDIR, 'font.json'), 'utf8'));
  const fontByName = new Map<string, any>(fontFix.variables.map((v: any) => [v.name, v]));
  const emitByName = new Map<string, any>(font.variables.map((v: any) => [v.name, v]));
  const missingF = [...fontByName.keys()].filter((n) => !emitByName.has(n));
  const extraF = [...emitByName.keys()].filter((n) => !fontByName.has(n));
  ok(missingF.length === 0 && extraF.length === 0, `figma font: variable names match fixture (${fontFix.variables.length})` + (missingF.length ? ` — MISSING ${missingF.slice(0, 3).join(',')}` : '') + (extraF.length ? ` — EXTRA ${extraF.slice(0, 3).join(',')}` : ''));

  const badFT: string[] = [], badFS: string[] = [], badFV: string[] = [], badFA: string[] = [], badFD: string[] = [];
  for (const [name, fv] of fontByName) {
    const ov = emitByName.get(name); if (!ov) continue;
    if (fv.resolvedType !== ov.resolvedType) badFT.push(name);
    if (JSON.stringify([...fv.scopes].sort()) !== JSON.stringify([...ov.scopes].sort())) badFS.push(name);
    if (fv.value !== ov.value) badFV.push(name);
    if ((fv.alias?.name ?? null) !== (ov.alias?.name ?? null)) badFA.push(name);
    if (fv.description !== ov.description) badFD.push(name);
  }
  ok(badFT.length === 0, 'figma font: resolvedType matches fixture' + (badFT.length ? ` — ${badFT.slice(0, 3).join(',')}` : ''));
  ok(badFS.length === 0, 'figma font: scopes match fixture' + (badFS.length ? ` — ${badFS.slice(0, 3).join(',')}` : ''));
  ok(badFV.length === 0, 'figma font: values match fixture' + (badFV.length ? ` — ${badFV.slice(0, 3).join(',')}` : ''));
  ok(badFA.length === 0, 'figma font: weight-role aliases target the same numeric weight as fixture' + (badFA.length ? ` — ${badFA.slice(0, 3).join(',')}` : ''));
  ok(badFD.length === 0, 'figma font: family descriptions carry the full fallback stack (fix #4)' + (badFD.length ? ` — ${badFD.slice(0, 3).join(',')}` : ''));

  // (b) font-fluid.{mobile,desktop} — byte-reproduce (10 vars per mode).
  const fluid = buildFigmaFontFluid(theme);
  for (const mode of FONT_FLUID_MODES) {
    const emitted = fluid.find((f) => f.$mode === mode)!;
    const fx = JSON.parse(readFileSync(resolve(FIXDIR, `font-fluid.${mode}.json`), 'utf8'));
    const fxByName = new Map<string, any>(fx.variables.map((v: any) => [v.name, v]));
    const outByName = new Map<string, any>(emitted.variables.map((v: any) => [v.name, v]));
    const missing = [...fxByName.keys()].filter((n) => !outByName.has(n));
    const extra = [...outByName.keys()].filter((n) => !fxByName.has(n));
    ok(missing.length === 0 && extra.length === 0, `figma font-fluid.${mode}: variable names match fixture (${fx.variables.length})` + (missing.length ? ` — MISSING ${missing.slice(0, 3).join(',')}` : '') + (extra.length ? ` — EXTRA ${extra.slice(0, 3).join(',')}` : ''));
    const scBad: string[] = [], vBad: string[] = [], tBad: string[] = [];
    for (const [name, fv] of fxByName) {
      const ov = outByName.get(name); if (!ov) continue;
      if (fv.resolvedType !== ov.resolvedType) tBad.push(name);
      if (JSON.stringify([...fv.scopes].sort()) !== JSON.stringify([...ov.scopes].sort())) scBad.push(name);
      if (fv.value !== ov.value) vBad.push(name);
    }
    ok(tBad.length === 0 && scBad.length === 0, `figma font-fluid.${mode}: scopes + resolvedType match fixture` + (tBad.length ? ` — types: ${tBad.slice(0, 3).join(',')}` : '') + (scBad.length ? ` — scopes: ${scBad.slice(0, 3).join(',')}` : ''));
    ok(vBad.length === 0, `figma font-fluid.${mode}: per-mode FONT_SIZE values match fixture` + (vBad.length ? ` — ${vBad.slice(0, 3).join(',')}` : ''));
  }

  // (c) text-styles — the six §4 fixes, gated against the CORRECTED expectation
  // (the pre-fix fixture is a structural reference; use it to build the expected
  // fluid/underline set + resolved fontSize per mode, then verify the fixes).
  const ts = buildFigmaTextStyles(theme);
  const preFix = JSON.parse(readFileSync(resolve(FIXDIR, 'text-styles.json'), 'utf8'));
  // Fixture strips the `text/` prefix → the corrected name is the composite path.
  const expectedByCorrectedName = new Map<string, any>(preFix.styles.map((s: any) => [String(s.name).replace(/^text\//, ''), s]));
  const emittedByName = new Map<string, any>(ts.styles.map((s: any) => [s.name, s]));
  const missS = [...expectedByCorrectedName.keys()].filter((n) => !emittedByName.has(n));
  const extraS = [...emittedByName.keys()].filter((n) => !expectedByCorrectedName.has(n));
  ok(missS.length === 0 && extraS.length === 0, `figma text-styles: same 36 styles as fixture — fix #1 (no \`text/\` wrapper)` + (missS.length ? ` — MISSING ${missS.slice(0, 3).join(',')}` : '') + (extraS.length ? ` — EXTRA ${extraS.slice(0, 3).join(',')}` : ''));

  // fix #1 sanity — no emitted style starts with `text/`.
  const wrapped = ts.styles.filter((s) => s.name.startsWith('text/'));
  ok(wrapped.length === 0, 'figma text-styles: fix #1 — no emitted style name starts with `text/`');

  const collBad: string[] = [], famBad: string[] = [], sizeBind: string[] = [], weightBind: string[] = [];
  const lhWrong: string[] = [], lsWrong: string[] = [], styleWrong: string[] = [];
  const upperMismatch: string[] = [], decoMismatch: string[] = [];
  for (const s of ts.styles) {
    const p = s.properties;
    // fix #2 — collection is `font` or `font-fluid`, matching what the fixture bound.
    const fx = expectedByCorrectedName.get(s.name);
    if (!fx) continue;
    if (!(p.fontFamily as any).bound || (p.fontFamily as any).collection !== 'font') collBad.push(`${s.name}:family`);
    if (!(p.fontSize as any).bound || !['font', 'font-fluid'].includes((p.fontSize as any).collection)) collBad.push(`${s.name}:size`);
    if (!(p.fontWeight as any).bound || (p.fontWeight as any).collection !== 'font') collBad.push(`${s.name}:weight`);
    // The pre-fix fixture bound fontSize to the same collection the corrected
    // emit chooses (font-fluid for fluid composites, font for static) — that
    // structure survives the fixes. Verify same binding target.
    if ((p.fontSize as any).variable !== fx.properties.fontSize.variable) sizeBind.push(`${s.name}: ${(p.fontSize as any).variable} ≠ ${fx.properties.fontSize.variable}`);
    if ((p.fontWeight as any).variable !== fx.properties.fontWeight.variable) weightBind.push(`${s.name}: ${(p.fontWeight as any).variable} ≠ ${fx.properties.fontWeight.variable}`);
    if ((p.fontFamily as any).variable !== fx.properties.fontFamily.variable) famBad.push(`${s.name}: ${(p.fontFamily as any).variable} ≠ ${fx.properties.fontFamily.variable}`);

    // fix #3a — lineHeight PERCENT, matches fontSize×multiplier / fontSize×100.
    const lh = (p.lineHeight as any).value;
    if (lh.unit !== 'PERCENT') lhWrong.push(`${s.name}:unit=${lh.unit}`);
    // Compare to the pre-fix PIXELS bake: percent × (fixture fontSize) / 100 should equal fixture PIXELS,
    // within a rounding tolerance (fixture bakes at desktop size for fluid composites).
    const fxLhPx = fx.properties.lineHeight.value.value;
    // Reconstruct the multiplier the fixture implies: fx px / fx desktop fontSize.
    const fxDesktopSize = (fx.properties.fontSize.resolvedByMode?.desktop ?? fx.properties.fontSize.resolvedByMode?.Default) as number;
    const expectedPercent = Math.round((fxLhPx / fxDesktopSize) * 100);
    if (Math.abs(lh.value - expectedPercent) > 1) lhWrong.push(`${s.name}:${lh.value}%≠${expectedPercent}% (fixture ${fxLhPx}px/${fxDesktopSize}px)`);

    // fix #3b (partial: PERCENT baked, not yet bindable). Same reconstruction —
    // fixture LS px / fx desktop size → PERCENT × 100 rounded.
    const ls = (p.letterSpacing as any).value;
    if (ls.unit !== 'PERCENT') lsWrong.push(`${s.name}:unit=${ls.unit}`);
    const fxLsPx = fx.properties.letterSpacing.value.value;
    const expectedLsPct = Math.round((fxLsPx / fxDesktopSize) * 10000) / 100;
    if (Math.abs(ls.value - expectedLsPct) > 0.01) lsWrong.push(`${s.name}:${ls.value}%≠${expectedLsPct}% (fixture ${fxLsPx}px/${fxDesktopSize}px)`);

    // fix #5 — fontStyle derived from weight-role numeric via named-instance table.
    // Compare against the derived expectation (not the fixture's baked string —
    // it happens to agree today for NB's weights + Inter).
    const fxStyle = fx.properties.fontStyle.value;
    if ((p.fontStyle as any).value !== fxStyle) styleWrong.push(`${s.name}: emitted ${(p.fontStyle as any).value} ≠ fixture ${fxStyle}`);

    // Preserved from spec: eyebrow uppercase + link underline.
    if ((p.textCase as any).value !== fx.properties.textCase.value) upperMismatch.push(`${s.name}: ${(p.textCase as any).value} ≠ ${fx.properties.textCase.value}`);
    if ((p.textDecoration as any).value !== fx.properties.textDecoration.value) decoMismatch.push(`${s.name}: ${(p.textDecoration as any).value} ≠ ${fx.properties.textDecoration.value}`);
  }
  ok(collBad.length === 0, 'figma text-styles: fix #2 — every bound property uses the prescribed collection (font / font-fluid)' + (collBad.length ? ` — ${collBad.slice(0, 3).join(', ')}` : ''));
  ok(famBad.length === 0, 'figma text-styles: fix #4 — fontFamily binds font/family/<role> (primary face; full stack in variable description)' + (famBad.length ? ` — ${famBad.slice(0, 3).join('; ')}` : ''));
  ok(sizeBind.length === 0, 'figma text-styles: fontSize binds the same var as the fixture (font/<size> or font-fluid/<path>)' + (sizeBind.length ? ` — ${sizeBind.slice(0, 3).join('; ')}` : ''));
  ok(weightBind.length === 0, 'figma text-styles: fontWeight binds font/weight-role/<role>' + (weightBind.length ? ` — ${weightBind.slice(0, 3).join('; ')}` : ''));
  ok(lhWrong.length === 0, 'figma text-styles: fix #3a — lineHeight baked as PERCENT (unit=PERCENT, value = round(multiplier×100))' + (lhWrong.length ? ` — ${lhWrong.slice(0, 3).join('; ')}` : ''));
  ok(lsWrong.length === 0, 'figma text-styles: fix #3b — letterSpacing baked as PERCENT (unit=PERCENT, value = em×100)' + (lsWrong.length ? ` — ${lsWrong.slice(0, 3).join('; ')}` : ''));
  ok(styleWrong.length === 0, 'figma text-styles: fix #5 — fontStyle derived from weight-role via the named-instance table' + (styleWrong.length ? ` — ${styleWrong.slice(0, 3).join('; ')}` : ''));
  ok(upperMismatch.length === 0, 'figma text-styles: textCase preserved (eyebrow UPPER, else ORIGINAL)' + (upperMismatch.length ? ` — ${upperMismatch.slice(0, 3).join('; ')}` : ''));
  ok(decoMismatch.length === 0, 'figma text-styles: textDecoration preserved (-link → UNDERLINE, else NONE)' + (decoMismatch.length ? ` — ${decoMismatch.slice(0, 3).join('; ')}` : ''));

  // fontStyleName table sanity — mono collapses 600 to Medium (JetBrains Mono has no Semi Bold).
  ok(fontStyleName('text', 700) === 'Bold' && fontStyleName('display', 600) === 'Semi Bold', 'figma fontStyleName: sans/display weight → real style name (700=Bold, 600=Semi Bold)');
  ok(fontStyleName('mono', 600) === 'Medium' && fontStyleName('mono', 400) === 'Regular', 'figma fontStyleName: mono collapses 600→Medium (JetBrains Mono lacks Semi Bold)');
}
// (13) EMIT-FIGMA DIMS (docs/10 §7 item 2) — the geometric axis has NO fixtures
// (§2 freezes only colour + typography). Gate structurally: variable counts vs
// the DTCG tree, every alias resolves within the emitted collections, scopes +
// resolvedType consistent per family. Materialisation-to-verify runs separately
// via the Figma MCP (docs/10 DoD).
{
  const theme = nbTheme();
  const { tree } = buildTree(theme);
  const root = Object.keys(tree)[0];
  const brand = tree[root];
  const dims = buildFigmaDims(theme);

  // (a) Counts match the DTCG tree exactly. Focus is -1 because the
  // strokeStyle leaf (`focus.ring.style: 'solid'`) is intentionally skipped —
  // Figma has no strokeStyle variable primitive.
  const expected = {
    dimension: Object.keys(brand.dimension).length,
    space: Object.keys(brand.space).length,
    radius: Object.keys(brand.radius).length,
    size: Object.keys(brand.size).length * 3, // 3 props per t-shirt
    'border-width': Object.keys(brand['border-width']).length,
    focus: Object.keys(brand.focus.ring).filter((k) => brand.focus.ring[k].$type === 'dimension').length,
    opacity: Object.keys(brand.opacity).length,
  };
  const got = {
    dimension: dims.dimension.variables.length,
    space: dims.space.variables.length,
    radius: dims.radius.variables.length,
    size: dims.size.variables.length,
    'border-width': dims.borderWidth.variables.length,
    focus: dims.focus.variables.length,
    opacity: dims.opacity.variables.length,
  };
  for (const key of Object.keys(expected) as Array<keyof typeof expected>) {
    ok(expected[key] === got[key], `figma dims.${key}: variable count matches DTCG tree (${expected[key]})` + (expected[key] !== got[key] ? ` — got ${got[key]}` : ''));
  }

  // (b) Every FLOAT var carries a valid non-empty scope set and resolvedType=FLOAT.
  const allDimColls = [dims.dimension, dims.space, dims.radius, dims.size, dims.borderWidth, dims.focus, dims.opacity];
  const badType: string[] = [], badScope: string[] = [];
  for (const c of allDimColls) for (const v of c.variables) {
    if (v.resolvedType !== 'FLOAT') badType.push(`${c.$collection}:${v.name}`);
    if (!v.scopes || v.scopes.length === 0) badScope.push(`${c.$collection}:${v.name}`);
  }
  ok(badType.length === 0, 'figma dims: every variable is resolvedType FLOAT' + (badType.length ? ` — ${badType.slice(0, 3).join(', ')}` : ''));
  ok(badScope.length === 0, 'figma dims: every variable declares at least one scope' + (badScope.length ? ` — ${badScope.slice(0, 3).join(', ')}` : ''));

  // (c) Every alias target resolves within the emitted collections.
  const allNames = new Set<string>();
  for (const c of allDimColls) for (const v of c.variables) allNames.add(v.name);
  const missingTargets: string[] = [];
  for (const c of allDimColls) for (const v of c.variables) {
    if (v.alias && !allNames.has(v.alias.name)) missingTargets.push(`${c.$collection}:${v.name} → ${v.alias.name}`);
  }
  ok(missingTargets.length === 0, 'figma dims: every alias resolves within the emitted collections' + (missingTargets.length ? ` — ${missingTargets.slice(0, 3).join(', ')}` : ''));

  // (d) Scopes narrow correctly per family — the picker in Figma should only
  // show `space/*` under GAP contexts, `radius/*` under CORNER_RADIUS, etc.
  const scopeFor: Record<string, string[]> = {
    dimension: ['WIDTH_HEIGHT', 'GAP', 'CORNER_RADIUS', 'STROKE_FLOAT'],
    space: ['GAP'],
    radius: ['CORNER_RADIUS'],
    'border-width': ['STROKE_FLOAT'],
    focus: ['STROKE_FLOAT'],
    opacity: ['OPACITY'],
  };
  const scopeMismatch: string[] = [];
  for (const c of allDimColls) {
    const expect = scopeFor[c.$collection];
    if (!expect) continue; // size scopes vary per prop — checked separately below
    for (const v of c.variables) {
      if (JSON.stringify(v.scopes) !== JSON.stringify(expect)) scopeMismatch.push(`${c.$collection}:${v.name} = ${v.scopes.join(',')}`);
    }
  }
  ok(scopeMismatch.length === 0, 'figma dims: scopes narrow per family (space→GAP, radius→CORNER_RADIUS, border-width/focus→STROKE_FLOAT, opacity→OPACITY, dimension broad)' + (scopeMismatch.length ? ` — ${scopeMismatch.slice(0, 3).join('; ')}` : ''));

  // (e) size — height binds WIDTH_HEIGHT + aliases dimension; padding binds
  // GAP + aliases space. Verifies the component tier composes the shared
  // primitives correctly.
  const sizeBad: string[] = [];
  for (const v of dims.size.variables) {
    const isHeight = v.name.endsWith('/height');
    const isPadding = v.name.includes('/padding-');
    if (isHeight) {
      if (JSON.stringify(v.scopes) !== JSON.stringify(['WIDTH_HEIGHT'])) sizeBad.push(`${v.name}:scope=${v.scopes.join(',')}`);
      if (v.alias && !v.alias.name.startsWith('dimension/')) sizeBad.push(`${v.name}:alias=${v.alias.name} (want dimension/*)`);
    } else if (isPadding) {
      if (JSON.stringify(v.scopes) !== JSON.stringify(['GAP'])) sizeBad.push(`${v.name}:scope=${v.scopes.join(',')}`);
      if (v.alias && !v.alias.name.startsWith('space/')) sizeBad.push(`${v.name}:alias=${v.alias.name} (want space/*)`);
    }
  }
  ok(sizeBad.length === 0, 'figma size: heights alias dimension/* (WIDTH_HEIGHT); paddings alias space/* (GAP) — component tier composes shared primitives' + (sizeBad.length ? ` — ${sizeBad.slice(0, 3).join('; ')}` : ''));

  // (f) opacity — Figma's OPACITY-scoped FLOAT is PERCENT (0–100), not fraction.
  // The adapter multiplies the DTCG 0–1 by 100 (see the comment in buildFigmaDims).
  // Verify each emitted value is a number in [0,100] AND matches DTCG × 100.
  const opBad = dims.opacity.variables.filter((v) => typeof v.value !== 'number' || (v.value as number) < 0 || (v.value as number) > 100);
  ok(opBad.length === 0, `figma opacity: every value is a number in [0,100] (PERCENT for Figma OPACITY scope)` + (opBad.length ? ` — ${opBad.slice(0, 3).map((v) => `${v.name}=${v.value}`).join(', ')}` : ''));
  const opMismatch: string[] = [];
  for (const v of dims.opacity.variables) {
    const key = v.name.split('/')[1];
    const dtcg = brand.opacity[key]?.$value as number;
    if (Math.abs((v.value as number) - Math.round(dtcg * 100)) > 0) opMismatch.push(`${v.name}: ${v.value} ≠ ${Math.round(dtcg * 100)} (DTCG ${dtcg} × 100)`);
  }
  ok(opMismatch.length === 0, `figma opacity: every emitted value = DTCG fraction × 100` + (opMismatch.length ? ` — ${opMismatch.slice(0, 3).join(', ')}` : ''));

  // (g) focus does NOT include the strokeStyle leaf (no Figma variable primitive
  // for strokeStyle — 'solid' stays a code-side literal).
  const hasStrokeStyle = dims.focus.variables.some((v) => v.name === 'focus/ring/style');
  ok(!hasStrokeStyle, `figma focus: strokeStyle leaf skipped (no Figma primitive for strokeStyle; the 'solid' literal stays code-side)`);

  // (h) Every dims var carries a non-empty description from the DTCG tree — the
  // source-of-truth prose lands in Figma's Variables-panel sidebar (namespace
  // stays out of the variable name per §3, but the DTCG `nbds.space.100 — 8px
  // (1× 8px base)` prose is visible on hover).
  const emptyDescs: string[] = [];
  for (const c of allDimColls) for (const v of c.variables) {
    if (!v.description || v.description.length === 0) emptyDescs.push(`${c.$collection}:${v.name}`);
  }
  ok(emptyDescs.length === 0, 'figma dims: every variable carries the DTCG $description (namespace-stripped names + rich prose in the Variables sidebar)' + (emptyDescs.length ? ` — ${emptyDescs.slice(0, 3).join(', ')}` : ''));
}
// (14) EMIT-FIGMA SHADOW + GRADIENT (docs/10 §7 item 3) — styles, not variables.
// Figma Effect Styles + Paint Styles ride the Plugin API (docs/08 §5). Shadow
// is mode-aware via two style sets (light + dark); gradient is opt-in per brand.
// No fixtures for this axis either — gate structurally + verify the aurora
// (opt-in) path emits non-empty gradient styles.
{
  const nb = nbTheme();
  const { tree: nbTree } = buildTree(nb);
  const nbRoot = Object.keys(nbTree)[0];
  const nbShadowKeys = Object.keys(nbTree[nbRoot].shadow ?? {});
  const shadows = buildFigmaShadow(nb);

  // (a) One style per shadow step, TWO SETS (light + dark). NB ships 7 steps
  // (xs..2xl + inset) × 2 modes = 14 styles.
  ok(shadows.styles.length === nbShadowKeys.length * 2, `figma shadow: emits N×2 styles for N shadow steps (light + dark mode sets) — expected ${nbShadowKeys.length * 2}, got ${shadows.styles.length}`);

  // (b) Names split cleanly by prefix.
  const lightNames = shadows.styles.filter((s) => s.name.startsWith('shadow/')).map((s) => s.name);
  const darkNames = shadows.styles.filter((s) => s.name.startsWith('shadow-dark/')).map((s) => s.name);
  ok(lightNames.length === nbShadowKeys.length && darkNames.length === nbShadowKeys.length, `figma shadow: N light styles ('shadow/*') + N dark styles ('shadow-dark/*') — got ${lightNames.length}L / ${darkNames.length}D`);

  // (c) Every effect layer has color + offset + radius + spread + type +
  // blendMode. Colours have {r,g,b,a} in [0,1].
  const badEffect: string[] = [], badColor: string[] = [];
  for (const s of shadows.styles) for (const e of s.effects) {
    if (!e.type || !e.offset || typeof e.radius !== 'number' || typeof e.spread !== 'number' || !e.color || e.blendMode !== 'NORMAL') badEffect.push(`${s.name}: missing fields`);
    for (const ch of ['r', 'g', 'b', 'a'] as const) {
      const v = (e.color as any)[ch];
      if (typeof v !== 'number' || v < 0 || v > 1) badColor.push(`${s.name}: color.${ch}=${v}`);
    }
  }
  ok(badEffect.length === 0, 'figma shadow: every effect has type/offset/radius/spread/color/blendMode' + (badEffect.length ? ` — ${badEffect.slice(0, 3).join('; ')}` : ''));
  ok(badColor.length === 0, 'figma shadow: every colour channel is in [0,1] (Figma float32)' + (badColor.length ? ` — ${badColor.slice(0, 3).join('; ')}` : ''));

  // (d) The `inset` shadow uses INNER_SHADOW; the rest DROP_SHADOW.
  const insetStyle = shadows.styles.find((s) => s.name === 'shadow/inset');
  const dropStyle = shadows.styles.find((s) => s.name === 'shadow/xs' || s.name === 'shadow/sm');
  ok(!!insetStyle && insetStyle.effects.every((e) => e.type === 'INNER_SHADOW'), `figma shadow: 'shadow/inset' uses INNER_SHADOW`);
  ok(!!dropStyle && dropStyle.effects.every((e) => e.type === 'DROP_SHADOW'), `figma shadow: elevation steps use DROP_SHADOW`);

  // (e) Dark alphas are LOWER than light (reduced — the surface-lift pattern).
  // Cross-check the same step in shadow/xs vs shadow-dark/xs.
  const lightXs = shadows.styles.find((s) => s.name === 'shadow/xs');
  const darkXs = shadows.styles.find((s) => s.name === 'shadow-dark/xs');
  const lightAlpha = lightXs?.effects[0].color.a ?? 0;
  const darkAlpha = darkXs?.effects[0].color.a ?? 0;
  ok(darkAlpha > 0 && darkAlpha < lightAlpha, `figma shadow: dark shadow is REDUCED vs light (surface-lift; dark ${darkAlpha.toFixed(3)} < light ${lightAlpha.toFixed(3)})`);

  // (f) Descriptions carry the DTCG prose + mode annotation.
  const badDesc = shadows.styles.filter((s) => !s.description || (!s.description.includes('light mode') && !s.description.includes('dark mode')));
  ok(badDesc.length === 0, 'figma shadow: every style description names its mode (light/dark)' + (badDesc.length ? ` — ${badDesc.slice(0, 3).map((s) => s.name).join(', ')}` : ''));

  // (g) GRADIENT — NB opts out → 0 styles emitted (empty file, consistent shape).
  const nbGradient = buildFigmaGradient(nb);
  ok(nbGradient.styles.length === 0, 'figma gradient: NB has no gradients — emits empty styles[] (consistent shape across brands)');
  ok(nbGradient.$collection === 'gradient-styles', `figma gradient: collection name 'gradient-styles' even when empty`);

  // (h) Aurora opts in → 2 gradients (brand + glow). Every stop's alias
  // resolves to a real palette leaf via the tree.
  const aurora = brandTheme(exampleBrands()['aurora'] as BrandInput);
  const { tree: auroraTree } = buildTree(aurora);
  const auroraGradient = buildFigmaGradient(aurora);
  ok(auroraGradient.styles.length > 0, `figma gradient (aurora): opt-in brand emits gradients — got ${auroraGradient.styles.length}`);

  const paintBad: string[] = [];
  for (const s of auroraGradient.styles) {
    if (!['GRADIENT_LINEAR', 'GRADIENT_RADIAL'].includes(s.paintType)) paintBad.push(`${s.name}: paintType=${s.paintType}`);
    if (!s.stops || s.stops.length < 2) paintBad.push(`${s.name}: <2 stops`);
    if (!s.sampledStops || s.sampledStops.length < 3) paintBad.push(`${s.name}: sampledStops<3`);
  }
  ok(paintBad.length === 0, 'figma gradient (aurora): every style has paintType + stops≥2 + sampledStops≥3 (OKLCH pre-sample)' + (paintBad.length ? ` — ${paintBad.slice(0, 3).join('; ')}` : ''));

  const aliasBad: string[] = [];
  for (const s of auroraGradient.styles) for (const stop of s.stops) {
    if (!stop.alias) { aliasBad.push(`${s.name}: stop@${stop.position} has no alias`); continue; }
    // Resolve `palette/primary/600` → the DTCG path `<root>.palette.primary.600` → leaf must exist.
    const path = `${Object.keys(auroraTree)[0]}.${stop.alias.replace(/\//g, '.')}`;
    const leaf = path.split('.').reduce((n: any, seg) => n?.[seg], auroraTree);
    if (!leaf || leaf.$type !== 'color') aliasBad.push(`${s.name}: alias ${stop.alias} does not resolve`);
  }
  ok(aliasBad.length === 0, 'figma gradient (aurora): every stop alias resolves to a real palette colour leaf' + (aliasBad.length ? ` — ${aliasBad.slice(0, 3).join('; ')}` : ''));

  // (i) a11y worst-case ratios ride alongside so plugins can flag text-on-gradient risks.
  const noA11y = auroraGradient.styles.filter((s) => !s.a11y || typeof s.a11y.worstOnWhite !== 'number');
  ok(noA11y.length === 0, `figma gradient (aurora): every style carries a11y.worstOnWhite / worstOnBlack — the text-on-gradient contract`);
}

// (15) NAMESPACE (docs/00 "Namespace") — `root` is the single, customizable, mode-
// invariant token namespace. Default is the 'prism' placeholder; a custom root re-homes
// EVERY token under `<root>.*` with no 'prism' leaking into any alias (the gradient-stop
// hardcode class of bug). One segment only — a dotted/spaced root is rejected.
{
  const { input } = parseDesignMd(readFileSync(resolve(HERE, '../examples/aurora.design.md'), 'utf8'));

  // default: no root → the 'prism' placeholder, byte-identical world (asserted in block 3)
  const def = brandTheme(input);
  ok(def.root === 'prism' && def.namespace === 'prism.palette', 'namespace: omitted root defaults to the prism placeholder');
  ok(Object.keys(buildTree(def).tree)[0] === 'prism', 'namespace: default tree is rooted at prism');

  // custom: re-home under 'acme'
  const custom = brandTheme({ ...input, root: 'acme' });
  ok(custom.root === 'acme' && custom.namespace === 'acme.palette', 'namespace: custom root sets root + <root>.palette');
  const ctree = buildTree(custom).tree;
  ok(Object.keys(ctree)[0] === 'acme' && !('prism' in ctree), 'namespace: custom tree is rooted at acme, no prism key');

  // the load-bearing assertion: every alias in the tree re-homes to {acme.…} — nothing
  // keeps a {prism.…} target (walks composite $values: typography/gradient/shadow/motion).
  const aliases: string[] = [];
  const walk = (n: any): void => {
    if (typeof n === 'string') { if (/^\{[^}]+\}$/.test(n)) aliases.push(n); return; }
    if (Array.isArray(n)) { n.forEach(walk); return; }
    if (n && typeof n === 'object') { for (const v of Object.values(n)) walk(v); }
  };
  walk(ctree.acme);
  const leaked = aliases.filter((a) => !a.startsWith('{acme.'));
  ok(aliases.length > 0 && leaked.length === 0, `namespace: every alias re-homes to {acme.…} (${aliases.length} aliases)` + (leaked.length ? ` — LEAKED ${leaked.slice(0, 3).join(', ')}` : ''));

  // one segment only — a dotted or spaced root is rejected at the engine boundary
  let threw = false;
  try { brandTheme({ ...input, root: 'ac.me' }); } catch { threw = true; }
  ok(threw, 'namespace: a two-segment (dotted) root throws');

  // schema half agrees: accepts a clean root, rejects a dotted one
  ok(validateBrandInput({ ...input, root: 'acme' }).length === 0, 'namespace: schema accepts a single-segment root');
  ok(validateBrandInput({ ...input, root: 'ac.me' }).length > 0, 'namespace: schema rejects a dotted root');
}

// (16) PIN-A-NEUTRAL (docs/00 "pin-a-neutral") — a brand that ships a pre-defined grey sets
// `neutral.anchor`; the ramp is then built AROUND it (pinned verbatim at its lightness step,
// same mechanism as the brand palettes) instead of derived from the hue/chroma cast. Verifies
// the pinned grey is reproduced, the derived ramp genuinely differs, it reaches the DTCG tree,
// and the schema accepts it.
{
  const { input } = parseDesignMd(readFileSync(resolve(HERE, '../examples/aurora.design.md'), 'utf8'));
  const grey = { l: 0.55, c: 0.006, h: 70 };           // a warm grey, hue ≠ aurora's neutral cast (285)
  const placed = autoPlaceStep(grey.l);

  const pinnedTheme = brandTheme({ ...input, neutral: { ...input.neutral, anchor: grey } });
  const derivedTheme = brandTheme(input);
  const pinnedStep = pinnedTheme.palettes.find((p) => p.palette === 'neutral')!.steps.find((s) => s.num === placed)!;
  const derivedStep = derivedTheme.palettes.find((p) => p.palette === 'neutral')!.steps.find((s) => s.num === placed)!;

  ok(deltaE2000(pinnedStep.rgb, oklchToRgb(grey)) < 1, `pin-a-neutral: the pinned grey is reproduced at neutral.${placed} (ΔE ${deltaE2000(pinnedStep.rgb, oklchToRgb(grey)).toFixed(2)})`);
  ok(deltaE2000(derivedStep.rgb, oklchToRgb(grey)) > 1, 'pin-a-neutral: the derived ramp genuinely differs (pin actually re-homes the ramp)');

  // reaches the DTCG tree: the pinned hex lands at that step under <root>.palette.neutral
  const ntree = buildTree(pinnedTheme).tree as any;
  ok(ntree.prism.palette.neutral[pinnedStep.key].$value === pinnedStep.hex, 'pin-a-neutral: the pinned grey flows through to the DTCG neutral primitive');

  // schema accepts a pinned neutral
  ok(validateBrandInput({ ...input, neutral: { ...input.neutral, anchor: grey } }).length === 0, 'pin-a-neutral: schema accepts neutral.anchor');
}

// (17) DESIGN.MD ROUND-TRIP (docs/07 §6) — `toDesignMd` is the inverse of `parseDesignMd`:
// serialize a BrandInput to frontmatter, parse it back, and get the SAME input. Guards the
// export leg (the web download) against drift from the parser. Key order is ignored (stable
// deep-compare); only defined keys are emitted so an omitted optional stays omitted.
{
  const stable = (v: any): any => Array.isArray(v) ? v.map(stable)
    : (v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, stable(v[k])])) : v);
  const same = (a: any, b: any) => JSON.stringify(stable(a)) === JSON.stringify(stable(b));

  for (const name of ['aurora', 'harbor']) {
    const { input } = parseDesignMd(readFileSync(resolve(HERE, `../examples/${name}.design.md`), 'utf8'));
    ok(same(parseDesignMd(toDesignMd(input)).input, input), `design.md round-trip: toDesignMd→parseDesignMd is identity for ${name}`);
  }

  // a synthetic brand exercising the optional/nested surface: custom root, neutral.anchor,
  // brandColors (array of mappings), actionPalette.
  const synth: any = {
    id: 'synth', root: 'acme', primary: { l: 0.5, c: 0.15, h: 30 },
    neutral: { hue: 30, chroma: 0.006, anchor: { l: 0.5, c: 0.006, h: 30 } },
    brandColors: [{ name: 'accent', oklch: { l: 0.6, c: 0.12, h: 200 } }], actionPalette: 'accent',
  };
  ok(same(parseDesignMd(toDesignMd(synth)).input, synth), 'design.md round-trip: identity for root + neutral.anchor + brandColors + actionPalette');

  // an omitted optional stays omitted (no phantom `root`), and prose survives the fence
  const minimal: any = { id: 'x', primary: { l: 0.5, c: 0.1, h: 200 }, neutral: { hue: 200, chroma: 0.006 } };
  ok(!('root' in parseDesignMd(toDesignMd(minimal)).input), 'design.md round-trip: an omitted optional is not emitted');
  ok(parseDesignMd(toDesignMd(minimal as any, 'Hello prose.')).prose === 'Hello prose.', 'design.md round-trip: prose survives the fence');
}

// (18) MODE CONFIG (docs/11 Pillar 1) — light is the required base; dark/HC are opt-in.
// Omitted → all four (back-compat, byte-identical golden in block 3). A light-only brand
// resolves + emits ONE mode with no per-mode colour overrides; light+dark carries the dark
// override but not HC. Guards: must include light; an unknown mode (wireframe not yet real).
{
  const { input } = parseDesignMd(readFileSync(resolve(HERE, '../examples/aurora.design.md'), 'utf8'));

  const def = brandTheme(input);
  ok(def.modes.length === 4 && resolvePreview(def).modes.length === 4, 'mode config: omitted modes → all four');

  const lo = brandTheme({ ...input, modes: ['light'] });
  const loRp = resolvePreview(lo);
  ok(loRp.modes.length === 1 && loRp.modes[0] === 'light', 'mode config: modes:[light] → light only');
  const loLeaf = (buildTree(lo).tree as any).prism.color.action.default;
  ok(Object.keys(loLeaf.$extensions.prism3.modes).length === 0, 'mode config: light-only tree emits no per-mode colour overrides');

  const ld = brandTheme({ ...input, modes: ['light', 'dark'] });
  ok(resolvePreview(ld).modes.length === 2, 'mode config: modes:[light,dark] → two modes');
  const ldLeaf = (buildTree(ld).tree as any).prism.color.action.default;
  ok('dark' in ldLeaf.$extensions.prism3.modes && !('hc-light' in ldLeaf.$extensions.prism3.modes), 'mode config: [light,dark] carries the dark override, not HC');

  let t1 = false, t2 = false;
  try { brandTheme({ ...input, modes: ['dark'] as any }); } catch { t1 = true; }
  try { brandTheme({ ...input, modes: ['light', 'wireframe'] as any }); } catch { t2 = true; }
  ok(t1, 'mode config: modes without light throws');
  ok(t2, 'mode config: an unknown mode (wireframe, not yet real) throws');

  ok(validateBrandInput({ ...input, modes: ['light', 'dark'] }).length === 0, 'mode config: schema accepts a valid modes subset');
  ok(validateBrandInput({ ...input, modes: ['light', 'bogus'] }).length > 0, 'mode config: schema rejects an unknown mode');
}

// ------------------------------------------------------------------- report
console.log(`\nPrism3 engine tests: ${pass} passed, ${fails.length} failed`);
if (fails.length) { fails.forEach((f) => console.log(`  ❌ ${f}`)); process.exitCode = 1; }
else console.log('  ✓ colour math + extreme-brand contracts all hold');
