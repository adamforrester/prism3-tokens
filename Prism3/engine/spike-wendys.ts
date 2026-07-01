/**
 * Prism3 engine — the WENDY'S SPIKE (docs/07 §11.6).
 *
 * Runs a REAL, spec-compliant `brand-skills` `design.md` (Wendy's) through the
 * engine end-to-end and emits a FULL-PARITY fidelity report:
 *
 *   standard design.md  →  parseStandardDesignMd  (read the flat/observed values)
 *                       →  classifyColors         (flat colours → engine anchors)
 *                       →  BrandInput             (anchors + families)
 *                       →  brandTheme + emitTheme  (the shipped core, unchanged)
 *                       →  wendys.tokens.json / .ai.json + wendys-fidelity-report.md
 *
 * The report is the DELIVERABLE EVIDENCE (§11.3 Decision A): the engine pins the
 * brand anchor exactly, GENERATES the rest, and reports where its generated system
 * DIVERGES from the observed values — across every axis (colour ΔE00, typography,
 * spacing, radius, elevation) — so we know exactly what the `brand-skills`
 * alignment spec (§11.7) must change before touching step A.
 *
 * ADDITIVE spike: emits `wendys.*` only; the shipped `emit-dtcg` (nb/aurora/harbor)
 * and all gates are untouched. Run:  npx tsx Prism3/engine/spike-wendys.ts
 * It self-verifies (anchor reproduced, aliases resolve, contrasts hold) and exits
 * non-zero on any failure.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { RGB, contrast, deltaE2000, hexToRgb } from './color';
import { Step } from './ramp';
import { BrandInput, PaletteBuild, Theme, brandTheme } from './theme';
import { emitTheme, validateBrandInput } from './emit-dtcg';
import { parseStandardDesignMd, StandardDesignMd } from './standard-design-md';
import { classifyColors, ColorClassification, ProvidedColor } from './classify-colors';

const here = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(here, 'out');

// --- helpers ---------------------------------------------------------------
const de2 = (n: number) => n.toFixed(2);
const nearestStep = (pal: PaletteBuild | undefined, rgb: RGB): { step: Step; de: number } | null => {
  if (!pal || !pal.steps.length) return null;
  let best = pal.steps[0], bestDe = Infinity;
  for (const s of pal.steps) { const d = deltaE2000(s.rgb, rgb); if (d < bestDe) { bestDe = d; best = s; } }
  return { step: best, de: bestDe };
};
const palByName = (theme: Theme, name: string | null) => theme.palettes.find((p) => p.palette === name);

// --- family derivation from the type tokens --------------------------------
// The family used by the body/caption tokens is the TEXT face; the family used by
// the display/heading tokens is the DISPLAY face.
const deriveFamilies = (typography: StandardDesignMd['typography']): { display?: string; text?: string } => {
  const firstFamilyFor = (pred: (name: string) => boolean): string | undefined => {
    for (const [name, tok] of Object.entries(typography)) if (pred(name.toLowerCase()) && tok.fontFamily) return tok.fontFamily;
    return undefined;
  };
  return {
    display: firstFamilyFor((n) => /^(mega|display|title|button|label|eyebrow)/.test(n)),
    text: firstFamilyFor((n) => /^(body|caption|paragraph)/.test(n)),
  };
};

// --- x-prism3 levers → BrandInput (docs/07 §11.4) --------------------------
// The optional namespaced block brand-skills emits verbatim. Map the recognised
// levers onto BrandInput; return the human-readable list of what was applied.
// Absent block → nothing applied → the engine runs on defaults (the plain-spec
// path §11.4 guarantees). Passed through as-is; the engine's schema validates.
const applyXPrism3 = (input: BrandInput, x: Record<string, unknown>): string[] => {
  const applied: string[] = [];
  if (x.radiusScale != null) { input.radiusScale = Number(x.radiusScale); applied.push(`radiusScale=${input.radiusScale}`); }
  if (x.typeScale != null) { input.typography = { ...input.typography, typeScale: x.typeScale as any }; applied.push(`typeScale=${x.typeScale}`); }
  if (x.density != null) { input.density = x.density as any; applied.push(`density=${x.density}`); }
  if (x.motionTempo != null) { input.motionPersonality = { tempo: x.motionTempo as any }; applied.push(`motionTempo=${x.motionTempo}`); }
  if (x.actionPalette != null) { input.actionPalette = String(x.actionPalette); applied.push(`actionPalette=${x.actionPalette}`); }
  if (x.iconContrast != null) { input.iconContrast = x.iconContrast as any; applied.push(`iconContrast=${x.iconContrast}`); }
  if (x.surfaces != null) { input.surfaces = x.surfaces as any; applied.push('surfaces'); }
  if (x.gradients != null) { input.gradients = x.gradients as any; applied.push('gradients'); }
  return applied;
};

// --- tier → engine type group (the headline alignment finding) -------------
const TIER_TO_GROUP: Record<string, string> = {
  mega: 'display', display: 'display', title: 'title', button: 'label',
  body: 'body', caption: 'caption', label: 'label', eyebrow: 'eyebrow', code: 'code',
};
const tierOf = (token: string) => token.toLowerCase().split('-')[0];
const pxNum = (v: string | number | undefined): number | null => {
  if (v == null) return null;
  const m = String(v).match(/-?\d*\.?\d+/);
  return m ? Number(m[0]) : null;
};

// --- report builder --------------------------------------------------------
const buildReport = (std: StandardDesignMd, cls: ColorClassification, input: BrandInput, theme: Theme,
                     stats: { resolved: number; aliases: number; modePass: number; modeChecks: number },
                     xApplied: string[]): { md: string; anchorDe: number } => {
  const md: string[] = [];
  const P = (...l: string[]) => md.push(...l);

  P(`# Wendy's — Prism3 fidelity report`, '',
    `> Generated by \`spike-wendys.ts\` (docs/07 §11.6). A real \`brand-skills\` \`design.md\` run through the`,
    `> engine: the brand anchor is **pinned exactly**, the rest is **generated + contrast-verified**, and every`,
    `> **observed** value is diffed against the engine's generated system (Decision A, §11.3). Divergence is the`,
    `> point — the engine does not trust extracted ramps as final; this report is the evidence that seeds the`,
    `> \`brand-skills\` alignment spec (§11.7).`, '');

  // headline
  const primaryPal = palByName(theme, 'primary')!;
  const anchor = nearestStep(primaryPal, hexToRgb(std.colors.primary))!;
  const pOnWhite = contrast(hexToRgb(std.colors.primary), { r: 255, g: 255, b: 255 });
  P(`## Headline`, '',
    `- **Anchor reproduction** — provided \`primary\` \`${std.colors.primary}\` vs generated \`primary.${anchor.step.key}\` \`${anchor.step.hex}\`: **ΔE00 ${de2(anchor.de)}** (≈0 confirms exact-anchor preservation).`,
    `- **Aliases**: ${stats.resolved}/${stats.aliases} resolve · **mode contrast contracts**: ${stats.modePass}/${stats.modeChecks} hold.`,
    `- **\`primary\` on white**: measured **${de2(pOnWhite)}:1** — which actually CLEARS small-text AA (≥4.5:1). The file states ~4.6:1 and prescribes \`primary-dark\` for small text; that ~4.6 figure fits a *different* red (the schema-example \`#E2231A\` / PMS 186), not this \`#C8102E\`. **Finding:** the observed contrast prose is stale for its own hex — the engine measures every contract, so it doesn't inherit that error.`,
    `- Palettes generated: ${theme.palettes.map((p) => p.palette).join(', ')} · danger draws from \`${theme.roleToPalette.danger}\`.`, '');

  // §1 colour
  P(`## 1. Colour fidelity (ΔE00 — observed swatch vs nearest generated step)`, '');
  const groups: { title: string; filter: (p: ProvidedColor) => boolean }[] = [
    { title: 'Primary (brand anchor + state variants)', filter: (p) => p.baseRamp === 'primary' },
    { title: 'Secondary', filter: (p) => p.baseRamp === 'secondary' },
    { title: 'Tertiary', filter: (p) => p.baseRamp === 'tertiary' },
    { title: 'Neutral (+ white)', filter: (p) => p.baseRamp === 'neutral' },
    { title: 'Status: success / warning / danger(←error)', filter: (p) => ['success', 'warning', 'danger'].includes(p.baseRamp ?? '') },
    { title: 'Info (engine-synthesised — expect divergence)', filter: (p) => p.baseRamp === 'info' },
  ];
  // How each observed swatch relates to the generated ramp: the brand palettes
  // pin an EXACT step; neutral swatches DERIVE the aggregate { hue, chroma };
  // status swatches pin HUE + chroma (lightness placed by the ramp); the rest are
  // regenerated and diffed. Labelled honestly so the table doesn't overclaim.
  const anchorLabel = (p: ProvidedColor): string =>
    p.role === 'primary' || p.role === 'secondary' || p.role === 'tertiary' ? '✅ pinned (exact step)'
      : p.role === 'neutral' ? 'derived (→ hue/chroma)'
      : p.role === 'success' || p.role === 'warning' || p.role === 'error' ? 'hue-pinned (L by ramp)'
      : '·';
  const allDe: number[] = [];
  for (const g of groups) {
    const rows = cls.provided.filter(g.filter);
    if (!rows.length) continue;
    P(`### ${g.title}`, '', '| token | observed | → nearest generated | ΔE00 | relation |', '|---|---|---|---|---|');
    for (const p of rows) {
      const pal = palByName(theme, p.baseRamp);
      const n = nearestStep(pal, p.rgb);
      if (n) allDe.push(n.de);
      P(`| \`${p.token}\` | ${p.hex} | ${n ? `\`${p.baseRamp}.${n.step.key}\` ${n.step.hex}` : '—'} | ${n ? de2(n.de) : '—'} | ${anchorLabel(p)} |`);
    }
    P('');
  }
  const meanDe = allDe.reduce((a, b) => a + b, 0) / (allDe.length || 1);
  P(`**Aggregate colour ΔE00** across ${allDe.length} observed swatches: **${de2(meanDe)}** (the anchor pins to ~0; the ramp steps and status/neutral — which the engine PLACES by contrast role, not by the observed value — carry the divergence).`, '');

  // §2 typography
  P(`## 2. Typography parity`, '',
    `The observed roles use the \`mega\` / \`display\` / \`title\` / \`button\` / \`body\` / \`caption\` vocabulary; the engine's`,
    `semantic vocabulary is \`display\` / \`title\` / \`body\` / \`label\` / \`caption\` / \`eyebrow\` / \`code\`. The role map below`,
    `is **the headline alignment finding** — \`mega\`→top of \`display\`, \`button\`→\`label\` (§11.5).`, '',
    '| observed token | family · size · weight | → engine group | nearest engine composite | Δsize |', '|---|---|---|---|---|');
  const comps = theme.typography.composites;
  const famStack = (role: string) => theme.typography.families.find((f) => f.role === role)?.stack[0] ?? role;
  for (const [token, tok] of Object.entries(std.typography)) {
    const group = TIER_TO_GROUP[tierOf(token)] ?? '—';
    const size = pxNum(tok.fontSize);
    const cands = comps.filter((c) => c.group === group);
    let near = cands[0], best = Infinity;
    for (const c of cands) { const d = size != null ? Math.abs(c.sizePx - size) : 0; if (d < best) { best = d; near = c; } }
    const engFam = near ? famStack(near.family) : '—';
    const dSize = near && size != null ? near.sizePx - size : null;
    P(`| \`${token}\` | ${tok.fontFamily} · ${tok.fontSize} · ${tok.fontWeight} | \`${group}\` | ${near ? `\`${near.path}\` (${near.sizePx}px, ${engFam}, w:${near.weightRole})` : '—'} | ${dSize == null ? '—' : (dSize > 0 ? '+' : '') + dSize + 'px'} |`);
  }
  P('',
    `- **Role rename required in \`brand-skills\`:** \`mega-*\`→\`display\` (top rungs), \`button-*\`→\`label\`. \`display\`/\`title\`/\`body\`/\`caption\` already align.`,
    `- **Weight naming differs:** observed uses numerics (900/700/400); the engine uses function-named weight roles (subtle/default/emphasis/strong) over a numeric reference tier — a mapping, not a conflict.`,
    `- **Size ladder differs by design:** the engine ships a curated rem ladder, not the brand's exact px, so Δsize is expected; the families (\`${famStack('display')}\` / \`${famStack('text')}\`) round-trip.`, '');

  // §3 spacing
  P(`## 3. Spacing parity`, '',
    `Observed spacing is a **t-shirt** scale on a **4px** base; the engine's \`space\` is a **numbered-multiplier** scale on an`,
    `**8px** rhythm (a deliberate, white-label-honest taxonomy — docs/00). Matched by px value:`, '',
    '| observed | px | engine token(s) at same px | note |', '|---|---|---|---|');
  const spacePx = new Map(theme.dims.space.map((s) => [s.px, `space.${s.key}`]));
  for (const [token, val] of Object.entries(std.spacing)) {
    const px = pxNum(val);
    const hit = px != null ? theme.dims.space.filter((s) => s.px === px).map((s) => `space.${s.key}`) : [];
    P(`| \`${token}\` | ${px ?? '—'} | ${hit.length ? hit.join(', ') : '—'} | ${hit.length ? 'value present in engine scale' : 'not on the 8px-rhythm ladder'} |`);
  }
  P('', `- Taxonomy divergence is intentional (t-shirt→numbered); the engine covers most observed px, with off-rhythm values (e.g. 4px \`base\`) absent by design. **Not** an alignment change — a documented translation.`, '');

  // §4 radius
  P(`## 4. Radius parity`, '',
    `Observed radius is a 9-step t-shirt scale; the engine ships a small **bounded** set (\`none/sm/md/lg/round\`) because radius`,
    `is genuinely semantic (docs/00). Matched by px:`, '',
    '| observed | px | engine token at same px | note |', '|---|---|---|---|');
  for (const [token, val] of Object.entries(std.rounded)) {
    const px = pxNum(val);
    const hit = px != null ? theme.dims.radius.filter((r) => r.px === px).map((r) => `radius.${r.name}`) : [];
    P(`| \`${token}\` | ${px ?? '—'} | ${hit.length ? hit.join(', ') : '—'} | ${hit.length ? 'match' : 'no bounded-set equivalent'} |`);
  }
  P('', `- Engine radius (\`${theme.dims.radius.map((r) => `${r.name}=${r.px}`).join(', ')}\`) at scale ${theme.dims.radiusScaleValue}. Observed default \`radius-m\`=8px maps cleanly to a scale-2 \`md\`; here defaults (scale 1) are kept so the divergence is visible. **Alignment finding:** to match Wendy's 8px default, set \`radiusScale: 2\`.`, '');

  // §5 elevation
  P(`## 5. Elevation parity`, '',
    `Observed elevation is single-layer CSS \`box-shadow\` strings; the engine generates a 6-step (\`xs–2xl\`) **two-layer**`,
    `(key + ambient) mode-aware ramp with a tinted-near-black colour. Fundamentally different shapes — reported qualitatively:`, '',
    '| observed | value | nearest engine step (light, key blur / ambient blur) |', '|---|---|---|');
  const engSteps = theme.shadow.steps.filter((s) => s.name !== 'inset');
  for (const [token, val] of Object.entries(std.elevation)) {
    if (String(val).trim() === 'none') { P(`| \`${token}\` | none | \`flat\` (no shadow — engine composes a foreground tier + border) |`); continue; }
    const nums = String(val).replace(/rgba?\([^)]*\)/g, '').match(/-?\d*\.?\d+/g)?.map(Number) ?? [];
    const blur = nums[2] ?? 0;
    let near = engSteps[0], best = Infinity;
    for (const s of engSteps) { const d = Math.abs((s.light[0]?.blur ?? 0) - blur); if (d < best) { best = d; near = s; } }
    P(`| \`${token}\` | \`${val}\` | \`${near.name}\` (${near.light[0]?.blur ?? 0} / ${near.light[1]?.blur ?? 0}) |`);
  }
  P('', `- **Format divergence:** observed = one-layer CSS; engine = two-layer composite → Figma Effect Style. The engine also reduces shadow in dark (lift-primary). Not a like-for-like port; a translation the exporter owns.`, '');

  // §6 coverage / decisions / alignment findings
  P(`## 6. Classification, engine decisions & alignment findings`, '');
  P(`### Colour-role classification log`, '', '| token | decision |', '|---|---|');
  for (const e of cls.log) P(`| \`${e.token}\` | ${e.decision} |`);
  P('');
  P(`### Engine decisions (from theme notes)`, '');
  for (const n of theme.notes) P(`- ${n}`);
  P('');
  P(`### Alignment findings for the \`brand-skills\` spec (§11.7)`, '',
    `1. **Type-role vocabulary:** rename \`mega-*\`→\`display\` (top rungs) and \`button-*\`→\`label\` so both tools speak the engine's set (\`display/title/body/label/caption/eyebrow/code\`). \`display/title/body/caption\` already align.`,
    `2. **Colour-role naming:** the classifier reads \`primary/secondary/tertiary/neutral-<step>/success/warning/error/info\` by convention. \`error\`→\`danger\` is the one rename the engine applies (its status role is \`danger\`); the colour-role contract should state this explicitly.`,
    `3. **\`info\` duplicates \`secondary\`** (both \`${std.colors.info}\`) and **\`error\` duplicates \`primary-dark\`** (both \`${std.colors.error}\`). The engine synthesises \`info\` and regenerates \`danger\` from the anchor, so these observed dups don't propagate — but they confirm brand-skills should keep emitting them (descriptive completeness) while the engine treats them as non-final.`,
    `4. **Scale/state variants** (\`primary-dark/darker/darkest\`, \`secondary-light/dark\`) are observed ramp points; the engine regenerates the full ramp and reports divergence rather than consuming them. No contract change — they stay descriptive.`,
    `5. **\`x-prism3:\` block — ${xApplied.length ? `levers applied: ${xApplied.join(', ')}` : 'absent → engine defaults'}.** ${xApplied.length ? 'The engine consumed the namespaced block verbatim.' : 'This plain-spec file carries no block, so the engine compiled on defaults — exactly the §11.4 guarantee.'} The engine now READS a top-level \`x-prism3\` (brand-skills emits it from \`surfaces.md\`); Wendy's would benefit from \`radiusScale: 2\` (→ 8px default radius) and \`typeScale: expressive\` (its 94px hero) — a practitioner adds those to opt into the fuller system.`,
    `6. **Spacing/radius/elevation taxonomies diverge by design** (t-shirt/CSS vs numbered/bounded/two-layer). These are translations the engine + exporter own, not alignment changes to brand-skills.`, '');

  return { md: md.join('\n') + '\n', anchorDe: anchor.de };
};

// --- main ------------------------------------------------------------------
const run = () => {
  const file = process.argv[2] ? resolve(process.argv[2]) : resolve(here, '../examples/wendys.design.md');
  const std = parseStandardDesignMd(readFileSync(file, 'utf8'));
  console.log(`[spike] read ${file} — brand '${std.name}', ${Object.keys(std.colors).length} colours, ${Object.keys(std.typography).length} type tokens`);

  const cls = classifyColors(std.colors);
  const input: BrandInput = {
    id: 'wendys',
    primary: cls.input.primary,
    neutral: cls.input.neutral,
    brandColors: cls.input.brandColors,
    status: cls.input.status,
    typography: { families: deriveFamilies(std.typography) },   // typeScale via x-prism3 (or engine default)
  };
  // Consume the optional x-prism3 engine-levers block (docs/07 §11.4). Absent for
  // this plain-spec Wendy's file → engine defaults, exactly as intended.
  const xApplied = Object.keys(std.xPrism3).length ? applyXPrism3(input, std.xPrism3) : [];
  console.log(`[spike] x-prism3 levers: ${xApplied.length ? xApplied.join(', ') : 'none (plain spec → engine defaults)'}`);

  const errs = validateBrandInput(input);
  if (errs.length) { console.error(`[spike] ❌ classified BrandInput violates the schema:`); errs.forEach((e) => console.error(`   ${e}`)); process.exit(1); }
  console.log(`[spike] ✓ classified BrandInput conforms to theme-schema.json`);

  const theme = brandTheme(input);
  const { stats } = emitTheme(theme, outDir);
  console.log(`[spike] emitted out/wendys.tokens.json + out/wendys.ai.json — aliases ${stats.resolved}/${stats.aliases}, mode contracts ${stats.modePass}/${stats.modeChecks}`);

  const { md, anchorDe } = buildReport(std, cls, input, theme, stats, xApplied);
  const reportPath = resolve(here, 'wendys-fidelity-report.md');
  writeFileSync(reportPath, md);
  console.log(`[spike] wrote ${reportPath}`);

  // --- self-verify the spike's own gates ---
  let ok = true;
  const check = (cond: boolean, msg: string) => { if (!cond) { ok = false; console.error(`[spike] ❌ ${msg}`); } };
  check(anchorDe < 0.5, `anchor not reproduced (ΔE00 ${anchorDe.toFixed(2)} ≥ 0.5)`);
  check(stats.broken.length === 0, `${stats.broken.length} unresolved aliases`);
  check(stats.modePass === stats.modeChecks, `contrast contracts ${stats.modePass}/${stats.modeChecks}`);
  check(theme.roleToPalette.danger === 'danger', `error→danger not carved as a distinct palette (danger draws from '${theme.roleToPalette.danger}')`);
  // Exercise the x-prism3 lever-mapping path even though the real Wendy's file omits
  // the block — proves the round-trip (brand-skills emits → engine consumes).
  { const probe = { id: 'p', primary: input.primary, neutral: input.neutral } as BrandInput;
    const ap = applyXPrism3(probe, { radiusScale: 2, typeScale: 'expressive', motionTempo: 'snappy' });
    check(probe.radiusScale === 2 && probe.typography?.typeScale === 'expressive' && probe.motionPersonality?.tempo === 'snappy' && ap.length === 3,
      `x-prism3 lever mapping broken (applied: ${ap.join(', ')})`); }
  if (!ok) { console.error('[spike] FAILED'); process.exit(1); }
  console.log(`[spike] ✓ all gates green — anchor ΔE00 ${anchorDe.toFixed(2)}, aliases ${stats.resolved}/${stats.aliases}, contracts ${stats.modePass}/${stats.modeChecks}`);
};

run();
