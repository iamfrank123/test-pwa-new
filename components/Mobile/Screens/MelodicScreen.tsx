'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useTranslation } from '@/context/LanguageContext';
import { useMobile } from '@/context/MobileContext';
import { useOrientation } from '@/hooks/useOrientation';
import StaticMelodicStaff from '@/components/Staff/StaticMelodicStaff';
import generateMelodicPattern, { MelodicNote } from '@/lib/generator/melodic-generator';
import { useRhythmAudio } from '@/hooks/useRhythmAudio';
import { useMIDIInput } from '@/hooks/useMIDIInput';
import { MIDINoteEvent } from '@/lib/types/midi';
import MobileScreenHeader from '@/components/Mobile/MobileScreenHeader';

interface GameNote {
    id: string;
    note: MelodicNote;
    x: number;
    status: 'pending' | 'hit' | 'miss' | 'match_perfect' | 'match_good';
    targetTime: number;
}

const KEY_SIGS = ['C', 'G', 'D', 'A', 'E', 'F', 'Bb', 'Eb', 'Ab'] as const;

export default function MelodicScreen() {
    const { t } = useTranslation();
    const { setIsExerciseActive } = useMobile();
    const { lockLandscape, unlock, requestFullscreen, exitFullscreen } = useOrientation();

    // Settings
    const [bpm, setBpm] = useState(60);
    const [timeSignature, setTimeSignature] = useState<'3/4' | '4/4'>('4/4');
    const [minNote, setMinNote] = useState('C4');
    const [maxNote, setMaxNote] = useState('C5');
    const [keySignature, setKeySignature] = useState<typeof KEY_SIGS[number]>('C');
    const [allowedDurations, setAllowedDurations] = useState<('w' | 'h' | 'q' | '8' | '16')[]>(['q', '8']);
    const [includeRests, setIncludeRests] = useState(false);
    const [isMetronomeEnabled, setIsMetronomeEnabled] = useState(true);

    // Game state
    const [isPlaying, setIsPlaying] = useState(false);
    const [score, setScore] = useState(0);
    const [combo, setCombo] = useState(0);
    const [activeNotes, setActiveNotes] = useState<GameNote[]>([]);
    const [countdown, setCountdown] = useState<number | null>(null);
    const [stats, setStats] = useState({ perfect: 0, good: 0, miss: 0 });
    const [feedback, setFeedback] = useState<{ text: string; color: string } | null>(null);

    const { initAudio, startMetronome, stopMetronome, setBpm: updateAudioBpm, setTimeSignature: updateAudioSignature, getAudioTime } = useRhythmAudio();

    const requestRef = useRef<number>();
    const nextSpawnTimeRef = useRef<number>(0);
    const currentPageTimeRef = useRef<number>(0);
    const playPatternGeneratedRef = useRef<boolean>(false);

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

    useEffect(() => { updateAudioBpm(bpm); }, [bpm, updateAudioBpm]);
    useEffect(() => { const [num] = timeSignature.split('/').map(Number); updateAudioSignature(num, 4); }, [timeSignature, updateAudioSignature]);

    const getMeasureDuration = useCallback(() => { const beatSec = 60 / bpm; const [num] = timeSignature.split('/').map(Number); return num * beatSec; }, [bpm, timeSignature]);

    const startGame = async () => {
        haptic('medium');
        setIsExerciseActive(true);
        await requestFullscreen();
        await lockLandscape();

        initAudio();
        setIsPlaying(true);
        let audioStart = 0;
        if (isMetronomeEnabled) audioStart = startMetronome() || 0; else audioStart = getAudioTime() + 0.1;

        setScore(0); setCombo(0); setStats({ perfect: 0, good: 0, miss: 0 }); setActiveNotes([]);
        playPatternGeneratedRef.current = false;

        const measureDur = getMeasureDuration();
        const firstNoteTime = audioStart + measureDur;
        nextSpawnTimeRef.current = firstNoteTime;
        currentPageTimeRef.current = audioStart;

        requestRef.current = requestAnimationFrame(gameLoop);
    };

    const stopGame = async () => {
        haptic('medium');
        setIsPlaying(false);
        stopMetronome();
        if (requestRef.current) cancelAnimationFrame(requestRef.current);
        setIsExerciseActive(false);
        await exitFullscreen();
        await unlock();
    };

    useEffect(() => { if (isPlaying) { if (isMetronomeEnabled) startMetronome(); else stopMetronome(); } }, [isMetronomeEnabled, isPlaying, startMetronome, stopMetronome]);

    const gameLoop = () => {
        const currentTime = getAudioTime();
        const measureDur = getMeasureDuration();

        const EXERCISE_MEASURES = 2;
        const GAP_MEASURES = 1;

        const gapDur = measureDur * GAP_MEASURES;
        const playDur = measureDur * EXERCISE_MEASURES;
        const cycleDur = gapDur + playDur;

        const timeInCycle = currentTime - currentPageTimeRef.current;
        if (timeInCycle >= cycleDur) {
            currentPageTimeRef.current += cycleDur;
            playPatternGeneratedRef.current = false;
            setActiveNotes([]);
        }
        if (timeInCycle < gapDur) {
            const beatSec = 60 / bpm; const currentBeatIndex = Math.floor(timeInCycle / beatSec); const gapBeats = Math.round(gapDur / beatSec); const beatsLeft = gapBeats - currentBeatIndex; setCountdown(beatsLeft > 0 ? beatsLeft : null);
        } else setCountdown(null);

        const playStartTime = currentPageTimeRef.current + gapDur;

        if (!playPatternGeneratedRef.current) {
            const [num] = timeSignature.split('/').map(Number);
            const beatSec = 60 / bpm;
            const measureSec = num * beatSec;

            const generatedNotes: GameNote[] = [];

            for (let m = 0; m < EXERCISE_MEASURES; m++) {
                const pattern = generateMelodicPattern(allowedDurations, includeRests, { low: minNote, high: maxNote }, keySignature as any, timeSignature);
                let cumulativeTime = playStartTime + (m * measureSec);

                pattern.forEach(mn => {
                    if (mn.duration !== 'bar') {
                        generatedNotes.push({ id: Math.random().toString(36).substr(2, 9), note: mn, x: 0, status: 'pending', targetTime: cumulativeTime });
                        cumulativeTime += mn.value * beatSec;
                    } else {
                        generatedNotes.push({ id: Math.random().toString(36).substr(2, 9), note: mn, x: 0, status: 'pending', targetTime: cumulativeTime });
                    }
                });
            }

            setActiveNotes(generatedNotes);
            playPatternGeneratedRef.current = true;
        }

        const playTimeInCycle = timeInCycle - gapDur;
        if (playTimeInCycle >= 0 && playTimeInCycle < playDur) {
            setActiveNotes(prev => prev.map(gn => {
                if (gn.note.isRest || gn.note.duration === 'bar') return gn;
                if (gn.status !== 'pending') return gn;
                const noteRelTime = gn.targetTime - playStartTime;
                if (playTimeInCycle >= noteRelTime && playTimeInCycle < noteRelTime + (gn.note.value * (60 / bpm))) {
                    return gn;
                } else if (playTimeInCycle >= noteRelTime + (gn.note.value * (60 / bpm))) {
                    setStats(s => ({ ...s, miss: s.miss + 1 }));
                    setCombo(0);
                    return { ...gn, status: 'miss' };
                }
                return gn;
            }));
        }

        requestRef.current = requestAnimationFrame(gameLoop);
    };

    const handleMIDINote = useCallback((event: MIDINoteEvent) => {
        if (!isPlaying || event.type !== 'noteOn') return;

        setActiveNotes(prev => {
            const pending = prev.filter(n => n.status === 'pending' && !n.note.isRest && n.note.duration !== 'bar');
            if (pending.length === 0) return prev;

            const currentTime = getAudioTime();
            const validNotes = pending.filter(n => {
                const noteEnd = n.targetTime + (n.note.value * (60 / bpm));
                return currentTime >= n.targetTime - 0.2 && currentTime <= noteEnd + 0.2;
            });

            if (validNotes.length === 0) return prev;

            const target = validNotes[0];
            if (!target.note.generated) return prev;

            const targetPitch = target.note.generated.midiNumber % 12;
            const playedPitch = event.pitch % 12;

            if (targetPitch === playedPitch) {
                const timing = Math.abs(currentTime - target.targetTime);
                let newStatus: GameNote['status'] = 'pending';
                let points = 0;

                if (timing <= 0.1) {
                    newStatus = 'match_perfect';
                    points = 5;
                    setStats(s => ({ ...s, perfect: s.perfect + 1 }));
                    setCombo(c => c + 1);
                    setFeedback({ text: `${t('rhythm.perfect')} +${points}`, color: 'text-green-500' });
                    haptic('success');
                } else if (timing <= 0.2) {
                    newStatus = 'match_good';
                    points = 3;
                    setStats(s => ({ ...s, good: s.good + 1 }));
                    setCombo(c => c + 1);
                    setFeedback({ text: `${t('rhythm.good')} +${points}`, color: 'text-yellow-500' });
                    haptic('medium');
                }

                setScore(s => s + points);
                setTimeout(() => setFeedback(null), 800);

                return prev.map(n => n.id === target.id ? { ...n, status: newStatus } : n);
            } else {
                setFeedback({ text: t('melodic.wrong_note'), color: 'text-red-500' });
                haptic('error');
                setTimeout(() => setFeedback(null), 800);
                return prev;
            }
        });
    }, [isPlaying, bpm, t, getAudioTime, haptic]);

    useMIDIInput(handleMIDINote);

    useEffect(() => { return () => { if (requestRef.current) cancelAnimationFrame(requestRef.current); }; }, []);

    return (
        <div className="flex flex-col h-full bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50 overflow-hidden">
            {!isPlaying && (
                <>
                    <MobileScreenHeader title={t('melodic.title')} />
                    <div className="flex-1 overflow-y-auto px-4 py-4 pb-safe">
                        <div className="max-w-md mx-auto space-y-3">
                            {/* BPM Control - FEATURED */}
                            <div className="bg-gradient-to-r from-green-500 to-emerald-600 p-4 rounded-2xl shadow-lg">
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
                                    max="200"
                                    value={bpm}
                                    onChange={(e) => setBpm(Number(e.target.value))}
                                    className="w-full h-3 bg-white/20 rounded-full appearance-none cursor-pointer accent-white"
                                />
                            </div>

                            {/* Time Signature & Key */}
                            <div className="grid grid-cols-2 gap-3">
                                <div className="bg-white/90 backdrop-blur-sm p-3 rounded-2xl shadow-md border border-gray-100">
                                    <label className="text-xs font-bold text-gray-600 uppercase block mb-2">{t('common.time_signature')}</label>
                                    <div className="flex gap-1">
                                        {(['3/4', '4/4'] as const).map(sig => (
                                            <button
                                                key={sig}
                                                onClick={() => { haptic('light'); setTimeSignature(sig); }}
                                                className={`flex-1 py-2 rounded-xl text-sm font-bold transition-all ${timeSignature === sig ? 'bg-green-500 text-white shadow-lg scale-105' : 'bg-gray-100 text-gray-600'}`}
                                            >
                                                {sig}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="bg-white/90 backdrop-blur-sm p-3 rounded-2xl shadow-md border border-gray-100">
                                    <label className="text-xs font-bold text-gray-600 uppercase block mb-2">{t('common.key')}</label>
                                    <select 
                                        value={keySignature} 
                                        onChange={e => { haptic('light'); setKeySignature(e.target.value as any); }} 
                                        className="w-full py-2 px-2 rounded-xl border-2 border-gray-200 text-sm font-bold focus:border-green-400 focus:outline-none bg-white"
                                    >
                                        {KEY_SIGS.map(k => (<option key={k} value={k}>{k}</option>))}
                                    </select>
                                </div>
                            </div>

                            {/* Note Durations */}
                            <div className="bg-white/90 backdrop-blur-sm p-3 rounded-2xl shadow-md border border-gray-100">
                                <label className="text-xs font-bold text-gray-600 uppercase block mb-2 flex items-center gap-2">
                                    <span>🎵</span>
                                    <span>{t('common.notes_label')}</span>
                                </label>
                                <div className="flex gap-2">
                                    {[{ id: 'w', icon: '𝅝' }, { id: 'h', icon: '𝅗𝅥' }, { id: 'q', icon: '♩' }, { id: '8', icon: '♪' }, { id: '16', icon: '♬' }].map(opt => (
                                        <button
                                            key={opt.id}
                                            onClick={() => {
                                                haptic('light');
                                                if (allowedDurations.includes(opt.id as any)) setAllowedDurations(allowedDurations.filter(d => d !== opt.id));
                                                else setAllowedDurations([...allowedDurations, opt.id as any]);
                                            }}
                                            className={`flex-1 py-3 rounded-xl font-bold text-2xl transition-all ${allowedDurations.includes(opt.id as any) ? 'bg-gradient-to-br from-green-500 to-emerald-600 text-white shadow-lg scale-105' : 'bg-gray-100 text-gray-400'}`}
                                        >
                                            {opt.icon}
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
                                        value={minNote}
                                        onChange={e => setMinNote(e.target.value)}
                                        className="flex-1 py-3 px-4 text-base rounded-xl border-2 border-gray-200 text-center font-bold focus:border-green-400 focus:outline-none bg-white"
                                        placeholder="C4"
                                    />
                                    <span className="text-gray-400 text-2xl font-bold">→</span>
                                    <input
                                        type="text"
                                        value={maxNote}
                                        onChange={e => setMaxNote(e.target.value)}
                                        className="flex-1 py-3 px-4 text-base rounded-xl border-2 border-gray-200 text-center font-bold focus:border-green-400 focus:outline-none bg-white"
                                        placeholder="C5"
                                    />
                                </div>
                            </div>

                            {/* Options */}
                            <div className="bg-white/90 backdrop-blur-sm p-3 rounded-2xl shadow-md border border-gray-100">
                                <label className="text-xs font-bold text-gray-600 uppercase block mb-2">Options</label>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => { haptic('light'); setIncludeRests(!includeRests); }}
                                        className={`flex-1 py-2.5 px-4 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2 ${includeRests ? 'bg-gradient-to-r from-green-500 to-emerald-600 text-white shadow-lg' : 'bg-gray-100 text-gray-600'}`}
                                    >
                                        <span>🎵</span>
                                        <span>{t('common.add_rests')}</span>
                                    </button>
                                    <button
                                        onClick={() => { haptic('light'); setIsMetronomeEnabled(!isMetronomeEnabled); }}
                                        className={`flex-1 py-2.5 px-4 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2 ${isMetronomeEnabled ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg' : 'bg-gray-100 text-gray-600'}`}
                                    >
                                        <span>⏱️</span>
                                        <span>{t('common.metronome')}</span>
                                    </button>
                                </div>
                            </div>

                            {/* MIDI Info */}
                            <div className="bg-gradient-to-br from-green-50 to-emerald-50 p-4 rounded-2xl border-2 border-green-200">
                                <h3 className="text-sm font-bold text-green-900 mb-2 flex items-center gap-2">
                                    <span className="text-lg">🎹</span>
                                    <span>{t('melodic.midi_required_title')}</span>
                                </h3>
                                <p className="text-xs text-green-800 leading-relaxed">
                                    {t('melodic.midi_required_desc')}
                                </p>
                            </div>

                            <button
                                onClick={startGame}
                                className="w-full bg-gradient-to-r from-green-500 via-emerald-600 to-green-600 text-white font-black py-5 rounded-2xl shadow-2xl active:scale-95 transition-transform flex items-center justify-center gap-3 text-xl border-2 border-green-400"
                            >
                                <span className="text-4xl">▶️</span>
                                <span>{t('common.start')}</span>
                            </button>

                            <div className="h-4"></div>
                        </div>
                    </div>
                </>
            )}

            {isPlaying && (
                <div className="flex-1 flex flex-col bg-gradient-to-br from-green-100 to-emerald-100 overflow-hidden relative">
                    <div className="absolute top-3 left-0 right-0 flex justify-center gap-3 pointer-events-none z-30 px-4">
                        <div className="bg-white/95 backdrop-blur-md px-4 py-2 rounded-2xl shadow-xl border-2 border-green-200 flex gap-6">
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

                    {countdown !== null && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm z-50">
                            <div className="bg-white/95 px-8 py-6 rounded-3xl shadow-2xl border-4 border-green-400 text-center">
                                <div className="text-lg font-black text-green-600 mb-2">
                                    {countdown > 1 ? t('rhythm.wait') : t('rhythm.ready')}
                                </div>
                                <div className="text-7xl font-black text-green-700 animate-pulse">{countdown}</div>
                            </div>
                        </div>
                    )}

                    {feedback && (
                        <div className="absolute top-24 left-0 right-0 z-50 flex justify-center pointer-events-none">
                            <div className={`text-3xl font-black ${feedback.color} bg-white/95 px-8 py-3 rounded-2xl shadow-2xl animate-bounce border-2 ${feedback.color.includes('green') ? 'border-green-400' : feedback.color.includes('yellow') ? 'border-yellow-400' : 'border-red-400'}`}>
                                {feedback.text}
                            </div>
                        </div>
                    )}

                    <div className="flex-1 flex items-center justify-center">
                        <StaticMelodicStaff notes={activeNotes} timeSignature={timeSignature} />
                    </div>

                    <div className="absolute top-3 left-4 z-30">
                        <div className="bg-gradient-to-r from-green-500 to-emerald-600 px-4 py-2 rounded-2xl shadow-xl border-2 border-green-400">
                            <div className="text-xs font-bold text-white/80 uppercase">Score</div>
                            <div className="text-3xl font-black text-white">{score}</div>
                        </div>
                    </div>

                    <button
                        onClick={stopGame}
                        className="absolute bottom-4 right-4 bg-gradient-to-r from-red-500 to-red-600 text-white font-bold px-6 py-3 rounded-2xl shadow-2xl active:scale-95 transition-all z-40 flex items-center gap-2 border-2 border-red-400"
                    >
                        <span className="text-xl">⏹️</span>
                        <span className="font-black">{t('common.stop')}</span>
                    </button>

                    <div className="absolute bottom-4 left-4 z-30 bg-white/95 backdrop-blur-sm px-4 py-2 rounded-2xl shadow-lg border-2 border-green-200">
                        <div className="text-xs font-bold text-green-600 flex items-center gap-2">
                            <span className="text-lg">🎹</span>
                            <span>Play the melody on MIDI</span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
