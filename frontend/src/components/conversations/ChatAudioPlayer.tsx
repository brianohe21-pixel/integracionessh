"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Pause, Play } from "lucide-react";
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
};

export function ChatAudioPlayer({ src, className }: Props) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);

  useEffect(() => {
    setLoading(true);
    setError(false);
    setPlaying(false);
    setDuration(0);
    setCurrentTime(0);
  }, [src]);

  function togglePlayback() {
    const audio = audioRef.current;
    if (!audio || loading || error) return;

    if (audio.paused) {
      void audio.play().then(() => setPlaying(true)).catch(() => setError(true));
      return;
    }

    audio.pause();
    setPlaying(false);
  }

  function handleSeek(event: React.MouseEvent<HTMLDivElement>) {
    const audio = audioRef.current;
    const rect = event.currentTarget.getBoundingClientRect();
    if (!audio || !audio.duration || !rect.width) return;

    const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    audio.currentTime = ratio * audio.duration;
    setCurrentTime(audio.currentTime);
  }

  return (
    <div className={cn("flex min-w-[220px] items-center gap-3", className)}>
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        className="hidden"
        onLoadedMetadata={(event) => {
          const audio = event.currentTarget;
          if (Number.isFinite(audio.duration)) {
            setDuration(audio.duration);
          }
          setLoading(false);
        }}
        onTimeUpdate={(event) => {
          setCurrentTime(event.currentTarget.currentTime);
        }}
        onEnded={() => {
          setPlaying(false);
          setCurrentTime(0);
        }}
        onError={() => {
          setError(true);
          setLoading(false);
        }}
      />

      <button
        type="button"
        onClick={togglePlayback}
        disabled={loading || error}
        className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-accent text-white transition hover:bg-accent-hover disabled:opacity-50"
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
          role="slider"
          aria-valuemin={0}
          aria-valuemax={duration || 0}
          aria-valuenow={currentTime}
          className="h-1.5 cursor-pointer rounded-full bg-surface-muted"
          onClick={handleSeek}
        >
          <div
            className="h-full rounded-full bg-accent transition-[width]"
            style={{
              width: duration > 0 ? `${(currentTime / duration) * 100}%` : "0%",
            }}
          />
        </div>
        <div className="mt-1 flex justify-between text-[11px] text-secondary">
          <span>{formatAudioTime(currentTime)}</span>
          <span>{formatAudioTime(duration)}</span>
        </div>
      </div>
    </div>
  );
}
