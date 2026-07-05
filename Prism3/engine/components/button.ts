/**
 * Button — re-authored v1 from the KB brief (knowledge-base/components/button.md §15),
 * the catalogue's calibration component. v0 was seeded from the schema shape only and
 * re-litigated settled decisions; this is faithful to the practice's resolved model.
 *
 * The practice's resolved decisions carried in here:
 *  - TWO-AXIS variant model: intent {primary, secondary, danger, ghost} × appearance
 *    {solid, outline, plain} × size — NOT a single overloaded `variant` enum (brief §3).
 *  - Default intent = secondary (one primary per view; the loud button is the deliberate
 *    choice, not the default) (§4, §15).
 *  - The state TRIO: isPending (focusable aria-disabled, delayed spinner, width-preserved,
 *    busy-announced), isInactive (focusable disabled — relevant-but-unsatisfied), isDisabled
 *    (native, RESERVED for controls irrelevant to the view) (§4, §13).
 *  - leadingVisual / trailingVisual (not *Icon — the slot holds avatars/counters/spinners) (§2).
 *  - type='button' default (neutralise the platform submit trap) (§3, §11).
 *  - Icon-ONLY is a distinct component (icon-button) so the accessible name is required at
 *    the type level (§6, §10).
 *
 * Calibration findings surfaced by binding the full matrix (see notes.findings): the engine
 * generates interaction states for `action` (primary) and `foreground.danger` but NOT for the
 * neutral `foreground.secondary` surface, and there is no `type.label.lg` — both are token-layer
 * gaps the engine-verified-focus-ring PR + a follow-up should close.
 */
import { ComponentDef } from '../component-schema';

