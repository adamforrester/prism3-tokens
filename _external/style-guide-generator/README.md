# Style Guide Generator Plugin

A Figma plugin for generating on-canvas style guides from Figma variables and design tokens.

## Features

- Select a variable collection and mode
- Filter variables by type (Color, Number, String, Boolean)
- Generate visual style guide layouts on canvas
- Supports colors, typography, shadows, spacing, etc.

## Project Structure

```
v1/
├── src/
│   ├── plugin/           # Plugin sandbox code (Figma API access)
│   │   ├── code.ts       # Main plugin logic
│   │   ├── messages.ts   # Message type definitions
│   │   └── ui-tokens.ts  # Plugin UI theming tokens
│   └── ui/               # Plugin UI (iframe)
│       ├── main.ts       # UI logic and interactions
│       ├── index.html    # HTML template
│       └── styles/       # CSS files
│           ├── tokens.css
│           ├── base.css
│           └── components.css
├── dist/                 # Compiled output (generated)
│   ├── code.js
│   └── ui.html
├── docs/                 # Documentation
│   ├── architecture.md
│   ├── backlog.md
│   ├── roadmap.md
│   ├── implementation-plan.md
│   └── agents.md
├── tokens/               # Reference token JSON files
├── manifest.json         # Figma plugin manifest
├── package.json
├── tsconfig.json
└── esbuild.config.js     # Build configuration
```

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Build the plugin:
   ```bash
   npm run build
   ```

3. Load in Figma:
   - Open Figma Desktop
   - Go to Plugins > Development > Import Plugin from Manifest
   - Select the `manifest.json` file in this directory

## Development

- `npm run build` - Build the plugin once
- `npm run watch` - Watch mode for development
- `npm run typecheck` - Run TypeScript type checking
- `npm run clean` - Remove dist folder

## Documentation

See the `/docs` folder for detailed documentation:

- **architecture.md** - System design and patterns
- **backlog.md** - Bugs and feature requests
- **roadmap.md** - Project phases and milestones
- **implementation-plan.md** - Detailed implementation steps
- **agents.md** - AI agent instructions
