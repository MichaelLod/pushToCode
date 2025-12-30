export interface TerminalBufferSnapshot {
    lines: string[];
    cursorX: number;
    cursorY: number;
    cols: number;
    rows: number;
    ansiContent?: string;
}
export declare class TerminalBufferService {
    private readonly logger;
    private sessions;
    private readonly SYNC_THROTTLE_MS;
    private readonly ANSI_COLORS;
    private cellToAnsi;
    private serializeBufferToAnsi;
    createBuffer(sessionId: string, cols?: number, rows?: number): void;
    write(sessionId: string, data: string): void;
    getSnapshot(sessionId: string, force?: boolean): TerminalBufferSnapshot | null;
    getSnapshotThrottled(sessionId: string, callback: (snapshot: TerminalBufferSnapshot) => void): void;
    resize(sessionId: string, cols: number, rows: number): void;
    clear(sessionId: string): void;
    destroyBuffer(sessionId: string): void;
    hasBuffer(sessionId: string): boolean;
}
