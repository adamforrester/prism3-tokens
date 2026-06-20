/**
 * Prism3 engine — theme loading.
 *
 * Reads the reverse-engineered NB schema and turns it into ramp specs, so the
 * regression and the DTCG emitter generate from one source of truth.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { generateRamp, Step } from './ramp';

const here = dirname(fileURLToPath(import.meta.url));
export const SCHEMA = resolve(here, '../schema/theme-schema.example.json');

export type Role = 'brand' | 'neutral' | 'success' | 'warning';

export type RampSpec = {
  name: string;       // human label, e.g. "brand (red)"
  palette: string;    // token key, e.g. "red"
  role: Role;
  hue: number;
  chroma: number;
  anchor?: { oklch: { l: number; c: number; h: number }; stepNum: number };
};

const oklchOf = (o: any) => ({ l: o.l, c: o.c, h: o.h });

export const loadSpecs = (): RampSpec[] => {
  const s = JSON.parse(readFileSync(SCHEMA, 'utf8'));
  return [
    { name: 'brand (red)', palette: 'red', role: 'brand', hue: s.primaryColor.oklch.h, chroma: s.primaryColor.oklch.c, anchor: { oklch: oklchOf(s.primaryColor.oklch), stepNum: 550 } },
    { name: 'success (green)', palette: 'green', role: 'success', hue: s.statusColors.success.oklch.h, chroma: s.statusColors.success.oklch.c, anchor: { oklch: oklchOf(s.statusColors.success.oklch), stepNum: 500 } },
    { name: 'warning (amber)', palette: 'amber', role: 'warning', hue: s.statusColors.warning.oklch.h, chroma: s.statusColors.warning.oklch.c, anchor: { oklch: oklchOf(s.statusColors.warning.oklch), stepNum: 500 } },
    { name: 'neutral', palette: 'neutral', role: 'neutral', hue: s.neutralHue.hue, chroma: s.neutralHue.chroma },
  ];
};

export const buildRamp = (spec: RampSpec): Step[] =>
  generateRamp({ hue: spec.hue, chroma: spec.chroma, anchor: spec.anchor });
