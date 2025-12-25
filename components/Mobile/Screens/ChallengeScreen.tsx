'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useTranslation } from '@/context/LanguageContext';
import { useMobile } from '@/context/MobileContext';
import { useOrientation } from '@/hooks/useOrientation';
import ChallengeStaff from '@/components/Staff/ChallengeStaff';
import { generateRandomNote } from '@/lib/generator/note-generator';
import { GeneratedNote, KeySignature, NoteRange } from '@/lib/generator/types';
import { useMIDIInput } from '@/hooks/useMIDIInput';
import MobileScreenHeader from '@/components/Mobile/MobileScreenHeader';
import { MIDINoteEvent } from '@/lib/types/midi';

const HIT_X = 100;
const HIT_WINDOW = 30;
const HIT_WINDOW_GOOD = 35;
const SCORE_PERFECT = 5;
const SCORE_GOOD = 3;

interface GameNote {
    id: string;
    note: GeneratedNote;
    x: number;
    status: 'pending' | 'hit' | 'miss' | 'match_perfect' | 'match_good';
}

const KEY_SIGNATURES: KeySignature[] = ['C', 'G', 'D', 'A', 'E', 'F', 'Bb', 'Eb', 'Ab'];

export default function ChallengeScreen() {
    const { t } = useTranslation();
    const { setIsExerciseActive } = useMobile();
    const { lockLandscape, unlock, requestFullscreen, exitFullscreen } = useOrientation();

    const [bpm, setBpm] = useState(60);
    const [keySignature, setKeySignature] = useState<KeySignature>('C');
    const [noteRange, setNoteRange] = useState<NoteRange>({ low: 'C4', high: 'C5' });

    const [isPlaying, setIsPlaying] = useState(false);
    const [score, setScore] = useState(0);
    const [combo, setCombo] = useState(0);
    const [activeNotes, setActiveNotes] = useState<GameNote[]>([]);
    const [feedback, setFeedback] = useState<{ text: string; color: string } | null>(null);

    const lastFrameTimeRef = useRef<number>(0);
    const requestRef = useRef<number>();
    const nextSpawnTimeRef = useRef<number>(0);

    const pixelsPerSecond = bpm * 2;

    const startGame = async () => {
        setIsExerciseActive(true);
        await requestFullscreen();
        await lockLandscape();

        setIsPlaying(true);
        setScore(0);
        setCombo(0);
        setActiveNotes([]);
        lastFrameTimeRef.current = performance.now();
        requestRef.current = requestAnimationFrame(gameLoop);
    };

    const stopGame = async () => {
        setIsPlaying(false);
        if (requestRef.current) cancelAnimationFrame(requestRef.current);
        setIsExerciseActive(false);
        await exitFullscreen();
        await unlock();
    };

    const gameLoop = (time: number) => {
        const deltaTime = (time - lastFrameTimeRef.current) / 1000;
        lastFrameTimeRef.current = time;

        const pixelsToMove = pixelsPerSecond * deltaTime;

        setActiveNotes(prevNotes => {
            const nextNotes = prevNotes.map(n => ({ ...n, x: n.x - pixelsToMove }));
            const validNotes = nextNotes.filter(n => {
                if (n.status === 'pending' && n.x < -50) return false;
                if (n.x < -100) return false;
                return true;
            });
            return validNotes;
        });

        if (time > nextSpawnTimeRef.current) {
            const newNote = generateRandomNote(noteRange, keySignature);
            const gameNote: GameNote = {
                id: Math.random().toString(36).substr(2, 9),
                note: newNote,
                x: 900,
                status: 'pending'
            };

            setActiveNotes(prev => [...prev, gameNote]);

            const secondsPerBeat = 60 / bpm;
            nextSpawnTimeRef.current = time + (secondsPerBeat * 1000);
        }

        requestRef.current = requestAnimationFrame(gameLoop);
    };

    useEffect(() => {
        return () => {
            if (requestRef.current) cancelAnimationFrame(requestRef.current);
        };
    }, []);

    const handleInput = useCallback((input: { type: 'midi' | 'touch', pitch?: number }) => {
        if (!isPlaying) return;

        setActiveNotes(currentNotes => {
            const MAX_INTERACTION_RANGE = 300;

            let pendingNotes = currentNotes.filter(n =>
                n.status === 'pending' &&
                n.x > (HIT_X - MAX_INTERACTION_RANGE) &&
                n.x < (HIT_X + MAX_INTERACTION_RANGE)
            );

            if (input.type === 'midi' && pendingNotes.length > 0) {
                const inputPitch = input.pitch! % 12;
                const PITCH_PRIORITY_RANGE = 60;

                const matchingNotes = pendingNotes.filter(n =>
                    (n.note.midiNumber % 12) === inputPitch &&
                    Math.abs(n.x - HIT_X) <= PITCH_PRIORITY_RANGE
                );

                if (matchingNotes.length > 0) {
                    pendingNotes = matchingNotes;
                }
            }

            if (pendingNotes.length === 0) return currentNotes;

            pendingNotes.sort((a, b) => Math.abs(a.x - HIT_X) - Math.abs(b.x - HIT_X));

            const targetNote = pendingNotes[0];
            if (!targetNote) return currentNotes;

            const STRICT_INTERACTIVE_ZONE = 60;
            const dist = Math.abs(targetNote.x - HIT_X);

            if (dist > STRICT_INTERACTIVE_ZONE) return currentNotes;

            if (input.type === 'midi') {
                const isMatch = (input.pitch! % 12) === (targetNote.note.midiNumber % 12);
                if (!isMatch) {
                    setCombo(0);
                    setFeedback({ text: 'Nota sbagliata!', color: 'text-red-500' });
                    setTimeout(() => setFeedback(null), 500);
                    return currentNotes;
                }
            }

            let newStatus: GameNote['status'] = 'pending';
            let points = 0;

            if (dist <= HIT_WINDOW) {
                newStatus = 'match_perfect';
                points = SCORE_PERFECT;
                setFeedback({ text: `Perfect +${SCORE_PERFECT}`, color: 'text-green-500' });
            } else if (dist <= HIT_WINDOW_GOOD) {
                newStatus = 'match_good';
                points = SCORE_GOOD;
                setFeedback({ text: `Good +${SCORE_GOOD}`, color: 'text-yellow-500' });
            } else {
                setCombo(0);
                points = 0;
                newStatus = 'miss';
                setFeedback({ text: 'Mancato 0', color: 'text-red-500' });
            }

            if (points > 0) {
                setScore(s => s + points);
                setCombo(c => c + 1);
            }

            setTimeout(() => setFeedback(null), 800);

            return currentNotes.map(n =>
                n.id === targetNote.id ? { ...n, status: newStatus } : n
            );
        });
    }, [isPlaying]);

    const handleMidiInput = useCallback((event: MIDINoteEvent) => {
        if (event.type === 'noteOn') {
            handleInput({ type: 'midi', pitch: event.pitch });
        }
    }, [handleInput]);

    useMIDIInput(handleMidiInput);

    const handleTouchClick = useCallback(() => {
        handleInput({ type: 'touch' });
    }, [handleInput]);

    return (
        <div className="flex flex-col h-full bg-gradient-to-br from-stone-50 to-stone-100 overflow-hidden">
            {!isPlaying && (
                <>
                    <MobileScreenHeader title={t('challenge.title')} />
                    <div className="flex-1 overflow-y-auto px-3 py-3 pb-safe">
                        <div className="max-w-md mx-auto space-y-2.5">
                            <div className="bg-white/90 backdrop-blur-sm p-2.5 rounded-xl shadow-sm border border-gray-100">
                                <div className="flex items-center justify-between mb-1.5">
                                    <label className="text-xs font-bold text-gray-600 uppercase">{t('common.speed')}</label>
                                    <span className="text-lg font-black text-amber-600">{bpm} {t('common.bpm')}</span>
                                </div>
                                <input type="range" min="30" max="180" value={bpm} onChange={(e) => setBpm(Number(e.target.value))} className="w-full h-1.5 accent-amber-500" />
                            </div>

                            <div className="bg-white/90 backdrop-blur-sm p-2.5 rounded-xl shadow-sm border border-gray-100">
                                <label className="text-xs font-bold text-gray-600 uppercase block mb-1.5">{t('common.key')}</label>
                                <div className="grid grid-cols-5 gap-1.5">
                                    {KEY_SIGNATURES.map(key => (
                                        <button key={key} onClick={() => setKeySignature(key)} className={`py-2 rounded-lg text-sm font-bold transition-all ${keySignature === key ? 'bg-amber-500 text-white shadow-md scale-105' : 'bg-gray-100 text-gray-600'}`}>{key}</button>
                                    ))}
                                </div>
                            </div>

                            <div className="bg-white/90 backdrop-blur-sm p-2.5 rounded-xl shadow-sm border border-gray-100">
                                <label className="text-xs font-bold text-gray-600 uppercase block mb-1.5">{t('common.note_range')}</label>
                                <div className="flex items-center gap-1.5">
                                    <input type="text" value={noteRange.low} onChange={e => setNoteRange({ ...noteRange, low: e.target.value })} className="flex-1 py-1.5 px-2 text-sm rounded-lg border border-gray-200 text-center font-semibold focus:border-amber-400 focus:outline-none" placeholder="C4" />
                                    <span className="text-gray-400 text-sm">—</span>
                                    <input type="text" value={noteRange.high} onChange={e => setNoteRange({ ...noteRange, high: e.target.value })} className="flex-1 py-1.5 px-2 text-sm rounded-lg border border-gray-200 text-center font-semibold focus:border-amber-400 focus:outline-none" placeholder="C5" />
                                </div>
                            </div>

                            <div className="bg-amber-50/80 backdrop-blur-sm border border-amber-200 rounded-xl p-3 text-sm text-amber-800">
                                <p className="font-semibold mb-2 flex items-center gap-2">
                                    <span>🎮</span>
                                    <span>{t('challenge.game_mode_title')}</span>
                                </p>
                                <ul className="text-xs text-amber-700 space-y-1">
                                    <li>{t('challenge.game_mode_desc_1')}</li>
                                    <li>{t('challenge.game_mode_desc_2')}</li>
                                    <li>{t('challenge.game_mode_desc_3')}</li>
                                </ul>
                            </div>

                            <button onClick={startGame} className="w-full bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 text-white font-black py-4 rounded-2xl shadow-xl active:scale-95 transition-transform flex items-center justify-center gap-3 text-xl mt-4 border-2 border-amber-400">
                                <span className="text-3xl">▶️</span>
                                <span>{t('challenge.start_btn')}</span>
                            </button>

                            <div className="h-4"></div>
                        </div>
                    </div>
                </>
            )}

            {isPlaying && (
                <div className="flex-1 flex flex-col bg-slate-50 overflow-hidden relative" onClick={handleTouchClick} onTouchStart={handleTouchClick}>
                    <div className="absolute top-2 left-0 right-0 flex justify-center gap-4 z-20">
                        <div className="bg-white/90 backdrop-blur px-6 py-2 rounded-xl shadow-md border border-gray-200 flex gap-8">
                            <div className="flex flex-col items-center">
                                <span className="text-xs font-bold text-blue-600 uppercase">{t('challenge.score_label')}</span>
                                <span className="text-3xl font-bold text-blue-700">{score}</span>
                            </div>
                            <div className="flex flex-col items-center">
                                <span className="text-xs font-bold text-orange-500 uppercase">{t('challenge.combo_label')}</span>
                                <span className="text-3xl font-bold text-orange-600">{combo}x</span>
                            </div>
                        </div>
                    </div>

                    {feedback && (
                        <div className="absolute top-20 left-0 right-0 z-30 flex justify-center pointer-events-none">
                            <div className={`text-3xl font-black ${feedback.color} bg-white/95 px-6 py-2 rounded-full shadow-lg animate-bounce`}>
                                {feedback.text}
                            </div>
                        </div>
                    )}

                    <div className="flex-1 flex items-center justify-center">
                        <ChallengeStaff
                            notes={activeNotes}
                            speedPixelsPerFrame={0}
                            keySignature={keySignature}
                            onHitZoneEnter={() => { }}
                            onHitZoneLeave={() => { }}
                            isPlaying={isPlaying}
                        />
                    </div>

                    <div className="absolute bottom-4 right-4 z-20">
                        <button onClick={stopGame} className="bg-red-600 hover:bg-red-700 text-white font-bold px-6 py-3 rounded-full shadow-xl active:scale-95 transition-all flex items-center gap-2">
                            <span className="text-xl">⏹️</span>
                            <span>Stop</span>
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
