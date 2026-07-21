/**
 * Plugin UI Main Entry Point
 *
 * Handles all UI interactions, message passing with the plugin backend,
 * and dynamic content generation.
 */

// =============================================================================
// Types
// =============================================================================

interface CollectionInfo {
  id: string;
  name: string;
  modes: { modeId: string; name: string }[];
}

interface ProcessedVariable {
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
  indentLevel?: number;
  isGroup?: boolean;
  selected?: boolean;
}

// Text style types (matches messages.ts)
interface TextStyleLineHeight {
  value: number;
  unit: 'PIXELS' | 'PERCENT' | 'AUTO';
}

interface TextStyleLetterSpacing {
  value: number;
  unit: 'PIXELS' | 'PERCENT';
}

interface BoundVariableInfo {
  id: string;
  name: string;
}

interface TextStyleInfo {
  id: string;
  name: string;
  fontFamily: string;
  fontStyle: string;
  fontSize: number;
  lineHeight: TextStyleLineHeight;
  letterSpacing: TextStyleLetterSpacing;
  textDecoration: 'NONE' | 'UNDERLINE' | 'STRIKETHROUGH';
  paragraphSpacing: number;
  description: string;
  boundVariables?: {
    fontSize?: BoundVariableInfo;
    fontFamily?: BoundVariableInfo;
    fontStyle?: BoundVariableInfo;
    lineHeight?: BoundVariableInfo;
    letterSpacing?: BoundVariableInfo;
  };
  // UI state
  selected?: boolean;
}

// =============================================================================
// State
// =============================================================================

type VariableType = 'COLOR' | 'FLOAT' | 'STRING' | 'BOOLEAN';
type TabId = 'color' | 'type-variables' | 'text-styles' | 'dimension';

// Map tabs to their variable types
const TAB_VARIABLE_TYPES: Record<TabId, VariableType> = {
  'color': 'COLOR',
  'type-variables': 'STRING',
  'text-styles': 'STRING',
  'dimension': 'FLOAT',
};

let loadedTokens: unknown = null;
let currentCollections: CollectionInfo[] = [];
let activeTab: TabId = 'color';

// Per-tab state
interface TabState {
  collectionId: string | null;
  modeId: string | null;
  variables: ProcessedVariable[];
}

const tabStates: Record<TabId, TabState> = {
  'color': { collectionId: null, modeId: null, variables: [] },
  'type-variables': { collectionId: null, modeId: null, variables: [] },
  'text-styles': { collectionId: null, modeId: null, variables: [] },
  'dimension': { collectionId: null, modeId: null, variables: [] },
};

// Legacy compatibility
let currentVariables: ProcessedVariable[] = [];
let selectedCollectionId: string | null = null;
let selectedModeId: string | null = null;
let selectedVariableType: VariableType = 'COLOR';

// Text styles state (separate from variables since they're not in collections)
let textStyles: TextStyleInfo[] = [];
let textStylesLoaded = false;

// =============================================================================
// Toast Notifications
// =============================================================================

let toastTimeout: ReturnType<typeof setTimeout> | null = null;

function showToast(message: string, type: 'error' | 'warning' | 'success' = 'warning', duration = 4000): void {
  const toast = document.getElementById('toast');
  if (!toast) return;

  if (toastTimeout) {
    clearTimeout(toastTimeout);
  }

  toast.textContent = message;
  toast.className = `pds-toast pds-toast--${type} pds-toast--visible`;

  toastTimeout = setTimeout(() => {
    toast.classList.remove('pds-toast--visible');
    toastTimeout = null;
  }, duration);
}

// =============================================================================
// Tab Switching
// =============================================================================

function switchTab(tabId: TabId): void {
  if (tabId === activeTab) return;

  activeTab = tabId;

  // Update tab bar UI
  document.querySelectorAll('.pds-tab-bar__tab').forEach((tab) => {
    tab.classList.remove('pds-tab-bar__tab--active');
    if (tab.getAttribute('data-tab') === tabId) {
      tab.classList.add('pds-tab-bar__tab--active');
    }
  });

  // Update tab content visibility
  document.querySelectorAll('.pds-tab-content').forEach((content) => {
    content.classList.remove('pds-tab-content--active');
    if (content.getAttribute('data-tab-content') === tabId) {
      content.classList.add('pds-tab-content--active');
    }
  });

  // Update legacy state for compatibility
  const state = tabStates[tabId];
  selectedCollectionId = state.collectionId;
  selectedModeId = state.modeId;
  currentVariables = state.variables;
  selectedVariableType = TAB_VARIABLE_TYPES[tabId];

  // Auto-load text styles when switching to text-styles tab
  if (tabId === 'text-styles' && !textStylesLoaded) {
    loadTextStyles();
  }
}

// =============================================================================
// Message Sending (UI -> Plugin)
// =============================================================================

function sendMessage(message: { type: string; [key: string]: unknown }): void {
  window.parent.postMessage({ pluginMessage: message }, '*');
}

function loadTokens(): void {
  sendMessage({ type: 'load-tokens' });
}

function loadVariableCollections(): void {
  sendMessage({ type: 'load-collections' });
}

function loadVariables(collectionId: string, modeId: string, variableType?: VariableType): void {
  const typeToLoad = variableType || selectedVariableType;
  selectedCollectionId = collectionId;
  selectedModeId = modeId;
  sendMessage({ type: 'load-variables', collectionId, modeId, variableType: typeToLoad });
}

function loadTextStyles(): void {
  sendMessage({ type: 'load-text-styles' });
}

// =============================================================================
// Message Receiving (Plugin -> UI)
// =============================================================================

