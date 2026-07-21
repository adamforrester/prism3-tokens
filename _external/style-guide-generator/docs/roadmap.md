# Project Roadmap

## Current State (Updated)

**Phase 0 and Phase 1 are complete.** The plugin now has:
- Modern build system (esbuild) with modular code structure
- Working UI with Figma Variables API integration
- Collection/Mode selection that loads real variables
- Hierarchical variable display with cascading checkboxes
- Select All/Deselect All functionality
- Complete Styling Options UI (dropdowns and toggles)
- Smooth toggle switch animations

**Next Priority:** Phase 2 - Core Style Guide Generation

---

## Phase 0: Project Setup & Architecture ✅ COMPLETE

- [x] Install and configure esbuild
- [x] Restructure to `src/plugin/` and `src/ui/`
- [x] Update TypeScript config to output to `/dist`
- [x] Update manifest to point to `/dist`
- [x] Extract CSS into separate files
- [x] Create message type definitions
- [x] Verify plugin works after migration

---

## Phase 1: Bug Fixes & UI Polish ✅ COMPLETE

- [x] Fix variable display (name only, no path)
- [x] Add checkboxes to group headers with cascading behavior
- [x] Add secondary button CSS
- [x] Fix Select All button
- [x] Update Styling Options section with new options
- [x] Add toggle switch animation
- [x] Standardize message passing patterns

---

## Phase 2: Core Style Guide Generation ✅ COMPLETE

**Goal:** Implement the primary plugin functionality - generating style guides on the Figma canvas.

### 2.1 Backend Implementation ✅

1. **Implemented `generate-style-guide` message handler**
   - Receives selected variables and options from UI
   - Creates parent frame with CSS Grid layout
   - Generates component sets for swatches and text cells

2. **Frame generation utilities** ✅
   - Created reusable functions for Figma node creation
   - Color conversion (variable values to Hex/RGB/HSL/HSB)
   - Text node creation with Inter font loading
   - Component set creation with variants

3. **Error handling and feedback** ✅
   - Returns success/failure status to UI
   - Shows Figma notification on completion
   - Graceful error handling with user feedback

### 2.2 Template: Standard ✅

CSS Grid layout with 4 columns:
```
┌─────────────────────────────────────────────────┐
│ Step  │ Swatch │ Value    │ Token              │
├───────┼────────┼──────────┼────────────────────┤
│ 025   │ [████] │ #FFFFFF  │ brand/primary/025  │
│ 050   │ [████] │ #F5F5F5  │ brand/primary/050  │
│ ...   │        │          │                    │
└─────────────────────────────────────────────────┘
```

### 2.3 Styling Options Integration ✅

All UI options now connected to generation:
- **Display style** → Template selection (standard, text, icon swatches)
- **Color value** → Hex/RGB/HSL/HSB format in labels
- **Aliasing** → Show alias path, resolved value, or both
- **Show description** → (Placeholder for future)
- **Add title cell** → Include/exclude header row

### 2.4 Recent Improvements ✅

- **CSS Grid Layout** - Uses native Figma grid mode for proper cell sizing
- **HUG Sizing** - Main frame hugs content rather than fixed width
- **Alias Variant** - Special cell with link icon and pill for alias paths
- **Alias Resolution** - Walks full alias chain to resolve final color value
- **Link Icon** - Custom SVG icon rendered as vector paths
- **Extra Right Padding** - Token column uses extended padding variant

### Definition of Done ✅
- [x] User can select variables and click "Generate Style Guide"
- [x] Frame appears on canvas near current viewport
- [x] Colors display correctly with variable binding
- [x] Labels show token names and values
- [x] Options from UI affect the output
- [x] Aliased variables display correctly with link icon
- [x] Resolved values show in Value column for aliases

---

## Phase 3: Additional Templates

### Templates to Implement

| Template | Description | Use Case |
|----------|-------------|----------|
| Standard | Vertical list with swatches | General documentation |
| Scale | Horizontal rows by color family | Primitive color scales |
| Text color | Text samples on backgrounds | Typography colors |
| Border color | Shapes with colored strokes | Border tokens |
| Transparency | Overlapping opacity demo | Alpha/transparency tokens |
| Icon color | Icon examples with fills | Icon color tokens |

### Definition of Done
- [ ] User can select template type from dropdown
- [ ] Each template generates appropriate visual layout
- [ ] Templates handle edge cases (missing data, long names)

---

## Phase 4: Variable Type Support

Extend beyond COLOR variables:

| Type | Visual Representation |
|------|----------------------|
| COLOR | Filled rectangles with hex values |
| NUMBER | Spacing boxes, dimension indicators |
| STRING | Text samples (font families, etc.) |
| BOOLEAN | Toggle/checkbox indicators |

### Tasks
- [ ] Update backend to load all variable types
- [ ] Wire segmented control to filter by type
- [ ] Create appropriate visualizations for each type

---

## Phase 5: Export & Polish

### Export Functionality
- [ ] Export to CSS custom properties
- [ ] Export to JSON (DTCG format)
- [ ] Export to SCSS variables
- [ ] Copy to clipboard / Download file

### UX Polish
- [ ] Loading states during generation
- [ ] Progress feedback for large exports
- [ ] State persistence (remember settings)
- [ ] Keyboard shortcuts
- [ ] Error messaging improvements

---

## Implementation Timeline

| Phase | Status | Focus |
|-------|--------|-------|
| 0 | ✅ Complete | Build tooling, project structure |
| 1 | ✅ Complete | Bug fixes, UI polish |
| 2 | ✅ Complete | Core style guide generation (Color variables) |
| 3 | 🔜 Next | Typography variables & text styles |
| 4 | Planned | Dimensions, Spacing, Borders |
| 5 | Planned | Effects, Export, Polish |

---

## Technical Considerations for Phase 2

### Figma API for Frame Generation

```typescript
// Create main container
const frame = figma.createFrame();
frame.name = "Style Guide";
frame.layoutMode = "VERTICAL";
frame.primaryAxisSizingMode = "AUTO";
frame.counterAxisSizingMode = "AUTO";
frame.paddingTop = frame.paddingBottom = 24;
frame.paddingLeft = frame.paddingRight = 24;
frame.itemSpacing = 16;

// Create color swatch
const swatch = figma.createRectangle();
swatch.resize(64, 64);
swatch.fills = [{ type: 'SOLID', color: { r: 0, g: 0, b: 1 } }];

// Create text label
const label = figma.createText();
await figma.loadFontAsync({ family: "Inter", style: "Regular" });
label.characters = "token-name";
```

### Color Value Conversion

Variables store colors as `{ r, g, b, a }` with values 0-1. Need utilities for:
- Converting to hex string
- Converting to RGB/RGBA string
- Converting to HSL string

### Variable Alias Resolution

When `aliasing` option is set:
- "Show alias" → Display the variable reference path
- "Show resolved value" → Display the actual color value
- "Show both" → Display both with clear formatting

---

## Success Metrics

- Generation time: < 3 seconds for 50 variables
- User can go from plugin open to generated guide in < 5 clicks
- Generated output uses proper Figma auto-layout
- Output is visually clean and matches design system quality
