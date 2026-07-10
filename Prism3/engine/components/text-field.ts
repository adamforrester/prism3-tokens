/**
 * TextField — the calibration brief for ENCAPSULATION BOUNDARY and ACCESSIBILITY WIRING
 * (KB text-field brief; Button is the calibration for intent×appearance, this is for where the
 * field ends and the form begins). A single-line control for free-form, non-enumerable text.
 *
 * The composition call (brief §2, §3, §12): TextField is the HOST that composes the two shared
 * field parts — `field-label` (the accessible name) and `field-message` (helper / validation) —
 * rather than re-declaring their tokens. So this def's `tokens` block is the INPUT CHROME only
 * (fill, the stateful border, placeholder, focus ring, disabled skin, geometry); label and
 * message colour/type live in their own defs and are reused by Select / NumberField later. That
 * is the "composed slots" half of the brief's hybrid, expressed in the data model. The host owns
 * the WIRING the parts can't: useId-generated ids tying label→input and stitching the
 * aria-describedby chain (helper + error), plus aria-invalid on error (§6, §11).
 *
 * State model = the input border, which is the one stateful field slot:
 *   rest → field.border.rest · hover → field.border.hover (a subtly stronger boundary, never the
 *   sole cue) · focus → border.focus + the field focus ring · error → border.danger (a border-ONLY
 *   swap; the message carries the text) · read-only → border.secondary with FULL-contrast
 *   text.primary (read-only ≠ disabled: focusable, copyable, submitted, passes contrast — the
 *   component's live edge, §4) · disabled → the shared disabled.* skin (contrast-exempt).
 *
 * Scope: the BASE field only. NumberField is a separate component (different keyboard + locale
 * parsing); SearchField / PasswordField are thin specialisations; email / url / tel stay as
 * `type` + inputmode + autocomplete here (brief §3). Validation is PRESENTATIONAL by default —
 * the field renders the `error` it is handed; a form library owns timing. No validation engine
 * is baked in.
 */
import { ComponentDef } from '../component-schema';

