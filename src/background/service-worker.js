/**
 * Background Service Worker
 * Handles Claude API communication and message routing
 */

// Import API utilities
importScripts('../utils/api.js');

/**
 * Message listener - handles messages from content script and popup
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Service worker received message:', message.type);

  switch (message.type) {
    case 'MODIFY_ELEMENT':
      handleModifyElement(message.data, sendResponse);
      return true; // Keep channel open for async response

    case 'VALIDATE_API_KEY':
      handleValidateApiKey(message.data, sendResponse);
      return true;

    case 'PING':
      sendResponse({ success: true, message: 'Service worker is alive' });
      return false;

    default:
      sendResponse({ success: false, error: 'Unknown message type' });
      return false;
  }
});

/**
 * Handle element modification request
 * @param {Object} data - Request data with userRequest and elementContext
 * @param {Function} sendResponse - Callback to send response
 */
async function handleModifyElement(data, sendResponse) {
  try {
    const { userRequest, elementContext } = data;

    if (!userRequest || !elementContext) {
      sendResponse({
        success: false,
        error: 'Missing required data: userRequest or elementContext'
      });
      return;
    }

    // Get API key from storage
    const apiKey = await getApiKey();

    if (!apiKey) {
      sendResponse({
        success: false,
        error: 'API key not found. Please set your API key in the extension popup.'
      });
      return;
    }

    console.log('Making request to Claude API...');
    console.log('User request:', userRequest);
    console.log('Element context:', elementContext);

    // Make request to Claude API
    const modifications = await requestModification(apiKey, userRequest, elementContext);

    console.log('Received modifications from Claude:', modifications);

    sendResponse({
      success: true,
      modifications: modifications
    });

  } catch (error) {
    console.error('Error in handleModifyElement:', error);

    sendResponse({
      success: false,
      error: error.message || 'Failed to process modification request'
    });
  }
}

/**
 * Handle API key validation
 * @param {Object} data - Data with apiKey
 * @param {Function} sendResponse - Callback
 */
function handleValidateApiKey(data, sendResponse) {
  const { apiKey } = data;

  const isValid = validateApiKey(apiKey);

  sendResponse({
    success: true,
    isValid: isValid
  });
}

/**
 * Get API key from Chrome storage
 * @returns {Promise<string|null>} - API key or null
 */
async function getApiKey() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['anthropicApiKey'], (result) => {
      resolve(result.anthropicApiKey || null);
    });
  });
}

/**
 * Save API key to Chrome storage
 * @param {string} apiKey - API key to save
 * @returns {Promise<void>}
 */
export async function saveApiKey(apiKey) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.set({ anthropicApiKey: apiKey }, () => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve();
      }
    });
  });
}

/**
 * Installation handler
 */
chrome.runtime.onInstalled.addListener((details) => {
  console.log('Polish extension installed:', details.reason);

  if (details.reason === 'install') {
    // Open options page on first install
    chrome.runtime.openOptionsPage();
  }
});

console.log('Polish service worker initialized');
