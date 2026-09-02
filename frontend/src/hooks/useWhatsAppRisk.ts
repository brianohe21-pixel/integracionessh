"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { TenantWhatsAppRiskSummary } from "@/types";

export interface WhatsAppRiskResponse {
  tenant: TenantWhatsAppRiskSummary;
  byBot: Record<string, TenantWhatsAppRiskSummary>;
}

export function useWhatsAppRisk(enabled = true) {
  return useQuery({
    queryKey: ["whatsapp-risk"],
    queryFn: () => api.get<WhatsAppRiskResponse>("/tenants/me/whatsapp-risk"),
    enabled,
    staleTime: 60_000,
  });
}

export function resolveWhatsAppRisk(
  data: WhatsAppRiskResponse | undefined,
  botId?: string | null
): TenantWhatsAppRiskSummary | null {
  if (!data) return null;
  if (botId && data.byBot[botId]) return data.byBot[botId];
  return data.tenant;
}
