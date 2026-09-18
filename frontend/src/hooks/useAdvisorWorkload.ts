"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { AdvisorWorkloadMetrics } from "@/types";

type AdvisorWorkloadOptions = {
  botId?: string;
  from?: string;
  to?: string;
};

async function fetchAdvisorWorkload(
  options?: AdvisorWorkloadOptions
): Promise<AdvisorWorkloadMetrics> {
  const params = new URLSearchParams();
  if (options?.botId) params.set("botId", options.botId);
  if (options?.from) params.set("from", options.from);
  if (options?.to) params.set("to", options.to);
  const query = params.toString();
  const path = query ? `/metrics/advisor-workload?${query}` : "/metrics/advisor-workload";
  return api.get<AdvisorWorkloadMetrics>(path);
}

export function useAdvisorWorkload(options?: AdvisorWorkloadOptions) {
  const botId = options?.botId ?? "";
  const from = options?.from ?? "";
  const to = options?.to ?? "";
  return useQuery({
    queryKey: ["metrics", "advisor-workload", botId, from, to],
    queryFn: () =>
      fetchAdvisorWorkload({
        ...(botId ? { botId } : {}),
        ...(from && to ? { from, to } : {}),
      }),
    refetchInterval: from && to ? false : 30_000,
    retry: false,
  });
}
