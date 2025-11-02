# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Development Setup

**No build process** - Pure vanilla JavaScript Chrome extension:
```bash
# Load extension
chrome://extensions/ → Enable "Developer mode" → "Load unpacked" → Select Polish folder

# Debug locations
Popup logs: Right-click popup → Inspect → Console
Service worker: chrome://extensions/ → Polish → "service worker" link
Content script: Page DevTools → Console (filter "Polish")

# Enable verbose logging
# Set DEBUG_MODE = true in popup.js line 15
```

**Extension won't load without:** 3 icon PNG files in `icons/` (icon16.png, icon48.png, icon128.png)

---

## Architecture Overview

### State Machine Pattern (popup.js)

**8-state machine** drives all UI behavior (lines 37-76):
```
INITIALIZING → NO_API_KEY → READY → SELECTING → ELEMENT_SELECTED → PROCESSING → SUCCESS
                     ↓                                      ↓              ↓
                   ERROR ←──────────────────────────────────┴──────────────┘
```

**Critical:** ALL UI changes go through `setState()` → `updateUIForState()`. Never manipulate DOM directly outside this flow.

**State persistence across popup lifecycle:**
- Popup can close anytime (user clicks outside)
- On reopen, `init()` restores state by querying:
  1. API key from `chrome.storage.local`
  2. Selected element from content script
  3. Selection mode status from content script

### 3-Layer Message Protocol

**Layer 1: Popup ↔ Content Script** (`chrome.tabs.sendMessage`)
- `TOGGLE_SELECTION_MODE` - Enable/disable selection
- `GET_SELECTED_ELEMENT_INFO` - Restore state on popup reopen
- `MODIFY_ELEMENT_REQUEST` - Send user's modification request

**Layer 2: Content Script ↔ Service Worker** (`chrome.runtime.sendMessage`)
- `MODIFY_ELEMENT` - Pass element context + request to API handler

**Layer 3: Content Script → Popup** (`chrome.runtime.sendMessage`)
- `ELEMENT_SELECTED` - Notification when user clicks element

**Timeout handling:**
- Standard messages: 5s timeout
- API requests: 10s timeout (user-facing), 30s service worker (to Claude)
- All wrapped in `Promise.race()` with timeout

**Async responses:** Must return `true` from listener to keep channel open:
```javascript
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (asyncOperation) {
    doWork().then(sendResponse);
    return true; // REQUIRED for async
  }
});
```

---

## DOM Contract (Backend ↔ UI)

### Immutable Element IDs

These IDs are **hardcoded in popup.js** and CANNOT change:

```javascript
// Sections
#apiKeySection, #editingSection

// API Key
#apiKeyInput (must be input[type="password"])
#saveApiKeyBtn
#apiKeyStatus

// Selection
#toggleSelectionBtn

// Element Info
#selectedElementInfo
#selectedElementTag
#selectedElementSelector

// Modification
#modificationInput (must be textarea)
#applyModificationBtn
#modificationStatus
```

### CSS Classes popup.js Manages

```javascript
.hidden           // MUST be display: none !important
.active           // Added to #toggleSelectionBtn during selection
.loading          // Added to #applyModificationBtn during processing
.status-success   // Added to status divs
.status-error     // Added to status divs
```

**Button state transformations:**
```javascript
// #toggleSelectionBtn
Ready: "Select Element" (no class, enabled)
Selecting: "Cancel Selection" (.active class, enabled)
Processing: (disabled)

// #applyModificationBtn
Initial: disabled
Ready: "Apply Changes" (enabled)
Processing: "Processing..." (.loading class, disabled)
```

---

## Critical Code Patterns

### Element Selection System (content.js)

**Two-phase highlighting:**
- Hover: Blue overlay `#3b82f6`, 2px border
- Selected: Green overlay `#10b981`, 3px border

**Overlay positioning:**
```javascript
// Absolute positioned with high z-index (999999)
// Tracks element via getBoundingClientRect() + window.scrollY/scrollX
// See highlightElement() lines 450-476
```

**Safety validation prevents modifying:**
```javascript
['html', 'head', 'body', 'script', 'style', 'iframe']
// Or any element with data-polish-extension attribute
```

### Claude API Integration (api.js)

**Prompt structure:**
1. User request (plain English)
2. Element context: tag, selector, HTML (truncated 5000 chars), computed styles, CSS rules (max 20)
3. Strict JSON response requirement

**Configuration:**
- Model: `claude-sonnet-4-5-20250929` (line 14)
- Temperature: 0.3 (for consistent code generation)
- Max tokens: 4096

**Response parsing:**
- Strips markdown code blocks if present
- Validates JSON structure
- Provides defaults for missing fields

