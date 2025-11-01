/**
 * Polish Extension - Popup Logic Controller
 * Coordinates between UI and backend (content script + service worker)
 *
 * Architecture: State machine pattern with comprehensive error handling
 * Message flow: popup → content script → service worker → Claude API
 *
 * @version 0.1.0
 */

/* ===========================
   CONSTANTS AND CONFIGURATION
   =========================== */

const DEBUG_MODE = true; // Set to false for production
const MESSAGE_TIMEOUT = 5000; // 5 seconds
const STATUS_AUTO_HIDE_DELAY = 3000; // 3 seconds
const API_KEY_MIN_LENGTH = 20;
const API_KEY_PREFIX = 'sk-ant-';

/* ===========================
   STATE MANAGEMENT
   =========================== */

/**
 * Application state machine
 * States:
 * - INITIALIZING: Popup loading
 * - NO_API_KEY: No API key saved
 * - READY: Ready to select element
 * - SELECTING: Selection mode active in content script
 * - ELEMENT_SELECTED: Element chosen, waiting for user request
 * - PROCESSING: API request in progress
 * - ERROR: Error state
 * - SUCCESS: Temporary success state
 */
const STATES = {
  INITIALIZING: 'INITIALIZING',
  NO_API_KEY: 'NO_API_KEY',
  READY: 'READY',
  SELECTING: 'SELECTING',
  ELEMENT_SELECTED: 'ELEMENT_SELECTED',
  PROCESSING: 'PROCESSING',
  ERROR: 'ERROR',
  SUCCESS: 'SUCCESS'
};

const state = {
  currentState: STATES.INITIALIZING,
  apiKey: null,
  selectedElement: null, // { selector, tagName }
  isProcessing: false,
  lastError: null
};

/* ===========================
   DOM ELEMENT REFERENCES
   =========================== */

const elements = {
  // Sections
  apiKeySection: null,
  editingSection: null,

  // API Key elements
  apiKeyInput: null,
  saveApiKeyBtn: null,
  apiKeyStatus: null,

  // Selection elements
  toggleSelectionBtn: null,
  selectedElementInfo: null,
  selectedElementTag: null,
  selectedElementSelector: null,

  // Modification elements
  modificationInput: null,
  applyModificationBtn: null,
  modificationStatus: null
};

/* ===========================
   LOGGING UTILITIES
   =========================== */

const logger = {
  debug: (...args) => {
    if (DEBUG_MODE) console.log('[Polish DEBUG]', ...args);
  },
  info: (...args) => {
    console.info('[Polish INFO]', ...args);
  },
  warn: (...args) => {
    console.warn('[Polish WARN]', ...args);
  },
  error: (...args) => {
    console.error('[Polish ERROR]', ...args);
  }
};

/* ===========================
   INITIALIZATION
   =========================== */

/**
 * Main initialization function
 * Called when popup DOM is ready
 */
document.addEventListener('DOMContentLoaded', async () => {
  logger.debug('Popup initializing...');

  try {
    await init();
  } catch (error) {
    logger.error('Initialization failed:', error);
    showError('Failed to initialize extension. Please reload.');
  }
});

/**
 * Initialize popup
 */
async function init() {
  // Cache all DOM element references
  cacheElements();

  // Verify all required elements exist
  if (!verifyElements()) {
    throw new Error('Required DOM elements missing');
  }

  // Set up all event listeners
  setupEventListeners();

  // Set up keyboard shortcuts
  setupKeyboardShortcuts();

  // Load API key from storage
  const hasApiKey = await loadApiKey();

  if (!hasApiKey) {
    setState(STATES.NO_API_KEY);
    return;
  }

  // Check if content script has an element selected
  const hasSelection = await checkForSelectedElement();

  if (hasSelection) {
    setState(STATES.ELEMENT_SELECTED);
  } else {
    // Check if selection mode is active
    const isSelecting = await checkSelectionStatus();
    setState(isSelecting ? STATES.SELECTING : STATES.READY);
  }

  logger.info('Popup initialized successfully');
}

