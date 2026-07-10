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
import { rgbToOklch, oklchToRgb, hex, hexToRgb, contrast, luminance, maxChroma, inGamut, deltaE2000, dualContrastWindow, RGB } from './color';
import { generateRamp, autoPlaceStep, STEP_NUMS } from './ramp';
import { radiusScale } from './scale';
import { at, deref, pxOf, buildTree } from './tree';
import { brandTheme, BrandInput, inRedTerritory } from './theme';
import { nbTheme } from './nb-fixture';
import { resolveAllModes } from './modes';
import { parseDesignMd, parseYamlSubset, toDesignMd } from './design-md';
import { parseStandardDesignMd, standardToBrandInput, applyXPrism3 } from './standard-design-md';
import { classifyColors } from './classify-colors';
import { leverManifest, leverGroups, buildLeverManifest, identityFields } from './levers';
import { previewSpec, previewTokenRefs, buildPreviewSpec } from './preview';
import { resolvePreview } from './resolve-preview';
import { exampleBrands, exampleBrandsJson, EXAMPLE_IDS } from './emit-brandinput';
import { buildFigmaColor, buildFigmaFont, buildFigmaFontFluid, buildFigmaTextStyles, buildFigmaDims, buildFigmaLayout, buildFigmaShadow, buildFigmaGradient, fontStyleName, figName, parseColor, COLOR_MODES, FONT_FLUID_MODES, LAYOUT_MODES } from './emit-figma';
import { buildTree, validateBrandInput } from './emit-dtcg';
import { buildAiMetadata } from './ai-metadata';
import { handleRpc, callTool, toolDefs } from './mcp';
import { scoreConsumption, scoreContractCompliance, tokenPaths, normalizeRef, isPrimitiveRef, PRIMITIVE_TIERS } from './eval';
import { runEval, buildPrompt, extractRefs, extractPairs, SAMPLE_TASKS } from './eval-run';
import { aliasRows } from './materialise-to-figma';
import { validateComponentDef, ComponentDef } from './component-schema';
import { button } from './components/button';
import { iconButton } from './components/icon-button';
import { fieldLabel } from './components/field-label';
import { fieldMessage } from './components/field-message';
import { textField } from './components/text-field';
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
// CR-01 regression: contrast() must return the RAW ratio so a pass/fail test is WCAG-correct.
// #007ea1 on black measures 4.4990 — it must read BELOW 4.5 (a genuine AA fail), not round up
// to a false pass. Guards against re-introducing a round() inside contrast().
{
  const marginal = contrast(hexToRgb('#007ea1'), BLACK);
  ok(marginal < 4.5 && marginal > 4.49, `contrast() raw: #007ea1/black = ${marginal.toFixed(5)} < 4.5 (no round-up false AA pass)`);
  ok(marginal !== Math.round(marginal * 100) / 100, 'contrast() returns un-rounded ratio (not pre-rounded to 2dp)');
}

// M-13: hexToRgb accepts 8-digit alpha hex (`#RRGGBBAA`, common in real extractions) and 4-digit
// `#RGBA` by dropping the alpha (anchors are opaque) — a trailing FF must not read as "invalid
// hex" and crash the standard-dialect CLI. Genuinely malformed hex is still rejected.
{
  ok(hex(hexToRgb('#C8102EFF')) === '#c8102e', 'M-13: 8-digit alpha hex drops the alpha (#C8102EFF → #c8102e)');
  ok(hex(hexToRgb('#c8102e88')) === '#c8102e', 'M-13: a non-FF alpha is dropped to the opaque colour');
  ok(hex(hexToRgb('#f008')) === '#ff0000', 'M-13: 4-digit #RGBA expands + drops alpha');
  let bad = false; try { hexToRgb('#12345'); } catch { bad = true; }
  ok(bad, 'M-13: a malformed (5-digit) hex is still rejected');
}

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

  // M-01: every ramp step must be a well-formed #rrggbb — a degenerate anchor L (== lMax/lMin)
  // used to divide by zero in the chroma arc → `#NaNNaNNaN`. Cover normal + extreme-L anchors.
  const hexOk = (r: ReturnType<typeof generateRamp>) => r.every((s) => /^#[0-9a-f]{6}$/.test(s.hex));
  ok(hexOk(ramp), 'M-01: normal ramp emits only #rrggbb hex');
  ok(hexOk(generateRamp({ hue: 285, chroma: 0.18, anchor: { oklch: { l: 0.975, c: 0.1, h: 285 }, stepNum: 500 } })), 'M-01: anchor L at lMax (mismatched step) — no NaN hex');
  ok(hexOk(generateRamp({ hue: 285, chroma: 0.18, anchor: { oklch: { l: 0.16, c: 0.05, h: 285 }, stepNum: 500 } })), 'M-01: anchor L at lMin (mismatched step) — no NaN hex');
  ok(hexOk(generateRamp({ hue: 145, chroma: 0.3, peakL: 0.9 })), 'M-01: unanchored vivid arc — no NaN hex');

  // M-02: a pinned anchor whose lightness disagrees with its step position used to leave the
  // ramp non-monotonic (a later step lighter than an earlier one — mode pickers misread it).
  // Now it throws; a consistent anchor stays strictly light→dark.
  const monotonic = (r: ReturnType<typeof generateRamp>) => r.every((s, i) => i === 0 || s.oklch.l <= r[i - 1].oklch.l + 1e-9);
  ok(monotonic(ramp), 'M-02: a consistent ramp is monotonic non-increasing in L');
  let m2 = false;
  try { generateRamp({ hue: 285, chroma: 0.18, anchor: { oklch: { l: 0.985, c: 0.1, h: 285 }, stepNum: 50 } }); } catch { m2 = true; }
  ok(m2, 'M-02: an anchor L that inverts the light→dark order throws (not a silent broken ramp)');

  // M-03: an out-of-gamut anchor can't render exactly; the independent-channel clamp silently
  // shifts L AND hue. The rendered colour genuinely drifts (the old anchor-ΔE gate compared two
  // identically-clipped values → tautologically ~0, blind to this), and brandTheme now SURFACES
  // it in the decisions log instead of shipping a quietly-shifted brand colour.
  const oog = { l: 0.55, c: 0.32, h: 145 };
  const rendered = rgbToOklch(generateRamp({ hue: 145, chroma: 0.2, anchor: { oklch: oog, stepNum: 500 } }).find((s) => s.num === 500)!.rgb);
  ok(Math.abs(rendered.h - oog.h) > 1 || Math.abs(rendered.l - oog.l) > 0.02, 'M-03: an out-of-gamut anchor genuinely drifts in hue/L (the old anchor ΔE gate compared two identically-clipped values — tautological)');
  const mkTheme = (o: { l: number; c: number; h: number }) => brandTheme({ id: 't', primary: { l: 0.6, c: 0.03, h: 200 }, neutral: { hue: 200, chroma: 0.01 }, brandColors: [{ name: 'x', oklch: o }] });
  ok(mkTheme(oog).notes.some((n) => n.includes("anchor 'x'") && n.includes('OUT of sRGB gamut')), 'M-03: brandTheme surfaces an out-of-gamut anchor in the decisions log (not silent)');
  ok(!mkTheme({ l: 0.5, c: 0.04, h: 200 }).notes.some((n) => n.includes('OUT of sRGB gamut')), 'M-03: an all-in-gamut brand produces no gamut warning');
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
    // L-01: stateful groups must stay visually distinct — a `walk` that saturated
    // at a ramp end would collapse hover/pressed onto rest. rest (walk 0)
    // ≠ hover (walk 1) ≠ pressed (walk 2), by path, for every interactive fill + link group.
    const path = (k: string) => (m.roles as any)[k]?.path;
    for (const g of ['interactive.primary', 'interactive.destructive']) {
      const [d, h, p] = [path(`${g}.fill.rest`), path(`${g}.fill.hover`), path(`${g}.fill.pressed`)];
      if (d && h && p) ok(d !== h && d !== p && h !== p, `[${b.id}/${m.mode}] ${g} fill states are distinct (rest/hover/pressed = ${d?.split('.').pop()}/${h?.split('.').pop()}/${p?.split('.').pop()})`);
    }
    const [ld, lh, lv] = [path('text.link.default'), path('text.link.hover'), path('text.link.visited')];
    if (ld && lh && lv) ok(ld !== lh && ld !== lv && lh !== lv, `[${b.id}/${m.mode}] text.link states are distinct`);
  }
}

// nbTheme regression theme also clears every contract
{
  const modes = resolveAllModes(nbTheme());
  const broken = modes.flatMap((m) => Object.entries(m.roles).filter(([, r]) => r.min > 0 && r.ratio < r.min).map(([k]) => `${m.mode}.${k}`));
  ok(broken.length === 0, 'nbTheme all contracts pass' + (broken.length ? ` — FAILED: ${broken.join(', ')}` : ''));
}

// INTERACTIVE COLOUR FAMILY (docs/20) — pin the family's intent where the frozen
// real-NB fixture no longer can: the legacy action.* / foreground.danger.* fills are
// REMOVED (task #14 — components bind interactive.*), the interactive.<color> family has
// the full slot/state shape, the historical neutral miss (§12) is a GATED contract that
// passes in every mode, and the Figma slots carry slot-aware scopes.
{
  const modes = resolveAllModes(nbTheme());
  const light = modes.find((m) => m.mode === 'light')!.roles;

  // (a) the legacy interactive fills are gone — action.* and the stateful foreground.danger.*
  //     no longer generated; danger is now a bare foreground.danger fill (like the others).
  const legacyPresent = [
    ...['default', 'hover', 'pressed', 'focused', 'selected', 'disabled'].map((s) => `action.${s}`),
    ...['default', 'hover', 'pressed', 'focused', 'selected', 'disabled'].map((s) => `foreground.danger.${s}`),
  ].filter((k) => k in light);
  ok(legacyPresent.length === 0, 'interactive: legacy action.* / foreground.danger.* fills removed' + (legacyPresent.length ? ` — STILL PRESENT ${legacyPresent.join(',')}` : ''));
  ok('foreground.danger' in light, 'interactive: danger is a bare foreground.danger fill (stateful/interactive expression is interactive.destructive.*)');

  // (b) interactive.<color> shape — three colours, each fill(+5 states, no per-colour
  //     disabled)/on-fill/text/border. Disabled is the cross-cutting disabled.* family.
  const shapeMissing: string[] = [];
  for (const c of ['primary', 'neutral', 'destructive']) {
    for (const st of ['rest', 'hover', 'pressed', 'focused', 'selected'])
      if (!(`interactive.${c}.fill.${st}` in light)) shapeMissing.push(`interactive.${c}.fill.${st}`);
    for (const slot of ['on-fill', 'text', 'border'])
      if (!(`interactive.${c}.${slot}` in light)) shapeMissing.push(`interactive.${c}.${slot}`);
  }
  ok(shapeMissing.length === 0, 'interactive: primary/neutral/destructive each carry fill(+5 states)/on-fill/text/border' + (shapeMissing.length ? ` — MISSING ${shapeMissing.slice(0, 4).join(',')}` : ''));
  // (b2) per-colour disabled fill is retired — no interactive.<color>.fill.disabled.
  const perColourDisabled = ['primary', 'neutral', 'destructive'].map((c) => `interactive.${c}.fill.disabled`).filter((k) => k in light);
  ok(perColourDisabled.length === 0, 'interactive: per-colour fill.disabled retired (cross-cutting disabled.* instead)' + (perColourDisabled.length ? ` — STILL PRESENT ${perColourDisabled.join(',')}` : ''));

  // (c) neutral fill.rest is a subtle SURFACE (min 0) — the gated pair is its ink, not the fill.
  ok(light['interactive.neutral.fill.rest'].min === 0, 'interactive: neutral.fill.rest is a min-0 subtle surface');

  // (d) the historical neutral MISS (§12) is now a passing gated contract in EVERY mode:
  //     on-fill contrast-verified against fill.rest at onMin (4.5).
  const neutralFails: string[] = [];
  for (const m of modes) {
    const r = m.roles['interactive.neutral.on-fill'];
    if (!r) { neutralFails.push(`${m.mode}:absent`); continue; }
    if (r.min < 4.5) neutralFails.push(`${m.mode}:min=${r.min}`);
    if (r.against !== 'interactive.neutral.fill.rest') neutralFails.push(`${m.mode}:against=${r.against}`);
    if (r.ratio < r.min) neutralFails.push(`${m.mode}:${r.ratio.toFixed(2)}<${r.min}`);
  }
  ok(neutralFails.length === 0, 'interactive: neutral on-fill is a passing gated contract in every mode' + (neutralFails.length ? ` — ${neutralFails.join(',')}` : ''));

  // (e) Figma slots are scoped by SLOT (fill→paint, text→TEXT_FILL, border→STROKE_COLOR).
  const { color } = buildFigmaColor(nbTheme());
  const byName = new Map<string, any>(color.find((c) => c.$mode === 'light')!.variables.map((v: any) => [v.name, v]));
  const scopeOf = (n: string) => JSON.stringify(byName.get(n)?.scopes ?? null);
  const scopeBad: string[] = [];
  if (scopeOf('color/interactive/primary/text') !== JSON.stringify(['TEXT_FILL'])) scopeBad.push('primary/text');
  if (scopeOf('color/interactive/primary/border') !== JSON.stringify(['STROKE_COLOR'])) scopeBad.push('primary/border');
  if (scopeOf('color/interactive/primary/fill/rest') !== JSON.stringify(['FRAME_FILL', 'SHAPE_FILL'])) scopeBad.push('primary/fill/rest');
  ok(scopeBad.length === 0, 'interactive: Figma slots carry slot-aware scopes' + (scopeBad.length ? ` — ${scopeBad.join(',')}` : ''));

  // (e2) disabled.<slot> is also slot-scoped — surface/on-disabled paint, text=TEXT_FILL,
  //     icon=[FRAME,SHAPE,STROKE], border=STROKE. Before this gate, disabled had no entry
  //     in COLOR_SCOPES so the family fell through to fill scopes and inks miscased —
  //     the NB fixture doesn't carry disabled/*, so the round-trip test was the only
  //     signal. This pins all five slots.
  const disabledScopeBad: string[] = [];
  if (scopeOf('color/disabled/fill') !== JSON.stringify(['FRAME_FILL', 'SHAPE_FILL'])) disabledScopeBad.push('disabled/fill');
  if (scopeOf('color/disabled/on-fill') !== JSON.stringify(['FRAME_FILL', 'SHAPE_FILL', 'TEXT_FILL'])) disabledScopeBad.push('disabled/on-fill');
  if (scopeOf('color/disabled/text') !== JSON.stringify(['TEXT_FILL'])) disabledScopeBad.push('disabled/text');
  if (scopeOf('color/disabled/icon') !== JSON.stringify(['FRAME_FILL', 'SHAPE_FILL', 'STROKE_COLOR'])) disabledScopeBad.push('disabled/icon');
  if (scopeOf('color/disabled/border') !== JSON.stringify(['STROKE_COLOR'])) disabledScopeBad.push('disabled/border');
  ok(disabledScopeBad.length === 0, 'disabled: Figma slots carry slot-aware scopes' + (disabledScopeBad.length ? ` — ${disabledScopeBad.join(',')}` : ''));

  // (e3) field.<slot> (docs/20 §17) is slot-scoped too — surface paints, border strokes,
  //      placeholder = TEXT_FILL. Same fall-through risk as disabled if it lacked a branch.
  const fieldScopeBad: string[] = [];
  if (scopeOf('color/field/fill') !== JSON.stringify(['FRAME_FILL', 'SHAPE_FILL'])) fieldScopeBad.push('field/fill');
  if (scopeOf('color/field/border/rest') !== JSON.stringify(['STROKE_COLOR'])) fieldScopeBad.push('field/border/rest');
  if (scopeOf('color/field/border/hover') !== JSON.stringify(['STROKE_COLOR'])) fieldScopeBad.push('field/border/hover');
  if (scopeOf('color/field/placeholder') !== JSON.stringify(['TEXT_FILL'])) fieldScopeBad.push('field/placeholder');
  ok(fieldScopeBad.length === 0, 'field: Figma slots carry slot-aware scopes' + (fieldScopeBad.length ? ` — ${fieldScopeBad.join(',')}` : ''));

  // (f) overlays (docs/20 §6): each colour has hover/pressed/selected washes, mode-adaptive
  //     (black-alpha light / white-alpha dark), and the COMPOSITED result is a gated contract
  //     — text.primary stays ≥ AA on the tinted surface in every mode (the wash-out guard).
  const overlayFails: string[] = [];
  for (const m of modes) {
    const pal = m.mode.includes('dark') ? 'white-alpha' : 'black-alpha';
    for (const c of ['primary', 'neutral', 'destructive'])
      for (const st of ['hover', 'pressed', 'selected']) {
        const r = m.roles[`interactive.${c}.overlay.${st}`];
        if (!r) { overlayFails.push(`${m.mode}:${c}.${st}:absent`); continue; }
        if (r.min < 4.5 || r.ratio < r.min) overlayFails.push(`${m.mode}:${c}.${st}:${r.ratio.toFixed(2)}<${r.min}`);
        if (!r.path.includes(pal)) overlayFails.push(`${m.mode}:${c}.${st}:pal=${r.path}`);
      }
  }
  ok(overlayFails.length === 0, 'interactive: overlays present, mode-adaptive, composited-contrast gated in every mode' + (overlayFails.length ? ` — ${overlayFails.slice(0, 3).join(',')}` : ''));

  // (g) the outlineInteraction lever opts out: 'none' emits NO overlay tokens.
  const noOverlay = resolveAllModes({ ...nbTheme(), outlineInteraction: 'none' })
    .flatMap((m) => Object.keys(m.roles)).filter((k) => k.includes('.overlay.'));
  ok(noOverlay.length === 0, 'interactive: outlineInteraction=none emits no overlays' + (noOverlay.length ? ` — ${noOverlay.slice(0, 2).join(',')}` : ''));
}

