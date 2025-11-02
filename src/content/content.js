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
let currentMode = null; // 'edit', 'chat', or null (agent mode - default)
let viewMode = 'desktop'; // 'desktop' or 'phone'
let apiKey = null;
let phoneModeWrapper = null; // Wrapper div for phone mode
let phoneModeViewportWrapper = null; // Inner viewport wrapper for phone mode

// GitHub Integration State
const githubState = {
  token: null,
  repo: null,
  baseBranch: 'main',
  username: null,
  repoName: null,
  connected: false
};

// Storage keys for GitHub integration
const GITHUB_STORAGE_KEYS = {
  TOKEN: 'polish_github_token',
  REPO: 'polish_github_repo',
  BASE_BRANCH: 'polish_github_base_branch',
  USERNAME: 'polish_github_username',
  REPO_NAME: 'polish_github_repo_name',
  CONNECTED: 'polish_github_connected'
};

// Versioning state
let currentProjectId = null; // Current project ID
let currentProjectName = 'new_project'; // Current project name
let initialHTML = null; // Initial HTML state
let currentUrl = null; // Current website URL (normalized)
let currentVersionIndex = null; // Current version index within the project (null = latest version)

// Live Website constants
const LIVE_WEBSITE_ID = '_live_website_';
const LIVE_WEBSITE_NAME = 'Live Website';

