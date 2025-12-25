'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import it from '../locales/it.json';
import en from '../locales/en.json';

type Locale = 'it' | 'en';
type Translations = typeof it;

interface LanguageContextType {
    locale: Locale;
    setLocale: (locale: Locale) => void;
    t: (keyPath: string) => string;
}

const translations: Record<Locale, any> = { it, en };

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider = ({ children }: { children: ReactNode }) => {
    const [locale, setLocaleState] = useState<Locale>('it');

    useEffect(() => {
        const savedLocale = localStorage.getItem('app-locale') as Locale;
        if (savedLocale && (savedLocale === 'it' || savedLocale === 'en')) {
            setLocaleState(savedLocale);
        } else {
            // Auto-detect browser language
            const browserLang = navigator.language.split('-')[0];
            if (browserLang === 'en') {
                setLocaleState('en');
            }
        }
    }, []);

    const setLocale = (newLocale: Locale) => {
        setLocaleState(newLocale);
        localStorage.setItem('app-locale', newLocale);
    };

    const t = (keyPath: string): string => {
        const keys = keyPath.split('.');
        let result = translations[locale];

        for (const key of keys) {
            if (result[key] === undefined) {
                console.warn(`Translation key not found: ${keyPath}`);
                return keyPath;
            }
            result = result[key];
        }

        return result as string;
    };

    return (
        <LanguageContext.Provider value={{ locale, setLocale, t }}>
            {children}
        </LanguageContext.Provider>
    );
};

export const useTranslation = () => {
    const context = useContext(LanguageContext);
    if (context === undefined) {
        throw new Error('useTranslation must be used within a LanguageProvider');
    }
    return context;
};