window.addEventListener('message', (event) => {
  const message = event.data?.pluginMessage;
  if (!message) return;

  switch (message.type) {
    case 'tokens-loaded':
      handleTokensLoaded(message.data);
      break;

    case 'collections-loaded':
      handleCollectionsLoaded(message.data);
      break;

    case 'variables-loaded':
      handleVariablesLoaded(message.data);
      break;

    case 'style-guide-generated':
      handleStyleGuideGenerated(message.data);
      break;

    case 'text-styles-loaded':
      handleTextStylesLoaded(message.data);
      break;

    case 'error':
      showToast(message.data, 'error');
      resetGenerateButton();
      break;

    default:
      break;
  }
});

function handleStyleGuideGenerated(data: {
  success: boolean;
  frameId?: string;
  frameName?: string;
  error?: string;
}): void {
  resetGenerateButton();

  if (!data.success) {
    showToast(`Generation failed: ${data.error}`, 'error');
  }
}

function resetGenerateButton(): void {
  // Reset the button for the active tab
  const button = document.querySelector(`.generate-button[data-tab="${activeTab}"]`) as HTMLButtonElement;
  if (button) {
    // Use appropriate text based on tab
    const buttonTexts: Record<TabId, string> = {
      'color': 'Generate Color Style Guide',
      'type-variables': 'Generate Font Variables Guide',
      'text-styles': 'Generate Text Styles Style Guide',
      'dimension': 'Generate Dimension Style Guide',
    };
    button.textContent = buttonTexts[activeTab] || 'Generate Style Guide';
    button.disabled = false;
  }
}

function handleTokensLoaded(data: {
  cssVariables: string;
  totalTokens: number;
}): void {
  loadedTokens = data;
  injectTokenCSS(data.cssVariables);
}

function handleCollectionsLoaded(collections: CollectionInfo[]): void {
  currentCollections = collections;
  populateCollectionDropdown(collections);
}

function handleVariablesLoaded(data: {
  variables: ProcessedVariable[];
  collectionName: string;
  modeName: string;
  tabId?: string;
}): void {
  const tabId = (data.tabId as TabId) || activeTab;

  // Store in tab state
  tabStates[tabId].variables = data.variables;

  // Update legacy state if active tab
  if (tabId === activeTab) {
    currentVariables = data.variables;
  }

  populateVariableFrameForTab(tabId, data.variables);
}

function handleTextStylesLoaded(data: TextStyleInfo[]): void {
  textStyles = data.map(style => ({ ...style, selected: true }));
  textStylesLoaded = true;
  renderTextStyles();
}

// =============================================================================
// CSS Injection
// =============================================================================

function injectTokenCSS(cssVariables: string): void {
  const existingStyle = document.getElementById('token-styles');
  if (existingStyle) {
    existingStyle.remove();
  }

  const styleElement = document.createElement('style');
  styleElement.id = 'token-styles';
  styleElement.textContent = cssVariables;
  document.head.appendChild(styleElement);
}

// =============================================================================
// Dropdown Interactions
// =============================================================================

function toggleDropdown(element: HTMLElement): void {
  if (element.hasAttribute('disabled')) return;

  // Close other open dropdowns
  document.querySelectorAll('.pds-dropdown--open').forEach((dropdown) => {
    if (dropdown !== element) {
      dropdown.classList.remove('pds-dropdown--open');
    }
  });

  element.classList.toggle('pds-dropdown--open');
}

function selectOption(option: HTMLElement, value: string): void {
  const dropdown = option.closest('.pds-dropdown');
  if (!dropdown) return;

  const textElement = dropdown.querySelector('.pds-dropdown__text');

  // Update selected option
  dropdown.querySelectorAll('.pds-dropdown__option').forEach((opt) => {
    opt.classList.remove('pds-dropdown__option--selected');
  });
  option.classList.add('pds-dropdown__option--selected');

  // Update displayed text
  if (textElement) {
    textElement.textContent = value;
  }

  // Close dropdown
  dropdown.classList.remove('pds-dropdown--open');

  // Check for conditional dropdowns that depend on this dropdown
  const dropdownOption = dropdown.getAttribute('data-option');
  if (dropdownOption) {
    updateConditionalOptions(dropdownOption, value);
  }
}

/**
 * Updates visibility of conditional options based on dropdown selection
 */
function updateConditionalOptions(dropdownOption: string, selectedValue: string): void {
  // Find all conditional option items
  const conditionalItems = document.querySelectorAll('.pds-option-list-item--conditional');

  conditionalItems.forEach((item) => {
    const condition = item.getAttribute('data-condition');
    if (!condition) return;

    // Parse condition format: "dropdown-option:value"
    const [conditionDropdown, conditionValue] = condition.split(':');

    if (conditionDropdown === dropdownOption) {
      // Show if the selected value matches the condition value
      if (selectedValue === conditionValue) {
        (item as HTMLElement).style.display = '';
      } else {
        (item as HTMLElement).style.display = 'none';
      }
    }
  });
}

// Close dropdowns when clicking outside
document.addEventListener('click', (event) => {
  const target = event.target as HTMLElement;
  if (!target.closest('.pds-dropdown')) {
    document.querySelectorAll('.pds-dropdown--open').forEach((dropdown) => {
      dropdown.classList.remove('pds-dropdown--open');
    });
  }
});

// =============================================================================
// Collection/Mode Dropdowns
// =============================================================================

