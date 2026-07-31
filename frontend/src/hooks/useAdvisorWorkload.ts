"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { AdvisorWorkloadMetrics } from "@/types";

async function fetchAdvisorWorkload(): Promise<AdvisorWorkloadMetrics> {
  return api.get<AdvisorWorkloadMetrics>("/metrics/advisor-workload");
}

export function useAdvisorWorkload() {
  return useQuery({
    queryKey: ["metrics", "advisor-workload"],
    queryFn: fetchAdvisorWorkload,
    refetchInterval: 30_000,
    retry: false,
  });
}
