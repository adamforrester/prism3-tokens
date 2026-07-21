# Product Backlog

## Priority Levels
- **P0:** Critical - blocking core functionality
- **P1:** High - important for MVP
- **P2:** Medium - nice to have
- **P3:** Low - future consideration

---

## Bugs

### UI Bugs

- [x] ~~**[P1] Variable display shows redundant text**~~ - Fixed: Now shows only variable name
- [x] ~~**[P1] Group headers missing checkboxes**~~ - Fixed: Groups now have checkboxes with cascading select/deselect
- [x] ~~**[P1] Secondary button variant has no CSS styles**~~ - Fixed: Added CSS for `.pds-button--secondary`
- [x] ~~**[P1] Select All button not working**~~ - Fixed: Now toggles between Select All/Deselect All
- [x] ~~**[P2] Segmented control not wired to filter variables**~~ - Fixed: Now filters by variable type (Color, Number, String, Boolean)

### Backend Bugs (Resolved)

- [x] ~~**[P1] Missing message handlers**~~ - `generate-style-guide` implemented
- [x] ~~**[P1] Text cell variant not found errors**~~ - Fixed component set recreation logic
- [x] ~~**[P1] layoutSizingHorizontal error**~~ - Fixed: append child before setting sizing
- [x] ~~**[P1] Value column empty for aliased variables**~~ - Fixed: proper alias chain resolution
- [x] ~~**[P1] Invalid callback error with vector paths**~~ - Fixed: simplified icon creation

---

## Technical Debt

### Code Quality (Completed)

- [x] ~~**[P1] Inconsistent message passing patterns**~~ - Standardized on `window.parent.postMessage`
- [x] ~~**[P1] TypeScript output to root directory**~~ - Now outputs to `/dist`
- [x] ~~**[P2] Monolithic ui.html**~~ - Extracted to modular CSS/JS with esbuild
- [x] ~~**[P1] Add build tooling (esbuild)**~~ - Complete with build/watch/typecheck scripts
- [x] ~~**[P1] Restructure project directories**~~ - Now uses `src/plugin/` and `src/ui/` structure
- [x] ~~**[P2] Type definitions for message payloads**~~ - Added in `src/plugin/messages.ts`

### Code Quality (Remaining)

- [ ] **[P2] TypeScript type warnings** - HUG sizing type issues, deprecated API warnings
- [ ] **[P2] Hardcoded tokens in ui-tokens.ts** - Well documented; consider dynamic loading later
- [ ] **[P3] Code organization** - Consider splitting style-guide-generator.ts into smaller modules

---

## Features - Color Style Guides (MVP) ✅ COMPLETE

### Core Functionality

- [x] ~~**[P0] On-canvas style guide generation**~~ - Complete with CSS Grid layout
- [x] ~~**[P1] Implement `generate-style-guide` handler**~~ - Creates Figma frames from selected variables
- [x] ~~**[P1] Swatch component set**~~ - 5 variants: default, text, icon, border, transparency
- [x] ~~**[P1] Text cell component set**~~ - Multiple variants with color, alignment, type, padding
- [x] ~~**[P1] Alias variant with link icon**~~ - Pill container with SVG link icon
- [x] ~~**[P1] Variable binding to swatches**~~ - Colors bound to actual Figma variables
- [x] ~~**[P1] Alias resolution**~~ - Walks alias chain to resolve final color value
- [x] ~~**[P1] Color format options**~~ - Hex, RGB, HSL, HSB output formats

### UI (Completed)

- [x] ~~**[P1] Dynamic variable loading**~~ - Working via Figma Variables API
- [x] ~~**[P1] Collection/Mode dropdowns**~~ - Populate from Figma, auto-load variables
- [x] ~~**[P1] Variable selection with hierarchy**~~ - Groups with cascading checkbox behavior
- [x] ~~**[P1] Select All/Deselect All**~~ - Toggle button with state tracking
- [x] ~~**[P1] Styling Options section**~~ - Display style, Color value, Aliasing, toggles

### UI (Remaining)

- [x] ~~**[P1] Variable type filtering**~~ - Implemented via tab system (Color, Text Variables, Text Styles, Dimensions)
- [ ] **[P1] Variable search/filter** - Add text input to filter variables by name
- [ ] **[P2] Collection/mode state persistence** - Remember last selected collection/mode
- [ ] **[P2] Loading states** - Show loading indicators during async operations

### Tab System ✅ COMPLETE (Phase 3.2)

- [x] ~~**[P1] Tab bar component**~~ - Four tabs: Color, Text Variables, Text Styles, Dimensions
- [x] ~~**[P1] Per-tab state management**~~ - Separate collection/mode/variables per tab
- [x] ~~**[P1] Tab content switching**~~ - Show/hide content based on active tab
- [x] ~~**[P1] Independent generation**~~ - Each tab generates its own style guide

---

## Features - Phase 3: Typography

### Typography Primitives

- [ ] **[P1] Font Family variables** - String variables scoped to FONT_FAMILY
- [ ] **[P1] Font Weight variables** - String variables scoped to FONT_WEIGHT
- [ ] **[P1] Font Size variables** - Number variables scoped to FONT_SIZE
- [ ] **[P1] Line Height variables** - Number variables scoped to LINE_HEIGHT
- [ ] **[P1] Letter Spacing variables** - Number variables scoped to LETTER_SPACING
- [ ] **[P2] Unit interpretation UI** - Dropdown for px/% /unitless selection
- [ ] **[P2] REM conversion** - Base font size input for rem calculations

### Typography Text Styles

- [ ] **[P1] Text style enumeration** - Read all local text styles
- [ ] **[P1] Text style table generation** - Composite view of all properties
- [ ] **[P2] Variable binding detection** - Show which properties are variable-bound
- [ ] **[P2] Preview text rendering** - "Aa" or sample text in each style

---

## Features - Phase 4: Dimensions & Spacing

### Generic Dimensions ✅ COMPLETE

- [x] ~~**[P1] Number variable support**~~ - Load and display number variables
- [x] ~~**[P1] Dimension table generation**~~ - Simple 3-column table (Name, Value, Token)

### Spacing

- [ ] **[P1] Spacing swatch component** - Visual bar/box representation
- [ ] **[P1] GAP-scoped variables** - Filter by variable scope
- [ ] **[P1] Spacing scale table** - Visual + value display

### Borders

- [ ] **[P1] Border radius component** - Visual corner representation
- [ ] **[P1] Border width component** - Visual stroke representation
- [ ] **[P1] CORNER_RADIUS scope filter** - Filter variables by scope
- [ ] **[P1] STROKE_FLOAT scope filter** - Filter variables by scope

---

## Features - Phase 5: Effects & Advanced

### Shadows

- [ ] **[P2] Shadow variable support** - Effect variables
- [ ] **[P2] Shadow preview component** - Visual representation

### Gradients & Color Styles

- [ ] **[P2] Color style support** - Generate from color styles (not just variables)
- [ ] **[P2] Gradient support** - Linear/radial gradient display

### Export Functionality

- [ ] **[P2] Export to CSS** - Generate CSS custom properties
- [ ] **[P2] Export to JSON** - Design Token Community Group format
- [ ] **[P2] Export to SCSS** - Sass variables format
- [ ] **[P3] Export to Tailwind config** - Generate Tailwind theme configuration

---

## Research / Discovery

- [ ] Investigate Figma's Variables REST API for external token sync
- [ ] Research accessibility testing integration (contrast ratios, etc.)
- [ ] Consider dark mode support for the plugin UI itself
- [ ] Explore component set generation patterns for new variable types
- [ ] Research text style API for reading bound variables
