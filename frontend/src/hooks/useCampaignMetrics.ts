"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { CampaignMetrics, CampaignStatus } from "@/types";

function isCampaignMetrics(data: unknown): data is CampaignMetrics {
  if (!data || typeof data !== "object") return false;
  const m = data as CampaignMetrics;
  return Boolean(m.funnel && m.conversionsByChannel && typeof m.replyRate === "number");
}

async function fetchCampaignMetrics(campaignId: string): Promise<CampaignMetrics> {
  const data = await api.get<CampaignMetrics>(`/campaigns/${campaignId}/metrics`);
  if (!isCampaignMetrics(data)) {
    throw new Error("Invalid campaign metrics response");
  }
  return data;
}

function refetchIntervalForStatus(status?: CampaignStatus): number | false {
  if (!status) return false;
  if (status === "running" || status === "paused") return 15_000;
  if (status === "scheduled" || status === "completed" || status === "failed") return 60_000;
  return false;
}

export function useCampaignMetrics(campaignId: string, status?: CampaignStatus) {
  return useQuery({
    queryKey: ["campaigns", campaignId, "metrics"],
    queryFn: () => fetchCampaignMetrics(campaignId),
    enabled: Boolean(campaignId) && Boolean(status) && status !== "draft",
    refetchInterval: refetchIntervalForStatus(status),
    refetchOnWindowFocus: true,
    retry: false,
  });
}

export function formatWaitTime(seconds: number): string {
  if (seconds <= 0) return "—";
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.round((seconds % 3600) / 60);
  return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
}