export const button: ComponentDef = {
  id: 'button',
  name: 'Button',
  aliases: ['btn', 'cta'],
  category: 'form',
  status: 'draft',
  description:
    'In-flow trigger for an action that happens now, in the current context — submit, save, confirm, delete, open a dialog, fire async work. NOT navigation (use link / link-button, even when it looks like a button), NOT a persistent binary (switch), NOT one-of-many selection (segmented-control / toggle-button).',

  props: [
    { name: 'children', type: 'node (label)', required: true, description: 'Visible label; verb-first, sentence case, ≤3 words. (Not required for the icon-only case — that is a distinct icon-button.)' },
    { name: 'onClick', type: 'function', required: false, description: 'Action handler. Suppressed while isPending or isInactive.' },
    { name: 'intent', type: "enum: 'primary' | 'secondary' | 'danger' | 'ghost'", values: ['primary', 'secondary', 'danger', 'ghost'], default: 'secondary', required: false, description: 'Semantic role + colour. One primary per view. ghost is the conventional alias for intent=secondary + appearance=plain.' },
    { name: 'appearance', type: "enum: 'solid' | 'outline' | 'plain'", values: ['solid', 'outline', 'plain'], default: 'solid', required: false, description: 'Visual fill, decoupled from intent so the matrix scales by addition, not multiplication.' },
    { name: 'size', type: "enum: 'small' | 'medium' | 'large'", values: ['small', 'medium', 'large'], default: 'medium', required: false, description: 'Control size — drives height, padding, and label type.' },
    { name: 'fullWidth', type: 'boolean', default: false, required: false, description: 'Stretch to container. Aliases: block / isFullWidth.' },
    { name: 'type', type: "enum: 'button' | 'submit' | 'reset'", values: ['button', 'submit', 'reset'], default: 'button', required: false, description: "Opinionated default 'button' to neutralise the platform's submit-on-enter-in-form trap; require 'submit' explicitly." },
    { name: 'isPending', type: 'boolean', default: false, required: false, description: 'Delays the spinner, preserves width, keeps focus (aria-disabled, not native disabled), suppresses re-fire, announces busy. Preferred over `loading`.' },
    { name: 'isInactive', type: 'boolean', default: false, required: false, description: 'Focusable disabled — visually muted, retains tab order, surfaces the blockage reason on focus. Use for a control blocked by satisfiable app state (e.g. submit on an incomplete form).' },
    { name: 'isDisabled', type: 'boolean', default: false, required: false, description: 'Native disabled. RESERVED for controls fundamentally irrelevant to the current view; removes from tab order + a11y tree. Prefer isInactive for anything relevant-but-blocked.' },
    { name: 'leadingVisual', type: 'slot', required: false, description: 'Icon / avatar / counter / spinner before the label.' },
    { name: 'trailingVisual', type: 'slot', required: false, description: 'Icon / caret / indicator after the label.' },
    { name: 'href', type: 'string', required: false, description: 'Discouraged — prefer link-button. If present, MUST render <a> (which drops type/disabled semantics).' },
    { name: 'aria-label', type: 'string', required: false, description: 'Accessible name; only needed when there is no visible label. Must be a superset of any visible text (WCAG 2.5.3).' },
  ],

  states: ['rest', 'hover', 'focus-visible', 'pressed', 'pending', 'inactive', 'disabled'],
  variants: {
    intent: ['primary', 'secondary', 'danger', 'ghost'],
    appearance: ['solid', 'outline', 'plain'],
    size: ['small', 'medium', 'large'],
    width: ['auto', 'full'],
    modifiers: ['leading-visual', 'trailing-visual', 'pending'],
  },

  // Full intent × appearance × size skin, bound to semantic roles. State-qualified slots
  // carry a dotted state suffix. ghost is omitted as a distinct skin — it resolves to
  // secondary.plain per the brief. Keys structure the matrix; the generators read them.
  tokens: {
    // base (variant-independent)
    'radius': 'radius.md',
    'focus-ring': 'color.border.focus',
    'ring-width': 'focus.ring.width',
    'ring-offset': 'focus.ring.offset',

    // per-size geometry + label type
    'size.small.padding-x': 'size.sm.padding-x',
    'size.small.padding-y': 'size.sm.padding-y',
    'size.small.height': 'size.sm.height',
    'size.small.type': 'type.label.sm.emphasis',
    'size.medium.padding-x': 'size.md.padding-x',
    'size.medium.padding-y': 'size.md.padding-y',
    'size.medium.height': 'size.md.height',
    'size.medium.type': 'type.label.md.emphasis',
    'size.large.padding-x': 'size.lg.padding-x',
    'size.large.padding-y': 'size.lg.padding-y',
    'size.large.height': 'size.lg.height',
    'size.large.type': 'type.label.md.emphasis', // FINDING: no type.label.lg — reuses md

    // primary — action.* carries full interaction states
    'primary.solid.fill': 'color.action.default',
    'primary.solid.fill.hover': 'color.action.hover',
    'primary.solid.fill.pressed': 'color.action.pressed',
    'primary.solid.fill.disabled': 'color.action.disabled',
    'primary.solid.label': 'color.text.on-action',
    'primary.solid.label.disabled': 'color.text.on-disabled',
    'primary.solid.icon': 'color.icon.on-action',
    'primary.outline.border': 'color.border.brand',
    'primary.outline.label': 'color.text.brand',
    'primary.outline.icon': 'color.icon.brand',
    'primary.plain.label': 'color.text.brand',
    'primary.plain.icon': 'color.icon.brand',

    // secondary — neutral surface; FINDING: no hover/pressed states on foreground.secondary
    'secondary.solid.fill': 'color.foreground.secondary',
    'secondary.solid.label': 'color.text.primary',
    'secondary.solid.icon': 'color.icon.primary',
    'secondary.outline.border': 'color.border.secondary',
    'secondary.outline.label': 'color.text.primary',
    'secondary.outline.icon': 'color.icon.primary',
    'secondary.plain.label': 'color.text.primary',
    'secondary.plain.icon': 'color.icon.primary',

    // danger — foreground.danger.* carries full interaction states
    'danger.solid.fill': 'color.foreground.danger.default',
    'danger.solid.fill.hover': 'color.foreground.danger.hover',
    'danger.solid.fill.pressed': 'color.foreground.danger.pressed',
    'danger.solid.fill.disabled': 'color.foreground.danger.disabled',
    'danger.solid.label': 'color.text.on-danger',
    'danger.solid.icon': 'color.icon.on-danger',
    'danger.outline.border': 'color.border.danger',
    'danger.outline.label': 'color.text.danger',
    'danger.outline.icon': 'color.icon.danger',
    'danger.plain.label': 'color.text.danger',
    'danger.plain.icon': 'color.icon.danger',

    // shared disabled ink for the non-solid appearances (solid skins bind their own on-disabled)
    'label.disabled': 'color.text.disabled',
    'icon.disabled': 'color.icon.disabled',
  },

  accessibility: {
    role: 'button (native <button>; never div[role=button] — it inherits Space/Enter activation, focus, and HC affordances for free)',
    wcag: ['1.4.11 Non-text Contrast (the focus ring + boundary ≥ 3:1)', '2.4.7 Focus Visible', '2.4.13 Focus Appearance', '2.5.3 Label in Name', '2.5.5 / 2.5.8 Target Size', '4.1.2 Name/Role/Value'],
    keyboard: 'Native <button>: Enter activates on keydown, Space on keyup. (This asymmetry vs a link — which activates on Enter only, Space scrolls — is exactly why a navigating "button" must be a real link.)',
    focus: 'A :focus-visible ring (color.border.focus) with an outline-offset so a sliver of background separates ring from border — it must NOT blend into the button\'s own fill (WCAG 1.4.11, target 3:1). Never suppressed. Focus is RETAINED through pending and inactive (aria-disabled, not native disabled).',
  },

  content: {
    labelPattern: 'Verb-first, action-specific, sentence case, ≤3 words. "Save changes" / "Delete file" — never "OK", "Submit", or "Click here".',
    errorPattern: 'Button has no error state — surface failures in an adjacent inline-message / alert (errors belong to the form/field).',
    dialogPattern: 'Match the destructive verb to the consequence ("Delete", not "Confirm"). Cancel = abort+revert; Close/Dismiss = dismiss info; never "OK" on an error.',
  },

  docs: {
    usage: 'Use for an immediate action in the current context — submit/save/reset a form, trigger a UI state change (open modal, toggle drawer), or fire async work. Assign intent=primary by the action\'s importance TO THIS VIEW; exactly one per view/region.',
    do: [
      'Lead with a verb, name the object ("Publish post", not "Submit")',
      'Keep exactly one primary per view; use secondary/ghost for the rest',
      'Pair a danger button with an adjacent neutral escape ("Cancel"/"Keep")',
      'Use isInactive (focusable) for a control blocked by satisfiable state; reserve isDisabled for the irrelevant',
    ],
    dont: [
      'Use a button for navigation to a URL — use a link / link-button',
      'Stack multiple primaries competing for attention',
      'Use native disabled on a relevant-but-blocked control (dead end for keyboard/SR users)',
      'Replace the label with a centred spinner (collapses width) — swap the leading visual instead',
    ],
    contentGuidelines: 'Verb-first, specific, sentence case, no terminal punctuation, ≤3 words to bound i18n expansion.',
  },

  ai: {
    primaryPurpose: 'Trigger an action in place.',
    whenToUse: 'The user needs to DO something on this surface — submit, confirm, open, apply, or start async work.',
    avoidWhen: 'The target is a different location/URL → use a link (or link-button if it must look like a button). A persistent on/off state → use a switch. One-of-many selection → use a segmented-control / radio. A toggle with pressed state → use a toggle-button. Icon-only with no visible text → use an icon-button (the accessible name is required there at the type level).',
    commonPartners: ['icon', 'spinner', 'tooltip', 'button-group', 'menu', 'popover'],
    triggerKeywords: ['button', 'submit', 'cta', 'confirm', 'action', 'primary action', 'save', 'delete'],
    generationPriority: 1,
  },

  composition: {
    composesWith: ['icon', 'spinner', 'tooltip', 'button-group', 'menu', 'popover'],
    alternativeTo: ['link', 'link-button', 'icon-button', 'toggle-button', 'split-button', 'switch', 'chip'],
    supersedes: ['input[type=button|submit]', 'div[role=button]'],
  },

  motion: {
    enter: 'none (present on mount)',
    exit: 'none',
    reduceMotion: 'State transitions (bg/border/shadow) run ~100–150ms via motion tokens; a subtle press (scale 0.98) gives tactile feedback. Under prefers-reduced-motion, resolve scale/translate to none but KEEP the instantaneous colour change so the state stays perceivable; the pending spinner is functional and its busy state is carried by aria-busy regardless.',
  },

  notes: {
    contested: [
      'native isDisabled vs focusable isInactive — the practice defaults to isInactive for relevant-but-blocked, but focusable aria-disabled is not yet the field-wide default (per-engagement decision).',
      'ghost (intent) vs plain (appearance) overlap — ghost is carried as an alias for secondary.plain, not a distinct skin.',
      'intent bundles hierarchy + tone, so a low-emphasis destructive ("quiet Delete") is expressed as intent=danger appearance=plain rather than a fully orthogonal emphasis×tone split.',
    ],
    unverified: [
      'FINDING (token layer): the neutral secondary.solid fill (foreground.secondary) has no hover/pressed/disabled states — only action (primary) and foreground.danger carry interaction states. A solid secondary button cannot express hover today.',
      'FINDING (token layer): no type.label.lg composite — large buttons reuse type.label.md.',
      'FINDING (engine): the focus-ring 3:1 non-text contrast (1.4.11) is asserted here but not yet engine-verified — that is the next contract to add (owner-approved).',
    ],
  },
};
