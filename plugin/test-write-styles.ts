/**
 * Plugin STYLES write-adapter test (shadow/gradient lane) — drives the REAL `applyStylesPlan`
 * executor against an in-memory `StylesApi` shim, so the Effect/Paint style write is verified with no
 * live Figma.
 *
 *   npx tsx plugin/test-write-styles.ts
 *
 * The shim models Figma's style API: `createEffectStyle`/`createPaintStyle` mint a mutable style node
 * with `name`/`description`/`effects`|`paints`; `getLocalEffectStylesAsync`/`getLocalPaintStylesAsync`
 * return them. Asserts: both shadow sets (`shadow/*` + `shadow-dark/*`) materialise as Effect Styles;
 * aurora's gradients materialise as Paint Styles carrying a GRADIENT_* paint + a gradientTransform +
 * baked stops; re-apply is idempotent (+0 created, no duplicate styles). Mirrors the other shim tests.
 */
import { buildStylesPlan } from '../Prism3/engine/write-plan';
import { brandTheme } from '../Prism3/engine/theme';
import { applyStylesPlan } from './src/write-styles';
import exampleBrands from '../Prism3/schema/example-brands.json';
import type { BrandInput } from '../Prism3/engine/theme';

let failed = 0;
const ok = (cond: boolean, label: string): void => {
  if (cond) console.log(`  ✓ ${label}`);
  else { failed++; console.error(`  ✗ ${label}`); }
};

// ---- the in-memory styles shim ------------------------------------------------------------
class ShimStyle {
  description = '';
  effects: readonly unknown[] = [];
  paints: readonly unknown[] = [];
  constructor(public name = '') {}
}
class StylesShim {
  effectStyles: ShimStyle[] = [];
  paintStyles: ShimStyle[] = [];
  async getLocalEffectStylesAsync(): Promise<ShimStyle[]> { return this.effectStyles; }
  async getLocalPaintStylesAsync(): Promise<ShimStyle[]> { return this.paintStyles; }
  createEffectStyle(): ShimStyle { const s = new ShimStyle(); this.effectStyles.push(s); return s; }
  createPaintStyle(): ShimStyle { const s = new ShimStyle(); this.paintStyles.push(s); return s; }
}

// ---- drive it: aurora (shadows + 2 gradients) ---------------------------------------------
const plan = buildStylesPlan(brandTheme(exampleBrands['aurora'] as unknown as BrandInput));
const shim = new StylesShim();
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- structural: the shim satisfies StylesApi
const run = () => applyStylesPlan(plan, shim as any);

const r1 = await run();
const effectsAfterFirst = shim.effectStyles.length;
const paintsAfterFirst = shim.paintStyles.length;
const r2 = await run();

console.log('plugin STYLES write-adapter (shadow/gradient) — executor against in-memory shim\n');

// first run creates all; second is idempotent
ok(r1.effects.created === plan.effects.length && r1.paints.created === plan.paints.length,
  `first run creates all styles (effects ${r1.effects.created}/${plan.effects.length}, paints ${r1.paints.created}/${plan.paints.length})`);
ok(r2.effects.created === 0 && r2.paints.created === 0, `second run creates 0 (idempotent): effects +${r2.effects.created}, paints +${r2.paints.created}`);
ok(shim.effectStyles.length === effectsAfterFirst && shim.paintStyles.length === paintsAfterFirst,
  `no duplicate styles across re-run (${shim.effectStyles.length} effects / ${shim.paintStyles.length} paints, stable)`);

// both shadow sets present as Effect Styles
const effectNames = shim.effectStyles.map((s) => s.name);
ok(effectNames.some((n) => n.startsWith('shadow/')) && effectNames.some((n) => n.startsWith('shadow-dark/')),
  'both shadow sets materialise as Effect Styles (shadow/* + shadow-dark/*)');
ok(shim.effectStyles.every((s) => Array.isArray(s.effects) && s.effects.length > 0), 'every Effect Style carries ≥1 effect');

// gradients as Paint Styles with a GradientPaint (paintType + transform + baked stops)
ok(shim.paintStyles.length === plan.paints.length && shim.paintStyles.length > 0, `aurora gradients materialise as Paint Styles (${shim.paintStyles.length})`);
const paintBad: string[] = [];
for (const s of shim.paintStyles) {
  const paints = s.paints as any[];
  if (paints.length !== 1) { paintBad.push(`${s.name}: not exactly 1 paint`); continue; }
  const p = paints[0];
  if (!['GRADIENT_LINEAR', 'GRADIENT_RADIAL'].includes(p.type)) paintBad.push(`${s.name}: type=${p.type}`);
  if (!Array.isArray(p.gradientStops) || p.gradientStops.length < 2) paintBad.push(`${s.name}: <2 stops`);
  if (!Array.isArray(p.gradientTransform) || p.gradientTransform.length !== 2) paintBad.push(`${s.name}: bad transform`);
  if (!p.gradientStops.every((st: any) => st.color && [st.color.r, st.color.g, st.color.b, st.color.a].every((c: number) => c >= 0 && c <= 1))) paintBad.push(`${s.name}: stop RGBA out of gamut`);
}
ok(paintBad.length === 0, 'each Paint Style holds one GRADIENT_* paint + transform + baked in-gamut stops' + (paintBad.length ? ` — ${paintBad.slice(0, 3).join('; ')}` : ''));

// ---- light-only brand: no shadow-dark Effect Styles --------------------------------------
const lightPlan = buildStylesPlan(brandTheme({ ...(exampleBrands['aurora'] as unknown as BrandInput), modes: ['light'] }));
const lightShim = new StylesShim();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
await applyStylesPlan(lightPlan, lightShim as any);
ok(lightShim.effectStyles.some((s) => s.name.startsWith('shadow/')) && !lightShim.effectStyles.some((s) => s.name.startsWith('shadow-dark/')),
  'light-only brand: shadow/* Effect Styles but NO shadow-dark/*');

console.log(`\nplugin STYLES write-adapter: ${failed === 0 ? 'ALL PASS' : failed + ' FAILED'}`);
if (failed) process.exit(1);
