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
// the on-color target an on-* label sits on
const onTarget = (x: string): string => x === 'interactive' ? 'foreground.interactive.default' : x === 'emphasis' ? 'background.inverse' : `foreground.${x}`;

/** Generate the prose + relationship fields for one semantic role. */
const describe = (group: string, variant: string, state: string | undefined): { meaning: string; when_to_use: string; avoid_when: string; paired_with?: string[] } => {
  const st = state ? ` (${state} state)` : '';
  const intent = INTENT[variant];

  if (group === 'background') {
    if (['primary', 'secondary', 'tertiary', 'quaternary'].includes(variant)) {
      const n = { primary: 1, secondary: 2, tertiary: 3, quaternary: 4 }[variant];
      return { meaning: `Elevation ${n} container surface (page → floating)`, when_to_use: `Fill for ${variant === 'primary' ? 'the page / base' : variant === 'quaternary' ? 'floating UI (dialogs, popovers, menus)' : variant === 'tertiary' ? 'nested / higher-elevation containers' : 'raised cards & panels'}.`, avoid_when: 'Do not use for text, icons, or interactive fills. For interactive elements use foreground.interactive.', paired_with: ['text.primary', 'text.secondary', 'border.default'] };
    }
    if (variant === 'subtle') return { meaning: 'Muted / grouped container surface', when_to_use: 'Secondary background for grouped or low-emphasis regions.', avoid_when: 'Do not use as the primary page surface (use background.primary).' };
    if (variant === 'sunken') return { meaning: 'Sunken / inset container surface', when_to_use: 'Wells, insets, tracks — areas that read as below the page.', avoid_when: 'Do not use for raised elements (use background.secondary+).' };
    if (variant === 'inverse') return { meaning: 'Inverse container surface', when_to_use: 'High-contrast inverted sections (e.g. a dark callout in light mode).', avoid_when: 'Do not place mode-default text on it — use text.inverse / text.on-emphasis.', paired_with: ['text.inverse', 'text.on-emphasis'] };
    if (variant.endsWith('-subtle')) { const i = variant.replace('-subtle', ''); return { meaning: `Subtle ${INTENT[i] ?? i} tint surface`, when_to_use: `Low-emphasis ${i} backgrounds — badges, banners, selected rows.`, avoid_when: `Do not use as a solid ${i} fill (use foreground.${i}) or for ${i} text (use text.${i}).`, paired_with: [`text.${i}`, `icon.${i}`] }; }
  }

  if (group === 'foreground') { // fills
    if (['primary', 'secondary', 'tertiary'].includes(variant)) return { meaning: `${EMPHASIS[variant]} neutral element fill`, when_to_use: 'Solid neutral fill for chips, neutral buttons, controls.', avoid_when: 'Do not use for text/icons (use text.*/icon.*) or page surfaces (use background.*).' };
    if (variant === 'inverse') return { meaning: 'Neutral element fill for inverse contexts', when_to_use: 'Neutral fills placed on inverse surfaces.', avoid_when: 'Do not use on default surfaces (use foreground.primary).' };
    if (variant === 'interactive') return { meaning: `Interactive (action) fill${st}`, when_to_use: `Primary interactive surfaces — buttons, toggles, selected controls${state ? ` in the ${state} state` : ''}.`, avoid_when: 'Do not use for destructive actions (use foreground.danger) or non-interactive surfaces (use background.*).', paired_with: ['text.on-interactive', 'icon.on-interactive'] };
    if (variant === 'danger') return { meaning: `Destructive / error fill${st}`, when_to_use: `Destructive actions — delete/remove buttons, error fills${state ? ` in the ${state} state` : ''}.`, avoid_when: 'Do not use for non-destructive actions (use foreground.interactive) or warnings (use foreground.warning).', paired_with: ['text.on-danger', 'icon.on-danger'] };
    if (intent) return { meaning: `Solid ${intent} fill`, when_to_use: `Filled ${variant} elements — badges, banners, status chips.`, avoid_when: `Do not use for ${variant} text (use text.${variant}) or as a subtle tint (use background.${variant}-subtle).`, paired_with: [`text.on-${variant}`, `icon.on-${variant}`] };
  }

  if (group === 'text' || group === 'icon') {
    const k = group;
    if (['primary', 'secondary', 'tertiary'].includes(variant)) return { meaning: `${EMPHASIS[variant]} ${k}`, when_to_use: `${cap(variant)} ${k} on any standard surface (holds across the elevation ladder).`, avoid_when: `Do not use on solid/vivid fills — use ${k}.on-*.`, paired_with: ['background.primary', 'background.secondary', 'background.tertiary'] };
    if (variant === 'disabled') return { meaning: `Disabled / inactive ${k}`, when_to_use: `${cap(k)} for disabled or inactive elements.`, avoid_when: 'Do not use for active content.' };
    if (variant === 'inverse') return { meaning: `${cap(k)} on inverse surfaces`, when_to_use: `${cap(k)} on background.inverse / dark callouts.`, avoid_when: 'Do not use on default surfaces.', paired_with: ['background.inverse'] };
    if (variant === 'link' || variant === 'interactive') return { meaning: `Link (interactive ${k})${st}`, when_to_use: `Hyperlinks and interactive ${k}${state ? ` in the ${state} state` : ''}.`, avoid_when: `Do not use for non-interactive ${k} (use ${k}.primary).` };
    if (variant.startsWith('on-')) { const x = variant.slice(3); return { meaning: `${cap(k)} on a solid ${INTENT[x] ?? x} fill`, when_to_use: `${cap(k)} placed on the ${x} fill it is paired with.`, avoid_when: `Do not use on standard surfaces — use ${k}.primary/secondary.`, paired_with: [onTarget(x)] }; }
    if (intent) return { meaning: `${cap(intent)} ${k}`, when_to_use: `${cap(variant)} ${k} on standard surfaces (e.g. inline error/success text).`, avoid_when: `Do not use on a solid ${variant} fill — use ${k}.on-${variant}.`, paired_with: ['background.primary'] };
  }

  if (group === 'border') {
    if (variant === 'default') return { meaning: 'Subtle / decorative border', when_to_use: 'Dividers, card outlines, low-emphasis separation.', avoid_when: 'Do not use where a 3:1 non-text contrast is required (use border.strong / border.interactive).' };
    if (variant === 'strong') return { meaning: 'Stronger divider border', when_to_use: 'Higher-emphasis dividers and separators.', avoid_when: 'Do not use for form-field borders (use border.interactive).' };
    if (variant === 'inverse') return { meaning: 'Border on inverse surfaces', when_to_use: 'Borders on background.inverse.', avoid_when: 'Do not use on default surfaces.', paired_with: ['background.inverse'] };
    if (variant === 'interactive') return { meaning: `Form-field / control border${st}`, when_to_use: state === 'focused' ? 'The focus ring on interactive elements.' : `Borders on inputs and controls${state ? ` in the ${state} state` : ''}.`, avoid_when: 'Do not use as a decorative divider (use border.default).', paired_with: ['background.primary'] };
    if (intent) return { meaning: `${cap(intent)} validation border`, when_to_use: `Validation/state borders for ${variant} (e.g. invalid fields).`, avoid_when: `Do not use as ${variant} text or fill — use text.${variant} / foreground.${variant}.` };
  }

  if (group === 'scrim') return { meaning: 'Semi-transparent backdrop behind modals / drawers', when_to_use: 'The dimming layer behind a modal, dialog, or drawer.', avoid_when: 'Do not use as a solid surface or for any opaque element.', paired_with: ['background.quaternary'] };

  // fallback
  return { meaning: `${group} ${variant}${st}`, when_to_use: `Use as the ${group} ${variant} role.`, avoid_when: `Do not use outside the ${group} role.` };
};

