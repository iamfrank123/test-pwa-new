'use client';

import { useEffect } from 'react';

export default function PWAInitializer() {
  useEffect(() => {
    // Register service worker on mount
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch((err) => {
          console.warn('[SW] Registration failed:', err);
        });
      });
    }
  }, []);

  return null;
}