/**
 * Cache all DOM element references
 */
function cacheElements() {
  // Sections
  elements.apiKeySection = document.getElementById('apiKeySection');
  elements.editingSection = document.getElementById('editingSection');

  // API Key elements
  elements.apiKeyInput = document.getElementById('apiKeyInput');
  elements.saveApiKeyBtn = document.getElementById('saveApiKeyBtn');
  elements.apiKeyStatus = document.getElementById('apiKeyStatus');

  // Selection elements
  elements.toggleSelectionBtn = document.getElementById('toggleSelectionBtn');
  elements.selectedElementInfo = document.getElementById('selectedElementInfo');
  elements.selectedElementTag = document.getElementById('selectedElementTag');
  elements.selectedElementSelector = document.getElementById('selectedElementSelector');

  // Modification elements
  elements.modificationInput = document.getElementById('modificationInput');
  elements.applyModificationBtn = document.getElementById('applyModificationBtn');
  elements.modificationStatus = document.getElementById('modificationStatus');

  logger.debug('DOM elements cached');
}

/**
 * Verify all required elements exist
 * @returns {boolean}
 */
function verifyElements() {
  const requiredElements = [
    'apiKeySection', 'editingSection', 'apiKeyInput', 'saveApiKeyBtn',
    'toggleSelectionBtn', 'modificationInput', 'applyModificationBtn'
  ];

  for (const key of requiredElements) {
    if (!elements[key]) {
      logger.error(`Missing required element: ${key}`);
      return false;
    }
  }

  return true;
}

/**
 * Set up all event listeners
 */
function setupEventListeners() {
  // API Key
  elements.saveApiKeyBtn.addEventListener('click', handleSaveApiKey);

  // Selection
  elements.toggleSelectionBtn.addEventListener('click', handleToggleSelection);

  // Modification
  elements.applyModificationBtn.addEventListener('click', handleApplyModification);

  logger.debug('Event listeners attached');
}

/**
 * Set up keyboard shortcuts
 */
function setupKeyboardShortcuts() {
  // Enter in API key input → Save
  elements.apiKeyInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSaveApiKey();
    }
  });

  // Ctrl+Enter or Cmd+Enter in textarea → Submit
  elements.modificationInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleApplyModification();
    }
  });

  // Escape → Cancel selection mode
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && state.currentState === STATES.SELECTING) {
      handleToggleSelection();
    }
  });

  logger.debug('Keyboard shortcuts registered');
}

/* ===========================
   STATE MACHINE
   =========================== */

/**
 * Set current state and update UI accordingly
 * @param {string} newState - One of STATES values
 */
function setState(newState) {
  if (!STATES[newState]) {
    logger.error(`Invalid state: ${newState}`);
    return;
  }

  logger.debug(`State transition: ${state.currentState} → ${newState}`);
  state.currentState = newState;
  updateUIForState();
}

/**
 * Update all UI elements based on current state
 */
