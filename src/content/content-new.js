/**
 * Content Script - Persistent Overlay Version
 * Runs on all web pages to enable persistent overlay with element selection and modification
 */

let isSelectionMode = false;
let currentlyHighlightedElement = null;
let selectedElement = null;
let overlayElement = null;
let polishOverlayWrapper = null;
let isOverlayVisible = false;

// State management
let currentMode = 'edit'; // 'edit' or 'chat'
let apiKey = null;

// DOM elements cache
const elements = {
  overlayWrapper: null,
  closeBtn: null,
  settingsBtn: null,
  shareFeedbackLink: null,
  discardBtn: null,
  saveBtn: null,
  publishBtn: null,
  backBtn: null,
  forwardBtn: null,
  editBtn: null,
  chatBtn: null,
  sendBtn: null,
  modificationInput: null,
  apiKeySection: null,
  apiKeyInput: null,
  saveApiKeyBtn: null,
  apiKeyStatus: null,
  selectedElementInfo: null,
  selectedElementTag: null,
  selectedElementSelector: null,
  modificationStatus: null,
  chatMessages: null
};

/**
 * Initialize the content script
 */
function init() {
  console.log('Polish content script initialized');

  // Create overlay element for highlighting
  createOverlay();

  // Inject persistent overlay
  injectOverlay();

  // Load API key
  loadApiKey();

  // Listen for messages from popup/background
  chrome.runtime.onMessage.addListener(handleMessage);
}

/**
 * Load overlay HTML and inject it into the page
 */
async function injectOverlay() {
  // Check if overlay already exists
  if (document.getElementById('polish-overlay-wrapper')) {
    return;
  }

  // Create overlay structure manually (more reliable than fetching HTML)
  createOverlayManually();
}

/**
 * Fallback: Create overlay structure manually if fetch fails
 */
function createOverlayManually() {
  polishOverlayWrapper = document.createElement('div');
  polishOverlayWrapper.id = 'polish-overlay-wrapper';
  polishOverlayWrapper.setAttribute('data-polish-extension', 'true');
  
  // We'll use the HTML structure from overlay.html as a string
  const overlayHTML = `
    <div id="polish-top-bar" class="polish-top-bar">
      <div class="polish-top-bar-left">
        <button id="polish-close-btn" class="polish-btn polish-btn-text" title="Close">Close</button>
        <button id="polish-settings-btn" class="polish-btn polish-btn-icon" title="Settings">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 10a2 2 0 100-4 2 2 0 000 4z" stroke="currentColor" stroke-width="1.5"/></svg>
        </button>
      </div>
      <div class="polish-top-bar-center">
        <button id="polish-back-btn" class="polish-btn polish-btn-icon" title="Back">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M10 12L6 8l4-4" stroke="currentColor" stroke-width="1.5"/></svg>
        </button>
        <button id="polish-forward-btn" class="polish-btn polish-btn-icon" title="Forward">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M6 12l4-4-4-4" stroke="currentColor" stroke-width="1.5"/></svg>
        </button>
        <select id="polish-context-selector" class="polish-context-selector">
          <option>bloomreach-ai-boost</option>
        </select>
      </div>
      <div class="polish-top-bar-right">
        <button id="polish-discard-btn" class="polish-btn polish-btn-text polish-btn-danger">Discard</button>
        <button id="polish-save-btn" class="polish-btn polish-btn-text polish-btn-primary">Save</button>
        <button id="polish-publish-btn" class="polish-btn polish-btn-text polish-btn-primary">Publish</button>
      </div>
    </div>
    <div id="polish-container" class="polish-container">
      <div id="polish-chat-panel" class="polish-chat-panel">
        <div class="polish-chat-header"><h2>Polish</h2></div>
        <div id="polish-chat-messages" class="polish-chat-messages"></div>
        <div class="polish-chat-input-area">
          <div class="polish-mode-buttons">
            <button id="polish-edit-btn" class="polish-mode-btn polish-mode-btn-active">Edit</button>
            <button id="polish-chat-btn" class="polish-mode-btn">Chat</button>
          </div>
          <div class="polish-input-wrapper">
            <textarea id="polish-modification-input" class="polish-modification-input" placeholder="Ask Polish..." rows="1"></textarea>
            <button id="polish-send-btn" class="polish-send-btn" title="Send">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M14 2L7 9M14 2l-5 12-2-5-5-2 12-5z" stroke="currentColor" stroke-width="1.5"/></svg>
            </button>
          </div>
          <div class="polish-share-feedback">
            <a href="#" id="polish-share-feedback-link" class="polish-link">Share Feedback</a>
          </div>
        </div>
        <div id="polish-api-key-section" class="polish-api-key-section hidden">
          <h3>API Key Setup</h3>
          <p class="polish-help-text">Enter your Anthropic API key to get started:</p>
          <div class="polish-input-group">
            <input type="password" id="polish-api-key-input" class="polish-input" placeholder="sk-ant-..." autocomplete="off" />
            <button id="polish-save-api-key-btn" class="polish-btn polish-btn-primary">Save</button>
          </div>
          <div id="polish-api-key-status" class="polish-status hidden"></div>
          <a href="https://console.anthropic.com/settings/keys" target="_blank" class="polish-link">Get your API key from Anthropic →</a>
        </div>
        <div id="polish-selected-element-info" class="polish-selected-element-info hidden">
          <div class="polish-info-box">
            <p class="polish-info-label">Selected element:</p>
            <p class="polish-info-value">
              &lt;<span id="polish-selected-element-tag"></span>&gt;<br>
              <span id="polish-selected-element-selector"></span>
            </p>
          </div>
        </div>
        <div id="polish-modification-status" class="polish-status hidden"></div>
      </div>
      <div id="polish-content-area" class="polish-content-area"></div>
    </div>
  `;
  
  polishOverlayWrapper.innerHTML = overlayHTML;
  document.body.appendChild(polishOverlayWrapper);
  
  cacheOverlayElements();
  setupOverlayEventListeners();
  hideOverlayUI();
}

