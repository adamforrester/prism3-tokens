# Prism3 modes — generated semantic mappings & contrast contracts

Roles are resolved by contrast target against each mode's surface (see `modes.ts`). Primitives are shared; only the role→step mapping changes per mode.

## light

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

## dark

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

## hc-light

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

## hc-dark

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

**Contrast contracts across modes: 28/28 pass.**
