"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { MetricsDateRange } from "@/lib/metrics-date-range";
import type { WebsiteMetrics } from "@/types";

function isWebsiteMetrics(data: unknown): data is WebsiteMetrics {
  if (!data || typeof data !== "object") return false;
  const metrics = data as WebsiteMetrics;
  return (
    typeof metrics.summary?.pageviews === "number" &&
    Array.isArray(metrics.dailyTrend) &&
    Array.isArray(metrics.topPages)
  );
}

async function fetchWebsiteMetrics(
  range: MetricsDateRange,
  botId?: string
): Promise<WebsiteMetrics> {
  const params = new URLSearchParams({
    from: range.from,
    to: range.to,
  });
  if (botId) params.set("botId", botId);
  const data = await api.get<WebsiteMetrics>(`/metrics/website?${params.toString()}`);
  if (!isWebsiteMetrics(data)) {
    throw new Error("Invalid website metrics response");
  }
  return data;
}

export function useWebsiteMetrics(range: MetricsDateRange, botId?: string) {
  return useQuery({
    queryKey: ["metrics", "website", range.from, range.to, botId ?? "all"],
    queryFn: () => fetchWebsiteMetrics(range, botId),
    refetchInterval: 60_000,
    retry: false,
  });
}
