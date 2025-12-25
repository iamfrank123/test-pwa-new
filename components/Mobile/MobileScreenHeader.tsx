'use client';

import React from 'react';
import { useTranslation } from '@/context/LanguageContext';

interface MobileScreenHeaderProps {
    title: string;
}

export default function MobileScreenHeader({ title }: MobileScreenHeaderProps) {
    const { t, locale, setLocale } = useTranslation();

    return (
        <div className="bg-white/80 backdrop-blur-md border-b border-gray-200 px-3 py-2 flex items-center justify-between sticky top-0 z-10">
            <h1 className="text-lg font-black text-gray-800 flex-1">{title}</h1>

            {/* Language Selector */}
            <div className="flex gap-1 bg-gray-100 rounded-lg p-0.5">
                <button
                    onClick={() => setLocale('it')}
                    className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${locale === 'it'
                            ? 'bg-white text-purple-700 shadow-sm'
                            : 'text-gray-600 hover:text-gray-800'
                        }`}
                >
                    🇮🇹 IT
                </button>
                <button
                    onClick={() => setLocale('en')}
                    className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${locale === 'en'
                            ? 'bg-white text-purple-700 shadow-sm'
                            : 'text-gray-600 hover:text-gray-800'
                        }`}
                >
                    🇬🇧 EN
                </button>
            </div>
        </div>
    );
}
