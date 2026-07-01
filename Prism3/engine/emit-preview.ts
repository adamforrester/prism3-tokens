/**
 * Prism3 engine — preview-spec emitter (I/O shell).
 *
 * The Node-only write step for the pure `preview.ts` spec (kept separate so the spec
 * stays `node:`-free for browser/Figma-sandbox bundling — docs/07 §3).
 *
 *   npx tsx Prism3/engine/emit-preview.ts   → schema/preview-spec.json
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { buildPreviewSpec, previewSpec, previewTokenRefs } from './preview';

const here = dirname(fileURLToPath(import.meta.url));
const outPath = resolve(here, '../schema/preview-spec.json');
writeFileSync(outPath, JSON.stringify(buildPreviewSpec(), null, 2) + '\n');
const variants = previewSpec.components.reduce((n, c) => n + c.variants.length, 0);
console.log(`[emit-preview] wrote ${outPath} — ${previewSpec.components.length} components, ${variants} variants, ${previewTokenRefs().length} token refs`);
