"use client";

import { useQuery } from "@tanstack/react-query";
import { useTenantContextId } from "@/hooks/useActiveTenant";
import { api } from "@/lib/api";
import type { SmsDlrSource, SmsHistoryPage, SmsHistoryStatus, SmsOverview } from "@/types";

export interface SmsHistoryFilters {
  limit?: number;
  cursor?: string;
  from?: string;
  to?: string;
  source?: SmsDlrSource | "all";
  status?: SmsHistoryStatus | "all";
}

function buildHistoryQuery(filters: SmsHistoryFilters): string {
  const params = new URLSearchParams();
  if (filters.limit) params.set("limit", String(filters.limit));
  if (filters.cursor) params.set("cursor", filters.cursor);
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  if (filters.source && filters.source !== "all") params.set("source", filters.source);
  if (filters.status && filters.status !== "all") params.set("status", filters.status);
  const query = params.toString();
  return query ? `?${query}` : "";
}

export function useSmsOverview() {
  const scope = useTenantContextId() ?? "home";
  return useQuery({
    queryKey: ["sms", "overview", scope],
    queryFn: async () => {
      const data = await api.get<{ overview: SmsOverview }>("/metrics/sms");
      return data.overview;
    },
    refetchInterval: 60_000,
  });
}

export function useSmsHistory(filters: SmsHistoryFilters) {
  const scope = useTenantContextId() ?? "home";
  return useQuery({
    queryKey: ["sms", "history", scope, filters],
    queryFn: () => api.get<SmsHistoryPage>(`/metrics/sms/history${buildHistoryQuery(filters)}`),
    placeholderData: (previous) => previous,
  });
}
