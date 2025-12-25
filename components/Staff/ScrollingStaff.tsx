'use client';

import { useEffect, useRef, useState } from 'react';
import { GeneratedNote, KeySignature } from '@/lib/generator/types';
import { getKeySignatureInfo } from '@/lib/generator/note-generator';
import { Vex } from 'vexflow';
import { useTranslation } from '@/context/LanguageContext';

const { Factory, StaveNote, Voice, Formatter } = Vex.Flow;

interface ScrollingStaffProps {
    notes: GeneratedNote[];
    currentNoteIndex: number;
    keySignature: KeySignature;
    feedbackStatus: 'idle' | 'correct' | 'incorrect';
    compact?: boolean;
}

export default function ScrollingStaff({
    notes,
    currentNoteIndex,
    keySignature,
    feedbackStatus,
    compact = false
}: ScrollingStaffProps) {
    const { t } = useTranslation();
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!containerRef.current) {
            console.log('No container ref');
            return;
        }

        if (notes.length === 0) {
            console.log('No notes to display');
            return;
        }

        console.log('Rendering staff with', notes.length, 'notes');

        // Clear previous rendering
        containerRef.current.innerHTML = '';

        try {
            // Create a unique container for this render
            const uniqueId = 'vexflow-scroll-' + Math.random().toString(36).substr(2, 9);
            const renderDiv = document.createElement('div');
            renderDiv.id = uniqueId;
            renderDiv.style.overflowX = 'auto';
            renderDiv.style.overflowY = 'hidden';
            renderDiv.style.whiteSpace = 'nowrap'; // Ensure no wrapping
            containerRef.current.appendChild(renderDiv);

            // Use Vex.Flow.Renderer instead of Factory for more control
            const VF = Vex.Flow;
            const renderer = new VF.Renderer(renderDiv, VF.Renderer.Backends.SVG);

            // Create notes (take first 20)
            const displayNotes = notes.slice(0, 20);

            // Use dynamic width based on note count, but cap it or scale it
            const noteSpacing = compact ? 60 : 120;
            const minWidth = compact ? 400 : 800;
            const contentWidth = Math.max(minWidth, displayNotes.length * noteSpacing + 100);
            const height = compact ? 120 : 250;
            renderer.resize(contentWidth, height);

            const context = renderer.getContext();

            // Scale context if compact
            if (compact) {
                context.scale(0.8, 0.8);
                renderer.resize(contentWidth * 0.8, height * 0.8);
            }

            // Create a stave
            const staveY = compact ? 10 : 40;
            const stave = new VF.Stave(10, staveY, contentWidth - 20);

            // Force Treble clef as requested to prevent visual jumping
            const clef = 'treble';
            stave.addClef(clef);

            // Add key signature
            const keyStr = keySignature === 'Bb' || keySignature === 'Eb' || keySignature === 'Ab'
                ? keySignature
                : keySignature;
            stave.addKeySignature(keyStr);

            stave.setContext(context).draw();
            const vfNotes = displayNotes.map(note => {
                const accidentalStr = note.accidental === '#' ? '#' : note.accidental === 'b' ? 'b' : '';
                const noteStr = `${note.note.toLowerCase()}${accidentalStr}/${note.octave}`;

                const staveNote = new StaveNote({
                    clef: clef,
                    keys: [noteStr],
                    duration: 'w'
                });

                // Add accidental if needed
                if (note.accidental) {
                    staveNote.addModifier(new VF.Accidental(note.accidental));
                }

                return staveNote;
            });

            // Create a voice
            const voice = new Voice({ num_beats: vfNotes.length * 4, beat_value: 4 });
            voice.addTickables(vfNotes);

            // Format and draw
            new Formatter().joinVoices([voice]).format([voice], contentWidth - 100);
            voice.draw(context, stave);

            // Add smooth transition to the SVG for note movements
            const svg = renderDiv.querySelector('svg');
            if (svg) {
                svg.style.transition = 'all 0.3s ease-out';

                // Apply colors to noteheads
                const noteheads = svg.querySelectorAll('.vf-notehead');
                noteheads.forEach((notehead, index) => {
                    if (index === currentNoteIndex) {
                        // Current note
                        if (feedbackStatus === 'correct') {
                            notehead.setAttribute('fill', '#22c55e'); // green
                            notehead.setAttribute('stroke', '#22c55e');
                        } else if (feedbackStatus === 'incorrect') {
                            notehead.setAttribute('fill', '#ef4444'); // red
                            notehead.setAttribute('stroke', '#ef4444');
                        } else {
                            notehead.setAttribute('fill', '#3b82f6'); // blue
                            notehead.setAttribute('stroke', '#3b82f6');
                        }
                    } else if (index < currentNoteIndex) {
                        // Already played
                        notehead.setAttribute('fill', '#9ca3af'); // gray
                        notehead.setAttribute('stroke', '#9ca3af');
                        notehead.setAttribute('opacity', '0.5');
                    } else {
                        // Upcoming
                        notehead.setAttribute('fill', '#000000');
                        notehead.setAttribute('stroke', '#000000');
                    }
                });
            }

            console.log('✅ Staff rendered successfully');

        } catch (error) {
            console.error('❌ VexFlow rendering error:', error);
            // Display error to user
            if (containerRef.current) {
                containerRef.current.innerHTML = `
                    <div style="color: red; padding: 20px;">
                        <strong>${t('sight_reading.render_error')}:</strong> ${error}
                    </div>
                `;
            }
        }

    }, [notes, currentNoteIndex, keySignature, feedbackStatus, t]);

    return (
        <div className={`bg-white rounded-xl shadow-lg ${compact ? 'p-2' : 'p-8'} mb-6`}>
            <h2 className="text-2xl font-bold text-gray-800 mb-4 text-center">
                {t('sight_reading.staff_title')}
            </h2>

            {notes.length > 0 ? (
                <>
                    <div
                        ref={containerRef}
                        className={`flex justify-start items-center ${compact ? 'min-h-[120px]' : 'min-h-[250px]'} w-full overflow-x-auto overflow-y-hidden border-2 border-gray-200 rounded-lg`}
                        style={{ maxWidth: '100%' }}
                    />

                    <div className="text-center mt-4 text-gray-600">
                        <p className="text-sm">
                            <span className="inline-block w-4 h-4 bg-blue-600 rounded-full mr-2"></span>
                            {t('sight_reading.current_note_label')}
                        </p>
                        <p className="text-sm mt-1">
                            <span className="inline-block w-4 h-4 bg-gray-400 rounded-full mr-2"></span>
                            {t('sight_reading.played_notes_label')}
                        </p>
                    </div>
                </>
            ) : (
                <div className="text-center text-gray-500 py-20">
                    <p className="text-xl">{t('sight_reading.start_prompt')}</p>
                </div>
            )}
        </div>
    );
}
