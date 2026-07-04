/**
 * Prism3 engine — ramp generation.
 *
 * Implements the architecture spec's color rules (§5.1–5.2):
 *  - exact anchor preservation (the brand value is a pinned step, never shifted)
 *  - ~20-step scale
 *  - gamut-aware chroma (vivid hues taper naturally at the extremes)
 *  - chroma arc (tints desaturate)
 *  - 5 tonal bands over the steps
 *  - contrast-role-targeted placement: role-critical steps are PLACED at the
 *    luminance their contrast role requires, not wherever even spacing lands
 *    them. The Mid-Tone 500 is the dual-side AA pivot (4.5:1 on white & black).
 */
import { OKLCH, RGB, maxChroma, oklchToRgb, hex, luminance, dualContrastWindow } from './color';

/** The 20-step scale (Univers/NB density), excluding pure white(000)/black(999). */
export const STEP_NUMS = [
  25, 50, 100, 150, 200, 250, 300, 350, 400, 450, 500, 550, 600, 650, 700, 750, 800, 850, 900, 950,
];

export const stepKey = (n: number): string => String(n).padStart(3, '0');

export type Band = 'Highlights' | 'Quarter' | 'Mid' | 'ThreeQuarter' | 'Shadows';
export const bandOf = (n: number): Band => {
  if (n <= 50) return 'Highlights';
  if (n <= 350) return 'Quarter';
  if (n <= 600) return 'Mid';
  if (n <= 900) return 'ThreeQuarter';
  return 'Shadows';
};

export type Step = { num: number; key: string; oklch: OKLCH; rgb: RGB; hex: string; band: Band };

export type Anchor = { oklch: OKLCH; stepNum: number };

export type RampOpts = {
  hue: number;
  /** Constant target chroma (the plateau); shaped into an arc then gamut-clamped. */
  chroma: number;
  chromaCeiling?: number;
  /** Lightest/darkest OKLCH L targets (engine defaults). */
  lMax?: number;
  lMin?: number;
  /** Optional exact anchor, pinned verbatim at its step. */
  anchor?: Anchor;
  /** Chroma-peak lightness for an UNanchored vivid ramp (status colors). When
   *  set (and no anchor), the ramp uses the asymmetric arc instead of the
   *  neutral bell. Ignored if `anchor` is given. */
  peakL?: number;
  /** Place role-critical steps at their required luminance. Default true. */
  roleTargets?: boolean;
};

/** Where an even-L engine would auto-place a color of lightness `l`. */
export const autoPlaceStep = (l: number, lMax = 0.975, lMin = 0.16): number => {
  const n = STEP_NUMS.length;
  let best = STEP_NUMS[0], bestD = Infinity;
  STEP_NUMS.forEach((num, i) => {
    const target = lMax + (lMin - lMax) * (i / (n - 1));
    const d = Math.abs(target - l);
    if (d < bestD) { bestD = d; best = num; }
  });
  return best;
};

/** The lightness at which a hue reaches its widest in-gamut chroma (yellows peak
 *  light, blues peak dark). Used to centre an unanchored vivid ramp. */
export const peakChromaL = (hue: number, ceiling = 0.4): number => {
  let bestL = 0.5, best = 0;
  for (let L = 0.05; L <= 0.97; L += 0.01) {
    const c = maxChroma(L, hue, ceiling);
    if (c > best) { best = c; bestL = L; }
  }
  return bestL;
};

/** The chroma arc as a function of L — peaks at the anchor/peakL (arc), or mid (bell). */
const chromaForL = (
  L: number, hue: number, plateau: number, peakL: number, arc: boolean,
  lMax: number, lMin: number, ceiling: number
): number => {
  let shape: number;
  if (arc) {
    if (L >= peakL) {
      // Guard the degenerate span: an anchor at (or beyond) lMax makes lMax−peakL ≤ 0, so
      // 0/0 → NaN → `#NaNNaNNaN` (M-01). At the peak the ratio is 0 anyway (full chroma).
      const span = lMax - peakL;
      const t = span > 1e-9 ? Math.min(1, (L - peakL) / span) : 0;
      shape = 0.05 + 0.95 * (1 - t) ** 1.3; // tints desaturate toward white
    } else {
      const span = peakL - lMin;
      const t = span > 1e-9 ? Math.min(1, (peakL - L) / span) : 0;
      shape = 0.45 + 0.55 * (1 - t); // shades keep more chroma than tints
    }
  } else {
    shape = 1 - Math.min(1, Math.abs(L - peakL) / 0.5); // symmetric bell (neutral)
  }
  return Math.min(plateau * shape, maxChroma(L, hue, ceiling));
};

