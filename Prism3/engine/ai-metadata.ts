/**
 * Prism3 engine — AI-readable metadata sidecar.
 *
 * Generates an `out/<id>.ai.json` peer to the DTCG `out/<id>.tokens.json`: the
 * agent surface for the SEMANTIC layer, per the practice's schema
 * (knowledge-base 31-color-systems §9 + 00-principles "descriptions = highest-ROI;
 * avoid_when > when_to_use"). Every field is GENERATED — `meaning`/`when_to_use`/
 * `avoid_when` from a deterministic role→intent model, and `paired_with` /
 * `contrast_with` / `mode_overrides` reshaped from data the engine already
 * computes (the on-* pairings, the floor contract, the per-mode resolution). The
 * point: contract-true metadata that regenerates, vs the field's hand-authored
 * metadata that rots. Keeps tokens.json DTCG-pure (no non-standard sibling keys).
 */
import { Theme } from './theme';
import { resolveAllModes } from './modes';

type AiToken = {
  $description: string;
  meaning: string;
  when_to_use: string;
  avoid_when: string;
  paired_with?: string[];
  contrast_with?: { token: string; min: string; ratio: number }[];
  mode_overrides: Record<string, string>;
};

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const INTENT: Record<string, string> = {
  brand: 'brand identity', success: 'success / positive', warning: 'warning / caution',
  danger: 'destructive / error', info: 'informational',
};
const EMPHASIS: Record<string, string> = { primary: 'primary (highest-emphasis)', secondary: 'secondary', tertiary: 'tertiary (subtle)' };
// state → the interaction moment it applies to (makes state variants informative)
const STATE_WHEN: Record<string, string> = { hover: 'on pointer hover', pressed: 'while pressed', focused: 'when keyboard-focused', disabled: 'when disabled / unavailable', selected: 'when selected / active', visited: 'after it has been visited' };
const sc = (state?: string) => (state && STATE_WHEN[state] ? ` ${STATE_WHEN[state]}` : '');
const NEUTRAL_FILL: Record<string, string> = {
  primary: 'High-emphasis neutral elements — neutral/secondary buttons, strong chips.',
  secondary: 'Medium-emphasis neutral fills — subtle buttons, chips.',
  tertiary: 'Low-emphasis neutral fills — ghost buttons, hover wells.',
};
// `meaning` answers "what does this SIGNIFY / what is it for" (vs `$description`,
// which is "what it is"). Semantic signal per intent; structural purpose otherwise.
const SIGNAL: Record<string, string> = {
  brand: 'Brand identity', success: 'Success / positive signalling', warning: 'Warning / caution signalling',
  danger: 'Destructive / error signalling', info: 'Informational signalling',
};
const genMeaning = (group: string, variant: string): string => {
  if (variant === 'interactive') return 'Interactivity / actions';
  if (variant === 'link') return 'Interactivity / navigation';
  if (SIGNAL[variant]) return SIGNAL[variant];                                  // intent fill/text/icon/border (incl. danger)
  if (variant.endsWith('-subtle')) { const i = variant.replace('-subtle', ''); return `${SIGNAL[i] ?? cap(i)} (low-emphasis)`; }
  if (variant.startsWith('on-')) { const x = variant.slice(3); return `Legible content on ${x === 'emphasis' ? 'emphasis / inverse' : (INTENT[x] ?? x)} fills`; }
  if (variant === 'disabled') return 'Unavailable / inactive state';
  if (variant === 'inverse') return group === 'border' ? 'Inverted-surface separation' : group === 'background' ? 'Inverted-surface emphasis' : 'Inverted-surface contrast';
  if (group === 'background') return variant === 'sunken' ? 'Recessed depth' : variant === 'subtle' ? 'Low-emphasis grouping' : 'Container elevation / depth';
  if (group === 'foreground') return 'Neutral element emphasis';
  if (group === 'text' || group === 'icon') return 'Content hierarchy / reading emphasis';
  if (group === 'border') return 'Separation / structure';
  if (group === 'scrim') return 'Background dimming / modal focus';
  return `${cap(group)} role`;
};
// the on-color target an on-* label sits on
const onTarget = (x: string): string => x === 'interactive' ? 'foreground.interactive.default' : x === 'emphasis' ? 'background.inverse' : `foreground.${x}`;

