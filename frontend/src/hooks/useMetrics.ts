"use client";

import { useQuery } from "@tanstack/react-query";
import { useTenantContextId } from "@/hooks/useActiveTenant";
import { api } from "@/lib/api";
import type { UsageMetrics } from "@/types";

export function useMetrics() {
  const scope = useTenantContextId() ?? "home";
  return useQuery({
    queryKey: ["metrics", scope],
    queryFn: () => api.get<UsageMetrics>("/metrics"),
    staleTime: 60_000,
    refetchOnMount: "always",
  });
}
