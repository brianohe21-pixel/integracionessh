"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Loader2, Pause, Play } from "lucide-react";
import {
  buildSkeletonPeaks,
  computePeaks,
  drawWaveformBars,
  getChatWaveformBarCount,
} from "@/lib/conversations/audio-waveform";
import { cn } from "@/lib/utils";

function formatAudioTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

type Props = {
  src: string;
  className?: string;
  variant?: "default" | "inline";
};

export function ChatAudioPlayer({ src, className, variant = "default" }: Props) {
  const isInline = variant === "inline";
  const waveHeight = isInline ? 32 : 40;
  const buttonSize = isInline ? "h-8 w-8" : "h-9 w-9";
  const iconSize = isInline ? "h-3.5 w-3.5" : "h-4 w-4";

  const audioRef = useRef<HTMLAudioElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const peaksRef = useRef<number[]>(buildSkeletonPeaks(getChatWaveformBarCount()));
  const progressRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const skeletonRef = useRef(true);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);

  const drawWaveform = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    const peaks = peaksRef.current;
    if (!canvas || !container || peaks.length === 0) return;

    const width = container.clientWidth;
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
      peaks,
      progress: progressRef.current,
      skeleton: skeletonRef.current,
      barGap: isInline ? 1.25 : 1.5,
      minBarHeight: isInline ? 3 : 4,
    });
  }, [waveHeight, isInline]);

  useLayoutEffect(() => {
    const width = containerRef.current?.clientWidth ?? 0;
    peaksRef.current = buildSkeletonPeaks(getChatWaveformBarCount(width));
    skeletonRef.current = true;
    progressRef.current = 0;
    drawWaveform();
  }, [src, drawWaveform]);

  const syncProgress = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !audio.duration) return;

    progressRef.current = audio.currentTime / audio.duration;
    setCurrentTime(audio.currentTime);
    drawWaveform();

    if (!audio.paused && !audio.ended) {
      rafRef.current = requestAnimationFrame(syncProgress);
    }
  }, [drawWaveform]);

  useEffect(() => {
    let cancelled = false;
    const audioContext = new AudioContext();

    const loadWaveform = async () => {
      setLoading(true);
      setError(false);
      skeletonRef.current = true;
      const width = containerRef.current?.clientWidth ?? 0;
      peaksRef.current = buildSkeletonPeaks(getChatWaveformBarCount(width));
      progressRef.current = 0;
      setCurrentTime(0);
      setDuration(0);
      setPlaying(false);
      drawWaveform();

      try {
        const response = await fetch(src, { mode: "cors" });
        if (!response.ok) throw new Error("fetch failed");

        const buffer = await response.arrayBuffer();
        const audioBuffer = await audioContext.decodeAudioData(buffer.slice(0));
        if (cancelled) return;

        const barCount = getChatWaveformBarCount(containerRef.current?.clientWidth ?? 0);
        peaksRef.current = computePeaks(audioBuffer.getChannelData(0), barCount);
        skeletonRef.current = false;
        setDuration(audioBuffer.duration);
        setLoading(false);
        drawWaveform();
      } catch {
        if (!cancelled) {
          setError(true);
          setLoading(false);
        }
      }
    };

    void loadWaveform();

    return () => {
      cancelled = true;
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      void audioContext.close();
    };
  }, [src, drawWaveform]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver(() => drawWaveform());
    observer.observe(container);
    return () => observer.disconnect();
  }, [drawWaveform]);

  function togglePlayback() {
    const audio = audioRef.current;
    if (!audio || loading || error) return;

    if (audio.paused) {
      void audio.play().then(() => {
        setPlaying(true);
        if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
        rafRef.current = requestAnimationFrame(syncProgress);
      }).catch(() => setError(true));
      return;
    }

    audio.pause();
    setPlaying(false);
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }

  function handleSeek(event: React.MouseEvent<HTMLDivElement>) {
    const audio = audioRef.current;
    const container = containerRef.current;
    if (!audio || !container || !audio.duration || loading) return;

    const rect = container.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    audio.currentTime = ratio * audio.duration;
    progressRef.current = ratio;
    setCurrentTime(audio.currentTime);
    drawWaveform();
  }

  const displayTime = playing || currentTime > 0
    ? formatAudioTime(currentTime)
    : formatAudioTime(duration);

  if (error) {
    return (
      <div className={cn("flex min-w-0 items-center gap-2", className)}>
        <audio controls src={src} className="w-full" />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex min-w-0 items-center gap-2",
        !isInline && "rounded-xl border border-default/70 bg-surface-muted/40 px-2 py-1.5",
        className
      )}
    >
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        crossOrigin="anonymous"
        className="hidden"
        onLoadedMetadata={(event) => {
          const audio = event.currentTarget;
          if (!duration && Number.isFinite(audio.duration)) {
            setDuration(audio.duration);
          }
        }}
        onEnded={() => {
          setPlaying(false);
          progressRef.current = 0;
          setCurrentTime(0);
          if (rafRef.current !== null) {
            cancelAnimationFrame(rafRef.current);
            rafRef.current = null;
          }
          drawWaveform();
        }}
      />

      <button
        type="button"
        onClick={togglePlayback}
        disabled={loading}
        className={cn(
          "flex flex-shrink-0 items-center justify-center rounded-full bg-accent text-white transition hover:bg-accent-hover disabled:opacity-50",
          buttonSize
        )}
      >
        {loading ? (
          <Loader2 className={cn(iconSize, "animate-spin")} />
        ) : playing ? (
          <Pause className={iconSize} />
        ) : (
          <Play className={cn(iconSize, "translate-x-0.5")} />
        )}
      </button>

      <div
        ref={containerRef}
        role="slider"
        aria-valuemin={0}
        aria-valuemax={duration || 0}
        aria-valuenow={currentTime}
        className={cn(
          "min-w-0 flex-1 overflow-hidden",
          !loading && "cursor-pointer",
          loading && "animate-pulse"
        )}
        onClick={handleSeek}
      >
        <canvas ref={canvasRef} className="block w-full" style={{ height: waveHeight }} />
      </div>

      <span className="w-8 flex-shrink-0 text-right text-[11px] font-medium tabular-nums text-secondary">
        {loading ? "--:--" : displayTime}
      </span>
    </div>
  );
}
