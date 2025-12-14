'use client';

import { useEffect, useState } from 'react';

interface MobileLayoutProps {
  children: React.ReactNode;
}

export default function MobileLayout({ children }: MobileLayoutProps) {
  const [isMobile, setIsMobile] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
        navigator.userAgent
      );
      setIsMobile(isMobileDevice);

      // Check if running as PWA
      const isStandaloneMode =
        window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as any).standalone === true;
      setIsStandalone(isStandaloneMode);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);

    // Watch for PWA install
    window.addEventListener('orientationchange', checkMobile);

    return () => {
      window.removeEventListener('resize', checkMobile);
      window.removeEventListener('orientationchange', checkMobile);
    };
  }, []);

  return (
    <div className={`${isMobile ? 'mobile-layout' : 'desktop-layout'} ${isStandalone ? 'pwa-standalone' : ''}`}>
      {/* Add safe area for notches on mobile */}
      {isMobile && (
        <style>{`
          body {
            padding-top: max(env(safe-area-inset-top), 0px);
            padding-left: max(env(safe-area-inset-left), 0px);
            padding-right: max(env(safe-area-inset-right), 0px);
            padding-bottom: max(env(safe-area-inset-bottom), 0px);
          }
          
          .mobile-layout {
            width: 100vw;
            height: 100vh;
            overflow: hidden;
            display: flex;
            flex-direction: column;
          }
          
          .mobile-layout main {
            flex: 1;
            overflow-y: auto;
            overflow-x: hidden;
            -webkit-overflow-scrolling: touch;
          }
          
          /* Prevent zoom on input focus for iOS */
          input, select, textarea {
            font-size: 16px !important;
          }
          
          /* Better touch targets for mobile */
          button, a {
            min-height: 44px;
            min-width: 44px;
          }
          
          /* Prevent double-tap zoom on buttons */
          button, a {
            touch-action: manipulation;
          }
        `}</style>
      )}
      {children}
    </div>
  );
}
