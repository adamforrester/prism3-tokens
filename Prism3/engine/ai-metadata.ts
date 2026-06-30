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
const TIER_N: Record<string, number> = { primary: 1, secondary: 2, tertiary: 3 };
// state → the interaction moment it applies to (makes state variants informative)
const STATE_WHEN: Record<string, string> = { hover: 'on pointer hover', pressed: 'while pressed', focused: 'when keyboard-focused', disabled: 'when disabled / unavailable', selected: 'when selected / active', visited: 'after it has been visited' };
const sc = (state?: string) => (state && STATE_WHEN[state] ? ` ${STATE_WHEN[state]}` : '');
// `meaning` answers "what does this SIGNIFY / what is it for" (vs `$description`,
// which is "what it is"). Semantic signal per intent; structural purpose otherwise.
const SIGNAL: Record<string, string> = {
  brand: 'Brand identity', success: 'Success / positive signalling', warning: 'Warning / caution signalling',
  danger: 'Destructive / error signalling', info: 'Informational signalling',
};
const genMeaning = (group: string, variant: string): string => {
  if (group === 'action') return 'Interactivity / actions';
  if (variant === 'link') return 'Interactivity / navigation';
  if (variant === 'focus') return 'Keyboard focus indication';
  if (SIGNAL[variant]) return SIGNAL[variant];                                  // intent fill/text/icon/border (incl. danger)
  if (variant.endsWith('-subtle')) { const i = variant.replace('-subtle', ''); return `${SIGNAL[i] ?? cap(i)} (low-emphasis)`; }
  if (variant.startsWith('on-')) { const x = variant.slice(3); return `Legible content on ${x === 'inverse' ? 'an inverse surface' : x === 'action' ? 'the action fill' : x === 'disabled' ? 'a disabled fill' : (INTENT[x] ?? x) + ' fills'}`; }
  if (variant === 'disabled') return 'Unavailable / inactive state';
  if (variant === 'inverse') return group === 'border' ? 'Inverted-surface separation' : group === 'background' ? 'Inverted page surface' : 'Inverted / bold surface';
  if (group === 'background') return 'Page / canvas surface';
  if (group === 'foreground') return 'Surface / fill on the canvas';
  if (group === 'text' || group === 'icon') return 'Content hierarchy / reading emphasis';
  if (group === 'border') return 'Separation / structure';
  if (group === 'scrim') return 'Background dimming / modal focus';
  return `${cap(group)} role`;
};
// the on-color target an on-* label sits on
const onTarget = (x: string): string => x === 'action' ? 'action.default' : x === 'inverse' ? 'background.inverse.primary' : x === 'disabled' ? 'action.disabled' : `foreground.${x}`;

/** Generate the prose + relationship fields for one semantic role. The key splits
 *  as [group, variant, state]; nested ladders (background.inverse.primary,
 *  foreground.danger.hover) put the tier/state in `state`. */
