# Prism3 modes & scales — generated mappings, contrast contracts, dimension axis

# Theme: nb (nbds.* / rgb)

- NB regression: measured anchors; brand red also serves as danger (NB brand hue is its danger hue).
- dimension axis: 4px grid, 8px space rhythm (Prism2 numbered scale), comfortable density, radius scale 1 (baseMd 4px).
- typography: curated rem size ladder (22 steps, 10–160px) reproducing the Prism2 reference scale; weight roles subtle/default/emphasis/strong → 300/400/600/700.
- shadow: 6-step ramp + inset, 2-layer, pure-black (NB dialect); mode-aware lift-primary (reduced in dark, NOT NB's heavier inverse — the field-correct choice).
- layout: 5 breakpoints (engine default) + 12-col grid (4/8/12 ladder) + container max 1920 / narrow 720 (NB caps); gutter/margin alias the spacing scale.

Palettes: red, green, amber, neutral, info. Danger draws from `red`.

## nb — colour mode: light

| role | → step | contrast | floor | result |
|---|---|---|---|---|
| background.primary | white | — | — | · |
| background.secondary | neutral.050 | — | — | · |
| background.tertiary | neutral.100 | — | — | · |
| background.inverse.primary | black | — | — | · |
| background.inverse.secondary | neutral.950 | — | — | · |
| background.inverse.tertiary | neutral.900 | — | — | · |
| scrim.default | black-alpha.40 | — | — | · |
| foreground.primary | neutral.050 | — | — | · |
| foreground.secondary | neutral.100 | — | — | · |
| foreground.tertiary | neutral.150 | — | — | · |
| foreground.inverse.primary | neutral.950 | — | — | · |
| foreground.inverse.secondary | neutral.900 | — | — | · |
| foreground.inverse.tertiary | neutral.850 | — | — | · |
| foreground.brand | red.550 | 4.62 | 4.5 | ✅ |
| foreground.success | green.550 | 4.84 | 4.5 | ✅ |
| foreground.warning | amber.600 | 5.46 | 4.5 | ✅ |
| foreground.info | info.550 | 4.56 | 4.5 | ✅ |
| foreground.brand-subtle | red.100 | — | — | · |
| foreground.success-subtle | green.100 | — | — | · |
| foreground.warning-subtle | amber.100 | — | — | · |
| foreground.danger-subtle | red.100 | — | — | · |
| foreground.info-subtle | info.100 | — | — | · |
| foreground.danger.default | red.550 | 4.62 | 4.5 | ✅ |
| foreground.danger.hover | red.600 | 5.64 | 4.5 | ✅ |
| foreground.danger.pressed | red.650 | 6.82 | 4.5 | ✅ |
| foreground.danger.focused | red.600 | 5.64 | 4.5 | ✅ |
| foreground.danger.selected | red.650 | 6.82 | 4.5 | ✅ |
| foreground.danger.disabled | neutral.200 | — | — | · |
| action.default | red.550 | 4.62 | 4.5 | ✅ |
| action.hover | red.600 | 5.64 | 4.5 | ✅ |
| action.pressed | red.650 | 6.82 | 4.5 | ✅ |
| action.focused | red.600 | 5.64 | 4.5 | ✅ |
| action.selected | red.650 | 6.82 | 4.5 | ✅ |
| action.disabled | neutral.200 | — | — | · |
| text.primary | neutral.950 | 19.44 | 7 | ✅ |
| text.secondary | neutral.550 | 4.52 | 4.5 | ✅ |
| text.tertiary | neutral.450 | 3.16 | 3 | ✅ |
| text.disabled | neutral.450 | 3.16 | 3 | ✅ |
| text.brand | red.550 | 4.62 | 4.5 | ✅ |
| text.success | green.550 | 4.84 | 4.5 | ✅ |
| text.warning | amber.600 | 5.46 | 4.5 | ✅ |
| text.danger | red.550 | 4.62 | 4.5 | ✅ |
| text.info | info.550 | 4.56 | 4.5 | ✅ |
| text.brand-subtle | red.450 | — | — | · |
| text.success-subtle | green.450 | — | — | · |
| text.warning-subtle | amber.450 | — | — | · |
| text.danger-subtle | red.450 | — | — | · |
| text.info-subtle | info.450 | — | — | · |
| text.on-action | white | 5.62 | 4.5 | ✅ |
| text.on-brand | white | 5.62 | 4.5 | ✅ |
| text.on-success | white | 5.89 | 4.5 | ✅ |
| text.on-warning | white | 6.63 | 4.5 | ✅ |
| text.on-danger | white | 5.62 | 4.5 | ✅ |
| text.on-info | white | 5.54 | 4.5 | ✅ |
| text.on-inverse | neutral.025 | 19.57 | 4.5 | ✅ |
| text.link.default | red.550 | 4.62 | 4.5 | ✅ |
| text.link.hover | red.600 | 5.64 | 4.5 | ✅ |
| text.link.visited | red.650 | 6.82 | 4.5 | ✅ |
| text.link.focused | red.550 | 4.62 | 4.5 | ✅ |
| icon.primary | neutral.950 | 19.44 | 7 | ✅ |
| icon.secondary | neutral.550 | 4.52 | 4.5 | ✅ |
| icon.tertiary | neutral.450 | 3.16 | 3 | ✅ |
| icon.disabled | neutral.450 | 3.16 | 3 | ✅ |
| icon.brand | red.550 | 4.62 | 4.5 | ✅ |
| icon.success | green.550 | 4.84 | 4.5 | ✅ |
| icon.warning | amber.600 | 5.46 | 4.5 | ✅ |
| icon.danger | red.550 | 4.62 | 4.5 | ✅ |
| icon.info | info.550 | 4.56 | 4.5 | ✅ |
| icon.brand-subtle | red.450 | — | — | · |
| icon.success-subtle | green.450 | — | — | · |
| icon.warning-subtle | amber.450 | — | — | · |
| icon.danger-subtle | red.450 | — | — | · |
| icon.info-subtle | info.450 | — | — | · |
| icon.on-action | white | 5.62 | 4.5 | ✅ |
| icon.on-brand | white | 5.62 | 4.5 | ✅ |
| icon.on-success | white | 5.89 | 4.5 | ✅ |
| icon.on-warning | white | 6.63 | 4.5 | ✅ |
| icon.on-danger | white | 5.62 | 4.5 | ✅ |
| icon.on-info | white | 5.54 | 4.5 | ✅ |
| icon.on-inverse | neutral.025 | 19.57 | 4.5 | ✅ |
| icon.link.default | red.550 | 4.62 | 4.5 | ✅ |
| icon.link.hover | red.600 | 5.64 | 4.5 | ✅ |
| icon.link.visited | red.650 | 6.82 | 4.5 | ✅ |
| icon.link.focused | red.550 | 4.62 | 4.5 | ✅ |
| border.primary | neutral.100 | — | — | · |
| border.secondary | neutral.400 | — | — | · |
| border.inverse | neutral.850 | — | — | · |
| border.brand | red.500 | 4.58 | 3 | ✅ |
| border.success | green.500 | 4.89 | 3 | ✅ |
| border.warning | amber.500 | 4.50 | 3 | ✅ |
| border.danger | red.500 | 4.58 | 3 | ✅ |
| border.info | info.500 | 4.56 | 3 | ✅ |
| border.focus | red.550 | 5.62 | 3 | ✅ |

## nb — colour mode: dark

| role | → step | contrast | floor | result |
|---|---|---|---|---|
| background.primary | neutral.950 | — | — | · |
| background.secondary | neutral.900 | — | — | · |
| background.tertiary | neutral.850 | — | — | · |
| background.inverse.primary | white | — | — | · |
| background.inverse.secondary | neutral.050 | — | — | · |
| background.inverse.tertiary | neutral.100 | — | — | · |
| scrim.default | black-alpha.60 | — | — | · |
| foreground.primary | neutral.900 | — | — | · |
| foreground.secondary | neutral.850 | — | — | · |
| foreground.tertiary | neutral.800 | — | — | · |
| foreground.inverse.primary | neutral.050 | — | — | · |
| foreground.inverse.secondary | neutral.100 | — | — | · |
| foreground.inverse.tertiary | neutral.150 | — | — | · |
| foreground.brand | red.450 | 4.66 | 4.5 | ✅ |
| foreground.success | green.400 | 5.17 | 4.5 | ✅ |
| foreground.warning | amber.450 | 4.74 | 4.5 | ✅ |
| foreground.info | info.450 | 4.65 | 4.5 | ✅ |
| foreground.brand-subtle | red.900 | — | — | · |
| foreground.success-subtle | green.900 | — | — | · |
| foreground.warning-subtle | amber.900 | — | — | · |
| foreground.danger-subtle | red.900 | — | — | · |
| foreground.info-subtle | info.900 | — | — | · |
| foreground.danger.default | red.450 | 4.66 | 4.5 | ✅ |
| foreground.danger.hover | red.400 | 5.52 | 4.5 | ✅ |
| foreground.danger.pressed | red.350 | 6.44 | 4.5 | ✅ |
| foreground.danger.focused | red.400 | 5.52 | 4.5 | ✅ |
| foreground.danger.selected | red.350 | 6.44 | 4.5 | ✅ |
| foreground.danger.disabled | neutral.750 | — | — | · |
| action.default | red.450 | 4.66 | 4.5 | ✅ |
| action.hover | red.400 | 5.52 | 4.5 | ✅ |
| action.pressed | red.350 | 6.44 | 4.5 | ✅ |
| action.focused | red.400 | 5.52 | 4.5 | ✅ |
| action.selected | red.350 | 6.44 | 4.5 | ✅ |
| action.disabled | neutral.750 | — | — | · |
| text.primary | neutral.025 | 18.11 | 7 | ✅ |
| text.secondary | neutral.450 | 4.68 | 4.5 | ✅ |
| text.tertiary | neutral.550 | 3.27 | 3 | ✅ |
| text.disabled | neutral.550 | 3.27 | 3 | ✅ |
| text.brand | red.450 | 4.66 | 4.5 | ✅ |
| text.success | green.400 | 5.17 | 4.5 | ✅ |
| text.warning | amber.450 | 4.74 | 4.5 | ✅ |
| text.danger | red.450 | 4.66 | 4.5 | ✅ |
| text.info | info.450 | 4.65 | 4.5 | ✅ |
| text.brand-subtle | red.350 | — | — | · |
| text.success-subtle | green.350 | — | — | · |
| text.warning-subtle | amber.350 | — | — | · |
| text.danger-subtle | red.350 | — | — | · |
| text.info-subtle | info.350 | — | — | · |
| text.on-action | black | 5.45 | 4.5 | ✅ |
| text.on-brand | black | 5.45 | 4.5 | ✅ |
| text.on-success | black | 6.05 | 4.5 | ✅ |
| text.on-warning | black | 5.54 | 4.5 | ✅ |
| text.on-danger | black | 5.45 | 4.5 | ✅ |
| text.on-info | black | 5.43 | 4.5 | ✅ |
| text.on-inverse | neutral.950 | 19.44 | 4.5 | ✅ |
| text.link.default | red.450 | 4.66 | 4.5 | ✅ |
| text.link.hover | red.400 | 5.52 | 4.5 | ✅ |
| text.link.visited | red.350 | 6.44 | 4.5 | ✅ |
| text.link.focused | red.450 | 4.66 | 4.5 | ✅ |
| icon.primary | neutral.025 | 18.11 | 7 | ✅ |
| icon.secondary | neutral.450 | 4.68 | 4.5 | ✅ |
| icon.tertiary | neutral.550 | 3.27 | 3 | ✅ |
| icon.disabled | neutral.550 | 3.27 | 3 | ✅ |
| icon.brand | red.450 | 4.66 | 4.5 | ✅ |
| icon.success | green.400 | 5.17 | 4.5 | ✅ |
| icon.warning | amber.450 | 4.74 | 4.5 | ✅ |
| icon.danger | red.450 | 4.66 | 4.5 | ✅ |
| icon.info | info.450 | 4.65 | 4.5 | ✅ |
| icon.brand-subtle | red.350 | — | — | · |
| icon.success-subtle | green.350 | — | — | · |
| icon.warning-subtle | amber.350 | — | — | · |
| icon.danger-subtle | red.350 | — | — | · |
| icon.info-subtle | info.350 | — | — | · |
| icon.on-action | black | 5.45 | 4.5 | ✅ |
| icon.on-brand | black | 5.45 | 4.5 | ✅ |
| icon.on-success | black | 6.05 | 4.5 | ✅ |
| icon.on-warning | black | 5.54 | 4.5 | ✅ |
| icon.on-danger | black | 5.45 | 4.5 | ✅ |
| icon.on-info | black | 5.43 | 4.5 | ✅ |
| icon.on-inverse | neutral.950 | 19.44 | 4.5 | ✅ |
| icon.link.default | red.450 | 4.66 | 4.5 | ✅ |
| icon.link.hover | red.400 | 5.52 | 4.5 | ✅ |
| icon.link.visited | red.350 | 6.44 | 4.5 | ✅ |
| icon.link.focused | red.450 | 4.66 | 4.5 | ✅ |
| border.primary | neutral.750 | — | — | · |
| border.secondary | neutral.500 | — | — | · |
| border.inverse | neutral.200 | — | — | · |
| border.brand | red.500 | 4.24 | 3 | ✅ |
| border.success | green.500 | 3.97 | 3 | ✅ |
| border.warning | amber.500 | 4.32 | 3 | ✅ |
| border.danger | red.500 | 4.24 | 3 | ✅ |
| border.info | info.500 | 4.27 | 3 | ✅ |
| border.focus | red.450 | 5.05 | 3 | ✅ |

## nb — colour mode: hc-light

| role | → step | contrast | floor | result |
|---|---|---|---|---|
| background.primary | white | — | — | · |
| background.secondary | white | — | — | · |
| background.tertiary | white | — | — | · |
| background.inverse.primary | black | — | — | · |
| background.inverse.secondary | black | — | — | · |
| background.inverse.tertiary | black | — | — | · |
| scrim.default | black-alpha.60 | — | — | · |
| foreground.primary | white | — | — | · |
| foreground.secondary | white | — | — | · |
| foreground.tertiary | white | — | — | · |
| foreground.inverse.primary | black | — | — | · |
| foreground.inverse.secondary | black | — | — | · |
| foreground.inverse.tertiary | black | — | — | · |
| foreground.brand | red.700 | 8.25 | 7 | ✅ |
| foreground.success | green.700 | 8.28 | 7 | ✅ |
| foreground.warning | amber.700 | 8.05 | 7 | ✅ |
| foreground.info | info.700 | 8.04 | 7 | ✅ |
| foreground.brand-subtle | red.100 | — | — | · |
| foreground.success-subtle | green.100 | — | — | · |
| foreground.warning-subtle | amber.100 | — | — | · |
| foreground.danger-subtle | red.100 | — | — | · |
| foreground.info-subtle | info.100 | — | — | · |
| foreground.danger.default | red.700 | 8.25 | 7 | ✅ |
| foreground.danger.hover | red.750 | 9.94 | 7 | ✅ |
| foreground.danger.pressed | red.800 | 11.66 | 7 | ✅ |
| foreground.danger.focused | red.750 | 9.94 | 7 | ✅ |
| foreground.danger.selected | red.800 | 11.66 | 7 | ✅ |
| foreground.danger.disabled | neutral.200 | — | — | · |
| action.default | red.700 | 8.25 | 7 | ✅ |
| action.hover | red.750 | 9.94 | 7 | ✅ |
| action.pressed | red.800 | 11.66 | 7 | ✅ |
| action.focused | red.750 | 9.94 | 7 | ✅ |
| action.selected | red.800 | 11.66 | 7 | ✅ |
| action.disabled | neutral.200 | — | — | · |
| text.primary | black | 21.00 | 15 | ✅ |
| text.secondary | neutral.700 | 8.09 | 7 | ✅ |
| text.tertiary | neutral.550 | 4.52 | 4.5 | ✅ |
| text.disabled | neutral.550 | 4.52 | 4.5 | ✅ |
| text.brand | red.700 | 8.25 | 7 | ✅ |
| text.success | green.700 | 8.28 | 7 | ✅ |
| text.warning | amber.700 | 8.05 | 7 | ✅ |
| text.danger | red.700 | 8.25 | 7 | ✅ |
| text.info | info.700 | 8.04 | 7 | ✅ |
| text.brand-subtle | red.450 | — | — | · |
| text.success-subtle | green.450 | — | — | · |
| text.warning-subtle | amber.450 | — | — | · |
| text.danger-subtle | red.450 | — | — | · |
| text.info-subtle | info.450 | — | — | · |
| text.on-action | white | 10.03 | 4.5 | ✅ |
| text.on-brand | white | 10.03 | 4.5 | ✅ |
| text.on-success | white | 10.07 | 4.5 | ✅ |
| text.on-warning | white | 9.78 | 4.5 | ✅ |
| text.on-danger | white | 10.03 | 4.5 | ✅ |
| text.on-info | white | 9.78 | 4.5 | ✅ |
| text.on-inverse | white | 21.00 | 7 | ✅ |
| text.link.default | red.700 | 8.25 | 7 | ✅ |
| text.link.hover | red.750 | 9.94 | 7 | ✅ |
| text.link.visited | red.800 | 11.66 | 7 | ✅ |
| text.link.focused | red.700 | 8.25 | 7 | ✅ |
| icon.primary | black | 21.00 | 15 | ✅ |
| icon.secondary | neutral.700 | 8.09 | 7 | ✅ |
| icon.tertiary | neutral.550 | 4.52 | 4.5 | ✅ |
| icon.disabled | neutral.550 | 4.52 | 4.5 | ✅ |
| icon.brand | red.700 | 8.25 | 7 | ✅ |
| icon.success | green.700 | 8.28 | 7 | ✅ |
| icon.warning | amber.700 | 8.05 | 7 | ✅ |
| icon.danger | red.700 | 8.25 | 7 | ✅ |
| icon.info | info.700 | 8.04 | 7 | ✅ |
| icon.brand-subtle | red.450 | — | — | · |
| icon.success-subtle | green.450 | — | — | · |
| icon.warning-subtle | amber.450 | — | — | · |
| icon.danger-subtle | red.450 | — | — | · |
| icon.info-subtle | info.450 | — | — | · |
| icon.on-action | white | 10.03 | 4.5 | ✅ |
| icon.on-brand | white | 10.03 | 4.5 | ✅ |
| icon.on-success | white | 10.07 | 4.5 | ✅ |
| icon.on-warning | white | 9.78 | 4.5 | ✅ |
| icon.on-danger | white | 10.03 | 4.5 | ✅ |
| icon.on-info | white | 9.78 | 4.5 | ✅ |
| icon.on-inverse | white | 21.00 | 7 | ✅ |
| icon.link.default | red.700 | 8.25 | 7 | ✅ |
| icon.link.hover | red.750 | 9.94 | 7 | ✅ |
| icon.link.visited | red.800 | 11.66 | 7 | ✅ |
| icon.link.focused | red.700 | 8.25 | 7 | ✅ |
| border.primary | neutral.500 | — | — | · |
| border.secondary | neutral.700 | — | — | · |
| border.inverse | neutral.500 | — | — | · |
| border.brand | red.500 | 4.58 | 4.5 | ✅ |
| border.success | green.500 | 4.89 | 4.5 | ✅ |
| border.warning | amber.500 | 4.50 | 4.5 | ✅ |
| border.danger | red.500 | 4.58 | 4.5 | ✅ |
| border.info | info.500 | 4.56 | 4.5 | ✅ |
| border.focus | red.700 | 10.03 | 4.5 | ✅ |

## nb — colour mode: hc-dark

| role | → step | contrast | floor | result |
|---|---|---|---|---|
| background.primary | black | — | — | · |
| background.secondary | black | — | — | · |
| background.tertiary | black | — | — | · |
| background.inverse.primary | white | — | — | · |
| background.inverse.secondary | white | — | — | · |
| background.inverse.tertiary | white | — | — | · |
| scrim.default | black-alpha.70 | — | — | · |
| foreground.primary | black | — | — | · |
| foreground.secondary | black | — | — | · |
| foreground.tertiary | black | — | — | · |
| foreground.inverse.primary | white | — | — | · |
| foreground.inverse.secondary | white | — | — | · |
| foreground.inverse.tertiary | white | — | — | · |
| foreground.brand | red.300 | 7.50 | 7 | ✅ |
| foreground.success | green.300 | 7.19 | 7 | ✅ |
| foreground.warning | amber.300 | 7.57 | 7 | ✅ |
| foreground.info | info.300 | 7.53 | 7 | ✅ |
| foreground.brand-subtle | red.900 | — | — | · |
| foreground.success-subtle | green.900 | — | — | · |
| foreground.warning-subtle | amber.900 | — | — | · |
| foreground.danger-subtle | red.900 | — | — | · |
| foreground.info-subtle | info.900 | — | — | · |
| foreground.danger.default | red.300 | 7.50 | 7 | ✅ |
| foreground.danger.hover | red.250 | 8.70 | 7 | ✅ |
| foreground.danger.pressed | red.200 | 10.01 | 7 | ✅ |
| foreground.danger.focused | red.250 | 8.70 | 7 | ✅ |
| foreground.danger.selected | red.200 | 10.01 | 7 | ✅ |
| foreground.danger.disabled | neutral.750 | — | — | · |
| action.default | red.300 | 7.50 | 7 | ✅ |
| action.hover | red.250 | 8.70 | 7 | ✅ |
| action.pressed | red.200 | 10.01 | 7 | ✅ |
| action.focused | red.250 | 8.70 | 7 | ✅ |
| action.selected | red.200 | 10.01 | 7 | ✅ |
| action.disabled | neutral.750 | — | — | · |
| text.primary | white | 21.00 | 15 | ✅ |
| text.secondary | neutral.300 | 7.49 | 7 | ✅ |
| text.tertiary | neutral.450 | 4.68 | 4.5 | ✅ |
| text.disabled | neutral.450 | 4.68 | 4.5 | ✅ |
| text.brand | red.300 | 7.50 | 7 | ✅ |
| text.success | green.300 | 7.19 | 7 | ✅ |
| text.warning | amber.300 | 7.57 | 7 | ✅ |
| text.danger | red.300 | 7.50 | 7 | ✅ |
| text.info | info.300 | 7.53 | 7 | ✅ |
| text.brand-subtle | red.350 | — | — | · |
| text.success-subtle | green.350 | — | — | · |
| text.warning-subtle | amber.350 | — | — | · |
| text.danger-subtle | red.350 | — | — | · |
| text.info-subtle | info.350 | — | — | · |
| text.on-action | black | 8.77 | 4.5 | ✅ |
| text.on-brand | black | 8.77 | 4.5 | ✅ |
| text.on-success | black | 8.41 | 4.5 | ✅ |
| text.on-warning | black | 8.84 | 4.5 | ✅ |
| text.on-danger | black | 8.77 | 4.5 | ✅ |
| text.on-info | black | 8.80 | 4.5 | ✅ |
| text.on-inverse | black | 21.00 | 7 | ✅ |
| text.link.default | red.300 | 7.50 | 7 | ✅ |
| text.link.hover | red.250 | 8.70 | 7 | ✅ |
| text.link.visited | red.200 | 10.01 | 7 | ✅ |
| text.link.focused | red.300 | 7.50 | 7 | ✅ |
| icon.primary | white | 21.00 | 15 | ✅ |
| icon.secondary | neutral.300 | 7.49 | 7 | ✅ |
| icon.tertiary | neutral.450 | 4.68 | 4.5 | ✅ |
| icon.disabled | neutral.450 | 4.68 | 4.5 | ✅ |
| icon.brand | red.300 | 7.50 | 7 | ✅ |
| icon.success | green.300 | 7.19 | 7 | ✅ |
| icon.warning | amber.300 | 7.57 | 7 | ✅ |
| icon.danger | red.300 | 7.50 | 7 | ✅ |
| icon.info | info.300 | 7.53 | 7 | ✅ |
| icon.brand-subtle | red.350 | — | — | · |
| icon.success-subtle | green.350 | — | — | · |
| icon.warning-subtle | amber.350 | — | — | · |
| icon.danger-subtle | red.350 | — | — | · |
| icon.info-subtle | info.350 | — | — | · |
| icon.on-action | black | 8.77 | 4.5 | ✅ |
| icon.on-brand | black | 8.77 | 4.5 | ✅ |
| icon.on-success | black | 8.41 | 4.5 | ✅ |
| icon.on-warning | black | 8.84 | 4.5 | ✅ |
| icon.on-danger | black | 8.77 | 4.5 | ✅ |
| icon.on-info | black | 8.80 | 4.5 | ✅ |
| icon.on-inverse | black | 21.00 | 7 | ✅ |
| icon.link.default | red.300 | 7.50 | 7 | ✅ |
| icon.link.hover | red.250 | 8.70 | 7 | ✅ |
| icon.link.visited | red.200 | 10.01 | 7 | ✅ |
| icon.link.focused | red.300 | 7.50 | 7 | ✅ |
| border.primary | neutral.500 | — | — | · |
| border.secondary | neutral.250 | — | — | · |
| border.inverse | neutral.500 | — | — | · |
| border.brand | red.500 | 4.58 | 4.5 | ✅ |
| border.success | green.450 | 5.11 | 4.5 | ✅ |
| border.warning | amber.500 | 4.67 | 4.5 | ✅ |
| border.danger | red.500 | 4.58 | 4.5 | ✅ |
| border.info | info.500 | 4.61 | 4.5 | ✅ |
| border.focus | red.300 | 8.77 | 4.5 | ✅ |

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
- info: engine default hue 245
- action colour is decoupled: uses palette 'accent', NOT the primary brand palette — explicit brand decision
- danger: primary hue 285 is NOT red → carved a dedicated danger red at hue 27
- dimension axis: 4px grid, 8px space rhythm, density 'compact' (drives component sizes), radius scale 2 (baseMd 4px)
- motion: tempo 'snappy' scales the duration ramp; easing roles + springs + composite transitions generated; reduce-motion variants derived (informational preserved, vestibular → 0)
- shadow: 6-step ramp (xs–2xl) + inset, 2-layer (key+ambient), softness 1.3; tinted base (hue 285, amount 0.5). Mode-aware, LIFT-primary: full shadow in light; reduced (faded, top-weighted) in dark — the surface ladder carries dark elevation. Composite shadow → Figma Effect Style.
- gradient: 2 brand gradient(s) [brand linear 135° 2-stop, glow radial 2-stop] — OPT-IN. DTCG composite spine, stop colours alias the ramp; kind/angle/oklch interpolation in $extensions (DTCG omits them — issue #101). OKLCH-interpolated + 5-stop sRGB pre-sample for Figma (sRGB-only); materializes as a Figma Paint Style (only stop colours bind). Worst-case-stop contrast computed for text-on-gradient.
- layout: 6 breakpoints (xs 0, sm 480, md 768, lg 1024, xl 1440, 2xl 1920); grid base 12 cols (ladder 4/8/12/12/12/12); gutter/margin alias the spacing scale (16/16/24/24/32/32 · 16/24/24/32/48/48); container max 1280px + narrow 720px (fluid-first + cap). Breakpoints → a separate Figma layout collection (modes), composing with colour light/dark.
- typography: curated rem size ladder (22 steps, 10–160px — NOT ratio-derived; covers all bases, clean values); weight roles subtle/default/emphasis/strong → 300/400/500/700; families display=Clash Display, text=Inter, mono=JetBrains Mono (variable: display/text); typeScale 'expressive'. 19 semantic composites (title/display sizes shifted by typeScale; display capped at 128px; title floor 16px) — NOTE: requested ceiling 128px; effective top display is 112px (typeScale shifts sizes off the exact ladder rung). responsive: 9 fluid composites (size-dependent mobile shrink — research-validated, Carbon fluid-display curve: body static, titles ~1 rung, display converges to ~40–48px; one min/max pair → web clamp() 360–1440px + Figma desktop/mobile modes). Line-height unitless multiplier in $value; px-from-ratio materialization for Figma in $extensions.
- disabled: 'accessible' — disabled text/icon/border clears 3:1 on the floor (legible, contrast-preserving; the field-rare default). Set disabledStrategy:'conventional' for the sub-AA exempt look.
- light primary surface is NON-default (neutral.50) — CONFIRM this is the page colour; the contrast floor moves with it

Palettes: primary, neutral, accent, success, warning, info, danger. Danger draws from `danger`.

## aurora — colour mode: light

| role | → step | contrast | floor | result |
|---|---|---|---|---|
| background.primary | neutral.050 | — | — | · |
| background.secondary | neutral.100 | — | — | · |
| background.tertiary | neutral.150 | — | — | · |
| background.inverse.primary | black | — | — | · |
| background.inverse.secondary | neutral.950 | — | — | · |
| background.inverse.tertiary | neutral.900 | — | — | · |
| scrim.default | black-alpha.40 | — | — | · |
| foreground.primary | neutral.100 | — | — | · |
| foreground.secondary | neutral.150 | — | — | · |
| foreground.tertiary | neutral.200 | — | — | · |
| foreground.inverse.primary | neutral.950 | — | — | · |
| foreground.inverse.secondary | neutral.900 | — | — | · |
| foreground.inverse.tertiary | neutral.850 | — | — | · |
| foreground.brand | primary.550 | 4.64 | 4.5 | ✅ |
| foreground.success | success.600 | 4.82 | 4.5 | ✅ |
| foreground.warning | warning.600 | 4.86 | 4.5 | ✅ |
| foreground.info | info.600 | 4.85 | 4.5 | ✅ |
| foreground.brand-subtle | primary.100 | — | — | · |
| foreground.success-subtle | success.100 | — | — | · |
| foreground.warning-subtle | warning.100 | — | — | · |
| foreground.danger-subtle | danger.100 | — | — | · |
| foreground.info-subtle | info.100 | — | — | · |
| foreground.danger.default | danger.600 | 4.89 | 4.5 | ✅ |
| foreground.danger.hover | danger.650 | 5.95 | 4.5 | ✅ |
| foreground.danger.pressed | danger.700 | 7.22 | 4.5 | ✅ |
| foreground.danger.focused | danger.650 | 5.95 | 4.5 | ✅ |
| foreground.danger.selected | danger.700 | 7.22 | 4.5 | ✅ |
| foreground.danger.disabled | neutral.200 | — | — | · |
| action.default | accent.600 | 4.95 | 4.5 | ✅ |
| action.hover | accent.650 | 6.00 | 4.5 | ✅ |
| action.pressed | accent.700 | 7.26 | 4.5 | ✅ |
| action.focused | accent.650 | 6.00 | 4.5 | ✅ |
| action.selected | accent.700 | 7.26 | 4.5 | ✅ |
| action.disabled | neutral.200 | — | — | · |
| text.primary | neutral.950 | 16.01 | 7 | ✅ |
| text.secondary | neutral.600 | 4.81 | 4.5 | ✅ |
| text.tertiary | neutral.500 | 3.28 | 3 | ✅ |
| text.disabled | neutral.500 | 3.28 | 3 | ✅ |
| text.brand | primary.550 | 4.64 | 4.5 | ✅ |
| text.success | success.600 | 4.82 | 4.5 | ✅ |
| text.warning | warning.600 | 4.86 | 4.5 | ✅ |
| text.danger | danger.600 | 4.89 | 4.5 | ✅ |
| text.info | info.600 | 4.85 | 4.5 | ✅ |
| text.brand-subtle | primary.450 | — | — | · |
| text.success-subtle | success.450 | — | — | · |
| text.warning-subtle | warning.450 | — | — | · |
| text.danger-subtle | danger.450 | — | — | · |
| text.info-subtle | info.450 | — | — | · |
| text.on-action | white | 6.85 | 4.5 | ✅ |
| text.on-brand | white | 6.42 | 4.5 | ✅ |
| text.on-success | white | 6.67 | 4.5 | ✅ |
| text.on-warning | white | 6.72 | 4.5 | ✅ |
| text.on-danger | white | 6.76 | 4.5 | ✅ |
| text.on-info | white | 6.70 | 4.5 | ✅ |
| text.on-inverse | neutral.025 | 19.60 | 4.5 | ✅ |
| text.link.default | accent.600 | 4.95 | 4.5 | ✅ |
| text.link.hover | accent.650 | 6.00 | 4.5 | ✅ |
| text.link.visited | accent.700 | 7.26 | 4.5 | ✅ |
| text.link.focused | accent.600 | 4.95 | 4.5 | ✅ |
| icon.primary | neutral.950 | 16.01 | 7 | ✅ |
| icon.secondary | neutral.500 | 3.28 | 3 | ✅ |
| icon.tertiary | neutral.500 | 3.28 | 3 | ✅ |
| icon.disabled | neutral.500 | 3.28 | 3 | ✅ |
| icon.brand | primary.550 | 4.64 | 3 | ✅ |
| icon.success | success.500 | 3.32 | 3 | ✅ |
| icon.warning | warning.500 | 3.32 | 3 | ✅ |
| icon.danger | danger.500 | 3.30 | 3 | ✅ |
| icon.info | info.500 | 3.30 | 3 | ✅ |
| icon.brand-subtle | primary.450 | — | — | · |
| icon.success-subtle | success.450 | — | — | · |
| icon.warning-subtle | warning.450 | — | — | · |
| icon.danger-subtle | danger.450 | — | — | · |
| icon.info-subtle | info.450 | — | — | · |
| icon.on-action | white | 6.85 | 4.5 | ✅ |
| icon.on-brand | white | 6.42 | 4.5 | ✅ |
| icon.on-success | white | 6.67 | 4.5 | ✅ |
| icon.on-warning | white | 6.72 | 4.5 | ✅ |
| icon.on-danger | white | 6.76 | 4.5 | ✅ |
| icon.on-info | white | 6.70 | 4.5 | ✅ |
| icon.on-inverse | neutral.025 | 19.60 | 4.5 | ✅ |
| icon.link.default | accent.600 | 4.95 | 3 | ✅ |
| icon.link.hover | accent.650 | 6.00 | 3 | ✅ |
| icon.link.visited | accent.700 | 7.26 | 3 | ✅ |
| icon.link.focused | accent.600 | 4.95 | 3 | ✅ |
| border.primary | neutral.200 | — | — | · |
| border.secondary | neutral.450 | — | — | · |
| border.inverse | neutral.850 | — | — | · |
| border.brand | primary.500 | 3.77 | 3 | ✅ |
| border.success | success.500 | 3.78 | 3 | ✅ |
| border.warning | warning.500 | 3.78 | 3 | ✅ |
| border.danger | danger.500 | 3.76 | 3 | ✅ |
| border.info | info.500 | 3.76 | 3 | ✅ |
| border.focus | accent.600 | 5.65 | 3 | ✅ |

## aurora — colour mode: dark

| role | → step | contrast | floor | result |
|---|---|---|---|---|
| background.primary | neutral.950 | — | — | · |
| background.secondary | neutral.900 | — | — | · |
| background.tertiary | neutral.850 | — | — | · |
| background.inverse.primary | white | — | — | · |
| background.inverse.secondary | neutral.050 | — | — | · |
| background.inverse.tertiary | neutral.100 | — | — | · |
| scrim.default | black-alpha.60 | — | — | · |
| foreground.primary | neutral.900 | — | — | · |
| foreground.secondary | neutral.850 | — | — | · |
| foreground.tertiary | neutral.800 | — | — | · |
| foreground.inverse.primary | neutral.050 | — | — | · |
| foreground.inverse.secondary | neutral.100 | — | — | · |
| foreground.inverse.tertiary | neutral.150 | — | — | · |
| foreground.brand | primary.450 | 4.61 | 4.5 | ✅ |
| foreground.success | success.450 | 4.68 | 4.5 | ✅ |
| foreground.warning | warning.450 | 4.60 | 4.5 | ✅ |
| foreground.info | info.450 | 4.63 | 4.5 | ✅ |
| foreground.brand-subtle | primary.900 | — | — | · |
| foreground.success-subtle | success.900 | — | — | · |
| foreground.warning-subtle | warning.900 | — | — | · |
| foreground.danger-subtle | danger.900 | — | — | · |
| foreground.info-subtle | info.900 | — | — | · |
| foreground.danger.default | danger.450 | 4.56 | 4.5 | ✅ |
| foreground.danger.hover | danger.400 | 5.41 | 4.5 | ✅ |
| foreground.danger.pressed | danger.350 | 6.34 | 4.5 | ✅ |
| foreground.danger.focused | danger.400 | 5.41 | 4.5 | ✅ |
| foreground.danger.selected | danger.350 | 6.34 | 4.5 | ✅ |
| foreground.danger.disabled | neutral.750 | — | — | · |
| action.default | accent.400 | 5.34 | 4.5 | ✅ |
| action.hover | accent.350 | 6.27 | 4.5 | ✅ |
| action.pressed | accent.300 | 7.32 | 4.5 | ✅ |
| action.focused | accent.350 | 6.27 | 4.5 | ✅ |
| action.selected | accent.300 | 7.32 | 4.5 | ✅ |
| action.disabled | neutral.750 | — | — | · |
| text.primary | neutral.025 | 18.13 | 7 | ✅ |
| text.secondary | neutral.450 | 4.66 | 4.5 | ✅ |
| text.tertiary | neutral.550 | 3.23 | 3 | ✅ |
| text.disabled | neutral.550 | 3.23 | 3 | ✅ |
| text.brand | primary.450 | 4.61 | 4.5 | ✅ |
| text.success | success.450 | 4.68 | 4.5 | ✅ |
| text.warning | warning.450 | 4.60 | 4.5 | ✅ |
| text.danger | danger.450 | 4.56 | 4.5 | ✅ |
| text.info | info.450 | 4.63 | 4.5 | ✅ |
| text.brand-subtle | primary.350 | — | — | · |
| text.success-subtle | success.350 | — | — | · |
| text.warning-subtle | warning.350 | — | — | · |
| text.danger-subtle | danger.350 | — | — | · |
| text.info-subtle | info.350 | — | — | · |
| text.on-action | black | 6.27 | 4.5 | ✅ |
| text.on-brand | black | 5.40 | 4.5 | ✅ |
| text.on-success | black | 5.48 | 4.5 | ✅ |
| text.on-warning | black | 5.40 | 4.5 | ✅ |
| text.on-danger | black | 5.35 | 4.5 | ✅ |
| text.on-info | black | 5.43 | 4.5 | ✅ |
| text.on-inverse | neutral.950 | 19.43 | 4.5 | ✅ |
| text.link.default | accent.400 | 5.34 | 4.5 | ✅ |
| text.link.hover | accent.350 | 6.27 | 4.5 | ✅ |
| text.link.visited | accent.300 | 7.32 | 4.5 | ✅ |
| text.link.focused | accent.400 | 5.34 | 4.5 | ✅ |
| icon.primary | neutral.025 | 18.13 | 7 | ✅ |
| icon.secondary | neutral.550 | 3.23 | 3 | ✅ |
| icon.tertiary | neutral.550 | 3.23 | 3 | ✅ |
| icon.disabled | neutral.550 | 3.23 | 3 | ✅ |
| icon.brand | primary.500 | 3.91 | 3 | ✅ |
| icon.success | success.500 | 3.90 | 3 | ✅ |
| icon.warning | warning.500 | 3.90 | 3 | ✅ |
| icon.danger | danger.500 | 3.92 | 3 | ✅ |
| icon.info | info.500 | 3.93 | 3 | ✅ |
| icon.brand-subtle | primary.350 | — | — | · |
| icon.success-subtle | success.350 | — | — | · |
| icon.warning-subtle | warning.350 | — | — | · |
| icon.danger-subtle | danger.350 | — | — | · |
| icon.info-subtle | info.350 | — | — | · |
| icon.on-action | black | 6.27 | 4.5 | ✅ |
| icon.on-brand | black | 5.40 | 4.5 | ✅ |
| icon.on-success | black | 5.48 | 4.5 | ✅ |
| icon.on-warning | black | 5.40 | 4.5 | ✅ |
| icon.on-danger | black | 5.35 | 4.5 | ✅ |
| icon.on-info | black | 5.43 | 4.5 | ✅ |
| icon.on-inverse | neutral.950 | 19.43 | 4.5 | ✅ |
| icon.link.default | accent.400 | 5.34 | 3 | ✅ |
| icon.link.hover | accent.350 | 6.27 | 3 | ✅ |
| icon.link.visited | accent.300 | 7.32 | 3 | ✅ |
| icon.link.focused | accent.400 | 5.34 | 3 | ✅ |
| border.primary | neutral.750 | — | — | · |
| border.secondary | neutral.500 | — | — | · |
| border.inverse | neutral.200 | — | — | · |
| border.brand | primary.500 | 4.25 | 3 | ✅ |
| border.success | success.500 | 4.23 | 3 | ✅ |
| border.warning | warning.500 | 4.23 | 3 | ✅ |
| border.danger | danger.500 | 4.26 | 3 | ✅ |
| border.info | info.500 | 4.26 | 3 | ✅ |
| border.focus | accent.400 | 5.80 | 3 | ✅ |

## aurora — colour mode: hc-light

| role | → step | contrast | floor | result |
|---|---|---|---|---|
| background.primary | white | — | — | · |
| background.secondary | white | — | — | · |
| background.tertiary | white | — | — | · |
| background.inverse.primary | black | — | — | · |
| background.inverse.secondary | black | — | — | · |
| background.inverse.tertiary | black | — | — | · |
| scrim.default | black-alpha.60 | — | — | · |
| foreground.primary | white | — | — | · |
| foreground.secondary | white | — | — | · |
| foreground.tertiary | white | — | — | · |
| foreground.inverse.primary | black | — | — | · |
| foreground.inverse.secondary | black | — | — | · |
| foreground.inverse.tertiary | black | — | — | · |
| foreground.brand | primary.700 | 7.90 | 7 | ✅ |
| foreground.success | success.700 | 7.04 | 7 | ✅ |
| foreground.warning | warning.700 | 7.12 | 7 | ✅ |
| foreground.info | info.700 | 7.07 | 7 | ✅ |
| foreground.brand-subtle | primary.100 | — | — | · |
| foreground.success-subtle | success.100 | — | — | · |
| foreground.warning-subtle | warning.100 | — | — | · |
| foreground.danger-subtle | danger.100 | — | — | · |
| foreground.info-subtle | info.100 | — | — | · |
| foreground.danger.default | danger.700 | 7.22 | 7 | ✅ |
| foreground.danger.hover | danger.750 | 8.67 | 7 | ✅ |
| foreground.danger.pressed | danger.800 | 10.27 | 7 | ✅ |
| foreground.danger.focused | danger.750 | 8.67 | 7 | ✅ |
| foreground.danger.selected | danger.800 | 10.27 | 7 | ✅ |
| foreground.danger.disabled | neutral.200 | — | — | · |
| action.default | accent.700 | 7.26 | 7 | ✅ |
| action.hover | accent.750 | 8.65 | 7 | ✅ |
| action.pressed | accent.800 | 10.07 | 7 | ✅ |
| action.focused | accent.750 | 8.65 | 7 | ✅ |
| action.selected | accent.800 | 10.07 | 7 | ✅ |
| action.disabled | neutral.200 | — | — | · |
| text.primary | black | 21.00 | 15 | ✅ |
| text.secondary | neutral.700 | 7.12 | 7 | ✅ |
| text.tertiary | neutral.600 | 4.81 | 4.5 | ✅ |
| text.disabled | neutral.600 | 4.81 | 4.5 | ✅ |
| text.brand | primary.700 | 7.90 | 7 | ✅ |
| text.success | success.700 | 7.04 | 7 | ✅ |
| text.warning | warning.700 | 7.12 | 7 | ✅ |
| text.danger | danger.700 | 7.22 | 7 | ✅ |
| text.info | info.700 | 7.07 | 7 | ✅ |
| text.brand-subtle | primary.450 | — | — | · |
| text.success-subtle | success.450 | — | — | · |
| text.warning-subtle | warning.450 | — | — | · |
| text.danger-subtle | danger.450 | — | — | · |
| text.info-subtle | info.450 | — | — | · |
| text.on-action | white | 10.03 | 4.5 | ✅ |
| text.on-brand | white | 10.92 | 4.5 | ✅ |
| text.on-success | white | 9.73 | 4.5 | ✅ |
| text.on-warning | white | 9.85 | 4.5 | ✅ |
| text.on-danger | white | 9.99 | 4.5 | ✅ |
| text.on-info | white | 9.78 | 4.5 | ✅ |
| text.on-inverse | white | 21.00 | 7 | ✅ |
| text.link.default | accent.700 | 7.26 | 7 | ✅ |
| text.link.hover | accent.750 | 8.65 | 7 | ✅ |
| text.link.visited | accent.800 | 10.07 | 7 | ✅ |
| text.link.focused | accent.700 | 7.26 | 7 | ✅ |
| icon.primary | black | 21.00 | 15 | ✅ |
| icon.secondary | neutral.600 | 4.81 | 4.5 | ✅ |
| icon.tertiary | neutral.600 | 4.81 | 4.5 | ✅ |
| icon.disabled | neutral.600 | 4.81 | 4.5 | ✅ |
| icon.brand | primary.550 | 4.64 | 4.5 | ✅ |
| icon.success | success.600 | 4.82 | 4.5 | ✅ |
| icon.warning | warning.600 | 4.86 | 4.5 | ✅ |
| icon.danger | danger.600 | 4.89 | 4.5 | ✅ |
| icon.info | info.600 | 4.85 | 4.5 | ✅ |
| icon.brand-subtle | primary.450 | — | — | · |
| icon.success-subtle | success.450 | — | — | · |
| icon.warning-subtle | warning.450 | — | — | · |
| icon.danger-subtle | danger.450 | — | — | · |
| icon.info-subtle | info.450 | — | — | · |
| icon.on-action | white | 10.03 | 4.5 | ✅ |
| icon.on-brand | white | 10.92 | 4.5 | ✅ |
| icon.on-success | white | 9.73 | 4.5 | ✅ |
| icon.on-warning | white | 9.85 | 4.5 | ✅ |
| icon.on-danger | white | 9.99 | 4.5 | ✅ |
| icon.on-info | white | 9.78 | 4.5 | ✅ |
| icon.on-inverse | white | 21.00 | 7 | ✅ |
| icon.link.default | accent.700 | 7.26 | 4.5 | ✅ |
| icon.link.hover | accent.750 | 8.65 | 4.5 | ✅ |
| icon.link.visited | accent.800 | 10.07 | 4.5 | ✅ |
| icon.link.focused | accent.700 | 7.26 | 4.5 | ✅ |
| border.primary | neutral.500 | — | — | · |
| border.secondary | neutral.700 | — | — | · |
| border.inverse | neutral.500 | — | — | · |
| border.brand | primary.500 | 4.58 | 4.5 | ✅ |
| border.success | success.500 | 4.59 | 4.5 | ✅ |
| border.warning | warning.500 | 4.59 | 4.5 | ✅ |
| border.danger | danger.500 | 4.56 | 4.5 | ✅ |
| border.info | info.500 | 4.56 | 4.5 | ✅ |
| border.focus | accent.700 | 10.03 | 4.5 | ✅ |

## aurora — colour mode: hc-dark

| role | → step | contrast | floor | result |
|---|---|---|---|---|
| background.primary | black | — | — | · |
| background.secondary | black | — | — | · |
| background.tertiary | black | — | — | · |
| background.inverse.primary | white | — | — | · |
| background.inverse.secondary | white | — | — | · |
| background.inverse.tertiary | white | — | — | · |
| scrim.default | black-alpha.70 | — | — | · |
| foreground.primary | black | — | — | · |
| foreground.secondary | black | — | — | · |
| foreground.tertiary | black | — | — | · |
| foreground.inverse.primary | white | — | — | · |
| foreground.inverse.secondary | white | — | — | · |
| foreground.inverse.tertiary | white | — | — | · |
| foreground.brand | primary.300 | 7.45 | 7 | ✅ |
| foreground.success | success.300 | 7.65 | 7 | ✅ |
| foreground.warning | warning.300 | 7.33 | 7 | ✅ |
| foreground.info | info.300 | 7.50 | 7 | ✅ |
| foreground.brand-subtle | primary.900 | — | — | · |
| foreground.success-subtle | success.900 | — | — | · |
| foreground.warning-subtle | warning.900 | — | — | · |
| foreground.danger-subtle | danger.900 | — | — | · |
| foreground.info-subtle | info.900 | — | — | · |
| foreground.danger.default | danger.300 | 7.42 | 7 | ✅ |
| foreground.danger.hover | danger.250 | 8.60 | 7 | ✅ |
| foreground.danger.pressed | danger.200 | 9.97 | 7 | ✅ |
| foreground.danger.focused | danger.250 | 8.60 | 7 | ✅ |
| foreground.danger.selected | danger.200 | 9.97 | 7 | ✅ |
| foreground.danger.disabled | neutral.750 | — | — | · |
| action.default | accent.300 | 7.32 | 7 | ✅ |
| action.hover | accent.250 | 8.50 | 7 | ✅ |
| action.pressed | accent.200 | 9.82 | 7 | ✅ |
| action.focused | accent.250 | 8.50 | 7 | ✅ |
| action.selected | accent.200 | 9.82 | 7 | ✅ |
| action.disabled | neutral.750 | — | — | · |
| text.primary | white | 21.00 | 15 | ✅ |
| text.secondary | neutral.300 | 7.46 | 7 | ✅ |
| text.tertiary | neutral.450 | 4.66 | 4.5 | ✅ |
| text.disabled | neutral.450 | 4.66 | 4.5 | ✅ |
| text.brand | primary.300 | 7.45 | 7 | ✅ |
| text.success | success.300 | 7.65 | 7 | ✅ |
| text.warning | warning.300 | 7.33 | 7 | ✅ |
| text.danger | danger.300 | 7.42 | 7 | ✅ |
| text.info | info.300 | 7.50 | 7 | ✅ |
| text.brand-subtle | primary.350 | — | — | · |
| text.success-subtle | success.350 | — | — | · |
| text.warning-subtle | warning.350 | — | — | · |
| text.danger-subtle | danger.350 | — | — | · |
| text.info-subtle | info.350 | — | — | · |
| text.on-action | black | 8.59 | 4.5 | ✅ |
| text.on-brand | black | 8.74 | 4.5 | ✅ |
| text.on-success | black | 8.98 | 4.5 | ✅ |
| text.on-warning | black | 8.60 | 4.5 | ✅ |
| text.on-danger | black | 8.70 | 4.5 | ✅ |
| text.on-info | black | 8.80 | 4.5 | ✅ |
| text.on-inverse | black | 21.00 | 7 | ✅ |
| text.link.default | accent.300 | 7.32 | 7 | ✅ |
| text.link.hover | accent.250 | 8.50 | 7 | ✅ |
| text.link.visited | accent.200 | 9.82 | 7 | ✅ |
| text.link.focused | accent.300 | 7.32 | 7 | ✅ |
| icon.primary | white | 21.00 | 15 | ✅ |
| icon.secondary | neutral.450 | 4.66 | 4.5 | ✅ |
| icon.tertiary | neutral.450 | 4.66 | 4.5 | ✅ |
| icon.disabled | neutral.450 | 4.66 | 4.5 | ✅ |
| icon.brand | primary.450 | 4.61 | 4.5 | ✅ |
| icon.success | success.450 | 4.68 | 4.5 | ✅ |
| icon.warning | warning.450 | 4.60 | 4.5 | ✅ |
| icon.danger | danger.450 | 4.56 | 4.5 | ✅ |
| icon.info | info.450 | 4.63 | 4.5 | ✅ |
| icon.brand-subtle | primary.350 | — | — | · |
| icon.success-subtle | success.350 | — | — | · |
| icon.warning-subtle | warning.350 | — | — | · |
| icon.danger-subtle | danger.350 | — | — | · |
| icon.info-subtle | info.350 | — | — | · |
| icon.on-action | black | 8.59 | 4.5 | ✅ |
| icon.on-brand | black | 8.74 | 4.5 | ✅ |
| icon.on-success | black | 8.98 | 4.5 | ✅ |
| icon.on-warning | black | 8.60 | 4.5 | ✅ |
| icon.on-danger | black | 8.70 | 4.5 | ✅ |
| icon.on-info | black | 8.80 | 4.5 | ✅ |
| icon.on-inverse | black | 21.00 | 7 | ✅ |
| icon.link.default | accent.300 | 7.32 | 4.5 | ✅ |
| icon.link.hover | accent.250 | 8.50 | 4.5 | ✅ |
| icon.link.visited | accent.200 | 9.82 | 4.5 | ✅ |
| icon.link.focused | accent.300 | 7.32 | 4.5 | ✅ |
| border.primary | neutral.500 | — | — | · |
| border.secondary | neutral.250 | — | — | · |
| border.inverse | neutral.500 | — | — | · |
| border.brand | primary.500 | 4.59 | 4.5 | ✅ |
| border.success | success.500 | 4.58 | 4.5 | ✅ |
| border.warning | warning.500 | 4.58 | 4.5 | ✅ |
| border.danger | danger.500 | 4.60 | 4.5 | ✅ |
| border.info | info.500 | 4.61 | 4.5 | ✅ |
| border.focus | accent.300 | 8.59 | 4.5 | ✅ |

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

