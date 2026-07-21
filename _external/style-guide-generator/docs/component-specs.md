# Style Guide Component Specifications

This document captures the exact specifications from the user's Figma design for programmatic recreation.

---

## Component Set: `_style-guide-swatches`

**Purpose:** Color swatch display cells for the style guide grid.

### Variants

| Variant | Size | Description |
|---------|------|-------------|
| `type=default, style=square` | 80x80px | Solid filled rectangle |
| `type=text, style=square` | 80x80px | Rectangle with "Aa" text for typography preview |
| `type=icon, style=square` | 80x80px | Rectangle with diamond icon for icon color preview |

### Specifications

**Default Swatch:**
```
- Type: RECTANGLE
- Size: 80x80px
- Corner radius: 0
- Fill: Bound to selected Figma variable (color)
```

**Text Swatch:**
```
- Type: FRAME (auto-layout)
- Size: 80x80px
- Layout: VERTICAL, center-center alignment
- Padding: 40px horizontal, 0 vertical
- Gap: 0
- Fill: Bound to selected Figma variable (color)
- Child: TEXT node
  - Characters: "Aa"
  - Font: Inter Medium, 24px
  - Color: White (#FFFFFF)
  - Alignment: CENTER
```

**Icon Swatch:**
```
- Type: FRAME (auto-layout)
- Size: 80x80px
- Layout: VERTICAL, center-center alignment
- Padding: 40px horizontal, 0 vertical
- Fill: Bound to selected Figma variable (color)
- Child: RECTANGLE (diamond)
  - Size: 16x16px
  - Rotation: 45 degrees
  - Corner radius: 2px
  - Color: White (#FFFFFF)
```

---

## Component Set: `_style-guide-text-cells`

**Purpose:** Text label cells for the style guide grid (headers and data cells).

### Properties

| Property | Values | Description |
|----------|--------|-------------|
| `color` | white, secondary, dark, light | Background color variant |
| `textAlign` | center, left | Text horizontal alignment |
| `type` | default, header | Cell type (affects font weight) |
| `padding` | default, extra right | Padding configuration |
| `swatchType` | Default | Swatch style indicator |

### Background Colors

| Variant | Token | Fallback |
|---------|-------|----------|
| white | `--pds/color/background/primary/default` | #FFFFFF |
| secondary | `--pds/color/surface/primary/default` | #F8F8F8 |
| dark | `--pds/color/background/primary/inverse` | #0F1115 |
| light | `--pds/color/background/primary/default` | #FFFFFF |

### Text Colors

| Background | Text Color Token | Fallback |
|------------|------------------|----------|
| white/secondary/light | black | #000000 |
| dark | `--pds/color/text/primary/inverse` | #FFFFFF |

### Text Styles

| Type | Font | Size | Weight | Style Name |
|------|------|------|--------|------------|
| default | Inter Medium | 16px | 500 | `_style-guide/cell-default` |
| header | Inter Bold | 16px | 700 | `_style-guide/header-default` |

### Padding Specifications

| Padding Variant | Horizontal | Vertical |
|-----------------|------------|----------|
| default (center) | 40px | 24px |
| default (left) | 24px left, 40px right | 24px |
| extra right | 24px left, 96px right | 24px |

### Cell Structure

```
- Type: FRAME (auto-layout)
- Size: Hug contents (min 149x67px typical)
- Layout: VERTICAL, alignment varies by textAlign
- Gap: 0
- Fill: Background color based on `color` property
- Child: TEXT node
  - Font: Based on `type` property
  - Color: Based on background
  - Alignment: Based on `textAlign`
```

---

## Alias Variant (Value Column)

**Purpose:** Special text cell for displaying aliased variable references with a link icon.

### Structure

```
- Type: COMPONENT
- Name: "alias"
- Size: Hug width, Fill height (when in grid)
- Layout: HORIZONTAL auto-layout
- Alignment: CENTER_CENTER
- Padding: 24px vertical, 40px left, 40px right
- Gap: 8px
- Fill: White (#FFFFFF)
```

### Children

1. **Link Icon Container** (`linkIcon`)
   ```
   - Type: FRAME (auto-layout)
   - Size: 16x16px
   - Layout: Absolute positioning for vector paths
   - Children: 3 VectorNode paths (chain link icon)
     - Fill: #656A7A
     - No stroke
   ```

2. **Alias Pill Container** (`aliasPill`)
   ```
   - Type: FRAME (auto-layout)
   - Layout: HORIZONTAL, CENTER_CENTER
   - Padding: 4px vertical, 8px horizontal
   - Corner Radius: 4px
   - Fill: #EBEBEB (light gray)
   - Child: TEXT node
     - Characters: Alias path (e.g., "global/brand/primary/500")
     - Font: Inter Medium, 14px
     - Color: #000000
   ```

### Link Icon SVG Paths

The link icon uses three filled vector paths from `images/link.svg`:
- Path 1: Top-right portion of chain link
- Path 2: Bottom-left portion of chain link
- Path 3: Diagonal connection bar

### Usage

