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
| background.inverse.primary | neutral.950 | — | — | · |
| background.inverse.secondary | neutral.900 | — | — | · |
| background.inverse.tertiary | neutral.850 | — | — | · |
| scrim.default | black-alpha.40 | — | — | · |
| foreground.primary | neutral.050 | — | — | · |
| foreground.secondary | neutral.100 | — | — | · |
| foreground.tertiary | neutral.150 | — | — | · |
| foreground.inverse.primary | neutral.900 | — | — | · |
| foreground.inverse.secondary | neutral.850 | — | — | · |
| foreground.inverse.tertiary | neutral.800 | — | — | · |
| foreground.brand | red.550 | 4.62 | 4.5 | ✅ |
| foreground.success | green.550 | 4.84 | 4.5 | ✅ |
| foreground.warning | amber.600 | 5.46 | 4.5 | ✅ |
| foreground.info | info.550 | 4.56 | 4.5 | ✅ |
| foreground.brand-subtle | red.100 | — | — | · |
| foreground.success-subtle | green.100 | — | — | · |
| foreground.warning-subtle | amber.100 | — | — | · |
| foreground.danger-subtle | red.100 | — | — | · |
| foreground.info-subtle | info.100 | — | — | · |
| foreground.danger | red.550 | 4.62 | 4.5 | ✅ |
| interactive.primary.fill.rest | red.550 | 4.62 | 4.5 | ✅ |
| interactive.primary.fill.hover | red.600 | 5.64 | 4.5 | ✅ |
| interactive.primary.fill.pressed | red.650 | 6.82 | 4.5 | ✅ |
| interactive.primary.fill.focused | red.600 | 5.64 | 4.5 | ✅ |
| interactive.primary.fill.selected | red.650 | 6.82 | 4.5 | ✅ |
| interactive.primary.on-fill | white | 5.62 | 4.5 | ✅ |
| interactive.primary.text | red.550 | 5.62 | 4.5 | ✅ |
| interactive.primary.border | red.500 | 4.58 | 3 | ✅ |
| interactive.destructive.fill.rest | red.550 | 4.62 | 4.5 | ✅ |
| interactive.destructive.fill.hover | red.600 | 5.64 | 4.5 | ✅ |
| interactive.destructive.fill.pressed | red.650 | 6.82 | 4.5 | ✅ |
| interactive.destructive.fill.focused | red.600 | 5.64 | 4.5 | ✅ |
| interactive.destructive.fill.selected | red.650 | 6.82 | 4.5 | ✅ |
| interactive.destructive.on-fill | white | 5.62 | 4.5 | ✅ |
| interactive.destructive.text | red.550 | 5.62 | 4.5 | ✅ |
| interactive.destructive.border | red.500 | 4.58 | 3 | ✅ |
| interactive.neutral.fill.rest | neutral.150 | — | — | · |
| interactive.neutral.fill.hover | neutral.200 | — | — | · |
| interactive.neutral.fill.pressed | neutral.250 | — | — | · |
| interactive.neutral.fill.focused | neutral.200 | — | — | · |
| interactive.neutral.fill.selected | neutral.250 | — | — | · |
| interactive.neutral.on-fill | neutral.950 | 12.33 | 4.5 | ✅ |
| interactive.neutral.text | neutral.950 | 19.44 | 4.5 | ✅ |
| interactive.neutral.border | neutral.400 | 3.27 | 3 | ✅ |
| interactive.primary.on-inverse | red.450 | 5.05 | 4.5 | ✅ |
| interactive.destructive.on-inverse | red.450 | 5.05 | 4.5 | ✅ |
| interactive.neutral.on-inverse | neutral.025 | 18.11 | 4.5 | ✅ |
| interactive.primary.overlay.hover | black-alpha.10 | 15.51 | 4.5 | ✅ |
| interactive.primary.overlay.pressed | black-alpha.20 | 12.11 | 4.5 | ✅ |
| interactive.primary.overlay.selected | black-alpha.20 | 12.11 | 4.5 | ✅ |
| interactive.neutral.overlay.hover | black-alpha.10 | 15.51 | 4.5 | ✅ |
| interactive.neutral.overlay.pressed | black-alpha.20 | 12.11 | 4.5 | ✅ |
| interactive.neutral.overlay.selected | black-alpha.20 | 12.11 | 4.5 | ✅ |
| interactive.destructive.overlay.hover | black-alpha.10 | 15.51 | 4.5 | ✅ |
| interactive.destructive.overlay.pressed | black-alpha.20 | 12.11 | 4.5 | ✅ |
| interactive.destructive.overlay.selected | black-alpha.20 | 12.11 | 4.5 | ✅ |
| disabled.fill | neutral.200 | — | — | · |
| disabled.on-fill | neutral.550 | 3.04 | 3 | ✅ |
| disabled.text | neutral.450 | 3.16 | 3 | ✅ |
| disabled.icon | neutral.450 | 3.16 | 3 | ✅ |
| disabled.border | neutral.200 | — | — | · |
| field.fill | neutral.050 | — | — | · |
| field.border.rest | neutral.400 | 3.27 | 3 | ✅ |
| field.border.hover | neutral.500 | 4.59 | 4.5 | ✅ |
| field.placeholder | neutral.550 | 4.52 | 4.5 | ✅ |
| text.primary | neutral.950 | 19.44 | 7 | ✅ |
| text.secondary | neutral.550 | 4.52 | 4.5 | ✅ |
| text.tertiary | neutral.450 | 3.16 | 3 | ✅ |
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
| text.on-brand | white | 5.62 | 4.5 | ✅ |
| text.on-success | white | 5.89 | 4.5 | ✅ |
| text.on-warning | white | 6.63 | 4.5 | ✅ |
| text.on-danger | white | 5.62 | 4.5 | ✅ |
| text.on-info | white | 5.54 | 4.5 | ✅ |
| text.on-inverse | neutral.025 | 18.11 | 4.5 | ✅ |
| text.link.default | red.550 | 4.62 | 4.5 | ✅ |
| text.link.hover | red.600 | 5.64 | 4.5 | ✅ |
| text.link.visited | red.650 | 6.82 | 4.5 | ✅ |
| text.link.focused | red.550 | 4.62 | 4.5 | ✅ |
| icon.primary | neutral.950 | 19.44 | 7 | ✅ |
| icon.secondary | neutral.550 | 4.52 | 4.5 | ✅ |
| icon.tertiary | neutral.450 | 3.16 | 3 | ✅ |
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
| icon.on-brand | white | 5.62 | 4.5 | ✅ |
| icon.on-success | white | 5.89 | 4.5 | ✅ |
| icon.on-warning | white | 6.63 | 4.5 | ✅ |
| icon.on-danger | white | 5.62 | 4.5 | ✅ |
| icon.on-info | white | 5.54 | 4.5 | ✅ |
| icon.on-inverse | neutral.025 | 18.11 | 4.5 | ✅ |
| icon.link.default | red.550 | 4.62 | 4.5 | ✅ |
| icon.link.hover | red.600 | 5.64 | 4.5 | ✅ |
| icon.link.visited | red.650 | 6.82 | 4.5 | ✅ |
| icon.link.focused | red.550 | 4.62 | 4.5 | ✅ |
| border.primary | neutral.100 | — | — | · |
| border.secondary | neutral.400 | — | — | · |
| border.inverse | neutral.800 | — | — | · |
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
| background.inverse.primary | neutral.025 | — | — | · |
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
| foreground.danger | red.450 | 4.66 | 4.5 | ✅ |
| interactive.primary.fill.rest | red.450 | 4.66 | 4.5 | ✅ |
| interactive.primary.fill.hover | red.400 | 5.52 | 4.5 | ✅ |
| interactive.primary.fill.pressed | red.350 | 6.44 | 4.5 | ✅ |
| interactive.primary.fill.focused | red.400 | 5.52 | 4.5 | ✅ |
| interactive.primary.fill.selected | red.350 | 6.44 | 4.5 | ✅ |
| interactive.primary.on-fill | neutral.950 | 5.05 | 4.5 | ✅ |
| interactive.primary.text | red.450 | 5.05 | 4.5 | ✅ |
| interactive.primary.border | red.500 | 4.24 | 3 | ✅ |
| interactive.destructive.fill.rest | red.450 | 4.66 | 4.5 | ✅ |
| interactive.destructive.fill.hover | red.400 | 5.52 | 4.5 | ✅ |
| interactive.destructive.fill.pressed | red.350 | 6.44 | 4.5 | ✅ |
| interactive.destructive.fill.focused | red.400 | 5.52 | 4.5 | ✅ |
| interactive.destructive.fill.selected | red.350 | 6.44 | 4.5 | ✅ |
| interactive.destructive.on-fill | neutral.950 | 5.05 | 4.5 | ✅ |
| interactive.destructive.text | red.450 | 5.05 | 4.5 | ✅ |
| interactive.destructive.border | red.500 | 4.24 | 3 | ✅ |
| interactive.neutral.fill.rest | neutral.850 | — | — | · |
| interactive.neutral.fill.hover | neutral.800 | — | — | · |
| interactive.neutral.fill.pressed | neutral.750 | — | — | · |
| interactive.neutral.fill.focused | neutral.800 | — | — | · |
| interactive.neutral.fill.selected | neutral.750 | — | — | · |
| interactive.neutral.on-fill | neutral.025 | 14.91 | 4.5 | ✅ |
| interactive.neutral.text | neutral.025 | 18.11 | 4.5 | ✅ |
| interactive.neutral.border | neutral.550 | 3.54 | 3 | ✅ |
| interactive.primary.on-inverse | red.550 | 5.24 | 4.5 | ✅ |
| interactive.destructive.on-inverse | red.550 | 5.24 | 4.5 | ✅ |
| interactive.neutral.on-inverse | neutral.950 | 18.11 | 4.5 | ✅ |
| interactive.primary.overlay.hover | white-alpha.10 | 14.26 | 4.5 | ✅ |
| interactive.primary.overlay.pressed | white-alpha.20 | 10.07 | 4.5 | ✅ |
| interactive.primary.overlay.selected | white-alpha.20 | 10.07 | 4.5 | ✅ |
| interactive.neutral.overlay.hover | white-alpha.10 | 14.26 | 4.5 | ✅ |
| interactive.neutral.overlay.pressed | white-alpha.20 | 10.07 | 4.5 | ✅ |
| interactive.neutral.overlay.selected | white-alpha.20 | 10.07 | 4.5 | ✅ |
| interactive.destructive.overlay.hover | white-alpha.10 | 14.26 | 4.5 | ✅ |
| interactive.destructive.overlay.pressed | white-alpha.20 | 10.07 | 4.5 | ✅ |
| interactive.destructive.overlay.selected | white-alpha.20 | 10.07 | 4.5 | ✅ |
| disabled.fill | neutral.750 | — | — | · |
| disabled.on-fill | neutral.450 | 3.08 | 3 | ✅ |
| disabled.text | neutral.550 | 3.27 | 3 | ✅ |
| disabled.icon | neutral.550 | 3.27 | 3 | ✅ |
| disabled.border | neutral.750 | — | — | · |
| field.fill | neutral.900 | — | — | · |
| field.border.rest | neutral.550 | 3.54 | 3 | ✅ |
| field.border.hover | neutral.450 | 5.06 | 4.5 | ✅ |
| field.placeholder | neutral.450 | 4.68 | 4.5 | ✅ |
| text.primary | neutral.025 | 18.11 | 7 | ✅ |
| text.secondary | neutral.450 | 4.68 | 4.5 | ✅ |
| text.tertiary | neutral.550 | 3.27 | 3 | ✅ |
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
| text.on-brand | neutral.950 | 5.05 | 4.5 | ✅ |
| text.on-success | neutral.950 | 5.60 | 4.5 | ✅ |
| text.on-warning | neutral.950 | 5.13 | 4.5 | ✅ |
| text.on-danger | neutral.950 | 5.05 | 4.5 | ✅ |
| text.on-info | neutral.950 | 5.03 | 4.5 | ✅ |
| text.on-inverse | neutral.950 | 18.11 | 4.5 | ✅ |
| text.link.default | red.450 | 4.66 | 4.5 | ✅ |
| text.link.hover | red.400 | 5.52 | 4.5 | ✅ |
| text.link.visited | red.350 | 6.44 | 4.5 | ✅ |
| text.link.focused | red.450 | 4.66 | 4.5 | ✅ |
| icon.primary | neutral.025 | 18.11 | 7 | ✅ |
| icon.secondary | neutral.450 | 4.68 | 4.5 | ✅ |
| icon.tertiary | neutral.550 | 3.27 | 3 | ✅ |
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
| icon.on-brand | neutral.950 | 5.05 | 4.5 | ✅ |
| icon.on-success | neutral.950 | 5.60 | 4.5 | ✅ |
| icon.on-warning | neutral.950 | 5.13 | 4.5 | ✅ |
| icon.on-danger | neutral.950 | 5.05 | 4.5 | ✅ |
| icon.on-info | neutral.950 | 5.03 | 4.5 | ✅ |
| icon.on-inverse | neutral.950 | 18.11 | 4.5 | ✅ |
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
| foreground.danger | red.700 | 8.25 | 7 | ✅ |
| interactive.primary.fill.rest | red.700 | 8.25 | 7 | ✅ |
| interactive.primary.fill.hover | red.750 | 9.94 | 7 | ✅ |
| interactive.primary.fill.pressed | red.800 | 11.66 | 7 | ✅ |
| interactive.primary.fill.focused | red.750 | 9.94 | 7 | ✅ |
| interactive.primary.fill.selected | red.800 | 11.66 | 7 | ✅ |
| interactive.primary.on-fill | white | 10.03 | 4.5 | ✅ |
| interactive.primary.text | red.650 | 8.29 | 7 | ✅ |
| interactive.primary.border | red.500 | 4.58 | 4.5 | ✅ |
| interactive.destructive.fill.rest | red.700 | 8.25 | 7 | ✅ |
| interactive.destructive.fill.hover | red.750 | 9.94 | 7 | ✅ |
| interactive.destructive.fill.pressed | red.800 | 11.66 | 7 | ✅ |
| interactive.destructive.fill.focused | red.750 | 9.94 | 7 | ✅ |
| interactive.destructive.fill.selected | red.800 | 11.66 | 7 | ✅ |
| interactive.destructive.on-fill | white | 10.03 | 4.5 | ✅ |
| interactive.destructive.text | red.650 | 8.29 | 7 | ✅ |
| interactive.destructive.border | red.500 | 4.58 | 4.5 | ✅ |
| interactive.neutral.fill.rest | neutral.150 | — | — | · |
| interactive.neutral.fill.hover | neutral.200 | — | — | · |
| interactive.neutral.fill.pressed | neutral.250 | — | — | · |
| interactive.neutral.fill.focused | neutral.200 | — | — | · |
| interactive.neutral.fill.selected | neutral.250 | — | — | · |
| interactive.neutral.on-fill | black | 13.32 | 4.5 | ✅ |
| interactive.neutral.text | black | 21.00 | 7 | ✅ |
| interactive.neutral.border | neutral.500 | 4.59 | 4.5 | ✅ |
| interactive.primary.on-inverse | red.350 | 7.52 | 7 | ✅ |
| interactive.destructive.on-inverse | red.350 | 7.52 | 7 | ✅ |
| interactive.neutral.on-inverse | white | 21.00 | 7 | ✅ |
| interactive.primary.overlay.hover | black-alpha.10 | 16.75 | 7 | ✅ |
| interactive.primary.overlay.pressed | black-alpha.20 | 13.08 | 7 | ✅ |
| interactive.primary.overlay.selected | black-alpha.20 | 13.08 | 7 | ✅ |
| interactive.neutral.overlay.hover | black-alpha.10 | 16.75 | 7 | ✅ |
| interactive.neutral.overlay.pressed | black-alpha.20 | 13.08 | 7 | ✅ |
| interactive.neutral.overlay.selected | black-alpha.20 | 13.08 | 7 | ✅ |
| interactive.destructive.overlay.hover | black-alpha.10 | 16.75 | 7 | ✅ |
| interactive.destructive.overlay.pressed | black-alpha.20 | 13.08 | 7 | ✅ |
| interactive.destructive.overlay.selected | black-alpha.20 | 13.08 | 7 | ✅ |
| disabled.fill | neutral.200 | — | — | · |
| disabled.on-fill | neutral.650 | 4.51 | 4.5 | ✅ |
| disabled.text | neutral.550 | 4.52 | 4.5 | ✅ |
| disabled.icon | neutral.550 | 4.52 | 4.5 | ✅ |
| disabled.border | neutral.200 | — | — | · |
| field.fill | white | — | — | · |
| field.border.rest | neutral.500 | 4.59 | 4.5 | ✅ |
| field.border.hover | neutral.650 | 8.15 | 7 | ✅ |
| field.placeholder | neutral.650 | 8.15 | 7 | ✅ |
| text.primary | black | 21.00 | 15 | ✅ |
| text.secondary | neutral.700 | 8.09 | 7 | ✅ |
| text.tertiary | neutral.550 | 4.52 | 4.5 | ✅ |
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
| foreground.danger | red.300 | 7.50 | 7 | ✅ |
| interactive.primary.fill.rest | red.300 | 7.50 | 7 | ✅ |
| interactive.primary.fill.hover | red.250 | 8.70 | 7 | ✅ |
| interactive.primary.fill.pressed | red.200 | 10.01 | 7 | ✅ |
| interactive.primary.fill.focused | red.250 | 8.70 | 7 | ✅ |
| interactive.primary.fill.selected | red.200 | 10.01 | 7 | ✅ |
| interactive.primary.on-fill | black | 8.77 | 4.5 | ✅ |
| interactive.primary.text | red.350 | 7.52 | 7 | ✅ |
| interactive.primary.border | red.500 | 4.58 | 4.5 | ✅ |
| interactive.destructive.fill.rest | red.300 | 7.50 | 7 | ✅ |
| interactive.destructive.fill.hover | red.250 | 8.70 | 7 | ✅ |
| interactive.destructive.fill.pressed | red.200 | 10.01 | 7 | ✅ |
| interactive.destructive.fill.focused | red.250 | 8.70 | 7 | ✅ |
| interactive.destructive.fill.selected | red.200 | 10.01 | 7 | ✅ |
| interactive.destructive.on-fill | black | 8.77 | 4.5 | ✅ |
| interactive.destructive.text | red.350 | 7.52 | 7 | ✅ |
| interactive.destructive.border | red.500 | 4.58 | 4.5 | ✅ |
| interactive.neutral.fill.rest | neutral.850 | — | — | · |
| interactive.neutral.fill.hover | neutral.800 | — | — | · |
| interactive.neutral.fill.pressed | neutral.750 | — | — | · |
| interactive.neutral.fill.focused | neutral.800 | — | — | · |
| interactive.neutral.fill.selected | neutral.750 | — | — | · |
| interactive.neutral.on-fill | white | 16.00 | 4.5 | ✅ |
| interactive.neutral.text | white | 21.00 | 7 | ✅ |
| interactive.neutral.border | neutral.500 | 4.57 | 4.5 | ✅ |
| interactive.primary.on-inverse | red.650 | 8.29 | 7 | ✅ |
| interactive.destructive.on-inverse | red.650 | 8.29 | 7 | ✅ |
| interactive.neutral.on-inverse | black | 21.00 | 7 | ✅ |
| interactive.primary.overlay.hover | white-alpha.10 | 17.49 | 7 | ✅ |
| interactive.primary.overlay.pressed | white-alpha.20 | 12.63 | 7 | ✅ |
| interactive.primary.overlay.selected | white-alpha.20 | 12.63 | 7 | ✅ |
| interactive.neutral.overlay.hover | white-alpha.10 | 17.49 | 7 | ✅ |
| interactive.neutral.overlay.pressed | white-alpha.20 | 12.63 | 7 | ✅ |
| interactive.neutral.overlay.selected | white-alpha.20 | 12.63 | 7 | ✅ |
| interactive.destructive.overlay.hover | white-alpha.10 | 17.49 | 7 | ✅ |
| interactive.destructive.overlay.pressed | white-alpha.20 | 12.63 | 7 | ✅ |
| interactive.destructive.overlay.selected | white-alpha.20 | 12.63 | 7 | ✅ |
| disabled.fill | neutral.750 | — | — | · |
| disabled.on-fill | neutral.300 | 4.92 | 4.5 | ✅ |
| disabled.text | neutral.450 | 4.68 | 4.5 | ✅ |
| disabled.icon | neutral.450 | 4.68 | 4.5 | ✅ |
| disabled.border | neutral.750 | — | — | · |
| field.fill | black | — | — | · |
| field.border.rest | neutral.500 | 4.57 | 4.5 | ✅ |
| field.border.hover | neutral.350 | 7.49 | 7 | ✅ |
| field.placeholder | neutral.350 | 7.49 | 7 | ✅ |
| text.primary | white | 21.00 | 15 | ✅ |
| text.secondary | neutral.300 | 7.49 | 7 | ✅ |
| text.tertiary | neutral.450 | 4.68 | 4.5 | ✅ |
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
| space.150 | 12 | 1.5× |
| space.200 | 16 | 2× |
| space.250 | 20 | 2.5× |
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
- anchor 'accent' (L0.55 C0.15 h235) is OUT of sRGB gamut — max renderable chroma at this L/hue is ~0.117; it ships clamped toward the boundary, so its lightness and hue may drift. Lower its chroma to ~0.117 for an exact match.
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
- typography: curated rem size ladder (22 steps, 10–160px — NOT ratio-derived; covers all bases, clean values); weight roles subtle/default/emphasis/strong → 300/400/500/700; families display=Clash Display, text=Inter, mono=JetBrains Mono (variable: display/text); typeScale 'expressive'. 35 semantic composites (title/display sizes shifted by typeScale; display capped at 128px; title floor 16px) — NOTE: requested ceiling 128px; effective top display is 112px (typeScale shifts sizes off the exact ladder rung). responsive: 9 fluid composites (size-dependent mobile shrink — research-validated, Carbon fluid-display curve: body static, titles ~1 rung, display converges to ~40–48px; one min/max pair → web clamp() 360–1440px + Figma desktop/mobile modes). Line-height unitless multiplier in $value; px-from-ratio materialization for Figma in $extensions.
- disabled: 'accessible' — disabled text/icon/border clears 3:1 on the floor (legible, contrast-preserving; the field-rare default). Set disabledStrategy:'conventional' for the sub-AA exempt look.
- interactive overlays: 'overlay-neutral' (default) — outline/text controls + rows/menus hover with a translucent neutral wash (interactive.<color>.overlay.*), contrast-verified on the composited surface. Set 'solid-tint' (opaque foreground.<color>-subtle) or 'none' to opt out.
- light primary surface is NON-default (neutral.50) — CONFIRM this is the page colour; the contrast floor moves with it
- action anchored at accent 'accent' step 500 (its pinned lightness) — the brand's own shade, nudged only if it fails AA on the floor
- neutral interactive emphasis: 'subtle' (light-grey, default); inverse surface-context: on (interactive.<color>.on-inverse generated)

