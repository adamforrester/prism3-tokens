/**
 * Style Guide Generator
 *
 * Generates on-canvas style guides from selected Figma variables.
 * Creates reusable components, text styles, and grid-based layouts.
 */

import { TextStyleGuideOptions, TextStyleInfo, BoundVariableInfo, FontVariableGuideOptions, FontDisplayType } from './messages';

// =============================================================================
// Types
// =============================================================================

export interface StyleGuideOptions {
  displayStyle: 'standard' | 'scale' | 'text-color' | 'border-color' | 'transparency' | 'icon-color';
  colorValue: 'hex' | 'rgb' | 'hsl' | 'hsb';
  displayAliases: boolean;
  showDescription: boolean;
  addTitleCell: boolean;
}

export interface VariableData {
  id: string;
  name: string;
  value: RGBA | VariableAlias;
  resolvedValue?: RGBA;
}

interface GenerationResult {
  success: boolean;
  frameId?: string;
  frameName?: string;
  error?: string;
}

// =============================================================================
// Constants
// =============================================================================

const STYLE_GUIDE_PAGE_NAME = 'Style Guide Components';
const SWATCH_COMPONENT_SET_NAME = '_style-guide-swatches';
const TEXT_CELL_COMPONENT_SET_NAME = '_style-guide-text-cells';
const SPACING_CELL_COMPONENT_SET_NAME = '_style-guide-spacing-cells';

// Component dimensions
const SWATCH_SIZE = 83; // Match cell height for consistent row sizing
const CELL_MIN_HEIGHT = 83;
const CELL_PADDING_H = 40;
const CELL_PADDING_V = 32;
const CELL_PADDING_LEFT = 24;
const CELL_PADDING_RIGHT_EXTRA = 96;
const GRID_GAP = 2;
const GRID_BORDER_RADIUS = 8;

// Colors (hardcoded to avoid variable conflicts)
const COLORS = {
  white: { r: 1, g: 1, b: 1 },
  black: { r: 0, g: 0, b: 0 },
  secondary: { r: 248 / 255, g: 248 / 255, b: 248 / 255 }, // #F8F8F8
  dark: { r: 15 / 255, g: 17 / 255, b: 21 / 255 }, // #0F1115
  textPrimary: { r: 36 / 255, g: 38 / 255, b: 45 / 255 }, // #24262D
  brandSecondary: { r: 101 / 255, g: 2 / 255, b: 230 / 255 }, // #6502E6 - placeholder for variable binding
  spacingFilled: { r: 254 / 255, g: 215 / 255, b: 215 / 255 }, // #FED7D7 - pink fill for spacing indicator
  spacingLine: { r: 99 / 255, g: 102 / 255, b: 241 / 255 }, // #6366F1 - purple line for spacing indicator
};

// Text style specs
const TEXT_STYLES = {
  header: {
    name: '_style-guide/header-default',
    family: 'Inter',
    style: 'Bold',
    size: 16,
    lineHeight: 100,
  },
  cell: {
    name: '_style-guide/cell-default',
    family: 'Inter',
    style: 'Medium',
    size: 16,
    lineHeight: 100,
  },
};

// =============================================================================
// Setup Functions
// =============================================================================

/**
 * Ensures the Style Guide Components page exists
 */
async function ensureStyleGuidePage(): Promise<PageNode> {
  let page = figma.root.children.find(
    (p) => p.type === 'PAGE' && p.name === STYLE_GUIDE_PAGE_NAME
  ) as PageNode | undefined;

  if (!page) {
    page = figma.createPage();
    page.name = STYLE_GUIDE_PAGE_NAME;
    // Move to end of page list
    figma.root.appendChild(page);
  }

  return page;
}

/**
 * Ensures text styles exist for the style guide
 */
async function ensureTextStyles(): Promise<{ header: TextStyle; cell: TextStyle }> {
  const localStyles = await figma.getLocalTextStylesAsync();

  let headerStyle = localStyles.find((s) => s.name === TEXT_STYLES.header.name);
  let cellStyle = localStyles.find((s) => s.name === TEXT_STYLES.cell.name);

  // Load font for creating styles
  await figma.loadFontAsync({ family: TEXT_STYLES.header.family, style: TEXT_STYLES.header.style });
  await figma.loadFontAsync({ family: TEXT_STYLES.cell.family, style: TEXT_STYLES.cell.style });

  if (!headerStyle) {
    headerStyle = figma.createTextStyle();
    headerStyle.name = TEXT_STYLES.header.name;
    headerStyle.fontName = { family: TEXT_STYLES.header.family, style: TEXT_STYLES.header.style };
    headerStyle.fontSize = TEXT_STYLES.header.size;
    headerStyle.lineHeight = { value: TEXT_STYLES.header.lineHeight, unit: 'PERCENT' };
  }

  if (!cellStyle) {
    cellStyle = figma.createTextStyle();
    cellStyle.name = TEXT_STYLES.cell.name;
    cellStyle.fontName = { family: TEXT_STYLES.cell.family, style: TEXT_STYLES.cell.style };
    cellStyle.fontSize = TEXT_STYLES.cell.size;
    cellStyle.lineHeight = { value: TEXT_STYLES.cell.lineHeight, unit: 'PERCENT' };
  }

  return { header: headerStyle, cell: cellStyle };
}

/**
 * Creates the swatch component set
 * Variants: default, text, icon, border, transparency
 */
async function createSwatchComponentSet(page: PageNode): Promise<ComponentSetNode> {
  // Check if already exists
  const existing = page.findOne(
    (n) => n.type === 'COMPONENT_SET' && n.name === SWATCH_COMPONENT_SET_NAME
  ) as ComponentSetNode | null;

  if (existing) {
    return existing;
  }

  // Load fonts for text variant
  await figma.loadFontAsync({ family: 'Inter', style: 'Medium' });

  // -------------------------------------------------------------------------
  // 1. Default swatch - solid color fill (will be bound to variable)
  // -------------------------------------------------------------------------
  const defaultSwatch = figma.createComponent();
  defaultSwatch.name = 'type=default';
  defaultSwatch.resize(SWATCH_SIZE, SWATCH_SIZE);
  defaultSwatch.fills = [{ type: 'SOLID', color: COLORS.brandSecondary }];
  page.appendChild(defaultSwatch);

  // -------------------------------------------------------------------------
  // 2. Text swatch - white background, "Aa" text filled with variable color
  // -------------------------------------------------------------------------
  const textSwatch = figma.createComponent();
  textSwatch.name = 'type=text';
  textSwatch.resize(SWATCH_SIZE, SWATCH_SIZE);
  textSwatch.fills = [{ type: 'SOLID', color: COLORS.white }];
  textSwatch.layoutMode = 'VERTICAL';
  textSwatch.primaryAxisAlignItems = 'CENTER';
  textSwatch.counterAxisAlignItems = 'CENTER';
  textSwatch.primaryAxisSizingMode = 'FIXED';
  textSwatch.counterAxisSizingMode = 'FIXED';

  const textNode = figma.createText();
  textNode.name = 'Preview text';
  textNode.fontName = { family: 'Inter', style: 'Medium' };
  textNode.characters = 'Aa';
  textNode.fontSize = 36;
  textNode.fills = [{ type: 'SOLID', color: COLORS.brandSecondary }]; // Will be bound to variable
  textNode.textAlignHorizontal = 'CENTER';
  textNode.textAlignVertical = 'CENTER';
  textSwatch.appendChild(textNode);
  page.appendChild(textSwatch);

  // -------------------------------------------------------------------------
  // 3. Icon swatch - white background, diamond icon filled with variable color
  // -------------------------------------------------------------------------
  const iconSwatch = figma.createComponent();
  iconSwatch.name = 'type=icon';
  iconSwatch.resize(SWATCH_SIZE, SWATCH_SIZE);
  iconSwatch.fills = [{ type: 'SOLID', color: COLORS.white }];
  iconSwatch.layoutMode = 'VERTICAL';
  iconSwatch.primaryAxisAlignItems = 'CENTER';
  iconSwatch.counterAxisAlignItems = 'CENTER';
  iconSwatch.primaryAxisSizingMode = 'FIXED';
  iconSwatch.counterAxisSizingMode = 'FIXED';

  const iconRect = figma.createRectangle();
  iconRect.name = 'Preview icon';
  iconRect.resize(24, 24);
  iconRect.rotation = 45;
  iconRect.cornerRadius = 2;
  iconRect.fills = [{ type: 'SOLID', color: COLORS.brandSecondary }]; // Will be bound to variable
  iconSwatch.appendChild(iconRect);
  page.appendChild(iconSwatch);

  // -------------------------------------------------------------------------
  // 4. Border swatch - white background, rectangle with variable stroke
  // -------------------------------------------------------------------------
  const borderSwatch = figma.createComponent();
  borderSwatch.name = 'type=border';
  borderSwatch.resize(SWATCH_SIZE, SWATCH_SIZE);
  borderSwatch.fills = [{ type: 'SOLID', color: COLORS.white }];
  borderSwatch.layoutMode = 'VERTICAL';
  borderSwatch.primaryAxisAlignItems = 'CENTER';
  borderSwatch.counterAxisAlignItems = 'CENTER';
  borderSwatch.primaryAxisSizingMode = 'FIXED';
  borderSwatch.counterAxisSizingMode = 'FIXED';

  const borderRect = figma.createRectangle();
  borderRect.name = 'Border preview';
  borderRect.resize(36, 36);
  borderRect.cornerRadius = 2;
  borderRect.fills = []; // No fill
  borderRect.strokes = [{ type: 'SOLID', color: COLORS.brandSecondary }]; // Will be bound to variable
  borderRect.strokeWeight = 3;
  borderSwatch.appendChild(borderRect);
  page.appendChild(borderSwatch);

  // -------------------------------------------------------------------------
  // 5. Transparency swatch - checkered background + color fill overlay
  // -------------------------------------------------------------------------
  const transparencySwatch = figma.createComponent();
  transparencySwatch.name = 'type=transparency';
  transparencySwatch.resize(SWATCH_SIZE, SWATCH_SIZE);
  transparencySwatch.clipsContent = true;

  // Create checkered background using a group of small rectangles
  // This creates the classic transparency checkerboard pattern
  const checkerSize = 8; // Size of each checker square
  const lightGray = { r: 1, g: 1, b: 1 }; // White
  const darkGray = { r: 0.8, g: 0.8, b: 0.8 }; // Light gray

  const checkerGroup = figma.createFrame();
  checkerGroup.name = 'Checkered background';
  checkerGroup.resize(SWATCH_SIZE, SWATCH_SIZE);
  checkerGroup.x = 0;
  checkerGroup.y = 0;
  checkerGroup.fills = [{ type: 'SOLID', color: lightGray }];
  checkerGroup.clipsContent = true;

  // Create dark squares in checkerboard pattern
  for (let row = 0; row < Math.ceil(SWATCH_SIZE / checkerSize); row++) {
    for (let col = 0; col < Math.ceil(SWATCH_SIZE / checkerSize); col++) {
      // Only create dark squares (alternating pattern)
      if ((row + col) % 2 === 1) {
        const square = figma.createRectangle();
        square.resize(checkerSize, checkerSize);
        square.x = col * checkerSize;
        square.y = row * checkerSize;
        square.fills = [{ type: 'SOLID', color: darkGray }];
        checkerGroup.appendChild(square);
      }
    }
  }

  transparencySwatch.appendChild(checkerGroup);

  // Color overlay (will be bound to variable with opacity)
  const colorOverlay = figma.createRectangle();
  colorOverlay.name = 'Color overlay';
  colorOverlay.resize(SWATCH_SIZE, SWATCH_SIZE);
  colorOverlay.x = 0;
  colorOverlay.y = 0;
  colorOverlay.fills = [{ type: 'SOLID', color: COLORS.brandSecondary, opacity: 0.6 }]; // Will be bound to variable
  transparencySwatch.appendChild(colorOverlay);

  // No auto-layout for transparency - use absolute positioning
  page.appendChild(transparencySwatch);

  // -------------------------------------------------------------------------
  // 6. Radius swatch - shows corner with configurable border radius
  // -------------------------------------------------------------------------
  const radiusSwatch = figma.createComponent();
  radiusSwatch.name = 'type=radius';
  radiusSwatch.resize(SWATCH_SIZE, SWATCH_SIZE);
  radiusSwatch.fills = [{ type: 'SOLID', color: COLORS.white }];
  radiusSwatch.layoutMode = 'VERTICAL';
  radiusSwatch.primaryAxisAlignItems = 'CENTER';
  radiusSwatch.counterAxisAlignItems = 'CENTER';
  radiusSwatch.primaryAxisSizingMode = 'FIXED';
  radiusSwatch.counterAxisSizingMode = 'FIXED';

  // Container that clips the corner view (48x48)
  const radiusContainer = figma.createFrame();
  radiusContainer.name = 'radius-example-container';
  radiusContainer.resize(48, 48);
  radiusContainer.fills = [];
  radiusContainer.clipsContent = true;

  // Inner rectangle that shows the corner (positioned so only top-left corner is visible)
  const radiusExample = figma.createFrame();
  radiusExample.name = 'radius-example';
  radiusExample.resize(256, 96);
  radiusExample.x = 0;
  radiusExample.y = 0;
  radiusExample.fills = [{ type: 'SOLID', color: { r: 245/255, g: 238/255, b: 255/255 } }]; // #F5EEFF light purple
  radiusExample.strokes = [{ type: 'SOLID', color: COLORS.brandSecondary }];
  radiusExample.strokeWeight = 2;
  radiusExample.cornerRadius = 8; // Default, will be overridden per instance

  radiusContainer.appendChild(radiusExample);
  radiusSwatch.appendChild(radiusContainer);
  page.appendChild(radiusSwatch);

  // -------------------------------------------------------------------------
  // Combine all variants into component set
  // -------------------------------------------------------------------------
  const componentSet = figma.combineAsVariants(
    [defaultSwatch, textSwatch, iconSwatch, borderSwatch, transparencySwatch, radiusSwatch],
    page
  );
  componentSet.name = SWATCH_COMPONENT_SET_NAME;

  // Enable auto-layout on the component set so variants don't overlap
  componentSet.layoutMode = 'VERTICAL';
  componentSet.primaryAxisSizingMode = 'AUTO';
  componentSet.counterAxisSizingMode = 'AUTO';
  componentSet.itemSpacing = 16;
  componentSet.paddingTop = componentSet.paddingBottom = 16;
  componentSet.paddingLeft = componentSet.paddingRight = 16;

  componentSet.x = 100;
  componentSet.y = 100;

  return componentSet;
}

