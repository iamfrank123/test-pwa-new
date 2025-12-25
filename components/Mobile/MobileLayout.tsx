'use client';

import React, { useEffect } from 'react';
import { MobileProvider, useMobile } from '@/context/MobileContext';
import ModeSelector from './ModeSelector';
import MobileScreenTransition from './MobileScreenTransition';
import RhythmScreen from './Screens/RhythmScreen';
import SightReadingScreen from './Screens/SightReadingScreen';
import MelodicScreen from './Screens/MelodicScreen';
import ChallengeScreen from './Screens/ChallengeScreen';

function MobileLayoutContent() {
    const { currentMode, isExerciseActive } = useMobile();

    // Prevent zoom and horizontal swipe
    useEffect(() => {
        // Prevent pinch zoom
        const preventZoom = (e: TouchEvent) => {
            if (e.touches.length > 1) {
                e.preventDefault();
            }
        };

        // Prevent double-tap zoom
        let lastTouchEnd = 0;
        const preventDoubleTapZoom = (e: TouchEvent) => {
            const now = Date.now();
            if (now - lastTouchEnd <= 300) {
                e.preventDefault();
            }
            lastTouchEnd = now;
        };

        document.addEventListener('touchstart', preventZoom, { passive: false });
        document.addEventListener('touchmove', preventZoom, { passive: false });
        document.addEventListener('touchend', preventDoubleTapZoom, { passive: false });

        return () => {
            document.removeEventListener('touchstart', preventZoom);
            document.removeEventListener('touchmove', preventZoom);
            document.removeEventListener('touchend', preventDoubleTapZoom);
        };
    }, []);

    const renderScreen = () => {
        switch (currentMode) {
            case 'rhythm':
                return <RhythmScreen />;
            case 'sight-reading':
                return <SightReadingScreen />;
            case 'melodic':
                return <MelodicScreen />;
            case 'challenge':
                return <ChallengeScreen />;
            default:
                return <RhythmScreen />;
        }
    };

    return (
        <div className="fixed inset-0 flex flex-col bg-stone-50 overflow-hidden">
            {/* Mode Selector - Always visible at top */}
            {!isExerciseActive && <ModeSelector />}

            {/* Main Content Area */}
            <div className="flex-1 overflow-hidden" style={{ marginTop: isExerciseActive ? '0' : '96px' }}>
                <MobileScreenTransition screenKey={currentMode}>
                    {renderScreen()}
                </MobileScreenTransition>
            </div>
        </div>
    );
}

export default function MobileLayout() {
    return (
        <MobileProvider>
            <MobileLayoutContent />
        </MobileProvider>
    );
}
