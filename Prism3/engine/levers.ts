/**
 * Prism3 engine — the LEVER MANIFEST (docs/08 §4).
 *
 * The shared-control contract: a machine-readable description of every `BrandInput`
 * knob — grouped, labelled, typed, ranged, with defaults and enum options — that
 * the Figma plugin, the web playground, and the MCP tool schema all RENDER FROM.
 * One source, so a lever added once appears in every surface and the two visual
 * editors stay in continuity by construction (not a manual sync).
 *
 * This is the PRESENTATION half. `schema/theme-schema.json` is the VALIDATION half
 * (what the engine actually accepts). The two must agree — `test.ts` asserts every
 * lever key resolves in the schema, every enum's options match the schema enum, and
 * every default matches the schema default — so the manifest can never drift from
 * the engine.
 *
 * PURE — no `node:*`, no I/O (the plugin / playground / MCP bundle this into a
 * browser/Figma sandbox, so it must stay Node-free — the same pure-core / I/O-shell
 * split as `theme.ts` vs `nb-fixture.ts`, docs/07 §3). The emit step lives in the
 * shell `emit-levers.ts` (`npx tsx Prism3/engine/emit-levers.ts` → `schema/lever-manifest.json`).
 *
 * `id` and `root` are intentionally NOT levers (see `identityFields`): they are brand
 * *identity* / namespace the host supplies (CLI derives `id` from the file/name, the
 * plugin from the Figma file, an MCP call passes them as arguments; `root` is the
 * per-engagement token namespace, default 'prism') — not design knobs a surface
 * renders in the lever-driven form. The drift gate enforces that every *other*
 * required BrandInput field IS a lever.
 */
export type LeverGroup = 'color' | 'form' | 'type' | 'motion' | 'elevation' | 'layout' | 'advanced';
/** The UI affordance a surface renders for this lever. `object`/`list` denote a
 *  structured sub-input (the surface renders a sub-form); the rest are atomic. */
export type LeverControl = 'color' | 'slider' | 'enum' | 'toggle' | 'list' | 'palette-ref' | 'object' | 'text';

export type Lever = {
  key: string;                          // dot-path into BrandInput (e.g. 'motionPersonality.tempo')
  group: LeverGroup;
  label: string;
  description: string;
  control: LeverControl;
  required?: boolean;                   // a required BrandInput field (no default; must be set)
  advanced?: boolean;                   // hidden behind progressive disclosure by default
  default?: unknown;                    // must equal the schema default where the schema defines one
  // slider (UI bounds — the presentation half; the schema leaves these open):
  min?: number; max?: number; step?: number; unit?: string;
  // enum (values MUST match the schema enum at `key`):
  options?: { value: string | number; label: string }[];
  // list/object (informational item hint):
  itemLabel?: string;
};

const enumOpts = (...pairs: [string | number, string][]): { value: string | number; label: string }[] =>
  pairs.map(([value, label]) => ({ value, label }));