// DOM elements cache
const elements = {
  overlayWrapper: null,
  closeBtn: null,
  settingsBtn: null,
  shareFeedbackLink: null,
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
async function init() {
  console.log('Polish content script initialized');

  // Don't initialize if we're inside the phone iframe (avoid duplicate overlays)
  if (window.frameElement && window.frameElement.hasAttribute('data-polish-phone-iframe')) {
    console.log('Skipping init - inside phone iframe');
    return;
  }

  // Set up message listener FIRST so it's ready immediately
  chrome.runtime.onMessage.addListener(handleMessage);

  // Create overlay element for highlighting (but don't inject UI yet)
  createOverlay();

  // Initialize versioning system and WAIT for it to complete
  // This will load any saved projects BEFORE we show the UI
  await initializeVersioning();

  // NOW inject persistent overlay (after projects are loaded)
  await injectOverlay();

  // Load API key (async, can happen in parallel)
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
            <button id="polish-edit-btn" class="polish-mode-btn" title="Edit Mode">
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
  // Clone and sanitize to exclude Polish UI elements
  if (!initialHTML) {
    const clonedDoc = document.documentElement.cloneNode(true);

    // Remove Polish extension elements from clone
    clonedDoc.querySelectorAll('[data-polish-extension="true"]').forEach(el => el.remove());
    const overlayWrapper = clonedDoc.querySelector('#polish-overlay-wrapper');
    if (overlayWrapper) {
      overlayWrapper.remove();
    }

    // Capture clean HTML
    initialHTML = clonedDoc.outerHTML;
  }
  
  // Ensure Live Website exists in storage
  await ensureLiveWebsiteExists();
  
  // Load projects for this URL
  await loadProjectsForUrl();
  
  // Update project name display
  updateProjectNameDisplay();
}

/**
 * Ensure Live Website record exists in storage
 */
async function ensureLiveWebsiteExists() {
  return new Promise((resolve) => {
    const storageKey = `polish_live_website_${currentUrl}`;
    chrome.storage.local.get([storageKey], (result) => {
      if (!result[storageKey]) {
        // Create Live Website record
        const liveWebsite = {
          html: initialHTML,
          savedAt: Date.now()
        };
        
        chrome.storage.local.set({ [storageKey]: liveWebsite }, () => {
          console.log('Live Website record created');
          resolve();
        });
      } else {
        resolve();
      }
    });
  });
}

/**
 * Check if project ID is Live Website
 */
function isLiveWebsite(projectId) {
  return projectId === LIVE_WEBSITE_ID;
}

/**
 * Get Live Website HTML from storage
 */
async function getLiveWebsiteHTML() {
  return new Promise((resolve) => {
    const storageKey = `polish_live_website_${currentUrl}`;
    chrome.storage.local.get([storageKey], (result) => {
      if (result[storageKey] && result[storageKey].html) {
        resolve(result[storageKey].html);
      } else {
        // Fallback to initialHTML if storage doesn't have it yet
        resolve(initialHTML);
      }
    });
  });
}

/**
 * Save active project ID for current URL
 */
async function saveActiveProject() {
  if (!currentUrl) return;
  
  // Don't save if currentProjectId is null (unsaved "new_project")
  // Only save when we have an actual project or Live Website
  if (currentProjectId === null) {
    return;
  }
  
  return new Promise((resolve) => {
    const storageKey = `polish_active_project_${currentUrl}`;
    const activeProjectData = {
      projectId: currentProjectId,
      projectName: currentProjectName,
      versionIndex: currentVersionIndex // Also save the current version index
    };
    
    chrome.storage.local.set({ [storageKey]: activeProjectData }, () => {
      if (chrome.runtime.lastError) {
        console.error('Failed to save active project:', chrome.runtime.lastError);
      } else {
        console.log(`Saved active project: ${currentProjectName} (${currentProjectId}), version: ${currentVersionIndex !== null ? currentVersionIndex : 'latest'}`);
      }
      resolve();
    });
  });
}

/**
 * Load active project ID for current URL
 */
async function loadActiveProject() {
  if (!currentUrl) return null;
  
  return new Promise((resolve) => {
    const storageKey = `polish_active_project_${currentUrl}`;
    chrome.storage.local.get([storageKey], (result) => {
      if (result[storageKey]) {
        resolve(result[storageKey]);
      } else {
        resolve(null);
      }
    });
  });
}

/**
 * Load projects for current URL
 */
async function loadProjectsForUrl() {
  return new Promise(async (resolve) => {
    const storageKey = `polish_projects_${currentUrl}`;
    chrome.storage.local.get([storageKey], async (result) => {
      const projects = result[storageKey] || [];
      
      // Try to load saved active project
      const savedActiveProject = await loadActiveProject();
      let projectToLoad = null;
      
      if (savedActiveProject && savedActiveProject.projectId) {
        // Check if saved project exists and is valid
        if (savedActiveProject.projectId === LIVE_WEBSITE_ID) {
          // Live Website - always available
          currentProjectId = LIVE_WEBSITE_ID;
          currentProjectName = LIVE_WEBSITE_NAME;
          currentVersionIndex = null;
          projectToLoad = 'live';
        } else {
          // Regular project - check if it exists
          const foundProject = projects.find(p => p.id === savedActiveProject.projectId);
          if (foundProject) {
            currentProjectId = foundProject.id;
            currentProjectName = foundProject.name;
            // Restore saved version index if available and valid
            if (savedActiveProject.versionIndex !== undefined && savedActiveProject.versionIndex !== null) {
              // Validate that the version index is within bounds
              if (foundProject.versions && foundProject.versions.length > 0) {
                const savedIndex = savedActiveProject.versionIndex;
                if (savedIndex >= 0 && savedIndex < foundProject.versions.length) {
                  currentVersionIndex = savedIndex;
                } else {
                  // Invalid index - default to latest
                  currentVersionIndex = null;
                }
              } else {
                currentVersionIndex = null;
              }
            } else {
              currentVersionIndex = null; // Show latest version if no saved index
            }
            projectToLoad = foundProject;
          }
        }
      }
      
      // If no saved active project or saved project doesn't exist, use defaults
      if (!projectToLoad) {
        if (projects.length === 0) {
          // No projects exist - default to "new_project"
          currentProjectId = null;
          currentProjectName = 'new_project';
          currentVersionIndex = null;
          // Don't load HTML - stay with initial state
          resolve();
          return;
        } else {
          // Load first project by default
          const firstProject = projects[0];
          currentProjectId = firstProject.id;
          currentProjectName = firstProject.name;
          currentVersionIndex = null;
          projectToLoad = firstProject;
        }
      }
      
      // Load the selected project
      if (projectToLoad === 'live') {
        // Load Live Website HTML
        getLiveWebsiteHTML().then(html => {
          if (html && html !== document.documentElement.outerHTML) {
            replaceBodyContentPreservingOverlay(html);
          }
          resolve();
        });
      } else if (projectToLoad && !isLiveWebsite(projectToLoad.id)) {
        // Load regular project HTML
        // If we have a saved version index, navigate to that specific version
        // Otherwise just load the project (which will load latest or specified version)
        if (currentVersionIndex !== null && projectToLoad.versions && projectToLoad.versions.length > 0) {
          // Navigate to the specific version (which will load HTML and chat history)
          navigateToVersion(projectToLoad, currentVersionIndex).then(() => {
            resolve();
          });
        } else {
          // Load project normally (latest version)
          loadProjectHTML(projectToLoad);
          resolve();
        }
      } else {
        resolve();
      }
    });
  });
}

/**
 * Surgically replace body content while preserving Polish overlay
 * This prevents destroying cached element references and event listeners
 * @param {string} newBodyHTML - The new body HTML content to insert
 */
function replaceBodyContentPreservingOverlay(newBodyHTML) {
  // Remove all body children EXCEPT Polish extension elements
  Array.from(document.body.children)
    .filter(child =>
      !child.hasAttribute('data-polish-extension') &&
      child.id !== 'polish-overlay-wrapper' &&
      child.id !== 'polish-phone-wrapper'
    )
    .forEach(child => child.remove());

  // Parse and insert new content
  const temp = document.createElement('div');
  temp.innerHTML = newBodyHTML;

  // Insert new content BEFORE overlay wrapper (keeps overlay at end)
  const overlayWrapper = document.getElementById('polish-overlay-wrapper');
  Array.from(temp.children).forEach(child => {
    if (overlayWrapper) {
      document.body.insertBefore(child, overlayWrapper);
    } else {
      document.body.appendChild(child);
    }
  });
}

/**
 * Load project HTML state
 */
function loadProjectHTML(project) {
  // Determine which HTML to load - use version if viewing specific version, otherwise latest
  let htmlToLoad = null;
  
  if (project.versions && project.versions.length > 0) {
    // Check if viewing a specific version
    if (currentVersionIndex !== null && currentVersionIndex >= 0 && currentVersionIndex < project.versions.length) {
      htmlToLoad = project.versions[currentVersionIndex].html;
    } else {
      // Load latest version
      const latestVersion = project.versions[project.versions.length - 1];
      htmlToLoad = latestVersion.html;
      currentVersionIndex = project.versions.length - 1;
    }
  } else if (project.html) {
    // Legacy: project has html directly (old format) - will migrate to versions on first save
    htmlToLoad = project.html;
    currentVersionIndex = null; // No versions yet
  }
  
  if (htmlToLoad) {
    try {
      console.log(`Loading project: ${project.name}, version: ${currentVersionIndex !== null ? currentVersionIndex + 1 : 'latest'}`);

      // Parse the saved HTML safely using DOMParser
      const parser = new DOMParser();
      const savedDoc = parser.parseFromString(htmlToLoad, 'text/html');

      // Use surgical replacement to preserve Polish overlay
      // This prevents destroying cached element references and event listeners
      replaceBodyContentPreservingOverlay(savedDoc.body.innerHTML);

      // Also update head if it has relevant content (like inline styles)
      // But preserve critical elements like script tags
      const savedHead = savedDoc.head;
      if (savedHead) {
        // Copy over style elements
        const styleElements = savedHead.querySelectorAll('style:not([data-polish-extension])');
        styleElements.forEach(style => {
          // Check if this style already exists
          const existingStyle = Array.from(document.head.querySelectorAll('style')).find(s =>
            s.textContent === style.textContent
          );
          if (!existingStyle) {
            document.head.appendChild(style.cloneNode(true));
          }
        });
      }

      // Clear selection when switching projects
      selectedElement = null;
      currentlyHighlightedElement = null;

      // Clear any highlights (overlay was preserved, so this still works)
      if (overlayElement) {
        overlayElement.style.display = 'none';
      }

      // Update UI immediately (no setTimeout needed since overlay was preserved)
      updateElementInfo(null, null);
      updateUIForState();
      
      // Update navigation buttons
      updateNavigationButtons(project);
      
      // Reload chat history and highlight active version
      if (isOverlayVisible) {
        loadChatHistory().then(data => {
          displayChatHistory(data);
        });
      }

      console.log('Project HTML loaded successfully');
    } catch (error) {
      console.error('Failed to load project HTML:', error);
      showNotification('Failed to load project', 'error');
    }
  } else {
    // No HTML to load
    currentVersionIndex = null;
    updateNavigationButtons(project);
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

  // Save button - save current state to project
  // Publish button - publish to GitHub
  if (elements.publishBtn) {
    elements.publishBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      await handlePublishToGitHub();
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
      handleNavigateBack();
    });
  }

  if (elements.forwardBtn) {
    elements.forwardBtn.addEventListener('click', (e) => {
      e.preventDefault();
      handleNavigateForward();
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

  // Load and display chat history
  loadChatHistory().then(data => {
    displayChatHistory(data);
  }).catch(error => {
    console.error('Failed to load chat history:', error);
  });

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

// Viewport meta tag reference
let viewportMetaTag = null;
let originalViewportContent = null;

/**
 * Apply current view mode to the website preview
 */
function applyViewMode() {
  if (!document.body.classList.contains('polish-overlay-active')) {
    return; // Only apply when overlay is active
  }

  if (viewMode === 'phone') {
    document.documentElement.classList.add('polish-phone-mode');
    document.body.classList.add('polish-phone-mode');
    document.body.classList.remove('polish-desktop-mode');
    createPhoneModeWrapper();
    setPhoneViewport();
  } else {
    document.documentElement.classList.remove('polish-phone-mode');
    document.body.classList.add('polish-desktop-mode');
    document.body.classList.remove('polish-phone-mode');
    removePhoneModeWrapper();
    restoreDesktopViewport();
  }
}

/**
 * Create iframe wrapper for phone mode that loads the page in mobile viewport
 */
function createPhoneModeWrapper() {
  if (phoneModeWrapper) return; // Already exists
  
  // Hide original page content (but keep our overlay visible)
  const originalContent = Array.from(document.body.children).filter(child => 
    !child.hasAttribute('data-polish-extension') && 
    child.id !== 'polish-overlay-wrapper'
  );
  
  // Store reference to original content for restoration
  phoneModeWrapper = {
    container: null,
    iframe: null,
    hiddenContent: originalContent
  };
  
  // Create container for phone bezel
  const container = document.createElement('div');
  container.id = 'polish-phone-wrapper';
  container.setAttribute('data-polish-extension', 'true');
  container.className = 'polish-phone-viewport-container';
  
  // Create iframe that will load the current page
  const iframe = document.createElement('iframe');
  iframe.id = 'polish-phone-iframe';
  iframe.setAttribute('data-polish-extension', 'true');
  iframe.setAttribute('data-polish-phone-iframe', 'true'); // Mark so content script skips init in iframe
  iframe.setAttribute('sandbox', 'allow-same-origin allow-scripts allow-forms allow-popups allow-modals');
  iframe.style.cssText = `
    width: 100%;
    height: 100%;
    border: 0;
    display: block;
    background: white;
  `;
  
  // Hide original content
  originalContent.forEach(child => {
    if (child.style) {
      child.dataset.polishOriginalDisplay = child.style.display || '';
      child.style.display = 'none';
    }
  });
  
  // Load current page in iframe
  iframe.src = window.location.href;
  
  // When iframe loads, inject mobile viewport code
  iframe.onload = () => {
    try {
      const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
      const iframeWin = iframe.contentWindow;
      
      // Set viewport meta tag
      let viewportMeta = iframeDoc.querySelector('meta[name="viewport"]');
      if (viewportMeta) {
        viewportMeta.setAttribute('content', 'width=375, initial-scale=1, maximum-scale=1, user-scalable=no');
      } else {
        viewportMeta = iframeDoc.createElement('meta');
        viewportMeta.name = 'viewport';
        viewportMeta.setAttribute('content', 'width=375, initial-scale=1, maximum-scale=1, user-scalable=no');
        iframeDoc.head.insertBefore(viewportMeta, iframeDoc.head.firstChild);
      }
      
      // Override window dimensions
      try {
        Object.defineProperty(iframeWin, 'innerWidth', {
          get: () => 375,
          configurable: true
        });
        Object.defineProperty(iframeWin, 'innerHeight', {
          get: () => 812,
          configurable: true
        });
        Object.defineProperty(iframeWin, 'outerWidth', {
          get: () => 375,
          configurable: true
        });
        Object.defineProperty(iframeWin, 'outerHeight', {
          get: () => 812,
          configurable: true
        });
      } catch (e) {
        console.warn('Could not override iframe window dimensions:', e);
      }
      
      // Constrain html and body to 375px
      const style = iframeDoc.createElement('style');
      style.id = 'polish-mobile-viewport-style';
      style.textContent = `
        html, body {
          width: 375px !important;
          min-width: 375px !important;
          max-width: 375px !important;
          margin: 0 !important;
          padding: 0 !important;
          overflow-x: hidden !important;
        }
        * {
          box-sizing: border-box;
        }
      `;
      iframeDoc.head.appendChild(style);
      
      // Trigger resize event
      iframeWin.dispatchEvent(new Event('resize'));
      iframeWin.dispatchEvent(new Event('orientationchange'));
      
    } catch (e) {
      console.error('Error setting up mobile viewport in iframe:', e);
      // If same-origin policy blocks access, fall back to simpler approach
      showNotification('Note: Mobile view may not fully activate due to page security settings', 'warning');
    }
  };
  
  container.appendChild(iframe);
  phoneModeWrapper.container = container;
  phoneModeWrapper.iframe = iframe;
  
  // Insert container into body
  document.body.insertBefore(container, document.body.firstChild);
}

/**
 * Remove phone mode wrapper and restore original structure
 */
function removePhoneModeWrapper() {
  if (!phoneModeWrapper || !phoneModeWrapper.container) return;
  
  // Show original content
  if (phoneModeWrapper.hiddenContent) {
    phoneModeWrapper.hiddenContent.forEach(child => {
      if (child.dataset.polishOriginalDisplay !== undefined) {
        child.style.display = child.dataset.polishOriginalDisplay;
        delete child.dataset.polishOriginalDisplay;
      } else {
        child.style.display = '';
      }
    });
  }
  
  // Remove iframe container
  phoneModeWrapper.container.remove();
  phoneModeWrapper = null;
}

/**
 * Set viewport to phone dimensions (375x812)
 */
function setPhoneViewport() {
  // Find or create viewport meta tag
  viewportMetaTag = document.querySelector('meta[name="viewport"]');
  
  if (viewportMetaTag) {
    // Save original viewport content
    originalViewportContent = viewportMetaTag.getAttribute('content');
    // Set phone viewport - force 375px width for mobile rendering
    viewportMetaTag.setAttribute('content', 'width=375, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover');
  } else {
    // Create new viewport meta tag
    viewportMetaTag = document.createElement('meta');
    viewportMetaTag.name = 'viewport';
    viewportMetaTag.setAttribute('content', 'width=375, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover');
    const head = document.head || document.getElementsByTagName('head')[0];
    head.insertBefore(viewportMetaTag, head.firstChild);
    originalViewportContent = null; // No original to restore
  }
  
  // Add a style element to override viewport dimensions via CSS
  // This helps ensure media queries respond correctly
  let phoneViewportStyle = document.getElementById('polish-phone-viewport-style');
  if (!phoneViewportStyle) {
    phoneViewportStyle = document.createElement('style');
    phoneViewportStyle.id = 'polish-phone-viewport-style';
    phoneViewportStyle.setAttribute('data-polish-extension', 'true');
    phoneViewportStyle.textContent = `
      /* Force mobile viewport behavior */
      html.polish-phone-mode {
        width: 375px !important;
        min-width: 375px !important;
        max-width: 375px !important;
        overflow-x: hidden;
        -webkit-text-size-adjust: 100%;
        text-size-adjust: 100%;
      }
      
      html.polish-phone-mode body {
        width: 375px !important;
        min-width: 375px !important;
        max-width: 375px !important;
        margin: 0 !important;
        padding: 0 !important;
      }
      
      /* Make the viewport wrapper act as a proper container */
      #polish-phone-viewport {
        width: 375px !important;
        min-width: 375px !important;
        max-width: 375px !important;
      }
      
      /* Constrain all content within viewport to 375px */
      #polish-phone-viewport * {
        max-width: 375px !important;
        box-sizing: border-box;
      }
      
      /* Force media queries to trigger at mobile breakpoints */
      @media screen and (max-width: 767px) {
        html.polish-phone-mode body,
        html.polish-phone-mode #polish-phone-viewport {
          width: 375px !important;
        }
      }
      
      /* Override common desktop-only styles */
      html.polish-phone-mode body > *:not([data-polish-extension]) {
        width: 100% !important;
        max-width: 375px !important;
      }
    `;
    document.head.appendChild(phoneViewportStyle);
  }
  
  // Note: Window dimension overrides are now handled inside the iframe
  // This function is called after iframe is created
}

/**
 * Restore desktop viewport
 */
function restoreDesktopViewport() {
  // Remove phone viewport style
  const phoneViewportStyle = document.getElementById('polish-phone-viewport-style');
  if (phoneViewportStyle) {
    phoneViewportStyle.remove();
  }
  
  // Restore original window dimensions
  try {
    delete window.innerWidth;
    delete window.innerHeight;
    delete window.outerWidth;
    delete window.outerHeight;
  } catch (e) {
    console.warn('Could not restore window dimensions:', e);
  }
  
  if (viewportMetaTag) {
    if (originalViewportContent) {
      // Restore original viewport content
      viewportMetaTag.setAttribute('content', originalViewportContent);
    } else {
      // Remove the viewport meta tag we created
      viewportMetaTag.remove();
    }
    viewportMetaTag = null;
    originalViewportContent = null;
  }
  
  // Force reflow
  document.body.offsetHeight;
  
  // Trigger resize event
  window.dispatchEvent(new Event('resize'));
  window.dispatchEvent(new Event('orientationchange'));
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
  // Determine which input is being used based on which overlay is active
  let apiKeyValue = null;
  let useSettingsOverlay = false;
  
  // Check if settings overlay is active first
  if (elements.settingsOverlay && elements.settingsOverlay.classList.contains('active') && elements.settingsApiKeyInput) {
    apiKeyValue = elements.settingsApiKeyInput.value.trim();
    useSettingsOverlay = true;
  } else if (elements.floatingApiKeyOverlay && !elements.floatingApiKeyOverlay.classList.contains('hidden') && elements.floatingApiKeyInput) {
    // Floating overlay is active
    apiKeyValue = elements.floatingApiKeyInput.value.trim();
    useSettingsOverlay = false;
  } else if (elements.floatingApiKeyInput) {
    // Fallback to floating input if it exists (initial screen)
    apiKeyValue = elements.floatingApiKeyInput.value.trim();
    useSettingsOverlay = false;
  } else if (elements.apiKeyInput) {
    // Legacy fallback
    apiKeyValue = elements.apiKeyInput.value.trim();
    useSettingsOverlay = false;
  }
  
  // Check if API key value exists and is valid
  if (!apiKeyValue || apiKeyValue.length < 20 || !apiKeyValue.startsWith('sk-ant-')) {
    let errorMsg = 'Invalid API key format. Must start with "sk-ant-" and be at least 20 characters.';
    if (!apiKeyValue) {
      errorMsg = 'Please enter an API key.';
    }
    
    // Determine which overlay to use for error display
    if (useSettingsOverlay || (elements.settingsOverlay && elements.settingsOverlay.classList.contains('active'))) {
      showSettingsApiKeyStatus(errorMsg, 'error');
    } else if (elements.floatingApiKeyOverlay && !elements.floatingApiKeyOverlay.classList.contains('hidden')) {
      showFloatingApiKeyStatus(errorMsg, 'error');
    } else if (elements.floatingApiKeyStatus) {
      showFloatingApiKeyStatus(errorMsg, 'error');
    } else if (elements.settingsApiKeyStatus) {
      showSettingsApiKeyStatus(errorMsg, 'error');
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
    
    if (useSettingsOverlay) {
      showSettingsApiKeyStatus(successMsg, 'success');
    } else {
      showFloatingApiKeyStatus(successMsg, 'success');
    }
    showNotification(successMsg, 'success');
    
    setTimeout(() => {
      if (useSettingsOverlay) {
        // Keep settings open, just update UI
        updateUIForState();
      } else {
        // Hide floating overlay and update UI
        hideApiKeySection();
        updateUIForState();
      }
    }, 1000);
  } catch (error) {
    console.error('Failed to save API key:', error);
    const errorMsg = 'Failed to save API key. Please try again.';
    if (useSettingsOverlay) {
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

  // Handle Chat mode differently
  if (currentMode === 'chat') {
    await handleChatSend(userRequest);
    return;
  }

  // Handle Agent mode (neither Edit nor Chat selected)
  if (currentMode === null || currentMode === undefined) {
    await handleAutoMode(userRequest);
    return;
  }

  // Edit mode logic (existing)
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

  // Create user message for chat history
  const userMessage = {
    id: `msg_${Date.now()}`,
    timestamp: Date.now(),
    role: 'user',
    content: userRequest,
    mode: currentMode || 'edit',
    elementContext: selectedElement ? {
      tagName: selectedElement.tagName.toLowerCase(),
      selector: generateSelector(selectedElement)
    } : null
  };

  // Save and display user message
  try {
    await saveChatMessage(userMessage);
    appendMessageToChat(userMessage);
  } catch (error) {
    console.error('Failed to save user message:', error);
    // Continue even if save fails
  }

  // Disable input during processing
  elements.modificationInput.disabled = true;
  elements.sendBtn.disabled = true;
  showModificationStatus('Processing your request...', 'loading');

  try {
    // Send modification request
    const response = await sendModificationRequest(userRequest);

    if (response && response.success) {
      // Create assistant message for chat history
      const assistantMessage = {
        id: `msg_${Date.now() + 1}`,
        timestamp: Date.now(),
        role: 'assistant',
        content: response.modifications.explanation || 'Modifications applied',
        mode: currentMode || 'edit',
        modifications: response.modifications
      };

      // Save and display assistant message
      try {
        await saveChatMessage(assistantMessage);
        appendMessageToChat(assistantMessage);
      } catch (error) {
        console.error('Failed to save assistant message:', error);
        // Continue even if save fails
      }

      // Auto-save version after modifications are applied
      try {
        await autoSaveVersion();
      } catch (error) {
        console.error('Failed to auto-save version:', error);
      }

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

    // Save error message to chat history
    const errorMessage_obj = {
      id: `msg_${Date.now() + 2}`,
      timestamp: Date.now(),
      role: 'assistant',
      content: `Error: ${errorMessage}`,
      mode: currentMode || 'edit'
    };

    try {
      await saveChatMessage(errorMessage_obj);
      appendMessageToChat(errorMessage_obj);
    } catch (saveError) {
      console.error('Failed to save error message:', saveError);
    }

    // Re-enable input on error, keep selection if it exists
    elements.modificationInput.disabled = false;
    elements.sendBtn.disabled = false;
    updateUIForState();
  }
}

/**
 * Handle sending messages in Chat mode (two-step API process)
 */
async function handleChatSend(userRequest) {
  // Create user message for chat history
  const userMessage = {
    id: `msg_${Date.now()}`,
    timestamp: Date.now(),
    role: 'user',
    content: userRequest,
    mode: 'chat'
  };

  // Save and display user message
  try {
    await saveChatMessage(userMessage);
    appendMessageToChat(userMessage);
  } catch (error) {
    console.error('Failed to save user message:', error);
  }

  // Disable input during processing
  elements.modificationInput.disabled = true;
  elements.sendBtn.disabled = true;
  elements.modificationInput.value = '';
  showModificationStatus('Analyzing page structure...', 'loading');

  try {
    // Step 1: Extract semantic DOM summary
    const semanticTree = extractSemanticDOM();
    const domSummary = semanticTreeToString(semanticTree);

    showModificationStatus('Identifying relevant parts...', 'loading');

    // Step 2: Call API to identify relevant DOM parts
    const identificationResponse = await chrome.runtime.sendMessage({
      type: 'IDENTIFY_DOM_PARTS',
      data: {
        userQuestion: userRequest,
        domSummary: domSummary
      }
    });

    if (!identificationResponse || !identificationResponse.success) {
      throw new Error(identificationResponse?.error || 'Failed to identify relevant DOM parts');
    }

    const { relevantSelectors, needsCSS } = identificationResponse.identification;

    showModificationStatus('Extracting relevant content...', 'loading');

    // Step 3: Extract relevant DOM based on identification
    const relevantDOM = extractRelevantDOM(
      relevantSelectors || ['body'],
      needsCSS || false
    );

    showModificationStatus('Generating answer...', 'loading');

    // Step 4: Get detailed answer with relevant DOM
    const answerResponse = await chrome.runtime.sendMessage({
      type: 'ANSWER_DOM_QUESTION',
      data: {
        userQuestion: userRequest,
        relevantDOM: `HTML:\n${relevantDOM.html}\n\nCSS:\n${relevantDOM.css}`
      }
    });

    if (!answerResponse || !answerResponse.success) {
      throw new Error(answerResponse?.error || 'Failed to get answer');
    }

    // Create assistant message
    const assistantMessage = {
      id: `msg_${Date.now() + 1}`,
      timestamp: Date.now(),
      role: 'assistant',
      content: answerResponse.answer,
      mode: 'chat'
    };

    // Save and display assistant message
    try {
      await saveChatMessage(assistantMessage);
      appendMessageToChat(assistantMessage);
    } catch (error) {
      console.error('Failed to save assistant message:', error);
    }

    // Auto-save version after chat response (no HTML changes, but still save chat)
    try {
      await autoSaveVersion();
    } catch (error) {
      console.error('Failed to auto-save version:', error);
    }

    showModificationStatus('Answer generated!', 'success');
    setTimeout(() => {
      showModificationStatus('', '');
      hideNotification();
    }, 2000);

  } catch (error) {
    console.error('Chat send failed:', error);
    let errorMessage = error.message || 'Failed to process question';
    if (errorMessage.includes('CORS')) {
      errorMessage = 'API Error: Please check your API key and permissions';
    }
    showModificationStatus(errorMessage, 'error');

    // Save error message to chat history
    const errorMessage_obj = {
      id: `msg_${Date.now() + 2}`,
      timestamp: Date.now(),
      role: 'assistant',
      content: `Error: ${errorMessage}`,
      mode: 'chat'
    };

    try {
      await saveChatMessage(errorMessage_obj);
      appendMessageToChat(errorMessage_obj);
    } catch (saveError) {
      console.error('Failed to save error message:', saveError);
    }
  } finally {
    // Re-enable input
    elements.modificationInput.disabled = false;
    elements.sendBtn.disabled = false;
    updateUIForState();
  }
}

/**
 * Handle agent mode (neither Edit nor Chat selected) - automatically perform tasks
 */
async function handleAutoMode(userRequest) {
  // Create user message for chat history
  const userMessage = {
    id: `msg_${Date.now()}`,
    timestamp: Date.now(),
    role: 'user',
    content: userRequest,
    mode: 'auto'
  };

  // Save and display user message
  try {
    await saveChatMessage(userMessage);
    appendMessageToChat(userMessage);
  } catch (error) {
    console.error('Failed to save user message:', error);
  }

  // Disable input during processing
  elements.modificationInput.disabled = true;
  elements.sendBtn.disabled = true;
  elements.modificationInput.value = '';
  showModificationStatus('Analyzing page structure...', 'loading');

  try {
    // Step 1: Extract semantic DOM summary
    const semanticTree = extractSemanticDOM();
    const domSummary = semanticTreeToString(semanticTree);

    showModificationStatus('Identifying relevant parts...', 'loading');

    // Step 2: Call API to identify relevant DOM parts
    const identificationResponse = await chrome.runtime.sendMessage({
      type: 'IDENTIFY_DOM_PARTS',
      data: {
        userQuestion: userRequest,
        domSummary: domSummary
      }
    });

    if (!identificationResponse || !identificationResponse.success) {
      throw new Error(identificationResponse?.error || 'Failed to identify relevant DOM parts');
    }

    const { relevantSelectors, needsCSS } = identificationResponse.identification;

    showModificationStatus('Extracting relevant content...', 'loading');

    // Step 3: Extract relevant DOM based on identification
    const relevantDOM = extractRelevantDOM(
      relevantSelectors || ['body'],
      needsCSS || false
    );

    showModificationStatus('Performing task...', 'loading');

    // Step 4: Ask LLM to perform the task and return modifications
    const taskResponse = await chrome.runtime.sendMessage({
      type: 'PERFORM_DOM_TASK',
      data: {
        userRequest: userRequest,
        relevantDOM: `HTML:\n${relevantDOM.html}\n\nCSS:\n${relevantDOM.css}`,
        relevantSelectors: relevantSelectors || []
      }
    });

    if (!taskResponse || !taskResponse.success) {
      throw new Error(taskResponse?.error || 'Failed to perform task');
    }

    // Step 5: Apply modifications to identified elements
    const taskResult = taskResponse.modifications; // This is the whole response object
    const modificationsArray = taskResult.modifications || []; // Array of modifications
    let appliedCount = 0;

    if (modificationsArray && modificationsArray.length > 0) {
      for (const modification of modificationsArray) {
        const { selector, css_changes, html_changes, action } = modification;
        
        try {
          // Find elements matching the selector
          const elementsToModify = document.querySelectorAll(selector);
          
          if (elementsToModify.length === 0) {
            console.warn(`No elements found for selector: ${selector}`);
            continue;
          }

          // Apply modifications to each matching element
          elementsToModify.forEach(element => {
            // Skip Polish extension elements
            if (element.hasAttribute('data-polish-extension')) {
              return;
            }

            try {
              let elementModified = false;
              
              // Handle different action types
              if (action === 'remove' || action === 'delete') {
                element.remove();
                elementModified = true;
              } else if (action === 'hide') {
                element.style.display = 'none';
                elementModified = true;
              } else {
                // Standard CSS/HTML modifications (default action is "modify")
                if (css_changes && css_changes.trim()) {
                  applyCSSChanges(element, css_changes);
                  elementModified = true;
                }

                if (html_changes && html_changes.trim()) {
                  applyHTMLChanges(element, html_changes);
                  elementModified = true;
                }
              }
              
              // Count each element once, not each modification
              if (elementModified) {
                appliedCount++;
              }
            } catch (error) {
              console.error(`Failed to apply modification to element with selector ${selector}:`, error);
            }
          });
        } catch (error) {
          console.error(`Failed to query selector ${selector}:`, error);
        }
      }
    }

    // Create assistant message
    const assistantMessage = {
      id: `msg_${Date.now() + 1}`,
      timestamp: Date.now(),
      role: 'assistant',
      content: taskResult?.summary || `Task completed. Modified ${appliedCount} element(s).`,
      mode: 'auto'
    };

    // Save and display assistant message
    try {
      await saveChatMessage(assistantMessage);
      appendMessageToChat(assistantMessage);
    } catch (error) {
      console.error('Failed to save assistant message:', error);
    }

    // Auto-save version after task is completed
    try {
      await autoSaveVersion();
    } catch (error) {
      console.error('Failed to auto-save version:', error);
    }

    if (appliedCount > 0) {
      showModificationStatus(`Task completed! Modified ${appliedCount} element(s).`, 'success');
    } else {
      showModificationStatus('Task completed, but no elements were modified.', 'warning');
    }

    setTimeout(() => {
      showModificationStatus('', '');
      hideNotification();
    }, 3000);

  } catch (error) {
    console.error('Agent mode failed:', error);
    let errorMessage = error.message || 'Failed to perform task';
    if (errorMessage.includes('CORS')) {
      errorMessage = 'API Error: Please check your API key and permissions';
    }
    showModificationStatus(errorMessage, 'error');

    // Save error message to chat history
    const errorMessage_obj = {
      id: `msg_${Date.now() + 2}`,
      timestamp: Date.now(),
      role: 'assistant',
      content: `Error: ${errorMessage}`,
      mode: 'auto'
    };

    try {
      await saveChatMessage(errorMessage_obj);
      appendMessageToChat(errorMessage_obj);
    } catch (saveError) {
      console.error('Failed to save error message:', saveError);
    }
  } finally {
    // Re-enable input
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
    } else if (currentMode === 'chat') {
      // In chat mode - allow free text
      elements.modificationInput.disabled = false;
      elements.modificationInput.placeholder = 'Ask Polish...';
      elements.sendBtn.disabled = false;
    } else {
      // Agent mode (neither edit nor chat) - allow free text for task requests
      elements.modificationInput.disabled = false;
      elements.modificationInput.placeholder = 'Tell Polish what to do...';
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
        <div class="polish-settings-section">
          <label class="polish-settings-label">GitHub Integration</label>
          <div class="polish-settings-warning" style="background-color: #fef3c7; border-left: 3px solid #f59e0b; padding: 8px; margin-bottom: 12px; font-size: 12px; line-height: 1.4; color: #92400e;">
            ⚠️ <strong>Testing Only:</strong> Create a fine-grained PAT with <code style="background: #fbbf24; padding: 2px 4px; border-radius: 2px;">repo→contents</code> (read/write) permissions. Revoke token from GitHub when done.
          </div>
          <div id="polish-github-connected-info" class="polish-settings-info hidden" style="background-color: #d1fae5; border-left: 3px solid #10b981; padding: 8px; margin-bottom: 12px; font-size: 12px; line-height: 1.4; color: #065f46;">
            ✓ Connected as <strong id="polish-github-username"></strong> → <strong id="polish-github-repo-name"></strong>
          </div>
          <div id="polish-github-form">
            <div class="polish-settings-input-group" style="margin-bottom: 10px;">
              <label for="polish-github-token-input" style="display: block; margin-bottom: 4px; font-size: 13px;">Personal Access Token</label>
              <input
                type="password"
                id="polish-github-token-input"
                class="polish-settings-input"
                placeholder="ghp_..."
                autocomplete="off"
              />
            </div>
            <div class="polish-settings-input-group" style="margin-bottom: 10px;">
              <label for="polish-github-repo-input" style="display: block; margin-bottom: 4px; font-size: 13px;">Repository (owner/repo)</label>
              <input
                type="text"
                id="polish-github-repo-input"
                class="polish-settings-input"
                placeholder="username/my-website"
                autocomplete="off"
              />
            </div>
            <div class="polish-settings-input-group" style="margin-bottom: 12px;">
              <label for="polish-github-branch-input" style="display: block; margin-bottom: 4px; font-size: 13px;">Base Branch</label>
              <input
                type="text"
                id="polish-github-branch-input"
                class="polish-settings-input"
                value="main"
                autocomplete="off"
              />
            </div>
          </div>
          <div class="polish-settings-button-group" style="display: flex; gap: 8px;">
            <button id="polish-settings-connect-github-btn" class="polish-btn polish-btn-primary polish-btn-text">
              Connect GitHub
            </button>
            <button id="polish-settings-disconnect-github-btn" class="polish-btn polish-btn-secondary polish-btn-text hidden" style="background-color: #ef4444; color: white;">
              Disconnect
            </button>
          </div>
          <div id="polish-github-status" class="polish-settings-status hidden"></div>
        </div>
      </div>
    </div>
  `;
  
  document.body.appendChild(overlay);
  elements.settingsOverlay = overlay;
  elements.settingsApiKeyInput = document.getElementById('polish-settings-api-key-input');
  elements.settingsSaveApiKeyBtn = document.getElementById('polish-settings-save-api-key-btn');
  elements.settingsApiKeyStatus = document.getElementById('polish-settings-api-key-status');

  // GitHub elements
  elements.githubTokenInput = document.getElementById('polish-github-token-input');
  elements.githubRepoInput = document.getElementById('polish-github-repo-input');
  elements.githubBranchInput = document.getElementById('polish-github-branch-input');
  elements.githubConnectBtn = document.getElementById('polish-settings-connect-github-btn');
  elements.githubDisconnectBtn = document.getElementById('polish-settings-disconnect-github-btn');
  elements.githubStatus = document.getElementById('polish-github-status');
  elements.githubConnectedInfo = document.getElementById('polish-github-connected-info');
  elements.githubUsername = document.getElementById('polish-github-username');
  elements.githubRepoName = document.getElementById('polish-github-repo-name');
  elements.githubForm = document.getElementById('polish-github-form');
  
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

  // GitHub event listeners
  if (elements.githubConnectBtn) {
    elements.githubConnectBtn.addEventListener('click', (e) => {
      e.preventDefault();
      handleConnectGitHub();
    });
  }

  if (elements.githubDisconnectBtn) {
    elements.githubDisconnectBtn.addEventListener('click', (e) => {
      e.preventDefault();
      handleDisconnectGitHub();
    });
  }

  // Load existing GitHub credentials if any
  loadGitHubCredentials();
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
 * Show GitHub status message
 */
function showGitHubStatus(message, type) {
  if (!elements.githubStatus) return;

  elements.githubStatus.textContent = message;
  elements.githubStatus.className = `polish-settings-status status-${type}`;
  elements.githubStatus.classList.remove('hidden');

  if (type === 'success') {
    setTimeout(() => {
      elements.githubStatus.classList.add('hidden');
    }, 3000);
  }
}

/**
 * Save GitHub credentials to storage
 */
async function saveGitHubCredentials(token, repo, baseBranch, username, repoName) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.set({
      [GITHUB_STORAGE_KEYS.TOKEN]: token,
      [GITHUB_STORAGE_KEYS.REPO]: repo,
      [GITHUB_STORAGE_KEYS.BASE_BRANCH]: baseBranch,
      [GITHUB_STORAGE_KEYS.USERNAME]: username,
      [GITHUB_STORAGE_KEYS.REPO_NAME]: repoName,
      [GITHUB_STORAGE_KEYS.CONNECTED]: true
    }, () => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve();
      }
    });
  });
}

/**
 * Load GitHub credentials from storage
 */
async function loadGitHubCredentials() {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(Object.values(GITHUB_STORAGE_KEYS), (result) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
        return;
      }

      const credentials = {
        token: result[GITHUB_STORAGE_KEYS.TOKEN] || null,
        repo: result[GITHUB_STORAGE_KEYS.REPO] || null,
        baseBranch: result[GITHUB_STORAGE_KEYS.BASE_BRANCH] || 'main',
        username: result[GITHUB_STORAGE_KEYS.USERNAME] || null,
        repoName: result[GITHUB_STORAGE_KEYS.REPO_NAME] || null,
        connected: result[GITHUB_STORAGE_KEYS.CONNECTED] || false
      };

      // Update state
      Object.assign(githubState, credentials);

      // Update UI if connected
      if (credentials.connected && elements.githubUsername && elements.githubRepoName) {
        updateGitHubUI(true);
      }

      resolve(credentials);
    });
  });
}

/**
 * Clear GitHub credentials from storage
 */
async function clearGitHubCredentials() {
  return new Promise((resolve, reject) => {
    chrome.storage.local.remove(Object.values(GITHUB_STORAGE_KEYS), () => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve();
      }
    });
  });
}

/**
 * Update GitHub UI based on connection status
 */
function updateGitHubUI(connected) {
  if (!elements.githubConnectBtn || !elements.githubDisconnectBtn) return;

  if (connected) {
    // Hide form, show connected info
    if (elements.githubForm) elements.githubForm.classList.add('hidden');
    if (elements.githubConnectBtn) elements.githubConnectBtn.classList.add('hidden');
    if (elements.githubDisconnectBtn) elements.githubDisconnectBtn.classList.remove('hidden');
    if (elements.githubConnectedInfo) elements.githubConnectedInfo.classList.remove('hidden');

    // Update connected info
    if (elements.githubUsername) elements.githubUsername.textContent = githubState.username || '';
    if (elements.githubRepoName) elements.githubRepoName.textContent = githubState.repo || '';
  } else {
    // Show form, hide connected info
    if (elements.githubForm) elements.githubForm.classList.remove('hidden');
    if (elements.githubConnectBtn) elements.githubConnectBtn.classList.remove('hidden');
    if (elements.githubDisconnectBtn) elements.githubDisconnectBtn.classList.add('hidden');
    if (elements.githubConnectedInfo) elements.githubConnectedInfo.classList.add('hidden');
  }
}

/**
 * Handle Connect GitHub button click
 */
async function handleConnectGitHub() {
  if (!elements.githubTokenInput || !elements.githubRepoInput) return;

  const token = elements.githubTokenInput.value.trim();
  const repo = elements.githubRepoInput.value.trim();
  const baseBranch = elements.githubBranchInput?.value.trim() || 'main';

  // Validate inputs
  if (!token) {
    showGitHubStatus('Please enter a GitHub Personal Access Token', 'error');
    return;
  }

  if (!token.startsWith('ghp_') && !token.startsWith('github_pat_')) {
    showGitHubStatus('Invalid token format. Must start with "ghp_" or "github_pat_"', 'error');
    return;
  }

  if (!repo) {
    showGitHubStatus('Please enter a repository (owner/repo)', 'error');
    return;
  }

  if (!repo.includes('/')) {
    showGitHubStatus('Repository must be in format "owner/repo"', 'error');
    return;
  }

  // Show loading state
  if (elements.githubConnectBtn) {
    elements.githubConnectBtn.disabled = true;
    elements.githubConnectBtn.textContent = 'Connecting...';
  }
  showGitHubStatus('Validating GitHub connection...', 'info');

  try {
    // Validate connection via service worker (which has access to github-api.js)
    const response = await chrome.runtime.sendMessage({
      type: 'VALIDATE_GITHUB',
      token,
      repo
    });

    if (response.error) {
      throw new Error(response.error);
    }

    if (!response.valid) {
      throw new Error(response.message || 'Failed to validate GitHub connection');
    }

    // Save credentials
    await saveGitHubCredentials(
      token,
      repo,
      baseBranch,
      response.username,
      response.repoName
    );

    // Update UI
    updateGitHubUI(true);
    showGitHubStatus('✓ GitHub connected successfully!', 'success');

    // Clear input fields for security
    if (elements.githubTokenInput) elements.githubTokenInput.value = '';
    if (elements.githubRepoInput) elements.githubRepoInput.value = '';

  } catch (error) {
    console.error('GitHub connection error:', error);

    let errorMessage = 'Failed to connect to GitHub';

    if (error.message.includes('Authentication failed') || error.message.includes('Invalid or expired token')) {
      errorMessage = 'Authentication failed. Please check your token.';
    } else if (error.message.includes('not found') || error.message.includes('no access')) {
      errorMessage = 'Repository not found. Verify owner/repo and token permissions.';
    } else if (error.message.includes('permissions') || error.message.includes('Insufficient permissions')) {
      errorMessage = 'Access denied. Ensure your PAT has repo→contents (read/write) permissions.';
    } else if (error.message.includes('Rate limit')) {
      errorMessage = error.message; // Use the detailed rate limit message
    } else if (error.message) {
      errorMessage = error.message;
    }

    showGitHubStatus(errorMessage, 'error');
  } finally {
    // Reset button state
    if (elements.githubConnectBtn) {
      elements.githubConnectBtn.disabled = false;
      elements.githubConnectBtn.textContent = 'Connect GitHub';
    }
  }
}

/**
 * Handle Disconnect GitHub button click
 */
async function handleDisconnectGitHub() {
  try {
    // Clear storage
    await clearGitHubCredentials();

    // Reset state
    githubState.token = null;
    githubState.repo = null;
    githubState.baseBranch = 'main';
    githubState.username = null;
    githubState.repoName = null;
    githubState.connected = false;

    // Update UI
    updateGitHubUI(false);
    showGitHubStatus('GitHub disconnected', 'success');

  } catch (error) {
    console.error('Error disconnecting GitHub:', error);
    showGitHubStatus('Failed to disconnect GitHub', 'error');
  }
}

/**
 * Generate polish-metadata.json content
 */
function generateMetadata() {
  const currentProject = getCurrentProjectFromState();
  if (!currentProject) {
    return null;
  }

  const latestVersion = currentProject.versions[currentProject.versions.length - 1];
  const changes = extractChangesFromChatHistory(latestVersion.chatMessages || []);

  const metadata = {
    created_at: new Date().toISOString(),
    source_url: window.location.href,
    project_name: currentProject.name || 'Untitled Project',
    branch: `polish-changes-${Date.now()}`,
    changes: changes,
    chat_summary: summarizeChatHistory(latestVersion.chatMessages || []),
    notes: "Generated via Polish browser extension"
  };

  return JSON.stringify(metadata, null, 2);
}

/**
 * Extract changes from chat history
 */
function extractChangesFromChatHistory(chatMessages) {
  const changes = [];

  // Simplified extraction - in a real implementation, this would parse modifications
  for (const message of chatMessages) {
    if (message.role === 'user') {
      changes.push({
        type: 'modification',
        description: message.content.substring(0, 100),
        timestamp: message.timestamp || Date.now()
      });
    }
  }

  return changes;
}

/**
 * Summarize chat history
 */
function summarizeChatHistory(chatMessages) {
  if (!chatMessages || chatMessages.length === 0) {
    return 'No chat history available';
  }

  const userMessages = chatMessages.filter(m => m.role === 'user');
  if (userMessages.length === 0) {
    return 'No user modifications recorded';
  }

  if (userMessages.length === 1) {
    return userMessages[0].content;
  }

  return `${userMessages.length} modifications made: ${userMessages.slice(0, 3).map(m => m.content.substring(0, 50)).join(', ')}...`;
}

/**
 * Generate README.md content for GitHub
 */
function generateReadme(branchName) {
  const timestamp = new Date().toISOString();
  const sourceUrl = window.location.href;

  return `# Polish Export

- **Source page:** ${sourceUrl}
- **Generated:** ${timestamp}
- **Branch:** ${branchName}

## Files
- \`index.html\` — Static snapshot with applied changes
- \`polish-metadata.json\` — Structured change log

## Next Steps
1. Review \`index.html\` and replicate changes in the real codebase
2. Merge this branch or cherry-pick into your workflow
3. Revoke the PAT if you created it for this test

> Generated automatically by the Polish browser extension.

## About Polish
Polish is an AI-powered browser extension that allows you to modify website elements using natural language commands powered by Claude AI.

**Note:** This is a static export and may not reflect the dynamic behavior of your application. Use this as a reference for implementing changes in your source code.
`;
}

/**
 * Get current project from state
 */
function getCurrentProjectFromState() {
  // Get from URL-specific storage
  const urlKey = `polish_projects_${currentUrl}`;

  // This would normally be async, but for simplicity we'll access the cached project data
  // In the actual publish flow, we'll use proper async access
  return {
    name: currentProjectName,
    versions: [{
      html: document.documentElement.outerHTML,
      chatMessages: [] // Will be populated from actual chat history
    }]
  };
}

/**
 * Handle Publish to GitHub button click
 */
async function handlePublishToGitHub() {
  // Check if GitHub is connected
  if (!githubState.connected || !githubState.token || !githubState.repo) {
    showNotification('Please connect GitHub first. Go to Settings → GitHub Integration.', 'error');

    // Open settings overlay to help user
    showSettingsOverlay();
    return;
  }

  // Show publishing state
  if (elements.publishBtn) {
    elements.publishBtn.disabled = true;
    elements.publishBtn.textContent = 'Publishing...';
  }

  try {
    // Generate branch name
    const branchName = `polish-changes-${Date.now()}`;

    // Get current HTML
    const currentHTML = document.documentElement.outerHTML;

    // Generate metadata
    const metadataContent = generateMetadata() || '{}';

    // Generate README
    const readmeContent = generateReadme(branchName);

    // Prepare files to commit
    const files = [
      {
        path: 'index.html',
        content: currentHTML,
        message: 'Polish: Add modified HTML snapshot'
      },
      {
        path: 'polish-metadata.json',
        content: metadataContent,
        message: 'Polish: Add metadata'
      },
      {
        path: 'README.md',
        content: readmeContent,
        message: 'Polish: Add README'
      }
    ];

    showNotification('Creating branch and committing files...', 'info');

    // Send to service worker to publish
    const response = await chrome.runtime.sendMessage({
      type: 'PUBLISH_TO_GITHUB',
      data: {
        token: githubState.token,
        repo: githubState.repo,
        baseBranch: githubState.baseBranch || 'main',
        branchName,
        files
      }
    });

    if (!response.success) {
      throw new Error(response.error || 'Failed to publish to GitHub');
    }

    // Show success message with link
    const branchUrl = response.branchUrl;
    showPublishSuccessModal(branchUrl, branchName);

  } catch (error) {
    console.error('Error publishing to GitHub:', error);

    let errorMessage = 'Failed to publish to GitHub';

    if (error.message.includes('Authentication') || error.message.includes('401')) {
      errorMessage = 'Authentication failed. Please reconnect GitHub in Settings.';
    } else if (error.message.includes('not found') || error.message.includes('404')) {
      errorMessage = 'Repository not found. Please check Settings → GitHub.';
    } else if (error.message.includes('permissions') || error.message.includes('403')) {
      errorMessage = 'Access denied. Check your GitHub token permissions.';
    } else if (error.message) {
      errorMessage = error.message;
    }

    showNotification(errorMessage, 'error');
  } finally {
    // Reset button state
    if (elements.publishBtn) {
      elements.publishBtn.disabled = false;
      elements.publishBtn.textContent = 'Publish';
    }
  }
}

/**
 * Show publish success modal with branch link
 */
function showPublishSuccessModal(branchUrl, branchName) {
  // Create modal overlay
  const modal = document.createElement('div');
  modal.setAttribute('data-polish-extension', 'true');
  modal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000000;
  `;

  modal.innerHTML = `
    <div style="background: white; border-radius: 8px; padding: 24px; max-width: 500px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);">
      <h2 style="margin: 0 0 16px 0; font-size: 18px; font-weight: 600; color: #10b981;">
        ✓ Successfully Published to GitHub!
      </h2>
      <p style="margin: 0 0 12px 0; color: #374151; line-height: 1.5;">
        Your changes have been committed to branch:
      </p>
      <p style="margin: 0 0 16px 0; font-family: monospace; background: #f3f4f6; padding: 8px 12px; border-radius: 4px; font-size: 13px; word-break: break-all;">
        ${branchName}
      </p>
      <div style="display: flex; gap: 8px;">
        <a href="${branchUrl}" target="_blank" style="flex: 1; background: #3b82f6; color: white; text-decoration: none; padding: 10px 16px; border-radius: 6px; text-align: center; font-weight: 500;">
          View on GitHub →
        </a>
        <button id="polish-close-success-modal" style="background: #e5e7eb; color: #374151; border: none; padding: 10px 16px; border-radius: 6px; font-weight: 500; cursor: pointer;">
          Close
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // Close on button click
  const closeBtn = modal.querySelector('#polish-close-success-modal');
  closeBtn.addEventListener('click', () => {
    modal.remove();
  });

  // Close on overlay click
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.remove();
    }
  });
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
          <div class="polish-versions-list-header">
            <div class="polish-versions-label">All Projects</div>
            <button id="polish-new-project-btn" class="polish-btn polish-btn-primary polish-btn-text" title="Create New Project">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M7 3v8M3 7h8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
              </svg>
              New Project
            </button>
          </div>
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
  
  // New Project button
  const newProjectBtn = document.getElementById('polish-new-project-btn');
  if (newProjectBtn) {
    newProjectBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      createNewProjectFromCurrent();
    });
  }
  
  if (elements.projectNameInput) {
    elements.projectNameInput.addEventListener('change', (e) => {
      const newName = e.target.value.trim();
      
      // Don't allow renaming Live Website
      if (isLiveWebsite(currentProjectId)) {
        e.target.value = LIVE_WEBSITE_NAME;
        showNotification('Live Website name cannot be changed', 'error');
        return;
      }
      
      if (newName && newName !== currentProjectName) {
        currentProjectName = newName;
        updateProjectNameDisplay();
        // Update project name in storage if project exists
        if (currentProjectId) {
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
    // Disable input if Live Website
    if (isLiveWebsite(currentProjectId)) {
      elements.projectNameInput.disabled = true;
      elements.projectNameInput.style.cursor = 'not-allowed';
    } else {
      elements.projectNameInput.disabled = false;
      elements.projectNameInput.style.cursor = 'text';
    }
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
    
    // Always show Live Website first
    const liveWebsiteItem = createLiveWebsiteItem();
    elements.projectsList.appendChild(liveWebsiteItem);
    
    if (projects.length === 0) {
      const emptyState = document.createElement('div');
      emptyState.className = 'polish-no-projects';
      emptyState.textContent = 'No saved projects';
      elements.projectsList.appendChild(emptyState);
      return;
    }
    
    // Add regular projects
    projects.forEach(project => {
      const item = createProjectItem(project);
      elements.projectsList.appendChild(item);
    });
  });
}

/**
 * Create Live Website project item
 */
function createLiveWebsiteItem() {
  const item = document.createElement('div');
  item.className = 'polish-project-item polish-project-item-live';
  if (currentProjectId === LIVE_WEBSITE_ID) {
    item.classList.add('active');
  }
  
  item.innerHTML = `
    <div class="polish-project-item-content">
      <span class="polish-project-item-name" data-project-id="${LIVE_WEBSITE_ID}">${LIVE_WEBSITE_NAME}</span>
      <span class="polish-project-item-badge">Original</span>
    </div>
    <button class="polish-project-item-menu" data-project-id="${LIVE_WEBSITE_ID}" title="Options">
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="8" cy="4" r="1" fill="currentColor"/>
        <circle cx="8" cy="8" r="1" fill="currentColor"/>
        <circle cx="8" cy="12" r="1" fill="currentColor"/>
      </svg>
    </button>
  `;
  
  // Click handler to switch to Live Website
  const nameSpan = item.querySelector('.polish-project-item-name');
  nameSpan.addEventListener('click', () => {
    switchToLiveWebsite();
  });
  
  // Menu button handler - show duplicate only (no delete)
  const menuBtn = item.querySelector('.polish-project-item-menu');
  menuBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    showLiveWebsiteMenu(menuBtn);
  });
  
  return item;
}

/**
 * Create regular project item
 */
function createProjectItem(project) {
  const item = document.createElement('div');
  item.className = 'polish-project-item';
  if (project.id === currentProjectId) {
    item.classList.add('active');
  }
  
  item.innerHTML = `
    <div class="polish-project-item-content">
      <span class="polish-project-item-name" data-project-id="${project.id}">${escapeHtml(project.name)}</span>
    </div>
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
    showProjectMenu(project.id, project.name, menuBtn);
  });
  
  return item;
}

/**
 * Switch to Live Website
 */
async function switchToLiveWebsite() {
  // Save current project's chat history before switching (if we have unsaved messages)
  if (currentProjectId && !isLiveWebsite(currentProjectId)) {
    try {
      await autoSaveVersion();
    } catch (error) {
      console.error('Failed to auto-save before switching to Live Website:', error);
    }
  }
  
  // Clear temporary messages
  temporaryChatMessages = [];
  
  currentProjectId = LIVE_WEBSITE_ID;
  currentProjectName = LIVE_WEBSITE_NAME;
  currentVersionIndex = null;
  
  updateProjectNameDisplay();
  
  // Load Live Website HTML
  const liveHTML = await getLiveWebsiteHTML();
  if (liveHTML) {
    try {
      // Parse the HTML safely
      const parser = new DOMParser();
      const liveDoc = parser.parseFromString(liveHTML, 'text/html');

      // Use surgical replacement to preserve Polish overlay
      replaceBodyContentPreservingOverlay(liveDoc.body.innerHTML);

      // Clear selection
      selectedElement = null;
      currentlyHighlightedElement = null;

      // Clear highlights
      if (overlayElement) {
        overlayElement.style.display = 'none';
      }

      // Update UI immediately
      updateElementInfo(null, null);
      updateUIForState();
    } catch (error) {
      console.error('Failed to load live HTML:', error);
      showNotification('Failed to switch to live website', 'error');
    }
  }
  
  // Reload chat history for the Live Website project
  if (isOverlayVisible) {
    loadChatHistory().then(data => {
      displayChatHistory({ messages: [], project: null }); // Live Website has no project
    }).catch(error => {
      console.error('Failed to load chat history:', error);
    });
  }
  
  hideVersionsOverlay();
  
  // Save active project
  await saveActiveProject();
  
  showNotification(`Switched to ${LIVE_WEBSITE_NAME}`, 'success');
}

/**
 * Switch to a different project
 */
async function switchToProject(projectId) {
  // Handle Live Website separately
  if (isLiveWebsite(projectId)) {
    await switchToLiveWebsite();
    return;
  }
  
  const storageKey = `polish_projects_${currentUrl}`;
  chrome.storage.local.get([storageKey], (result) => {
    const projects = result[storageKey] || [];
    const project = projects.find(p => p.id === projectId);
    
    if (project) {
      currentProjectId = project.id;
      currentProjectName = project.name;
      currentVersionIndex = null; // Show latest version
      
      updateProjectNameDisplay();
      loadProjectHTML(project);
      
      // Reload chat history for the switched project
      if (isOverlayVisible) {
        loadChatHistory().then(data => {
          displayChatHistory(data);
        }).catch(error => {
          console.error('Failed to load chat history:', error);
        });
      }
      
      hideVersionsOverlay();
      
      // Save active project
      saveActiveProject();
      
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
        // Save active project with updated name
        saveActiveProject();
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
      <button class="polish-project-menu-item" id="polish-duplicate-project-btn" style="display: none;">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="5" y="5" width="8" height="8" rx="1" stroke="currentColor" stroke-width="1.5" fill="none"/>
          <path d="M3 11V3C3 2.448 3.448 2 4 2h8" stroke="currentColor" stroke-width="1.5" fill="none"/>
        </svg>
        Duplicate
      </button>
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
      if (deleteTargetProjectId && !isLiveWebsite(deleteTargetProjectId)) {
        deleteProject(deleteTargetProjectId);
      }
    });
  }
  
  const duplicateBtn = document.getElementById('polish-duplicate-project-btn');
  if (duplicateBtn) {
    duplicateBtn.addEventListener('click', () => {
      if (deleteTargetProjectId) {
        duplicateProject(deleteTargetProjectId);
      }
    });
  }
}

let deleteTargetProjectId = null;

/**
 * Show project menu (delete/duplicate) aligned to menu button
 */
function showProjectMenu(projectId, projectName, menuButton) {
  if (!elements.deleteOverlay || !menuButton) return;
  
  const btnRect = menuButton.getBoundingClientRect();
  
  elements.deleteOverlay.style.top = `${btnRect.top}px`;
  elements.deleteOverlay.style.left = `${btnRect.right + 8}px`;
  
  deleteTargetProjectId = projectId;
  
  // Show/hide buttons based on project type
  const deleteBtn = document.getElementById('polish-delete-project-btn');
  const duplicateBtn = document.getElementById('polish-duplicate-project-btn');
  
  // Show both delete and duplicate for regular projects
  if (deleteBtn) deleteBtn.style.display = 'flex';
  if (duplicateBtn) {
    duplicateBtn.style.display = 'flex';
    // Add click handler if not already added
    if (!duplicateBtn.hasAttribute('data-listener-added')) {
      duplicateBtn.setAttribute('data-listener-added', 'true');
      duplicateBtn.addEventListener('click', () => {
        if (deleteTargetProjectId) {
          duplicateProject(deleteTargetProjectId);
        }
      });
    }
  }
  
  elements.deleteOverlay.classList.remove('hidden');
}

/**
 * Show Live Website menu (only "Duplicate", no "Delete")
 */
function showLiveWebsiteMenu(menuButton) {
  if (!elements.deleteOverlay || !menuButton) return;
  
  const btnRect = menuButton.getBoundingClientRect();
  
  elements.deleteOverlay.style.top = `${btnRect.top}px`;
  elements.deleteOverlay.style.left = `${btnRect.right + 8}px`;
  
  deleteTargetProjectId = LIVE_WEBSITE_ID;
  
  // Show/hide buttons - only show duplicate, hide delete
  const deleteBtn = document.getElementById('polish-delete-project-btn');
  const duplicateBtn = document.getElementById('polish-duplicate-project-btn');
  
  if (deleteBtn) deleteBtn.style.display = 'none';
  if (duplicateBtn) {
    duplicateBtn.style.display = 'flex';
    // Add click handler if not already added
    if (!duplicateBtn.hasAttribute('data-listener-added')) {
      duplicateBtn.setAttribute('data-listener-added', 'true');
      duplicateBtn.addEventListener('click', () => {
        if (deleteTargetProjectId) {
          duplicateProject(deleteTargetProjectId);
        }
      });
    }
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
      // If deleted project was current, switch to Live Website
      if (currentProjectId === projectId) {
        currentProjectId = LIVE_WEBSITE_ID;
        currentProjectName = LIVE_WEBSITE_NAME;
        isProjectSaved = true;
        
        updateProjectNameDisplay();
        
        // Load Live Website HTML
        getLiveWebsiteHTML().then(liveHTML => {
          if (liveHTML) {
            try {
              // Parse the HTML safely
              const parser = new DOMParser();
              const liveDoc = parser.parseFromString(liveHTML, 'text/html');

              // Use surgical replacement to preserve Polish overlay
              replaceBodyContentPreservingOverlay(liveDoc.body.innerHTML);

              // Clear selection
              selectedElement = null;
              currentlyHighlightedElement = null;

              // Clear highlights
              if (overlayElement) {
                overlayElement.style.display = 'none';
              }

              // Update UI immediately
              updateElementInfo(null, null);
              updateUIForState();
              
              // Reload chat history for Live Website
              if (isOverlayVisible) {
                loadChatHistory().then(data => {
                  displayChatHistory({ messages: [], project: null });
                }).catch(error => {
                  console.error('Failed to load chat history:', error);
                });
              }
            } catch (error) {
              console.error('Failed to load live HTML:', error);
            }
          }
        });
        
        hideVersionsOverlay();
        
        // Save active project (now Live Website)
        saveActiveProject();
        
        showNotification('Project deleted. Switched to Live Website.', 'success');
      } else {
        showNotification('Project deleted', 'success');
      }
      
      refreshProjectsList();
      hideDeleteOverlay();
    });
  });
}

/**
 * Create new project from current state
 */
async function createNewProjectFromCurrent() {
  // Save current project's chat history before creating new project
  if (currentProjectId && !isLiveWebsite(currentProjectId)) {
    try {
      await autoSaveVersion();
    } catch (error) {
      console.error('Failed to auto-save before creating new project:', error);
    }
  }
  
  const currentHTML = document.documentElement.outerHTML;
  
  // Generate project ID and name
  const projectId = `project_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const projectName = generateProjectName();
  
  // Clear temporary messages for new project
  temporaryChatMessages = [];
  
  const project = {
    id: projectId,
    name: projectName,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    isLive: false,
    sourceProjectId: currentProjectId || null,
    versions: [{
      html: currentHTML,
      chatMessages: [],
      savedAt: Date.now()
    }]
  };
  
  const storageKey = `polish_projects_${currentUrl}`;
  chrome.storage.local.get([storageKey], (result) => {
    const projects = result[storageKey] || [];
    projects.push(project);
    
    chrome.storage.local.set({ [storageKey]: projects }, () => {
      // Switch to new project
      currentProjectId = projectId;
      currentProjectName = projectName;
      currentVersionIndex = 0; // First version
      
      updateProjectNameDisplay();
      
      // Update navigation buttons
      updateNavigationButtons(project);
      
      // Reload chat history for the new project (will be empty)
      if (isOverlayVisible) {
        loadChatHistory().then(data => {
          displayChatHistory(data);
        }).catch(error => {
          console.error('Failed to load chat history:', error);
        });
      }
      
      // Refresh project list
      refreshProjectsList();
      
      hideVersionsOverlay();
      
      // Save active project
      saveActiveProject();
      
      showNotification(`Created new project: "${projectName}"`, 'success');
      console.log('New project created from current state');
    });
  });
}

/**
 * Create new project from Live Website
 */
async function createNewProjectFromLive() {
  // Save current project's chat history before creating new project
  if (currentProjectId && !isLiveWebsite(currentProjectId)) {
    try {
      await autoSaveVersion();
    } catch (error) {
      console.error('Failed to auto-save before creating new project from Live:', error);
    }
  }
  
  const liveHTML = await getLiveWebsiteHTML();
  
  // Generate project ID and name
  const projectId = `project_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const projectName = generateProjectName();
  
  // Clear temporary messages for new project
  temporaryChatMessages = [];
  
  const project = {
    id: projectId,
    name: projectName,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    isLive: false,
    sourceProjectId: LIVE_WEBSITE_ID,
    versions: [{
      html: liveHTML,
      chatMessages: [],
      savedAt: Date.now()
    }]
  };
  
  const storageKey = `polish_projects_${currentUrl}`;
  chrome.storage.local.get([storageKey], (result) => {
    const projects = result[storageKey] || [];
    projects.push(project);
    
    chrome.storage.local.set({ [storageKey]: projects }, () => {
      // Switch to new project
      currentProjectId = projectId;
      currentProjectName = projectName;
      currentVersionIndex = 0; // First version
      
      // Load the Live Website HTML into the new project
      if (liveHTML) {
        try {
          // Parse the HTML safely
          const parser = new DOMParser();
          const liveDoc = parser.parseFromString(liveHTML, 'text/html');

          // Use surgical replacement to preserve Polish overlay
          replaceBodyContentPreservingOverlay(liveDoc.body.innerHTML);

          // Clear selection
          selectedElement = null;
          currentlyHighlightedElement = null;

          // Clear highlights
          if (overlayElement) {
            overlayElement.style.display = 'none';
          }

          // Update UI immediately
          updateElementInfo(null, null);
          updateUIForState();
        } catch (error) {
          console.error('Failed to load live HTML:', error);
        }
      }
      
      // Reload chat history for the new project (will be empty)
      if (isOverlayVisible) {
        loadChatHistory().then(data => {
          displayChatHistory(data);
        }).catch(error => {
          console.error('Failed to load chat history:', error);
        });
      }
      
      updateProjectNameDisplay();
      refreshProjectsList();
      
      hideVersionsOverlay();
      
      // Save active project
      saveActiveProject();
      
      showNotification(`Created new project from Live Website: "${projectName}"`, 'success');
      console.log('New project created from Live Website');
    });
  });
}

/**
 * Duplicate a project
 */
async function duplicateProject(sourceProjectId) {
  // Save current project's chat history before duplicating
  if (currentProjectId && !isLiveWebsite(currentProjectId) && currentProjectId !== sourceProjectId) {
    try {
      await autoSaveVersion();
    } catch (error) {
      console.error('Failed to auto-save before duplicating project:', error);
    }
  }
  
  const storageKey = `polish_projects_${currentUrl}`;
  
  chrome.storage.local.get([storageKey], async (result) => {
    const projects = result[storageKey] || [];
    let sourceProject = null;
    
    // Handle Live Website duplication
    if (isLiveWebsite(sourceProjectId)) {
      const liveHTML = await getLiveWebsiteHTML();
      sourceProject = {
        id: LIVE_WEBSITE_ID,
        name: LIVE_WEBSITE_NAME,
        html: liveHTML
      };
    } else {
      sourceProject = projects.find(p => p.id === sourceProjectId);
    }
    
    if (!sourceProject) {
      showNotification('Project not found', 'error');
      return;
    }
    
    // Generate new project ID and name
    const projectId = `project_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const projectName = `Copy of ${sourceProject.name}`;
    
    // Copy versions if they exist, otherwise create from legacy HTML
    let versions = [];
    if (sourceProject.versions && sourceProject.versions.length > 0) {
      versions = JSON.parse(JSON.stringify(sourceProject.versions)); // Deep copy
    } else if (sourceProject.html) {
      // Legacy project - create first version from HTML
      versions = [{
        html: sourceProject.html,
        chatMessages: [],
        savedAt: Date.now()
      }];
    }
    
    const newProject = {
      id: projectId,
      name: projectName,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      isLive: false,
      sourceProjectId: sourceProjectId,
      versions: versions
    };
    
    projects.push(newProject);
    
    chrome.storage.local.set({ [storageKey]: projects }, () => {
      // Switch to duplicated project
      // Clear temporary messages for duplicated project
      temporaryChatMessages = [];
      
      currentProjectId = projectId;
      currentProjectName = projectName;
      currentVersionIndex = versions.length > 0 ? versions.length - 1 : null; // Latest version
      
      // Load the duplicated HTML
      loadProjectHTML(newProject);
      
      // Reload chat history for the duplicated project (will be empty - chat history is not duplicated)
      if (isOverlayVisible) {
        loadChatHistory().then(data => {
          displayChatHistory(data);
        }).catch(error => {
          console.error('Failed to load chat history:', error);
        });
      }
      
      updateProjectNameDisplay();
      refreshProjectsList();
      
      hideDeleteOverlay();
      hideVersionsOverlay();
      
      // Save active project
      saveActiveProject();
      
      showNotification(`Duplicated project: "${projectName}"`, 'success');
      console.log('Project duplicated');
    });
  });
}

/**
 * Generate project name with timestamp
 */
function generateProjectName() {
  const now = new Date();
  const timeStr = now.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
  return `Project ${timeStr}`;
}

/**
 * Auto-save current state as a new version
 * Called automatically after each chat interaction
 */
async function autoSaveVersion() {
  // Don't allow saving Live Website
  if (isLiveWebsite(currentProjectId) || !currentUrl) {
    return;
  }

  // Generate project ID if needed
  if (!currentProjectId) {
    currentProjectId = `project_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Clone the document to avoid modifying the live DOM
  const clonedDoc = document.documentElement.cloneNode(true);

  // Remove Polish extension elements from clone (don't save our UI)
  clonedDoc.querySelectorAll('[data-polish-extension="true"]').forEach(el => el.remove());
  const overlayWrapper = clonedDoc.querySelector('#polish-overlay-wrapper');
  if (overlayWrapper) {
    overlayWrapper.remove();
  }

  // Get clean HTML without Polish elements
  const currentHTML = clonedDoc.outerHTML;
  
  // Get current chat history - combine latest version messages + temporary messages
  const storageKey = `polish_projects_${currentUrl}`;
  const tempStorageKey = `polish_chat_history_temp_${currentUrl}`;
  
  // Get both project data and temporary messages
  const result = await new Promise((resolve) => {
    chrome.storage.local.get([storageKey, tempStorageKey], (data) => {
      resolve(data);
    });
  });
  
  const projects = result[storageKey] || [];
  const project = projects.find(p => p.id === currentProjectId);
  
  let chatMessages = [];
  
  // Get messages from latest version if it exists
  if (project && project.versions && project.versions.length > 0) {
    const latestVersion = project.versions[project.versions.length - 1];
    chatMessages = [...(latestVersion.chatMessages || [])];
  }
  
  // Add temporary messages (unsaved since last version)
  const urlHistory = result[tempStorageKey] || {};
  const tempMessages = urlHistory[currentProjectId] || [];
  
  // Filter out messages that are already in the latest version to avoid duplicates
  if (chatMessages.length > 0) {
    const existingMessageIds = new Set(chatMessages.map(m => m.id));
    const newTempMessages = tempMessages.filter(m => !existingMessageIds.has(m.id));
    chatMessages = [...chatMessages, ...newTempMessages];
  } else {
    // No version messages yet, use all temp messages
    chatMessages = [...tempMessages];
  }
  
  // Also include any messages in the in-memory array that might not be persisted yet
  if (temporaryChatMessages.length > 0) {
    const existingMessageIds = new Set(chatMessages.map(m => m.id));
    const newInMemoryMessages = temporaryChatMessages.filter(m => !existingMessageIds.has(m.id));
    chatMessages = [...chatMessages, ...newInMemoryMessages];
  }
  
  chrome.storage.local.get([storageKey], (result) => {
    const projects = result[storageKey] || [];
    
    // Find existing project or create new one
    let project = projects.find(p => p.id === currentProjectId);
    
    if (!project) {
      // New project - create it
      project = {
        id: currentProjectId,
        name: currentProjectName,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        isLive: false,
        sourceProjectId: null,
        versions: []
      };
      projects.push(project);
    } else {
      // Preserve creation date and source
      project.createdAt = project.createdAt || Date.now();
      project.sourceProjectId = project.sourceProjectId || null;
      project.updatedAt = Date.now();
    }
    
    // Initialize versions array if it doesn't exist (legacy projects)
    if (!project.versions) {
      project.versions = [];
      // If there's legacy HTML, create first version from it
      if (project.html) {
        project.versions.push({
          html: project.html,
          chatMessages: [],
          savedAt: project.updatedAt || Date.now()
        });
        // Remove legacy html field
        delete project.html;
      }
    }
    
    // If we're viewing an old version and make changes, branch from that point
    if (currentVersionIndex !== null && currentVersionIndex < project.versions.length - 1) {
      // Remove all versions after current (user is branching)
      project.versions = project.versions.slice(0, currentVersionIndex + 1);
    }
    
    // Create new version
    const newVersion = {
      html: currentHTML,
      chatMessages: [...chatMessages], // Copy current chat messages
      savedAt: Date.now()
    };
    
    project.versions.push(newVersion);
    currentVersionIndex = project.versions.length - 1; // Set to latest version
    
    // Update project name if it changed
    project.name = currentProjectName;
    
    chrome.storage.local.set({ [storageKey]: projects }, () => {
      console.log(`Auto-saved version ${project.versions.length} for project ${currentProjectName} with ${chatMessages.length} messages`);
      
      // Clear temporary chat messages after saving to version
      // All temporary messages were already included in chatMessages, so we can clear temp storage
      temporaryChatMessages = [];
      const tempStorageKey = `polish_chat_history_temp_${currentUrl}`;
      chrome.storage.local.get([tempStorageKey], (result) => {
        const urlHistory = result[tempStorageKey] || {};
        // Only clear if messages were actually saved
        if (chatMessages.length > 0) {
          delete urlHistory[currentProjectId];
          chrome.storage.local.set({ [tempStorageKey]: urlHistory }, () => {
            console.log('Cleared temporary chat messages after saving to version');
          });
        }
      });
      
      // Update navigation buttons
      updateNavigationButtons(project);
    });
  });
}

/**
 * Handle back navigation - move to previous version
 */
async function handleNavigateBack() {
  if (isLiveWebsite(currentProjectId) || !currentUrl) {
    return; // Can't navigate on Live Website
  }

  const storageKey = `polish_projects_${currentUrl}`;
  chrome.storage.local.get([storageKey], (result) => {
    const projects = result[storageKey] || [];
    const project = projects.find(p => p.id === currentProjectId);
    
    if (!project || !project.versions || project.versions.length === 0) {
      return;
    }
    
    // Determine current version index
    let targetIndex = currentVersionIndex;
    if (targetIndex === null) {
      // At latest version - move to second-to-last
      targetIndex = project.versions.length - 1;
    }
    
    // Can't go back from first version
    if (targetIndex <= 0) {
      return;
    }
    
    // Move to previous version
    targetIndex = targetIndex - 1;
    navigateToVersion(project, targetIndex);
  });
}

/**
 * Handle forward navigation - move to next version
 */
async function handleNavigateForward() {
  if (isLiveWebsite(currentProjectId) || !currentUrl) {
    return; // Can't navigate on Live Website
  }

  const storageKey = `polish_projects_${currentUrl}`;
  chrome.storage.local.get([storageKey], (result) => {
    const projects = result[storageKey] || [];
    const project = projects.find(p => p.id === currentProjectId);
    
    if (!project || !project.versions || project.versions.length === 0) {
      return;
    }
    
    // Determine current version index
    let targetIndex = currentVersionIndex;
    if (targetIndex === null) {
      // At latest version, can't go forward
      return;
    }
    
    // Can't go forward from last version
    if (targetIndex >= project.versions.length - 1) {
      return;
    }
    
    // Move to next version
    targetIndex = targetIndex + 1;
    navigateToVersion(project, targetIndex);
  });
}

/**
 * Navigate to a specific version
 */
async function navigateToVersion(project, versionIndex) {
  if (!project.versions || versionIndex < 0 || versionIndex >= project.versions.length) {
    return;
  }
  
  const version = project.versions[versionIndex];
  
  // Update current version index
  currentVersionIndex = versionIndex;
  
  // Save the active project with the new version index
  await saveActiveProject();
  
  // Load the HTML for this version
  try {
    const parser = new DOMParser();
    const versionDoc = parser.parseFromString(version.html, 'text/html');
    
    // Use surgical replacement to preserve Polish overlay
    replaceBodyContentPreservingOverlay(versionDoc.body.innerHTML);
    
    // Also update head
    const savedHead = versionDoc.head;
    if (savedHead) {
      const styleElements = savedHead.querySelectorAll('style:not([data-polish-extension])');
      styleElements.forEach(style => {
        const existingStyle = Array.from(document.head.querySelectorAll('style')).find(s =>
          s.textContent === style.textContent
        );
        if (!existingStyle) {
          document.head.appendChild(style.cloneNode(true));
        }
      });
    }
    
    // Clear selection
    selectedElement = null;
    currentlyHighlightedElement = null;
    
    // Clear highlights
    if (overlayElement) {
      overlayElement.style.display = 'none';
    }
    
    // Update UI
    updateElementInfo(null, null);
    updateUIForState();
    
    // Reload chat history for this version and highlight active message
    loadChatHistory().then(data => {
      displayChatHistory(data);
    });
    
    // Update navigation buttons
    updateNavigationButtons(project);
    
    showNotification(`Viewing version ${versionIndex + 1} of ${project.versions.length}`, 'info');
  } catch (error) {
    console.error('Failed to load version:', error);
    showNotification('Failed to load version', 'error');
  }
}

/**
 * Update navigation button states (enabled/disabled)
 */
function updateNavigationButtons(project) {
  if (!elements.backBtn || !elements.forwardBtn) {
    return;
  }
  
  // For Live Website, disable both buttons
  if (isLiveWebsite(currentProjectId)) {
    elements.backBtn.disabled = true;
    elements.backBtn.classList.add('polish-btn-disabled');
    elements.forwardBtn.disabled = true;
    elements.forwardBtn.classList.add('polish-btn-disabled');
    return;
  }
  
  if (!project || !project.versions || project.versions.length === 0) {
    // No versions yet, disable both
    elements.backBtn.disabled = true;
    elements.backBtn.classList.add('polish-btn-disabled');
    elements.forwardBtn.disabled = true;
    elements.forwardBtn.classList.add('polish-btn-disabled');
    return;
  }
  
  // Determine current version index
  let currentIndex = currentVersionIndex;
  if (currentIndex === null) {
    // At latest version
    currentIndex = project.versions.length - 1;
  }
  
  // Enable/disable back button
  if (currentIndex <= 0) {
    elements.backBtn.disabled = true;
    elements.backBtn.classList.add('polish-btn-disabled');
  } else {
    elements.backBtn.disabled = false;
    elements.backBtn.classList.remove('polish-btn-disabled');
  }
  
  // Enable/disable forward button
  // Can only go forward if not at latest version
  if (currentIndex >= project.versions.length - 1) {
    elements.forwardBtn.disabled = true;
    elements.forwardBtn.classList.add('polish-btn-disabled');
  } else {
    elements.forwardBtn.disabled = false;
    elements.forwardBtn.classList.remove('polish-btn-disabled');
  }
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
// Chat History Functions
// ============================================================================

/**
 * Load chat history for current project from chrome.storage.local
 * Always returns the FULL chat history from the latest version
 * @returns {Promise<Object>} Object with { messages: Array, project: Object }
 */
async function loadChatHistory() {
  if (!currentUrl || !currentProjectId || isLiveWebsite(currentProjectId)) {
    return Promise.resolve({ messages: [], project: null });
  }

  const storageKey = `polish_projects_${currentUrl}`;
  const tempStorageKey = `polish_chat_history_temp_${currentUrl}`;

  return new Promise((resolve) => {
    chrome.storage.local.get([storageKey, tempStorageKey], (result) => {
      if (chrome.runtime.lastError) {
        console.error('Failed to load chat history:', chrome.runtime.lastError);
        resolve({ messages: [], project: null });
        return;
      }

      const projects = result[storageKey] || [];
      const project = projects.find(p => p.id === currentProjectId);
      
      let messages = [];
      
      // Always load the FULL history from the latest version (not just up to current version)
      // We'll highlight the appropriate message based on currentVersionIndex in displayChatHistory
      if (project && project.versions && project.versions.length > 0) {
        const latestVersion = project.versions[project.versions.length - 1];
        messages = [...(latestVersion.chatMessages || [])];
      }
      
      // Add temporary messages (unsaved since last version)
      const urlHistory = result[tempStorageKey] || {};
      const tempMessages = urlHistory[currentProjectId] || [];
      
      // Only add temp messages if we have versions (to avoid duplicates)
      if (project && project.versions && project.versions.length > 0) {
        // Filter out messages that are already in the latest version
        const latestMessageIds = new Set((project.versions[project.versions.length - 1].chatMessages || []).map(m => m.id));
        const newTempMessages = tempMessages.filter(m => !latestMessageIds.has(m.id));
        messages = [...messages, ...newTempMessages];
      } else {
        // No versions yet, use temporary messages
        messages = tempMessages;
      }

      console.log(`Loaded ${messages.length} messages (full history) for project ${currentProjectId}, viewing version ${currentVersionIndex !== null ? currentVersionIndex + 1 : 'latest'}`);
      resolve({ messages, project }); // Return both messages and project for highlighting logic
    });
  });
}

// Temporary chat storage for real-time display (before version is saved)
let temporaryChatMessages = [];

/**
 * Save a chat message to temporary storage for real-time display
 * Messages are saved to version when autoSaveVersion is called
 * @param {Object} message - Message object to save
 */
async function saveChatMessage(message) {
  // Add to temporary storage for real-time display
  temporaryChatMessages.push(message);
  
  // Also save to persistent storage for backup/real-time sync
  if (!currentUrl || !currentProjectId || isLiveWebsite(currentProjectId)) {
    return Promise.resolve();
  }

  const storageKey = `polish_chat_history_temp_${currentUrl}`;

  return new Promise((resolve, reject) => {
    chrome.storage.local.get([storageKey], (result) => {
      if (chrome.runtime.lastError) {
        console.error('Failed to get temporary chat history:', chrome.runtime.lastError);
        reject(chrome.runtime.lastError);
        return;
      }

      const urlHistory = result[storageKey] || {};
      let projectHistory = urlHistory[currentProjectId] || [];

      // Add new message
      projectHistory.push(message);

      urlHistory[currentProjectId] = projectHistory;

      chrome.storage.local.set({ [storageKey]: urlHistory }, () => {
        if (chrome.runtime.lastError) {
          console.error('Failed to save chat message:', chrome.runtime.lastError);
          reject(chrome.runtime.lastError);
        } else {
          console.log(`Chat message saved temporarily for project ${currentProjectId}`);
          resolve();
        }
      });
    });
  });
}

/**
 * Clear chat history for current project
 */
async function clearChatHistory() {
  if (!currentUrl || !currentProjectId) {
    console.error('Cannot clear chat history: no URL or project ID');
    return Promise.reject(new Error('No URL or project ID'));
  }

  const storageKey = `polish_chat_history_${currentUrl}`;

  return new Promise((resolve, reject) => {
    chrome.storage.local.get([storageKey], (result) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
        return;
      }

      const urlHistory = result[storageKey] || {};
      delete urlHistory[currentProjectId];

      chrome.storage.local.set({ [storageKey]: urlHistory }, () => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          console.log(`Chat history cleared for project ${currentProjectId} on ${currentUrl}`);
          resolve();
        }
      });
    });
  });
}

/**
 * Display chat history in the chat messages container
 * @param {Array} messages - Array of message objects
 */
function displayChatHistory(messagesOrData, project = null) {
  if (!elements.chatMessages) return;

  // Handle both old format (just messages array) and new format (object with messages and project)
  let messages, projectData;
  if (Array.isArray(messagesOrData)) {
    messages = messagesOrData;
    projectData = project;
  } else {
    messages = messagesOrData.messages || [];
    projectData = messagesOrData.project || project;
  }

  // Clear existing messages
  elements.chatMessages.innerHTML = '';

  // If no messages, show empty state
  if (messages.length === 0) {
    const emptyState = document.createElement('div');
    emptyState.className = 'polish-chat-empty-state';
    emptyState.innerHTML = `
      <p>No messages yet. Start by selecting Edit or Chat mode!</p>
    `;
    elements.chatMessages.appendChild(emptyState);
    return;
  }

  // Determine which message should be highlighted based on current version
  // The highlighted message is the last assistant message that made changes up to the current version
  let activeMessageIndex = -1;
  let greyOutAll = false; // Flag to grey out all messages (when at version 0 - original state)
  
  if (projectData && projectData.versions && projectData.versions.length > 0) {
    // Determine which version's messages to use for finding the active message
    let targetVersionIndex = currentVersionIndex;
    if (targetVersionIndex === null) {
      // Viewing latest version - highlight the last message that made changes
      targetVersionIndex = projectData.versions.length - 1;
    }
    
    // If viewing version 0 (original state before any changes), grey out all messages
    if (targetVersionIndex === 0) {
      greyOutAll = true;
      activeMessageIndex = -1; // No active message
    } else if (targetVersionIndex >= 0 && targetVersionIndex < projectData.versions.length) {
      // Get messages up to this version
      const targetVersion = projectData.versions[targetVersionIndex];
      const versionMessages = targetVersion.chatMessages || [];
      
      if (versionMessages.length > 0) {
        // Find the last assistant message that made changes in this version's messages
        for (let i = versionMessages.length - 1; i >= 0; i--) {
          const versionMsg = versionMessages[i];
          if (versionMsg.role === 'assistant' && 
              (versionMsg.modifications || versionMsg.mode === 'auto' || versionMsg.mode === 'edit')) {
            // Find this message's index in the full messages array
            activeMessageIndex = messages.findIndex(m => m.id === versionMsg.id);
            break;
          }
        }
      }
    }
  }

  // Render each message with highlighting and greyed-out state
  // All messages are visible, but messages after the highlighted one are greyed out
  // If at version 0 (original state), all messages are greyed out
  messages.forEach((msg, index) => {
    const isActive = (index === activeMessageIndex);
    let isGreyedOut = false;
    if (greyOutAll) {
      // At version 0 - grey out all messages
      isGreyedOut = true;
    } else {
      // Messages after the active one are greyed out
      isGreyedOut = (activeMessageIndex >= 0 && index > activeMessageIndex);
    }
    const messageEl = createMessageElement(msg, isActive, isGreyedOut);
    elements.chatMessages.appendChild(messageEl);
  });

  // Auto-scroll to bottom
  elements.chatMessages.scrollTop = elements.chatMessages.scrollHeight;
}

/**
 * Create DOM element for a single chat message
 * @param {Object} message - Message object
 * @returns {HTMLElement} Message element
 */
function createMessageElement(message, isActive = false, isGreyedOut = false) {
  const div = document.createElement('div');
  div.className = `polish-chat-message ${message.role}`;
  if (isActive) {
    div.classList.add('polish-message-active');
  }
  if (isGreyedOut) {
    div.classList.add('polish-message-greyed-out');
  }
  div.setAttribute('data-message-id', message.id);

  // Message header (timestamp + mode badge)
  const header = document.createElement('div');
  header.className = 'polish-message-header';

  const time = document.createElement('span');
  time.className = 'polish-message-time';
  time.textContent = formatTime(message.timestamp);
  header.appendChild(time);

  // Mode badge: show "You" for user messages, mode for assistant messages
  const mode = document.createElement('span');
  mode.className = 'polish-message-mode';
  if (message.role === 'user') {
    mode.textContent = 'You';
  } else if (message.mode) {
    // Assistant messages show the mode
    if (message.mode === 'edit') {
      mode.textContent = 'Edit';
    } else if (message.mode === 'chat') {
      mode.textContent = 'Chat';
    } else if (message.mode === 'auto') {
      mode.textContent = 'Agent';
    } else {
      mode.textContent = message.mode || 'Edit';
    }
  }
  header.appendChild(mode);

  div.appendChild(header);

  // Message content (support markdown formatting for chat and agent mode responses)
  const content = document.createElement('div');
  content.className = 'polish-message-content';
  
  // For chat and agent mode assistant messages, render full markdown
  if ((message.mode === 'chat' || message.mode === 'auto') && message.role === 'assistant') {
    content.innerHTML = renderMarkdown(message.content);
  } else {
    content.textContent = message.content;
  }
  
  div.appendChild(content);

  // Element context (for edit mode messages)
  if (message.elementContext) {
    const element = document.createElement('div');
    element.className = 'polish-message-element';
    element.textContent = `<${message.elementContext.tagName}>`;
    if (message.elementContext.selector) {
      element.title = message.elementContext.selector;
    }
    div.appendChild(element);
  }

  return div;
}

/**
 * Append a single message to the chat and scroll to bottom
 * @param {Object} message - Message object
 */
function appendMessageToChat(message) {
  if (!elements.chatMessages) return;

  // Remove empty state if it exists
  const emptyState = elements.chatMessages.querySelector('.polish-chat-empty-state');
  if (emptyState) {
    emptyState.remove();
  }

  // Determine if this message should be greyed out (comes after the active one)
  // Check if there's an active message in the chat
  const existingMessages = Array.from(elements.chatMessages.querySelectorAll('.polish-chat-message'));
  const activeMessage = elements.chatMessages.querySelector('.polish-message-active');
  let isGreyedOut = false;
  
  if (activeMessage && existingMessages.length > 0) {
    const activeIndex = existingMessages.indexOf(activeMessage);
    // If there's an active message, new messages are always after it and should be greyed out
    isGreyedOut = activeIndex >= 0;
  }
  
  const messageEl = createMessageElement(message, false, isGreyedOut);
  elements.chatMessages.appendChild(messageEl);

  // Auto-scroll to bottom with smooth animation
  elements.chatMessages.scrollTop = elements.chatMessages.scrollHeight;
}

/**
 * Format timestamp for display
 * @param {number} timestamp - Unix timestamp in milliseconds
 * @returns {string} Formatted time string
 */
function formatTime(timestamp) {
  const date = new Date(timestamp);
  const now = new Date();

  // If today, show just the time
  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  // If this year, show date without year
  if (date.getFullYear() === now.getFullYear()) {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  // Otherwise show full date
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
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

/**
 * Render markdown content to HTML
 * Supports: code blocks, inline code, headers, bold, italic, lists, links, blockquotes
 */
function renderMarkdown(text) {
  if (!text) return '';
  
  // Use placeholders to protect code blocks from other markdown processing
  const codeBlockPlaceholders = [];
  const inlineCodePlaceholders = [];
  
  // Step 1: Extract and protect code blocks (```...```)
  let html = text.replace(/```(\w+)?\n?([\s\S]*?)```/g, (match, lang, code) => {
    const placeholder = `__CODE_BLOCK_${codeBlockPlaceholders.length}__`;
    codeBlockPlaceholders.push({
      placeholder,
      lang: lang || 'text',
      code: code.trim()
    });
    return placeholder;
  });
  
  // Step 2: Extract and protect inline code (`...`)
  html = html.replace(/`([^`\n]+)`/g, (match, code) => {
    const placeholder = `__INLINE_CODE_${inlineCodePlaceholders.length}__`;
    inlineCodePlaceholders.push({
      placeholder,
      code: code.trim()
    });
    return placeholder;
  });
  
  // Step 3: Process headers (# ## ###)
  html = html.replace(/^### (.*?)$/gm, '<h3 class="polish-markdown-h3">$1</h3>');
  html = html.replace(/^## (.*?)$/gm, '<h2 class="polish-markdown-h2">$1</h2>');
  html = html.replace(/^# (.*?)$/gm, '<h1 class="polish-markdown-h1">$1</h1>');
  
  // Step 4: Process blockquotes (> text)
  html = html.replace(/^>\s+(.+)$/gm, '<blockquote class="polish-markdown-blockquote">$1</blockquote>');
  
  // Step 5: Process horizontal rules (--- or ***)
  html = html.replace(/^---$/gm, '<hr class="polish-markdown-hr">');
  html = html.replace(/^\*\*\*$/gm, '<hr class="polish-markdown-hr">');
  
  // Step 6: Process unordered lists (- or *)
  const listItems = [];
  html = html.replace(/^[\s]*[-*]\s+(.+)$/gm, (match, content) => {
    listItems.push(content);
    return `__LIST_ITEM_${listItems.length - 1}__`;
  });
  
  // Step 7: Process ordered lists (1. 2. etc.)
  html = html.replace(/^\d+\.\s+(.+)$/gm, (match, content) => {
    listItems.push(content);
    return `__LIST_ITEM_${listItems.length - 1}__`;
  });
  
  // Step 8: Wrap consecutive list items
  html = html.replace(/(__LIST_ITEM_\d+__(?:\s*__LIST_ITEM_\d+__)*)/g, (match) => {
    const items = match.match(/__LIST_ITEM_(\d+)__/g).map(item => {
      const index = parseInt(item.match(/\d+/)[0]);
      return `<li class="polish-markdown-li">${listItems[index]}</li>`;
    });
    return `<ul class="polish-markdown-ul">${items.join('')}</ul>`;
  });
  
  // Step 9: Process links [text](url)
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="polish-markdown-link">$1</a>');
  
  // Step 10: Process bold (**text**)
  html = html.replace(/\*\*([^*\n]+?)\*\*/g, '<strong>$1</strong>');
  
  // Step 11: Process bold (__text__) - but be careful not to conflict with underscores
  html = html.replace(/\b__([^_\n]+?)__\b/g, '<strong>$1</strong>');
  
  // Step 12: Process italic (*text*) - only if not part of **bold** (already processed)
  html = html.replace(/([^*]|^)\*([^*\n]+?)\*([^*]|$)/g, '$1<em>$2</em>$3');
  
  // Step 13: Process italic (_text_) - only if not part of __bold__ (already processed)
  html = html.replace(/([^_]|^)_([^_\n]+?)_([^_]|$)/g, (match, before, text, after) => {
    // Skip if this was already processed as bold
    if (match.includes('<strong>')) return match;
    return `${before}<em>${text}</em>${after}`;
  });
  
  // Step 14: Escape HTML
  html = html
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  
  // Step 15: Restore code blocks (un-escape their content)
  codeBlockPlaceholders.forEach(({ placeholder, lang, code }) => {
    const escapedCode = code
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>');
    html = html.replace(placeholder, `<pre class="polish-markdown-code-block"><code class="language-${lang}">${escapedCode}</code></pre>`);
  });
  
  // Step 16: Restore inline code
  inlineCodePlaceholders.forEach(({ placeholder, code }) => {
    const escapedCode = code
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>');
    html = html.replace(placeholder, `<code class="polish-markdown-inline-code">${escapedCode}</code>`);
  });
  
  // Step 17: Process paragraphs (split by double line breaks)
  html = html.split(/\n\n+/).map(para => {
    para = para.trim();
    if (!para) return '';
    // Don't wrap if it's already a block element
    if (/^<(pre|h[1-6]|ul|ol|blockquote|hr|p)/.test(para)) {
      return para;
    }
    return `<p class="polish-markdown-p">${para}</p>`;
  }).join('\n\n');
  
  // Step 18: Process single line breaks (convert to <br> but not in code blocks)
  html = html.replace(/\n/g, '<br>');
  
  // Clean up any double <br> that might result from paragraph splits
  html = html.replace(/<br><br>/g, '<br>');
  
  return html;
}

/**
 * Extract and create a semantic tree representation of the DOM
 * This creates a compressed, structured representation for LLM processing
 */
function extractSemanticDOM() {
  const body = document.body;
  if (!body) return {};

  const semanticTree = {
    url: window.location.href,
    title: document.title,
    elements: []
  };

  // Walk the DOM tree and create semantic representation
  function walkDOM(node, depth = 0, path = []) {
    // Skip our extension elements
    if (node.hasAttribute && node.hasAttribute('data-polish-extension')) {
      return null;
    }

    // Limit depth to avoid excessive nesting
    if (depth > 10) return null;

    // Skip script, style, and other non-content elements
    const skipTags = ['script', 'style', 'noscript', 'meta', 'link', 'title', 'head'];
    if (node.nodeType === Node.ELEMENT_NODE) {
      const tagName = node.tagName.toLowerCase();
      if (skipTags.includes(tagName)) {
        return null;
      }

      // Skip hidden elements
      if (node.offsetParent === null && getComputedStyle(node).display === 'none') {
        return null;
      }

      // Get text content (first 100 chars)
      const text = node.textContent?.trim().substring(0, 100) || '';
      
      // Get classes and ID
      const classes = Array.from(node.classList || []);
      const id = node.id || null;
      
      // Generate selector
      const selector = id ? `#${CSS.escape(id)}` : 
                      classes.length > 0 ? `.${classes[0]}` : 
                      tagName;

      // Create semantic representation
      const semanticNode = {
        type: tagName,
        text: text,
        classes: classes.slice(0, 5), // Limit to 5 classes
        id: id,
        selector: selector,
        path: path.length > 0 ? path.join(' > ') : tagName,
        children: []
      };

      // Recurse children
      const childPath = [...path, `${tagName}${id ? '#' + id : classes.length > 0 ? '.' + classes[0] : ''}`];
      for (let child of Array.from(node.children)) {
        const childNode = walkDOM(child, depth + 1, childPath);
        if (childNode && semanticNode.children.length < 20) { // Limit children
          semanticNode.children.push(childNode);
        }
      }

      return semanticNode;
    }
    return null;
  }

  // Walk the body
  for (let child of Array.from(body.children)) {
    const node = walkDOM(child, 0, []);
    if (node) {
      semanticTree.elements.push(node);
    }
  }

  return semanticTree;
}

/**
 * Convert semantic tree to string for LLM consumption
 */
function semanticTreeToString(semanticTree) {
  let output = `Page: ${semanticTree.title}\nURL: ${semanticTree.url}\n\nElements:\n\n`;

  function formatNode(node, indent = 0) {
    if (!node) return '';
    const prefix = '  '.repeat(indent);
    let result = `${prefix}- <${node.type}>`;
    
    if (node.id) result += ` #${node.id}`;
    if (node.classes.length > 0) result += ` .${node.classes.join('.')}`;
    if (node.text) result += ` "${node.text.substring(0, 50)}"`;
    result += `\n    Selector: ${node.selector}\n    Path: ${node.path}\n`;
    
    if (node.children && node.children.length > 0) {
      node.children.forEach(child => {
        result += formatNode(child, indent + 1);
      });
    }
    
    return result;
  }

  semanticTree.elements.slice(0, 50).forEach(element => {
    output += formatNode(element);
    output += '\n';
  });

  return output;
}

/**
 * Extract relevant DOM parts based on selectors and needs
 */
function extractRelevantDOM(selectors, needsCSS = false) {
  let relevantHTML = '';
  let relevantCSS = '';

  // Extract elements matching selectors
  const elements = [];
  const addedElements = new Set(); // Avoid duplicates
  
  selectors.forEach(selector => {
    try {
      const matches = document.querySelectorAll(selector);
      matches.forEach(el => {
        if (!el.hasAttribute('data-polish-extension') && !addedElements.has(el)) {
          elements.push(el);
          addedElements.add(el);
        }
      });
    } catch (e) {
      console.warn(`Invalid selector: ${selector}`, e);
    }
  });

  // Extract HTML for matched elements
  elements.slice(0, 10).forEach(el => { // Limit to 10 elements
    const clone = el.cloneNode(true);
    // Remove our extension elements from clone
    clone.querySelectorAll('[data-polish-extension]').forEach(ext => ext.remove());
    const html = clone.outerHTML;
    if (html.length > 5000) {
      relevantHTML += html.substring(0, 5000) + '\n<!-- ... truncated ... -->\n\n';
    } else {
      relevantHTML += html + '\n\n';
    }
  });

  // Extract CSS if needed
  if (needsCSS) {
    const stylesheets = Array.from(document.styleSheets);
    stylesheets.forEach(sheet => {
      try {
        const rules = Array.from(sheet.cssRules || []);
        rules.forEach(rule => {
          // Check if rule matches any of our selectors
          if (selectors.some(sel => {
            try {
              return document.querySelector(sel) && rule.selectorText && 
                     document.querySelector(sel).matches(rule.selectorText);
            } catch {
              return false;
            }
          })) {
            relevantCSS += rule.cssText + '\n';
          }
        });
      } catch (e) {
        // Cross-origin stylesheets will throw
      }
    });
  }

  return {
    html: relevantHTML.substring(0, 30000), // Limit total size
    css: relevantCSS.substring(0, 10000),
    elementCount: elements.length
  };
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}


