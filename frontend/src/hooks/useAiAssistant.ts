"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { AiAssistantConfig } from "@/types";

export function useAiAssistant(botId: string) {
  return useQuery<AiAssistantConfig>({
    queryKey: ["ai-assistant", botId],
    queryFn: () => api.get<AiAssistantConfig>(`/bots/${botId}/ai-assistant`),
    enabled: Boolean(botId),
  });
}

export function useSaveAiAssistant(botId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: Partial<AiAssistantConfig>) =>
      api.put<AiAssistantConfig>(`/bots/${botId}/ai-assistant`, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["ai-assistant", botId] });
      void queryClient.invalidateQueries({ queryKey: ["bots", botId] });
      void queryClient.invalidateQueries({ queryKey: ["bots"] });
      void queryClient.invalidateQueries({ queryKey: ["apps"] });
    },
  });
}

export function useEnableAiAssistant(botId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: {
      systemPrompt: string;
      model?: string;
      temperature?: number;
      maxTokens?: number;
      knowledgeEnabled?: boolean;
    }) => api.post<AiAssistantConfig>(`/bots/${botId}/ai-assistant/enable`, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["ai-assistant", botId] });
      void queryClient.invalidateQueries({ queryKey: ["bots", botId] });
      void queryClient.invalidateQueries({ queryKey: ["bots"] });
      void queryClient.invalidateQueries({ queryKey: ["apps"] });
    },
  });
}

export function useDisableAiAssistant(botId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<AiAssistantConfig>(`/bots/${botId}/ai-assistant/disable`, {}),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["ai-assistant", botId] });
      void queryClient.invalidateQueries({ queryKey: ["bots", botId] });
      void queryClient.invalidateQueries({ queryKey: ["bots"] });
      void queryClient.invalidateQueries({ queryKey: ["apps"] });
    },
  });
}
