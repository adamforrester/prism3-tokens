/**
 * Figma Plugin Backend - Style Guide Generator
 *
 * This file runs in Figma's plugin sandbox and handles:
 * - Plugin initialization
 * - Message routing between UI and Figma API
 * - Figma Variables API interactions
 * - Style guide generation
 */

import { PluginMessage, ProcessedVariable, StyleGuideOptions, TextStyleInfo, TextStyleGuideOptions, FontVariableGuideOptions } from './messages';
import { pluginUITokens, generatePluginUICSS, getTokensByCategory } from './ui-tokens';
import { generateStyleGuide, generateDimensionStyleGuide, generateTextStyleGuide, generateFontVariableGuide } from './style-guide-generator';

// =============================================================================
// Plugin Initialization
// =============================================================================

figma.showUI(__html__, {
  width: 500,
  height: 700,
  themeColors: true,
});

// =============================================================================
// Message Handling
// =============================================================================

figma.ui.onmessage = async (msg: PluginMessage) => {
  try {
    switch (msg.type) {
      case 'load-tokens':
        await loadTokensAndGenerateCSS();
        break;

      case 'load-collections':
        await loadVariableCollections();
        break;

      case 'load-variables':
        await loadVariablesFromCollection(msg.collectionId, msg.modeId, msg.variableType, msg.tabId);
        break;

      case 'generate-style-guide':
        await handleGenerateStyleGuide(msg.data);
        break;

      case 'load-text-styles':
        await loadTextStyles();
        break;

      case 'generate-text-style-guide':
        await handleGenerateTextStyleGuide(msg.data);
        break;

      case 'load-font-variables':
        await loadFontVariablesFromCollection(msg.collectionId, msg.modeId, msg.tabId);
        break;

      case 'generate-font-variable-guide':
        await handleGenerateFontVariableGuide(msg.data);
        break;

      default:
        break;
    }
  } catch (error) {
    figma.ui.postMessage({
      type: 'error',
      data: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

// =============================================================================
// Token Loading (for Plugin UI theming)
// =============================================================================

/**
 * Load tokens for styling the plugin UI.
 * These are hardcoded tokens from the PRISM design system used to theme
 * the plugin's own interface (buttons, inputs, etc.)
 */
async function loadTokensAndGenerateCSS(): Promise<void> {
  const cssVariables = generatePluginUICSS();
  const buttonTokens = getTokensByCategory('action');
  const spacingTokens = [
    ...getTokensByCategory('space'),
    ...getTokensByCategory('font'),
    ...getTokensByCategory('radius'),
  ];

  figma.ui.postMessage({
    type: 'tokens-loaded',
    data: {
      cssVariables,
      typographyCSS: '',
      buttonTokens,
      spacingTokens,
      totalTokens: Object.keys(pluginUITokens).length,
      message: 'Plugin UI tokens loaded successfully',
    },
  });
}

// =============================================================================
// Figma Variables API
// =============================================================================

/**
 * Load all variable collections from the current Figma file
 */
async function loadVariableCollections(): Promise<void> {
  const collections = await figma.variables.getLocalVariableCollections();

  const collectionsData = collections.map((collection) => ({
    id: collection.id,
    name: collection.name,
    modes: collection.modes.map((mode) => ({
      modeId: mode.modeId,
      name: mode.name,
    })),
  }));

  figma.ui.postMessage({
    type: 'collections-loaded',
    data: collectionsData,
  });
}

/**
 * Load variables from a specific collection and mode
 * @param variableType - Filter by variable type (defaults to 'COLOR' for backwards compatibility)
 * @param tabId - Optional tab identifier for UI routing
 */
async function loadVariablesFromCollection(
  collectionId: string,
  modeId: string,
  variableType: 'COLOR' | 'FLOAT' | 'STRING' | 'BOOLEAN' = 'COLOR',
  tabId?: string
): Promise<void> {
  const collection = await figma.variables.getVariableCollectionById(collectionId);
  if (!collection) {
    throw new Error('Collection not found');
  }

  const allVariables = await figma.variables.getLocalVariables();
  const variablesInCollection = allVariables.filter(
    (variable) => variable.variableCollectionId === collectionId
  );

  // Process variables - filter by the requested type
  const processedVariables: ProcessedVariable[] = variablesInCollection
    .filter((variable) => variable.resolvedType === variableType)
    .map((variable) => {
      const value = variable.valuesByMode[modeId];
      const nameParts = variable.name.split('/');
      const groupLevel = Math.max(0, nameParts.length - 1);
      const foundMode = collection.modes.find((m) => m.modeId === modeId);

      return {
        id: variable.id,
        name: variable.name,
        displayName: nameParts[nameParts.length - 1],
        fullPath: variable.name,
        nameParts,
        groupLevel,
        type: variable.resolvedType,
        value,
        collection: collection.name,
        mode: foundMode ? foundMode.name : 'Unknown',
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  const selectedMode = collection.modes.find((m) => m.modeId === modeId);

  figma.ui.postMessage({
    type: 'variables-loaded',
    data: {
      variables: processedVariables,
      collectionName: collection.name,
      modeName: selectedMode ? selectedMode.name : 'Unknown',
      tabId,
    },
  });
}

// =============================================================================
// Style Guide Generation
// =============================================================================

/**
 * Handle style guide generation request from UI
 * Routes to appropriate generator based on variable type
 */
async function handleGenerateStyleGuide(data: {
  collectionId: string;
  modeId: string;
  variableIds: string[];
  options: StyleGuideOptions;
}): Promise<void> {
  // Detect variable type from first variable to route to appropriate generator
  let variableType: 'COLOR' | 'FLOAT' | 'STRING' | 'BOOLEAN' = 'COLOR';
  if (data.variableIds.length > 0) {
    const firstVar = await figma.variables.getVariableById(data.variableIds[0]);
    if (firstVar) {
      variableType = firstVar.resolvedType as 'COLOR' | 'FLOAT' | 'STRING' | 'BOOLEAN';
    }
  }

  let result;
  switch (variableType) {
    case 'FLOAT':
      result = await generateDimensionStyleGuide(
        data.collectionId,
        data.modeId,
        data.variableIds,
        data.options
      );
      break;
    case 'COLOR':
    default:
      result = await generateStyleGuide(
        data.collectionId,
        data.modeId,
        data.variableIds,
        data.options
      );
      break;
  }

  figma.ui.postMessage({
    type: 'style-guide-generated',
    data: result,
  });

  if (result.success) {
    figma.notify(`Style guide created: ${result.frameName}`);
  } else {
    figma.notify(`Error: ${result.error}`, { error: true });
  }
}

// =============================================================================
// Text Styles Loading
// =============================================================================

/**
 * Load all local text styles from the current Figma file
 */
async function loadTextStyles(): Promise<void> {
  const textStyles = await figma.getLocalTextStylesAsync();

  const styleInfos: TextStyleInfo[] = [];

  for (const style of textStyles) {
    // Extract bound variables for each property
    const boundVariables: TextStyleInfo['boundVariables'] = {};

    // Check if fontSize is bound to a variable
    if (style.boundVariables?.fontSize) {
      const varId = (style.boundVariables.fontSize as VariableAlias).id;
      const variable = await figma.variables.getVariableByIdAsync(varId);
      if (variable) {
        boundVariables.fontSize = { id: variable.id, name: variable.name };
      }
    }

    // Check if fontFamily is bound to a variable
    if (style.boundVariables?.fontFamily) {
      const varId = (style.boundVariables.fontFamily as VariableAlias).id;
      const variable = await figma.variables.getVariableByIdAsync(varId);
      if (variable) {
        boundVariables.fontFamily = { id: variable.id, name: variable.name };
      }
    }

    // Check if fontStyle is bound to a variable
    if (style.boundVariables?.fontStyle) {
      const varId = (style.boundVariables.fontStyle as VariableAlias).id;
      const variable = await figma.variables.getVariableByIdAsync(varId);
      if (variable) {
        boundVariables.fontStyle = { id: variable.id, name: variable.name };
      }
    }

    // Check if lineHeight is bound to a variable
    if (style.boundVariables?.lineHeight) {
      const varId = (style.boundVariables.lineHeight as VariableAlias).id;
      const variable = await figma.variables.getVariableByIdAsync(varId);
      if (variable) {
        boundVariables.lineHeight = { id: variable.id, name: variable.name };
      }
    }

    // Check if letterSpacing is bound to a variable
    if (style.boundVariables?.letterSpacing) {
      const varId = (style.boundVariables.letterSpacing as VariableAlias).id;
      const variable = await figma.variables.getVariableByIdAsync(varId);
      if (variable) {
        boundVariables.letterSpacing = { id: variable.id, name: variable.name };
      }
    }

    // Format line height
    let lineHeightInfo: TextStyleInfo['lineHeight'];
    if (style.lineHeight === figma.mixed) {
      lineHeightInfo = { value: 0, unit: 'AUTO' };
    } else if (typeof style.lineHeight === 'object' && 'unit' in style.lineHeight) {
      if (style.lineHeight.unit === 'AUTO') {
        lineHeightInfo = { value: 0, unit: 'AUTO' };
      } else {
        lineHeightInfo = {
          value: style.lineHeight.value,
          unit: style.lineHeight.unit as 'PIXELS' | 'PERCENT',
        };
      }
    } else {
      lineHeightInfo = { value: 0, unit: 'AUTO' };
    }

    // Format letter spacing
    let letterSpacingInfo: TextStyleInfo['letterSpacing'];
    if (style.letterSpacing === figma.mixed) {
      letterSpacingInfo = { value: 0, unit: 'PIXELS' };
    } else if (typeof style.letterSpacing === 'object') {
      letterSpacingInfo = {
        value: style.letterSpacing.value,
        unit: style.letterSpacing.unit as 'PIXELS' | 'PERCENT',
      };
    } else {
      letterSpacingInfo = { value: 0, unit: 'PIXELS' };
    }

    // Handle mixed values for fontSize
    const fontSize = style.fontSize === figma.mixed ? 0 : style.fontSize;

    // Handle fontName
    const fontName = style.fontName === figma.mixed
      ? { family: 'Mixed', style: 'Mixed' }
      : style.fontName;

    // Handle textDecoration
    const textDecoration = style.textDecoration === figma.mixed
      ? 'NONE'
      : style.textDecoration;

    // Handle paragraphSpacing
    const paragraphSpacing = style.paragraphSpacing === figma.mixed
      ? 0
      : style.paragraphSpacing;

    styleInfos.push({
      id: style.id,
      name: style.name,
      fontFamily: fontName.family,
      fontStyle: fontName.style,
      fontSize,
      lineHeight: lineHeightInfo,
      letterSpacing: letterSpacingInfo,
      textDecoration: textDecoration as TextStyleInfo['textDecoration'],
      paragraphSpacing,
      description: style.description || '',
      boundVariables: Object.keys(boundVariables).length > 0 ? boundVariables : undefined,
    });
  }

  // Sort by name
  styleInfos.sort((a, b) => a.name.localeCompare(b.name));

  figma.ui.postMessage({
    type: 'text-styles-loaded',
    data: styleInfos,
  });
}

// =============================================================================
// Text Style Guide Generation
// =============================================================================

/**
 * Handle text style guide generation request from UI
 */
async function handleGenerateTextStyleGuide(data: {
  styleIds: string[];
  options: TextStyleGuideOptions;
}): Promise<void> {
  const result = await generateTextStyleGuide(data.styleIds, data.options);

  figma.ui.postMessage({
    type: 'style-guide-generated',
    data: result,
  });

  if (result.success) {
    figma.notify(`Text style guide created: ${result.frameName}`);
  } else {
    figma.notify(`Error: ${result.error}`, { error: true });
  }
}

// =============================================================================
// Font Variables Loading (scope-filtered)
// =============================================================================

/**
 * Font-related variable scopes from Figma's API
 * These cover all typography-related variable scopes
 */
const FONT_VARIABLE_SCOPES = new Set([
  'FONT_FAMILY',
  'FONT_SIZE',
  'FONT_WEIGHT',
  'FONT_STYLE',
  'LETTER_SPACING',
  'LINE_HEIGHT',
]);

/**
 * Load font-scoped variables from a collection.
 * Unlike other loaders, this spans BOTH STRING and FLOAT types
 * and filters by Figma variable scopes.
 */
async function loadFontVariablesFromCollection(
  collectionId: string,
  modeId: string,
  tabId?: string
): Promise<void> {
  const collection = await figma.variables.getVariableCollectionById(collectionId);
  if (!collection) {
    throw new Error('Collection not found');
  }

  const allVariables = await figma.variables.getLocalVariables();
  const variablesInCollection = allVariables.filter(
    (variable) => variable.variableCollectionId === collectionId
  );

  // Filter to variables that have at least one font-related scope
  const fontVariables = variablesInCollection.filter((variable) => {
    // Only STRING and FLOAT types are relevant for font variables
    if (variable.resolvedType !== 'STRING' && variable.resolvedType !== 'FLOAT') {
      return false;
    }
    // Check if any of the variable's scopes are font-related
    return variable.scopes.some((scope) => FONT_VARIABLE_SCOPES.has(scope));
  });

  const processedVariables: ProcessedVariable[] = fontVariables
    .map((variable) => {
      const value = variable.valuesByMode[modeId];
      const nameParts = variable.name.split('/');
      const groupLevel = Math.max(0, nameParts.length - 1);
      const foundMode = collection.modes.find((m) => m.modeId === modeId);

      return {
        id: variable.id,
        name: variable.name,
        displayName: nameParts[nameParts.length - 1],
        fullPath: variable.name,
        nameParts,
        groupLevel,
        type: variable.resolvedType,
        value,
        collection: collection.name,
        mode: foundMode ? foundMode.name : 'Unknown',
        scopes: variable.scopes as string[],
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  const selectedMode = collection.modes.find((m) => m.modeId === modeId);

  figma.ui.postMessage({
    type: 'variables-loaded',
    data: {
      variables: processedVariables,
      collectionName: collection.name,
      modeName: selectedMode ? selectedMode.name : 'Unknown',
      tabId,
    },
  });
}

// =============================================================================
// Font Variable Guide Generation
// =============================================================================

/**
 * Handle font variable guide generation request from UI
 */
async function handleGenerateFontVariableGuide(data: {
  collectionId: string;
  modeId: string;
  variableIds: string[];
  options: FontVariableGuideOptions;
}): Promise<void> {
  const result = await generateFontVariableGuide(
    data.collectionId,
    data.modeId,
    data.variableIds,
    data.options
  );

  figma.ui.postMessage({
    type: 'style-guide-generated',
    data: result,
  });

  if (result.success) {
    figma.notify(`Font variable guide created: ${result.frameName}`);
  } else {
    figma.notify(`Error: ${result.error}`, { error: true });
  }
}
