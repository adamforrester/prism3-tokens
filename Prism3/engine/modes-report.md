# Prism3 modes & scales — generated mappings, contrast contracts, dimension axis

# Theme: nb (nbds.* / rgb)

- NB regression: measured anchors; brand red also serves as danger (NB brand hue is its danger hue).
- dimension axis: 4px grid, comfortable density, radius scale 1 (baseMd 4px).

Palettes: red, green, amber, neutral. Danger draws from `red`.

## nb — colour mode: light

| role | → step | contrast | floor | result |
|---|---|---|---|---|
| text.primary | neutral.950 | 19.44 | 7 | ✅ |
| text.secondary | neutral.500 | 4.59 | 4.5 | ✅ |
| text.inverse | neutral.025 | 19.57 | 4.5 | ✅ |
| surface.default | white | — | — | · |
| surface.sunken | neutral.050 | — | — | · |
| border.default | neutral.100 | — | — | · |
| border.strong | neutral.400 | — | — | · |
| action.primary | red.550 | 5.62 | 4.5 | ✅ |
| status.success | green.500 | 4.89 | 4.5 | ✅ |
| status.warning | amber.500 | 4.50 | 4.5 | ✅ |
| status.danger | red.550 | 5.62 | 4.5 | ✅ |

## nb — colour mode: dark

| role | → step | contrast | floor | result |
|---|---|---|---|---|
| text.primary | neutral.025 | 18.11 | 7 | ✅ |
| text.secondary | neutral.450 | 5.06 | 4.5 | ✅ |
| text.inverse | neutral.950 | 19.44 | 4.5 | ✅ |
| surface.default | neutral.950 | — | — | · |
| surface.sunken | black | — | — | · |
| border.default | neutral.750 | — | — | · |
| border.strong | neutral.500 | — | — | · |
| action.primary | red.450 | 5.05 | 4.5 | ✅ |
| status.success | green.450 | 4.73 | 4.5 | ✅ |
| status.warning | amber.450 | 5.13 | 4.5 | ✅ |
| status.danger | red.450 | 5.05 | 4.5 | ✅ |

## nb — colour mode: hc-light

| role | → step | contrast | floor | result |
|---|---|---|---|---|
| text.primary | black | 21.00 | 15 | ✅ |
| text.secondary | neutral.650 | 8.15 | 7 | ✅ |
| text.inverse | white | 21.00 | 7 | ✅ |
| surface.default | white | — | — | · |
| surface.sunken | neutral.050 | — | — | · |
| border.default | neutral.500 | — | — | · |
| border.strong | neutral.700 | — | — | · |
| action.primary | red.650 | 8.29 | 7 | ✅ |
| status.success | green.600 | 7.03 | 7 | ✅ |
| status.warning | amber.650 | 8.08 | 7 | ✅ |
| status.danger | red.650 | 8.29 | 7 | ✅ |

## nb — colour mode: hc-dark

| role | → step | contrast | floor | result |
|---|---|---|---|---|
| text.primary | white | 21.00 | 15 | ✅ |
| text.secondary | neutral.350 | 7.49 | 7 | ✅ |
| text.inverse | black | 21.00 | 7 | ✅ |
| surface.default | black | — | — | · |
| surface.sunken | neutral.950 | — | — | · |
| border.default | neutral.500 | — | — | · |
| border.strong | neutral.250 | — | — | · |
| action.primary | red.350 | 7.52 | 7 | ✅ |
| status.success | green.350 | 7.19 | 7 | ✅ |
| status.warning | amber.350 | 7.61 | 7 | ✅ |
| status.danger | red.350 | 7.52 | 7 | ✅ |

## nb — dimension axis

Grid (37 primitives, px): 0, 1, 2, 4, 6, 8, 12, 16, 20, 24, 28, 32, 36, 40, 44, 48, 52, 56, 60, 64, 68, 72, 76, 80, 84, 88, 92, 96, 100, 104, 108, 112, 116, 120, 124, 128, 720

Space — density `comfortable`:

| token | px | × base |
|---|---|---|
| space.4xs | 4 | 1 |
| space.3xs | 8 | 2 |
| space.2xs | 12 | 3 |
| space.xs | 16 | 4 |
| space.sm | 24 | 6 |
| space.md | 32 | 8 |
| space.lg | 48 | 12 |
| space.xl | 64 | 16 |
| space.2xl | 96 | 24 |
| space.3xl | 128 | 32 |

Radius — scale `1`:

| token | px |
|---|---|
| radius.none | 0 |
| radius.sm | 2 |
| radius.md | 4 |
| radius.lg | 6 |
| radius.round | 128 (pill) |

