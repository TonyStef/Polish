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
let viewMode = 'desktop'; // 'desktop' or 'phone'
let apiKey = null;
let phoneModeWrapper = null; // Wrapper div for phone mode

// Versioning state
let currentProjectId = null; // Current project ID
let currentProjectName = 'new_project'; // Current project name
let initialHTML = null; // Initial HTML state for discard functionality
let isProjectSaved = false; // Whether current project is saved
let currentUrl = null; // Current website URL (normalized)

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
  chatMessages: null,
  floatingApiKeyOverlay: null,
  floatingApiKeyInput: null,
  floatingSaveApiKeyBtn: null,
  floatingApiKeyStatus: null,
  floatingNotification: null,
  deselectElementBtn: null,
  viewModeToggleBtn: null,
  settingsOverlay: null,
  settingsApiKeyInput: null,
  settingsSaveApiKeyBtn: null,
  settingsApiKeyStatus: null,
  projectSelectorBtn: null,
  versionsOverlay: null,
  deleteOverlay: null,
  projectNameInput: null,
  projectsList: null
};

/**
 * Initialize the content script
 */
function init() {
  console.log('Polish content script initialized');

  // Set up message listener FIRST so it's ready immediately
  chrome.runtime.onMessage.addListener(handleMessage);

  // Create overlay element for highlighting
  createOverlay();

  // Inject persistent overlay (async, but listener is already set up)
  injectOverlay();

  // Initialize versioning system
  initializeVersioning();

  // Load API key (async)
  loadApiKey();

  // Add scroll/resize listeners to keep selected element highlighted
  window.addEventListener('scroll', updateSelectedElementHighlight, true);
  window.addEventListener('resize', updateSelectedElementHighlight);
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
        <button id="polish-settings-btn" class="polish-btn polish-btn-text" title="Settings">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="8" cy="8" r="3" stroke="currentColor" stroke-width="1.5" fill="none"/>
            <path d="M8 3v2M8 11v2M3 8h2M11 8h2M4.343 4.343l1.414 1.414M10.243 10.243l1.414 1.414M11.657 4.343l-1.414 1.414M5.757 10.243l-1.414 1.414" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          </svg>
          Settings
        </button>
      </div>
      <div class="polish-top-bar-center">
        <button id="polish-back-btn" class="polish-btn polish-btn-icon" title="Back">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M10 12L6 8l4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
        <button id="polish-forward-btn" class="polish-btn polish-btn-icon" title="Forward">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M6 12l4-4-4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
        <button id="polish-project-selector-btn" class="polish-project-selector-btn" title="Select Project">
          <span id="polish-project-name-display">new_project</span>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
        <button id="polish-view-mode-toggle" class="polish-btn polish-btn-icon" title="Toggle Phone/Desktop View">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
            <!-- Desktop icon (larger horizontal) -->
            <rect x="2" y="4" width="8" height="6" rx="1" stroke="currentColor" stroke-width="1.5" fill="none"/>
            <line x1="3" y1="6" x2="9" y2="6" stroke="currentColor" stroke-width="1"/>
            <!-- Phone icon (smaller vertical, overlapping) -->
            <rect x="8" y="6" width="6" height="8" rx="1" stroke="currentColor" stroke-width="1.5" fill="none"/>
            <line x1="9.5" y1="8" x2="12.5" y2="8" stroke="currentColor" stroke-width="0.5"/>
          </svg>
        </button>
      </div>
      <div class="polish-top-bar-right">
        <button id="polish-discard-btn" class="polish-btn polish-btn-text polish-btn-danger">Discard</button>
        <button id="polish-save-btn" class="polish-btn polish-btn-text polish-btn-primary">Save</button>
        <button id="polish-publish-btn" class="polish-btn polish-btn-text polish-btn-primary">Publish</button>
      </div>
    </div>
    <div id="polish-container" class="polish-container">
      <div id="polish-chat-panel" class="polish-chat-panel">
        <div id="polish-chat-messages" class="polish-chat-messages"></div>
        <div class="polish-chat-input-area">
          <div id="polish-selected-element-info" class="polish-selected-element-info hidden">
            <span>Selected element: &lt;<span id="polish-selected-element-tag"></span>&gt;</span>
            <button id="polish-deselect-element-btn" class="polish-deselect-btn" title="Deselect element">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 4L4 12M4 4l8 8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
              </svg>
            </button>
          </div>
          <div class="polish-mode-buttons">
            <button id="polish-edit-btn" class="polish-mode-btn polish-mode-btn-active" title="Edit Mode">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M11.333 2a1.414 1.414 0 012 2L6 11.333l-3.333 1L4 9l7.333-7.333z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
              Edit
            </button>
            <button id="polish-chat-btn" class="polish-mode-btn" title="Chat Mode">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M5.333 12H4a2 2 0 01-2-2V4a2 2 0 012-2h8a2 2 0 012 2v1.333" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M6 10l5.333-5.333a1.414 1.414 0 012 2L8 12l-2 1 1-3z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
              Chat
            </button>
          </div>
          <div class="polish-input-wrapper">
            <textarea id="polish-modification-input" class="polish-modification-input" placeholder="Ask Polish..." rows="1"></textarea>
            <button id="polish-send-btn" class="polish-send-btn" title="Send">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M14 2L7 9M14 2l-5 12-2-5-5-2 12-5z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </button>
          </div>
          <div class="polish-share-feedback">
            <a href="https://forms.gle/5pX4CB1u2VVsCi1n7" target="_blank" id="polish-share-feedback-link" class="polish-link">Share Feedback</a>
          </div>
        </div>
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
  elements.deselectElementBtn = document.getElementById('polish-deselect-element-btn');
  elements.chatMessages = document.getElementById('polish-chat-messages');
  elements.viewModeToggleBtn = document.getElementById('polish-view-mode-toggle');
  elements.projectSelectorBtn = document.getElementById('polish-project-selector-btn');
  
  // Create floating API key overlay (not in HTML, created dynamically)
  createFloatingApiKeyOverlay();
  
  // Create floating notification system (not in HTML, created dynamically)
  createFloatingNotification();
  
  // Create settings overlay (not in HTML, created dynamically)
  createSettingsOverlay();
  
  // Create versions overlay (not in HTML, created dynamically)
  createVersionsOverlay();
  
  // Create delete overlay (not in HTML, created dynamically)
  createDeleteOverlay();
  
  // Initialize view mode button state
  if (elements.viewModeToggleBtn) {
    updateViewModeButton();
  }
}

