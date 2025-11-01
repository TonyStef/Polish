/**
 * Content Script
 * Runs on all web pages to enable element selection and modification
 */

// Import utilities (we'll use module type or inline these functions)
// For now, we'll define them inline since service workers don't support modules yet

let isSelectionMode = false;
let currentlyHighlightedElement = null;
let selectedElement = null;
let overlayElement = null;
let highlightRequestId = null; // For requestAnimationFrame throttling

/* ===========================
   MESSAGING UTILITIES (INLINED)
   =========================== */

/**
 * IMPORTANT: Chrome Extension Module Loading Constraints
 *
 * These utilities are inlined instead of imported to avoid ES6 module issues.
 * Content scripts CAN use modules but only if declared in manifest.json as type="module",
 * which we avoid to maintain compatibility and follow the "no build process" principle.
 *
 * See popup.js for full explanation of module loading constraints.
 */

/**
 * Message types for extension communication
 * @readonly
 */
const MESSAGE_TYPES = {
  TOGGLE_SELECTION_MODE: 'TOGGLE_SELECTION_MODE',
  GET_SELECTION_STATUS: 'GET_SELECTION_STATUS',
  GET_SELECTED_ELEMENT_INFO: 'GET_SELECTED_ELEMENT_INFO',
  MODIFY_ELEMENT_REQUEST: 'MODIFY_ELEMENT_REQUEST',
  ELEMENT_SELECTED: 'ELEMENT_SELECTED',
  MODIFY_ELEMENT: 'MODIFY_ELEMENT',
  VALIDATE_API_KEY: 'VALIDATE_API_KEY',
  PING: 'PING'
};

/**
 * Send message to service worker
 * @param {Object} message - Message object with {type, data}
 * @param {number} [timeout=30000] - Timeout in milliseconds
 * @returns {Promise<Object>} Response from service worker
 */
async function sendToServiceWorker(message, timeout = 30000) {
  console.log('[Polish] Sending to service worker:', message.type);

  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error(`Message "${message.type}" timed out after ${timeout}ms`));
    }, timeout);

    chrome.runtime.sendMessage(message, (response) => {
      clearTimeout(timeoutId);

      if (chrome.runtime.lastError) {
        const errorMsg = chrome.runtime.lastError.message;

        if (errorMsg.includes('Extension context invalidated')) {
          reject(new Error('Extension service unavailable. Please reload the extension.'));
        } else {
          reject(new Error(errorMsg));
        }
      } else {
        console.log('[Polish] Received response:', response);
        resolve(response || { success: false });
      }
    });
  });
}

/**
 * Format error for user display
 * @param {Error|string} error - Error to format
 * @returns {string} User-friendly error message
 */
function formatUserError(error) {
  if (!error) return 'An unknown error occurred';

  const message = error.message || String(error);
  const lowerMsg = message.toLowerCase();

  if (lowerMsg.includes('timeout')) {
    return 'Request timed out. Please try again.';
  }
  if (lowerMsg.includes('api')) {
    return message; // API errors are descriptive
  }
  if (lowerMsg.includes('service worker') || lowerMsg.includes('extension context')) {
    return 'Extension service unavailable. Please reload the extension.';
  }

  return message.substring(0, 200);
}

/**
 * Initialize the content script
 */
function init() {
  console.log('Polish content script initialized');

  // Create overlay element for highlighting
  createOverlay();

  // Listen for messages from popup/background
  chrome.runtime.onMessage.addListener(handleMessage);
}

/**
 * Handle messages from popup or background script
 */
