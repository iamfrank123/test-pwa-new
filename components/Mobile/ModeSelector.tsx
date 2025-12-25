'use client';

import React from 'react';
import { useMobile, ExerciseMode } from '@/context/MobileContext';
import { useTranslation } from '@/context/LanguageContext';

export default function ModeSelector() {
    const { t } = useTranslation();
    const { currentMode, setCurrentMode, isExerciseActive } = useMobile();

    const modes: { id: ExerciseMode; icon: string; label: string }[] = [
        { id: 'rhythm', icon: '🥁', label: t('header.rhythm_solfege') },
        { id: 'sight-reading', icon: '🎹', label: t('header.sight_reading') },
        { id: 'melodic', icon: '🎵', label: t('header.melodic_solfege') },
        { id: 'challenge', icon: '🏆', label: t('header.challenge') }
    ];

    return (
        <div className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 shadow-lg pt-safe">
            <div className="pt-2 pb-3 px-2">
                <div className="flex justify-around items-center gap-1 max-w-md mx-auto">
                    {modes.map((mode) => (
                        <button
                            key={mode.id}
                            onClick={() => !isExerciseActive && setCurrentMode(mode.id)}
                            disabled={isExerciseActive}
                            className={`flex-1 flex flex-col items-center py-2.5 px-1 rounded-xl transition-all ${currentMode === mode.id
                                ? 'bg-white shadow-lg scale-105'
                                : 'bg-white/20 hover:bg-white/30 active:scale-95'
                                } ${isExerciseActive ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
                                }`}
                        >
                            <span className="text-2xl mb-1">{mode.icon}</span>
                            <span className={`text-xs font-bold text-center leading-tight ${currentMode === mode.id ? 'text-purple-700' : 'text-white'
                                }`}>
                                {mode.label}
                            </span>
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
}