/** Generate the prose + relationship fields for one semantic role. */
const describe = (group: string, variant: string, state: string | undefined): { desc: string; when_to_use: string; avoid_when: string; paired_with?: string[] } => {
  const st = state ? ` (${state} state)` : '';
  const intent = INTENT[variant];

  if (group === 'background') {
    if (['primary', 'secondary', 'tertiary', 'quaternary'].includes(variant)) {
      const n = { primary: 1, secondary: 2, tertiary: 3, quaternary: 4 }[variant];
      return { desc: `Elevation ${n} container surface (page → floating)`, when_to_use: `Fill for ${variant === 'primary' ? 'the page / base' : variant === 'quaternary' ? 'floating UI (dialogs, popovers, menus)' : variant === 'tertiary' ? 'nested / higher-elevation containers' : 'raised cards & panels'}.`, avoid_when: 'Do not use for text, icons, or interactive fills. For interactive elements use foreground.interactive.', paired_with: ['text.primary', 'text.secondary', 'border.default'] };
    }
    if (variant === 'subtle') return { desc: 'Muted / grouped container surface', when_to_use: 'Secondary background for grouped or low-emphasis regions.', avoid_when: 'Do not use as the primary page surface (use background.primary).' };
    if (variant === 'sunken') return { desc: 'Sunken / inset container surface', when_to_use: 'Wells, insets, tracks — areas that read as below the page.', avoid_when: 'Do not use for raised elements (use background.secondary+).' };
    if (variant === 'inverse') return { desc: 'Inverse container surface', when_to_use: 'High-contrast inverted sections (e.g. a dark callout in light mode).', avoid_when: 'Do not place mode-default text on it — use text.inverse / text.on-emphasis.', paired_with: ['text.inverse', 'text.on-emphasis'] };
    if (variant.endsWith('-subtle')) { const i = variant.replace('-subtle', ''); return { desc: `Subtle ${INTENT[i] ?? i} tint surface`, when_to_use: `Low-emphasis ${i} backgrounds — badges, banners, selected rows.`, avoid_when: `Do not use as a solid ${i} fill (use foreground.${i}) or for ${i} text (use text.${i}).`, paired_with: [`text.${i}`, `icon.${i}`] }; }
  }

  if (group === 'foreground') { // fills
    if (['primary', 'secondary', 'tertiary'].includes(variant)) return { desc: `${EMPHASIS[variant]} neutral element fill`, when_to_use: NEUTRAL_FILL[variant], avoid_when: 'Do not use for text/icons (use text.*/icon.*) or page surfaces (use background.*).' };
    if (variant === 'inverse') return { desc: 'Neutral element fill for inverse contexts', when_to_use: 'Neutral fills placed on inverse surfaces.', avoid_when: 'Do not use on default surfaces (use foreground.primary).' };
    if (variant === 'interactive') return { desc: `Interactive (action) fill${st}`, when_to_use: `Primary interactive surfaces — buttons, toggles, controls${sc(state)}.`, avoid_when: 'Do not use for destructive actions (use foreground.danger) or non-interactive surfaces (use background.*).', paired_with: ['text.on-interactive', 'icon.on-interactive'] };
    if (variant === 'danger') return { desc: `Destructive / error fill${st}`, when_to_use: `Destructive actions — delete/remove buttons, error fills${sc(state)}.`, avoid_when: 'Do not use for non-destructive actions (use foreground.interactive) or warnings (use foreground.warning).', paired_with: ['text.on-danger', 'icon.on-danger'] };
    if (intent) return { desc: `Solid ${intent} fill`, when_to_use: `Filled ${variant} elements — badges, banners, status chips.`, avoid_when: `Do not use for ${variant} text (use text.${variant}) or as a subtle tint (use background.${variant}-subtle).`, paired_with: [`text.on-${variant}`, `icon.on-${variant}`] };
  }

  if (group === 'text' || group === 'icon') {
    const k = group;
    if (['primary', 'secondary', 'tertiary'].includes(variant)) return { desc: `${EMPHASIS[variant]} ${k}`, when_to_use: `${cap(variant)} ${k} on any standard surface (holds across the elevation ladder).`, avoid_when: `Do not use on solid/vivid fills — use ${k}.on-*.`, paired_with: ['background.primary', 'background.secondary', 'background.tertiary'] };
    if (variant === 'disabled') return { desc: `Disabled / inactive ${k}`, when_to_use: `${cap(k)} for disabled or inactive elements.`, avoid_when: 'Do not use for active content.' };
    if (variant === 'inverse') return { desc: `${cap(k)} on inverse surfaces`, when_to_use: `${cap(k)} on background.inverse / dark callouts.`, avoid_when: 'Do not use on default surfaces.', paired_with: ['background.inverse'] };
    if (variant === 'link' || variant === 'interactive') return { desc: `Link (interactive ${k})${st}`, when_to_use: `Hyperlinks and interactive ${k}${sc(state)}.`, avoid_when: `Do not use for non-interactive ${k} (use ${k}.primary).` };
    if (variant.startsWith('on-')) { const x = variant.slice(3); return { desc: `${cap(k)} on a solid ${INTENT[x] ?? x} fill`, when_to_use: `${cap(k)} placed on the ${x} fill it is paired with.`, avoid_when: `Do not use on standard surfaces — use ${k}.primary/secondary.`, paired_with: [onTarget(x)] }; }
    if (intent) return { desc: `${cap(intent)} ${k}`, when_to_use: `${cap(variant)} ${k} on standard surfaces (e.g. inline error/success text).`, avoid_when: `Do not use on a solid ${variant} fill — use ${k}.on-${variant}.`, paired_with: ['background.primary'] };
  }

  if (group === 'border') {
    if (variant === 'default') return { desc: 'Subtle / decorative border', when_to_use: 'Dividers, card outlines, low-emphasis separation.', avoid_when: 'Do not use where a 3:1 non-text contrast is required (use border.strong / border.interactive).' };
    if (variant === 'strong') return { desc: 'Stronger divider border', when_to_use: 'Higher-emphasis dividers and separators.', avoid_when: 'Do not use for form-field borders (use border.interactive).' };
    if (variant === 'inverse') return { desc: 'Border on inverse surfaces', when_to_use: 'Borders on background.inverse.', avoid_when: 'Do not use on default surfaces.', paired_with: ['background.inverse'] };
    if (variant === 'interactive') return { desc: `Form-field / control border${st}`, when_to_use: state === 'focused' ? 'The focus ring on interactive elements (keyboard focus).' : `Borders on inputs and controls${sc(state)}.`, avoid_when: 'Do not use as a decorative divider (use border.default).', paired_with: ['background.primary'] };
    if (intent) return { desc: `${cap(intent)} validation border`, when_to_use: `Validation/state borders for ${variant} (e.g. invalid fields).`, avoid_when: `Do not use as ${variant} text or fill — use text.${variant} / foreground.${variant}.` };
  }

  if (group === 'scrim') return { desc: 'Semi-transparent backdrop behind modals / drawers', when_to_use: 'The dimming layer behind a modal, dialog, or drawer.', avoid_when: 'Do not use as a solid surface or for any opaque element.', paired_with: ['background.quaternary'] };

  // fallback
  return { desc: `${group} ${variant}${st}`, when_to_use: `Use as the ${group} ${variant} role.`, avoid_when: `Do not use outside the ${group} role.` };
};

