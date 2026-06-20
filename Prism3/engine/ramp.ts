/**
 * Prism3 engine — ramp generation.
 *
 * Implements the architecture spec's color rules (§5.1–5.2):
 *  - exact anchor preservation (the brand value is a pinned step, never shifted)
 *  - ~20-step scale
 *  - gamut-aware chroma (vivid hues taper naturally at the extremes)
 *  - 5 tonal bands over the steps
 */
import { OKLCH, RGB, maxChroma, oklchToRgb, hex } from './color';

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
  /** Constant target chroma (the plateau); gamut-clamped per step. */
  chroma: number;
  chromaCeiling?: number;
  /** Lightest/darkest OKLCH L targets (engine defaults). */
  lMax?: number;
  lMin?: number;
  /** Optional exact anchor, pinned verbatim at its step. */
  anchor?: Anchor;
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

export const generateRamp = (opts: RampOpts): Step[] => {
  const { hue, chroma, chromaCeiling = 0.4, lMax = 0.975, lMin = 0.16, anchor } = opts;
  const n = STEP_NUMS.length;
  const ai = anchor ? STEP_NUMS.indexOf(anchor.stepNum) : -1;

  return STEP_NUMS.map((num, i) => {
    // ---- Lightness: even by default; piecewise-linear through the anchor if pinned ----
    let L: number;
    if (ai < 0) {
      L = lMax + (lMin - lMax) * (i / (n - 1));
    } else if (i === ai) {
      L = anchor!.oklch.l;
    } else if (i < ai) {
      L = lMax + (anchor!.oklch.l - lMax) * (i / ai);
    } else {
      L = anchor!.oklch.l + (lMin - anchor!.oklch.l) * ((i - ai) / (n - 1 - ai));
    }

    // ---- Chroma: an ARC that peaks at the anchor (or mid) and tapers toward
    //      both ends, then clamped to the in-gamut max; anchor exact. Real
    //      ramps desaturate their tints — a flat plateau over-saturates the
    //      light end where the gamut is wide (NB regression, green.050). ----
    let C: number, H: number;
    if (i === ai) {
      C = anchor!.oklch.c;
      H = anchor!.oklch.h;
    } else {
      H = hue;
      const peakL = anchor ? anchor.oklch.l : 0.5;
      let shape: number;
      if (anchor) {
        if (L >= peakL) {
          const t = Math.min(1, (L - peakL) / (lMax - peakL));
          shape = 0.05 + 0.95 * (1 - t) ** 1.3; // tints desaturate toward white
        } else {
          const t = Math.min(1, (peakL - L) / (peakL - lMin));
          shape = 0.45 + 0.55 * (1 - t); // shades keep more chroma than tints
        }
      } else {
        // no anchor (neutral): symmetric bell, near-gray at both ends
        shape = 1 - Math.min(1, Math.abs(L - peakL) / 0.5);
      }
      C = Math.min(chroma * shape, maxChroma(L, H, chromaCeiling));
    }

    const o: OKLCH = { l: L, c: C, h: H };
    const rgb = oklchToRgb(o);
    return { num, key: stepKey(num), oklch: o, rgb, hex: hex(rgb), band: bandOf(num) };
  });
};
