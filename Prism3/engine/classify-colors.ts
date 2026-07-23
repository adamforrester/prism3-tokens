/**
 * Prism3 engine — the colour-role CLASSIFIER (docs/07 §11.5).
 *
 * The one genuinely new parser piece the integration needs: it reads the FLAT
 * `colors: { name → hex }` map from a standard `design.md` into the engine's
 * colour anchors, by NAMING CONVENTION. `brand-skills` emits observed swatches;
 * the engine regenerates a complete, contrast-verified ramp from a few anchors
 * (Decision A, §11.3) — so the classifier's job is to pick the ANCHORS out of the
 * flat map, not to trust the extracted ramp as final. Everything it doesn't turn
 * into an anchor it still records as a `provided` value, so the runner can diff
 * the engine's generated ramp against every observed swatch (the fidelity report).
 *
 * Convention (the shared vocabulary that makes the bridge deterministic):
 *   primary                      → the pinned brand anchor (palette 'primary')
 *   secondary / tertiary         → additional brand palettes (brandColors[])
 *   neutral / neutral-<step>     → derive neutral { hue, chroma } (chroma-weighted)
 *   success / warning            → status anchors (hue + chroma)
 *   error                        → status.danger  (RENAME error→danger, logged)
 *   info                         → NOT an anchor (engine synthesises info); report-only
 *   white / black                → primitives; report-only
 *   <base>-<variant> (primary-dark, secondary-light, …) → report-only, tied to <base>
 *
 * Pure + deterministic. Consumed by `standardToBrandInput` (standard-design-md.ts),
 * which `cli.ts` routes to for the standard `design.md` dialect.
 */
import { hexToRgb, rgbToOklch, RGB } from './color';
import { OKLCH } from './theme';

export type ColorRole =
  | 'primary' | 'secondary' | 'tertiary' | 'neutral'
  | 'success' | 'warning' | 'error' | 'info'
  | 'white' | 'black' | 'variant' | 'unknown';

/** Every swatch from the flat map, with its classification + which generated
 *  palette it should be compared against in the fidelity report. */
export type ProvidedColor = {
  token: string;
  hex: string;
  rgb: RGB;
  oklch: OKLCH;
  role: ColorRole;
  baseRamp: string | null;   // generated palette to diff against ('primary','danger',…) or null
  usedAsAnchor: boolean;     // did this swatch become an engine input anchor?
};

export type ClassifyEntry = { token: string; decision: string };

/** The colour portion of a BrandInput, ready to spread into the full input. */
export type ColorInput = {
  primary: OKLCH;
  neutral: { hue: number; chroma: number };
  brandColors: { name: string; oklch: OKLCH }[];
  status: Partial<Record<'success' | 'warning' | 'danger', OKLCH & { chroma: number }>>;
};

export type ColorClassification = {
  input: ColorInput;
  provided: ProvidedColor[];
  log: ClassifyEntry[];
};

const round = (n: number, dp = 4) => Number(n.toFixed(dp));
const oklchOf = (hex: string): OKLCH => {
  const o = rgbToOklch(hexToRgb(hex));
  return { l: round(o.l), c: round(o.c), h: round(o.h, 2) };
};

// Which generated palette a token should be diffed against, for report grouping.
const baseRampFor = (role: ColorRole, token: string): string | null => {
  switch (role) {
    case 'primary': return 'primary';
    case 'secondary': return 'secondary';
    case 'tertiary': return 'tertiary';
    case 'neutral': case 'white': case 'black': return 'neutral';
    case 'success': return 'success';
    case 'warning': return 'warning';
    case 'error': return 'danger';        // engine calls it danger
    case 'info': return 'info';
    case 'variant': {                     // <base>-<variant> → the base ramp
      const base = token.split('-')[0];
      return ['primary', 'secondary', 'tertiary', 'neutral'].includes(base) ? base : null;
    }
    default: return null;
  }
};

const roleOf = (token: string): ColorRole => {
  const t = token.toLowerCase();
  if (t === 'primary') return 'primary';
  if (t === 'secondary') return 'secondary';
  if (t === 'tertiary') return 'tertiary';
  if (t === 'white') return 'white';
  if (t === 'black') return 'black';
  if (t === 'neutral' || /^neutral-/.test(t)) return 'neutral';
  if (t === 'success') return 'success';
  if (t === 'warning') return 'warning';
  if (t === 'error') return 'error';
  if (t === 'info') return 'info';
  if (/^(primary|secondary|tertiary)-/.test(t)) return 'variant';
  return 'unknown';
};

/**
 * Classify a flat `colors` map into engine anchors + a full provided-swatch list.
 * Deterministic and pure — no I/O.
 */
