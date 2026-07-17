/**
 * Plugin build (#107). Two esbuild bundles, one per context (docs/18 §1):
 *   • main.ts → dist/main.js   — the sandbox controller (manifest.main)
 *   • ui/ui.ts → inlined into dist/ui.html — the iframe (manifest.ui)
 *
 * The UI must be a SINGLE self-contained HTML file: a Figma plugin iframe has no server to
 * fetch a separate .js from (and we ship `allowedDomains:["none"]`), so the bundled JS is
 * inlined into a <script> in the HTML template. iife + no network — nothing loads at runtime.
 *
 * `--watch` keeps both rebuilding. Run: `node build.mjs` (or `npm run build` / `npm run watch`).
 */
import { build, context } from 'esbuild';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const out = resolve(root, 'dist');
const watch = process.argv.includes('--watch');

const mainOpts = {
  entryPoints: [resolve(root, 'src/main.ts')],
  outfile: resolve(out, 'main.js'),
  bundle: true,
  format: 'iife',        // the sandbox is not an ES-module context
  target: 'es2020',
  logLevel: 'info',
};

// Bundle the UI to an in-memory JS string, then inline it into the HTML template.
const htmlTemplate = await readFile(resolve(root, 'src/ui/index.html'), 'utf8');
const buildUiHtml = async () => {
  const res = await build({
    entryPoints: [resolve(root, 'src/ui/ui.ts')],
    bundle: true,
    format: 'iife',
    target: 'es2020',
    write: false,
    logLevel: 'silent',
  });
  const js = res.outputFiles[0].text;
  // Replace the dev-only module script tag with the inlined bundle.
  const html = htmlTemplate.replace(
    /<script type="module" src="\.\/ui\.ts"><\/script>/,
    `<script>${js}</script>`,
  );
  await mkdir(out, { recursive: true });
  await writeFile(resolve(out, 'ui.html'), html);
  console.log('  dist/ui.html   (UI bundle inlined)');
};

if (watch) {
  const ctx = await context(mainOpts);
  await ctx.watch();
  await buildUiHtml();
  // esbuild's context watch covers main.js; rebuild the inlined UI on any src change.
  const { watch: fsWatch } = await import('node:fs');
  fsWatch(resolve(root, 'src'), { recursive: true }, () => buildUiHtml().catch(console.error));
  console.log('watching plugin/src …');
} else {
  await build(mainOpts);
  await buildUiHtml();
  console.log('plugin build complete → plugin/dist/');
}