/**
 * Cache all overlay DOM elements
 */
function cacheOverlayElements() {
  elements.overlayWrapper = document.getElementById('polish-overlay-wrapper');
  elements.closeBtn = document.getElementById('polish-close-btn');
  elements.settingsBtn = document.getElementById('polish-settings-btn');
  elements.shareFeedbackLink = document.getElementById('polish-share-feedback-link');
  elements.discardBtn = document.getElementById('polish-discard-btn');
  elements.saveBtn = document.getElementById('polish-save-btn');
  elements.publishBtn = document.getElementById('polish-publish-btn');
  elements.backBtn = document.getElementById('polish-back-btn');
  elements.forwardBtn = document.getElementById('polish-forward-btn');
  elements.editBtn = document.getElementById('polish-edit-btn');
  elements.chatBtn = document.getElementById('polish-chat-btn');
  elements.sendBtn = document.getElementById('polish-send-btn');
  elements.modificationInput = document.getElementById('polish-modification-input');
  elements.apiKeySection = document.getElementById('polish-api-key-section');
  elements.apiKeyInput = document.getElementById('polish-api-key-input');
  elements.saveApiKeyBtn = document.getElementById('polish-save-api-key-btn');
  elements.apiKeyStatus = document.getElementById('polish-api-key-status');
  elements.selectedElementInfo = document.getElementById('polish-selected-element-info');
  elements.selectedElementTag = document.getElementById('polish-selected-element-tag');
  elements.selectedElementSelector = document.getElementById('polish-selected-element-selector');
  elements.modificationStatus = document.getElementById('polish-modification-status');
  elements.chatMessages = document.getElementById('polish-chat-messages');
}

/**
 * Set up event listeners for overlay UI
 */
