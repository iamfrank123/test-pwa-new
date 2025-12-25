'use client';

import React, { ReactNode } from 'react';

interface MobileScreenTransitionProps {
    children: ReactNode;
    screenKey: string;
}

export default function MobileScreenTransition({ children, screenKey }: MobileScreenTransitionProps) {
    return (
        <div
            key={screenKey}
            className="mobile-screen-transition w-full h-full"
            style={{
                animation: 'mobileScreenFadeIn 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
            }}
        >
            {children}
            
            <style jsx>{`
                @keyframes mobileScreenFadeIn {
                    from {
                        opacity: 0;
                        transform: translateY(10px) scale(0.98);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0) scale(1);
                    }
                }

                .mobile-screen-transition {
                    will-change: opacity, transform;
                }
            `}</style>
        </div>
    );
}
