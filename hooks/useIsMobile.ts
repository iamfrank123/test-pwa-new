'use client';

import { useState, useEffect } from 'react';

/**
 * Hook to detect if the current device is mobile
 * Uses viewport width and user agent detection
 */
export function useIsMobile(breakpoint: number = 768): boolean {
    const [isMobile, setIsMobile] = useState(false);

    useEffect(() => {
        // Initial check
        const checkIsMobile = () => {
            const width = window.innerWidth;
            const userAgent = navigator.userAgent.toLowerCase();
            const isMobileUA = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent);

            // Device is mobile if viewport is small OR if user agent indicates mobile
            setIsMobile(width < breakpoint || isMobileUA);
        };

        checkIsMobile();

        // Listen for resize events
        window.addEventListener('resize', checkIsMobile);

        return () => {
            window.removeEventListener('resize', checkIsMobile);
        };
    }, [breakpoint]);

    return isMobile;
}