/**
 * Normalize URL for storage key (remove hash, trailing slash, etc.)
 */
function normalizeUrl(url) {
  try {
    const urlObj = new URL(url);
    return `${urlObj.protocol}//${urlObj.host}${urlObj.pathname}`.replace(/\/$/, '');
  } catch (e) {
    return url.split('#')[0].split('?')[0].replace(/\/$/, '');
  }
}

/**
 * Initialize versioning system - store initial HTML and load projects
 */
async function initializeVersioning() {
  // Normalize current URL
  currentUrl = normalizeUrl(window.location.href);
  
  // Store initial HTML state (only once per page load)
  if (!initialHTML) {
    initialHTML = document.documentElement.outerHTML;
  }
  
  // Load projects for this URL
  await loadProjectsForUrl();
  
  // Update project name display
  updateProjectNameDisplay();
}

/**
 * Load projects for current URL
 */
async function loadProjectsForUrl() {
  return new Promise((resolve) => {
    const storageKey = `polish_projects_${currentUrl}`;
    chrome.storage.local.get([storageKey], (result) => {
      const projects = result[storageKey] || [];
      
      // If no projects exist, create default "new_project" (unsaved)
      if (projects.length === 0) {
        currentProjectId = null;
        currentProjectName = 'new_project';
        isProjectSaved = false;
      } else {
        // Load first project by default (or find active one)
        const firstProject = projects[0];
        currentProjectId = firstProject.id;
        currentProjectName = firstProject.name;
        isProjectSaved = true;
        
        // Load the project's HTML state
        loadProjectHTML(firstProject);
      }
      
      resolve();
    });
  });
}

/**
 * Load project HTML state
 */
function loadProjectHTML(project) {
  if (project && project.html) {
    try {
      // Save current HTML before switching (if needed for future undo)
      // Restore HTML state
      document.documentElement.outerHTML = project.html;
      
      // Store the loaded HTML as the new "initial" state for this project
      // (so discard works from this project's saved state)
      // But keep the true initial HTML for the page
      
      // Clear selection when switching projects
      selectedElement = null;
      
      // Re-initialize after HTML change
      setTimeout(() => {
        injectOverlay();
        setupOverlayEventListeners();
        
        // Re-cache elements that might have been lost
        cacheOverlayElements();
        
        // Clear any highlights
        if (overlayElement) {
          overlayElement.style.display = 'none';
        }
        
        // Update UI
        updateElementInfo(null, null);
        updateUIForState();
      }, 100);
    } catch (error) {
      console.error('Failed to load project HTML:', error);
    }
  }
}

/**
 * Update project name display
 */
function updateProjectNameDisplay() {
  const display = document.getElementById('polish-project-name-display');
  if (display) {
    display.textContent = currentProjectName;
  }
}

/**
 * Set up event listeners for overlay UI
 */
