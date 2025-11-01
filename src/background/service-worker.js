/**
 * Background Service Worker
 * Handles Claude API communication and message routing
 */

// Import API utilities (must not use ES6 exports in service workers)
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

    case 'IDENTIFY_DOM_PARTS':
      handleIdentifyDOMParts(message.data, sendResponse);
      return true; // Keep channel open for async response

    case 'ANSWER_DOM_QUESTION':
      handleAnswerDOMQuestion(message.data, sendResponse);
      return true; // Keep channel open for async response

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
async function saveApiKey(apiKey) {
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
 * Handle identify DOM parts request (Step 1 of chat mode)
 * @param {Object} data - Request data with userQuestion and domSummary
 * @param {Function} sendResponse - Callback to send response
 */
async function handleIdentifyDOMParts(data, sendResponse) {
  try {
    const { userQuestion, domSummary } = data;
    if (!userQuestion || !domSummary) {
      sendResponse({ success: false, error: 'Missing required data: userQuestion or domSummary' });
      return;
    }

    // Get API key from storage
    const apiKey = await getApiKey();
    if (!apiKey) {
      sendResponse({ success: false, error: 'API key not found. Please set your API key.' });
      return;
    }

    console.log('Identifying relevant DOM parts...');
    const identification = await identifyRelevantDOMParts(apiKey, userQuestion, domSummary);
    console.log('Identified relevant parts:', identification);

    sendResponse({ success: true, identification: identification });
  } catch (error) {
    console.error('Error in handleIdentifyDOMParts:', error);
    sendResponse({ success: false, error: error.message || 'Failed to identify DOM parts' });
  }
}

/**
 * Handle answer DOM question request (Step 2 of chat mode)
 * @param {Object} data - Request data with userQuestion and relevantDOM
 * @param {Function} sendResponse - Callback to send response
 */
async function handleAnswerDOMQuestion(data, sendResponse) {
  try {
    const { userQuestion, relevantDOM } = data;
    if (!userQuestion || !relevantDOM) {
      sendResponse({ success: false, error: 'Missing required data: userQuestion or relevantDOM' });
      return;
    }

    // Get API key from storage
    const apiKey = await getApiKey();
    if (!apiKey) {
      sendResponse({ success: false, error: 'API key not found. Please set your API key.' });
      return;
    }

    console.log('Generating answer to DOM question...');
    const answer = await answerDOMQuestion(apiKey, userQuestion, relevantDOM);
    console.log('Answer generated');

    sendResponse({ success: true, answer: answer });
  } catch (error) {
    console.error('Error in handleAnswerDOMQuestion:', error);
    sendResponse({ success: false, error: error.message || 'Failed to answer question' });
  }
}

/**
 * Handle extension icon click - toggle overlay
 */
chrome.action.onClicked.addListener(async (tab) => {
  console.log('Extension icon clicked, toggling overlay');
  
  // Check if this is a valid page for content scripts
  if (!tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://') || tab.url.startsWith('moz-extension://')) {
    console.warn('Content scripts cannot run on this page:', tab.url);
    return;
  }
  
  // Helper function to send toggle message with retry logic
  const sendToggleMessage = async (retries = 3) => {
    for (let i = 0; i < retries; i++) {
      try {
        const response = await chrome.tabs.sendMessage(tab.id, {
          type: 'TOGGLE_OVERLAY'
        });
        console.log('Overlay toggle response:', response);
        return;
      } catch (error) {
        // If it's the last retry, check if we need to inject
        if (i === retries - 1) {
          // Check if error is because content script doesn't exist
          if (error.message && error.message.includes('Receiving end does not exist')) {
            try {
              console.log('Content script not found, ensuring it\'s injected...');
              // Inject CSS first
              await chrome.scripting.insertCSS({
                target: { tabId: tab.id },
                files: ['src/content/content.css']
              });
              // Inject JS
              await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                files: ['src/content/content.js']
              });
              
              // Wait for initialization and retry
              await new Promise(resolve => setTimeout(resolve, 200));
              await chrome.tabs.sendMessage(tab.id, { type: 'TOGGLE_OVERLAY' });
            } catch (injectionError) {
              console.error('Failed to inject content script:', injectionError);
            }
          } else {
            console.error('Failed to toggle overlay:', error);
          }
        } else {
          // Wait a bit before retrying (content script might still be initializing)
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
    }
  };
  
  await sendToggleMessage();
});

/**
 * Installation handler
 */
chrome.runtime.onInstalled.addListener((details) => {
  console.log('Polish extension installed:', details.reason);
  // API key setup is handled in the overlay UI, no options page needed
});

console.log('Polish service worker initialized');
