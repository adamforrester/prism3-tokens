/**
 * Prism3 engine — CLI adapter (the authoring on-ramp; docs/07 §6, build step A).
 *
 *   npx tsx Prism3/engine/cli.ts <design.md> [--out <dir>]
 *
 * A thin new ENTRY POINT over the portable core — not a second pipeline. It does
 * exactly what the regression runner does for the hardcoded brands, but for an
 * arbitrary `design.md` supplied on the command line:
 *
 *   read design.md → parseDesignMd → validate (theme-schema.json)
 *                  → brandTheme (the pure core) → emitTheme (DTCG + .ai.json)
 *                  → gate on aliases + mode contracts
 *
 * No token logic lives here; `brandTheme`, `emitTheme`, and `validateBrandInput`
 * are imported from the same core the hardcoded emit uses. This is the I/O shell:
 * it owns the file read + argv + process exit; the parser and core stay pure.
 *
 * Exit codes: 0 = clean; 1 = schema violation, a broken alias, or a failed mode
 * contrast contract (so it fails CI). Errors print a readable diagnosis.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
import { brandTheme } from './theme';
import { parseDesignMd } from './design-md';
import { emitTheme, validateBrandInput } from './emit-dtcg';

const fail = (msg: string): never => {
  console.error(`\n✖ ${msg}\n`);
  process.exit(1);
};

const main = () => {
  // ---- parse argv: <design.md> [--out <dir>] ----
  const argv = process.argv.slice(2);
  let designPath: string | undefined;
  let outDir: string | undefined;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--out' || a === '-o') { outDir = argv[++i]; if (!outDir) fail('--out needs a directory argument'); }
    else if (a === '--help' || a === '-h') {
      console.log('Usage: tsx cli.ts <design.md> [--out <dir>]\n\n  <design.md>   a brand brief with YAML frontmatter (see examples/*.design.md)\n  --out <dir>   output directory for <id>.tokens.json + <id>.ai.json (default: engine/out)');
      process.exit(0);
    }
    else if (a.startsWith('-')) fail(`unknown flag: ${a}`);
    else if (!designPath) designPath = a;
    else fail(`unexpected extra argument: ${a}`);
  }
  if (!designPath) fail('missing <design.md> argument (try --help)');

  const here = dirname(fileURLToPath(import.meta.url));
  const resolvedOut = outDir ? resolve(process.cwd(), outDir) : resolve(here, 'out');

  // ---- read + parse ----
  let text: string;
  try { text = readFileSync(resolve(process.cwd(), designPath!), 'utf8'); }
  catch { return fail(`cannot read design file: ${designPath}`); }

  let parsed;
  try { parsed = parseDesignMd(text); }
  catch (e) { return fail(`parse error in ${designPath}: ${(e as Error).message}`); }
  const { input } = parsed;

  // ---- validate against the BrandInput contract ----
  const errs = validateBrandInput(input);
  if (errs.length) {
    console.error(`\n✖ ${designPath} violates the BrandInput contract (schema/theme-schema.json):`);
    errs.forEach((x) => console.error(`   · ${x}`));
    process.exit(1);
  }

  // ---- compile the pure core + emit ----
  let theme;
  try { theme = brandTheme(input); }
  catch (e) { return fail(`brandTheme failed for '${(input as any).id}': ${(e as Error).message}`); }
  const { stats } = emitTheme(theme, resolvedOut);

  // ---- report + gate ----
  console.log(`\n[${theme.id}] ${theme.root}.* / ${theme.colorFormat}  ←  ${designPath}`);
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
};

main();