// DISABLED — cross-cutting family (docs/20 §7): one treatment regardless of intent,
// present in every mode, with its on-ink gated against the disabled surface.
{
  const modes = resolveAllModes(nbTheme());
  const shapeMissing: string[] = [];
  for (const m of modes)
    for (const k of ['fill', 'on-fill', 'text', 'icon', 'border'])
      if (!(`disabled.${k}` in m.roles)) shapeMissing.push(`${m.mode}:disabled.${k}`);
  ok(shapeMissing.length === 0, 'disabled: surface/on-disabled/text/icon/border in every mode' + (shapeMissing.length ? ` — ${shapeMissing.slice(0, 3).join(',')}` : ''));

  const onFails: string[] = [];
  for (const m of modes) {
    const r = m.roles['disabled.on-fill'];
    if (r.against !== 'disabled.fill') onFails.push(`${m.mode}:against=${r.against}`);
    if (r.min > 0 && r.ratio < r.min) onFails.push(`${m.mode}:${r.ratio.toFixed(2)}<${r.min}`);
  }
  ok(onFails.length === 0, 'disabled: on-disabled is gated against disabled.fill (accessible strategy)' + (onFails.length ? ` — ${onFails.join(',')}` : ''));
}

// FIELD — form-element chrome (docs/20 §17). Minimal + gated: a surface + a PERCEIVABLE resting
// border (≥3:1 vs the page — the Prism2 improvement) + a READABLE placeholder (≥4.5 on the fill).
// Everything stateful composes from other families (focus→border.focus, disabled→disabled.*).
{
  const modes = resolveAllModes(nbTheme());
  const shapeMissing: string[] = [];
  for (const m of modes)
    for (const k of ['fill', 'border.rest', 'border.hover', 'placeholder'])
      if (!(`field.${k}` in m.roles)) shapeMissing.push(`${m.mode}:field.${k}`);
  ok(shapeMissing.length === 0, 'field: fill/border.rest/border.hover/placeholder present in every mode' + (shapeMissing.length ? ` — ${shapeMissing.slice(0, 3).join(',')}` : ''));

  const fails: string[] = [];
  for (const m of modes) {
    const b = m.roles['field.border.rest'], bh = m.roles['field.border.hover'], p = m.roles['field.placeholder'];
    // resting border is a perceivable boundary (SC 1.4.11) vs the page — NOT the sub-3:1 Prism2 shipped.
    if (b.against !== 'background.primary' || b.min < 3 || b.ratio < b.min) fails.push(`${m.mode}:border ${b.ratio.toFixed(2)}<${b.min}@${b.against}`);
    // hover border is a STRONGER boundary than rest (gated ≥4.5), same page ground — a perceptible, not sole, state cue.
    if (bh.against !== 'background.primary' || bh.min < 4.5 || bh.ratio < bh.min || bh.ratio < b.ratio) fails.push(`${m.mode}:border.hover ${bh.ratio.toFixed(2)}<${bh.min}@${bh.against}`);
    // placeholder is readable on the field fill — NOT a sub-AA hint.
    if (p.against !== 'field.fill' || p.min < 4.5 || p.ratio < p.min) fails.push(`${m.mode}:placeholder ${p.ratio.toFixed(2)}<${p.min}@${p.against}`);
  }
  ok(fails.length === 0, 'field: rest border ≥3:1 + hover border ≥4.5 (≥rest) on the page + placeholder ≥4.5 on the fill, every mode' + (fails.length ? ` — ${fails.join(',')}` : ''));
}

// MATERIALISE-TO-FIGMA — the colour aliases MUST bind a distinct target per mode. This locks
// the collapse-proofing into the suite (the #85 round-trip hit a hand-rolled script that bound
// light's target to all four modes → every mode identical). Pure + Figma-free: assert on the
// generated alias rows directly, so the guarantee doesn't rest solely on a manual round-trip.
{
  const { modes, rows } = aliasRows('nb');
  ok(modes.length === 4, `materialise: nb emits 4 colour modes (${modes.join('/')})`);
  ok(rows.length > 0 && rows.every(([, t]) => t.length === modes.length), 'materialise: every alias row carries one target per mode');
  ok(rows.some(([, t]) => new Set(t).size > 1), 'materialise: alias rows carry distinct per-mode targets (collapse-proof — not one target repeated)');
  const bg = rows.find(([n]) => n === 'color/background/primary');
  ok(!!bg && new Set(bg![1]).size > 1, 'materialise: background/primary binds a different palette step per mode (the collapse-guard probe)');
}

// INVERSE + neutralEmphasis + accentPalette (docs/20 §9/§10/§3, increment 4).
{
  // (a) inverse surface-context: interactive.<color>.on-inverse present + gated against the
  //     inverse surface in every mode; the `inverse` lever opts out.
  const modes = resolveAllModes(nbTheme());
  const invFails: string[] = [];
  for (const m of modes)
    for (const c of ['primary', 'neutral', 'destructive']) {
      const r = m.roles[`interactive.${c}.on-inverse`];
      if (!r) { invFails.push(`${m.mode}:${c}:absent`); continue; }
      if (r.against !== 'background.inverse.primary') invFails.push(`${m.mode}:${c}:against=${r.against}`);
      if (r.min > 0 && r.ratio < r.min) invFails.push(`${m.mode}:${c}:${r.ratio.toFixed(2)}<${r.min}`);
    }
  ok(invFails.length === 0, 'inverse: interactive.<color>.on-inverse gated on the inverse surface in every mode' + (invFails.length ? ` — ${invFails.slice(0, 3).join(',')}` : ''));
  const noInv = resolveAllModes({ ...nbTheme(), inverseContext: false })
    .flatMap((m) => Object.keys(m.roles)).filter((k) => k.startsWith('interactive.') && k.endsWith('.on-inverse'));
  ok(noInv.length === 0, 'inverse: inverse=false emits no on-inverse inks' + (noInv.length ? ` — ${noInv.slice(0, 2).join(',')}` : ''));

  // (b) neutralEmphasis 'strong' → a bold neutral fill that clears the non-text floor, on-fill still gated.
  const strong = resolveAllModes({ ...nbTheme(), neutralEmphasis: 'strong' });
  const strongFails = strong.flatMap((m) => {
    const fill = m.roles['interactive.neutral.fill.rest'], on = m.roles['interactive.neutral.on-fill'];
    const bad: string[] = [];
    if (!(fill.min >= 3) || fill.ratio < fill.min) bad.push(`${m.mode}:fill ${fill.ratio.toFixed(2)}<${fill.min}`);
    if (on.ratio < on.min) bad.push(`${m.mode}:on ${on.ratio.toFixed(2)}<${on.min}`);
    return bad;
  });
  ok(strongFails.length === 0, 'neutralEmphasis: strong gives a floor-clearing neutral fill with a gated on-ink' + (strongFails.length ? ` — ${strongFails.slice(0, 2).join(',')}` : ''));

  // (c) accentPalette: opt-in → a full interactive.accent.* column, all contracts hold; absent by default.
  const noAccent = resolveAllModes(nbTheme()).flatMap((m) => Object.keys(m.roles)).filter((k) => k.startsWith('interactive.accent'));
  ok(noAccent.length === 0, 'accent: no accent column without accentPalette (never falls back to primary)' + (noAccent.length ? ` — ${noAccent.slice(0, 2).join(',')}` : ''));
  const acc = resolveAllModes({ ...nbTheme(), accentPalette: 'green', accentAnchorStep: 500 });
  const accLight = acc.find((m) => m.mode === 'light')!.roles;
  const accMissing = ['fill.rest', 'on-fill', 'text', 'border', 'on-inverse', 'overlay.hover'].filter((s) => !(`interactive.accent.${s}` in accLight));
  const accFails = acc.flatMap((m) => Object.entries(m.roles).filter(([k, r]) => k.startsWith('interactive.accent') && r.min > 0 && r.ratio < r.min).map(([k]) => `${m.mode}.${k}`));
  ok(accMissing.length === 0 && accFails.length === 0, 'accent: opt-in emits a full gated interactive.accent.* column' + (accMissing.length ? ` — MISSING ${accMissing.join(',')}` : '') + (accFails.length ? ` — FAILS ${accFails.slice(0, 2).join(',')}` : ''));

  // (d) accentPalette must differ from the action palette (no two identical columns).
  let threw = false;
  try { brandTheme({ id: 'x', primary: { l: 0.5, c: 0.2, h: 20 }, neutral: { hue: 20, chroma: 0.01 }, actionPalette: 'primary', accentPalette: 'primary' } as unknown as BrandInput); }
  catch { threw = true; }
  ok(threw, 'accent: accentPalette === actionPalette is rejected');
}

// roleColors — general semantic-role rebasing (docs/21): re-base any role on a declared palette,
// with the contrast guarantee preserved and a hue-mismatch note (not a block).
{
  const mk = (roleColors: any, extra: any = {}) => brandTheme({ id: 'rc', primary: { l: 0.5, c: 0.12, h: 250 }, neutral: { hue: 250, chroma: 0.01 }, roleColors, ...extra } as unknown as BrandInput);
  // (a) the gap-closer: a blue brand reuses its blue for info (no override existed before #21).
  ok(mk({ info: 'primary' }).roleToPalette.info === 'primary', 'roleColors: info re-bases on the brand (primary) palette');
  // (b) explicit danger rebase wins over the carve AND mints no orphan danger ramp.
  const red = brandTheme({ id: 'red', primary: { l: 0.5, c: 0.2, h: 25 }, neutral: { hue: 25, chroma: 0.01 }, roleColors: { danger: 'primary' } } as unknown as BrandInput);
  ok(red.roleToPalette.danger === 'primary' && !red.palettes.some((p) => p.palette === 'danger'), 'roleColors: explicit danger→primary reuses the brand red with no orphan danger palette');
  // (c) action via roleColors (the general form of actionPalette).
  ok(mk({ action: 'cta' }, { brandColors: [{ name: 'cta', oklch: { l: 0.5, c: 0.15, h: 30 } }] }).roleToPalette.action === 'cta', 'roleColors: action re-bases like actionPalette');
  // (d) THE GUARANTEE — every contract still passes when roles are rebased, all modes.
  const rebased = resolveAllModes(mk({ info: 'primary', danger: 'primary' }));
  const broken = rebased.flatMap((m) => Object.entries(m.roles).filter(([, r]) => r.min > 0 && r.ratio < r.min).map(([k]) => `${m.mode}.${k}`));
  ok(broken.length === 0, 'roleColors: a rebased brand still clears every contract in every mode' + (broken.length ? ` — FAILED ${broken.slice(0, 3).join(',')}` : ''));
  const infoPath = rebased.find((m) => m.mode === 'light')!.roles['text.info'].path;
  ok(/\.primary\./.test(infoPath), `roleColors: text.info now resolves on the primary ramp (${infoPath.split('.').slice(-2).join('.')})`);
  // (e) hue-mismatch is flagged, not blocked.
  const mis = brandTheme({ id: 'mis', primary: { l: 0.5, c: 0.15, h: 150 }, neutral: { hue: 150, chroma: 0.01 }, brandColors: [{ name: 'lime', oklch: { l: 0.7, c: 0.15, h: 135 } }], roleColors: { danger: 'lime' } } as unknown as BrandInput);
  ok(mis.roleToPalette.danger === 'lime' && mis.notes.some((n) => /CONFIRM the danger signal/.test(n)), 'roleColors: a hue mismatch (danger not red) is allowed but flagged in notes');
  // (f) guards: brand/neutral cannot be rebased; unknown palette rejected.
  let tn = false, tu = false;
  try { mk({ neutral: 'primary' }); } catch { tn = true; }
  try { mk({ info: 'nope' }); } catch { tu = true; }
  ok(tn, 'roleColors: rebasing neutral (the surface model) is rejected');
  ok(tu, 'roleColors: an unknown target palette is rejected');
}

// L-02: dualContrastWindow is only defined up to √21 ≈ 4.583 (the max ratio any single
// luminance clears on BOTH extremes). At 4.5 it returns a valid non-empty window; past
// √21 it must THROW rather than hand back an inverted [min>max] pair.
{
  const [lo, hi] = dualContrastWindow(4.5);
  ok(lo < hi && lo > 0 && hi < 1, `L-02: dualContrastWindow(4.5) is a valid non-empty window [${lo.toFixed(3)}, ${hi.toFixed(3)}]`);
  let threw = false;
  try { dualContrastWindow(7); } catch { threw = true; }
  ok(threw, 'L-02: dualContrastWindow(7) throws — no luminance clears 7:1 on both black and white (would have been an inverted window)');
  ok(dualContrastWindow(Math.sqrt(21))[0] <= dualContrastWindow(Math.sqrt(21))[1] + 1e-9, 'L-02: exactly √21 is the degenerate boundary (min ≈ max), still allowed');
}

// L-03: radiusScale is weakly monotone (none ≤ sm ≤ md ≤ lg) for any scale ≥ 0 — small
// scales legitimately snap rungs together, but a rung is never SMALLER than its predecessor.
// A non-monotone input (negative scale) trips the gate.
{
  for (const s of [0, 0.25, 0.5, 1, 1.5, 2]) {
    const ladder = radiusScale(s).filter((r) => !r.pill);
    const mono = ladder.every((r, i) => i === 0 || r.px >= ladder[i - 1].px);
    ok(mono, `L-03: radiusScale(${s}) is weakly monotone (${ladder.map((r) => r.px).join('≤')})`);
  }
  ok(radiusScale(0).filter((r) => !r.pill).every((r) => r.px === 0), 'L-03: scale=0 collapses the ladder to all-sharp by design (equality allowed)');
  ok(radiusScale(0.25).filter((r) => !r.pill).map((r) => r.px).join(',') === '0,0,2,2', 'L-03: a small scale quantises onto the 2px sub-grid (none=sm=0, md=lg=2) — a documented resolution limit, not a bug');
  // The gate itself is a construction-time tripwire: RADIUS_LADDER factors are
  // monotone and Math.max(0,·)/snap2 preserve that for any scale ≥ 0, so no scalar
  // input can violate it — it guards a FUTURE non-monotone ladder edit. Assert the
  // property holds at the extremes rather than trying to force the (unreachable) throw.
  ok(radiusScale(1000).filter((r) => !r.pill).every((r, i, a) => i === 0 || r.px >= a[i - 1].px), 'L-03: monotonicity holds even at an absurd scale (gate never false-trips a valid ladder)');
}

// L-05: pxOf is rem-aware (a rem leaf scales by 16, not truncated as px), and deref reports
// a runaway/cyclic alias chain as missing (undefined) rather than a mid-chain node.
{
  const tree: any = { root: { a: { $value: '1.5rem' }, b: { $value: '8px' }, loop: { $value: '{root.loop}' } } };
  ok(pxOf(tree, tree.root.b) === 8, 'L-05: pxOf reads a px leaf directly (8px → 8)');
  ok(pxOf(tree, tree.root.a) === 24, 'L-05: pxOf scales a rem leaf by 16 (1.5rem → 24px), not parseInt→1');
  ok(deref(tree, tree.root.loop) === undefined, 'L-05: deref returns undefined on a cyclic alias chain (missing), not a mid-chain alias node');
  ok(deref(tree, tree.root.b)?.$value === '8px' && at(tree, 'root.b')?.$value === '8px', 'L-05: deref/at resolve a normal leaf unchanged');
}

// M-05: red-territory detection is chroma-aware. A red-ish but DESATURATED (greige) primary
// must NOT be reused as danger — a near-grey can't signal destruction — so it carves a real
// saturated red; a genuinely saturated red primary still reuses itself.
{
  ok(!inRedTerritory(30, 0.03), 'M-05: a warm greige (h30, c0.03) is NOT red territory (chroma below floor)');
  ok(inRedTerritory(27, 0.17), 'M-05: a saturated red (h27, c0.17) IS red territory');
  const greige = brandTheme({ id: 'greige', primary: { l: 0.5, c: 0.03, h: 30 }, neutral: { hue: 30, chroma: 0.01 } });
  ok(greige.roleToPalette.danger === 'danger', 'M-05: a greige-warm primary carves a dedicated danger palette (does NOT reuse the near-grey primary)');
  const dMid = greige.palettes.find((p) => p.palette === 'danger')!.steps.find((s) => s.num === 500)!;
  ok(dMid.oklch.c > 0.08, `M-05: the carved danger is a saturated red (mid chroma ${dMid.oklch.c.toFixed(3)} > floor), not a near-grey`);
  const satRed = brandTheme({ id: 'red', primary: { l: 0.55, c: 0.17, h: 27 }, neutral: { hue: 27, chroma: 0.01 } });
  ok(satRed.roleToPalette.danger === 'primary', 'M-05: a saturated red primary still reuses itself as danger (no near-duplicate red)');
  ok(greige.notes.some((n) => n.includes('below the') && n.includes('floor')), 'M-05: the greige carve reason is surfaced in the decisions log');
}

