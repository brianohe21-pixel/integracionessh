"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { MarketingMetrics } from "@/types";

function isMarketingMetrics(data: unknown): data is MarketingMetrics {
  if (!data || typeof data !== "object") return false;
  const m = data as MarketingMetrics;
  return Boolean(m.campaigns?.rates && m.inbox);
}

async function fetchMarketingMetrics(): Promise<MarketingMetrics> {
  const data = await api.get<MarketingMetrics>("/metrics/marketing");
  if (!isMarketingMetrics(data)) {
    throw new Error("Invalid marketing metrics response");
  }
  return data;
}

export function useMarketingMetrics() {
  return useQuery({
    queryKey: ["metrics", "marketing"],
    queryFn: fetchMarketingMetrics,
    refetchInterval: 60_000,
    retry: false,
  });
}
