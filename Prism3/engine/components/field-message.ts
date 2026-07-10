/**
 * FieldMessage — the small icon + caption that sits BELOW a field and carries helper
 * guidance or a validation result (KB text-field brief §2 "Helper / description text" +
 * "Error / validation message", §6, §7). This is the Prism3 successor to Prism2's reused
 * "Helper message" sub-component: one part, a `tone` axis, shared across the whole form
 * family (TextField now; Select / Checkbox-group / NumberField later) rather than
 * re-declared per host.
 *
 * Why it's its own ComponentDef (not a slot): unlike an Icon, it BINDS tokens of its own
 * and its meaning changes with state — each tone re-points text + icon at a semantic role
 * (`text.<role>` / `icon.<role>`), and the pairing is exactly what §7's "say what is wrong
 * AND how to fix it, with an icon, never colour-only" requires. It is the reusable, gated
 * unit that satisfies that contract once for every field.
 *
 * The a11y division of labour: the MESSAGE renders icon + caption (icon aria-hidden, text
 * carries the meaning — never colour-only). The HOST (TextField) owns the wiring — it puts
 * this node's id into the field's `aria-describedby` chain and sets `aria-invalid` on error
 * (§6). So the part is presentational; the host stitches it in.
 */
import { ComponentDef } from '../component-schema';

export const fieldMessage: ComponentDef = {
  id: 'field-message',
  name: 'FieldMessage',
  aliases: ['helper-text', 'help-text', 'field-error', 'validation-message', 'caption'],
  category: 'form',
  status: 'draft',
  description:
    'The small icon + caption below a form field. In its default tone it is persistent helper guidance (the format shown BEFORE failure); its error / warning / success tones carry a validation result. A shared field part — the same component under every field control, not re-authored per host. Icon + text together, never colour alone.',

  props: [
    { name: 'tone', type: "enum: 'default' | 'error' | 'warning' | 'success'", values: ['default', 'error', 'warning', 'success'], default: 'default', required: false, description: 'default = helper guidance (neutral); error / warning / success = a validation result. The tone re-points both the caption ink and the icon at the matching semantic role.' },
    { name: 'children', type: 'string | node', required: true, description: 'The message text. For error tone, say what is wrong AND how to fix it (SC 3.3.3) — "Enter a valid email, e.g. name@example.com", not "Invalid input".' },
    { name: 'icon', type: 'slot', required: false, description: 'The leading status glyph, aria-hidden (the text carries the meaning). Present by default on validation tones; optional on the default tone.' },
    { name: 'id', type: 'string', required: false, description: 'Set by the host so it can reference this node from the field\'s aria-describedby chain. Auto-generated with useId when composed inside TextField.' },
  ],

  // Presentational: no interaction states. `tone` is the only axis, and it is what drives
  // the token re-pointing below — the state-as-variant that a helper/validation caption has.
  states: [],
  variants: {
    tone: ['default', 'error', 'warning', 'success'],
  },

  // Tone → (caption ink, status icon). default is a muted neutral; each validation tone lands
  // on its semantic role. text.<role> clears the 4.5:1 body floor and icon.<role> its non-text
  // floor by construction (the engine gates them per mode), so a re-based role (roleColors) or a
  // new brand re-derives the whole set without a manual pass. The caption is caption-scale type.
  tokens: {
    'type': 'type.caption.md.default',
    'gap': 'space.075',
    'default.text': 'color.text.secondary',
    'default.icon': 'color.icon.secondary',
    'error.text': 'color.text.danger',
    'error.icon': 'color.icon.danger',
    'warning.text': 'color.text.warning',
    'warning.icon': 'color.icon.warning',
    'success.text': 'color.text.success',
    'success.icon': 'color.icon.success',
  },

  accessibility: {
    role: 'none (rendered text; the host associates it via aria-describedby)',
    wcag: [
      '1.4.1 Use of Colour (tone is carried by icon + text, never colour alone)',
      '3.3.1 Error Identification / 3.3.3 Error Suggestion (the error tone names the problem and the fix — wired by the host)',
      '1.4.3 Contrast (caption ink clears 4.5:1; the engine gates text.<role> per mode)',
    ],
    aria: 'The status icon is aria-hidden — the caption text carries the meaning. The message does NOT self-announce; the host field references its id in aria-describedby (and sets aria-invalid on error). If the message appears/changes dynamically, the host wraps it in a polite live region so it is announced without stealing focus.',
  },

  content: {
    errorPattern: 'Say what is wrong AND how to fix it (SC 3.3.3): "Enter a valid email address, e.g. name@example.com" — specific, human, not "Invalid input", not blaming the user.',
    labelPattern: 'Default tone carries the format up front ("Use 8+ characters") so the guidance is seen before failure, not only in the error.',
  },

  docs: {
    usage: 'Place directly below a field to carry persistent helper guidance (default tone) or a validation result (error / warning / success). Reuse the same component under every field control so the icon-plus-text, gated-contrast contract holds everywhere. The field wires it into aria-describedby.',
    do: [
      'Show the format/constraint in the default tone BEFORE the user can fail',
      'Pair the tone with an icon so it is never colour-only',
      'Let the host own aria-describedby + aria-invalid; keep this node presentational',
    ],
    dont: [
      'Signal error with colour alone (fails SC 1.4.1)',
      'Duplicate the error into a self-announcing live region here AND on the host — the host owns announcement',
      'Use warning as a hard blocker — it is a soft, non-blocking caution (many systems fold it into helper/error)',
    ],
  },

  ai: {
    primaryPurpose: 'Carry helper guidance or a validation result below a form field, as icon + caption.',
    whenToUse: 'Under any field control that needs persistent guidance or an error/warning/success message.',
    avoidWhen: 'As a standalone alert or toast (use an alert/banner) — this is field-scoped and associated to one control. Never as the sole colour-coded error signal without text.',
    commonPartners: ['text-field', 'number-field', 'select', 'checkbox', 'field-label', 'icon'],
    triggerKeywords: ['helper text', 'help text', 'error message', 'validation message', 'field error', 'caption', 'hint'],
    generationPriority: 3,
  },

  composition: {
    composesWith: ['text-field', 'field-label', 'icon'],
    alternativeTo: ['tooltip', 'inline-alert'],
  },

  notes: {
    contested: [
      'Whether warning is a distinct tone — many systems fold it into helper/error; kept here as an optional soft caution (brief §4).',
    ],
  },
};