// ---- primitive tier (simplified) -------------------------------------------
type AiPrimitive = { $description: string; meaning: string; intent?: string; tier: 'primitive'; consume: string; aliased_by?: string[] };

// The contrast-role intent of each ramp band (the Univers/NB placement method:
// steps are placed at the luminance their role needs, not on an even-L curve).
const BAND_INTENT: Record<string, string> = {
  Highlights: 'Lightest tints — app / subtle backgrounds, hover & selected fills',
  Quarter: 'Subtle borders, dividers, and disabled / secondary fills',
  Mid: 'Solid fills & UI-element backgrounds',
  ThreeQuarter: 'Strong borders, secondary text, and hover/active states of solid fills',
  Shadows: 'Highest-contrast text and strong foreground',
};
const colorIntent = (seg: string[], node: any): string | undefined => {
  if (seg[0] !== 'color') return undefined;                       // scale-role intent is colour-specific
  if (seg[1] === 'white') return 'Pure highlight base — default light surface / on-colour text';
  if (seg[1] === 'black') return 'Shadow base — scrim & shadow source / on-colour text';
  if (seg[1] === 'black-alpha' || seg[1] === 'white-alpha') return 'Overlay / scrim / shadow compositing (alpha — composites over any surface)';
  const ext = node.$extensions?.prism3 ?? {};
  if (!ext.band) return undefined;
  // Usage-framed tails (what the step UNLOCKS) — distinct from the identity the
  // leaf $description states (the measured property / provenance). No paraphrase.
  const pivot = seg[2] === '500' ? ' — the one mid step that reads as text or icons over both light and dark fills' : '';
  return BAND_INTENT[ext.band] + pivot + (ext.anchor ? ' — reach for this when fidelity to the source brand colour matters' : '');
};

