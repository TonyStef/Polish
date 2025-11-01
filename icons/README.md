# Extension Icons

**Status**: ⚠️ PLACEHOLDERS NEEDED

---

## Required Icons

The Polish Chrome extension requires 3 icon files in this directory:

```
icons/
├── icon16.png   (16x16 pixels)
├── icon48.png   (48x48 pixels)
└── icon128.png  (128x128 pixels)
```

**Without these icons, the extension will NOT load in Chrome.**

---

## Icon Specifications

### icon16.png
- **Size**: 16x16 pixels
- **Format**: PNG
- **Usage**: Extension toolbar icon
- **Display**: Small icon in Chrome toolbar

### icon48.png
- **Size**: 48x48 pixels
- **Format**: PNG
- **Usage**: Extension management page
- **Display**: chrome://extensions/ page

### icon128.png
- **Size**: 128x128 pixels
- **Format**: PNG
- **Usage**: Chrome Web Store listing
- **Display**: When installing/showcasing extension

---

## Creating Placeholders

**For POC/Testing**, create simple placeholder icons:

### Option 1: Simple Colored Squares

Create solid color squares with "P" logo:
- Background: Blue (#3b82f6)
- Text: White "P"
- Font: Bold, sans-serif

### Option 2: Online Icon Generator

Use a free online tool:
1. Go to https://favicon.io/ or similar
2. Generate icons with "P" text
3. Download PNG files
4. Rename to icon16.png, icon48.png, icon128.png
5. Place in this folder

### Option 3: Design Tool

Use Figma, Photoshop, or similar:
1. Create artboards: 16x16, 48x48, 128x128
2. Design simple "P" logo
3. Export as PNG
4. Place in this folder

---

## Creating Final Icons (UI Team)

**For production**, create professional icons:

### Design Guidelines

**Logo/Symbol:**
- Represent "polishing" or "editing"
- Simple, recognizable at small sizes
- Works in monochrome (for dark mode)

**Colors:**
- Match extension branding
- Consider multiple color variants
- Test on light and dark backgrounds

**Style:**
- Modern, clean design
- Clear at 16x16 (very small!)
- Consistent across all sizes

**Best Practices:**
- Use vector graphics (scale to PNG)
- Add slight padding (don't touch edges)
- Test on different backgrounds
- Consider accessibility (color blindness)

---

## Quick Start (For Testing)

**If you need to test the extension NOW:**

### Method 1: Generate Simple Icons

```bash
# Use ImageMagick (if installed)
convert -size 16x16 xc:#3b82f6 -pointsize 12 -fill white -gravity center -annotate +0+0 'P' icon16.png
convert -size 48x48 xc:#3b82f6 -pointsize 36 -fill white -gravity center -annotate +0+0 'P' icon48.png
convert -size 128x128 xc:#3b82f6 -pointsize 96 -fill white -gravity center -annotate +0+0 'P' icon128.png
```

### Method 2: Online Generator

1. Go to https://www.favicon-generator.org/
2. Upload any image or create text "P"
3. Download package
4. Extract and use the PNG files
5. Rename to icon16.png, icon48.png, icon128.png

### Method 3: Use Emoji (Quick Hack)

1. Screenshot a large "✨" or "🎨" emoji
2. Resize to 128x128, 48x48, 16x16
3. Save as PNG files
4. Temporary solution only!

---

## Installation

**After creating icons:**

1. Place files in this folder (`icons/`)
2. Verify names match exactly:
   - `icon16.png`
   - `icon48.png`
   - `icon128.png`
3. Reload extension in Chrome
4. Icons should appear correctly

---

## Troubleshooting

**Extension won't load:**
- Check file names (case-sensitive!)
- Verify PNG format
- Check file sizes match specs
- Ensure files aren't corrupted

**Icons look blurry:**
- Check pixel dimensions match exactly
- Don't upscale smaller images
- Use proper PNG export settings

**Icons don't appear:**
- Hard refresh: chrome://extensions/
- Click "Reload" under Polish extension
- Check browser console for errors

---

## Current Status

**As of 2025-11-01:**
- ❌ No icons exist yet
- ⏳ Waiting for UI team to create
- 🔧 Use placeholder method above for testing

---

## For UI Team

**When creating final icons:**

1. Design at largest size first (128x128)
2. Scale down carefully (don't just resize!)
3. Optimize each size for clarity
4. Test at actual display sizes
5. Export as PNG with transparency (optional)
6. Replace placeholders in this folder

**Deliverables:**
- [ ] icon16.png (16x16)
- [ ] icon48.png (48x48)
- [ ] icon128.png (128x128)
- [ ] (Optional) SVG source file for future scaling

---

## Resources

**Icon Design:**
- [Material Design Icons](https://material.io/design/iconography)
- [Chrome Extension Icon Guidelines](https://developer.chrome.com/docs/webstore/images/)
- [Flat Icon](https://www.flaticon.com/)

**Tools:**
- [Figma](https://www.figma.com/) - Design tool
- [GIMP](https://www.gimp.org/) - Free image editor
- [Favicon Generator](https://favicon.io/) - Quick generation

---

**Last Updated**: 2025-11-01
**Status**: Placeholders needed for testing
