"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTenantContextId } from "@/hooks/useActiveTenant";
import { api } from "@/lib/api";
import type { Lead, LeadMetrics, LeadsListResponse, LeadStatus, MarketingConsent } from "@/types";

export function useLeads(options?: {
  status?: LeadStatus;
  botId?: string;
  metaFlowId?: string;
  adsOnly?: boolean;
  q?: string;
  cursor?: string;
}) {
  const params = new URLSearchParams();
  if (options?.status) params.set("status", options.status);
  if (options?.botId) params.set("botId", options.botId);
  if (options?.metaFlowId) params.set("metaFlowId", options.metaFlowId);
  if (options?.adsOnly) params.set("adsOnly", "true");
  if (options?.q) params.set("q", options.q);
  if (options?.cursor) params.set("cursor", options.cursor);
  const qs = params.toString() ? `?${params.toString()}` : "";

  return useQuery({
    queryKey: ["leads", options],
    queryFn: () => api.get<LeadsListResponse>(`/leads${qs}`),
  });
}

export function useLead(leadId: string | null) {
  return useQuery({
    queryKey: ["leads", leadId],
    queryFn: () => api.get<Lead>(`/leads/${leadId}`),
    enabled: !!leadId,
  });
}

export function useLeadMetrics(options?: { enabled?: boolean }) {
  const scope = useTenantContextId() ?? "home";
  return useQuery({
    queryKey: ["metrics", "leads", scope],
    queryFn: () => api.get<LeadMetrics>("/metrics/leads"),
    enabled: options?.enabled ?? true,
  });
}

export function useCreateLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      botId: string;
      conversationId: string;
      name?: string;
      email?: string;
      notes?: string;
    }) => api.post<Lead>("/leads", body),
    onSuccess: (lead) => {
      qc.invalidateQueries({ queryKey: ["leads"] });
      qc.invalidateQueries({ queryKey: ["metrics", "leads"] });
      qc.invalidateQueries({ queryKey: ["contacts"] });
      qc.invalidateQueries({ queryKey: ["leads", "active"] });
      qc.setQueryData(["leads", "active", lead.phone], lead);
    },
  });
}

export function useUpdateLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      leadId,
      ...body
    }: {
      leadId: string;
      status?: LeadStatus;
      tags?: string[];
      notes?: string;
      assignedAdvisorId?: string | null;
      name?: string;
      email?: string;
    }) => api.patch<Lead>(`/leads/${leadId}`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["leads"] });
      qc.invalidateQueries({ queryKey: ["metrics", "leads"] });
    },
  });
}

export function useConvertLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      leadId,
      marketingConsent,
    }: {
      leadId: string;
      marketingConsent?: MarketingConsent;
    }) =>
      api.post<{ lead: Lead; contact: unknown }>(`/leads/${leadId}/convert`, {
        ...(marketingConsent ? { marketingConsent } : {}),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["leads"] });
      qc.invalidateQueries({ queryKey: ["contacts"] });
      qc.invalidateQueries({ queryKey: ["metrics", "leads"] });
    },
  });
}

export function useLoseLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (leadId: string) => api.post<Lead>(`/leads/${leadId}/lose`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["leads"] });
      qc.invalidateQueries({ queryKey: ["metrics", "leads"] });
    },
  });
}

export function useDeleteLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (leadId: string) => api.delete(`/leads/${leadId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["leads"] });
      qc.invalidateQueries({ queryKey: ["metrics", "leads"] });
    },
  });
}

export function useActiveLeadByPhone(phone: string | undefined) {
  return useQuery({
    queryKey: ["leads", "active", phone],
    queryFn: async () => {
      if (!phone) return null;
      const data = await api.get<LeadsListResponse>(`/leads?q=${encodeURIComponent(phone)}`);
      return (
        data.items.find(
          (l) =>
            l.phone.replace(/\D/g, "") === phone.replace(/\D/g, "") &&
            ["new", "contacted", "qualified"].includes(l.status)
        ) ?? null
      );
    },
    enabled: !!phone,
  });
}
