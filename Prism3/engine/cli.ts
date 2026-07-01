/**
 * Prism3 engine — CLI adapter (the authoring on-ramp; docs/07 §6 + §11).
 *
 *   npx tsx Prism3/engine/cli.ts <design.md> [--out <dir>] [--fidelity]
 *
 * A thin ENTRY POINT over the portable core — not a second pipeline. It accepts
 * BOTH `design.md` dialects and auto-detects which:
 *
 *   • ENGINE-NATIVE — frontmatter compiles 1:1 to BrandInput (`primary: {l,c,h}`,
 *     `neutral: {hue,chroma}`, …); see examples/*.design.md. Read by `parseDesignMd`.
 *   • STANDARD (brand-skills / google-labs) — a flat `colors:` hex map + structured
 *     type/dimension maps + an optional `x-prism3` levers block. Read by
 *     `parseStandardDesignMd`, then the colour-role classifier turns the flat map
 *     into anchors (`standardToBrandInput`). This is what makes a real brand-skills
 *     extraction a production input path, not a spike.
 *
 * Detection: a top-level `colors:` map is the standard dialect (engine-native never
 * has one); otherwise native. Both then run the same core:
 *   … → BrandInput → validate (theme-schema.json) → brandTheme → emitTheme → gate.
 *
 * `--fidelity` (standard dialect only) additionally writes `<id>-fidelity-report.md`
 * — the Decision-A regression artefact diffing every observed value against the
 * generated system (§11.3). No token logic lives here; the parser, classifier, core,
 * and report builder are all imported. This is the I/O shell: file read + argv + exit.
 *
 * Exit codes: 0 = clean; 1 = schema violation, a broken alias, or a failed mode
 * contrast contract (so it fails CI). Errors print a readable diagnosis.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
import { Theme, brandTheme } from './theme';
import { parseDesignMd } from './design-md';
import { parseStandardDesignMd, standardToBrandInput } from './standard-design-md';
import { buildFidelityReport } from './fidelity';
import { emitTheme, validateBrandInput } from './emit-dtcg';

const fail = (msg: string): never => {
  console.error(`\n✖ ${msg}\n`);
  process.exit(1);
};

const validateOrExit = (input: unknown, designPath: string) => {
  const errs = validateBrandInput(input);
  if (errs.length) {
    console.error(`\n✖ ${designPath} violates the BrandInput contract (schema/theme-schema.json):`);
    errs.forEach((x) => console.error(`   · ${x}`));
    process.exit(1);
  }
};

// Shared emit + gate + report. Returns nothing; exits non-zero on a failed gate.
const emitAndGate = (theme: Theme, resolvedOut: string, designPath: string, source: string) => {
  const { stats } = emitTheme(theme, resolvedOut);
  console.log(`\n[${theme.id}] ${theme.root}.* / ${theme.colorFormat}  ←  ${designPath} (${source})`);
  for (const n of theme.notes) console.log(`   · ${n}`);
  console.log(`  palettes: ${theme.palettes.map((p) => p.palette).join(', ')} (danger ← ${theme.roleToPalette.danger})`);
  console.log(`  aliases: ${stats.resolved}/${stats.aliases} resolve | mode contracts: ${stats.modePass}/${stats.modeChecks} pass`);
  console.log(`  [written] ${resolve(resolvedOut, theme.id + '.tokens.json')}`);
  console.log(`  [written] ${resolve(resolvedOut, theme.id + '.ai.json')}`);
  const broken = stats.broken.length > 0;
  const contractsFail = stats.modePass < stats.modeChecks;
  if (broken) stats.broken.forEach((b) => console.error(`   ❌ unresolved alias: ${b.path} -> {${b.ref}}`));
  if (contractsFail) console.error(`   ❌ ${stats.modeChecks - stats.modePass} mode contrast contract(s) failed`);
  if (broken || contractsFail) process.exit(1);
  console.log(`  ✓ ${theme.id} generated cleanly — all aliases resolve, all contrast contracts hold`);
  return stats;
};

const main = () => {
  // ---- parse argv: <design.md> [--out <dir>] [--fidelity] ----
  const argv = process.argv.slice(2);
  let designPath: string | undefined;
  let outDir: string | undefined;
  let fidelity = false;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--out' || a === '-o') { outDir = argv[++i]; if (!outDir) fail('--out needs a directory argument'); }
    else if (a === '--fidelity') fidelity = true;
    else if (a === '--help' || a === '-h') {
      console.log('Usage: tsx cli.ts <design.md> [--out <dir>] [--fidelity]\n\n  <design.md>   a brand brief with YAML frontmatter — engine-native (examples/*.design.md)\n                OR a standard brand-skills / google-labs design.md (flat colors + x-prism3)\n  --out <dir>   output directory for <id>.tokens.json + <id>.ai.json (default: engine/out)\n  --fidelity    (standard dialect) also write <id>-fidelity-report.md — the observed-vs-generated diff');
      process.exit(0);
    }
    else if (a.startsWith('-')) fail(`unknown flag: ${a}`);
    else if (!designPath) designPath = a;
    else fail(`unexpected extra argument: ${a}`);
  }
  if (!designPath) fail('missing <design.md> argument (try --help)');

  const here = dirname(fileURLToPath(import.meta.url));
  const resolvedOut = outDir ? resolve(process.cwd(), outDir) : resolve(here, 'out');

  // ---- read ----
  let text: string;
  try { text = readFileSync(resolve(process.cwd(), designPath!), 'utf8'); }
  catch { return fail(`cannot read design file: ${designPath}`); }

  // ---- detect dialect: a top-level flat `colors:` map is the standard dialect ----
  let std;
  try { std = parseStandardDesignMd(text); }
  catch (e) { return fail(`parse error in ${designPath}: ${(e as Error).message}`); }
  const isStandard = Object.keys(std.colors).length > 0;

  if (isStandard) {
    // ---- STANDARD dialect: classify the flat colours into anchors ----
    const { input, classification, xApplied } = standardToBrandInput(std);
    console.log(`[standard] '${std.name}' → id '${input.id}' — ${Object.keys(std.colors).length} colours, ${Object.keys(std.typography).length} type tokens; x-prism3: ${xApplied.length ? xApplied.join(', ') : 'none (defaults)'}`);
    validateOrExit(input, designPath!);
    let theme: Theme;
    try { theme = brandTheme(input); }
    catch (e) { return fail(`brandTheme failed for '${input.id}': ${(e as Error).message}`); }
    const stats = emitAndGate(theme, resolvedOut, designPath!, 'standard');
    if (fidelity) {
      const { md, anchorDe } = buildFidelityReport(std, classification, input, theme, stats, xApplied);
      const reportPath = resolve(resolvedOut, `${theme.id}-fidelity-report.md`);
      writeFileSync(reportPath, md);
      console.log(`  [written] ${reportPath}  (anchor ΔE00 ${anchorDe.toFixed(2)})`);
    }
    return;
  }

  // ---- ENGINE-NATIVE dialect ----
  if (fidelity) console.error('  (note: --fidelity applies to the standard dialect only; ignored for an engine-native brief)');
  let input;
  try { input = parseDesignMd(text).input; }
  catch (e) { return fail(`parse error in ${designPath}: ${(e as Error).message}`); }
  validateOrExit(input, designPath!);
  let theme: Theme;
  try { theme = brandTheme(input); }
  catch (e) { return fail(`brandTheme failed for '${(input as any).id}': ${(e as Error).message}`); }
  emitAndGate(theme, resolvedOut, designPath!, 'engine-native');
};

main();
