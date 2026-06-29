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
import { rgbToOklch, oklchToRgb, hex, contrast, luminance, maxChroma, inGamut, deltaE2000, RGB } from './color';
import { generateRamp, autoPlaceStep, STEP_NUMS } from './ramp';
import { brandTheme, nbTheme, BrandInput } from './theme';
import { resolveAllModes } from './modes';

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
  ok(comps.length >= 12 && comps.length <= 25, `[type/${label}] composite count ${comps.length} in 12..25`);
  let bad = '', dup = '', mono = '';
  const byGroup: Record<string, number[]> = {};
  for (const c of comps) {
    (byGroup[c.group] ??= []).push(c.sizePx);
    if (!ladder.has(c.sizePx)) bad ||= `${c.path} off-ladder ${c.sizePx}`;
    if (!FAM.has(c.family)) bad ||= `${c.path} bad family ${c.family}`;
    if (!wr.has(c.weightRole)) bad ||= `${c.path} bad weight ${c.weightRole}`;
    if (!lh.has(c.lineHeight)) bad ||= `${c.path} bad line-height ${c.lineHeight}`;
    if (!ls.has(c.tracking)) bad ||= `${c.path} bad tracking ${c.tracking}`;
  }
  for (const [g, sizes] of Object.entries(byGroup)) {
    const seen = new Set<number>();
    for (const s of sizes) { if (seen.has(s)) dup ||= `${g}:${s}`; seen.add(s); }
    for (let i = 1; i < sizes.length; i++) if (sizes[i] <= sizes[i - 1]) mono ||= `${g}:${sizes[i - 1]}->${sizes[i]}`;
  }
  ok(!bad, `[type/${label}] all composite refs resolve${bad ? ` — ${bad}` : ''}`);
  ok(!dup, `[type/${label}] no duplicate size within a group${dup ? ` — ${dup}` : ''}`);
  ok(!mono, `[type/${label}] sizes monotonic within group${mono ? ` — ${mono}` : ''}`);
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
ok(!tBrand('tf-d', {}).typography.composites.some((c) => c.path === 'title.2xs'), 'titleFloor default 18 → no title.2xs');
// C1: titleFloor 16 delivers a LITERAL 16px title.2xs under EVERY typeScale (pinned, exempt from the shift).
for (const scale of ['compact', 'default', 'expressive'] as const) {
  const c = tBrand('tf16-' + scale, { titleFloor: 16, typeScale: scale }).typography.composites.find((x) => x.path === 'title.2xs');
  ok(!!c && c.sizePx === 16, `titleFloor 16 + ${scale} → title.2xs pinned at 16px (got ${c?.sizePx})`);
}
ok(tBrand('dc', { displayCeiling: 96 }).typography.composites.filter((c) => c.group === 'display').every((c) => c.sizePx <= 96), 'displayCeiling 96 → no display composite above 96px');
ok(tBrand('eb', {}).typography.composites.find((c) => c.group === 'eyebrow')?.textCase === 'uppercase', 'eyebrow carries uppercase textCase');

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
  ok(def[0].stops.length === 2 && def[0].stops[0].aliasOf === 'prism.color.primary.600' && def[0].stops[1].aliasOf === 'prism.color.primary.350', 'default gradient stops alias primary.600 → primary.350');
  // explicit array: linear + radial, cross-palette, stop colours alias the ramp.
  const ex = grBrand('gr-ex', [
    { name: 'brand', kind: 'linear', angle: 135, stops: [{ palette: 'primary', step: 600, position: 0 }, { palette: 'accent', step: 500, position: 1 }] },
    { name: 'glow', kind: 'radial', center: [0.5, 0.4], shape: 'circle', stops: [{ palette: 'accent', step: 400, position: 0 }, { palette: 'accent', step: 700, position: 1 }] },
  ]).gradient.gradients;
  ok(ex.length === 2 && ex[0].kind === 'linear' && ex[1].kind === 'radial', 'explicit array → both linear + radial kinds');
  ok(ex.every((g) => g.stops.every((s) => s.aliasOf.startsWith('prism.color.'))), 'every gradient stop aliases the colour ramp (never raw hex)');
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

// ------------------------------------------------------------------- report
console.log(`\nPrism3 engine tests: ${pass} passed, ${fails.length} failed`);
if (fails.length) { fails.forEach((f) => console.log(`  ❌ ${f}`)); process.exitCode = 1; }
else console.log('  ✓ colour math + extreme-brand contracts all hold');