function populateCollectionDropdown(collections: CollectionInfo[]): void {
  // Populate dropdowns for each tab that has collection selectors
  const tabsWithCollections: TabId[] = ['color', 'dimension', 'type-variables'];

  tabsWithCollections.forEach((tabId) => {
    const collectionDropdown = document.querySelector(
      `[data-dropdown="${tabId}-collection"]`
    ) as HTMLElement;

    if (!collectionDropdown) {
      return;
    }

    const optionsContainer = collectionDropdown.querySelector('.pds-dropdown__options');
    const textElement = collectionDropdown.querySelector('.pds-dropdown__text');

    if (!optionsContainer || !textElement) return;

    // Clear existing options
    optionsContainer.innerHTML = '';

    // Add collection options
    collections.forEach((collection) => {
      const option = document.createElement('div');
      option.className = 'pds-dropdown__option';
      option.textContent = collection.name;
      option.onclick = () => {
        selectOption(option, collection.name);

        // Update tab state
        tabStates[tabId].collectionId = collection.id;

        // Update legacy state if this is active tab
        if (tabId === activeTab) {
          selectedCollectionId = collection.id;
        }

        // Populate mode dropdown for this collection
        populateModeDropdownForTab(tabId, collection.modes);

        // Auto-select first mode if available
        if (collection.modes.length > 0) {
          tabStates[tabId].modeId = collection.modes[0].modeId;
          const modeDropdown = document.querySelector(`[data-dropdown="${tabId}-mode"] .pds-dropdown__text`);
          if (modeDropdown) {
            modeDropdown.textContent = collection.modes[0].name;
          }
          if (tabId === activeTab) {
            selectedModeId = collection.modes[0].modeId;
          }
          loadVariablesForTab(tabId, collection.id, collection.modes[0].modeId);
        }
      };
      optionsContainer.appendChild(option);
    });

    // Set first collection as selected if available
    if (collections.length > 0) {
      textElement.textContent = collections[0].name;
      tabStates[tabId].collectionId = collections[0].id;

      if (tabId === activeTab) {
        selectedCollectionId = collections[0].id;
      }

      populateModeDropdownForTab(tabId, collections[0].modes);

      if (collections[0].modes.length > 0) {
        tabStates[tabId].modeId = collections[0].modes[0].modeId;
        const modeDropdown = document.querySelector(`[data-dropdown="${tabId}-mode"] .pds-dropdown__text`);
        if (modeDropdown) {
          modeDropdown.textContent = collections[0].modes[0].name;
        }
        if (tabId === activeTab) {
          selectedModeId = collections[0].modes[0].modeId;
        }
        loadVariablesForTab(tabId, collections[0].id, collections[0].modes[0].modeId);
      }
    }
  });
}

function populateModeDropdown(modes: { modeId: string; name: string }[]): void {
  // Legacy function - redirect to active tab
  populateModeDropdownForTab(activeTab, modes);
}

function populateModeDropdownForTab(tabId: TabId, modes: { modeId: string; name: string }[]): void {
  const modeDropdown = document.querySelector(
    `[data-dropdown="${tabId}-mode"]`
  ) as HTMLElement;

  if (!modeDropdown) return;

  const optionsContainer = modeDropdown.querySelector('.pds-dropdown__options');
  const textElement = modeDropdown.querySelector('.pds-dropdown__text');

  if (!optionsContainer || !textElement) return;

  // Clear existing options
  optionsContainer.innerHTML = '';

  // Add mode options
  modes.forEach((mode) => {
    const option = document.createElement('div');
    option.className = 'pds-dropdown__option';
    option.textContent = mode.name;
    option.onclick = () => {
      selectOption(option, mode.name);
      tabStates[tabId].modeId = mode.modeId;

      if (tabId === activeTab) {
        selectedModeId = mode.modeId;
      }

      if (tabStates[tabId].collectionId) {
        loadVariablesForTab(tabId, tabStates[tabId].collectionId!, mode.modeId);
      }
    };
    optionsContainer.appendChild(option);
  });

  // Set first mode as selected
  if (modes.length > 0) {
    textElement.textContent = modes[0].name;
    tabStates[tabId].modeId = modes[0].modeId;
    if (tabId === activeTab) {
      selectedModeId = modes[0].modeId;
    }
  }
}

function loadVariablesForTab(tabId: TabId, collectionId: string, modeId: string): void {
  if (tabId === 'type-variables') {
    // Font variables tab uses special scope-filtered loading
    sendMessage({ type: 'load-font-variables', collectionId, modeId, tabId });
  } else {
    const variableType = TAB_VARIABLE_TYPES[tabId];
    sendMessage({ type: 'load-variables', collectionId, modeId, variableType, tabId });
  }
}

// =============================================================================
// Variable Selection Frame
// =============================================================================

function populateVariableFrame(variables: ProcessedVariable[]): void {
  // Legacy - redirect to active tab
  populateVariableFrameForTab(activeTab, variables);
}

function populateVariableFrameForTab(tabId: TabId, variables: ProcessedVariable[]): void {
  const variableFrame = document.querySelector(`[data-frame="${tabId}"] .pds-variable-selection-frame__content`);
  if (!variableFrame) {
    return;
  }

  // Clear existing content
  variableFrame.innerHTML = '';

  // Group variables by their path structure
  const groupedVariables = groupVariablesByPath(variables);

  // Create variable rows
  groupedVariables.forEach((variable) => {
    const row = createVariableRow(variable);
    variableFrame.appendChild(row);
  });

  // Update Select All button text for this tab
  updateSelectAllButtonTextForTab(tabId);
}

function updateSelectAllButtonText(): void {
  // Legacy - redirect to active tab
  updateSelectAllButtonTextForTab(activeTab);
}

function updateSelectAllButtonTextForTab(tabId: TabId): void {
  const frame = document.querySelector(`[data-frame="${tabId}"]`);
  const selectAllButton = document.querySelector(`.select-all-button[data-tab="${tabId}"]`);

  if (!frame || !selectAllButton) return;

  const allCheckboxes = frame.querySelectorAll('.pds-variable-checkbox-row__checkbox');
  if (allCheckboxes.length === 0) return;

  const allSelected = Array.from(allCheckboxes).every((checkbox) =>
    checkbox.classList.contains('pds-variable-checkbox-row__checkbox--checked')
  );

  selectAllButton.textContent = allSelected ? 'Deselect All' : 'Select All';
}