function handleMessage(message, sender, sendResponse) {
  console.log('Content script received message:', message.type);

  switch (message.type) {
    case 'TOGGLE_SELECTION_MODE':
      toggleSelectionMode();
      sendResponse({ success: true, isActive: isSelectionMode });
      break;

    case 'APPLY_MODIFICATIONS':
      applyModifications(message.data);
      sendResponse({ success: true });
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
      return true; // Keep channel open for async response

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
  document.addEventListener('mouseenter', handleMouseOver, true);
  document.addEventListener('mouseleave', handleMouseOut, true);
  document.addEventListener('click', handleClick, true);
  document.addEventListener('scroll', handleScroll, true);

  // Change cursor to indicate selection mode
  document.body.style.cursor = 'crosshair';

  // Show notification
  showNotification('Selection mode active - Click an element to modify it');
}

/**
 * Disable selection mode - remove event listeners
 */
function disableSelectionMode() {
  document.removeEventListener('mouseenter', handleMouseOver, true);
  document.removeEventListener('mouseleave', handleMouseOut, true);
  document.removeEventListener('click', handleClick, true);
  document.removeEventListener('scroll', handleScroll, true);

  // Reset cursor
  document.body.style.cursor = '';

  // Hide overlay
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

  // Ensure element is a valid Element node (not text, comment, etc.)
  if (!(element instanceof Element)) {
    return;
  }

  // Don't highlight our own elements
  if (element.hasAttribute('data-polish-extension')) {
    return;
  }

  // Don't highlight unsafe elements
  if (!isSafeToModify(element)) {
    return;
  }

  // Only update if different element (prevents redundant redraws)
  if (currentlyHighlightedElement === element) {
    return;
  }

  currentlyHighlightedElement = element;

  // Throttle highlight updates to 60fps using requestAnimationFrame
  if (highlightRequestId) {
    cancelAnimationFrame(highlightRequestId);
  }

  highlightRequestId = requestAnimationFrame(() => {
    highlightElement(element);
    highlightRequestId = null;
  });
}

/**
 * Handle mouse out - remove highlight
 */
function handleMouseOut(event) {
  if (!isSelectionMode) return;

  event.preventDefault();
  event.stopPropagation();

  // Check if moving to a child element (keep highlight if so)
  const relatedTarget = event.relatedTarget;
  if (relatedTarget instanceof Element && currentlyHighlightedElement &&
      currentlyHighlightedElement.contains(relatedTarget)) {
    return; // Moving to child, keep highlight active
  }

  hideOverlay();
  currentlyHighlightedElement = null;
}

/**
 * Handle scroll - reposition overlay for currently highlighted element
 */
function handleScroll(event) {
  if (!isSelectionMode || !currentlyHighlightedElement) return;

  // Reposition overlay to match scrolled element
  // Using requestAnimationFrame for smooth updates
  requestAnimationFrame(() => {
    if (currentlyHighlightedElement) {
      highlightElement(currentlyHighlightedElement);
    }
  });
}

/**
 * Handle click - select element and request modification
 */
function handleClick(event) {
  if (!isSelectionMode) return;

  event.preventDefault();
  event.stopPropagation();

  const element = event.target;

  // Ensure element is a valid Element node (not text, comment, etc.)
  if (!(element instanceof Element)) {
    return;
  }

  // Don't select our own elements
  if (element.hasAttribute('data-polish-extension')) {
    return;
  }

  // Don't select unsafe elements
  if (!isSafeToModify(element)) {
    showNotification('Cannot modify this element', 'error');
    return;
  }

  selectedElement = element;
  console.log('Element selected:', element);

  // Highlight the selected element with a different style
  highlightElement(element, true);

  // Disable selection mode temporarily
  disableSelectionMode();

  // Notify popup that an element was selected
  chrome.runtime.sendMessage({
    type: 'ELEMENT_SELECTED',
    data: {
      selector: generateSelector(element),
      tagName: element.tagName.toLowerCase()
    }
  });

  showNotification('Element selected! Enter your modification request.');
}

/**
 * Handle modification request from popup
 * @param {Object} data - Contains userRequest
 * @param {Function} sendResponse - Callback to send response back to popup
 */
async function handleModificationRequest(data, sendResponse) {
  const { userRequest } = data;

  if (!selectedElement) {
    console.error('No element selected');
    sendResponse({
      success: false,
      error: 'No element selected. Please select an element first.'
    });
    return;
  }

  if (!userRequest || !userRequest.trim()) {
    sendResponse({
      success: false,
      error: 'Please enter a modification request.'
    });
    return;
  }

  console.log('Processing modification request:', userRequest);

  try {
    // Extract element context
    const elementContext = extractElementContext(selectedElement);

    // Show loading state
    showNotification('Processing your request...', 'loading');

    // Send to service worker (30s timeout for API call)
    const response = await sendToServiceWorker({
      type: MESSAGE_TYPES.MODIFY_ELEMENT,
      data: {
        userRequest,
        elementContext
      }
    }, 30000);

    if (response.success) {
      console.log('Received modifications:', response.modifications);

      // Apply the modifications
      applyModifications({
        modifications: response.modifications,
        element: selectedElement
      });

      showNotification('Modifications applied!', 'success');

      // Clear selection
      selectedElement = null;
      hideOverlay();

      sendResponse({
        success: true,
        explanation: response.modifications.explanation
      });
    } else {
      console.error('Modification failed:', response.error);
      showNotification(`Error: ${response.error}`, 'error');
      sendResponse({
        success: false,
        error: response.error
      });
    }
  } catch (error) {
    console.error('Error in handleModificationRequest:', error);

    const errorMessage = formatUserError(error);
    showNotification(`Error: ${errorMessage}`, 'error');
    sendResponse({
      success: false,
      error: errorMessage
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
    // Apply CSS changes
    if (modifications.css_changes) {
      applyCSSChanges(element, modifications.css_changes);
    }

    // Apply HTML changes
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
  // Parse CSS and apply to element
  // We'll apply it as inline styles for simplicity

  // Remove CSS comments
  const cleanCSS = cssChanges.replace(/\/\*[\s\S]*?\*\//g, '');

  // Extract CSS properties
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
    // Sanitize HTML to prevent XSS
    const sanitizedHTML = sanitizeHTML(newHTML);

    // Replace element's HTML
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
  // Create a temporary div to parse HTML
  const temp = document.createElement('div');
  temp.innerHTML = html;

  // Remove script tags
  temp.querySelectorAll('script').forEach(script => script.remove());

  // Remove event handler attributes
  const allElements = temp.querySelectorAll('*');
  allElements.forEach(el => {
    // Remove onclick, onload, etc.
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
 * Optimized with batched style updates and GPU-accelerated positioning
 */
function highlightElement(element, isSelected = false) {
  if (!overlayElement) return;

  const rect = element.getBoundingClientRect();

  // Calculate styles based on selection state
  const borderColor = isSelected ? '#10b981' : '#3b82f6';
  const bgColor = isSelected ? 'rgba(16, 185, 129, 0.1)' : 'rgba(59, 130, 246, 0.1)';
  const borderWidth = isSelected ? '3px' : '2px';

  // Single cssText assignment = 1 reflow instead of 7+
  // Using transform for GPU acceleration instead of top/left
  overlayElement.style.cssText = `
    position: absolute;
    display: block;
    pointer-events: none;
    z-index: 999999;
    box-sizing: border-box;
    top: 0;
    left: 0;
    width: ${rect.width}px;
    height: ${rect.height}px;
    transform: translate(${rect.left + window.scrollX}px, ${rect.top + window.scrollY}px);
    border: ${borderWidth} solid ${borderColor};
    background-color: ${bgColor};
    transition: all 0.15s ease-out;
  `;
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
  // Remove existing notification
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

  // Auto-remove after 3 seconds (unless it's loading)
  if (type !== 'loading') {
    setTimeout(() => {
      notification.style.animation = 'slideOut 0.3s ease-out';
      setTimeout(() => notification.remove(), 300);
    }, 3000);
  }
}

// ============================================================================
// DOM Utility Functions (copied from dom-parser.js since we can't import yet)
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
