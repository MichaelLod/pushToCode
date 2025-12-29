/**
 * useTerminal hook - Manages xterm.js terminal instance
 */

import { useEffect, useRef, useCallback, useState } from "react";
import { Terminal, ITerminalOptions } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";

export interface UseTerminalOptions {
  sessionId: string;
  onInput?: (data: string) => void;
  onResize?: (cols: number, rows: number) => void;
  fontSize?: number;
  fontFamily?: string;
}

export interface UseTerminalReturn {
  terminalRef: React.RefObject<HTMLDivElement | null>;
  terminal: Terminal | null;
  isReady: boolean;
  write: (data: string) => void;
  writeln: (data: string) => void;
  clear: () => void;
  focus: () => void;
  fit: () => void;
  getSize: () => { cols: number; rows: number } | null;
}

// Terminal theme matching design requirements
const TERMINAL_THEME = {
  background: "#1a1b26",
  foreground: "#c0caf5",
  cursor: "#c0caf5",
  cursorAccent: "#1a1b26",
  selectionBackground: "#33467c",
  selectionForeground: "#c0caf5",
  black: "#15161e",
  red: "#f7768e",
  green: "#9ece6a",
  yellow: "#e0af68",
  blue: "#7aa2f7",
  magenta: "#bb9af7",
  cyan: "#7dcfff",
  white: "#a9b1d6",
  brightBlack: "#414868",
  brightRed: "#f7768e",
  brightGreen: "#9ece6a",
  brightYellow: "#e0af68",
  brightBlue: "#7aa2f7",
  brightMagenta: "#bb9af7",
  brightCyan: "#7dcfff",
  brightWhite: "#c0caf5",
};

export function useTerminal(options: UseTerminalOptions): UseTerminalReturn {
  const { sessionId, onInput, onResize, fontSize = 14, fontFamily = "monospace" } = options;

  const terminalRef = useRef<HTMLDivElement | null>(null);
  const terminalInstanceRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const [isReady, setIsReady] = useState(false);

  // Store callbacks in refs to avoid re-creating terminal on callback changes
  const onInputRef = useRef(onInput);
  const onResizeRef = useRef(onResize);
  // eslint-disable-next-line react-hooks/refs -- Keep refs in sync with latest callbacks
  onInputRef.current = onInput;
  // eslint-disable-next-line react-hooks/refs -- Keep refs in sync with latest callbacks
  onResizeRef.current = onResize;

  // Initialize terminal
  useEffect(() => {
    if (!terminalRef.current) return;

    const terminalOptions: ITerminalOptions = {
      cursorBlink: true,
      cursorStyle: "block",
      fontSize,
      fontFamily,
      theme: TERMINAL_THEME,
      allowProposedApi: true,
      scrollback: 10000,
      convertEol: true,
      // Mobile-friendly settings
      scrollOnUserInput: true,
      macOptionIsMeta: true,
    };

    const terminal = new Terminal(terminalOptions);
    const fitAddon = new FitAddon();

    terminal.loadAddon(fitAddon);
    terminal.open(terminalRef.current);

    // Initial fit
    requestAnimationFrame(() => {
      try {
        fitAddon.fit();
      } catch (e) {
        console.warn("Initial fit failed:", e);
      }
    });

    // Handle input - send keystrokes
    const inputDisposable = terminal.onData((data) => {
      onInputRef.current?.(data);
    });

    // Handle resize
    const resizeDisposable = terminal.onResize(({ cols, rows }) => {
      onResizeRef.current?.(cols, rows);
    });

    terminalInstanceRef.current = terminal;
    fitAddonRef.current = fitAddon;
    setIsReady(true);

    // Handle window resize
    const handleResize = () => {
      requestAnimationFrame(() => {
        try {
          fitAddon.fit();
        } catch (e) {
          console.warn("Fit on resize failed:", e);
        }
      });
    };

    window.addEventListener("resize", handleResize);

    // Also observe container size changes
    const resizeObserver = new ResizeObserver(handleResize);
    if (terminalRef.current) {
      resizeObserver.observe(terminalRef.current);
    }

    return () => {
      inputDisposable.dispose();
      resizeDisposable.dispose();
      resizeObserver.disconnect();
      window.removeEventListener("resize", handleResize);
      terminal.dispose();
      terminalInstanceRef.current = null;
      fitAddonRef.current = null;
      setIsReady(false);
    };
  }, [sessionId, fontSize, fontFamily]);

  const write = useCallback((data: string) => {
    terminalInstanceRef.current?.write(data);
  }, []);

  const writeln = useCallback((data: string) => {
    terminalInstanceRef.current?.writeln(data);
  }, []);

  const clear = useCallback(() => {
    terminalInstanceRef.current?.clear();
  }, []);

  const focus = useCallback(() => {
    terminalInstanceRef.current?.focus();
  }, []);

  const fit = useCallback(() => {
    try {
      fitAddonRef.current?.fit();
    } catch (e) {
      console.warn("Fit failed:", e);
    }
  }, []);

  const getSize = useCallback((): { cols: number; rows: number } | null => {
    const terminal = terminalInstanceRef.current;
    if (!terminal) return null;
    return { cols: terminal.cols, rows: terminal.rows };
  }, []);

  /* eslint-disable react-hooks/refs -- Expose terminal instance for external use */
  return {
    terminalRef,
    terminal: terminalInstanceRef.current,
    isReady,
    write,
    writeln,
    clear,
    focus,
    fit,
    getSize,
  };
  /* eslint-enable react-hooks/refs */
}