// M-06: a non-primary actionPalette anchors the action role at the brand's PINNED accent step
// (matching nbTheme's action=550=accent step), not the hardcoded 500 pivot that silently
// discarded the brand's chosen shade. pickBrand still nudges to clear AA, so a11y is preserved.
{
  const step = autoPlaceStep(0.35);   // a dark accent pins well below 500
  ok(step !== 500, `precondition: a dark accent pins off the 500 pivot (step ${step})`);
  const acted = brandTheme({ id: 'act', primary: { l: 0.5, c: 0.08, h: 260 }, neutral: { hue: 260, chroma: 0.01 }, brandColors: [{ name: 'cta', oklch: { l: 0.35, c: 0.1, h: 260 } }], actionPalette: 'cta' });
  ok(acted.roleAnchorStep.action === step, `M-06: a non-primary actionPalette anchors the action at the accent's pinned step ${step}, not 500`);
  const prim = brandTheme({ id: 'p', primary: { l: 0.35, c: 0.1, h: 260 }, neutral: { hue: 260, chroma: 0.01 } });
  ok(prim.roleAnchorStep.action === prim.roleAnchorStep.brand, 'M-06: actionPalette=primary still anchors the action at the primary step');
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
  // L-06: a gradient name becomes a token path segment, so it needs the same slug charset
  // palette names enforce (CR-03) and must be unique among gradients.
  const goodStops = [{ palette: 'primary', step: 600, position: 0 }, { palette: 'accent', step: 500, position: 1 }];
  let badName = false;
  try { grBrand('gr-dot', [{ name: 'brand.fade', stops: goodStops }]); } catch { badName = true; }
  ok(badName, "L-06: a dotted gradient name ('brand.fade') throws (would break the {a.b.c} alias convention)");
  let dupGrad = false;
  try { grBrand('gr-dup', [{ name: 'fade', stops: goodStops }, { name: 'fade', stops: goodStops }]); } catch { dupGrad = true; }
  ok(dupGrad, 'L-06: two gradients named the same throw (duplicate gradient name)');
  ok(grBrand('gr-ok-name', [{ name: 'brand-fade', stops: goodStops }]).gradient.gradients.length === 1, 'L-06: a valid slug gradient name still builds');
  // NB ships no gradients.
  ok(nbTheme().gradient.gradients.length === 0, 'NB ships no gradients (it had none)');
}