function groupVariablesByPath(variables: ProcessedVariable[]): ProcessedVariable[] {
  const result: ProcessedVariable[] = [];
  const groupMap = new Map<string, boolean>();

  // Sort variables by their full path
  const sortedVariables = [...variables].sort((a, b) =>
    a.fullPath.localeCompare(b.fullPath)
  );

  sortedVariables.forEach((variable) => {
    const pathParts = variable.nameParts;

    // Add parent groups if they don't exist
    for (let i = 0; i < pathParts.length - 1; i++) {
      const groupPath = pathParts.slice(0, i + 1).join('/');
      const groupKey = `group_${groupPath}`;

      if (!groupMap.has(groupKey)) {
        groupMap.set(groupKey, true);
        result.push({
          id: groupKey,
          name: groupPath,
          displayName: pathParts[i],
          fullPath: groupPath,
          nameParts: pathParts.slice(0, i + 1),
          groupLevel: i,
          indentLevel: i,
          type: 'GROUP',
          isGroup: true,
          selected: true,
          value: null,
          collection: variable.collection,
          mode: variable.mode,
        });
      }
    }

    // Add the actual variable
    result.push({
      ...variable,
      indentLevel: Math.min(pathParts.length - 1, 4),
      selected: true,
      isGroup: false,
    });
  });

  return result;
}

function createVariableRow(variable: ProcessedVariable): HTMLElement {
  const row = document.createElement('div');
  row.className = `pds-variable-checkbox-row pds-variable-checkbox-row--level-${variable.indentLevel || 0}`;
  row.setAttribute('data-variable-id', variable.id);
  row.setAttribute('data-full-path', variable.fullPath); // Store full path for parent/child matching

  if (variable.isGroup) {
    // Group row - show checkbox for "select all in group"
    row.classList.add('pds-variable-checkbox-row--group');
    row.innerHTML = `
      <div class="pds-variable-checkbox-row__inner">
        <div class="pds-variable-checkbox-row__checkbox-container">
          <div class="pds-variable-checkbox-row__checkbox pds-variable-checkbox-row__checkbox--checked" data-group-checkbox="true">
            <div class="pds-variable-checkbox-row__checkmark">✓</div>
          </div>
        </div>
        <div class="pds-variable-checkbox-row__label">
          <p class="pds-variable-checkbox-row__text">${variable.displayName}</p>
        </div>
      </div>
    `;
  } else {
    // Variable row - show checkbox and variable name only (not full path)
    row.innerHTML = `
      <div class="pds-variable-checkbox-row__inner">
        <div class="pds-variable-checkbox-row__checkbox-container">
          <div class="pds-variable-checkbox-row__checkbox pds-variable-checkbox-row__checkbox--checked">
            <div class="pds-variable-checkbox-row__checkmark">✓</div>
          </div>
        </div>
        <div class="pds-variable-checkbox-row__label">
          <p class="pds-variable-checkbox-row__text">${variable.displayName}</p>
        </div>
      </div>
    `;
  }

  // Add click handler to checkbox
  const checkbox = row.querySelector('.pds-variable-checkbox-row__checkbox');
  if (checkbox) {
    checkbox.addEventListener('click', () => toggleVariableCheckbox(checkbox as HTMLElement));
  }

  return row;
}

function toggleVariableCheckbox(checkbox: HTMLElement): void {
  const isChecked = checkbox.classList.contains('pds-variable-checkbox-row__checkbox--checked');
  const row = checkbox.closest('.pds-variable-checkbox-row');
  if (!row) return;

  const fullPath = row.getAttribute('data-full-path');
  const isGroupCheckbox = checkbox.hasAttribute('data-group-checkbox');

  if (isChecked) {
    checkbox.classList.remove('pds-variable-checkbox-row__checkbox--checked');
    row.setAttribute('data-selected', 'false');
  } else {
    checkbox.classList.add('pds-variable-checkbox-row__checkbox--checked');
    row.setAttribute('data-selected', 'true');
  }

  // If this is a group checkbox, toggle all children
  if (isGroupCheckbox && fullPath) {
    toggleGroupChildren(fullPath, !isChecked);
  }

  // Update the Select All button text
  updateSelectAllButtonText();
}

function toggleGroupChildren(groupPath: string, selected: boolean): void {
  const allRows = document.querySelectorAll('.pds-variable-checkbox-row');

  allRows.forEach((row) => {
    const rowPath = row.getAttribute('data-full-path');
    if (!rowPath) return;

    // Skip the parent row itself - only affect children
    if (rowPath === groupPath) return;

    // Check if this row is a child of the group (path starts with groupPath/)
    const isChild = rowPath.startsWith(groupPath + '/');

    if (isChild) {
      const checkbox = row.querySelector('.pds-variable-checkbox-row__checkbox');
      if (checkbox) {
        if (selected) {
          checkbox.classList.add('pds-variable-checkbox-row__checkbox--checked');
        } else {
          checkbox.classList.remove('pds-variable-checkbox-row__checkbox--checked');
        }
        row.setAttribute('data-selected', String(selected));
      }
    }
  });
}

// =============================================================================
// Text Styles Selection Frame
// =============================================================================

function renderTextStyles(): void {
  const frame = document.querySelector('[data-frame="text-styles"] .pds-variable-selection-frame__content');
  if (!frame) {
    return;
  }

  // Clear existing content
  frame.innerHTML = '';

  if (textStyles.length === 0) {
    frame.innerHTML = '<p class="pds-variable-selection-frame__empty">No text styles found in this file.</p>';
    return;
  }

  // Group text styles by their path structure (similar to variables)
  const groupedStyles = groupTextStylesByPath(textStyles);

  // Create rows for each style
  groupedStyles.forEach((item) => {
    const row = createTextStyleRow(item);
    frame.appendChild(row);
  });

  // Update Select All button text
  updateSelectAllButtonTextForTab('text-styles');
}

interface TextStyleWithUI extends TextStyleInfo {
  indentLevel?: number;
  isGroup?: boolean;
  displayName?: string;
  fullPath?: string;
}