function setupOverlayEventListeners() {
  // Close button
  if (elements.closeBtn) {
    elements.closeBtn.addEventListener('click', handleClose);
  }

  // Placeholder buttons (no functionality yet)
  if (elements.settingsBtn) {
    elements.settingsBtn.addEventListener('click', (e) => {
      e.preventDefault();
      console.log('Settings clicked (placeholder)');
    });
  }

  if (elements.shareFeedbackLink) {
    elements.shareFeedbackLink.addEventListener('click', (e) => {
      e.preventDefault();
      console.log('Share Feedback clicked (placeholder)');
    });
  }

  if (elements.discardBtn) {
    elements.discardBtn.addEventListener('click', (e) => {
      e.preventDefault();
      console.log('Discard clicked (placeholder)');
    });
  }

  if (elements.saveBtn) {
    elements.saveBtn.addEventListener('click', (e) => {
      e.preventDefault();
      console.log('Save clicked (placeholder)');
    });
  }

  if (elements.publishBtn) {
    elements.publishBtn.addEventListener('click', (e) => {
      e.preventDefault();
      console.log('Publish clicked (placeholder)');
    });
  }

  if (elements.backBtn) {
    elements.backBtn.addEventListener('click', (e) => {
      e.preventDefault();
      console.log('Back clicked (placeholder)');
    });
  }

  if (elements.forwardBtn) {
    elements.forwardBtn.addEventListener('click', (e) => {
      e.preventDefault();
      console.log('Forward clicked (placeholder)');
    });
  }

  // Functional buttons
  if (elements.editBtn) {
    elements.editBtn.addEventListener('click', handleEditMode);
  }

  if (elements.chatBtn) {
    elements.chatBtn.addEventListener('click', handleChatMode);
  }

  if (elements.sendBtn) {
    elements.sendBtn.addEventListener('click', handleSend);
  }

  // API Key
  if (elements.saveApiKeyBtn) {
    elements.saveApiKeyBtn.addEventListener('click', handleSaveApiKey);
  }

  // Keyboard shortcuts
  if (elements.modificationInput) {
    elements.modificationInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        handleSend();
      }
    });

    // Auto-resize textarea
    elements.modificationInput.addEventListener('input', () => {
      elements.modificationInput.style.height = 'auto';
      elements.modificationInput.style.height = Math.min(elements.modificationInput.scrollHeight, 120) + 'px';
    });
  }

  // Escape to close selection mode
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isSelectionMode) {
      toggleSelectionMode();
    }
  });
}

/**
 * Show overlay UI
 */
function showOverlayUI() {
  if (!elements.overlayWrapper) return;
  
  isOverlayVisible = true;
  elements.overlayWrapper.classList.add('active');
  document.body.classList.add('polish-overlay-active');
  
  // Check if API key exists, show appropriate UI
  if (!apiKey) {
    showApiKeySection();
  } else {
    hideApiKeySection();
    updateUIForState();
  }
}

/**
 * Hide overlay UI
 */
function hideOverlayUI() {
  if (!elements.overlayWrapper) return;
  
  isOverlayVisible = false;
  elements.overlayWrapper.classList.remove('active');
  document.body.classList.remove('polish-overlay-active');
  
  // Disable selection mode when hiding
  if (isSelectionMode) {
    toggleSelectionMode();
  }
}

/**
 * Toggle overlay visibility
 */
function toggleOverlay() {
  if (isOverlayVisible) {
    hideOverlayUI();
  } else {
    showOverlayUI();
  }
}

/**
 * Handle close button click
 */
function handleClose() {
  hideOverlayUI();
}

/**
 * Handle Edit mode button
 */
function handleEditMode() {
  if (currentMode === 'edit') return; // Already in edit mode
  
  currentMode = 'edit';
  elements.editBtn.classList.add('polish-mode-btn-active');
  elements.chatBtn.classList.remove('polish-mode-btn-active');
  
  // Enable element selection if needed
  if (apiKey) {
    // Selection will be enabled when user clicks to select
    updateUIForState();
  }
}

/**
 * Handle Chat mode button (placeholder - not fully implemented)
 */
function handleChatMode() {
  if (currentMode === 'chat') return; // Already in chat mode
  
  currentMode = 'chat';
  elements.chatBtn.classList.add('polish-mode-btn-active');
  elements.editBtn.classList.remove('polish-mode-btn-active');
  
  // Disable selection mode if active
  if (isSelectionMode) {
    toggleSelectionMode();
  }
  
  console.log('Chat mode activated (not fully implemented yet)');
}

/**
 * Load API key from storage
 */
async function loadApiKey() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['anthropicApiKey'], (result) => {
      if (result.anthropicApiKey) {
        apiKey = result.anthropicApiKey;
        console.log('API key loaded');
        resolve(true);
      } else {
        apiKey = null;
        resolve(false);
      }
    });
  });
}

/**
 * Handle save API key
 */
