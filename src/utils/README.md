# Utility Functions

**Purpose**: Shared utility functions used across the extension

---

## 📄 Files

### `api.js` - Claude API Wrapper
**What it does**:
- Makes requests to Anthropic's Claude API
- Formats prompts for element modification
- Parses and validates API responses
- Handles API errors
- Validates API key format

**Used by**: `service-worker.js`
**Exported functions**:
- `requestModification(apiKey, userRequest, elementContext)`
- `validateApiKey(apiKey)`

### `dom-parser.js` - DOM Context Extraction
**What it does**:
- Extracts element information for Claude
- Generates unique CSS selectors
- Gets computed styles
- Finds applicable CSS rules
- Validates element safety

**Used by**: `content.js` (inline copy)
**Exported functions**:
- `extractElementContext(element)`
- `generateSelector(element)`
- `isSafeToModify(element)`

---

## 🔧 api.js

### requestModification()

**Purpose**: Request modification from Claude API

**Signature**:
```javascript
async function requestModification(apiKey, userRequest, elementContext)
```

**Parameters**:
- `apiKey` (string) - User's Anthropic API key
- `userRequest` (string) - User's plain-English modification request
- `elementContext` (object) - Element data from dom-parser.js

**Returns**:
```javascript
{
  css_changes: string,   // CSS rules to apply (or empty string)
  html_changes: string,  // New HTML (or empty string)
  explanation: string    // What was changed
}
```

**Errors thrown**:
- "API key is required"
- "User request and element context are required"
- "Claude API error: [status] - [message]"
- "No response content from Claude"
- "Failed to parse modifications from Claude"

**Example**:
```javascript
const modifications = await requestModification(
  'sk-ant-...',
  'Make this button blue and larger',
  {
    tagName: 'button',
    selector: 'div.hero > button:nth-child(1)',
    html: '<button>Click Me</button>',
    computedStyles: { 'background-color': 'rgb(255, 0, 0)', ... },
    cssRules: '.button { ... }',
    classList: ['btn', 'primary'],
    id: null
  }
);

// Returns:
// {
//   css_changes: 'background-color: blue; font-size: 20px;',
//   html_changes: '',
//   explanation: 'Changed background to blue and increased font size'
// }
```

---

### Prompt Structure

**What gets sent to Claude**:
```
You are helping modify a website element. The user wants to: "[userRequest]"

**Current Element Information:**

Tag: button
Selector: div.hero > button:nth-child(1)

HTML:
```html
<button class="primary">Click Me</button>
```

Current Styles (computed):
```css
  background-color: rgb(255, 0, 0);
  padding: 12px 24px;
  ...
```

Applicable CSS Rules:
```css
.primary { ... }
```

**Instructions:**
Return ONLY a valid JSON object:
{
  "css_changes": "/* CSS rules */",
  "html_changes": "<!-- HTML or empty -->",
  "explanation": "What was changed"
}
```

**Claude model used**: `claude-3-5-sonnet-20241022`

**Temperature**: 0.3 (lower for consistent code generation)

**Max tokens**: 4096

---

### validateApiKey()

**Purpose**: Validate API key format (basic check)

**Signature**:
```javascript
export function validateApiKey(apiKey)
```

**Parameters**:
- `apiKey` (string) - API key to validate

**Returns**: `boolean` - true if format is valid

**Validation**:
- Must be a string
- Must start with 'sk-ant-'
- Must be at least 20 characters long

**Example**:
```javascript
validateApiKey('sk-ant-abc123...') // true
validateApiKey('invalid-key')      // false
validateApiKey('sk-ant-short')     // false
```

**Note**: This only validates format, not whether the key works with Anthropic's API.

---

## 🔧 dom-parser.js

### extractElementContext()

**Purpose**: Extract comprehensive element information for Claude

**Signature**:
```javascript
export function extractElementContext(element)
```

**Parameters**:
- `element` (HTMLElement) - DOM element to analyze

**Returns**:
```javascript
{
  tagName: string,        // Element tag name (lowercase)
  selector: string,       // Unique CSS selector
  html: string,           // Element HTML (truncated to 5000 chars)
  computedStyles: Object, // Relevant computed styles
  cssRules: string,       // Applicable CSS rules (up to 20)
  classList: Array,       // Element classes
  id: string | null       // Element ID if exists
}
```

