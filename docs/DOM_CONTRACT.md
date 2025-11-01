# DOM Contract - UI Integration Guide

**For**: Frontend / UI Team
**Purpose**: Exact specification of HTML structure required by popup.js
**Version**: 0.1.0

---

## Overview

This document specifies the **contract** between popup.js (backend logic) and popup.html (UI design).

**Key Principle**: popup.js reads and writes to specific DOM element IDs. As long as these IDs exist with the correct structure, you have complete freedom to style everything however you want.

---

## Required Element IDs

### ✅ MUST HAVE - Required for functionality

These element IDs are **mandatory**. popup.js will fail if any are missing.

```html
<!-- Sections -->
#apiKeySection       <!-- Container for API key setup -->
#editingSection      <!-- Container for editing UI -->

<!-- API Key Elements -->
#apiKeyInput         <!-- Password input for API key -->
#saveApiKeyBtn       <!-- Button to save API key -->
#apiKeyStatus        <!-- Status message container -->

<!-- Selection Elements -->
#toggleSelectionBtn  <!-- Button to toggle selection mode -->

<!-- Element Info Display -->
#selectedElementInfo     <!-- Container showing selected element -->
#selectedElementTag      <!-- Displays element tag name -->
#selectedElementSelector <!-- Displays element CSS selector -->

<!-- Modification Elements -->
#modificationInput   <!-- Textarea for user's request -->
#applyModificationBtn <!-- Button to apply changes -->
#modificationStatus  <!-- Status message container -->
```

### ⚠️ Type Requirements

Each element must be the correct HTML element type:

```html
<input id="apiKeyInput" type="password">     ✅ Must be input[type="password"]
<button id="saveApiKeyBtn">                  ✅ Must be button
<textarea id="modificationInput">            ✅ Must be textarea
<div id="apiKeySection">                     ✅ Can be any container (div, section, etc.)
<span id="selectedElementTag">               ✅ Can be any inline element (span, strong, etc.)
```

---

## Complete HTML Structure

Here's the minimum required structure with all IDs:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Polish</title>
  <!-- Your custom CSS here -->
</head>
<body>

  <!-- API Key Setup Section -->
  <section id="apiKeySection">
    <h2>API Key Setup</h2>
    <input id="apiKeyInput" type="password" placeholder="sk-ant-...">
    <button id="saveApiKeyBtn">Save</button>
    <div id="apiKeyStatus"></div> <!-- popup.js writes status messages here -->
  </section>

  <!-- Editing Section -->
  <section id="editingSection" class="hidden">
    <h2>Edit Page</h2>

    <!-- Selection Button -->
    <button id="toggleSelectionBtn">Select Element</button>

    <!-- Selected Element Info (hidden until element selected) -->
    <div id="selectedElementInfo" class="hidden">
      <p>Selected: &lt;<span id="selectedElementTag"></span>&gt;</p>
      <p><span id="selectedElementSelector"></span></p>
    </div>

    <!-- Modification Input -->
    <label for="modificationInput">What would you like to change?</label>
    <textarea id="modificationInput" rows="4"></textarea>

    <button id="applyModificationBtn">Apply Changes</button>
    <div id="modificationStatus"></div> <!-- popup.js writes status messages here -->
  </section>

  <script src="popup.js"></script>
</body>
</html>
```

---

## What popup.js Does With Each Element

### Input Elements (popup.js READS)

```javascript
// API Key Input
const apiKey = elements.apiKeyInput.value.trim();
```

```javascript
// Modification Input
const userRequest = elements.modificationInput.value.trim();
```

**Your Freedom**:
- Style however you want (colors, borders, fonts, spacing)
- Add icons inside inputs
- Add placeholders
- Add help text below
- Wrap in containers for styling

**Requirements**:
- Must be actual `<input>` or `<textarea>`
- Must have specified ID
- Don't prevent `value` property from working

### Button Elements (popup.js READS clicks & WRITES text/state)

```javascript
// popup.js listens for clicks
elements.saveApiKeyBtn.addEventListener('click', handleSaveApiKey);

// popup.js updates button text
elements.applyModificationBtn.textContent = 'Processing...';

// popup.js disables/enables buttons
elements.toggleSelectionBtn.disabled = true;