async function handleSaveApiKey() {
  const apiKeyValue = elements.apiKeyInput.value.trim();
  
  if (!apiKeyValue || apiKeyValue.length < 20 || !apiKeyValue.startsWith('sk-ant-')) {
    showApiKeyStatus('Invalid API key format. Must start with "sk-ant-" and be at least 20 characters.', 'error');
    return;
  }

  try {
    await new Promise((resolve, reject) => {
      chrome.storage.local.set({ anthropicApiKey: apiKeyValue }, () => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve();
        }
      });
    });

    apiKey = apiKeyValue;
    showApiKeyStatus('API key saved successfully!', 'success');
    
    setTimeout(() => {
      hideApiKeySection();
      updateUIForState();
    }, 1000);
  } catch (error) {
    console.error('Failed to save API key:', error);
    showApiKeyStatus('Failed to save API key. Please try again.', 'error');
  }
}

/**
 * Show API key section
 */
function showApiKeySection() {
  if (elements.apiKeySection) {
    elements.apiKeySection.classList.remove('hidden');
  }
  if (elements.modificationInput) {
    elements.modificationInput.disabled = true;
  }
  if (elements.sendBtn) {
    elements.sendBtn.disabled = true;
  }
}

/**
 * Hide API key section
 */
function hideApiKeySection() {
  if (elements.apiKeySection) {
    elements.apiKeySection.classList.add('hidden');
  }
}

/**
 * Show API key status message
 */
function showApiKeyStatus(message, type) {
  if (!elements.apiKeyStatus) return;
  
  elements.apiKeyStatus.textContent = message;
  elements.apiKeyStatus.className = `polish-status status-${type}`;
  elements.apiKeyStatus.classList.remove('hidden');
  
  if (type === 'success') {
    setTimeout(() => {
      elements.apiKeyStatus.classList.add('hidden');
    }, 3000);
  }
}

/**
 * Handle send button click
 */
async function handleSend() {
  if (!apiKey) {
    showApiKeySection();
    return;
  }

  const userRequest = elements.modificationInput.value.trim();
  
  if (!userRequest || userRequest.length < 3) {
    showModificationStatus('Please enter a request.', 'error');
    return;
  }

  // If in edit mode and no element selected, enable selection mode
  if (currentMode === 'edit' && !selectedElement) {
    toggleSelectionMode();
    showModificationStatus('Please select an element first.', 'error');
    return;
  }

  // Disable input during processing
  elements.modificationInput.disabled = true;
  elements.sendBtn.disabled = true;
  showModificationStatus('Processing your request...', 'loading');

  try {
    // Send modification request
    const response = await sendModificationRequest(userRequest);
    
    if (response && response.success) {
      showModificationStatus('Modifications applied successfully!', 'success');
      elements.modificationInput.value = '';
      
      // Clear selection
      selectedElement = null;
      hideOverlay();
      updateElementInfo(null, null);
      
      setTimeout(() => {
        showModificationStatus('', '');
        elements.modificationStatus.classList.add('hidden');
      }, 3000);
    } else {
      throw new Error(response?.error || 'Modification failed');
    }
  } catch (error) {
    console.error('Send failed:', error);
    showModificationStatus(error.message || 'Failed to process request', 'error');
  } finally {
    elements.modificationInput.disabled = false;
    elements.sendBtn.disabled = false;
    updateUIForState();
  }
}

/**
 * Send modification request
 */
async function sendModificationRequest(userRequest) {
  const elementContext = extractElementContext(selectedElement);
  
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(
      {
        type: 'MODIFY_ELEMENT',
        data: { userRequest, elementContext }
      },
      (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else if (response && response.success) {
          applyModifications({
            modifications: response.modifications,
            element: selectedElement
          });
          resolve(response);
        } else {
          reject(new Error(response?.error || 'Modification failed'));
        }
      }
    );
  });
}

/**
 * Update UI based on current state
 */
function updateUIForState() {
  if (!apiKey) {
    showApiKeySection();
    return;
  }

  hideApiKeySection();

  if (selectedElement) {
    elements.selectedElementInfo.classList.remove('hidden');
    elements.modificationInput.disabled = false;
    elements.sendBtn.disabled = false;
  } else {
    elements.selectedElementInfo.classList.add('hidden');
    if (currentMode === 'edit') {
      elements.modificationInput.disabled = true;
      elements.sendBtn.disabled = false; // Can still send to enable selection
    } else {
      elements.modificationInput.disabled = false;
      elements.sendBtn.disabled = false;
    }
  }
}

/**
 * Show modification status
 */