function setupOverlayEventListeners() {
  // Close button
  if (elements.closeBtn) {
    elements.closeBtn.addEventListener('click', handleClose);
  }

  // Settings button
  if (elements.settingsBtn) {
    elements.settingsBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      toggleSettingsOverlay();
    });
  }
  
  // Close settings overlay when clicking outside
  document.addEventListener('click', (e) => {
    if (elements.settingsOverlay && elements.settingsOverlay.classList.contains('active')) {
      if (!elements.settingsOverlay.contains(e.target) && !elements.settingsBtn.contains(e.target)) {
        hideSettingsOverlay();
      }
    }
  });

  // Share Feedback link opens the form in a new tab - no handler needed as it's a regular link

  // Project selector button
  if (elements.projectSelectorBtn) {
    elements.projectSelectorBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      toggleVersionsOverlay();
    });
  }

  // Discard button - revert to initial state
  if (elements.discardBtn) {
    elements.discardBtn.addEventListener('click', (e) => {
      e.preventDefault();
      handleDiscard();
    });
  }

  // Save button - save current state to project
  if (elements.saveBtn) {
    elements.saveBtn.addEventListener('click', (e) => {
      e.preventDefault();
      handleSaveProject();
    });
  }

  // Publish button - placeholder (no functionality)
  if (elements.publishBtn) {
    elements.publishBtn.addEventListener('click', (e) => {
      e.preventDefault();
      console.log('Publish clicked (placeholder - no functionality)');
    });
  }
  
  // Close versions overlay when clicking outside
  document.addEventListener('click', (e) => {
    // Close delete overlay if clicking outside
    if (elements.deleteOverlay && !elements.deleteOverlay.classList.contains('hidden')) {
      if (!elements.deleteOverlay.contains(e.target) && 
          !e.target.closest('.polish-project-item-menu')) {
        hideDeleteOverlay();
      }
    }
    
    // Close versions overlay if clicking outside
    if (elements.versionsOverlay && elements.versionsOverlay.classList.contains('active')) {
      if (!elements.versionsOverlay.contains(e.target) && 
          !elements.projectSelectorBtn.contains(e.target) &&
          (!elements.deleteOverlay || !elements.deleteOverlay.contains(e.target))) {
        hideVersionsOverlay();
      }
    }
  });

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
  
  // Deselect element button
  if (elements.deselectElementBtn) {
    elements.deselectElementBtn.addEventListener('click', handleDeselectElement);
  }

  // View mode toggle button (Phone/Desktop)
  if (elements.viewModeToggleBtn) {
    elements.viewModeToggleBtn.addEventListener('click', handleToggleViewMode);
  }

  if (elements.sendBtn) {
    elements.sendBtn.addEventListener('click', handleSend);
  }

  // API Key (legacy - kept for compatibility, but floating overlay is primary)
  if (elements.saveApiKeyBtn) {
    elements.saveApiKeyBtn.addEventListener('click', handleSaveApiKey);
  }

  // Keyboard shortcuts
  if (elements.modificationInput) {
    elements.modificationInput.addEventListener('keydown', (e) => {
      // Allow Enter to submit (with Ctrl/Cmd) or just Enter if element is selected
      if (e.key === 'Enter') {
        if (e.ctrlKey || e.metaKey || selectedElement) {
          e.preventDefault();
          handleSend();
        }
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
  document.documentElement.classList.add('polish-overlay-active');
  document.body.classList.add('polish-overlay-active');
  
  // Apply current view mode
  applyViewMode();
  updateViewModeButton();
  
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
  document.documentElement.classList.remove('polish-overlay-active');
  document.body.classList.remove('polish-overlay-active');
  
  // Remove phone mode wrapper if active
  removePhoneModeWrapper();
  
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
 * Handle Edit mode button - toggle mode
 */
function handleEditMode() {
  // If already active, deselect it
  if (currentMode === 'edit') {
    currentMode = null;
    elements.editBtn.classList.remove('polish-mode-btn-active');
    
    // Deselect element if selected
    if (selectedElement) {
      selectedElement = null;
      hideOverlay();
      updateElementInfo(null, null);
    }
    
    // Disable selection mode
    if (isSelectionMode) {
      toggleSelectionMode();
    }
    
    updateUIForState();
    return;
  }
  
  // Activate edit mode
  currentMode = 'edit';
  elements.editBtn.classList.add('polish-mode-btn-active');
  elements.chatBtn.classList.remove('polish-mode-btn-active');
  
  // If no element is selected, enable selection mode
  if (!selectedElement) {
    if (!isSelectionMode) {
      toggleSelectionMode();
    }
  }
  
  // Update UI
  if (apiKey) {
    updateUIForState();
  }
}

/**
 * Handle Chat mode button - toggle mode (placeholder - not fully implemented)
 */
function handleChatMode() {
  // If already active, deselect it
  if (currentMode === 'chat') {
    currentMode = null;
    elements.chatBtn.classList.remove('polish-mode-btn-active');
    updateUIForState();
    return;
  }
  
  // Activate chat mode
  currentMode = 'chat';
  elements.chatBtn.classList.add('polish-mode-btn-active');
  elements.editBtn.classList.remove('polish-mode-btn-active');
  
  // Deselect element if selected
  if (selectedElement) {
    selectedElement = null;
    hideOverlay();
    updateElementInfo(null, null);
  }
  
  // Disable selection mode if active
  if (isSelectionMode) {
    toggleSelectionMode();
  }
  
  console.log('Chat mode activated (not fully implemented yet)');
  updateUIForState();
}

/**
 * Handle deselect element button
 */
function handleDeselectElement() {
  selectedElement = null;
  hideOverlay();
  updateElementInfo(null, null);
  
  // Exit edit mode
  currentMode = null;
  elements.editBtn.classList.remove('polish-mode-btn-active');
  
  // Disable selection mode
  if (isSelectionMode) {
    toggleSelectionMode();
  }
  
  updateUIForState();
}

/**
 * Handle view mode toggle (Phone/Desktop)
 */
function handleToggleViewMode() {
  viewMode = viewMode === 'desktop' ? 'phone' : 'desktop';
  applyViewMode();
  updateViewModeButton();
}

/**
 * Apply current view mode to the website preview
 */
function applyViewMode() {
  if (!document.body.classList.contains('polish-overlay-active')) {
    return; // Only apply when overlay is active
  }

  if (viewMode === 'phone') {
    document.body.classList.add('polish-phone-mode');
    document.body.classList.remove('polish-desktop-mode');
    createPhoneModeWrapper();
  } else {
    document.body.classList.add('polish-desktop-mode');
    document.body.classList.remove('polish-phone-mode');
    removePhoneModeWrapper();
  }
}

/**
 * Create wrapper div for phone mode to constrain website content
 */
function createPhoneModeWrapper() {
  if (phoneModeWrapper) return; // Already exists
  
  // Create wrapper div
  phoneModeWrapper = document.createElement('div');
  phoneModeWrapper.id = 'polish-phone-wrapper';
  phoneModeWrapper.setAttribute('data-polish-extension', 'true');
  phoneModeWrapper.style.cssText = `
    width: 375px;
    max-width: 375px;
    margin: 0;
    position: relative;
    background: inherit;
    min-height: 100%;
  `;
  
  // Move all body children into wrapper (except our extension elements)
  const children = Array.from(document.body.children).filter(child => 
    !child.hasAttribute('data-polish-extension') && child.id !== 'polish-overlay-wrapper'
  );
  
  children.forEach(child => {
    phoneModeWrapper.appendChild(child);
  });
  
  // Insert wrapper as first child of body
  document.body.insertBefore(phoneModeWrapper, document.body.firstChild);
}

/**
 * Remove phone mode wrapper and restore original structure
 */
function removePhoneModeWrapper() {
  if (!phoneModeWrapper) return;
  
  // Move all wrapper children back to body
  const children = Array.from(phoneModeWrapper.children);
  children.forEach(child => {
    document.body.insertBefore(child, phoneModeWrapper);
  });
  
  // Remove wrapper
  phoneModeWrapper.remove();
  phoneModeWrapper = null;
}

/**
 * Update view mode button visual state
 */
function updateViewModeButton() {
  if (!elements.viewModeToggleBtn) return;
  
  if (viewMode === 'phone') {
    elements.viewModeToggleBtn.classList.add('polish-view-mode-active');
    elements.viewModeToggleBtn.title = 'Switch to Desktop View';
  } else {
    elements.viewModeToggleBtn.classList.remove('polish-view-mode-active');
    elements.viewModeToggleBtn.title = 'Switch to Phone View';
  }
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
  const apiKeyValue = (elements.settingsApiKeyInput || elements.floatingApiKeyInput || elements.apiKeyInput)?.value.trim();
  const statusElement = elements.settingsApiKeyStatus || elements.floatingApiKeyStatus;
  
  if (!apiKeyValue || apiKeyValue.length < 20 || !apiKeyValue.startsWith('sk-ant-')) {
    const errorMsg = 'Invalid API key format. Must start with "sk-ant-" and be at least 20 characters.';
    if (statusElement) {
      showSettingsApiKeyStatus(errorMsg, 'error');
    } else {
      showFloatingApiKeyStatus(errorMsg, 'error');
    }
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
    const successMsg = 'API key saved successfully!';
    if (statusElement) {
      showSettingsApiKeyStatus(successMsg, 'success');
    } else {
      showFloatingApiKeyStatus(successMsg, 'success');
    }
    showNotification(successMsg, 'success');
    
    setTimeout(() => {
      hideApiKeySection();
      if (elements.settingsOverlay && elements.settingsOverlay.classList.contains('active')) {
        // Keep settings open, just update UI
        updateUIForState();
      } else {
        updateUIForState();
      }
    }, 1000);
  } catch (error) {
    console.error('Failed to save API key:', error);
    const errorMsg = 'Failed to save API key. Please try again.';
    if (statusElement) {
      showSettingsApiKeyStatus(errorMsg, 'error');
    } else {
      showFloatingApiKeyStatus(errorMsg, 'error');
    }
  }
}

/**
 * Show floating API key status
 */
function showFloatingApiKeyStatus(message, type) {
  if (!elements.floatingApiKeyStatus) return;
  
  elements.floatingApiKeyStatus.textContent = message;
  elements.floatingApiKeyStatus.className = `polish-status status-${type}`;
  elements.floatingApiKeyStatus.classList.remove('hidden');
  
  if (type === 'success') {
    setTimeout(() => {
      elements.floatingApiKeyStatus.classList.add('hidden');
    }, 3000);
  }
}

/**
 * Show API key section (floating overlay)
 */
function showApiKeySection() {
  if (elements.floatingApiKeyOverlay) {
    elements.floatingApiKeyOverlay.classList.remove('hidden');
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
  if (elements.floatingApiKeyOverlay) {
    elements.floatingApiKeyOverlay.classList.add('hidden');
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
    if (!isSelectionMode) {
      toggleSelectionMode();
    }
    showModificationStatus('Selection mode enabled - Click an element on the page to select it.', 'loading');
    elements.modificationInput.placeholder = 'Select a web element...';
    elements.modificationInput.disabled = true;
    return;
  }

  // In edit mode, require element selection
  if (currentMode === 'edit' && !selectedElement) {
    showModificationStatus('Please select an element first by clicking on it.', 'error');
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
      
      // Clear selection after successful modification
      selectedElement = null;
      hideOverlay();
      updateElementInfo(null, null);
      
      setTimeout(() => {
        showModificationStatus('', '');
        elements.modificationStatus.classList.add('hidden');
        updateUIForState();
      }, 3000);
    } else {
      throw new Error(response?.error || 'Modification failed');
    }
  } catch (error) {
    console.error('Send failed:', error);
    // Extract meaningful error message
    let errorMessage = error.message || 'Failed to process request';
    if (errorMessage.includes('CORS')) {
      errorMessage = 'API Error: Please check your API key and permissions';
    }
    showModificationStatus(errorMessage, 'error');
    // Re-enable input on error, keep selection if it exists
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
    // Element is selected - show info and enable input
    elements.selectedElementInfo.classList.remove('hidden');
    elements.modificationInput.disabled = false;
    elements.sendBtn.disabled = false;
    elements.modificationInput.placeholder = 'Ask Polish...';
    // Keep the selected element highlighted
    highlightElement(selectedElement, true);
  } else {
    // No element selected
    elements.selectedElementInfo.classList.add('hidden');
    if (currentMode === 'edit') {
      // In edit mode but no selection - user needs to select first
      elements.modificationInput.disabled = true;
      elements.modificationInput.placeholder = 'Select a web element...';
      elements.sendBtn.disabled = false; // Can click send to enable selection mode
    } else {
      // In chat mode - allow free text
      elements.modificationInput.disabled = false;
      elements.modificationInput.placeholder = 'Ask Polish...';
      elements.sendBtn.disabled = false;
    }
  }
}

/**
 * Show modification status (using floating notification)
 */
function showModificationStatus(message, type) {
  if (!message) {
    hideNotification();
    return;
  }
  
  showNotification(message, type);
}

/**
 * Update element info display (only show element type)
 */
function updateElementInfo(tagName, selector) {
  if (elements.selectedElementTag) {
    elements.selectedElementTag.textContent = tagName || '';
  }
  
  // Show/hide selected element info bar
  if (tagName && elements.selectedElementInfo) {
    elements.selectedElementInfo.classList.remove('hidden');
  } else if (elements.selectedElementInfo) {
    elements.selectedElementInfo.classList.add('hidden');
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
  
  // Don't hide overlay if we have a selected element - keep it highlighted
  if (!selectedElement) {
    hideOverlay();
  }
  
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

  // Don't select overlay elements
  if (element.hasAttribute('data-polish-extension') || 
      element.closest('#polish-overlay-wrapper')) {
    return;
  }

  if (!isSafeToModify(element)) {
    showNotification('Cannot modify this element', 'error');
    return;
  }

  selectedElement = element;
  console.log('Element selected:', element);

  // Keep the element highlighted (selected state)
  highlightElement(element, true);

  // Disable selection mode but keep the highlight
  disableSelectionMode();
  
  // Re-highlight to maintain the selected state
  highlightElement(selectedElement, true);

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
          // Clear selection after modification
          selectedElement = null;
          hideOverlay();
          updateElementInfo(null, null);
          // Exit edit mode
          currentMode = null;
          elements.editBtn.classList.remove('polish-mode-btn-active');
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
  overlayElement.style.position = 'fixed'; // Use fixed positioning for better accuracy
  overlayElement.style.top = `${rect.top}px`; // getBoundingClientRect() already gives viewport coordinates
  overlayElement.style.left = `${rect.left}px`;
  overlayElement.style.width = `${rect.width}px`;
  overlayElement.style.height = `${rect.height}px`;
  overlayElement.style.zIndex = '2147483646'; // Just below overlay wrapper
  overlayElement.style.pointerEvents = 'none'; // Allow clicks through highlight

  if (isSelected) {
    overlayElement.style.border = '3px solid #10b981';
    overlayElement.style.backgroundColor = 'rgba(16, 185, 129, 0.15)';
  } else {
    overlayElement.style.border = '2px solid #3b82f6';
    overlayElement.style.backgroundColor = 'rgba(59, 130, 246, 0.1)';
  }
}

/**
 * Update highlight position on scroll/resize (for selected elements)
 */
function updateSelectedElementHighlight() {
  if (selectedElement && overlayElement) {
    highlightElement(selectedElement, true);
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
 * Create floating API key overlay (centered on webpage preview)
 */
function createFloatingApiKeyOverlay() {
  if (document.getElementById('polish-floating-api-key-overlay')) return;
  
  const overlay = document.createElement('div');
  overlay.id = 'polish-floating-api-key-overlay';
  overlay.setAttribute('data-polish-extension', 'true');
  overlay.className = 'polish-floating-api-key-overlay hidden';
  
  overlay.innerHTML = `
    <div class="polish-floating-api-key-content">
      <h3>API Key Setup</h3>
      <p class="polish-help-text">Enter your Anthropic API key to get started:</p>
      <div class="polish-input-group">
        <input type="password" id="polish-floating-api-key-input" class="polish-input" placeholder="sk-ant-..." autocomplete="off" />
        <button id="polish-floating-save-api-key-btn" class="polish-btn polish-btn-primary">Save</button>
      </div>
      <div id="polish-floating-api-key-status" class="polish-status hidden"></div>
      <a href="https://console.anthropic.com/settings/keys" target="_blank" class="polish-link">Get your API key from Anthropic →</a>
    </div>
  `;
  
  document.body.appendChild(overlay);
  
  // Cache elements
  elements.floatingApiKeyOverlay = overlay;
  elements.floatingApiKeyInput = document.getElementById('polish-floating-api-key-input');
  elements.floatingSaveApiKeyBtn = document.getElementById('polish-floating-save-api-key-btn');
  elements.floatingApiKeyStatus = document.getElementById('polish-floating-api-key-status');
  
  // Set up event listeners
  if (elements.floatingSaveApiKeyBtn) {
    elements.floatingSaveApiKeyBtn.addEventListener('click', handleSaveApiKey);
  }
  if (elements.floatingApiKeyInput) {
    elements.floatingApiKeyInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleSaveApiKey();
      }
    });
  }
}

/**
 * Create floating notification system (top-center of webpage preview)
 */
function createFloatingNotification() {
  if (document.getElementById('polish-floating-notification')) return;
  
  const notification = document.createElement('div');
  notification.id = 'polish-floating-notification';
  notification.setAttribute('data-polish-extension', 'true');
  notification.className = 'polish-floating-notification hidden';
  
  document.body.appendChild(notification);
  elements.floatingNotification = notification;
}

/**
 * Show notification to user (using floating notification at top-center of webpage preview)
 */
function showNotification(message, type = 'info') {
  if (!elements.floatingNotification) {
    createFloatingNotification();
  }
  
  const notification = elements.floatingNotification;
  const bgColors = {
    info: '#3b82f6',
    success: '#10b981',
    error: '#ef4444',
    loading: '#f59e0b',
    warning: '#f59e0b'
  };

  notification.textContent = message;
  notification.className = `polish-floating-notification polish-notification-${type}`;
  notification.style.background = bgColors[type] || bgColors.info;
  notification.classList.remove('hidden');
  
  // Auto-hide after 3 seconds (unless it's loading)
  if (type !== 'loading') {
    setTimeout(() => {
      notification.classList.add('hidden');
    }, 3000);
  }
}

/**
 * Hide floating notification
 */
function hideNotification() {
  if (elements.floatingNotification) {
    elements.floatingNotification.classList.add('hidden');
  }
}

/**
 * Create settings overlay (positioned bottom-right of Settings button)
 */
function createSettingsOverlay() {
  if (document.getElementById('polish-settings-overlay')) return;
  
  const overlay = document.createElement('div');
  overlay.id = 'polish-settings-overlay';
  overlay.setAttribute('data-polish-extension', 'true');
  overlay.className = 'polish-settings-overlay hidden';
  
  overlay.innerHTML = `
    <div class="polish-settings-content">
      <div class="polish-settings-header">
        <h3>Settings</h3>
        <button id="polish-settings-close" class="polish-settings-close-btn" title="Close">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 4L4 12M4 4l8 8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          </svg>
        </button>
      </div>
      <div class="polish-settings-body">
        <div class="polish-settings-section">
          <label for="polish-settings-api-key-input" class="polish-settings-label">Anthropic API Key</label>
          <div class="polish-settings-input-group">
            <input 
              type="password" 
              id="polish-settings-api-key-input" 
              class="polish-settings-input" 
              placeholder="sk-ant-..."
            />
            <button id="polish-settings-save-api-key-btn" class="polish-btn polish-btn-primary polish-btn-text">
              Save
            </button>
          </div>
          <div id="polish-settings-api-key-status" class="polish-settings-status hidden"></div>
        </div>
      </div>
    </div>
  `;
  
  document.body.appendChild(overlay);
  elements.settingsOverlay = overlay;
  elements.settingsApiKeyInput = document.getElementById('polish-settings-api-key-input');
  elements.settingsSaveApiKeyBtn = document.getElementById('polish-settings-save-api-key-btn');
  elements.settingsApiKeyStatus = document.getElementById('polish-settings-api-key-status');
  
  // Event listeners
  const closeBtn = document.getElementById('polish-settings-close');
  if (closeBtn) {
    closeBtn.addEventListener('click', (e) => {
      e.preventDefault();
      hideSettingsOverlay();
    });
  }
  
  if (elements.settingsSaveApiKeyBtn) {
    elements.settingsSaveApiKeyBtn.addEventListener('click', (e) => {
      e.preventDefault();
      handleSaveApiKey();
    });
  }
  
  if (elements.settingsApiKeyInput) {
    elements.settingsApiKeyInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleSaveApiKey();
      }
    });
  }
}

/**
 * Show settings overlay (positioned bottom-right of Settings button)
 */
function showSettingsOverlay() {
  if (!elements.settingsOverlay || !elements.settingsBtn) return;
  
  // Get Settings button position
  const settingsBtnRect = elements.settingsBtn.getBoundingClientRect();
  const overlayWidth = 300; // Width of settings overlay
  const spacing = 8; // Spacing from button
  
  // Calculate position - align right edge of overlay with right edge of button
  let leftPosition = settingsBtnRect.right - overlayWidth;
  
  // Ensure overlay doesn't go off the left edge of screen
  if (leftPosition < 0) {
    leftPosition = spacing;
  }
  
  // Ensure overlay doesn't go off the right edge of screen
  if (leftPosition + overlayWidth > window.innerWidth) {
    leftPosition = window.innerWidth - overlayWidth - spacing;
  }
  
  // Position overlay below Settings button
  const topPosition = settingsBtnRect.bottom + spacing;
  
  // Ensure overlay doesn't go off the bottom of screen (if needed, position above button)
  const overlayHeight = 200; // Approximate height of settings overlay
  let finalTopPosition = topPosition;
  if (topPosition + overlayHeight > window.innerHeight) {
    finalTopPosition = settingsBtnRect.top - overlayHeight - spacing;
    // If still doesn't fit above, just position it and let it scroll
    if (finalTopPosition < 0) {
      finalTopPosition = topPosition;
    }
  }
  
  elements.settingsOverlay.style.top = `${finalTopPosition}px`;
  elements.settingsOverlay.style.left = `${leftPosition}px`;
  
  elements.settingsOverlay.classList.remove('hidden');
  elements.settingsOverlay.classList.add('active');
  
  // Clear input field (user can enter new API key)
  if (elements.settingsApiKeyInput) {
    elements.settingsApiKeyInput.value = '';
    elements.settingsApiKeyInput.placeholder = apiKey ? 'Enter new API key...' : 'sk-ant-...';
  }
  
  // Clear status message
  if (elements.settingsApiKeyStatus) {
    elements.settingsApiKeyStatus.classList.add('hidden');
  }
  
  // Focus input
  if (elements.settingsApiKeyInput) {
    setTimeout(() => {
      elements.settingsApiKeyInput.focus();
    }, 100);
  }
}

/**
 * Hide settings overlay
 */
function hideSettingsOverlay() {
  if (elements.settingsOverlay) {
    elements.settingsOverlay.classList.add('hidden');
    elements.settingsOverlay.classList.remove('active');
  }
}

/**
 * Toggle settings overlay
 */
function toggleSettingsOverlay() {
  if (elements.settingsOverlay && elements.settingsOverlay.classList.contains('active')) {
    hideSettingsOverlay();
  } else {
    showSettingsOverlay();
  }
}

/**
 * Show settings API key status
 */
function showSettingsApiKeyStatus(message, type) {
  if (!elements.settingsApiKeyStatus) return;
  
  elements.settingsApiKeyStatus.textContent = message;
  elements.settingsApiKeyStatus.className = `polish-settings-status status-${type}`;
  elements.settingsApiKeyStatus.classList.remove('hidden');
  
  if (type === 'success') {
    setTimeout(() => {
      elements.settingsApiKeyStatus.classList.add('hidden');
    }, 3000);
  }
}

/**
 * Create versions overlay (for project management)
 */
function createVersionsOverlay() {
  if (document.getElementById('polish-versions-overlay')) return;
  
  const overlay = document.createElement('div');
  overlay.id = 'polish-versions-overlay';
  overlay.setAttribute('data-polish-extension', 'true');
  overlay.className = 'polish-versions-overlay hidden';
  
  overlay.innerHTML = `
    <div class="polish-versions-content">
      <div class="polish-versions-header">
        <h3>Projects</h3>
        <button id="polish-versions-close" class="polish-versions-close-btn" title="Close">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 4L4 12M4 4l8 8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          </svg>
        </button>
      </div>
      <div class="polish-versions-body">
        <div class="polish-versions-current">
          <label for="polish-project-name-input" class="polish-versions-label">Current Project</label>
          <input 
            type="text" 
            id="polish-project-name-input" 
            class="polish-versions-input" 
            placeholder="Project name..."
          />
        </div>
        <div class="polish-versions-list-container">
          <div class="polish-versions-label" style="margin-bottom: 8px;">All Projects</div>
          <div id="polish-projects-list" class="polish-projects-list"></div>
        </div>
      </div>
    </div>
  `;
  
  document.body.appendChild(overlay);
  elements.versionsOverlay = overlay;
  elements.projectNameInput = document.getElementById('polish-project-name-input');
  elements.projectsList = document.getElementById('polish-projects-list');
  
  // Event listeners
  const closeBtn = document.getElementById('polish-versions-close');
  if (closeBtn) {
    closeBtn.addEventListener('click', (e) => {
      e.preventDefault();
      hideVersionsOverlay();
    });
  }
  
  if (elements.projectNameInput) {
    elements.projectNameInput.addEventListener('change', (e) => {
      const newName = e.target.value.trim();
      if (newName && newName !== currentProjectName) {
        currentProjectName = newName;
        updateProjectNameDisplay();
        // If project is saved, update its name in storage
        if (isProjectSaved && currentProjectId) {
          updateProjectName(currentProjectId, newName);
        }
      }
    });
    
    elements.projectNameInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.target.blur();
      }
    });
  }
}