// ---------------------------------------------------------------------------
// The manifest. Ordered by group; `advanced` marks the progressive-disclosure set
// so a surface can show a lean default (primary + form + type/motion basics) and
// reveal the rest on demand.
export const leverManifest: Lever[] = [
  // ---- COLOR ----
  { key: 'primary', group: 'color', label: 'Primary brand colour', control: 'color', required: true,
    description: 'The exact brand anchor. Pinned, never shifted; the engine places it on the ramp by its lightness.' },
  { key: 'neutral.hue', group: 'color', label: 'Neutral hue', control: 'slider', required: true, min: 0, max: 360, step: 1, unit: '°',
    description: 'Hue the greys lean toward (a small chroma tints them to the brand for cohesion).' },
  { key: 'neutral.chroma', group: 'color', label: 'Neutral chroma', control: 'slider', required: true, min: 0, max: 0.03, step: 0.001,
    description: 'Peak neutral chroma (~0.004–0.02); tapers to near-0 at the ramp ends. 0 = pure grey.' },
  { key: 'neutral.anchor', group: 'color', label: 'Pin a neutral', control: 'color', advanced: true,
    description: 'Optional. A pre-defined brand grey, pinned verbatim at its lightness step; the ramp is built around it (hue/chroma from the anchor) instead of the cast. Set for a client that ships their own neutral; omit to derive from hue + chroma.' },
  { key: 'brandColors', group: 'color', label: 'Additional brand colours', control: 'list', itemLabel: 'brand colour (name + OKLCH)',
    description: 'Secondary / tertiary / accents — any number; each becomes its own ramp and can drive actions.' },
  { key: 'actionPalette', group: 'color', label: 'Action palette', control: 'palette-ref', default: 'primary',
    description: 'Which palette drives interactive/action colour. Defaults to primary; point at an accent when the hero colour is a poor CTA.' },
  { key: 'status.success', group: 'color', label: 'Success colour', control: 'color', advanced: true,
    description: 'Optional measured override; omit to let the engine synthesise from a canonical hue.' },
  { key: 'status.warning', group: 'color', label: 'Warning colour', control: 'color', advanced: true,
    description: 'Optional measured override; omit to synthesise.' },
  { key: 'status.danger', group: 'color', label: 'Danger colour', control: 'color', advanced: true,
    description: 'Optional measured override; omit to reuse the brand red (if red) or carve a dedicated one.' },
  { key: 'status.info', group: 'color', label: 'Info colour', control: 'color', advanced: true,
    description: 'Optional measured override; omit to synthesise from the canonical blue hue.' },
  { key: 'surfaces', group: 'color', label: 'Page surfaces', control: 'object', advanced: true,
    description: 'Non-default page surface per mode (e.g. a warm off-white). The contrast floor moves with it.' },

  // ---- FORM ----
  { key: 'radiusScale', group: 'form', label: 'Corner softness', control: 'slider', default: 1, min: 0, max: 2, step: 0.5,
    description: '0 = sharp, 1 = default, 2 = soft. Scales the radius ramp.' },
  { key: 'density', group: 'form', label: 'Density', control: 'enum', default: 'comfortable',
    options: enumOpts(['comfortable', 'Comfortable'], ['compact', 'Compact'], ['spacious', 'Spacious']),
    description: 'Drives component sizes (control height + paired padding). The name stays stable; the metrics shift.' },
  { key: 'baseMd', group: 'form', label: 'Radius anchor', control: 'slider', advanced: true, default: 4, min: 2, max: 12, step: 1, unit: 'px',
    description: 'The radius.md value (px) at scale 1.' },
  { key: 'spaceBase', group: 'form', label: 'Spacing rhythm', control: 'slider', advanced: true, default: 8, min: 4, max: 12, step: 1, unit: 'px',
    description: 'Base of the numbered-multiplier space scale (space.100 = 1×).' },
  { key: 'baseUnit', group: 'form', label: 'Fine grid base', control: 'slider', advanced: true, default: 4, min: 2, max: 8, step: 1, unit: 'px',
    description: 'Fine dimension-grid base backing radius/borders.' },

  // ---- TYPE ----
  { key: 'typography.typeScale', group: 'type', label: 'Type scale', control: 'enum', default: 'default',
    options: enumOpts(['compact', 'Compact'], ['default', 'Default'], ['expressive', 'Expressive']),
    description: 'Shifts heading sizes (display + title) up/down the ladder; body/label/caption stay put.' },
  { key: 'typography.families', group: 'type', label: 'Font families', control: 'object',
    description: 'Display / text / mono faces (+ a variable-font flag). A single name auto-pads a system fallback stack.' },
  { key: 'typography.weightRoles', group: 'type', label: 'Weight roles → numeric', control: 'object', advanced: true,
    description: 'Map subtle/default/emphasis/strong/max to the brand’s numeric weights (defaults 300/400/600/700/900).' },
  { key: 'typography.displayCeiling', group: 'type', label: 'Display size ceiling', control: 'slider', advanced: true, default: 160, min: 48, max: 160, step: 8, unit: 'px',
    description: 'Cap the display tier; brands with no mega heroes stop lower (e.g. 96).' },
  { key: 'typography.titleFloor', group: 'type', label: 'Title floor', control: 'enum', advanced: true, default: 18,
    options: enumOpts([18, '18px (title.xs)'], [16, '16px (adds title.2xs)']),
    description: 'Smallest title size. 16 adds a 16px brand-font heading that overlaps body.md.' },
  { key: 'typography.responsive', group: 'type', label: 'Responsive type', control: 'object', advanced: true,
    description: 'Fluid heading sizing on/off + the min/max viewport pair driving clamp() and the Figma modes.' },
  { key: 'typography.weights', group: 'type', label: 'Per-role weight sets', control: 'object', advanced: true,
    description: 'Which weights each type role ships (weight is an axis on every role; adding one is additive).' },
  { key: 'typography.familyMap', group: 'type', label: 'Role → family map', control: 'object', advanced: true,
    description: 'Which family role each semantic group consumes (e.g. neutral buttons: label → text).' },
  { key: 'typography.links', group: 'type', label: 'Underlined link roles', control: 'list', advanced: true, itemLabel: 'type role',
    description: 'Which roles get an underlined .*-link variant. Default body + caption.' },
  { key: 'typography.italics', group: 'type', label: 'Italic roles', control: 'list', advanced: true, itemLabel: 'type role',
    description: 'Which roles ship an .*-italic variant per weight (fontStyle:italic). Default none — italics are opt-in.' },

  // ---- MOTION ----
  { key: 'motionPersonality.tempo', group: 'motion', label: 'Motion tempo', control: 'enum', default: 'standard',
    options: enumOpts(['snappy', 'Snappy'], ['standard', 'Standard'], ['relaxed', 'Relaxed']),
    description: 'Scales the duration ramp (snappy ×0.8, standard ×1.0, relaxed ×1.3). Reduce-motion is derived.' },
  { key: 'motionPersonality.easingEmphasized', group: 'motion', label: 'Emphasized easing', control: 'list', advanced: true, itemLabel: 'cubic-bezier value',
    description: 'Optional 4-number cubic-bezier override for the expressive easing curve.' },

  // ---- ELEVATION ----
  { key: 'shadow.softness', group: 'elevation', label: 'Shadow softness', control: 'slider', default: 1, min: 0, max: 2, step: 0.1,
    description: 'Blur:offset dial. Low → crisp/product; high → soft/marketing.' },
  { key: 'shadow.tint', group: 'elevation', label: 'Shadow tint', control: 'object', advanced: true,
    description: 'Hue-shift the shadow base off pure black (hue + amount). Defaults to a subtle neutral tint.' },

  // ---- LAYOUT ----
  { key: 'layout.breakpoints', group: 'layout', label: 'Breakpoints', control: 'list', advanced: true, itemLabel: 'min-width (px)',
    description: 'Min-width floors (px), ascending. Names auto sm/md/lg/xl/2xl. Default [0,768,1024,1440,1920].' },
  { key: 'layout.columns', group: 'layout', label: 'Grid columns', control: 'slider', advanced: true, default: 12, min: 4, max: 24, step: 1,
    description: 'Base column count for the design grid (16/24 for dense-data brands).' },
  { key: 'layout.containerMax', group: 'layout', label: 'Container max', control: 'slider', advanced: true, default: 1440, min: 960, max: 1920, step: 40, unit: 'px',
    description: 'Content max-width cap; layout is fluid below it.' },
  { key: 'layout.containerNarrow', group: 'layout', label: 'Narrow container', control: 'slider', advanced: true, default: 720, min: 480, max: 960, step: 20, unit: 'px',
    description: 'Reading-measure container (~65–75ch).' },

  // ---- ADVANCED (accessibility + opt-in) ----
  { key: 'iconContrast', group: 'advanced', label: 'Icon contrast floor', control: 'enum', default: 'text',
    options: enumOpts(['text', 'Match text (4.5:1)'], ['3:1', 'Non-text floor (3:1)']),
    description: 'Whether icons mirror text contrast or run against the WCAG 1.4.11 non-text floor.' },
  { key: 'disabledStrategy', group: 'advanced', label: 'Disabled strategy', control: 'enum', default: 'accessible',
    options: enumOpts(['accessible', 'Accessible (contrast-preserving)'], ['conventional', 'Conventional (sub-AA, exempt)']),
    description: 'Accessible keeps disabled text legible on the floor; conventional uses the field-standard dimmed look.' },
  { key: 'disabledMin', group: 'advanced', label: 'Disabled contrast floor', control: 'slider', default: 3, min: 2, max: 4.5, step: 0.5,
    description: 'Contrast floor for the accessible disabled strategy (escalates to 4.5:1 in high-contrast).' },
  { key: 'outlineInteraction', group: 'advanced', label: 'Outline hover', control: 'enum', default: 'overlay-neutral',
    options: enumOpts(['overlay-neutral', 'Neutral overlay wash'], ['solid-tint', 'Opaque subtle tint'], ['none', 'No hover expression']),
    description: 'How outline/text controls express hover/pressed/selected. Overlay = translucent neutral wash (composites over any surface); solid-tint = opaque foreground.<color>-subtle; none = omit.' },
  { key: 'neutralEmphasis', group: 'advanced', label: 'Neutral emphasis', control: 'enum', default: 'subtle',
    options: enumOpts(['subtle', 'Subtle (light grey)'], ['strong', 'Strong (bold near-black/white)']),
    description: 'The neutral interactive fill boldness — subtle light grey (a surface) or a strong near-black/near-white fill.' },
  { key: 'inverse', group: 'advanced', label: 'Inverse surface-context', control: 'toggle', default: true,
    description: 'Generate interactive.<color>.on-inverse inks for controls on a dark hero / inverse section (a light CTA on dark).' },
  { key: 'accentPalette', group: 'color', label: 'Accent interactive colour', control: 'palette-ref', advanced: true,
    description: 'Opt-in — names a declared brand palette to get a full interactive.accent.* column. Must differ from the action palette; omit for no accent.' },
  { key: 'gradients', group: 'advanced', label: 'Gradients', control: 'toggle', default: false,
    description: 'Opt-in (off by default). On ships one default brand gradient; an explicit array ships specific ones.' },
];

