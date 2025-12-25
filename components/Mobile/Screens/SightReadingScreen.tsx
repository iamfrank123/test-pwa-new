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

    // Start exercise
    const startGame = useCallback(async () => {
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
    }, [keySignature, noteRange, setIsExerciseActive, requestFullscreen, lockLandscape]);

    // Stop exercise
    const stopGame = useCallback(async () => {
        setIsPlaying(false);
        setNoteQueue([]);
        setCurrentNoteIndex(0);
        setFeedbackStatus('idle');
        queueManagerRef.current = null;
        setIsExerciseActive(false);
        await exitFullscreen();
        await unlock();
    }, [setIsExerciseActive, exitFullscreen, unlock]);

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
            setTimeout(() => setFeedbackStatus('idle'), 500);
        } else {
            isProcessingRef.current = true;
            setTimeout(() => { isProcessingRef.current = false; }, 200);

            setFeedbackStatus('incorrect');
            setStats(s => ({ ...s, miss: s.miss + 1 }));
            setTimeout(() => setFeedbackStatus('idle'), 500);
        }
    }, [isPlaying]);

    useMIDIInput(handleMIDINote);

    return (
        <div className="flex flex-col h-full bg-gradient-to-br from-stone-50 to-stone-100 overflow-hidden">
            {/* Settings Panel - Portrait Mode */}
            {!isPlaying && (
                <>
                    <MobileScreenHeader title={t('sight_reading.title')} />
                    <div className="flex-1 overflow-y-auto px-3 py-3 pb-safe">
                        <div className="max-w-md mx-auto space-y-2.5">
                            {/* Key Signature */}
                            <div className="bg-white/90 backdrop-blur-sm p-2.5 rounded-xl shadow-sm border border-gray-100">
                                <label className="text-xs font-bold text-gray-600 uppercase block mb-1.5">{t('common.key')}</label>
                                <div className="grid grid-cols-5 gap-1.5">
                                    {KEY_SIGNATURES.map(key => (
                                        <button
                                            key={key}
                                            onClick={() => setKeySignature(key)}
                                            className={`py-2 rounded-lg text-sm font-bold transition-all ${keySignature === key ? 'bg-blue-500 text-white shadow-md scale-105' : 'bg-gray-100 text-gray-600'}`}
                                        >
                                            {key}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Note Range - Compact */}
                            <div className="bg-white/90 backdrop-blur-sm p-2.5 rounded-xl shadow-sm border border-gray-100">
                                <label className="text-xs font-bold text-gray-600 uppercase block mb-1.5">{t('common.note_range')}</label>
                                <div className="flex items-center gap-1.5">
                                    <input
                                        type="text"
                                        value={noteRange.low}
                                        onChange={e => setNoteRange({ ...noteRange, low: e.target.value })}
                                        className="flex-1 py-1.5 px-2 text-sm rounded-lg border border-gray-200 text-center font-semibold focus:border-blue-400 focus:outline-none"
                                        placeholder="C4"
                                    />
                                    <span className="text-gray-400 text-sm">—</span>
                                    <input
                                        type="text"
                                        value={noteRange.high}
                                        onChange={e => setNoteRange({ ...noteRange, high: e.target.value })}
                                        className="flex-1 py-1.5 px-2 text-sm rounded-lg border border-gray-200 text-center font-semibold focus:border-blue-400 focus:outline-none"
                                        placeholder="C5"
                                    />
                                </div>
                            </div>

                            {/* MIDI Info */}
                            <div className="bg-blue-50/80 backdrop-blur-sm border border-blue-200 rounded-xl p-3 text-sm text-blue-800">
                                <p className="font-semibold mb-1 flex items-center gap-2">
                                    <span>🎹</span>
                                    <span>{t('common.midi_connection')}</span>
                                </p>
                                <p className="text-xs text-blue-700">
                                    {t('common.midi_connection_sight_reading')}
                                </p>
                            </div>

                            <button
                                onClick={startGame}
                                className="w-full bg-gradient-to-r from-blue-500 via-indigo-500 to-blue-600 text-white font-black py-4 rounded-2xl shadow-xl active:scale-95 transition-transform flex items-center justify-center gap-3 text-xl mt-4 border-2 border-blue-400"
                            >
                                <span className="text-3xl">▶️</span>
                                <span>{t('common.start')}</span>
                            </button>

                            <div className="h-4"></div>
                        </div>
                    </div>
                </>
            )}

            {/* Exercise Area - Landscape Mode */}
            {isPlaying && (
                <div className="flex-1 flex flex-col bg-slate-50 overflow-hidden">
                    {/* Stats Overlay */}
                    <div className="absolute top-2 left-0 right-0 flex justify-center gap-4 z-20">
                        <div className="bg-white/90 backdrop-blur px-4 py-2 rounded-xl shadow-md border border-gray-200 flex gap-6">
                            <div className="flex flex-col items-center">
                                <span className="text-xs font-bold text-green-600 uppercase">{t('stats.perfect')}</span>
                                <span className="text-2xl font-bold text-green-700">{stats.perfect}</span>
                            </div>
                            <div className="flex flex-col items-center">
                                <span className="text-xs font-bold text-red-500 uppercase">{t('stats.miss')}</span>
                                <span className="text-2xl font-bold text-red-600">{stats.miss}</span>
                            </div>
                        </div>
                    </div>

                    {/* Feedback */}
                    {feedbackStatus !== 'idle' && (
                        <div className="absolute top-20 left-0 right-0 z-30 flex justify-center pointer-events-none">
                            <div className={`text-2xl font-black px-6 py-2 rounded-full shadow-lg ${feedbackStatus === 'correct' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}`}>
                                {feedbackStatus === 'correct' ? `✓ ${t('common.correct')}` : `✗ ${t('stats.miss')}`}
                            </div>
                        </div>
                    )}

                    {/* Staff */}
                    <div className="flex-1 flex items-center justify-center">
                        <ScrollingStaff
                            notes={noteQueue}
                            currentNoteIndex={currentNoteIndex}
                            keySignature={keySignature}
                            feedbackStatus={feedbackStatus}
                            compact={true}
                        />
                    </div>

                    {/* Stop Button */}
                    <div className="absolute bottom-4 right-4 z-20">
                        <button
                            onClick={stopGame}
                            className="bg-red-600 hover:bg-red-700 text-white font-bold px-6 py-3 rounded-full shadow-xl active:scale-95 transition-all flex items-center gap-2"
                        >
                            <span className="text-xl">⏹️</span>
                            <span>{t('common.stop')}</span>
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
