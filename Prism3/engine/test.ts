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

// ------------------------------------------------------------------- report
console.log(`\nPrism3 engine tests: ${pass} passed, ${fails.length} failed`);
if (fails.length) { fails.forEach((f) => console.log(`  ❌ ${f}`)); process.exitCode = 1; }
else console.log('  ✓ colour math + extreme-brand contracts all hold');
