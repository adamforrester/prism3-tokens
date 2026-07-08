/**
 * Button — re-authored v1 from the KB brief (knowledge-base/components/button.md §15),
 * the catalogue's calibration component. v0 was seeded from the schema shape only and
 * re-litigated settled decisions; this is faithful to the practice's resolved model.
 *
 * The practice's resolved decisions carried in here:
 *  - TWO-AXIS variant model: intent {primary, neutral, destructive} × appearance
 *    {filled, outline, text} × size — NOT a single overloaded `variant` enum (brief §3;
 *    reconciled to the interactive vocabulary per docs/20 / KB button.md §3).
 *  - Default intent = neutral (one primary per view; the loud button is the deliberate
 *    choice, not the default) (§4, §15).
 *  - The state TRIO: isPending (focusable aria-disabled, delayed spinner, width-preserved,
 *    busy-announced), isInactive (focusable disabled — relevant-but-unsatisfied), isDisabled
 *    (native, RESERVED for controls irrelevant to the view) (§4, §13).
 *  - leadingVisual / trailingVisual (not *Icon — the slot holds avatars/counters/spinners) (§2).
 *  - type='button' default (neutralise the platform submit trap) (§3, §11).
 *  - Icon-ONLY is a distinct component (icon-button) so the accessible name is required at
 *    the type level (§6, §10).
 *
 * Rebound to the interactive colour system (docs/20): the two-axis model is now the
 * reconciled vocabulary — appearance {filled, outline, text} × colour {primary, neutral,
 * destructive} (+ accent when a brand declares one) — bound to `interactive.<colour>.*`
 * with cross-cutting `disabled.*`. This CLOSES the v1 HIGH finding: neutral (was the
 * stateless `foreground.secondary`) now carries hover/pressed/on-fill like every colour,
 * so the default button is no longer hover-less. outline/text hover uses the overlay wash
 * (assumes `outlineInteraction: overlay-neutral`, the default). `ghost` is retired — a
 * quiet button is `intent=neutral appearance=text`. (`type.label.lg` gap still stands.)
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
    { name: 'intent', type: "enum: 'primary' | 'neutral' | 'destructive'", values: ['primary', 'neutral', 'destructive'], default: 'neutral', required: false, description: 'Semantic colour, drawn from interactive.<intent>.* (docs/20). One primary per view; neutral is the workhorse default; destructive for delete/remove. accent is available when the brand declares one. (Reconciled from the old primary/secondary/danger/ghost — secondary→neutral, danger→destructive, ghost retired to intent=neutral appearance=text.)' },
    { name: 'appearance', type: "enum: 'filled' | 'outline' | 'text'", values: ['filled', 'outline', 'text'], default: 'filled', required: false, description: 'Visual treatment over the colour, decoupled from intent so the matrix scales by addition. filled = interactive fill + on-fill ink; outline = border + text ink; text = ink only. (Reconciled from solid/outline/plain.)' },
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
    intent: ['primary', 'neutral', 'destructive'],
    appearance: ['filled', 'outline', 'text'],
    size: ['small', 'medium', 'large'],
    width: ['auto', 'full'],
    modifiers: ['leading-visual', 'trailing-visual', 'pending'],
  },

  // Full colour × appearance × size skin, bound to the interactive.* family + cross-cutting
  // disabled.*. Every colour now carries the SAME shape (fill+states / on-fill / border / text
  // / overlay), so the matrix is uniform — no per-colour gaps. State-qualified slots carry a
  // dotted state suffix. accent is omitted from the base matrix (brand-conditional — it exists
  // only when the brand declares an accent palette). Keys structure the matrix; generators read them.
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
    'size.large.type': 'type.label.md.emphasis', // FINDING (still open): no type.label.lg — reuses md

    // primary — interactive.primary.* (full states)
    'primary.filled.fill': 'color.interactive.primary.fill.rest',
    'primary.filled.fill.hover': 'color.interactive.primary.fill.hover',
    'primary.filled.fill.pressed': 'color.interactive.primary.fill.pressed',
    'primary.filled.label': 'color.interactive.primary.on-fill',
    'primary.filled.icon': 'color.interactive.primary.on-fill',
    'primary.outline.border': 'color.interactive.primary.border',
    'primary.outline.label': 'color.interactive.primary.text',
    'primary.outline.icon': 'color.interactive.primary.text',
    'primary.outline.overlay.hover': 'color.interactive.primary.overlay.hover',
    'primary.outline.overlay.pressed': 'color.interactive.primary.overlay.pressed',
    'primary.text.label': 'color.interactive.primary.text',
    'primary.text.icon': 'color.interactive.primary.text',
    'primary.text.overlay.hover': 'color.interactive.primary.overlay.hover',
    'primary.on-inverse.label': 'color.interactive.primary.on-inverse',

    // neutral — the workhorse default; now carries hover/pressed like every colour (v1 gap CLOSED)
    'neutral.filled.fill': 'color.interactive.neutral.fill.rest',
    'neutral.filled.fill.hover': 'color.interactive.neutral.fill.hover',
    'neutral.filled.fill.pressed': 'color.interactive.neutral.fill.pressed',
    'neutral.filled.label': 'color.interactive.neutral.on-fill',
    'neutral.filled.icon': 'color.interactive.neutral.on-fill',
    'neutral.outline.border': 'color.interactive.neutral.border',
    'neutral.outline.label': 'color.interactive.neutral.text',
    'neutral.outline.icon': 'color.interactive.neutral.text',
    'neutral.outline.overlay.hover': 'color.interactive.neutral.overlay.hover',
    'neutral.outline.overlay.pressed': 'color.interactive.neutral.overlay.pressed',
    'neutral.text.label': 'color.interactive.neutral.text',
    'neutral.text.icon': 'color.interactive.neutral.text',
    'neutral.text.overlay.hover': 'color.interactive.neutral.overlay.hover',
    'neutral.on-inverse.label': 'color.interactive.neutral.on-inverse',

    // destructive — interactive.destructive.* (full states)
    'destructive.filled.fill': 'color.interactive.destructive.fill.rest',
    'destructive.filled.fill.hover': 'color.interactive.destructive.fill.hover',
    'destructive.filled.fill.pressed': 'color.interactive.destructive.fill.pressed',
    'destructive.filled.label': 'color.interactive.destructive.on-fill',
    'destructive.filled.icon': 'color.interactive.destructive.on-fill',
    'destructive.outline.border': 'color.interactive.destructive.border',
    'destructive.outline.label': 'color.interactive.destructive.text',
    'destructive.outline.icon': 'color.interactive.destructive.text',
    'destructive.outline.overlay.hover': 'color.interactive.destructive.overlay.hover',
    'destructive.outline.overlay.pressed': 'color.interactive.destructive.overlay.pressed',
    'destructive.text.label': 'color.interactive.destructive.text',
    'destructive.text.icon': 'color.interactive.destructive.text',
    'destructive.text.overlay.hover': 'color.interactive.destructive.overlay.hover',
    'destructive.on-inverse.label': 'color.interactive.destructive.on-inverse',

    // cross-cutting disabled (docs/20 §7) — ONE treatment, any intent/appearance
    'disabled.fill': 'color.disabled.fill',
    'disabled.on-fill': 'color.disabled.on-fill',
    'disabled.label': 'color.disabled.text',
    'disabled.icon': 'color.disabled.icon',
    'disabled.border': 'color.disabled.border',
  },

  accessibility: {
    role: 'button (native <button>; never div[role=button] — it inherits Space/Enter activation, focus, and HC affordances for free)',
    wcag: ['1.4.11 Non-text Contrast (the focus ring + boundary ≥ 3:1)', '2.4.7 Focus Visible', '2.4.13 Focus Appearance', '2.5.3 Label in Name', '2.5.5 / 2.5.8 Target Size', '4.1.2 Name/Role/Value'],
    keyboard: 'Native <button>: Enter activates on keydown, Space on keyup. (This asymmetry vs a link — which activates on Enter only, Space scrolls — is exactly why a navigating "button" must be a real link.)',
    focus: 'A :focus-visible ring (color.border.focus) with an outline-offset so a sliver of background separates ring from border — it must NOT blend into the button\'s own fill (WCAG 1.4.11, target 3:1). Never suppressed. Focus is RETAINED through pending and inactive (aria-disabled, not native disabled).',
    aria: 'State attributes are distinct, not interchangeable: aria-pressed only for a toggle-button; aria-expanded (+ aria-haspopup) for a menu/disclosure trigger; aria-checked only for the switch role. Do not conflate them. Busy: while isPending, set aria-busy and announce via a polite live region ("Saving…") since a spinner is invisible to assistive tech; keep the control focusable so the busy state is discoverable. isInactive/isPending use aria-disabled (not native disabled) so focus and the explanatory name/description stay reachable.',
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
      'Keep exactly one primary per view; use neutral (with outline/text appearances) for the rest',
      'Pair a destructive button with an adjacent neutral escape ("Cancel"/"Keep")',
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
      'intent bundles hierarchy + tone, so a low-emphasis destructive ("quiet Delete") is expressed as intent=destructive appearance=text rather than a fully orthogonal emphasis×tone split.',
      'outline/text hover uses the interactive overlay wash, which assumes outlineInteraction=overlay-neutral (the default); a solid-tint / none brand rebinds those slots (foreground.<colour>-subtle / no hover).',
    ],
    evolution: [
      'RESOLVED (was the v1 HIGH finding): interaction states existed only on the solid action/danger roles, so the default (neutral) button was hover-less. The interactive colour system (docs/20) gives every colour — primary/neutral/destructive — the full fill+states/on-fill/border/text/overlay shape, so the matrix is now uniform and the default button has proper hover/pressed. Disabled is the cross-cutting disabled.* family, no longer scattered per-colour.',
    ],
    unverified: [
      'FINDING (token layer, still open): no type.label.lg composite — large buttons reuse type.label.md (large differs from medium only in height/padding, not type scale).',
      'FINDING (engine): the focus-ring 3:1 non-text contrast (1.4.11) is asserted here but not yet engine-verified — a follow-up contract.',
    ],
  },
};
