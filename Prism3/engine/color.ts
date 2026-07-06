/**
 * Prism3 engine — color math (dependency-free).
 *
 * Everything the ramp generator and regression need: sRGB <-> OKLCH,
 * sRGB -> CIELAB (for CIEDE2000), WCAG contrast, and gamut-aware max chroma.
 * No external libraries on purpose — the engine must run without a network
 * install, and the math is small enough to own and audit.
 */

export type RGB = { r: number; g: number; b: number }; // 0..255
export type OKLCH = { l: number; c: number; h: number }; // l 0..1, c 0+, h deg

// ---- sRGB <-> linear ----
const srgbToLinear = (c: number): number => {
  const cs = c / 255;
  return cs <= 0.04045 ? cs / 12.92 : ((cs + 0.055) / 1.055) ** 2.4;
};
const linearToSrgb = (c: number): number => {
  const v = c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055;
  return v;
};

// ---- linear sRGB <-> OKLab (Björn Ottosson) ----
const linToOklab = (lr: number, lg: number, lb: number) => {
  const l = 0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb;
  const m = 0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb;
  const s = 0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb;
  const l_ = Math.cbrt(l), m_ = Math.cbrt(m), s_ = Math.cbrt(s);
  return {
    L: 0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_,
    a: 1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_,
    b: 0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_,
  };
};
const oklabToLin = (L: number, a: number, b: number) => {
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const l = l_ ** 3, m = m_ ** 3, s = s_ ** 3;
  return {
    lr: 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    lg: -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    lb: -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  };
};

// ---- OKLCH <-> sRGB ----
export const rgbToOklch = ({ r, g, b }: RGB): OKLCH => {
  const { L, a, b: bb } = linToOklab(srgbToLinear(r), srgbToLinear(g), srgbToLinear(b));
  const c = Math.hypot(a, bb);
  let h = (Math.atan2(bb, a) * 180) / Math.PI;
  if (h < 0) h += 360;
  return { l: L, c, h };
};

/** OKLCH -> linear sRGB triplet (may be out of [0,1] = out of gamut). */
const oklchToLinRgb = ({ l, c, h }: OKLCH) => {
  const hr = (h * Math.PI) / 180;
  return oklabToLin(l, c * Math.cos(hr), c * Math.sin(hr));
};

export const inGamut = (o: OKLCH, eps = 1e-4): boolean => {
  const { lr, lg, lb } = oklchToLinRgb(o);
  return [lr, lg, lb].every((v) => v >= -eps && v <= 1 + eps);
};

export const oklchToRgb = (o: OKLCH): RGB => {
  const { lr, lg, lb } = oklchToLinRgb(o);
  const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
  return {
    r: Math.round(clamp01(linearToSrgb(clamp01(lr))) * 255),
    g: Math.round(clamp01(linearToSrgb(clamp01(lg))) * 255),
    b: Math.round(clamp01(linearToSrgb(clamp01(lb))) * 255),
  };
};

export const hex = ({ r, g, b }: RGB): string =>
  '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('');

/**
 * Parse a hex colour string → RGB (0..255). Accepts `#rgb`, `#rrggbb`, with or
 * without the leading `#`. The inverse of `hex()`. Used by the standard-design.md
 * reader / colour-role classifier, which receive brand anchors as sRGB hex.
 */
export const hexToRgb = (s: string): RGB => {
  let h = s.trim().replace(/^#/, '');
  // Accept #RGB and #RGBA (expand each nibble), and drop the alpha of #RRGGBBAA / #RGBA —
  // 8-digit alpha hex like `#C8102EFF` is common in real extractions; a brand anchor is opaque,
  // so the alpha is irrelevant and must not be rejected as "invalid hex" (M-13).
  if (h.length === 3 || h.length === 4) h = h.split('').map((c) => c + c).join('');
  if (h.length === 8) h = h.slice(0, 6);
  if (h.length !== 6 || /[^0-9a-fA-F]/.test(h)) throw new Error(`invalid hex colour: '${s}'`);
  return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16) };
};

/**
 * Largest in-gamut chroma at a given L and H, capped at `ceiling`.
 * Binary search — this is what makes vivid hues taper naturally at the
 * light/dark extremes instead of clamping to mud.
 */
export const maxChroma = (l: number, h: number, ceiling = 0.4): number => {
  let lo = 0, hi = ceiling;
  for (let i = 0; i < 28; i++) {
    const mid = (lo + hi) / 2;
    if (inGamut({ l, c: mid, h })) lo = mid;
    else hi = mid;
  }
  return lo;
};

// ---- WCAG contrast ----
const relLuminance = ({ r, g, b }: RGB): number =>
  0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(b);

// Returns the RAW WCAG contrast ratio. WCAG conformance is defined on the un-rounded
// value, so every pass/fail decision must compare THIS — rounding is a display concern
// applied only at emit boundaries (tree/ai-metadata/preview), never before a threshold
// test. (CR-01: rounding here let #007ea1-on-black at 4.4990 report 4.50 and false-pass
// a 4.5:1 AA contract — squarely in the engine's least-extreme-passing sweet spot.)
export const contrast = (a: RGB, b: RGB): number => {
  const la = relLuminance(a) + 0.05, lb = relLuminance(b) + 0.05;
  return Math.max(la, lb) / Math.min(la, lb);
};

