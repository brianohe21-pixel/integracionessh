"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { MetricsDateRange } from "@/lib/metrics-date-range";
import type { CallingMetrics } from "@/types";

function isCallingMetrics(data: unknown): data is CallingMetrics {
  if (!data || typeof data !== "object") return false;
  const metrics = data as CallingMetrics;
  return typeof metrics.summary?.pickupRate === "number" && Array.isArray(metrics.byBot);
}

async function fetchCallingMetrics(
  range: MetricsDateRange,
  botId?: string
): Promise<CallingMetrics> {
  const params = new URLSearchParams({
    from: range.from,
    to: range.to,
  });
  if (botId) params.set("botId", botId);
  const data = await api.get<CallingMetrics>(`/metrics/calling?${params.toString()}`);
  if (!isCallingMetrics(data)) {
    throw new Error("Invalid calling metrics response");
  }
  return data;
}

export function useCallingMetrics(range: MetricsDateRange, botId?: string) {
  return useQuery({
    queryKey: ["metrics", "calling", range.from, range.to, botId ?? "all"],
    queryFn: () => fetchCallingMetrics(range, botId),
    refetchInterval: 60_000,
    retry: false,
  });
}

export function formatCallDuration(seconds: number): string {
  if (seconds <= 0) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${String(secs).padStart(2, "0")}`;
}
