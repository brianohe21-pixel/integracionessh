"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Loader2, Pause, Play } from "lucide-react";
import { cn } from "@/lib/utils";
import { useT } from "@/i18n/context";

function formatAudioTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function buildSkeletonPeaks(barCount: number): number[] {
  return Array.from({ length: barCount }, (_, index) => {
    const wave =
      Math.sin(index * 0.28) * 0.18 +
      Math.sin(index * 0.09) * 0.12 +
      Math.sin(index * 0.41 + 1.2) * 0.08;
    return Math.max(0.12, Math.min(0.82, 0.28 + wave));
  });
}

function getBarCount(): number {
  if (typeof window === "undefined") return 96;
  return Math.min(160, Math.max(64, Math.floor(window.innerWidth / 6)));
}

function computePeaks(channelData: Float32Array, barCount: number): number[] {
  const blockSize = Math.max(1, Math.floor(channelData.length / barCount));
  const peaks: number[] = [];

  for (let i = 0; i < barCount; i++) {
    const start = i * blockSize;
    const end = Math.min(start + blockSize, channelData.length);
    let max = 0;
    for (let j = start; j < end; j++) {
      max = Math.max(max, Math.abs(channelData[j] ?? 0));
    }
    peaks.push(max);
  }

  const peakMax = Math.max(...peaks, 0.001);
  return peaks.map((peak) => peak / peakMax);
}

function readCssColor(variable: string, fallback: string): string {
  if (typeof window === "undefined") return fallback;
  const value = getComputedStyle(document.documentElement).getPropertyValue(variable).trim();
  return value || fallback;
}

interface AudioWaveformPlayerProps {
  src: string;
  className?: string;
}

export function AudioWaveformPlayer({ src, className }: AudioWaveformPlayerProps) {
  const t = useT();
  const audioRef = useRef<HTMLAudioElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const peaksRef = useRef<number[]>(buildSkeletonPeaks(getBarCount()));
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
    const height = 72;
    const dpr = window.devicePixelRatio || 1;

    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    const accent = readCssColor("--accent", "#128c7e");
    const muted = readCssColor("--text-muted", "#94a3b8");
    const skeleton = readCssColor("--border", "#cbd5e1");
    const barGap = 2;
    const barWidth = Math.max(2, (width - barGap * (peaks.length - 1)) / peaks.length);
    const progress = progressRef.current;
    const playedBars = Math.floor(progress * peaks.length);
    const isSkeleton = skeletonRef.current;

    for (let i = 0; i < peaks.length; i++) {
      const barHeight = Math.max(3, peaks[i]! * (height - 12));
      const x = i * (barWidth + barGap);
      const y = (height - barHeight) / 2;

      ctx.fillStyle = isSkeleton ? skeleton : i < playedBars ? accent : muted;
      ctx.beginPath();
      ctx.roundRect(x, y, barWidth, barHeight, 1.5);
      ctx.fill();
    }
  }, []);

  useLayoutEffect(() => {
    peaksRef.current = buildSkeletonPeaks(getBarCount());
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
      peaksRef.current = buildSkeletonPeaks(getBarCount());
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

        peaksRef.current = computePeaks(audioBuffer.getChannelData(0), getBarCount());
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
  }, [drawWaveform, loading, error]);

  const togglePlayback = async () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (audio.paused) {
      try {
        await audio.play();
        setPlaying(true);
        if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
        rafRef.current = requestAnimationFrame(syncProgress);
      } catch {
        setError(true);
      }
      return;
    }

    audio.pause();
    setPlaying(false);
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  };

  const seekTo = (clientX: number) => {
    const audio = audioRef.current;
    const container = containerRef.current;
    if (!audio || !container || !audio.duration) return;

    const rect = container.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    audio.currentTime = ratio * audio.duration;
    progressRef.current = ratio;
    setCurrentTime(audio.currentTime);
    drawWaveform();
  };

  if (error) {
    return (
      <div className={cn("space-y-2", className)}>
        <p className="text-sm text-secondary">{t("voiceAgents.recordingLoadError")}</p>
        <audio controls src={src} className="w-full" />
      </div>
    );
  }

  return (
    <div className={cn("space-y-2", className)}>
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

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => void togglePlayback()}
          disabled={loading}
          className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-accent text-white transition hover:bg-accent-hover disabled:opacity-50"
          aria-label={playing ? t("voiceAgents.pauseRecording") : t("voiceAgents.playRecording")}
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : playing ? (
            <Pause className="h-4 w-4" />
          ) : (
            <Play className="h-4 w-4 translate-x-0.5" />
          )}
        </button>

        <div className="min-w-0 flex-1">
          <div
            ref={containerRef}
            className={cn(
              "relative h-[72px] w-full overflow-hidden rounded-lg bg-surface-muted",
              loading && "animate-pulse",
              !loading && "cursor-pointer"
            )}
            onClick={(event) => {
              if (!loading) seekTo(event.clientX);
            }}
            onKeyDown={(event) => {
              if (loading) return;
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                seekTo(
                  containerRef.current
                    ? containerRef.current.getBoundingClientRect().left +
                        containerRef.current.clientWidth / 2
                    : 0
                );
              }
            }}
            role="slider"
            tabIndex={loading ? -1 : 0}
            aria-valuemin={0}
            aria-valuemax={duration}
            aria-valuenow={currentTime}
            aria-label={t("voiceAgents.playRecording")}
          >
            <canvas ref={canvasRef} className="block h-[72px] w-full" />
          </div>
          <div className="mt-1 flex justify-between text-xs text-secondary tabular-nums">
            <span>{formatAudioTime(currentTime)}</span>
            <span>{formatAudioTime(duration)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
