/**
 * Prism3 engine — reader for the STANDARD `design.md` interchange format.
 *
 * The engine's front door for a `design.md` authored by `brand-skills` (the
 * extractor) following the open `google-labs-code/design.md` spec — a DIFFERENT
 * shape from the engine's own `BrandInput` frontmatter that `design-md.ts` parses.
 * `cli.ts` auto-detects this dialect and routes to it (docs/07 §11). The standard
 * file carries RESOLVED, observed values:
 *   - `colors`     — a FLAT map of token-name → sRGB hex ("#C8102E")
 *   - `typography` — a map of token-name → { fontFamily, fontSize, fontWeight, … }
 *   - `rounded` / `spacing` / `elevation` — flat maps of resolved dimensions/CSS
 *   - `name` / `version` — brand identity
 * plus `##` prose sections the spec leaves human-authored.
 *
 * `parseStandardDesignMd` reads the file into a typed `StandardDesignMd`;
 * `standardToBrandInput` then runs the colour-role classifier (`classify-colors.ts`),
 * derives the type families, and applies the optional `x-prism3` levers to produce a
 * `BrandInput`. It reuses `parseYamlSubset` from `design-md.ts` (the YAML-subset
 * parser is format-agnostic), so this is a shape mapper, not a second parser.
 */
import { parseYamlSubset } from './design-md';
import { BrandInput } from './theme';
import { classifyColors, ColorClassification } from './classify-colors';

export type StandardTypeToken = {
  fontFamily?: string;
  fontSize?: string;                    // "94px", "1rem" — resolved dimension string
  fontWeight?: number;
  lineHeight?: number | string;         // 1.19 (unitless × fontSize) or "24px"
  letterSpacing?: string;               // "-0.5px", "-0.02em"
  fontFeature?: string;
  fontVariation?: string;
};

export type StandardDesignMd = {
  name: string;
  version?: string;
  colors: Record<string, string>;                    // token → hex
  typography: Record<string, StandardTypeToken>;     // token → type object
  rounded: Record<string, string | number>;          // token → px string / 0
  spacing: Record<string, string | number>;
  elevation: Record<string, string>;                 // token → CSS box-shadow / "none"
  /** Optional Prism3 engine-levers block (docs/07 §11.4). A namespaced extension
   *  the base spec ignores; brand-skills emits it verbatim from surfaces.md. Empty
   *  when absent — a plain spec file then compiles on engine defaults. */
  xPrism3: Record<string, unknown>;
  prose: string;
};

/** Split the `---`-fenced YAML frontmatter from the trailing prose. Mirrors the
 *  fence handling in `design-md.ts` (kept local so the shipped parser is
 *  untouched). Throws if the opening/closing fence is missing. */
const splitFrontmatter = (text: string): { fm: string; prose: string } => {
  const nl = text.indexOf('\n');
  const firstLine = (nl < 0 ? text : text.slice(0, nl)).trim();
  if (firstLine !== '---') {
    throw new Error("standard design.md must open with a '---' YAML frontmatter fence on the first line");
  }
  const rest = text.slice(nl + 1);
  const close = rest.indexOf('\n---');
  if (close < 0) throw new Error("standard design.md frontmatter is not closed with a '---' line");
  const fm = rest.slice(0, close);
  const afterFence = rest.slice(close + 4);
  const proseStart = afterFence.indexOf('\n');
  const prose = (proseStart < 0 ? '' : afterFence.slice(proseStart + 1)).trim();
  return { fm, prose };
};

const asRecord = (v: unknown): Record<string, any> =>
  v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, any>) : {};

/** Parse a standard `design.md` (brand-skills / google-labs format) into a typed
 *  `StandardDesignMd`. Values are read verbatim — no coercion, no classification. */
export const parseStandardDesignMd = (text: string): StandardDesignMd => {
  const { fm, prose } = splitFrontmatter(text);
  const raw = parseYamlSubset(fm);
  const colorsRaw = asRecord(raw.colors);
  const colors: Record<string, string> = {};
  for (const [k, v] of Object.entries(colorsRaw)) {
    // L-15: an unquoted `#hex` value is read as a YAML comment and stripped to null, which
    // would surface downstream as a baffling `invalid hex 'null'`. Point at the real cause.
    if (v == null || v === '')
      throw new Error(`colour '${k}' has no value — a bare '#hex' is read as a comment; quote it, e.g. ${k}: "#3366ff"`);
    colors[k] = String(v);
  }
  return {
    name: raw.name != null ? String(raw.name) : 'brand',
    version: raw.version != null ? String(raw.version) : undefined,
    colors,
    typography: asRecord(raw.typography) as Record<string, StandardTypeToken>,
    rounded: asRecord(raw.rounded),
    spacing: asRecord(raw.spacing),
    elevation: asRecord(raw.elevation) as Record<string, string>,
    xPrism3: asRecord(raw['x-prism3']),
    prose,
  };
};