// `consume` differs by family: colour/dimension are PRIVATE (reach them through a
// semantic alias); opacity/motion are consumable directly (their semantic layer is thin).
const CONSUME: Record<string, string> = {
  color: 'Private primitive — reference a semantic token that aliases this, not the raw step.',
  dimension: 'Private primitive — reference via space / radius / size / border-width / focus.',
  opacity: 'Consumable — reference directly for custom alpha (or use the scrim / disabled tokens).',
  motion: 'Consumable — motion durations/easings/springs are used directly; transitions compose them.',
  font: 'Private primitive — reach for it through a typography composite (Phase 2), not the raw size/weight.',
};
const primMeaning = (seg: string[]): string => {
  if (seg[0] === 'color') {
    if (seg[1] === 'white' || seg[1] === undefined) return 'Pure white primitive';
    if (seg.length === 2) return `Pure ${seg[1]} primitive`;
    if (seg[1] === 'black-alpha' || seg[1] === 'white-alpha') return `${seg[1].startsWith('black') ? 'Black' : 'White'} at ${seg[2]}% alpha (composites over any surface)`;
    return `${seg[1]} ramp — raw step ${seg[2]}`;
  }
  if (seg[0] === 'opacity') return 'Opacity scale primitive';
  if (seg[0] === 'dimension') return `${seg[1]}px grid primitive`;
  if (seg[0] === 'motion') return seg[1] === 'easing' ? 'Easing curve primitive (cubic-bezier)' : seg[1] === 'spring' ? 'Spring primitive (damping / stiffness)' : seg[1] === 'stagger' ? 'Stagger delay primitive' : 'Motion duration primitive';
  if (seg[0] === 'font') {
    if (seg[1] === 'family') return `Font family stack — ${seg[2]} role`;
    if (seg[1] === 'size') return `Font size primitive — ${seg[2]}px (rem)`;
    if (seg[1] === 'weight') return `Font weight primitive — numeric ${seg[2]} (reference tier)`;
    if (seg[1] === 'line-height') return `Line-height multiplier — ${seg[2]} (unitless)`;
    if (seg[1] === 'letter-spacing') return `Letter-spacing primitive — ${seg[2]} (em)`;
    return 'Typography primitive';
  }
  return `${seg[0]} primitive`;
};

/** Refs inside a $value — a `{alias}` string, or alias strings in a composite object. */
const refsIn = (v: any): string[] => {
  if (typeof v === 'string') { const m = v.match(/^\{(.+)\}$/); return m ? [m[1]] : []; }
  if (v && typeof v === 'object') return Object.values(v).flatMap(refsIn);
  return [];
};

