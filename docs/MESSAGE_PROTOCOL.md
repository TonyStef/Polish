# Message Protocol Specification

**Version**: 0.1.0
**Purpose**: Complete specification of all message types used in Polish extension

---

## Overview

The Polish extension uses Chrome's message passing API for communication between components:
- `chrome.tabs.sendMessage()` - Popup → Content Script
- `chrome.runtime.sendMessage()` - Content Script → Background / Popup
- `chrome.runtime.onMessage.addListener()` - Receive messages

---

## Message Format

All messages follow this structure:

```javascript
{
  type: 'MESSAGE_TYPE',    // Required: Message type identifier
  data: { ... }            // Optional: Message payload
}
```

**Response Format**:

```javascript
{
  success: boolean,        // Required: Whether operation succeeded
  ...additionalFields      // Optional: Response-specific fields
}
```

---

## Messages: Popup → Content Script

### 1. TOGGLE_SELECTION_MODE

**Purpose**: Toggle element selection mode on/off
**Direction**: popup.js → content.js
**When**: User clicks "Select Element" or "Cancel Selection" button

**Request**:
```javascript
{
  type: 'TOGGLE_SELECTION_MODE'
}
```

**Response**:
```javascript
{
  success: true,
  isActive: boolean  // true if selection mode now active, false if deactivated
}
```

**Example Usage**:
```javascript
// popup.js
const response = await sendToContentScript({
  type: 'TOGGLE_SELECTION_MODE'
});

if (response.success) {
  setState(response.isActive ? STATES.SELECTING : STATES.READY);
}
```

**Error Cases**:
- Content script not loaded: `chrome.runtime.lastError`
- Timeout after 5 seconds

---

### 2. GET_SELECTION_STATUS

**Purpose**: Query current selection mode status
**Direction**: popup.js → content.js
**When**: Popup initializes (to restore state if needed)

**Request**:
```javascript
{
  type: 'GET_SELECTION_STATUS'
}
```

**Response**:
```javascript
{
  success: true,
  isActive: boolean  // true if selection mode currently active
}
```

**Example Usage**:
```javascript
// popup.js - during initialization
const response = await sendToContentScript({
  type: 'GET_SELECTION_STATUS'
});

if (response.isActive) {
  setState(STATES.SELECTING);
}
```

---

### 3. GET_SELECTED_ELEMENT_INFO

**Purpose**: Query if content script has an element selected
**Direction**: popup.js → content.js
**When**: Popup initializes (to restore state if popup was closed during selection)

**Request**:
```javascript
{
  type: 'GET_SELECTED_ELEMENT_INFO'
}
```

**Response (when element is selected)**:
```javascript
{
  success: true,
  hasSelection: true,
  selector: string,  // CSS selector for element
  tagName: string    // Element tag name (lowercase)
}
```

**Response (when no element selected)**:
```javascript
{
  success: true,
  hasSelection: false
}
```

**Example Usage**:
```javascript
// popup.js - during initialization
const response = await sendToContentScript({
  type: 'GET_SELECTED_ELEMENT_INFO'
});

if (response.hasSelection) {
  state.selectedElement = {
    selector: response.selector,
    tagName: response.tagName
  };
  setState(STATES.ELEMENT_SELECTED);
}
```

---

### 4. MODIFY_ELEMENT_REQUEST

**Purpose**: Send user's modification request to content script
**Direction**: popup.js → content.js
**When**: User submits modification request

**Request**:
```javascript
{
  type: 'MODIFY_ELEMENT_REQUEST',
  data: {
    userRequest: string  // User's plain-English modification request
  }
}
```

**Success Response**:
```javascript
{
  success: true,
  explanation: string  // Optional: What was changed
}
```

**Error Response**:
```javascript
{
  success: false,
  error: string  // Error message
}
```

**Example Usage**:
```javascript
// popup.js
const response = await sendToContentScript({
  type: 'MODIFY_ELEMENT_REQUEST',
  data: {
    userRequest: 'Make this button blue and larger'
  }
}, 10000); // Longer timeout for API call

if (response.success) {
  showSuccess('Modifications applied!');
} else {
  showError(response.error);
}
```

**Error Cases**:
- No element selected: `"No element selected. Please select an element first."`
- Empty request: `"Please enter a modification request."`
- API error: From service worker (e.g., "API rate limit exceeded")
- Network timeout: After 10 seconds

**Note**: This is a long-running operation (2-10 seconds) because it:
1. Extracts element context
2. Calls service worker
3. Service worker calls Claude API (2-10 seconds)
4. Applies modifications
5. Returns response

---

## Messages: Content Script → Popup

### 1. ELEMENT_SELECTED

**Purpose**: Notify popup that user selected an element on page
**Direction**: content.js → popup.js
**When**: User clicks an element while in selection mode

**Message**:
```javascript
{
  type: 'ELEMENT_SELECTED',
  data: {
    selector: string,  // CSS selector for the selected element
    tagName: string    // Element tag name (lowercase)
  }
}
```

