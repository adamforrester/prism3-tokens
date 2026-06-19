# Prism3

The next iteration of the Prism white-label design system, delivered as a **brand-generation engine**: a brand is a small validated input set that the engine expands into a complete token tree, AI metadata, and platform outputs.

This directory currently holds the **architecture spec + Theme Schema contract** (the first deliverable). The engine, reference brand, and tool surface come next.

```
Prism3/
├── docs/
│   └── 01-token-architecture.md   ← the architecture spec (start here)
└── schema/
    ├── theme-schema.json          ← the brand input contract (JSON Schema)
    └── theme-schema.example.json  ← a worked brand input (New Balance, illustrative)
```

**Status:** v0.1 draft for review. See §11 of the architecture spec for the open decisions to resolve next.

The prior iterations (`../Tokens/Prism2`, `../Tokens/New Balance`) are retained as reference inputs — Prism3 is clean-sheet and cherry-picks the best mechanics from both.
