/**
 * component-schema.ts — the component-definition contract (docs/14 §2, docs/19).
 *
 * DRAFT v0. One `ComponentDef` per component is the SINGLE SOURCE from which every
 * artifact projects — Figma shell, WC/React code, Storybook, docs, `.ai.json`,
 * Code Connect (docs/19 §1). This file is the schema + a runtime validator; the
 * definitions themselves live one-file-per-component under `components/` (see
 * `components/button.ts`). Final on-disk format (TS object vs YAML+parser) is a
 * build decision (docs/14 §2) — the SHAPE is what this locks.
 *
 * Seeded, not invented (docs/13 inspirations + KB):
 *  - Key spine mirrors the KB §15 agent-consumable schema (`components/_schema.md`):
 *    identity / description / api / states / variants / accessibility / content /
 *    composition / notes — plus the two projections §15 doesn't carry (docs/ai).
 *  - Maps to `@directededges/specs-schema` (Specs CLI: `Component` / `AnyProp`) —
 *    conformant-or-mappable, the follow-don't-fork posture (docs/13 §3).
 *  - Type-checked + runtime-validated so metadata drift is a GATE FAILURE, not a
 *    silent rot — the Astryx typed-`ComponentDoc` lesson (docs/13 §1), the same
 *    "can't drift" mechanism as the lever manifest / preview spec.
 *  - Carries `avoid_when` + a relationships graph — the intent-poor gap docs/13 §1
 *    names in Astryx's schema; this is a DECISION surface, not a props table.
 *
 * The binding insight (docs/14 §2): visual props bind to LOCKED TOKEN NAMES, not
 * values. That makes a definition brand- and mode-INVARIANT structure — brands and
 * modes are value-columns the engine already supplies. `validateComponentDef` checks
 * every binding resolves against a real generated tree, so a definition is bound to a
 * *verified contract* — a property Specs-CLI-style observed-value specs can't have.
 */
import { normalizeRef, tokenPaths, isPrimitiveRef } from './eval';

/** A reference to a token by its root-relative dotted path (`color.action.default`,
 *  `radius.md`). Validated to resolve against the generated tree. */
export type TokenRef = string;

export type PropDef = {
  name: string;
  /** Free-form per §15 ("keys locked, values prose"): `boolean` / `enum` / `node` / a union. */
  type: string;
  default?: string | boolean | number;
  required?: boolean;
  /** Allowed values when `type` is an enum. */
  values?: string[];
  deprecated?: boolean;
  description: string;
};

export type ComponentDef = {
  // ---- identity (§15) + specs-schema Component.id/name ----
  id: string;
  name: string;
  aliases?: string[];
  /** Grouping by purpose (action / input / container / feedback / navigation / …). */
  category: string;
  status: 'draft' | 'stable' | 'deprecated';
  description: string;

  // ---- api (§15) ----
  /** The substrate this stands on (the form family stands on `text-field`). The def
   *  records the DELTA, not a copy — the §15 `inherits:` convention. */
  inherits?: string;
  props: PropDef[];

  // ---- states + variants (§15) ----
  /** Runtime interaction states: rest / hover / pressed / focus / disabled / … . `[]`
   *  for non-interactive primitives. */
  states: string[];
  /** Intentional axes and their values, e.g. `{ size: ['sm','md','lg'], tone: [...] }`. */
  variants: Record<string, string[]>;

  // ---- the token BINDING (docs/14 §2) — the brand/mode-invariant skin ----
  /** slot → token ref. Slots are the component's paintable/measurable surfaces; a
   *  state- or variant-qualified slot uses a dotted suffix (`fill.hover`, `label.on-disabled`).
   *  VALUES are token refs, validated to resolve. Reach for SEMANTIC roles, not primitives. */
  tokens: Record<string, TokenRef>;

  // ---- accessibility (§15) ----
  accessibility: {
    role?: string;
    wcag?: string[];
    keyboard?: string;
    focus?: string;
  };

  // ---- content (§15, SCALES) ----
  content?: {
    labelPattern?: string;
    errorPattern?: string;
    emptyPattern?: string;
    [k: string]: string | undefined;
  };

  // ---- docs projection (docs/19 §6 — carried so docs are a projection, not a re-author) ----
  docs: {
    usage: string;
    do?: string[];
    dont?: string[];
    contentGuidelines?: string;
  };

  // ---- .ai.json projection (KB 03 §7 / docs/13 §1 — the decision surface) ----
  ai: {
    primaryPurpose: string;
    whenToUse: string;
    /** The highest-value field (docs/13 §1: AI defaults to using whatever it finds). Required. */
    avoidWhen: string;
    commonPartners?: string[];
    triggerKeywords?: string[];
    /** Tiebreaker when several components could serve a prompt. */
    generationPriority?: number;
  };

  // ---- composition (§15) ----
  composition?: {
    composesWith?: string[];
    alternativeTo?: string[];
    supersedes?: string[];
    supersededBy?: string[];
  };

  // ---- motion / notes (§15, SCALES) ----
  motion?: { enter?: string; exit?: string; reduceMotion?: string };
  notes?: { contested?: string[]; unverified?: string[] };
};

