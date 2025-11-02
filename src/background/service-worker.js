/**
 * Background Service Worker
 * Handles Claude API communication and message routing
 */

// Import API utilities (must not use ES6 exports in service workers)
importScripts('../utils/api.js');
importScripts('../utils/github-api.js');

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

    case 'PERFORM_DOM_TASK':
      handlePerformDOMTask(message.data, sendResponse);
      return true; // Keep channel open for async response

    case 'VALIDATE_GITHUB':
      handleValidateGitHub(message.token, message.repo, sendResponse);
      return true; // Keep channel open for async response

    case 'PUBLISH_TO_GITHUB':
      handlePublishToGitHub(message.data, sendResponse);
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
 * Handle perform DOM task request (for auto mode)
 * @param {Object} data - Request data with userRequest, relevantDOM, and relevantSelectors
 * @param {Function} sendResponse - Callback to send response
 */
async function handlePerformDOMTask(data, sendResponse) {
  try {
    const { userRequest, relevantDOM, relevantSelectors } = data;
    if (!userRequest || !relevantDOM) {
      sendResponse({ success: false, error: 'Missing required data: userRequest or relevantDOM' });
      return;
    }

    // Get API key from storage
    const apiKey = await getApiKey();
    if (!apiKey) {
      sendResponse({ success: false, error: 'API key not found. Please set your API key.' });
      return;
    }

    console.log('Performing DOM task...');
    const modifications = await performDOMTask(apiKey, userRequest, relevantDOM, relevantSelectors || []);
    console.log('Task modifications generated:', modifications);

    sendResponse({ success: true, modifications: modifications });
  } catch (error) {
    console.error('Error in handlePerformDOMTask:', error);
    sendResponse({ success: false, error: error.message || 'Failed to perform task' });
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
 * Handle GitHub validation request
 * @param {string} token - GitHub Personal Access Token
 * @param {string} repo - Repository in format "owner/repo"
 * @param {Function} sendResponse - Callback to send response
 */
async function handleValidateGitHub(token, repo, sendResponse) {
  try {
    console.log('Validating GitHub connection...');

    // Use validateConnection from github-api.js
    const result = await validateConnection(token, repo);

    console.log('GitHub validation result:', result);
    sendResponse(result);

  } catch (error) {
    console.error('Error validating GitHub:', error);
    sendResponse({
      valid: false,
      error: error.message || 'Failed to validate GitHub connection',
      errorType: error.name
    });
  }
}

/**
 * Handle publish to GitHub request
 * @param {Object} data - Request data with token, repo, branch info, and files
 * @param {Function} sendResponse - Callback to send response
 */
async function handlePublishToGitHub(data, sendResponse) {
  try {
    const { token, repo, baseBranch, branchName, files } = data;

    if (!token || !repo || !branchName || !files) {
      throw new Error('Missing required data for GitHub publish');
    }

    console.log('Publishing to GitHub:', { repo, baseBranch, branchName });

    // Get base branch SHA
    const baseRef = await getBranchRef(token, repo, baseBranch);
    const baseSha = baseRef.object.sha;

    // Create new branch
    await createBranch(token, repo, branchName, baseSha);
    console.log('Branch created:', branchName);

    // Commit all files
    const commitResults = [];
    for (const file of files) {
      const result = await createOrUpdateFile(
        token,
        repo,
        file.path,
        file.content,
        file.message || `Polish: Add ${file.path}`,
        branchName
      );
      commitResults.push(result);
      console.log('File committed:', file.path);
    }

    const branchUrl = `https://github.com/${repo}/tree/${branchName}`;

    sendResponse({
      success: true,
      branchName,
      branchUrl,
      commitResults
    });

  } catch (error) {
    console.error('Error publishing to GitHub:', error);
    sendResponse({
      success: false,
      error: error.message || 'Failed to publish to GitHub',
      errorType: error.name
    });
  }
}

/**
 * Installation handler
 */
chrome.runtime.onInstalled.addListener((details) => {
  console.log('Polish extension installed:', details.reason);
  // API key setup is handled in the overlay UI, no options page needed
});

console.log('Polish service worker initialized');
