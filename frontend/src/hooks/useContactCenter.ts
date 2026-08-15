"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type {
  AgentPresence,
  ContactCenterIvrFlow,
  ContactCenterQueue,
  ContactCenterWallboard,
  SoftphoneTokenResponse,
  VoiceCampaign,
} from "@/types";

export function useContactCenterQueues(botId?: string) {
  const qs = botId ? `?botId=${encodeURIComponent(botId)}` : "";
  return useQuery({
    queryKey: ["cc-queues", botId],
    queryFn: () => api.get<{ items: ContactCenterQueue[] }>(`/contact-center/queues${qs}`),
  });
}

export function useContactCenterIvr(botId?: string) {
  const qs = botId ? `?botId=${encodeURIComponent(botId)}` : "";
  return useQuery({
    queryKey: ["cc-ivr", botId],
    queryFn: () => api.get<{ items: ContactCenterIvrFlow[] }>(`/contact-center/ivr${qs}`),
  });
}

export function useContactCenterCampaigns(botId?: string) {
  const qs = botId ? `?botId=${encodeURIComponent(botId)}` : "";
  return useQuery({
    queryKey: ["cc-campaigns", botId],
    queryFn: () => api.get<{ items: VoiceCampaign[] }>(`/contact-center/campaigns${qs}`),
  });
}

export function useContactCenterWallboard(enabled = true) {
  return useQuery({
    queryKey: ["cc-wallboard"],
    queryFn: () => api.get<ContactCenterWallboard>("/contact-center/wallboard"),
    refetchInterval: 5000,
    enabled,
  });
}

export function useMyPresence() {
  return useQuery({
    queryKey: ["cc-presence"],
    queryFn: () => api.get<AgentPresence>("/contact-center/me/presence"),
    refetchInterval: 15000,
  });
}

export function useSoftphoneToken() {
  return useMutation({
    mutationFn: () => api.post<SoftphoneTokenResponse>("/contact-center/me/token", {}),
  });
}

export function useUpdatePresence() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: Partial<AgentPresence>) =>
      api.put<AgentPresence>("/contact-center/me/presence", body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["cc-presence"] });
      void queryClient.invalidateQueries({ queryKey: ["cc-wallboard"] });
    },
  });
}

export function useCreateQueue() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      api.post<ContactCenterQueue>("/contact-center/queues", body),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["cc-queues"] }),
  });
}

export function useUpdateQueue() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ queueId, body }: { queueId: string; body: Record<string, unknown> }) =>
      api.put<ContactCenterQueue>(`/contact-center/queues/${queueId}`, body),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["cc-queues"] }),
  });
}

export function useCreateIvr() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      api.post<ContactCenterIvrFlow>("/contact-center/ivr", body),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["cc-ivr"] }),
  });
}

export function useUpdateIvr() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ ivrFlowId, body }: { ivrFlowId: string; body: Record<string, unknown> }) =>
      api.put<ContactCenterIvrFlow>(`/contact-center/ivr/${ivrFlowId}`, body),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["cc-ivr"] }),
  });
}

export function useSaveRouting() {
  return useMutation({
    mutationFn: ({
      botId,
      body,
    }: {
      botId: string;
      body: {
        telephonyRoutingMode: "ai" | "ivr" | "queue";
        telephonyQueueId?: string;
        telephonyIvrFlowId?: string;
      };
    }) => api.put(`/contact-center/routing/${botId}`, body),
  });
}

export function useAssignAdvisorVoice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      advisorId: string;
      queueIds: string[];
      skills?: string[];
      voiceEnabled?: boolean;
    }) => api.put("/contact-center/advisors/voice", body),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["advisors"] }),
  });
}

export function useCreateVoiceCampaign() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      api.post<VoiceCampaign>("/contact-center/campaigns", body),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["cc-campaigns"] }),
  });
}

export function useStartVoiceCampaign() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (campaignId: string) =>
      api.post<VoiceCampaign>(`/contact-center/campaigns/${campaignId}/start`, {}),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["cc-campaigns"] }),
  });
}

export function usePauseVoiceCampaign() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (campaignId: string) =>
      api.post<VoiceCampaign>(`/contact-center/campaigns/${campaignId}/pause`, {}),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["cc-campaigns"] }),
  });
}

export function useSuperviseCall() {
  return useMutation({
    mutationFn: ({ callId, role }: { callId: string; role: "monitor" | "whisper" | "barge" }) =>
      api.post(`/contact-center/calls/${callId}/supervise`, { role }),
  });
}

export function useHoldCall() {
  return useMutation({
    mutationFn: ({ callId, hold }: { callId: string; hold: boolean }) =>
      api.post(`/contact-center/calls/${callId}/hold`, { hold }),
  });
}

export function useTransferCall() {
  return useMutation({
    mutationFn: (body: {
      callId: string;
      targetQueueId?: string;
      targetAdvisorId?: string;
      warm?: boolean;
    }) =>
      api.post(`/contact-center/calls/${body.callId}/transfer`, {
        targetQueueId: body.targetQueueId,
        targetAdvisorId: body.targetAdvisorId,
        warm: body.warm,
      }),
  });
}

export function useSetDisposition() {
  return useMutation({
    mutationFn: ({ callId, disposition }: { callId: string; disposition: string }) =>
      api.put(`/contact-center/calls/${callId}/disposition`, { disposition }),
  });
}

export function useCallCopilot() {
  return useMutation({
    mutationFn: (callId: string) =>
      api.post<{ summary: string }>(`/contact-center/calls/${callId}/copilot`, {}),
  });
}

export function useClickToCall() {
  return useMutation({
    mutationFn: (body: { botId: string; to: string }) =>
      api.post<{ callId: string }>("/contact-center/calls/outbound", body),
  });
}
