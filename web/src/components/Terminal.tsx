"use client";

/**
 * Terminal component - Renders xterm.js terminal with ANSI support
 */

import { useEffect, useRef, useCallback } from "react";
import { useTerminal } from "@/hooks/useTerminal";
import "@xterm/xterm/css/xterm.css";

export interface TerminalProps {
  sessionId: string;
  onInput?: (data: string) => void;
  onResize?: (cols: number, rows: number) => void;
  onReady?: (terminal: ReturnType<typeof useTerminal>) => void;
  fontSize?: number;
  fontFamily?: string;
  className?: string;
}

export function Terminal({
  sessionId,
  onInput,
  onResize,
  onReady,
  fontSize = 14,
  fontFamily = "monospace",
  className = "",
}: TerminalProps) {
  const terminal = useTerminal({
    sessionId,
    onInput,
    onResize,
    fontSize,
    fontFamily,
  });

  const onReadyRef = useRef(onReady);
  // eslint-disable-next-line react-hooks/refs -- Keep ref in sync with latest callback
  onReadyRef.current = onReady;

  // Notify parent when terminal is ready
  useEffect(() => {
    if (terminal.isReady) {
      onReadyRef.current?.(terminal);
    }
  }, [terminal.isReady, terminal]);

  // Focus terminal on click
  const handleClick = useCallback(() => {
    terminal.focus();
  }, [terminal]);

  // Handle touch for mobile
  const handleTouchStart = useCallback(() => {
    terminal.focus();
  }, [terminal]);

  return (
    <div
      className={`terminal-container ${className}`}
      onClick={handleClick}
      onTouchStart={handleTouchStart}
      style={{
        width: "100%",
        height: "100%",
        minHeight: 0,
        backgroundColor: "#1a1b26",
        // Mobile viewport handling
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      <div
        ref={terminal.terminalRef}
        style={{
          width: "100%",
          height: "100%",
          // Ensure terminal fills container
          overflow: "hidden",
        }}
      />
    </div>
  );
}

/**
 * TerminalController - Provides imperative access to terminal methods
 * Use with useImperativeHandle in parent component
 */
export interface TerminalController {
  write: (data: string) => void;
  writeln: (data: string) => void;
  clear: () => void;
  focus: () => void;
  fit: () => void;
  getSize: () => { cols: number; rows: number } | null;
}

export function createTerminalController(
  terminal: ReturnType<typeof useTerminal>
): TerminalController {
  return {
    write: terminal.write,
    writeln: terminal.writeln,
    clear: terminal.clear,
    focus: terminal.focus,
    fit: terminal.fit,
    getSize: terminal.getSize,
  };
}

export default Terminal;