export const buildAiMetadata = (theme: Theme, tree: any) => {
  const root = theme.root;
  const brand = tree?.[root] ?? {};

  // ---- semantic tier (rich) ----
  const modes = resolveAllModes(theme);
  const byRole: Record<string, Record<string, any>> = {};
  for (const m of modes) for (const [k, r] of Object.entries(m.roles)) (byRole[k] ??= {})[m.mode] = r;

  const semantic: Record<string, AiToken> = {};
  for (const [roleKey, perMode] of Object.entries(byRole)) {
    const [group, variant, state] = roleKey.split('.');
    const light = perMode.light;
    const d = describe(group, variant, state);
    const mode_overrides: Record<string, string> = {};
    for (const [mode, r] of Object.entries(perMode)) mode_overrides[mode] = `{${r.path}}`;
    const ai: AiToken = {
      $description: `${cap(d.desc)}.`,                 // what it IS (plain)
      meaning: genMeaning(group, variant),             // what it SIGNIFIES / is for
      when_to_use: d.when_to_use,
      avoid_when: d.avoid_when,
      mode_overrides,
    };
    if (d.paired_with) ai.paired_with = d.paired_with;
    if (light.min > 0) ai.contrast_with = [{ token: light.against, min: `${light.min}:1`, ratio: light.ratio }];
    semantic[roleKey] = ai;
  }

  // ---- primitive tier (simplified) + the reverse alias index (aliased_by) ----
  // Walk the whole tree once: collect leaves, and build path → [referrers] from
  // every alias (colour semantics, dimension semantics, transitions, scrim, …) so
  // each primitive carries the bidirectional graph for impact analysis.
  const leaves: { path: string; node: any }[] = [];
  const walk = (o: any, p: string[]) => {
    if (o && typeof o === 'object') {
      if (o.$type !== undefined) { leaves.push({ path: p.join('.'), node: o }); return; }
      for (const [k, v] of Object.entries(o)) if (!k.startsWith('$')) walk(v, [...p, k]);
    }
  };
  walk(brand, []);
  const strip = (ref: string) => (ref.startsWith(root + '.') ? ref.slice(root.length + 1) : ref);
  const aliasedBy: Record<string, string[]> = {};
  for (const { path, node } of leaves) for (const ref of refsIn(node.$value)) (aliasedBy[strip(ref)] ??= []).push(path);

  const primitives: Record<string, AiPrimitive> = {};
  for (const { path, node } of leaves) {
    if (refsIn(node.$value).length > 0) continue;       // skip aliases/composites — primitives only
    const seg = path.split('.');
    const intent = colorIntent(seg, node);
    const p: AiPrimitive = {
      $description: node.$description,
      meaning: primMeaning(seg),
      ...(intent ? { intent } : {}),
      tier: 'primitive',
      consume: CONSUME[seg[0]] ?? 'Private primitive — prefer a semantic token.',
    };
    const by = aliasedBy[path];
    if (by && by.length) p.aliased_by = [...new Set(by)].sort();
    primitives[path] = p;
  }

  return {
    $schema: 'prism3-ai-metadata/0.1',
    brand: theme.id,
    generated: true,
    note: 'Agent-readable metadata, companion to ' + `${theme.id}.tokens.json` + '. The semantic tier carries ' +
      'the full schema (knowledge-base 31-color-systems §9); the primitive tier a simplified set + colour-scale `intent` ' +
      'and `aliased_by` (the reverse index — which tokens resolve to it). `aliased_by` is recomputed from the token ' +
      'tree on every build (authoritative at build time, never hand-maintained — it cannot drift as roles re-resolve). ' +
      'All fields generated and contract-true.',
    semantic_fields: ['$description', 'meaning', 'when_to_use', 'avoid_when', 'paired_with', 'contrast_with', 'mode_overrides'],
    primitive_fields: ['$description', 'meaning', 'intent', 'tier', 'consume', 'aliased_by'],
    semantic,
    primitives,
  };
};
