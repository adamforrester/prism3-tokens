/**
 * Prism3 engine — reader for the STANDARD `design.md` interchange format.
 *
 * This is the spike (docs/07 §11.6): the engine's front door for a `design.md`
 * authored by `brand-skills` (the extractor) following the open
 * `google-labs-code/design.md` spec — a DIFFERENT shape from the engine's own
 * `BrandInput` frontmatter that `design-md.ts` parses. The standard file carries
 * RESOLVED, observed values:
 *   - `colors`     — a FLAT map of token-name → sRGB hex ("#C8102E")
 *   - `typography` — a map of token-name → { fontFamily, fontSize, fontWeight, … }
 *   - `rounded` / `spacing` / `elevation` — flat maps of resolved dimensions/CSS
 *   - `name` / `version` — brand identity
 * plus `##` prose sections the spec leaves human-authored.
 *
 * This module does NOT classify or generate — it only reads the file into a typed
 * `StandardDesignMd`. The colour-role classifier (`classify-colors.ts`) turns the
 * flat `colors` map into engine anchors; the runner (`spike-wendys.ts`) drives the
 * whole chain. It reuses `parseYamlSubset` from `design-md.ts` (the YAML-subset
 * parser is format-agnostic), so this is a shape mapper, not a second parser.
 *
 * IMPORTANT: this reader is ADDITIVE and does not touch the shipped step-A
 * pipeline (`design-md.ts` / `cli.ts` / `emit-dtcg.ts`).
 */
import { parseYamlSubset } from './design-md';

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
  for (const [k, v] of Object.entries(colorsRaw)) colors[k] = String(v);
  return {
    name: raw.name != null ? String(raw.name) : 'brand',
    version: raw.version != null ? String(raw.version) : undefined,
    colors,
    typography: asRecord(raw.typography) as Record<string, StandardTypeToken>,
    rounded: asRecord(raw.rounded),
    spacing: asRecord(raw.spacing),
    elevation: asRecord(raw.elevation) as Record<string, string>,
    prose,
  };
};
