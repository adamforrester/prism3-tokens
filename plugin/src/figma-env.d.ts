/**
 * Ambient globals injected into the plugin's MAIN thread by Figma at runtime (not exported by
 * `@figma/plugin-typings`). `__html__` is the bundled UI HTML string Figma substitutes from the
 * manifest's `ui` field; `__uiFiles__` is its multi-file counterpart. Main-context only.
 */
declare const __html__: string;
declare const __uiFiles__: Record<string, string>;
