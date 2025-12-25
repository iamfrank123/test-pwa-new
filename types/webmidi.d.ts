/**
 * Type definitions for Web MIDI API
 * These types are needed for TypeScript to recognize Web MIDI API types during build
 */

interface MIDIAccess extends EventTarget {
    inputs: MIDIInputMap;
    outputs: MIDIOutputMap;
    onstatechange: ((this: MIDIAccess, ev: MIDIConnectionEvent) => any) | null;
    sysexEnabled: boolean;
}

interface MIDIInputMap extends Map<string, MIDIInput> {}

interface MIDIOutputMap extends Map<string, MIDIOutput> {}

interface MIDIInput extends MIDIPort {
    onmidimessage: ((this: MIDIInput, ev: MIDIMessageEvent) => any) | null;
}

interface MIDIOutput extends MIDIPort {
    send(data: number[] | Uint8Array, timestamp?: number): void;
    clear(): void;
}

interface MIDIPort extends EventTarget {
    id: string;
    manufacturer?: string;
    name?: string;
    type: 'input' | 'output';
    version?: string;
    state: 'connected' | 'disconnected';
    connection: 'open' | 'closed' | 'pending';
    onstatechange: ((this: MIDIPort, ev: MIDIConnectionEvent) => any) | null;
    open(): Promise<MIDIPort>;
    close(): Promise<MIDIPort>;
}

interface MIDIMessageEvent extends Event {
    data: Uint8Array;
    receivedTime: number;
}

interface MIDIConnectionEvent extends Event {
    port: MIDIPort;
}

interface Navigator {
    requestMIDIAccess(options?: { sysex: boolean }): Promise<MIDIAccess>;
}