/**
 * Show versions overlay
 */
function showVersionsOverlay() {
  if (!elements.versionsOverlay || !elements.projectSelectorBtn) return;
  
  const btnRect = elements.projectSelectorBtn.getBoundingClientRect();
  const overlayWidth = 320;
  const spacing = 8;
  
  let leftPosition = btnRect.right - overlayWidth;
  if (leftPosition < 0) leftPosition = spacing;
  if (leftPosition + overlayWidth > window.innerWidth) {
    leftPosition = window.innerWidth - overlayWidth - spacing;
  }
  
  const topPosition = btnRect.bottom + spacing;
  const overlayHeight = 400;
  let finalTop = topPosition;
  if (topPosition + overlayHeight > window.innerHeight) {
    finalTop = btnRect.top - overlayHeight - spacing;
    if (finalTop < 0) finalTop = topPosition;
  }
  
  elements.versionsOverlay.style.top = `${finalTop}px`;
  elements.versionsOverlay.style.left = `${leftPosition}px`;
  
  // Update current project name input
  if (elements.projectNameInput) {
    elements.projectNameInput.value = currentProjectName;
  }
  
  // Refresh projects list
  refreshProjectsList();
  
  elements.versionsOverlay.classList.remove('hidden');
  elements.versionsOverlay.classList.add('active');
}