Palettes: primary, neutral, accent, success, warning, info, danger. Danger draws from `danger`.

## aurora — colour mode: light

| role | → step | contrast | floor | result |
|---|---|---|---|---|
| background.primary | neutral.050 | — | — | · |
| background.secondary | neutral.100 | — | — | · |
| background.tertiary | neutral.150 | — | — | · |
| background.inverse.primary | neutral.950 | — | — | · |
| background.inverse.secondary | neutral.900 | — | — | · |
| background.inverse.tertiary | neutral.850 | — | — | · |
| scrim.default | black-alpha.40 | — | — | · |
| foreground.primary | neutral.100 | — | — | · |
| foreground.secondary | neutral.150 | — | — | · |
| foreground.tertiary | neutral.200 | — | — | · |
| foreground.inverse.primary | neutral.900 | — | — | · |
| foreground.inverse.secondary | neutral.850 | — | — | · |
| foreground.inverse.tertiary | neutral.800 | — | — | · |
| foreground.brand | primary.550 | 4.64 | 4.5 | ✅ |
| foreground.success | success.600 | 4.82 | 4.5 | ✅ |
| foreground.warning | warning.600 | 4.86 | 4.5 | ✅ |
| foreground.info | info.600 | 4.85 | 4.5 | ✅ |
| foreground.brand-subtle | primary.100 | — | — | · |
| foreground.success-subtle | success.100 | — | — | · |
| foreground.warning-subtle | warning.100 | — | — | · |
| foreground.danger-subtle | danger.100 | — | — | · |
| foreground.info-subtle | info.100 | — | — | · |
| foreground.danger | danger.600 | 4.89 | 4.5 | ✅ |
| interactive.primary.fill.rest | accent.600 | 4.95 | 4.5 | ✅ |
| interactive.primary.fill.hover | accent.650 | 6.00 | 4.5 | ✅ |
| interactive.primary.fill.pressed | accent.700 | 7.26 | 4.5 | ✅ |
| interactive.primary.fill.focused | accent.650 | 6.00 | 4.5 | ✅ |
| interactive.primary.fill.selected | accent.700 | 7.26 | 4.5 | ✅ |
| interactive.primary.on-fill | white | 6.85 | 4.5 | ✅ |
| interactive.primary.text | accent.550 | 4.69 | 4.5 | ✅ |
| interactive.primary.border | accent.500 | 3.76 | 3 | ✅ |
| interactive.destructive.fill.rest | danger.600 | 4.89 | 4.5 | ✅ |
| interactive.destructive.fill.hover | danger.650 | 5.95 | 4.5 | ✅ |
| interactive.destructive.fill.pressed | danger.700 | 7.22 | 4.5 | ✅ |
| interactive.destructive.fill.focused | danger.650 | 5.95 | 4.5 | ✅ |
| interactive.destructive.fill.selected | danger.700 | 7.22 | 4.5 | ✅ |
| interactive.destructive.on-fill | white | 6.76 | 4.5 | ✅ |
| interactive.destructive.text | danger.550 | 4.58 | 4.5 | ✅ |
| interactive.destructive.border | danger.500 | 3.76 | 3 | ✅ |
| interactive.neutral.fill.rest | neutral.150 | — | — | · |
| interactive.neutral.fill.hover | neutral.200 | — | — | · |
| interactive.neutral.fill.pressed | neutral.250 | — | — | · |
| interactive.neutral.fill.focused | neutral.200 | — | — | · |
| interactive.neutral.fill.selected | neutral.250 | — | — | · |
| interactive.neutral.on-fill | neutral.950 | 12.36 | 4.5 | ✅ |
| interactive.neutral.text | neutral.950 | 16.01 | 4.5 | ✅ |
| interactive.neutral.border | neutral.450 | 3.16 | 3 | ✅ |
| interactive.primary.on-inverse | accent.450 | 4.87 | 4.5 | ✅ |
| interactive.destructive.on-inverse | danger.450 | 4.95 | 4.5 | ✅ |
| interactive.neutral.on-inverse | neutral.025 | 18.13 | 4.5 | ✅ |
| interactive.primary.overlay.hover | black-alpha.10 | 12.82 | 4.5 | ✅ |
| interactive.primary.overlay.pressed | black-alpha.20 | 10.06 | 4.5 | ✅ |
| interactive.primary.overlay.selected | black-alpha.20 | 10.06 | 4.5 | ✅ |
| interactive.neutral.overlay.hover | black-alpha.10 | 12.82 | 4.5 | ✅ |
| interactive.neutral.overlay.pressed | black-alpha.20 | 10.06 | 4.5 | ✅ |
| interactive.neutral.overlay.selected | black-alpha.20 | 10.06 | 4.5 | ✅ |
| interactive.destructive.overlay.hover | black-alpha.10 | 12.82 | 4.5 | ✅ |
| interactive.destructive.overlay.pressed | black-alpha.20 | 10.06 | 4.5 | ✅ |
| interactive.destructive.overlay.selected | black-alpha.20 | 10.06 | 4.5 | ✅ |
| disabled.fill | neutral.200 | — | — | · |
| disabled.on-fill | neutral.550 | 3.08 | 3 | ✅ |
| disabled.text | neutral.500 | 3.28 | 3 | ✅ |
| disabled.icon | neutral.500 | 3.28 | 3 | ✅ |
| disabled.border | neutral.200 | — | — | · |
| field.fill | neutral.100 | — | — | · |
| field.border.rest | neutral.450 | 3.16 | 3 | ✅ |
| field.border.hover | neutral.550 | 4.57 | 4.5 | ✅ |
| field.placeholder | neutral.600 | 4.81 | 4.5 | ✅ |
| text.primary | neutral.950 | 16.01 | 7 | ✅ |
| text.secondary | neutral.600 | 4.81 | 4.5 | ✅ |
| text.tertiary | neutral.500 | 3.28 | 3 | ✅ |
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
| text.on-brand | white | 6.42 | 4.5 | ✅ |
| text.on-success | white | 6.67 | 4.5 | ✅ |
| text.on-warning | white | 6.72 | 4.5 | ✅ |
| text.on-danger | white | 6.76 | 4.5 | ✅ |
| text.on-info | white | 6.70 | 4.5 | ✅ |
| text.on-inverse | neutral.025 | 18.13 | 4.5 | ✅ |
| text.link.default | accent.600 | 4.95 | 4.5 | ✅ |
| text.link.hover | accent.650 | 6.00 | 4.5 | ✅ |
| text.link.visited | accent.700 | 7.26 | 4.5 | ✅ |
| text.link.focused | accent.600 | 4.95 | 4.5 | ✅ |
| icon.primary | neutral.950 | 16.01 | 7 | ✅ |
| icon.secondary | neutral.500 | 3.28 | 3 | ✅ |
| icon.tertiary | neutral.500 | 3.28 | 3 | ✅ |
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
| icon.on-brand | white | 6.42 | 4.5 | ✅ |
| icon.on-success | white | 6.67 | 4.5 | ✅ |
| icon.on-warning | white | 6.72 | 4.5 | ✅ |
| icon.on-danger | white | 6.76 | 4.5 | ✅ |
| icon.on-info | white | 6.70 | 4.5 | ✅ |
| icon.on-inverse | neutral.025 | 18.13 | 4.5 | ✅ |
| icon.link.default | accent.600 | 4.95 | 3 | ✅ |
| icon.link.hover | accent.650 | 6.00 | 3 | ✅ |
| icon.link.visited | accent.700 | 7.26 | 3 | ✅ |
| icon.link.focused | accent.600 | 4.95 | 3 | ✅ |
| border.primary | neutral.200 | — | — | · |
| border.secondary | neutral.450 | — | — | · |
| border.inverse | neutral.800 | — | — | · |
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
| background.inverse.primary | neutral.025 | — | — | · |
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
| foreground.danger | danger.450 | 4.56 | 4.5 | ✅ |
| interactive.primary.fill.rest | accent.400 | 5.34 | 4.5 | ✅ |
| interactive.primary.fill.hover | accent.350 | 6.27 | 4.5 | ✅ |
| interactive.primary.fill.pressed | accent.300 | 7.32 | 4.5 | ✅ |
| interactive.primary.fill.focused | accent.350 | 6.27 | 4.5 | ✅ |
| interactive.primary.fill.selected | accent.300 | 7.32 | 4.5 | ✅ |
| interactive.primary.on-fill | neutral.950 | 5.80 | 4.5 | ✅ |
| interactive.primary.text | accent.450 | 4.87 | 4.5 | ✅ |
| interactive.primary.border | accent.500 | 4.26 | 3 | ✅ |
| interactive.destructive.fill.rest | danger.450 | 4.56 | 4.5 | ✅ |
| interactive.destructive.fill.hover | danger.400 | 5.41 | 4.5 | ✅ |
| interactive.destructive.fill.pressed | danger.350 | 6.34 | 4.5 | ✅ |
| interactive.destructive.fill.focused | danger.400 | 5.41 | 4.5 | ✅ |
| interactive.destructive.fill.selected | danger.350 | 6.34 | 4.5 | ✅ |
| interactive.destructive.on-fill | neutral.950 | 4.95 | 4.5 | ✅ |
| interactive.destructive.text | danger.450 | 4.95 | 4.5 | ✅ |
| interactive.destructive.border | danger.500 | 4.26 | 3 | ✅ |
| interactive.neutral.fill.rest | neutral.850 | — | — | · |
| interactive.neutral.fill.hover | neutral.800 | — | — | · |
| interactive.neutral.fill.pressed | neutral.750 | — | — | · |
| interactive.neutral.fill.focused | neutral.800 | — | — | · |
| interactive.neutral.fill.selected | neutral.750 | — | — | · |
| interactive.neutral.on-fill | neutral.025 | 14.99 | 4.5 | ✅ |
| interactive.neutral.text | neutral.025 | 18.13 | 4.5 | ✅ |
| interactive.neutral.border | neutral.550 | 3.51 | 3 | ✅ |
| interactive.primary.on-inverse | accent.550 | 5.31 | 4.5 | ✅ |
| interactive.destructive.on-inverse | danger.550 | 5.18 | 4.5 | ✅ |
| interactive.neutral.on-inverse | neutral.950 | 18.13 | 4.5 | ✅ |
| interactive.primary.overlay.hover | white-alpha.10 | 14.26 | 4.5 | ✅ |
| interactive.primary.overlay.pressed | white-alpha.20 | 10.07 | 4.5 | ✅ |
| interactive.primary.overlay.selected | white-alpha.20 | 10.07 | 4.5 | ✅ |
| interactive.neutral.overlay.hover | white-alpha.10 | 14.26 | 4.5 | ✅ |
| interactive.neutral.overlay.pressed | white-alpha.20 | 10.07 | 4.5 | ✅ |
| interactive.neutral.overlay.selected | white-alpha.20 | 10.07 | 4.5 | ✅ |
| interactive.destructive.overlay.hover | white-alpha.10 | 14.26 | 4.5 | ✅ |
| interactive.destructive.overlay.pressed | white-alpha.20 | 10.07 | 4.5 | ✅ |
| interactive.destructive.overlay.selected | white-alpha.20 | 10.07 | 4.5 | ✅ |
| disabled.fill | neutral.750 | — | — | · |
| disabled.on-fill | neutral.450 | 3.04 | 3 | ✅ |
| disabled.text | neutral.550 | 3.23 | 3 | ✅ |
| disabled.icon | neutral.550 | 3.23 | 3 | ✅ |
| disabled.border | neutral.750 | — | — | · |
| field.fill | neutral.900 | — | — | · |
| field.border.rest | neutral.550 | 3.51 | 3 | ✅ |
| field.border.hover | neutral.450 | 5.06 | 4.5 | ✅ |
| field.placeholder | neutral.450 | 4.66 | 4.5 | ✅ |
| text.primary | neutral.025 | 18.13 | 7 | ✅ |
| text.secondary | neutral.450 | 4.66 | 4.5 | ✅ |
| text.tertiary | neutral.550 | 3.23 | 3 | ✅ |
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
| text.on-brand | neutral.950 | 5.00 | 4.5 | ✅ |
| text.on-success | neutral.950 | 5.07 | 4.5 | ✅ |
| text.on-warning | neutral.950 | 4.99 | 4.5 | ✅ |
| text.on-danger | neutral.950 | 4.95 | 4.5 | ✅ |
| text.on-info | neutral.950 | 5.03 | 4.5 | ✅ |
| text.on-inverse | neutral.950 | 18.13 | 4.5 | ✅ |
| text.link.default | accent.400 | 5.34 | 4.5 | ✅ |
| text.link.hover | accent.350 | 6.27 | 4.5 | ✅ |
| text.link.visited | accent.300 | 7.32 | 4.5 | ✅ |
| text.link.focused | accent.400 | 5.34 | 4.5 | ✅ |
| icon.primary | neutral.025 | 18.13 | 7 | ✅ |
| icon.secondary | neutral.550 | 3.23 | 3 | ✅ |
| icon.tertiary | neutral.550 | 3.23 | 3 | ✅ |
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
| icon.on-brand | neutral.950 | 5.00 | 4.5 | ✅ |
| icon.on-success | neutral.950 | 5.07 | 4.5 | ✅ |
| icon.on-warning | neutral.950 | 4.99 | 4.5 | ✅ |
| icon.on-danger | neutral.950 | 4.95 | 4.5 | ✅ |
| icon.on-info | neutral.950 | 5.03 | 4.5 | ✅ |
| icon.on-inverse | neutral.950 | 18.13 | 4.5 | ✅ |
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
| foreground.danger | danger.700 | 7.22 | 7 | ✅ |
| interactive.primary.fill.rest | accent.700 | 7.26 | 7 | ✅ |
| interactive.primary.fill.hover | accent.750 | 8.65 | 7 | ✅ |
| interactive.primary.fill.pressed | accent.800 | 10.07 | 7 | ✅ |
| interactive.primary.fill.focused | accent.750 | 8.65 | 7 | ✅ |
| interactive.primary.fill.selected | accent.800 | 10.07 | 7 | ✅ |
| interactive.primary.on-fill | white | 10.03 | 4.5 | ✅ |
| interactive.primary.text | accent.650 | 8.30 | 7 | ✅ |
| interactive.primary.border | accent.500 | 4.56 | 4.5 | ✅ |
| interactive.destructive.fill.rest | danger.700 | 7.22 | 7 | ✅ |
| interactive.destructive.fill.hover | danger.750 | 8.67 | 7 | ✅ |
| interactive.destructive.fill.pressed | danger.800 | 10.27 | 7 | ✅ |
| interactive.destructive.fill.focused | danger.750 | 8.67 | 7 | ✅ |
| interactive.destructive.fill.selected | danger.800 | 10.27 | 7 | ✅ |
| interactive.destructive.on-fill | white | 9.99 | 4.5 | ✅ |
| interactive.destructive.text | danger.650 | 8.22 | 7 | ✅ |
| interactive.destructive.border | danger.500 | 4.56 | 4.5 | ✅ |
| interactive.neutral.fill.rest | neutral.150 | — | — | · |
| interactive.neutral.fill.hover | neutral.200 | — | — | · |
| interactive.neutral.fill.pressed | neutral.250 | — | — | · |
| interactive.neutral.fill.focused | neutral.200 | — | — | · |
| interactive.neutral.fill.selected | neutral.250 | — | — | · |
| interactive.neutral.on-fill | black | 13.36 | 4.5 | ✅ |
| interactive.neutral.text | black | 21.00 | 7 | ✅ |
| interactive.neutral.border | neutral.500 | 4.54 | 4.5 | ✅ |
| interactive.primary.on-inverse | accent.350 | 7.36 | 7 | ✅ |
| interactive.destructive.on-inverse | danger.350 | 7.44 | 7 | ✅ |
| interactive.neutral.on-inverse | white | 21.00 | 7 | ✅ |
| interactive.primary.overlay.hover | black-alpha.10 | 16.75 | 7 | ✅ |
| interactive.primary.overlay.pressed | black-alpha.20 | 13.08 | 7 | ✅ |
| interactive.primary.overlay.selected | black-alpha.20 | 13.08 | 7 | ✅ |
| interactive.neutral.overlay.hover | black-alpha.10 | 16.75 | 7 | ✅ |
| interactive.neutral.overlay.pressed | black-alpha.20 | 13.08 | 7 | ✅ |
| interactive.neutral.overlay.selected | black-alpha.20 | 13.08 | 7 | ✅ |
| interactive.destructive.overlay.hover | black-alpha.10 | 16.75 | 7 | ✅ |
| interactive.destructive.overlay.pressed | black-alpha.20 | 13.08 | 7 | ✅ |
| interactive.destructive.overlay.selected | black-alpha.20 | 13.08 | 7 | ✅ |
| disabled.fill | neutral.200 | — | — | · |
| disabled.on-fill | neutral.650 | 4.53 | 4.5 | ✅ |
| disabled.text | neutral.600 | 4.81 | 4.5 | ✅ |
| disabled.icon | neutral.600 | 4.81 | 4.5 | ✅ |
| disabled.border | neutral.200 | — | — | · |
| field.fill | white | — | — | · |
| field.border.rest | neutral.500 | 4.54 | 4.5 | ✅ |
| field.border.hover | neutral.650 | 8.14 | 7 | ✅ |
| field.placeholder | neutral.650 | 8.14 | 7 | ✅ |
| text.primary | black | 21.00 | 15 | ✅ |
| text.secondary | neutral.700 | 7.12 | 7 | ✅ |
| text.tertiary | neutral.600 | 4.81 | 4.5 | ✅ |
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
| foreground.danger | danger.300 | 7.42 | 7 | ✅ |
| interactive.primary.fill.rest | accent.300 | 7.32 | 7 | ✅ |
| interactive.primary.fill.hover | accent.250 | 8.50 | 7 | ✅ |
| interactive.primary.fill.pressed | accent.200 | 9.82 | 7 | ✅ |
| interactive.primary.fill.focused | accent.250 | 8.50 | 7 | ✅ |
| interactive.primary.fill.selected | accent.200 | 9.82 | 7 | ✅ |
| interactive.primary.on-fill | black | 8.59 | 4.5 | ✅ |
| interactive.primary.text | accent.350 | 7.36 | 7 | ✅ |
| interactive.primary.border | accent.500 | 4.60 | 4.5 | ✅ |
| interactive.destructive.fill.rest | danger.300 | 7.42 | 7 | ✅ |
| interactive.destructive.fill.hover | danger.250 | 8.60 | 7 | ✅ |
| interactive.destructive.fill.pressed | danger.200 | 9.97 | 7 | ✅ |
| interactive.destructive.fill.focused | danger.250 | 8.60 | 7 | ✅ |
| interactive.destructive.fill.selected | danger.200 | 9.97 | 7 | ✅ |
| interactive.destructive.on-fill | black | 8.70 | 4.5 | ✅ |
| interactive.destructive.text | danger.350 | 7.44 | 7 | ✅ |
| interactive.destructive.border | danger.500 | 4.60 | 4.5 | ✅ |
| interactive.neutral.fill.rest | neutral.850 | — | — | · |
| interactive.neutral.fill.hover | neutral.800 | — | — | · |
| interactive.neutral.fill.pressed | neutral.750 | — | — | · |
| interactive.neutral.fill.focused | neutral.800 | — | — | · |
| interactive.neutral.fill.selected | neutral.750 | — | — | · |
| interactive.neutral.on-fill | white | 16.06 | 4.5 | ✅ |
| interactive.neutral.text | white | 21.00 | 7 | ✅ |
| interactive.neutral.border | neutral.500 | 4.63 | 4.5 | ✅ |
| interactive.primary.on-inverse | accent.650 | 8.30 | 7 | ✅ |
| interactive.destructive.on-inverse | danger.650 | 8.22 | 7 | ✅ |
| interactive.neutral.on-inverse | black | 21.00 | 7 | ✅ |
| interactive.primary.overlay.hover | white-alpha.10 | 17.49 | 7 | ✅ |
| interactive.primary.overlay.pressed | white-alpha.20 | 12.63 | 7 | ✅ |
| interactive.primary.overlay.selected | white-alpha.20 | 12.63 | 7 | ✅ |
| interactive.neutral.overlay.hover | white-alpha.10 | 17.49 | 7 | ✅ |
| interactive.neutral.overlay.pressed | white-alpha.20 | 12.63 | 7 | ✅ |
| interactive.neutral.overlay.selected | white-alpha.20 | 12.63 | 7 | ✅ |
| interactive.destructive.overlay.hover | white-alpha.10 | 17.49 | 7 | ✅ |
| interactive.destructive.overlay.pressed | white-alpha.20 | 12.63 | 7 | ✅ |
| interactive.destructive.overlay.selected | white-alpha.20 | 12.63 | 7 | ✅ |
| disabled.fill | neutral.750 | — | — | · |
| disabled.on-fill | neutral.300 | 4.87 | 4.5 | ✅ |
| disabled.text | neutral.450 | 4.66 | 4.5 | ✅ |
| disabled.icon | neutral.450 | 4.66 | 4.5 | ✅ |
| disabled.border | neutral.750 | — | — | · |
| field.fill | black | — | — | · |
| field.border.rest | neutral.500 | 4.63 | 4.5 | ✅ |
| field.border.hover | neutral.350 | 7.49 | 7 | ✅ |
| field.placeholder | neutral.350 | 7.49 | 7 | ✅ |
| text.primary | white | 21.00 | 15 | ✅ |
| text.secondary | neutral.300 | 7.46 | 7 | ✅ |
| text.tertiary | neutral.450 | 4.66 | 4.5 | ✅ |
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
| space.150 | 12 | 1.5× |
| space.200 | 16 | 2× |
| space.250 | 20 | 2.5× |
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

