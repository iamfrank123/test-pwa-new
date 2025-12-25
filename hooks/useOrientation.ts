'use client';

import { useCallback, useEffect, useState } from 'react';

export type OrientationType = 'portrait' | 'landscape' | 'any';

interface UseOrientationReturn {
    currentOrientation: OrientationType;
    lockPortrait: () => Promise<void>;
    lockLandscape: () => Promise<void>;
    unlock: () => Promise<void>;
    requestFullscreen: () => Promise<void>;
    exitFullscreen: () => Promise<void>;
    isFullscreen: boolean;
}

/**
 * Hook to manage screen orientation and fullscreen
 * Handles graceful degradation for unsupported browsers (e.g., iOS Safari)
 */
export function useOrientation(): UseOrientationReturn {
    const [currentOrientation, setCurrentOrientation] = useState<OrientationType>('portrait');
    const [isFullscreen, setIsFullscreen] = useState(false);

    // Update orientation state
    useEffect(() => {
        const updateOrientation = () => {
            if (typeof window !== 'undefined') {
                const isPortrait = window.innerHeight > window.innerWidth;
                setCurrentOrientation(isPortrait ? 'portrait' : 'landscape');
            }
        };

        updateOrientation();
        window.addEventListener('resize', updateOrientation);
        window.addEventListener('orientationchange', updateOrientation);

        return () => {
            window.removeEventListener('resize', updateOrientation);
            window.removeEventListener('orientationchange', updateOrientation);
        };
    }, []);

    // Track fullscreen status
    useEffect(() => {
        const updateFullscreenStatus = () => {
            setIsFullscreen(!!document.fullscreenElement);
        };

        document.addEventListener('fullscreenchange', updateFullscreenStatus);
        return () => {
            document.removeEventListener('fullscreenchange', updateFullscreenStatus);
        };
    }, []);

    const requestFullscreen = useCallback(async () => {
        try {
            if (document.fullscreenEnabled && !document.fullscreenElement) {
                await document.documentElement.requestFullscreen();
            }
        } catch (err) {
            console.log('Fullscreen request failed:', err);
        }
    }, []);

    const exitFullscreen = useCallback(async () => {
        try {
            if (document.fullscreenElement) {
                await document.exitFullscreen();
            }
        } catch (err) {
            console.log('Exit fullscreen failed:', err);
        }
    }, []);

    const lockPortrait = useCallback(async () => {
        try {
            // Request fullscreen first (required for orientation lock)
            await requestFullscreen();

            // @ts-ignore - Screen Orientation API
            if (screen.orientation && screen.orientation.lock) {
                // @ts-ignore
                await screen.orientation.lock('portrait').catch((err: any) => {
                    console.log('Portrait orientation lock not supported:', err);
                });
            }
        } catch (err) {
            console.log('Lock portrait failed:', err);
        }
    }, [requestFullscreen]);

    const lockLandscape = useCallback(async () => {
        try {
            // Request fullscreen first (required for orientation lock)
            await requestFullscreen();

            // @ts-ignore - Screen Orientation API
            if (screen.orientation && screen.orientation.lock) {
                // @ts-ignore
                await screen.orientation.lock('landscape').catch((err: any) => {
                    console.log('Landscape orientation lock not supported:', err);
                });
            }
        } catch (err) {
            console.log('Lock landscape failed:', err);
        }
    }, [requestFullscreen]);

    const unlock = useCallback(async () => {
        try {
            // @ts-ignore - Screen Orientation API
            if (screen.orientation && screen.orientation.unlock) {
                // @ts-ignore
                screen.orientation.unlock();
            }

            // Optionally exit fullscreen when unlocking
            await exitFullscreen();
        } catch (err) {
            console.log('Unlock orientation failed:', err);
        }
    }, [exitFullscreen]);

    return {
        currentOrientation,
        lockPortrait,
        lockLandscape,
        unlock,
        requestFullscreen,
        exitFullscreen,
        isFullscreen
    };
}
