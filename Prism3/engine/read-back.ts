/**
 * Prism3 engine — READ-BACK (the read leg + the verify contract), docs/22 Phase 4 / #109.
 *
 * The inverse of `write-plan.ts`. Where `WritePlan` describes what colour variables to MATERIALISE,
 * `ReadbackSnapshot` is a plain-data mirror of what a live Figma file CONTAINS — read out of
 * `figma.variables` by the plugin executor (`plugin/src/read-figma.ts`) and handed here. This module
 * is the pure half: the snapshot SHAPE + `verifyReadback`, the materialisation-contract check.
 *
 * `verifyReadback` ports the checks the `materialise-to-figma.ts` `verifyPass` string-emitter has
 * always encoded (the API-probe read-back), so the same guarantees hold whether the read runs via the
 * paste-path or the live plugin:
 *   - **modesDistinct** — `color/background/primary` binds a DIFFERENT target per mode (the collapse
 *     guard: the #85 round-trip caught a script that collapsed every mode to one target).
 *   - **aliasesResolve** — every alias target name a colour var references exists (palette or color).
 *   - **slot scopes** — the per-slot scope contract (docs/10 §3 / docs/20) survived the round-trip.
 *   - **fieldFamilyPresent / retiredRolesAbsent / renamedRolesAbsent / bareDangerPresent** — the
 *     role-set shape (#86 renames, retired roles gone, bare `foreground/danger` present).
 *   - **primitivesHidden** — core-palette primitives are hidden from publishing (ref tier).
 *
 * PURE — no `node:*`, no `figma.*`, no I/O. The snapshot is host-neutral plain data: it's what #110's
 * shared UI will consume to SEED itself from an existing themed file, and what the write-side
 * `WritePlan` can be diffed against for a full write→read round-trip.
 */
import type { Rgba } from './write-plan';

/** A colour variable's per-mode value, as read back: either a resolved literal or the NAME of the
 *  variable it aliases (names — not Figma ids — so the snapshot is pure + serialisable). `null`
 *  alias = the mode carries a literal with no alias (shouldn't happen for our colour vars, but the
 *  read is faithful about it). */
export type ReadValue = { alias: string | null } | Rgba;

export type ReadbackSnapshot = {
  collections: { name: string; modes: string[] }[];
  /** core-palette primitives (ref tier). */
  palette: { name: string; scopes: string[]; hidden: boolean }[];
  /** semantic colour roles — per-mode alias target name (or literal). */
  color: { name: string; scopes: string[]; valuesByMode: Record<string, ReadValue> }[];
};

/** The verify verdict: an overall pass + the individual checks + supporting detail for the UI/log. */
export type ReadbackVerdict = {
  ok: boolean;
  checks: {
    modesDistinct: boolean;
    aliasesResolve: boolean;
    slotScopes: boolean;
    fieldFamilyPresent: boolean;
    retiredRolesAbsent: boolean;
    renamedRolesAbsent: boolean;
    bareDangerPresent: boolean;
    primitivesHidden: boolean;
  };
  details: {
    colorVars: number;
    modes: string[];
    backgroundPrimaryByMode: Record<string, string>;
    danglingAliases: string[];
    scopeMismatches: string[];
  };
};