/**
 * Creates the text cell component set
 * Based on exact Figma spec:
 * - color: white (#FFFFFF bg), secondary (#F8F8F8 bg), dark (#0F1115 bg)
 * - textAlign: center, left
 * - type: default (Medium), header (Bold), alias (with link icon + pill container)
 * - padding: default (40px h, 32px v), extra right (96px right padding)
 *
 * Valid combinations (excluding invalid):
 * - alias type: only white color, left align, default padding
 * - header type: no extra right padding
 * - dark color: only header type, no extra right padding
 * - extra right padding: only left align, default type
 */
async function createTextCellComponentSet(page: PageNode): Promise<ComponentSetNode> {
  // Clean up any existing text cell components/component sets
  // Look for both component sets AND stray components with variant-like names
  const existingNodes = page.findAll(
    (n) => (n.type === 'COMPONENT_SET' && n.name === TEXT_CELL_COMPONENT_SET_NAME) ||
           (n.type === 'COMPONENT' && n.name.includes('color=') && n.name.includes('textAlign=')) ||
           (n.type === 'FRAME' && n.name.includes('color=') && n.name.includes('textAlign='))
  );

  // Check if we have a valid component set with correct structure
  const existingSet = existingNodes.find(n => n.type === 'COMPONENT_SET') as ComponentSetNode | undefined;
  if (existingSet) {
    // Check for both alias and value alias variants
    const aliasVariant = existingSet.findOne(
      (n) => n.type === 'COMPONENT' && n.name.includes('type=alias') && !n.name.includes('type=value alias')
    ) as ComponentNode | null;

    const valueAliasVariant = existingSet.findOne(
      (n) => n.type === 'COMPONENT' && n.name.includes('type=value alias')
    ) as ComponentNode | null;

    const hasCorrectAliasStructure = aliasVariant?.findOne(
      (n) => n.name === '_Alias'
    );

    const hasValueAliasStructure = valueAliasVariant?.findOne(
      (n) => n.name === '_Alias'
    );

    if (hasCorrectAliasStructure && hasValueAliasStructure) {
      return existingSet;
    }
  }

  // Remove all existing nodes to start fresh
  for (const node of existingNodes) {
    node.remove();
  }

  // Load required fonts
  await figma.loadFontAsync({ family: 'Inter', style: 'Medium' });
  await figma.loadFontAsync({ family: 'Inter', style: 'Bold' });
  await figma.loadFontAsync({ family: 'Inter', style: 'Semi Bold' });

  const components: ComponentNode[] = [];

  // Color definitions matching the spec
  const CELL_COLORS: Record<string, { bg: RGB; text: RGB; headerText: RGB }> = {
    white: { bg: COLORS.white, text: COLORS.black, headerText: COLORS.textPrimary },
    secondary: { bg: COLORS.secondary, text: COLORS.black, headerText: COLORS.textPrimary },
    dark: { bg: COLORS.dark, text: COLORS.white, headerText: COLORS.white },
  };

  // Padding definitions
  const PADDING: Record<string, { left: number; right: number; leftAlignLeft: number; top: number; bottom: number }> = {
    default: { left: 40, right: 40, leftAlignLeft: 24, top: 32, bottom: 32 },
    'extra right': { left: 24, right: 96, leftAlignLeft: 24, top: 32, bottom: 32 },
  };

  // Helper to create a basic text cell component
  function createBasicTextCell(
    color: 'white' | 'secondary' | 'dark',
    textAlign: 'center' | 'left',
    type: 'default' | 'header',
    padding: 'default' | 'extra right'
  ): ComponentNode {
    const colorDef = CELL_COLORS[color];
    const paddingDef = PADDING[padding];

    const component = figma.createComponent();
    component.name = `color=${color}, textAlign=${textAlign}, type=${type}, padding=${padding}`;
    component.resize(252, CELL_MIN_HEIGHT);
    component.fills = [{ type: 'SOLID', color: colorDef.bg }];
    component.layoutMode = 'VERTICAL';
    component.primaryAxisAlignItems = 'CENTER';
    component.counterAxisAlignItems = textAlign === 'center' ? 'CENTER' : 'MIN';
    component.itemSpacing = 16;
    component.paddingTop = paddingDef.top;
    component.paddingBottom = paddingDef.bottom;
    component.paddingLeft = textAlign === 'center' ? paddingDef.left : paddingDef.leftAlignLeft;
    component.paddingRight = paddingDef.right;

    const text = figma.createText();
    text.name = '100';
    text.fontName = { family: 'Inter', style: type === 'header' ? 'Bold' : 'Medium' };
    text.characters = '100';
    text.fontSize = 16;
    text.lineHeight = { value: 100, unit: 'PERCENT' };
    text.fills = [{ type: 'SOLID', color: type === 'header' ? colorDef.headerText : colorDef.text }];
    text.textAlignHorizontal = textAlign === 'center' ? 'CENTER' : 'LEFT';
    text.textAlignVertical = 'CENTER';

    // Must append to auto-layout parent BEFORE setting layout sizing
    component.appendChild(text);
    text.layoutSizingHorizontal = 'HUG';
    text.layoutSizingVertical = 'HUG';

    return component;
  }

  // Helper to create alias variant (only white, left, default padding)
  // Uses reduced vertical padding (24px) to match other cell heights
  function createAliasTextCell(): ComponentNode {
    const component = figma.createComponent();
    component.name = 'color=white, textAlign=left, type=alias, padding=default';
    component.resize(252, CELL_MIN_HEIGHT);
    component.fills = [{ type: 'SOLID', color: COLORS.white }];
    component.layoutMode = 'VERTICAL';
    component.primaryAxisAlignItems = 'CENTER';
    component.counterAxisAlignItems = 'MIN';
    component.itemSpacing = 16;
    component.paddingTop = 24;
    component.paddingBottom = 24;
    component.paddingLeft = 24;
    component.paddingRight = 40;
    // Height will be set to FILL after appending to parent

    // Create the _Alias pill container
    const aliasContainer = figma.createFrame();
    aliasContainer.name = '_Alias';
    aliasContainer.fills = [{ type: 'SOLID', color: { r: 240/255, g: 241/255, b: 243/255 } }]; // #F0F1F3
    aliasContainer.layoutMode = 'HORIZONTAL';
    aliasContainer.primaryAxisAlignItems = 'CENTER';
    aliasContainer.counterAxisAlignItems = 'CENTER';
    aliasContainer.paddingLeft = 12;
    aliasContainer.paddingRight = 12;
    aliasContainer.paddingTop = 4;
    aliasContainer.paddingBottom = 4;
    aliasContainer.itemSpacing = 10;
    aliasContainer.cornerRadius = 6;
    aliasContainer.resize(180, 30);
    aliasContainer.clipsContent = true;

    // Create link icon (16x16) using the exact SVG paths
    const linkIcon = figma.createFrame();
    linkIcon.name = 'link';
    linkIcon.resize(16, 16);
    linkIcon.fills = [];
    linkIcon.clipsContent = false;

    const fillColor = { r: 101/255, g: 106/255, b: 122/255 }; // #656A7A

    // Path 1: Upper-right chain link
    const path1 = figma.createVector();
    path1.vectorPaths = [{
      windingRule: 'NONZERO',
      data: 'M 14.5732 1.42883 C 13.6512 0.507773 12.426 0 11.1229 0 C 9.81979 0 8.59394 0.507773 7.67265 1.42883 L 5.85111 3.24994 C 5.62455 3.47646 5.49927 3.77797 5.49927 4.09824 C 5.49927 4.41852 5.6238 4.72003 5.85111 4.94655 C 6.31925 5.41458 7.07996 5.41458 7.5481 4.94655 L 9.36963 3.12544 C 9.83852 2.65741 10.4605 2.40016 11.1229 2.40016 C 11.7853 2.40016 12.408 2.65818 12.8762 3.12619 C 13.8432 4.093 13.8432 5.66515 12.8762 6.63193 L 11.0546 8.45304 C 10.828 8.67955 10.7028 8.98106 10.7028 9.30209 C 10.7028 9.62311 10.8273 9.92388 11.0546 10.1504 C 11.2812 10.3769 11.5828 10.5022 11.9031 10.5022 C 12.2235 10.5022 12.5251 10.3777 12.7516 10.1504 L 14.5732 8.32928 C 16.4757 6.42718 16.4757 3.33181 14.5732 1.42956 L 14.5732 1.42883 Z'
    }];
    path1.fills = [{ type: 'SOLID', color: fillColor }];
    path1.strokes = [];
    linkIcon.appendChild(path1);

    // Path 2: Lower-left chain link
    const path2 = figma.createVector();
    path2.vectorPaths = [{
      windingRule: 'NONZERO',
      data: 'M 8.45195 11.0541 L 6.63041 12.8752 C 6.16153 13.3433 5.53959 13.6005 4.87715 13.6005 C 4.21471 13.6005 3.59203 13.3425 3.12389 12.8745 C 2.15685 11.9077 2.15685 10.3355 3.12389 9.36875 L 4.94543 7.54765 C 5.172 7.32113 5.29727 7.01962 5.29727 6.69859 C 5.29727 6.37757 5.17274 6.0768 4.94543 5.85029 C 4.47729 5.38226 3.71658 5.38226 3.24844 5.85029 L 1.42691 7.6714 C -0.475636 9.5735 -0.475636 12.6689 1.42691 14.5711 C 2.34893 15.4922 3.57409 16 4.87719 16 C 6.18033 16 7.40618 15.4922 8.32747 14.5711 L 10.149 12.75 C 10.3756 12.5235 10.5009 12.222 10.5009 11.9017 C 10.5009 11.5814 10.3763 11.2799 10.149 11.0534 C 9.68087 10.5854 8.92016 10.5854 8.45202 11.0534 L 8.45195 11.0541 Z'
    }];
    path2.fills = [{ type: 'SOLID', color: fillColor }];
    path2.strokes = [];
    linkIcon.appendChild(path2);

    // Path 3: Diagonal connecting bar
    const path3 = figma.createVector();
    path3.vectorPaths = [{
      windingRule: 'NONZERO',
      data: 'M 4.19751 10.6019 C 4.19751 10.9222 4.32205 11.2237 4.54936 11.4502 C 4.77592 11.6767 5.07751 11.802 5.39786 11.802 C 5.71821 11.802 6.01979 11.6774 6.24636 11.4502 L 11.4507 6.24784 C 11.6773 6.02133 11.8025 5.71981 11.8025 5.39879 C 11.8025 5.07776 11.678 4.777 11.4507 4.55048 C 10.9826 4.08246 10.2218 4.08246 9.7537 4.55048 L 4.54938 9.75283 C 4.32281 9.97934 4.19751 10.2809 4.19751 10.6019 Z'
    }];
    path3.fills = [{ type: 'SOLID', color: fillColor }];
    path3.strokes = [];
    linkIcon.appendChild(path3);

    aliasContainer.appendChild(linkIcon);

    // Create alias text
    const aliasText = figma.createText();
    aliasText.name = 'AliasText';
    aliasText.fontName = { family: 'Inter', style: 'Semi Bold' };
    aliasText.characters = 'color-neutral-100';
    aliasText.fontSize = 16;
    aliasText.lineHeight = { value: 100, unit: 'PERCENT' };
    aliasText.fills = [{ type: 'SOLID', color: COLORS.textPrimary }];

    // Must append to auto-layout parent BEFORE setting layout sizing
    aliasContainer.appendChild(aliasText);
    aliasText.layoutSizingHorizontal = 'HUG';
    aliasText.layoutSizingVertical = 'HUG';

    // Must append aliasContainer to component BEFORE setting its layout sizing
    component.appendChild(aliasContainer);
    aliasContainer.layoutSizingHorizontal = 'HUG';
    aliasContainer.layoutSizingVertical = 'FIXED';

    return component;
  }

  // Helper to create value alias variant (shows value + alias side by side)
  // Only white, left, default padding
  function createValueAliasTextCell(): ComponentNode {
    const component = figma.createComponent();
    component.name = 'color=white, textAlign=left, type=value alias, padding=default';
    component.resize(300, CELL_MIN_HEIGHT);
    component.fills = [{ type: 'SOLID', color: COLORS.white }];
    component.layoutMode = 'HORIZONTAL'; // Horizontal to place value and alias side by side
    component.primaryAxisAlignItems = 'MIN';
    component.counterAxisAlignItems = 'CENTER';
    component.itemSpacing = 12; // Gap between value and alias
    component.paddingTop = 24;
    component.paddingBottom = 24;
    component.paddingLeft = 24;
    component.paddingRight = 40;

    // Create the value text (on the left)
    const valueText = figma.createText();
    valueText.name = '100'; // Same name as default cells for consistency
    valueText.fontName = { family: 'Inter', style: 'Medium' };
    valueText.characters = '16px';
    valueText.fontSize = 16;
    valueText.lineHeight = { value: 100, unit: 'PERCENT' };
    valueText.fills = [{ type: 'SOLID', color: COLORS.black }];
    valueText.textAlignHorizontal = 'LEFT';
    valueText.textAlignVertical = 'CENTER';

    component.appendChild(valueText);
    valueText.layoutSizingHorizontal = 'HUG';
    valueText.layoutSizingVertical = 'HUG';

    // Create the _Alias pill container (on the right)
    const aliasContainer = figma.createFrame();
    aliasContainer.name = '_Alias';
    aliasContainer.fills = [{ type: 'SOLID', color: { r: 240/255, g: 241/255, b: 243/255 } }]; // #F0F1F3
    aliasContainer.layoutMode = 'HORIZONTAL';
    aliasContainer.primaryAxisAlignItems = 'CENTER';
    aliasContainer.counterAxisAlignItems = 'CENTER';
    aliasContainer.paddingLeft = 12;
    aliasContainer.paddingRight = 12;
    aliasContainer.paddingTop = 4;
    aliasContainer.paddingBottom = 4;
    aliasContainer.itemSpacing = 10;
    aliasContainer.cornerRadius = 6;
    aliasContainer.resize(180, 30);
    aliasContainer.clipsContent = true;

    // Create link icon (16x16)
    const linkIcon = figma.createFrame();
    linkIcon.name = 'link';
    linkIcon.resize(16, 16);
    linkIcon.fills = [];
    linkIcon.clipsContent = false;

    const fillColor = { r: 101/255, g: 106/255, b: 122/255 }; // #656A7A

    // Path 1: Upper-right chain link
    const path1 = figma.createVector();
    path1.vectorPaths = [{
      windingRule: 'NONZERO',
      data: 'M 14.5732 1.42883 C 13.6512 0.507773 12.426 0 11.1229 0 C 9.81979 0 8.59394 0.507773 7.67265 1.42883 L 5.85111 3.24994 C 5.62455 3.47646 5.49927 3.77797 5.49927 4.09824 C 5.49927 4.41852 5.6238 4.72003 5.85111 4.94655 C 6.31925 5.41458 7.07996 5.41458 7.5481 4.94655 L 9.36963 3.12544 C 9.83852 2.65741 10.4605 2.40016 11.1229 2.40016 C 11.7853 2.40016 12.408 2.65818 12.8762 3.12619 C 13.8432 4.093 13.8432 5.66515 12.8762 6.63193 L 11.0546 8.45304 C 10.828 8.67955 10.7028 8.98106 10.7028 9.30209 C 10.7028 9.62311 10.8273 9.92388 11.0546 10.1504 C 11.2812 10.3769 11.5828 10.5022 11.9031 10.5022 C 12.2235 10.5022 12.5251 10.3777 12.7516 10.1504 L 14.5732 8.32928 C 16.4757 6.42718 16.4757 3.33181 14.5732 1.42956 L 14.5732 1.42883 Z'
    }];
    path1.fills = [{ type: 'SOLID', color: fillColor }];
    path1.strokes = [];
    linkIcon.appendChild(path1);

    // Path 2: Lower-left chain link
    const path2 = figma.createVector();
    path2.vectorPaths = [{
      windingRule: 'NONZERO',
      data: 'M 8.45195 11.0541 L 6.63041 12.8752 C 6.16153 13.3433 5.53959 13.6005 4.87715 13.6005 C 4.21471 13.6005 3.59203 13.3425 3.12389 12.8745 C 2.15685 11.9077 2.15685 10.3355 3.12389 9.36875 L 4.94543 7.54765 C 5.172 7.32113 5.29727 7.01962 5.29727 6.69859 C 5.29727 6.37757 5.17274 6.0768 4.94543 5.85029 C 4.47729 5.38226 3.71658 5.38226 3.24844 5.85029 L 1.42691 7.6714 C -0.475636 9.5735 -0.475636 12.6689 1.42691 14.5711 C 2.34893 15.4922 3.57409 16 4.87719 16 C 6.18033 16 7.40618 15.4922 8.32747 14.5711 L 10.149 12.75 C 10.3756 12.5235 10.5009 12.222 10.5009 11.9017 C 10.5009 11.5814 10.3763 11.2799 10.149 11.0534 C 9.68087 10.5854 8.92016 10.5854 8.45202 11.0534 L 8.45195 11.0541 Z'
    }];
    path2.fills = [{ type: 'SOLID', color: fillColor }];
    path2.strokes = [];
    linkIcon.appendChild(path2);

    // Path 3: Diagonal connecting bar
    const path3 = figma.createVector();
    path3.vectorPaths = [{
      windingRule: 'NONZERO',
      data: 'M 4.19751 10.6019 C 4.19751 10.9222 4.32205 11.2237 4.54936 11.4502 C 4.77592 11.6767 5.07751 11.802 5.39786 11.802 C 5.71821 11.802 6.01979 11.6774 6.24636 11.4502 L 11.4507 6.24784 C 11.6773 6.02133 11.8025 5.71981 11.8025 5.39879 C 11.8025 5.07776 11.678 4.777 11.4507 4.55048 C 10.9826 4.08246 10.2218 4.08246 9.7537 4.55048 L 4.54938 9.75283 C 4.32281 9.97934 4.19751 10.2809 4.19751 10.6019 Z'
    }];
    path3.fills = [{ type: 'SOLID', color: fillColor }];
    path3.strokes = [];
    linkIcon.appendChild(path3);

    aliasContainer.appendChild(linkIcon);

    // Create alias text
    const aliasText = figma.createText();
    aliasText.name = 'AliasText';
    aliasText.fontName = { family: 'Inter', style: 'Semi Bold' };
    aliasText.characters = 'font-size/base';
    aliasText.fontSize = 16;
    aliasText.lineHeight = { value: 100, unit: 'PERCENT' };
    aliasText.fills = [{ type: 'SOLID', color: COLORS.textPrimary }];

    aliasContainer.appendChild(aliasText);
    aliasText.layoutSizingHorizontal = 'HUG';
    aliasText.layoutSizingVertical = 'HUG';

    component.appendChild(aliasContainer);
    aliasContainer.layoutSizingHorizontal = 'HUG';
    aliasContainer.layoutSizingVertical = 'FIXED';

    return component;
  }


  // Create valid variant combinations based on the spec
  // Default variants (white and secondary colors, all aligns, default padding)
  for (const color of ['white', 'secondary'] as const) {
    for (const textAlign of ['center', 'left'] as const) {
      const comp = createBasicTextCell(color, textAlign, 'default', 'default');
      page.appendChild(comp);
      components.push(comp);
    }
  }

  // Header variants (white and dark colors only - per spec)
  for (const color of ['white', 'dark'] as const) {
    for (const textAlign of ['center', 'left'] as const) {
      const comp = createBasicTextCell(color, textAlign, 'header', 'default');
      page.appendChild(comp);
      components.push(comp);
    }
  }

  // Extra right padding variants (white and secondary, left align only, default type only)
  for (const color of ['white', 'secondary'] as const) {
    const comp = createBasicTextCell(color, 'left', 'default', 'extra right');
    page.appendChild(comp);
    components.push(comp);
  }

  // Alias variant (only white, left, default padding)
  const aliasComp = createAliasTextCell();
  page.appendChild(aliasComp);
  components.push(aliasComp);

  // Value Alias variant (shows value + alias side by side, only white, left, default padding)
  const valueAliasComp = createValueAliasTextCell();
  page.appendChild(valueAliasComp);
  components.push(valueAliasComp);


  // Combine into component set
  const componentSet = figma.combineAsVariants(components, page);
  componentSet.name = TEXT_CELL_COMPONENT_SET_NAME;

  // Enable auto-layout on the component set
  componentSet.layoutMode = 'VERTICAL';
  componentSet.primaryAxisSizingMode = 'AUTO';
  componentSet.counterAxisSizingMode = 'AUTO';
  componentSet.itemSpacing = 16;
  componentSet.paddingTop = componentSet.paddingBottom = 16;
  componentSet.paddingLeft = componentSet.paddingRight = 16;

  componentSet.x = 300;
  componentSet.y = 100;

  return componentSet;
}