export const textField: ComponentDef = {
  id: 'text-field',
  name: 'TextField',
  aliases: ['text-input', 'input', 'textbox', 'formfield'],
  category: 'form',
  status: 'draft',
  description:
    'A single-line control for free-form, non-enumerable text — names, emails, SKUs, short queries. A composed host: label + input + helper/error, with the accessibility wiring (id generation, aria-describedby chain, aria-invalid) handled internally. Not multi-line (Textarea), not a known set (Select/Combobox), not numeric-formatted (NumberField), not suggestion-backed (Combobox).',

  props: [
    { name: 'label', type: 'string | node', required: true, description: 'The visible, persistent label (rendered as FieldLabel). Required — a visually-hidden label is the only label-less case, and it still exists in the DOM. Never the placeholder.' },
    { name: 'value', type: 'string', required: false, description: 'Controlled value; pair with onChange. A controlled value with no onChange is read-only by accident.' },
    { name: 'defaultValue', type: 'string', required: false, description: 'Uncontrolled initial value — preferred for form-library ergonomics.' },
    { name: 'onChange', type: 'function', required: false, description: 'Change handler (also onBlur / onFocus).' },
    { name: 'type', type: "enum: 'text' | 'email' | 'url' | 'tel' | 'search' | 'password'", values: ['text', 'email', 'url', 'tel', 'search', 'password'], default: 'text', required: false, description: 'Attribute-only variants (mobile keyboard + autofill). NOT number — use NumberField. search / password are better served by their thin specialisations.' },
    { name: 'placeholder', type: 'string', required: false, description: 'An example only ("name@example.com"); vanishes on input; nothing load-bearing lives here.' },
    { name: 'helpText', type: 'string | node', required: false, description: 'Persistent guidance (rendered as FieldMessage, default tone); wired via aria-describedby. Show the format BEFORE failure.' },
    { name: 'error', type: 'string | node', required: false, description: 'Error message (rendered as FieldMessage, error tone). Sets aria-invalid + adds the id to aria-describedby. Say what and how to fix (SC 3.3.3); the message pairs an icon, so it is not colour-only. The input itself swaps to a border-only error boundary.' },
    { name: 'required', type: 'boolean', default: false, required: false, description: 'Sets required / aria-required; the label marks the minority (§7).' },
    { name: 'disabled', type: 'boolean', default: false, required: false, description: 'Native disabled — removed from tab order, not submitted, silent to AT, contrast-exempt. Reserve for fields irrelevant in the current state.' },
    { name: 'readOnly', type: 'boolean', default: false, required: false, description: 'DISTINCT from disabled — focusable, selectable/copyable, SUBMITTED, passes contrast. Use for a value the user may read/copy but not edit (a generated key). The component\'s live edge (§4).' },
    { name: 'autoComplete', type: 'string (WHATWG token)', required: false, description: 'Satisfies SC 1.3.5 Identify Input Purpose — an accessibility obligation, not a convenience.' },
    { name: 'inputMode', type: "enum: 'text' | 'numeric' | 'decimal' | 'tel' | 'email' | 'url' | 'search'", values: ['text', 'numeric', 'decimal', 'tel', 'email', 'url', 'search'], required: false, description: 'Selects the mobile virtual keyboard.' },
    { name: 'prefix', type: 'slot (adornment)', required: false, description: 'Leading adornment — a decorative/purpose glyph (currency, search), aria-hidden. Signals the field\'s PURPOSE; validation never mutates it.' },
    { name: 'suffix', type: 'slot (adornment | action)', required: false, description: 'Trailing adornment. May be decorative (aria-hidden) OR a real labelled action (clear / reveal) — a focusable button, not decoration. The decorative-vs-interactive split is load-bearing (§2).' },
    { name: 'clearable', type: 'boolean', default: false, required: false, description: 'Adds a labelled Clear button that announces the cleared state and RETURNS FOCUS to the input (the recurring trap is stranding focus).' },
    { name: 'loading', type: 'boolean', default: false, required: false, description: 'Async validation/value — a spinner replaces an adornment without reflow; sets aria-busy; does not block typing unless intended.' },
    { name: 'size', type: "enum: 'small' | 'medium' | 'large'", values: ['small', 'medium', 'large'], default: 'medium', required: false, description: 'Three tiers (height + padding). A single bordered (outline) style; filled/underline are theming, not API.' },
    { name: 'id', type: 'string', required: false, description: 'Wiring + form submission; auto-generated with useId if omitted, tying label→input and the aria-describedby chain.' },
    { name: 'name', type: 'string', required: false, description: 'A real <input name> so the field works uncontrolled, in a native <form>, with useFormStatus / Server Actions, and the Constraint Validation API.' },
  ],

  // The FULL generic state set actually applies here (unlike Button). read-only and disabled are
  // distinct rows — the component's live edge. warning is optional (folded into helper/error by many).
  states: ['rest', 'hover', 'focus-visible', 'disabled', 'read-only', 'loading', 'error', 'empty'],
  variants: {
    size: ['small', 'medium', 'large'],
    style: ['outline'], // default; filled/underline are theming, not an API axis
  },

  // INPUT CHROME ONLY — label + message colour/type live in field-label / field-message (composed).
  // Border is the one stateful slot: rest/hover from field.*, focus/error/read-only from generic
  // border roles, disabled from the shared disabled skin. The value ink is full-contrast text.primary
  // in every non-disabled state (read-only included — it is NOT dimmed); disabled swaps to the
  // contrast-exempt disabled ink. The focus ring uses the field-specific offset.
  tokens: {
    'fill': 'color.field.fill',
    'text': 'color.text.primary',
    'placeholder': 'color.field.placeholder',
    'border.rest': 'color.field.border.rest',
    'border.hover': 'color.field.border.hover',
    'border.focus': 'color.border.focus',
    'border.error': 'color.border.danger',
    'border.readonly': 'color.border.secondary',
    // focus ring — field-specific offset so the ring hugs the inset field, not a button edge
    'focus-ring': 'color.border.focus',
    'ring-width': 'focus.ring.width',
    'ring-offset': 'focus.ring.offset-field',
    // disabled skin (contrast-exempt) — the shared cross-cutting family
    'disabled.fill': 'color.disabled.fill',
    'disabled.text': 'color.disabled.on-fill',
    'disabled.border': 'color.disabled.border',
    // geometry
    'radius': 'radius.sm',
    'size.small.height': 'size.sm.height',
    'size.small.pad-x': 'size.sm.padding-x',
    'size.small.pad-y': 'size.sm.padding-y',
    'size.medium.height': 'size.md.height',
    'size.medium.pad-x': 'size.md.padding-x',
    'size.medium.pad-y': 'size.md.padding-y',
    'size.large.height': 'size.lg.height',
    'size.large.pad-x': 'size.lg.padding-x',
    'size.large.pad-y': 'size.lg.padding-y',
  },

  accessibility: {
    role: 'textbox (native <input>)',
    wcag: [
      '1.3.5 Identify Input Purpose (autocomplete — the most field-specific SC)',
      '1.3.1 Info and Relationships (label + describedby association)',
      '3.3.1 Error Identification / 3.3.2 Labels or Instructions / 3.3.3 Error Suggestion',
      '1.4.3 Contrast (value + placeholder) / 1.4.11 Non-text Contrast (field boundary ≥3:1) / 2.4.13 Focus Appearance',
      '4.1.2 Name/Role/Value / 2.5.8 Target Size',
      '3.3.7 Redundant Entry / 3.3.8 Accessible Authentication (login/checkout fields, WCAG 2.2)',
    ],
    keyboard: 'Native text editing. Tab focuses the input; interactive affixes (clear / reveal) are SEPARATE tab stops with their own accessible names. Escape clears when clearable.',
    focus: ':focus-visible ring, boundary ≥3:1 (1.4.11 / 2.4.13) — the field is a primary focus target. forwardRef must reach the <input>, not the wrapper, so consumers can focus on load / focus the first invalid field on submit.',
    aria: 'The host generates ids (useId) and stitches aria-describedby across helper + error, and sets aria-invalid on error — the consumer never hand-manages ids (the highest-frequency real a11y failure). placeholder is NOT the accessible name. During loading, aria-busy; the field stays focusable. Do not fire validation mid-IME-composition. Set dir="auto" on the input so content direction can differ from UI direction.',
  },

  content: {
    labelPattern: 'Noun phrase, sentence case, ≤3 words, no trailing colon; never the placeholder (see field-label).',
    errorPattern: 'What is wrong AND how to fix it (SC 3.3.3); icon + text, not colour-only (see field-message).',
    emptyPattern: 'The empty state is just the label + optional placeholder — there is no separate empty UI.',
  },

  docs: {
    usage: 'Use for free-form, non-enumerable single-line input — names, titles, SKUs, identifiers, short queries. Always render a visible label; show the format in helper text before failure; keep validation timing with the form library. Compose FieldLabel above and FieldMessage below; the host wires the ids and aria-describedby chain.',
    do: [
      'Always render a visible, associated label (FieldLabel) — visually-hidden only for search',
      'Distinguish readOnly (copyable, submitted, full-contrast) from disabled (silent, exempt)',
      'Emit a real <input name> so it works uncontrolled, in a native form, with Server Actions',
      'Separate a decorative prefix (aria-hidden) from an interactive suffix action (a labelled button)',
    ],
    dont: [
      'Use the placeholder as the label, or put load-bearing text in it',
      'Use type="number" for numeric input — use NumberField (email/url/tel stay as type here)',
      'Bake a validation engine or timing into the field — render the error you are handed',
      'Signal error with the border colour alone — the message carries the text + icon',
    ],
    contentGuidelines: 'Label = noun phrase, sentence case, no trailing colon. Placeholder = example only. Helper carries the format up front. Error says what + how to fix, never "Invalid input".',
  },

  ai: {
    primaryPurpose: 'Capture a single line of free-form, non-enumerable text with an associated label and helper/error.',
    whenToUse: 'Names, emails, titles, SKUs, identifiers, short queries — any single-line text the system cannot offer as a fixed set.',
    avoidWhen: 'The value comes from a known set (Select/Radio/Combobox), spans multiple lines (Textarea), is numeric-formatted (NumberField), is boolean (Checkbox/Switch), is a date (Date Picker), or needs suggestions (Combobox — the moment a suggestion list attaches you are in combobox territory with a different ARIA contract).',
    commonPartners: ['field-label', 'field-message', 'icon', 'button', 'spinner', 'form'],
    triggerKeywords: ['text field', 'text input', 'input', 'form field', 'textbox', 'email field', 'search field'],
    generationPriority: 2,
  },

  composition: {
    composesWith: ['field-label', 'field-message', 'icon', 'button', 'spinner', 'form', 'tooltip'],
    alternativeTo: ['textarea', 'select', 'combobox', 'number-field', 'search-field', 'date-picker', 'password-field', 'checkbox', 'switch'],
    supersedes: ['bare input without label wiring', 'placeholder-as-label', 'type=number for formatted numeric'],
  },

  notes: {
    contested: [
      'Bundled props vs composed slots — ship both: props for the 90% vertical-form case, composed FieldLabel/FieldMessage slots for the 10% custom layout (brief §3).',
      'How far to split the typed family — NumberField separate; SearchField/PasswordField thin specialisations; email/url/tel stay as type+attributes (brief §3).',
      'Validation ownership/timing — presentational default; the form library owns timing (brief §3, §6).',
      'warning as a distinct state — optional; many systems fold it into helper/error (brief §4).',
    ],
    unverified: [
      'Polaris migration to framework-agnostic Web Components (<s-text-field>, Shadow DOM) — needs _source-text backing, shared with the Button brief (brief §11, §14).',
    ],
  },
};
