'use client';

import { useEffect, useRef, useState } from 'react';
import { Vex } from 'vexflow';
import { RhythmNote } from '@/lib/generator/rhythm-generator';

const { Renderer, Stave, StaveNote, Voice, Formatter } = Vex.Flow;

interface RhythmGameNote {
    id: string;
    note: RhythmNote;
    x: number;
    status: 'pending' | 'hit' | 'miss' | 'match_perfect' | 'match_good';
}

interface RhythmStaffProps {
    notes: RhythmGameNote[];
    onHitZoneEnter?: (noteId: string) => void;
    onHitZoneLeave?: (noteId: string) => void;
    hitX: number;
}

export default function RhythmStaff({ notes, hitX }: RhythmStaffProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const rendererRef = useRef<any>(null);
    const contextRef = useRef<any>(null);

    const [staffWidth, setStaffWidth] = useState(800);
    const STAFF_HEIGHT = 200;

    // Use a ResizeObserver to handle responsiveness without infinite loops
    useEffect(() => {
        if (!containerRef.current) return;

        const resizeObserver = new ResizeObserver((entries) => {
            for (let entry of entries) {
                const newWidth = entry.contentRect.width;
                if (newWidth > 0 && Math.abs(newWidth - staffWidth) > 10) {
                    setStaffWidth(newWidth);
                }
            }
        });

        resizeObserver.observe(containerRef.current);

        // Initial setup for VexFlow
        containerRef.current.innerHTML = '';
        const renderer = new Renderer(containerRef.current, Renderer.Backends.SVG);
        renderer.resize(staffWidth, STAFF_HEIGHT);
        const context = renderer.getContext();
        rendererRef.current = renderer;
        contextRef.current = context;

        renderFrame();

        return () => resizeObserver.disconnect();
    }, [staffWidth]);

    const renderFrame = () => {
        if (!contextRef.current) return;
        const context = contextRef.current;
        context.clear();

        // 1. Draw Static Staff (Single Line)
        const stave = new Stave(0, 70, staffWidth);
        stave.setConfigForLine(0, { visible: true });
        stave.setNumLines(1);
        stave.setContext(context).draw();

        // 2. Draw Hit Marker (Green Line)
        context.save();
        context.beginPath();
        context.rect(hitX - 20, 50, 40, 60);
        context.setFillStyle('rgba(34, 197, 94, 0.2)');
        context.fill();
        context.restore();

        // 3. Draw Notes
        notes.forEach(gameNote => {
            if (gameNote.x < -50 || gameNote.x > staffWidth + 50) return;

            if (gameNote.note.duration === 'bar') {
                context.save();
                context.beginPath();
                context.moveTo(gameNote.x, 70);
                context.lineTo(gameNote.x, 70 + 80);
                context.lineWidth = 2;
                context.setStrokeStyle('#666666');
                context.stroke();
                context.restore();
                return;
            }

            const duration = gameNote.note.duration;
            const type = gameNote.note.isRest ? 'r' : '';
            const noteKey = 'b/4';

            const vfNote = new StaveNote({
                clef: 'percussion',
                keys: [noteKey],
                duration: duration + type,
                auto_stem: true
            });

            let color = '#000000';
            if (gameNote.status === 'match_perfect') color = '#22c55e';
            else if (gameNote.status === 'match_good') color = '#eab308';
            else if (gameNote.status === 'miss') color = '#ef4444';
            else if (gameNote.status === 'hit') color = '#9ca3af';

            vfNote.setStyle({ fillStyle: color, strokeStyle: color });

            const tickContext = new Vex.Flow.TickContext();
            tickContext.addTickable(vfNote);
            tickContext.preFormat().setX(gameNote.x);

            vfNote.setStave(stave);
            vfNote.setContext(context);
            vfNote.draw();
        });
    };

    // Re-render on notes update
    useEffect(() => {
        renderFrame();
    }, [notes]);

    return (
        <div className="w-full max-w-full overflow-hidden">
            <div ref={containerRef} className="bg-white rounded-xl shadow-lg border-2 border-gray-200 w-full" style={{ minHeight: STAFF_HEIGHT }} />
        </div>
    );
}

