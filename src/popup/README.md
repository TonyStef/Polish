# Popup Scripts

**Purpose**: Extension popup - backend logic + UI reference wireframe

---

## ⚠️ IMPORTANT: Backend vs UI

This folder contains TWO types of files with DIFFERENT purposes:

| File | Type | Who Touches It | Purpose |
|------|------|----------------|---------|
| `popup.js` | **BACKEND LOGIC** | Backend team ONLY | State management, message coordination |
| `popup.html` | **UI REFERENCE** | UI team (replace entirely) | Starting point for custom design |

**Do NOT confuse these!** `popup.js` is backend code. `popup.html` is just a wireframe.

---

## 📄 Files

### `popup.js` - BACKEND LOGIC (Don't Modify)
**What it is**: Complete backend logic controller
**Who modifies**: Backend team ONLY
**Lines**: ~720
**Status**: Production-ready, fully tested

**What it does**:
- Manages application state (state machine with 8 states)
- Coordinates messages between user, content script, service worker
- Handles API key save/load from chrome.storage
- Validates all user inputs
- Manages UI state transitions
- Error handling with user-friendly messages
- Keyboard shortcuts (Enter, Ctrl+Enter, Escape)
- Focus management for accessibility

**You should NOT modify this file unless:**
- You're adding new backend features
- You're fixing bugs in the logic
- You understand the state machine architecture

### `popup.html` - UI REFERENCE (Replace Entirely)
**What it is**: Minimal wireframe showing required structure
**Who modifies**: UI team (cofounder)
**Status**: Reference/starting point only

**What it has**:
- Required element IDs that popup.js needs
- Basic HTML structure
- Minimal styling (to be replaced)
- Comments explaining what's needed

**What UI team should do**:
1. Use this as a reference for required element IDs
2. Build custom UI with your own design
3. Keep same element IDs
4. Replace minimal CSS with your styling
5. Test with popup.js (it will just work)

**You can completely replace popup.html** as long as:
- All required element IDs exist
- Elements are correct types (input, button, textarea, etc.)
- `.hidden` class hides elements with `display: none`

---

## 🔄 How It Works

### State Machine (popup.js)

```
INITIALIZING (on open)
   ↓
NO_API_KEY (if no key) ───→ READY (after saving key)
   ↓
READY (ready to select)
   ↓
SELECTING (selection mode active)
   ↓
ELEMENT_SELECTED (element chosen)
   ↓
PROCESSING (API request in progress)
   ↓
SUCCESS (brief) ───→ READY (reset)
   ↓
ERROR (show error, allow retry)
```

Each state determines:
- Which UI sections are visible
- Which buttons are enabled
- What button text shows
- Where focus goes

### Message Coordination (popup.js)

```
USER ACTION
   ↓
popup.js (validates, updates state)
   ↓
chrome.tabs.sendMessage() to content.js
   ↓
content.js processes
   ↓
Response back to popup.js
   ↓
popup.js updates UI state
```

---

## 📊 Required Element IDs (popup.html)

These element IDs MUST exist for popup.js to work:

### Sections
- `#apiKeySection` - Container for API key setup
- `#editingSection` - Container for editing UI

### API Key Elements
- `#apiKeyInput` - input[type="password"] for API key
- `#saveApiKeyBtn` - button to save key
- `#apiKeyStatus` - div for status messages

### Selection Elements
- `#toggleSelectionBtn` - button to toggle selection mode

### Element Info
- `#selectedElementInfo` - container (hidden until element selected)
- `#selectedElementTag` - span for tag name
- `#selectedElementSelector` - span for CSS selector

### Modification Elements
- `#modificationInput` - textarea for user's request
- `#applyModificationBtn` - button to apply changes
- `#modificationStatus` - div for status messages

**See**: [../../docs/DOM_CONTRACT.md](../../docs/DOM_CONTRACT.md) for complete specification

---

## 🛠️ Key Functions (popup.js)

### Initialization
- `init()` - Main initialization
- `cacheElements()` - Cache all DOM references
- `setupEventListeners()` - Attach event handlers
- `setupKeyboardShortcuts()` - Keyboard support

### State Management
- `setState(newState)` - Change state and update UI
- `updateUIForState()` - Update all UI for current state

