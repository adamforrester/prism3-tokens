/**
 * Plugin UI Theming Tokens
 *
 * These tokens are used to style the plugin UI itself (buttons, inputs, etc.).
 * They are NOT the user's design system tokens - those come from Figma's Variables API.
 *
 * These values are extracted from the PRISM design system to ensure the plugin UI
 * matches the design system it's documenting. They are intentionally hardcoded here
 * rather than loaded dynamically, as the plugin UI needs to render before any
 * Figma API calls complete.
 */

import { TokenValue } from './messages';

export const pluginUITokens: Record<string, TokenValue> = {
  // ==========================================================================
  // Primary Action Colors
  // ==========================================================================
  'pds.color.action.primary.surface.rest': { $value: '#0c0cff', $type: 'color' },
  'pds.color.action.primary.surface.hover': { $value: '#0000db', $type: 'color' },
  'pds.color.action.primary.surface.active': { $value: '#0000aa', $type: 'color' },
  'pds.color.action.primary.text.rest': { $value: '#0c0cff', $type: 'color' },
  'pds.color.action.primary.text.hover': { $value: '#0000db', $type: 'color' },
  'pds.color.action.primary.text.active': { $value: '#0000aa', $type: 'color' },
  'pds.color.action.primary.text.onPrimary': { $value: '#ffffff', $type: 'color' },
  'pds.color.action.primary.border.rest': { $value: '#0c0cff', $type: 'color' },
  'pds.color.action.primary.border.hover': { $value: '#0000db', $type: 'color' },
  'pds.color.action.primary.border.active': { $value: '#0000aa', $type: 'color' },

  // Primary surface inverse (for outline button hover/active)
  'pds.color.action.primary.surface.hover-inverse': { $value: '#e5e5ff', $type: 'color' },
  'pds.color.action.primary.surface.active-inverse': { $value: '#cdcdff', $type: 'color' },

  // ==========================================================================
  // Ghost/Transparent Colors
  // ==========================================================================
  'pds.color.action.ghost.surface.rest': { $value: '#00000000', $type: 'color' },
  'pds.color.action.ghost.surface.hover': { $value: '#0000001a', $type: 'color' },
  'pds.color.action.ghost.surface.active': { $value: '#00000033', $type: 'color' },

  // ==========================================================================
  // Neutral Action Colors
  // ==========================================================================
  'pds.color.action.neutral.surface.rest': { $value: '#303030', $type: 'color' },
  'pds.color.action.neutral.surface.hover': { $value: '#474747', $type: 'color' },
  'pds.color.action.neutral.surface.active': { $value: '#5e5e5e', $type: 'color' },
  'pds.color.action.neutral.text.rest': { $value: '#474747', $type: 'color' },
  'pds.color.action.neutral.text.hover': { $value: '#303030', $type: 'color' },
  'pds.color.action.neutral.text.active': { $value: '#1b1b1b', $type: 'color' },
  'pds.color.action.neutral.text.onNeutral': { $value: '#ffffff', $type: 'color' },
  'pds.color.action.neutral.border.rest': { $value: '#6a6a6a', $type: 'color' },
  'pds.color.action.neutral.border.hover': { $value: '#525252', $type: 'color' },
  'pds.color.action.neutral.border.active': { $value: '#3b3b3b', $type: 'color' },
  'pds.color.action.neutral.icon.rest': { $value: '#474747', $type: 'color' },
  'pds.color.action.neutral.icon.hover': { $value: '#303030', $type: 'color' },
  'pds.color.action.neutral.icon.active': { $value: '#1b1b1b', $type: 'color' },
  'pds.color.action.neutral.icon.onNeutral': { $value: '#ffffff', $type: 'color' },

  // ==========================================================================
  // Disabled State Colors
  // ==========================================================================
  'pds.color.disabled.text.default': { $value: '#6a6a6a', $type: 'color' },
  'pds.color.disabled.text.onDisabled': { $value: '#525252', $type: 'color' },
  'pds.color.disabled.surface.default': { $value: '#c6c6c6', $type: 'color' },
  'pds.color.disabled.surface.onDisabled': { $value: '#919191', $type: 'color' },

  // ==========================================================================
  // Component Sizing
  // ==========================================================================
  'pds.size.component.height.sm': { $value: '32px', $type: 'dimension' },
  'pds.size.component.height.md': { $value: '40px', $type: 'dimension' },
  'pds.size.component.height.lg': { $value: '48px', $type: 'dimension' },
  'pds.size.component.height-xs': { $value: '36px', $type: 'dimension' },

  // ==========================================================================
  // Form Input Colors
  // ==========================================================================
  'pds.color.surface.input.default': { $value: '#00000000', $type: 'color' },
  'pds.color.surface.input.hover': { $value: '#0000001a', $type: 'color' },
  'pds.color.border.input.default': { $value: '#848484', $type: 'color' },
  'pds.color.border.focused.default': { $value: '#035ef9', $type: 'color' },

  // ==========================================================================
  // Toggle Switch Colors
  // ==========================================================================
  'pds.color.action.primary.surface-bold.rest': { $value: '#1e1eff', $type: 'color' },
  'pds.color.action.primary.surface-bold.hover': { $value: '#0812c3', $type: 'color' },
  'pds.color.action.primary.surface-bold.active': { $value: '#090a83', $type: 'color' },
  'pds.color.border.focused.toggle': { $value: '#3256ff', $type: 'color' },

  // ==========================================================================
  // Typography
  // ==========================================================================
  'pds.font.family.body': { $value: 'Inter', $type: 'fontFamily' },
  'pds.font.size.body.md': { $value: '16px', $type: 'dimension' },
  'pds.font.size.body.sm': { $value: '14px', $type: 'dimension' },
  'pds.font.size.detail.lg': { $value: '12px', $type: 'dimension' },
  'pds.font.size.detail.md': { $value: '11px', $type: 'dimension' },
  'pds.font.size.detail.sm': { $value: '10px', $type: 'dimension' },
  'pds.font.size.title.desktop.sm': { $value: '24px', $type: 'dimension' },
  'pds.font.weight.body.bold': { $value: '700', $type: 'fontWeight' },
  'pds.font.weight.body.regular': { $value: '400', $type: 'fontWeight' },
  'pds.font.weight.title.bold': { $value: '700', $type: 'fontWeight' },
  'pds.font.weight.detail.regular': { $value: '400', $type: 'fontWeight' },
  'pds.font.weight.medium': { $value: '500', $type: 'fontWeight' },

  // ==========================================================================
  // Spacing
  // ==========================================================================
  'pds.space.100': { $value: '8px', $type: 'dimension' },
  'pds.space.150': { $value: '12px', $type: 'dimension' },
  'pds.space.200': { $value: '16px', $type: 'dimension' },
  'pds.space.250': { $value: '20px', $type: 'dimension' },
  'pds.space.300': { $value: '24px', $type: 'dimension' },
  'pds.space.400': { $value: '32px', $type: 'dimension' },
  'pds.space.icon.sm': { $value: '4px', $type: 'dimension' },
  'pds.space.icon.md': { $value: '6px', $type: 'dimension' },
  'pds.space.icon.lg': { $value: '8px', $type: 'dimension' },

  // ==========================================================================
  // Border Radius
  // ==========================================================================
  'pds.radius.small': { $value: '4px', $type: 'dimension' },
  'pds.radius.medium': { $value: '6px', $type: 'dimension' },
  'pds.border.radius.button': { $value: '4px', $type: 'dimension' },
  'pds.border.radius.xs': { $value: '2px', $type: 'dimension' },

  // ==========================================================================
  // Surface & Border Colors
  // ==========================================================================
  'pds.color.border.primary.default': { $value: '#d4d4d4', $type: 'color' },
  'pds.color.surface.primary.default': { $value: '#f1f1f1', $type: 'color' },
  'pds.color.surface.secondary.default': { $value: '#ffffff', $type: 'color' },
  'pds.color.icon.primary.default': { $value: '#111111', $type: 'color' },
  'pds.color.text.secondary.default': { $value: '#6a6a6a', $type: 'color' },
  'pds2.color.surface.primary.default': { $value: '#f8f8f8', $type: 'color' },
  'pds.color.action.primary.icon.onPrimary': { $value: '#ffffff', $type: 'color' },
};

/**
 * Generate CSS custom properties from plugin UI tokens
 * Note: We return a single-line CSS string to avoid issues with Figma's plugin parser
 * which can have issues with multi-line strings in minified code.
 */
export function generatePluginUICSS(): string {
  const cssVariables = Object.entries(pluginUITokens)
    .map(([path, token]) => '--' + path.replace(/\./g, '-') + ':' + token.$value)
    .join(';');

  return ':root{' + cssVariables + '}';
}

/**
 * Get tokens filtered by category
 */
export function getTokensByCategory(category: 'action' | 'space' | 'font' | 'radius'): [string, TokenValue][] {
  return Object.entries(pluginUITokens)
    .filter(([path]) => path.includes(category));
}