/**
 * Hide versions overlay
 */
function hideVersionsOverlay() {
  if (elements.versionsOverlay) {
    elements.versionsOverlay.classList.add('hidden');
    elements.versionsOverlay.classList.remove('active');
  }
  hideDeleteOverlay();
}

/**
 * Toggle versions overlay
 */
function toggleVersionsOverlay() {
  if (elements.versionsOverlay && elements.versionsOverlay.classList.contains('active')) {
    hideVersionsOverlay();
  } else {
    showVersionsOverlay();
  }
}

/**
 * Refresh projects list in overlay
 */
async function refreshProjectsList() {
  if (!elements.projectsList) return;
  
  const storageKey = `polish_projects_${currentUrl}`;
  chrome.storage.local.get([storageKey], (result) => {
    const projects = result[storageKey] || [];
    
    elements.projectsList.innerHTML = '';
    
    if (projects.length === 0) {
      elements.projectsList.innerHTML = '<div class="polish-no-projects">No saved projects</div>';
      return;
    }
    
    projects.forEach(project => {
      const item = document.createElement('div');
      item.className = 'polish-project-item';
      if (project.id === currentProjectId) {
        item.classList.add('active');
      }
      
      item.innerHTML = `
        <span class="polish-project-item-name" data-project-id="${project.id}">${escapeHtml(project.name)}</span>
        <button class="polish-project-item-menu" data-project-id="${project.id}" title="Options">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="8" cy="4" r="1" fill="currentColor"/>
            <circle cx="8" cy="8" r="1" fill="currentColor"/>
            <circle cx="8" cy="12" r="1" fill="currentColor"/>
          </svg>
        </button>
      `;
      
      // Click handler to switch project
      const nameSpan = item.querySelector('.polish-project-item-name');
      nameSpan.addEventListener('click', () => {
        switchToProject(project.id);
      });
      
      // Menu button handler
      const menuBtn = item.querySelector('.polish-project-item-menu');
      menuBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        showDeleteOverlay(project.id, project.name, menuBtn);
      });
      
      elements.projectsList.appendChild(item);
    });
  });
}