### API Key Management
- `loadApiKey()` - Load from chrome.storage
- `handleSaveApiKey()` - Save API key
- `validateApiKeyFormat()` - Validate format

### Selection Mode
- `handleToggleSelection()` - Toggle selection mode
- `checkSelectionStatus()` - Query content script

### Element Selection
- `checkForSelectedElement()` - Query if element selected
- `updateElementInfo()` - Display element info

### Modification
- `handleApplyModification()` - Process modification request
- `validateModificationRequest()` - Validate input

### Message Passing
- `sendToContentScript(message)` - Send to content.js
- `getCurrentTab()` - Get active tab

### Error Handling
- `formatErrorMessage(error)` - User-friendly errors
- Comprehensive try-catch throughout

---

## 🎨 For UI Team (Cofounder)

### What You Need to Know

**popup.js does all the logic:**
- You don't need to understand how it works
- You don't need to modify it
- It reads/writes to DOM elements by ID
- It manages all state and messages

**Your job (popup.html):**
1. Build beautiful UI with your design
2. Use the required element IDs (see DOM_CONTRACT.md)
3. Style it however you want
4. Test that buttons/inputs work with popup.js

### Getting Started

**Step 1**: Read [../../docs/DOM_CONTRACT.md](../../docs/DOM_CONTRACT.md)
- Understand required element IDs
- See examples of customization freedom

**Step 2**: Look at current `popup.html`
- See the minimal wireframe
- Note the element IDs
- Understand the structure

**Step 3**: Build your custom UI
- Replace HTML with your design
- Keep same element IDs
- Style however you want
- Add animations, transitions, icons, etc.

**Step 4**: Test with popup.js
- Load extension in Chrome
- Test all flows
- Verify buttons work
- Check error states

### Example Customization

```html
<!-- Current minimal wireframe -->
<input id="apiKeyInput" type="password">
<button id="saveApiKeyBtn">Save</button>

<!-- Your custom version (totally fine!) -->
<div class="fancy-input-group with-icon gradient-border">
  <svg class="lock-icon">...</svg>
  <input id="apiKeyInput" type="password" class="glass-morphism-input">
  <button id="saveApiKeyBtn" class="gradient-button with-glow">
    <span class="button-text">Save Key</span>
    <svg class="save-icon">...</svg>
  </button>
</div>
```

As long as the IDs are there, it works!

---

## 🔍 Debugging popup.js

**View logs**:
```bash
1. Click extension icon to open popup
2. Right-click inside popup
3. Select "Inspect"
4. Console tab shows all logs
```

**Common logs**:
```
[Polish DEBUG] Popup initializing...
[Polish DEBUG] State transition: INITIALIZING → NO_API_KEY
[Polish INFO] API key loaded
[Polish DEBUG] Toggle selection clicked
[Polish ERROR] Failed to toggle selection mode: ...
```

**Enable debug mode**:
In `popup.js` line 19:
```javascript
const DEBUG_MODE = true; // Shows verbose logs
```

---

## ⚠️ Important Notes

**For Backend Developers**:
- Don't modify popup.html (that's for UI team)
- All logic goes in popup.js
- Follow state machine pattern
- Add tests when changing logic

**For UI Developers**:
- Don't modify popup.js (that's backend)
- Use popup.html as a starting point
- Keep element IDs exactly as specified
- Style freely within the contract

**For Both**:
- Communicate about required changes
- Test after any modifications
- Read DOM_CONTRACT.md before UI changes
- Read IMPLEMENTATION_DETAILS.md before logic changes

---

## 📖 Related Documentation

- **DOM Contract**: [../../docs/DOM_CONTRACT.md](../../docs/DOM_CONTRACT.md) ⭐ For UI team
- **Implementation Details**: [../../docs/IMPLEMENTATION_DETAILS.md](../../docs/IMPLEMENTATION_DETAILS.md) ⭐ For backend
- **Message Protocol**: [../../docs/MESSAGE_PROTOCOL.md](../../docs/MESSAGE_PROTOCOL.md)
- **Architecture**: [../../docs/BACKEND_ARCHITECTURE.md](../../docs/BACKEND_ARCHITECTURE.md)

---

**Last Updated**: 2025-11-01
**Backend**: Complete, production-ready
**UI**: Wireframe only, ready for custom design
