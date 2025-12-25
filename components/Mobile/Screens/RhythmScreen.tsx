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

    // Haptic feedback
    const haptic = useCallback((intensity: 'light' | 'medium' | 'heavy' = 'light') => {
        if (navigator.vibrate) {
            const patterns = { light: 10, medium: 20, heavy: 30 };
            navigator.vibrate(patterns[intensity]);
        }
    }, []);

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
        haptic('medium');

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
        haptic('medium');
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

    const gameLoop = useCallback((time: number) => {
        if (!isPlaying) return;

        const currentTime = getAudioTime();
        const measureDur = getMeasureDuration();

        // Spawn new measures
        while (nextSpawnTimeRef.current <= currentTime + 5) {
            const pattern = generateRhythmPattern(allowedFigures, includeRests, timeSignature);
            patternQueueRef.current.push(...pattern);

            let cumulativeTime = nextSpawnTimeRef.current;
            const spawnStart = measuresSpawnedRef.current * measureDur;

            pattern.forEach(rn => {
                const noteId = `${measuresSpawnedRef.current}-${Math.random().toString(36).substr(2, 9)}`;
                const relativeTime = cumulativeTime - firstNoteTimeRef.current;
                const x = SPAWN_X + (relativeTime * pixelsPerSecond);

                const gameNote: RhythmGameNote = {
                    id: noteId,
                    note: rn,
                    x: x,
                    status: 'pending',
                    targetTime: cumulativeTime
                };

                setActiveNotes(prev => [...prev, gameNote]);
                cumulativeTime += rn.value * (60 / bpm);
            });

            nextSpawnTimeRef.current += measureDur;
            measuresSpawnedRef.current++;
        }

        // Move notes
        setActiveNotes(prevNotes => {
            const elapsed = currentTime - firstNoteTimeRef.current;
            const scrollOffset = elapsed * pixelsPerSecond;

            return prevNotes
                .map(n => ({
                    ...n,
                    x: SPAWN_X + ((n.targetTime - firstNoteTimeRef.current) * pixelsPerSecond) - scrollOffset
                }))
                .filter(n => {
                    if (n.status === 'pending' && n.x < HIT_X - 100 && !scoredNoteIds.current.has(n.id)) {
                        if (!n.note.isRest) {
                            setStats(prev => ({ ...prev, miss: prev.miss + 1 }));
                            setCombo(0);
                            scoredNoteIds.current.add(n.id);
                        }
                        return false;
                    }
                    return n.x > -200;
                });
        });

        requestRef.current = requestAnimationFrame(gameLoop);
    }, [isPlaying, allowedFigures, includeRests, timeSignature, bpm, pixelsPerSecond, getMeasureDuration, getAudioTime]);

    useEffect(() => {
        return () => {
            if (requestRef.current) cancelAnimationFrame(requestRef.current);
        };
    }, []);

    const handleTap = useCallback(() => {
        if (!isPlaying) return;
        haptic('light');

        if (isSoundEnabled) playDrumSound();

        setActiveNotes(prevNotes => {
            const pending = prevNotes.filter(n => n.status === 'pending' && !n.note.isRest);
            if (pending.length === 0) return prevNotes;

            pending.sort((a, b) => Math.abs(a.x - HIT_X) - Math.abs(b.x - HIT_X));
            const closest = pending[0];

            const distance = Math.abs(closest.x - HIT_X);
            const HIT_WINDOW = 30;
            const HIT_WINDOW_GOOD = 50;

            if (distance > HIT_WINDOW_GOOD) {
                setStats(prev => ({ ...prev, miss: prev.miss + 1 }));
                setCombo(0);
                setFeedback({ text: t('rhythm.miss'), color: 'text-red-500' });
                setTimeout(() => setFeedback(null), 500);
                return prevNotes;
            }

            let newStatus: RhythmGameNote['status'] = 'pending';
            let points = 0;

            if (distance <= HIT_WINDOW) {
                newStatus = 'match_perfect';
                points = SCORE_PERFECT;
                setStats(prev => ({ ...prev, perfect: prev.perfect + 1 }));
                setCombo(prev => prev + 1);
                setScore(prev => prev + points);
                setFeedback({ text: `${t('rhythm.perfect')} +${points}`, color: 'text-green-500' });
                haptic('medium');
            } else if (distance <= HIT_WINDOW_GOOD) {
                newStatus = 'match_good';
                points = SCORE_GOOD;
                setStats(prev => ({ ...prev, good: prev.good + 1 }));
                setCombo(prev => prev + 1);
                setScore(prev => prev + points);
                setFeedback({ text: `${t('rhythm.good')} +${points}`, color: 'text-yellow-500' });
            }

            setTimeout(() => setFeedback(null), 800);
            scoredNoteIds.current.add(closest.id);

            return prevNotes.map(n => n.id === closest.id ? { ...n, status: newStatus } : n);
        });
    }, [isPlaying, isSoundEnabled, playDrumSound, t, haptic]);

    return (
        <div className="flex flex-col h-full bg-gradient-to-br from-purple-50 via-pink-50 to-orange-50 overflow-hidden">
            {/* Settings Panel - Portrait Mode */}
            {!isPlaying && (
                <>
                    <MobileScreenHeader title={t('rhythm.title')} />
                    <div className="flex-1 overflow-y-auto px-4 py-4 pb-safe">
                        <div className="max-w-md mx-auto space-y-3">
                            {/* BPM Control - FEATURED */}
                            <div className="bg-gradient-to-r from-purple-500 to-purple-600 p-4 rounded-2xl shadow-lg">
                                <div className="flex items-center justify-between mb-3">
                                    <label className="text-white font-bold text-sm uppercase flex items-center gap-2">
                                        <span className="text-2xl">⏱️</span>
                                        <span>{t('common.speed')}</span>
                                    </label>
                                    <div className="bg-white/20 backdrop-blur-sm px-4 py-2 rounded-xl">
                                        <span className="text-white text-3xl font-black">{bpm}</span>
                                    </div>
                                </div>
                                <input
                                    type="range"
                                    min="40"
                                    max="180"
                                    value={bpm}
                                    onChange={(e) => setBpm(Number(e.target.value))}
                                    className="w-full h-3 bg-white/20 rounded-full appearance-none cursor-pointer accent-white"
                                    style={{
                                        background: `linear-gradient(to right, white 0%, white ${((bpm - 40) / 140) * 100}%, rgba(255,255,255,0.2) ${((bpm - 40) / 140) * 100}%, rgba(255,255,255,0.2) 100%)`
                                    }}
                                />
                                <div className="flex justify-between text-white/70 text-xs mt-2">
                                    <span>Slow (40)</span>
                                    <span>Fast (180)</span>
                                </div>
                            </div>

                            {/* Mode & Time Signature */}
                            <div className="grid grid-cols-2 gap-3">
                                <div className="bg-white/90 backdrop-blur-sm p-3 rounded-2xl shadow-md border border-gray-100">
                                    <label className="text-xs font-bold text-gray-600 uppercase block mb-2">{t('common.mode')}</label>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => { haptic('light'); setVisualMode('scrolling'); }}
                                            className={`flex-1 py-2 rounded-xl font-bold text-lg transition-all ${visualMode === 'scrolling' ? 'bg-purple-500 text-white shadow-lg scale-105' : 'bg-gray-100 text-gray-400'}`}
                                        >
                                            🌊
                                        </button>
                                        <button
                                            onClick={() => { haptic('light'); setVisualMode('static'); }}
                                            className={`flex-1 py-2 rounded-xl font-bold text-lg transition-all ${visualMode === 'static' ? 'bg-purple-500 text-white shadow-lg scale-105' : 'bg-gray-100 text-gray-400'}`}
                                        >
                                            📄
                                        </button>
                                    </div>
                                </div>

                                <div className="bg-white/90 backdrop-blur-sm p-3 rounded-2xl shadow-md border border-gray-100">
                                    <label className="text-xs font-bold text-gray-600 uppercase block mb-2">{t('common.time_signature')}</label>
                                    <div className="flex gap-1">
                                        {(['3/4', '4/4', '6/8'] as const).map(sig => (
                                            <button
                                                key={sig}
                                                onClick={() => { haptic('light'); setTimeSignature(sig); }}
                                                className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${timeSignature === sig ? 'bg-purple-500 text-white shadow-lg scale-105' : 'bg-gray-100 text-gray-600'}`}
                                            >
                                                {sig}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Note Durations */}
                            <div className="bg-white/90 backdrop-blur-sm p-3 rounded-2xl shadow-md border border-gray-100">
                                <label className="text-xs font-bold text-gray-600 uppercase block mb-2 flex items-center gap-2">
                                    <span>🎵</span>
                                    <span>{t('common.notes_label')}</span>
                                </label>
                                <div className="flex gap-2">
                                    {[
                                        { id: 'w', icon: '𝅝' },
                                        { id: 'h', icon: '𝅗𝅥' },
                                        { id: 'q', icon: '♩' },
                                        { id: '8', icon: '♪' },
                                        { id: '16', icon: '♬' }
                                    ].map(opt => (
                                        <button
                                            key={opt.id}
                                            onClick={() => {
                                                haptic('light');
                                                setDurationOptions(prev => ({ ...prev, [opt.id]: !prev[opt.id as keyof typeof prev] }));
                                            }}
                                            className={`flex-1 py-3 rounded-xl font-bold text-2xl transition-all ${
                                                durationOptions[opt.id as keyof typeof durationOptions] 
                                                    ? 'bg-gradient-to-br from-purple-500 to-purple-600 text-white shadow-lg scale-105' 
                                                    : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                                            }`}
                                        >
                                            {opt.icon}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Options Pills */}
                            <div className="bg-white/90 backdrop-blur-sm p-3 rounded-2xl shadow-md border border-gray-100">
                                <label className="text-xs font-bold text-gray-600 uppercase block mb-2">Options</label>
                                <div className="flex flex-wrap gap-2">
                                    <button
                                        onClick={() => { haptic('light'); setIncludeRests(!includeRests); }}
                                        className={`flex-1 min-w-[100px] py-2.5 px-4 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2 ${
                                            includeRests 
                                                ? 'bg-gradient-to-r from-purple-500 to-purple-600 text-white shadow-lg' 
                                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                        }`}
                                    >
                                        <span>🎵</span>
                                        <span>{t('common.add_rests')}</span>
                                    </button>
                                    <button
                                        onClick={() => { haptic('light'); setIsMetronomeEnabled(!isMetronomeEnabled); }}
                                        className={`flex-1 min-w-[100px] py-2.5 px-4 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2 ${
                                            isMetronomeEnabled 
                                                ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg' 
                                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                        }`}
                                    >
                                        <span>⏱️</span>
                                        <span>{t('common.metronome')}</span>
                                    </button>
                                    <button
                                        onClick={() => { haptic('light'); setIsSoundEnabled(!isSoundEnabled); }}
                                        className={`flex-1 min-w-[100px] py-2.5 px-4 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2 ${
                                            isSoundEnabled 
                                                ? 'bg-gradient-to-r from-green-500 to-green-600 text-white shadow-lg' 
                                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                        }`}
                                    >
                                        <span>🔊</span>
                                        <span>{t('common.sounds')}</span>
                                    </button>
                                </div>
                            </div>

                            {/* Start Button - HERO */}
                            <button
                                onClick={startGame}
                                className="w-full bg-gradient-to-r from-purple-500 via-purple-600 to-pink-600 text-white font-black py-5 rounded-2xl shadow-2xl active:scale-95 transition-transform flex items-center justify-center gap-3 text-xl border-2 border-purple-400"
                            >
                                <span className="text-4xl">▶️</span>
                                <span>{t('common.start')}</span>
                            </button>

                            <div className="h-4"></div>
                        </div>
                    </div>
                </>
            )}

            {/* Game Area - Landscape Mode */}
            {isPlaying && (
                <div 
                    ref={containerRef} 
                    className="flex-1 relative flex items-center justify-center bg-gradient-to-br from-purple-100 to-pink-100"
                    onClick={handleTap}
                    onTouchStart={handleTap}
                >
                    {/* Stats Overlay */}
                    <div className="absolute top-3 left-0 right-0 flex justify-center gap-3 pointer-events-none z-30 px-4">
                        <div className="bg-white/95 backdrop-blur-md px-4 py-2 rounded-2xl shadow-xl border border-purple-200 flex gap-6">
                            <div className="text-center">
                                <div className="text-xs font-bold text-green-600 uppercase">Perfect</div>
                                <div className="text-2xl font-black text-green-700">{stats.perfect}</div>
                            </div>
                            <div className="text-center">
                                <div className="text-xs font-bold text-yellow-600 uppercase">Good</div>
                                <div className="text-2xl font-black text-yellow-700">{stats.good}</div>
                            </div>
                            <div className="text-center">
                                <div className="text-xs font-bold text-red-600 uppercase">Miss</div>
                                <div className="text-2xl font-black text-red-700">{stats.miss}</div>
                            </div>
                        </div>
                        
                        {combo > 1 && (
                            <div className="bg-gradient-to-r from-orange-500 to-orange-600 px-4 py-2 rounded-2xl shadow-xl animate-pulse">
                                <div className="text-xs font-bold text-white uppercase">Combo</div>
                                <div className="text-2xl font-black text-white">{combo}x 🔥</div>
                            </div>
                        )}
                    </div>

                    {/* Countdown */}
                    {countdown !== null && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm z-50">
                            <div className="bg-white/95 px-8 py-6 rounded-3xl shadow-2xl border-4 border-purple-400 text-center">
                                <div className="text-lg font-black text-purple-600 mb-2">
                                    {countdown > 1 ? t('rhythm.wait') : t('rhythm.ready')}
                                </div>
                                <div className="text-7xl font-black text-purple-700 animate-pulse">
                                    {countdown}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Feedback */}
                    {feedback && (
                        <div className="absolute top-24 left-0 right-0 z-50 flex justify-center pointer-events-none">
                            <div className={`text-3xl font-black ${feedback.color} bg-white/95 px-8 py-3 rounded-2xl shadow-2xl animate-bounce border-2 ${
                                feedback.color.includes('green') ? 'border-green-400' :
                                feedback.color.includes('yellow') ? 'border-yellow-400' : 'border-red-400'
                            }`}>
                                {feedback.text}
                            </div>
                        </div>
                    )}

                    {/* Staff */}
                    <div className="w-full px-4">
                        {visualMode === 'scrolling' ? (
                            <RhythmStaff notes={activeNotes} hitX={HIT_X} />
                        ) : (
                            <StaticRhythmStaff
                                notes={activeNotes.filter(n => n.targetTime >= currentPageTimeRef.current && n.targetTime < currentPageTimeRef.current + (getMeasureDuration() * 3))}
                                timeSignature={timeSignature}
                                currentBeatIndex={0}
                            />
                        )}
                    </div>

                    {/* Score Display */}
                    <div className="absolute top-3 left-4 z-30">
                        <div className="bg-gradient-to-r from-purple-500 to-purple-600 px-4 py-2 rounded-2xl shadow-xl">
                            <div className="text-xs font-bold text-white/80 uppercase">Score</div>
                            <div className="text-3xl font-black text-white">{score}</div>
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

                    {/* Tap Hint */}
                    <div className="absolute bottom-4 left-4 z-30 bg-white/90 backdrop-blur-sm px-4 py-2 rounded-2xl shadow-lg border border-purple-200">
                        <div className="text-xs font-bold text-purple-600 flex items-center gap-2">
                            <span className="text-lg">👆</span>
                            <span>Tap to hit notes</span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
