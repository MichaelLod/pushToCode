"use client";

import { useCallback } from "react";

export interface KeyboardControlsProps {
  isVisible: boolean;
  onToggle: () => void;
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
  { key: "Enter", label: "Enter", width: "wide" },
  { key: "ArrowUp", label: "\u2191" },
  { key: "ArrowDown", label: "\u2193" },
  { key: "ArrowLeft", label: "\u2190" },
  { key: "ArrowRight", label: "\u2192" },
  { key: "Control+c", label: "Ctrl+C", width: "wide" },
];

/**
 * Horizontal keyboard toolbar for essential terminal keys
 * Displayed above soft keyboard on mobile
 */
export function KeyboardControls({
  isVisible,
  onToggle,
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
    <div className="flex items-center">
      {/* Toggle button */}
      <button
        onClick={onToggle}
        className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg
                   bg-bg-secondary text-text-primary hover:bg-border transition-colors"
        aria-label={isVisible ? "Hide keyboard controls" : "Show keyboard controls"}
        aria-expanded={isVisible}
      >
        <svg
          className="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
          />
        </svg>
      </button>

      {/* Keyboard toolbar */}
      {isVisible && (
        <div
          className="flex items-center gap-1 ml-2 px-2 py-1 bg-bg-secondary rounded-lg overflow-x-auto"
          role="toolbar"
          aria-label="Keyboard controls"
        >
          {KEYBOARD_KEYS.map(({ key, label, width }) => (
            <button
              key={key}
              onClick={() => handleKeyClick(key)}
              className={`min-h-[44px] flex items-center justify-center rounded-lg
                         bg-bg-primary text-text-primary font-mono text-sm
                         hover:bg-border active:bg-accent active:text-bg-primary
                         transition-colors ${width === "wide" ? "min-w-[60px] px-2" : "min-w-[44px]"}`}
              aria-label={`Press ${label}`}
            >
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default KeyboardControls;
