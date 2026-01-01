"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getApiClient, TranscribeResponse } from "@/lib/api";

export interface VoiceRecorderState {
  isRecording: boolean;
  isTranscribing: boolean;
  duration: number;
  error: string | null;
  audioData: Float32Array | null;
}

export interface VoiceRecorderOptions {
  serverUrl?: string;
  apiKey?: string;
}

export interface UseVoiceRecorderResult {
  state: VoiceRecorderState;
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<TranscribeResponse | null>;
  cancelRecording: () => void;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  // TTS playback
  playTTS: (text: string) => Promise<void>;
  stopTTS: () => void;
  isTTSPlaying: boolean;
}

/**
 * Get the best supported audio mimeType for the current browser
 */
function getSupportedMimeType(): string {
  const mimeTypes = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/ogg;codecs=opus",
    "audio/wav",
    "", // Empty string = browser default
  ];

  for (const mimeType of mimeTypes) {
    if (mimeType === "" || MediaRecorder.isTypeSupported(mimeType)) {
      return mimeType;
    }
  }

  return "";
}

/**
 * Hook for voice recording with Web Audio waveform visualization
 * Uses MediaRecorder API with browser-compatible audio format
 */
export function useVoiceRecorder(options?: VoiceRecorderOptions): UseVoiceRecorderResult {
  const [state, setState] = useState<VoiceRecorderState>({
    isRecording: false,
    isTranscribing: false,
    duration: 0,
    error: null,
    audioData: null,
  });

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const animationFrameRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);
  const durationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawWaveformRef = useRef<() => void>(() => {});

  // Cleanup function
  const cleanup = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (audioContextRef.current && audioContextRef.current.state !== "closed") {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    analyserRef.current = null;
    mediaRecorderRef.current = null;
    chunksRef.current = [];
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  // Draw waveform visualization - use ref to avoid circular dependency
  useEffect(() => {
    drawWaveformRef.current = () => {
      const canvas = canvasRef.current;
      const analyser = analyserRef.current;

      if (!canvas || !analyser) return;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Float32Array(bufferLength);
      analyser.getFloatTimeDomainData(dataArray);

      // Update state with audio data for external visualization if needed
      setState((prev) => ({ ...prev, audioData: dataArray.slice() }));

      // Clear canvas
      ctx.fillStyle = "#24283b";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw waveform
      ctx.lineWidth = 2;
      ctx.strokeStyle = "#7aa2f7";
      ctx.beginPath();

      const sliceWidth = canvas.width / bufferLength;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const v = dataArray[i];
        const y = ((v + 1) / 2) * canvas.height;

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }

        x += sliceWidth;
      }

      ctx.lineTo(canvas.width, canvas.height / 2);
      ctx.stroke();

      // Continue animation if recording
      if (mediaRecorderRef.current?.state === "recording") {
        animationFrameRef.current = requestAnimationFrame(drawWaveformRef.current);
      }
    };
  }, []);

  const startRecording = useCallback(async () => {
    try {
      cleanup();
      setState({
        isRecording: false,
        isTranscribing: false,
        duration: 0,
        error: null,
        audioData: null,
      });

      // Request microphone access - use simple constraints for better mobile compatibility
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });
      streamRef.current = stream;

      // Set up Web Audio for visualization
      // Use webkitAudioContext for older Safari
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const audioContext = new AudioContextClass();
      audioContextRef.current = audioContext;

      // Resume audio context if suspended (required for mobile browsers)
      if (audioContext.state === "suspended") {
        await audioContext.resume();
      }

      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.8;
      source.connect(analyser);
      analyserRef.current = analyser;

      // Set up MediaRecorder with browser-compatible mimeType
      const mimeType = getSupportedMimeType();
      const recorderOptions: MediaRecorderOptions = {};
      if (mimeType) {
        recorderOptions.mimeType = mimeType;
      }

      const mediaRecorder = new MediaRecorder(stream, recorderOptions);
      mediaRecorderRef.current = mediaRecorder;

      console.log("[VoiceRecorder] Using mimeType:", mimeType || "browser default");

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onerror = () => {
        setState((prev) => ({
          ...prev,
          error: "Recording error occurred",
          isRecording: false,
        }));
        cleanup();
      };

      // Start recording
      chunksRef.current = [];
      mediaRecorder.start(100); // Collect data every 100ms
      startTimeRef.current = Date.now();

      // Start duration counter
      durationIntervalRef.current = setInterval(() => {
        setState((prev) => ({
          ...prev,
          duration: Math.floor((Date.now() - startTimeRef.current) / 1000),
        }));
      }, 1000);

      setState((prev) => ({ ...prev, isRecording: true, error: null }));

      // Start waveform visualization
      animationFrameRef.current = requestAnimationFrame(drawWaveformRef.current);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to start recording";
      setState((prev) => ({
        ...prev,
        error: errorMessage,
        isRecording: false,
      }));
      cleanup();
    }
  }, [cleanup]);

  const stopRecording = useCallback(async (): Promise<TranscribeResponse | null> => {
    return new Promise((resolve) => {
      const mediaRecorder = mediaRecorderRef.current;

      if (!mediaRecorder || mediaRecorder.state !== "recording") {
        cleanup();
        resolve(null);
        return;
      }

      // Store mimeType for blob creation
      const recorderMimeType = mediaRecorder.mimeType || "audio/webm";

      mediaRecorder.onstop = async () => {
        setState((prev) => ({
          ...prev,
          isRecording: false,
          isTranscribing: true,
        }));

        try {
          const audioBlob = new Blob(chunksRef.current, { type: recorderMimeType });
          console.log("[VoiceRecorder] Created blob:", recorderMimeType, audioBlob.size, "bytes");

          // Determine file extension from mimeType
          const extMap: Record<string, string> = {
            "audio/webm": "webm",
            "audio/webm;codecs=opus": "webm",
            "audio/mp4": "m4a",
            "audio/ogg": "ogg",
            "audio/ogg;codecs=opus": "ogg",
            "audio/wav": "wav",
            "audio/x-wav": "wav",
          };
          const ext = extMap[recorderMimeType] || "webm";
          const filename = `audio.${ext}`;

          // Convert WebSocket URL to HTTP for API calls
          let baseUrl = options?.serverUrl || process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
          if (baseUrl.startsWith("ws://")) {
            baseUrl = baseUrl.replace("ws://", "http://");
          } else if (baseUrl.startsWith("wss://")) {
            baseUrl = baseUrl.replace("wss://", "https://");
          }
          console.log("[VoiceRecorder] Transcribing to:", baseUrl);
          const apiClient = getApiClient({ baseUrl, apiKey: options?.apiKey });
          const response = await apiClient.transcribe(audioBlob, filename);
          console.log("[VoiceRecorder] Transcription response:", response);

          setState((prev) => ({
            ...prev,
            isTranscribing: false,
            error: null,
          }));

          cleanup();
          resolve(response);
        } catch (err) {
          console.error("[VoiceRecorder] Transcription error:", err);
          const errorMessage =
            err instanceof Error ? err.message : "Transcription failed";
          setState((prev) => ({
            ...prev,
            isTranscribing: false,
            error: errorMessage,
          }));
          cleanup();
          resolve(null);
        }
      };

      mediaRecorder.stop();
    });
  }, [cleanup]);

  const cancelRecording = useCallback(() => {
    const mediaRecorder = mediaRecorderRef.current;
    if (mediaRecorder && mediaRecorder.state === "recording") {
      mediaRecorder.stop();
    }
    cleanup();
    setState({
      isRecording: false,
      isTranscribing: false,
      duration: 0,
      error: null,
      audioData: null,
    });
  }, [cleanup]);

  // TTS playback state and refs
  const [isTTSPlaying, setIsTTSPlaying] = useState(false);
  const ttsAudioRef = useRef<HTMLAudioElement | null>(null);
  const ttsQueueRef = useRef<string[]>([]);
  const isProcessingTTSRef = useRef(false);

  // Process TTS queue
  const processTTSQueue = useCallback(async () => {
    if (isProcessingTTSRef.current || ttsQueueRef.current.length === 0) {
      return;
    }

    isProcessingTTSRef.current = true;
    const text = ttsQueueRef.current.shift();

    if (!text) {
      isProcessingTTSRef.current = false;
      return;
    }

    try {
      setIsTTSPlaying(true);

      // Build base URL
      let baseUrl = options?.serverUrl || process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
      if (baseUrl.startsWith("ws://")) {
        baseUrl = baseUrl.replace("ws://", "http://");
      } else if (baseUrl.startsWith("wss://")) {
        baseUrl = baseUrl.replace("wss://", "https://");
      }

      // Call TTS API
      const response = await fetch(`${baseUrl}/api/transcribe/tts`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": options?.apiKey || "",
        },
        body: JSON.stringify({ text, voice: "alloy" }),
      });

      if (!response.ok) {
        throw new Error(`TTS request failed: ${response.status}`);
      }

      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);

      // Play the audio
      const audio = new Audio(audioUrl);
      ttsAudioRef.current = audio;

      audio.onended = () => {
        URL.revokeObjectURL(audioUrl);
        ttsAudioRef.current = null;
        isProcessingTTSRef.current = false;

        // Process next in queue
        if (ttsQueueRef.current.length > 0) {
          processTTSQueue();
        } else {
          setIsTTSPlaying(false);
        }
      };

      audio.onerror = () => {
        URL.revokeObjectURL(audioUrl);
        ttsAudioRef.current = null;
        isProcessingTTSRef.current = false;
        setIsTTSPlaying(false);
        console.error("[TTS] Audio playback error");
      };

      await audio.play();
    } catch (err) {
      console.error("[TTS] Error:", err);
      isProcessingTTSRef.current = false;
      setIsTTSPlaying(false);
      // Try next in queue
      if (ttsQueueRef.current.length > 0) {
        processTTSQueue();
      }
    }
  }, [options?.serverUrl, options?.apiKey]);

  // Play TTS - adds to queue and starts processing
  const playTTS = useCallback(async (text: string) => {
    if (!text.trim()) return;

    console.log("[TTS] Queuing:", text.substring(0, 50) + "...");
    ttsQueueRef.current.push(text);
    processTTSQueue();
  }, [processTTSQueue]);

  // Stop TTS playback
  const stopTTS = useCallback(() => {
    if (ttsAudioRef.current) {
      ttsAudioRef.current.pause();
      ttsAudioRef.current = null;
    }
    ttsQueueRef.current = [];
    isProcessingTTSRef.current = false;
    setIsTTSPlaying(false);
  }, []);

  return {
    state,
    startRecording,
    stopRecording,
    cancelRecording,
    canvasRef,
    playTTS,
    stopTTS,
    isTTSPlaying,
  };
}
