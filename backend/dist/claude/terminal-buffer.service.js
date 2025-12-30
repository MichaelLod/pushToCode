"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var TerminalBufferService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.TerminalBufferService = void 0;
const common_1 = require("@nestjs/common");
const headless_1 = require("@xterm/headless");
let TerminalBufferService = TerminalBufferService_1 = class TerminalBufferService {
    logger = new common_1.Logger(TerminalBufferService_1.name);
    sessions = new Map();
    SYNC_THROTTLE_MS = 50;
    ANSI_COLORS = {
        0: '30', 1: '31', 2: '32', 3: '33', 4: '34', 5: '35', 6: '36', 7: '37',
        8: '90', 9: '91', 10: '92', 11: '93', 12: '94', 13: '95', 14: '96', 15: '97',
    };
    cellToAnsi(cell, prevFg, prevBg, prevBold, prevDim, prevItalic, prevUnderline) {
        const fg = cell.getFgColorMode() !== 0 ? cell.getFgColor() : -1;
        const bg = cell.getBgColorMode() !== 0 ? cell.getBgColor() : -1;
        const bold = cell.isBold() === 1;
        const dim = cell.isDim() === 1;
        const italic = cell.isItalic() === 1;
        const underline = cell.isUnderline() === 1;
        const changed = fg !== prevFg || bg !== prevBg || bold !== prevBold ||
            dim !== prevDim || italic !== prevItalic || underline !== prevUnderline;
        if (!changed) {
            return { ansi: '', fg, bg, bold, dim, italic, underline };
        }
        const codes = [];
        if (fg === -1 && bg === -1 && !bold && !dim && !italic && !underline) {
            return { ansi: '\x1b[0m', fg, bg, bold, dim, italic, underline };
        }
        if ((prevFg !== -1 && fg === -1) || (prevBg !== -1 && bg === -1) ||
            (prevBold && !bold) || (prevDim && !dim) || (prevItalic && !italic) || (prevUnderline && !underline)) {
            codes.push('0');
        }
        if (bold)
            codes.push('1');
        if (dim)
            codes.push('2');
        if (italic)
            codes.push('3');
        if (underline)
            codes.push('4');
        if (fg !== -1) {
            if (fg < 16) {
                codes.push(this.ANSI_COLORS[fg] || '37');
            }
            else if (fg < 256) {
                codes.push(`38;5;${fg}`);
            }
        }
        if (bg !== -1) {
            if (bg < 16) {
                codes.push(bg < 8 ? `${40 + bg}` : `${100 + bg - 8}`);
            }
            else if (bg < 256) {
                codes.push(`48;5;${bg}`);
            }
        }
        const ansi = codes.length > 0 ? `\x1b[${codes.join(';')}m` : '';
        return { ansi, fg, bg, bold, dim, italic, underline };
    }
    serializeBufferToAnsi(terminal) {
        const buffer = terminal.buffer.active;
        const lines = [];
        let prevFg = -1, prevBg = -1;
        let prevBold = false, prevDim = false, prevItalic = false, prevUnderline = false;
        for (let y = 0; y < buffer.length; y++) {
            const line = buffer.getLine(y);
            if (!line)
                continue;
            let lineContent = '';
            let lastNonSpace = -1;
            for (let x = 0; x < line.length; x++) {
                const cell = line.getCell(x);
                if (cell) {
                    const char = cell.getChars();
                    if (char && char !== ' ' && char.trim() !== '') {
                        lastNonSpace = x;
                    }
                }
            }
            for (let x = 0; x <= lastNonSpace; x++) {
                const cell = line.getCell(x);
                if (!cell)
                    continue;
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
            if (prevFg !== -1 || prevBg !== -1 || prevBold || prevDim || prevItalic || prevUnderline) {
                lineContent += '\x1b[0m';
                prevFg = -1;
                prevBg = -1;
                prevBold = false;
                prevDim = false;
                prevItalic = false;
                prevUnderline = false;
            }
            lines.push(lineContent);
        }
        while (lines.length > 0 && lines[lines.length - 1] === '') {
            lines.pop();
        }
        return lines.join('\n');
    }
    createBuffer(sessionId, cols = 120, rows = 30) {
        this.destroyBuffer(sessionId);
        const terminal = new headless_1.Terminal({
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
    write(sessionId, data) {
        const session = this.sessions.get(sessionId);
        if (!session) {
            this.logger.warn(`No terminal buffer for session ${sessionId}`);
            return;
        }
        session.terminal.write(data);
    }
    getSnapshot(sessionId, force = false) {
        const session = this.sessions.get(sessionId);
        if (!session) {
            return null;
        }
        const buffer = session.terminal.buffer.active;
        const lines = [];
        const totalRows = buffer.length;
        for (let i = 0; i < totalRows; i++) {
            const line = buffer.getLine(i);
            if (line) {
                lines.push(line.translateToString(true));
            }
        }
        const currentBuffer = lines.join('\n');
        if (!force && currentBuffer === session.lastSentBuffer) {
            return null;
        }
        session.lastSentBuffer = currentBuffer;
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
    getSnapshotThrottled(sessionId, callback) {
        const session = this.sessions.get(sessionId);
        if (!session) {
            return;
        }
        const now = Date.now();
        const timeSinceLastSync = now - session.lastSyncTime;
        if (timeSinceLastSync >= this.SYNC_THROTTLE_MS) {
            const snapshot = this.getSnapshot(sessionId);
            if (snapshot) {
                session.lastSyncTime = now;
                callback(snapshot);
            }
            return;
        }
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
    resize(sessionId, cols, rows) {
        const session = this.sessions.get(sessionId);
        if (!session) {
            return;
        }
        session.terminal.resize(cols, rows);
        this.logger.log(`Resized terminal buffer for session ${sessionId} to ${cols}x${rows}`);
    }
    clear(sessionId) {
        const session = this.sessions.get(sessionId);
        if (!session) {
            return;
        }
        session.terminal.clear();
        session.lastSentBuffer = '';
    }
    destroyBuffer(sessionId) {
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
    hasBuffer(sessionId) {
        return this.sessions.has(sessionId);
    }
};
exports.TerminalBufferService = TerminalBufferService;
exports.TerminalBufferService = TerminalBufferService = TerminalBufferService_1 = __decorate([
    (0, common_1.Injectable)()
], TerminalBufferService);
//# sourceMappingURL=terminal-buffer.service.js.map