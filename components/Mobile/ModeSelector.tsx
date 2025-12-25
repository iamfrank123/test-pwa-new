'use client';

import React from 'react';
import { useMobile, ExerciseMode } from '@/context/MobileContext';
import { useTranslation } from '@/context/LanguageContext';

export default function ModeSelector() {
    const { t } = useTranslation();
    const { currentMode, setCurrentMode, isExerciseActive } = useMobile();

    const modes: { id: ExerciseMode; icon: string; label: string; gradient: string }[] = [
        { 
            id: 'rhythm', 
            icon: '🥁', 
            label: t('header.rhythm_solfege'),
            gradient: 'from-purple-500 to-purple-600'
        },
        { 
            id: 'sight-reading', 
            icon: '🎹', 
            label: t('header.sight_reading'),
            gradient: 'from-blue-500 to-blue-600'
        },
        { 
            id: 'melodic', 
            icon: '🎵', 
            label: t('header.melodic_solfege'),
            gradient: 'from-green-500 to-green-600'
        },
        { 
            id: 'challenge', 
            icon: '⚡', 
            label: t('header.challenge'),
            gradient: 'from-amber-500 to-orange-600'
        }
    ];

    // Haptic feedback simulation
    const haptic = () => {
        if (navigator.vibrate) {
            navigator.vibrate(10);
        }
    };

    return (
        <div className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-r from-amber-600 to-orange-500 shadow-xl pt-safe">
            {/* Header Brand */}
            <div className="px-4 pt-2 pb-1 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
                        <span className="text-xl">🎹</span>
                    </div>
                    <div>
                        <h1 className="text-white text-sm font-bold leading-tight">Solfeggio</h1>
                        <p className="text-white/80 text-xs leading-tight">Piano Trainer</p>
                    </div>
                </div>
                
                {/* Status Indicator */}
                {isExerciseActive && (
                    <div className="flex items-center gap-2 bg-white/20 backdrop-blur-sm px-3 py-1 rounded-full">
                        <div className="w-2 h-2 bg-red-400 rounded-full animate-pulse" />
                        <span className="text-white text-xs font-bold">LIVE</span>
                    </div>
                )}
            </div>

            {/* Mode Selector Pills */}
            <div className="px-3 pb-3 overflow-x-auto scrollbar-hide">
                <div className="flex gap-2 min-w-max">
                    {modes.map((mode) => {
                        const isActive = currentMode === mode.id;
                        
                        return (
                            <button
                                key={mode.id}
                                onClick={() => {
                                    if (!isExerciseActive) {
                                        haptic();
                                        setCurrentMode(mode.id);
                                    }
                                }}
                                disabled={isExerciseActive}
                                className={`
                                    flex items-center gap-2 px-4 py-2.5 rounded-2xl 
                                    font-bold text-sm transition-all duration-200
                                    ${isActive 
                                        ? 'bg-white text-amber-700 shadow-lg scale-105' 
                                        : 'bg-white/20 text-white backdrop-blur-sm hover:bg-white/30'
                                    }
                                    ${isExerciseActive 
                                        ? 'opacity-50 cursor-not-allowed' 
                                        : 'cursor-pointer active:scale-95'
                                    }
                                `}
                            >
                                <span className="text-xl">{mode.icon}</span>
                                <span className="whitespace-nowrap">{mode.label}</span>
                                
                                {/* Active Indicator Dot */}
                                {isActive && (
                                    <div className="w-1.5 h-1.5 bg-amber-600 rounded-full ml-1" />
                                )}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Bottom Border with gradient */}
            <div className="h-1 bg-gradient-to-r from-amber-500 via-orange-400 to-amber-500" />
        </div>
    );
}