### XSS Protection (content.js)

**All HTML from Claude passes through `sanitizeHTML()` (lines 428-449):**
1. Removes `<script>` tags
2. Strips event handler attributes (onclick, onload, etc.)
3. Parses in isolated temp div before DOM injection

---

## Service Worker Constraints

**Uses `importScripts()` not ES6 imports:**
```javascript
importScripts('../utils/api.js');  // ✓ Works
import { api } from '../utils/api.js';  // ✗ Fails
```

**API key access:**
- Only service worker accesses `chrome.storage.local` for API key
- Content script never has direct access (security)
- Service worker validates format: `sk-ant-` prefix, min 20 chars

---

## Content Script Constraints

**DOM utilities are inlined** (lines 557-683):
- `extractElementContext()`, `generateSelector()`, `isSafeToModify()`, etc.
- NOT imported from `dom-parser.js` (ES6 imports don't work well in content scripts)
- If modifying DOM utilities, update content.js inline functions

**CSS rule extraction:**
- Skips CORS-protected external stylesheets gracefully
- Limits to 20 rules to save API tokens
- Only includes relevant computed styles (~30 properties from ~200 total)

---

## Team Responsibilities

### Backend Team (DON'T touch UI files)
- `popup.js` - State machine, message coordination
- `content.js` - DOM manipulation, selection
- `service-worker.js` - API proxy
- `api.js` - Claude API wrapper

### UI Team (DON'T touch logic files)
- `popup.html` - Complete redesign allowed, keep IDs
- CSS styling - Use any framework, keep `.hidden` working
- `icons/` - Create 3 PNG files (16x16, 48x48, 128x128)

---

## Adding New Features

### New UI State
1. Add state to `STATES` enum (popup.js line 37)
2. Add case to `updateUIForState()` switch (line 265)
3. Add transitions in relevant handlers

### New Message Type
1. Add to sender's message call
2. Add case to receiver's `handleMessage()` switch
3. Document in `docs/MESSAGE_PROTOCOL.md`
4. Return `true` if async response needed

### New UI Element
1. Add to `popup.html` with unique ID
2. Add to `elements` object in `popup.js` (line 65)
3. Add to `cacheElements()` and `verifyElements()`
4. Document in `docs/DOM_CONTRACT.md`

---

## Debugging Workflow

**Message flow not working:**
1. Check all 3 DevTools simultaneously
2. Look for message type in logs: "received message:", "sending:"
3. Verify `chrome.runtime.lastError` logged
4. Check timeout not exceeded (5s/10s)

**State machine stuck:**
1. Check current state: `state.currentState` in popup console
2. Check which handler should transition state
3. Verify `setState()` called (look for "State transition:" log)

**Element selection not working:**
1. Check `isSelectionMode` flag in content script
2. Verify event listeners attached (log in `enableSelectionMode()`)
3. Check element passes `isSafeToModify()`

---

## GitHub Integration (POC)

**Status:** Personal Access Token (PAT) flow - **Testing Only**

### Overview

Polish can now publish changes to GitHub repositories. When users click "Publish", the extension creates a new branch with:
- `index.html` - Full HTML snapshot with modifications
- `polish-metadata.json` - Structured change log
- `README.md` - Instructions for developers

### Architecture

**Flow:**
```
User → Settings → Connect GitHub (PAT) → Publish Button → Service Worker → GitHub API → New Branch
```

**Components:**
- `src/utils/github-api.js` - GitHub REST API wrapper (no ES6 exports)
- `src/content/content.js` - Settings UI, publish logic, metadata generation
- `src/background/service-worker.js` - GitHub API message handlers

**Storage Keys:**
```javascript
polish_github_token        // PAT (password field, masked)
polish_github_repo         // "owner/repo" format
polish_github_base_branch  // Default: "main"
polish_github_username     // Cached from validation
polish_github_repo_name    // Cached from validation
polish_github_connected    // Boolean connection status
```

### Security Model

**Current (POC):**
- Users create fine-grained PAT with `repo→contents` (read/write) permissions
- Token stored in `chrome.storage.local` (encrypted by Chrome at rest)
- Token never logged, masked in UI
- Validated on save via GitHub API `/user` endpoint

**Required Token Permissions:**
- `repo` → `contents` (read/write) - **Minimum required**
- Optional: `pull_requests` (for future PR creation)

**Security Best Practices Implemented:**
- Token format validation (`ghp_*` or `github_pat_*` prefix)
- HTTPS-only GitHub API calls
- Token transmitted in `Authorization` header (never in URL)
- Input sanitization for repo owner/name
- Error messages don't expose sensitive data

### User Flow

1. **Settings → GitHub Integration:**
   - User creates PAT at `https://github.com/settings/tokens`
   - Pastes token, enters `owner/repo`, selects base branch
   - Clicks "Connect GitHub"
   - Extension validates via GitHub API
   - Saves credentials to `chrome.storage.local`

2. **Publish:**
   - User modifies page via Polish
   - Clicks "Publish" button
   - Extension generates branch name: `polish-changes-{timestamp}`
   - Creates branch from base
   - Commits 3 files (HTML, metadata, README)
   - Shows success modal with GitHub branch link

3. **Disconnect:**
   - User clicks "Disconnect" in Settings
   - Clears all GitHub credentials from storage

### GitHub API Calls

**Validation:**
```javascript
GET /user                           // Validate token
GET /repos/{owner}/{repo}           // Validate repo access
```

**Publishing:**
```javascript
GET /repos/{owner}/{repo}/git/refs/heads/{base}  // Get base SHA
POST /repos/{owner}/{repo}/git/refs              // Create branch
PUT /repos/{owner}/{repo}/contents/{path}        // Commit files (3x)
```

### Error Handling

**Custom Error Classes:**
- `GitHubAuthError` - Invalid/expired token (401)
- `GitHubNotFoundError` - Repo not found (404)
- `GitHubPermissionError` - Insufficient permissions (403)
- `GitHubRateLimitError` - Rate limit exceeded (403 + headers)

**User-Friendly Messages:**
- "Authentication failed. Please check your token."
- "Repository not found. Verify owner/repo and token permissions."
- "Access denied. Ensure your PAT has repo→contents (read/write) permissions."
- "Rate limit exceeded. Resets at {time}."

### Limitations (PAT Approach)

**Current Constraints:**
- ⚠️ **Testing only** - Users must manually create/revoke PATs
- Token stored locally (Chrome encrypts, but not ideal for production)
- No automatic token refresh
- No OAuth consent flow
- Users might grant excessive permissions
- Static HTML export only (not source file editing)

### Future Roadmap

**Production Implementation (GitHub App + OAuth):**

1. Register GitHub App with Polish organization
2. Implement OAuth flow:
   - User clicks "Connect GitHub" → Backend OAuth endpoint
   - User authorizes app installation → Callback with installation ID
   - Backend stores installation tokens (server-side)
   - Extension communicates via backend API

3. Benefits:
   - No user-managed tokens
   - Granular permissions (repo-specific)
   - Automatic token refresh
   - Professional UX
   - Audit trail

**Backend Requirements:**
- Node.js/Express server (or similar)
- Endpoints: `/auth/install`, `/api/publish`, `/webhooks/github`
- Database for user → installation ID mapping
- GitHub App credentials (private key, app ID)

**Migration Path:**
- Keep PAT as "developer mode" option
- Add OAuth as "recommended" flow
- Both use same storage schema
- Gradual migration of users

### Message Types

**New Message Types:**
```javascript
VALIDATE_GITHUB    // Content → Service Worker (validate token + repo)
PUBLISH_TO_GITHUB  // Content → Service Worker (create branch + commit files)
```

**Message Handlers:**
- `handleValidateGitHub()` - Uses `validateConnection()` from github-api.js
- `handlePublishToGitHub()` - Uses `getBranchRef()`, `createBranch()`, `createOrUpdateFile()`

### Testing

**Manual Test Checklist:**
- [ ] Connect with valid PAT → Success
- [ ] Connect with invalid token → "Authentication failed"
- [ ] Connect to non-existent repo → "Repository not found"
- [ ] Connect without permissions → "Access denied"
- [ ] Publish creates branch with 3 files
- [ ] Publish twice creates unique branch names
- [ ] Disconnect clears all credentials
- [ ] Success message auto-hides after 3s
- [ ] Error messages persist until dismissed
- [ ] Branch link opens in new tab

**Rate Limiting:**
- GitHub: 5,000 requests/hour (authenticated)
- Polish uses ~4 requests per publish
- Monitor via `X-RateLimit-Remaining` header

---

## Known Limitations (Intentional for POC)

- No persistence (changes reset on page refresh)
- No undo/redo
- Single element selection only
- Inline styles only (no CSS file generation)
- No TypeScript, no automated tests

---

## Key Architectural Insight

This is a **state-machine-driven message-passing architecture**:
- `popup.js` orchestrates via centralized state management
- DOM contract creates clean backend/UI separation
- Message protocol enables async cross-component communication
- All UI changes flow through state machine (prevents race conditions)

**Never bypass the state machine** - it's the source of truth for all UI state.
