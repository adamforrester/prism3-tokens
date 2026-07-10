/**
 * FieldLabel — the accessible name above a field, with a required/optional indicator and a
 * size to pair with the field it sits over (KB text-field brief §2 "Label", §6, §7). The
 * second shared field part: like FieldMessage, it is authored once and reused under every
 * form control (TextField now; Select / Checkbox-group / NumberField later), so "the label is
 * always present, always associated" holds family-wide rather than per host.
 *
 * Why its own ComponentDef (not a slot): it binds its own type + colour and has an axis
 * (size) plus a disabled dim — a small stateful part, not an inert glyph. It is the DOM-present
 * accessible name (§6: a visually-hidden label is the only "label-less" case, and even then it
 * exists) — the single most load-bearing a11y node in the field, so it earns a definition.
 *
 * The practice default is the STATIC top-aligned label (brief §2, §13) — floating labels are
 * out of favour for a11y and i18n. This part models that default; a floating treatment would be
 * a motion concern on the host, not a different label component.
 */
import { ComponentDef } from '../component-schema';

export const fieldLabel: ComponentDef = {
  id: 'field-label',
  name: 'FieldLabel',
  aliases: ['label', 'form-label'],
  category: 'form',
  status: 'draft',
  description:
    'The visible, persistent label above a form field — the field\'s accessible name — with an optional required/optional indicator and a size that pairs with the control. A shared field part: the same component above every field control. Static top-aligned by default (the practice default; floating labels are out of favour).',

  props: [
    { name: 'children', type: 'string | node', required: true, description: 'The label text — a noun phrase, sentence case, ≤3 words, no trailing colon ("Email address", not "Enter your email address here").' },
    { name: 'htmlFor', type: 'string', required: true, description: 'The id of the field it names — a native <label for>. Set by the host when composed inside TextField (useId).' },
    { name: 'indicator', type: "enum: 'none' | 'required' | 'optional'", values: ['none', 'required', 'optional'], default: 'none', required: false, description: 'The required/optional marker. Mark the MINORITY consistently within a form (§7): "(optional)" when most are required, a required marker when most are optional. Never the sole signal — the field also carries required/aria-required.' },
    { name: 'size', type: "enum: 'small' | 'medium'", values: ['small', 'medium'], default: 'medium', required: false, description: 'Pairs with the field size. Two steps, matching the type system\'s label scale.' },
    { name: 'isDisabled', type: 'boolean', default: false, required: false, description: 'Dims the label when its field is disabled (a visual echo — the field\'s native disabled is the source of truth).' },
  ],

  // `isDisabled` is the one runtime shift (a dim); `size` and `indicator` are author axes.
  states: ['rest', 'disabled'],
  variants: {
    size: ['small', 'medium'],
    indicator: ['none', 'required', 'optional'],
  },

  // Label ink is the strong primary content role; the indicator is muted (secondary) so the
  // "(optional)" suffix reads as de-emphasised; disabled dims to the shared disabled ink.
  // Two sizes bind the type system's two label steps (type.label.{sm,md}.emphasis).
  tokens: {
    'gap': 'space.050',
    'text': 'color.text.primary',
    'indicator': 'color.text.secondary',
    'disabled.text': 'color.disabled.text',
    'size.small.text': 'type.label.sm.emphasis',
    'size.medium.text': 'type.label.md.emphasis',
  },

  accessibility: {
    role: 'none (native <label> element)',
    wcag: [
      '1.3.1 Info and Relationships (native <label for> ties the name to the control)',
      '3.3.2 Labels or Instructions (every field has a visible, programmatic label)',
      '1.4.3 Contrast (label ink is text.primary — clears the text floor)',
    ],
    aria: 'Prefer a native <label for=id>; use aria-label / aria-labelledby only when a visible label genuinely cannot be shown (a search field with a hidden label — and it still exists in the DOM). The required/optional marker is visual; the field carries required / aria-required so the state is not asterisk-only.',
  },

  content: {
    labelPattern: 'Noun or noun phrase, sentence case, concise, ≤3 words, no trailing colon. Not an instruction — that belongs in helper text.',
  },

  docs: {
    usage: 'Place above every field as its accessible name. Wire htmlFor to the field id. Mark the minority (required vs optional) consistently across a form. Reuse the same component above every field control so the label-is-always-present contract holds family-wide.',
    do: [
      'Always render a label, even for search (visually-hidden, still in the DOM)',
      'Keep it a short noun phrase in sentence case, no trailing colon',
      'Mark the minority (required or optional) consistently, and back it with aria-required — never the asterisk alone',
    ],
    dont: [
      'Use the placeholder as the label (it vanishes on input — fails SC 3.3.2)',
      'Write an instruction as the label ("Enter your email here") — that is helper text',
      'Rely on a red asterisk as the only required signal',
    ],
  },

  ai: {
    primaryPurpose: 'Name a form field visibly and programmatically.',
    whenToUse: 'Above every field control — the accessible name for the input.',
    avoidWhen: 'As a section heading or standalone text (use a heading) — this is bound to one control via htmlFor. Never omit it in favour of a placeholder.',
    commonPartners: ['text-field', 'number-field', 'select', 'checkbox', 'field-message'],
    triggerKeywords: ['label', 'field label', 'form label', 'required indicator', 'optional field'],
    generationPriority: 3,
  },

  composition: {
    composesWith: ['text-field', 'field-message'],
    alternativeTo: ['aria-label'],
  },

  notes: {
    contested: [
      'Which to mark — required vs optional; the practice marks the minority consistently (brief §7).',
      'Floating vs static label; static top-aligned is the default here (brief §2, §13).',
    ],
  },
};
