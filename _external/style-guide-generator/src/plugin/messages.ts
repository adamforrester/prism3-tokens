/**
 * Message type definitions for plugin <-> UI communication
 *
 * All messages between the plugin sandbox and UI iframe use these types.
 * This ensures type safety and documentation of the message protocol.
 */

// =============================================================================
// UI -> Plugin Messages (requests from UI to plugin)
// =============================================================================

export interface LoadTokensMessage {
  type: 'load-tokens';
}

export interface LoadCollectionsMessage {
  type: 'load-collections';
}

export type VariableType = 'COLOR' | 'FLOAT' | 'STRING' | 'BOOLEAN';

export interface LoadVariablesMessage {
  type: 'load-variables';
  collectionId: string;
  modeId: string;
  variableType?: VariableType;
  tabId?: string;
}

export interface LoadTextStylesMessage {
  type: 'load-text-styles';
}

// Display style types for different variable types
export type ColorDisplayStyle = 'standard' | 'scale' | 'text-color' | 'border-color' | 'transparency' | 'icon-color';
export type DimensionDisplayStyle = 'standard' | 'spacing' | 'border-radius';
export type FontDisplayType = 'standard' | 'font-family' | 'font-size' | 'font-weight' | 'letter-spacing' | 'line-height';
export type SpacingStyle = 'filled' | 'line';
export type TableHeaderStyle = 'light' | 'dark';

export interface StyleGuideOptions {
  // Display style - can be color-specific or dimension-specific
  displayStyle: ColorDisplayStyle | DimensionDisplayStyle;
  // Color value format (only used for color variables)
  colorValue?: 'hex' | 'rgb' | 'hsl' | 'hsb';
  // Spacing style (only used when displayStyle is 'spacing')
  spacingStyle?: SpacingStyle;
  // Table header style (light = white, dark = dark)
  tableHeader?: TableHeaderStyle;
  // Display values with "px" suffix (only used for dimension variables)
  displayPixels?: boolean;
  // Add REM values column (only used for dimension variables)
  addRemValues?: boolean;
  // Common options
  displayAliases: boolean;
  showDescription: boolean;
  addTitleCell: boolean;
}

export interface GenerateStyleGuideMessage {
  type: 'generate-style-guide';
  data: {
    collectionId: string;
    modeId: string;
    variableIds: string[];
    options: StyleGuideOptions;
  };
}

// Text Style Guide Options
export interface TextStyleGuideOptions {
  tableHeader: TableHeaderStyle;
  addRemValues: boolean;
  displayAliases: boolean;
  showTextDecoration: boolean;
  showParagraphSpacing: boolean;
  showDescription: boolean;
}

export interface GenerateTextStyleGuideMessage {
  type: 'generate-text-style-guide';
  data: {
    styleIds: string[];
    options: TextStyleGuideOptions;
  };
}

// Font Variable Guide Options
export interface FontVariableGuideOptions {
  displayType: FontDisplayType;
  tableHeader: TableHeaderStyle;
  addRemValues: boolean;
  displayAliases: boolean;
  showDescription: boolean;
}

export interface LoadFontVariablesMessage {
  type: 'load-font-variables';
  collectionId: string;
  modeId: string;
  tabId?: string;
}

export interface GenerateFontVariableGuideMessage {
  type: 'generate-font-variable-guide';
  data: {
    collectionId: string;
    modeId: string;
    variableIds: string[];
    options: FontVariableGuideOptions;
  };
}

export type PluginMessage =
  | LoadTokensMessage
  | LoadCollectionsMessage
  | LoadVariablesMessage
  | GenerateStyleGuideMessage
  | LoadTextStylesMessage
  | GenerateTextStyleGuideMessage
  | LoadFontVariablesMessage
  | GenerateFontVariableGuideMessage;

// =============================================================================
// Plugin -> UI Messages (responses from plugin to UI)
// =============================================================================

export interface TokensLoadedMessage {
  type: 'tokens-loaded';
  data: {
    cssVariables: string;
    typographyCSS: string;
    buttonTokens: [string, TokenValue][];
    spacingTokens: [string, TokenValue][];
    totalTokens: number;
    message: string;
  };
}

export interface CollectionInfo {
  id: string;
  name: string;
  modes: {
    modeId: string;
    name: string;
  }[];
}

export interface CollectionsLoadedMessage {
  type: 'collections-loaded';
  data: CollectionInfo[];
}

export interface ProcessedVariable {
  id: string;
  name: string;
  displayName: string;
  fullPath: string;
  nameParts: string[];
  groupLevel: number;
  type: string;
  value: unknown;
  collection: string;
  mode: string;
  scopes?: string[];
}

export interface VariablesLoadedMessage {
  type: 'variables-loaded';
  data: {
    variables: ProcessedVariable[];
    collectionName: string;
    modeName: string;
  };
}

// Text style types
export interface BoundVariableInfo {
  id: string;
  name: string;
}

export interface TextStyleLineHeight {
  value: number;
  unit: 'PIXELS' | 'PERCENT' | 'AUTO';
}

export interface TextStyleLetterSpacing {
  value: number;
  unit: 'PIXELS' | 'PERCENT';
}

export type TextDecorationType = 'NONE' | 'UNDERLINE' | 'STRIKETHROUGH';

export interface TextStyleInfo {
  id: string;
  name: string;
  fontFamily: string;
  fontStyle: string;
  fontSize: number;
  lineHeight: TextStyleLineHeight;
  letterSpacing: TextStyleLetterSpacing;
  textDecoration: TextDecorationType;
  paragraphSpacing: number;
  description: string;
  // Bound variables for each property (only if bound to a variable)
  boundVariables?: {
    fontSize?: BoundVariableInfo;
    fontFamily?: BoundVariableInfo;
    fontStyle?: BoundVariableInfo;
    lineHeight?: BoundVariableInfo;
    letterSpacing?: BoundVariableInfo;
  };
}

export interface TextStylesLoadedMessage {
  type: 'text-styles-loaded';
  data: TextStyleInfo[];
}

export interface ErrorMessage {
  type: 'error';
  data: string;
}

export interface StyleGuideGeneratedMessage {
  type: 'style-guide-generated';
  data: {
    success: boolean;
    frameId?: string;
    frameName?: string;
    error?: string;
  };
}

export type UIMessage =
  | TokensLoadedMessage
  | CollectionsLoadedMessage
  | VariablesLoadedMessage
  | TextStylesLoadedMessage
  | ErrorMessage
  | StyleGuideGeneratedMessage;

// =============================================================================
// Shared Types
// =============================================================================

export interface TokenValue {
  $value: string;
  $type: 'color' | 'dimension' | 'fontFamily' | 'fontWeight';
}