function groupTextStylesByPath(styles: TextStyleInfo[]): TextStyleWithUI[] {
  const result: TextStyleWithUI[] = [];
  const groupMap = new Map<string, boolean>();

  // Sort styles by name
  const sortedStyles = [...styles].sort((a, b) => a.name.localeCompare(b.name));

  sortedStyles.forEach((style) => {
    const pathParts = style.name.split('/');

    // Add parent groups if they don't exist
    for (let i = 0; i < pathParts.length - 1; i++) {
      const groupPath = pathParts.slice(0, i + 1).join('/');
      const groupKey = `group_${groupPath}`;

      if (!groupMap.has(groupKey)) {
        groupMap.set(groupKey, true);
        result.push({
          id: groupKey,
          name: groupPath,
          displayName: pathParts[i],
          fullPath: groupPath,
          indentLevel: i,
          isGroup: true,
          selected: true,
          // Placeholder values for group
          fontFamily: '',
          fontStyle: '',
          fontSize: 0,
          lineHeight: { value: 0, unit: 'AUTO' },
          letterSpacing: { value: 0, unit: 'PIXELS' },
          textDecoration: 'NONE',
          paragraphSpacing: 0,
          description: '',
        });
      }
    }

    // Add the actual text style
    result.push({
      ...style,
      displayName: pathParts[pathParts.length - 1],
      fullPath: style.name,
      indentLevel: Math.min(pathParts.length - 1, 4),
      isGroup: false,
      selected: true,
    });
  });

  return result;
}

function createTextStyleRow(style: TextStyleWithUI): HTMLElement {
  const row = document.createElement('div');
  row.className = `pds-variable-checkbox-row pds-variable-checkbox-row--level-${style.indentLevel || 0}`;
  row.setAttribute('data-variable-id', style.id);
  row.setAttribute('data-full-path', style.fullPath || style.name);

  if (style.isGroup) {
    row.classList.add('pds-variable-checkbox-row--group');
    row.innerHTML = `
      <div class="pds-variable-checkbox-row__inner">
        <div class="pds-variable-checkbox-row__checkbox-container">
          <div class="pds-variable-checkbox-row__checkbox pds-variable-checkbox-row__checkbox--checked" data-group-checkbox="true">
            <div class="pds-variable-checkbox-row__checkmark">✓</div>
          </div>
        </div>
        <div class="pds-variable-checkbox-row__label">
          <p class="pds-variable-checkbox-row__text">${style.displayName}</p>
        </div>
      </div>
    `;
  } else {
    row.innerHTML = `
      <div class="pds-variable-checkbox-row__inner">
        <div class="pds-variable-checkbox-row__checkbox-container">
          <div class="pds-variable-checkbox-row__checkbox pds-variable-checkbox-row__checkbox--checked">
            <div class="pds-variable-checkbox-row__checkmark">✓</div>
          </div>
        </div>
        <div class="pds-variable-checkbox-row__label">
          <p class="pds-variable-checkbox-row__text">${style.displayName}</p>
        </div>
      </div>
    `;
  }

  // Add click handler to checkbox
  const checkbox = row.querySelector('.pds-variable-checkbox-row__checkbox');
  if (checkbox) {
    checkbox.addEventListener('click', () => toggleVariableCheckbox(checkbox as HTMLElement));
  }

  return row;
}

// =============================================================================
// Segmented Control
// =============================================================================

function selectSegment(element: HTMLElement, value: string): void {
  const control = element.closest('.pds-segmented-control');
  if (!control) return;

  // Remove selected class from all options
  control.querySelectorAll('.pds-segmented-control__option').forEach((option) => {
    option.classList.remove('pds-segmented-control__option--selected');
  });

  // Add selected class to clicked option
  element.classList.add('pds-segmented-control__option--selected');

  // Map segment text to variable type
  const typeMap: Record<string, VariableType> = {
    'Color': 'COLOR',
    'Number': 'FLOAT',
    'String': 'STRING',
    'Boolean': 'BOOLEAN',
  };

  const newType = typeMap[value];
  if (newType && newType !== selectedVariableType) {
    selectedVariableType = newType;

    // Reload variables with new type if collection/mode are selected
    if (selectedCollectionId && selectedModeId) {
      loadVariables(selectedCollectionId, selectedModeId, selectedVariableType);
    }
  }
}

// =============================================================================
// Toggle Switch
// =============================================================================

function toggleSwitch(element: HTMLElement): void {
  element.classList.toggle('pds-toggle--selected');

  const isSelected = element.classList.contains('pds-toggle--selected');
  const iconElement = element.querySelector('.pds-toggle__icon');

  if (iconElement) {
    if (isSelected) {
      iconElement.innerHTML = `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M6.66843 10.1136L12.7967 3.98535L13.7395 4.92816L6.66843 11.9992L2.42578 7.7566L3.36859 6.81381L6.66843 10.1136Z" fill="#1E1EFF"/></svg>`;
    } else {
      iconElement.innerHTML = `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M8.00047 7.05767L11.3003 3.75781L12.2431 4.70062L8.94327 8.00047L12.2431 11.3003L11.3003 12.2431L8.00047 8.94327L4.70062 12.2431L3.75781 11.3003L7.05767 8.00047L3.75781 4.70062L4.70062 3.75781L8.00047 7.05767Z" fill="white"/></svg>`;
    }
  }
}

// =============================================================================
// Plugin Actions
// =============================================================================

function resetPlugin(): void {
  if (!confirm('Are you sure you want to reset? This will clear all selections.')) {
    return;
  }

  // Reset all checkboxes to unchecked
  document.querySelectorAll('.pds-variable-checkbox-row__checkbox').forEach((checkbox) => {
    checkbox.classList.remove('pds-variable-checkbox-row__checkbox--checked');
  });

}