# Theme: harbor (prism.* / hex)

- primary anchor (h195) pinned exactly at step 600
- anchor 'primary' (L0.46 C0.08 h195) is OUT of sRGB gamut — max renderable chroma at this L/hue is ~0.079; it ships clamped toward the boundary, so its lightness and hue may drift. Lower its chroma to ~0.079 for an exact match.
- success: brand-supplied hue 150 — seeds a vivid ramp from its hue+chroma (not pinned at its measured lightness; the exact swatch may not appear verbatim)
- warning: brand-supplied hue 70 — seeds a vivid ramp from its hue+chroma (not pinned at its measured lightness; the exact swatch may not appear verbatim)
- info: engine default hue 245
- action colour defaults to the PRIMARY brand palette — CONFIRM this hue is the intended interactive colour for this brand
- danger: brand-supplied hue 27
- dimension axis: 4px grid, 8px space rhythm, density 'comfortable' (drives component sizes), radius scale 1 (baseMd 4px)
- motion: tempo 'relaxed' scales the duration ramp; easing roles + springs + composite transitions generated; reduce-motion variants derived (informational preserved, vestibular → 0)
- shadow: 6-step ramp (xs–2xl) + inset, 2-layer (key+ambient), softness 1; tinted base (hue 65, amount 0.15). Mode-aware, LIFT-primary: full shadow in light; reduced (faded, top-weighted) in dark — the surface ladder carries dark elevation. Composite shadow → Figma Effect Style.
- gradient: none (opt-in axis; brand declared no gradients — the field-common default).
- layout: 5 breakpoints (sm 0, md 768, lg 1024, xl 1440, 2xl 1920); grid base 12 cols (ladder 4/8/12/12/12); gutter/margin alias the spacing scale (16/16/24/24/32 · 16/24/24/32/48); container max 1440px + narrow 720px (fluid-first + cap). Breakpoints → a separate Figma layout collection (modes), composing with colour light/dark.
- typography: curated rem size ladder (22 steps, 10–160px — NOT ratio-derived; covers all bases, clean values); weight roles subtle/default/emphasis/strong → 300/400/600/700; families display=Inter, text=Inter, mono=JetBrains Mono; typeScale 'compact'. 35 semantic composites (title/display sizes shifted by typeScale; display capped at 160px; title floor 18px) — NOTE: requested ceiling 160px; effective top display is 144px (typeScale shifts sizes off the exact ladder rung). responsive: 9 fluid composites (size-dependent mobile shrink — research-validated, Carbon fluid-display curve: body static, titles ~1 rung, display converges to ~40–48px; one min/max pair → web clamp() 375–1280px + Figma desktop/mobile modes). Line-height unitless multiplier in $value; px-from-ratio materialization for Figma in $extensions.
- disabled: 'accessible' — disabled text/icon/border clears 3:1 on the floor (legible, contrast-preserving; the field-rare default). Set disabledStrategy:'conventional' for the sub-AA exempt look.
- interactive overlays: 'overlay-neutral' (default) — outline/text controls + rows/menus hover with a translucent neutral wash (interactive.<color>.overlay.*), contrast-verified on the composited surface. Set 'solid-tint' (opaque foreground.<color>-subtle) or 'none' to opt out.
- light primary surface is NON-default (neutral.50) — CONFIRM this is the page colour; the contrast floor moves with it
- neutral interactive emphasis: 'subtle' (light-grey, default); inverse surface-context: on (interactive.<color>.on-inverse generated)

