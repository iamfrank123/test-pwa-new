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

export default function MelodicScreen() {
    const { t } = useTranslation();
    const { setIsExerciseActive } = useMobile();
    const { lockLandscape, unlock, requestFullscreen, exitFullscreen } = useOrientation();

    // Settings
    const [bpm, setBpm] = useState(60);
    const [timeSignature, setTimeSignature] = useState<'3/4' | '4/4'>('4/4');
    const [minNote, setMinNote] = useState('C4');
    const [maxNote, setMaxNote] = useState('C5');
    const [keySignature, setKeySignature] = useState<'C' | 'G' | 'D' | 'A' | 'E' | 'F' | 'Bb' | 'Eb' | 'Ab'>('C');
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

    useEffect(() => { updateAudioBpm(bpm); }, [bpm, updateAudioBpm]);
    useEffect(() => { const [num] = timeSignature.split('/').map(Number); updateAudioSignature(num, 4); }, [timeSignature, updateAudioSignature]);

    const getMeasureDuration = useCallback(() => { const beatSec = 60 / bpm; const [num] = timeSignature.split('/').map(Number); return num * beatSec; }, [bpm, timeSignature]);

    const startGame = async () => {
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
                const measurePattern = generateMelodicPattern(allowedDurations, includeRests, { low: minNote, high: maxNote }, keySignature, timeSignature as any);

                const measureStart = playStartTime + (m * measureSec);
                let cursorInMeasure = 0;

                for (const pn of measurePattern) {
                    if (pn.duration === 'bar') {
                        const gameNote: GameNote = { id: Math.random().toString(36).substr(2, 9), note: pn, x: 900, status: 'pending', targetTime: measureStart + cursorInMeasure };
                        generatedNotes.push(gameNote);
                        continue;
                    }

                    const noteDurSec = pn.value * beatSec;
                    const gameNote: GameNote = { id: Math.random().toString(36).substr(2, 9), note: pn, x: 900, status: 'pending', targetTime: measureStart + cursorInMeasure };
                    generatedNotes.push(gameNote);
                    cursorInMeasure += noteDurSec;
                }
            }

            setActiveNotes(generatedNotes);
            playPatternGeneratedRef.current = true;
            nextSpawnTimeRef.current = playStartTime + playDur;
        }

        setActiveNotes(prev => prev.map(n => {
            if (n.status === 'pending' && currentTime > n.targetTime + 0.25) {
                if (n.note.isRest) return { ...n, status: 'match_perfect' as const };
                return { ...n, status: 'miss' as const };
            }
            return n;
        }).filter(n => n.targetTime >= currentPageTimeRef.current - 5.0));

        requestRef.current = requestAnimationFrame(gameLoop);
    };

    useEffect(() => { return () => { if (requestRef.current) cancelAnimationFrame(requestRef.current); }; }, []);

    const scoredNoteIds = useRef<Set<string>>(new Set());

    useEffect(() => {
        if (!isPlaying) return;
        const unscoredGreenRests = activeNotes.filter(n => n.note.isRest && n.status === 'match_perfect' && !scoredNoteIds.current.has(n.id));
        if (unscoredGreenRests.length > 0) {
            unscoredGreenRests.forEach(n => scoredNoteIds.current.add(n.id));
            setScore(s => s + (unscoredGreenRests.length * 5));
            setStats(s => ({ ...s, perfect: s.perfect + unscoredGreenRests.length }));
            setCombo(c => c + unscoredGreenRests.length);
        }
    }, [activeNotes, isPlaying]);

    const handleMIDINote = useCallback((event: MIDINoteEvent) => {
        if (event.type !== 'noteOn') return;
        const played = event.pitch;
        if (!isPlaying || !played) return;

        const currentTime = getAudioTime();

        setActiveNotes(currentNotes => {
            const candidates = currentNotes.filter(n => n.status === 'pending' && n.note.duration !== 'bar' && !n.note.isRest);
            if (candidates.length === 0) return currentNotes;
            candidates.sort((a, b) => Math.abs(a.targetTime - currentTime) - Math.abs(b.targetTime - currentTime));

            const matchingCandidates = candidates.filter(n => n.note.generated && n.note.generated.midiNumber === played);
            const target = matchingCandidates.length > 0 ? matchingCandidates[0] : candidates[0];
            if (!target || !target.note.generated) return currentNotes;

            const timeDiff = target.targetTime - currentTime;
            const absTimeDiff = Math.abs(timeDiff);
            const PERFECT_WINDOW_S = 0.10;
            const GOOD_WINDOW_S = 0.15;
            const IGNORE_WINDOW_S = 0.4;

            if (absTimeDiff > IGNORE_WINDOW_S) return currentNotes;

            if (played !== target.note.generated.midiNumber) {
                setCombo(0);
                setStats(s => ({ ...s, miss: s.miss + 1 }));
                setFeedback({ text: t('melodic.wrong_note'), color: 'text-red-500' });
                setTimeout(() => setFeedback(null), 800);
                return currentNotes.map(n => n.id === target.id ? { ...n, status: 'miss' as GameNote['status'] } : n);
            }

            let newStatus: GameNote['status'] = 'miss';
            let points = 0;
            let feedbackText = '';
            let feedbackColor = '';

            if (absTimeDiff <= PERFECT_WINDOW_S) {
                newStatus = 'match_perfect';
                points = 5;
                feedbackText = t('rhythm.perfect');
                feedbackColor = 'text-green-500';
                setStats(s => ({ ...s, perfect: s.perfect + 1 }));
                setCombo(c => c + 1);
            } else if (absTimeDiff <= GOOD_WINDOW_S) {
                newStatus = 'match_good';
                points = 3;
                feedbackText = timeDiff > 0 ? `${t('melodic.early')} (${t('rhythm.good')})` : `${t('melodic.late')} (${t('rhythm.good')})`;
                feedbackColor = 'text-yellow-500';
                setStats(s => ({ ...s, good: s.good + 1 }));
                setCombo(c => c + 1);
            } else {
                newStatus = 'miss';
                feedbackText = timeDiff > 0 ? t('melodic.too_early') : t('melodic.too_late');
                feedbackColor = 'text-red-500';
                setStats(s => ({ ...s, miss: s.miss + 1 }));
                setCombo(0);
            }

            if (points > 0) setScore(s => s + points);
            setFeedback({ text: feedbackText, color: feedbackColor });
            setTimeout(() => setFeedback(null), 1000);

            return currentNotes.map(n => n.id === target.id ? { ...n, status: newStatus } : n);
        });
    }, [isPlaying, getAudioTime, t]);

    useMIDIInput(handleMIDINote);

    const KEY_SIGS: ('C' | 'G' | 'D' | 'A' | 'E' | 'F' | 'Bb' | 'Eb' | 'Ab')[] = ['C', 'G', 'D', 'A', 'E', 'F', 'Bb', 'Eb', 'Ab'];

    return (
        <div className="flex flex-col h-full bg-gradient-to-br from-stone-50 to-stone-100 overflow-hidden">
            {!isPlaying && (
                <>
                    <MobileScreenHeader title={t('melodic.title')} />
                    <div className="flex-1 overflow-y-auto px-3 py-3 pb-safe">
                        <div className="max-w-md mx-auto space-y-2.5">
                            <div className="bg-white/90 backdrop-blur-sm p-2.5 rounded-xl shadow-sm border border-gray-100">
                                <div className="flex items-center justify-between mb-1.5">
                                    <label className="text-xs font-bold text-gray-600 uppercase">{t('common.bpm')}</label>
                                    <span className="text-lg font-black text-amber-600">{bpm}</span>
                                </div>
                                <input type="range" min="40" max="200" value={bpm} onChange={(e) => setBpm(Number(e.target.value))} className="w-full h-1.5 accent-amber-500" />
                            </div>

                            <div className="bg-white/90 backdrop-blur-sm p-2.5 rounded-xl shadow-sm border border-gray-100">
                                <div className="flex gap-2">
                                    <div className="flex-1">
                                        <label className="text-xs font-bold text-gray-600 uppercase block mb-1">{t('common.time_signature')}</label>
                                        <div className="flex gap-1.5">
                                            {(['3/4', '4/4'] as const).map(sig => (
                                                <button key={sig} onClick={() => setTimeSignature(sig)} className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${timeSignature === sig ? 'bg-amber-600 text-white shadow-md' : 'bg-gray-100 text-gray-600'}`}>{sig}</button>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="flex-1">
                                        <label className="text-xs font-bold text-gray-600 uppercase block mb-1">{t('common.key')}</label>
                                        <select value={keySignature} onChange={e => setKeySignature(e.target.value as any)} className="w-full py-1.5 px-2 rounded-lg border border-gray-200 text-xs font-semibold focus:border-amber-400 focus:outline-none">
                                            {KEY_SIGS.map(k => (<option key={k} value={k}>{k}</option>))}
                                        </select>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-white/90 backdrop-blur-sm p-2.5 rounded-xl shadow-sm border border-gray-100">
                                <label className="text-xs font-bold text-gray-600 uppercase block mb-1.5">{t('common.notes_label')}</label>
                                <div className="flex gap-1.5">
                                    {[{ id: 'w', icon: '𝅝' }, { id: 'h', icon: '𝅗𝅥' }, { id: 'q', icon: '♩' }, { id: '8', icon: '♪' }, { id: '16', icon: '♬' }].map(opt => (
                                        <button key={opt.id} onClick={() => { if (allowedDurations.includes(opt.id as any)) setAllowedDurations(allowedDurations.filter(d => d !== opt.id)); else setAllowedDurations([...allowedDurations, opt.id as any]); }} className={`flex-1 py-2 rounded-lg font-bold text-lg transition-all ${allowedDurations.includes(opt.id as any) ? 'bg-amber-500 text-white shadow-md scale-105' : 'bg-gray-100 text-gray-400'}`}>{opt.icon}</button>
                                    ))}
                                </div>
                            </div>

                            <div className="bg-white/90 backdrop-blur-sm p-2.5 rounded-xl shadow-sm border border-gray-100">
                                <label className="text-xs font-bold text-gray-600 uppercase block mb-1.5">{t('common.note_range')}</label>
                                <div className="flex items-center gap-1.5">
                                    <input type="text" value={minNote} onChange={e => setMinNote(e.target.value)} className="flex-1 py-1.5 px-2 text-sm rounded-lg border border-gray-200 text-center font-semibold focus:border-amber-400 focus:outline-none" placeholder="C4" />
                                    <span className="text-gray-400 text-sm">—</span>
                                    <input type="text" value={maxNote} onChange={e => setMaxNote(e.target.value)} className="flex-1 py-1.5 px-2 text-sm rounded-lg border border-gray-200 text-center font-semibold focus:border-amber-400 focus:outline-none" placeholder="C5" />
                                </div>
                            </div>

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
                                </div>
                            </div>

                            {/* MIDI Requirement Info */}
                            <div className="bg-amber-50/90 backdrop-blur-sm border border-amber-300 rounded-xl p-3 text-sm">
                                <p className="font-bold text-amber-900 mb-1 flex items-center gap-2">
                                    <span>🎹</span>
                                    <span>{t('melodic.midi_required_title')}</span>
                                </p>
                                <p className="text-xs text-amber-800 leading-relaxed">
                                    {t('melodic.midi_required_desc')}
                                </p>
                            </div>

                            <button onClick={startGame} className="w-full bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 text-white font-black py-4 rounded-2xl shadow-xl active:scale-95 transition-transform flex items-center justify-center gap-3 text-xl mt-4 border-2 border-amber-400">
                                <span className="text-3xl">▶️</span>
                                <span>{t('common.start')}</span>
                            </button>

                            <div className="h-4"></div>
                        </div>
                    </div>
                </>
            )}

            {isPlaying && (
                <div className="flex-1 flex flex-col bg-stone-50 overflow-hidden relative">
                    <div className="absolute top-2 left-0 right-0 flex justify-center space-x-4 pointer-events-none z-30">
                        <div className="bg-white/90 px-4 py-2 rounded-lg border border-gray-200 shadow-sm"><span className="text-green-600 font-bold block text-sm">{t('stats.perfect')}</span><span className="text-2xl font-bold text-green-700">{stats.perfect}</span></div>
                        <div className="bg-white/90 px-4 py-2 rounded-lg border border-gray-200 shadow-sm"><span className="text-yellow-600 font-bold block text-sm">{t('stats.good')}</span><span className="text-2xl font-bold text-yellow-700">{stats.good}</span></div>
                        <div className="bg-white/90 px-4 py-2 rounded-lg border border-gray-200 shadow-sm"><span className="text-red-500 font-bold block text-sm">{t('stats.miss')}</span><span className="text-2xl font-bold text-red-600">{stats.miss}</span></div>
                        {combo > 1 && (<div className="bg-white/90 px-4 py-2 rounded-lg border border-orange-200 shadow-sm"><span className="text-orange-500 font-bold block text-sm">{t('rhythm.combo')}</span><span className="text-2xl font-bold text-orange-600">{combo}x</span></div>)}
                    </div>

                    {countdown !== null && (
                        <div className="absolute top-24 left-0 right-0 flex items-center justify-center z-40 pointer-events-none">
                            <div className="text-center bg-white/90 px-6 py-2 rounded-xl shadow-lg border border-amber-100">
                                <div className="text-xl font-bold text-amber-600 mb-0.5">{countdown > 1 ? t('rhythm.wait') : t('rhythm.ready')}</div>
                                <div className="text-4xl font-black text-amber-800">{countdown}</div>
                            </div>
                        </div>
                    )}

                    {feedback && (
                        <div className="absolute top-32 left-0 right-0 z-50 flex justify-center pointer-events-none">
                            <div className={`text-2xl font-black animate-bounce ${feedback.color} bg-white/95 px-6 py-2 rounded-full shadow-lg`}>
                                {feedback.text}
                            </div>
                        </div>
                    )}

                    <div className="flex-1 flex items-center justify-center">
                        <StaticMelodicStaff notes={activeNotes} timeSignature={timeSignature} />
                    </div>

                    <div className="absolute bottom-4 right-4 z-20">
                        <button onClick={stopGame} className="bg-red-600 hover:bg-red-700 text-white font-bold px-6 py-3 rounded-full shadow-xl active:scale-95 transition-all flex items-center gap-2">
                            <span className="text-xl">⏹️</span>
                            <span>{t('common.stop')}</span>
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
