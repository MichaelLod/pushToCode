"use client";

/**
 * useVoiceMode hook - Manages voice session state
 * Orchestrates recording, transcription, WebSocket communication, and audio playback
 */

import { useCallback, useState, useRef, useEffect } from "react";
import { useVoiceWebSocket, ConnectionStatus } from "./useVoiceWebSocket";
import { useVoiceRecorder } from "./useVoiceRecorder";
import {
  VoiceOption,
  VoiceServerMessage,
  isVoiceResponseMessage,
  isVoiceAudioMessage,
  isVoiceErrorMessage,
} from "@/types/voice";

export type VoiceSessionState = "idle" | "listening" | "processing" | "speaking";

export interface UseVoiceModeOptions {
  serverUrl: string;
  apiKey?: string;
  sessionId: string;
  onAudioChunk?: (audioData: string, isFinal: boolean) => void;
}

export interface UseVoiceModeReturn {
  // State
  sessionState: VoiceSessionState;
  connectionStatus: ConnectionStatus;
  isConnected: boolean;
  lastResponseText: string;
  currentOptions: VoiceOption[];
  error: string | null;
  audioData: Float32Array | null;
  recordingDuration: number;

  // Actions
  startListening: () => Promise<void>;
  stopListening: () => Promise<void>;
  cancelListening: () => void;
  selectOption: (optionId: string) => void;
  clearError: () => void;

  // Recorder refs
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
}

export function useVoiceMode(options: UseVoiceModeOptions): UseVoiceModeReturn {
  const { serverUrl, apiKey, sessionId, onAudioChunk } = options;

  // Session state
  const [sessionState, setSessionState] = useState<VoiceSessionState>("idle");
  const [lastResponseText, setLastResponseText] = useState("");
  const [currentOptions, setCurrentOptions] = useState<VoiceOption[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Refs to avoid stale closures
  const onAudioChunkRef = useRef(onAudioChunk);
  onAudioChunkRef.current = onAudioChunk;

  // Handle incoming WebSocket messages
  const handleMessage = useCallback((message: VoiceServerMessage) => {
    if (isVoiceResponseMessage(message)) {
      setLastResponseText(message.text);
      setCurrentOptions(message.options ?? []);
      // If there's no audio, go to idle; otherwise wait for audio
      if (!message.options?.length) {
        // Stay in speaking state if audio is coming
      }
    } else if (isVoiceAudioMessage(message)) {
      setSessionState("speaking");
      onAudioChunkRef.current?.(message.audio, message.isFinal);
      if (message.isFinal) {
        // Audio playback will set state back to idle when done
      }
    } else if (isVoiceErrorMessage(message)) {
      setError(message.message);
      setSessionState("idle");
    }
  }, []);

  // Handle WebSocket errors
  const handleError = useCallback((err: Event | Error) => {
    const errorMessage = err instanceof Error ? err.message : "Connection error";
    setError(errorMessage);
    setSessionState("idle");
  }, []);

  // WebSocket connection
  const {
    status: connectionStatus,
    isConnected,
    sendText,
    selectOption: wsSelectOption,
  } = useVoiceWebSocket({
    url: serverUrl,
    apiKey,
    sessionId,
    autoConnect: true,
    onMessage: handleMessage,
    onError: handleError,
  });

  // Voice recorder
  const {
    state: recorderState,
    startRecording,
    stopRecording,
    cancelRecording,
    canvasRef,
  } = useVoiceRecorder({
    serverUrl,
    apiKey,
  });

  // Start listening (recording)
  const startListening = useCallback(async () => {
    if (!isConnected) {
      setError("Not connected to server");
      return;
    }

    setError(null);
    setSessionState("listening");
    await startRecording();
  }, [isConnected, startRecording]);

  // Stop listening and send transcription
  const stopListening = useCallback(async () => {
    setSessionState("processing");
    const result = await stopRecording();

    if (result?.text) {
      sendText(result.text);
      // Stay in processing until we get a response
    } else {
      setError("Failed to transcribe audio");
      setSessionState("idle");
    }
  }, [stopRecording, sendText]);

  // Cancel listening without sending
  const cancelListeningHandler = useCallback(() => {
    cancelRecording();
    setSessionState("idle");
    setError(null);
  }, [cancelRecording]);

  // Select an option card
  const selectOptionHandler = useCallback((optionId: string) => {
    wsSelectOption(optionId);
    setCurrentOptions([]);
    setSessionState("processing");
  }, [wsSelectOption]);

  // Clear error
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Sync recorder state with session state
  useEffect(() => {
    if (recorderState.isRecording && sessionState !== "listening") {
      setSessionState("listening");
    }
    if (recorderState.isTranscribing && sessionState !== "processing") {
      setSessionState("processing");
    }
  }, [recorderState.isRecording, recorderState.isTranscribing, sessionState]);

  // Handle recorder errors
  useEffect(() => {
    if (recorderState.error) {
      setError(recorderState.error);
      setSessionState("idle");
    }
  }, [recorderState.error]);

  return {
    // State
    sessionState,
    connectionStatus,
    isConnected,
    lastResponseText,
    currentOptions,
    error,
    audioData: recorderState.audioData,
    recordingDuration: recorderState.duration,

    // Actions
    startListening,
    stopListening,
    cancelListening: cancelListeningHandler,
    selectOption: selectOptionHandler,
    clearError,

    // Recorder refs
    canvasRef,
  };
}