function showModificationStatus(message, type) {
  if (!elements.modificationStatus) return;
  
  if (!message) {
    elements.modificationStatus.classList.add('hidden');
    return;
  }
  
  elements.modificationStatus.textContent = message;
  elements.modificationStatus.className = `polish-status status-${type}`;
  elements.modificationStatus.classList.remove('hidden');
}

/**
 * Update element info display
 */
function updateElementInfo(tagName, selector) {
  if (elements.selectedElementTag) {
    elements.selectedElementTag.textContent = tagName || '';
  }
  if (elements.selectedElementSelector) {
    elements.selectedElementSelector.textContent = selector || '';
  }
}

/**
 * Handle messages from background/popup
 */
function handleMessage(message, sender, sendResponse) {
  console.log('Content script received message:', message.type);

  switch (message.type) {
    case 'TOGGLE_OVERLAY':
      toggleOverlay();
      sendResponse({ success: true, isVisible: isOverlayVisible });
      break;

    case 'TOGGLE_SELECTION_MODE':
      toggleSelectionMode();
      sendResponse({ success: true, isActive: isSelectionMode });
      break;

    case 'GET_SELECTION_STATUS':
      sendResponse({ success: true, isActive: isSelectionMode });
      break;

    case 'GET_SELECTED_ELEMENT_INFO':
      if (selectedElement) {
        sendResponse({
          success: true,
          hasSelection: true,
          selector: generateSelector(selectedElement),
          tagName: selectedElement.tagName.toLowerCase()
        });
      } else {
        sendResponse({ success: true, hasSelection: false });
      }
      break;

    case 'MODIFY_ELEMENT_REQUEST':
      handleModificationRequest(message.data, sendResponse);
      return true;

    default:
      sendResponse({ success: false, error: 'Unknown message type' });
  }

  return false;
}

/**
 * Toggle element selection mode on/off
 */
function toggleSelectionMode() {
  isSelectionMode = !isSelectionMode;

  if (isSelectionMode) {
    console.log('Selection mode activated');
    enableSelectionMode();
  } else {
    console.log('Selection mode deactivated');
    disableSelectionMode();
  }
}

/**
 * Enable selection mode - add event listeners
 */
function enableSelectionMode() {
  document.addEventListener('mouseover', handleMouseOver, true);
  document.addEventListener('mouseout', handleMouseOut, true);
  document.addEventListener('click', handleClick, true);

  document.body.style.cursor = 'crosshair';
  showNotification('Selection mode active - Click an element to select it');
}

/**
 * Disable selection mode - remove event listeners
 */
function disableSelectionMode() {
  document.removeEventListener('mouseover', handleMouseOver, true);
  document.removeEventListener('mouseout', handleMouseOut, true);
  document.removeEventListener('click', handleClick, true);

  document.body.style.cursor = '';
  hideOverlay();
  currentlyHighlightedElement = null;
}

/**
 * Handle mouse over - highlight element
 */
function handleMouseOver(event) {
  if (!isSelectionMode) return;

  event.preventDefault();
  event.stopPropagation();

  const element = event.target;

  if (element.hasAttribute('data-polish-extension')) {
    return;
  }

  if (!isSafeToModify(element)) {
    return;
  }

  currentlyHighlightedElement = element;
  highlightElement(element);
}

/**
 * Handle mouse out - remove highlight
 */
function handleMouseOut(event) {
  if (!isSelectionMode) return;

  event.preventDefault();
  event.stopPropagation();

  hideOverlay();
  currentlyHighlightedElement = null;
}

/**
 * Handle click - select element
 */
function handleClick(event) {
  if (!isSelectionMode) return;

  event.preventDefault();
  event.stopPropagation();

  const element = event.target;

  if (element.hasAttribute('data-polish-extension')) {
    return;
  }

  if (!isSafeToModify(element)) {
    showNotification('Cannot modify this element', 'error');
    return;
  }

  selectedElement = element;
  console.log('Element selected:', element);

  highlightElement(element, true);
  disableSelectionMode();

  updateElementInfo(
    selectedElement.tagName.toLowerCase(),
    generateSelector(selectedElement)
  );

  updateUIForState();
  showNotification('Element selected! Enter your modification request.');
}

/**
 * Handle modification request (legacy - kept for compatibility)
 */
