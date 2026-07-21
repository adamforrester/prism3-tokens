# Font Variables Tab - Implementation Plan

## Goal
Replace the "Type Variables" placeholder tab with a fully functional "Font Variables" tab that loads font-scoped variables from Figma collections, displays them with configurable options, and generates a style guide table with optional example cells.

## Key Design Decisions

### Variable Scoping
Figma variables have a `scopes` property. We filter by these typography-related scopes:
- `FONT_FAMILY` (STRING type) - Font family names
- `FONT_SIZE` (FLOAT type) - Font sizes
- `FONT_WEIGHT` (FLOAT type) - Numeric weights (400, 700)
- `FONT_STYLE` (STRING type) - Style names ("Bold", "Regular") — this covers string-based font weights
- `LETTER_SPACING` (FLOAT type) - Letter spacing values
- `LINE_HEIGHT` (FLOAT type) - Line height values

### Font Weight Handling
Font weight can be either:
- A STRING variable scoped to `FONT_STYLE` (e.g., "Bold", "Regular")
- A FLOAT variable scoped to `FONT_WEIGHT` (e.g., 400, 700)

We load BOTH types and let the user select from all font-scoped variables in their collection.

### Display Style → Example Behavior
| Display Style | Example Column | Example Content |
|--------------|---------------|-----------------|
| Standard | No | — |
| Font Family | Yes | "Abc 123" in that font family |
| Font Size | Yes | "Abc 123" at that font size |
| Font Weight | Yes | "Abc 123" in that font weight |
| Letter Spacing | No | — |
| Line Height | No | — |

### REM Values
Applies to FLOAT variables only (Font Size, Font Weight as number, Letter Spacing, Line Height).
Does NOT apply to STRING variables (Font Family, Font Weight as string).

### Display Aliases
When enabled and no alias exists for a variable, show the default (value-only) cell — skip the alias pill.

---

## Phases

### Phase 1: Rename Tab & Update HTML
**Status:** `pending`
**Files:** `src/ui/index.html`

- Rename "Type Variables" → "Font Variables" in tab bar
- Replace "Coming Soon" placeholder with full tab content
- Add Collection/Mode selector row (same pattern as Color/Dimension)
- Add Section header: "Font Variables" / "Select font variables to include"
- Add Select All button
- Add Variable selection frame
- Add Styling Options:
  - Display Type dropdown: Standard, Font family, Font size, Font weight, Letter spacing, Line height
  - Table header dropdown: Dark, Light
  - Add REM values toggle
  - Display Aliases toggle
  - Show Description toggle
- Add Generate button

### Phase 2: Update Message Types
**Status:** `pending`
**Files:** `src/plugin/messages.ts`

- Add `FontVariableGuideOptions` interface:
  - `displayType`: `'standard' | 'font-family' | 'font-size' | 'font-weight' | 'letter-spacing' | 'line-height'`
  - `tableHeader`: `'light' | 'dark'`
  - `addRemValues`: boolean
  - `displayAliases`: boolean
  - `showDescription`: boolean
- Add `GenerateFontVariableGuideMessage` interface
- Update `UIMessage` union type

### Phase 3: Update Variable Loading with Scope Filtering
**Status:** `pending`
**Files:** `src/plugin/code.ts`

- Add a new message handler: `load-font-variables`
- Create `loadFontVariablesFromCollection()` function that:
  - Loads ALL variables from the collection (both STRING and FLOAT)
  - Filters to only those with font-related scopes: `FONT_FAMILY`, `FONT_SIZE`, `FONT_WEIGHT`, `FONT_STYLE`, `LETTER_SPACING`, `LINE_HEIGHT`
  - Returns them with scope info included in the processed variable data
- Add `generate-font-variable-guide` message handler

### Phase 4: Update UI Main.ts
**Status:** `pending`
**Files:** `src/ui/main.ts`

- Update `TabId` if needed (keep `'type-variables'` as internal ID or rename)
- Update `TAB_VARIABLE_TYPES` — the font variables tab needs special handling since it spans STRING and FLOAT types
- Add `getFontVariableOptions()` function to read display options
- Update `generateStyleGuide()` to route font variables tab to its own generator
- Add `generateFontVariableGuide()` UI function
- Wire up Collection/Mode dropdowns for the font variables tab (add to `populateCollectionDropdown` tabs list)

### Phase 5: Create Font Variable Generator
**Status:** `pending`
**Files:** `src/plugin/style-guide-generator.ts`

- Create `generateFontVariableGuide()` function
- Columns: Name, Value, [REMs], [Alias], Token, [Description], [Example]
  - Example column only shown when display type is font-family, font-size, or font-weight
  - REMs column: only for FLOAT variables, skipped for STRING variables
- Create `createFontExampleCell()` helper function:
  - Font Family: "Abc 123" rendered in that font family (regular weight, 16px)
  - Font Size: "Abc 123" rendered at that font size (Inter font)
  - Font Weight: "Abc 123" rendered with that weight (Inter font, standard size)
- Handle alias display using existing `type=alias` cell variant (just show value without alias pill when no alias exists)

### Phase 6: Build & Test
**Status:** `pending`
**Files:** All

- Run build
- Fix any TypeScript errors
- Test in Figma

---

## Errors Encountered
| Error | Attempt | Resolution |
|-------|---------|------------|

---

## Files Modified Tracker
| File | Phases | Changes |
|------|--------|---------|
| `src/ui/index.html` | 1 | Replace type-variables tab content |
| `src/plugin/messages.ts` | 2 | Add FontVariableGuideOptions, message types |
| `src/plugin/code.ts` | 3 | Add font variable loading with scope filter |
| `src/ui/main.ts` | 4 | Add font variable options, generation routing |
| `src/plugin/style-guide-generator.ts` | 5 | Add generateFontVariableGuide function |