export const buildAiMetadata = (theme: Theme) => {
  const modes = resolveAllModes(theme);
  const byRole: Record<string, Record<string, any>> = {};
  for (const m of modes) for (const [k, r] of Object.entries(m.roles)) (byRole[k] ??= {})[m.mode] = r;

  const tokens: Record<string, AiToken> = {};
  for (const [roleKey, perMode] of Object.entries(byRole)) {
    const [group, variant, state] = roleKey.split('.');
    const light = perMode.light;
    const d = describe(group, variant, state);
    const mode_overrides: Record<string, string> = {};
    for (const [mode, r] of Object.entries(perMode)) mode_overrides[mode] = `{${r.path}}`;
    const ai: AiToken = {
      $description: `${cap(d.meaning)}.`,
      meaning: d.meaning,
      when_to_use: d.when_to_use,
      avoid_when: d.avoid_when,
      mode_overrides,
    };
    if (d.paired_with) ai.paired_with = d.paired_with;
    if (light.min > 0) ai.contrast_with = [{ token: light.against, min: `${light.min}:1`, ratio: light.ratio }];
    tokens[roleKey] = ai;
  }

  return {
    $schema: 'prism3-ai-metadata/0.1',
    brand: theme.id,
    generated: true,
    note: 'Agent-readable metadata for the semantic token layer; companion to ' +
      `${theme.id}.tokens.json (DTCG tokens). Fields per knowledge-base 31-color-systems §9. ` +
      'All fields generated from the role model + computed contracts — contract-true and regenerated each build.',
    fields: ['$description', 'meaning', 'when_to_use', 'avoid_when', 'paired_with', 'contrast_with', 'mode_overrides'],
    tokens,
  };
};