**Example**:
```javascript
// content.js - when element is clicked
chrome.runtime.sendMessage({
  type: 'ELEMENT_SELECTED',
  data: {
    selector: 'div.header > button.cta:nth-child(2)',
    tagName: 'button'
  }
});
```

**Popup Handler**:
```javascript
// popup.js
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'ELEMENT_SELECTED') {
    state.selectedElement = message.data;
    setState(STATES.ELEMENT_SELECTED);
    sendResponse({ received: true });
  }
});
```

**Important**: Popup might be closed when this message is sent. That's okay - content script keeps the selection, and popup will query it on next open.

---

## Messages: Content Script → Service Worker

### 1. MODIFY_ELEMENT

**Purpose**: Request modification from Claude API
**Direction**: content.js → service-worker.js
**When**: Processing user's modification request

**Request**:
```javascript
{
  type: 'MODIFY_ELEMENT',
  data: {
    userRequest: string,      // User's modification request
    elementContext: {
      tagName: string,        // Element tag name
      selector: string,       // CSS selector
      html: string,           // Element HTML (truncated to 5000 chars)
      computedStyles: Object, // Relevant computed styles
      cssRules: string,       // Applicable CSS rules (up to 20)
      classList: Array,       // Element classes
      id: string | null      // Element ID if exists
    }
  }
}
```

**Success Response**:
```javascript
{
  success: true,
  modifications: {
    css_changes: string,   // CSS rules to apply
    html_changes: string,  // New HTML if needed (or empty string)
    explanation: string    // What was changed
  }
}
```

**Error Response**:
```javascript
{
  success: false,
  error: string  // Error message from API or service worker
}
```

**Example Element Context**:
```javascript
{
  tagName: 'button',
  selector: 'div.hero > button.primary:nth-child(1)',
  html: '<button class="primary">Click Me</button>',
  computedStyles: {
    'background-color': 'rgb(59, 130, 246)',
    'color': 'rgb(255, 255, 255)',
    'padding': '12px 24px',
    'border-radius': '8px',
    'font-size': '16px'
  },
  cssRules: '.primary { background: #3b82f6; color: white; }',
  classList: ['primary'],
  id: null
}
```

**Example Modifications Response**:
```javascript
{
  success: true,
  modifications: {
    css_changes: 'background-color: #10b981; padding: 16px 32px; font-size: 18px;',
    html_changes: '',
    explanation: 'Changed background to green, increased padding and font size'
  }
}
```

---

## Messages: Popup → Service Worker

### 1. VALIDATE_API_KEY (Optional)

**Purpose**: Validate API key with Anthropic
**Direction**: popup.js → service-worker.js
**When**: (Optional) When user saves API key, to verify it works

**Request**:
```javascript
{
  type: 'VALIDATE_API_KEY',
  data: {
    apiKey: string  // API key to validate
  }
}
```

**Response**:
```javascript
{
  success: true,
  isValid: boolean  // true if key format is valid
}
```

**Note**: Currently only validates format (starts with 'sk-ant-', length > 20). Full API validation not implemented in POC.

---

### 2. PING

**Purpose**: Health check for service worker
**Direction**: popup.js → service-worker.js
**When**: (Optional) To verify service worker is responsive

**Request**:
```javascript
{
  type: 'PING'
}
```

**Response**:
```javascript
{
  success: true,
  message: 'Service worker is alive'
}
```

---

## Message Timeouts

Different operations have different timeout thresholds:

| Operation | Timeout | Reason |
|-----------|---------|--------|
| TOGGLE_SELECTION_MODE | 5s | Should be instant |
| GET_SELECTION_STATUS | 5s | Should be instant |
| GET_SELECTED_ELEMENT_INFO | 5s | Should be instant |
| MODIFY_ELEMENT_REQUEST | 10s | Includes Claude API call |
| MODIFY_ELEMENT (to service worker) | 30s | Claude API can be slow |

**Implementation**:
```javascript
const response = await Promise.race([
  sendMessage(message),
  timeout(MESSAGE_TIMEOUT)
]);
```

---

## Error Handling

### Standard Error Response

All failed operations return:
```javascript
{
  success: false,
  error: string  // User-friendly error message
}
```

### Common Errors

**Connection Errors**:
```javascript
{
  success: false,
  error: 'Could not establish connection. Receiving end does not exist.'
}
```
→ User message: "Could not connect to the page. Please refresh and try again."

**Timeout Errors**:
```javascript
{
  success: false,
  error: 'Message timeout'
}
```
→ User message: "Request timed out. Please try again."

**Validation Errors**:
```javascript
{
  success: false,
  error: 'No element selected. Please select an element first.'
}
```
→ User message: Same as error (already user-friendly)

**API Errors**:
```javascript
{
  success: false,
  error: 'Claude API error: 429 - Too many requests'
}
```
→ User message: "API rate limit reached. Please wait a moment and try again."

---

## Message Flow Diagrams

### Flow 1: Toggle Selection Mode