// =============================================================================
// Spacing Cell Component Set
// =============================================================================

/**
 * Spacing cell component set for visual spacing indicators
 * Creates components with two display variants:
 * - filled: Solid rectangle with width representing spacing value
 * - line: Line with vertical endpoints (ruler-style marking)
 */
async function createSpacingCellComponentSet(page: PageNode): Promise<ComponentSetNode> {
  // Check for existing component set
  const existingSet = page.findOne(
    (n) => n.type === 'COMPONENT_SET' && n.name === SPACING_CELL_COMPONENT_SET_NAME
  ) as ComponentSetNode | null;

  if (existingSet) {
    return existingSet;
  }


  const components: ComponentNode[] = [];

  // Create filled variant
  const filledComponent = figma.createComponent();
  filledComponent.name = 'display=filled';
  filledComponent.resize(252, CELL_MIN_HEIGHT);
  filledComponent.fills = [{ type: 'SOLID', color: COLORS.white }];
  filledComponent.layoutMode = 'HORIZONTAL';
  filledComponent.primaryAxisAlignItems = 'MIN';
  filledComponent.counterAxisAlignItems = 'CENTER';
  filledComponent.paddingLeft = 24;
  filledComponent.paddingRight = 40;
  filledComponent.paddingTop = 25;
  filledComponent.paddingBottom = 25;

  // Create the spacing indicator rectangle (default 8px width)
  const filledIndicator = figma.createFrame();
  filledIndicator.name = 'spacing-filled-example';
  filledIndicator.resize(8, 20);
  filledIndicator.fills = [{ type: 'SOLID', color: COLORS.spacingFilled }];
  filledIndicator.layoutMode = 'NONE';

  filledComponent.appendChild(filledIndicator);
  filledIndicator.layoutSizingHorizontal = 'FIXED';
  filledIndicator.layoutSizingVertical = 'FIXED';

  page.appendChild(filledComponent);
  components.push(filledComponent);

  // Create line variant
  const lineComponent = figma.createComponent();
  lineComponent.name = 'display=line';
  lineComponent.resize(252, CELL_MIN_HEIGHT);
  lineComponent.fills = [{ type: 'SOLID', color: COLORS.white }];
  lineComponent.layoutMode = 'HORIZONTAL';
  lineComponent.primaryAxisAlignItems = 'MIN';
  lineComponent.counterAxisAlignItems = 'CENTER';
  lineComponent.paddingLeft = 24;
  lineComponent.paddingRight = 40;
  lineComponent.paddingTop = 24;
  lineComponent.paddingBottom = 24;

  // Create the line indicator container (default 8px width)
  const lineIndicator = figma.createFrame();
  lineIndicator.name = 'spacing-line-example';
  lineIndicator.resize(8, 16);
  lineIndicator.fills = [];
  lineIndicator.layoutMode = 'NONE';
  lineIndicator.clipsContent = false;

  // Create left vertical bar
  const leftBar = figma.createRectangle();
  leftBar.name = 'left-bar';
  leftBar.resize(1, 16);
  leftBar.x = 0;
  leftBar.y = 0;
  leftBar.fills = [{ type: 'SOLID', color: COLORS.spacingLine }];
  lineIndicator.appendChild(leftBar);

  // Create horizontal line
  const horizontalLine = figma.createRectangle();
  horizontalLine.name = 'horizontal-line';
  horizontalLine.resize(8, 1);
  horizontalLine.x = 0;
  horizontalLine.y = 7.5; // Center vertically
  horizontalLine.fills = [{ type: 'SOLID', color: COLORS.spacingLine }];
  lineIndicator.appendChild(horizontalLine);

  // Create right vertical bar
  const rightBar = figma.createRectangle();
  rightBar.name = 'right-bar';
  rightBar.resize(1, 16);
  rightBar.x = 7; // Position at right edge
  rightBar.y = 0;
  rightBar.fills = [{ type: 'SOLID', color: COLORS.spacingLine }];
  lineIndicator.appendChild(rightBar);

  lineComponent.appendChild(lineIndicator);
  lineIndicator.layoutSizingHorizontal = 'FIXED';
  lineIndicator.layoutSizingVertical = 'FIXED';

  page.appendChild(lineComponent);
  components.push(lineComponent);

  // Combine into component set
  const componentSet = figma.combineAsVariants(components, page);
  componentSet.name = SPACING_CELL_COMPONENT_SET_NAME;

  // Enable auto-layout on the component set
  componentSet.layoutMode = 'VERTICAL';
  componentSet.primaryAxisSizingMode = 'AUTO';
  componentSet.counterAxisSizingMode = 'AUTO';
  componentSet.itemSpacing = 16;
  componentSet.paddingTop = componentSet.paddingBottom = 16;
  componentSet.paddingLeft = componentSet.paddingRight = 16;

  componentSet.x = 600;
  componentSet.y = 100;

  return componentSet;
}

/**
 * Creates a spacing cell with a specific width
 * Note: We detach the instance to allow modifying nested element widths
 */
