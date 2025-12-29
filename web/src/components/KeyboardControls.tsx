"use client";

import { useCallback } from "react";

export interface KeyboardControlsProps {
  isVisible?: boolean;
  onToggle?: () => void;
  onKeyPress: (key: string) => void;
}

interface KeyButton {
  key: string;
  label: string;
  width?: "normal" | "wide";
}

// Map key names to terminal escape sequences
const KEY_SEQUENCES: Record<string, string> = {
  Escape: "\x1b",
  Tab: "\t",
  Enter: "\r",
  ArrowUp: "\x1b[A",
  ArrowDown: "\x1b[B",
  ArrowLeft: "\x1b[D",
  ArrowRight: "\x1b[C",
  "Control+c": "\x03",
};

const KEYBOARD_KEYS: KeyButton[] = [
  { key: "Escape", label: "Esc" },
  { key: "Tab", label: "Tab" },
  { key: "Enter", label: "Enter" },
  { key: "ArrowUp", label: "\u2191" },
  { key: "ArrowDown", label: "\u2193" },
  { key: "ArrowLeft", label: "\u2190" },
  { key: "ArrowRight", label: "\u2192" },
  { key: "Control+c", label: "^C" },
];

/**
 * Horizontal keyboard toolbar for essential terminal keys
 * Displayed above soft keyboard on mobile
 */
export function KeyboardControls({
  onKeyPress,
}: KeyboardControlsProps) {
  const handleKeyClick = useCallback(
    (key: string) => {
      // Translate key name to terminal escape sequence
      const sequence = KEY_SEQUENCES[key] || key;
      onKeyPress(sequence);
    },
    [onKeyPress]
  );

  return (
    <div
      className="flex items-center gap-1 overflow-x-auto"
      role="toolbar"
      aria-label="Keyboard controls"
    >
      {KEYBOARD_KEYS.map(({ key, label }) => (
        <button
          key={key}
          onClick={() => handleKeyClick(key)}
          className="h-8 px-3 flex items-center justify-center rounded-md
                     bg-bg-primary text-text-primary font-mono text-xs
                     hover:bg-border active:bg-accent active:text-bg-primary
                     transition-colors shrink-0"
          aria-label={`Press ${label}`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

export default KeyboardControls;
