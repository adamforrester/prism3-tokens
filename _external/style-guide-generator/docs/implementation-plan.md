# Implementation Plan

This document outlines the phased approach to completing the Style Guide Generator plugin.

## Current State Assessment

### What's Working
- Figma Variables API integration (`loadVariableCollections`, `loadVariablesFromCollection`)
- Collection/Mode dropdowns pull from **actual Figma collections** (not JSON files)
- Variables load and display in selection frame
- CSS custom properties inject into plugin UI
- Component demos functional

### What Needs Work
- UI bugs in variable display (checkboxes, text display)
- Hardcoded tokens in `code.ts` used for plugin UI theming (not user data)
- Token processor created but never integrated
- Monolithic `ui.html` file
- No build tooling for UI layer
- Core functionality (style guide generation) not implemented

### Files to Clean Up or Remove
- `token-processor.ts` - Decide: remove or repurpose
- `/tokens/*.json` - Reference data, not actively used; keep for reference or remove
- Hardcoded `realTokens` object in `code.ts` - Keep for plugin UI theming, but document purpose

---

## Phase 0: Project Setup & Architecture (Do First)

**Goal:** Set up proper build tooling and project structure before making feature changes.

### 0.1 Add Build Tooling

Install and configure esbuild for both plugin and UI:

```
v1/
├── src/
│   ├── plugin/           # Plugin sandbox code
│   │   ├── code.ts       # Main plugin logic
│   │   ├── messages.ts   # Message type definitions
│   │   └── figma-utils.ts # Figma API helpers
│   └── ui/               # UI code
│       ├── main.ts       # UI entry point
│       ├── styles/
│       │   ├── base.css
│       │   ├── components.css
│       │   └── variables.css
│       └── components/   # UI component modules (future)
├── dist/                 # Compiled output
│   ├── code.js          # Compiled plugin
│   └── ui.html          # Bundled UI
├── tokens/              # Reference token files (optional)
├── docs/                # Documentation
├── package.json
├── tsconfig.json
├── esbuild.config.js    # Build configuration
└── manifest.json        # Points to dist/
```

### 0.2 Update TypeScript Config

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "outDir": "./dist",
    "rootDir": "./src"
  }
}
```

### 0.3 Update Manifest

```json
{
  "main": "dist/code.js",
  "ui": "dist/ui.html"
}
```

### 0.4 Create Message Type Definitions

```typescript
// src/plugin/messages.ts
export interface LoadCollectionsMessage {
  type: 'load-collections';
}

export interface LoadVariablesMessage {
  type: 'load-variables';
  collectionId: string;
  modeId: string;
}

// ... etc
```

---

## Phase 1: Bug Fixes & Code Cleanup

**Goal:** Fix existing issues before adding features.

### 1.1 UI Bug Fixes

| Bug | Description | Fix |
|-----|-------------|-----|
| Missing checkboxes on groups | Group headers show no checkbox | Add checkbox to group rows OR remove group headers |
| Redundant text display | Shows both variable name AND full path | Display only variable name (last segment of path) |
| Secondary button unstyled | `.pds-button--secondary` has no CSS | Add CSS rules for secondary variant |

### 1.2 Code Consistency

| Issue | Fix |
|-------|-----|
| Inconsistent `postMessage` | Standardize on `window.parent.postMessage()` |
| Mixed async patterns | Ensure consistent `async/await` usage |
| Missing error boundaries | Add try/catch to all message handlers |

### 1.3 Dead Code Removal

- Remove or repurpose `token-processor.ts`
- Document purpose of hardcoded tokens in `code.ts`
- Clean up unused demo components in `ui.html`

---

## Phase 2: Variable Selection Improvements

**Goal:** Make variable selection fully functional with real Figma data.

### 2.1 Collection/Mode Integration (Already Working)

Verify and ensure:
- [ ] Collections dropdown populates from Figma
- [ ] Modes dropdown updates when collection changes
- [ ] Variables load when mode is selected

### 2.2 Variable Display Improvements

Current behavior:
```
pds/color/blueberry
  025
  pds/color/blueberry/025
