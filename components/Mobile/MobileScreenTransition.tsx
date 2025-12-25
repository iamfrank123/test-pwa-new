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
                animation: 'fadeIn 0.3s ease-in-out'
            }}
        >
            {children}
        </div>
    );
}
