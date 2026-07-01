/**
 * Prism3 engine — the PREVIEW SPEC (docs/08 §7, B1a).
 *
 * A portable, data-only description of sample components — each element binding to
 * semantic token paths (root-relative, e.g. `color.action.default`, `radius.md`,
 * `type.label.md.emphasis`) plus the contrast pairs to overlay. It is the shared
 * artifact that makes the Figma plugin and the web playground render the SAME live
 * preview: both host renderers read this one spec and resolve the paths against the
 * current theme. It extracts the component/binding knowledge that was hardcoded in
 * `visualize.ts` into a contract both surfaces (and the visualiser) can render from.
 *
 * PURE — no `node:*`, no I/O (bundled into the browser/Figma sandbox; docs/07 §3,
 * the pure-core / I/O-shell split — same lesson as `levers.ts` ↔ `emit-levers.ts`).
 * The emit step is the shell `emit-preview.ts` → `schema/preview-spec.json`.
 *
 * `test.ts` gates it: every referenced token path resolves to a real leaf in the
 * emitted token tree (the binding-validity gate — the same "can't drift" discipline
 * as the lever manifest), and every contract pair's fg/bg is itself a bound token.
 * The actual contrast *values* are already gated by the engine's mode contracts
 * (248/248); the overlay just surfaces them per pair.
 */

/** A component element's token bindings: UI prop → root-relative token path. */
export type PreviewBindings = Record<string, string>;
/** A foreground/background pair whose contrast the overlay reports (fg on bg ≥ min). */
export type ContractPair = { fg: string; bg: string; min: number; label?: string };
export type PreviewVariant = { name: string; bindings: PreviewBindings; contracts?: ContractPair[] };
export type PreviewComponent = { id: string; label: string; description: string; variants: PreviewVariant[] };
export type PreviewSpec = { components: PreviewComponent[] };

// Contrast minimums (WCAG): body/label text 4.5; large text + non-text UI (borders,
// focus, disabled per the engine's disabledMin) 3.
const TEXT = 4.5, UI = 3;

// Common bindings reused across variants.
const surface = { bg: 'color.foreground.primary', text: 'color.text.primary', border: 'color.border.secondary' };

