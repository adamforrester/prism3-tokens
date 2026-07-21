# AI Agent Instructions

This document provides context and guidelines for AI agents working on this project.

## Project Overview

**Style Guide Generator** is a Figma plugin for the PRISM Design System that generates on-canvas style guides from design tokens and variables.

### Key Technologies
- TypeScript (plugin backend)
- HTML/CSS/JavaScript (plugin UI)
- Figma Plugin API
- CSS Custom Properties for theming

## Critical Context

### Figma Plugin Constraints

1. **Two-Context Architecture**
   - `code.ts` runs in Figma's sandbox - has Figma API access, no DOM
   - `ui.html` runs in iframe - has DOM access, no direct Figma API
   - Communication is ONLY via message passing

2. **API Limitations**
   - All Figma API calls are async
   - No file system access from plugin
   - No external network requests from sandbox (only from UI)
   - Plugin UI runs in sandboxed iframe

3. **Build Requirements**
   - TypeScript must be compiled before testing
   - Run `npm run build` after any `.ts` changes
   - No hot reload - must close/reopen plugin to see changes

### Code Style Guidelines

1. **Component Naming**
   - Use `pds-` prefix for all CSS classes
   - Follow BEM-like convention: `.pds-component--modifier__element`

2. **Token Usage**
   - Always use CSS custom properties with fallbacks
   - Format: `var(--pds-category-subcategory-property, fallback)`

3. **Message Passing**
   - Use consistent pattern: `window.parent.postMessage({ pluginMessage: {...} }, '*')`
   - Always include `type` field in messages
   - Handle errors and send error messages back to UI

4. **TypeScript**
   - Use strict mode
   - Add type annotations for function parameters
   - Use interfaces for complex objects

## Common Tasks

### Adding a New Message Type

1. Add handler case in `code.ts` switch statement:
```typescript
case 'new-message-type':
  await handleNewMessage(msg.data);
  break;
```

2. Add handler function:
```typescript
async function handleNewMessage(data: SomeType) {
  try {
    // Implementation
    figma.ui.postMessage({
      type: 'new-message-response',
      data: result
    });
  } catch (error) {
    figma.ui.postMessage({
      type: 'error',
      data: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
```

3. Add UI handler in `ui.html`:
```javascript
case 'new-message-response':
  // Handle response
  break;
```

### Adding a New Component Style

1. Add CSS in `ui.html` `<style>` section
2. Follow existing patterns for states (hover, active, focus, disabled)
3. Use token variables with fallbacks
4. Add component demo in appropriate section

### Creating Figma Nodes

Use Figma's node creation API:
```typescript
// Create a frame
const frame = figma.createFrame();
frame.name = "Style Guide";
frame.resize(800, 600);

// Create a rectangle
const rect = figma.createRectangle();
rect.fills = [{ type: 'SOLID', color: { r: 1, g: 0, b: 0 } }];

// Create text
const text = figma.createText();
await figma.loadFontAsync({ family: "Inter", style: "Regular" });
text.characters = "Hello";
```

## File Locations

| Purpose | File |
|---------|------|
| Plugin backend logic | `src/code.ts` |
| Plugin UI | `ui.html` |
| Plugin manifest | `manifest.json` |
| Token source files | `tokens/*.json` |
| Documentation | `docs/*.md` |

## Testing

1. Open Figma Desktop
2. Right-click canvas → Plugins → Development → Import plugin from manifest
3. Select `manifest.json` from this directory
4. Run plugin via Plugins menu or right-click → Plugins

After code changes:
```bash
npm run build
```
Then close and reopen the plugin in Figma.

## Known Issues

Refer to `docs/backlog.md` for current bugs and technical debt.

## Documentation

- `docs/architecture.md` - System design and patterns
- `docs/backlog.md` - Bugs and feature requests
- `docs/roadmap.md` - Project phases and milestones

## Questions to Ask User

When uncertain about implementation, ask about:
1. Desired output format for generated style guides
2. Specific token types to prioritize
3. Layout preferences for documentation
4. Export format requirements
5. Any existing Figma component library to reference