export const classifyColors = (colors: Record<string, string>): ColorClassification => {
  const log: ClassifyEntry[] = [];
  const provided: ProvidedColor[] = [];

  for (const [token, hex] of Object.entries(colors)) {
    const role = roleOf(token);
    const rgb = hexToRgb(hex);
    provided.push({ token, hex, rgb, oklch: rgbToOklch(rgb), role, baseRamp: baseRampFor(role, token), usedAsAnchor: false });
  }
  const mark = (token: string) => { const p = provided.find((x) => x.token === token); if (p) p.usedAsAnchor = true; };

  // Role lookup is case-insensitive (roleOf lowercases), so anchor EXTRACTION must be too —
  // otherwise `{ Primary: … }` / `{ Error: … }` classify correctly but their `colors[role]`
  // lookup misses, dropping the anchor silently (M-12). Map each canonical role → its hex and
  // ORIGINAL token (for mark/log); a case collision keeps the last, matching the map's own semantics.
  const lc: Record<string, string> = {};       // lowercase role → hex
  const origKey: Record<string, string> = {};  // lowercase role → original token
  for (const [token, hex] of Object.entries(colors)) { const k = token.toLowerCase(); lc[k] = hex; origKey[k] = token; }

  // --- primary anchor (required) ---
  if (!lc.primary) throw new Error("classify-colors: no 'primary' colour in the map — cannot anchor the brand palette");
  const primary = oklchOf(lc.primary);
  mark(origKey.primary);
  log.push({ token: origKey.primary, decision: `→ brand anchor (pinned) oklch(${primary.l} ${primary.c} ${primary.h})` });

  // --- additional brand palettes: secondary, tertiary ---
  const brandColors: { name: string; oklch: OKLCH }[] = [];
  for (const name of ['secondary', 'tertiary']) {
    if (lc[name]) {
      const o = oklchOf(lc[name]);
      brandColors.push({ name, oklch: o });
      mark(origKey[name]);
      log.push({ token: origKey[name], decision: `→ brandColors[] '${name}' (pinned) oklch(${o.l} ${o.c} ${o.h})` });
    }
  }

  // --- neutral: derive { hue, chroma } from all neutral-* swatches ---
  // Grey hue is unstable at near-zero chroma, so weight the hue by each swatch's
  // chroma (the most-tinted neutrals dominate the hue); chroma is the mean.
  const neutrals = provided.filter((p) => p.role === 'neutral');
  let neutral: { hue: number; chroma: number; auto?: boolean };
  if (neutrals.length) {
    const sumC = neutrals.reduce((s, p) => s + p.oklch.c, 0);
    // circular chroma-weighted mean hue
    let x = 0, y = 0;
    for (const p of neutrals) { const r = (p.oklch.h * Math.PI) / 180; x += p.oklch.c * Math.cos(r); y += p.oklch.c * Math.sin(r); }
    const hue = sumC > 1e-6 ? round(((Math.atan2(y, x) * 180) / Math.PI + 360) % 360, 2) : 0;
    const chroma = round(sumC / neutrals.length);
    neutral = { hue, chroma };
    neutrals.forEach((p) => mark(p.token));
    log.push({ token: `neutral-* (${neutrals.length})`, decision: `→ neutral { hue ${hue}, chroma ${chroma} } (chroma-weighted hue, mean chroma over ${neutrals.length} swatches)` });
  } else {
    // No neutral provided → auto-follow the brand primary hue. The generated ramp is identical to the
    // old `hue: primary.h` snapshot (same value at build), but now the cast re-tracks on recolour.
    neutral = { hue: primary.h, chroma: 0.005, auto: true };
    log.push({ token: 'neutral', decision: `→ none provided; auto-follows the brand primary { hue ${neutral.hue}, chroma ${neutral.chroma} }` });
  }

  // --- status: success / warning / error→danger (hue + chroma anchors) ---
  const status: ColorInput['status'] = {};
  const statusMap: [string, 'success' | 'warning' | 'danger'][] = [['success', 'success'], ['warning', 'warning'], ['error', 'danger']];
  for (const [token, key] of statusMap) {
    if (lc[token]) {
      const o = oklchOf(lc[token]);
      status[key] = { l: o.l, c: o.c, h: o.h, chroma: o.c };
      mark(origKey[token]);
      const rename = token === 'error' ? ' [RENAME error→danger]' : '';
      log.push({ token: origKey[token], decision: `→ status.${key}${rename} hue ${o.h}, chroma ${o.c} (lightness placed by the status ramp, not pinned)` });
    }
  }

  // --- report-only swatches (info / white / black / variants / unknown) ---
  for (const p of provided.filter((x) => !x.usedAsAnchor)) {
    const why = p.role === 'info' ? 'info is engine-SYNTHESISED (not an anchor); kept for the fidelity diff'
      : p.role === 'white' || p.role === 'black' ? `${p.role} is a primitive; kept for the fidelity diff`
      : p.role === 'variant' ? `state/scale variant of '${p.baseRamp}'; engine regenerates the ramp — kept for the fidelity diff`
      : 'unrecognised token; kept for the fidelity diff';
    log.push({ token: p.token, decision: `· report-only — ${why}` });
  }

  return { input: { primary, neutral, brandColors, status }, provided, log };
};
