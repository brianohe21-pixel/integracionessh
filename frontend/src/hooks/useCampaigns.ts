"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Campaign } from "@/types";

export interface CampaignRecipient {
  to: string;
  components?: Array<{
    type: string;
    parameters?: Array<{ type: string; text?: string }>;
  }>;
}

export interface CreateCampaignInput {
  name: string;
  botId: string;
  channel?: "whatsapp" | "sms";
  templateName: string;
  language: string;
  segments?: string[];
  scheduledAt?: string | null;
  batchConfig?: { size: number; delaySeconds: number };
  recipients?: CampaignRecipient[];
  audienceTags?: string[];
  requireOptIn?: boolean;
  requestDlr?: boolean;
}

export type UpdateCampaignInput = CreateCampaignInput;

const DLR_GRACE_MS = 15 * 60 * 1000;

function isAwaitingSmsDlr(campaign: Campaign): boolean {
  return (
    campaign.channel === "sms" &&
    Boolean(campaign.requestDlr) &&
    campaign.sent > 0 &&
    campaign.deliveredCount + campaign.deliveryFailed < campaign.sent
  );
}

function refetchIntervalForCampaign(campaign: Campaign | undefined): number | false {
  if (!campaign) return 5_000;
  if (campaign.status === "running") return 3_000;
  if (campaign.status === "paused") return 15_000;
  if (campaign.status === "scheduled") return 10_000;

  if (isAwaitingSmsDlr(campaign)) {
    const anchor = campaign.completedAt ?? campaign.startedAt ?? campaign.updatedAt;
    const elapsed = Date.now() - new Date(anchor).getTime();
    if (elapsed < DLR_GRACE_MS) return 5_000;
  }

  return false;
}

export function useCampaignList() {
  return useQuery({
    queryKey: ["campaigns"],
    queryFn: () => api.get<Campaign[]>("/campaigns"),
    refetchInterval: 30_000,
  });
}

export function useCampaign(campaignId: string) {
  return useQuery({
    queryKey: ["campaigns", campaignId],
    queryFn: () => api.get<Campaign>(`/campaigns/${campaignId}`),
    refetchInterval: (query) => refetchIntervalForCampaign(query.state.data),
    refetchOnWindowFocus: true,
    enabled: Boolean(campaignId),
  });
}

export function useCampaignRecipients(campaignId: string) {
  return useQuery({
    queryKey: ["campaigns", campaignId, "recipients"],
    queryFn: () => api.get<CampaignRecipient[]>(`/campaigns/${campaignId}/recipients`),
    enabled: Boolean(campaignId),
  });
}

export function useCreateCampaign() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateCampaignInput) =>
      api.post<Campaign>("/campaigns", input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["campaigns"] });
    },
  });
}

export function useUpdateCampaign(campaignId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateCampaignInput) =>
      api.put<Campaign>(`/campaigns/${campaignId}`, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["campaigns"] });
      queryClient.invalidateQueries({ queryKey: ["campaigns", campaignId] });
      queryClient.invalidateQueries({ queryKey: ["campaigns", campaignId, "recipients"] });
    },
  });
}

export function useStartCampaign() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (campaignId: string) =>
      api.post<Campaign>(`/campaigns/${campaignId}/start`, {}),
    onSuccess: (_data, campaignId) => {
      queryClient.invalidateQueries({ queryKey: ["campaigns"] });
      queryClient.invalidateQueries({ queryKey: ["campaigns", campaignId] });
    },
  });
}

export function usePauseCampaign() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (campaignId: string) =>
      api.post<Campaign>(`/campaigns/${campaignId}/pause`, {}),
    onSuccess: (_data, campaignId) => {
      queryClient.invalidateQueries({ queryKey: ["campaigns"] });
      queryClient.invalidateQueries({ queryKey: ["campaigns", campaignId] });
    },
  });
}

export function useResumeCampaign() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (campaignId: string) =>
      api.post<Campaign>(`/campaigns/${campaignId}/resume`, {}),
    onSuccess: (_data, campaignId) => {
      queryClient.invalidateQueries({ queryKey: ["campaigns"] });
      queryClient.invalidateQueries({ queryKey: ["campaigns", campaignId] });
    },
  });
}

export function useCancelCampaign() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (campaignId: string) => api.delete(`/campaigns/${campaignId}`),
    onSuccess: (_data, campaignId) => {
      queryClient.invalidateQueries({ queryKey: ["campaigns"] });
      queryClient.invalidateQueries({ queryKey: ["campaigns", campaignId] });
    },
  });
}

export function useArchiveCampaign() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (campaignId: string) =>
      api.post(`/campaigns/${campaignId}/archive`, {}),
    onSuccess: (_data, campaignId) => {
      queryClient.invalidateQueries({ queryKey: ["campaigns"] });
      queryClient.invalidateQueries({ queryKey: ["campaigns", campaignId] });
    },
  });
}

export function useRetryCampaign() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (campaignId: string) =>
      api.post<Campaign>(`/campaigns/${campaignId}/retry`, {}),
    onSuccess: (_data, campaignId) => {
      queryClient.invalidateQueries({ queryKey: ["campaigns"] });
      queryClient.invalidateQueries({ queryKey: ["campaigns", campaignId] });
      queryClient.invalidateQueries({ queryKey: ["campaigns", campaignId, "metrics"] });
      queryClient.invalidateQueries({ queryKey: ["bulk-failures", "campaign", campaignId] });
    },
  });
}

export function useCloneCampaign() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (campaignId: string) =>
      api.post<Campaign>(`/campaigns/${campaignId}/clone`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["campaigns"] });
    },
  });
}