/** Solve for the L whose rendered luminance hits `targetY` (Y rises with L). */
const solveLForLuminance = (
  targetY: number, hue: number,
  cFor: (L: number) => number, lMax: number, lMin: number
): number => {
  let lo = lMin, hi = lMax;
  for (let i = 0; i < 30; i++) {
    const mid = (lo + hi) / 2;
    const y = luminance(oklchToRgb({ l: mid, c: cFor(mid), h: hue }));
    if (y < targetY) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
};

/** Piecewise-linear L over step indices through the given knots (sorted, monotonic). */
const lCurve = (knots: { i: number; L: number }[], n: number): number[] => {
  const ks = [...knots].sort((a, b) => a.i - b.i);
  const L: number[] = [];
  for (let x = 0; x < n; x++) {
    let a = ks[0], b = ks[ks.length - 1];
    for (let k = 0; k < ks.length - 1; k++) {
      if (x >= ks[k].i && x <= ks[k + 1].i) { a = ks[k]; b = ks[k + 1]; break; }
    }
    L[x] = a.i === b.i ? a.L : a.L + (b.L - a.L) * ((x - a.i) / (b.i - a.i));
  }
  return L;
};

export const generateRamp = (opts: RampOpts): Step[] => {
  const {
    hue, chroma, chromaCeiling = 0.4, lMax = 0.975, lMin = 0.16, anchor, roleTargets = true,
  } = opts;
  const n = STEP_NUMS.length;
  const ai = anchor ? STEP_NUMS.indexOf(anchor.stepNum) : -1;
  const arc = !!anchor || opts.peakL != null; // arc for brand/status, bell for neutral
  const peakL = anchor ? anchor.oklch.l : (opts.peakL ?? 0.5);
  const cFor = (L: number) => chromaForL(L, hue, chroma, peakL, arc, lMax, lMin, chromaCeiling);

  // ---- build the L curve from knots: endpoints + brand anchor + role anchors ----
  const knots: { i: number; L: number }[] = [
    { i: 0, L: lMax },
    { i: n - 1, L: lMin },
  ];
  if (anchor) knots.push({ i: ai, L: anchor.oklch.l });
  if (roleTargets) {
    // Mid-Tone 500 = the dual-side AA pivot: place it at the centre of the
    // luminance window where it clears 4.5:1 on BOTH white and black.
    const i500 = STEP_NUMS.indexOf(500);
    if (i500 !== ai) {
      const [ylo, yhi] = dualContrastWindow(4.5);
      const L500 = solveLForLuminance((ylo + yhi) / 2, hue, cFor, lMax, lMin);
      knots.push({ i: i500, L: L500 });
    }
  }
  // keep knots monotonic in L (a lighter step must not end up darker)
  const sorted = [...knots].sort((a, b) => a.i - b.i);
  for (let k = 1; k < sorted.length; k++) {
    if (sorted[k].L > sorted[k - 1].L) sorted[k].L = sorted[k - 1].L; // clamp non-increasing
  }
  const Ls = lCurve(sorted, n);

  const steps = STEP_NUMS.map((num, i) => {
    let L = Ls[i], C: number, H: number;
    if (i === ai) {
      L = anchor!.oklch.l; C = anchor!.oklch.c; H = anchor!.oklch.h; // anchor exact
    } else {
      H = hue; C = cFor(L);
    }
    const o: OKLCH = { l: L, c: C, h: H };
    const rgb = oklchToRgb(o);
    return { num, key: stepKey(num), oklch: o, rgb, hex: hex(rgb), band: bandOf(num) };
  });
  // M-02: the anchor L is written verbatim AFTER the knot monotonic-clamp, so an anchor whose
  // lightness disagrees with its step position leaves the ramp non-monotonic (a later step
  // lighter than an earlier one). The mode pickers assume number↔lightness ordering and would
  // silently misread it — fail loud instead. (A consistent anchor, e.g. from autoPlaceStep as
  // brandTheme uses, never trips this.)
  for (let i = 1; i < steps.length; i++) {
    if (steps[i].oklch.l > steps[i - 1].oklch.l + 1e-9)
      throw new Error(`ramp: non-monotonic lightness — step ${steps[i].key} (L ${steps[i].oklch.l.toFixed(3)}) is lighter than ${steps[i - 1].key} (L ${steps[i - 1].oklch.l.toFixed(3)}). A pinned anchor's lightness disagrees with its step position; place the anchor at the step matching its L (autoPlaceStep).`);
  }
  return steps;
};
