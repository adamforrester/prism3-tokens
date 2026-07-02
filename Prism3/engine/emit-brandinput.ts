/**
 * I/O shell — emit the parsed example `BrandInput`s as a committed JSON artifact.
 *
 * The browser hosts (web dashboard, Figma plugin) boot from a VALIDATED brand, but
 * the `design.md` parser (`design-md.ts`) is node-only, so it can't run in the
 * sandbox. This writes the *pre-resolution* BrandInput as plain data the hosts
 * import directly. The engine already gates each `design.md` → `out/<id>.tokens.json`
 * byte-identically; a `test.ts` drift gate additionally keeps this JSON current and
 * asserts every emitted brand resolves all-green on the preview contracts — so a
 * host can trust whatever it boots from here.
 *
 * PURE consumers only downstream: this shell reads files; the JSON it writes is inert.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { parseDesignMd } from './design-md';

const here = dirname(fileURLToPath(import.meta.url));
const EX = resolve(here, '../examples');
const OUT = resolve(here, '../schema/example-brands.json');

/** The example ids surfaced to the hosts, in menu order (aurora is the boot default). */
export const EXAMPLE_IDS = ['aurora', 'harbor'] as const;

export const exampleBrands = (): Record<string, unknown> => {
  const brands: Record<string, unknown> = {};
  for (const id of EXAMPLE_IDS) {
    brands[id] = parseDesignMd(readFileSync(resolve(EX, `${id}.design.md`), 'utf8')).input;
  }
  return brands;
};

export const exampleBrandsJson = (): string => JSON.stringify(exampleBrands(), null, 2) + '\n';

const isMain = process.argv[1] ? resolve(process.argv[1]) === fileURLToPath(import.meta.url) : false;
if (isMain) {
  writeFileSync(OUT, exampleBrandsJson());
  console.log(`[written] ${OUT}`);
}
