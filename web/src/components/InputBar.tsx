"use client";

import { useCallback, useState } from "react";
import { FileUpload, FileAttachment } from "./FileUpload";
import { KeyboardControls } from "./KeyboardControls";
import { VoiceRecorder } from "./VoiceRecorder";

export interface InputBarProps {
  onKeyPress?: (key: string) => void;
  onTranscription?: (text: string) => void;
  onFileUpload?: (attachments: FileAttachment[]) => void;
  disabled?: boolean;
  serverUrl?: string;
  apiKey?: string;
  // Voice mode
  voiceMode?: boolean;
  onVoiceModeChange?: (enabled: boolean) => void;
  voiceQueueCount?: number;
  // Called when recording starts (to stop TTS)
  onRecordStart?: () => void;
}

/**
 * Floating toolbar with action buttons only (no text input)
 * Layout: [KeyboardToggle] [Mic] [Attach]
 */
export function InputBar({
  onKeyPress,
  onTranscription,
  onFileUpload,
  disabled = false,
  serverUrl,
  apiKey,
  voiceMode = false,
  onVoiceModeChange,
  voiceQueueCount = 0,
  onRecordStart,
}: InputBarProps) {
  const [attachments, setAttachments] = useState<FileAttachment[]>([]);
  const [showKeyboard, setShowKeyboard] = useState(false);
  const [showVoiceRecorder, setShowVoiceRecorder] = useState(false);

  // Handle keyboard control key press
  const handleKeyboardKeyPress = useCallback(
    (key: string) => {
      onKeyPress?.(key);
    },
    [onKeyPress]
  );

  // Handle voice transcription - send directly to terminal
  const handleTranscription = useCallback((transcribedText: string) => {
    onTranscription?.(transcribedText);
  }, [onTranscription]);

  // Handle attachments change
  const handleAttachmentsChange = useCallback((newAttachments: FileAttachment[]) => {
    setAttachments(newAttachments);
    if (newAttachments.length > 0) {
      onFileUpload?.(newAttachments);
      // Clear attachments after triggering upload
      setTimeout(() => setAttachments([]), 100);
    }
  }, [onFileUpload]);

  return (
    <>
      <div className="border-t border-border bg-bg-primary px-3 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        {/* Keyboard controls row */}
        {showKeyboard && (
          <div className="mb-2 -mx-3 px-3 py-1.5 bg-bg-secondary border-b border-border">
            <KeyboardControls onKeyPress={handleKeyboardKeyPress} />
          </div>
        )}

        {/* Action buttons - centered */}
        <div className="flex items-center justify-center gap-3">
          {/* Keyboard toggle button */}
          <button
            onClick={() => setShowKeyboard(!showKeyboard)}
            disabled={disabled}
            className={`w-11 h-11 flex items-center justify-center rounded-xl
                       transition-colors disabled:opacity-50 disabled:cursor-not-allowed
                       ${showKeyboard
                         ? "bg-accent text-bg-primary"
                         : "bg-bg-secondary text-text-secondary hover:text-text-primary hover:bg-border"
                       }`}
            aria-label={showKeyboard ? "Hide keyboard controls" : "Show keyboard controls"}
            aria-pressed={showKeyboard}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <rect x="2" y="6" width="20" height="12" rx="2" strokeWidth="1.5" />
              <path strokeWidth="1.5" d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M8 14h8" />
            </svg>
          </button>

          {/* Voice mode toggle button */}
          <button
            onClick={() => onVoiceModeChange?.(!voiceMode)}
            disabled={disabled}
            className={`w-11 h-11 flex items-center justify-center rounded-xl
                       transition-colors disabled:opacity-50 disabled:cursor-not-allowed
                       ${voiceMode
                         ? "bg-info text-bg-primary"
                         : "bg-bg-secondary text-text-secondary hover:text-text-primary hover:bg-border"
                       }`}
            aria-label={voiceMode ? "Disable voice mode" : "Enable voice mode"}
            aria-pressed={voiceMode}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
            </svg>
          </button>

          {/* Mic button - prominent with queue badge */}
          <div className="relative">
            <button
              onClick={() => {
                onRecordStart?.();
                setShowVoiceRecorder(true);
              }}
              disabled={disabled}
              className="w-14 h-14 flex items-center justify-center rounded-full
                        bg-error text-white shadow-lg shadow-error/30
                        hover:bg-error/90 hover:scale-105 active:scale-95
                        transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Start voice recording"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
                />
              </svg>
            </button>
            {/* Queue badge */}
            {voiceQueueCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-warning text-bg-primary text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                {voiceQueueCount}
              </span>
            )}
          </div>

          {/* Attach button */}
          <FileUpload
            attachments={attachments}
            onAttachmentsChange={handleAttachmentsChange}
          />
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