// Expected slot scopes (docs/10 §3 / docs/20) — the same contract the emit-figma scope maps produce.
// Sorted, comma-joined, to compare order-independently against the read-back scopes.
const EXPECTED_SLOT_SCOPES: Record<string, string[]> = {
  'color/interactive/primary/text': ['TEXT_FILL'],
  'color/interactive/primary/border': ['STROKE_COLOR'],
  'color/disabled/fill': ['FRAME_FILL', 'SHAPE_FILL'],
  'color/disabled/on-fill': ['FRAME_FILL', 'SHAPE_FILL', 'TEXT_FILL'],
  'color/disabled/text': ['TEXT_FILL'],
  'color/disabled/icon': ['FRAME_FILL', 'SHAPE_FILL', 'STROKE_COLOR'],
  'color/disabled/border': ['STROKE_COLOR'],
  'color/field/fill': ['FRAME_FILL', 'SHAPE_FILL'],
  'color/field/border/rest': ['STROKE_COLOR'],
  'color/field/border/hover': ['STROKE_COLOR'],
  'color/field/placeholder': ['TEXT_FILL'],
};
const FIELD_FAMILY = ['color/field/fill', 'color/field/border/rest', 'color/field/border/hover', 'color/field/placeholder'];
// Retired by role-set changes — must be absent (docs/20 / #86).
const RETIRED_ROLES = ['color/action/default', 'color/text/on-action', 'color/text/on-disabled', 'color/foreground/danger/default'];
// Renamed by #86 (.surface → .fill / .on-disabled → .on-fill; field/border went flat → border/{rest,hover}).
const RENAMED_ROLES = ['color/disabled/surface', 'color/disabled/on-disabled', 'color/field/surface', 'color/field/border'];

const sortScopes = (s: string[]): string => [...s].sort().join(',');
const isAlias = (v: ReadValue): v is { alias: string | null } => 'alias' in v;

/**
 * Verify a read-back snapshot against the materialisation contract. Pure — the plugin reads the live
 * file into a `ReadbackSnapshot`, then calls this; the same checks run on the shim in tests.
 */
export const verifyReadback = (snap: ReadbackSnapshot): ReadbackVerdict => {
  const colorByName = new Map(snap.color.map((v) => [v.name, v]));
  const has = (n: string): boolean => colorByName.has(n);
  const allNames = new Set<string>([...snap.palette.map((p) => p.name), ...snap.color.map((c) => c.name)]);
  const colModes = snap.collections.find((c) => c.name === 'color')?.modes ?? [];

  // modesDistinct — background/primary must bind a different TARGET per mode (the collapse guard).
  const bg = colorByName.get('color/background/primary');
  const backgroundPrimaryByMode: Record<string, string> = {};
  for (const m of colModes) {
    const val = bg?.valuesByMode[m];
    backgroundPrimaryByMode[m] = val ? (isAlias(val) ? (val.alias ?? 'literal') : 'literal') : 'ABSENT';
  }
  const modesDistinct = new Set(Object.values(backgroundPrimaryByMode)).size > 1;

  // aliasesResolve — every alias target name a colour var references must exist somewhere.
  const danglingAliases: string[] = [];
  for (const v of snap.color)
    for (const [m, val] of Object.entries(v.valuesByMode))
      if (isAlias(val) && val.alias && !allNames.has(val.alias)) danglingAliases.push(`${v.name} @${m} -> ${val.alias}`);
  const aliasesResolve = danglingAliases.length === 0;

  // slotScopes — the per-slot scope contract survived (order-independent).
  const scopeMismatches: string[] = [];
  for (const [name, want] of Object.entries(EXPECTED_SLOT_SCOPES)) {
    const v = colorByName.get(name);
    const got = v ? sortScopes(v.scopes) : 'ABSENT';
    if (got !== sortScopes(want)) scopeMismatches.push(`${name}: ${got} != ${sortScopes(want)}`);
  }
  const slotScopes = scopeMismatches.length === 0;

  const checks = {
    modesDistinct,
    aliasesResolve,
    slotScopes,
    fieldFamilyPresent: FIELD_FAMILY.every(has),
    retiredRolesAbsent: RETIRED_ROLES.every((n) => !has(n)),
    renamedRolesAbsent: RENAMED_ROLES.every((n) => !has(n)),
    bareDangerPresent: has('color/foreground/danger'),
    primitivesHidden: snap.palette.length > 0 && snap.palette.every((p) => p.hidden),
  };

  return {
    ok: Object.values(checks).every(Boolean),
    checks,
    details: {
      colorVars: snap.color.length,
      modes: colModes,
      backgroundPrimaryByMode,
      danglingAliases,
      scopeMismatches,
    },
  };
};
