'use client';

import { useEffect, useState } from 'react';
import { useServiceWorker } from '@/hooks/useServiceWorker';

export default function UpdateNotification() {
  const { updateAvailable, skipWaiting } = useServiceWorker();
  const [showNotification, setShowNotification] = useState(false);

  useEffect(() => {
    if (updateAvailable) {
      setShowNotification(true);
    }
  }, [updateAvailable]);

  const handleUpdate = () => {
    skipWaiting();
    // Reload after a short delay to ensure new service worker is active
    setTimeout(() => {
      window.location.reload();
    }, 500);
  };

  const handleDismiss = () => {
    setShowNotification(false);
  };

  if (!showNotification) {
    return null;
  }

  return (
    <div className="fixed top-0 left-0 right-0 z-40 animate-in slide-in-from-top-4">
      <div className="bg-gradient-to-r from-green-600 to-emerald-600 text-white shadow-lg">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between gap-4 flex-col sm:flex-row">
            <div className="flex items-center gap-3 flex-1">
              <span className="text-xl">✨</span>
              <div>
                <h3 className="font-semibold">Update Available</h3>
                <p className="text-sm text-green-100">A new version of Pentagramma is ready to use</p>
              </div>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                onClick={handleDismiss}
                className="flex-1 sm:flex-initial px-4 py-2 text-green-100 hover:bg-green-700 rounded-lg font-medium transition-colors"
                aria-label="Dismiss update notification"
              >
                Later
              </button>
              <button
                onClick={handleUpdate}
                className="flex-1 sm:flex-initial px-4 py-2 bg-white text-green-600 rounded-lg font-medium hover:bg-green-50 transition-colors"
                aria-label="Update Pentagramma"
              >
                Update Now
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
