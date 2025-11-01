# Polish - AI-Powered Website Editor

**Chrome extension that lets you modify any website using natural language and Claude AI**

[![Version](https://img.shields.io/badge/version-0.1.0-blue.svg)](https://github.com/yourusername/polish)
[![Status](https://img.shields.io/badge/status-beta-orange.svg)](https://github.com/yourusername/polish)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

---

## 🎯 What is Polish?

Polish is a Chrome extension that allows users to modify website elements using plain English commands powered by Claude AI.

**Example**:
1. Click the Polish extension icon
2. Select "Select Element" and click any element on the page
3. Type: "Make this button blue and larger"
4. Claude AI generates and applies the CSS/HTML changes instantly

**Core Concept**: User installs extension → Types modifications in natural language → Claude AI processes → Changes applied locally (no upload to production)

---

## 🏗️ Project Status

**Current Phase**: POC/MVP - Backend Complete ✅
**Version**: 0.1.0
**Backend**: Production-ready (100% complete)
**Frontend**: Wireframe only (UI team to implement)

### What's Done

✅ Complete backend logic and infrastructure
✅ Claude API integration
✅ Element selection system
✅ DOM manipulation & modification application
✅ Message passing architecture
✅ Error handling with recovery
✅ State management (state machine)
✅ Keyboard shortcuts
✅ Comprehensive documentation

### What's Next

⏳ UI/UX design (handled by cofounder)
⏳ Extension icons (final design)
⏳ Testing & deployment

---

## 📁 Project Structure

```
Polish/
├── README.md                      # You are here
├── CONTRIBUTING.md                # How to contribute
├── manifest.json                  # Chrome extension configuration
│
├── docs/                          # Complete documentation
│   ├── INDEX.md                   # Documentation navigation
│   ├── README.md                  # Docs overview
│   ├── BACKEND_ARCHITECTURE.md    # System architecture
│   ├── IMPLEMENTATION_DETAILS.md  # Technical deep dive
│   ├── MESSAGE_PROTOCOL.md        # Message passing spec
│   └── DOM_CONTRACT.md            # For UI team
│
├── src/                           # Source code
│   ├── background/                # Background service worker
│   │   └── service-worker.js      # Claude API handler
│   ├── content/                   # Content scripts (run on pages)
│   │   ├── content.js             # Element selection & modification
│   │   └── content.css            # Selection UI styles
│   ├── popup/                     # Popup scripts
│   │   ├── popup.js               # Backend logic (state machine)
│   │   └── popup.html             # UI reference wireframe
│   └── utils/                     # Shared utilities
│       ├── api.js                 # Claude API wrapper
│       └── dom-parser.js          # DOM context extraction
│
└── icons/                         # Extension icons (placeholders)
```

**Each folder has its own README** - Check `docs/INDEX.md` for navigation guide

---

## 🚀 Quick Start

### Prerequisites

- Google Chrome (latest version)
- Anthropic API key ([Get one here](https://console.anthropic.com/settings/keys))
- Node.js/npm (optional, for development)

### Installation

**1. Clone the repository**:
```bash
git clone <repository-url>
cd Polish
```

**2. Load extension in Chrome**:
```bash
# 1. Open Chrome and go to:
chrome://extensions/

# 2. Enable "Developer mode" (top right toggle)

# 3. Click "Load unpacked"

# 4. Select the Polish folder

# Extension should load successfully ✅
```

**3. Set up API key**:
```bash
# 1. Click the Polish extension icon
# 2. Enter your Anthropic API key (starts with sk-ant-)
# 3. Click "Save"
```

### First Use

**1. Navigate to any website** (e.g., https://wikipedia.org)

**2. Click Polish extension icon**

**3. Click "Select Element" button**

**4. Click any element on the page**
- Should see blue highlight on hover
- Should see green highlight when clicked

**5. Type a modification request**
- Example: "Make this text bigger and blue"
- Press Ctrl+Enter (or Cmd+Enter on Mac)

**6. Wait 2-10 seconds for Claude to process**

**7. Modifications applied!**


### Getting Started

**Step 1**: Read documentation
```bash
docs/DOM_CONTRACT.md  # Required element IDs and structure
src/popup/README.md   # What popup.js does
```

**Step 2**: Start with wireframe
```bash
src/popup/popup.html  # Use as starting point
# Replace with your custom HTML
# Keep same element IDs
```

**Step 3**: Build your design
- Use any CSS framework (Tailwind, Bootstrap, etc.)
- Add animations, transitions, icons
- Make it beautiful!

**Step 4**: Test
- Load extension in Chrome
- Verify all buttons/inputs work
- Test all states (API key setup, selection, modification)

**See**: [`docs/DOM_CONTRACT.md`](docs/DOM_CONTRACT.md) for complete guide

---

## 🛠️ For Backend Developers

### Architecture Overview

**Components:**
1. **Popup** (`popup.js`) - State machine, message coordinator
2. **Content Script** (`content.js`) - Element selection, DOM manipulation
3. **Service Worker** (`service-worker.js`) - Claude API handler
4. **Utils** (`api.js`, `dom-parser.js`) - Shared utilities

**Message Flow:**
```
User → popup.js → content.js → service-worker.js → Claude API
                                                          ↓
User ← popup.js ← content.js ← service-worker.js ← Response
```

### Getting Started

**Step 1**: Understand the system
```bash
docs/BACKEND_ARCHITECTURE.md  # Read first
docs/IMPLEMENTATION_DETAILS.md  # Deep dive
docs/MESSAGE_PROTOCOL.md       # All message types
```

**Step 2**: Find what you need to modify
```bash
src/README.md  # Source code guide
# Each folder has its own README
```

**Step 3**: Make changes and test
```bash
# Modify code
# Load extension in Chrome
# Test in browser DevTools
```

---

## 📖 Documentation

### Essential Reading

| Document | For | Purpose |
|----------|-----|---------|
| [docs/INDEX.md](docs/INDEX.md) | Everyone | Documentation navigation |
| [docs/README.md](docs/README.md) | Everyone | Documentation overview |
| [docs/BACKEND_ARCHITECTURE.md](docs/BACKEND_ARCHITECTURE.md) | Backend devs | System architecture |
| [docs/IMPLEMENTATION_DETAILS.md](docs/IMPLEMENTATION_DETAILS.md) | Backend devs | Technical implementation |
| [docs/MESSAGE_PROTOCOL.md](docs/MESSAGE_PROTOCOL.md) | Backend devs | Message specifications |
| [docs/DOM_CONTRACT.md](docs/DOM_CONTRACT.md) | UI devs | UI integration guide |

### Folder Documentation

Each source folder has its own README:
- [`src/README.md`](src/README.md) - Source code overview
- [`src/background/README.md`](src/background/README.md) - Service worker
- [`src/content/README.md`](src/content/README.md) - Content scripts
- [`src/popup/README.md`](src/popup/README.md) - Popup logic & UI
- [`src/utils/README.md`](src/utils/README.md) - Utilities

---

## 🔧 Development

### Prerequisites

```bash
# Chrome browser (latest)
# Anthropic API key
# Text editor (VS Code recommended)
```

### Local Setup

```bash
# 1. Clone repository
git clone <repository-url>
cd Polish

# 2. No build process needed (vanilla JavaScript)

# 3. Load in Chrome as described above
```

### Testing

**Load extension:**
```bash
chrome://extensions/
→ Developer mode ON
→ Load unpacked
→ Select Polish folder
```

**View logs:**
```bash
# Popup logs:
Right-click popup → Inspect → Console

# Service worker logs:
chrome://extensions/ → Polish → "service worker" link

# Content script logs:
Page DevTools → Console (filter for "Polish")
```

**Debug mode:**
In `popup.js` line 19, set:
```javascript
const DEBUG_MODE = true;  // Verbose logging
```

---

## 🎯 Features

### Current Features (v0.1.0)

✅ **Element Selection**
- Visual highlighting (blue hover, green selected)
- Click any element to select
- Safe element validation

✅ **Natural Language Modifications**
- Type requests in plain English
- Claude AI processes and generates code
- CSS and HTML modifications supported

✅ **State Management**
- Professional state machine (8 states)
- Handles popup lifecycle
- Race condition prevention

✅ **Error Handling**
- Comprehensive error recovery
- User-friendly error messages
- Network timeout handling

✅ **Keyboard Shortcuts**
- Enter: Save API key
- Ctrl+Enter: Submit modification
- Escape: Cancel selection mode

✅ **Security**
- XSS protection (HTML sanitization)
- Safe element validation
- API key encryption (via Chrome storage)

### Planned Features (Future)

⏳ Modification persistence
⏳ Undo/redo functionality
⏳ Multi-element selection
⏳ Modification templates
⏳ Export as CSS file
⏳ Collaborative sharing

---

## ⚙️ Configuration

### API Key

**Required**: Anthropic API key

**Get one**: https://console.anthropic.com/settings/keys

**Set in extension**:
1. Click extension icon
2. Enter key (starts with `sk-ant-`)
3. Click "Save"

**Storage**: `chrome.storage.local` (encrypted by Chrome)

### Extension Permissions

**Required permissions** (in `manifest.json`):
- `activeTab` - Access current tab
- `storage` - Store API key
- `scripting` - Inject scripts
- `<all_urls>` - Work on any website

---

## 🐛 Troubleshooting

### Common Issues

**Extension won't load**:
- Check Chrome version (need latest)
- Verify all files exist
- Check for syntax errors in console

**"No active tab found"**:
- Refresh the page
- Make sure you're on a regular webpage (not chrome:// pages)

**"Could not establish connection"**:
- Content script not loaded yet
- Refresh page and try again

**"API rate limit exceeded"**:
- Wait a few moments
- Claude API has rate limits
- Try again shortly

**Modifications not applying**:
- Check DevTools console for errors
- Verify element is still on page
- Check Claude's response in service worker logs

### Getting Help

**Check documentation:**
- [`docs/IMPLEMENTATION_DETAILS.md`](docs/IMPLEMENTATION_DETAILS.md) - Debugging tips
- [`docs/MESSAGE_PROTOCOL.md`](docs/MESSAGE_PROTOCOL.md) - Error handling

**Enable debug logging:**
```javascript
// In popup.js line 19:
const DEBUG_MODE = true;
```

---

## 🤝 Contributing

See [`CONTRIBUTING.md`](CONTRIBUTING.md) for development guidelines.

**Quick guide:**
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

**Backend changes**: Follow state machine pattern, add tests
**UI changes**: Keep element IDs, test with popup.js

---

## 📝 License

MIT License - See LICENSE file for details

---

## 👥 Team

**Backend/Infrastructure**: Backend team
**UI/Design**: Cofounder
**AI Integration**: Claude 3.5 Sonnet (Anthropic)

---

## 🙏 Acknowledgments

- [Anthropic](https://anthropic.com) for Claude AI
- [Chrome Extension Docs](https://developer.chrome.com/docs/extensions/)
- Our users and testers

---

## 📞 Contact

**Questions?**
- Read [docs/INDEX.md](docs/INDEX.md) for navigation
- Check folder READMEs
- Open an issue

---

**Current Status**: Backend complete ✅ | UI in progress ⏳ | Ready for deployment 🚀

---

**Version**: 0.1.0
**Last Updated**: 2025-11-01
**Status**: Beta
