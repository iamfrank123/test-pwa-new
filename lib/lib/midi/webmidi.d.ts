// Type definitions for Web MIDI API
// These types are part of the Web MIDI API specification

interface MIDIMessageEvent extends Event {
    data: Uint8Array | null;
    timeStamp: number;
}

interface MIDIInput extends EventTarget {
    id: string;
    name: string;
    manufacturer: string;
    state: 'connected' | 'disconnected';
    onmidimessage: ((this: MIDIInput, ev: MIDIMessageEvent) => any) | null;
}

interface MIDIOutput {
    id: string;
    name: string;
    manufacturer: string;
    state: 'connected' | 'disconnected';
}

interface MIDIAccess extends EventTarget {
    inputs: MIDIInputMap;
    outputs: MIDIOutputMap;
    onstatechange: ((this: MIDIAccess, ev: Event) => any) | null;
}

interface MIDIInputMap extends Map<string, MIDIInput> {}
interface MIDIOutputMap extends Map<string, MIDIOutput> {}

interface Navigator {
    requestMIDIAccess(options?: { sysex?: boolean }): Promise<MIDIAccess>;
}

