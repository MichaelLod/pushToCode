"use client";

/**
 * VoiceWaveform - Visual feedback during recording and playback
 * Shows animated waveform visualization based on audio data or playback state
 */

import { useEffect, useRef } from "react";

export type WaveformMode = "idle" | "recording" | "processing" | "playing";

export interface VoiceWaveformProps {
  mode: WaveformMode;
  audioData?: Float32Array | null;
  className?: string;
}

export function VoiceWaveform({ mode, audioData, className = "" }: VoiceWaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Set canvas size for high DPI displays
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const width = rect.width;
    const height = rect.height;
    const centerY = height / 2;

    const drawWaveform = () => {
      // Clear canvas
      ctx.fillStyle = "transparent";
      ctx.clearRect(0, 0, width, height);

      if (mode === "idle") {
        // Draw flat line
        ctx.beginPath();
        ctx.moveTo(0, centerY);
        ctx.lineTo(width, centerY);
        ctx.strokeStyle = "#565f89";
        ctx.lineWidth = 2;
        ctx.stroke();
        return;
      }

      if (mode === "recording" && audioData) {
        // Draw actual audio waveform
        ctx.beginPath();
        ctx.strokeStyle = "#7aa2f7";
        ctx.lineWidth = 2;

        const sliceWidth = width / audioData.length;
        let x = 0;

        for (let i = 0; i < audioData.length; i++) {
          const v = audioData[i];
          const y = centerY + v * centerY * 0.8;

          if (i === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }

          x += sliceWidth;
        }

        ctx.stroke();
        return;
      }

      if (mode === "processing") {
        // Draw pulsing dots
        const time = Date.now() / 200;
        const dotCount = 5;
        const dotSpacing = width / (dotCount + 1);

        for (let i = 0; i < dotCount; i++) {
          const phase = (time + i * 0.5) % (Math.PI * 2);
          const yOffset = Math.sin(phase) * 10;
          const opacity = 0.5 + Math.sin(phase) * 0.3;

          ctx.beginPath();
          ctx.arc(dotSpacing * (i + 1), centerY + yOffset, 4, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(122, 162, 247, ${opacity})`;
          ctx.fill();
        }

        animationFrameRef.current = requestAnimationFrame(drawWaveform);
        return;
      }

      if (mode === "playing") {
        // Draw animated equalizer bars
        const time = Date.now() / 100;
        const barCount = 20;
        const barWidth = width / barCount - 2;
        const barSpacing = width / barCount;

        for (let i = 0; i < barCount; i++) {
          const phase = (time + i * 0.3) % (Math.PI * 2);
          const barHeight = 10 + Math.abs(Math.sin(phase)) * (height * 0.6);

          const gradient = ctx.createLinearGradient(0, centerY - barHeight / 2, 0, centerY + barHeight / 2);
          gradient.addColorStop(0, "#7aa2f7");
          gradient.addColorStop(1, "#bb9af7");

          ctx.fillStyle = gradient;
          ctx.fillRect(
            i * barSpacing + 1,
            centerY - barHeight / 2,
            barWidth,
            barHeight
          );
        }

        animationFrameRef.current = requestAnimationFrame(drawWaveform);
        return;
      }
    };

    drawWaveform();

    // Continue animation for animated modes
    if (mode === "recording" && audioData) {
      // Recording animation is driven by audioData updates
    } else if (mode === "processing" || mode === "playing") {
      animationFrameRef.current = requestAnimationFrame(drawWaveform);
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [mode, audioData]);

  // Redraw when audioData changes during recording
  useEffect(() => {
    if (mode === "recording" && audioData) {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      const width = rect.width;
      const height = rect.height;
      const centerY = height / 2;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      ctx.beginPath();
      ctx.strokeStyle = "#7aa2f7";
      ctx.lineWidth = 2;

      const sliceWidth = width / audioData.length;
      let x = 0;

      for (let i = 0; i < audioData.length; i++) {
        const v = audioData[i];
        const y = centerY + v * centerY * 0.8;

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }

        x += sliceWidth;
      }

      ctx.stroke();
    }
  }, [mode, audioData]);

  return (
    <div className={`relative ${className}`}>
      <canvas
        ref={canvasRef}
        className="w-full h-full"
        style={{ display: "block" }}
        aria-label={`Voice waveform - ${mode}`}
      />
      {mode === "recording" && (
        <div className="absolute top-2 right-2 flex items-center gap-2">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-error opacity-75" />
            <span className="relative inline-flex rounded-full h-3 w-3 bg-error" />
          </span>
        </div>
      )}
    </div>
  );
}

export default VoiceWaveform;
