import './globals.css'
import type { Metadata } from 'next'
import PWAInitializer from '@/components/PWA/Initializer'
import InstallBanner from '@/components/PWA/InstallBanner'
import UpdateNotification from '@/components/PWA/UpdateNotification'
import MobileLayout from '@/components/PWA/MobileLayout'

export const metadata: Metadata = {
    title: 'Pentagramma - Interactive MIDI Piano Trainer',
    description: 'Learn piano with real-time MIDI feedback and digital sheet music',
    manifest: '/manifest.json',
    appleWebApp: {
        capable: true,
        statusBarStyle: 'black-translucent',
        title: 'Pentagramma',
    },
    formatDetection: {
        telephone: false,
    },
    viewport: {
        width: 'device-width',
        initialScale: 1,
        maximumScale: 5,
        minimumScale: 1,
        userScalable: true,
        viewportFit: 'cover',
    },
}

export default function RootLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <html lang="it">
            <head>
                <meta name="theme-color" content="#2d3748" />
                <meta name="msapplication-TileColor" content="#2d3748" />
                <link rel="icon" href="/icons/icon-192x192.png" />
                <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />
                <meta name="apple-mobile-web-app-capable" content="yes" />
                <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
                <meta name="apple-mobile-web-app-title" content="Pentagramma" />
            </head>
            <body>
                <PWAInitializer />
                <MobileLayout>
                    {children}
                    <InstallBanner />
                    <UpdateNotification />
                </MobileLayout>
            </body>
        </html>
    )
}