function toggleSelectAll(tabId?: TabId): void {
  const tab = tabId || activeTab;
  const frame = document.querySelector(`[data-frame="${tab}"]`);
  const selectAllButton = document.querySelector(`.select-all-button[data-tab="${tab}"]`) as HTMLButtonElement;

  if (!frame || !selectAllButton) return;

  const allCheckboxes = frame.querySelectorAll('.pds-variable-checkbox-row__checkbox');
  if (allCheckboxes.length === 0) return;

  // Check if all are currently selected
  const allSelected = Array.from(allCheckboxes).every((checkbox) =>
    checkbox.classList.contains('pds-variable-checkbox-row__checkbox--checked')
  );

  if (allSelected) {
    // Deselect all
    allCheckboxes.forEach((checkbox) => {
      checkbox.classList.remove('pds-variable-checkbox-row__checkbox--checked');
      const row = checkbox.closest('.pds-variable-checkbox-row');
      if (row) row.setAttribute('data-selected', 'false');
    });
    selectAllButton.textContent = 'Select All';
  } else {
    // Select all
    allCheckboxes.forEach((checkbox) => {
      checkbox.classList.add('pds-variable-checkbox-row__checkbox--checked');
      const row = checkbox.closest('.pds-variable-checkbox-row');
      if (row) row.setAttribute('data-selected', 'true');
    });
    selectAllButton.textContent = 'Deselect All';
  }
}

// Legacy function name for backwards compatibility
function selectAllVariables(): void {
  toggleSelectAll();
}

function getSelectedOptions(): {
  displayStyle: 'standard' | 'scale' | 'text-color' | 'border-color' | 'icon-color';
  colorValue: 'hex' | 'rgb' | 'hsl' | 'hsb';
  tableHeader: 'light' | 'dark';
  displayAliases: boolean;
  showDescription: boolean;
  addTitleCell: boolean;
} {
  // Display style dropdown
  const displayStyleDropdown = document.querySelector('[data-option="display-style"] .pds-dropdown__text');
  const displayStyleText = displayStyleDropdown?.textContent?.toLowerCase() || 'standard';
  let displayStyle: 'standard' | 'scale' | 'text-color' | 'border-color' | 'icon-color' = 'standard';
  if (displayStyleText.includes('scale')) displayStyle = 'scale';
  else if (displayStyleText.includes('text')) displayStyle = 'text-color';
  else if (displayStyleText.includes('border')) displayStyle = 'border-color';
  else if (displayStyleText.includes('icon')) displayStyle = 'icon-color';

  // Color value dropdown
  const colorValueDropdown = document.querySelector('[data-option="color-value"] .pds-dropdown__text');
  const colorValueText = colorValueDropdown?.textContent?.toLowerCase() || 'hex';
  let colorValue: 'hex' | 'rgb' | 'hsl' | 'hsb' = 'hex';
  if (colorValueText.includes('rgb')) colorValue = 'rgb';
  else if (colorValueText.includes('hsb')) colorValue = 'hsb';
  else if (colorValueText.includes('hsl')) colorValue = 'hsl';

  // Table header dropdown
  const tableHeaderDropdown = document.querySelector('[data-option="table-header"] .pds-dropdown__text');
  const tableHeaderText = tableHeaderDropdown?.textContent?.toLowerCase() || 'dark';
  const tableHeader: 'light' | 'dark' = tableHeaderText.includes('light') ? 'light' : 'dark';

  // Display Aliases toggle
  const displayAliasesToggle = document.querySelector('[data-option="display-aliases"]');
  const displayAliases = displayAliasesToggle?.classList.contains('pds-toggle--selected') || false;

  // Show description toggle
  const showDescriptionToggle = document.querySelector('[data-option="show-description"]');
  const showDescription = showDescriptionToggle?.classList.contains('pds-toggle--selected') || false;

  // Add title cell toggle
  const addTitleCellToggle = document.querySelector('[data-option="add-title-cell"]');
  const addTitleCell = addTitleCellToggle?.classList.contains('pds-toggle--selected') || false;

  return {
    displayStyle,
    colorValue,
    tableHeader,
    displayAliases,
    showDescription,
    addTitleCell,
  };
}

function getDimensionOptions(): {
  displayStyle: 'standard' | 'spacing' | 'border-radius';
  spacingStyle: 'filled' | 'line';
  tableHeader: 'light' | 'dark';
  displayPixels: boolean;
  addRemValues: boolean;
  displayAliases: boolean;
  showDescription: boolean;
  addTitleCell: boolean;
} {
  // Display style dropdown for dimensions
  const displayStyleDropdown = document.querySelector('[data-option="dimension-display-style"] .pds-dropdown__text');
  const displayStyleText = displayStyleDropdown?.textContent?.toLowerCase() || 'standard';
  let displayStyle: 'standard' | 'spacing' | 'border-radius' = 'standard';
  if (displayStyleText.includes('spacing')) displayStyle = 'spacing';
  else if (displayStyleText.includes('radius')) displayStyle = 'border-radius';

  // Spacing style dropdown (only relevant when displayStyle is 'spacing')
  const spacingStyleDropdown = document.querySelector('[data-option="dimension-spacing-style"] .pds-dropdown__text');
  const spacingStyleText = spacingStyleDropdown?.textContent?.toLowerCase() || 'filled';
  let spacingStyle: 'filled' | 'line' = 'filled';
  if (spacingStyleText.includes('line')) spacingStyle = 'line';

  // Table header dropdown
  const tableHeaderDropdown = document.querySelector('[data-option="dimension-table-header"] .pds-dropdown__text');
  const tableHeaderText = tableHeaderDropdown?.textContent?.toLowerCase() || 'dark';
  const tableHeader: 'light' | 'dark' = tableHeaderText.includes('light') ? 'light' : 'dark';

  // Display in Pixels toggle
  const displayPixelsToggle = document.querySelector('[data-option="dimension-display-pixels"]');
  const displayPixels = displayPixelsToggle?.classList.contains('pds-toggle--selected') || false;

  // Add REM values toggle
  const addRemToggle = document.querySelector('[data-option="dimension-add-rem"]');
  const addRemValues = addRemToggle?.classList.contains('pds-toggle--selected') || false;

  // Display Aliases toggle
  const displayAliasesToggle = document.querySelector('[data-option="dimension-display-aliases"]');
  const displayAliases = displayAliasesToggle?.classList.contains('pds-toggle--selected') || false;

  // Show description toggle
  const showDescriptionToggle = document.querySelector('[data-option="dimension-show-description"]');
  const showDescription = showDescriptionToggle?.classList.contains('pds-toggle--selected') || false;

  // Add title cell toggle
  const addTitleCellToggle = document.querySelector('[data-option="dimension-add-title-cell"]');
  const addTitleCell = addTitleCellToggle?.classList.contains('pds-toggle--selected') || false;

  return {
    displayStyle,
    spacingStyle,
    tableHeader,
    displayPixels,
    addRemValues,
    displayAliases,
    showDescription,
    addTitleCell,
  };
}

