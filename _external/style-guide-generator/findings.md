# Font Variables Tab - Findings

## Figma Variable Scopes for Typography
Figma variables have a `scopes` property (array of `VariableScope` values).
Typography-related scopes:
- `FONT_FAMILY` — STRING variable
- `FONT_STYLE` — STRING variable (covers named weights like "Bold")
- `FONT_SIZE` — FLOAT variable
- `FONT_WEIGHT` — FLOAT variable (numeric weights like 400, 700)
- `LETTER_SPACING` — FLOAT variable
- `LINE_HEIGHT` — FLOAT variable

## Current Architecture
- Collection-based tabs (color, dimension) use `loadVariablesFromCollection()` in code.ts
- This function filters by `resolvedType` only (COLOR or FLOAT), no scope filtering
- Font variables span BOTH STRING and FLOAT types, so we need a new loader
- The `type-variables` tab has ID `'type-variables'` in the tab bar HTML and state management

## Existing Patterns to Reuse
- Collection/Mode dropdown pattern from color & dimension tabs
- Variable selection frame with hierarchical grouping
- Text cell component set with alias variant
- Example cell pattern from `createTextStyleExampleCell()` in style-guide-generator.ts
- Grid layout pattern from dimension/color generators

## Key Difference from Other Tabs
Font variables tab must load variables of MULTIPLE types (STRING + FLOAT) filtered by scope,
whereas color loads only COLOR and dimension loads only FLOAT.
