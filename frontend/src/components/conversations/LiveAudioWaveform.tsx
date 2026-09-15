"use client";

import { useEffect, useRef } from "react";
import {
  drawWaveformBars,
  getChatWaveformBarCount,
  peaksFromAnalyser,
  readCssColor,
} from "@/lib/conversations/audio-waveform";
import { cn } from "@/lib/utils";

type Props = {
  stream: MediaStream | null;
  active: boolean;
  className?: string;
  height?: number;
  variant?: "default" | "inline";
};

export function LiveAudioWaveform({
  stream,
  active,
  className,
  height,
  variant = "default",
}: Props) {
  const isInline = variant === "inline";
  const waveHeight = height ?? (isInline ? 32 : 44);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const peaksRef = useRef<number[]>([]);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!active || !stream) return;

    const audioContext = new AudioContext();
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.82;

    const source = audioContext.createMediaStreamSource(stream);
    source.connect(analyser);

    audioContextRef.current = audioContext;
    analyserRef.current = analyser;
    peaksRef.current = [];

    const draw = () => {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      const analyserNode = analyserRef.current;
      if (!canvas || !container || !analyserNode) return;

      const width = container.clientWidth;
      const barCount = getChatWaveformBarCount(width);
      peaksRef.current = peaksFromAnalyser(analyserNode, barCount, peaksRef.current);

      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(waveHeight * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${waveHeight}px`;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawWaveformBars({
        ctx,
        width,
        height: waveHeight,
        peaks: peaksRef.current,
        progress: 1,
        accentColor: readCssColor("--accent", "#128c7e"),
        inactiveColor: readCssColor("--accent", "#128c7e"),
        barGap: isInline ? 1.25 : 1.5,
        minBarHeight: isInline ? 3 : 4,
      });

      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);

    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      source.disconnect();
      void audioContext.close();
      audioContextRef.current = null;
      analyserRef.current = null;
      peaksRef.current = [];
    };
  }, [active, stream, waveHeight, isInline]);

  return (
    <div
      ref={containerRef}
      className={cn(
        "min-w-0 flex-1 overflow-hidden",
        isInline ? "px-0.5" : "rounded-lg border border-accent/15 bg-accent-muted/30 px-2 py-1.5",
        className
      )}
    >
      <canvas ref={canvasRef} className="block w-full" style={{ height: waveHeight }} />
    </div>
  );
}
