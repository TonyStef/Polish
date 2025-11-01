# Polish Extension - Backend Architecture Documentation

## Overview

This document explains the "backend" architecture of the Polish Chrome extension - the core logic, API integration, and DOM manipulation systems. The UI design and styling will be implemented by the frontend team.

## What We've Built (Backend/Logic Layer)

We've implemented the complete backend infrastructure:
- Chrome extension manifest and permissions
- Claude API integration
- DOM element selection system
- Element context extraction
- CSS and HTML modification application
- Message passing architecture
- Error handling and validation

**What's NOT included**: Final UI styling and design (handled by cofounder)

---

## Project Structure

```
Polish/
├── docs/
│   ├── ARCHITECTURE.md          # This file - complete system overview
│   ├── API_INTEGRATION.md       # Claude API integration details
│   └── MESSAGE_FLOW.md          # Message passing architecture
├── src/
│   ├── background/
│   │   └── service-worker.js    # Background script - API calls
│   ├── content/
│   │   ├── content.js           # Content script - DOM manipulation
│   │   └── content.css          # Selection UI styles
│   ├── popup/
│   │   ├── popup.html           # Extension popup UI (basic structure)
│   │   ├── popup.css            # Popup styles (needs cofounder's design)
│   │   └── popup.js             # Popup logic
│   └── utils/
│       ├── api.js               # Claude API wrapper
│       └── dom-parser.js        # DOM context extraction utilities
├── icons/                       # Extension icons (needs to be added)
└── manifest.json                # Chrome extension configuration
```

---

## Core Components

### 1. `manifest.json` - Chrome Extension Configuration

**Purpose**: Defines extension permissions, scripts, and metadata

**Key Features**:
- Manifest V3 (latest Chrome extension format)
- Permissions: `activeTab`, `storage`, `scripting`
- Host permissions: `<all_urls>` (works on any website)
- Defines background service worker
- Defines content scripts that run on all pages

**Related Files**: All other files referenced from here

---

### 2. `src/background/service-worker.js` - Background Service Worker

**Purpose**: Handles all Claude API communication and acts as message router

**Why it exists**:
- Chrome extensions can't make API calls directly from content scripts
- Service workers run in the background and handle async operations
- Stores and retrieves API keys securely

**Key Functions**:

```javascript
// Main message handler - routes messages from popup and content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.type) {
    case 'MODIFY_ELEMENT':      // Request to modify an element
    case 'VALIDATE_API_KEY':    // Validate user's API key
    case 'PING':                // Health check
  }
});

// Makes request to Claude API with element context
async function handleModifyElement(data, sendResponse)

// Retrieves API key from chrome.storage
async function getApiKey()
```

**Message Types It Handles**:
- `MODIFY_ELEMENT`: Receives element context + user request → calls Claude → returns modifications
- `VALIDATE_API_KEY`: Checks if API key format is valid
- `PING`: Health check from popup

**Data Flow**:
1. Receives message from content script with element context + user request
2. Retrieves API key from Chrome storage
3. Calls Claude API via `api.js`
4. Receives modifications from Claude
5. Sends modifications back to content script

---

### 3. `src/utils/api.js` - Claude API Wrapper

**Purpose**: Handles all communication with Anthropic's Claude API

**Key Functions**:

```javascript
// Main API call function
async function requestModification(apiKey, userRequest, elementContext)
  → Returns: { css_changes: string, html_changes: string, explanation: string }

// Builds the prompt for Claude
function buildPrompt(userRequest, elementContext)
  → Returns: Formatted prompt string

// Parses Claude's JSON response
function parseClaudeResponse(responseText)
  → Extracts and validates the modification object

// Validates API key format
export function validateApiKey(apiKey)
  → Returns: boolean
```

**How It Works**:

1. **Constructs Prompt**: Formats element data into a clear prompt for Claude
2. **API Request**: Makes POST request to `https://api.anthropic.com/v1/messages`
3. **Response Parsing**: Extracts JSON from Claude's response
4. **Validation**: Ensures response has required fields
5. **Error Handling**: Catches API errors, rate limits, invalid responses