function updateUIForState() {
  const currentState = state.currentState;

  switch (currentState) {
    case STATES.NO_API_KEY:
      showSection('apiKey');
      elements.apiKeyInput.focus();
      break;

    case STATES.READY:
      showSection('editing');
      elements.toggleSelectionBtn.textContent = 'Select Element';
      elements.toggleSelectionBtn.classList.remove('active');
      elements.toggleSelectionBtn.disabled = false;
      elements.selectedElementInfo.classList.add('hidden');
      elements.modificationInput.disabled = true;
      elements.applyModificationBtn.disabled = true;
      elements.toggleSelectionBtn.focus();
      break;

    case STATES.SELECTING:
      showSection('editing');
      elements.toggleSelectionBtn.textContent = 'Cancel Selection';
      elements.toggleSelectionBtn.classList.add('active');
      elements.toggleSelectionBtn.disabled = false;
      elements.selectedElementInfo.classList.add('hidden');
      elements.modificationInput.disabled = true;
      elements.applyModificationBtn.disabled = true;
      break;

    case STATES.ELEMENT_SELECTED:
      showSection('editing');
      elements.toggleSelectionBtn.textContent = 'Select Element';
      elements.toggleSelectionBtn.classList.remove('active');
      elements.toggleSelectionBtn.disabled = false;
      elements.selectedElementInfo.classList.remove('hidden');
      elements.modificationInput.disabled = false;
      elements.applyModificationBtn.disabled = false;
      elements.modificationInput.focus();
      updateElementInfo(state.selectedElement?.tagName, state.selectedElement?.selector);
      break;

    case STATES.PROCESSING:
      showSection('editing');
      elements.toggleSelectionBtn.disabled = true;
      elements.modificationInput.disabled = true;
      elements.applyModificationBtn.disabled = true;
      elements.applyModificationBtn.textContent = 'Processing...';
      elements.applyModificationBtn.classList.add('loading');
      break;

    case STATES.ERROR:
      // Show error in appropriate section
      if (state.apiKey) {
        showSection('editing');
      } else {
        showSection('apiKey');
      }
      break;

    case STATES.SUCCESS:
      // Brief success state, then return to READY
      setTimeout(() => {
        setState(STATES.READY);
      }, 1000);
      break;
  }
}

/**
 * Show specific UI section
 * @param {string} section - 'apiKey' or 'editing'
 */
function showSection(section) {
  if (section === 'apiKey') {
    elements.apiKeySection?.classList.remove('hidden');
    elements.editingSection?.classList.add('hidden');
  } else if (section === 'editing') {
    elements.apiKeySection?.classList.add('hidden');
    elements.editingSection?.classList.remove('hidden');
  }
}

/* ===========================
   API KEY MANAGEMENT
   =========================== */

/**
 * Load API key from chrome.storage.local
 * @returns {Promise<boolean>} True if API key exists
 */
async function loadApiKey() {
  try {
    const result = await chrome.storage.local.get(['anthropicApiKey']);

    if (result.anthropicApiKey) {
      state.apiKey = result.anthropicApiKey;
      logger.info('API key loaded');
      return true;
    }

    logger.warn('No API key found');
    return false;
  } catch (error) {
    logger.error('Failed to load API key:', error);
    return false;
  }
}

/**
 * Handle API key save button click
 */
async function handleSaveApiKey() {
  const apiKey = elements.apiKeyInput.value.trim();

  // Validate format
  if (!validateApiKeyFormat(apiKey)) {
    showApiKeyStatus(
      `Invalid API key format. Must start with "${API_KEY_PREFIX}" and be at least ${API_KEY_MIN_LENGTH} characters.`,
      'error'
    );
    return;
  }

  // Show loading state
  elements.saveApiKeyBtn.disabled = true;
  elements.saveApiKeyBtn.textContent = 'Saving...';
  elements.apiKeyInput.disabled = true;

  try {
    // Save to storage
    await chrome.storage.local.set({ anthropicApiKey: apiKey });

    state.apiKey = apiKey;

    showApiKeyStatus('API key saved successfully!', 'success');

    logger.info('API key saved');

    // Transition to READY state
    setTimeout(() => {
      setState(STATES.READY);
    }, 500);

  } catch (error) {
    logger.error('Failed to save API key:', error);
    showApiKeyStatus('Failed to save API key. Please try again.', 'error');

    // Reset button state
    elements.saveApiKeyBtn.disabled = false;
    elements.saveApiKeyBtn.textContent = 'Save Key';
    elements.apiKeyInput.disabled = false;
  }
}

/**
 * Validate API key format
 * @param {string} apiKey - API key to validate
 * @returns {boolean}
 */
function validateApiKeyFormat(apiKey) {
  if (!apiKey || typeof apiKey !== 'string') {
    return false;
  }

  if (!apiKey.startsWith(API_KEY_PREFIX)) {
    return false;
  }

  if (apiKey.length < API_KEY_MIN_LENGTH) {
    return false;
  }

  return true;
}

