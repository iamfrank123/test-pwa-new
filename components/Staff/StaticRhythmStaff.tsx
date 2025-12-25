'use client';

import { useEffect, useRef, useState } from 'react';
import { Vex } from 'vexflow';
import { RhythmNote } from '@/lib/generator/rhythm-generator';

const { Renderer, Stave, StaveNote, Voice, Formatter, Beam } = Vex.Flow;

interface RhythmGameNote {
    id: string;
    note: RhythmNote;
    x: number;
    status: 'pending' | 'hit' | 'miss' | 'match_perfect' | 'match_good';
    targetTime: number;
}

interface StaticRhythmStaffProps {
    notes: RhythmGameNote[]; // Should be exactly 2 measures of notes
    timeSignature: string; // '4/4' etc
    currentBeatIndex: number; // Index of note currently active/next
}

export default function StaticRhythmStaff({ notes, timeSignature, currentBeatIndex }: StaticRhythmStaffProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const rendererRef = useRef<any>(null);
    const contextRef = useRef<any>(null);

    const [barWidth, setBarWidth] = useState(400);
    const STAFF_HEIGHT = 200;

    useEffect(() => {
        if (!containerRef.current) return;

        const resizeObserver = new ResizeObserver((entries) => {
            for (let entry of entries) {
                const totalWidth = entry.contentRect.width;
                if (totalWidth > 0) {
                    const calculatedBarWidth = Math.max(150, (totalWidth - 60) / 2);
                    if (Math.abs(calculatedBarWidth - barWidth) > 5) {
                        setBarWidth(calculatedBarWidth);
                    }
                }
            }
        });

        resizeObserver.observe(containerRef.current);

        containerRef.current.innerHTML = '';
        const renderer = new Renderer(containerRef.current, Renderer.Backends.SVG);
        renderer.resize(barWidth * 2 + 50, STAFF_HEIGHT);
        const context = renderer.getContext();
        rendererRef.current = renderer;
        contextRef.current = context;

        renderFrame();

        return () => resizeObserver.disconnect();
    }, [notes, timeSignature, currentBeatIndex, barWidth]);

    const renderFrame = () => {
        if (!contextRef.current) return;
        const context = contextRef.current;
        context.clear();

        const measure1Notes: RhythmGameNote[] = [];
        const measure2Notes: RhythmGameNote[] = [];
        let currentMeasure = 1;

        notes.forEach((n, index) => {
            if (index === 0 && n.note.duration === 'bar') return;
            if (n.note.duration === 'bar') {
                currentMeasure++;
                return;
            }
            if (currentMeasure === 1) measure1Notes.push(n);
            else if (currentMeasure === 2) measure2Notes.push(n);
        });

        const stave1 = new Stave(10, 50, barWidth);
        stave1.addClef('percussion');
        stave1.addTimeSignature(timeSignature);
        stave1.setContext(context).draw();

        const stave2 = new Stave(10 + barWidth, 50, barWidth);
        stave2.setContext(context).draw();

        const createVexNotes = (measureNotes: RhythmGameNote[]) => {
            return measureNotes.map(gn => {
                const duration = gn.note.duration + (gn.note.isRest ? 'r' : '');
                let fillStyle = 'black';
                let strokeStyle = 'black';

                if (gn.status === 'match_perfect') { fillStyle = '#22c55e'; strokeStyle = '#22c55e'; }
                else if (gn.status === 'match_good') { fillStyle = '#eab308'; strokeStyle = '#eab308'; }
                else if (gn.status === 'miss') { fillStyle = '#ef4444'; strokeStyle = '#ef4444'; }

                const vn = new StaveNote({
                    clef: 'percussion',
                    keys: ['b/4'],
                    duration: duration,
                    auto_stem: true
                });

                vn.setStyle({ fillStyle, strokeStyle });
                return vn;
            });
        };

        const [numBeats, beatValue] = timeSignature.split('/').map(Number);

        if (measure1Notes.length > 0) {
            const voice1 = new Voice({ num_beats: numBeats, beat_value: beatValue });
            voice1.setMode(Voice.Mode.SOFT);
            const vfNotes1 = createVexNotes(measure1Notes);
            const beams1 = Beam.generateBeams(vfNotes1);
            voice1.addTickables(vfNotes1);
            new Formatter().joinVoices([voice1]).format([voice1], barWidth - 50);
            voice1.draw(context, stave1);
            beams1.forEach(b => b.setContext(context).draw());
        }

        if (measure2Notes.length > 0) {
            const voice2 = new Voice({ num_beats: numBeats, beat_value: beatValue });
            voice2.setMode(Voice.Mode.SOFT);
            const vfNotes2 = createVexNotes(measure2Notes);
            const beams2 = Beam.generateBeams(vfNotes2);
            voice2.addTickables(vfNotes2);
            new Formatter().joinVoices([voice2]).format([voice2], barWidth - 50);
            voice2.draw(context, stave2);
            beams2.forEach(b => b.setContext(context).draw());
        }
    };

    return (
        <div className="w-full max-w-full overflow-hidden flex justify-center mt-10 px-4">
            <div ref={containerRef} className="bg-white p-4 rounded-xl shadow-lg border-2 border-gray-200 w-full" style={{ minHeight: STAFF_HEIGHT }} />
        </div>
    );
}
