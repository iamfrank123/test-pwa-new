'use client';

import { useEffect, useState, useCallback } from 'react';

export function useServiceWorker() {
  const [isRegistered, setIsRegistered] = useState(false);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      return;
    }

    const registerServiceWorker = async () => {
      try {
        const reg = await navigator.serviceWorker.register('/sw.js', {
          scope: '/',
          updateViaCache: 'none', // Always check for updates
        });

        console.log('[SW] Service Worker registered:', reg);
        setRegistration(reg);
        setIsRegistered(true);

        // Check for updates every hour
        setInterval(() => {
          console.log('[SW] Checking for updates...');
          reg.update();
        }, 60 * 60 * 1000);

        // Listen for updates
        reg.addEventListener('updatefound', () => {
          console.log('[SW] Update found');
          const newWorker = reg.installing;
          if (!newWorker) return;

          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // New service worker is ready to replace the old one
              setUpdateAvailable(true);
              console.log('[SW] Update available - ready to activate');
            }
          });
        });
      } catch (error) {
        console.error('[SW] Failed to register Service Worker:', error);
      }
    };

    // Register on client side only, after a short delay
    const timeout = setTimeout(registerServiceWorker, 1000);
    return () => clearTimeout(timeout);
  }, []);

  const skipWaiting = useCallback(() => {
    if (registration?.waiting) {
      console.log('[SW] Requesting skip waiting');
      registration.waiting.postMessage({ type: 'SKIP_WAITING' });
      setUpdateAvailable(false);
    }
  }, [registration]);

  const clearCache = useCallback(() => {
    if (registration?.active) {
      console.log('[SW] Requesting cache clear');
      registration.active.postMessage({ type: 'CLEAR_CACHE' });
    }
  }, [registration]);

  return {
    isRegistered,
    updateAvailable,
    skipWaiting,
    clearCache,
    registration,
  };
}
