"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Lead, LeadsListResponse, LeadStatus } from "@/types";

export function useAdsLeads(options?: {
  status?: LeadStatus;
  botId?: string;
  attributionSource?: "meta_ctwa" | "meta_lead_ads";
  q?: string;
}) {
  const params = new URLSearchParams();
  params.set("adsOnly", "true");
  if (options?.status) params.set("status", options.status);
  if (options?.botId) params.set("botId", options.botId);
  if (options?.attributionSource) params.set("attributionSource", options.attributionSource);
  if (options?.q) params.set("q", options.q);
  const qs = `?${params.toString()}`;

  return useQuery({
    queryKey: ["ads-leads", options],
    queryFn: () => api.get<LeadsListResponse>(`/leads${qs}`),
  });
}

export function useAdsLeadMetrics(leads: Lead[]) {
  const ctwa = leads.filter(
    (lead) => lead.attribution?.source === "meta_ctwa" || lead.metaFlowId === "meta_ctwa"
  ).length;
  const leadAds = leads.filter(
    (lead) =>
      lead.attribution?.source === "meta_lead_ads" || lead.metaFlowId === "meta_lead_ads"
  ).length;
  const converted = leads.filter((lead) => lead.status === "converted").length;
  const active = leads.filter((lead) =>
    ["new", "contacted", "qualified"].includes(lead.status)
  ).length;

  return {
    total: leads.length,
    ctwa,
    leadAds,
    converted,
    active,
    conversionRate: leads.length ? Math.round((converted / leads.length) * 100) : 0,
  };
}
