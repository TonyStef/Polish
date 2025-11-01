# Source Code - Polish Extension

This folder contains all source code for the Polish Chrome extension backend.

---

## 📁 Folder Structure

```
src/
├── background/     → Background service worker (API handler)
├── content/        → Content scripts (run on web pages)
├── popup/          → Popup scripts (backend logic + UI reference)
└── utils/          → Shared utilities (API, DOM parsing)
```

---

## 🎯 What Each Folder Does

### `background/`
**Purpose**: Handles Claude API communication in the background
**Runs**: In extension context (always alive)
**Key File**: `service-worker.js`
**Does**:
- Receives modification requests
- Calls Claude API
- Returns modifications to content script
- Manages API key from storage

**Read**: [background/README.md](background/README.md)

---

### `content/`
**Purpose**: Runs on every web page for element selection and modification
**Runs**: In page context (with Chrome APIs)
**Key Files**:
- `content.js` - Element selection, DOM manipulation
- `content.css` - Selection UI styles

**Does**:
- Highlights elements on hover
- Captures element context
- Applies modifications
- Shows notifications

**Read**: [content/README.md](content/README.md)

---

### `popup/`
**Purpose**: Extension popup UI and backend logic
**Runs**: When user clicks extension icon
**Key Files**:
- `popup.js` - **BACKEND LOGIC** (state machine, message coordination)
- `popup.html` - **REFERENCE WIREFRAME** (for UI team to start from)

**Does**:
- Manages application state
- Coordinates between user and content script
- Handles API key storage
- Manages UI state transitions

**⚠️ IMPORTANT**:
- `popup.js` = Backend logic (DON'T MODIFY unless you're backend team)
- `popup.html` = Reference wireframe (UI team REPLACES this with custom design)

**Read**: [popup/README.md](popup/README.md)

---

### `utils/`
**Purpose**: Shared utility functions used across the extension
**Runs**: Wherever imported
**Key Files**:
- `api.js` - Claude API wrapper
- `dom-parser.js` - DOM context extraction

**Does**:
- Makes API calls to Claude
- Parses and validates API responses
- Extracts element information
- Generates CSS selectors

**Read**: [utils/README.md](utils/README.md)

---

## 🔄 How Components Connect

```
USER ACTION
   ↓
popup.js (coordinates action)
   ↓
chrome.tabs.sendMessage()
   ↓
content.js (executes on page)
   ↓
chrome.runtime.sendMessage()
   ↓
service-worker.js (calls API)
   ↓
utils/api.js (makes request)
   ↓
Claude API (processes request)
   ↓
Response flows back up the chain
```

**Detailed flow**: See [../docs/MESSAGE_PROTOCOL.md](../docs/MESSAGE_PROTOCOL.md)

---

## 📊 File Responsibilities

| File | Responsibility | Can Modify? |
|------|---------------|-------------|
| `background/service-worker.js` | API calls | Backend only |
| `content/content.js` | DOM manipulation | Backend only |
| `content/content.css` | Selection styles | Backend or UI |
| `popup/popup.js` | State management | Backend only |
| `popup/popup.html` | UI structure | UI team (replace) |
| `utils/api.js` | API wrapper | Backend only |
| `utils/dom-parser.js` | DOM parsing | Backend only |

---

## 🛠️ Development Workflow

### For Backend Developers

**Making changes:**
1. Understand component architecture (this file)
2. Read specific folder README
3. Check message protocol if changing communication
4. Make changes
5. Test end-to-end

**Don't modify:**
- `popup.html` (that's for UI team)

### For UI Developers

**Building the interface:**
1. Read [popup/README.md](popup/README.md)
2. Read [../docs/DOM_CONTRACT.md](../docs/DOM_CONTRACT.md)
3. Use `popup.html` as starting point
4. Replace with your custom design
5. Keep element IDs exactly as specified

**Don't modify:**
- `popup.js` (backend logic)
- Other .js files (all backend)

---

## 🧪 Testing

**Load extension:**
```bash
1. Open chrome://extensions/
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select Polish folder
```

**Test each component:**
- Background: Check service worker console
- Content: Check page DevTools console
- Popup: Right-click popup → Inspect

**See**: [../docs/IMPLEMENTATION_DETAILS.md](../docs/IMPLEMENTATION_DETAILS.md) for complete testing guide

---

## 📖 Documentation

- **Architecture**: [../docs/BACKEND_ARCHITECTURE.md](../docs/BACKEND_ARCHITECTURE.md)
- **Implementation**: [../docs/IMPLEMENTATION_DETAILS.md](../docs/IMPLEMENTATION_DETAILS.md)
- **Messages**: [../docs/MESSAGE_PROTOCOL.md](../docs/MESSAGE_PROTOCOL.md)
- **UI Contract**: [../docs/DOM_CONTRACT.md](../docs/DOM_CONTRACT.md)

---

## 🚀 Quick Start

**For backend work:**
```bash
1. Read BACKEND_ARCHITECTURE.md
2. Find the component you need to modify
3. Read that folder's README.md
4. Make changes
5. Test in Chrome
```

**For UI work:**
```bash
1. Read DOM_CONTRACT.md
2. Read popup/README.md
3. Start with popup/popup.html
4. Build your custom UI
5. Test in Chrome
```

---

**Last Updated**: 2025-11-01
**Maintainer**: Backend Team
