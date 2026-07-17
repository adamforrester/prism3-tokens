/**
 * Build-time host discriminant (docs/22 #110). Substituted by esbuild `--define` at bundle time:
 *   • web build   → defaults to `'web'` (no --define needed; see the fallback below)
 *   • plugin build → `--define:PRISM3_HOST='"figma"'`
 *
 * Declared as an ambient const so both the web tsconfig and the plugin's ui-context tsconfig
 * typecheck the shared `web/src` UI. `makeWriteHost` / `hostCommit` branch on it, and esbuild
 * dead-code-eliminates the unused host's branch — so the "one UI, no fork" bundle never ships
 * the other host's code.
 */
declare const PRISM3_HOST: 'web' | 'figma';