const describe = (group: string, variant: string, state: string | undefined): { desc: string; when_to_use: string; avoid_when: string; paired_with?: string[] } => {
  const st = state ? ` (${state} state)` : '';
  const intent = INTENT[variant];

  // background — the CANVAS (thin, page-level)
  if (group === 'background') {
    if (variant === 'inverse') { const tier = state ?? 'primary'; return { desc: `Inverse page surface (tier ${TIER_N[tier] ?? 1})`, when_to_use: 'Inverted page sections — a dark band on a light page (or vice-versa).', avoid_when: 'Do not place mode-default ink on it — use text.on-inverse.', paired_with: ['text.on-inverse', 'border.inverse'] }; }
    if (TIER_N[variant]) return { desc: `Page / canvas surface (tier ${TIER_N[variant]})`, when_to_use: variant === 'primary' ? 'The page / base canvas.' : variant === 'secondary' ? 'A slightly tinted page or page band.' : 'A third page-level surface step.', avoid_when: 'Do not use for surfaces placed on the page (use foreground.*) or for ink (use text/icon).', paired_with: ['foreground.primary', 'text.primary', 'border.primary'] };
  }

  // foreground — SURFACES & FILLS placed on the canvas
  if (group === 'foreground') {
    if (variant === 'inverse') { const tier = state ?? 'primary'; return { desc: `Inverse / bold surface (tier ${TIER_N[tier] ?? 1})`, when_to_use: 'Strong / inverse fills — a dark callout, a solid neutral button, an emphasis surface in light mode.', avoid_when: 'Do not use for the page (use background.*) or for ink (use text/icon).', paired_with: ['text.on-inverse'] }; }
    if (TIER_N[variant]) return { desc: `Surface placed on the canvas (tier ${TIER_N[variant]})`, when_to_use: variant === 'primary' ? 'Cards — the default surface placed on the page.' : variant === 'secondary' ? 'Panels / nested containers.' : 'A third surface step.', avoid_when: 'Do not use for the page itself (use background.*) or for ink (use text/icon).', paired_with: ['text.primary', 'border.primary'] };
    if (variant === 'danger') return { desc: `Destructive / error fill${st}`, when_to_use: `Destructive actions — delete/remove buttons, error fills${sc(state)}.`, avoid_when: 'Do not use for non-destructive actions (use action.*) or warnings (use foreground.warning).', paired_with: ['text.on-danger', 'icon.on-danger'] };
    if (variant.endsWith('-subtle')) { const i = variant.replace('-subtle', ''); return { desc: `Subtle ${INTENT[i] ?? i} tint surface`, when_to_use: `Low-emphasis ${i} surfaces — banners, badges, selected rows.`, avoid_when: `Do not use as a solid ${i} fill (use foreground.${i}) or for ${i} ink (use text.${i}).`, paired_with: [`text.${i}`, `icon.${i}`] }; }
    if (intent) return { desc: `Bold solid ${intent} fill`, when_to_use: `Filled ${variant} elements — badges, banners, status chips.`, avoid_when: `Do not use for ${variant} ink (use text.${variant}) or as a subtle tint (use foreground.${variant}-subtle).`, paired_with: [`text.on-${variant}`, `icon.on-${variant}`] };
  }

  // action — the interactive fill (variant carries the state)
  if (group === 'action') return { desc: `Interactive (action) fill${variant === 'default' ? '' : ` (${variant} state)`}`, when_to_use: `Primary interactive surfaces — buttons, toggles, controls${sc(variant)}.`, avoid_when: 'Do not use for destructive actions (use foreground.danger) or non-interactive surfaces (use background/foreground).', paired_with: ['text.on-action', 'icon.on-action'] };

  // text / icon — INK
  if (group === 'text' || group === 'icon') {
    const k = group;
    if (TIER_N[variant]) return { desc: `${EMPHASIS[variant]} ${k}`, when_to_use: `${cap(variant)} ${k} on any surface (holds across the tonal ladder).`, avoid_when: `Do not use on solid/vivid fills — use ${k}.on-*.`, paired_with: ['background.primary', 'foreground.primary'] };
    if (variant === 'disabled') return { desc: `Disabled / inactive ${k}`, when_to_use: `${cap(k)} for disabled or inactive elements.`, avoid_when: 'Do not use for active content.' };
    if (variant === 'link') return { desc: `Link (interactive ${k})${st}`, when_to_use: `Hyperlinks and interactive ${k}${sc(state)}.`, avoid_when: `Do not use for non-interactive ${k} (use ${k}.primary).` };
    if (variant.endsWith('-subtle')) { const i = variant.replace('-subtle', ''); return { desc: `Muted ${INTENT[i] ?? i} ${k}`, when_to_use: `Low-emphasis ${i} ${k} — secondary status text / quiet accents.`, avoid_when: `For safety-critical ${i} messaging use the bold ${k}.${i}; verify contrast for body text.`, paired_with: ['background.primary'] }; }
    if (variant.startsWith('on-')) { const x = variant.slice(3); return { desc: `${cap(k)} on ${x === 'inverse' ? 'an inverse surface' : x === 'disabled' ? 'a disabled fill (muted)' : `a solid ${INTENT[x] ?? x} fill`}`, when_to_use: x === 'disabled' ? `The label/${k} on a disabled control's fill — muted but legible (paired with action.disabled / foreground.danger.disabled).` : `${cap(k)} placed on the ${x === 'inverse' ? 'inverse surface' : x + ' fill'} it is paired with.`, avoid_when: x === 'disabled' ? `Do not use on an enabled fill (use ${k}.on-action / on-{semantic}) or on the page (use ${k}.disabled).` : `Do not use on standard surfaces — use ${k}.primary/secondary.`, paired_with: [onTarget(x)] }; }
    if (intent) return { desc: `${cap(intent)} ${k}`, when_to_use: `${cap(variant)} ${k} on standard surfaces (e.g. inline error/success text).`, avoid_when: `Do not use on a solid ${variant} fill — use ${k}.on-${variant}.`, paired_with: ['background.primary'] };
  }

  // border
  if (group === 'border') {
    if (variant === 'primary') return { desc: 'Default / decorative border', when_to_use: 'Dividers, card outlines, low-emphasis separation.', avoid_when: 'Do not use where a 3:1 non-text contrast is required (use border.secondary / border.focus).' };
    if (variant === 'secondary') return { desc: 'Stronger divider border', when_to_use: 'Higher-emphasis dividers and separators; control borders.', avoid_when: 'Do not use as a faint hairline (use border.primary).' };
    if (variant === 'inverse') return { desc: 'Border on inverse surfaces', when_to_use: 'Borders on background.inverse / foreground.inverse.', avoid_when: 'Do not use on default surfaces.', paired_with: ['background.inverse.primary'] };
    if (variant === 'focus') return { desc: 'Focus ring colour', when_to_use: 'The keyboard-focus indicator on interactive elements.', avoid_when: 'Do not use as a decorative divider (use border.primary).', paired_with: ['background.primary'] };
    if (intent) return { desc: `${cap(intent)} validation border`, when_to_use: `Validation/state borders for ${variant} (e.g. invalid fields).`, avoid_when: `Do not use as ${variant} ink or fill — use text.${variant} / foreground.${variant}.` };
  }

  if (group === 'scrim') return { desc: 'Semi-transparent backdrop behind modals / drawers', when_to_use: 'The dimming layer behind a modal, dialog, or drawer.', avoid_when: 'Do not use as a solid surface or for any opaque element.', paired_with: ['foreground.inverse.primary'] };

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
  shadow: 'Consumable — apply the elevation step directly (mode-aware: light shadow / reduced in dark, surface lift carries dark elevation).',
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
  if (seg[0] === 'shadow') return `Shadow / elevation composite — ${seg[1]} (2-layer, mode-aware)`;
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
  // Direct reverse edges (target → tokens that reference it directly).
  const directBy: Record<string, string[]> = {};
  for (const { path, node } of leaves) for (const ref of refsIn(node.$value)) (directBy[strip(ref)] ??= []).push(path);
  // TRANSITIVE closure: a primitive's referrers include indirect ones too, so the
  // two-hop weight chain (composite → weight-role → numeric) is visible — the KB's
  // "re-map a brand's weights, every composite reflows" payoff is now provable from
  // the index. Without this, font.weight.700 would list only weight-role.strong and
  // hide the 15 composites that actually consume it.
  const aliasedBy: Record<string, string[]> = {};
  for (const target of Object.keys(directBy)) {
    const acc = new Set<string>();
    const visit = (t: string) => { for (const r of directBy[t] ?? []) if (!acc.has(r)) { acc.add(r); visit(r); } };
    visit(target);
    aliasedBy[target] = [...acc].sort();
  }

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

  // ---- typography tier (composites + weight roles) ----
  // The consumer-facing type styles + the function-named weight roles. Without
  // this the agent surface would omit the entire typography semantic layer (and
  // aliased_by would dangle references at entries that don't exist in the file).
  const TYPE_DESC: Record<string, { desc: string; when: string; avoid: string }> = {
    display: { desc: 'hero / marketing display type', when: 'Large expressive headlines and hero moments.', avoid: 'Do not use for product-UI headings (use title) or running text (use body).' },
    title: { desc: 'heading type — visual hierarchy, decoupled from DOM level', when: 'Section and page headings; pick the size for visual prominence and set the DOM level (h1–h6) by document structure independently.', avoid: 'Do not bind the size to a heading level; do not use for running text (use body).' },
    body: { desc: 'running text / default UI copy', when: 'Paragraphs, descriptions, and default interface text.', avoid: 'Do not use for headings (use title/display) or dense control labels (use label).' },
    label: { desc: 'UI label type — buttons, form labels, tabs, chips', when: 'Control and form labels, button text, tabs, chips, badges.', avoid: 'Do not use for running text (use body).' },
    caption: { desc: 'caption / secondary small text', when: 'Image captions, helper text, metadata, footnotes.', avoid: 'Do not use for primary reading text (use body).' },
    eyebrow: { desc: 'eyebrow / kicker — small uppercase label above a heading', when: 'A short label sitting above a title or hero (a "kicker").', avoid: 'Do not use as the heading itself (use title) or for body copy.' },
    code: { desc: 'monospace / code type', when: 'Inline code, code blocks, and column-aligned values.', avoid: 'Do not use for prose (use body).' },
  };
  const typography: Record<string, any> = {};
  for (const c of theme.typography.composites) {
    const d = TYPE_DESC[c.group];
    const resolves: Record<string, string> = {
      fontFamily: `{${root}.font.family.${c.family}}`,
      fontSize: `{${root}.font.size.${c.sizePx}}`,
      fontWeight: `{${root}.font.weight-role.${c.weightRole}}`,
      lineHeight: `{${root}.font.line-height.${c.lineHeight}}`,
      letterSpacing: `{${root}.font.letter-spacing.${c.tracking}}`,
    };
    if (c.textCase !== 'none') resolves.textCase = c.textCase;
    if (c.link) resolves.textDecoration = 'underline';
    // Key by the real tree path (`type.<path>`) so aliased_by references resolve.
    typography[`type.${c.path}`] = {
      $description: `${cap(d.desc)}${c.link ? ' (underlined link variant)' : ''}.`,
      meaning: `Type style — ${c.group}${c.variant ? ' ' + c.variant : ''} ${c.weightRole}${c.link ? ' link' : ''} (${c.sizePx}px, ${c.family} face${c.textCase !== 'none' ? `, ${c.textCase}` : ''})`,
      when_to_use: c.link ? `${d.when} The underlined link variant — pair with the text.link.* colour.` : d.when,
      avoid_when: c.link ? `Do not use for non-link text (use ${c.group}.${c.variant || c.weightRole} without -link).` : d.avoid,
      resolves_to: resolves,
    };
  }
  for (const w of theme.typography.weightRoles) {
    const key = `font.weight-role.${w.role}`;
    const entry: any = {
      $description: `The ${w.role} font-weight role.`,
      meaning: `Function-named weight → ${w.value} — white-label-stable (the role is the contract; each brand maps the numeric).`,
      when_to_use: `Reference ${key} (not the numeric) so a brand weight re-map reflows every consumer at once.`,
      avoid_when: `Do not hard-code the numeric (${w.value}); reference the role.`,
      resolves_to: `{${root}.font.weight.${w.value}}`,
    };
    const usedBy = (aliasedBy[key] ?? []).filter((p) => p.startsWith('type.'));
    if (usedBy.length) entry.used_by = usedBy;                      // which composites carry this role
    typography[key] = entry;
  }

  // ---- gradient tier (opt-in brand gradients) ----
  // Keyed by the real tree path (`gradient.<name>`) so an aliased_by reference (a
  // colour primitive listing a gradient that consumes it) resolves to a real entry.
  const gradient: Record<string, any> = {};
  for (const g of theme.gradient.gradients) {
    const aa = Math.min(g.worstOnWhite, g.worstOnBlack);
    gradient[`gradient.${g.name}`] = {
      $description: `Brand gradient — ${g.kind}${g.kind === 'linear' ? ` ${g.angle}°` : ` ${g.shape}`}, ${g.stops.length} stops.`,
      meaning: `Decorative ${g.kind} gradient (opt-in); stop colours alias the ramp, ${g.interpolation} interpolation. Materializes as a Figma Paint Style — only stop colours bind (kind/angle/positions baked).`,
      when_to_use: 'Brand / marketing surfaces, hero backgrounds, decorative fills.',
      avoid_when: aa < 4.5
        ? `Do not place body text directly over it — worst-case contrast is ${aa}:1 (below 4.5:1); use a scrim or a solid container.`
        : 'Keep text overlays within the contrast-safe lightness range, or add a scrim.',
      resolves_to: g.stops.map((s) => `{${s.aliasOf}}`),
      a11y: { worst_on_white: g.worstOnWhite, worst_on_black: g.worstOnBlack },
    };
  }

  return {
    $schema: 'prism3-ai-metadata/0.1',
    brand: theme.id,
    generated: true,
    note: 'Agent-readable metadata, companion to ' + `${theme.id}.tokens.json` + '. The semantic (colour) tier and the ' +
      'typography tier (type composites + weight roles) carry the rich schema; the primitive tier a simplified set + ' +
      'colour-scale `intent` and `aliased_by` (the reverse index — which tokens resolve to it, TRANSITIVELY, so the ' +
      'two-hop weight chain composite→role→numeric is visible). `aliased_by` is recomputed from the token tree on every ' +
      'build (authoritative at build time, never hand-maintained — it cannot drift). All fields generated and contract-true.',
    semantic_fields: ['$description', 'meaning', 'when_to_use', 'avoid_when', 'paired_with', 'contrast_with', 'mode_overrides'],
    typography_fields: ['$description', 'meaning', 'when_to_use', 'avoid_when', 'resolves_to', 'used_by'],
    primitive_fields: ['$description', 'meaning', 'intent', 'tier', 'consume', 'aliased_by'],
    semantic,
    typography,
    ...(Object.keys(gradient).length ? { gradient_fields: ['$description', 'meaning', 'when_to_use', 'avoid_when', 'resolves_to', 'a11y'], gradient } : {}),
    primitives,
  };
};
