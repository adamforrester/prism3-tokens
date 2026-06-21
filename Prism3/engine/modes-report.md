# Prism3 modes & scales — generated mappings, contrast contracts, dimension axis

# Theme: nb (nbds.* / rgb)

- NB regression: measured anchors; brand red also serves as danger (NB brand hue is its danger hue).
- dimension axis: 4px grid, 8px space rhythm (Prism2 numbered scale), comfortable density, radius scale 1 (baseMd 4px).

Palettes: red, green, amber, neutral. Danger draws from `red`.

## nb — colour mode: light

| role | → step | contrast | floor | result |
|---|---|---|---|---|
| text.primary | neutral.950 | 19.44 | 7 | ✅ |
| text.secondary | neutral.550 | 4.52 | 4.5 | ✅ |
| text.inverse | neutral.025 | 19.57 | 4.5 | ✅ |
| surface.default | white | — | — | · |
| surface.sunken | neutral.050 | — | — | · |
| border.default | neutral.100 | — | — | · |
| border.strong | neutral.400 | — | — | · |
| action.primary | red.550 | 4.62 | 4.5 | ✅ |
| status.success | green.550 | 4.84 | 4.5 | ✅ |
| status.warning | amber.600 | 5.46 | 4.5 | ✅ |
| status.danger | red.550 | 4.62 | 4.5 | ✅ |

## nb — colour mode: dark

| role | → step | contrast | floor | result |
|---|---|---|---|---|
| text.primary | neutral.025 | 18.11 | 7 | ✅ |
| text.secondary | neutral.450 | 4.68 | 4.5 | ✅ |
| text.inverse | neutral.950 | 19.44 | 4.5 | ✅ |
| surface.default | neutral.950 | — | — | · |
| surface.sunken | black | — | — | · |
| border.default | neutral.750 | — | — | · |
| border.strong | neutral.500 | — | — | · |
| action.primary | red.450 | 4.66 | 4.5 | ✅ |
| status.success | green.400 | 5.17 | 4.5 | ✅ |
| status.warning | amber.450 | 4.74 | 4.5 | ✅ |
| status.danger | red.450 | 4.66 | 4.5 | ✅ |

## nb — colour mode: hc-light

| role | → step | contrast | floor | result |
|---|---|---|---|---|
| text.primary | black | 21.00 | 15 | ✅ |
| text.secondary | neutral.700 | 8.09 | 7 | ✅ |
| text.inverse | white | 21.00 | 7 | ✅ |
| surface.default | white | — | — | · |
| surface.sunken | neutral.050 | — | — | · |
| border.default | neutral.500 | — | — | · |
| border.strong | neutral.700 | — | — | · |
| action.primary | red.700 | 8.25 | 7 | ✅ |
| status.success | green.700 | 8.28 | 7 | ✅ |
| status.warning | amber.700 | 8.05 | 7 | ✅ |
| status.danger | red.700 | 8.25 | 7 | ✅ |

## nb — colour mode: hc-dark

| role | → step | contrast | floor | result |
|---|---|---|---|---|
| text.primary | white | 21.00 | 15 | ✅ |
| text.secondary | neutral.300 | 7.49 | 7 | ✅ |
| text.inverse | black | 21.00 | 7 | ✅ |
| surface.default | black | — | — | · |
| surface.sunken | neutral.900 | — | — | · |
| border.default | neutral.500 | — | — | · |
| border.strong | neutral.250 | — | — | · |
| action.primary | red.300 | 7.50 | 7 | ✅ |
| status.success | green.300 | 7.19 | 7 | ✅ |
| status.warning | amber.300 | 7.57 | 7 | ✅ |
| status.danger | red.300 | 7.50 | 7 | ✅ |

## nb — dimension axis

Grid (37 primitives, px): 0, 1, 2, 4, 6, 8, 12, 16, 20, 24, 28, 32, 36, 40, 44, 48, 52, 56, 60, 64, 68, 72, 76, 80, 84, 88, 92, 96, 100, 104, 108, 112, 116, 120, 124, 128, 720

Space — numbered multiplier, `8px` rhythm (reference tier, density-free):

| token | px | × base |
|---|---|---|
| space.0 | 0 | 0× |
| space.025 | 2 | 0.25× |
| space.050 | 4 | 0.5× |
| space.075 | 6 | 0.75× |
| space.100 | 8 | 1× |
| space.200 | 16 | 2× |
| space.300 | 24 | 3× |
| space.400 | 32 | 4× |
| space.500 | 40 | 5× |
| space.600 | 48 | 6× |
| space.700 | 56 | 7× |
| space.800 | 64 | 8× |
| space.900 | 72 | 9× |
| space.1000 | 80 | 10× |
| space.1100 | 88 | 11× |
| space.1200 | 96 | 12× |

Radius — scale `1`:

| token | px |
|---|---|
| radius.none | 0 |
| radius.sm | 2 |
| radius.md | 4 |
| radius.lg | 6 |
| radius.round | 128 (pill) |

Component sizes — t-shirt, density `comfortable` (height + paired padding from the shared scales):

| size | height | padding-x | padding-y |
|---|---|---|---|
| size.xs | 32px | 8px | 4px |
| size.sm | 40px | 16px | 6px |
| size.md | 48px | 16px | 8px |
| size.lg | 56px | 24px | 8px |
| size.xl | 64px | 24px | 16px |

# Theme: aurora (prism.* / hex)