**Prompt Structure**:
```
User request: "[what user wants to change]"

Current Element:
- Tag: div
- Selector: .header > div.nav:nth-child(2)
- HTML: <div>...</div>
- Computed Styles: { color: red, ... }
- CSS Rules: .nav { display: flex; ... }

Instructions: Return JSON with css_changes and html_changes
```

**Expected Claude Response**:
```json
{
  "css_changes": "color: blue; font-size: 20px;",
  "html_changes": "<div class='nav'>New content</div>",
  "explanation": "Changed color to blue and increased font size"
}
```

---

### 4. `src/utils/dom-parser.js` - DOM Context Extraction

**Purpose**: Extract comprehensive element information for Claude to analyze

**Key Functions**:

```javascript
// Main extraction function
export function extractElementContext(element)
  → Returns: {
      tagName: string,
      selector: string,
      html: string,
      computedStyles: Object,
      cssRules: string,
      classList: Array,
      id: string,
      attributes: Object
    }

// Generates unique CSS selector for element
export function generateSelector(element)
  → Returns: "div.header > nav.main:nth-child(2)"

// Gets clean HTML (removes scripts, limits depth)
function getCleanHTML(element, maxDepth = 3)

// Filters computed styles to only relevant properties
function getRelevantComputedStyles(element)

// Finds CSS rules that apply to this element
function getApplicableCSSRules(element)

// Validates if element is safe to modify
export function isSafeToModify(element)
  → Returns: boolean (false for html, head, body, script, iframe)
```

**Why Each Part Matters**:

- **Selector**: Unique identifier so we can find the element again
- **HTML**: Shows structure and content to Claude
- **Computed Styles**: Shows current visual state
- **CSS Rules**: Shows what stylesheets affect this element
- **Safety Check**: Prevents modifying critical page elements

**Optimization**:
- Limits HTML depth to prevent huge payloads
- Truncates HTML at 5000 characters
- Only includes relevant CSS properties (not all 200+)
- Skips inaccessible stylesheets (CORS)

---

### 5. `src/content/content.js` - Content Script (Main DOM Logic)

**Purpose**: Runs on every webpage to enable element selection and modification

**This is the core "backend" logic that makes everything work.**

**Key Features**:

#### A. Element Selection System
```javascript
// Toggle selection mode on/off
function toggleSelectionMode()

// Highlight elements on hover
function handleMouseOver(event)

// Select element on click
function handleClick(event)

// Visual feedback via overlay
function highlightElement(element, isSelected)
```

**How Selection Works**:
1. User clicks "Select Element" in popup
2. Popup sends `TOGGLE_SELECTION_MODE` message
3. Content script enables hover listeners
4. User hovers → element gets highlighted with blue overlay
5. User clicks → element gets selected (green overlay)
6. Selection mode disables, waiting for user's modification request

#### B. Modification Application
```javascript
// Main function to apply Claude's modifications
function applyModifications(data)

// Apply CSS changes as inline styles
function applyCSSChanges(element, cssChanges)

// Replace element HTML safely
function applyHTMLChanges(element, newHTML)

// Basic XSS protection
function sanitizeHTML(html)
```

**How Modification Works**:
1. Receives modifications from background script
2. Parses CSS rules and applies them as inline styles
3. Sanitizes HTML (removes `<script>` tags, event handlers)
4. Replaces element's HTML with new version
5. Shows success notification

#### C. Message Passing
```javascript
// Listens for messages from popup/background
chrome.runtime.onMessage.addListener(handleMessage)

// Sends messages to background script
chrome.runtime.sendMessage({ type: 'MODIFY_ELEMENT', data: {...} })

// All popup ↔ content communication uses chrome.runtime messaging

```

#### D. User Notifications
```javascript
function showNotification(message, type = 'info')
  → Types: 'info', 'success', 'error', 'loading'
```

Shows floating notifications in top-right corner:
- "Selection mode active"
- "Processing your request..."
- "Modifications applied!"
- Error messages

**Security Measures**:
- Removes `<script>` tags from Claude's HTML
- Removes `onclick`, `onload`, etc. event handlers
- Validates elements before modification
- Won't modify `<html>`, `<head>`, `<body>`, `<iframe>`