// --- standard design.md → BrandInput -----------------------------------------
// The full conversion the CLI (and the fidelity report) run: classify the flat
// colours into anchors, derive the type families, and apply the optional x-prism3
// levers. Pure; the caller owns validation + emit.

/** Slug a brand `name` into an emit id (`Wendy's` → `wendys`, `Acme Corp` →
 *  `acme-corp`). The standard format carries no `id`; the engine needs one. */
export const idFromName = (name: string): string =>
  name.toLowerCase().replace(/['’]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'brand';

/** The family used by body/caption tokens is the TEXT face; the family used by
 *  the display/heading tokens is the DISPLAY face. */
export const deriveFamilies = (typography: StandardDesignMd['typography']): { display?: string; text?: string } => {
  const firstFamilyFor = (pred: (name: string) => boolean): string | undefined => {
    for (const [name, tok] of Object.entries(typography)) if (pred(name.toLowerCase()) && tok.fontFamily) return tok.fontFamily;
    return undefined;
  };
  return {
    display: firstFamilyFor((n) => /^(mega|display|title|button|label|eyebrow)/.test(n)),
    text: firstFamilyFor((n) => /^(body|caption|paragraph)/.test(n)),
  };
};

/** Map the optional namespaced `x-prism3` block (docs/07 §11.4) onto a BrandInput.
 *  Mutates `input`; returns the human-readable list of levers applied. An absent
 *  block applies nothing → the engine runs on defaults (the plain-spec guarantee).
 *  Passed through as-is; the engine's schema validates the values. */
export const applyXPrism3 = (input: BrandInput, x: Record<string, unknown>): string[] => {
  const applied: string[] = [];
  if (x.radiusScale != null) {
    // M-14: Number('soft') is NaN, and NaN passes `typeof … === 'number'` + all min/max
    // comparisons (they're false), so it would slip to NaNpx radius tokens. Reject at ingest.
    const rs = Number(x.radiusScale);
    if (!Number.isFinite(rs)) throw new Error(`x-prism3.radiusScale must be a number (0=sharp … 2=soft), got ${JSON.stringify(x.radiusScale)}`);
    input.radiusScale = rs; applied.push(`radiusScale=${rs}`);
  }
  if (x.typeScale != null) { input.typography = { ...input.typography, typeScale: x.typeScale as any }; applied.push(`typeScale=${x.typeScale}`); }
  if (x.density != null) { input.density = x.density as any; applied.push(`density=${x.density}`); }
  if (x.motionTempo != null) { input.motionPersonality = { tempo: x.motionTempo as any }; applied.push(`motionTempo=${x.motionTempo}`); }
  if (x.actionPalette != null) { input.actionPalette = String(x.actionPalette); applied.push(`actionPalette=${x.actionPalette}`); }
  if (x.iconContrast != null) { input.iconContrast = x.iconContrast as any; applied.push(`iconContrast=${x.iconContrast}`); }
  if (x.surfaces != null) { input.surfaces = x.surfaces as any; applied.push('surfaces'); }
  if (x.gradients != null) { input.gradients = x.gradients as any; applied.push('gradients'); }
  return applied;
};

export type StandardConversion = { input: BrandInput; classification: ColorClassification; xApplied: string[] };

/** Convert a parsed standard `design.md` into a `BrandInput` (+ the classification
 *  and applied levers, for reporting). `id` overrides the name-derived slug. */
export const standardToBrandInput = (std: StandardDesignMd, id?: string): StandardConversion => {
  const classification = classifyColors(std.colors);
  const input: BrandInput = {
    id: id ?? idFromName(std.name),
    primary: classification.input.primary,
    neutral: classification.input.neutral,
    brandColors: classification.input.brandColors,
    status: classification.input.status,
    typography: { families: deriveFamilies(std.typography) },   // typeScale via x-prism3 or engine default
  };
  const xApplied = Object.keys(std.xPrism3).length ? applyXPrism3(input, std.xPrism3) : [];
  return { input, classification, xApplied };
};