// popup.js adds CSS classes
elements.toggleSelectionBtn.classList.add('active');
elements.applyModificationBtn.classList.add('loading');
```

**Your Freedom**:
- Style however you want (colors, shapes, shadows, animations)
- Add icons to buttons
- Customize hover/focus/active states
- Add loading spinners (triggered by `.loading` class)

**Requirements**:
- Must be actual `<button>` elements
- Must have specified IDs
- Don't prevent click events from bubbling
- Support `.disabled` property

### Display Elements (popup.js WRITES)

```javascript
// popup.js writes tag name
elements.selectedElementTag.textContent = 'button';

// popup.js writes selector
elements.selectedElementSelector.textContent = 'div.nav > button:nth-child(2)';

// popup.js writes status messages
elements.apiKeyStatus.textContent = 'API key saved successfully!';
```

**Your Freedom**:
- Style however you want (fonts, colors, backgrounds)
- Wrap in additional containers
- Add icons or badges
- Animate content changes

**Requirements**:
- Must support `.textContent` property
- Content will be replaced entirely (no innerHTML)

### Container Elements (popup.js READS & WRITES visibility)

```javascript
// popup.js shows/hides sections
elements.apiKeySection.classList.add('hidden');
elements.editingSection.classList.remove('hidden');

// popup.js shows/hides element info
elements.selectedElementInfo.classList.remove('hidden');
```

**Your Freedom**:
- Use any HTML element (div, section, article, etc.)
- Nest as deeply as you want
- Add any other classes or attributes

**Requirements**:
- Must have specified IDs
- Must support `.classList` operations

---

## CSS Classes That popup.js Uses

popup.js adds/removes these CSS classes. You control what they look like:

### .hidden

**Purpose**: Show/hide elements
**Used On**: Sections, containers, status messages

**Requirement**:
```css
.hidden {
  display: none !important;
}
```

**Your Freedom**: That's it! Just make it `display: none`.

### .active

**Purpose**: Indicates selection mode is active
**Used On**: `#toggleSelectionBtn`

**Example**:
```css
.active {
  background: #10b981; /* Your brand color */
  box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.2);
}
```

**Your Freedom**: Style however you want. This is just visual feedback.

### .loading

**Purpose**: Indicates processing/loading state
**Used On**: `#applyModificationBtn`

**Example**:
```css
.loading {
  background: #f59e0b;
  cursor: wait;
  position: relative;
}

.loading::after {
  content: '';
  /* Add spinner animation */
}
```

**Your Freedom**: Style however you want. Add spinners, animations, etc.

### .status, .status-success, .status-error, .status-loading

**Purpose**: Style status messages
**Used On**: `#apiKeyStatus`, `#modificationStatus`

**popup.js sets**:
```javascript
element.className = 'status status-success'; // or status-error, status-loading
```

**Example**:
```css
.status {
  padding: 12px;
  border-radius: 8px;
  margin-top: 8px;
}

.status-success {
  background: #d1fae5;
  color: #065f46;
}

.status-error {
  background: #fee2e2;
  color: #991b1b;
}

.status-loading {
  background: #fef3c7;
  color: #92400e;
}
```

**Your Freedom**: Completely customize colors, borders, animations, icons.

---

## Button States Managed by popup.js

### Toggle Selection Button

| State | Text | Class | Disabled |
|-------|------|-------|----------|
| Ready | "Select Element" | none | false |
| Selecting | "Cancel Selection" | `.active` | false |
| Processing | "Select Element" | none | true |

### Apply Modification Button

| State | Text | Class | Disabled |
|-------|------|-------|----------|
| Initial | "Apply Changes" | none | true |
| Ready | "Apply Changes" | none | false |
| Processing | "Processing..." | `.loading` | true |

### Save API Key Button

| State | Text | Disabled |
|-------|------|----------|
| Initial | "Save" | false |
| Saving | "Saving..." | true |

---

## Focus Management

popup.js automatically manages focus for accessibility:

```javascript
// On popup open with no API key
elements.apiKeyInput.focus();

// On popup open with API key
elements.toggleSelectionBtn.focus();

// After element selected
elements.modificationInput.focus();
```

**Your Freedom**: Add custom focus styles
**Requirements**: Don't prevent focus with `tabindex="-1"` on these elements

---

## Keyboard Shortcuts

popup.js handles these keyboard events:

1. **Enter** in `#apiKeyInput` → Saves API key
2. **Ctrl+Enter** (Cmd+Enter) in `#modificationInput` → Submits modification
3. **Escape** anywhere → Cancels selection mode

**Your Freedom**: Add visual indicators for shortcuts (e.g., "Press Ctrl+Enter to submit")
**Requirements**: Don't `e.preventDefault()` on these keys

---

## Layout Freedom

### You Can Change

