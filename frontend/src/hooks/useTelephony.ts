"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type {
  CallEvent,
  CallRecord,
  IntegrationEvent,
  Message,
  VoiceAgentWebhookDelivery,
} from "@/types";

export interface TelephonySettings {
  telephonyEnabled?: boolean;
  telephonyPhoneNumber?: string;
  telephonyVoiceId?: string;
  telephonyModel?: string;
  telephonyGreeting?: string;
  telephonySystemPrompt?: string;
  telephonyRecordingEnabled?: boolean;
  telephonyRecordingNotice?: string;
  telephonyWebhookUrl?: string;
  telephonyWebhookSecret?: string;
  telephonyWebhookEnabled?: boolean;
  telephonyWebhookEvents?: IntegrationEvent[];
}

export interface TelnyxNumber {
  id: string;
  phoneNumber: string;
  status: string;
}

export interface TelnyxVoice {
  id: string;
  name: string;
}

export function useTelephonySettings(botId: string) {
  return useQuery({
    queryKey: ["telephony-settings", botId],
    queryFn: () =>
      api.get<TelephonySettings>(`/bots/${encodeURIComponent(botId)}/telephony/settings`),
    enabled: Boolean(botId),
  });
}

export function useTelephonyNumbers() {
  return useQuery({
    queryKey: ["telephony-numbers"],
    queryFn: () => api.get<{ numbers: TelnyxNumber[] }>("/telephony/numbers"),
  });
}

export function useTelephonyVoices() {
  return useQuery({
    queryKey: ["telephony-voices"],
    queryFn: () => api.get<{ voices: TelnyxVoice[] }>("/telephony/voices"),
  });
}

export function useTelephonyCalls(botId: string) {
  return useQuery({
    queryKey: ["telephony-calls", botId],
    queryFn: () =>
      api.get<{ items: CallRecord[] }>(
        `/bots/${encodeURIComponent(botId)}/telephony/calls`
      ),
    enabled: Boolean(botId),
    refetchInterval: 10_000,
  });
}

export function useTelephonyCall(botId: string, callId?: string) {
  return useQuery({
    queryKey: ["telephony-call", botId, callId],
    queryFn: () =>
      api.get<CallRecord>(
        `/bots/${encodeURIComponent(botId)}/telephony/calls/${encodeURIComponent(callId!)}`
      ),
    enabled: Boolean(botId && callId),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (status === "initiated" || status === "ringing" || status === "accepted") {
        return 3000;
      }
      return false;
    },
  });
}

export function useTelephonyCallEvents(botId: string, callId?: string) {
  return useQuery({
    queryKey: ["telephony-call-events", botId, callId],
    queryFn: () =>
      api.get<{ items: CallEvent[] }>(
        `/bots/${encodeURIComponent(botId)}/telephony/calls/${encodeURIComponent(callId!)}/events`
      ),
    enabled: Boolean(botId && callId),
    refetchInterval: 10_000,
  });
}

export function useTelephonyCallTranscript(
  conversationId?: string,
  callStatus?: CallRecord["status"]
) {
  const active =
    callStatus === "initiated" ||
    callStatus === "ringing" ||
    callStatus === "accepted";

  return useQuery({
    queryKey: ["conversation-messages", conversationId],
    queryFn: async () => {
      const raw = await api.get<unknown>(
        `/conversations/${encodeURIComponent(conversationId!)}`
      );
      return Array.isArray(raw) ? (raw as Message[]) : [];
    },
    enabled: Boolean(conversationId),
    refetchInterval: active ? 5000 : false,
  });
}

export function useTelephonyRecording(botId: string, callId?: string, enabled = true) {
  return useQuery({
    queryKey: ["telephony-recording", botId, callId],
    queryFn: () =>
      api.get<{ url: string; expiresInSeconds: number }>(
        `/bots/${encodeURIComponent(botId)}/telephony/calls/${encodeURIComponent(callId!)}/recording`
      ),
    enabled: Boolean(botId && callId && enabled),
    staleTime: 60_000,
  });
}

export function useVoiceAgentWebhookDeliveries(botId: string) {
  return useQuery({
    queryKey: ["voice-agent-webhook-deliveries", botId],
    queryFn: () =>
      api.get<{ deliveries: VoiceAgentWebhookDelivery[] }>(
        `/bots/${encodeURIComponent(botId)}/telephony/webhook/deliveries`
      ),
    enabled: Boolean(botId),
  });
}

export function useSaveTelephonySettings(botId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: TelephonySettings & { enabled?: boolean }) =>
      api.put<TelephonySettings>(
        `/bots/${encodeURIComponent(botId)}/telephony/settings`,
        payload
      ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["telephony-settings", botId] });
      void qc.invalidateQueries({ queryKey: ["bots"] });
    },
  });
}

export function useStartOutboundCall(botId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { to: string; contactName?: string }) =>
      api.post<{ callId: string; sessionId: string; status: string }>(
        `/bots/${encodeURIComponent(botId)}/telephony/calls`,
        payload
      ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["telephony-calls", botId] });
    },
  });
}

export function useEndTelephonyCall(botId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (callId: string) =>
      api.post<{ callId: string; status: string }>(
        `/bots/${encodeURIComponent(botId)}/telephony/calls/${encodeURIComponent(callId)}/end`,
        {}
      ),
    onSuccess: (_data, callId) => {
      void qc.invalidateQueries({ queryKey: ["telephony-calls", botId] });
      void qc.invalidateQueries({ queryKey: ["telephony-call", botId, callId] });
    },
  });
}

export function useTestVoiceAgentWebhook(botId: string) {
  return useMutation({
    mutationFn: () =>
      api.post<{ sent: boolean }>(
        `/bots/${encodeURIComponent(botId)}/telephony/webhook/test`,
        {}
      ),
  });
}