/**
 * Validate a `ComponentDef`. Structural checks always run; when a generated `tree`
 * (+ its `root`) is supplied, every token binding is resolved against it — the
 * bound-to-a-verified-contract gate (docs/14 §2). Returns `{ errors, warnings }`:
 * errors fail the gate (drift / broken binding); warnings surface a smell
 * (a component reaching past the semantic layer into a raw primitive tier).
 */
export const validateComponentDef = (
  def: ComponentDef,
  tree?: any,
  root?: string,
): { errors: string[]; warnings: string[] } => {
  const errors: string[] = [];
  const warnings: string[] = [];
  const req = (cond: boolean, msg: string) => { if (!cond) errors.push(msg); };

  // identity + prose
  req(!!def.id && /^[a-z][a-z0-9-]*$/.test(def.id), `id must be kebab-case (got '${def.id}')`);
  req(!!def.name, 'name is required');
  req(!!def.category, 'category is required');
  req(['draft', 'stable', 'deprecated'].includes(def.status), `status must be draft|stable|deprecated (got '${def.status}')`);
  req(!!def.description, 'description is required');

  // api
  req(Array.isArray(def.props), 'props must be an array');
  for (const p of def.props ?? []) {
    req(!!p.name && !!p.type && !!p.description, `prop '${p?.name ?? '?'}' needs name + type + description`);
    if (p.values && p.default !== undefined && typeof p.default === 'string' && !p.values.includes(p.default))
      errors.push(`prop '${p.name}': default '${p.default}' is not one of its values [${p.values.join(', ')}]`);
  }

  // states + variants
  req(Array.isArray(def.states), 'states must be an array (use [] for non-interactive)');
  req(!!def.variants && typeof def.variants === 'object', 'variants must be an object');

  // accessibility + docs + ai (the projections must be present — they're not optional)
  req(!!def.accessibility, 'accessibility block is required');
  req(!!def.docs?.usage, 'docs.usage is required (docs projection)');
  req(!!def.ai?.primaryPurpose && !!def.ai?.whenToUse, 'ai.primaryPurpose + ai.whenToUse are required');
  req(!!def.ai?.avoidWhen, 'ai.avoidWhen is required — the highest-value intent field (docs/13 §1)');

  // token bindings — resolve against the generated contract when a tree is supplied
  req(!!def.tokens && typeof def.tokens === 'object' && Object.keys(def.tokens).length > 0, 'tokens block must bind at least one slot');
  if (tree && root && def.tokens) {
    const valid = tokenPaths(tree, root);
    for (const [slot, ref] of Object.entries(def.tokens)) {
      if (typeof ref !== 'string') { errors.push(`token slot '${slot}' must be a string ref`); continue; }
      const path = normalizeRef(ref, root);
      if (!valid.has(path)) errors.push(`token slot '${slot}' → '${ref}' does not resolve in the generated tree`);
      else if (isPrimitiveRef(path)) warnings.push(`token slot '${slot}' → '${ref}' reaches a raw primitive tier — prefer a semantic role`);
    }
  }

  return { errors, warnings };
};
