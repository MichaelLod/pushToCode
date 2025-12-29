"use client";

import { useCallback, useEffect } from "react";
import { useVoiceRecorder, VoiceRecorderOptions } from "@/hooks/useVoiceRecorder";

export interface VoiceRecorderProps {
  isOpen: boolean;
  onClose: () => void;
  onTranscription: (text: string) => void;
  serverUrl?: string;
  apiKey?: string;
}

/**
 * Voice recorder component with bottom half-sheet modal
 * Features real-time waveform visualization using Web Audio
 */
export function VoiceRecorder({
  isOpen,
  onClose,
  onTranscription,
  serverUrl,
  apiKey,
}: VoiceRecorderProps) {
  const recorderOptions: VoiceRecorderOptions = { serverUrl, apiKey };
  const { state, startRecording, stopRecording, cancelRecording, canvasRef } =
    useVoiceRecorder(recorderOptions);

  const { isRecording, isTranscribing, duration, error } = state;

  // Auto-start recording when modal opens
  useEffect(() => {
    if (isOpen && !isRecording && !isTranscribing) {
      startRecording();
    }
  }, [isOpen, isRecording, isTranscribing, startRecording]);

  // Handle stop and transcribe
  const handleStop = useCallback(async () => {
    const result = await stopRecording();
    if (result?.text) {
      onTranscription(result.text);
    }
    onClose();
  }, [stopRecording, onTranscription, onClose]);

  // Handle cancel
  const handleCancel = useCallback(() => {
    cancelRecording();
    onClose();
  }, [cancelRecording, onClose]);

  // Format duration as MM:SS
  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-40 transition-opacity"
        onClick={handleCancel}
        aria-hidden="true"
      />

      {/* Half-sheet modal */}
      <div
        className="fixed bottom-0 left-0 right-0 z-50 bg-bg-secondary rounded-t-2xl shadow-lg transform transition-transform"
        style={{ maxHeight: "50vh" }}
        role="dialog"
        aria-modal="true"
        aria-label="Voice recorder"
      >
        {/* Handle bar */}
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-10 h-1 bg-border rounded-full" />
        </div>

        <div className="px-6 pb-safe">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-text-primary">
              {isTranscribing ? "Transcribing..." : "Recording"}
            </h2>
            <span className="text-2xl font-mono text-text-primary">
              {formatDuration(duration)}
            </span>
          </div>

          {/* Error message */}
          {error && (
            <div className="mb-4 px-4 py-2 bg-error/20 border border-error rounded-lg">
              <p className="text-error text-sm">{error}</p>
            </div>
          )}

          {/* Waveform visualization */}
          <div className="mb-6 bg-bg-primary rounded-xl overflow-hidden">
            <canvas
              ref={canvasRef}
              className="w-full h-24"
              width={800}
              height={96}
              aria-label="Audio waveform"
            />
          </div>

          {/* Status indicator */}
          <div className="flex justify-center mb-6">
            {isRecording && (
              <div className="flex items-center gap-2">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-error opacity-75" />
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-error" />
                </span>
                <span className="text-text-secondary text-sm">Recording...</span>
              </div>
            )}
            {isTranscribing && (
              <div className="flex items-center gap-2">
                <div className="animate-spin h-4 w-4 border-2 border-info border-t-transparent rounded-full" />
                <span className="text-text-secondary text-sm">
                  Processing audio...
                </span>
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex gap-4 pb-6">
            <button
              onClick={handleCancel}
              disabled={isTranscribing}
              className="flex-1 min-h-[44px] px-6 py-3 rounded-xl bg-bg-primary text-text-primary font-medium
                       hover:bg-border transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Cancel recording"
            >
              Cancel
            </button>
            <button
              onClick={handleStop}
              disabled={!isRecording || isTranscribing}
              className="flex-1 min-h-[44px] px-6 py-3 rounded-xl bg-info text-bg-primary font-medium
                       hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Stop and send"
            >
              {isTranscribing ? "Processing..." : "Stop & Send"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

export default VoiceRecorder;