# Theme: aurora (prism.* / hex)

- primary anchor (h285) pinned exactly at step 550
- success: engine default hue 145
- warning: engine default hue 75
- danger: primary hue 285 is NOT red → carved a dedicated danger red at hue 27
- dimension axis: 4px grid, density 'compact', radius scale 2 (baseMd 4px)

Palettes: primary, neutral, success, warning, danger. Danger draws from `danger`.

## aurora — colour mode: light

| role | → step | contrast | floor | result |
|---|---|---|---|---|
| text.primary | neutral.950 | 19.43 | 7 | ✅ |
| text.secondary | neutral.500 | 4.54 | 4.5 | ✅ |
| text.inverse | neutral.025 | 19.60 | 4.5 | ✅ |
| surface.default | white | — | — | · |
| surface.sunken | neutral.050 | — | — | · |
| border.default | neutral.100 | — | — | · |
| border.strong | neutral.400 | — | — | · |
| action.primary | primary.550 | 6.42 | 4.5 | ✅ |
| status.success | success.500 | 4.59 | 4.5 | ✅ |
| status.warning | warning.500 | 4.59 | 4.5 | ✅ |
| status.danger | danger.500 | 4.56 | 4.5 | ✅ |

## aurora — colour mode: dark

| role | → step | contrast | floor | result |
|---|---|---|---|---|
| text.primary | neutral.025 | 18.13 | 7 | ✅ |
| text.secondary | neutral.450 | 5.06 | 4.5 | ✅ |
| text.inverse | neutral.950 | 19.43 | 4.5 | ✅ |
| surface.default | neutral.950 | — | — | · |
| surface.sunken | black | — | — | · |
| border.default | neutral.750 | — | — | · |
| border.strong | neutral.500 | — | — | · |
| action.primary | primary.450 | 5.00 | 4.5 | ✅ |
| status.success | success.450 | 5.07 | 4.5 | ✅ |
| status.warning | warning.450 | 4.99 | 4.5 | ✅ |
| status.danger | danger.450 | 4.95 | 4.5 | ✅ |

## aurora — colour mode: hc-light

| role | → step | contrast | floor | result |
|---|---|---|---|---|
| text.primary | black | 21.00 | 15 | ✅ |
| text.secondary | neutral.650 | 8.14 | 7 | ✅ |
| text.inverse | white | 21.00 | 7 | ✅ |
| surface.default | white | — | — | · |
| surface.sunken | neutral.050 | — | — | · |
| border.default | neutral.500 | — | — | · |
| border.strong | neutral.700 | — | — | · |
| action.primary | primary.600 | 7.68 | 7 | ✅ |
| status.success | success.650 | 8.05 | 7 | ✅ |
| status.warning | warning.650 | 8.15 | 7 | ✅ |
| status.danger | danger.650 | 8.22 | 7 | ✅ |

## aurora — colour mode: hc-dark

| role | → step | contrast | floor | result |
|---|---|---|---|---|
| text.primary | white | 21.00 | 15 | ✅ |
| text.secondary | neutral.350 | 7.49 | 7 | ✅ |
| text.inverse | black | 21.00 | 7 | ✅ |
| surface.default | black | — | — | · |
| surface.sunken | neutral.950 | — | — | · |
| border.default | neutral.500 | — | — | · |
| border.strong | neutral.250 | — | — | · |
| action.primary | primary.350 | 7.50 | 7 | ✅ |
| status.success | success.350 | 7.67 | 7 | ✅ |
| status.warning | warning.350 | 7.40 | 7 | ✅ |
| status.danger | danger.350 | 7.44 | 7 | ✅ |

## aurora — dimension axis

Grid (36 primitives, px): 0, 1, 2, 4, 6, 8, 12, 16, 20, 24, 28, 32, 36, 40, 44, 48, 52, 56, 60, 64, 68, 72, 76, 80, 84, 88, 92, 96, 100, 104, 108, 112, 116, 120, 124, 128

Space — density `compact`:

| token | px | × base |
|---|---|---|
| space.4xs | 2 | 0.5 |
| space.3xs | 6 | 1.5 |
| space.2xs | 8 | 2 |
| space.xs | 12 | 3 |
| space.sm | 20 | 5 |
| space.md | 28 | 7 |
| space.lg | 44 | 11 |
| space.xl | 60 | 15 |
| space.2xl | 92 | 23 |
| space.3xl | 124 | 31 |

Radius — scale `2`:

| token | px |
|---|---|
| radius.none | 0 |
| radius.sm | 4 |
| radius.md | 8 |
| radius.lg | 12 |
| radius.round | 128 (pill) |

