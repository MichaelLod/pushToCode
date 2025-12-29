"use client";

import { useCallback, useState, useRef } from "react";
import { FileUpload, FileAttachment } from "./FileUpload";
import { KeyboardControls } from "./KeyboardControls";
import { VoiceRecorder } from "./VoiceRecorder";

export interface InputBarProps {
  onSubmit: (text: string, attachments: FileAttachment[]) => void;
  onKeyPress?: (key: string) => void;
  disabled?: boolean;
  placeholder?: string;
  serverUrl?: string;
  apiKey?: string;
}

/**
 * Main input bar component
 * Layout: [KeyboardToggle] [TextField (auto-grow 1-5 lines)] [Mic] [Attach] [Send]
 */
export function InputBar({
  onSubmit,
  onKeyPress,
  disabled = false,
  placeholder = "Enter command...",
  serverUrl,
  apiKey,
}: InputBarProps) {
  const [text, setText] = useState("");
  const [attachments, setAttachments] = useState<FileAttachment[]>([]);
  const [showKeyboard, setShowKeyboard] = useState(false);
  const [showVoiceRecorder, setShowVoiceRecorder] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Handle submit
  const handleSubmit = useCallback(() => {
    const trimmedText = text.trim();
    if (!trimmedText && attachments.length === 0) return;

    onSubmit(trimmedText, attachments);
    setText("");
    setAttachments([]);
  }, [text, attachments, onSubmit]);

  // Handle keyboard control key press
  const handleKeyboardKeyPress = useCallback(
    (key: string) => {
      onKeyPress?.(key);
    },
    [onKeyPress]
  );

  // Handle voice transcription
  const handleTranscription = useCallback((transcribedText: string) => {
    setText((prev) => {
      const newText = prev ? `${prev} ${transcribedText}` : transcribedText;
      return newText;
    });
    // Focus input after transcription
    inputRef.current?.focus();
  }, []);

  // Check if send should be enabled
  const canSend = (text.trim().length > 0 || attachments.length > 0) && !disabled;

  return (
    <>
      <div className="border-t border-border bg-bg-primary px-3 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        {/* Keyboard controls row */}
        {showKeyboard && (
          <div className="mb-2 -mx-3 px-3 py-1.5 bg-bg-secondary border-b border-border">
            <KeyboardControls onKeyPress={handleKeyboardKeyPress} />
          </div>
        )}

        {/* Main input row */}
        <div className="flex items-center gap-1.5">
          {/* Text input - takes most space */}
          <input
            ref={inputRef}
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSubmit();
              }
            }}
            disabled={disabled}
            placeholder={placeholder}
            className="flex-1 min-w-0 h-9 rounded-lg bg-bg-secondary px-3 text-sm text-text-primary
                      placeholder:text-text-secondary focus:outline-none focus:ring-2 focus:ring-accent
                      disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Command input"
          />

          {/* Action buttons group - compact on mobile */}
          <div className="flex items-center gap-1 shrink-0">
            {/* Keyboard toggle button */}
            <button
              onClick={() => setShowKeyboard(!showKeyboard)}
              disabled={disabled}
              className={`w-9 h-9 flex items-center justify-center rounded-lg
                         transition-colors disabled:opacity-50 disabled:cursor-not-allowed
                         ${showKeyboard
                           ? "bg-accent text-bg-primary"
                           : "bg-bg-secondary text-text-secondary hover:text-text-primary hover:bg-border"
                         }`}
              aria-label={showKeyboard ? "Hide keyboard controls" : "Show keyboard controls"}
              aria-pressed={showKeyboard}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <rect x="2" y="6" width="20" height="12" rx="2" strokeWidth="1.5" />
                <path strokeWidth="1.5" d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M8 14h8" />
              </svg>
            </button>

            {/* Mic button - prominent */}
            <button
              onClick={() => setShowVoiceRecorder(true)}
              disabled={disabled}
              className="w-11 h-11 flex items-center justify-center rounded-full
                        bg-error text-white shadow-lg shadow-error/30
                        hover:bg-error/90 hover:scale-105 active:scale-95
                        transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Start voice recording"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
                />
              </svg>
            </button>

            {/* Attach button */}
            <FileUpload
              attachments={attachments}
              onAttachmentsChange={setAttachments}
            />

            {/* Send button */}
            <button
              onClick={handleSubmit}
              disabled={!canSend}
              className={`w-9 h-9 flex items-center justify-center rounded-lg
                        transition-all disabled:opacity-30 disabled:cursor-not-allowed
                        ${canSend
                          ? "bg-accent text-bg-primary hover:opacity-90"
                          : "bg-bg-secondary text-text-secondary"
                        }`}
              aria-label="Send message"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Voice recorder modal */}
      <VoiceRecorder
        isOpen={showVoiceRecorder}
        onClose={() => setShowVoiceRecorder(false)}
        onTranscription={handleTranscription}
        serverUrl={serverUrl}
        apiKey={apiKey}
      />
    </>
  );
}

export default InputBar;
