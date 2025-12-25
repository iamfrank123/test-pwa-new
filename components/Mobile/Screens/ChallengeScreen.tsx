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
    const [bestCombo, setBestCombo] = useState(0);
    const [activeNotes, setActiveNotes] = useState<GameNote[]>([]);
    const [feedback, setFeedback] = useState<{ text: string; color: string; points?: number } | null>(null);

    const lastFrameTimeRef = useRef<number>(0);
    const requestRef = useRef<number>();
    const nextSpawnTimeRef = useRef<number>(0);

    const pixelsPerSecond = bpm * 2;

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

    const startGame = async () => {
        haptic('medium');
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
        haptic('medium');
        setIsPlaying(false);
        if (requestRef.current) cancelAnimationFrame(requestRef.current);
        setIsExerciseActive(false);
        await exitFullscreen();
        await unlock();
        
        // Update best combo
        if (combo > bestCombo) setBestCombo(combo);
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
        haptic('light');

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
                    setFeedback({ text: t('melodic.wrong_note'), color: 'text-red-500' });
                    haptic('error');
                    setTimeout(() => setFeedback(null), 500);
                    return currentNotes;
                }
            }

            let newStatus: GameNote['status'] = 'pending';
            let points = 0;

            if (dist <= HIT_WINDOW) {
                newStatus = 'match_perfect';
                points = SCORE_PERFECT;
                setFeedback({ text: `${t('rhythm.perfect')}`, color: 'text-green-500', points });
                haptic('success');
            } else if (dist <= HIT_WINDOW_GOOD) {
                newStatus = 'match_good';
                points = SCORE_GOOD;
                setFeedback({ text: `${t('rhythm.good')}`, color: 'text-yellow-500', points });
                haptic('medium');
            } else {
                setCombo(0);
                points = 0;
                newStatus = 'miss';
                setFeedback({ text: t('challenge.mancato'), color: 'text-red-500' });
                haptic('error');
            }

            if (points > 0) {
                setScore(s => s + points);
                setCombo(c => {
                    const newCombo = c + 1;
                    if (newCombo > bestCombo) setBestCombo(newCombo);
                    return newCombo;
                });
            }

            setTimeout(() => setFeedback(null), 800);

            return currentNotes.map(n =>
                n.id === targetNote.id ? { ...n, status: newStatus } : n
            );
        });
    }, [isPlaying, t, bestCombo, haptic]);

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
        <div className="flex flex-col h-full bg-gradient-to-br from-amber-50 via-orange-50 to-red-50 overflow-hidden">
            {!isPlaying && (
                <>
                    <MobileScreenHeader title={t('challenge.title')} />
                    <div className="flex-1 overflow-y-auto px-4 py-4 pb-safe">
                        <div className="max-w-md mx-auto space-y-3">
                            {/* Challenge Info Banner */}
                            <div className="bg-gradient-to-r from-amber-500 to-orange-600 p-4 rounded-2xl shadow-lg">
                                <div className="flex items-center gap-3 mb-2">
                                    <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
                                        <span className="text-3xl">⚡</span>
                                    </div>
                                    <div className="flex-1">
                                        <h3 className="text-white font-black text-lg">Challenge Mode</h3>
                                        <p className="text-white/90 text-xs">Test your speed & accuracy!</p>
                                    </div>
                                </div>
                                {bestCombo > 0 && (
                                    <div className="bg-white/20 backdrop-blur-sm px-3 py-2 rounded-xl mt-2">
                                        <div className="flex items-center justify-between">
                                            <span className="text-white/80 text-xs font-bold">Best Combo</span>
                                            <span className="text-white text-xl font-black">{bestCombo}x 🏆</span>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* BPM Control - FEATURED */}
                            <div className="bg-white/90 backdrop-blur-sm p-4 rounded-2xl shadow-md border border-gray-100">
                                <div className="flex items-center justify-between mb-3">
                                    <label className="text-gray-700 font-bold text-sm uppercase flex items-center gap-2">
                                        <span className="text-2xl">🚀</span>
                                        <span>{t('common.speed')}</span>
                                    </label>
                                    <div className="bg-gradient-to-r from-amber-500 to-orange-600 px-4 py-2 rounded-xl shadow-md">
                                        <span className="text-white text-3xl font-black">{bpm}</span>
                                    </div>
                                </div>
                                <input
                                    type="range"
                                    min="30"
                                    max="180"
                                    value={bpm}
                                    onChange={(e) => { haptic('light'); setBpm(Number(e.target.value)); }}
                                    className="w-full h-3 bg-gray-200 rounded-full appearance-none cursor-pointer accent-amber-500"
                                />
                                <div className="flex justify-between text-gray-400 text-xs mt-2">
                                    <span>Easy (30)</span>
                                    <span>Insane (180)</span>
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
                                                    ? 'bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-lg scale-110' 
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
                                    <span className="text-lg">🎹</span>
                                    <span>{t('common.note_range')}</span>
                                </label>
                                <div className="flex items-center gap-3">
                                    <input
                                        type="text"
                                        value={noteRange.low}
                                        onChange={e => setNoteRange({ ...noteRange, low: e.target.value })}
                                        className="flex-1 py-3 px-4 text-base rounded-xl border-2 border-gray-200 text-center font-bold focus:border-amber-400 focus:outline-none bg-white"
                                        placeholder="C4"
                                    />
                                    <span className="text-gray-400 text-2xl font-bold">→</span>
                                    <input
                                        type="text"
                                        value={noteRange.high}
                                        onChange={e => setNoteRange({ ...noteRange, high: e.target.value })}
                                        className="flex-1 py-3 px-4 text-base rounded-xl border-2 border-gray-200 text-center font-bold focus:border-amber-400 focus:outline-none bg-white"
                                        placeholder="C5"
                                    />
                                </div>
                            </div>

                            {/* Game Instructions */}
                            <div className="bg-gradient-to-br from-amber-50 to-orange-50 p-4 rounded-2xl border-2 border-amber-200">
                                <h3 className="text-sm font-bold text-amber-900 mb-2 flex items-center gap-2">
                                    <span className="text-lg">🎮</span>
                                    <span>{t('challenge.game_mode_title')}</span>
                                </h3>
                                <ul className="text-xs text-amber-800 space-y-1.5 ml-7">
                                    <li className="leading-relaxed">• {t('challenge.game_mode_desc_1')}</li>
                                    <li className="leading-relaxed">• {t('challenge.game_mode_desc_2')}</li>
                                    <li className="leading-relaxed">• {t('challenge.game_mode_desc_3')}</li>
                                </ul>
                            </div>

                            {/* Start Button - HERO */}
                            <button
                                onClick={startGame}
                                className="w-full bg-gradient-to-r from-amber-500 via-orange-600 to-amber-600 text-white font-black py-5 rounded-2xl shadow-2xl active:scale-95 transition-transform flex items-center justify-center gap-3 text-xl border-2 border-amber-400"
                            >
                                <span className="text-4xl">⚡</span>
                                <span>{t('challenge.start_btn')}</span>
                            </button>

                            <div className="h-4"></div>
                        </div>
                    </div>
                </>
            )}

            {isPlaying && (
                <div 
                    className="flex-1 flex flex-col bg-gradient-to-br from-amber-100 to-orange-100 overflow-hidden relative" 
                    onClick={handleTouchClick} 
                    onTouchStart={handleTouchClick}
                >
                    {/* Stats Header */}
                    <div className="absolute top-3 left-0 right-0 flex justify-center gap-3 z-20 px-4">
                        <div className="bg-white/95 backdrop-blur-md px-6 py-3 rounded-2xl shadow-xl border-2 border-amber-200 flex gap-8">
                            <div className="flex flex-col items-center">
                                <span className="text-xs font-bold text-blue-600 uppercase">{t('challenge.score_label')}</span>
                                <span className="text-3xl font-black text-blue-700">{score}</span>
                            </div>
                            <div className="flex flex-col items-center">
                                <span className="text-xs font-bold text-orange-500 uppercase">{t('challenge.combo_label')}</span>
                                <span className="text-3xl font-black text-orange-600">{combo}x</span>
                            </div>
                        </div>

                        {combo > 5 && (
                            <div className="bg-gradient-to-r from-orange-500 to-red-600 px-4 py-3 rounded-2xl shadow-xl animate-pulse border-2 border-orange-400">
                                <div className="text-white text-2xl font-black">🔥</div>
                            </div>
                        )}
                    </div>

                    {/* Feedback */}
                    {feedback && (
                        <div className="absolute top-24 left-0 right-0 z-30 flex justify-center pointer-events-none">
                            <div className={`bg-white/95 px-8 py-4 rounded-2xl shadow-2xl animate-bounce border-4 ${
                                feedback.color.includes('green') ? 'border-green-400' :
                                feedback.color.includes('yellow') ? 'border-yellow-400' : 'border-red-400'
                            }`}>
                                <div className={`text-3xl font-black ${feedback.color} text-center`}>
                                    {feedback.text}
                                </div>
                                {feedback.points && (
                                    <div className="text-2xl font-black text-amber-600 text-center mt-1">
                                        +{feedback.points}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Staff */}
                    <div className="flex-1 flex items-center justify-center p-4">
                        <ChallengeStaff
                            notes={activeNotes}
                            speedPixelsPerFrame={0}
                            keySignature={keySignature}
                            onHitZoneEnter={() => { }}
                            onHitZoneLeave={() => { }}
                            isPlaying={isPlaying}
                        />
                    </div>

                    {/* BPM Display */}
                    <div className="absolute top-3 left-4 z-20">
                        <div className="bg-gradient-to-r from-amber-500 to-orange-600 px-4 py-2 rounded-2xl shadow-xl border-2 border-amber-400">
                            <div className="text-xs font-bold text-white/80 uppercase">BPM</div>
                            <div className="text-2xl font-black text-white">{bpm}</div>
                        </div>
                    </div>

                    {/* Best Combo */}
                    {bestCombo > combo && (
                        <div className="absolute top-3 right-4 z-20">
                            <div className="bg-white/95 backdrop-blur-md px-4 py-2 rounded-2xl shadow-xl border-2 border-purple-200">
                                <div className="text-xs font-bold text-purple-600 uppercase">Best</div>
                                <div className="text-2xl font-black text-purple-700">{bestCombo}x</div>
                            </div>
                        </div>
                    )}

                    {/* Stop Button */}
                    <button
                        onClick={stopGame}
                        className="absolute bottom-4 right-4 bg-gradient-to-r from-red-500 to-red-600 text-white font-bold px-6 py-3 rounded-2xl shadow-2xl active:scale-95 transition-all z-40 flex items-center gap-2 border-2 border-red-400"
                    >
                        <span className="text-xl">⏹️</span>
                        <span className="font-black">Stop</span>
                    </button>

                    {/* Instructions Hint */}
                    <div className="absolute bottom-4 left-4 z-30 bg-white/95 backdrop-blur-sm px-4 py-2 rounded-2xl shadow-lg border-2 border-amber-200">
                        <div className="text-xs font-bold text-amber-600 flex items-center gap-2">
                            <span className="text-lg">👆</span>
                            <span>Tap screen or use MIDI</span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