---

### 6. `src/content/content.css` - Selection UI Styles

**Purpose**: Visual styles for element selection and notifications

**What It Styles**:
- `.polish-element-overlay`: The blue/green highlight box
- `[data-polish-notification]`: Floating notification boxes
- Animations: `slideIn`, `slideOut`, `pulse`, `spin`

**Color Coding**:
- **Blue overlay** (`#3b82f6`): Element being hovered
- **Green overlay** (`#10b981`): Element selected
- **Notifications**:
  - Blue: Info
  - Green: Success
  - Red: Error
  - Orange: Loading

---

### 7. `src/popup/` - Extension Popup UI

**Purpose**: User interface for the extension (basic structure provided for cofounder)

**Files**:
- `popup.html`: HTML structure (ready for styling)
- `popup.css`: Styles (**needs cofounder's design work**)
- `popup.js`: Logic and event handlers

**Sections in UI**:
1. **API Key Setup**: Input field for user's Anthropic API key
2. **Element Selection**: Button to toggle selection mode
3. **Modification Input**: Text area for user's request
4. **Status Messages**: Shows progress and errors

**What's Implemented**:
- Basic HTML structure
- Input fields and buttons
- Logic placeholders

**What's Needed from Cofounder**:
- Visual design and branding
- CSS styling (colors, spacing, typography)
- Animations and transitions
- Icon design

---

## Message Flow Architecture

### Complete User Flow:

```
1. USER OPENS EXTENSION
   └─> popup.html loads
   └─> popup.js checks for API key in chrome.storage
   └─> Shows API key setup OR editing interface

2. USER ENTERS API KEY
   └─> popup.js saves to chrome.storage.local
   └─> Validates format (starts with 'sk-ant-')

3. USER CLICKS "SELECT ELEMENT"
   └─> popup.js → content.js: "TOGGLE_SELECTION_MODE"
   └─> content.js enables hover/click listeners
   └─> Visual feedback: cursor changes to crosshair

4. USER HOVERS OVER PAGE ELEMENTS
   └─> content.js highlights elements with blue overlay
   └─> Shows element info (tag name, classes)

5. USER CLICKS AN ELEMENT
   └─> content.js selects element (green overlay)
   └─> content.js → popup: "ELEMENT_SELECTED"
   └─> popup shows modification input field

6. USER TYPES REQUEST AND CLICKS "APPLY"
   └─> popup → content.js: user request
   └─> content.js extracts element context using dom-parser.js
   └─> content.js → service-worker.js: "MODIFY_ELEMENT" + context

7. SERVICE WORKER PROCESSES REQUEST
   └─> Retrieves API key from storage
   └─> Calls api.js → Claude API
   └─> Waits for Claude's response

8. CLAUDE PROCESSES REQUEST
   └─> Analyzes element context
   └─> Generates CSS and/or HTML changes
   └─> Returns JSON response

9. MODIFICATIONS APPLIED
   └─> service-worker.js → content.js: modifications
   └─> content.js applies CSS changes (inline styles)
   └─> content.js applies HTML changes (sanitized)
   └─> Shows success notification

10. USER SEES CHANGES LIVE
    └─> Page updates in real-time
    └─> No page refresh needed
    └─> Can make another modification or refresh to reset
```

### Message Types Reference:

| Message Type | Direction | Data | Purpose |
|-------------|-----------|------|---------|
| `TOGGLE_SELECTION_MODE` | popup → content | none | Enable/disable selection |
| `ELEMENT_SELECTED` | content → popup | selector, tagName | Notify element was selected |
| `MODIFY_ELEMENT_REQUEST` | popup → content | userRequest | Send user's modification request |
| `MODIFY_ELEMENT` | content → background | userRequest, elementContext | Request Claude API call |
| `MODIFY_ELEMENT` response | background → content | modifications | Return Claude's changes |
| `VALIDATE_API_KEY` | popup → background | apiKey | Check API key validity |

---

## Technical Decisions & Why

### 1. Why Chrome Extension Manifest V3?
- **Latest standard** (V2 is deprecated)
- **Better security** (service workers instead of background pages)
- **Future-proof** (Google requires V3 for new extensions)

### 2. Why Service Worker for API Calls?
- **CORS restrictions**: Content scripts can't make cross-origin API calls
- **Security**: API keys shouldn't be exposed in content script context
- **Performance**: Centralized API handling

### 3. Why Inline Styles for CSS Application?
- **Simplicity**: Easier to apply and doesn't require parsing CSS selectors
- **Specificity**: Inline styles override most other styles
- **Reversibility**: User can refresh page to reset
- **Trade-off**: Not as clean as injecting stylesheets, but more reliable

### 4. Why Limit HTML Depth and Length?
- **Token limits**: Claude API has input token limits
- **Cost**: Fewer tokens = cheaper API calls
- **Performance**: Faster processing
- **Relevance**: Deep nested content usually isn't relevant

### 5. Why Sanitize Claude's HTML?
- **Security**: Prevent XSS attacks if Claude generates malicious code
- **Safety**: Remove scripts that could break the page
- **Trust**: Can't 100% trust AI-generated code

### 6. Why User Provides Their Own API Key?
- **Cost**: We don't pay for API calls
- **Scalability**: No server infrastructure needed
- **Privacy**: User's requests go directly to Anthropic
- **MVP**: Simpler for proof of concept

---

## What Works (Backend Complete)

✅ Element selection with visual highlighting
✅ Element context extraction (HTML, CSS, selectors)
✅ Claude API integration with structured prompts
✅ CSS modification application
✅ HTML modification application
✅ XSS protection and sanitization
✅ Message passing between all components
✅ Error handling and user notifications
✅ API key storage and validation

## What's Needed (Frontend/UI)

⏳ Extension icon design
⏳ Popup UI styling and branding
⏳ Visual design for notifications
⏳ Animation polish
⏳ User experience refinements

---

## How to Test

1. **Load Extension**:
   - Open Chrome → `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select the `Polish` folder

2. **Set API Key**:
   - Click extension icon
   - Enter Anthropic API key (get from https://console.anthropic.com/settings/keys)
   - Click Save

3. **Test on a Website**:
   - Navigate to any website (e.g., Wikipedia, Medium)
   - Click extension icon
   - Click "Select Element"
   - Hover over elements (should see blue highlight)
   - Click an element (should see green highlight)
   - Enter a request (e.g., "make this text red and bigger")
   - Click "Apply Changes"
   - See modifications applied live

4. **Debugging**:
   - Open DevTools Console to see logs
   - Check service worker logs: `chrome://extensions/` → "service worker" link
   - Look for error messages in notifications

---

## Known Limitations (MVP)

1. **No persistence**: Changes reset on page refresh
2. **No undo/redo**: Must refresh page to reset
3. **Single element at a time**: Can't select multiple elements
4. **Basic validation**: Limited error checking
5. **No change history**: Can't see past modifications
6. **Inline styles only**: Doesn't generate proper CSS files

These are intentional for the POC. We can add these features later.

---

## Next Steps for Frontend Team

1. **Design the popup UI** (`popup.html`, `popup.css`)
2. **Create extension icons** (16x16, 48x48, 128x128 PNG)
3. **Style notifications** (improve content.css)
4. **Add branding** (colors, logo, typography)

All the backend logic is complete and ready to use.

---

## Security Considerations

⚠️ **Current Security Measures**:
- API keys stored in `chrome.storage.local` (not in code)
- HTML sanitization (removes scripts and event handlers)
- Element validation (won't modify critical elements)
- HTTPS API calls only

⚠️ **Future Improvements Needed**:
- More robust HTML sanitization (consider DOMPurify library)
- Content Security Policy enforcement
- Rate limiting on API calls
- Better error messages (don't expose sensitive data)

---

## Questions?

For any questions about the backend architecture, check:
- `docs/API_INTEGRATION.md` - Detailed API integration guide
- `docs/MESSAGE_FLOW.md` - Complete message passing diagrams
- Or read the inline comments in each source file

**Built by**: Backend team
**Last updated**: 2025-11-01
**Version**: 0.1.0 (POC)