function getTextStyleOptions(): {
  tableHeader: 'light' | 'dark';
  addRemValues: boolean;
  displayAliases: boolean;
  showTextDecoration: boolean;
  showParagraphSpacing: boolean;
  showDescription: boolean;
} {
  // Table header dropdown
  const tableHeaderDropdown = document.querySelector('[data-option="text-styles-table-header"] .pds-dropdown__text');
  const tableHeaderText = tableHeaderDropdown?.textContent?.toLowerCase() || 'dark';
  const tableHeader: 'light' | 'dark' = tableHeaderText.includes('light') ? 'light' : 'dark';

  // Add REM values toggle
  const addRemToggle = document.querySelector('[data-option="text-styles-add-rem"]');
  const addRemValues = addRemToggle?.classList.contains('pds-toggle--selected') || false;

  // Display aliases toggle
  const displayAliasesToggle = document.querySelector('[data-option="text-styles-display-aliases"]');
  const displayAliases = displayAliasesToggle?.classList.contains('pds-toggle--selected') || false;

  // Show text decoration toggle
  const showTextDecorationToggle = document.querySelector('[data-option="text-styles-show-text-decoration"]');
  const showTextDecoration = showTextDecorationToggle?.classList.contains('pds-toggle--selected') || false;

  // Show paragraph spacing toggle
  const showParagraphSpacingToggle = document.querySelector('[data-option="text-styles-show-paragraph-spacing"]');
  const showParagraphSpacing = showParagraphSpacingToggle?.classList.contains('pds-toggle--selected') || false;

  // Show description toggle
  const showDescriptionToggle = document.querySelector('[data-option="text-styles-show-description"]');
  const showDescription = showDescriptionToggle?.classList.contains('pds-toggle--selected') || false;

  return {
    tableHeader,
    addRemValues,
    displayAliases,
    showTextDecoration,
    showParagraphSpacing,
    showDescription,
  };
}

type FontDisplayType = 'standard' | 'font-family' | 'font-size' | 'font-weight' | 'letter-spacing' | 'line-height';

function getFontVariableOptions(): {
  displayType: FontDisplayType;
  tableHeader: 'light' | 'dark';
  addRemValues: boolean;
  displayAliases: boolean;
  showDescription: boolean;
} {
  // Display type dropdown
  const displayTypeDropdown = document.querySelector('[data-option="font-display-type"] .pds-dropdown__text');
  const displayTypeText = displayTypeDropdown?.textContent?.toLowerCase() || 'standard';
  let displayType: FontDisplayType = 'standard';
  if (displayTypeText.includes('font family')) displayType = 'font-family';
  else if (displayTypeText.includes('font size')) displayType = 'font-size';
  else if (displayTypeText.includes('font weight')) displayType = 'font-weight';
  else if (displayTypeText.includes('letter spacing')) displayType = 'letter-spacing';
  else if (displayTypeText.includes('line height')) displayType = 'line-height';

  // Table header dropdown
  const tableHeaderDropdown = document.querySelector('[data-option="font-table-header"] .pds-dropdown__text');
  const tableHeaderText = tableHeaderDropdown?.textContent?.toLowerCase() || 'dark';
  const tableHeader: 'light' | 'dark' = tableHeaderText.includes('light') ? 'light' : 'dark';

  // Add REM values toggle
  const addRemToggle = document.querySelector('[data-option="font-add-rem"]');
  const addRemValues = addRemToggle?.classList.contains('pds-toggle--selected') || false;

  // Display Aliases toggle
  const displayAliasesToggle = document.querySelector('[data-option="font-display-aliases"]');
  const displayAliases = displayAliasesToggle?.classList.contains('pds-toggle--selected') || false;

  // Show description toggle
  const showDescriptionToggle = document.querySelector('[data-option="font-show-description"]');
  const showDescription = showDescriptionToggle?.classList.contains('pds-toggle--selected') || false;

  return {
    displayType,
    tableHeader,
    addRemValues,
    displayAliases,
    showDescription,
  };
}

function generateStyleGuide(tabId?: TabId): void {
  const tab = tabId || activeTab;

  // Handle text-styles tab separately (doesn't use collections/modes)
  if (tab === 'text-styles') {
    generateTextStyleGuide();
    return;
  }

  // Handle font variables tab separately
  if (tab === 'type-variables') {
    generateFontVariableGuide();
    return;
  }

  const state = tabStates[tab];

  if (!state.collectionId || !state.modeId) {
    showToast('Please select a collection and mode first.', 'warning');
    return;
  }

  const selectedVariables: string[] = [];
  const frame = document.querySelector(`[data-frame="${tab}"]`);

  if (frame) {
    frame.querySelectorAll('.pds-variable-checkbox-row__checkbox--checked').forEach((checkbox) => {
      const row = checkbox.closest('.pds-variable-checkbox-row');
      if (row) {
        const variableId = row.getAttribute('data-variable-id');
        if (variableId && !variableId.startsWith('group_')) {
          selectedVariables.push(variableId);
        }
      }
    });
  }

  if (selectedVariables.length === 0) {
    showToast('Please select at least one variable.', 'warning');
    return;
  }

  // Get options based on the active tab
  const options = tab === 'dimension' ? getDimensionOptions() : getSelectedOptions();

  const generationData = {
    collectionId: state.collectionId,
    modeId: state.modeId,
    variableIds: selectedVariables,
    options,
  };

  sendMessage({ type: 'generate-style-guide', data: generationData });

  // Show loading state
  const button = document.querySelector(`.generate-button[data-tab="${tab}"]`) as HTMLButtonElement;
  if (button) {
    button.textContent = 'Generating...';
    button.disabled = true;
  }
}