export const previewSpec: PreviewSpec = {
  components: [
    {
      id: 'button', label: 'Button (primary)', description: 'The primary action — filled, on the action palette, across its states.',
      variants: ['default', 'hover', 'pressed', 'disabled'].map((s) => ({
        name: s,
        bindings: {
          bg: s === 'disabled' ? 'color.action.disabled' : `color.action.${s}`,
          text: s === 'disabled' ? 'color.text.on-disabled' : 'color.text.on-action',
          radius: 'radius.md', padX: 'space.300', padY: 'space.150', type: 'type.label.md.emphasis',
        },
        contracts: [{ fg: s === 'disabled' ? 'color.text.on-disabled' : 'color.text.on-action', bg: s === 'disabled' ? 'color.action.disabled' : `color.action.${s}`, min: s === 'disabled' ? UI : TEXT, label: 'label on fill' }],
      })),
    },
    {
      id: 'button-secondary', label: 'Button (secondary)', description: 'White-fill + brand border and label — the demoted action.',
      variants: [{
        name: 'default',
        bindings: { bg: 'color.background.primary', border: 'color.border.brand', text: 'color.foreground.brand', radius: 'radius.md', padX: 'space.300', padY: 'space.150', type: 'type.label.md.emphasis' },
        contracts: [{ fg: 'color.foreground.brand', bg: 'color.background.primary', min: TEXT, label: 'label on page' }, { fg: 'color.border.brand', bg: 'color.background.primary', min: UI, label: 'border on page' }],
      }],
    },
    {
      id: 'input', label: 'Text input', description: 'A form field — default, focused (brand ring), and disabled.',
      variants: [
        // `border.primary` is bound for rendering but NOT contracted: the engine
        // ships it decorative (min 0, ~1.5:1) — the input's 3:1 obligation is carried
        // by the focus ring (border.focus, contracted on the focus variant), not the
        // resting border. (Same as `card`'s decorative border.secondary — bound, not contracted.)
        { name: 'default', bindings: { bg: 'color.background.primary', border: 'color.border.primary', text: 'color.text.primary', placeholder: 'color.text.tertiary', radius: 'radius.sm', padX: 'space.200', padY: 'space.150', type: 'type.body.md.default' },
          contracts: [{ fg: 'color.text.primary', bg: 'color.background.primary', min: TEXT, label: 'value on field' }] },
        { name: 'focus', bindings: { bg: 'color.background.primary', border: 'color.border.focus', text: 'color.text.primary', radius: 'radius.sm', padX: 'space.200', padY: 'space.150', type: 'type.body.md.default' },
          contracts: [{ fg: 'color.border.focus', bg: 'color.background.primary', min: UI, label: 'focus ring' }] },
        { name: 'disabled', bindings: { bg: 'color.background.secondary', border: 'color.border.secondary', text: 'color.text.disabled', radius: 'radius.sm', padX: 'space.200', padY: 'space.150', type: 'type.body.md.default' },
          contracts: [{ fg: 'color.text.disabled', bg: 'color.background.secondary', min: UI, label: 'disabled value' }] },
      ],
    },
    {
      id: 'card', label: 'Card', description: 'A surface with a title, body, and a nested action — the elevation + ink workhorse.',
      variants: [{
        name: 'default',
        bindings: { bg: surface.bg, border: surface.border, title: 'type.title.md.strong', titleText: 'color.text.primary', body: 'type.body.md.default', bodyText: 'color.text.secondary', radius: 'radius.lg', shadow: 'shadow.sm', pad: 'space.300' },
        contracts: [{ fg: 'color.text.primary', bg: 'color.foreground.primary', min: TEXT, label: 'title on card' }, { fg: 'color.text.secondary', bg: 'color.foreground.primary', min: TEXT, label: 'body on card' }],
      }],
    },
    {
      id: 'alert', label: 'Alert / banner', description: 'A semantic banner per status — tinted fill, matching border, ink, and icon.',
      variants: ['success', 'warning', 'danger', 'info'].map((sem) => ({
        name: sem,
        bindings: { bg: `color.foreground.${sem}-subtle`, border: `color.border.${sem}`, text: `color.text.${sem}`, icon: `color.icon.${sem}`, radius: 'radius.md', pad: 'space.200', type: 'type.body.md.default' },
        contracts: [{ fg: `color.text.${sem}`, bg: `color.foreground.${sem}-subtle`, min: TEXT, label: `${sem} text on tint` }, { fg: `color.border.${sem}`, bg: 'color.background.primary', min: UI, label: 'border on page' }],
      })),
    },
    {
      id: 'nav-item', label: 'Nav item', description: 'A top-nav link — resting and selected (brand ink + action indicator).',
      variants: [
        { name: 'default', bindings: { text: 'color.text.secondary', type: 'type.label.md.emphasis', padX: 'space.200', padY: 'space.150' },
          contracts: [{ fg: 'color.text.secondary', bg: 'color.background.primary', min: TEXT, label: 'label on page' }] },
        { name: 'selected', bindings: { text: 'color.text.brand', indicator: 'color.action.default', type: 'type.label.md.emphasis', padX: 'space.200', padY: 'space.150' },
          contracts: [{ fg: 'color.text.brand', bg: 'color.background.primary', min: TEXT, label: 'selected label' }, { fg: 'color.action.default', bg: 'color.background.primary', min: UI, label: 'indicator' }] },
      ],
    },
    {
      id: 'badge', label: 'Badge / tag', description: 'A compact status pill — filled brand and subtle-info variants.',
      variants: [
        { name: 'brand', bindings: { bg: 'color.foreground.brand', text: 'color.text.on-brand', radius: 'radius.round', padX: 'space.150', padY: 'space.100', type: 'type.label.sm.emphasis' },
          contracts: [{ fg: 'color.text.on-brand', bg: 'color.foreground.brand', min: TEXT, label: 'label on fill' }] },
        { name: 'info-subtle', bindings: { bg: 'color.foreground.info-subtle', text: 'color.text.info', radius: 'radius.round', padX: 'space.150', padY: 'space.100', type: 'type.label.sm.emphasis' },
          contracts: [{ fg: 'color.text.info', bg: 'color.foreground.info-subtle', min: TEXT, label: 'label on tint' }] },
      ],
    },
    {
      id: 'typography', label: 'Type specimen', description: 'The reading hierarchy — display, title, body, secondary, and a link.',
      variants: [
        { name: 'display', bindings: { type: 'type.display.lg.strong', text: 'color.text.primary' }, contracts: [{ fg: 'color.text.primary', bg: 'color.background.primary', min: UI, label: 'display (large)' }] },
        { name: 'title', bindings: { type: 'type.title.lg.strong', text: 'color.text.primary' }, contracts: [{ fg: 'color.text.primary', bg: 'color.background.primary', min: TEXT, label: 'title on page' }] },
        { name: 'body', bindings: { type: 'type.body.md.default', text: 'color.text.primary' }, contracts: [{ fg: 'color.text.primary', bg: 'color.background.primary', min: TEXT, label: 'body on page' }] },
        { name: 'secondary', bindings: { type: 'type.body.md.default', text: 'color.text.secondary' }, contracts: [{ fg: 'color.text.secondary', bg: 'color.background.primary', min: TEXT, label: 'secondary on page' }] },
        { name: 'link', bindings: { type: 'type.body.md.default', text: 'color.text.link.default' }, contracts: [{ fg: 'color.text.link.default', bg: 'color.background.primary', min: TEXT, label: 'link on page' }] },
      ],
    },
  ],
};

/** All root-relative token paths the spec references (bindings + contract endpoints),
 *  deduped — the set the binding-validity gate resolves against the token tree. */
export const previewTokenRefs = (spec: PreviewSpec = previewSpec): string[] => {
  const refs = new Set<string>();
  for (const c of spec.components) for (const v of c.variants) {
    for (const t of Object.values(v.bindings)) refs.add(t);
    for (const ct of v.contracts ?? []) { refs.add(ct.fg); refs.add(ct.bg); }
  }
  return [...refs].sort();
};

export const buildPreviewSpec = () => ({
  $schema: 'https://prism3.dev/schema/preview-spec.json',
  description: 'Portable sample-component preview spec (docs/08 §7 B1a). Each element binds UI props to root-relative semantic token paths + the contrast pairs to overlay. The Figma plugin and web playground render the same live preview from it. Kept in sync with the emitted token tree by engine/test.ts (binding-validity gate). Emitted by engine/emit-preview.ts.',
  ...previewSpec,
});