/**
 * Show API key status message
 * @param {string} message - Message to display
 * @param {string} type - 'success' or 'error'
 */
function showApiKeyStatus(message, type) {
  if (!elements.apiKeyStatus) return;

  elements.apiKeyStatus.textContent = message;
  elements.apiKeyStatus.className = `status status-${type}`;
  elements.apiKeyStatus.classList.remove('hidden');

  if (type === 'success') {
    setTimeout(() => {
      elements.apiKeyStatus.classList.add('hidden');
    }, STATUS_AUTO_HIDE_DELAY);
  }
}

/* ===========================
   SELECTION MODE MANAGEMENT
   =========================== */

/**
 * Handle toggle selection button click
 */
async function handleToggleSelection() {
  logger.debug('Toggle selection clicked');

  try {
    const response = await sendToContentScript({
      type: 'TOGGLE_SELECTION_MODE'
    });

    if (response && response.success) {
      const isActive = response.isActive;
      setState(isActive ? STATES.SELECTING : STATES.READY);
      logger.debug(`Selection mode ${isActive ? 'activated' : 'deactivated'}`);
    } else {
      throw new Error('Failed to toggle selection mode');
    }

  } catch (error) {
    logger.error('Toggle selection failed:', error);
    showModificationStatus(
      'Failed to toggle selection mode. Please refresh the page.',
      'error'
    );
  }
}

/**
 * Check current selection status from content script
 * @returns {Promise<boolean>}
 */
async function checkSelectionStatus() {
  try {
    const response = await sendToContentScript({
      type: 'GET_SELECTION_STATUS'
    });

    if (response && response.success) {
      return response.isActive || false;
    }

    return false;
  } catch (error) {
    logger.warn('Could not check selection status:', error);
    return false;
  }
}

/* ===========================
   ELEMENT SELECTION HANDLING
   =========================== */

/**
 * Check if content script has an element selected
 * @returns {Promise<boolean>}
 */
async function checkForSelectedElement() {
  try {
    const response = await sendToContentScript({
      type: 'GET_SELECTED_ELEMENT_INFO'
    });

    if (response && response.success && response.hasSelection) {
      state.selectedElement = {
        selector: response.selector,
        tagName: response.tagName
      };
      logger.debug('Found selected element:', state.selectedElement);
      return true;
    }

    return false;
  } catch (error) {
    logger.warn('Could not check for selected element:', error);
    return false;
  }
}

/**
 * Listen for element selected messages from content script
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'ELEMENT_SELECTED') {
    logger.debug('Element selected:', message.data);

    state.selectedElement = {
      selector: message.data.selector,
      tagName: message.data.tagName
    };

    setState(STATES.ELEMENT_SELECTED);
    sendResponse({ received: true });
  }
});

/**
 * Update element info display
 * @param {string} tagName - Element tag name
 * @param {string} selector - Element selector
 */
function updateElementInfo(tagName, selector) {
  if (elements.selectedElementTag) {
    elements.selectedElementTag.textContent = tagName || '';
  }

  if (elements.selectedElementSelector) {
    elements.selectedElementSelector.textContent = selector || '';
  }
}

/* ===========================
   MODIFICATION REQUEST HANDLING
   =========================== */

/**
 * Handle apply modification button click
 */