/**
 * Switch to a different project
 */
async function switchToProject(projectId) {
  const storageKey = `polish_projects_${currentUrl}`;
  chrome.storage.local.get([storageKey], (result) => {
    const projects = result[storageKey] || [];
    const project = projects.find(p => p.id === projectId);
    
    if (project) {
      currentProjectId = project.id;
      currentProjectName = project.name;
      isProjectSaved = true;
      
      updateProjectNameDisplay();
      loadProjectHTML(project);
      hideVersionsOverlay();
      
      showNotification(`Switched to project: ${project.name}`, 'success');
    }
  });
}

/**
 * Update project name in storage
 */
async function updateProjectName(projectId, newName) {
  const storageKey = `polish_projects_${currentUrl}`;
  chrome.storage.local.get([storageKey], (result) => {
    const projects = result[storageKey] || [];
    const project = projects.find(p => p.id === projectId);
    
    if (project) {
      project.name = newName;
      project.updatedAt = Date.now();
      
      chrome.storage.local.set({ [storageKey]: projects }, () => {
        console.log('Project name updated');
      });
    }
  });
}

/**
 * Create delete overlay
 */
function createDeleteOverlay() {
  if (document.getElementById('polish-delete-overlay')) return;
  
  const overlay = document.createElement('div');
  overlay.id = 'polish-delete-overlay';
  overlay.setAttribute('data-polish-extension', 'true');
  overlay.className = 'polish-delete-overlay hidden';
  
  overlay.innerHTML = `
    <div class="polish-delete-content">
      <button class="polish-delete-btn" id="polish-delete-project-btn">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M5.5 4V2.5C5.5 1.67 6.17 1 7 1h2c.83 0 1.5.67 1.5 1.5V4M7 7.5v4M9 7.5v4M3 4h10l-1 10H4L3 4z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        Delete
      </button>
    </div>
  `;
  
  document.body.appendChild(overlay);
  elements.deleteOverlay = overlay;
  
  const deleteBtn = document.getElementById('polish-delete-project-btn');
  if (deleteBtn) {
    deleteBtn.addEventListener('click', () => {
      if (deleteTargetProjectId) {
        deleteProject(deleteTargetProjectId);
      }
    });
  }
}