Palettes: primary, neutral, success, warning, info, danger. Danger draws from `danger`.

## harbor — colour mode: light

| role | → step | contrast | floor | result |
|---|---|---|---|---|
| background.primary | neutral.050 | — | — | · |
| background.secondary | neutral.100 | — | — | · |
| background.tertiary | neutral.150 | — | — | · |
| background.inverse.primary | neutral.950 | — | — | · |
| background.inverse.secondary | neutral.900 | — | — | · |
| background.inverse.tertiary | neutral.850 | — | — | · |
| scrim.default | black-alpha.40 | — | — | · |
| foreground.primary | neutral.100 | — | — | · |
| foreground.secondary | neutral.150 | — | — | · |
| foreground.tertiary | neutral.200 | — | — | · |
| foreground.inverse.primary | neutral.900 | — | — | · |
| foreground.inverse.secondary | neutral.850 | — | — | · |
| foreground.inverse.tertiary | neutral.800 | — | — | · |
| foreground.brand | primary.600 | 4.91 | 4.5 | ✅ |
| foreground.success | success.600 | 4.85 | 4.5 | ✅ |
| foreground.warning | warning.600 | 4.86 | 4.5 | ✅ |
| foreground.info | info.600 | 4.85 | 4.5 | ✅ |
| foreground.brand-subtle | primary.100 | — | — | · |
| foreground.success-subtle | success.100 | — | — | · |
| foreground.warning-subtle | warning.100 | — | — | · |
| foreground.danger-subtle | danger.100 | — | — | · |
| foreground.info-subtle | info.100 | — | — | · |
| foreground.danger | danger.600 | 4.92 | 4.5 | ✅ |
| interactive.primary.fill.rest | primary.600 | 4.91 | 4.5 | ✅ |
| interactive.primary.fill.hover | primary.650 | 5.99 | 4.5 | ✅ |
| interactive.primary.fill.pressed | primary.700 | 7.21 | 4.5 | ✅ |
| interactive.primary.fill.focused | primary.650 | 5.99 | 4.5 | ✅ |
| interactive.primary.fill.selected | primary.700 | 7.21 | 4.5 | ✅ |
| interactive.primary.on-fill | white | 6.79 | 4.5 | ✅ |
| interactive.primary.text | primary.600 | 5.59 | 4.5 | ✅ |
| interactive.primary.border | primary.500 | 3.77 | 3 | ✅ |
| interactive.destructive.fill.rest | danger.600 | 4.92 | 4.5 | ✅ |
| interactive.destructive.fill.hover | danger.650 | 5.97 | 4.5 | ✅ |
| interactive.destructive.fill.pressed | danger.700 | 7.24 | 4.5 | ✅ |
| interactive.destructive.fill.focused | danger.650 | 5.97 | 4.5 | ✅ |
| interactive.destructive.fill.selected | danger.700 | 7.24 | 4.5 | ✅ |
| interactive.destructive.on-fill | white | 6.80 | 4.5 | ✅ |
| interactive.destructive.text | danger.550 | 4.60 | 4.5 | ✅ |
| interactive.destructive.border | danger.500 | 3.76 | 3 | ✅ |
| interactive.neutral.fill.rest | neutral.150 | — | — | · |
| interactive.neutral.fill.hover | neutral.200 | — | — | · |
| interactive.neutral.fill.pressed | neutral.250 | — | — | · |
| interactive.neutral.fill.focused | neutral.200 | — | — | · |
| interactive.neutral.fill.selected | neutral.250 | — | — | · |
| interactive.neutral.on-fill | neutral.950 | 12.36 | 4.5 | ✅ |
| interactive.neutral.text | neutral.950 | 15.98 | 4.5 | ✅ |
| interactive.neutral.border | neutral.450 | 3.20 | 3 | ✅ |
| interactive.primary.on-inverse | primary.450 | 5.00 | 4.5 | ✅ |
| interactive.destructive.on-inverse | danger.450 | 4.94 | 4.5 | ✅ |
| interactive.neutral.on-inverse | neutral.025 | 18.11 | 4.5 | ✅ |
| interactive.primary.overlay.hover | black-alpha.10 | 12.80 | 4.5 | ✅ |
| interactive.primary.overlay.pressed | black-alpha.20 | 10.04 | 4.5 | ✅ |
| interactive.primary.overlay.selected | black-alpha.20 | 10.04 | 4.5 | ✅ |
| interactive.neutral.overlay.hover | black-alpha.10 | 12.80 | 4.5 | ✅ |
| interactive.neutral.overlay.pressed | black-alpha.20 | 10.04 | 4.5 | ✅ |
| interactive.neutral.overlay.selected | black-alpha.20 | 10.04 | 4.5 | ✅ |
| interactive.destructive.overlay.hover | black-alpha.10 | 12.80 | 4.5 | ✅ |
| interactive.destructive.overlay.pressed | black-alpha.20 | 10.04 | 4.5 | ✅ |
| interactive.destructive.overlay.selected | black-alpha.20 | 10.04 | 4.5 | ✅ |
| disabled.fill | neutral.200 | — | — | · |
| disabled.on-fill | neutral.550 | 3.08 | 3 | ✅ |
| disabled.text | neutral.500 | 3.32 | 3 | ✅ |
| disabled.icon | neutral.500 | 3.32 | 3 | ✅ |
| disabled.border | neutral.200 | — | — | · |
| field.fill | neutral.100 | — | — | · |
| field.border.rest | neutral.450 | 3.20 | 3 | ✅ |
| field.border.hover | neutral.550 | 4.56 | 4.5 | ✅ |
| field.placeholder | neutral.600 | 4.88 | 4.5 | ✅ |
| text.primary | neutral.950 | 15.98 | 7 | ✅ |
| text.secondary | neutral.600 | 4.88 | 4.5 | ✅ |
| text.tertiary | neutral.500 | 3.32 | 3 | ✅ |
| text.brand | primary.600 | 4.91 | 4.5 | ✅ |
| text.success | success.600 | 4.85 | 4.5 | ✅ |
| text.warning | warning.600 | 4.86 | 4.5 | ✅ |
| text.danger | danger.600 | 4.92 | 4.5 | ✅ |
| text.info | info.600 | 4.85 | 4.5 | ✅ |
| text.brand-subtle | primary.450 | — | — | · |
| text.success-subtle | success.450 | — | — | · |
| text.warning-subtle | warning.450 | — | — | · |
| text.danger-subtle | danger.450 | — | — | · |
| text.info-subtle | info.450 | — | — | · |
| text.on-brand | white | 6.79 | 4.5 | ✅ |
| text.on-success | white | 6.70 | 4.5 | ✅ |
| text.on-warning | white | 6.72 | 4.5 | ✅ |
| text.on-danger | white | 6.80 | 4.5 | ✅ |
| text.on-info | white | 6.70 | 4.5 | ✅ |
| text.on-inverse | neutral.025 | 18.11 | 4.5 | ✅ |
| text.link.default | primary.600 | 4.91 | 4.5 | ✅ |
| text.link.hover | primary.650 | 5.99 | 4.5 | ✅ |
| text.link.visited | primary.700 | 7.21 | 4.5 | ✅ |
| text.link.focused | primary.600 | 4.91 | 4.5 | ✅ |
| icon.primary | neutral.950 | 15.98 | 7 | ✅ |
| icon.secondary | neutral.600 | 4.88 | 4.5 | ✅ |
| icon.tertiary | neutral.500 | 3.32 | 3 | ✅ |
| icon.brand | primary.600 | 4.91 | 4.5 | ✅ |
| icon.success | success.600 | 4.85 | 4.5 | ✅ |
| icon.warning | warning.600 | 4.86 | 4.5 | ✅ |
| icon.danger | danger.600 | 4.92 | 4.5 | ✅ |
| icon.info | info.600 | 4.85 | 4.5 | ✅ |
| icon.brand-subtle | primary.450 | — | — | · |
| icon.success-subtle | success.450 | — | — | · |
| icon.warning-subtle | warning.450 | — | — | · |
| icon.danger-subtle | danger.450 | — | — | · |
| icon.info-subtle | info.450 | — | — | · |
| icon.on-brand | white | 6.79 | 4.5 | ✅ |
| icon.on-success | white | 6.70 | 4.5 | ✅ |
| icon.on-warning | white | 6.72 | 4.5 | ✅ |
| icon.on-danger | white | 6.80 | 4.5 | ✅ |
| icon.on-info | white | 6.70 | 4.5 | ✅ |
| icon.on-inverse | neutral.025 | 18.11 | 4.5 | ✅ |
| icon.link.default | primary.600 | 4.91 | 4.5 | ✅ |
| icon.link.hover | primary.650 | 5.99 | 4.5 | ✅ |
| icon.link.visited | primary.700 | 7.21 | 4.5 | ✅ |
| icon.link.focused | primary.600 | 4.91 | 4.5 | ✅ |
| border.primary | neutral.200 | — | — | · |
| border.secondary | neutral.450 | — | — | · |
| border.inverse | neutral.800 | — | — | · |
| border.brand | primary.500 | 3.77 | 3 | ✅ |
| border.success | success.500 | 3.79 | 3 | ✅ |
| border.warning | warning.500 | 3.79 | 3 | ✅ |
| border.danger | danger.500 | 3.76 | 3 | ✅ |
| border.info | info.500 | 3.75 | 3 | ✅ |
| border.focus | primary.600 | 5.59 | 3 | ✅ |