- primary anchor (h285) pinned exactly at step 550
- brand colour 'accent' (h235) added
- success: engine default hue 145
- warning: engine default hue 75
- action colour is decoupled: uses palette 'accent', NOT the primary brand palette — explicit brand decision
- danger: primary hue 285 is NOT red → carved a dedicated danger red at hue 27
- dimension axis: 4px grid, 8px space rhythm, density 'compact' (drives component sizes), radius scale 2 (baseMd 4px)
- light primary surface is NON-default (neutral.50) — CONFIRM this is the page colour; the contrast floor moves with it

Palettes: primary, neutral, accent, success, warning, danger. Danger draws from `danger`.

## aurora — colour mode: light

| role | → step | contrast | floor | result |
|---|---|---|---|---|
| text.primary | neutral.950 | 16.01 | 7 | ✅ |
| text.secondary | neutral.600 | 4.81 | 4.5 | ✅ |
| text.inverse | neutral.025 | 19.60 | 4.5 | ✅ |
| surface.default | neutral.050 | — | — | · |
| surface.sunken | neutral.100 | — | — | · |
| border.default | neutral.200 | — | — | · |
| border.strong | neutral.450 | — | — | · |
| action.primary | accent.600 | 4.95 | 4.5 | ✅ |
| status.success | success.600 | 4.82 | 4.5 | ✅ |
| status.warning | warning.600 | 4.86 | 4.5 | ✅ |
| status.danger | danger.600 | 4.89 | 4.5 | ✅ |

## aurora — colour mode: dark

| role | → step | contrast | floor | result |
|---|---|---|---|---|
| text.primary | neutral.025 | 18.13 | 7 | ✅ |
| text.secondary | neutral.450 | 4.66 | 4.5 | ✅ |
| text.inverse | neutral.950 | 19.43 | 4.5 | ✅ |
| surface.default | neutral.950 | — | — | · |
| surface.sunken | black | — | — | · |
| border.default | neutral.750 | — | — | · |
| border.strong | neutral.500 | — | — | · |
| action.primary | accent.400 | 5.34 | 4.5 | ✅ |
| status.success | success.450 | 4.68 | 4.5 | ✅ |
| status.warning | warning.450 | 4.60 | 4.5 | ✅ |
| status.danger | danger.450 | 4.56 | 4.5 | ✅ |

## aurora — colour mode: hc-light

| role | → step | contrast | floor | result |
|---|---|---|---|---|
| text.primary | black | 21.00 | 15 | ✅ |
| text.secondary | neutral.700 | 7.12 | 7 | ✅ |
| text.inverse | white | 21.00 | 7 | ✅ |
| surface.default | white | — | — | · |
| surface.sunken | neutral.100 | — | — | · |
| border.default | neutral.500 | — | — | · |
| border.strong | neutral.700 | — | — | · |
| action.primary | accent.700 | 7.26 | 7 | ✅ |
| status.success | success.700 | 7.04 | 7 | ✅ |
| status.warning | warning.700 | 7.12 | 7 | ✅ |
| status.danger | danger.700 | 7.22 | 7 | ✅ |

## aurora — colour mode: hc-dark

| role | → step | contrast | floor | result |
|---|---|---|---|---|
| text.primary | white | 21.00 | 15 | ✅ |
| text.secondary | neutral.300 | 7.46 | 7 | ✅ |
| text.inverse | black | 21.00 | 7 | ✅ |
| surface.default | black | — | — | · |
| surface.sunken | neutral.900 | — | — | · |
| border.default | neutral.500 | — | — | · |
| border.strong | neutral.250 | — | — | · |
| action.primary | accent.300 | 7.32 | 7 | ✅ |
| status.success | success.300 | 7.65 | 7 | ✅ |
| status.warning | warning.300 | 7.33 | 7 | ✅ |
| status.danger | danger.300 | 7.42 | 7 | ✅ |

## aurora — dimension axis

Grid (36 primitives, px): 0, 1, 2, 4, 6, 8, 12, 16, 20, 24, 28, 32, 36, 40, 44, 48, 52, 56, 60, 64, 68, 72, 76, 80, 84, 88, 92, 96, 100, 104, 108, 112, 116, 120, 124, 128

Space — numbered multiplier, `8px` rhythm (reference tier, density-free):

| token | px | × base |
|---|---|---|
| space.0 | 0 | 0× |
| space.025 | 2 | 0.25× |
| space.050 | 4 | 0.5× |
| space.075 | 6 | 0.75× |
| space.100 | 8 | 1× |
| space.200 | 16 | 2× |
| space.300 | 24 | 3× |
| space.400 | 32 | 4× |
| space.500 | 40 | 5× |
| space.600 | 48 | 6× |
| space.700 | 56 | 7× |
| space.800 | 64 | 8× |
| space.900 | 72 | 9× |
| space.1000 | 80 | 10× |
| space.1100 | 88 | 11× |
| space.1200 | 96 | 12× |

Radius — scale `2`:

| token | px |
|---|---|
| radius.none | 0 |
| radius.sm | 4 |
| radius.md | 8 |
| radius.lg | 12 |
| radius.round | 128 (pill) |

Component sizes — t-shirt, density `compact` (height + paired padding from the shared scales):

| size | height | padding-x | padding-y |
|---|---|---|---|
| size.xs | 32px | 8px | 4px |
| size.sm | 32px | 8px | 4px |
| size.md | 40px | 16px | 6px |
| size.lg | 48px | 16px | 8px |
| size.xl | 56px | 24px | 8px |