async function handleModificationRequest(data, sendResponse) {
  const { userRequest } = data;

  if (!selectedElement) {
    sendResponse({
      success: false,
      error: 'No element selected. Please select an element first.'
    });
    return;
  }

  try {
    const elementContext = extractElementContext(selectedElement);
    showNotification('Processing your request...', 'loading');

    chrome.runtime.sendMessage(
      {
        type: 'MODIFY_ELEMENT',
        data: { userRequest, elementContext }
      },
      (response) => {
        if (chrome.runtime.lastError) {
          sendResponse({
            success: false,
            error: chrome.runtime.lastError.message
          });
          return;
        }

        if (response.success) {
          applyModifications({
            modifications: response.modifications,
            element: selectedElement
          });

          showNotification('Modifications applied!', 'success');
          selectedElement = null;
          hideOverlay();
          updateElementInfo(null, null);
          updateUIForState();

          sendResponse({
            success: true,
            explanation: response.modifications.explanation
          });
        } else {
          sendResponse({
            success: false,
            error: response.error
          });
        }
      }
    );
  } catch (error) {
    console.error('Error in handleModificationRequest:', error);
    sendResponse({
      success: false,
      error: error.message || 'Failed to process modification'
    });
  }
}

/**
 * Apply modifications to the selected element
 */
function applyModifications(data) {
  const { modifications, element } = data;

  if (!element || !modifications) {
    console.error('Invalid modification data');
    return;
  }

  try {
    if (modifications.css_changes) {
      applyCSSChanges(element, modifications.css_changes);
    }

    if (modifications.html_changes && modifications.html_changes.trim()) {
      applyHTMLChanges(element, modifications.html_changes);
    }

    console.log('Modifications applied successfully');
  } catch (error) {
    console.error('Failed to apply modifications:', error);
    showNotification('Failed to apply modifications', 'error');
  }
}

/**
 * Apply CSS changes to element
 */
function applyCSSChanges(element, cssChanges) {
  const cleanCSS = cssChanges.replace(/\/\*[\s\S]*?\*\//g, '');
  const rules = cleanCSS.split(';')
    .map(rule => rule.trim())
    .filter(rule => rule.length > 0);

  rules.forEach(rule => {
    const [property, value] = rule.split(':').map(s => s.trim());
    if (property && value) {
      try {
        element.style[property] = value;
      } catch (error) {
        console.warn(`Failed to apply CSS property ${property}: ${value}`, error);
      }
    }
  });
}

/**
 * Apply HTML changes to element
 */
function applyHTMLChanges(element, newHTML) {
  try {
    const sanitizedHTML = sanitizeHTML(newHTML);
    element.outerHTML = sanitizedHTML;
    console.log('HTML updated');
  } catch (error) {
    console.error('Failed to update HTML:', error);
    throw error;
  }
}

/**
 * Basic HTML sanitization (remove script tags)
 */
function sanitizeHTML(html) {
  const temp = document.createElement('div');
  temp.innerHTML = html;

  temp.querySelectorAll('script').forEach(script => script.remove());

  const allElements = temp.querySelectorAll('*');
  allElements.forEach(el => {
    Array.from(el.attributes).forEach(attr => {
      if (attr.name.startsWith('on')) {
        el.removeAttribute(attr.name);
      }
    });
  });

  return temp.innerHTML;
}

/**
 * Highlight an element with overlay
 */
function highlightElement(element, isSelected = false) {
  if (!overlayElement) return;

  const rect = element.getBoundingClientRect();

  overlayElement.style.display = 'block';
  overlayElement.style.top = `${rect.top + window.scrollY}px`;
  overlayElement.style.left = `${rect.left + window.scrollX}px`;
  overlayElement.style.width = `${rect.width}px`;
  overlayElement.style.height = `${rect.height}px`;

  if (isSelected) {
    overlayElement.style.border = '3px solid #10b981';
    overlayElement.style.backgroundColor = 'rgba(16, 185, 129, 0.1)';
  } else {
    overlayElement.style.border = '2px solid #3b82f6';
    overlayElement.style.backgroundColor = 'rgba(59, 130, 246, 0.1)';
  }
}

/**
 * Hide overlay
 */
function hideOverlay() {
  if (overlayElement) {
    overlayElement.style.display = 'none';
  }
}

/**
 * Create overlay element for highlighting
 */
function createOverlay() {
  overlayElement = document.createElement('div');
  overlayElement.setAttribute('data-polish-extension', 'true');
  overlayElement.className = 'polish-element-overlay';
  overlayElement.style.cssText = `
    position: absolute;
    pointer-events: none;
    z-index: 999999;
    display: none;
    box-sizing: border-box;
  `;

  document.body.appendChild(overlayElement);
}

/**
 * Show notification to user
 */
function showNotification(message, type = 'info') {
  const existing = document.querySelector('[data-polish-notification]');
  if (existing) {
    existing.remove();
  }

  const notification = document.createElement('div');
  notification.setAttribute('data-polish-notification', 'true');
  notification.setAttribute('data-polish-extension', 'true');

  const bgColors = {
    info: '#3b82f6',
    success: '#10b981',
    error: '#ef4444',
    loading: '#f59e0b'
  };

  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: ${bgColors[type] || bgColors.info};
    color: white;
    padding: 12px 20px;
    border-radius: 8px;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    z-index: 1000000;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    font-size: 14px;
    font-weight: 500;
    max-width: 300px;
    animation: slideIn 0.3s ease-out;
  `;

  notification.textContent = message;
  document.body.appendChild(notification);

  if (type !== 'loading') {
    setTimeout(() => {
      notification.style.animation = 'slideOut 0.3s ease-out';
      setTimeout(() => notification.remove(), 300);
    }, 3000);
  }
}

// ============================================================================
// DOM Utility Functions
// ============================================================================

function extractElementContext(element) {
  if (!element || !(element instanceof HTMLElement)) {
    throw new Error('Invalid element');
  }

  return {
    tagName: element.tagName.toLowerCase(),
    selector: generateSelector(element),
    html: getCleanHTML(element),
    computedStyles: getRelevantComputedStyles(element),
    cssRules: getApplicableCSSRules(element),
    classList: Array.from(element.classList),
    id: element.id || null
  };
}

function generateSelector(element) {
  if (element.id) {
    return `#${CSS.escape(element.id)}`;
  }

  const path = [];
  let current = element;

  while (current && current !== document.body) {
    let selector = current.tagName.toLowerCase();

    if (current.classList.length > 0) {
      selector += '.' + Array.from(current.classList).map(c => CSS.escape(c)).join('.');
    }

    if (current.parentElement) {
      const siblings = Array.from(current.parentElement.children);
      const index = siblings.indexOf(current);
      if (siblings.length > 1) {
        selector += `:nth-child(${index + 1})`;
      }
    }

    path.unshift(selector);
    current = current.parentElement;
  }

  return path.join(' > ');
}

