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
  templateName: string;
  language: string;
  segments?: string[];
  scheduledAt?: string;
  recipients?: CampaignRecipient[];
  audienceTags?: string[];
  requireOptIn?: boolean;
}

export interface UpdateCampaignInput {
  name?: string;
  segments?: string[];
  scheduledAt?: string | null;
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
    refetchInterval: (query) => {
      const data = query.state.data;
      if (!data) return 5_000;
      if (data.status === "running") return 3_000;
      if (data.status === "scheduled") return 10_000;
      return false;
    },
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["campaigns"] });
    },
  });
}