**Example**:
```javascript
const context = extractElementContext(buttonElement);

// Returns:
// {
//   tagName: 'button',
//   selector: 'div.header > button.cta:nth-child(2)',
//   html: '<button class="cta">Click Me</button>',
//   computedStyles: {
//     'background-color': 'rgb(59, 130, 246)',
//     'padding': '12px 24px',
//     'border-radius': '8px',
//     ...
//   },
//   cssRules: '.cta { background: #3b82f6; color: white; }',
//   classList: ['cta'],
//   id: null
// }
```

---

### generateSelector()

**Purpose**: Generate unique CSS selector for an element

**Signature**:
```javascript
export function generateSelector(element)
```

**Parameters**:
- `element` (HTMLElement) - Element to generate selector for

**Returns**: `string` - CSS selector

**Strategy**:
1. If element has ID → `#elementId`
2. Otherwise, build path from element to body:
   - Use tag name
   - Add classes if present
   - Add `:nth-child()` if needed for uniqueness

**Examples**:
```javascript
generateSelector(elementWithId)
// "#submitButton"

generateSelector(elementWithClasses)
// "div.container > button.primary:nth-child(2)"

generateSelector(plainElement)
// "body > div:nth-child(1) > section:nth-child(3) > p:nth-child(1)"
```

---

### isSafeToModify()

**Purpose**: Check if element is safe to modify

**Signature**:
```javascript
export function isSafeToModify(element)
```

**Parameters**:
- `element` (HTMLElement) - Element to check

**Returns**: `boolean` - true if safe to modify

**Blocks modification of**:
- `html`, `head`, `body` (critical page structure)
- `script`, `style` (code/styling)
- `iframe` (embedded content)
- Elements with `data-polish-extension` attribute (our own elements)

**Example**:
```javascript
isSafeToModify(buttonElement)  // true
isSafeToModify(bodyElement)    // false
isSafeToModify(scriptElement)  // false
```

---

## 📊 Data Flow

```
USER REQUEST
   ↓
content.js: extractElementContext(selectedElement)
   (uses dom-parser.js)
   ↓
Sends to service-worker.js
   ↓
service-worker.js: requestModification(apiKey, userRequest, elementContext)
   (uses api.js)
   ↓
api.js: buildPrompt() → fetch Claude API → parseClaudeResponse()
   ↓
Returns modifications
   ↓
content.js: applyModifications()
```

---

## ⚠️ Important Notes

### api.js

**Security**:
- API keys never logged to console (only last 4 chars for debugging)
- All API communication over HTTPS
- Errors don't expose sensitive data

**Performance**:
- Typical API call: 2-10 seconds
- Max tokens: 4096 (limits response size)
- Temperature: 0.3 (consistent results)

**Error Handling**:
- All errors thrown with user-friendly messages
- Network errors caught and described
- Malformed responses handled gracefully

### dom-parser.js

**Optimization**:
- HTML truncated at 5000 characters (prevents huge payloads)
- Only 20 most relevant CSS rules included (tokens are expensive)
- Deep nested children simplified
- Script tags removed for security

**Accuracy**:
- Selectors guaranteed unique (uses :nth-child if needed)
- Computed styles only include relevant properties (filters ~200 CSS properties down to ~30)
- CORS-protected stylesheets skipped gracefully

---

## 🔍 Debugging

**api.js errors**:
```javascript
// In service-worker.js console:
"Claude API error: 401 - Invalid authentication"
"Claude API error: 429 - Too many requests"
"Failed to parse modifications from Claude: ..."
```

**dom-parser.js debugging**:
```javascript
// In content.js console:
const context = extractElementContext(element);
console.log(context);
// Check if selector, html, styles look correct
```

---

## 📖 Related Documentation

- **API Integration**: [../../docs/IMPLEMENTATION_DETAILS.md](../../docs/IMPLEMENTATION_DETAILS.md)
- **Architecture**: [../../docs/BACKEND_ARCHITECTURE.md](../../docs/BACKEND_ARCHITECTURE.md)
- **Claude API Docs**: https://docs.anthropic.com/

---

**Last Updated**: 2025-11-01
