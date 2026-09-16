"use client";

import { useQuery } from "@tanstack/react-query";
import { useTenantContextId } from "@/hooks/useActiveTenant";
import { api } from "@/lib/api";
import type { InboxSlaMetrics } from "@/types";

async function fetchInboxSlaMetrics(): Promise<InboxSlaMetrics> {
  return api.get<InboxSlaMetrics>("/metrics/inbox-sla");
}

export function useInboxSlaMetrics() {
  const scope = useTenantContextId() ?? "home";
  return useQuery({
    queryKey: ["metrics", "inbox-sla", scope],
    queryFn: fetchInboxSlaMetrics,
    refetchInterval: 60_000,
    retry: false,
  });
}