async function handleApplyModification() {
  logger.debug('Apply modification clicked');

  // Prevent double submission
  if (state.isProcessing) {
    logger.warn('Already processing a request');
    return;
  }

  const userRequest = elements.modificationInput.value.trim();

  // Validate request
  if (!validateModificationRequest(userRequest)) {
    showModificationStatus('Please enter a modification request.', 'error');
    return;
  }

  if (!state.selectedElement) {
    showModificationStatus('No element selected. Please select an element first.', 'error');
    return;
  }

  // Set processing state
  state.isProcessing = true;
  setState(STATES.PROCESSING);
  showModificationStatus('Processing your request...', 'loading');

  try {
    // Send modification request to content script
    const response = await sendToContentScript(
      {
        type: 'MODIFY_ELEMENT_REQUEST',
        data: { userRequest }
      },
      MESSAGE_TIMEOUT
    );

    if (response && response.success) {
      logger.info('Modification applied successfully');
      showModificationStatus('Modifications applied successfully!', 'success');

      // Clear input
      elements.modificationInput.value = '';

      // Clear selection
      state.selectedElement = null;

      // Set success state
      setState(STATES.SUCCESS);

    } else {
      throw new Error(response?.error || 'Modification failed');
    }

  } catch (error) {
    logger.error('Modification request failed:', error);

    const errorMessage = formatErrorMessage(error);
    showModificationStatus(errorMessage, 'error');

    // Return to element selected state
    setState(STATES.ELEMENT_SELECTED);

  } finally {
    state.isProcessing = false;
  }
}

/**
 * Validate modification request
 * @param {string} request - User's modification request
 * @returns {boolean}
 */
function validateModificationRequest(request) {
  if (!request || typeof request !== 'string') {
    return false;
  }

  if (request.trim().length === 0) {
    return false;
  }

  if (request.length < 3) {
    return false;
  }

  return true;
}

/**
 * Show modification status message
 * @param {string} message - Message to display
 * @param {string} type - 'success', 'error', 'loading', 'info'
 */
function showModificationStatus(message, type) {
  if (!elements.modificationStatus) return;

  elements.modificationStatus.textContent = message;
  elements.modificationStatus.className = `status status-${type}`;
  elements.modificationStatus.classList.remove('hidden');

  if (type === 'success') {
    setTimeout(() => {
      elements.modificationStatus.classList.add('hidden');
    }, STATUS_AUTO_HIDE_DELAY);
  }
}

/* ===========================
   MESSAGE PASSING
   =========================== */

/**
 * Send message to content script in active tab
 * @param {Object} message - Message to send
 * @param {number} timeout - Timeout in milliseconds
 * @returns {Promise<Object>} Response from content script
 */
async function sendToContentScript(message, timeout = MESSAGE_TIMEOUT) {
  try {
    // Get active tab
    const tab = await getCurrentTab();

    if (!tab) {
      throw new Error('No active tab found');
    }

    // Send message with timeout
    return await Promise.race([
      new Promise((resolve, reject) => {
        chrome.tabs.sendMessage(tab.id, message, (response) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve(response);
          }
        });
      }),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Message timeout')), timeout)
      )
    ]);

  } catch (error) {
    logger.error('Failed to send message to content script:', error);
    throw error;
  }
}

/**
 * Get current active tab
 * @returns {Promise<Object>} Tab object
 */
async function getCurrentTab() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    return tab;
  } catch (error) {
    logger.error('Failed to get current tab:', error);
    return null;
  }
}

/* ===========================
   UTILITY FUNCTIONS
   =========================== */

/**
 * Format error message for user display
 * @param {Error|string} error - Error object or message
 * @returns {string} User-friendly error message
 */
function formatErrorMessage(error) {
  const message = error.message || String(error);

  // Handle common error types
  if (message.includes('timeout')) {
    return 'Request timed out. Please try again.';
  }

  if (message.includes('No active tab')) {
    return 'Could not find active tab. Please refresh and try again.';
  }

  if (message.includes('Could not establish connection')) {
    return 'Could not connect to the page. Please refresh and try again.';
  }

  if (message.includes('rate limit')) {
    return 'API rate limit reached. Please wait a moment and try again.';
  }

  // Default: return the error message (sanitized)
  return message.substring(0, 200); // Limit length
}

/**
 * Show error message
 * @param {string} message - Error message
 */
function showError(message) {
  logger.error(message);
  alert(message); // Simple alert for critical errors
}

/* ===========================
   INITIALIZATION COMPLETE
   =========================== */

logger.debug('Popup script loaded');