let deleteTargetProjectId = null;

/**
 * Show delete overlay aligned to menu button
 */
function showDeleteOverlay(projectId, projectName, menuButton) {
  if (!elements.deleteOverlay || !menuButton) return;
  
  const btnRect = menuButton.getBoundingClientRect();
  
  elements.deleteOverlay.style.top = `${btnRect.top}px`;
  elements.deleteOverlay.style.left = `${btnRect.right + 8}px`;
  
  const deleteBtn = document.getElementById('polish-delete-project-btn');
  if (deleteBtn) {
    deleteBtn.setAttribute('data-project-id', projectId);
    deleteTargetProjectId = projectId;
  }
  
  elements.deleteOverlay.classList.remove('hidden');
}

/**
 * Hide delete overlay
 */
function hideDeleteOverlay() {
  if (elements.deleteOverlay) {
    elements.deleteOverlay.classList.add('hidden');
    deleteTargetProjectId = null;
  }
}

/**
 * Delete project
 */
async function deleteProject(projectId) {
  const storageKey = `polish_projects_${currentUrl}`;
  chrome.storage.local.get([storageKey], (result) => {
    const projects = result[storageKey] || [];
    const filtered = projects.filter(p => p.id !== projectId);
    
    chrome.storage.local.set({ [storageKey]: filtered }, () => {
      // If deleted project was current, switch to new_project
      if (currentProjectId === projectId) {
        currentProjectId = null;
        currentProjectName = 'new_project';
        isProjectSaved = false;
        updateProjectNameDisplay();
        
        // Revert to initial HTML
        if (initialHTML) {
          document.documentElement.outerHTML = initialHTML;
          setTimeout(() => {
            injectOverlay();
            setupOverlayEventListeners();
          }, 100);
        }
      }
      
      refreshProjectsList();
      hideDeleteOverlay();
      showNotification('Project deleted', 'success');
    });
  });
}

