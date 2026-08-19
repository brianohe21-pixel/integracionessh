"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { VoiceAgentHttpTool, VoiceAgentHttpToolTestResult } from "@/types";

export interface VoiceAgentHttpToolInput {
  name: string;
  description: string;
  httpUrl: string;
  httpMethod: "GET" | "POST" | "PATCH";
  httpBody?: string;
  httpHeaders?: Array<{ key: string; value: string }>;
  httpResponseVariable?: string;
  parametersJson?: string;
  instruction?: string;
  enabled?: boolean;
  sortOrder?: number;
}

export function useVoiceAgentTools(botId: string) {
  return useQuery({
    queryKey: ["voice-agent-tools", botId],
    queryFn: () =>
      api.get<{ tools: VoiceAgentHttpTool[] }>(
        `/bots/${encodeURIComponent(botId)}/telephony/tools`
      ),
    enabled: Boolean(botId),
  });
}

export function useVoiceAgentToolSecrets(botId: string) {
  return useQuery({
    queryKey: ["voice-agent-tool-secrets", botId],
    queryFn: () =>
      api.get<{ secrets: Array<{ name: string; configured: boolean }> }>(
        `/bots/${encodeURIComponent(botId)}/telephony/tools/secrets`
      ),
    enabled: Boolean(botId),
  });
}

export function useCreateVoiceAgentTool(botId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: VoiceAgentHttpToolInput) =>
      api.post<VoiceAgentHttpTool>(
        `/bots/${encodeURIComponent(botId)}/telephony/tools`,
        input
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["voice-agent-tools", botId] });
    },
  });
}

export function useUpdateVoiceAgentTool(botId: string, toolId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<VoiceAgentHttpToolInput>) =>
      api.put<VoiceAgentHttpTool>(
        `/bots/${encodeURIComponent(botId)}/telephony/tools/${encodeURIComponent(toolId)}`,
        input
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["voice-agent-tools", botId] });
    },
  });
}

export function useDeleteVoiceAgentTool(botId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (toolId: string) =>
      api.delete(
        `/bots/${encodeURIComponent(botId)}/telephony/tools/${encodeURIComponent(toolId)}`
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["voice-agent-tools", botId] });
    },
  });
}

export function useTestVoiceAgentTool(botId: string, toolId: string) {
  return useMutation({
    mutationFn: (payload: { args?: Record<string, unknown>; variables?: Record<string, string> }) =>
      api.post<VoiceAgentHttpToolTestResult>(
        `/bots/${encodeURIComponent(botId)}/telephony/tools/${encodeURIComponent(toolId)}/test`,
        payload
      ),
  });
}

export function useSaveVoiceAgentToolSecret(botId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { name: string; value: string }) =>
      api.put<{ name: string; configured: boolean }>(
        `/bots/${encodeURIComponent(botId)}/telephony/tools/secrets`,
        payload
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["voice-agent-tool-secrets", botId] });
    },
  });
}

export function useDeleteVoiceAgentToolSecret(botId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (name: string) =>
      api.delete(
        `/bots/${encodeURIComponent(botId)}/telephony/tools/secrets/${encodeURIComponent(name)}`
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["voice-agent-tool-secrets", botId] });
    },
  });
}
