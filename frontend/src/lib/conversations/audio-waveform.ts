export function buildSkeletonPeaks(barCount: number): number[] {
  return Array.from({ length: barCount }, (_, index) => {
    const wave =
      Math.sin(index * 0.22) * 0.22 +
      Math.sin(index * 0.08) * 0.14 +
      Math.sin(index * 0.35 + 0.8) * 0.1;
    return Math.max(0.18, Math.min(0.88, 0.34 + wave));
  });
}

export function computePeaks(channelData: Float32Array, barCount: number): number[] {
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
  return smoothPeaks(peaks.map((peak) => peak / peakMax));
}

export function smoothPeaks(peaks: number[], radius = 1): number[] {
  return peaks.map((_, index) => {
    let sum = 0;
    let count = 0;
    for (let offset = -radius; offset <= radius; offset++) {
      const value = peaks[index + offset];
      if (value === undefined) continue;
      sum += value;
      count++;
    }
    return count > 0 ? sum / count : 0;
  });
}

export function readCssColor(variable: string, fallback: string): string {
  if (typeof window === "undefined") return fallback;
  const value = getComputedStyle(document.documentElement).getPropertyValue(variable).trim();
  return value || fallback;
}

export function getChatWaveformBarCount(width?: number): number {
  if (width && width > 0) {
    return Math.min(56, Math.max(32, Math.floor(width / 4)));
  }
  return 44;
}

export type WaveformDrawOptions = {
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  peaks: number[];
  progress?: number;
  skeleton?: boolean;
  accentColor?: string;
  inactiveColor?: string;
  skeletonColor?: string;
  barGap?: number;
  minBarHeight?: number;
};

export function drawWaveformBars(options: WaveformDrawOptions): void {
  const {
    ctx,
    width,
    height,
    peaks,
    progress = 0,
    skeleton = false,
    accentColor = readCssColor("--accent", "#128c7e"),
    inactiveColor = readCssColor("--text-muted", "#94a3b8"),
    skeletonColor = readCssColor("--border", "#cbd5e1"),
    barGap = 1.5,
    minBarHeight = 4,
  } = options;

  ctx.clearRect(0, 0, width, height);

  const barWidth = Math.max(2, (width - barGap * (peaks.length - 1)) / peaks.length);
  const maxBarHeight = height - 6;
  const centerY = height / 2;
  const progressX = progress * width;

  for (let i = 0; i < peaks.length; i++) {
    const peak = Math.max(0.12, Math.min(1, peaks[i] ?? 0));
    const barHeight = Math.max(minBarHeight, peak * maxBarHeight);
    const x = i * (barWidth + barGap);
    const y = centerY - barHeight / 2;
    const barEndX = x + barWidth;

    if (skeleton) {
      ctx.fillStyle = skeletonColor;
      ctx.globalAlpha = 0.55;
      ctx.beginPath();
      ctx.roundRect(x, y, barWidth, barHeight, barWidth / 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      continue;
    }

    const playedRatio =
      barEndX <= progressX
        ? 1
        : x >= progressX
          ? 0
          : (progressX - x) / Math.max(barWidth, 1);

    if (playedRatio >= 1) {
      ctx.fillStyle = accentColor;
      ctx.beginPath();
      ctx.roundRect(x, y, barWidth, barHeight, barWidth / 2);
      ctx.fill();
      continue;
    }

    if (playedRatio <= 0) {
      ctx.fillStyle = inactiveColor;
      ctx.globalAlpha = 0.45;
      ctx.beginPath();
      ctx.roundRect(x, y, barWidth, barHeight, barWidth / 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      continue;
    }

    const splitX = x + barWidth * playedRatio;
    ctx.fillStyle = accentColor;
    ctx.beginPath();
    ctx.roundRect(x, y, Math.max(barWidth * playedRatio, barWidth / 2), barHeight, barWidth / 2);
    ctx.fill();

    ctx.fillStyle = inactiveColor;
    ctx.globalAlpha = 0.45;
    ctx.beginPath();
    ctx.roundRect(splitX, y, Math.max(barEndX - splitX, 0.5), barHeight, barWidth / 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}

export function peaksFromAnalyser(
  analyser: AnalyserNode,
  barCount: number,
  previousPeaks?: number[]
): number[] {
  const data = new Uint8Array(analyser.fftSize);
  analyser.getByteTimeDomainData(data);
  const step = Math.max(1, Math.floor(data.length / barCount));
  const peaks: number[] = [];

  for (let i = 0; i < barCount; i++) {
    const sample = data[i * step] ?? 128;
    const amplitude = Math.abs(sample - 128) / 128;
    const boosted = Math.min(1, amplitude * 1.65 + 0.08);
    const previous = previousPeaks?.[i] ?? boosted;
    peaks.push(previous * 0.55 + boosted * 0.45);
  }

  return smoothPeaks(peaks);
}