// L-07: a brand-SUPPLIED status override seeds a vivid, UNANCHORED ramp from its hue+chroma
// (not pinned at its measured lightness) — say so in the decisions log so a measured swatch
// isn't wrongly implied to round-trip. The engine-default branch note is unchanged.
{
  const withOverride = brandTheme({ id: 'st', primary: { l: 0.5, c: 0.12, h: 200 }, neutral: { hue: 200, chroma: 0.01 }, status: { success: { l: 0.5, c: 0.15, h: 150, chroma: 0.15 } } });
  ok(withOverride.notes.some((n) => n.startsWith('success: brand-supplied hue 150') && n.includes('not pinned at its measured lightness')), 'L-07: a brand-supplied status note flags that the ramp is unanchored (measured swatch may not appear verbatim)');
  const noOverride = brandTheme({ id: 'st2', primary: { l: 0.5, c: 0.12, h: 200 }, neutral: { hue: 200, chroma: 0.01 } });
  ok(noOverride.notes.some((n) => n === 'success: engine default hue 145'), 'L-07: the engine-default status note is unchanged (byte-identical for brands without overrides)');
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
  // legacy interactive fills gone (action.* retired task #14; foreground.interactive earlier)
  ok(p(L, 'action.default') === undefined, 'legacy action.* removed (components bind interactive.*)');
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
  // on-fill softening: dark interactive on-fill is near-black (950), light keeps pure white; HC keeps pure
  ok(!isBlack(p(D, 'interactive.primary.on-fill')), 'dark interactive on-fill is softened (near-black, not pure)');
  ok(isWhite(p(L, 'interactive.primary.on-fill')), 'light interactive on-fill stays pure white (user preference)');
  ok(isWhite(p(HCD, 'interactive.primary.on-fill')) || isBlack(p(HCD, 'interactive.primary.on-fill')), 'HC keeps pure extremes for on-fill (max contrast)');
  ok(isBlack(p(HCL, 'background.inverse.primary')), 'HC inverse stays a pure extreme (max contrast)');
  // (the ink on a disabled fill is the cross-cutting disabled.on-fill — tested in the DISABLED block above.)
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

  // CR-05: a misindented line (or a stray no-colon/prose line) used to end the block loop
  // early and SILENTLY drop that line + everything after it. Now every line must be consumed
  // or the parser throws with the offending line number — a designer's lever can't vanish.
  const threwOn = (s: string) => { try { parseYamlSubset(s); return false; } catch { return true; } };
  ok(threwOn('id: x\nneutral:\n  hue: 200\n   chroma: 0.01\nradiusScale: 1'), 'CR-05: a key over-indented by one space throws (not silently dropped with the rest)');
  ok(threwOn('id: x\nstray prose line\nneutral:\n  hue: 200'), 'CR-05: a stray no-colon line inside frontmatter throws (does not truncate the rest)');
  ok(!threwOn('id: x\nneutral:\n  hue: 200\n  chroma: 0.01\nradiusScale: 1'), 'CR-05: correctly-indented equivalent still parses clean');
  // the error names the offending source line (actionable)
  let msg = '';
  try { parseYamlSubset('id: x\nneutral:\n  hue: 200\n   chroma: 0.01'); } catch (e) { msg = (e as Error).message; }
  ok(/line 4/.test(msg) && /chroma/.test(msg), 'CR-05: the error points at the offending line (number + content)');
  // L-08: a duplicate key at the same level silently last-wins in object assignment — now it
  // throws (a pasted-twice `id:`/`primary:` block can't quietly lose one).
  ok(threwOn('id: a\nid: b'), 'L-08: a duplicate top-level key throws (no silent last-win)');
  ok(threwOn('neutral:\n  hue: 200\n  hue: 300'), 'L-08: a duplicate nested key throws');
  ok(!threwOn('id: a\nneutral:\n  hue: 200'), 'L-08: distinct keys at the same level still parse clean');
}
// (2) parseDesignMd — frontmatter/prose split; a missing fence is an error.
{
  const { input, prose } = parseDesignMd('---\nid: x\nprimary: { l: 0.5, c: 0.1, h: 200 }\n---\n\n# Title\n\nBody prose.\n');
  ok((input as any).id === 'x' && (input as any).primary.h === 200, 'parseDesignMd: frontmatter → BrandInput');
  ok(prose.includes('Body prose.') && !prose.includes('id: x'), 'parseDesignMd: prose separated from frontmatter');
  let threw = false;
  try { parseDesignMd('no fence here\nid: x\n'); } catch { threw = true; }
  ok(threw, 'parseDesignMd: missing frontmatter fence throws');
  // L-08: the closing fence is an EXACT `---` line, not any line that starts with `---`. A
  // frontmatter line like `name: --- x ---` (or a `----` rule in prose) must not close early.
  const fenced = parseDesignMd('---\nid: x\nname: "--- not a fence ---"\nprimary: { l: 0.5, c: 0.1, h: 200 }\n---\n\nBody.\n');
  ok((fenced.input as any).name === '--- not a fence ---' && (fenced.input as any).primary.h === 200, 'L-08: a `---`-containing VALUE inside frontmatter does not close the fence early (whole block parsed)');
  ok(fenced.prose === 'Body.', 'L-08: prose still starts after the real (exact-`---`) closing fence');
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

  // M-11: the alias gate must include fluid-typography responsive refs (`responsive.{min,max}.ref`)
  // — a dangling {root.font.size.NN} used to ship while the gate reported clean. Independently
  // count every {…} ref in the tree INCLUDING the fluid refs; buildTree's own count must match
  // (if its walk skipped them — the bug — its count would be lower than this independent one).
  {
    const brandRoot = (built.tree as any)[Object.keys(built.tree)[0]];
    let refs = 0, fluidRefs = 0;
    const isRef = (s: any) => typeof s === 'string' && /^\{.+\}$/.test(s);
    const count = (n: any): void => {
      if (!n || typeof n !== 'object') return;
      if (n.$type !== undefined) {
        if (isRef(n.$value)) refs++;
        else if (n.$value && typeof n.$value === 'object' && !Array.isArray(n.$value)) for (const s of Object.values(n.$value)) if (isRef(s)) refs++;
        else if (Array.isArray(n.$value)) for (const it of n.$value) if (it && typeof it === 'object') for (const s of Object.values(it)) if (isRef(s)) refs++;
        const mo = n.$extensions?.prism3?.modes;
        if (mo && !Array.isArray(mo)) for (const mv of Object.values(mo)) if (isRef((mv as any)?.$value)) refs++;
        const r = n.$extensions?.prism3?.responsive;
        if (r?.fluid) for (const e of [r.min, r.max]) if (isRef(e?.ref)) { refs++; fluidRefs++; }
        return;
      }
      for (const [k, v] of Object.entries(n)) if (!k.startsWith('$')) count(v);
    };
    count(brandRoot);
    ok(fluidRefs > 0, `M-11: precondition — harbor has fluid composites (${fluidRefs} responsive refs)`);
    ok(built.stats.aliases === refs, `M-11: the alias gate counts every ref incl. fluid responsive refs (gate ${built.stats.aliases} === independent ${refs})`);
  }
}
// M-10: the .ai.json `aliased_by` reverse index must count mode-override (dark/HC) + fluid
// consumers, not just $value refs — else a primitive consumed ONLY by a dark override shows zero
// consumers, contradicting the sidecar's own "cannot drift" note. (The sidecar was otherwise
// entirely ungated.) Prove mode/fluid refs add direct consumer edges a $value-only index misses.
{
  const t = brandTheme(parseDesignMd(readFileSync(resolve(HERE, '../examples/aurora.design.md'), 'utf8')).input);
  const tree = buildTree(t).tree as any;
  const R = t.root;
  const refsInV = (v: any): string[] => { if (typeof v === 'string') { const m = v.match(/^\{(.+)\}$/); return m ? [m[1]] : []; } if (v && typeof v === 'object') return Object.values(v).flatMap(refsInV); return []; };
  const strip = (ref: string) => (ref.startsWith(R + '.') ? ref.slice(R.length + 1) : ref);
  const edgesValue = new Set<string>(), edgesAll = new Set<string>();
  const wp = (o: any, p: string[]): void => {
    if (!o || typeof o !== 'object') return;
    if (o.$type !== undefined) {
      for (const ref of refsInV(o.$value)) { const e = strip(ref) + '←' + p.join('.'); edgesValue.add(e); edgesAll.add(e); }
      const mo = o.$extensions?.prism3?.modes; if (mo && !Array.isArray(mo)) for (const mv of Object.values(mo)) for (const ref of refsInV((mv as any)?.$value)) edgesAll.add(strip(ref) + '←' + p.join('.'));
      const r = o.$extensions?.prism3?.responsive; if (r?.fluid) for (const end of [r.min, r.max]) { const m = String(end?.ref).match(/^\{(.+)\}$/); if (m) edgesAll.add(strip(m[1]) + '←' + p.join('.')); }
      return;
    }
    for (const [k, v] of Object.entries(o)) if (!k.startsWith('$')) wp(v, [...p, k]);
  };
  wp(tree[R], []);
  ok(edgesAll.size > edgesValue.size, `M-10: mode-override + fluid refs add ${edgesAll.size - edgesValue.size} direct consumer edges the $value-only index missed`);
  const ai = buildAiMetadata(t, tree) as any;
  ok(Object.values(ai.primitives).some((pr: any) => (pr.aliased_by?.length ?? 0) > 0), 'M-10: the emitted sidecar carries a populated aliased_by reverse index (was ungated)');

  // Sidecar-reference gate: every `paired_with` entry must resolve to a real role key in the SAME
  // sidecar. This is the gate that was missing — the field.border → field.border.rest rename left
  // a stale `field.fill` paired_with pointing at the gone `field.border`, and nothing caught it
  // because the sidecar's cross-references were never validated. Now a rename that orphans a
  // paired_with ref fails here instead of shipping a broken .ai.json.
  const roleKeys = new Set(Object.keys(ai.color));
  const dangling: string[] = [];
  for (const [k, r] of Object.entries(ai.color as Record<string, any>))
    for (const ref of (r.paired_with ?? []))
      if (!roleKeys.has(ref)) dangling.push(`${k} → ${ref}`);
  ok(dangling.length === 0, 'sidecar: every .ai.json paired_with resolves to a real role in the sidecar' + (dangling.length ? ` — ${dangling.slice(0, 5).join(', ')}` : ''));
}
// (5) STANDARD dialect — the brand-skills / google-labs design.md path (docs/07 §11):
// the reader + colour-role classifier + x-prism3 levers, on the real Wendy's file.
{
  const std = parseStandardDesignMd(readFileSync(resolve(HERE, '../examples/wendys.design.md'), 'utf8'));
  ok(Object.keys(std.colors).length === 24 && Object.keys(std.typography).length === 25, 'wendys standard: reader sees 24 colours + 25 type tokens');
  // L-15: an UNQUOTED `#hex` colour value is read as a YAML comment and stripped to null. Give
  // an actionable error at the reader ("quote it") rather than a baffling `invalid hex 'null'`
  // two layers down. A quoted hex reads back fine.
  let hexComment = '';
  try { parseStandardDesignMd('---\nname: b\ncolors:\n  primary: #ff0000\n---\n'); } catch (e) { hexComment = (e as Error).message; }
  ok(/primary/.test(hexComment) && /quote it/.test(hexComment), "L-15: an unquoted '#hex' colour throws a quote-it hint, not a downstream 'invalid hex null'");
  ok(parseStandardDesignMd('---\nname: b\ncolors:\n  primary: "#ff0000"\n---\n').colors.primary === '#ff0000', 'L-15: a quoted hex reads back verbatim');
  const cls = classifyColors(std.colors);
  ok(!!cls.input.status.danger, 'classifier: error → status.danger (the one rename)');
  ok(!!cls.input.status.success && !!cls.input.status.warning, 'classifier: success + warning classified from the flat map');
  ok(cls.input.brandColors.some((b) => b.name === 'secondary') && cls.input.brandColors.some((b) => b.name === 'tertiary'), 'classifier: secondary + tertiary → brandColors[]');
  // M-12: classification lowercases, so anchor EXTRACTION must too — a mixed/upper-case map
  // must anchor identically, not silently drop the anchor (or throw "no primary").
  const mixed = classifyColors({ Primary: '#3366cc', Error: '#cc2222', Secondary: '#22aa88', Neutral: '#888888' });
  ok(!!mixed.input.primary && !!mixed.input.status.danger && mixed.input.brandColors.some((b) => b.name === 'secondary'),
    'M-12: mixed-case keys (Primary/Error/Secondary) classify + extract identically to lowercase');
  let m12threw = false;
  try { classifyColors({ PRIMARY: '#123456' }); } catch { m12threw = true; }
  ok(!m12threw, 'M-12: an all-caps PRIMARY no longer throws "no primary"');
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
  // M-14: a non-numeric radiusScale (`Number('soft')` → NaN) must be rejected at ingest, not
  // slipped through to NaNpx radius tokens (NaN passes typeof-number + every min/max compare).
  let m14ingest = false;
  try { applyXPrism3({ id: 'p', primary: { l: 0.5, c: 0.1, h: 20 }, neutral: { hue: 20, chroma: 0.01 } } as BrandInput, { radiusScale: 'soft' }); } catch { m14ingest = true; }
  ok(m14ingest, 'M-14: x-prism3.radiusScale="soft" throws at ingest (not a NaN radius)');
  ok(applyXPrism3({ id: 'p', primary: { l: 0.5, c: 0.1, h: 20 }, neutral: { hue: 20, chroma: 0.01 } } as BrandInput, { radiusScale: 1.5 }).length === 1, 'M-14: a numeric radiusScale still applies');
  ok(validateBrandInput({ id: 't', primary: { l: 0.5, c: 0.05, h: 200 }, neutral: { hue: 200, chroma: 0.01 }, radiusScale: NaN } as any).length > 0, 'M-14: the validator rejects a NaN number (backstop)');
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
  const pinput = parseDesignMd(readFileSync(resolve(HERE, '../examples/harbor.design.md'), 'utf8')).input;
  const rp = resolvePreview(brandTheme(pinput));
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

  // Per-mode geometry (docs/11 1b): with no wireframe, dims carry NO overrides; opting into
  // wireframe surfaces a radius→0 override the preview reads for the wireframe column, while
  // the canonical `dims` baseline stays positive (light) and space/size stay override-free.
  ok(Object.keys(rp.dimOverrides).length === 0, 'resolved preview: default modes carry no per-mode dim overrides');
  const wfRp = resolvePreview(brandTheme({ ...pinput, modes: ['light', 'wireframe'] }));
  const radiusRef = Object.keys(wfRp.dims).find((k) => k.startsWith('radius.') && wfRp.dims[k] > 0)!;
  ok(wfRp.dimOverrides[radiusRef]?.wireframe === 0 && wfRp.dims[radiusRef] > 0,
    `resolved preview: wireframe zeroes ${radiusRef} via an override (baseline ${wfRp.dims[radiusRef]}px stays)`);
  const spaceRef = Object.keys(wfRp.dims).find((k) => k.startsWith('space.'));
  ok(!spaceRef || !wfRp.dimOverrides[spaceRef], 'resolved preview: wireframe leaves space untouched (only radius zeroes)');
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
// (10b) L-10: the visualiser now prints a contract's ACTUAL pass/fail (a failing light contract
// used to print `3.20≥4.5`, literally false). Making it honest SURFACED a pre-existing gap the
// bug had masked: nb's HAND-AUTHORED semantic text on the subtle-tint surface lands ~4.0–4.2:1
// in light — under AA 4.5 (the `-subtle` banner/badge pairing; a CR-02-sibling: the role is
// contracted vs the floor but used on a specific tint). Engine-GENERATED brands (aurora/harbor,
// gated all-green above) clear it. Captured here as a tested, visible fact — flagged for a
// follow-up colour/preview-spec decision, NOT silently fixed (it would move nb token values).
{
  const nbLightFails = resolvePreview(nbTheme()).contracts.filter((c) => c.byMode.light && !c.byMode.light.pass);
  ok(nbLightFails.length > 0, 'L-10: nb has light-mode preview-contract shortfalls the visualiser now shows honestly (were masked by the ≥-always display bug)');
  ok(nbLightFails.every((c) => /tint/.test(c.label ?? '')), `L-10: every nb light shortfall is a semantic-text-on-subtle-tint pairing (${nbLightFails.map((c) => c.label).join('; ')}) — CR-02-sibling, flagged for follow-up`);
}

// (11) EMIT-FIGMA COLOUR (docs/10) — buildFigmaColor(nbTheme) must reproduce the frozen
// Token Press export (fixtures/figma/nb): same variable names per collection/mode, same
// scopes, and — the load-bearing property — every semantic aliases the SAME palette
// variable by name in every mode (0 broken/mismatched). Values compared to float32
// tolerance (Figma stores colour as float32; the importer's rounding differs by ~5e-7).
// NB (#66): the byte-repro is on variable NAMES / scopes / aliases / values — NOT the
// `$collection` label. The emitter now labels the primitives `core-palette` / `core-font`
// / `type-sets` (#66), while the frozen fixture keeps the pre-rename labels; the fixture is
// the Token Press byte-repro target and stays put until Token Press confirms the new labels
// (#67). The load-bearing contract (names/aliases/values) is unchanged, which is what this gates.
{
  const FIXDIR = resolve(HERE, '../fixtures/figma/nb');
  const { palette, color } = buildFigmaColor(nbTheme());
  const emitted: Record<string, any> = { palette };
  for (const c of color) emitted[`color.${c.$mode}`] = c;

  // NB opts into the default four modes (no wireframe), so `color` here has 4 entries.
  // Iterate the modes actually emitted rather than the full COLOR_MODES set — the
  // wireframe mode is opt-in and has no NB fixture (docs/11 Pillar 1b).
  for (const key of ['palette', ...color.map((c) => `color.${c.$mode}`)]) {
    const fix = JSON.parse(readFileSync(resolve(FIXDIR, `${key}.json`), 'utf8'));
    const out = emitted[key];
    const fixByName = new Map<string, any>(fix.variables.map((v: any) => [v.name, v]));
    const outByName = new Map<string, any>(out.variables.map((v: any) => [v.name, v]));
    // The fixture is the FROZEN real NB Token Press export. `missing === 0` keeps the
    // byte-repro guarantee (every real-NB var is still emitted, and the scope/alias/value
    // checks below verify them). Engine-invented FAMILIES that NB's export predates
    // (interactive.* — docs/20) are allow-listed out of the `extra` check: they are
    // pinned for shape/scope in the dedicated interactive block below, not here — so this
    // gate still fails on a spurious var inside a REAL family. (Fixture-character decision,
    // 2026-07-06; pairs with #67.)
    const ENGINE_ADDED_FAMILIES = ['color/interactive/', 'color/disabled/', 'color/field/'];
    const missing = [...fixByName.keys()].filter((n) => !outByName.has(n));
    const extra = [...outByName.keys()].filter((n) => !fixByName.has(n) && !ENGINE_ADDED_FAMILIES.some((p) => n.startsWith(p)));
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

  // Scopes are restored to their real per-family targets across primitive +
  // semantic (this PR keeps the fixture-match here — hidden-from-publishing
  // handles the hide, scopes remain guidance for bespoke picker use).
  // Family descriptions now lead with the fixture's stack line (fix #4) and
  // have the DTCG $description appended — assert `startsWith` on the fixture.
  const badFT: string[] = [], badFS: string[] = [], badFV: string[] = [], badFA: string[] = [], badFD: string[] = [];
  for (const [name, fv] of fontByName) {
    const ov = emitByName.get(name); if (!ov) continue;
    if (fv.resolvedType !== ov.resolvedType) badFT.push(name);
    if (JSON.stringify([...fv.scopes].sort()) !== JSON.stringify([...ov.scopes].sort())) badFS.push(name);
    if (fv.value !== ov.value) badFV.push(name);
    if ((fv.alias?.name ?? null) !== (ov.alias?.name ?? null)) badFA.push(name);
    if (name.startsWith('font/family/') && !ov.description.startsWith(fv.description)) badFD.push(name);
  }
  ok(badFT.length === 0, 'figma font: resolvedType matches fixture' + (badFT.length ? ` — ${badFT.slice(0, 3).join(',')}` : ''));
  ok(badFS.length === 0, 'figma font: scopes match fixture' + (badFS.length ? ` — ${badFS.slice(0, 3).join(',')}` : ''));
  ok(badFV.length === 0, 'figma font: values match fixture' + (badFV.length ? ` — ${badFV.slice(0, 3).join(',')}` : ''));
  ok(badFA.length === 0, 'figma font: weight-role aliases target the same numeric weight as fixture' + (badFA.length ? ` — ${badFA.slice(0, 3).join(',')}` : ''));
  ok(badFD.length === 0, 'figma font: family descriptions still lead with the full fallback stack (fix #4 preserved)' + (badFD.length ? ` — ${badFD.slice(0, 3).join(',')}` : ''));

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
    // fix #2 — collection is the typography primitive `core-font` (renamed from `font`, #66) or
    // `type-sets` (renamed from `font-fluid`) for the fluid composites. The bound VARIABLE names
    // still mirror the DTCG paths (`font/…`, `font-fluid/…`) — the rename is a collection label only.
    const fx = expectedByCorrectedName.get(s.name);
    if (!fx) continue;
    if (!(p.fontFamily as any).bound || (p.fontFamily as any).collection !== 'core-font') collBad.push(`${s.name}:family`);
    if (!(p.fontSize as any).bound || !['core-font', 'type-sets'].includes((p.fontSize as any).collection)) collBad.push(`${s.name}:size`);
    if (!(p.fontWeight as any).bound || (p.fontWeight as any).collection !== 'core-font') collBad.push(`${s.name}:weight`);
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
  ok(collBad.length === 0, 'figma text-styles: fix #2 — every bound property uses the prescribed collection (core-font / type-sets)' + (collBad.length ? ` — ${collBad.slice(0, 3).join(', ')}` : ''));
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
    radius: dims.radius[0].variables.length,
    size: dims.size.variables.length,
    'border-width': dims.borderWidth.variables.length,
    focus: dims.focus.variables.length,
    opacity: dims.opacity.variables.length,
  };
  for (const key of Object.keys(expected) as Array<keyof typeof expected>) {
    ok(expected[key] === got[key], `figma dims.${key}: variable count matches DTCG tree (${expected[key]})` + (expected[key] !== got[key] ? ` — got ${got[key]}` : ''));
  }

  // (b) Every FLOAT var carries a valid non-empty scope set and resolvedType=FLOAT.
  // radius is now per-mode (Pillar 1b); the Default-mode file is [0], byte-identical
  // to the pre-1b world for a non-wireframe brand like NB.
  const allDimColls = [dims.dimension, dims.space, dims.radius[0], dims.size, dims.borderWidth, dims.focus, dims.opacity];
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
  // `dimension` (ref-tier primitive) keeps its broad scope so, if a component
  // author unhides + uses one directly, guidance is still correct.
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

  // CR-03: brand-colour names are validated at the engine boundary. A last-wins palette map
  // means a name colliding with an engine ramp (neutral/primary/status) or a duplicate would
  // silently corrupt output with green gates — so reserved / bad-charset / duplicate all throw.
  // (aurora's gradient references its 'accent' brandColor, so drop both here to isolate the name guard)
  const bc = (name: string) => ({ ...input, actionPalette: 'primary', gradients: [], brandColors: [{ name, oklch: { l: 0.55, c: 0.15, h: 235 } }] });
  const rejects = (name: string) => { try { brandTheme(bc(name)); return false; } catch { return true; } };
  ok(brandTheme(bc('brand-blue')).palettes.some((p) => p.palette === 'brand-blue'), 'CR-03: a valid slug brand-colour name is accepted');
  ok(rejects('neutral') && rejects('primary'), 'CR-03: a brand colour named after an engine ramp (neutral/primary) throws (would hijack it)');
  ok(rejects('success') && rejects('white'), 'CR-03: a brand colour named after a reserved palette (status / base swatch) throws');
  ok(rejects('my.accent') && rejects('brand blue') && rejects('<img>'), 'CR-03: dotted / spaced / symbol brand-colour names throw (alias-path + XSS charset guard)');
  let dupThrew = false;
  try { brandTheme({ ...input, actionPalette: 'primary', gradients: [], brandColors: [{ name: 'twin', oklch: { l: 0.5, c: 0.1, h: 10 } }, { name: 'twin', oklch: { l: 0.6, c: 0.1, h: 200 } }] }); } catch { dupThrew = true; }
  ok(dupThrew, 'CR-03: duplicate brand-colour names throw');
  ok(validateBrandInput(bc('brand-blue')).length === 0 && validateBrandInput(bc('my.accent')).length > 0, 'CR-03: schema pattern accepts a slug, rejects a dotted brand-colour name');

  // CR-04: the hand-rolled validator must enforce keyword classes it used to ignore — else
  // `[schema] ✓ conforms` vouches for inputs brandTheme then crashes on / mis-emits. Baseline:
  // aurora conforms (its `variable` is a per-face object — the schema now describes boolean|object).
  ok(validateBrandInput(input).length === 0, 'CR-04: a valid brand (aurora) conforms');
  // boolean branch (via gradients oneOf: [boolean, array]) — the headline probe.
  ok(validateBrandInput({ ...input, gradients: 'banana' as any }).length > 0, 'CR-04: gradients:"banana" rejected (no boolean branch used to let it match the oneOf)');
  ok(validateBrandInput({ ...input, gradients: true as any }).length === 0, 'CR-04: gradients:true still accepted (valid boolean)');
  // numeric enum (was only checked under type:string)
  ok(validateBrandInput({ ...input, typography: { ...(input.typography ?? {}), titleFloor: 17 } as any }).length > 0, 'CR-04: titleFloor:17 rejected (numeric enum [16,18] now enforced)');
  ok(validateBrandInput({ ...input, typography: { ...(input.typography ?? {}), titleFloor: 18 } as any }).length === 0, 'CR-04: titleFloor:18 accepted (in enum)');
  // minItems / maxItems (never checked before)
  ok(validateBrandInput({ ...input, motionPersonality: { easingEmphasized: [0.2, 0] } as any }).length > 0, 'CR-04: easingEmphasized [0.2,0] rejected (minItems 4)');
  ok(validateBrandInput({ ...input, motionPersonality: { easingEmphasized: [0.2, 0, 0.4, 1] } as any }).length === 0, 'CR-04: a 4-length easing accepted');
  // families.variable is boolean|per-face-object — a string matches neither
  ok(validateBrandInput({ ...input, typography: { families: { variable: 'yes' } } as any }).length > 0, 'CR-04: families.variable:"yes" rejected (boolean|object, not string)');
  ok(validateBrandInput({ ...input, typography: { families: { variable: { display: true } } } as any }).length === 0, 'CR-04: families.variable per-face object accepted');
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

// (18) MODE CONFIG (docs/11 Pillar 1) — light is the required base; dark/HC/wireframe opt-in.
// Omitted → the default four (back-compat, byte-identical golden in block 3). A light-only
// brand resolves + emits ONE mode with no per-mode colour overrides; light+dark carries the
// dark override but not HC. Wireframe (1b) is a generated greyscale mode (non-neutral roles →
// equivalent neutral; radius → 0), opt-in only. Guards: must include light; unknown mode throws.
{
  const { input } = parseDesignMd(readFileSync(resolve(HERE, '../examples/aurora.design.md'), 'utf8'));

  const def = brandTheme(input);
  ok(def.modes.length === 4 && resolvePreview(def).modes.length === 4, 'mode config: omitted modes → all four');

  const lo = brandTheme({ ...input, modes: ['light'] });
  const loRp = resolvePreview(lo);
  ok(loRp.modes.length === 1 && loRp.modes[0] === 'light', 'mode config: modes:[light] → light only');
  const loTree = (buildTree(lo).tree as any).prism;
  ok(Object.keys(loTree.color.interactive.primary.fill.rest.$extensions.prism3.modes).length === 0, 'mode config: light-only tree emits no per-mode colour overrides');
  ok(Object.keys(loTree.shadow.xs.$extensions.prism3.modes).length === 0, 'mode config: light-only tree emits no per-mode SHADOW overrides (dark reduction gated)');

  const ld = brandTheme({ ...input, modes: ['light', 'dark'] });
  ok(resolvePreview(ld).modes.length === 2, 'mode config: modes:[light,dark] → two modes');
  const ldTree = (buildTree(ld).tree as any).prism;
  ok('dark' in ldTree.color.interactive.primary.fill.rest.$extensions.prism3.modes && !('hc-light' in ldTree.color.interactive.primary.fill.rest.$extensions.prism3.modes), 'mode config: [light,dark] carries the dark override, not HC');
  ok('dark' in ldTree.shadow.xs.$extensions.prism3.modes, 'mode config: [light,dark] keeps the dark shadow reduction');

  let t1 = false, t2 = false;
  try { brandTheme({ ...input, modes: ['dark'] as any }); } catch { t1 = true; }
  try { brandTheme({ ...input, modes: ['light', 'bogus'] as any }); } catch { t2 = true; }
  ok(t1, 'mode config: modes without light throws');
  ok(t2, 'mode config: an unknown mode throws');

  ok(validateBrandInput({ ...input, modes: ['light', 'dark'] }).length === 0, 'mode config: schema accepts a valid modes subset');
  ok(validateBrandInput({ ...input, modes: ['light', 'wireframe'] }).length === 0, 'mode config: schema accepts wireframe (opt-in)');
  ok(validateBrandInput({ ...input, modes: ['light', 'bogus'] }).length > 0, 'mode config: schema rejects an unknown mode');

  // Wireframe (1b): opt-in greyscale mode. Non-neutral roles remap to the neutral ramp at the
  // same position (still clearing each min); radius zeroes. Never a default.
  const wf = brandTheme({ ...input, modes: ['light', 'wireframe'] });
  ok(wf.modes.includes('wireframe') && resolvePreview(wf).modes.includes('wireframe'), 'wireframe: opt-in mode resolves + previews');
  ok(!brandTheme(input).modes.includes('wireframe'), 'wireframe: never a default (opt-in only)');
  const R = wf.root, neutralPal = wf.roleToPalette.neutral, actionPal = wf.roleToPalette.action;
  const wfBuilt = buildTree(wf);
  const wfTree = (wfBuilt.tree as any)[R];
  const act = wfTree.color.interactive.primary.fill.rest;
  ok(actionPal !== neutralPal && act.$value.includes(`.${actionPal}.`), 'wireframe: light $value stays the chromatic (accent) pick');
  ok(act.$extensions.prism3.modes.wireframe.$value.includes(`.${neutralPal}.`), 'wireframe: the wireframe override remaps a chromatic role → neutral (greyscale)');
  ok(wfTree.radius.md.$extensions.prism3.modes?.wireframe?.$value === `{${R}.dimension.0}`, 'wireframe: radius.md carries a wireframe → dimension.0 override');
  ok(!wfTree.radius.none.$extensions?.prism3?.modes, 'wireframe: radius.none (already 0) carries no redundant override');
  const wfMode = wfBuilt.modes.find((m) => m.mode === 'wireframe')!;
  const wfChecks = Object.values(wfMode.roles).filter((r) => r.min > 0);
  ok(wfChecks.length > 0 && wfChecks.every((r) => r.ratio >= r.min), `wireframe: every contrast contract holds on the greyscale (${wfChecks.length} checks)`);
}

// (19) EMIT-FIGMA LAYOUT (docs/10 §7 item 4) — one `layout` variable collection
// with FIVE breakpoint modes (sm/md/lg/xl/2xl). The mode-column here is the
// VIEWPORT (composes independently with the colour light/dark collection).
// No fixtures — gate structurally: 5 mode files, same variable names across
// modes, per-mode alias resolution into space/*, scopes per family, breakpoint
// + container values invariant across modes, container/fluid intentionally
// skipped (no Figma primitive for percentage-of-parent).
{
  const theme = nbTheme();
  const { tree } = buildTree(theme);
  const root = Object.keys(tree)[0];
  const brand = tree[root];
  const dims = buildFigmaDims(theme);
  const layout = buildFigmaLayout(theme);

  // (a) one mode file per breakpoint the brand SHIPS (CR-08 — derived from the grid node, not a
  // hardcoded 5), in ascending order. NB ships the default 5 (sm..2xl == LAYOUT_MODES).
  const gridKeys = Object.keys(brand.grid);
  ok(layout.length === gridKeys.length && layout.length === 5, `figma layout: one mode file per breakpoint (got ${layout.length}, grid has ${gridKeys.length})`);
  const modeSeq = layout.map((l) => l.$mode).join(',');
  ok(modeSeq === gridKeys.join(',') && modeSeq === LAYOUT_MODES.join(','), `figma layout: modes follow the brand's breakpoints [${gridKeys.join(',')}] (got [${modeSeq}])`);
  ok(layout.every((l) => l.$collection === 'layout'), `figma layout: every file is $collection = 'layout'`);

  // (b) Every mode file carries the SAME variable-name set — the mode column
  // is *just* the value axis. Compute the sm names and check the rest against it.
  const nameSets = layout.map((l) => l.variables.map((v) => v.name).sort().join('|'));
  const nameDrift = nameSets.filter((s) => s !== nameSets[0]);
  ok(nameDrift.length === 0, `figma layout: every mode carries the same variable-name set (${layout[0].variables.length} vars)`);

  // (c) Every var is resolvedType FLOAT with a non-empty scope + non-empty description.
  const badType: string[] = [], badScope: string[] = [], emptyDesc: string[] = [];
  for (const l of layout) for (const v of l.variables) {
    if (v.resolvedType !== 'FLOAT') badType.push(`${l.$mode}:${v.name}`);
    if (!v.scopes || v.scopes.length === 0) badScope.push(`${l.$mode}:${v.name}`);
    if (!v.description || v.description.length === 0) emptyDesc.push(`${l.$mode}:${v.name}`);
  }
  ok(badType.length === 0, 'figma layout: every variable is resolvedType FLOAT' + (badType.length ? ` — ${badType.slice(0, 3).join(', ')}` : ''));
  ok(badScope.length === 0, 'figma layout: every variable declares at least one scope' + (badScope.length ? ` — ${badScope.slice(0, 3).join(', ')}` : ''));
  ok(emptyDesc.length === 0, 'figma layout: every variable carries the DTCG $description' + (emptyDesc.length ? ` — ${emptyDesc.slice(0, 3).join(', ')}` : ''));

  // (d) Scopes narrow correctly per family. grid/columns is ALL_SCOPES (no
  // narrow scope fits a count); grid/{gutter,margin} → GAP (matches space);
  // container/{max,narrow} + breakpoint/* → WIDTH_HEIGHT.
  const scopeFor = (name: string): string[] => {
    if (name === 'grid/columns') return ['ALL_SCOPES'];
    if (name === 'grid/gutter' || name === 'grid/margin') return ['GAP'];
    if (name.startsWith('container/') || name.startsWith('breakpoint/')) return ['WIDTH_HEIGHT'];
    return [];
  };
  const scopeMismatch: string[] = [];
  for (const l of layout) for (const v of l.variables) {
    const expect = scopeFor(v.name);
    if (JSON.stringify(v.scopes) !== JSON.stringify(expect)) scopeMismatch.push(`${l.$mode}:${v.name}=${v.scopes.join(',')} (want ${expect.join(',')})`);
  }
  ok(scopeMismatch.length === 0, 'figma layout: scopes narrow per family (grid.columns→ALL_SCOPES; grid.gutter/margin→GAP; container/*+breakpoint/*→WIDTH_HEIGHT)' + (scopeMismatch.length ? ` — ${scopeMismatch.slice(0, 3).join('; ')}` : ''));

  // (e) grid/gutter + grid/margin are ALIASES into space/* (per-mode — the
  // point of the mode column is that gutter+margin grow with the breakpoint).
  // Every alias must resolve to a real space var in the emitted dims artifact.
  const spaceNames = new Set(dims.space.variables.map((v) => v.name));
  const aliasBad: string[] = [];
  for (const l of layout) for (const v of l.variables) {
    if (v.name === 'grid/gutter' || v.name === 'grid/margin') {
      if (!v.alias) { aliasBad.push(`${l.$mode}:${v.name} has no alias`); continue; }
      if (!v.alias.name.startsWith('space/')) aliasBad.push(`${l.$mode}:${v.name} → ${v.alias.name} (want space/*)`);
      if (!spaceNames.has(v.alias.name)) aliasBad.push(`${l.$mode}:${v.name} → ${v.alias.name} (not in space collection)`);
    }
  }
  ok(aliasBad.length === 0, 'figma layout: grid/gutter + grid/margin alias into space/* (per-mode) and every target resolves' + (aliasBad.length ? ` — ${aliasBad.slice(0, 3).join('; ')}` : ''));

  // (f) grid/columns is a plain FLOAT (no alias — it's a count, not a
  // dimension). columns matches the DTCG's per-breakpoint value.
  const colsBad: string[] = [];
  for (const l of layout) {
    const cols = l.variables.find((v) => v.name === 'grid/columns');
    if (!cols) { colsBad.push(`${l.$mode}: no grid/columns`); continue; }
    if (cols.alias !== null) colsBad.push(`${l.$mode}: grid/columns has alias (want plain FLOAT)`);
    const dtcg = brand.grid[l.$mode].columns.$value;
    if (cols.value !== dtcg) colsBad.push(`${l.$mode}: grid/columns=${cols.value} ≠ DTCG ${dtcg}`);
  }
  ok(colsBad.length === 0, 'figma layout: grid/columns is a plain FLOAT count matching the DTCG per-breakpoint value' + (colsBad.length ? ` — ${colsBad.slice(0, 3).join('; ')}` : ''));

  // (g) container/max + container/narrow are viewport-invariant — SAME value
  // in every mode. Same for breakpoint/* (min-width thresholds are constants;
  // the breakpoint COLUMN varies, but each named breakpoint's px is fixed).
  const invariantBad: string[] = [];
  for (const name of ['container/max', 'container/narrow', 'breakpoint/sm', 'breakpoint/md', 'breakpoint/lg', 'breakpoint/xl', 'breakpoint/2xl']) {
    const vals = layout.map((l) => l.variables.find((v) => v.name === name)?.value);
    const distinct = new Set(vals);
    if (distinct.size !== 1) invariantBad.push(`${name} varies across modes: ${[...distinct].join(',')}`);
  }
  ok(invariantBad.length === 0, 'figma layout: container/* + breakpoint/* are viewport-invariant (same value in every mode)' + (invariantBad.length ? ` — ${invariantBad.slice(0, 3).join('; ')}` : ''));

  // (h) container/fluid is INTENTIONALLY SKIPPED — Figma has no FLOAT primitive
  // for `100%` (percentage-of-parent). Same class of "no Figma primitive" skip
  // as focus.ring.style in the dims axis. This is a load-bearing skip: it
  // documents the intentional omission so a future contributor doesn't add it
  // back by mistake.
  const hasFluid = layout.some((l) => l.variables.some((v) => v.name === 'container/fluid'));
  ok(!hasFluid, `figma layout: container/fluid (100%) is intentionally skipped (no Figma primitive for percentage-of-parent; stays code-side)`);

  // (i) A variable count sanity — the exact shape a Figma-MCP materialiser
  // will import: 10 vars × 5 modes (5 breakpoint + 3 grid + 2 container).
  ok(layout[0].variables.length === 10, `figma layout: 10 vars per mode (5 breakpoint + 3 grid + 2 container) — got ${layout[0].variables.length}`);
}

// (19b) CR-08 (#65) — the layout axis must follow the brand's ACTUAL breakpoints, not a hardcoded
// 5. AURORA ships SIX breakpoints (xs..2xl); `buildFigmaLayout` used to iterate LAYOUT_MODES
// (sm..2xl) and read gridNode[mode] by name, silently DROPPING aurora's base `xs` grid (0px,
// 4-col mobile-first) on every regen while still emitting `breakpoint/xs` as a constant — an
// internally inconsistent artifact. This gates the emit LAYER on a non-5-breakpoint brand (the
// engine grid layer was tested, the Figma emit layer wasn't — the gate blind spot the review named).
{
  const aurora = brandTheme(parseDesignMd(readFileSync(resolve(HERE, '../examples/aurora.design.md'), 'utf8')).input);
  const { tree } = buildTree(aurora);
  const brand = tree[Object.keys(tree)[0]];
  const gridKeys = Object.keys(brand.grid); // [xs, sm, md, lg, xl, 2xl]
  const layout = buildFigmaLayout(aurora);
  const dims = buildFigmaDims(aurora);
  ok(gridKeys.length === 6 && gridKeys[0] === 'xs', `CR-08: aurora ships 6 breakpoints starting at xs (got [${gridKeys.join(',')}])`);
  ok(layout.length === 6 && layout.map((l) => l.$mode).join(',') === gridKeys.join(','), `CR-08: aurora emits a layout mode per breakpoint incl. the base xs (got [${layout.map((l) => l.$mode).join(',')}])`);
  const xs = layout.find((l) => l.$mode === 'xs');
  const xsCols = xs?.variables.find((v) => v.name === 'grid/columns');
  ok(!!xsCols && xsCols.value === brand.grid.xs.columns.$value, `CR-08: the xs grid carries aurora's base column count (${brand.grid.xs.columns.$value}), not dropped`);
  const spaceNames = new Set(dims.space.variables.map((v) => v.name));
  const dangling = layout.flatMap((l) => l.variables.filter((v) => v.alias && !spaceNames.has(v.alias.name)).map((v) => `${l.$mode}:${v.name}`));
  ok(dangling.length === 0, `CR-08: every aurora layout alias resolves into space/* across all 6 modes (${dangling.length} dangling)`);
  ok(layout[0].variables.length === 11, `CR-08: aurora emits 11 vars per mode (6 breakpoint + 3 grid + 2 container), got ${layout[0].variables.length}`);
}

// (20) EMIT-FIGMA MODE OPT-OUT (post-#42 follow-up; #45 audit; reviewer flag on #46).
// BrandInput.modes lets a brand ship any subset of {light, dark, hc-light, hc-dark}.
// emit-figma's colour axis previously hardcoded all four; a light-only brand's
// output would silently carry color.dark.json with light values (the alias fallback).
// The fix reads theme.modes and intersects with the canonical COLOR_MODES ordering.
// Gates: (a) NB (opts into all four) → four files, byte-identical to the pre-fix world
// (asserted by the existing block 3 golden — this block adds mode-count coverage);
// (b) light-only → ONE color file, `color.light.json`, no dark/hc-* silently emitted;
// (c) [light,dark] → TWO files in canonical order; (d) canonical ORDER preserved
// regardless of the order the user typed modes into their brief; (e) shadow already
// gated the dark-mode extension key present (block 14 (e)) — reconfirm here that a
// light-only brand emits NO shadow-dark/* styles (defensive, since the shadow builder
// iterates $extensions.prism3.modes.dark and would emit if it existed).
{
  const { input } = parseDesignMd(readFileSync(resolve(HERE, '../examples/aurora.design.md'), 'utf8'));

  // (a) default (all four modes) — unchanged from the shipped world
  const full = brandTheme(input);
  const fullColor = buildFigmaColor(full).color;
  ok(fullColor.length === 4, `emit-figma mode opt-out: default brand emits four color files (got ${fullColor.length})`);
  ok(fullColor.map((f) => f.$mode).join(',') === 'light,dark,hc-light,hc-dark', `emit-figma mode opt-out: default order is light,dark,hc-light,hc-dark`);

  // (b) light-only — ONE file, the load-bearing fix
  const lo = brandTheme({ ...input, modes: ['light'] });
  const loColor = buildFigmaColor(lo).color;
  ok(loColor.length === 1, `emit-figma mode opt-out: light-only brand emits ONE color file (got ${loColor.length})`);
  ok(loColor[0].$mode === 'light', `emit-figma mode opt-out: light-only emits color.light.json (got color.${loColor[0].$mode}.json)`);
  // The pre-fix bug would emit four files here — the alias fallback in the light branch
  // would silently carry through. This gate is the fix's regression fence.
  ok(loColor.every((f) => f.$mode === 'light'), `emit-figma mode opt-out: NO silent dark/hc-* emission for a light-only brand`);

  // Shadow: a light-only brand emits NO shadow-dark/* styles (defensive — block 14 (e)
  // already asserted the dark extension exists for NB; here we assert the negative).
  const loShadow = buildFigmaShadow(lo);
  const loDarkShadows = loShadow.styles.filter((s) => s.name.startsWith('shadow-dark/'));
  ok(loDarkShadows.length === 0, `emit-figma mode opt-out: light-only brand emits NO shadow-dark/* styles (got ${loDarkShadows.length})`);

  // (c) [light, dark] — two files, canonical order
  const ld = brandTheme({ ...input, modes: ['light', 'dark'] });
  const ldColor = buildFigmaColor(ld).color;
  ok(ldColor.length === 2, `emit-figma mode opt-out: [light,dark] emits two color files (got ${ldColor.length})`);
  ok(ldColor.map((f) => f.$mode).join(',') === 'light,dark', `emit-figma mode opt-out: [light,dark] modes in canonical order (got ${ldColor.map((f) => f.$mode).join(',')})`);

  // (d) canonical ORDER preserved regardless of user-typed order. Typing [light, hc-light, dark]
  // should still emit light,dark,hc-light (canonical), not the typed order.
  const shuffled = brandTheme({ ...input, modes: ['light', 'hc-light', 'dark'] });
  const shColor = buildFigmaColor(shuffled).color;
  ok(shColor.map((f) => f.$mode).join(',') === 'light,dark,hc-light',
    `emit-figma mode opt-out: canonical order preserved regardless of user-typed order (got ${shColor.map((f) => f.$mode).join(',')})`);

  // (e) every emitted color file's per-role value comes from the RIGHT mode extension
  // (not a silent light fallback). For [light, dark]: the dark file's interactive.primary.fill.rest
  // value must equal the dark extension's alias target, not the light $value.
  const ldTree = (buildTree(ld).tree as any)[Object.keys(buildTree(ld).tree)[0]];
  const darkFile = ldColor.find((f) => f.$mode === 'dark')!;
  const darkAction = darkFile.variables.find((v) => v.name === 'color/interactive/primary/fill/rest')!;
  const darkExtAlias = ldTree.color.interactive.primary.fill.rest.$extensions.prism3.modes.dark.$value.replace(/^\{|\}$/g, '');
  ok(darkAction.alias?.name === figName(darkExtAlias),
    `emit-figma mode opt-out: dark file's color/interactive/primary/fill/rest alias is the DARK extension target, not a light fallback (got ${darkAction.alias?.name}, want ${figName(darkExtAlias)})`);
}

// (21) EMIT-FIGMA GENERALISE (docs/10 §7 item 6) — the queue's closing check:
// the emit-figma adapter is brand-agnostic. Run it against aurora (engine-native
// design.md, opts INTO gradients, action = accent) and wendys (STANDARD-dialect
// through parseStandard + classifier + brandTheme) and gate every axis. This
// isn't asserting fixture byte-identity (no fixtures for these brands — §2 only
// freezes NB colour + typography); the gate is that (a) every axis produces
// output with the right shape, (b) every alias resolves WITHIN each brand's
// own emitted collections, (c) the namespace transform (figName) strips
// whichever root the brand carries — aurora=prism (default), wendys=prism
// (default), NB=nbds — with no leakage across brands, and (d) the aurora
// gradient axis actually ships alias-driven stops that resolve to palette leaves
// in the aurora tree (the alias-driven Paint Style form parked in the shadow +
// gradient PR now materialises through the generalise pass).
{
  const auroraTheme = brandTheme(parseDesignMd(readFileSync(resolve(HERE, '../examples/aurora.design.md'), 'utf8')).input);
  const wendysStd = parseStandardDesignMd(readFileSync(resolve(HERE, '../examples/wendys.design.md'), 'utf8'));
  const wendysTheme = brandTheme(standardToBrandInput(wendysStd).input);

  // Each brand runs through every axis. We assert structural claims uniformly:
  // - palette + color(×4 modes when default) shape correct
  // - every alias in EACH brand's emitted collections resolves WITHIN that brand
  // - namespace lever holds — figName strips the brand's own root exactly once
  // - every axis produces non-empty output where it should (gradient is opt-in;
  //   aurora HAS gradients, wendys does not)
  for (const [id, theme] of [['aurora', auroraTheme], ['wendys', wendysTheme]] as const) {
    const { palette, color } = buildFigmaColor(theme);
    const dims = buildFigmaDims(theme);
    const layout = buildFigmaLayout(theme);
    const font = buildFigmaFont(theme);
    const fluid = buildFigmaFontFluid(theme);
    const textStyles = buildFigmaTextStyles(theme);
    const shadow = buildFigmaShadow(theme);
    const gradient = buildFigmaGradient(theme);

    // (a) Shape sanity — colour + palette + font + fluid + text-styles all present.
    ok(palette.variables.length > 0, `figma generalise (${id}): palette has variables (${palette.variables.length})`);
    ok(color.length === 4, `figma generalise (${id}): 4 colour modes emitted (default all four; got ${color.length})`);
    ok(color.every((c) => c.variables.length === color[0].variables.length), `figma generalise (${id}): every colour mode file has the same variable-name set`);
    ok(font.variables.length > 0, `figma generalise (${id}): font primitives emitted (${font.variables.length})`);
    ok(fluid.length === 2 && fluid.every((f) => f.variables.length > 0), `figma generalise (${id}): font-fluid has both mobile + desktop modes`);
    ok(textStyles.styles.length > 0, `figma generalise (${id}): text-styles emitted (${textStyles.styles.length})`);
    ok(shadow.styles.length > 0, `figma generalise (${id}): shadow effect styles emitted (${shadow.styles.length})`);
    const gridKeys = (() => { const t = buildTree(theme).tree; return Object.keys(t[Object.keys(t)[0]].grid); })();
    ok(layout.length === gridKeys.length && layout.map((l) => l.$mode).join(',') === gridKeys.join(','), `figma generalise (${id}): one layout mode file per breakpoint [${gridKeys.join(',')}] — got [${layout.map((l) => l.$mode).join(',')}]`); // CR-08: follows the brand's breakpoints (aurora 6 / wendys 5)

    // (b) COLOUR aliases — every per-mode alias name resolves within palette (name-based).
    const paletteNames = new Set(palette.variables.map((v) => v.name));
    const colorAliasBad: string[] = [];
    for (const c of color) for (const v of c.variables) {
      if (!v.alias || !paletteNames.has(v.alias.name)) colorAliasBad.push(`${c.$mode}:${v.name} → ${v.alias?.name ?? '<none>'}`);
    }
    ok(colorAliasBad.length === 0, `figma generalise (${id}): every colour alias resolves to a real palette variable within THIS brand` + (colorAliasBad.length ? ` — ${colorAliasBad.slice(0, 3).join(', ')}` : ''));

    // (c) DIMS aliases — cross-collection resolution within the 7 emitted collections.
    const dimNames = new Set<string>();
    const allDimColls = [dims.dimension, dims.space, dims.radius[0], dims.size, dims.borderWidth, dims.focus, dims.opacity];
    for (const c of allDimColls) for (const v of c.variables) dimNames.add(v.name);
    const dimsAliasBad: string[] = [];
    for (const c of allDimColls) for (const v of c.variables) {
      if (v.alias && !dimNames.has(v.alias.name)) dimsAliasBad.push(`${c.$collection}:${v.name} → ${v.alias.name}`);
    }
    ok(dimsAliasBad.length === 0, `figma generalise (${id}): every dims alias resolves within the emitted collections` + (dimsAliasBad.length ? ` — ${dimsAliasBad.slice(0, 3).join(', ')}` : ''));

    // (d) LAYOUT aliases — grid/gutter + grid/margin resolve into THIS brand's space collection.
    const spaceNames = new Set(dims.space.variables.map((v) => v.name));
    const layoutAliasBad: string[] = [];
    for (const l of layout) for (const v of l.variables) {
      if (v.name === 'grid/gutter' || v.name === 'grid/margin') {
        if (!v.alias || !spaceNames.has(v.alias.name)) layoutAliasBad.push(`${l.$mode}:${v.name} → ${v.alias?.name ?? '<none>'}`);
      }
    }
    ok(layoutAliasBad.length === 0, `figma generalise (${id}): every layout grid alias resolves within THIS brand's space collection` + (layoutAliasBad.length ? ` — ${layoutAliasBad.slice(0, 3).join(', ')}` : ''));

    // (e) NAMESPACE strip — Figma variable names carry no brand prefix. figName
    // strips exactly one root segment; walking every emitted name proves the
    // transform is idempotent regardless of what root the brand carries. NB
    // uses `nbds`; aurora + wendys both default to `prism` (no leakage back
    // into the emitted names).
    const allEmittedNames: string[] = [
      ...palette.variables.map((v) => v.name),
      ...color.flatMap((c) => c.variables.map((v) => v.name)),
      ...allDimColls.flatMap((c) => c.variables.map((v) => v.name)),
      ...layout.flatMap((l) => l.variables.map((v) => v.name)),
      ...font.variables.map((v) => v.name),
      ...fluid.flatMap((f) => f.variables.map((v) => v.name)),
    ];
    const namespaceLeaks = allEmittedNames.filter((n) => n.startsWith('prism/') || n.startsWith('nbds/') || n.startsWith('acme/'));
    ok(namespaceLeaks.length === 0, `figma generalise (${id}): no brand-namespace leakage in emitted variable names (${allEmittedNames.length} names checked)` + (namespaceLeaks.length ? ` — LEAKS: ${namespaceLeaks.slice(0, 3).join(', ')}` : ''));
  }

  // (f) AURORA GRADIENTS — the alias-driven Paint Style form. Aurora opts in
  // (gradients: true, custom array); its gradient axis emits ≥1 style, every
  // stop carries a real alias, and every alias resolves to a palette leaf in
  // aurora's DTCG tree.
  const auroraGradient = buildFigmaGradient(auroraTheme);
  ok(auroraGradient.styles.length > 0, `figma generalise (aurora): gradient axis emits ≥1 style (got ${auroraGradient.styles.length})`);
  const auroraTree = buildTree(auroraTheme).tree as any;
  const auroraRoot = Object.keys(auroraTree)[0];
  const stopAliasBad: string[] = [];
  for (const s of auroraGradient.styles) for (const stop of s.stops) {
    if (!stop.alias) { stopAliasBad.push(`${s.name}@${stop.position} has no alias`); continue; }
    const dottedPath = `${auroraRoot}.${stop.alias.replace(/\//g, '.')}`;
    const leaf = dottedPath.split('.').reduce((n: any, seg) => n?.[seg], auroraTree);
    if (!leaf || leaf.$type !== 'color') stopAliasBad.push(`${s.name}@${stop.position} → ${stop.alias} does not resolve to a colour leaf`);
  }
  ok(stopAliasBad.length === 0, `figma generalise (aurora): every gradient stop alias resolves to a colour leaf in aurora's DTCG` + (stopAliasBad.length ? ` — ${stopAliasBad.slice(0, 3).join('; ')}` : ''));

  // (g) WENDYS carries no gradients (didn't opt in) — the axis emits an empty
  // consistent shape, exactly like NB. Documents that opt-in works negatively
  // on the standard-dialect front door too.
  const wendysGradient = buildFigmaGradient(wendysTheme);
  ok(wendysGradient.styles.length === 0 && wendysGradient.$collection === 'gradient-styles', `figma generalise (wendys): no gradients opted in → empty consistent-shape file (collection='gradient-styles')`);
}

// (22) EMIT-FIGMA WIREFRAME (docs/10 §7 item 1; docs/11 Pillar 1b — #48 in the engine,
// this PR in emit-figma). `'wireframe'` is a valid opt-in mode: two materialisation
// changes fire, gated behind `theme.modes.includes('wireframe')` so the default four-mode
// world is unchanged.
//
//   (a) COLOUR — the color collection gains a `wireframe` MODE. Every role's
//       `$extensions.prism3.modes.wireframe.$value` (already emitted by tree.ts) aliases
//       a `palette/neutral/*` step (greyscale); the emit-figma iteration path is the same
//       as dark/hc-* — the load-bearing change is `COLOR_MODES` gaining `'wireframe'` so
//       the intersection with `theme.modes` picks it up.
//   (b) GEOMETRY — this is the NEW shape. Non-zero `radius.*` DTCG leaves carry a
//       `$extensions.prism3.modes.wireframe → {root.dimension.0}` override (tree.ts).
//       emit-figma materialises that as a wireframe MODE on the `radius` variable
//       collection: `radius/*` in the wireframe mode file aliases `dimension/0`.
//       `radius.none` (already 0) carries no override in the DTCG → stays 0 in both modes.
//       This is the FIRST non-colour/shadow axis to be MODE-VARYING, and the
//       load-bearing precedent for any future mode-varying geometry.
//
// No example brand opts into wireframe today, so we gate against a SYNTHETIC
// wireframe-enabled brand (same pattern as blocks 18 + 20: `brandTheme({ …input,
// modes: [..., 'wireframe'] })`). Default (four-mode) behaviour is untouched —
// verified by the byte-identical `out/*` regeneration and blocks 3/11 still green.
{
  const { input } = parseDesignMd(readFileSync(resolve(HERE, '../examples/aurora.design.md'), 'utf8'));

  // ---- COLOUR AXIS ----------------------------------------------------------
  // (a1) A default (no wireframe) brand emits four colour files — same as pre-1b. This
  // asserts wireframe adds no silent phantom mode; block 20 (d) already checks canonical
  // ordering — this reconfirms the four-file world stays four files when wireframe is off.
  const def = brandTheme(input);
  const defColor = buildFigmaColor(def).color;
  ok(defColor.length === 4, `emit-figma wireframe: default (no wireframe) still emits 4 colour files (got ${defColor.length})`);
  ok(!defColor.some((c) => c.$mode === 'wireframe'), `emit-figma wireframe: no phantom wireframe file when the brand didn't opt in`);

  // (a2) Synthetic wireframe-opted-in brand — colour axis gains a 5th mode file, canonical
  // position last (matches COLOR_MODES order). Every role's per-mode value comes from
  // the wireframe extension in the DTCG tree, not a silent light fallback.
  const wf = brandTheme({ ...input, modes: ['light', 'dark', 'hc-light', 'hc-dark', 'wireframe'] });
  const wfColor = buildFigmaColor(wf).color;
  ok(wfColor.length === 5, `emit-figma wireframe: opted-in brand emits 5 colour files (got ${wfColor.length})`);
  ok(wfColor.map((c) => c.$mode).join(',') === 'light,dark,hc-light,hc-dark,wireframe',
    `emit-figma wireframe: canonical mode order preserved (got ${wfColor.map((c) => c.$mode).join(',')})`);
  const wfMode = wfColor.find((c) => c.$mode === 'wireframe')!;

  // (a3) The wireframe file's role names + shape match the light file (same variable
  // set — modes carry the same names by different values, per docs/06 §7b).
  const lightNames = new Set(wfColor.find((c) => c.$mode === 'light')!.variables.map((v) => v.name));
  const wfNames = new Set(wfMode.variables.map((v) => v.name));
  ok(lightNames.size === wfNames.size && [...lightNames].every((n) => wfNames.has(n)),
    `emit-figma wireframe: wireframe file carries the same variable-name set as light (${lightNames.size} vars)`);

  // (a4) Every wireframe-mode alias points at a `palette/neutral/*` step (greyscale —
  // the point of the mode). Also verify per-role that the alias matches the DTCG
  // extension target byte-for-byte (no silent light fallback).
  const wfTreeBuilt = buildTree(wf);
  const wfTree = (wfTreeBuilt.tree as any)[wf.root];
  const nonNeutralAliases: string[] = [];
  const mismatchedAliases: string[] = [];
  for (const v of wfMode.variables) {
    // trace the DTCG leaf back for this Figma name (color/<family>/…)
    const dtcgPath = v.name.split('/').slice(1); // drop the 'color' segment
    let node: any = wfTree.color;
    for (const seg of dtcgPath) node = node?.[seg];
    if (!node) continue;
    const ext = node.$extensions?.prism3?.modes?.wireframe?.$value;
    if (typeof ext !== 'string') continue; // some roles may keep the light value in wireframe (already-neutral); accept whatever the tree emits
    const wantName = figName(ext.replace(/^\{|\}$/g, ''));
    if (v.alias?.name !== wantName) mismatchedAliases.push(`${v.name} → ${v.alias?.name} (want ${wantName})`);
    if (v.alias && !v.alias.name.startsWith('palette/neutral/') && !v.alias.name.startsWith('palette/white') && !v.alias.name.startsWith('palette/black')) {
      // Wireframe is a greyscale mode — every chromatic role should route to the neutral
      // ramp (or pure white/black for those specific primitive roles).
      nonNeutralAliases.push(`${v.name} → ${v.alias.name}`);
    }
  }
  ok(mismatchedAliases.length === 0, `emit-figma wireframe: every wireframe-mode alias matches the DTCG wireframe extension exactly (no silent fallback)` + (mismatchedAliases.length ? ` — ${mismatchedAliases.slice(0, 3).join('; ')}` : ''));
  ok(nonNeutralAliases.length === 0, `emit-figma wireframe: every wireframe alias routes to palette/neutral/* (greyscale contract)` + (nonNeutralAliases.length ? ` — ${nonNeutralAliases.slice(0, 3).join('; ')}` : ''));

  // (a5) The wireframe file's non-alias fallback values (belt-and-suspenders {r,g,b,a})
  // are neutral too — verify a representative saturated role (interactive.primary.fill.rest
  // in the light file uses the accent palette; wireframe collapses to neutral). Structural
  // proof the value shipped alongside the alias is the neutral colour, not the light
  // chromatic one.
  const wfAction = wfMode.variables.find((v) => v.name === 'color/interactive/primary/fill/rest')!;
  const lightAction = wfColor.find((c) => c.$mode === 'light')!.variables.find((v) => v.name === 'color/interactive/primary/fill/rest')!;
  const rgbDist = Math.abs((wfAction.value as any).r - (wfAction.value as any).g)
                + Math.abs((wfAction.value as any).g - (wfAction.value as any).b);
  const lightRgbDist = Math.abs((lightAction.value as any).r - (lightAction.value as any).g)
                     + Math.abs((lightAction.value as any).g - (lightAction.value as any).b);
  ok(rgbDist < 0.02, `emit-figma wireframe: color/interactive/primary/fill/rest resolves to a neutral (r≈g≈b, spread ${rgbDist.toFixed(3)})`);
  ok(lightRgbDist > 0.05, `emit-figma wireframe: baseline sanity — light action is CHROMATIC (spread ${lightRgbDist.toFixed(3)}, > 0.05)`);

  // ---- GEOMETRY AXIS — the NEW mode-varying shape (radius) ------------------
  // (b1) Default (no wireframe) brand's `radius` remains a single Default-mode file —
  // byte-identical to the pre-1b world. Non-wireframe brands ship as before.
  const defDims = buildFigmaDims(def);
  ok(Array.isArray(defDims.radius) && defDims.radius.length === 1, `emit-figma wireframe: non-wireframe brand's radius is a single Default file (got length ${defDims.radius.length})`);
  ok(defDims.radius[0].$mode === 'Default', `emit-figma wireframe: non-wireframe brand's radius mode is Default (got ${defDims.radius[0].$mode})`);

  // (b2) Wireframe-opted-in brand's `radius` collection carries TWO modes — Default
  // + wireframe. Both files carry the same variable-name set (mode column is the
  // value axis, same shape as colour). This is the FIRST non-colour/shadow axis
  // to be mode-varying — the load-bearing precedent for future mode-varying
  // geometry (docs/00 progress + docs/11 Pillar 1b).
  const wfDims = buildFigmaDims(wf);
  ok(wfDims.radius.length === 2, `emit-figma wireframe: wireframe-opted brand's radius has 2 modes (got ${wfDims.radius.length})`);
  const modeSeq = wfDims.radius.map((r) => r.$mode).join(',');
  ok(modeSeq === 'Default,wireframe', `emit-figma wireframe: radius modes in canonical order Default,wireframe (got ${modeSeq})`);

  const defaultRadiusFile = wfDims.radius[0];
  const wfRadiusFile = wfDims.radius[1];
  const defaultNames = new Set(defaultRadiusFile.variables.map((v) => v.name));
  const wfRadiusNames = new Set(wfRadiusFile.variables.map((v) => v.name));
  ok(defaultNames.size === wfRadiusNames.size && [...defaultNames].every((n) => wfRadiusNames.has(n)),
    `emit-figma wireframe: radius wireframe mode carries the same variable-name set as Default (${defaultNames.size} vars)`);

  // (b3) Every NON-ZERO radius var aliases `dimension/0` in the wireframe mode. Zero
  // radius (`radius.none`) stays 0 with no override (matches tree.ts:345 — the
  // "already-0 needs no override" invariant), so its wireframe entry keeps its
  // Default alias.
  const wfAliasBad: string[] = [];
  for (const wfVar of wfRadiusFile.variables) {
    const defVar = defaultRadiusFile.variables.find((v) => v.name === wfVar.name)!;
    if (defVar.value === 0) {
      // Zero radius keeps its Default form — the DTCG carries no wireframe override.
      if (wfVar.value !== 0) wfAliasBad.push(`${wfVar.name}: zero-radius should stay 0 in wireframe (got ${wfVar.value})`);
    } else {
      // Non-zero radius must alias dimension/0 (value 0) in the wireframe mode.
      if (wfVar.value !== 0) wfAliasBad.push(`${wfVar.name}: non-zero-radius should be 0 in wireframe (got ${wfVar.value})`);
      if (wfVar.alias?.name !== 'dimension/0') wfAliasBad.push(`${wfVar.name}: alias=${wfVar.alias?.name} (want dimension/0)`);
    }
  }
  ok(wfAliasBad.length === 0, `emit-figma wireframe: every non-zero radius aliases dimension/0 in wireframe mode; radius.none stays 0` + (wfAliasBad.length ? ` — ${wfAliasBad.slice(0, 3).join('; ')}` : ''));

  // (b4) Default-mode radius file for the wireframe-opted brand is IDENTICAL in shape
  // (name, scopes, value, alias) to the non-wireframe brand's radius file — the
  // Default mode is the light-canonical world; wireframe is purely additive. This
  // gates the invariant that opting into wireframe never mutates the Default mode.
  const defRadiusFile = defDims.radius[0];
  const shapeDrift: string[] = [];
  for (const dv of defRadiusFile.variables) {
    const wv = defaultRadiusFile.variables.find((v) => v.name === dv.name);
    if (!wv) { shapeDrift.push(`${dv.name}: missing in wireframe-opted Default file`); continue; }
    if (dv.value !== wv.value) shapeDrift.push(`${dv.name}: value ${dv.value} vs ${wv.value}`);
    if ((dv.alias?.name ?? null) !== (wv.alias?.name ?? null)) shapeDrift.push(`${dv.name}: alias ${dv.alias?.name} vs ${wv.alias?.name}`);
    if (JSON.stringify(dv.scopes) !== JSON.stringify(wv.scopes)) shapeDrift.push(`${dv.name}: scopes ${dv.scopes.join(',')} vs ${wv.scopes.join(',')}`);
  }
  ok(shapeDrift.length === 0, `emit-figma wireframe: opting in preserves Default-mode radius byte-shape (name/value/alias/scopes)` + (shapeDrift.length ? ` — ${shapeDrift.slice(0, 3).join('; ')}` : ''));
}

// ---------------------------------------------------- M-08: parseColor loud-fail + hex forms
// parseColor used to return a silent {0,0,0,1} BLACK for anything it couldn't parse —
// so an unresolvable alias target (`parseColor(undefined)`) or a malformed value would
// ship a black swatch carrying a dangling alias. Now it (a) handles 3-digit and 8-digit
// hex, and (b) THROWS on genuinely unparseable input rather than degrading to black.
{
  const eq = (a: any, b: any) => a.r === b.r && a.g === b.g && a.b === b.b && a.a === b.a;

  // 3-digit hex expands like CSS: #f00 → #ff0000.
  ok(eq(parseColor('#f00'), parseColor('#ff0000')), 'M-08: 3-digit hex #f00 expands to #ff0000');
  ok(eq(parseColor('#abc'), parseColor('#aabbcc')), 'M-08: 3-digit hex #abc expands to #aabbcc');

  // 8-digit hex carries the alpha byte.
  const withAlpha = parseColor('#12345678');
  ok(withAlpha.a === Math.fround(0x78 / 255), `M-08: 8-digit hex #RRGGBBAA parses alpha (got a=${withAlpha.a})`);
  ok(withAlpha.r === Math.fround(0x12 / 255) && withAlpha.g === Math.fround(0x34 / 255) && withAlpha.b === Math.fround(0x56 / 255), 'M-08: 8-digit hex parses RGB alongside alpha');

  // 6-digit hex + rgb()/rgba() still work (no regression).
  ok(eq(parseColor('#ffffff'), { r: 1, g: 1, b: 1, a: 1 }), 'M-08: 6-digit hex still parses');
  ok(parseColor('rgba(0, 0, 0, 0.6)').a === Math.fround(0.6), 'M-08: rgba() alpha still parses');
  ok(parseColor('rgb(255, 0, 0)').r === 1, 'M-08: rgb() still parses');

  // The load-bearing change: unparseable input THROWS (loud-fail), never a silent black.
  const throws = (v: unknown, label: string) => {
    let threw = false;
    try { parseColor(v); } catch { threw = true; }
    ok(threw, `M-08: parseColor(${label}) THROWS instead of returning silent black`);
  };
  throws(undefined, 'undefined');           // the unresolvable-alias path (targetLeaf?.$value)
  throws('{prism.color.no.such.role}', 'an unresolved brace alias'); // a raw alias reaching the emitter
  throws('not-a-colour', 'garbage');
  throws('#ff', '2-digit hex');             // not a valid hex length
}

// ---------------------------------------------------- M-09: space alias guarded like siblings
// buildFigmaDims emitted the `space` alias UNCONDITIONALLY — so a space leaf carrying a
// raw px value (not a `{…}` reference) would ship `alias.name: ''` (a dangling empty-named
// binding). Every sibling axis (radius/size/border/focus) guards with `isAlias ? … : null`;
// space now matches.
{
  const dims = buildFigmaDims(nbTheme());

  // Engine brands alias every space step into dimension — so all aliases resolve to a
  // non-empty `dimension/*` name, and NONE carries the empty-string dangling name that
  // the pre-M-09 unconditional-alias code would emit off a non-brace value.
  const emptyNamed = dims.space.variables.filter((v) => v.alias && !v.alias.name);
  ok(emptyNamed.length === 0, `M-09: no space var ships an empty-named alias (got ${emptyNamed.length})`);
  ok(dims.space.variables.every((v) => v.alias && v.alias.name.startsWith('dimension/')), 'M-09: every space var aliases a dimension/* primitive');

  // The invariant the guard enforces: a space alias is either null or a NON-EMPTY
  // VARIABLE_ALIAS — never the `{ name: '' }` dangling binding. This is the same shape
  // contract radius/size/border/focus already satisfy; space now joins them.
  ok(dims.space.variables.every((v) => v.alias === null || (v.alias.type === 'VARIABLE_ALIAS' && v.alias.name.length > 0)),
    'M-09: every space alias is either null or a non-empty VARIABLE_ALIAS (never { name: \'\' })');
}

// ---------------------------------------------------- MCP adapter (docs/08 §5, roadmap C)
// The agent-callable surface over the core: dependency-free JSON-RPC. Gate the handshake,
// the tool catalogue, the "derives from the lever manifest" tie, and a full theme_brand
// round-trip — all against the PURE handleRpc/callTool (no stdio needed).
{
  const brandSchema = JSON.parse(readFileSync(resolve(HERE, '../schema/theme-schema.json'), 'utf8'));
  const rpc = (method: string, params?: any) => handleRpc({ jsonrpc: '2.0', id: 1, method, params }, brandSchema);

  // handshake
  const init = rpc('initialize');
  ok((init?.result as any)?.protocolVersion && (init?.result as any)?.serverInfo?.name === 'prism3-engine', 'MCP: initialize returns protocolVersion + serverInfo');
  ok(rpc('notifications/initialized') === null, 'MCP: a notification (initialized) gets no response');
  ok((rpc('bogus/method') as any)?.error?.code === -32601, 'MCP: an unknown method → JSON-RPC -32601 (method not found)');

  // tool catalogue
  const tools = (rpc('tools/list')?.result as any)?.tools as any[];
  ok(Array.isArray(tools) && tools.map((t) => t.name).sort().join(',') === 'list_levers,theme_brand,validate_brand', 'MCP: tools/list advertises list_levers + theme_brand + validate_brand');
  ok(tools.find((t) => t.name === 'theme_brand')?.inputSchema === brandSchema, 'MCP: theme_brand inputSchema IS the BrandInput schema (precise OKLCH-aware shape)');
  ok(toolDefs(brandSchema).length === 3, 'MCP: toolDefs is a pure function of the brand schema');

  // list_levers derives from the manifest (can't drift — the surface IS the manifest)
  const leversText = (callTool('list_levers', {}).content[0].text);
  const leversPayload = JSON.parse(leversText);
  ok(leversPayload.levers.length === leverManifest.length && leversPayload.groups.length === leverGroups.length, 'MCP: list_levers returns the lever manifest verbatim (every lever an agent can turn)');

  // theme_brand round-trip: a valid brand → tokens + metadata + all contracts pass
  const themed = callTool('theme_brand', { id: 'mcp-probe', primary: { l: 0.5, c: 0.15, h: 250 }, neutral: { hue: 250, chroma: 0.01 } });
  ok(themed.isError !== true, 'MCP: theme_brand on a valid brand is not an error');
  const payload = JSON.parse(themed.content[0].text);
  ok(payload.tokens?.prism && payload.id === 'mcp-probe', 'MCP: theme_brand returns the DTCG token tree under the root namespace');
  ok(payload.contracts.checks > 0 && payload.contracts.pass === payload.contracts.checks && payload.contracts.failures.length === 0, `MCP: theme_brand reports all ${payload.contracts.checks} contrast contracts passing`);
  ok(payload.aliases.broken.length === 0 && payload.aliases.resolved === payload.aliases.total, 'MCP: theme_brand reports every alias resolving');
  ok(payload.aiMetadata && Array.isArray(payload.notes), 'MCP: theme_brand includes the .ai.json metadata + the decisions log');

  // validate_brand: bad input → errors; good input → clean; and theme_brand rejects a bad brand loudly
  ok(JSON.parse(callTool('validate_brand', { id: 'x' }).content[0].text).valid === false, 'MCP: validate_brand flags an incomplete brand (missing primary/neutral)');
  ok(JSON.parse(callTool('validate_brand', { id: 'ok', primary: { l: 0.5, c: 0.15, h: 250 }, neutral: { hue: 250, chroma: 0.01 } }).content[0].text).valid === true, 'MCP: validate_brand passes a complete brand');
  ok(callTool('theme_brand', { id: 'bad' }).isError === true, 'MCP: theme_brand on an invalid brand returns a tool-level error (isError), not a crash');
  ok(callTool('no_such_tool', {}).isError === true, 'MCP: an unknown tool name → isError result');
}

// ------------------------------------------- consumption eval (docs/17, roadmap C follow-on)
// The PURE, deterministic scoring half: given the token refs an agent's output uses + the tree,
// compute the invented-token rate (hallucination) and the primitive-leak rate (reaching past the
// semantic layer into palette/dimension/font). No LLM needed — the name contract is locked.
{
  const theme = brandTheme({ id: 'eval', primary: { l: 0.5, c: 0.15, h: 250 }, neutral: { hue: 250, chroma: 0.01 } });
  const { tree } = buildTree(theme);
  const paths = [...tokenPaths(tree, 'prism')];
  const semantic = paths.find((p) => !isPrimitiveRef(p))!;   // a real semantic leaf (color.*/space.* …)
  const primitive = paths.find((p) => isPrimitiveRef(p))!;   // a real primitive leaf (palette.*/dimension.*/font.*)
  ok(paths.length > 100 && !!semantic && !!primitive, `eval: tokenPaths enumerates the tree's leaves (${paths.length}) incl. semantic + primitive tiers`);
  ok(PRIMITIVE_TIERS.has('palette') && PRIMITIVE_TIERS.has('dimension') && PRIMITIVE_TIERS.has('font') && !PRIMITIVE_TIERS.has('color'),
    'eval: primitive tiers = palette/dimension/font (the core-* grouping); color is semantic');

  // all-semantic output → 0 invented, 0 leak
  const clean = scoreConsumption([semantic, semantic], tree, 'prism');
  ok(clean.invented.length === 0 && clean.inventedRate === 0 && clean.primitiveLeakRate === 0, 'eval: valid semantic refs → 0 invented, 0 primitive-leak');

  // invented refs (hallucinated token names) → counted with the right rate
  const inv = scoreConsumption(['color.nope.nope', 'space.999999', semantic], tree, 'prism');
  ok(inv.invented.length === 2 && inv.valid === 1 && Math.abs(inv.inventedRate - 2 / 3) < 1e-9, 'eval: nonexistent refs → invented, rate 2/3, the one real ref valid');

  // a primitive ref among valid refs → leak rate reflects reaching past the semantic layer
  const leak = scoreConsumption([primitive, semantic], tree, 'prism');
  ok(leak.invented.length === 0 && leak.primitiveLeaks.length === 1 && Math.abs(leak.primitiveLeakRate - 0.5) < 1e-9, 'eval: a primitive ref among 2 valid refs → primitive-leak rate 0.5');

  // normalizeRef: brace + root-qualified forms resolve identically to relative
  ok(normalizeRef(`{prism.${semantic}}`, 'prism') === semantic && normalizeRef(`prism.${semantic}`, 'prism') === semantic, 'eval: normalizeRef strips the brace wrapper + the root namespace');
  const braced = scoreConsumption([`{prism.${semantic}}`, `prism.${primitive}`], tree, 'prism');
  ok(braced.valid === 2 && braced.primitiveLeaks.length === 1, 'eval: braced + root-qualified refs normalise and score like relative refs');

  // occurrence-based rate: a duplicated invented ref counts twice in the rate, once in the list
  const dup = scoreConsumption(['color.nope.nope', 'color.nope.nope', semantic, semantic], tree, 'prism');
  ok(dup.invented.length === 1 && Math.abs(dup.inventedRate - 0.5) < 1e-9, 'eval: a repeated hallucination is listed once but rated by occurrence (2/4)');

  // empty → no NaN
  const empty = scoreConsumption([], tree, 'prism');
  ok(empty.total === 0 && empty.inventedRate === 0 && empty.primitiveLeakRate === 0, 'eval: empty ref list scores 0/0 without NaN');

  // contract compliance (docs/17 §4): did the agent pair legible colours, in every mode?
  const good = scoreContractCompliance([{ fg: 'color.text.primary', bg: 'color.background.primary' }], theme);
  ok(good.checked === 4 && good.pass === 4 && good.rate === 1 && good.failures.length === 0, 'eval: text.primary on background.primary clears 4.5 in all 4 modes (compliant)');
  const bad = scoreContractCompliance([{ fg: 'color.background.secondary', bg: 'color.background.primary' }], theme);
  ok(bad.pass === 0 && bad.failures.length === bad.checked && bad.checked > 0 && bad.rate === 0, 'eval: two adjacent page surfaces as a text pair fail 4.5 in every mode');
  ok(bad.failures.every((f) => f.min === 4.5) && bad.failures[0].ratio < 4.5, 'eval: a text-kind failure records the 4.5 floor + the (raw, rounded) ratio below it');
  // kind lowers the floor to 3 (WCAG 1.4.11 / large text)
  const ui = scoreContractCompliance([{ fg: 'color.background.secondary', bg: 'color.background.primary', kind: 'ui' }], theme);
  ok(ui.failures.every((f) => f.min === 3), 'eval: kind:ui/large-text drops the contract floor to 3:1');
  // mixed pass+fail → rate strictly between 0 and 1; unresolved pair flagged, not counted
  const mixed = scoreContractCompliance([
    { fg: 'color.text.primary', bg: 'color.background.primary' },
    { fg: 'color.background.secondary', bg: 'color.background.primary' },
    { fg: 'color.made.up.role', bg: 'color.background.primary' },
  ], theme);
  ok(mixed.rate > 0 && mixed.rate < 1, 'eval: a mix of passing + failing pairs → compliance rate between 0 and 1');
  ok(mixed.unresolved.length === 1 && /made\.up/.test(mixed.unresolved[0]), 'eval: a pair naming a non-colour role is reported unresolved, not scored');
  ok(scoreContractCompliance([], theme).rate === 1 && scoreContractCompliance([], theme).checked === 0, 'eval: no pairs → vacuously compliant (rate 1, checked 0), no NaN');
}

// -------------------------------------------- consumption-eval harness (docs/17 §3, eval-run.ts)
// The model call is INJECTED, so the whole pipeline (prompt → [mock model] → extract → score)
// is deterministic + gated without an LLM. A keyed shell swaps the mock for a real Claude client.
{
  const theme = brandTheme({ id: 'evalrun', primary: { l: 0.5, c: 0.15, h: 250 }, neutral: { hue: 250, chroma: 0.01 } });
  const { tree } = buildTree(theme);
  const paths = [...tokenPaths(tree, 'prism')];
  const S = paths.find((p) => !isPrimitiveRef(p))!, P = paths.find((p) => isPrimitiveRef(p))!;

  ok(SAMPLE_TASKS.length === 4 && SAMPLE_TASKS.every((t) => t.name && t.brief), 'eval-run: SAMPLE_TASKS is the 4-task fixed set');
  ok(buildPrompt(SAMPLE_TASKS, [S]).includes(S) && /reference ONLY these/.test(buildPrompt(SAMPLE_TASKS, [S])), 'eval-run: WITH-surface prompt embeds the catalogue');
  ok(/best guess/.test(buildPrompt(SAMPLE_TASKS)) && !buildPrompt(SAMPLE_TASKS).includes('reference ONLY'), 'eval-run: WITHOUT-surface prompt tells the agent to guess (no catalogue)');

  // extractRefs: JSON object, fenced JSON, and prose fallback
  ok(extractRefs('{"a":["x.y","z.w"]}').flat.join(',') === 'x.y,z.w', 'eval-run: extractRefs reads a JSON {task:[refs]} object');
  ok(extractRefs('```json\n{"a":["p.q"]}\n```').byTask.a?.[0] === 'p.q', 'eval-run: extractRefs tolerates ```json fences + surrounding prose');
  ok(extractRefs('use color.interactive.primary.fill.rest and space.400 here').flat.sort().join(',') === 'color.interactive.primary.fill.rest,space.400', 'eval-run: extractRefs falls back to scraping dotted paths from prose');

  // full run with a mock runner: 1 valid semantic + 1 invented + 1 valid primitive
  const mock = async () => JSON.stringify({ 'primary-button': [S, 'color.totally.invented', P] });
  const res = await runEval(tree, 'prism', mock, { catalog: [S], tasks: [{ name: 'primary-button', brief: 'x' }] });
  ok(res.arm === 'with-surface', 'eval-run: catalogue present → with-surface arm');
  const pb = res.byTask['primary-button'];
  ok(pb.total === 3 && pb.invented.length === 1 && Math.abs(pb.inventedRate - 1 / 3) < 1e-9, 'eval-run: runEval scores the task — 1 invented of 3 (1/3)');
  ok(pb.primitiveLeaks.length === 1 && Math.abs(pb.primitiveLeakRate - 0.5) < 1e-9, 'eval-run: the primitive ref among 2 valid → leak 0.5');
  ok(res.aggregate.total === 3 && res.aggregate.valid === 2, 'eval-run: aggregate rolls up all refs (2 valid / 3)');
  const without = await runEval(tree, 'prism', async () => '{"t":[]}', { tasks: [{ name: 't', brief: 'x' }] });
  ok(without.arm === 'without-surface', 'eval-run: no catalogue → without-surface arm');

  // pairs mode (contract-compliance on real agent output): prompt elicits fg/bg pairs, runEval scores them
  ok(/PAIRINGS/.test(buildPrompt(SAMPLE_TASKS, undefined, true)) && /"pairs"/.test(buildPrompt(SAMPLE_TASKS, undefined, true)), 'eval-run: pairs-mode prompt elicits {fg,bg,kind} pairings');
  ok(!/PAIRINGS/.test(buildPrompt(SAMPLE_TASKS)), 'eval-run: refs-mode prompt does not ask for pairings');
  const pairsJson = '{"card": {"refs": ["color.text.primary","color.background.primary"], "pairs": [{"fg":"color.text.primary","bg":"color.background.primary","kind":"text"},{"fg":"color.background.secondary","bg":"color.background.primary"}]}}';
  ok(extractPairs(pairsJson).all.length === 2 && extractPairs(pairsJson).byTask.card[0].kind === 'text', 'eval-run: extractPairs pulls the {fg,bg,kind} pairs from a pairs-mode object');
  ok(extractRefs(pairsJson).flat.length === 2, 'eval-run: extractRefs still recovers the refs[] from a pairs-mode object');
  const withPairs = await runEval(tree, 'prism', async () => pairsJson, { theme, tasks: [{ name: 'card', brief: 'x' }] });
  ok(withPairs.complianceAggregate !== undefined && withPairs.complianceByTask?.card !== undefined, 'eval-run: supplying a theme enables compliance scoring on the elicited pairs');
  ok(withPairs.complianceAggregate!.checked > 0 && withPairs.complianceAggregate!.pass < withPairs.complianceAggregate!.checked, 'eval-run: the good text pair passes + the adjacent-surface pair fails → compliance rate < 1');
  const refsOnly = await runEval(tree, 'prism', async () => pairsJson, { tasks: [{ name: 'card', brief: 'x' }] });
  ok(refsOnly.complianceAggregate === undefined, 'eval-run: no theme → refs-only, no compliance scoring (back-compat)');

  // guidance arm (the .ai.json metadata differential): the prompt carries when_to_use/avoid_when so the
  // agent can skip contrast checks the raw names can't convey (decorative border / disabled label).
  const guided = buildPrompt(SAMPLE_TASKS, ['color.border.primary'], true, 'border.primary — decorative hairline; avoid_when: NOT a 3:1 target');
  ok(/Semantic guidance/.test(guided) && /decorative hairline/.test(guided), 'eval-run: guidance is embedded in the prompt surface');
  ok(!/Semantic guidance/.test(buildPrompt(SAMPLE_TASKS, ['color.border.primary'], true)), 'eval-run: no guidance → prompt has no guidance block');
  let seen = '';
  await runEval(tree, 'prism', async (p) => { seen = p; return pairsJson; }, { theme, guidance: 'border.primary — decorative', catalog: ['color.border.primary'], tasks: [{ name: 'card', brief: 'x' }] });
  ok(/Semantic guidance/.test(seen) && /decorative/.test(seen), 'eval-run: runEval threads guidance into the prompt the runner sees');

  // skill arm (the portable-instructions differential, docs/17 §4): unlike `guidance` (per-brand
  // .ai.json data), the skill carries brand-agnostic RULES and composes on top of the catalogue.
  const SKILL = 'Reach for the semantic role, not the primitive. border.primary is decorative — not a 3:1 target.';
  const skilled = buildPrompt(SAMPLE_TASKS, ['color.border.primary'], true, undefined, SKILL);
  ok(/Consumption skill/.test(skilled) && skilled.includes(SKILL), 'eval-run: skill is embedded in the prompt surface');
  ok(!/Consumption skill/.test(buildPrompt(SAMPLE_TASKS, ['color.border.primary'], true)), 'eval-run: no skill → prompt has no skill block');
  // skill composes WITH guidance (both blocks present) — they are different layers, not exclusive.
  const both = buildPrompt(SAMPLE_TASKS, ['color.border.primary'], true, 'border.primary — decorative', SKILL);
  ok(/Semantic guidance/.test(both) && /Consumption skill/.test(both), 'eval-run: skill + guidance compose (both blocks present)');
  // back-compat: a call with neither guidance nor skill is byte-identical to the pre-skill prompt.
  ok(buildPrompt(SAMPLE_TASKS, ['color.border.primary'], true) === buildPrompt(SAMPLE_TASKS, ['color.border.primary'], true, undefined, undefined), 'eval-run: omitting skill leaves the prompt byte-identical (back-compat)');
  let seenSkill = '';
  await runEval(tree, 'prism', async (p) => { seenSkill = p; return pairsJson; }, { theme, skill: SKILL, catalog: ['color.border.primary'], tasks: [{ name: 'card', brief: 'x' }] });
  ok(/Consumption skill/.test(seenSkill) && seenSkill.includes(SKILL), 'eval-run: runEval threads the skill into the prompt the runner sees');
}

// (23) EMIT-FIGMA — hide primitives + thread descriptions (docs/10 §3, this PR).
// Two intent policies gated together because they land in the same emit pass.
//
// (a) PRIMITIVE TIER is hidden from library consumers. Every var in a
//     ref-tier collection (palette, dimension, font/family/*, font/size/*,
//     font/weight/*, opacity) carries `hiddenFromPublishing: true` (Figma's
//     official mechanism for "consumers of this file as a library shouldn't
//     see this in the picker"). Scopes stay at their real role-family targets
//     — Figma's Plugin API rejects "bogus" scopes ("Invalid scope for this
//     variable type" if you try `TEXT_CONTENT` on a COLOR/FLOAT var), and
//     `scopes: []` is documented as ALL_SCOPES (probe-verified 2026-07-04:
//     setBoundVariableForPaint succeeds on a var with scopes=[]), so
//     there is no scopes-based mechanism to hide a variable from LOCAL
//     pickers in the definer file. The production discipline: publish
//     tokens as a library and consume in a separate authoring file —
//     hidden-from-publishing narrows the picker end-to-end there.
//
// (b) SEMANTIC TIER stays visible. `color/*`, `space`, `radius`, `size`,
//     `border-width`, `focus`, `font-fluid`, `font/weight-role/*`, `layout`
//     all keep their role-family scopes and carry no `hiddenFromPublishing`
//     field (JSON stays clean — semantic bytes are unchanged from the pre-
//     hide world modulo the new descriptions).
//
// (c) DESCRIPTIONS ARE THREADED. Every Figma variable's `description` reads
//     from the underlying DTCG leaf's `$description` — the source of truth for
//     token metadata (see nb.tokens.json + nb.ai.json). Zero empty descriptions
//     across every emit-figma variable. Designers see the same prose in
//     Figma's Variables panel that appears in DTCG consumers + the AI sidecar.
{
  const theme = nbTheme();
  const { palette, color } = buildFigmaColor(theme);
  const font = buildFigmaFont(theme);
  const fluid = buildFigmaFontFluid(theme);
  const dims = buildFigmaDims(theme);
  const layout = buildFigmaLayout(theme);

  // Primitive-tier: every var must have hiddenFromPublishing=true. Scopes stay
  // at real role-family targets (Figma's Plugin API rejects "bogus"/non-matching
  // scopes and treats scopes=[] as ALL_SCOPES; hidden-from-publishing is
  // the only scopes-safe mechanism).
  const primitiveGroups: Array<{ tag: string; vars: any[]; expectScopes: string[] }> = [
    { tag: 'palette', vars: palette.variables, expectScopes: ['FRAME_FILL', 'SHAPE_FILL', 'TEXT_FILL', 'STROKE_COLOR'] },
    { tag: 'dimension', vars: dims.dimension.variables, expectScopes: ['WIDTH_HEIGHT', 'GAP', 'CORNER_RADIUS', 'STROKE_FLOAT'] },
    { tag: 'opacity', vars: dims.opacity.variables, expectScopes: ['OPACITY'] },
    { tag: 'font/family', vars: font.variables.filter((v) => v.name.startsWith('font/family/')), expectScopes: ['FONT_FAMILY'] },
    { tag: 'font/size', vars: font.variables.filter((v) => v.name.startsWith('font/size/')), expectScopes: ['FONT_SIZE'] },
    { tag: 'font/weight', vars: font.variables.filter((v) => v.name.startsWith('font/weight/')), expectScopes: ['FONT_WEIGHT'] },
  ];
  const notHidden: string[] = [];
  const wrongScope: string[] = [];
  for (const g of primitiveGroups) {
    for (const v of g.vars) {
      if (v.hiddenFromPublishing !== true) notHidden.push(`${g.tag}:${v.name}`);
      // Scope sets are unordered — compare as sorted sets.
      if (JSON.stringify([...v.scopes].sort()) !== JSON.stringify([...g.expectScopes].sort()))
        wrongScope.push(`${g.tag}:${v.name} = [${v.scopes.join(',')}]`);
    }
  }
  ok(notHidden.length === 0, `figma primitives: every ref-tier var has hiddenFromPublishing=true (${primitiveGroups.reduce((n, g) => n + g.vars.length, 0)} vars across ${primitiveGroups.length} collections)` + (notHidden.length ? ` — ${notHidden.slice(0, 3).join(', ')}` : ''));
  ok(wrongScope.length === 0, 'figma primitives: each ref-tier collection carries its role-family scopes (hidden-from-publishing does the hide; scopes still guide bespoke use)' + (wrongScope.length ? ` — ${wrongScope.slice(0, 3).join(', ')}` : ''));

  // Semantic-tier: every var must NOT be hidden.
  const semanticGroups: Array<{ tag: string; vars: any[] }> = [
    { tag: 'color', vars: color.flatMap((c) => c.variables) },
    { tag: 'space', vars: dims.space.variables },
    { tag: 'radius', vars: dims.radius.flatMap((c) => c.variables) },
    { tag: 'size', vars: dims.size.variables },
    { tag: 'border-width', vars: dims.borderWidth.variables },
    { tag: 'focus', vars: dims.focus.variables },
    { tag: 'font-fluid', vars: fluid.flatMap((c) => c.variables) },
    { tag: 'font/weight-role', vars: font.variables.filter((v) => v.name.startsWith('font/weight-role/')) },
    { tag: 'layout', vars: layout.flatMap((c) => c.variables) },
  ];
  const wronglyHidden: string[] = [];
  for (const g of semanticGroups) {
    for (const v of g.vars) {
      if (v.hiddenFromPublishing) wronglyHidden.push(`${g.tag}:${v.name}`);
    }
  }
  ok(wronglyHidden.length === 0, `figma semantics: no semantic-tier var is hidden from publishing (${semanticGroups.reduce((n, g) => n + g.vars.length, 0)} vars across ${semanticGroups.length} collections)` + (wronglyHidden.length ? ` — ${wronglyHidden.slice(0, 3).join(', ')}` : ''));

  // Descriptions: every var across every collection has a non-empty description.
  const allColls: Array<{ tag: string; vars: any[] }> = [...primitiveGroups, ...semanticGroups];
  const emptyDesc: string[] = [];
  for (const g of allColls) for (const v of g.vars) {
    if (!v.description || v.description.length === 0) emptyDesc.push(`${g.tag}:${v.name}`);
  }
  ok(emptyDesc.length === 0, `figma descriptions: every variable carries a non-empty description sourced from the DTCG $description (${allColls.reduce((n, g) => n + g.vars.length, 0)} vars total)` + (emptyDesc.length ? ` — ${emptyDesc.slice(0, 3).join(', ')}` : ''));

  // Descriptions actually match the DTCG source (spot-check a handful of paths
  // across axes so a silent decoupling — someone writing custom description
  // text in the adapter — would be caught).
  const { tree } = buildTree(theme);
  const R = Object.keys(tree)[0];
  const spotChecks: Array<[string, any, string]> = [
    ['palette/red/550', tree[R].palette.red['550'], palette.variables.find((v) => v.name === 'palette/red/550')!.description],
    ['color/background/primary', tree[R].color.background.primary, color[0].variables.find((v) => v.name === 'color/background/primary')!.description],
    ['space/100', tree[R].space['100'], dims.space.variables.find((v) => v.name === 'space/100')!.description],
    ['radius/md', tree[R].radius.md, dims.radius[0].variables.find((v) => v.name === 'radius/md')!.description],
    ['opacity/50', tree[R].opacity['50'], dims.opacity.variables.find((v) => v.name === 'opacity/50')!.description],
    ['font/size/16', tree[R].font.size['16'], font.variables.find((v) => v.name === 'font/size/16')!.description],
    ['font/weight/400', tree[R].font.weight['400'], font.variables.find((v) => v.name === 'font/weight/400')!.description],
  ];
  const descMismatch: string[] = [];
  for (const [name, leaf, actual] of spotChecks) {
    // family carries the stack line FIRST, then the description; other tokens are exact.
    if (name.startsWith('font/family/')) continue;
    if (actual !== String(leaf.$description ?? '')) descMismatch.push(name);
  }
  ok(descMismatch.length === 0, 'figma descriptions: spot-check across axes matches the DTCG $description verbatim' + (descMismatch.length ? ` — ${descMismatch.slice(0, 3).join(', ')}` : ''));

  // font/family descriptions: still lead with the stack (fix #4 preserved),
  // AND the DTCG $description is threaded onto the end.
  const familyFusion: string[] = [];
  for (const v of font.variables.filter((v) => v.name.startsWith('font/family/'))) {
    const role = v.name.split('/')[2];
    const leaf = tree[R].font.family[role];
    const stackFirst = /^stack: [^—]+/.test(v.description);
    const carriesDtcg = v.description.includes(String(leaf.$description ?? ''));
    if (!stackFirst || !carriesDtcg) familyFusion.push(v.name);
  }
  ok(familyFusion.length === 0, 'figma font/family: description leads with the stack (fix #4) AND ends with the DTCG $description' + (familyFusion.length ? ` — ${familyFusion.slice(0, 3).join(', ')}` : ''));

  // Drift fence: same brand emits deterministically. Regenerate twice; the
  // sorted-keys JSON MUST be byte-identical. Catches accidental
  // Math.random / Date.now use, which the workflow rules ban.
  const first = JSON.stringify(buildFigmaColor(theme).palette);
  const second = JSON.stringify(buildFigmaColor(theme).palette);
  ok(first === second, 'figma palette: emit is deterministic (regeneration byte-identical)');
}

// ----------------------------------------- component-definition schema (docs/14 §2, DRAFT v0)
// Button, the first component def, validated against component-schema.ts — and its token
// bindings resolved against TWO brands' generated trees. That proves the definition is
// brand-INVARIANT structure bound to a VERIFIED contract (docs/14 §2), not observed values:
// build the def once, every brand materialises because the bindings resolve through roles.
{
  const nbT = nbTheme();
  const nbTree = buildTree(nbT).tree;
  const auroraT = brandTheme(parseDesignMd(readFileSync(resolve(HERE, '../examples/aurora.design.md'), 'utf8')).input);
  const auroraTree = buildTree(auroraT).tree;

  // Both calibration defs: structurally valid, and every token binding resolves across TWO
  // brands (build-once / materialise-everywhere), binding only semantic roles (no primitive leak).
  for (const [name, def] of [['Button', button], ['IconButton', iconButton], ['FieldLabel', fieldLabel], ['FieldMessage', fieldMessage], ['TextField', textField]] as [string, ComponentDef][]) {
    const s = validateComponentDef(def);
    ok(s.errors.length === 0, `component: ${name} def is structurally valid${s.errors.length ? ' — ' + s.errors.join('; ') : ''}`);
    const vnb = validateComponentDef(def, nbTree, nbT.root);
    const vau = validateComponentDef(def, auroraTree, auroraT.root);
    ok(vnb.errors.length === 0, `component: every ${name} token binding resolves in nb${vnb.errors.length ? ' — ' + vnb.errors.join('; ') : ''}`);
    ok(vau.errors.length === 0, `component: every ${name} token binding resolves in aurora${vau.errors.length ? ' — ' + vau.errors.join('; ') : ''}`);
    ok(vnb.warnings.length === 0 && vau.warnings.length === 0, `component: ${name} binds only semantic roles, no primitive-tier leak${[...vnb.warnings, ...vau.warnings].length ? ' — ' + [...vnb.warnings, ...vau.warnings].join('; ') : ''}`);
  }

  // Button carries the reconciled two-axis model bound to interactive.* (docs/20): intent
  // {primary,neutral,destructive} × appearance {filled,outline,text}, neutral default.
  ok(button.props.find((p) => p.name === 'intent')?.default === 'neutral', 'component: Button intent defaults to neutral (one primary per view)');
  ok(JSON.stringify(button.variants.appearance) === JSON.stringify(['filled', 'outline', 'text']), 'component: Button appearance axis is filled/outline/text (reconciled)');
  ok(!Object.values(button.tokens).some((v) => /color\.action\.|color\.foreground\.danger\.|foreground\.secondary/.test(String(v))), 'component: Button binds interactive.*/disabled.*, not the legacy action./danger./secondary roles');
  ok(iconButton.inherits === 'button' && !!iconButton.props.find((p) => p.name === 'aria-label')?.required, 'component: IconButton inherits button + REQUIRES an accessible name');

  // The field FAMILY (docs/20 §17, KB text-field): TextField is a HOST that composes the two
  // shared parts, and binds INPUT CHROME only — label/message colour+type live in their own defs.
  ok(['field-label', 'field-message'].every((p) => textField.composition?.composesWith?.includes(p)), 'component: TextField composes field-label + field-message (the shared parts, not re-declared)');
  ok(!Object.keys(textField.tokens).some((k) => /label|caption|message/.test(k)), 'component: TextField binds input chrome only — no label/message tokens (those live in the part defs)');
  ok(textField.tokens['border.rest'] === 'color.field.border.rest' && textField.tokens['border.hover'] === 'color.field.border.hover', 'component: TextField binds the stateful field border (rest + hover)');
  // read-only ≠ disabled — the live edge: read-only keeps full-contrast text.primary, not a dimmed disabled ink.
  ok(textField.tokens['text'] === 'color.text.primary' && textField.tokens['border.readonly'] === 'color.border.secondary', 'component: TextField read-only stays full-contrast (text.primary + border.secondary), not disabled.*');
  ok(textField.tokens['border.error'] === 'color.border.danger', 'component: TextField error is a border-only swap (border.danger)');
  // FieldMessage: every validation tone re-points BOTH ink + icon at the matching semantic role.
  ok(([['error', 'danger'], ['warning', 'warning'], ['success', 'success']] as const).every(([tone, role]) => fieldMessage.tokens[`${tone}.text`] === `color.text.${role}` && fieldMessage.tokens[`${tone}.icon`] === `color.icon.${role}`), 'component: FieldMessage tones bind text.<role> + icon.<role> (icon + text, never colour-only)');
  ok(fieldMessage.states.length === 0 && JSON.stringify(fieldMessage.variants.tone) === JSON.stringify(['default', 'error', 'warning', 'success']), 'component: FieldMessage is presentational with a tone axis');
  ok(!!fieldLabel.props.find((p) => p.name === 'children')?.required && fieldLabel.tokens['text'] === 'color.text.primary', 'component: FieldLabel requires text + binds the primary label ink');

  // The drift gate bites: a broken def is caught (missing avoid_when + an unresolvable binding).
  const broken = { ...button, ai: { ...button.ai, avoidWhen: '' }, tokens: { ...button.tokens, bogus: 'color.nope.nope' } } as ComponentDef;
  const vb = validateComponentDef(broken, nbTree, nbT.root);
  ok(vb.errors.some((e) => /avoidWhen/.test(e)), 'component: missing ai.avoidWhen fails the gate');
  ok(vb.errors.some((e) => /bogus/.test(e) && /does not resolve/.test(e)), 'component: a broken token binding fails the gate');
}

// ------------------------------------------------------------------- report
console.log(`\nPrism3 engine tests: ${pass} passed, ${fails.length} failed`);
if (fails.length) { fails.forEach((f) => console.log(`  ❌ ${f}`)); process.exitCode = 1; }
else console.log('  ✓ colour math + extreme-brand contracts all hold');