/**
 * Handle Save button - save current state to project
 */
async function handleSaveProject() {
  const currentHTML = document.documentElement.outerHTML;
  
  // Generate project ID if needed
  if (!currentProjectId) {
    currentProjectId = `project_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  const project = {
    id: currentProjectId,
    name: currentProjectName,
    html: currentHTML,
    createdAt: Date.now(),
    updatedAt: Date.now()
  };
  
  const storageKey = `polish_projects_${currentUrl}`;
  chrome.storage.local.get([storageKey], (result) => {
    const projects = result[storageKey] || [];
    
    // Update or add project
    const existingIndex = projects.findIndex(p => p.id === currentProjectId);
    if (existingIndex >= 0) {
      projects[existingIndex] = project;
    } else {
      projects.push(project);
    }
    
    chrome.storage.local.set({ [storageKey]: projects }, () => {
      isProjectSaved = true;
      showNotification(`Project "${currentProjectName}" saved`, 'success');
      console.log('Project saved');
    });
  });
}

/**
 * Handle Discard button - revert to initial state
 */
function handleDiscard() {
  if (!initialHTML) {
    showNotification('No initial state available', 'error');
    return;
  }
  
  // Revert to initial HTML
  document.documentElement.outerHTML = initialHTML;
  
  // Reset project state (but keep name)
  isProjectSaved = false;
  
  // Re-initialize overlay
  setTimeout(() => {
    injectOverlay();
    setupOverlayEventListeners();
    showNotification('Changes discarded', 'success');
  }, 100);
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
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

