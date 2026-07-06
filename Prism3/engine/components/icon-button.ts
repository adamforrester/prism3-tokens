/**
 * IconButton — the icon-only specialisation of Button (KB brief §6, §10, §12).
 *
 * It exists as a DISTINCT component for one reason: an icon-only control has no visible
 * text, so its accessible name must be REQUIRED at the type level — "button, unlabelled" is
 * the single highest-frequency Button a11y failure in the wild (brief §6). Everything else
 * it inherits from Button (the intent × appearance model, the state trio, the focus contract);
 * this def records the DELTA, per the schema's `inherits` convention.
 *
 * The boundary from the other side: here the IconButton owns the accessible name and the
 * Icon inside it is decorative (aria-hidden) — the inverse of a labelled Button with a
 * leadingVisual, where the label carries the name and the icon is aria-hidden either way.
 */
import { ComponentDef } from '../component-schema';

export const iconButton: ComponentDef = {
  id: 'icon-button',
  name: 'IconButton',
  aliases: ['icon-btn'],
  category: 'form',
  status: 'draft',
  description:
    'A Button whose entire content is a single icon, with no visible text label. Use for space-constrained, self-evident actions (close, more, edit) in toolbars, table rows, and headers. Because there is no visible label, an accessible name is mandatory.',

  inherits: 'button',

  // Delta from Button: the label becomes an icon; the name moves to a required accessible name.
  props: [
    { name: 'icon', type: 'slot', required: true, description: 'The single icon. Rendered aria-hidden — the IconButton owns the name.' },
    { name: 'aria-label', type: 'string', required: true, description: 'REQUIRED accessible name (there is no visible text). A verb naming the action ("Close", "More actions"). Enforced at the TYPE LEVEL — a missing name is a compile error, not merely a runtime warning; that type-level requirement is the entire reason IconButton is a separate component.' },
    { name: 'intent', type: "enum: 'primary' | 'neutral' | 'destructive'", values: ['primary', 'neutral', 'destructive'], default: 'neutral', required: false, description: 'Inherited from Button (interactive.<intent>.*). Icon-only actions are most often neutral text-appearance.' },
    { name: 'appearance', type: "enum: 'filled' | 'outline' | 'text'", values: ['filled', 'outline', 'text'], default: 'text', required: false, description: 'Default text — icon-only actions usually sit in toolbars, not as filled CTAs.' },
    { name: 'size', type: "enum: 'small' | 'medium' | 'large'", values: ['small', 'medium', 'large'], default: 'medium', required: false, description: 'Square control; height drives both dimensions.' },
    { name: 'isPending', type: 'boolean', default: false, required: false, description: 'Inherited — swap the icon for a spinner, keep focus, announce busy.' },
    { name: 'isInactive', type: 'boolean', default: false, required: false, description: 'Inherited — focusable disabled for relevant-but-blocked actions.' },
    { name: 'isDisabled', type: 'boolean', default: false, required: false, description: 'Inherited — native disabled, reserved for irrelevant controls.' },
  ],

  states: ['rest', 'hover', 'focus-visible', 'pressed', 'pending', 'inactive', 'disabled'],
  variants: {
    intent: ['primary', 'neutral', 'destructive'],
    appearance: ['filled', 'outline', 'text'],
    size: ['small', 'medium', 'large'],
    modifiers: ['pending'],
  },

  // Icon-only is SQUARE: the height role drives both dimensions, so padding-x = padding-y.
  // Colour skin follows Button's reconciled interactive.* model (same colour × appearance);
  // this delta binds the square geometry + the base focus contract + the icon-glyph skins.
  // The icon glyph binds the same interactive inks Button's label does (on-fill for filled,
  // text for outline/text) — every colour now carries the full state shape (v1 gap closed).
  tokens: {
    'radius': 'radius.md',
    'focus-ring': 'color.border.focus',
    'ring-width': 'focus.ring.width',
    'ring-offset': 'focus.ring.offset',
    // square sizing — one dimension token drives width AND height
    'size.small.side': 'size.sm.height',
    'size.medium.side': 'size.md.height',
    'size.large.side': 'size.lg.height',
    // primary
    'primary.filled.fill': 'color.interactive.primary.fill.rest',
    'primary.filled.fill.hover': 'color.interactive.primary.fill.hover',
    'primary.filled.fill.pressed': 'color.interactive.primary.fill.pressed',
    'primary.filled.icon': 'color.interactive.primary.on-fill',
    'primary.outline.border': 'color.interactive.primary.border',
    'primary.outline.icon': 'color.interactive.primary.text',
    'primary.text.icon': 'color.interactive.primary.text',
    // neutral (default — now stateful)
    'neutral.filled.fill': 'color.interactive.neutral.fill.rest',
    'neutral.filled.fill.hover': 'color.interactive.neutral.fill.hover',
    'neutral.filled.fill.pressed': 'color.interactive.neutral.fill.pressed',
    'neutral.filled.icon': 'color.interactive.neutral.on-fill',
    'neutral.outline.border': 'color.interactive.neutral.border',
    'neutral.outline.icon': 'color.interactive.neutral.text',
    'neutral.text.icon': 'color.interactive.neutral.text',
    // destructive
    'destructive.filled.fill': 'color.interactive.destructive.fill.rest',
    'destructive.filled.fill.hover': 'color.interactive.destructive.fill.hover',
    'destructive.filled.fill.pressed': 'color.interactive.destructive.fill.pressed',
    'destructive.filled.icon': 'color.interactive.destructive.on-fill',
    'destructive.outline.border': 'color.interactive.destructive.border',
    'destructive.outline.icon': 'color.interactive.destructive.text',
    'destructive.text.icon': 'color.interactive.destructive.text',
    // cross-cutting disabled
    'disabled.icon': 'color.disabled.icon',
    'disabled.border': 'color.disabled.border',
  },

  accessibility: {
    role: 'button (native <button>)',
    wcag: ['4.1.2 Name/Role/Value (the mandatory accessible name)', '2.5.3 Label in Name', '1.4.11 Non-text Contrast (focus ring ≥ 3:1; AND the icon glyph itself ≥ 3:1 against its background)', '2.4.7 Focus Visible', '2.5.5 / 2.5.8 Target Size (icon-only buttons are the most likely to fail the 24×24 / 44×44 floor — expand the hit area beyond the optical size)'],
    keyboard: 'Native <button> — Enter on keydown, Space on keyup. Identical to Button.',
    focus: 'Same offset :focus-visible ring as Button; retained through pending/inactive.',
    aria: 'aria-label is the accessible name (required). If it triggers a menu, add aria-haspopup + aria-expanded; aria-pressed only if it is a toggle. While isPending, set aria-busy and keep it focusable. Do NOT put a tooltip on a natively-disabled icon button (unreachable) — use isInactive so the reason stays reachable.',
  },

  content: {
    labelPattern: 'The accessible name is a verb naming the action ("Close", "Edit", "More actions") — never the icon\'s shape ("X", "three dots"). If a tooltip is shown, its text should match the accessible name.',
  },

  docs: {
    usage: 'Use for a self-evident action where space is tight and a text label would be redundant or not fit — toolbar actions, a close affordance, row-level edit/delete. Always provide the accessible name; pair with a Tooltip for the visible name on hover/focus.',
    do: [
      'Always give it an accessible name (a verb)',
      'Use recognisable, conventional icons (close = ×, more = ⋯); pair novel icons with a visible label instead',
      'Expand the hit area to meet target-size minimums even when the icon is visually small',
    ],
    dont: [
      'Ship it without an accessible name ("button, unlabelled")',
      'Use it for an unfamiliar action a user cannot infer from the glyph — use a labelled Button',
      "Tooltip a natively-disabled icon button (the tooltip can't be reached) — use isInactive",
    ],
  },

  ai: {
    primaryPurpose: 'Trigger an action with an icon alone, no visible label.',
    whenToUse: 'A self-evident, conventional action in a space-constrained context (toolbar, table row, card header, close affordance).',
    avoidWhen: 'The action is not obvious from the icon (use a labelled button) — or a visible label would fit and aid recognition. Never when you cannot supply an accessible name.',
    commonPartners: ['icon', 'tooltip', 'button-group', 'menu'],
    triggerKeywords: ['icon button', 'close button', 'more button', 'toolbar action', 'edit action', 'kebab menu'],
    generationPriority: 2,
  },

  composition: {
    composesWith: ['icon', 'tooltip', 'button-group', 'menu', 'popover'],
    alternativeTo: ['button', 'link'],
  },

  notes: {
    contested: [
      'Whether IconButton is a distinct component or a mode of Button — the practice ships it distinct precisely so the accessible name is required at the type level (brief §10).',
    ],
  },
};