## harbor — colour mode: dark

| role | → step | contrast | floor | result |
|---|---|---|---|---|
| background.primary | neutral.950 | — | — | · |
| background.secondary | neutral.900 | — | — | · |
| background.tertiary | neutral.850 | — | — | · |
| background.inverse.primary | neutral.025 | — | — | · |
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
| foreground.success | success.450 | 4.67 | 4.5 | ✅ |
| foreground.warning | warning.450 | 4.62 | 4.5 | ✅ |
| foreground.info | info.450 | 4.63 | 4.5 | ✅ |
| foreground.brand-subtle | primary.900 | — | — | · |
| foreground.success-subtle | success.900 | — | — | · |
| foreground.warning-subtle | warning.900 | — | — | · |
| foreground.danger-subtle | danger.900 | — | — | · |
| foreground.info-subtle | info.900 | — | — | · |
| foreground.danger | danger.450 | 4.56 | 4.5 | ✅ |
| interactive.primary.fill.rest | primary.450 | 4.61 | 4.5 | ✅ |
| interactive.primary.fill.hover | primary.400 | 5.46 | 4.5 | ✅ |
| interactive.primary.fill.pressed | primary.350 | 6.37 | 4.5 | ✅ |
| interactive.primary.fill.focused | primary.400 | 5.46 | 4.5 | ✅ |
| interactive.primary.fill.selected | primary.350 | 6.37 | 4.5 | ✅ |
| interactive.primary.on-fill | neutral.950 | 5.00 | 4.5 | ✅ |
| interactive.primary.text | primary.450 | 5.00 | 4.5 | ✅ |
| interactive.primary.border | primary.500 | 4.24 | 3 | ✅ |
| interactive.destructive.fill.rest | danger.450 | 4.56 | 4.5 | ✅ |
| interactive.destructive.fill.hover | danger.400 | 5.38 | 4.5 | ✅ |
| interactive.destructive.fill.pressed | danger.350 | 6.36 | 4.5 | ✅ |
| interactive.destructive.fill.focused | danger.400 | 5.38 | 4.5 | ✅ |
| interactive.destructive.fill.selected | danger.350 | 6.36 | 4.5 | ✅ |
| interactive.destructive.on-fill | neutral.950 | 4.94 | 4.5 | ✅ |
| interactive.destructive.text | danger.450 | 4.94 | 4.5 | ✅ |
| interactive.destructive.border | danger.500 | 4.25 | 3 | ✅ |
| interactive.neutral.fill.rest | neutral.850 | — | — | · |
| interactive.neutral.fill.hover | neutral.800 | — | — | · |
| interactive.neutral.fill.pressed | neutral.750 | — | — | · |
| interactive.neutral.fill.focused | neutral.800 | — | — | · |
| interactive.neutral.fill.selected | neutral.750 | — | — | · |
| interactive.neutral.on-fill | neutral.025 | 14.96 | 4.5 | ✅ |
| interactive.neutral.text | neutral.025 | 18.11 | 4.5 | ✅ |
| interactive.neutral.border | neutral.550 | 3.51 | 3 | ✅ |
| interactive.primary.on-inverse | primary.600 | 6.33 | 4.5 | ✅ |
| interactive.destructive.on-inverse | danger.550 | 5.21 | 4.5 | ✅ |
| interactive.neutral.on-inverse | neutral.950 | 18.11 | 4.5 | ✅ |
| interactive.primary.overlay.hover | white-alpha.10 | 14.24 | 4.5 | ✅ |
| interactive.primary.overlay.pressed | white-alpha.20 | 10.05 | 4.5 | ✅ |
| interactive.primary.overlay.selected | white-alpha.20 | 10.05 | 4.5 | ✅ |
| interactive.neutral.overlay.hover | white-alpha.10 | 14.24 | 4.5 | ✅ |
| interactive.neutral.overlay.pressed | white-alpha.20 | 10.05 | 4.5 | ✅ |
| interactive.neutral.overlay.selected | white-alpha.20 | 10.05 | 4.5 | ✅ |
| interactive.destructive.overlay.hover | white-alpha.10 | 14.24 | 4.5 | ✅ |
| interactive.destructive.overlay.pressed | white-alpha.20 | 10.05 | 4.5 | ✅ |
| interactive.destructive.overlay.selected | white-alpha.20 | 10.05 | 4.5 | ✅ |
| disabled.fill | neutral.750 | — | — | · |
| disabled.on-fill | neutral.450 | 3.05 | 3 | ✅ |
| disabled.text | neutral.550 | 3.23 | 3 | ✅ |
| disabled.icon | neutral.550 | 3.23 | 3 | ✅ |
| disabled.border | neutral.750 | — | — | · |
| field.fill | neutral.900 | — | — | · |
| field.border.rest | neutral.550 | 3.51 | 3 | ✅ |
| field.border.hover | neutral.450 | 5.00 | 4.5 | ✅ |
| field.placeholder | neutral.450 | 4.61 | 4.5 | ✅ |
| text.primary | neutral.025 | 18.11 | 7 | ✅ |
| text.secondary | neutral.450 | 4.61 | 4.5 | ✅ |
| text.tertiary | neutral.550 | 3.23 | 3 | ✅ |
| text.brand | primary.450 | 4.61 | 4.5 | ✅ |
| text.success | success.450 | 4.67 | 4.5 | ✅ |
| text.warning | warning.450 | 4.62 | 4.5 | ✅ |
| text.danger | danger.450 | 4.56 | 4.5 | ✅ |
| text.info | info.450 | 4.63 | 4.5 | ✅ |
| text.brand-subtle | primary.350 | — | — | · |
| text.success-subtle | success.350 | — | — | · |
| text.warning-subtle | warning.350 | — | — | · |
| text.danger-subtle | danger.350 | — | — | · |
| text.info-subtle | info.350 | — | — | · |
| text.on-brand | neutral.950 | 5.00 | 4.5 | ✅ |
| text.on-success | neutral.950 | 5.06 | 4.5 | ✅ |
| text.on-warning | neutral.950 | 5.02 | 4.5 | ✅ |
| text.on-danger | neutral.950 | 4.94 | 4.5 | ✅ |
| text.on-info | neutral.950 | 5.02 | 4.5 | ✅ |
| text.on-inverse | neutral.950 | 18.11 | 4.5 | ✅ |
| text.link.default | primary.450 | 4.61 | 4.5 | ✅ |
| text.link.hover | primary.400 | 5.46 | 4.5 | ✅ |
| text.link.visited | primary.350 | 6.37 | 4.5 | ✅ |
| text.link.focused | primary.450 | 4.61 | 4.5 | ✅ |
| icon.primary | neutral.025 | 18.11 | 7 | ✅ |
| icon.secondary | neutral.450 | 4.61 | 4.5 | ✅ |
| icon.tertiary | neutral.550 | 3.23 | 3 | ✅ |
| icon.brand | primary.450 | 4.61 | 4.5 | ✅ |
| icon.success | success.450 | 4.67 | 4.5 | ✅ |
| icon.warning | warning.450 | 4.62 | 4.5 | ✅ |
| icon.danger | danger.450 | 4.56 | 4.5 | ✅ |
| icon.info | info.450 | 4.63 | 4.5 | ✅ |
| icon.brand-subtle | primary.350 | — | — | · |
| icon.success-subtle | success.350 | — | — | · |
| icon.warning-subtle | warning.350 | — | — | · |
| icon.danger-subtle | danger.350 | — | — | · |
| icon.info-subtle | info.350 | — | — | · |
| icon.on-brand | neutral.950 | 5.00 | 4.5 | ✅ |
| icon.on-success | neutral.950 | 5.06 | 4.5 | ✅ |
| icon.on-warning | neutral.950 | 5.02 | 4.5 | ✅ |
| icon.on-danger | neutral.950 | 4.94 | 4.5 | ✅ |
| icon.on-info | neutral.950 | 5.02 | 4.5 | ✅ |
| icon.on-inverse | neutral.950 | 18.11 | 4.5 | ✅ |
| icon.link.default | primary.450 | 4.61 | 4.5 | ✅ |
| icon.link.hover | primary.400 | 5.46 | 4.5 | ✅ |
| icon.link.visited | primary.350 | 6.37 | 4.5 | ✅ |
| icon.link.focused | primary.450 | 4.61 | 4.5 | ✅ |
| border.primary | neutral.750 | — | — | · |
| border.secondary | neutral.500 | — | — | · |
| border.inverse | neutral.200 | — | — | · |
| border.brand | primary.500 | 4.24 | 3 | ✅ |
| border.success | success.500 | 4.22 | 3 | ✅ |
| border.warning | warning.500 | 4.22 | 3 | ✅ |
| border.danger | danger.500 | 4.25 | 3 | ✅ |
| border.info | info.500 | 4.26 | 3 | ✅ |
| border.focus | primary.450 | 5.00 | 3 | ✅ |

