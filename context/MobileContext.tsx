'use client';

import React, { createContext, useContext, useState, ReactNode } from 'react';

export type ExerciseMode = 'rhythm' | 'sight-reading' | 'melodic' | 'challenge';

interface MobileContextType {
    currentMode: ExerciseMode;
    setCurrentMode: (mode: ExerciseMode) => void;
    isExerciseActive: boolean;
    setIsExerciseActive: (active: boolean) => void;
}

const MobileContext = createContext<MobileContextType | undefined>(undefined);

export function MobileProvider({ children }: { children: ReactNode }) {
    const [currentMode, setCurrentMode] = useState<ExerciseMode>('rhythm');
    const [isExerciseActive, setIsExerciseActive] = useState(false);

    return (
        <MobileContext.Provider
            value={{
                currentMode,
                setCurrentMode,
                isExerciseActive,
                setIsExerciseActive
            }}
        >
            {children}
        </MobileContext.Provider>
    );
}

export function useMobile() {
    const context = useContext(MobileContext);
    if (context === undefined) {
        throw new Error('useMobile must be used within a MobileProvider');
    }
    return context;
}
