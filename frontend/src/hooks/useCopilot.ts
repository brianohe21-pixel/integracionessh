"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Conversation } from "@/types";

export interface CopilotSuggestResponse {
  suggestion: string;
  sources: string[];
}

export interface CopilotAnalyzeResponse {
  detectedIntent: string;
  copilotSummary: string;
  intentDetails?: {
    intent: string;
    confidence: number;
    topics: string[];
  };
  summaryDetails?: {
    summary: string;
    keyPoints: string[];
  };
  conversation?: Conversation | null;
}

export function useCopilotSuggest() {
  return useMutation({
    mutationFn: (body: { conversationId: string; botId: string }) =>
      api.post<CopilotSuggestResponse>(
        `/conversations/${encodeURIComponent(body.conversationId)}/copilot`,
        { botId: body.botId, action: "suggest" }
      ),
  });
}

export function useCopilotAnalyze() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { conversationId: string; botId: string }) =>
      api.post<CopilotAnalyzeResponse>(
        `/conversations/${encodeURIComponent(body.conversationId)}/copilot`,
        { botId: body.botId, action: "analyze" }
      ),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["conversations"] });
      qc.invalidateQueries({ queryKey: ["conversation-messages", vars.conversationId] });
    },
  });
}