The alias variant is used in the Value column when:
- `aliasing` option is set to "alias" or "both"
- The variable is aliased to another variable

When `aliasing` is "both", an alias row appears above the resolved value row.

---

## Grid Layout Structure

**Frame Name:** "Color Style Guide - [Collection Name]" (dynamic based on collection)

### Grid Configuration

```typescript
// Figma CSS Grid implementation
mainFrame.layoutMode = 'GRID';
mainFrame.layoutSizingHorizontal = 'HUG';  // Frame hugs content width
mainFrame.layoutSizingVertical = 'HUG';    // Frame hugs content height

// Column definitions: Step, Swatch, Value, Token
mainFrame.gridColumnSizes = [
  { type: 'AUTO', isMinContent: true },    // Step: fit content
  { type: 'AUTO', isMinContent: true },    // Swatch: fit content (80px)
  { type: 'FR', value: 1 },                // Value: 1fr (flexible)
  { type: 'FR', value: 2 },                // Token: 2fr (more flexible)
];

// Row definitions: AUTO for all rows
mainFrame.gridRowSizes = Array(rowCount).fill({ type: 'AUTO', isMinContent: true });

// Gap between cells
mainFrame.gridColumnGap = 2;
mainFrame.gridRowGap = 2;

// Visual styling
mainFrame.cornerRadius = 8;
mainFrame.clipsContent = true;
```

### CSS Grid Equivalent

```css
display: grid;
grid-template-columns: auto auto 1fr 2fr;
grid-template-rows: repeat(N, auto);
gap: 2px;
border-radius: 8px;
overflow: clip;
```

### Column Layout

| Column | Index | Content | Cell Type |
|--------|-------|---------|-----------|
| Step | 1 | Scale step number (025, 050, etc.) | text-cell (center) |
| Swatch | 2 | Color swatch | swatch (default/text/icon) |
| Value | 3 | Hex/RGB value | text-cell (left) |
| Token | 4 | Token name | text-cell (left, extra right padding) |

### Row Layout

| Row | Type | Column 1 | Column 2 | Column 3 | Column 4 |
|-----|------|----------|----------|----------|----------|
| 1 | Header | "Step" | (empty) | "Value" | "Token" |
| 2+ | Data | Step value | Color swatch | Color value | Token name |

### Cell Placement (grid-area)

```
Header row:  [1/1] Step    [1/2] empty   [1/3] Value   [1/4] Token
Data row 1:  [2/1] 025     [2/2] swatch  [2/3] #HEX    [2/4] token-name
Data row 2:  [3/1] 050     [3/2] swatch  [3/3] #HEX    [3/4] token-name
...
```

---

## Text Styles to Create

| Style Name | Family | Weight | Size | Line Height |
|------------|--------|--------|------|-------------|
| `_style-guide/header-default` | Inter | Bold (700) | 16px | 100% |
| `_style-guide/cell-default` | Inter | Medium (500) | 16px | 100% |

---

## Implementation Notes

### Component Creation Strategy

Since components must be built programmatically (not imported from external file):

1. **Check for existing components** before creating
   - Search for component set by name
   - If exists, use existing; if not, create new

2. **Component naming convention**
   - Swatches: `_style-guide-swatches`
   - Text cells: `_style-guide-text-cells`
   - Prefix with underscore to indicate internal/utility

3. **Page placement**
   - Create "Style Guide Components" page if not exists
   - Place at bottom of page list
   - Store components on this page

### Variable Binding

**IMPORTANT:** Swatches should be bound to actual Figma variables, NOT hardcoded colors.

```typescript
// Binding a fill to a variable
const variable = figma.variables.getVariableById(variableId);
swatch.fills = [{
  type: 'SOLID',
  color: { r: 0, g: 0, b: 0 }, // Fallback
  boundVariables: {
    color: {
      type: 'VARIABLE_ALIAS',
      id: variable.id
    }
  }
}];
```

### Grid vs Auto-Layout

The example uses **Figma's Grid Layout** (CSS Grid equivalent), NOT auto-layout.

```typescript
// Enable grid layout on frame
frame.layoutMode = "NONE";
frame.layoutGrids = [/* grid configuration */];

// Position children using layoutGridCells or manual positioning
// Note: As of 2024, Figma's grid layout API may require specific handling
```

**Alternative approach:** If grid layout API is complex, consider using nested auto-layout frames:
- Outer frame: VERTICAL auto-layout (rows)
- Each row: HORIZONTAL auto-layout (cells)
- Apply consistent sizing to simulate grid behavior

---

## Generation Flow

1. **Setup Phase** (one-time, behind the scenes)
   - Find or create "Style Guide Components" page
   - Find or create `_style-guide-swatches` component set
   - Find or create `_style-guide-text-cells` component set
   - Find or create text styles

2. **Generation Phase** (per user action)
   - Create container frame with grid layout
   - Create header row with text cells
   - For each selected variable:
     - Create data row
     - Instance swatch component, bind to variable
     - Instance text cells with appropriate values
   - Position frame near viewport center

3. **Cleanup Phase**
   - Select generated frame
   - Notify UI of success/failure
