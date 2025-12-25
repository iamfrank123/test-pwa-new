'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useTranslation } from '@/context/LanguageContext';
import { useMobile } from '@/context/MobileContext';
import { useOrientation } from '@/hooks/useOrientation';
import ScrollingStaff from '@/components/Staff/ScrollingStaff';
import { KeySignature, NoteRange } from '@/lib/generator/types';
import { NoteQueueManager } from '@/lib/generator/queue-manager';
import { checkNoteMatch } from '@/lib/generator/note-generator';
import { useMIDIInput } from '@/hooks/useMIDIInput';
import { MIDINoteEvent } from '@/lib/types/midi';
import MobileScreenHeader from '@/components/Mobile/MobileScreenHeader';

const KEY_SIGNATURES: KeySignature[] = ['C', 'G', 'D', 'A', 'E', 'F', 'Bb', 'Eb', 'Ab'];

export default function SightReadingScreen() {
    const { t } = useTranslation();
    const { setIsExerciseActive } = useMobile();
    const { lockLandscape, unlock, requestFullscreen, exitFullscreen } = useOrientation();

    // Settings
    const [keySignature, setKeySignature] = useState<KeySignature>('C');
    const [noteRange, setNoteRange] = useState<NoteRange>({ low: 'C4', high: 'C5' });

    // Exercise state
    const [isPlaying, setIsPlaying] = useState(false);
    const [noteQueue, setNoteQueue] = useState<any[]>([]);
    const [currentNoteIndex, setCurrentNoteIndex] = useState(0);
    const [feedbackStatus, setFeedbackStatus] = useState<'idle' | 'correct' | 'incorrect'>('idle');
    const [stats, setStats] = useState({ perfect: 0, good: 0, miss: 0 });

    const queueManagerRef = useRef<NoteQueueManager | null>(null);
    const isProcessingRef = useRef(false);

    // Haptic feedback
    const haptic = useCallback((intensity: 'light' | 'medium' | 'heavy' | 'success' | 'error' = 'light') => {
        if (navigator.vibrate) {
            const patterns = {
                light: 10,
                medium: 20,
                heavy: 30,
                success: [10, 50, 10],
                error: [20, 100, 20]
            };
            navigator.vibrate(patterns[intensity] || 10);
        }
    }, []);

    // Start exercise
    const startGame = useCallback(async () => {
        haptic('medium');
        setIsExerciseActive(true);
        await requestFullscreen();
        await lockLandscape();

        const manager = new NoteQueueManager(keySignature, noteRange);
        manager.initializeQueue(20);

        queueManagerRef.current = manager;
        setNoteQueue(manager.getAllNotes());
        setCurrentNoteIndex(0);
        setIsPlaying(true);
        setFeedbackStatus('idle');
        setStats({ perfect: 0, good: 0, miss: 0 });
    }, [keySignature, noteRange, setIsExerciseActive, requestFullscreen, lockLandscape, haptic]);

    // Stop exercise
    const stopGame = useCallback(async () => {
        haptic('medium');
        setIsPlaying(false);
        setNoteQueue([]);
        setCurrentNoteIndex(0);
        setFeedbackStatus('idle');
        queueManagerRef.current = null;
        setIsExerciseActive(false);
        await exitFullscreen();
        await unlock();
    }, [setIsExerciseActive, exitFullscreen, unlock, haptic]);

    // MIDI handler
    const handleMIDINote = useCallback((event: MIDINoteEvent) => {
        if (!isPlaying || !queueManagerRef.current || event.type !== 'noteOn') return;
        if (isProcessingRef.current) return;

        const manager = queueManagerRef.current;
        const currentNote = manager.getCurrentNote();
        if (!currentNote) return;

        const isCorrect = checkNoteMatch(event.pitch, currentNote);

        if (isCorrect) {
            isProcessingRef.current = true;
            setTimeout(() => { isProcessingRef.current = false; }, 100);

            setStats(s => ({ ...s, perfect: s.perfect + 1 }));
            manager.shiftQueue();
            setNoteQueue([...manager.getAllNotes()]);
            setFeedbackStatus('correct');
            haptic('success');
            setTimeout(() => setFeedbackStatus('idle'), 500);
        } else {
            isProcessingRef.current = true;
            setTimeout(() => { isProcessingRef.current = false; }, 200);

            setFeedbackStatus('incorrect');
            setStats(s => ({ ...s, miss: s.miss + 1 }));
            haptic('error');
            setTimeout(() => setFeedbackStatus('idle'), 500);
        }
    }, [isPlaying, haptic]);

    useMIDIInput(handleMIDINote);

    return (
        <div className="flex flex-col h-full bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 overflow-hidden">
            {/* Settings Panel - Portrait Mode */}
            {!isPlaying && (
                <>
                    <MobileScreenHeader title={t('sight_reading.title')} />
                    <div className="flex-1 overflow-y-auto px-4 py-4 pb-safe">
                        <div className="max-w-md mx-auto space-y-3">
                            {/* MIDI Connection Status */}
                            <div className="bg-gradient-to-r from-blue-500 to-indigo-600 p-4 rounded-2xl shadow-lg">
                                <div className="flex items-center gap-3 mb-2">
                                    <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
                                        <span className="text-2xl">🎹</span>
                                    </div>
                                    <div className="flex-1">
                                        <h3 className="text-white font-bold text-sm">{t('common.midi_connection')}</h3>
                                        <p className="text-white/80 text-xs">{t('common.midi_connection_sight_reading')}</p>
                                    </div>
                                    <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse shadow-lg" />
                                </div>
                            </div>

                            {/* Key Signature */}
                            <div className="bg-white/90 backdrop-blur-sm p-4 rounded-2xl shadow-md border border-gray-100">
                                <label className="text-xs font-bold text-gray-600 uppercase block mb-3 flex items-center gap-2">
                                    <span className="text-lg">🎼</span>
                                    <span>{t('common.key')}</span>
                                </label>
                                <div className="grid grid-cols-5 gap-2">
                                    {KEY_SIGNATURES.map(key => (
                                        <button
                                            key={key}
                                            onClick={() => { haptic('light'); setKeySignature(key); }}
                                            className={`py-3 rounded-xl text-sm font-bold transition-all ${
                                                keySignature === key 
                                                    ? 'bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-lg scale-110' 
                                                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                            }`}
                                        >
                                            {key}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Note Range */}
                            <div className="bg-white/90 backdrop-blur-sm p-4 rounded-2xl shadow-md border border-gray-100">
                                <label className="text-xs font-bold text-gray-600 uppercase block mb-3 flex items-center gap-2">
                                    <span className="text-lg">🎵</span>
                                    <span>{t('common.note_range')}</span>
                                </label>
                                <div className="flex items-center gap-3">
                                    <div className="flex-1">
                                        <label className="text-xs text-gray-500 font-medium mb-1 block">Low Note</label>
                                        <input
                                            type="text"
                                            value={noteRange.low}
                                            onChange={e => setNoteRange({ ...noteRange, low: e.target.value })}
                                            className="w-full py-3 px-4 text-base rounded-xl border-2 border-gray-200 text-center font-bold focus:border-blue-400 focus:outline-none bg-white shadow-sm"
                                            placeholder="C4"
                                        />
                                    </div>
                                    <div className="text-gray-400 text-2xl font-bold pt-6">→</div>
                                    <div className="flex-1">
                                        <label className="text-xs text-gray-500 font-medium mb-1 block">High Note</label>
                                        <input
                                            type="text"
                                            value={noteRange.high}
                                            onChange={e => setNoteRange({ ...noteRange, high: e.target.value })}
                                            className="w-full py-3 px-4 text-base rounded-xl border-2 border-gray-200 text-center font-bold focus:border-blue-400 focus:outline-none bg-white shadow-sm"
                                            placeholder="C5"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Instructions */}
                            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-4 rounded-2xl border-2 border-blue-200">
                                <h3 className="text-sm font-bold text-blue-900 mb-2 flex items-center gap-2">
                                    <span className="text-lg">💡</span>
                                    <span>How to Play</span>
                                </h3>
                                <ul className="text-xs text-blue-800 space-y-1.5 ml-7">
                                    <li className="leading-relaxed">• Connect your MIDI keyboard</li>
                                    <li className="leading-relaxed">• Play the highlighted note</li>
                                    <li className="leading-relaxed">• Progress through the staff</li>
                                    <li className="leading-relaxed">• Build your sight-reading skills!</li>
                                </ul>
                            </div>

                            {/* Start Button - HERO */}
                            <button
                                onClick={startGame}
                                className="w-full bg-gradient-to-r from-blue-500 via-indigo-600 to-blue-600 text-white font-black py-5 rounded-2xl shadow-2xl active:scale-95 transition-transform flex items-center justify-center gap-3 text-xl border-2 border-blue-400"
                            >
                                <span className="text-4xl">▶️</span>
                                <span>{t('common.start')}</span>
                            </button>

                            <div className="h-4"></div>
                        </div>
                    </div>
                </>
            )}

            {/* Exercise Area - Landscape Mode */}
            {isPlaying && (
                <div className="flex-1 flex flex-col bg-gradient-to-br from-blue-100 to-indigo-100 overflow-hidden">
                    {/* Stats Overlay */}
                    <div className="absolute top-3 left-0 right-0 flex justify-center gap-3 z-20 px-4">
                        <div className="bg-white/95 backdrop-blur-md px-6 py-3 rounded-2xl shadow-xl border-2 border-blue-200 flex gap-8">
                            <div className="flex flex-col items-center">
                                <span className="text-xs font-bold text-green-600 uppercase">Perfect</span>
                                <span className="text-3xl font-black text-green-700">{stats.perfect}</span>
                            </div>
                            <div className="flex flex-col items-center">
                                <span className="text-xs font-bold text-red-500 uppercase">Miss</span>
                                <span className="text-3xl font-black text-red-600">{stats.miss}</span>
                            </div>
                        </div>
                    </div>

                    {/* Feedback */}
                    {feedbackStatus !== 'idle' && (
                        <div className="absolute top-24 left-0 right-0 z-30 flex justify-center pointer-events-none">
                            <div className={`text-3xl font-black px-8 py-4 rounded-2xl shadow-2xl animate-bounce border-4 ${
                                feedbackStatus === 'correct' 
                                    ? 'bg-gradient-to-r from-green-500 to-green-600 text-white border-green-400' 
                                    : 'bg-gradient-to-r from-red-500 to-red-600 text-white border-red-400'
                            }`}>
                                {feedbackStatus === 'correct' ? `✓ ${t('common.correct')}!` : `✗ ${t('stats.miss')}`}
                            </div>
                        </div>
                    )}

                    {/* Staff */}
                    <div className="flex-1 flex items-center justify-center p-4">
                        <ScrollingStaff
                            notes={noteQueue}
                            currentNoteIndex={currentNoteIndex}
                            keySignature={keySignature}
                            feedbackStatus={feedbackStatus}
                        />
                    </div>

                    {/* Key Signature Display */}
                    <div className="absolute top-3 left-4 z-20">
                        <div className="bg-gradient-to-r from-blue-500 to-indigo-600 px-4 py-2 rounded-2xl shadow-xl border-2 border-blue-400">
                            <div className="text-xs font-bold text-white/80 uppercase">Key</div>
                            <div className="text-2xl font-black text-white">{keySignature}</div>
                        </div>
                    </div>

                    {/* Progress Display */}
                    <div className="absolute top-3 right-4 z-20">
                        <div className="bg-white/95 backdrop-blur-md px-4 py-2 rounded-2xl shadow-xl border-2 border-purple-200">
                            <div className="text-xs font-bold text-purple-600 uppercase">Progress</div>
                            <div className="text-2xl font-black text-purple-700">{currentNoteIndex + 1}/{noteQueue.length}</div>
                        </div>
                    </div>

                    {/* Stop Button */}
                    <button
                        onClick={stopGame}
                        className="absolute bottom-4 right-4 bg-gradient-to-r from-red-500 to-red-600 text-white font-bold px-6 py-3 rounded-2xl shadow-2xl active:scale-95 transition-all z-40 flex items-center gap-2 border-2 border-red-400"
                    >
                        <span className="text-xl">⏹️</span>
                        <span className="font-black">{t('common.stop')}</span>
                    </button>

                    {/* MIDI Hint */}
                    <div className="absolute bottom-4 left-4 z-30 bg-white/95 backdrop-blur-sm px-4 py-2 rounded-2xl shadow-lg border-2 border-blue-200">
                        <div className="text-xs font-bold text-blue-600 flex items-center gap-2">
                            <span className="text-lg">🎹</span>
                            <span>Play on your MIDI keyboard</span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