function getCleanHTML(element, maxDepth = 3) {
  const clone = element.cloneNode(true);
  clone.querySelectorAll('script').forEach(script => script.remove());

  let html = clone.outerHTML;

  if (html.length > 5000) {
    html = html.substring(0, 5000) + '\n<!-- ... truncated ... -->';
  }

  return html;
}

function getRelevantComputedStyles(element) {
  const computed = window.getComputedStyle(element);

  const relevantProperties = [
    'display', 'position', 'width', 'height',
    'margin', 'padding', 'border', 'border-radius',
    'background', 'background-color', 'color',
    'font-family', 'font-size', 'font-weight', 'line-height',
    'text-align', 'flex', 'grid'
  ];

  const styles = {};

  relevantProperties.forEach(prop => {
    const value = computed.getPropertyValue(prop);
    if (value && value !== 'none' && value !== 'normal' && value !== 'auto') {
      styles[prop] = value;
    }
  });

  return styles;
}

function getApplicableCSSRules(element) {
  const rules = [];

  try {
    for (const sheet of document.styleSheets) {
      try {
        const cssRules = sheet.cssRules || sheet.rules;

        for (const rule of cssRules) {
          if (rule instanceof CSSStyleRule) {
            if (element.matches(rule.selectorText)) {
              rules.push(rule.cssText);
            }
          }
        }
      } catch (e) {
        continue;
      }
    }
  } catch (error) {
    console.warn('Could not access CSS rules:', error);
  }

  return rules.slice(0, 20).join('\n\n');
}

function isSafeToModify(element) {
  if (!element || !(element instanceof HTMLElement)) {
    return false;
  }

  const tagName = element.tagName.toLowerCase();
  const unsafeTags = ['html', 'head', 'body', 'script', 'style', 'iframe'];

  if (unsafeTags.includes(tagName)) {
    return false;
  }

  if (element.hasAttribute('data-polish-extension')) {
    return false;
  }

  return true;
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