async function createSpacingCellInstance(
  componentSet: ComponentSetNode,
  width: number,
  display: 'filled' | 'line' = 'filled'
): Promise<FrameNode> {
  // Find the matching variant
  const variant = componentSet.findOne(
    (n) => n.type === 'COMPONENT' && n.name === `display=${display}`
  ) as ComponentNode | null;

  if (!variant) {
    throw new Error(`Spacing cell variant not found: display=${display}`);
  }

  const instance = variant.createInstance();

  // Detach the instance to allow modifying nested elements
  const detachedFrame = instance.detachInstance();

  // Find the indicator element and set its width
  const indicatorName = display === 'filled' ? 'spacing-filled-example' : 'spacing-line-example';
  const indicator = detachedFrame.findOne((n) => n.name === indicatorName) as FrameNode | null;

  if (indicator) {
    // Ensure width is at least 1px and reasonable (max 500px for display)
    const clampedWidth = Math.max(1, Math.min(width, 500));
    indicator.resize(clampedWidth, indicator.height);

    // For line display, also update the horizontal line and right bar positions
    if (display === 'line') {
      const horizontalLine = indicator.findOne((n) => n.name === 'horizontal-line') as RectangleNode | null;
      const rightBar = indicator.findOne((n) => n.name === 'right-bar') as RectangleNode | null;

      if (horizontalLine) {
        horizontalLine.resize(clampedWidth, 1);
      }
      if (rightBar) {
        rightBar.x = clampedWidth - 1;
      }
    }
  }

  return detachedFrame;
}

/**
 * Creates a radius swatch instance with a specific border radius value
 * Note: We detach the instance to allow modifying the nested radius-example element
 */
async function createRadiusSwatchInstance(
  componentSet: ComponentSetNode,
  radiusValue: number
): Promise<FrameNode> {
  // Find the radius variant
  const variant = componentSet.findOne(
    (n) => n.type === 'COMPONENT' && n.name === 'type=radius'
  ) as ComponentNode | null;

  if (!variant) {
    throw new Error('Radius swatch variant not found');
  }

  const instance = variant.createInstance();

  // Detach the instance to allow modifying nested elements
  const detachedFrame = instance.detachInstance();

  // Find the radius-example element and set its corner radius
  const radiusExample = detachedFrame.findOne((n) => n.name === 'radius-example') as FrameNode | null;

  if (radiusExample) {
    // Clamp radius to reasonable value (max 48px to fit in the container)
    const clampedRadius = Math.max(0, Math.min(radiusValue, 48));
    radiusExample.cornerRadius = clampedRadius;
  }

  return detachedFrame;
}

// =============================================================================
// Color Utilities
// =============================================================================

/**
 * Converts RGBA (0-1 range) to hex string
 */
function rgbaToHex(color: RGBA): string {
  const r = Math.round(color.r * 255);
  const g = Math.round(color.g * 255);
  const b = Math.round(color.b * 255);
  const hex = ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
  return `#${hex.toUpperCase()}`;
}

/**
 * Converts RGBA to RGB/RGBA string
 */
function rgbaToRgbString(color: RGBA): string {
  const r = Math.round(color.r * 255);
  const g = Math.round(color.g * 255);
  const b = Math.round(color.b * 255);
  if (color.a !== undefined && color.a < 1) {
    return `rgba(${r}, ${g}, ${b}, ${color.a.toFixed(2)})`;
  }
  return `rgb(${r}, ${g}, ${b})`;
}

/**
 * Converts RGBA to HSL string
 */
function rgbaToHslString(color: RGBA): string {
  const r = color.r;
  const g = color.g;
  const b = color.b;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;

  let h = 0;
  let s = 0;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      case b:
        h = ((r - g) / d + 4) / 6;
        break;
    }
  }

  return `hsl(${Math.round(h * 360)}, ${Math.round(s * 100)}%, ${Math.round(l * 100)}%)`;
}

/**
 * Converts RGBA to HSB/HSV string
 */
function rgbaToHsbString(color: RGBA): string {
  const r = color.r;
  const g = color.g;
  const b = color.b;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;

  let h = 0;
  const s = max === 0 ? 0 : d / max;
  const v = max; // brightness/value

  if (max !== min) {
    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      case b:
        h = ((r - g) / d + 4) / 6;
        break;
    }
  }

  return `hsb(${Math.round(h * 360)}, ${Math.round(s * 100)}%, ${Math.round(v * 100)}%)`;
}

/**
 * Formats color value based on user preference
 */
function formatColorValue(color: RGBA, format: 'hex' | 'rgb' | 'hsl' | 'hsb'): string {
  switch (format) {
    case 'hex':
      return rgbaToHex(color);
    case 'rgb':
      return rgbaToRgbString(color);
    case 'hsl':
      return rgbaToHslString(color);
    case 'hsb':
      return rgbaToHsbString(color);
    default:
      return rgbaToHex(color);
  }
}

/**
 * Extracts the step/scale value from a variable name
 * e.g., "brand/primary/025" -> "025"
 */
function extractStepFromName(name: string): string {
  const parts = name.split('/');
  const lastPart = parts[parts.length - 1];
  // Check if it looks like a scale value (e.g., 025, 100, 500)
  if (/^\d+$/.test(lastPart)) {
    return lastPart;
  }
  return lastPart;
}

// =============================================================================
// Generation Functions
// =============================================================================

/**
 * Creates a text cell instance with the given properties
 * Color options: white, secondary, dark
 * Padding options: default, extra right
 * Type options: default, header, alias, value alias
 */
async function createTextCellInstance(
  componentSet: ComponentSetNode,
  text: string,
  options: {
    color: 'white' | 'secondary' | 'dark';
    textAlign: 'center' | 'left';
    type: 'default' | 'header' | 'alias' | 'value alias';
    padding?: 'default' | 'extra right';
    aliasText?: string; // Only used for 'value alias' type
  }
): Promise<InstanceNode> {
  const padding = options.padding || 'default';
  const variantName = `color=${options.color}, textAlign=${options.textAlign}, type=${options.type}, padding=${padding}`;
  const component = componentSet.findOne(
    (n) => n.type === 'COMPONENT' && n.name === variantName
  ) as ComponentNode | null;

  if (!component) {
    throw new Error(`Text cell variant not found: ${variantName}`);
  }

  const instance = component.createInstance();

  // Update text content based on type
  if (options.type === 'alias') {
    // For alias type, update the AliasText inside the _Alias container
    const aliasTextNode = instance.findOne((n) => n.type === 'TEXT' && n.name === 'AliasText') as TextNode | null;
    if (aliasTextNode) {
      const fontName = aliasTextNode.fontName as FontName;
      await figma.loadFontAsync(fontName);
      aliasTextNode.characters = text;
    }
  } else if (options.type === 'value alias') {
    // For value alias type, update both the value text ('100') and the AliasText
    const valueTextNode = instance.findOne((n) => n.type === 'TEXT' && n.name === '100') as TextNode | null;
    if (valueTextNode) {
      const fontName = valueTextNode.fontName as FontName;
      await figma.loadFontAsync(fontName);
      valueTextNode.characters = text;
    }
    const aliasTextNode = instance.findOne((n) => n.type === 'TEXT' && n.name === 'AliasText') as TextNode | null;
    if (aliasTextNode && options.aliasText) {
      const fontName = aliasTextNode.fontName as FontName;
      await figma.loadFontAsync(fontName);
      aliasTextNode.characters = options.aliasText;
    }
  } else {
    // For default/header types, update the '100' text node
    const textNode = instance.findOne((n) => n.type === 'TEXT' && n.name === '100') as TextNode | null;
    if (textNode) {
      const fontName = textNode.fontName as FontName;
      await figma.loadFontAsync(fontName);
      textNode.characters = text;
    }
  }

  return instance;
}

/**
 * Creates a swatch instance bound to a variable
 * Handles different swatch types with appropriate variable binding
 */
function createSwatchInstance(
  componentSet: ComponentSetNode,
  variable: Variable,
  swatchType: 'default' | 'text' | 'icon' | 'border' | 'transparency' = 'default'
): InstanceNode {
  const variantName = `type=${swatchType}`;
  const component = componentSet.findOne(
    (n) => n.type === 'COMPONENT' && n.name === variantName
  ) as ComponentNode | null;

  if (!component) {
    throw new Error(`Swatch variant not found: ${variantName}`);
  }

  const instance = component.createInstance();

  // Create variable binding paint
  const boundPaint: SolidPaint = {
    type: 'SOLID',
    color: { r: 0.5, g: 0.5, b: 0.5 }, // Fallback
    boundVariables: {
      color: {
        type: 'VARIABLE_ALIAS',
        id: variable.id,
      },
    },
  };

  // Apply variable binding based on swatch type
  switch (swatchType) {
    case 'default':
      // Bind fill to the instance itself
      instance.fills = [boundPaint];
      break;

    case 'text': {
      // Bind fill to the text node inside
      const textNode = instance.findOne((n) => n.type === 'TEXT' && n.name === 'Preview text') as TextNode | null;
      if (textNode) {
        textNode.fills = [boundPaint];
      }
      break;
    }

    case 'icon': {
      // Bind fill to the icon rectangle inside
      const iconNode = instance.findOne((n) => n.name === 'Preview icon') as RectangleNode | null;
      if (iconNode) {
        iconNode.fills = [boundPaint];
      }
      break;
    }

    case 'border': {
      // Bind stroke to the border rectangle inside
      const borderNode = instance.findOne((n) => n.name === 'Border preview') as RectangleNode | null;
      if (borderNode) {
        borderNode.strokes = [boundPaint];
      }
      break;
    }

    case 'transparency': {
      // Bind fill to the color overlay rectangle
      const overlayNode = instance.findOne((n) => n.name === 'Color overlay') as RectangleNode | null;
      if (overlayNode) {
        overlayNode.fills = [boundPaint];
      }
      break;
    }
  }

  return instance;
}

/**
 * Recursively resolves a FLOAT variable value, following alias chains
 * until reaching a concrete number value.
 * @param value - The variable value to resolve (number or alias)
 * @param modeId - The mode ID to use for resolution
 * @param maxDepth - Maximum depth to prevent infinite loops (default: 10)
 * @returns The resolved number value, or null if unresolvable
 */
async function resolveFloatValue(
  value: VariableValue,
  modeId: string,
  maxDepth: number = 10
): Promise<number | null> {
  // Base case: direct number value
  if (typeof value === 'number') {
    return value;
  }

  // Safety: prevent infinite loops
  if (maxDepth <= 0) {
    return null;
  }

  // Handle alias - recursively resolve
  if (value && typeof value === 'object' && 'type' in value && (value as VariableAlias).type === 'VARIABLE_ALIAS') {
    const aliasId = (value as VariableAlias).id;
    const aliasedVar = await figma.variables.getVariableById(aliasId);
    if (aliasedVar) {
      // Try same mode first, then fall back to first available mode
      const modeIds = Object.keys(aliasedVar.valuesByMode);
      let aliasValue = aliasedVar.valuesByMode[modeId];
      if (aliasValue === undefined && modeIds.length > 0) {
        aliasValue = aliasedVar.valuesByMode[modeIds[0]];
      }
      return resolveFloatValue(aliasValue, modeId, maxDepth - 1);
    }
  }

  return null;
}

/**
 * Extracts a numeric value from a variable name for sorting
 * e.g., "spacing/100" -> 100, "radius/sm" -> Infinity (fallback)
 */
function extractNumericValue(name: string): number {
  // Try to extract any number from the name (handles "100", "spacing-100", etc.)
  const match = name.match(/(\d+(?:\.\d+)?)/);
  return match ? parseFloat(match[1]) : Infinity;
}

/**
 * Resolves an alias path for a FLOAT variable (returns the alias target name or empty string)
 */
async function getFloatAliasPath(
  value: VariableValue,
  modeId: string
): Promise<string> {
  if (value && typeof value === 'object' && 'type' in value && (value as VariableAlias).type === 'VARIABLE_ALIAS') {
    const aliasId = (value as VariableAlias).id;
    const aliasedVar = await figma.variables.getVariableById(aliasId);
    return aliasedVar ? aliasedVar.name : '';
  }
  return '';
}

/**
 * Generates a dimension style guide for FLOAT (number) variables
 * Columns: [Title?], Name, Value, [Alias?], Token, [Description?]
 * All columns are configurable via options
 */
