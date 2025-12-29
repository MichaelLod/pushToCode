import { Injectable, Logger } from '@nestjs/common';
import { Terminal } from '@xterm/headless';

interface TerminalSession {
  terminal: Terminal;
  lastSentBuffer: string;
  lastSyncTime: number;
  pendingSync: NodeJS.Timeout | null;
}

export interface TerminalBufferSnapshot {
  lines: string[];
  cursorX: number;
  cursorY: number;
  cols: number;
  rows: number;
}

@Injectable()
export class TerminalBufferService {
  private readonly logger = new Logger(TerminalBufferService.name);
  private sessions: Map<string, TerminalSession> = new Map();

  // Minimum time between buffer syncs (ms)
  private readonly SYNC_THROTTLE_MS = 50;

  /**
   * Create a new terminal buffer for a session
   */
  createBuffer(sessionId: string, cols = 120, rows = 30): void {
    // Clean up existing buffer if any
    this.destroyBuffer(sessionId);

    const terminal = new Terminal({
      cols,
      rows,
      scrollback: 1000,
      allowProposedApi: true,
    });

    this.sessions.set(sessionId, {
      terminal,
      lastSentBuffer: '',
      lastSyncTime: 0,
      pendingSync: null,
    });

    this.logger.log(`Created terminal buffer for session ${sessionId} (${cols}x${rows})`);
  }

  /**
   * Write data to the terminal buffer
   */
  write(sessionId: string, data: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      this.logger.warn(`No terminal buffer for session ${sessionId}`);
      return;
    }

    session.terminal.write(data);
  }

  /**
   * Get the current terminal buffer as a snapshot
   * Only returns data if the buffer has changed since last sync
   */
  getSnapshot(sessionId: string, force = false): TerminalBufferSnapshot | null {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return null;
    }

    const buffer = session.terminal.buffer.active;
    const lines: string[] = [];

    // Get all lines from the buffer (including scrollback)
    const totalRows = buffer.length;
    for (let i = 0; i < totalRows; i++) {
      const line = buffer.getLine(i);
      if (line) {
        lines.push(line.translateToString(true));
      }
    }

    // Create a hash of the current state to detect changes
    const currentBuffer = lines.join('\n');

    // Only return if buffer has changed or forced
    if (!force && currentBuffer === session.lastSentBuffer) {
      return null;
    }

    session.lastSentBuffer = currentBuffer;

    return {
      lines,
      cursorX: buffer.cursorX,
      cursorY: buffer.cursorY,
      cols: session.terminal.cols,
      rows: session.terminal.rows,
    };
  }

  /**
   * Get a snapshot with throttling - calls callback when ready
   * This prevents sending too many updates too quickly
   */
  getSnapshotThrottled(
    sessionId: string,
    callback: (snapshot: TerminalBufferSnapshot) => void,
  ): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return;
    }

    const now = Date.now();
    const timeSinceLastSync = now - session.lastSyncTime;

    // If we've waited long enough, send immediately
    if (timeSinceLastSync >= this.SYNC_THROTTLE_MS) {
      const snapshot = this.getSnapshot(sessionId);
      if (snapshot) {
        session.lastSyncTime = now;
        callback(snapshot);
      }
      return;
    }

    // Otherwise, schedule a sync for later (debounce)
    if (session.pendingSync) {
      clearTimeout(session.pendingSync);
    }

    session.pendingSync = setTimeout(() => {
      session.pendingSync = null;
      const snapshot = this.getSnapshot(sessionId);
      if (snapshot) {
        session.lastSyncTime = Date.now();
        callback(snapshot);
      }
    }, this.SYNC_THROTTLE_MS - timeSinceLastSync);
  }

  /**
   * Resize the terminal buffer
   */
  resize(sessionId: string, cols: number, rows: number): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return;
    }

    session.terminal.resize(cols, rows);
    this.logger.log(`Resized terminal buffer for session ${sessionId} to ${cols}x${rows}`);
  }

  /**
   * Clear the terminal buffer
   */
  clear(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return;
    }

    session.terminal.clear();
    session.lastSentBuffer = '';
  }

  /**
   * Destroy the terminal buffer for a session
   */
  destroyBuffer(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      if (session.pendingSync) {
        clearTimeout(session.pendingSync);
      }
      session.terminal.dispose();
      this.sessions.delete(sessionId);
      this.logger.log(`Destroyed terminal buffer for session ${sessionId}`);
    }
  }

  /**
   * Check if a buffer exists for a session
   */
  hasBuffer(sessionId: string): boolean {
    return this.sessions.has(sessionId);
  }
}