function generateFontVariableGuide(): void {
  const state = tabStates['type-variables'];

  if (!state.collectionId || !state.modeId) {
    showToast('Please select a collection and mode first.', 'warning');
    return;
  }

  const selectedVariables: string[] = [];
  const frame = document.querySelector('[data-frame="type-variables"]');

  if (frame) {
    frame.querySelectorAll('.pds-variable-checkbox-row__checkbox--checked').forEach((checkbox) => {
      const row = checkbox.closest('.pds-variable-checkbox-row');
      if (row) {
        const variableId = row.getAttribute('data-variable-id');
        if (variableId && !variableId.startsWith('group_')) {
          selectedVariables.push(variableId);
        }
      }
    });
  }

  if (selectedVariables.length === 0) {
    showToast('Please select at least one font variable.', 'warning');
    return;
  }

  const options = getFontVariableOptions();

  const generationData = {
    collectionId: state.collectionId,
    modeId: state.modeId,
    variableIds: selectedVariables,
    options,
  };

  sendMessage({ type: 'generate-font-variable-guide', data: generationData });

  // Show loading state
  const button = document.querySelector('.generate-button[data-tab="type-variables"]') as HTMLButtonElement;
  if (button) {
    button.textContent = 'Generating...';
    button.disabled = true;
  }
}

function generateTextStyleGuide(): void {
  // Get selected text style IDs
  const selectedStyleIds: string[] = [];
  const frame = document.querySelector('[data-frame="text-styles"]');

  if (frame) {
    frame.querySelectorAll('.pds-variable-checkbox-row__checkbox--checked').forEach((checkbox) => {
      const row = checkbox.closest('.pds-variable-checkbox-row');
      if (row) {
        const styleId = row.getAttribute('data-variable-id');
        if (styleId && !styleId.startsWith('group_')) {
          selectedStyleIds.push(styleId);
        }
      }
    });
  }

  if (selectedStyleIds.length === 0) {
    showToast('Please select at least one text style.', 'warning');
    return;
  }

  const options = getTextStyleOptions();

  const generationData = {
    styleIds: selectedStyleIds,
    options,
  };

  sendMessage({ type: 'generate-text-style-guide', data: generationData });

  // Show loading state
  const button = document.querySelector('.generate-button[data-tab="text-styles"]') as HTMLButtonElement;
  if (button) {
    button.textContent = 'Generating...';
    button.disabled = true;
  }
}

// =============================================================================
// Initialization
// =============================================================================

function initializeEventListeners(): void {
  // Tab bar click handlers
  document.querySelectorAll('.pds-tab-bar__tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      const tabId = tab.getAttribute('data-tab') as TabId;
      if (tabId) {
        switchTab(tabId);
      }
    });
  });

  // Dropdown toggles and option selection
  document.querySelectorAll('.pds-dropdown').forEach((dropdown) => {
    // Toggle dropdown open/close when clicking on the dropdown (but not options)
    dropdown.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      // Only toggle if clicking on the dropdown itself, not on an option
      if (!target.closest('.pds-dropdown__option')) {
        toggleDropdown(dropdown as HTMLElement);
      }
    });

    // Add click handlers to all options within this dropdown
    dropdown.querySelectorAll('.pds-dropdown__option').forEach((option) => {
      option.addEventListener('click', (e) => {
        e.stopPropagation(); // Prevent dropdown toggle
        const optionText = (option as HTMLElement).textContent || '';
        selectOption(option as HTMLElement, optionText);
      });
    });
  });

  // Segmented control options (legacy - keep for backwards compatibility)
  document.querySelectorAll('.pds-segmented-control__option').forEach((option) => {
    option.addEventListener('click', () => {
      selectSegment(option as HTMLElement, option.textContent || '');
    });
  });

  // Toggle switches
  document.querySelectorAll('.pds-toggle').forEach((toggle) => {
    toggle.addEventListener('click', () => {
      toggleSwitch(toggle as HTMLElement);
    });
  });

  // Generate buttons (one per tab)
  document.querySelectorAll('.generate-button').forEach((button) => {
    button.addEventListener('click', () => {
      const tabId = button.getAttribute('data-tab') as TabId;
      generateStyleGuide(tabId || undefined);
    });
  });

  // Select All buttons (one per tab)
  document.querySelectorAll('.select-all-button').forEach((button) => {
    button.addEventListener('click', () => {
      const tabId = button.getAttribute('data-tab') as TabId;
      toggleSelectAll(tabId || undefined);
    });
  });

  // Reset button (if exists)
  const resetButton = document.querySelector('[data-action="reset"]');
  if (resetButton) {
    resetButton.addEventListener('click', resetPlugin);
  }
}

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {

  initializeEventListeners();
  loadTokens();

  // Small delay to ensure UI is ready before loading collections
  setTimeout(() => {
    loadVariableCollections();
  }, 100);
});

// Export for global access (needed for inline onclick handlers during transition)
(window as unknown as { toggleDropdown: typeof toggleDropdown }).toggleDropdown = toggleDropdown;
(window as unknown as { selectOption: typeof selectOption }).selectOption = selectOption;
(window as unknown as { selectSegment: typeof selectSegment }).selectSegment = selectSegment;
(window as unknown as { toggleSwitch: typeof toggleSwitch }).toggleSwitch = toggleSwitch;
(window as unknown as { toggleVariableCheckbox: typeof toggleVariableCheckbox }).toggleVariableCheckbox = toggleVariableCheckbox;
(window as unknown as { switchTab: typeof switchTab }).switchTab = switchTab;
