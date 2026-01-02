"use client";

/**
 * VoiceMode - Main container for voice-first interaction
 * Orchestrates recording, processing, playback, and option selection
 */

import { useCallback, useEffect, useMemo } from "react";
import { useVoiceMode, VoiceSessionState } from "@/hooks/useVoiceMode";
import { useAudioPlayer, AudioPlayer } from "./AudioPlayer";
import { VoiceWaveform, WaveformMode } from "./VoiceWaveform";
import { OptionCards } from "./OptionCards";

export interface VoiceModeProps {
  serverUrl: string;
  apiKey?: string;
  sessionId: string;
  repoPath?: string;
}

export function VoiceMode({ serverUrl, apiKey, sessionId, repoPath }: VoiceModeProps) {
  // Audio player for TTS
  const audioPlayer = useAudioPlayer({
    onPlaybackEnd: () => {
      // Will be handled by voice mode
    },
  });

  // Voice mode state and actions
  const {
    sessionState,
    connectionStatus,
    isConnected,
    lastResponseText,
    currentOptions,
    error,
    audioData,
    recordingDuration,
    startListening,
    stopListening,
    cancelListening,
    selectOption,
    clearError,
  } = useVoiceMode({
    serverUrl,
    apiKey,
    sessionId,
    repoPath,
    onAudioChunk: (audio, isFinal) => {
      audioPlayer.queueAudio(audio, isFinal);
    },
  });

  // Map session state to waveform mode
  const waveformMode: WaveformMode = useMemo(() => {
    if (audioPlayer.isPlaying) return "playing";
    switch (sessionState) {
      case "listening":
        return "recording";
      case "processing":
        return "processing";
      case "speaking":
        return "playing";
      default:
        return "idle";
    }
  }, [sessionState, audioPlayer.isPlaying]);

  // Handle microphone button press
  const handleMicPress = useCallback(async () => {
    if (sessionState === "listening") {
      await stopListening();
    } else if (sessionState === "idle") {
      await startListening();
    }
  }, [sessionState, startListening, stopListening]);

  // Handle cancel
  const handleCancel = useCallback(() => {
    if (sessionState === "listening") {
      cancelListening();
    }
    audioPlayer.stop();
  }, [sessionState, cancelListening, audioPlayer]);

  // Format recording duration
  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  // Get status text
  const statusText = useMemo(() => {
    if (!isConnected) return "Connecting...";
    if (audioPlayer.isPlaying) return "Speaking...";
    switch (sessionState) {
      case "listening":
        return "Listening...";
      case "processing":
        return "Processing...";
      case "speaking":
        return "Speaking...";
      default:
        return "Tap to speak";
    }
  }, [sessionState, isConnected, audioPlayer.isPlaying]);

  // Get microphone button state
  const micButtonState = useMemo(() => {
    if (sessionState === "listening") {
      return {
        className: "bg-error",
        icon: "stop",
        disabled: false,
      };
    }
    if (sessionState === "processing" || audioPlayer.isPlaying) {
      return {
        className: "bg-border",
        icon: "mic",
        disabled: true,
      };
    }
    return {
      className: "bg-accent",
      icon: "mic",
      disabled: !isConnected,
    };
  }, [sessionState, isConnected, audioPlayer.isPlaying]);

  // Clear error after 5 seconds
  useEffect(() => {
    if (error) {
      const timer = setTimeout(clearError, 5000);
      return () => clearTimeout(timer);
    }
  }, [error, clearError]);

  return (
    <div className="flex flex-1 flex-col bg-bg-primary">
      {/* Connection status indicator */}
      <div className="px-4 py-2 border-b border-border">
        <div className="flex items-center gap-2">
          <div
            className={`w-2 h-2 rounded-full ${
              connectionStatus === "connected"
                ? "bg-success"
                : connectionStatus === "connecting"
                ? "bg-warning animate-pulse"
                : "bg-error"
            }`}
          />
          <span className="text-sm text-text-secondary">
            {connectionStatus === "connected"
              ? "Connected"
              : connectionStatus === "connecting"
              ? "Connecting..."
              : "Disconnected"}
          </span>
        </div>
      </div>

      {/* Main content area */}
      <div className="flex-1 flex flex-col overflow-auto">
        {/* Last response text */}
        {lastResponseText && (
          <div className="px-4 py-6">
            <div className="max-w-2xl mx-auto">
              <p className="text-lg text-text-primary leading-relaxed">
                {lastResponseText}
              </p>
            </div>
          </div>
        )}

        {/* Option cards */}
        {currentOptions.length > 0 && (
          <div className="max-w-2xl mx-auto w-full">
            <OptionCards
              options={currentOptions}
              onSelect={selectOption}
              disabled={sessionState !== "idle" || audioPlayer.isPlaying}
            />
          </div>
        )}

        {/* Spacer */}
        <div className="flex-1" />
      </div>

      {/* Error message */}
      {error && (
        <div className="px-4 pb-2">
          <div className="max-w-2xl mx-auto px-4 py-2 bg-error/20 border border-error rounded-lg">
            <p className="text-error text-sm">{error}</p>
          </div>
        </div>
      )}

      {/* Audio playback indicator */}
      {audioPlayer.isPlaying && (
        <div className="px-4 pb-2">
          <div className="max-w-2xl mx-auto">
            <AudioPlayer isPlaying={audioPlayer.isPlaying} />
          </div>
        </div>
      )}

      {/* Waveform visualization */}
      <div className="px-4 pb-4">
        <div className="max-w-2xl mx-auto h-24 bg-bg-secondary rounded-xl overflow-hidden">
          <VoiceWaveform
            mode={waveformMode}
            audioData={audioData}
            className="h-full"
          />
        </div>
      </div>

      {/* Control area */}
      <div className="px-4 pb-safe border-t border-border bg-bg-secondary">
        <div className="max-w-2xl mx-auto py-6">
          {/* Status text and duration */}
          <div className="text-center mb-4">
            <p className="text-text-secondary">{statusText}</p>
            {sessionState === "listening" && (
              <p className="text-lg font-mono text-text-primary mt-1">
                {formatDuration(recordingDuration)}
              </p>
            )}
          </div>

          {/* Control buttons */}
          <div className="flex items-center justify-center gap-4">
            {/* Cancel button - shown when listening */}
            {sessionState === "listening" && (
              <button
                onClick={handleCancel}
                className="min-h-[48px] min-w-[48px] px-4 py-3 rounded-full
                         bg-bg-primary text-text-secondary font-medium
                         hover:bg-border transition-colors
                         focus:outline-none focus:ring-2 focus:ring-border"
                aria-label="Cancel"
              >
                Cancel
              </button>
            )}

            {/* Main microphone button */}
            <button
              onClick={handleMicPress}
              disabled={micButtonState.disabled}
              className={`min-h-[80px] min-w-[80px] rounded-full
                       ${micButtonState.className}
                       flex items-center justify-center
                       shadow-lg hover:opacity-90 active:scale-95
                       disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100
                       transition-all duration-150
                       focus:outline-none focus:ring-4 focus:ring-accent/30`}
              aria-label={sessionState === "listening" ? "Stop recording" : "Start recording"}
            >
              {micButtonState.icon === "stop" ? (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="32"
                  height="32"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  className="text-white"
                >
                  <rect x="6" y="6" width="12" height="12" rx="2" />
                </svg>
              ) : (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="32"
                  height="32"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-white"
                >
                  <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                  <line x1="12" x2="12" y1="19" y2="22" />
                </svg>
              )}
            </button>

            {/* Stop playback button - shown when playing */}
            {audioPlayer.isPlaying && (
              <button
                onClick={() => audioPlayer.stop()}
                className="min-h-[48px] min-w-[48px] px-4 py-3 rounded-full
                         bg-bg-primary text-text-secondary font-medium
                         hover:bg-border transition-colors
                         focus:outline-none focus:ring-2 focus:ring-border"
                aria-label="Stop playback"
              >
                Stop
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default VoiceMode;
