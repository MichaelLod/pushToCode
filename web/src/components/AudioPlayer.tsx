"use client";

/**
 * AudioPlayer - Plays TTS audio chunks using Web Audio API
 * Queues and plays base64-encoded audio chunks sequentially
 */

import { useCallback, useEffect, useRef, useState } from "react";

export interface AudioPlayerProps {
  onPlaybackStart?: () => void;
  onPlaybackEnd?: () => void;
  onError?: (error: string) => void;
}

export interface AudioPlayerHandle {
  queueAudio: (base64Audio: string, isFinal: boolean) => Promise<void>;
  stop: () => void;
  isPlaying: boolean;
}

export function useAudioPlayer(props: AudioPlayerProps = {}): AudioPlayerHandle {
  const { onPlaybackStart, onPlaybackEnd, onError } = props;

  const [isPlaying, setIsPlaying] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioQueueRef = useRef<AudioBuffer[]>([]);
  const isPlayingRef = useRef(false);
  const currentSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const isFinalReceivedRef = useRef(false);

  // Initialize AudioContext lazily (must be user-initiated on mobile)
  const getAudioContext = useCallback((): AudioContext => {
    if (!audioContextRef.current) {
      const AudioContextClass = window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      audioContextRef.current = new AudioContextClass();
    }
    return audioContextRef.current;
  }, []);

  // Play next audio in queue
  const playNext = useCallback(() => {
    if (audioQueueRef.current.length === 0) {
      // Queue is empty
      if (isFinalReceivedRef.current) {
        // All audio played
        isPlayingRef.current = false;
        setIsPlaying(false);
        onPlaybackEnd?.();
        isFinalReceivedRef.current = false;
      }
      return;
    }

    const audioBuffer = audioQueueRef.current.shift()!;
    const audioContext = getAudioContext();

    // Resume context if suspended (required for mobile)
    if (audioContext.state === "suspended") {
      audioContext.resume();
    }

    const source = audioContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(audioContext.destination);

    currentSourceRef.current = source;

    source.onended = () => {
      currentSourceRef.current = null;
      playNext();
    };

    source.start();
  }, [getAudioContext, onPlaybackEnd]);

  // Queue audio for playback
  const queueAudio = useCallback(async (base64Audio: string, isFinal: boolean) => {
    try {
      const audioContext = getAudioContext();

      // Decode base64 to ArrayBuffer
      const binaryString = atob(base64Audio);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      // Decode audio data
      const audioBuffer = await audioContext.decodeAudioData(bytes.buffer.slice(0));
      audioQueueRef.current.push(audioBuffer);

      if (isFinal) {
        isFinalReceivedRef.current = true;
      }

      // Start playback if not already playing
      if (!isPlayingRef.current) {
        isPlayingRef.current = true;
        setIsPlaying(true);
        onPlaybackStart?.();
        playNext();
      }
    } catch (error) {
      console.error("[AudioPlayer] Failed to decode audio:", error);
      onError?.(error instanceof Error ? error.message : "Failed to decode audio");
    }
  }, [getAudioContext, onPlaybackStart, playNext, onError]);

  // Stop playback and clear queue
  const stop = useCallback(() => {
    audioQueueRef.current = [];
    isFinalReceivedRef.current = false;

    if (currentSourceRef.current) {
      try {
        currentSourceRef.current.stop();
      } catch {
        // Ignore errors if already stopped
      }
      currentSourceRef.current = null;
    }

    isPlayingRef.current = false;
    setIsPlaying(false);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stop();
      if (audioContextRef.current && audioContextRef.current.state !== "closed") {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }
    };
  }, [stop]);

  return {
    queueAudio,
    stop,
    isPlaying,
  };
}

/**
 * AudioPlayer component - Visual representation of audio playback state
 */
export function AudioPlayer({ isPlaying }: { isPlaying: boolean }) {
  const [tick, setTick] = useState(0);

  // Animate bars using interval
  useEffect(() => {
    if (!isPlaying) return;

    const interval = setInterval(() => {
      setTick((t) => t + 1);
    }, 50);

    return () => clearInterval(interval);
  }, [isPlaying]);

  if (!isPlaying) {
    return null;
  }

  const time = tick * 50;

  return (
    <div className="flex items-center justify-center gap-1 py-2">
      {/* Animated equalizer bars */}
      <div className="flex items-end gap-0.5 h-6">
        {[0, 1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="w-1 bg-accent rounded-full transition-all duration-75"
            style={{
              height: `${40 + Math.sin(time / 200 + i) * 30}%`,
            }}
          />
        ))}
      </div>
      <span className="ml-2 text-sm text-text-secondary">Playing...</span>
    </div>
  );
}

export default AudioPlayer;
