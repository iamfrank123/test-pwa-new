'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function Header() {
    const [mounted, setMounted] = useState(false);
    const [midiStatus, setMidiStatus] = useState({
        hasAccess: false,
        error: null as string | null,
    });

    // Only run on client
    useEffect(() => {
        setMounted(true);

        // Check MIDI support
        if (typeof navigator !== 'undefined' && typeof navigator.requestMIDIAccess === 'function') {
            setMidiStatus({ hasAccess: true, error: null });
        } else {
            setMidiStatus({
                hasAccess: false,
                error: 'WebMIDI not supported'
            });
        }
    }, []);

    const handleMIDIConnect = async () => {
        try {
            if (typeof navigator !== 'undefined' && typeof navigator.requestMIDIAccess === 'function') {
                await navigator.requestMIDIAccess();
                setMidiStatus({ hasAccess: true, error: null });
            }
        } catch (error) {
            setMidiStatus({
                hasAccess: false,
                error: 'Failed to access MIDI'
            });
        }
    };

    return (
        <header className="bg-white shadow-sm border-b border-gray-200">
            <div className="container mx-auto px-4 py-4">
                <div className="flex items-center justify-between">
                    {/* Logo & Navigation */}
                    <div className="flex items-center space-x-8">
                        <div>
                            <Link href="/">
                                <h1 className="text-2xl font-bold text-gray-800 cursor-pointer hover:text-blue-600 transition">
                                    🎼 Pentagramma
                                </h1>
                            </Link>
                            <p className="text-sm text-gray-600">Interactive MIDI Piano Trainer</p>
                        </div>

                        <nav className="hidden md:flex space-x-4">
                            <Link href="/" className="px-3 py-2 text-gray-700 hover:bg-gray-100 rounded-md font-medium">
                                Sight Reading
                            </Link>
                            <Link href="/challenge" className="px-3 py-2 text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-md font-medium">
                                ⚡ Challenge Mode
                            </Link>
                            <Link href="/rhythm" className="px-3 py-2 text-amber-600 bg-amber-50 hover:bg-amber-100 rounded-md font-medium">
                                🥁 Rhythm Mode
                            </Link>
                            <Link href="/melodic-solfege" className="px-3 py-2 text-amber-600 hover:bg-amber-50 rounded-md font-medium">
                                🎵 Melodic Solfege
                            </Link>
                        </nav>
                    </div>

                    {/* Only render after mounting (prevents hydration error) */}
                    {mounted && (
                        <div className="flex items-center space-x-4">
                            {!midiStatus.hasAccess ? (
                                <button
                                    onClick={handleMIDIConnect}
                                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                                >
                                    🎹 Connect MIDI
                                </button>
                            ) : (
                                <div className="px-4 py-2 bg-green-50 border border-green-200 rounded-lg">
                                    <span className="text-green-700">✓ MIDI Ready</span>
                                </div>
                            )}

                            {midiStatus.error && (
                                <div className="px-4 py-2 bg-yellow-50 border border-yellow-200 rounded-lg">
                                    <span className="text-yellow-700 text-sm">⚠️ {midiStatus.error}</span>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </header>
    );
}
