# Architecture Overview

## Project Structure

```
v1/
├── src/
│   ├── plugin/                    # Plugin backend (Figma sandbox)
│   │   ├── code.ts               # Main entry, message routing
│   │   ├── messages.ts           # Type definitions for message payloads
│   │   ├── ui-tokens.ts          # UI token generation (CSS variables)
│   │   └── style-guide-generator.ts  # Core style guide generation logic
│   └── ui/                        # Plugin UI (iframe)
│       ├── index.html            # HTML structure
│       ├── main.ts               # UI logic and message handling
│       └── styles/
│           ├── tokens.css        # Design tokens as CSS variables
│           ├── base.css          # Base styles and resets
│           └── components.css    # UI component styles
├── dist/                          # Compiled output (esbuild)
│   ├── code.js                   # Bundled plugin backend
│   └── ui.html                   # Bundled UI with inlined CSS/JS
├── images/                        # Static assets
│   └── link.svg                  # Icon for alias variant
├── docs/                          # Project documentation
│   ├── architecture.md           # This file
│   ├── backlog.md                # Feature backlog
│   ├── roadmap.md                # Project roadmap
│   ├── component-specs.md        # Generated component specifications
│   └── agents.md                 # AI agent instructions
├── manifest.json                  # Figma plugin manifest
├── package.json                   # Dependencies and build scripts
├── tsconfig.json                  # TypeScript config
└── esbuild.config.js             # Build configuration
```

## Figma Plugin Architecture

### Two-Context Model

Figma plugins run in two isolated contexts:

1. **Plugin Sandbox (`code.ts` → `code.js`)**
   - Has access to Figma API (`figma.*`)
   - Can manipulate the canvas, read variables, create nodes
   - No DOM access
   - Runs in Figma's main thread

2. **UI Context (`ui.html`)**
   - Standard web environment (HTML/CSS/JS)
   - Has DOM access
   - No direct Figma API access
   - Runs in sandboxed iframe

### Message Passing

Communication between contexts uses message passing:

```
┌─────────────────┐         ┌─────────────────┐
│   UI Context    │ ◄─────► │ Plugin Sandbox  │
│   (ui.html)     │         │ (code.ts)       │
└─────────────────┘         └─────────────────┘
        │                           │
        ▼                           ▼
  window.parent.postMessage    figma.ui.postMessage
        │                           │
        └───────────────────────────┘
              Message Channel
```

**UI → Plugin:**
```javascript
window.parent.postMessage({
  pluginMessage: { type: 'load-variables', collectionId, modeId }
}, '*');
```

**Plugin → UI:**
```javascript
figma.ui.postMessage({
  type: 'variables-loaded',
  data: { variables, collectionName, modeName }
});
```

## Message Types

### Current Message Flow

| Message Type | Direction | Purpose |
|-------------|-----------|---------|
| `load-tokens` | UI → Plugin | Request embedded token data |
| `tokens-loaded` | Plugin → UI | Return CSS variables and token data |
| `load-collections` | UI → Plugin | Request variable collections |
| `collections-loaded` | Plugin → UI | Return collection list with modes |
| `load-variables` | UI → Plugin | Request variables for collection/mode |
| `variables-loaded` | Plugin → UI | Return processed variables |
| `generate-style-guide` | UI → Plugin | Generate on-canvas style guide |
| `style-guide-created` | Plugin → UI | Confirm style guide creation |
| `error` | Plugin → UI | Error notification |

### Message Payload Types (from messages.ts)

```typescript
interface GenerateStyleGuideMessage {
  type: 'generate-style-guide';
  variables: SelectedVariable[];
  options: StyleGuideOptions;
  collectionId: string;
  modeId: string;
}

interface StyleGuideOptions {
  displayStyle: 'standard' | 'text' | 'icon' | 'border' | 'transparency';
  colorValue: 'hex' | 'rgb' | 'hsl' | 'hsb';
  aliasing: 'alias' | 'resolved' | 'both';
  showDescription: boolean;
  addTitleCell: boolean;
}
```

## Component System

### CSS Custom Properties

All components use CSS custom properties for theming:

```css
.pds-button--primary {
  background-color: var(--pds-color-action-primary-surface-rest, #0c0cff);
  color: var(--pds-color-action-primary-text-onPrimary, #ffffff);
}
```

Fallback values ensure components work even before tokens are injected.

### Component Naming Convention

BEM-like pattern with `pds-` prefix:

- `.pds-button` - Block
- `.pds-button--primary` - Modifier (variant)
- `.pds-button--small` - Modifier (size)
- `.pds-button__icon` - Element

### Available Components

- **Buttons:** Primary, Secondary, Neutral, Outline variants; Small/Medium/Large sizes
- **Form Controls:** Input, Textarea, Select, Toggle, Checkbox
- **Layout:** Page Header, Section Header, Selector Card
- **Navigation:** Dropdown Menu, Segmented Control
- **Data Display:** Variable Selection Frame, Variable Checkbox Row

## Build Process

Using **esbuild** for fast TypeScript compilation and bundling:

```bash
npm run build         # Compile plugin and UI to dist/
npm run build:plugin  # Compile only plugin backend
npm run build:ui      # Compile only UI
npm run watch         # Watch mode for development
npm run typecheck     # Run TypeScript type checking
```

### Build Pipeline

1. **Plugin Backend** (`src/plugin/*.ts` → `dist/code.js`)
   - Bundles all plugin TypeScript into single file
   - Targets ES2020 for Figma's JavaScript engine

2. **UI** (`src/ui/` → `dist/ui.html`)
   - Compiles TypeScript to JavaScript
   - Inlines CSS from `styles/` directory
   - Produces single HTML file with embedded JS/CSS

## Key Files

### manifest.json
Defines plugin metadata and entry points:
- `main`: Plugin sandbox entry point (`dist/code.js`)
- `ui`: UI iframe source (`dist/ui.html`)
- `permissions`: Required Figma permissions

### src/plugin/code.ts
Main plugin entry point:
- Initialize plugin UI
- Handle message routing
- Dispatch to specialized handlers

### src/plugin/style-guide-generator.ts
Core style guide generation (~800 lines):
- Component set creation (swatches, text cells)
- CSS Grid layout generation
- Variable binding and alias resolution
- Color format conversion (hex/rgb/hsl)

### src/plugin/messages.ts
Type definitions for all message payloads:
- `PluginMessage` union type
- `UIMessage` union type
- Shared interfaces for variables and options

### src/plugin/ui-tokens.ts
Embedded design tokens for UI styling:
- CSS custom properties generation
- Token definitions for plugin UI components

### src/ui/main.ts
Plugin UI logic:
- Event handling for user interactions
- Message sending to plugin backend
- Dynamic variable list rendering
- Form state management