## harbor — colour mode: hc-light

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
| foreground.brand | primary.700 | 7.21 | 7 | ✅ |
| foreground.success | success.750 | 8.43 | 7 | ✅ |
| foreground.warning | warning.700 | 7.12 | 7 | ✅ |
| foreground.info | info.700 | 7.08 | 7 | ✅ |
| foreground.brand-subtle | primary.100 | — | — | · |
| foreground.success-subtle | success.100 | — | — | · |
| foreground.warning-subtle | warning.100 | — | — | · |
| foreground.danger-subtle | danger.100 | — | — | · |
| foreground.info-subtle | info.100 | — | — | · |
| foreground.danger | danger.700 | 7.24 | 7 | ✅ |
| interactive.primary.fill.rest | primary.700 | 7.21 | 7 | ✅ |
| interactive.primary.fill.hover | primary.750 | 8.53 | 7 | ✅ |
| interactive.primary.fill.pressed | primary.800 | 10.11 | 7 | ✅ |
| interactive.primary.fill.focused | primary.750 | 8.53 | 7 | ✅ |
| interactive.primary.fill.selected | primary.800 | 10.11 | 7 | ✅ |
| interactive.primary.on-fill | white | 9.96 | 4.5 | ✅ |
| interactive.primary.text | primary.650 | 8.28 | 7 | ✅ |
| interactive.primary.border | primary.500 | 4.58 | 4.5 | ✅ |
| interactive.destructive.fill.rest | danger.700 | 7.24 | 7 | ✅ |
| interactive.destructive.fill.hover | danger.750 | 8.73 | 7 | ✅ |
| interactive.destructive.fill.pressed | danger.800 | 10.32 | 7 | ✅ |
| interactive.destructive.fill.focused | danger.750 | 8.73 | 7 | ✅ |
| interactive.destructive.fill.selected | danger.800 | 10.32 | 7 | ✅ |
| interactive.destructive.on-fill | white | 10.01 | 4.5 | ✅ |
| interactive.destructive.text | danger.650 | 8.25 | 7 | ✅ |
| interactive.destructive.border | danger.500 | 4.57 | 4.5 | ✅ |
| interactive.neutral.fill.rest | neutral.150 | — | — | · |
| interactive.neutral.fill.hover | neutral.200 | — | — | · |
| interactive.neutral.fill.pressed | neutral.250 | — | — | · |
| interactive.neutral.fill.focused | neutral.200 | — | — | · |
| interactive.neutral.fill.selected | neutral.250 | — | — | · |
| interactive.neutral.on-fill | black | 13.36 | 4.5 | ✅ |
| interactive.neutral.text | black | 21.00 | 7 | ✅ |
| interactive.neutral.border | neutral.500 | 4.59 | 4.5 | ✅ |
| interactive.primary.on-inverse | primary.350 | 7.47 | 7 | ✅ |
| interactive.destructive.on-inverse | danger.350 | 7.46 | 7 | ✅ |
| interactive.neutral.on-inverse | white | 21.00 | 7 | ✅ |
| interactive.primary.overlay.hover | black-alpha.10 | 16.75 | 7 | ✅ |
| interactive.primary.overlay.pressed | black-alpha.20 | 13.08 | 7 | ✅ |
| interactive.primary.overlay.selected | black-alpha.20 | 13.08 | 7 | ✅ |
| interactive.neutral.overlay.hover | black-alpha.10 | 16.75 | 7 | ✅ |
| interactive.neutral.overlay.pressed | black-alpha.20 | 13.08 | 7 | ✅ |
| interactive.neutral.overlay.selected | black-alpha.20 | 13.08 | 7 | ✅ |
| interactive.destructive.overlay.hover | black-alpha.10 | 16.75 | 7 | ✅ |
| interactive.destructive.overlay.pressed | black-alpha.20 | 13.08 | 7 | ✅ |
| interactive.destructive.overlay.selected | black-alpha.20 | 13.08 | 7 | ✅ |
| disabled.fill | neutral.200 | — | — | · |
| disabled.on-fill | neutral.650 | 4.54 | 4.5 | ✅ |
| disabled.text | neutral.600 | 4.88 | 4.5 | ✅ |
| disabled.icon | neutral.600 | 4.88 | 4.5 | ✅ |
| disabled.border | neutral.200 | — | — | · |
| field.fill | white | — | — | · |
| field.border.rest | neutral.500 | 4.59 | 4.5 | ✅ |
| field.border.hover | neutral.650 | 8.16 | 7 | ✅ |
| field.placeholder | neutral.650 | 8.16 | 7 | ✅ |
| text.primary | black | 21.00 | 15 | ✅ |
| text.secondary | neutral.700 | 7.13 | 7 | ✅ |
| text.tertiary | neutral.600 | 4.88 | 4.5 | ✅ |
| text.brand | primary.700 | 7.21 | 7 | ✅ |
| text.success | success.750 | 8.43 | 7 | ✅ |
| text.warning | warning.700 | 7.12 | 7 | ✅ |
| text.danger | danger.700 | 7.24 | 7 | ✅ |
| text.info | info.700 | 7.08 | 7 | ✅ |
| text.brand-subtle | primary.450 | — | — | · |
| text.success-subtle | success.450 | — | — | · |
| text.warning-subtle | warning.450 | — | — | · |
| text.danger-subtle | danger.450 | — | — | · |
| text.info-subtle | info.450 | — | — | · |
| text.on-brand | white | 9.96 | 4.5 | ✅ |
| text.on-success | white | 11.65 | 4.5 | ✅ |
| text.on-warning | white | 9.84 | 4.5 | ✅ |
| text.on-danger | white | 10.01 | 4.5 | ✅ |
| text.on-info | white | 9.78 | 4.5 | ✅ |
| text.on-inverse | white | 21.00 | 7 | ✅ |
| text.link.default | primary.700 | 7.21 | 7 | ✅ |
| text.link.hover | primary.750 | 8.53 | 7 | ✅ |
| text.link.visited | primary.800 | 10.11 | 7 | ✅ |
| text.link.focused | primary.700 | 7.21 | 7 | ✅ |
| icon.primary | black | 21.00 | 15 | ✅ |
| icon.secondary | neutral.700 | 7.13 | 7 | ✅ |
| icon.tertiary | neutral.600 | 4.88 | 4.5 | ✅ |
| icon.brand | primary.700 | 7.21 | 7 | ✅ |
| icon.success | success.750 | 8.43 | 7 | ✅ |
| icon.warning | warning.700 | 7.12 | 7 | ✅ |
| icon.danger | danger.700 | 7.24 | 7 | ✅ |
| icon.info | info.700 | 7.08 | 7 | ✅ |
| icon.brand-subtle | primary.450 | — | — | · |
| icon.success-subtle | success.450 | — | — | · |
| icon.warning-subtle | warning.450 | — | — | · |
| icon.danger-subtle | danger.450 | — | — | · |
| icon.info-subtle | info.450 | — | — | · |
| icon.on-brand | white | 9.96 | 4.5 | ✅ |
| icon.on-success | white | 11.65 | 4.5 | ✅ |
| icon.on-warning | white | 9.84 | 4.5 | ✅ |
| icon.on-danger | white | 10.01 | 4.5 | ✅ |
| icon.on-info | white | 9.78 | 4.5 | ✅ |
| icon.on-inverse | white | 21.00 | 7 | ✅ |
| icon.link.default | primary.700 | 7.21 | 7 | ✅ |
| icon.link.hover | primary.750 | 8.53 | 7 | ✅ |
| icon.link.visited | primary.800 | 10.11 | 7 | ✅ |
| icon.link.focused | primary.700 | 7.21 | 7 | ✅ |
| border.primary | neutral.500 | — | — | · |
| border.secondary | neutral.700 | — | — | · |
| border.inverse | neutral.500 | — | — | · |
| border.brand | primary.500 | 4.58 | 4.5 | ✅ |
| border.success | success.500 | 4.60 | 4.5 | ✅ |
| border.warning | warning.500 | 4.60 | 4.5 | ✅ |
| border.danger | danger.500 | 4.57 | 4.5 | ✅ |
| border.info | info.500 | 4.56 | 4.5 | ✅ |
| border.focus | primary.700 | 9.96 | 4.5 | ✅ |

