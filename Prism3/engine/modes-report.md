# Prism3 modes — generated semantic mappings & contrast contracts

# Theme: nb (nbds.color / rgb)

- NB regression: measured anchors; brand red also serves as danger (NB brand hue is its danger hue).

Palettes: red, green, amber, neutral. Danger draws from `red`.

## nb — light

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

## nb — dark

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

## nb — hc-light

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

## nb — hc-dark

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

# Theme: aurora (prism.color / hex)

- primary anchor (h285) pinned exactly at step 550
- success: engine default hue 145
- warning: engine default hue 75
- danger: primary hue 285 is NOT red → carved a dedicated danger red at hue 27

Palettes: primary, neutral, success, warning, danger. Danger draws from `danger`.

## aurora — light

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

## aurora — dark

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

## aurora — hc-light

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

## aurora — hc-dark

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

