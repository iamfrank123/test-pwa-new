# PWA Icons Setup Guide

To complete the PWA setup, you need to add icons to the `/public/icons/` directory.

## Required Icons

Create these image files in `/public/icons/`:

### Essential Icons
- `icon-192x192.png` - 192x192 PNG (used by most devices)
- `icon-512x512.png` - 512x512 PNG (used for splash screens)

### Maskable Icons (for adaptive icons on Android 12+)
- `icon-192x192-maskable.png` - 192x192 PNG with maskable safe zone
- `icon-512x512-maskable.png` - 512x512 PNG with maskable safe zone

### Screenshots (optional but recommended)
- `screenshot-mobile-1.png` - 540x720 PNG (mobile screenshots)
- `screenshot-mobile-2.png` - 540x720 PNG (mobile screenshots)
- `screenshot-desktop.png` - 1280x800 PNG (desktop screenshots)

## Icon Design Recommendations

1. **Colors**: Use the Pentagramma brand color (Indigo/Blue gradient)
   - Primary: #667eea
   - Secondary: #764ba2

2. **Safe Zone (Maskable icons)**:
   - Keep important elements within a circle of radius 40% from center
   - This ensures compatibility with various device shapes

3. **Design**:
   - Use the musical note symbol (♪) or staff notation
   - Maintain clarity at 192px size
   - Solid background color for contrast

## Automated Icon Generation

You can use online tools to generate icons:
- [PWA Icon Generator](https://www.pwabuilder.com/)
- [Favicon Generator](https://favicon-generator.org/)
- [Asset Generator](https://www.assetgenerator.org/)

## Quick PNG Creation

If you have GraphicsMagick or ImageMagick installed:

```bash
# Create a 512x512 blue icon with white music note
convert -size 512x512 xc:#667eea -fill white -pointsize 256 \
  -gravity center -annotate +0+0 "♪" /public/icons/icon-512x512.png

# Create 192x192 version
convert /public/icons/icon-512x512.png -resize 192x192 \
  /public/icons/icon-192x192.png
```

## Verification

After adding icons, verify your PWA:

1. Open DevTools (F12)
2. Go to Application > Manifest
3. Check that all icons are properly referenced
4. Verify manifest.json shows all icons correctly

## Testing PWA Install Prompt

To test the install prompt:
1. Use Chrome DevTools
2. Go to Application > Manifest
3. Click "Add to shelf" or use the install button
4. On mobile, the browser will show native install prompt
