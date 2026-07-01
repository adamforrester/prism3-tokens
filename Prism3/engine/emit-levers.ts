/**
 * Prism3 engine — lever-manifest emitter (I/O shell).
 *
 * The Node-only write step for the pure `levers.ts` manifest (kept separate so the
 * manifest stays `node:`-free for browser/Figma-sandbox bundling — docs/07 §3,
 * the pure-core / I/O-shell split; same pattern as `theme.ts` vs `nb-fixture.ts`).
 *
 *   npx tsx Prism3/engine/emit-levers.ts   → schema/lever-manifest.json
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { buildLeverManifest, leverManifest, leverGroups } from './levers';

const here = dirname(fileURLToPath(import.meta.url));
const outPath = resolve(here, '../schema/lever-manifest.json');
writeFileSync(outPath, JSON.stringify(buildLeverManifest(), null, 2) + '\n');
console.log(`[emit-levers] wrote ${outPath} — ${leverManifest.length} levers across ${leverGroups.length} groups (${leverManifest.filter((l) => l.advanced).length} advanced)`);