```

Desired behavior (show name only):
```
☑ black
☑ blueberry
  ☑ 025
  ☑ 050
  ☑ 100
```

Changes needed:
- Update `createVariableRow()` to show only `displayName`
- Remove secondary text (full path)
- Add checkboxes to group rows for "select all in group"

### 2.3 Variable Type Filtering

Currently only COLOR variables load. Add support for:
- [ ] Color (current)
- [ ] Number (spacing, sizing)
- [ ] String (font families)
- [ ] Boolean

Use segmented control to filter by type.

---

## Phase 3: Style Guide Generation

**Goal:** Implement core plugin functionality.

### 3.1 Message Handlers

Implement backend handlers:
- `generate-style-guide` - Create frames on canvas
- `scan-variables` - Find variables in selection

### 3.2 Frame Generation

Create Figma nodes:
- Parent frame with auto-layout
- Section headers
- Color swatch components
- Token name/value labels

### 3.3 Layout Templates

Start with one template, expand later:
1. **Color Scales** - Horizontal rows of color swatches (for primitives)

Future templates:
2. Semantic Token List
3. Typography Specimen
4. Spacing Scale
5. Shadow Gallery
6. Border Radius Examples
7. Full Design System Overview

---

## Phase 4: Export Functionality

**Goal:** Enable exporting tokens in various formats.

### 4.1 Export Formats
- CSS Custom Properties
- JSON (Design Token Community Group format)
- SCSS Variables

### 4.2 Export UI
- Add export button
- Format selector dropdown
- Copy to clipboard / Download file

---

## Implementation Order

### Sprint 1: Foundation
1. Set up esbuild and new project structure
2. Migrate existing code to new structure
3. Fix TypeScript config and manifest
4. Verify plugin still works

### Sprint 2: Bug Fixes
1. Fix variable display (name only, no path)
2. Fix/remove group headers or add checkboxes
3. Add secondary button CSS
4. Standardize message passing

### Sprint 3: Variable Selection Polish
1. Add variable type filtering
2. Implement "select all" for groups
3. Add search/filter functionality
4. Improve loading states

### Sprint 4: Core Generation
1. Implement `generate-style-guide` handler
2. Create color swatch generation
3. Add progress feedback
4. Test with real PRISM variables

### Sprint 5+: Templates & Export
1. Add additional layout templates
2. Implement export functionality
3. Polish and UX improvements

---

## Decision Points

### Decision 1: Token Processor

**Options:**
A. **Remove entirely** - Use Figma Variables API exclusively
B. **Repurpose** - Use for export formatting (tokens → CSS/JSON)
C. **Keep for reference** - Document as unused, keep code

**Recommendation:** Option B - Repurpose for export functionality

### Decision 2: Hardcoded Tokens in code.ts

**Purpose:** These style the plugin UI itself (buttons, inputs, etc.)

**Options:**
A. Keep as-is, add comments explaining purpose
B. Move to separate config file
C. Load dynamically from a Figma collection (complex)

**Recommendation:** Option A for now, consider B during restructure

### Decision 3: Group Headers in Variable List

**Options:**
A. Remove group headers entirely - flat list with indentation
B. Keep headers, add "select all" checkbox
C. Collapsible groups with expand/collapse

**Recommendation:** Option B - Adds useful bulk selection

---

## Success Criteria

### Phase 0 Complete When:
- [ ] Build runs with `npm run build`
- [ ] Watch mode works with `npm run watch`
- [ ] Plugin loads in Figma from `dist/`
- [ ] All existing functionality preserved

### Phase 1 Complete When:
- [ ] Variables show name only (not full path)
- [ ] Group rows have checkboxes (or are removed)
- [ ] Secondary button is styled
- [ ] No console errors
- [ ] Consistent code patterns

### Phase 2 Complete When:
- [ ] All variable types can be loaded
- [ ] Type filtering via segmented control works
- [ ] "Select all" works for groups
- [ ] Search/filter functional

### Phase 3 Complete When:
- [ ] User can generate a color style guide on canvas
- [ ] Generated frame uses proper Figma auto-layout
- [ ] Token names and values display correctly
