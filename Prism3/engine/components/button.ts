/**
 * Button — the first component definition against `component-schema.ts` (DRAFT v0).
 * One of the three calibration components (Button / Text Field / Card, docs/14 §6).
 * Every visual surface binds to a SEMANTIC token role (never a primitive), so the
 * structure is brand- and mode-invariant — the engine supplies the values per brand.
 */
import { ComponentDef } from '../component-schema';

export const button: ComponentDef = {
  id: 'button',
  name: 'Button',
  aliases: ['btn', 'cta'],
  category: 'action',
  status: 'draft',
  description:
    'A labelled control that triggers an action. Not a navigation element — a control that DOES something in place (submit, confirm, open). For navigation between locations, use a link.',

  props: [
    { name: 'variant', type: "enum: 'primary' | 'secondary' | 'tertiary' | 'danger'", values: ['primary', 'secondary', 'tertiary', 'danger'], default: 'primary', required: false, description: 'Emphasis / intent of the action.' },
    { name: 'size', type: "enum: 'sm' | 'md' | 'lg'", values: ['sm', 'md', 'lg'], default: 'md', required: false, description: 'Control size; drives height + padding + type.' },
    { name: 'disabled', type: 'boolean', default: false, required: false, description: 'Non-interactive, dimmed. Exempt from the 4.5:1 text floor (WCAG 1.4.3).' },
    { name: 'loading', type: 'boolean', default: false, required: false, description: 'Shows a spinner and suppresses activation while a request is in flight.' },
    { name: 'iconStart', type: 'node', required: false, description: 'Optional leading icon.' },
    { name: 'iconEnd', type: 'node', required: false, description: 'Optional trailing icon.' },
    { name: 'fullWidth', type: 'boolean', default: false, required: false, description: 'Stretches to the container width.' },
    { name: 'type', type: "enum: 'button' | 'submit' | 'reset'", values: ['button', 'submit', 'reset'], default: 'button', required: false, description: 'Native button type for form participation.' },
    { name: 'children', type: 'node', required: true, description: 'The button label. Keep it a short verb phrase.' },
  ],

  states: ['rest', 'hover', 'pressed', 'focus', 'disabled', 'loading'],
  variants: { size: ['sm', 'md', 'lg'], variant: ['primary', 'secondary', 'tertiary', 'danger'] },

  // Semantic-role bindings. State-qualified slots carry a dotted suffix.
  tokens: {
    'fill': 'color.action.default',
    'fill.hover': 'color.action.hover',
    'fill.pressed': 'color.action.pressed',
    'fill.disabled': 'color.action.disabled',
    'label': 'color.text.on-action',
    'label.disabled': 'color.text.on-disabled',
    'focus-ring': 'color.border.focus',
    'radius': 'radius.md',
    'padding-x': 'size.md.padding-x',
    'padding-y': 'size.md.padding-y',
    'height': 'size.md.height',
    'ring-width': 'focus.ring.width',
    'type': 'type.label.md.emphasis',
  },

  accessibility: {
    role: 'button',
    wcag: ['1.4.3 Contrast (label on fill ≥ 4.5:1, verified by the engine)', '2.1.1 Keyboard', '2.4.7 Focus Visible'],
    keyboard: 'Enter or Space activates. Focusable in DOM order; disabled removes it from the tab sequence.',
    focus: 'A visible focus ring (color.border.focus) on keyboard focus; never suppressed.',
  },

  content: {
    labelPattern: 'A short verb phrase in sentence case ("Save changes", not "SAVE CHANGES" or "Ok").',
    errorPattern: 'Buttons do not show errors themselves; surface failures in an adjacent inline-message or alert.',
  },

  docs: {
    usage: 'Use for in-place actions: submitting a form, confirming a dialog, triggering a mutation. One primary button per view; secondary/tertiary for lower-emphasis actions.',
    do: ['Lead with a verb', 'Keep one primary action per surface', 'Pair a destructive action with a confirmation'],
    dont: ['Use a button for navigation (use a link)', 'Stack three primaries', 'Disable without explaining why nearby'],
    contentGuidelines: 'Verb-first, specific ("Publish post" over "Submit"). Avoid "Click here".',
  },

  ai: {
    primaryPurpose: 'Trigger an action in place.',
    whenToUse: 'The user needs to DO something on this surface — submit, confirm, open, apply.',
    avoidWhen: 'The target is a different location/URL (use a link); or the control toggles a persistent on/off state (use a switch); or you need one-of-many selection (use a segmented control / radio).',
    commonPartners: ['form', 'dialog', 'inline-message', 'icon'],
    triggerKeywords: ['button', 'submit', 'cta', 'confirm', 'action', 'primary action'],
    generationPriority: 1,
  },

  composition: {
    composesWith: ['form', 'dialog', 'card', 'banner'],
    alternativeTo: ['link', 'switch', 'segmented-control'],
  },

  motion: {
    enter: 'none (present on mount)',
    exit: 'none',
    reduceMotion: 'state transitions honour prefers-reduced-motion; no essential meaning is carried by motion.',
  },

  notes: {
    contested: ['Whether `tertiary` is a Button variant or a distinct Link-button is an open catalogue question.'],
  },
};
