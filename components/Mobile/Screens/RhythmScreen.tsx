'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { generateRhythmPattern, RhythmNoteType } from '@/lib/generator/rhythm-generator';
import { RhythmNote } from '@/lib/generator/rhythm-generator';
import { useRhythmAudio } from '@/hooks/useRhythmAudio';
import { useTranslation } from '@/context/LanguageContext';
import { useOrientation } from '@/hooks/useOrientation';
import { useMobile } from '@/context/MobileContext';
import RhythmStaff from '@/components/Staff/RhythmStaff';
import StaticRhythmStaff from '@/components/Staff/StaticRhythmStaff';
import ScoreStats from '@/components/Feedback/ScoreStats';
import MobileScreenHeader from '@/components/Mobile/MobileScreenHeader';

// Game Constants
const SPAWN_X = 900;
const HIT_X = 100;
const SCORE_PERFECT = 5;
const SCORE_GOOD = 3;

interface RhythmGameNote {
    id: string;
    note: RhythmNote;
    x: number;
    status: 'pending' | 'hit' | 'miss' | 'match_perfect' | 'match_good';
    targetTime: number;
}

export default function RhythmScreen() {
    const { t } = useTranslation();
    const { setIsExerciseActive } = useMobile();
    const { lockLandscape, unlock } = useOrientation();

    // Settings
    const [bpm, setBpm] = useState(60);
    const [timeSignature, setTimeSignature] = useState<'3/4' | '4/4' | '6/8'>('4/4');
    const [allowedFigures, setAllowedFigures] = useState<RhythmNoteType[]>(['w', 'h', 'q', '8']);
    const [includeRests, setIncludeRests] = useState(false);
    const [visualMode, setVisualMode] = useState<'scrolling' | 'static'>('static');
    const [isMetronomeEnabled, setIsMetronomeEnabled] = useState(true);
    const [isSoundEnabled, setIsSoundEnabled] = useState(true);

    // Audio Hook
    const { initAudio, startMetronome, stopMetronome, setBpm: updateAudioBpm, setTimeSignature: updateAudioSignature, playDrumSound, getAudioTime } = useRhythmAudio();

    // Game State
    const [isPlaying, setIsPlaying] = useState(false);
    const [score, setScore] = useState(0);
    const [combo, setCombo] = useState(0);
    const [activeNotes, setActiveNotes] = useState<RhythmGameNote[]>([]);
    const [stats, setStats] = useState({ perfect: 0, good: 0, miss: 0 });
    const [feedback, setFeedback] = useState<{ text: string; color: string } | null>(null);
    const [countdown, setCountdown] = useState<number | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // Refs
    const requestRef = useRef<number>();
    const nextSpawnTimeRef = useRef<number>(0);
    const patternQueueRef = useRef<RhythmNote[]>([]);
    const currentPageTimeRef = useRef<number>(0);
    const firstNoteTimeRef = useRef<number>(0);
    const measuresSpawnedRef = useRef<number>(0);
    const scoredNoteIds = useRef<Set<string>>(new Set());

    const pixelsPerSecond = bpm * 2;

    // Duration Settings
    const [durationOptions, setDurationOptions] = useState({
        'w': true, 'h': true, 'q': true, '8': true, '16': false
    });

    useEffect(() => {
        const selected = Object.entries(durationOptions)
            .filter(([_, isSelected]) => isSelected)
            .map(([key]) => key as RhythmNoteType);
        if (selected.length === 0) setAllowedFigures(['q']);
        else setAllowedFigures(selected);
    }, [durationOptions]);

    useEffect(() => {
        updateAudioBpm(bpm);
    }, [bpm, updateAudioBpm]);

    useEffect(() => {
        const [num, den] = timeSignature.split('/').map(Number);
        updateAudioSignature(num, den || 4);
    }, [timeSignature, updateAudioSignature]);

    const getMeasureDuration = useCallback(() => {
        const beatSec = 60 / bpm;
        const [num] = timeSignature.split('/').map(Number);
        return num * beatSec;
    }, [bpm, timeSignature]);

    const startGame = async (e?: React.MouseEvent) => {
        e?.stopPropagation();

        // Lock to landscape and enter fullscreen
        await lockLandscape();
        setIsExerciseActive(true);

        initAudio();
        setIsPlaying(true);

        let audioStart = 0;
        if (isMetronomeEnabled) {
            // @ts-ignore
            audioStart = startMetronome() || 0;
        } else {
            audioStart = getAudioTime() + 0.1;
        }

        setScore(0);
        setCombo(0);
        setActiveNotes([]);
        patternQueueRef.current = [];
        measuresSpawnedRef.current = 0;
        scoredNoteIds.current = new Set();

        const beatSec = 60 / bpm;
        const [num] = timeSignature.split('/').map(Number);
        const measureDur = num * beatSec;
        const firstNoteTime = audioStart + measureDur;

        nextSpawnTimeRef.current = firstNoteTime;
        firstNoteTimeRef.current = firstNoteTime;
        currentPageTimeRef.current = audioStart;

        setStats({ perfect: 0, good: 0, miss: 0 });

        requestRef.current = requestAnimationFrame(gameLoop);
    };

    const stopGame = async (e?: React.MouseEvent) => {
        e?.stopPropagation();
        setIsPlaying(false);
        setIsExerciseActive(false);
        stopMetronome();
        if (requestRef.current) cancelAnimationFrame(requestRef.current);

        // Unlock orientation and exit fullscreen
        await unlock();
    };

    useEffect(() => {
        if (isPlaying) {
            if (isMetronomeEnabled) startMetronome();
            else stopMetronome();
        }
    }, [isMetronomeEnabled, isPlaying, startMetronome, stopMetronome]);

    const gameLoop = () => {
        const currentTime = getAudioTime();
        const measureDur = getMeasureDuration();

        const EXERCISE_MEASURES = 2;
        const GAP_MEASURES = 1;

        if (visualMode === 'static') {
            const gapDur = measureDur * GAP_MEASURES;
            const playDur = measureDur * EXERCISE_MEASURES;
            const cycleDur = gapDur + playDur;
            const timeInCycle = currentTime - currentPageTimeRef.current;

            if (timeInCycle >= cycleDur) {
                currentPageTimeRef.current += cycleDur;
            }

            if (timeInCycle < gapDur) {
                const beatSec = 60 / bpm;
                const currentBeatIndex = Math.floor(timeInCycle / beatSec);
                const gapBeats = Math.round(gapDur / beatSec);
                const beatsLeft = gapBeats - currentBeatIndex;
                setCountdown(beatsLeft > 0 ? beatsLeft : null);
            } else {
                setCountdown(null);
            }
        } else {
            if (currentTime < firstNoteTimeRef.current) {
                const beatSec = 60 / bpm;
                const timeLeft = firstNoteTimeRef.current - currentTime;
                const beatsLeft = Math.ceil(timeLeft / beatSec);
                setCountdown(beatsLeft > 0 ? beatsLeft : null);
            } else {
                setCountdown(null);
            }
        }

        const PRELOAD_WINDOW = 20.0;
        const notesToAdd: RhythmGameNote[] = [];

        while (nextSpawnTimeRef.current < currentTime + PRELOAD_WINDOW) {
            if (patternQueueRef.current.length === 0) {
                patternQueueRef.current = generateRhythmPattern(allowedFigures, includeRests, timeSignature);
                measuresSpawnedRef.current += 1;
            }

            const nextNote = patternQueueRef.current.shift();
            if (nextNote) {
                const beatSec = 60 / bpm;
                const noteDur = (nextNote.duration === 'bar' ? 0 : nextNote.value) * beatSec;

                const gameNote: RhythmGameNote = {
                    id: Math.random().toString(36).substr(2, 9),
                    note: nextNote,
                    x: SPAWN_X,
                    status: 'pending',
                    targetTime: nextSpawnTimeRef.current
                };

                notesToAdd.push(gameNote);
                nextSpawnTimeRef.current += noteDur;

                if (nextNote.duration === 'bar' && visualMode === 'static') {
                    if (patternQueueRef.current.length === 0) {
                        if (measuresSpawnedRef.current % EXERCISE_MEASURES === 0) {
                            nextSpawnTimeRef.current += (measureDur * GAP_MEASURES);
                        }
                    }
                }
            }
        }

        setActiveNotes(prev => {
            let nextState = [...prev, ...notesToAdd];

            if (visualMode === 'scrolling') {
                nextState = nextState.map(n => {
                    const diff = n.targetTime - currentTime;
                    const newX = (diff * pixelsPerSecond) + HIT_X;
                    return { ...n, x: newX };
                });
            }

            return nextState.map(n => {
                if (n.status === 'pending' && currentTime > n.targetTime + 0.25) {
                    if (n.note.isRest) {
                        return { ...n, status: 'match_perfect' as const };
                    }
                    return { ...n, status: 'miss' as const };
                }
                return n;
            }).filter(n => {
                if (visualMode === 'static') {
                    return n.targetTime >= currentPageTimeRef.current - 5.0;
                } else {
                    return n.targetTime > currentTime - 5.0;
                }
            });
        });

        requestRef.current = requestAnimationFrame(gameLoop);
    };

    useEffect(() => {
        return () => {
            if (requestRef.current) cancelAnimationFrame(requestRef.current);
        };
    }, []);

    useEffect(() => {
        if (!isPlaying) return;

        const unscoredGreenRests = activeNotes.filter(n =>
            n.note.isRest &&
            n.status === 'match_perfect' &&
            !scoredNoteIds.current.has(n.id)
        );

        if (unscoredGreenRests.length > 0) {
            unscoredGreenRests.forEach(n => scoredNoteIds.current.add(n.id));
            setScore(s => s + (unscoredGreenRests.length * SCORE_PERFECT));
            setStats(s => ({ ...s, perfect: s.perfect + unscoredGreenRests.length }));
            setCombo(c => c + unscoredGreenRests.length);
            setFeedback({ text: `${t('rhythm.rest_feedback')} +5`, color: 'text-green-500' });
            setTimeout(() => setFeedback(null), 500);
        }
    }, [activeNotes, isPlaying, t]);

    const handleInteraction = useCallback(() => {
        if (!isPlaying) return;

        const currentTime = getAudioTime();

        setActiveNotes(currentNotes => {
            const candidates = currentNotes.filter(n => n.status === 'pending' && n.note.duration !== 'bar');
            if (candidates.length === 0) return currentNotes;

            candidates.sort((a, b) => Math.abs(a.targetTime - currentTime) - Math.abs(b.targetTime - currentTime));
            const target = candidates[0];

            if (!target) return currentNotes;

            const timeDiff = Math.abs(target.targetTime - currentTime);
            const PERFECT_WINDOW_S = 0.10;
            const GOOD_WINDOW_S = 0.15;

            if (target.note.isRest) {
                if (timeDiff < GOOD_WINDOW_S) {
                    setCombo(0);
                    setStats(s => ({ ...s, miss: s.miss + 1 }));
                    setFeedback({ text: t('rhythm.rest_warning'), color: 'text-red-500' });
                    setTimeout(() => setFeedback(null), 500);
                    return currentNotes.map(n => n.id === target.id ? { ...n, status: 'miss' } : n);
                }
                return currentNotes;
            }

            let newStatus: RhythmGameNote['status'] = 'pending';
            let points = 0;

            if (timeDiff <= PERFECT_WINDOW_S) {
                newStatus = 'match_perfect';
                points = SCORE_PERFECT;
                setStats(s => ({ ...s, perfect: s.perfect + 1 }));
                setFeedback({ text: `${t('rhythm.perfect')} +5`, color: 'text-green-500' });
                scoredNoteIds.current.add(target.id);
            } else if (timeDiff <= GOOD_WINDOW_S) {
                newStatus = 'match_good';
                points = SCORE_GOOD;
                setStats(s => ({ ...s, good: s.good + 1 }));
                setFeedback({ text: `${t('rhythm.good')} +3`, color: 'text-yellow-500' });
                scoredNoteIds.current.add(target.id);
            } else {
                if (timeDiff > 0.2) return currentNotes;
                newStatus = 'miss';
                setCombo(0);
                setStats(s => ({ ...s, miss: s.miss + 1 }));
                setFeedback({ text: t('rhythm.miss'), color: 'text-red-500' });
            }

            if (points > 0) {
                if (isSoundEnabled) playDrumSound();
                setScore(s => s + points);
                setCombo(c => c + 1);
            }
            setTimeout(() => setFeedback(null), 500);

            return currentNotes.map(n => n.id === target.id ? { ...n, status: newStatus } : n);
        });
    }, [isPlaying, isSoundEnabled, playDrumSound, getAudioTime, t]);

    return (
        <div
            className="flex flex-col h-full bg-gradient-to-br from-stone-50 to-stone-100 overflow-hidden"
            onMouseDown={handleInteraction}
            onTouchStart={handleInteraction}
        >
            {/* Mobile Settings Panel - Portrait Mode Only */}
            {!isPlaying && (
                <>
                    <MobileScreenHeader title={t('rhythm.title')} />
                    <div className="flex-1 overflow-y-auto px-3 py-3 pb-safe">
                        <div className="max-w-md mx-auto space-y-2.5">
                            {/* BPM - Compact */}
                            <div className="bg-white/90 backdrop-blur-sm p-2.5 rounded-xl shadow-sm border border-gray-100">
                                <div className="flex items-center justify-between mb-1.5">
                                    <label className="text-xs font-bold text-gray-600 uppercase">{t('common.bpm')}</label>
                                    <span className="text-lg font-black text-amber-600">{bpm}</span>
                                </div>
                                <input
                                    type="range"
                                    min="40"
                                    max="200"
                                    value={bpm}
                                    onChange={(e) => setBpm(Number(e.target.value))}
                                    className="w-full h-1.5 accent-amber-500"
                                />
                            </div>

                            {/* Visual Mode + Time Signature - Single Row */}
                            <div className="bg-white/90 backdrop-blur-sm p-2.5 rounded-xl shadow-sm border border-gray-100">
                                <div className="flex gap-2">
                                    {/* Visual Mode */}
                                    <div className="flex-1">
                                        <label className="text-xs font-bold text-gray-600 uppercase block mb-1">{t('common.mode')}</label>
                                        <div className="flex gap-1.5">
                                            <button
                                                onClick={() => setVisualMode('scrolling')}
                                                className={`flex-1 py-1.5 px-2 rounded-lg font-semibold text-xs transition-all ${visualMode === 'scrolling' ? 'bg-amber-500 text-white shadow-md' : 'bg-gray-100 text-gray-600'}`}
                                            >
                                                🌊
                                            </button>
                                            <button
                                                onClick={() => setVisualMode('static')}
                                                className={`flex-1 py-1.5 px-2 rounded-lg font-semibold text-xs transition-all ${visualMode === 'static' ? 'bg-amber-500 text-white shadow-md' : 'bg-gray-100 text-gray-600'}`}
                                            >
                                                📄
                                            </button>
                                        </div>
                                    </div>

                                    {/* Time Signature */}
                                    <div className="flex-1">
                                        <label className="text-xs font-bold text-gray-600 uppercase block mb-1">{t('common.time_signature')}</label>
                                        <div className="flex gap-1.5">
                                            {(['3/4', '4/4', '6/8'] as const).map(sig => (
                                                <button
                                                    key={sig}
                                                    onClick={() => setTimeSignature(sig)}
                                                    className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${timeSignature === sig ? 'bg-amber-600 text-white shadow-md' : 'bg-gray-100 text-gray-600'}`}
                                                >
                                                    {sig}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Duration Options - Single Compact Row */}
                            <div className="bg-white/90 backdrop-blur-sm p-2.5 rounded-xl shadow-sm border border-gray-100">
                                <label className="text-xs font-bold text-gray-600 uppercase block mb-1.5">{t('common.notes_label')}</label>
                                <div className="flex gap-1.5">
                                    {[
                                        { id: 'w', icon: '𝅝' },
                                        { id: 'h', icon: '𝅗𝅥' },
                                        { id: 'q', icon: '♩' },
                                        { id: '8', icon: '♪' },
                                        { id: '16', icon: '♬' }
                                    ].map(opt => (
                                        <button
                                            key={opt.id}
                                            onClick={() => setDurationOptions(prev => ({ ...prev, [opt.id]: !prev[opt.id as keyof typeof prev] }))}
                                            className={`flex-1 py-2 rounded-lg font-bold text-lg transition-all ${durationOptions[opt.id as keyof typeof durationOptions] ? 'bg-amber-500 text-white shadow-md scale-105' : 'bg-gray-100 text-gray-400'}`}
                                        >
                                            {opt.icon}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Toggles - Compact Pills */}
                            <div className="bg-white/90 backdrop-blur-sm p-2.5 rounded-xl shadow-sm border border-gray-100">
                                <div className="flex flex-wrap gap-1.5">
                                    <label className={`flex-1 min-w-[90px] flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg cursor-pointer transition-all ${includeRests ? 'bg-amber-500 text-white shadow-md' : 'bg-gray-100 text-gray-600'}`}>
                                        <input type="checkbox" checked={includeRests} onChange={e => setIncludeRests(e.target.checked)} className="hidden" />
                                        <span className="text-xs font-semibold">🎵 {t('common.add_rests')}</span>
                                    </label>
                                    <label className={`flex-1 min-w-[90px] flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg cursor-pointer transition-all ${isMetronomeEnabled ? 'bg-amber-500 text-white shadow-md' : 'bg-gray-100 text-gray-600'}`}>
                                        <input type="checkbox" checked={isMetronomeEnabled} onChange={e => setIsMetronomeEnabled(e.target.checked)} className="hidden" />
                                        <span className="text-xs font-semibold">⏱️ {t('common.metronome')}</span>
                                    </label>
                                    <label className={`flex-1 min-w-[90px] flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg cursor-pointer transition-all ${isSoundEnabled ? 'bg-amber-500 text-white shadow-md' : 'bg-gray-100 text-gray-600'}`}>
                                        <input type="checkbox" checked={isSoundEnabled} onChange={e => setIsSoundEnabled(e.target.checked)} className="hidden" />
                                        <span className="text-xs font-semibold">🔊 {t('common.sounds')}</span>
                                    </label>
                                </div>
                            </div>

                            <button
                                onClick={startGame}
                                className="w-full bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 text-white font-black py-4 rounded-2xl shadow-xl active:scale-95 transition-transform flex items-center justify-center gap-3 text-xl mt-4 border-2 border-amber-400"
                            >
                                <span className="text-3xl">▶️</span>
                                <span>{t('common.start')}</span>
                            </button>

                            {/* Bottom Spacer for Safe Area */}
                            <div className="h-4"></div>
                        </div>
                    </div>
                </>
            )}

            {/* Game Area - Landscape Mode */}
            {isPlaying && (
                <div ref={containerRef} className="flex-1 relative flex items-center justify-center bg-stone-50">
                    {/* Stats Overlay */}
                    <div className="absolute top-2 left-0 right-0 flex justify-center space-x-2 pointer-events-none z-30">
                        <ScoreStats perfect={stats.perfect} good={stats.good} miss={stats.miss} />
                        {combo > 1 && (
                            <div className="bg-white/90 px-3 py-1 rounded-lg border border-orange-200 shadow-sm">
                                <span className="text-orange-500 font-bold text-xs block">{t('rhythm.combo')}</span>
                                <span className="text-xl font-bold text-orange-600">{combo}x</span>
                            </div>
                        )}
                    </div>

                    {/* Countdown */}
                    {countdown !== null && (
                        <div className="absolute top-16 left-0 right-0 flex items-center justify-center z-40 pointer-events-none">
                            <div className="bg-white/90 px-4 py-1 rounded-lg shadow-lg border border-amber-100">
                                <div className="text-sm font-black text-amber-600">
                                    {countdown > 1 ? t('rhythm.wait') : t('rhythm.ready')}
                                </div>
                                <div className="text-3xl font-black text-amber-800 text-center">
                                    {countdown}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Feedback */}
                    {feedback && (
                        <div className="absolute top-28 left-0 right-0 z-50 flex justify-center pointer-events-none">
                            <div className={`text-xl font-black ${feedback.color} bg-white/90 px-4 py-1 rounded-full shadow-lg`}>
                                {feedback.text}
                            </div>
                        </div>
                    )}

                    {/* Staff */}
                    {visualMode === 'scrolling' ? (
                        <RhythmStaff notes={activeNotes} hitX={HIT_X} />
                    ) : (
                        <StaticRhythmStaff
                            notes={activeNotes.filter(n => n.targetTime >= currentPageTimeRef.current && n.targetTime < currentPageTimeRef.current + (getMeasureDuration() * 3))}
                            timeSignature={timeSignature}
                            currentBeatIndex={0}
                        />
                    )}

                    {/* Stop Button */}
                    <button
                        onClick={stopGame}
                        className="absolute bottom-4 right-4 bg-red-600 text-white font-bold px-6 py-2 rounded-full shadow-lg active:scale-95 transition-transform z-40"
                    >
                        ⏹️ {t('common.stop')}
                    </button>
                </div>
            )}
        </div>
    );
}
