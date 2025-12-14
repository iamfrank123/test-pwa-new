# Pentagramma PWA Implementation Guide

## Overview

Pentagramma is now a full Progressive Web App (PWA) with the following features:

✅ **Install Prompt Banner** - Users see a banner when visiting the site  
✅ **Offline Support** - Works offline with cached assets  
✅ **Auto-Updates** - Automatic update checks and notifications  
✅ **Mobile Optimized** - Responsive design for all devices  
✅ **Service Worker** - Handles caching, offline mode, and synchronization  
✅ **MIDI Support** - Full MIDI functionality on mobile devices  

## File Structure

```
public/
├── manifest.json          # PWA metadata and app configuration
├── sw.js                  # Service Worker for caching/offline
├── offline.html           # Offline fallback page
└── icons/                 # App icons (192x192, 512x512, etc.)

components/PWA/
├── Initializer.tsx        # Service Worker registration
├── InstallBanner.tsx      # Install prompt UI
├── UpdateNotification.tsx  # Update available notification
└── MobileLayout.tsx       # Mobile-specific layout wrapper

hooks/
├── useInstallPrompt.ts    # Hook for install prompt
└── useServiceWorker.ts    # Hook for SW management

app/
└── layout.tsx             # Updated with PWA components
```

## How It Works

### 1. Installation Flow

When a user visits Pentagramma on supported devices:

1. **Service Worker Registers** - `PWAInitializer.tsx` registers the SW
2. **Install Prompt Shows** - `InstallBanner.tsx` appears after 2 seconds
3. **User Installs** - Click "Install App" to add to home screen
4. **App Launches** - Opens in standalone mode without browser UI

### 2. Update Detection

Updates happen automatically:

1. **Background Check** - Service Worker checks for updates every hour
2. **Update Available** - `UpdateNotification.tsx` prompts user
3. **User Action** - Click "Update Now" to refresh with new version
4. **Auto-Sync** - All devices sync the new version automatically

### 3. Offline Support

Service Worker provides offline functionality:

- **Network First**: Try network, fallback to cache
- **Cache Strategy**: Static assets cached for 24 hours
- **Offline Page**: `/offline.html` shown if no cached page available
- **Data Persistence**: User progress saved locally via browser storage

## Usage on Different Devices

### Desktop (Chrome/Edge)

1. Visit [pentagramma.app](http://pentagramma.app)
2. Click install icon in address bar or banner
3. App opens in window without browser UI
4. Updates sync automatically

### Mobile (iOS)

1. Open Safari and visit site
2. Tap Share button → "Add to Home Screen"
3. App appears as icon on home screen
4. Tap to open app in full-screen mode
5. MIDI support available (with compatible devices)

### Mobile (Android)

1. Open Chrome and visit site
2. Tap menu (three dots) → "Install app"
3. OR click install banner when shown
4. App appears as icon on home screen
5. Full MIDI support included

## Key Features Explained

### Install Banner (`InstallBanner.tsx`)

Shows after 2 seconds on first visit if device supports installation:
- **Desktop**: Shows desktop install text
- **Mobile**: Shows "Add to Home Screen" message
- Dismissible via "Not Now" button
- Won't show if already installed

### Update Notification (`UpdateNotification.tsx`)

Appears when new version is available:
- Offers immediate update or "Later"
- Updates downloads in background
- Full page reload ensures new version loads
- Automatic on all devices

### Service Worker (`sw.js`)

Handles all PWA functionality:
- **Caching Strategy**: Network-first for HTML, cache-first for assets
- **Update Checks**: Every hour in background
- **Offline Fallback**: Shows offline page if needed
- **Message Handling**: Receives commands from pages (clear cache, skip waiting)

### Mobile Layout (`MobileLayout.tsx`)

Optimizations for mobile devices:
- Safe area support (notches, dynamic island)
- Touch-optimized controls (44px minimum tap targets)
- Prevents double-tap zoom on buttons
- Optimized font sizes (16px minimum to prevent zoom on iOS)
- Proper viewport handling for standalone mode

## Configuration

### Manifest.json

Customize app appearance:

```json
{
  "name": "Pentagramma",
  "short_name": "Pentagramma",
  "start_url": "/",
  "display": "standalone",
  "theme_color": "#2d3748",
  "icons": [...]
}
```

### Service Worker Updates

- Cache version: `CACHE_VERSION` in `sw.js`
- Increment when deploying changes
- SW automatically clears old caches

## Development vs Production

### Development Mode
- Service Worker disabled
- No caching
- Real-time updates
- Console logs enabled

### Production Mode
- Service Worker active
- Full caching enabled
- Update notifications shown
- Optimized performance

## Testing

### Test Installation Prompt

1. Open DevTools (F12)
2. Go to Application tab
3. Left sidebar → Manifest
4. Click "Add to shelf" (Chrome)
5. Or test on real device

### Test Offline Mode

1. Go to Application tab → Service Workers
2. Enable "Offline" checkbox
3. Reload page
4. Should show cached content or offline page

### Test Updates

1. Change `CACHE_VERSION` in `sw.js`
2. Reload page
3. Update notification should appear
4. Click "Update Now"
5. Page reloads with new version

## MIDI on Mobile

Full MIDI support included:

- **Android**: Via USB MIDI devices or Bluetooth MIDI
- **iOS**: Via Bluetooth MIDI or USB MIDI adapters
- Same functionality as desktop
- Install as app for best compatibility

## Browser Support

### Full Support (PWA Features)
- ✅ Chrome/Chromium (v40+)
- ✅ Edge (v18+)
- ✅ Samsung Internet
- ✅ Opera (v27+)
- ✅ Android Firefox (partial)

### Partial Support (Basic Functionality)
- ⚠️ Safari (iOS 16.4+) - Install prompt not shown, but works with "Add to Home Screen"
- ⚠️ Firefox Desktop - No install prompt

### Limited Support
- ❌ Internet Explorer - Use modern browser instead

## Troubleshooting

### Install Prompt Not Showing

1. Check manifest.json is valid
2. Verify icons exist in `/public/icons/`
3. Check browser supports PWA (use Chrome/Edge)
4. Clear browser cache and cookies
5. Try incognito/private mode

### Service Worker Not Registering

1. Check browser console for errors
2. Verify `/sw.js` exists
3. Check Application tab → Service Workers
4. Try clearing site cache

### MIDI Not Working on Mobile

1. Use USB MIDI device on Android with adapter
2. Use Bluetooth MIDI on iOS 13+
3. Check app has permissions
4. Try opening as installed app (not web)

### Updates Not Syncing

1. Check Service Worker is registered
2. Verify no browser cache blocking updates
3. Wait for hourly update check
4. Manually refresh page (Ctrl+Shift+R)

## Next Steps

1. **Add Icons**: Create icons in `/public/icons/` (see guide)
2. **Test on Devices**: Test installation on mobile/tablet
3. **Configure Manifest**: Customize colors and metadata
4. **Monitor Updates**: Check browser console for SW logs
5. **Optimize Icons**: Use high-quality, properly designed icons

## Additional Resources

- [Web.dev PWA Docs](https://web.dev/progressive-web-apps/)
- [MDN Service Worker Guide](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)
- [PWABuilder Tool](https://www.pwabuilder.com/)
- [Manifest Spec](https://w3c.github.io/manifest/)
