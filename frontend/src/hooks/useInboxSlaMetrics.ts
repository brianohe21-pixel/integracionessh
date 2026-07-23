"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { InboxSlaMetrics } from "@/types";

async function fetchInboxSlaMetrics(): Promise<InboxSlaMetrics> {
  return api.get<InboxSlaMetrics>("/metrics/inbox-sla");
}

export function useInboxSlaMetrics() {
  return useQuery({
    queryKey: ["metrics", "inbox-sla"],
    queryFn: fetchInboxSlaMetrics,
    refetchInterval: 60_000,
    retry: false,
  });
}
