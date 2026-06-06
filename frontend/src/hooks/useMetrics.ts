"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { UsageMetrics } from "@/types";

export function useMetrics() {
  return useQuery({
    queryKey: ["metrics"],
    queryFn: () => api.get<UsageMetrics>("/metrics"),
    staleTime: 60_000,
    refetchOnMount: "always",
  });
}