## harbor — colour mode: hc-dark

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
| foreground.brand | primary.300 | 7.44 | 7 | ✅ |
| foreground.success | success.300 | 7.65 | 7 | ✅ |
| foreground.warning | warning.300 | 7.34 | 7 | ✅ |
| foreground.info | info.300 | 7.50 | 7 | ✅ |
| foreground.brand-subtle | primary.900 | — | — | · |
| foreground.success-subtle | success.900 | — | — | · |
| foreground.warning-subtle | warning.900 | — | — | · |
| foreground.danger-subtle | danger.900 | — | — | · |
| foreground.info-subtle | info.900 | — | — | · |
| foreground.danger | danger.300 | 7.39 | 7 | ✅ |
| interactive.primary.fill.rest | primary.300 | 7.44 | 7 | ✅ |
| interactive.primary.fill.hover | primary.250 | 8.62 | 7 | ✅ |
| interactive.primary.fill.pressed | primary.200 | 9.93 | 7 | ✅ |
| interactive.primary.fill.focused | primary.250 | 8.62 | 7 | ✅ |
| interactive.primary.fill.selected | primary.200 | 9.93 | 7 | ✅ |
| interactive.primary.on-fill | black | 8.72 | 4.5 | ✅ |
| interactive.primary.text | primary.350 | 7.47 | 7 | ✅ |
| interactive.primary.border | primary.500 | 4.58 | 4.5 | ✅ |
| interactive.destructive.fill.rest | danger.300 | 7.39 | 7 | ✅ |
| interactive.destructive.fill.hover | danger.250 | 8.63 | 7 | ✅ |
| interactive.destructive.fill.pressed | danger.200 | 9.95 | 7 | ✅ |
| interactive.destructive.fill.focused | danger.250 | 8.63 | 7 | ✅ |
| interactive.destructive.fill.selected | danger.200 | 9.95 | 7 | ✅ |
| interactive.destructive.on-fill | black | 8.67 | 4.5 | ✅ |
| interactive.destructive.text | danger.350 | 7.46 | 7 | ✅ |
| interactive.destructive.border | danger.500 | 4.60 | 4.5 | ✅ |
| interactive.neutral.fill.rest | neutral.850 | — | — | · |
| interactive.neutral.fill.hover | neutral.800 | — | — | · |
| interactive.neutral.fill.pressed | neutral.750 | — | — | · |
| interactive.neutral.fill.focused | neutral.800 | — | — | · |
| interactive.neutral.fill.selected | neutral.750 | — | — | · |
| interactive.neutral.on-fill | white | 16.03 | 4.5 | ✅ |
| interactive.neutral.text | white | 21.00 | 7 | ✅ |
| interactive.neutral.border | neutral.500 | 4.57 | 4.5 | ✅ |
| interactive.primary.on-inverse | primary.650 | 8.28 | 7 | ✅ |
| interactive.destructive.on-inverse | danger.650 | 8.25 | 7 | ✅ |
| interactive.neutral.on-inverse | black | 21.00 | 7 | ✅ |
| interactive.primary.overlay.hover | white-alpha.10 | 17.49 | 7 | ✅ |
| interactive.primary.overlay.pressed | white-alpha.20 | 12.63 | 7 | ✅ |
| interactive.primary.overlay.selected | white-alpha.20 | 12.63 | 7 | ✅ |
| interactive.neutral.overlay.hover | white-alpha.10 | 17.49 | 7 | ✅ |
| interactive.neutral.overlay.pressed | white-alpha.20 | 12.63 | 7 | ✅ |
| interactive.neutral.overlay.selected | white-alpha.20 | 12.63 | 7 | ✅ |
| interactive.destructive.overlay.hover | white-alpha.10 | 17.49 | 7 | ✅ |
| interactive.destructive.overlay.pressed | white-alpha.20 | 12.63 | 7 | ✅ |
| interactive.destructive.overlay.selected | white-alpha.20 | 12.63 | 7 | ✅ |
| disabled.fill | neutral.750 | — | — | · |
| disabled.on-fill | neutral.300 | 4.89 | 4.5 | ✅ |
| disabled.text | neutral.450 | 4.61 | 4.5 | ✅ |
| disabled.icon | neutral.450 | 4.61 | 4.5 | ✅ |
| disabled.border | neutral.750 | — | — | · |
| field.fill | black | — | — | · |
| field.border.rest | neutral.500 | 4.57 | 4.5 | ✅ |
| field.border.hover | neutral.350 | 7.49 | 7 | ✅ |
| field.placeholder | neutral.350 | 7.49 | 7 | ✅ |
| text.primary | white | 21.00 | 15 | ✅ |
| text.secondary | neutral.300 | 7.39 | 7 | ✅ |
| text.tertiary | neutral.450 | 4.61 | 4.5 | ✅ |
| text.brand | primary.300 | 7.44 | 7 | ✅ |
| text.success | success.300 | 7.65 | 7 | ✅ |
| text.warning | warning.300 | 7.34 | 7 | ✅ |
| text.danger | danger.300 | 7.39 | 7 | ✅ |
| text.info | info.300 | 7.50 | 7 | ✅ |
| text.brand-subtle | primary.350 | — | — | · |
| text.success-subtle | success.350 | — | — | · |
| text.warning-subtle | warning.350 | — | — | · |
| text.danger-subtle | danger.350 | — | — | · |
| text.info-subtle | info.350 | — | — | · |
| text.on-brand | black | 8.72 | 4.5 | ✅ |
| text.on-success | black | 8.98 | 4.5 | ✅ |
| text.on-warning | black | 8.61 | 4.5 | ✅ |
| text.on-danger | black | 8.67 | 4.5 | ✅ |
| text.on-info | black | 8.80 | 4.5 | ✅ |
| text.on-inverse | black | 21.00 | 7 | ✅ |
| text.link.default | primary.300 | 7.44 | 7 | ✅ |
| text.link.hover | primary.250 | 8.62 | 7 | ✅ |
| text.link.visited | primary.200 | 9.93 | 7 | ✅ |
| text.link.focused | primary.300 | 7.44 | 7 | ✅ |
| icon.primary | white | 21.00 | 15 | ✅ |
| icon.secondary | neutral.300 | 7.39 | 7 | ✅ |
| icon.tertiary | neutral.450 | 4.61 | 4.5 | ✅ |
| icon.brand | primary.300 | 7.44 | 7 | ✅ |
| icon.success | success.300 | 7.65 | 7 | ✅ |
| icon.warning | warning.300 | 7.34 | 7 | ✅ |
| icon.danger | danger.300 | 7.39 | 7 | ✅ |
| icon.info | info.300 | 7.50 | 7 | ✅ |
| icon.brand-subtle | primary.350 | — | — | · |
| icon.success-subtle | success.350 | — | — | · |
| icon.warning-subtle | warning.350 | — | — | · |
| icon.danger-subtle | danger.350 | — | — | · |
| icon.info-subtle | info.350 | — | — | · |
| icon.on-brand | black | 8.72 | 4.5 | ✅ |
| icon.on-success | black | 8.98 | 4.5 | ✅ |
| icon.on-warning | black | 8.61 | 4.5 | ✅ |
| icon.on-danger | black | 8.67 | 4.5 | ✅ |
| icon.on-info | black | 8.80 | 4.5 | ✅ |
| icon.on-inverse | black | 21.00 | 7 | ✅ |
| icon.link.default | primary.300 | 7.44 | 7 | ✅ |
| icon.link.hover | primary.250 | 8.62 | 7 | ✅ |
| icon.link.visited | primary.200 | 9.93 | 7 | ✅ |
| icon.link.focused | primary.300 | 7.44 | 7 | ✅ |
| border.primary | neutral.500 | — | — | · |
| border.secondary | neutral.250 | — | — | · |
| border.inverse | neutral.500 | — | — | · |
| border.brand | primary.500 | 4.58 | 4.5 | ✅ |
| border.success | success.500 | 4.56 | 4.5 | ✅ |
| border.warning | warning.500 | 4.56 | 4.5 | ✅ |
| border.danger | danger.500 | 4.60 | 4.5 | ✅ |
| border.info | info.500 | 4.61 | 4.5 | ✅ |
| border.focus | primary.300 | 8.72 | 4.5 | ✅ |

## harbor — dimension axis

Grid (36 primitives, px): 0, 1, 2, 4, 6, 8, 12, 16, 20, 24, 28, 32, 36, 40, 44, 48, 52, 56, 60, 64, 68, 72, 76, 80, 84, 88, 92, 96, 100, 104, 108, 112, 116, 120, 124, 128

Space — numbered multiplier, `8px` rhythm (reference tier, density-free):

| token | px | × base |
|---|---|---|
| space.0 | 0 | 0× |
| space.025 | 2 | 0.25× |
| space.050 | 4 | 0.5× |
| space.075 | 6 | 0.75× |
| space.100 | 8 | 1× |
| space.150 | 12 | 1.5× |
| space.200 | 16 | 2× |
| space.250 | 20 | 2.5× |
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

