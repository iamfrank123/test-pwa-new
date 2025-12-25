import { useState, useEffect } from 'react';

interface BeforeInstallPromptEvent extends Event {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export function usePWA() {
    const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
    const [isInstalled, setIsInstalled] = useState(false);
    const [isIOS, setIsIOS] = useState(false);
    const [isStandalone, setIsStandalone] = useState(false);

    useEffect(() => {
        // 1. Check if already installed (Standalone Mode)
        const checkStandalone = () => {
            const isStandaloneMode =
                window.matchMedia('(display-mode: standalone)').matches ||
                (window.navigator as any).standalone === true; // iOS legacy

            setIsStandalone(isStandaloneMode);
            setIsInstalled(isStandaloneMode); // Initial assumption
        };

        checkStandalone();
        window.matchMedia('(display-mode: standalone)').addEventListener('change', checkStandalone);

        // 2. Platform Detection (iOS)
        const userAgent = window.navigator.userAgent.toLowerCase();
        const isIosDevice = /iphone|ipad|ipod/.test(userAgent);
        setIsIOS(isIosDevice);

        // 3. Capture beforeinstallprompt event (Android / Desktop Chrome)
        const handleBeforeInstallPrompt = (e: Event) => {
            e.preventDefault(); // Prevent default mini-infobar
            setDeferredPrompt(e as BeforeInstallPromptEvent);
            console.log("PWA: beforeinstallprompt captured");
        };

        // 4. Listen for appinstalled event
        const handleAppInstalled = () => {
            setIsInstalled(true);
            setDeferredPrompt(null);
            console.log("PWA: App installed successfully");
        };

        window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
        window.addEventListener('appinstalled', handleAppInstalled);

        return () => {
            window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
            window.removeEventListener('appinstalled', handleAppInstalled);
            window.matchMedia('(display-mode: standalone)').removeEventListener('change', checkStandalone);
        };
    }, []);

    const installApp = async () => {
        if (deferredPrompt) {
            deferredPrompt.prompt();
            const choiceResult = await deferredPrompt.userChoice;
            if (choiceResult.outcome === 'accepted') {
                console.log('PWA: User accepted the install prompt');
            } else {
                console.log('PWA: User dismissed the install prompt');
            }
            setDeferredPrompt(null);
        }
    };

    return {
        isInstalled,
        isIOS,
        isStandalone,
        canInstall: !!deferredPrompt || (isIOS && !isStandalone), // Android/Desktop: prompt available. iOS: not standalone.
        installApp
    };
}