/** Group order + human labels for a surface's section layout. */
export const leverGroups: { group: LeverGroup; label: string }[] = [
  { group: 'color', label: 'Colour' },
  { group: 'form', label: 'Form factor' },
  { group: 'type', label: 'Typography' },
  { group: 'motion', label: 'Motion' },
  { group: 'elevation', label: 'Elevation' },
  { group: 'layout', label: 'Layout' },
  { group: 'advanced', label: 'Advanced' },
];

/** Required `BrandInput` fields that are brand *identity*, not design levers — the
 *  host supplies them, so they are deliberately absent from the manifest. The drift
 *  gate subtracts these before asserting every required field is a lever, so the
 *  omission is explicit and a *new* required field (or a dropped `primary`/`neutral`)
 *  is still caught. */
export const identityFields = ['id', 'root'] as const;

export const buildLeverManifest = () => ({
  $schema: 'https://prism3.dev/schema/lever-manifest.json',
  description: 'Presentation contract for the BrandInput controls (labels/groups/UI ranges/knob types). Rendered by the Figma plugin, the web playground, and the MCP tool schema. Kept in sync with theme-schema.json by engine/test.ts. Emitted by engine/emit-levers.ts. Note: brand `id` is host-supplied identity, not a lever.',
  groups: leverGroups,
  levers: leverManifest,
});
