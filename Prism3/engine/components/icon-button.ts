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
    { name: 'intent', type: "enum: 'primary' | 'secondary' | 'danger' | 'ghost'", values: ['primary', 'secondary', 'danger', 'ghost'], default: 'secondary', required: false, description: 'Inherited from Button. Icon-only actions are most often secondary/ghost.' },
    { name: 'appearance', type: "enum: 'solid' | 'outline' | 'plain'", values: ['solid', 'outline', 'plain'], default: 'plain', required: false, description: 'Default plain — icon-only actions usually sit in toolbars, not as filled CTAs.' },
    { name: 'size', type: "enum: 'small' | 'medium' | 'large'", values: ['small', 'medium', 'large'], default: 'medium', required: false, description: 'Square control; height drives both dimensions.' },
    { name: 'isPending', type: 'boolean', default: false, required: false, description: 'Inherited — swap the icon for a spinner, keep focus, announce busy.' },
    { name: 'isInactive', type: 'boolean', default: false, required: false, description: 'Inherited — focusable disabled for relevant-but-blocked actions.' },
    { name: 'isDisabled', type: 'boolean', default: false, required: false, description: 'Inherited — native disabled, reserved for irrelevant controls.' },
  ],

  states: ['rest', 'hover', 'focus-visible', 'pressed', 'pending', 'inactive', 'disabled'],
  variants: {
    intent: ['primary', 'secondary', 'danger', 'ghost'],
    appearance: ['solid', 'outline', 'plain'],
    size: ['small', 'medium', 'large'],
    modifiers: ['pending'],
  },

  // Icon-only is SQUARE: the height role drives both dimensions, so padding-x = padding-y.
  // Colour skin is inherited from Button (same intent × appearance roles); this delta binds
  // the square geometry + the base focus contract + the two most common icon-button skins.
  tokens: {
    'radius': 'radius.md',
    'focus-ring': 'color.border.focus',
    'ring-width': 'focus.ring.width',
    'ring-offset': 'focus.ring.offset',
    // square sizing — one dimension token drives width AND height
    'size.small.side': 'size.sm.height',
    'size.medium.side': 'size.md.height',
    'size.large.side': 'size.lg.height',
    // FULL intent × appearance icon skin, bound EXPLICITLY. The icon-glyph skin differs from
    // Button's fill+label skin, so it is not merged from the parent — `inherits: button` here
    // denotes API/behaviour/state inheritance, NOT a token merge. (Same interaction-state gap
    // as Button applies: only the solid action/danger roles carry hover/pressed — see button notes.)
    'primary.solid.fill': 'color.action.default',
    'primary.solid.icon': 'color.icon.on-action',
    'primary.outline.border': 'color.border.brand',
    'primary.outline.icon': 'color.icon.brand',
    'primary.plain.icon': 'color.icon.brand',
    'secondary.solid.fill': 'color.foreground.secondary',
    'secondary.solid.icon': 'color.icon.primary',
    'secondary.outline.border': 'color.border.secondary',
    'secondary.outline.icon': 'color.icon.primary',
    'secondary.plain.icon': 'color.icon.primary',
    'danger.solid.fill': 'color.foreground.danger.default',
    'danger.solid.icon': 'color.icon.on-danger',
    'danger.outline.border': 'color.border.danger',
    'danger.outline.icon': 'color.icon.danger',
    'danger.plain.icon': 'color.icon.danger',
    'icon.disabled': 'color.icon.disabled',
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
