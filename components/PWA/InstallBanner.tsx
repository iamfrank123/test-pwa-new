'use client';

import { useEffect, useState } from 'react';
import { useInstallPrompt } from '@/hooks/useInstallPrompt';

export default function PWAInstallBanner() {
  const { isInstallable, isInstalled, install } = useInstallPrompt();
  const [isMobile, setIsMobile] = useState(false);
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    // Check if device is mobile/tablet
    const checkMobile = () => {
      const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
        navigator.userAgent
      );
      setIsMobile(isMobileDevice);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    if (isInstallable && !isInstalled) {
      // Show banner after a short delay
      const timeout = setTimeout(() => setShowBanner(true), 2000);
      return () => clearTimeout(timeout);
    }
  }, [isInstallable, isInstalled]);

  const handleInstall = async () => {
    await install();
    setShowBanner(false);
  };

  const handleDismiss = () => {
    setShowBanner(false);
  };

  if (!showBanner || isInstalled) {
    return null;
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 animate-in slide-in-from-bottom-4">
      <div className="bg-white border-t border-gray-200 shadow-lg">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between gap-4 flex-col sm:flex-row">
            <div className="flex items-center gap-3 flex-1">
              <div className="text-3xl">🎵</div>
              <div>
                <h3 className="font-semibold text-gray-900">Install Pentagramma</h3>
                <p className="text-sm text-gray-600">
                  {isMobile
                    ? 'Add Pentagramma to your home screen for offline access and better performance'
                    : 'Install Pentagramma as an app for a better experience'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                onClick={handleDismiss}
                className="flex-1 sm:flex-initial px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg font-medium transition-colors"
                aria-label="Dismiss install banner"
              >
                Not Now
              </button>
              <button
                onClick={handleInstall}
                className="flex-1 sm:flex-initial px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg font-medium hover:shadow-lg transition-all hover:from-blue-700 hover:to-indigo-700"
                aria-label="Install Pentagramma app"
              >
                {isMobile ? '📱 Install App' : '⬇️ Install'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
