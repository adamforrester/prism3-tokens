/**
 * Prism3 engine — DTCG emit.
 *
 * Turns the generated ramps into a W3C Design Tokens (DTCG) tree in NB's own
 * dialect (`nbds.color.*`, `rgb(r, g, b)` values, 3-digit padded steps), so the
 * output is drop-in comparable with the hand-built NB tokens. Every leaf also
 * carries the engine's provenance under `$extensions.prism3` (OKLCH source,
 * tonal band, contrast role) — the thing the hand-built tokens can't tell you.
 *
 * A semantic alias layer (`nbds.semantic.*`) maps the contract roles to
 * primitive steps using DTCG brace aliases, then the run validates that every
 * alias resolves. Run:  npx tsx Prism3/engine/emit-dtcg.ts
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { RGB, contrast, oklchToRgb } from './color';
import { Step, stepKey, bandOf } from './ramp';
import { loadSpecs, buildRamp, RampSpec } from './theme';

const here = dirname(fileURLToPath(import.meta.url));
const WHITE: RGB = { r: 255, g: 255, b: 255 };
const round = (n: number, d = 4) => Math.round(n * 10 ** d) / 10 ** d;
const rgbStr = ({ r, g, b }: RGB) => `rgb(${r}, ${g}, ${b})`;

const bandName: Record<string, string> = {
  Highlights: 'Highlight', Quarter: 'Quarter-Tone', Mid: 'Mid-Tone',
  ThreeQuarter: 'Three-Quarter-Tone', Shadows: 'Shadow',
};

type Leaf = {
  $type: 'color';
  $value: string;
  $description: string;
  $extensions: { prism3: Record<string, unknown> };
};

/** A generated primitive step -> DTCG leaf with engine provenance. */
const primitiveLeaf = (spec: RampSpec, s: Step): Leaf => {
  const isAnchor = !!spec.anchor && s.num === spec.anchor.stepNum;
  const role =
    isAnchor ? `${spec.role}-anchor (exact brand value, pinned)` :
    s.num === 500 ? 'mid-tone AA pivot (≥4.5:1 on white and black)' :
    bandName[s.band];
  return {
    $type: 'color',
    $value: rgbStr(s.rgb),
    $description: `${spec.name} ${s.key} — ${bandName[s.band]} band — ${role}`,
    $extensions: {
      prism3: {
        generated: true,
        source: 'oklch',
        oklch: { l: round(s.oklch.l), c: round(s.oklch.c), h: round(s.oklch.h, 2) },
        hex: s.hex,
        band: s.band,
        anchor: isAnchor,
        contrastOnWhite: contrast(s.rgb, WHITE),
      },
    },
  };
};

const colorLeaf = (rgb: RGB, description: string, extra: Record<string, unknown> = {}): Leaf => ({
  $type: 'color',
  $value: rgbStr(rgb),
  $description: description,
  $extensions: { prism3: { generated: true, source: 'oklch', ...extra } },
});

const aliasLeaf = (path: string, description: string, extra: Record<string, unknown> = {}): Leaf => ({
  $type: 'color',
  $value: `{${path}}`,
  $description: description,
  $extensions: { prism3: { role: 'semantic', aliasOf: path, ...extra } },
});

// ---- build the tree ----
const specs = loadSpecs();
const ramps = new Map(specs.map((s) => [s.palette, buildRamp(s)] as const));

const color: Record<string, any> = {
  white: colorLeaf(WHITE, 'Pure white — Highlight base / default surface', { band: 'Highlights' }),
  black: colorLeaf({ r: 0, g: 0, b: 0 }, 'Pure black — Shadow base', { band: 'Shadows' }),
};
for (const spec of specs) {
  const node: Record<string, Leaf> = {};
  for (const s of ramps.get(spec.palette)!) node[s.key] = primitiveLeaf(spec, s);
  color[spec.palette] = node;
}

// Semantic layer — contract roles mapped to primitive steps via DTCG aliases.
const semantic = {
  text: {
    primary: aliasLeaf('nbds.color.neutral.950', 'Primary text on light surfaces'),
    secondary: aliasLeaf('nbds.color.neutral.650', 'Secondary / supporting text on light'),
    inverse: aliasLeaf('nbds.color.white', 'Text on dark surfaces'),
  },
  surface: {
    default: aliasLeaf('nbds.color.white', 'Default page surface'),
    sunken: aliasLeaf('nbds.color.neutral.050', 'Sunken / subtle surface'),
  },
  border: {
    default: aliasLeaf('nbds.color.neutral.200', 'Default border (Quarter-Tone, not text-safe by design)'),
    strong: aliasLeaf('nbds.color.neutral.400', 'Stronger border / divider'),
  },
  action: {
    primary: aliasLeaf('nbds.color.red.550', 'Primary action — the exact brand red anchor'),
    'primary-hover': aliasLeaf('nbds.color.red.600', 'Primary action, hover'),
  },
  status: {
    success: aliasLeaf('nbds.color.green.500', 'Success'),
    warning: aliasLeaf('nbds.color.amber.500', 'Warning'),
    danger: aliasLeaf('nbds.color.red.550', 'Danger / destructive'),
  },
};

const tree = {
  nbds: { color, semantic },
  $extensions: {
    generator: { name: 'Prism3 engine', method: 'OKLCH generation from theme schema' },
    prism3: {
      schema: 'theme-schema.example.json',
      note: 'Generated primitives + semantic aliases. Primitives carry OKLCH provenance and tonal-band/contrast roles under $extensions.prism3.',
    },
  },
};

// ---- validate: every brace alias resolves to a real token path ----
const resolvePath = (path: string): boolean => {
  let node: any = tree;
  for (const seg of path.split('.')) {
    node = node?.[seg];
    if (node === undefined) return false;
  }
  return node && node.$type === 'color';
};
const aliases: { path: string; ref: string }[] = [];
const walk = (node: any, path: string[]) => {
  if (node && typeof node === 'object') {
    if (typeof node.$value === 'string') {
      const m = node.$value.match(/^\{(.+)\}$/);
      if (m) aliases.push({ path: path.join('.'), ref: m[1] });
      return;
    }
    for (const [k, v] of Object.entries(node)) if (!k.startsWith('$')) walk(v, [...path, k]);
  }
};
walk(tree.nbds, ['nbds']);
const broken = aliases.filter((a) => !resolvePath(a.ref));

// ---- count leaves ----
let leaves = 0;
const countLeaves = (node: any) => {
  if (node && typeof node === 'object') {
    if (node.$type === 'color') { leaves++; return; }
    for (const [k, v] of Object.entries(node)) if (!k.startsWith('$')) countLeaves(v);
  }
};
countLeaves(tree.nbds);

// ---- write ----
const outDir = resolve(here, 'out');
mkdirSync(outDir, { recursive: true });
const outPath = resolve(outDir, 'nb.tokens.json');
writeFileSync(outPath, JSON.stringify(tree, null, 2) + '\n');

console.log('Prism3 DTCG emit');
console.log(`  palettes: ${Object.keys(color).join(', ')}`);
console.log(`  color leaves: ${leaves}`);
console.log(`  semantic aliases: ${aliases.length}, resolved: ${aliases.length - broken.length}/${aliases.length}`);
if (broken.length) {
  console.log(`  ❌ broken aliases:`);
  for (const b of broken) console.log(`     ${b.path} -> {${b.ref}}`);
  process.exitCode = 1;
} else {
  console.log('  ✅ all aliases resolve');
}
console.log(`  [written] ${outPath}`);
