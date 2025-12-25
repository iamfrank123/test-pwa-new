'use client';

import { useState, useEffect } from 'react';
import { useTranslation } from '@/context/LanguageContext';

export default function OrientationPrompt() {
    const { t } = useTranslation();
    const [show, setShow] = useState(false);

    useEffect(() => {
        const checkOrientation = () => {
            // Show prompt if height > width (Portrait)
            // Some mobile browsers report 0 or incorrect values during rapid rotation
            const isPortrait = window.innerHeight > window.innerWidth;

            // Only show on small screens (mobile/tablets)
            const isMobile = window.innerWidth < 1024;

            setShow(isPortrait && isMobile);
        };

        checkOrientation();
        window.addEventListener('resize', checkOrientation);
        window.addEventListener('orientationchange', checkOrientation);

        return () => {
            window.removeEventListener('resize', checkOrientation);
            window.removeEventListener('orientationchange', checkOrientation);
        };
    }, []);

    if (!show) return null;

    return (
        <div className="fixed inset-0 z-[9999] bg-stone-900 flex flex-col items-center justify-center p-8 text-center sm:hidden">
            <div className="animate-bounce mb-8">
                <svg
                    className="w-24 h-24 text-amber-500"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                >
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"
                    />
                    <path
                        className="animate-[pulse_2s_infinite]"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M7 12l5 5 5-5m-5 5V7"
                        transform="rotate(-90 12 12)"
                    />
                </svg>
            </div>

            <h2 className="text-2xl font-bold text-white mb-4">
                {t('orientation.rotate')}
            </h2>

            <p className="text-stone-400 max-w-xs">
                {t('orientation.optimal')}
            </p>

            <div className="mt-12 flex space-x-2">
                <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></div>
                <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse delay-75"></div>
                <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse delay-150"></div>
            </div>
        </div>
    );
}
