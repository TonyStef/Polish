# Background Service Worker

**Purpose**: Handles all Claude API communication and message routing

---

## 📄 Files

### `service-worker.js`
**What it does**:
- Receives modification requests from content script
- Retrieves API key from chrome.storage
- Calls Claude API via `../utils/api.js`
- Returns modifications to content script
- Validates API keys
- Handles API errors

**Entry points** (message handlers):
- `MODIFY_ELEMENT` - Process modification request
- `VALIDATE_API_KEY` - Validate API key format
- `PING` - Health check

---

## 🔄 How It Works

```
content.js sends: { type: 'MODIFY_ELEMENT', data: { userRequest, elementContext } }
   ↓
service-worker.js receives message
   ↓
getApiKey() from chrome.storage.local
   ↓
requestModification(apiKey, userRequest, elementContext)
   (calls ../utils/api.js)
   ↓
Claude API processes (2-10 seconds)
   ↓
Returns: { success: true, modifications: { css_changes, html_changes, explanation } }
   ↓
content.js receives response and applies modifications
```

---

## 🔌 Dependencies

**Internal**:
- `../utils/api.js` - Claude API wrapper (imported via `importScripts()`)

**Chrome APIs**:
- `chrome.runtime.onMessage` - Receive messages
- `chrome.storage.local` - API key storage

---

## 📊 Message Types Handled

### MODIFY_ELEMENT
**From**: content.js
**Request**:
```javascript
{
  type: 'MODIFY_ELEMENT',
  data: {
    userRequest: string,
    elementContext: {
      tagName, selector, html, computedStyles, cssRules, classList, id
    }
  }
}
```

**Response (success)**:
```javascript
{
  success: true,
  modifications: {
    css_changes: string,
    html_changes: string,
    explanation: string
  }
}
```

**Response (error)**:
```javascript
{
  success: false,
  error: string
}
```

### VALIDATE_API_KEY
**From**: popup.js (optional)
**Request**:
```javascript
{
  type: 'VALIDATE_API_KEY',
  data: { apiKey: string }
}
```

**Response**:
```javascript
{
  success: true,
  isValid: boolean
}
```

### PING
**From**: popup.js (health check)
**Response**:
```javascript
{
  success: true,
  message: 'Service worker is alive'
}
```

---

## 🛠️ Key Functions

### `handleModifyElement(data, sendResponse)`
Main modification handler

### `async getApiKey()`
Retrieves API key from chrome.storage

### `handleValidateApiKey(data, sendResponse)`
Validates API key format

---

## ⚠️ Error Handling

**Errors caught**:
- Missing API key → "API key not found. Please set your API key in the extension popup."
- Missing data → "Missing required data: userRequest or elementContext"
- API call fails → Error message from Claude API
- Network timeout → Handled by api.js

**All errors returned**:
```javascript
{
  success: false,
  error: "user-friendly error message"
}
```

---

## 🔍 Debugging

**View logs**:
```bash
1. Go to chrome://extensions/
2. Find Polish extension
3. Click "service worker" link
4. Console opens with all logs
```

**Common logs**:
```
Service worker received message: MODIFY_ELEMENT
Making request to Claude API...
User request: "Make this button blue"
Element context: {...}
Received modifications from Claude: {...}
```

---

## 📖 Related Documentation

- **API Integration**: [../../docs/IMPLEMENTATION_DETAILS.md](../../docs/IMPLEMENTATION_DETAILS.md)
- **Message Protocol**: [../../docs/MESSAGE_PROTOCOL.md](../../docs/MESSAGE_PROTOCOL.md)
- **Architecture**: [../../docs/BACKEND_ARCHITECTURE.md](../../docs/BACKEND_ARCHITECTURE.md)

---

**Last Updated**: 2025-11-01