/** WCAG relative luminance of a color as actually rendered (0..1). */
export const luminance = (rgb: RGB): number => relLuminance(rgb);

/** Composite a translucent `over` colour at alpha `a` (0..1) onto an opaque `base`
 *  — straight "source-over" in sRGB, the model Figma/CSS use for a solid fill under
 *  a translucent one. Used to verify that content stays legible on the *result* of
 *  an interactive overlay sitting on a surface (docs/20 §13). */
export const composite = (base: RGB, over: RGB, a: number): RGB => ({
  r: over.r * a + base.r * (1 - a),
  g: over.g * a + base.g * (1 - a),
  b: over.b * a + base.b * (1 - a),
});

/**
 * Luminance window in which a color clears `ratio`:1 against BOTH white and
 * black. For 4.5 it is the famously narrow [~0.175, ~0.183] — this is what
 * makes the Mid-Tone 500 step (the dual-side AA pivot) a placed role, not an
 * accident of even spacing.
 */
export const dualContrastWindow = (ratio = 4.5): [number, number] => {
  // The most any single luminance can clear against BOTH extremes is √21 ≈ 4.583
  // (at the geometric-mean luminance where the black-side and white-side ratios
  // meet). Past that the window inverts (min > max) — an empty set. Return no
  // window by throwing rather than handing back an inverted [min>max] pair a
  // caller would misread as a valid range (e.g. a future HC 7:1 caller). L-02.
  if (ratio > Math.sqrt(21))
    throw new Error(`dualContrastWindow: no colour clears ${ratio}:1 on both black and white — the max dual-side ratio is √21 ≈ 4.58`);
  const min = ratio * 0.05 - 0.05; // passes on black
  const max = 1.05 / ratio - 0.05; // passes on white
  return [min, max];
};

// ---- sRGB -> CIELAB (D65) for CIEDE2000 ----
const rgbToLab = ({ r, g, b }: RGB) => {
  const lr = srgbToLinear(r), lg = srgbToLinear(g), lb = srgbToLinear(b);
  // linear sRGB -> XYZ (D65)
  const X = lr * 0.4124564 + lg * 0.3575761 + lb * 0.1804375;
  const Y = lr * 0.2126729 + lg * 0.7151522 + lb * 0.072175;
  const Z = lr * 0.0193339 + lg * 0.119192 + lb * 0.9503041;
  const xn = 0.95047, yn = 1.0, zn = 1.08883;
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const fx = f(X / xn), fy = f(Y / yn), fz = f(Z / zn);
  return { L: 116 * fy - 16, a: 500 * (fx - fy), b: 200 * (fy - fz) };
};

/** CIEDE2000 color difference between two sRGB colors. */
export const deltaE2000 = (c1: RGB, c2: RGB): number => {
  const { L: L1, a: a1, b: b1 } = rgbToLab(c1);
  const { L: L2, a: a2, b: b2 } = rgbToLab(c2);
  const rad = Math.PI / 180, deg = 180 / Math.PI;
  const avgC = (Math.hypot(a1, b1) + Math.hypot(a2, b2)) / 2;
  const G = 0.5 * (1 - Math.sqrt(avgC ** 7 / (avgC ** 7 + 25 ** 7)));
  const a1p = a1 * (1 + G), a2p = a2 * (1 + G);
  const C1p = Math.hypot(a1p, b1), C2p = Math.hypot(a2p, b2);
  const h1p = (Math.atan2(b1, a1p) * deg + 360) % 360;
  const h2p = (Math.atan2(b2, a2p) * deg + 360) % 360;
  const dLp = L2 - L1, dCp = C2p - C1p;
  let dhp = 0;
  if (C1p * C2p !== 0) {
    dhp = h2p - h1p;
    if (dhp > 180) dhp -= 360;
    else if (dhp < -180) dhp += 360;
  }
  const dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin((dhp * rad) / 2);
  const avgLp = (L1 + L2) / 2, avgCp = (C1p + C2p) / 2;
  let avghp = h1p + h2p;
  if (C1p * C2p !== 0) {
    if (Math.abs(h1p - h2p) > 180) avghp += h1p + h2p < 360 ? 360 : -360;
    avghp /= 2;
  }
  const T =
    1 -
    0.17 * Math.cos((avghp - 30) * rad) +
    0.24 * Math.cos(2 * avghp * rad) +
    0.32 * Math.cos((3 * avghp + 6) * rad) -
    0.2 * Math.cos((4 * avghp - 63) * rad);
  const dTheta = 30 * Math.exp(-(((avghp - 275) / 25) ** 2));
  const Rc = 2 * Math.sqrt(avgCp ** 7 / (avgCp ** 7 + 25 ** 7));
  const Sl = 1 + (0.015 * (avgLp - 50) ** 2) / Math.sqrt(20 + (avgLp - 50) ** 2);
  const Sc = 1 + 0.045 * avgCp;
  const Sh = 1 + 0.015 * avgCp * T;
  const Rt = -Math.sin(2 * dTheta * rad) * Rc;
  return Math.sqrt(
    (dLp / Sl) ** 2 + (dCp / Sc) ** 2 + (dHp / Sh) ** 2 + Rt * (dCp / Sc) * (dHp / Sh)
  );
};
