'use client';

import React from 'react';
import { useTranslation } from '@/context/LanguageContext';

interface MobileScreenHeaderProps {
    title: string;
}

export default function MobileScreenHeader({ title }: MobileScreenHeaderProps) {
    const { t, locale, setLocale } = useTranslation();

    // Haptic feedback
    const haptic = () => {
        if (navigator.vibrate) {
            navigator.vibrate(10);
        }
    };

    return (
        <div className="bg-white/95 backdrop-blur-xl border-b border-gray-200 px-4 py-3 flex items-center justify-between sticky top-0 z-10 shadow-sm">
            <h1 className="text-xl font-black text-gray-800 flex-1 tracking-tight">{title}</h1>

            {/* Language Selector - Modern Pills */}
            <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
                <button
                    onClick={() => { haptic(); setLocale('it'); }}
                    className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                        locale === 'it'
                            ? 'bg-white text-purple-700 shadow-md scale-105'
                            : 'text-gray-600 hover:text-gray-800 active:scale-95'
                    }`}
                >
                    <span className="mr-1">🇮🇹</span>
                    IT
                </button>
                <button
                    onClick={() => { haptic(); setLocale('en'); }}
                    className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                        locale === 'en'
                            ? 'bg-white text-purple-700 shadow-md scale-105'
                            : 'text-gray-600 hover:text-gray-800 active:scale-95'
                    }`}
                >
                    <span className="mr-1">🇬🇧</span>
                    EN
                </button>
            </div>
        </div>
    );
}