✅ Colors, fonts, spacing, borders, shadows
✅ Add icons, badges, labels
✅ Add animations and transitions
✅ Reorder elements visually (with CSS)
✅ Add containers for styling
✅ Add illustrations or branding
✅ Change popup size (width, height)
✅ Add dark mode
✅ Add responsive breakpoints

### You Cannot Change

❌ Element IDs (must match exactly)
❌ Element types (input must stay input, button must stay button)
❌ Remove required elements
❌ Prevent JavaScript events from working
❌ Break `.hidden` class functionality

---

## Example: Custom Styling

Here's an example of how you might customize while keeping the contract:

```html
<!-- Original wireframe -->
<input id="apiKeyInput" type="password">
<button id="saveApiKeyBtn">Save</button>

<!-- Your custom version ✅ -->
<div class="fancy-input-wrapper with-icon gradient-border">
  <svg class="input-icon"><!-- your icon --></svg>
  <input id="apiKeyInput" type="password" class="premium-input">
  <button id="saveApiKeyBtn" class="gradient-button with-shadow">
    <span class="button-text">Save</span>
    <svg class="button-icon"><!-- your icon --></svg>
  </button>
</div>
```

As long as the IDs are there and the elements work, popup.js is happy!

---

## Example: Status Message Styling

```html
<!-- Original wireframe -->
<div id="apiKeyStatus"></div>

<!-- Your custom version ✅ -->
<div class="status-wrapper animated fade-in">
  <div id="apiKeyStatus" class="status-message with-icon"></div>
</div>
```

```css
.status-message {
  padding: 16px 20px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  gap: 12px;
  animation: slideIn 0.3s ease;
}

.status-success::before {
  content: '✓';
  width: 24px;
  height: 24px;
  /* ... your success icon */
}

.status-error::before {
  content: '⚠';
  /* ... your error icon */
}
```

---

## Testing Your UI

### Checklist

After implementing your design, verify:

- [ ] All required IDs exist
- [ ] All elements are correct types (input, button, textarea, etc.)
- [ ] `.hidden` class hides elements
- [ ] Buttons can be clicked
- [ ] Inputs can be typed in
- [ ] Button states (disabled) work visually
- [ ] Focus is visible
- [ ] Status messages are readable
- [ ] Element info displays correctly
- [ ] Works at different window sizes
- [ ] Keyboard shortcuts work

### Quick Test

1. Open popup → Should see API key section
2. Type invalid key → Should see error
3. Type valid key → Should save and show editing section
4. Click "Select Element" → Button should show "Cancel Selection"
5. Click element on page → Info should appear in popup
6. Type request and submit → Should show "Processing..." then "Success"

---

## Common Questions

### Q: Can I add extra elements between required elements?
**A**: Yes! Add anything you want. popup.js only cares about the elements with specified IDs.

### Q: Can I wrap required elements in divs for styling?
**A**: Yes! Nest as much as you want. Just keep the IDs on the correct elements.

### Q: Can I use a different HTML structure order?
**A**: Yes, as long as all required IDs exist. popup.js doesn't care about DOM order.

### Q: Can I rename CSS classes?
**A**: Only if they're classes you added. Don't rename `.hidden`, `.active`, `.loading`, `.status-*`.

### Q: Can I use a CSS framework (Tailwind, Bootstrap, etc.)?
**A**: Yes! Just make sure required IDs and basic functionality still work.

### Q: Can I animate state changes?
**A**: Yes! Use CSS transitions and animations freely. popup.js adds/removes classes, you control the animation.

### Q: What if I want to add a close button to the popup?
**A**: Add it! popup.js doesn't prevent it. But Chrome handles popup closing automatically when clicking outside.

---

## Integration Workflow

1. **Start with wireframe**: Use provided `popup.html` as base
2. **Add your styles**: Create custom CSS or use framework
3. **Test functionality**: Verify all IDs work with popup.js
4. **Refine visuals**: Polish animations, colors, spacing
5. **Test edge cases**: Long selectors, error states, etc.
6. **Ship it**: No changes to popup.js needed

---

## Need Help?

If you're unsure about something:

1. Check `IMPLEMENTATION_DETAILS.md` for technical details
2. Check `MESSAGE_PROTOCOL.md` for backend behavior
3. Test with provided `popup.html` wireframe first
4. Make changes incrementally and test often

---

**Summary**: Keep the IDs, keep the element types, keep basic functionality. Everything else is yours to customize!

**Last Updated**: 2025-11-01
**For Questions**: Contact Backend Team
