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
import { contrast } from './color';
import { Theme, brandTheme, BrandInput } from './theme';
import { nbTheme } from './nb-fixture';
import { resolveAllModes, ModeResult } from './modes';
import { buildAiMetadata } from './ai-metadata';
import { parseDesignMd } from './design-md';
import { buildTree, Stats } from './tree';
export { buildTree };

const here = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(here, 'out');
// (outDir is created lazily by emitTheme; no side effect on import.)


// ---------------------------------------------------------------------------
// Reusable emit + validation core — shared by this regression runner AND the
// file-driven CLI (engine/cli.ts). No token logic lives here: buildTree (above)
// is the generator; these persist its output and check the input contract, so
// the CLI is a thin new entry point over the same core, not a second pipeline.

// Persist a theme's DTCG tree + AI-metadata sidecar to `outDir`; return the built
// tree/modes/stats so the caller can print a summary and gate on the contracts.
export const emitTheme = (theme: Theme, outDir: string): { tree: any; modes: ModeResult[]; stats: Stats } => {
  mkdirSync(outDir, { recursive: true });
  const built = buildTree(theme);
  writeFileSync(resolve(outDir, `${theme.id}.tokens.json`), JSON.stringify(built.tree, null, 2) + '\n');
  // AI-readable metadata sidecar (agent surface for the semantic layer).
  writeFileSync(resolve(outDir, `${theme.id}.ai.json`), JSON.stringify(buildAiMetadata(theme, built.tree), null, 2) + '\n');
  return built;
};

// Dependency-free validator for the JSON-Schema subset the BrandInput contract
// uses (schema/theme-schema.json) — guards the documented contract against drift
// from the actual white-label input, and gates every CLI run.
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
/** Validate a parsed BrandInput against the canonical theme-schema.json contract. */
export const validateBrandInput = (input: unknown): string[] => validate(input, brandSchema, brandSchema.$defs ?? {});
/** Read + compile a committed example brand's design.md into a BrandInput (I/O shell). */
export const readExampleBrand = (relPath: string): BrandInput =>
  parseDesignMd(readFileSync(resolve(here, relPath), 'utf8')).input;

// ---------------------------------------------------------------------------
// Regression runner — runs ONLY when this module is executed directly, so
// importing it for its exports (cli.ts) has no side effects. Emits the NB
// regression theme plus the two committed example brands, Aurora and Harbor,
// each compiled FROM its design.md (examples/*.design.md). Those files are the
// single source of truth: out/*.tokens.json is faithful to the CLI path by
// construction, and test.ts confirms it byte-for-byte.
const isMain = process.argv[1] ? resolve(process.argv[1]) === fileURLToPath(import.meta.url) : false;
if (isMain) {
  const auroraInput = readExampleBrand('../examples/aurora.design.md');
  const harborInput = readExampleBrand('../examples/harbor.design.md');
  const themes: Theme[] = [nbTheme(), brandTheme(auroraInput), brandTheme(harborInput)];
  const md: string[] = ['# Prism3 modes & scales — generated mappings, contrast contracts, dimension axis', ''];
  let ok = true;

  for (const theme of themes) {
    const { tree, modes, stats } = emitTheme(theme, outDir);
    const outPath = resolve(outDir, `${theme.id}.tokens.json`);

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
      // one line per group: sizes (unique) × the weight set it ships (+link marker).
      const byGroup: Record<string, { sizes: Set<string>; weights: Set<string>; link: boolean }> = {};
      for (const c of theme.typography.composites) {
        const e = (byGroup[c.group] ??= { sizes: new Set(), weights: new Set(), link: false });
        e.sizes.add(c.variant ? `${c.variant}=${c.sizePx}` : String(c.sizePx));
        e.weights.add(c.weightRole); if (c.link) e.link = true;
      }
      console.log(`  type: ${stats.typeComposites} composites — ${Object.entries(byGroup).map(([g, e]) => `${g}[${[...e.sizes].join(' ')} · w:${[...e.weights].join('/')}${e.link ? ' +link' : ''}]`).join(' ')}`);
      const fl = theme.typography.composites.filter((c) => c.sizeMinPx !== c.sizePx);
      console.log(`  fluid: ${theme.typography.fluid ? `${fl.length} composites ${theme.typography.minViewport}–${theme.typography.maxViewport}px (e.g. ${fl.slice(0, 3).map((c) => `${c.path} ${c.sizeMinPx}→${c.sizePx}`).join(', ')})` : 'OFF (static)'}`);
    }
    console.log(`  shadow: ${theme.shadow.steps.length}-step ramp + inset, ${theme.shadow.steps[0].light.length}-layer, softness ${theme.shadow.softness}, tint(hue ${theme.shadow.tint.hue}, amount ${theme.shadow.tint.amount}) — mode-aware (lift-primary, reduced dark); elevation = foreground tier + shadow (no colour group)`);
    console.log(`  layout: ${theme.layout.breakpoints.length} breakpoints (${theme.layout.breakpoints.map((b) => `${b.name}=${b.px}`).join(' ')}); grid cols ${theme.layout.grid.map((g) => g.columns).join('/')}, gutter ${theme.layout.grid.map((g) => g.gutterPx).join('/')} + margin ${theme.layout.grid.map((g) => g.marginPx).join('/')} (spacing aliases); container max ${theme.layout.containerMax}/narrow ${theme.layout.containerNarrow}`);
    console.log(`  gradient: ${theme.gradient.gradients.length ? theme.gradient.gradients.map((g) => `${g.name}(${g.kind}${g.kind === 'linear' ? ` ${g.angle}°` : ''}, ${g.stops.length} stops, ${g.interpolation}, worst-on-white ${g.worstOnWhite}:1)`).join(' · ') : 'none (opt-in axis)'}`);
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

  // BrandInput ↔ schema conformance — both example inputs (compiled from their
  // design.md) + the worked schema example.
  const exampleInput = JSON.parse(readFileSync(resolve(here, '../schema/theme-schema.example.json'), 'utf8'));
  console.log('');
  for (const [label, input] of [['aurora (from design.md)', auroraInput], ['harbor (from design.md)', harborInput], ['theme-schema.example.json', exampleInput]] as const) {
    const errs = validateBrandInput(input);
    if (errs.length) { ok = false; console.log(`[schema] ❌ ${label} violates theme-schema.json:`); errs.forEach((x) => console.log(`   ${x}`)); }
    else console.log(`[schema] ✓ ${label} conforms to the BrandInput contract`);
  }

  writeFileSync(resolve(here, 'modes-report.md'), md.join('\n') + '\n');
  console.log(`\n[written] ${resolve(here, 'modes-report.md')}`);
  if (!ok) process.exitCode = 1;
}