```
User clicks "Select Element"
   ↓
popup.js: handleToggleSelection()
   ↓
chrome.tabs.sendMessage({ type: 'TOGGLE_SELECTION_MODE' })
   ↓
content.js: handleMessage()
   ↓
content.js: toggleSelectionMode()
   ↓
content.js: enableSelectionMode()
   ↓
content.js: sendResponse({ success: true, isActive: true })
   ↓
popup.js: receives response
   ↓
popup.js: setState(STATES.SELECTING)
```

### Flow 2: Element Selection

```
User clicks element on page (while in selection mode)
   ↓
content.js: handleClick()
   ↓
content.js: validates element is safe
   ↓
content.js: selectedElement = element
   ↓
content.js: chrome.runtime.sendMessage({ type: 'ELEMENT_SELECTED', data: {...} })
   ↓
popup.js: chrome.runtime.onMessage.addListener()
   ↓
popup.js: state.selectedElement = message.data
   ↓
popup.js: setState(STATES.ELEMENT_SELECTED)
```

### Flow 3: Modification Request (Complete)

```
User types request and clicks "Apply Changes"
   ↓
popup.js: handleApplyModification()
   ↓
popup.js: validates request
   ↓
popup.js: setState(STATES.PROCESSING)
   ↓
popup.js: chrome.tabs.sendMessage({ type: 'MODIFY_ELEMENT_REQUEST', data: { userRequest } })
   ↓
content.js: handleMessage() → handleModificationRequest()
   ↓
content.js: validates selectedElement exists
   ↓
content.js: extractElementContext(selectedElement)
   ↓
content.js: chrome.runtime.sendMessage({ type: 'MODIFY_ELEMENT', data: { userRequest, elementContext } })
   ↓
service-worker.js: handleModifyElement()
   ↓
service-worker.js: getApiKey() from chrome.storage
   ↓
service-worker.js: requestModification() → Claude API (2-10 seconds)
   ↓
service-worker.js: receives modifications from Claude
   ↓
service-worker.js: sendResponse({ success: true, modifications: {...} })
   ↓
content.js: receives response from service worker
   ↓
content.js: applyModifications(modifications, element)
   ↓
content.js: showNotification('Modifications applied!', 'success')
   ↓
content.js: sendResponse({ success: true }) to popup
   ↓
popup.js: receives response
   ↓
popup.js: setState(STATES.SUCCESS)
   ↓
popup.js: after 1 second → setState(STATES.READY)
```

---

## Chrome API Methods Used

### Sending Messages

**From popup to content script** (specific tab):
```javascript
chrome.tabs.sendMessage(tabId, message, callback);
```

**From content script to service worker** (or popup):
```javascript
chrome.runtime.sendMessage(message, callback);
```

### Receiving Messages

**In any script**:
```javascript
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Handle message
  sendResponse(response);
  return true; // Keep channel open for async response
});
```

**Important**: Return `true` from listener if sending response asynchronously!

---

## Testing Message Flow

### Manual Testing Procedure

1. **Open DevTools for each component**:
   - Popup: Right-click popup → Inspect
   - Service worker: chrome://extensions/ → Service worker
   - Content script: Page DevTools → Console

2. **Add logging**:
```javascript
// In each component
console.log('[Polish] Sending:', message.type);
console.log('[Polish] Received:', message.type);
```

3. **Test each flow**:
   - Toggle selection → Verify logs in popup AND content script
   - Select element → Verify message from content to popup
   - Submit modification → Verify popup → content → service worker → Claude

4. **Test error cases**:
   - Refresh page during operation
   - Close popup during processing
   - Enter invalid data
   - Timeout (disconnect network)

---

## Debugging Tips

### Enable Verbose Logging

In each file, add:
```javascript
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[Component] Received:', message);
  // ... handle message
  console.log('[Component] Responding:', response);
  sendResponse(response);
});
```

### Common Issues

**"Unchecked runtime.lastError: The message port closed before a response was received"**
- Cause: Forgot to call `sendResponse()` or return `true`
- Fix: Always call `sendResponse()` and return `true` for async

**"Could not establish connection"**
- Cause: Content script not loaded on page
- Fix: User needs to refresh page

**Messages never arrive**
- Cause: Wrong message type or missing listener
- Fix: Check message type spelling, verify listener exists

**Response is undefined**
- Cause: Content script/service worker returned nothing
- Fix: Always return `{ success: boolean, ... }`

---

## Version History

**v0.1.0** (2025-11-01):
- Initial message protocol
- All message types defined
- Error handling specified
- Timeout thresholds set

---

## Future Enhancements

Potential future message types:

- `UNDO_MODIFICATION` - Undo last change
- `GET_MODIFICATION_HISTORY` - Get list of all changes
- `CLEAR_ALL_MODIFICATIONS` - Reset all changes
- `EXPORT_MODIFICATIONS` - Export changes as CSS file
- `APPLY_TEMPLATE` - Apply predefined modification template

---

**Last Updated**: 2025-11-01
**Status**: Complete
**For**: Development Team