export async function generateDimensionStyleGuide(
  collectionId: string,
  modeId: string,
  selectedVariableIds: string[],
  options: StyleGuideOptions
): Promise<GenerationResult> {
  try {

    // Setup phase
    const page = await ensureStyleGuidePage();
    await ensureTextStyles();
    const textCellComponentSet = await createTextCellComponentSet(page);

    // Create spacing cell component set if displayStyle is 'spacing'
    const isSpacingDisplay = options.displayStyle === 'spacing';
    let spacingCellComponentSet: ComponentSetNode | null = null;
    if (isSpacingDisplay) {
      spacingCellComponentSet = await createSpacingCellComponentSet(page);
    }

    // Create swatch component set if displayStyle is 'border-radius'
    const isBorderRadiusDisplay = options.displayStyle === 'border-radius';
    let swatchComponentSet: ComponentSetNode | null = null;
    if (isBorderRadiusDisplay) {
      swatchComponentSet = await createSwatchComponentSet(page);
    }

    // Get collection info
    const collection = await figma.variables.getVariableCollectionById(collectionId);
    if (!collection) {
      throw new Error('Collection not found');
    }

    const mode = collection.modes.find((m) => m.modeId === modeId);
    const modeName = mode ? mode.name : 'Unknown';

    // Get selected variables
    const variables: Variable[] = [];
    for (const varId of selectedVariableIds) {
      const variable = await figma.variables.getVariableById(varId);
      if (variable && variable.resolvedType === 'FLOAT') {
        variables.push(variable);
      }
    }

    if (variables.length === 0) {
      throw new Error('No valid number variables selected');
    }

    // Resolve all variable values first for sorting by actual value
    const resolvedValues = new Map<string, number>();
    for (const variable of variables) {
      const rawValue = variable.valuesByMode[modeId];
      const resolved = await resolveFloatValue(rawValue, modeId);
      resolvedValues.set(variable.id, resolved ?? Infinity);
    }

    // Sort variables numerically by their resolved values
    // This ensures variables are ordered by actual value (e.g., 2, 4, 8, 16, 24)
    variables.sort((a, b) => {
      const numA = resolvedValues.get(a.id) ?? Infinity;
      const numB = resolvedValues.get(b.id) ?? Infinity;
      if (numA !== numB) return numA - numB;
      // Fall back to alphabetical for equal numeric values
      return a.name.localeCompare(b.name);
    });

    // Determine column visibility from options
    const showTitleColumn = options.addTitleCell;
    const showAliasColumn = options.displayAliases;
    const showDescriptionColumn = options.showDescription;
    const showVisualColumn = isSpacingDisplay || isBorderRadiusDisplay;
    const showRemColumn = options.addRemValues || false;
    const displayPixels = options.displayPixels || false;

    // Determine header color based on tableHeader option (light = white, dark = dark)
    const headerColor: 'white' | 'dark' = options.tableHeader === 'light' ? 'white' : 'dark';

    // Create main frame with CSS Grid layout
    const mainFrame = figma.createFrame();
    mainFrame.name = `${collection.name} - ${modeName} Dimensions`;
    mainFrame.cornerRadius = GRID_BORDER_RADIUS;
    mainFrame.clipsContent = true;
    mainFrame.fills = []; // No fill - gaps between cells create the table lines

    // Calculate columns: Base (Name, Value, Token) + optional columns
    let numCols = 3; // Name, Value, Token
    if (showTitleColumn) numCols++;
    if (showRemColumn) numCols++;
    if (showAliasColumn) numCols++;
    if (showDescriptionColumn) numCols++;
    if (showVisualColumn) numCols++;

    const numRows = variables.length + 1; // +1 for header

    // Enable Grid layout mode
    mainFrame.layoutMode = 'GRID';
    mainFrame.gridRowCount = numRows;
    mainFrame.gridColumnCount = numCols;

    // Configure column sizes - all HUG
    for (let i = 0; i < numCols; i++) {
      mainFrame.gridColumnSizes[i].type = 'HUG';
    }

    // Configure row sizes - all HUG
    for (let i = 0; i < numRows; i++) {
      mainFrame.gridRowSizes[i].type = 'HUG';
    }

    // Set gap between cells
    mainFrame.gridColumnGap = GRID_GAP;
    mainFrame.gridRowGap = GRID_GAP;

    // Set frame sizing - HUG both dimensions
    mainFrame.layoutSizingHorizontal = 'HUG';
    mainFrame.layoutSizingVertical = 'HUG';

    // Helper function to add a child to the grid
    function addToGrid(child: SceneNode, row: number, col: number) {
      mainFrame.appendChild(child);
      if ('layoutSizingHorizontal' in child) {
        (child as FrameNode).layoutSizingHorizontal = 'FILL';
        (child as FrameNode).layoutSizingVertical = 'FILL';
      }
    }

    let currentRow = 0;

    // Create header row
    let colIndex = 0;

    // Title header (optional)
    if (showTitleColumn) {
      const titleHeader = await createTextCellInstance(textCellComponentSet, '—', {
        color: headerColor,
        textAlign: 'left',
        type: 'header',
      });
      addToGrid(titleHeader, currentRow, colIndex++);
    }

    // Name header
    const nameHeader = await createTextCellInstance(textCellComponentSet, 'Name', {
      color: headerColor,
      textAlign: 'left',
      type: 'header',
    });
    addToGrid(nameHeader, currentRow, colIndex++);

    // Value header (changes to "Pixels" when displayPixels is enabled)
    const valueHeaderText = displayPixels ? 'Pixels' : 'Value';
    const valueHeader = await createTextCellInstance(textCellComponentSet, valueHeaderText, {
      color: headerColor,
      textAlign: 'left',
      type: 'header',
    });
    addToGrid(valueHeader, currentRow, colIndex++);

    // REM header (optional)
    if (showRemColumn) {
      const remHeader = await createTextCellInstance(textCellComponentSet, 'REMs (16px base)', {
        color: headerColor,
        textAlign: 'left',
        type: 'header',
      });
      addToGrid(remHeader, currentRow, colIndex++);
    }

    // Alias header (optional)
    if (showAliasColumn) {
      const aliasHeader = await createTextCellInstance(textCellComponentSet, 'Alias', {
        color: headerColor,
        textAlign: 'left',
        type: 'header',
      });
      addToGrid(aliasHeader, currentRow, colIndex++);
    }

    // Token header
    const tokenHeader = await createTextCellInstance(textCellComponentSet, 'Token', {
      color: headerColor,
      textAlign: 'left',
      type: 'header',
    });
    addToGrid(tokenHeader, currentRow, colIndex++);

    // Description header (optional)
    if (showDescriptionColumn) {
      const descHeader = await createTextCellInstance(textCellComponentSet, 'Description', {
        color: headerColor,
        textAlign: 'left',
        type: 'header',
      });
      addToGrid(descHeader, currentRow, colIndex++);
    }

    // Visual header (optional - shown for spacing displayStyle)
    if (showVisualColumn) {
      const visualHeader = await createTextCellInstance(textCellComponentSet, 'Visual', {
        color: headerColor,
        textAlign: 'left',
        type: 'header',
      });
      addToGrid(visualHeader, currentRow, colIndex++);
    }

    currentRow++;

    // Create data rows
    for (const variable of variables) {
      colIndex = 0;

      // Extract display name from variable path
      const nameParts = variable.name.split('/');
      const displayName = nameParts[nameParts.length - 1];

      // Title cell (optional) - em dash placeholder
      if (showTitleColumn) {
        const titleCell = await createTextCellInstance(textCellComponentSet, '—', {
          color: 'white',
          textAlign: 'left',
          type: 'default',
        });
        addToGrid(titleCell, currentRow, colIndex++);
      }

      // Name cell
      const nameCell = await createTextCellInstance(textCellComponentSet, displayName, {
        color: 'white',
        textAlign: 'left',
        type: 'default',
      });
      addToGrid(nameCell, currentRow, colIndex++);

      // Value cell - format the number value (handles deep alias chains)
      const rawValue = variable.valuesByMode[modeId];
      let displayValue = '—';
      const resolvedNumber = await resolveFloatValue(rawValue, modeId);
      if (resolvedNumber !== null) {
        displayValue = Number.isInteger(resolvedNumber) ? resolvedNumber.toString() : resolvedNumber.toFixed(2);
        // Add "px" suffix when displayPixels is enabled
        if (displayPixels) {
          displayValue = displayValue + 'px';
        }
      }

      const valueCell = await createTextCellInstance(textCellComponentSet, displayValue, {
        color: 'white',
        textAlign: 'left',
        type: 'default',
      });
      addToGrid(valueCell, currentRow, colIndex++);

      // REM cell (optional) - calculated from resolved value
      if (showRemColumn) {
        let remDisplayValue = '—';
        if (resolvedNumber !== null) {
          const remValue = resolvedNumber / 16;
          // Format: up to 4 decimal places, trim trailing zeros
          remDisplayValue = parseFloat(remValue.toFixed(4)).toString() + 'rem';
        }
        const remCell = await createTextCellInstance(textCellComponentSet, remDisplayValue, {
          color: 'white',
          textAlign: 'left',
          type: 'default',
        });
        addToGrid(remCell, currentRow, colIndex++);
      }

      // Alias cell (optional)
      if (showAliasColumn) {
        const aliasPath = await getFloatAliasPath(rawValue, modeId);
        const aliasCell = await createTextCellInstance(textCellComponentSet, aliasPath, {
          color: 'white',
          textAlign: 'left',
          type: aliasPath ? 'alias' : 'default', // Use alias styling when there's an alias
        });
        addToGrid(aliasCell, currentRow, colIndex++);
      }

      // Token cell - full variable path
      const isTokenLastColumn = !showDescriptionColumn && !showVisualColumn;
      const tokenCell = await createTextCellInstance(textCellComponentSet, variable.name, {
        color: 'white',
        textAlign: 'left',
        type: 'default',
        padding: isTokenLastColumn ? 'extra right' : 'default',
      });
      addToGrid(tokenCell, currentRow, colIndex++);

      // Description cell (optional)
      if (showDescriptionColumn) {
        const description = variable.description && variable.description.trim() !== ''
          ? variable.description
          : '—';
        const isDescLastColumn = !showVisualColumn;
        const descCell = await createTextCellInstance(textCellComponentSet, description, {
          color: 'white',
          textAlign: 'left',
          type: 'default',
          padding: isDescLastColumn ? 'extra right' : 'default',
        });
        addToGrid(descCell, currentRow, colIndex++);
      }

      // Visual cell (optional - shown for spacing or border-radius displayStyle)
      if (showVisualColumn && resolvedNumber !== null) {
        if (isSpacingDisplay && spacingCellComponentSet) {
          // Spacing visual
          const spacingStyle = options.spacingStyle || 'filled';
          const visualCell = await createSpacingCellInstance(
            spacingCellComponentSet,
            resolvedNumber,
            spacingStyle
          );
          addToGrid(visualCell, currentRow, colIndex++);
        } else if (isBorderRadiusDisplay && swatchComponentSet) {
          // Border radius visual
          const visualCell = await createRadiusSwatchInstance(
            swatchComponentSet,
            resolvedNumber
          );
          addToGrid(visualCell, currentRow, colIndex++);
        } else {
          // Fallback: show em dash
          const emptyVisualCell = await createTextCellInstance(textCellComponentSet, '—', {
            color: 'white',
            textAlign: 'left',
            type: 'default',
            padding: 'extra right',
          });
          addToGrid(emptyVisualCell, currentRow, colIndex++);
        }
      } else if (showVisualColumn) {
        // Fallback: show em dash if no resolved value
        const emptyVisualCell = await createTextCellInstance(textCellComponentSet, '—', {
          color: 'white',
          textAlign: 'left',
          type: 'default',
          padding: 'extra right',
        });
        addToGrid(emptyVisualCell, currentRow, colIndex++);
      }

      currentRow++;
    }

    // Position frame near viewport center
    const viewport = figma.viewport.center;
    mainFrame.x = viewport.x - mainFrame.width / 2;
    mainFrame.y = viewport.y - mainFrame.height / 2;

    // Select the generated frame
    figma.currentPage.selection = [mainFrame];
    figma.viewport.scrollAndZoomIntoView([mainFrame]);


    return {
      success: true,
      frameId: mainFrame.id,
      frameName: mainFrame.name,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Main generation function - creates the style guide frame
 */
export async function generateStyleGuide(
  collectionId: string,
  modeId: string,
  selectedVariableIds: string[],
  options: StyleGuideOptions
): Promise<GenerationResult> {
  try {

    // Setup phase
    const page = await ensureStyleGuidePage();
    const textStyles = await ensureTextStyles();
    const swatchComponentSet = await createSwatchComponentSet(page);
    const textCellComponentSet = await createTextCellComponentSet(page);

    // Get collection info
    const collection = await figma.variables.getVariableCollectionById(collectionId);
    if (!collection) {
      throw new Error('Collection not found');
    }

    const mode = collection.modes.find((m) => m.modeId === modeId);
    const modeName = mode ? mode.name : 'Unknown';

    // Get selected variables
    const variables: Variable[] = [];
    for (const varId of selectedVariableIds) {
      const variable = await figma.variables.getVariableById(varId);
      if (variable && variable.resolvedType === 'COLOR') {
        variables.push(variable);
      }
    }

    if (variables.length === 0) {
      throw new Error('No valid color variables selected');
    }

    // Sort variables by name
    variables.sort((a, b) => a.name.localeCompare(b.name));

    // Determine column visibility options
    const showTitleColumn = options.addTitleCell;
    const showStepColumn = options.displayStyle === 'scale';
    const showAliasColumn = options.displayAliases;
    const showDescriptionColumn = options.showDescription;

    // Determine header color based on tableHeader option (light = white, dark = dark)
    const headerColor: 'white' | 'dark' = options.tableHeader === 'light' ? 'white' : 'dark';

    // Create main frame with CSS Grid layout
    const mainFrame = figma.createFrame();
    mainFrame.name = `${collection.name} - ${modeName} Style Guide`;
    mainFrame.cornerRadius = GRID_BORDER_RADIUS;
    mainFrame.clipsContent = true;
    mainFrame.fills = []; // No fill - gaps between cells create the table lines

    // Always include a header row
    const hasHeaderRow = true;
    const numRows = variables.length + 1;

    // Calculate number of columns based on options
    // Base columns: Swatch, Value, Token (3)
    // + Title column if addTitleCell is on (+1)
    // + Step column if scale style (+1)
    // + Alias column if displayAliases is on (+1)
    // + Description column if showDescription is on (+1)
    let numCols = 3;
    if (showTitleColumn) numCols++;
    if (showStepColumn) numCols++;
    if (showAliasColumn) numCols++;
    if (showDescriptionColumn) numCols++;

    // Enable Grid layout mode
    mainFrame.layoutMode = 'GRID';

    // Set grid dimensions - this creates the track size arrays
    mainFrame.gridRowCount = numRows;
    mainFrame.gridColumnCount = numCols;

    // Configure column sizes based on layout
    // Column order: [Title?], [Step?], Swatch, Value, [Alias?], Token, [Description?]
    // All columns use HUG to prevent text from being cut off
    let colIdx = 0;
    // Title column (HUG) - if enabled
    if (showTitleColumn) {
      mainFrame.gridColumnSizes[colIdx].type = 'HUG';
      colIdx++;
    }
    // Step column (HUG) - if scale style
    if (showStepColumn) {
      mainFrame.gridColumnSizes[colIdx].type = 'HUG';
      colIdx++;
    }
    // Swatch column (HUG)
    mainFrame.gridColumnSizes[colIdx].type = 'HUG';
    colIdx++;
    // Value column (HUG)
    mainFrame.gridColumnSizes[colIdx].type = 'HUG';
    colIdx++;
    // Alias column (HUG) - if enabled
    if (showAliasColumn) {
      mainFrame.gridColumnSizes[colIdx].type = 'HUG';
      colIdx++;
    }
    // Token column (HUG)
    mainFrame.gridColumnSizes[colIdx].type = 'HUG';
    colIdx++;
    // Description column (HUG) - if enabled, LAST column
    if (showDescriptionColumn) {
      mainFrame.gridColumnSizes[colIdx].type = 'HUG';
    }

    // Configure row sizes: all HUG to fit content
    for (let i = 0; i < numRows; i++) {
      mainFrame.gridRowSizes[i].type = 'HUG';
    }

    // Set gap between cells
    mainFrame.gridColumnGap = GRID_GAP;
    mainFrame.gridRowGap = GRID_GAP;

    // Set frame sizing - HUG both dimensions to fit content
    mainFrame.layoutSizingHorizontal = 'HUG';
    mainFrame.layoutSizingVertical = 'HUG';

    let currentRow = 0;

    // Helper function to add a child to the grid at a specific position
    function addToGrid(child: SceneNode, row: number, col: number, fill: boolean = true) {
      mainFrame.appendChild(child);
      // Use setGridChildPosition if available, otherwise set anchor indices directly
      if ('setGridChildPosition' in child && typeof (child as any).setGridChildPosition === 'function') {
        (child as any).setGridChildPosition(row, col);
      }
      // Set fill sizing for cells (not swatches)
      if (fill && 'layoutSizingHorizontal' in child) {
        (child as any).layoutSizingHorizontal = 'FILL';
        (child as any).layoutSizingVertical = 'FILL';
      }
    }

    // Create header row - uses headerColor with header type for proper contrast
    if (hasHeaderRow) {
      let colIndex = 0;

      // Title header (if enabled) - uses em dash as placeholder
      if (showTitleColumn) {
        const titleHeader = await createTextCellInstance(textCellComponentSet, '—', {
          color: headerColor,
          textAlign: 'left',
          type: 'header',
        });
        addToGrid(titleHeader, currentRow, colIndex++);
      }

      // Step header (only for Scale style)
      if (showStepColumn) {
        const stepHeader = await createTextCellInstance(textCellComponentSet, 'Step', {
          color: headerColor,
          textAlign: 'center',
          type: 'header',
        });
        addToGrid(stepHeader, currentRow, colIndex++);
      }

      // Empty cell for swatch column - use headerColor for consistency
      const emptyCell = await createTextCellInstance(textCellComponentSet, '', {
        color: headerColor,
        textAlign: 'center',
        type: 'header',
      });
      addToGrid(emptyCell, currentRow, colIndex++);

      // Value header
      const valueHeader = await createTextCellInstance(textCellComponentSet, 'Value', {
        color: headerColor,
        textAlign: 'left',
        type: 'header',
      });
      addToGrid(valueHeader, currentRow, colIndex++);

      // Alias header (if enabled)
      if (showAliasColumn) {
        const aliasHeader = await createTextCellInstance(textCellComponentSet, 'Alias', {
          color: headerColor,
          textAlign: 'left',
          type: 'header',
        });
        addToGrid(aliasHeader, currentRow, colIndex++);
      }

      // Token header
      const tokenHeader = await createTextCellInstance(textCellComponentSet, 'Token', {
        color: headerColor,
        textAlign: 'left',
        type: 'header',
      });
      addToGrid(tokenHeader, currentRow, colIndex++);

      // Description header (if enabled) - LAST column
      if (showDescriptionColumn) {
        const descriptionHeader = await createTextCellInstance(textCellComponentSet, 'Description', {
          color: headerColor,
          textAlign: 'left',
          type: 'header',
        });
        addToGrid(descriptionHeader, currentRow, colIndex++);
      }

      currentRow++;
    }

    // Create data rows
    for (const variable of variables) {
      let colIndex = 0;

      // Title cell (if enabled) - uses em dash as placeholder, user can manually edit after generation
      if (showTitleColumn) {
        const titleCell = await createTextCellInstance(textCellComponentSet, '—', {
          color: 'white',
          textAlign: 'left',
          type: 'default',
        });
        addToGrid(titleCell, currentRow, colIndex++);
      }

      // Step cell (only for Scale style)
      if (showStepColumn) {
        const stepValue = extractStepFromName(variable.name);
        // Check if step detection worked (is it a number?)
        const isValidStep = /^\d+$/.test(stepValue);
        const stepCell = await createTextCellInstance(textCellComponentSet, isValidStep ? stepValue : 'Step', {
          color: 'white',
          textAlign: 'center',
          type: 'default',
        });
        addToGrid(stepCell, currentRow, colIndex++);

        // Show notification if step not detected (only once)
        if (!isValidStep && currentRow === (hasHeaderRow ? 1 : 0)) {
          figma.notify('Color scale steps not detected', { timeout: 3000 });
        }
      }

      // Swatch cell - bound to variable
      // Map display style to swatch type, with transparency auto-detection
      let swatchType: 'default' | 'text' | 'icon' | 'border' | 'transparency' = 'default';

      // Check for transparency (alpha < 1) - auto-detect regardless of display style
      const colorVal = variable.valuesByMode[modeId];
      const hasTransparency = colorVal && typeof colorVal === 'object' && 'a' in colorVal &&
                              (colorVal as RGBA).a !== undefined && (colorVal as RGBA).a < 1;

      if (hasTransparency) {
        swatchType = 'transparency';
      } else {
        // Map display style to swatch type
        switch (options.displayStyle) {
          case 'text-color':
            swatchType = 'text';
            break;
          case 'icon-color':
            swatchType = 'icon';
            break;
          case 'border-color':
            swatchType = 'border';
            break;
          default:
            swatchType = 'default';
        }
      }

      const swatch = createSwatchInstance(swatchComponentSet, variable, swatchType);
      addToGrid(swatch, currentRow, colIndex++, false); // Don't fill - keep fixed size

      // Value cell - always shows the resolved color value (hex/rgb/hsl/hsb)
      const colorValue = variable.valuesByMode[modeId];
      let displayValue = '';
      let aliasPath = ''; // Will be populated if this is an alias

      if (colorValue && typeof colorValue === 'object') {
        if ('type' in colorValue && (colorValue as VariableAlias).type === 'VARIABLE_ALIAS') {
          // It's an alias - get the alias path for the Alias column
          const aliasId = (colorValue as VariableAlias).id;
          const aliasedVar = await figma.variables.getVariableById(aliasId);
          aliasPath = aliasedVar ? aliasedVar.name : 'Unknown alias';

          // Resolve to get the final color value - walk the alias chain
          let currentVar: Variable | null = aliasedVar;
          let resolvedColor: RGBA | null = null;
          let maxDepth = 10; // Prevent infinite loops

          while (currentVar && maxDepth > 0) {
            maxDepth--;
            // Get the value from this variable - try same mode first, then first available
            const modeIds = Object.keys(currentVar.valuesByMode);
            let varValue = currentVar.valuesByMode[modeId];
            if (varValue === undefined && modeIds.length > 0) {
              varValue = currentVar.valuesByMode[modeIds[0]];
            }

            if (!varValue || typeof varValue !== 'object') break;

            if ('r' in varValue) {
              // Found a direct color value
              resolvedColor = varValue as RGBA;
              break;
            } else if ('type' in varValue && (varValue as VariableAlias).type === 'VARIABLE_ALIAS') {
              // It's another alias - keep walking
              const nextAliasId = (varValue as VariableAlias).id;
              currentVar = await figma.variables.getVariableById(nextAliasId);
            } else {
              break;
            }
          }

          if (resolvedColor) {
            displayValue = formatColorValue(resolvedColor, options.colorValue);
          }
        } else if ('r' in colorValue) {
          // It's a direct color value
          displayValue = formatColorValue(colorValue as RGBA, options.colorValue);
        }
      }

      // Value column always uses default type (not alias type)
      const valueCell = await createTextCellInstance(textCellComponentSet, displayValue, {
        color: 'white',
        textAlign: 'left',
        type: 'default',
      });
      addToGrid(valueCell, currentRow, colIndex++);

      // Alias column (if enabled) - shows the alias path with special styling
      if (showAliasColumn) {
        const aliasCell = await createTextCellInstance(textCellComponentSet, aliasPath, {
          color: 'white',
          textAlign: 'left',
          type: aliasPath ? 'alias' : 'default', // Use alias type for styling when there's an alias
        });
        addToGrid(aliasCell, currentRow, colIndex++);
      }

      // Token name cell - uses extra right padding for visual balance at end of row
      const tokenCell = await createTextCellInstance(textCellComponentSet, variable.name, {
        color: 'white',
        textAlign: 'left',
        type: 'default',
        padding: 'extra right',
      });
      addToGrid(tokenCell, currentRow, colIndex++);

      // Description column (if enabled) - LAST column, shows the variable description from metadata
      if (showDescriptionColumn) {
        // Use description if available, otherwise show placeholder
        const description = variable.description && variable.description.trim() !== ''
          ? variable.description
          : '—'; // Em dash as placeholder for empty description

        const descriptionCell = await createTextCellInstance(textCellComponentSet, description, {
          color: 'white',
          textAlign: 'left',
          type: 'default',
        });
        addToGrid(descriptionCell, currentRow, colIndex++);
      }

      currentRow++;
    }

    // Position frame near viewport center
    const viewport = figma.viewport.center;
    mainFrame.x = viewport.x - mainFrame.width / 2;
    mainFrame.y = viewport.y - mainFrame.height / 2;

    // Select the generated frame
    figma.currentPage.selection = [mainFrame];
    figma.viewport.scrollAndZoomIntoView([mainFrame]);


    return {
      success: true,
      frameId: mainFrame.id,
      frameName: mainFrame.name,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// =============================================================================
// Text Style Guide Generation
// =============================================================================

/**
 * Generates a text style guide from selected Figma text styles
 * Columns: Name, Family, Size, [REMs], Weight, Line Height, Letter Spacing,
 *          [Paragraph Spacing], [Text Decoration], Example
 */
export async function generateTextStyleGuide(
  selectedStyleIds: string[],
  options: TextStyleGuideOptions
): Promise<GenerationResult> {
  try {

    // Setup phase
    const page = await ensureStyleGuidePage();
    await ensureTextStyles();
    const textCellComponentSet = await createTextCellComponentSet(page);

    // Get selected text styles
    const allTextStyles = await figma.getLocalTextStylesAsync();
    const selectedStyles = allTextStyles.filter(s => selectedStyleIds.includes(s.id));

    if (selectedStyles.length === 0) {
      throw new Error('No valid text styles selected');
    }

    // Preserve Figma's order (how user organized styles in the UI)
    // No sorting - selectedStyles already in correct order

    // Determine column visibility
    const showRemColumn = options.addRemValues;
    const showParagraphSpacing = options.showParagraphSpacing;
    const showTextDecoration = options.showTextDecoration;
    const showDescription = options.showDescription;
    const displayAliases = options.displayAliases;

    // Determine header color
    const headerColor: 'white' | 'dark' = options.tableHeader === 'light' ? 'white' : 'dark';

    // Calculate columns
    // Base: Name, Family, Size, Weight, Line Height, Letter Spacing, Example (7)
    let numCols = 7;
    if (showRemColumn) numCols++;
    if (showParagraphSpacing) numCols++;
    if (showTextDecoration) numCols++;
    if (showDescription) numCols++;

    const numRows = selectedStyles.length + 1; // +1 for header

    // Create main frame
    const mainFrame = figma.createFrame();
    mainFrame.name = 'Text Styles Guide';
    mainFrame.cornerRadius = GRID_BORDER_RADIUS;
    mainFrame.clipsContent = true;
    mainFrame.fills = []; // No fill - gaps between cells create the table lines

    // Enable Grid layout mode
    mainFrame.layoutMode = 'GRID';
    mainFrame.gridRowCount = numRows;
    mainFrame.gridColumnCount = numCols;

    // Configure column sizes - all HUG
    for (let i = 0; i < numCols; i++) {
      mainFrame.gridColumnSizes[i].type = 'HUG';
    }

    // Configure row sizes - all HUG
    for (let i = 0; i < numRows; i++) {
      mainFrame.gridRowSizes[i].type = 'HUG';
    }

    // Set gap between cells
    mainFrame.gridColumnGap = GRID_GAP;
    mainFrame.gridRowGap = GRID_GAP;

    // Set frame sizing - HUG both dimensions
    mainFrame.layoutSizingHorizontal = 'HUG';
    mainFrame.layoutSizingVertical = 'HUG';

    // Helper function to add a child to the grid
    function addToGrid(child: SceneNode, row: number, col: number) {
      mainFrame.appendChild(child);
      if ('layoutSizingHorizontal' in child) {
        (child as FrameNode).layoutSizingHorizontal = 'FILL';
        (child as FrameNode).layoutSizingVertical = 'FILL';
      }
    }

    let currentRow = 0;

    // Create header row
    let colIndex = 0;

    // Name header
    const nameHeader = await createTextCellInstance(textCellComponentSet, 'Name', {
      color: headerColor,
      textAlign: 'left',
      type: 'header',
    });
    addToGrid(nameHeader, currentRow, colIndex++);

    // Family header
    const familyHeader = await createTextCellInstance(textCellComponentSet, 'Family', {
      color: headerColor,
      textAlign: 'left',
      type: 'header',
    });
    addToGrid(familyHeader, currentRow, colIndex++);

    // Size header
    const sizeHeader = await createTextCellInstance(textCellComponentSet, 'Size', {
      color: headerColor,
      textAlign: 'left',
      type: 'header',
    });
    addToGrid(sizeHeader, currentRow, colIndex++);

    // REMs header (optional)
    if (showRemColumn) {
      const remHeader = await createTextCellInstance(textCellComponentSet, 'REMs', {
        color: headerColor,
        textAlign: 'left',
        type: 'header',
      });
      addToGrid(remHeader, currentRow, colIndex++);
    }

    // Weight header
    const weightHeader = await createTextCellInstance(textCellComponentSet, 'Weight', {
      color: headerColor,
      textAlign: 'left',
      type: 'header',
    });
    addToGrid(weightHeader, currentRow, colIndex++);

    // Line Height header
    const lineHeightHeader = await createTextCellInstance(textCellComponentSet, 'Line Height', {
      color: headerColor,
      textAlign: 'left',
      type: 'header',
    });
    addToGrid(lineHeightHeader, currentRow, colIndex++);

    // Letter Spacing header
    const letterSpacingHeader = await createTextCellInstance(textCellComponentSet, 'Letter Spacing', {
      color: headerColor,
      textAlign: 'left',
      type: 'header',
    });
    addToGrid(letterSpacingHeader, currentRow, colIndex++);

    // Paragraph Spacing header (optional)
    if (showParagraphSpacing) {
      const paragraphHeader = await createTextCellInstance(textCellComponentSet, 'Paragraph Spacing', {
        color: headerColor,
        textAlign: 'left',
        type: 'header',
      });
      addToGrid(paragraphHeader, currentRow, colIndex++);
    }

    // Text Decoration header (optional)
    if (showTextDecoration) {
      const decorationHeader = await createTextCellInstance(textCellComponentSet, 'Decoration', {
        color: headerColor,
        textAlign: 'left',
        type: 'header',
      });
      addToGrid(decorationHeader, currentRow, colIndex++);
    }

    // Description header (optional)
    if (showDescription) {
      const descHeader = await createTextCellInstance(textCellComponentSet, 'Description', {
        color: headerColor,
        textAlign: 'left',
        type: 'header',
      });
      addToGrid(descHeader, currentRow, colIndex++);
    }

    // Example header
    const exampleHeader = await createTextCellInstance(textCellComponentSet, 'Example', {
      color: headerColor,
      textAlign: 'left',
      type: 'header',
    });
    addToGrid(exampleHeader, currentRow, colIndex++);

    currentRow++;

    // Create data rows
    for (const style of selectedStyles) {
      colIndex = 0;

      // Get bound variables for this style
      const boundVars = await getTextStyleBoundVariables(style);

      // Name cell - use full path with hyphens instead of slashes
      const displayName = style.name.replace(/\//g, '-');
      const nameCell = await createTextCellInstance(textCellComponentSet, displayName, {
        color: 'white',
        textAlign: 'left',
        type: 'default',
      });
      addToGrid(nameCell, currentRow, colIndex++);

      // Family cell (with alias if bound)
      const fontName = style.fontName === figma.mixed ? { family: 'Mixed', style: 'Mixed' } : style.fontName;
      const familyCell = await createTextStyleDataCell(
        textCellComponentSet,
        fontName.family,
        boundVars.fontFamily,
        displayAliases
      );
      addToGrid(familyCell, currentRow, colIndex++);

      // Size cell (with alias if bound)
      const fontSize = style.fontSize === figma.mixed ? 0 : style.fontSize;
      const sizeDisplay = fontSize.toString() + 'px';
      const sizeCell = await createTextStyleDataCell(
        textCellComponentSet,
        sizeDisplay,
        boundVars.fontSize,
        displayAliases
      );
      addToGrid(sizeCell, currentRow, colIndex++);

      // REMs cell (optional)
      if (showRemColumn) {
        const remValue = fontSize / 16;
        const remDisplay = parseFloat(remValue.toFixed(4)).toString() + 'rem';
        const remCell = await createTextCellInstance(textCellComponentSet, remDisplay, {
          color: 'white',
          textAlign: 'left',
          type: 'default',
        });
        addToGrid(remCell, currentRow, colIndex++);
      }

      // Weight cell (with alias if bound - uses fontStyle)
      const weightCell = await createTextStyleDataCell(
        textCellComponentSet,
        fontName.style,
        boundVars.fontStyle,
        displayAliases
      );
      addToGrid(weightCell, currentRow, colIndex++);

      // Line Height cell (with alias if bound)
      const lineHeightDisplay = formatLineHeight(style.lineHeight);
      const lineHeightCell = await createTextStyleDataCell(
        textCellComponentSet,
        lineHeightDisplay,
        boundVars.lineHeight,
        displayAliases
      );
      addToGrid(lineHeightCell, currentRow, colIndex++);

      // Letter Spacing cell (with alias if bound)
      const letterSpacingDisplay = formatLetterSpacing(style.letterSpacing);
      const letterSpacingCell = await createTextStyleDataCell(
        textCellComponentSet,
        letterSpacingDisplay,
        boundVars.letterSpacing,
        displayAliases
      );
      addToGrid(letterSpacingCell, currentRow, colIndex++);

      // Paragraph Spacing cell (optional - no variable binding)
      if (showParagraphSpacing) {
        const paragraphSpacing = style.paragraphSpacing === figma.mixed ? 0 : style.paragraphSpacing;
        const paragraphCell = await createTextCellInstance(textCellComponentSet, paragraphSpacing.toString() + 'px', {
          color: 'white',
          textAlign: 'left',
          type: 'default',
        });
        addToGrid(paragraphCell, currentRow, colIndex++);
      }

      // Text Decoration cell (optional - no variable binding)
      if (showTextDecoration) {
        const textDecoration = style.textDecoration === figma.mixed ? 'NONE' : style.textDecoration;
        const decorationDisplay = textDecoration === 'NONE' ? 'None' :
                                  textDecoration === 'UNDERLINE' ? 'Underline' : 'Strikethrough';
        const decorationCell = await createTextCellInstance(textCellComponentSet, decorationDisplay, {
          color: 'white',
          textAlign: 'left',
          type: 'default',
        });
        addToGrid(decorationCell, currentRow, colIndex++);
      }

      // Description cell (optional)
      if (showDescription) {
        const description = style.description && style.description.trim() !== '' ? style.description : '—';
        const descCell = await createTextCellInstance(textCellComponentSet, description, {
          color: 'white',
          textAlign: 'left',
          type: 'default',
        });
        addToGrid(descCell, currentRow, colIndex++);
      }

      // Example cell - "Abc 123" rendered in the text style
      const exampleCell = await createTextStyleExampleCell(style);
      addToGrid(exampleCell, currentRow, colIndex++);

      currentRow++;
    }

    // Position frame near viewport center
    const viewport = figma.viewport.center;
    mainFrame.x = viewport.x - mainFrame.width / 2;
    mainFrame.y = viewport.y - mainFrame.height / 2;

    // Select the generated frame
    figma.currentPage.selection = [mainFrame];
    figma.viewport.scrollAndZoomIntoView([mainFrame]);


    return {
      success: true,
      frameId: mainFrame.id,
      frameName: mainFrame.name,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Helper to get bound variables for a text style
 */
async function getTextStyleBoundVariables(style: TextStyle): Promise<{
  fontSize?: BoundVariableInfo;
  fontFamily?: BoundVariableInfo;
  fontStyle?: BoundVariableInfo;
  lineHeight?: BoundVariableInfo;
  letterSpacing?: BoundVariableInfo;
}> {
  const result: {
    fontSize?: BoundVariableInfo;
    fontFamily?: BoundVariableInfo;
    fontStyle?: BoundVariableInfo;
    lineHeight?: BoundVariableInfo;
    letterSpacing?: BoundVariableInfo;
  } = {};

  if (style.boundVariables?.fontSize) {
    const varId = (style.boundVariables.fontSize as VariableAlias).id;
    const variable = await figma.variables.getVariableByIdAsync(varId);
    if (variable) {
      result.fontSize = { id: variable.id, name: variable.name };
    }
  }

  if (style.boundVariables?.fontFamily) {
    const varId = (style.boundVariables.fontFamily as VariableAlias).id;
    const variable = await figma.variables.getVariableByIdAsync(varId);
    if (variable) {
      result.fontFamily = { id: variable.id, name: variable.name };
    }
  }

  if (style.boundVariables?.fontStyle) {
    const varId = (style.boundVariables.fontStyle as VariableAlias).id;
    const variable = await figma.variables.getVariableByIdAsync(varId);
    if (variable) {
      result.fontStyle = { id: variable.id, name: variable.name };
    }
  }

  if (style.boundVariables?.lineHeight) {
    const varId = (style.boundVariables.lineHeight as VariableAlias).id;
    const variable = await figma.variables.getVariableByIdAsync(varId);
    if (variable) {
      result.lineHeight = { id: variable.id, name: variable.name };
    }
  }

  if (style.boundVariables?.letterSpacing) {
    const varId = (style.boundVariables.letterSpacing as VariableAlias).id;
    const variable = await figma.variables.getVariableByIdAsync(varId);
    if (variable) {
      result.letterSpacing = { id: variable.id, name: variable.name };
    }
  }

  return result;
}

/**
 * Helper to create a data cell with optional alias display
 * Uses value alias variant when a variable is bound AND displayAliases is true
 * This shows both the value and the alias side by side
 */
async function createTextStyleDataCell(
  componentSet: ComponentSetNode,
  value: string,
  boundVariable: BoundVariableInfo | undefined,
  displayAliases: boolean
): Promise<InstanceNode> {
  // If no bound variable or not displaying aliases, use default type
  if (!boundVariable || !displayAliases) {
    return createTextCellInstance(componentSet, value, {
      color: 'white',
      textAlign: 'left',
      type: 'default',
    });
  }

  // Use value alias type when variable is bound and displayAliases is on
  // This shows both the value AND the alias name side by side
  return createTextCellInstance(componentSet, value, {
    color: 'white',
    textAlign: 'left',
    type: 'value alias',
    aliasText: boundVariable.name,
  });
}

/**
 * Helper to format line height value
 */
function formatLineHeight(lineHeight: LineHeight | typeof figma.mixed): string {
  if (lineHeight === figma.mixed) {
    return 'Mixed';
  }
  if (typeof lineHeight === 'object' && 'unit' in lineHeight) {
    if (lineHeight.unit === 'AUTO') {
      return 'Auto';
    }
    if (lineHeight.unit === 'PERCENT') {
      return lineHeight.value.toFixed(0) + '%';
    }
    if (lineHeight.unit === 'PIXELS') {
      return lineHeight.value.toFixed(0) + 'px';
    }
  }
  return 'Auto';
}

/**
 * Helper to format letter spacing value
 */
function formatLetterSpacing(letterSpacing: LetterSpacing | typeof figma.mixed): string {
  if (letterSpacing === figma.mixed) {
    return 'Mixed';
  }
  if (typeof letterSpacing === 'object') {
    if (letterSpacing.unit === 'PERCENT') {
      return letterSpacing.value.toFixed(0) + '%';
    }
    if (letterSpacing.unit === 'PIXELS') {
      return letterSpacing.value.toFixed(2) + 'px';
    }
  }
  return '0';
}

/**
 * Recursively resolves a STRING variable value, following alias chains
 */
async function resolveStringValue(
  value: VariableValue,
  modeId: string,
  maxDepth: number = 10
): Promise<string | null> {
  if (typeof value === 'string') {
    return value;
  }
  if (maxDepth <= 0) {
    return null;
  }
  if (value && typeof value === 'object' && 'type' in value && (value as VariableAlias).type === 'VARIABLE_ALIAS') {
    const aliasId = (value as VariableAlias).id;
    const aliasedVar = await figma.variables.getVariableById(aliasId);
    if (aliasedVar) {
      const modeIds = Object.keys(aliasedVar.valuesByMode);
      let aliasValue = aliasedVar.valuesByMode[modeId];
      if (aliasValue === undefined && modeIds.length > 0) {
        aliasValue = aliasedVar.valuesByMode[modeIds[0]];
      }
      return resolveStringValue(aliasValue, modeId, maxDepth - 1);
    }
  }
  return null;
}

/**
 * Creates a font example cell with "Abc 123" rendered with the specified font property
 */
async function createFontExampleCell(
  displayType: FontDisplayType,
  resolvedValue: string | number,
  variableType: string
): Promise<FrameNode> {
  const frame = figma.createFrame();
  frame.name = 'Example';
  frame.resize(200, CELL_MIN_HEIGHT);
  frame.fills = [{ type: 'SOLID', color: COLORS.white }];
  frame.layoutMode = 'VERTICAL';
  frame.primaryAxisAlignItems = 'CENTER';
  frame.counterAxisAlignItems = 'MIN';
  frame.paddingLeft = 24;
  frame.paddingRight = 40;
  frame.paddingTop = 24;
  frame.paddingBottom = 24;

  // Load default font
  await figma.loadFontAsync({ family: 'Inter', style: 'Regular' });

  const textNode = figma.createText();
  textNode.name = 'Example text';
  textNode.fontName = { family: 'Inter', style: 'Regular' };
  textNode.fills = [{ type: 'SOLID', color: COLORS.textPrimary }];

  if (displayType === 'font-family') {
    // Show "Abc 123" in the font family
    const familyName = String(resolvedValue);
    // Use the font family name as the example text
    textNode.characters = familyName;
    textNode.fontSize = 16;
    // Try to load and apply the font family
    try {
      await figma.loadFontAsync({ family: familyName, style: 'Regular' });
      textNode.fontName = { family: familyName, style: 'Regular' };
    } catch (e) {
      // Keep Inter as fallback
    }
  } else if (displayType === 'font-size') {
    // Show "Abc 123" at the font size
    const fontSize = typeof resolvedValue === 'number' ? resolvedValue : parseFloat(String(resolvedValue));
    textNode.characters = 'Abc 123';
    if (!isNaN(fontSize) && fontSize > 0) {
      // Clamp font size to reasonable range for display
      textNode.fontSize = Math.min(Math.max(fontSize, 8), 120);
    } else {
      textNode.fontSize = 16;
    }
  } else if (displayType === 'font-weight') {
    // Show "Abc 123" in the font weight
    textNode.characters = 'Abc 123';
    textNode.fontSize = 16;

    if (variableType === 'STRING') {
      // String font weight like "Bold", "Regular"
      const weightStyle = String(resolvedValue);
      try {
        await figma.loadFontAsync({ family: 'Inter', style: weightStyle });
        textNode.fontName = { family: 'Inter', style: weightStyle };
      } catch (e) {
      }
    } else {
      // Numeric font weight like 400, 700
      const numWeight = typeof resolvedValue === 'number' ? resolvedValue : parseFloat(String(resolvedValue));
      // Map numeric weight to Inter style name
      const weightMap: Record<number, string> = {
        100: 'Thin',
        200: 'Extra Light',
        300: 'Light',
        400: 'Regular',
        500: 'Medium',
        600: 'Semi Bold',
        700: 'Bold',
        800: 'Extra Bold',
        900: 'Black',
      };
      const styleName = weightMap[numWeight] || 'Regular';
      try {
        await figma.loadFontAsync({ family: 'Inter', style: styleName });
        textNode.fontName = { family: 'Inter', style: styleName };
      } catch (e) {
      }
    }
  }

  frame.appendChild(textNode);
  textNode.layoutSizingHorizontal = 'HUG';
  textNode.layoutSizingVertical = 'HUG';

  return frame;
}

/**
 * Generates a font variable style guide
 * Supports mixed STRING and FLOAT variables filtered by font-related scopes
 * Columns: Name, Value, [REMs], [Alias], Token, [Description], [Example]
 */
export async function generateFontVariableGuide(
  collectionId: string,
  modeId: string,
  selectedVariableIds: string[],
  options: FontVariableGuideOptions
): Promise<GenerationResult> {
  try {

    // Setup phase
    const page = await ensureStyleGuidePage();
    await ensureTextStyles();
    const textCellComponentSet = await createTextCellComponentSet(page);

    // Get collection info
    const collection = await figma.variables.getVariableCollectionById(collectionId);
    if (!collection) {
      throw new Error('Collection not found');
    }

    const mode = collection.modes.find((m) => m.modeId === modeId);
    const modeName = mode ? mode.name : 'Unknown';

    // Get selected variables (both STRING and FLOAT)
    const variables: Variable[] = [];
    for (const varId of selectedVariableIds) {
      const variable = await figma.variables.getVariableById(varId);
      if (variable && (variable.resolvedType === 'FLOAT' || variable.resolvedType === 'STRING')) {
        variables.push(variable);
      }
    }

    if (variables.length === 0) {
      throw new Error('No valid font variables selected');
    }

    // Sort alphabetically by name
    variables.sort((a, b) => a.name.localeCompare(b.name));

    // Determine column visibility
    const showAliasColumn = options.displayAliases;
    const showDescriptionColumn = options.showDescription;
    const showExampleColumn = options.displayType === 'font-family'
      || options.displayType === 'font-size'
      || options.displayType === 'font-weight';
    // REM values only apply to FLOAT variables, but we show the column if enabled
    // For STRING variables, the REM cell will show '—'
    const showRemColumn = options.addRemValues;

    const headerColor: 'white' | 'dark' = options.tableHeader === 'light' ? 'white' : 'dark';

    // Create main frame
    const mainFrame = figma.createFrame();
    mainFrame.name = `${collection.name} - ${modeName} Font Variables`;
    mainFrame.cornerRadius = GRID_BORDER_RADIUS;
    mainFrame.clipsContent = true;
    mainFrame.fills = [];

    // Calculate columns: Name, Value, Token + optional
    let numCols = 3; // Name, Value, Token
    if (showRemColumn) numCols++;
    if (showAliasColumn) numCols++;
    if (showDescriptionColumn) numCols++;
    if (showExampleColumn) numCols++;

    const numRows = variables.length + 1; // +1 for header

    // Enable Grid layout
    mainFrame.layoutMode = 'GRID';
    mainFrame.gridRowCount = numRows;
    mainFrame.gridColumnCount = numCols;

    for (let i = 0; i < numCols; i++) {
      mainFrame.gridColumnSizes[i].type = 'HUG';
    }
    for (let i = 0; i < numRows; i++) {
      mainFrame.gridRowSizes[i].type = 'HUG';
    }

    mainFrame.gridColumnGap = GRID_GAP;
    mainFrame.gridRowGap = GRID_GAP;
    mainFrame.layoutSizingHorizontal = 'HUG';
    mainFrame.layoutSizingVertical = 'HUG';

    function addToGrid(child: SceneNode, row: number, col: number) {
      mainFrame.appendChild(child);
      if ('layoutSizingHorizontal' in child) {
        (child as FrameNode).layoutSizingHorizontal = 'FILL';
        (child as FrameNode).layoutSizingVertical = 'FILL';
      }
    }

    let currentRow = 0;
    let colIndex = 0;

    // === Header row ===

    // Name header
    const nameHeader = await createTextCellInstance(textCellComponentSet, 'Name', {
      color: headerColor,
      textAlign: 'left',
      type: 'header',
    });
    addToGrid(nameHeader, currentRow, colIndex++);

    // Value header
    const valueHeader = await createTextCellInstance(textCellComponentSet, 'Value', {
      color: headerColor,
      textAlign: 'left',
      type: 'header',
    });
    addToGrid(valueHeader, currentRow, colIndex++);

    // REM header (optional)
    if (showRemColumn) {
      const remHeader = await createTextCellInstance(textCellComponentSet, 'REMs (16px base)', {
        color: headerColor,
        textAlign: 'left',
        type: 'header',
      });
      addToGrid(remHeader, currentRow, colIndex++);
    }

    // Alias header (optional)
    if (showAliasColumn) {
      const aliasHeader = await createTextCellInstance(textCellComponentSet, 'Alias', {
        color: headerColor,
        textAlign: 'left',
        type: 'header',
      });
      addToGrid(aliasHeader, currentRow, colIndex++);
    }

    // Token header
    const tokenHeader = await createTextCellInstance(textCellComponentSet, 'Token', {
      color: headerColor,
      textAlign: 'left',
      type: 'header',
    });
    addToGrid(tokenHeader, currentRow, colIndex++);

    // Description header (optional)
    if (showDescriptionColumn) {
      const descHeader = await createTextCellInstance(textCellComponentSet, 'Description', {
        color: headerColor,
        textAlign: 'left',
        type: 'header',
      });
      addToGrid(descHeader, currentRow, colIndex++);
    }

    // Example header (optional)
    if (showExampleColumn) {
      const exampleHeader = await createTextCellInstance(textCellComponentSet, 'Example', {
        color: headerColor,
        textAlign: 'left',
        type: 'header',
      });
      addToGrid(exampleHeader, currentRow, colIndex++);
    }

    currentRow++;

    // === Data rows ===
    for (const variable of variables) {
      colIndex = 0;
      const isFloat = variable.resolvedType === 'FLOAT';
      const rawValue = variable.valuesByMode[modeId];

      // Resolve value
      let displayValue = '—';
      let resolvedValue: string | number | null = null;

      if (isFloat) {
        const num = await resolveFloatValue(rawValue, modeId);
        if (num !== null) {
          resolvedValue = num;
          displayValue = Number.isInteger(num) ? num.toString() : num.toFixed(2);
        }
      } else {
        const str = await resolveStringValue(rawValue, modeId);
        if (str !== null) {
          resolvedValue = str;
          displayValue = str;
        }
      }

      // Name cell
      const nameParts = variable.name.split('/');
      const displayName = nameParts[nameParts.length - 1];
      const nameCell = await createTextCellInstance(textCellComponentSet, displayName, {
        color: 'white',
        textAlign: 'left',
        type: 'default',
      });
      addToGrid(nameCell, currentRow, colIndex++);

      // Value cell
      const valueCell = await createTextCellInstance(textCellComponentSet, displayValue, {
        color: 'white',
        textAlign: 'left',
        type: 'default',
      });
      addToGrid(valueCell, currentRow, colIndex++);

      // REM cell (optional) - only meaningful for FLOAT variables
      if (showRemColumn) {
        let remDisplayValue = '—';
        if (isFloat && resolvedValue !== null && typeof resolvedValue === 'number') {
          const remValue = resolvedValue / 16;
          remDisplayValue = parseFloat(remValue.toFixed(4)).toString() + 'rem';
        }
        const remCell = await createTextCellInstance(textCellComponentSet, remDisplayValue, {
          color: 'white',
          textAlign: 'left',
          type: 'default',
        });
        addToGrid(remCell, currentRow, colIndex++);
      }

      // Alias cell (optional)
      if (showAliasColumn) {
        const aliasPath = await getFloatAliasPath(rawValue, modeId);
        const aliasCell = await createTextCellInstance(textCellComponentSet, aliasPath || '—', {
          color: 'white',
          textAlign: 'left',
          type: aliasPath ? 'alias' : 'default',
        });
        addToGrid(aliasCell, currentRow, colIndex++);
      }

      // Token cell
      const isTokenLastColumn = !showDescriptionColumn && !showExampleColumn;
      const tokenCell = await createTextCellInstance(textCellComponentSet, variable.name, {
        color: 'white',
        textAlign: 'left',
        type: 'default',
        padding: isTokenLastColumn ? 'extra right' : 'default',
      });
      addToGrid(tokenCell, currentRow, colIndex++);

      // Description cell (optional)
      if (showDescriptionColumn) {
        const description = variable.description && variable.description.trim() !== ''
          ? variable.description
          : '—';
        const isDescLastColumn = !showExampleColumn;
        const descCell = await createTextCellInstance(textCellComponentSet, description, {
          color: 'white',
          textAlign: 'left',
          type: 'default',
          padding: isDescLastColumn ? 'extra right' : 'default',
        });
        addToGrid(descCell, currentRow, colIndex++);
      }

      // Example cell (optional)
      if (showExampleColumn && resolvedValue !== null) {
        const exampleCell = await createFontExampleCell(
          options.displayType,
          resolvedValue,
          variable.resolvedType
        );
        addToGrid(exampleCell, currentRow, colIndex++);
      } else if (showExampleColumn) {
        const emptyCell = await createTextCellInstance(textCellComponentSet, '—', {
          color: 'white',
          textAlign: 'left',
          type: 'default',
          padding: 'extra right',
        });
        addToGrid(emptyCell, currentRow, colIndex++);
      }

      currentRow++;
    }

    // Position frame near viewport center
    const viewport = figma.viewport.center;
    mainFrame.x = viewport.x - mainFrame.width / 2;
    mainFrame.y = viewport.y - mainFrame.height / 2;

    figma.currentPage.selection = [mainFrame];
    figma.viewport.scrollAndZoomIntoView([mainFrame]);


    return {
      success: true,
      frameId: mainFrame.id,
      frameName: mainFrame.name,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Creates an example cell with "Abc 123" rendered in the text style
 */
async function createTextStyleExampleCell(style: TextStyle): Promise<FrameNode> {
  // Create a frame to contain the example text
  const frame = figma.createFrame();
  frame.name = 'Example';
  frame.resize(200, CELL_MIN_HEIGHT);
  frame.fills = [{ type: 'SOLID', color: COLORS.white }];
  frame.layoutMode = 'VERTICAL';
  frame.primaryAxisAlignItems = 'CENTER';
  frame.counterAxisAlignItems = 'MIN';
  frame.paddingLeft = 24;
  frame.paddingRight = 40;
  frame.paddingTop = 24;
  frame.paddingBottom = 24;

  // Get font info from the style
  const fontName = style.fontName === figma.mixed
    ? { family: 'Inter', style: 'Regular' }
    : style.fontName;

  // Load the default font first (needed to set initial characters)
  await figma.loadFontAsync({ family: 'Inter', style: 'Regular' });

  // Also load the style's font
  try {
    await figma.loadFontAsync(fontName);
  } catch (e) {
    // Font might not be available, that's okay - we have Inter as fallback
  }

  // Create the text node
  const textNode = figma.createText();
  textNode.name = 'Example text';

  // Set fontName explicitly first (uses the loaded Inter Regular)
  textNode.fontName = { family: 'Inter', style: 'Regular' };
  textNode.characters = 'Abc 123';

  // Apply the text style (this will change the font to the style's font)
  textNode.textStyleId = style.id;

  // Ensure text is visible (dark color)
  textNode.fills = [{ type: 'SOLID', color: COLORS.textPrimary }];

  frame.appendChild(textNode);
  textNode.layoutSizingHorizontal = 'HUG';
  textNode.layoutSizingVertical = 'HUG';

  return frame;
}
