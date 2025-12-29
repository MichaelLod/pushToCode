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
  ansiContent?: string;  // Full ANSI-formatted content with colors preserved
}

@Injectable()
export class TerminalBufferService {
  private readonly logger = new Logger(TerminalBufferService.name);
  private sessions: Map<string, TerminalSession> = new Map();

  // Minimum time between buffer syncs (ms)
  private readonly SYNC_THROTTLE_MS = 50;

  // Standard 256-color palette for xterm (first 16 colors)
  private readonly ANSI_COLORS: Record<number, string> = {
    0: '30', 1: '31', 2: '32', 3: '33', 4: '34', 5: '35', 6: '36', 7: '37',
    8: '90', 9: '91', 10: '92', 11: '93', 12: '94', 13: '95', 14: '96', 15: '97',
  };

  /**
   * Convert cell attributes to ANSI escape sequence
   */
  private cellToAnsi(
    cell: any,
    prevFg: number,
    prevBg: number,
    prevBold: boolean,
    prevDim: boolean,
    prevItalic: boolean,
    prevUnderline: boolean,
  ): { ansi: string; fg: number; bg: number; bold: boolean; dim: boolean; italic: boolean; underline: boolean } {
    const fg = cell.getFgColorMode() !== 0 ? cell.getFgColor() : -1;
    const bg = cell.getBgColorMode() !== 0 ? cell.getBgColor() : -1;
    const bold = cell.isBold() === 1;
    const dim = cell.isDim() === 1;
    const italic = cell.isItalic() === 1;
    const underline = cell.isUnderline() === 1;

    // Check if attributes changed
    const changed = fg !== prevFg || bg !== prevBg || bold !== prevBold ||
                    dim !== prevDim || italic !== prevItalic || underline !== prevUnderline;

    if (!changed) {
      return { ansi: '', fg, bg, bold, dim, italic, underline };
    }

    // Build SGR (Select Graphic Rendition) sequence
    const codes: string[] = [];

    // Reset if we're going from styled to unstyled, or changing styles
    if (fg === -1 && bg === -1 && !bold && !dim && !italic && !underline) {
      return { ansi: '\x1b[0m', fg, bg, bold, dim, italic, underline };
    }

    // Start fresh with reset if significant changes
    if ((prevFg !== -1 && fg === -1) || (prevBg !== -1 && bg === -1) ||
        (prevBold && !bold) || (prevDim && !dim) || (prevItalic && !italic) || (prevUnderline && !underline)) {
      codes.push('0');
    }

    // Add attributes
    if (bold) codes.push('1');
    if (dim) codes.push('2');
    if (italic) codes.push('3');
    if (underline) codes.push('4');

    // Foreground color
    if (fg !== -1) {
      if (fg < 16) {
        codes.push(this.ANSI_COLORS[fg] || '37');
      } else if (fg < 256) {
        codes.push(`38;5;${fg}`);
      }
    }

    // Background color
    if (bg !== -1) {
      if (bg < 16) {
        codes.push(bg < 8 ? `${40 + bg}` : `${100 + bg - 8}`);
      } else if (bg < 256) {
        codes.push(`48;5;${bg}`);
      }
    }

    const ansi = codes.length > 0 ? `\x1b[${codes.join(';')}m` : '';
    return { ansi, fg, bg, bold, dim, italic, underline };
  }

  /**
   * Serialize buffer to ANSI-formatted string with colors preserved
   */
  private serializeBufferToAnsi(terminal: Terminal): string {
    const buffer = terminal.buffer.active;
    const lines: string[] = [];

    let prevFg = -1, prevBg = -1;
    let prevBold = false, prevDim = false, prevItalic = false, prevUnderline = false;

    for (let y = 0; y < buffer.length; y++) {
      const line = buffer.getLine(y);
      if (!line) continue;

      let lineContent = '';
      let lastNonSpace = -1;

      // First pass: find last non-space character
      for (let x = 0; x < line.length; x++) {
        const cell = line.getCell(x);
        if (cell) {
          const char = cell.getChars();
          if (char && char !== ' ' && char.trim() !== '') {
            lastNonSpace = x;
          }
        }
      }

      // Second pass: build ANSI string up to last non-space
      for (let x = 0; x <= lastNonSpace; x++) {
        const cell = line.getCell(x);
        if (!cell) continue;

        const result = this.cellToAnsi(cell, prevFg, prevBg, prevBold, prevDim, prevItalic, prevUnderline);
        lineContent += result.ansi;
        prevFg = result.fg;
        prevBg = result.bg;
        prevBold = result.bold;
        prevDim = result.dim;
        prevItalic = result.italic;
        prevUnderline = result.underline;

        lineContent += cell.getChars() || ' ';
      }

      // Reset at end of line if we have active styling
      if (prevFg !== -1 || prevBg !== -1 || prevBold || prevDim || prevItalic || prevUnderline) {
        lineContent += '\x1b[0m';
        prevFg = -1; prevBg = -1;
        prevBold = false; prevDim = false; prevItalic = false; prevUnderline = false;
      }

      lines.push(lineContent);
    }

    // Trim trailing empty lines
    while (lines.length > 0 && lines[lines.length - 1] === '') {
      lines.pop();
    }

    return lines.join('\n');
  }

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

    // Serialize with ANSI codes to preserve colors
    const ansiContent = this.serializeBufferToAnsi(session.terminal);

    return {
      lines,
      cursorX: buffer.cursorX,
      cursorY: buffer.cursorY,
      cols: session.terminal.cols,
      rows: session.terminal.rows,
      ansiContent,
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
