# Content Scripts

**Purpose**: Runs on every web page to enable element selection and modification

---

## 📄 Files

### `content.js`
**What it does**:
- Enables element selection mode (hover + click)
- Highlights elements with visual overlay
- Captures element context (HTML, CSS, selector)
- Sends modification requests to service worker
- Applies CSS and HTML modifications
- Shows notifications to user
- Handles all message types from popup

**Lines**: ~660
**State**: Production-ready

### `content.css`
**What it does**:
- Styles for element selection overlay
- Notification animations
- Visual feedback (blue for hover, green for selected)

---

## 🔄 How It Works

### Element Selection Flow

```
1. User clicks "Select Element" in popup
   ↓
2. popup.js sends TOGGLE_SELECTION_MODE message
   ↓
3. content.js enables selection mode
   ↓
4. Adds mouseover, mouseout, click listeners
   ↓
5. User hovers elements → Blue highlight appears
   ↓
6. User clicks element → Green highlight, selection mode off
   ↓
7. Sends ELEMENT_SELECTED message to popup
   ↓
8. Popup shows element info, enables modification input
```

### Modification Flow

```
1. User enters request in popup and submits
   ↓
2. popup.js sends MODIFY_ELEMENT_REQUEST
   ↓
3. content.js validates selectedElement exists
   ↓
4. extractElementContext(selectedElement)
   ↓
5. Sends MODIFY_ELEMENT to service-worker.js
   ↓
6. service-worker calls Claude API (2-10 seconds)
   ↓
7. content.js receives modifications
   ↓
8. applyCSSChanges() and/or applyHTMLChanges()
   ↓
9. Shows success notification
   ↓
10. Sends success response to popup
```

---

## 📊 Message Types Handled

### From Popup

**TOGGLE_SELECTION_MODE**
- Toggles selection mode on/off
- Response: `{ success: true, isActive: boolean }`

**GET_SELECTION_STATUS**
- Returns current selection mode state
- Response: `{ success: true, isActive: boolean }`

**GET_SELECTED_ELEMENT_INFO**
- Returns info about selected element (or null)
- Response: `{ success: true, hasSelection: boolean, selector, tagName }`

**MODIFY_ELEMENT_REQUEST**
- Processes user's modification request
- Sends to service worker
- Applies modifications
- Response: `{ success: true }` or `{ success: false, error: string }`

**APPLY_MODIFICATIONS** (legacy)
- Directly apply modifications
- Response: `{ success: true }`

### To Popup

**ELEMENT_SELECTED**
- Sent when user clicks an element
- Data: `{ selector: string, tagName: string }`

### To Service Worker

**MODIFY_ELEMENT**
- Request modification from Claude
- Data: `{ userRequest: string, elementContext: {...} }`

---

## 🛠️ Key Functions

### Selection Mode

**`toggleSelectionMode()`**
- Toggles selection on/off

**`enableSelectionMode()`**
- Adds event listeners (mouseover, mouseout, click)
- Changes cursor to crosshair
- Shows notification

**`disableSelectionMode()`**
- Removes event listeners
- Resets cursor
- Hides overlay

**`handleClick(event)`**
- Captures clicked element
- Validates it's safe to modify
- Sends ELEMENT_SELECTED message
- Disables selection mode

### Element Highlighting

**`highlightElement(element, isSelected)`**
- Shows blue or green overlay
- Positions overlay over element

**`hideOverlay()`**
- Hides overlay

**`createOverlay()`**
- Creates DOM element for highlighting

### Modification Handling

**`handleModificationRequest(data, sendResponse)`**
- Main modification handler (NEW)
- Validates input
- Extracts element context
- Calls service worker
- Applies modifications

**`applyModifications(data)`**
- Applies CSS and/or HTML changes

**`applyCSSChanges(element, cssChanges)`**
- Parses CSS string
- Applies as inline styles

**`applyHTMLChanges(element, newHTML)`**
- Sanitizes HTML
- Replaces element.outerHTML

**`sanitizeHTML(html)`**
- Removes `<script>` tags
- Removes event handler attributes (onclick, etc.)

### DOM Utilities (inline copies from utils/dom-parser.js)

**`extractElementContext(element)`**
- Extracts tag, selector, HTML, styles, CSS rules

**`generateSelector(element)`**
- Generates unique CSS selector

**`getCleanHTML(element)`**
- Gets HTML with script tags removed, truncated to 5000 chars

**`getRelevantComputedStyles(element)`**
- Gets important computed styles only

**`getApplicableCSSRules(element)`**
- Gets CSS rules that apply to element

**`isSafeToModify(element)`**
- Checks if element is safe to modify
- Blocks: html, head, body, script, style, iframe

### Notifications

**`showNotification(message, type)`**
- Shows floating notification in top-right
- Types: 'info', 'success', 'error', 'loading'
- Auto-hides after 3 seconds (except loading)

---

## ⚠️ Safety Features

**Element Validation**:
- Won't modify unsafe tags (html, head, body, script, etc.)
- Won't modify own extension elements (data-polish-extension)

**HTML Sanitization**:
- Removes all `<script>` tags
- Removes event handler attributes
- Prevents XSS attacks

**Error Handling**:
- Validates selectedElement exists before modification
- Validates userRequest is non-empty
- Catches and reports all errors

---

## 🎨 Visual Feedback

**Overlay Colors**:
- Blue (`#3b82f6`) - Element being hovered
- Green (`#10b981`) - Element selected

**Notifications**:
- Blue - Info
- Green - Success
- Red - Error
- Orange - Loading

**Cursor**:
- Crosshair - Selection mode active
- Default - Normal mode

---

## 🔍 Debugging

**View logs**:
```bash
1. Open page DevTools (F12)
2. Go to Console tab
3. Filter for "Polish" or "content script"
```

**Common logs**:
```
Polish content script initialized
Selection mode activated
Element selected: <button>
Processing modification request: "make it blue"
Received modifications: {...}
Modifications applied successfully
```

**Test selection**:
1. Enable selection mode
2. Hover elements → Should see blue overlay
3. Click element → Should see green overlay
4. Check console for "Element selected" log

---

## 📖 Related Documentation

- **Message Protocol**: [../../docs/MESSAGE_PROTOCOL.md](../../docs/MESSAGE_PROTOCOL.md)
- **Implementation Details**: [../../docs/IMPLEMENTATION_DETAILS.md](../../docs/IMPLEMENTATION_DETAILS.md)
- **DOM Parser**: [../utils/README.md](../utils/README.md)

---

**Last Updated**: 2025-11-01
