"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Conversation, HandoffMode, Message } from "@/types";

export function useConversations(options?: {
  botId?: string;
  handoffMode?: HandoffMode;
  assignedOnly?: boolean;
}) {
  const params = new URLSearchParams();
  if (options?.botId) params.set("botId", options.botId);
  if (options?.handoffMode) params.set("handoffMode", options.handoffMode);
  const qs = params.toString() ? `?${params.toString()}` : "";

  return useQuery({
    queryKey: ["conversations", "list", options?.botId ?? "all", options?.handoffMode ?? "all"],
    queryFn: async () => {
      const raw = await api.get<unknown>(`/conversations${qs}`);
      return Array.isArray(raw) ? (raw as Conversation[]) : [];
    },
  });
}

export function useConversationMessages(conversationId: string) {
  return useQuery({
    queryKey: ["conversation-messages", conversationId],
    queryFn: async () => {
      const raw = await api.get<unknown>(
        `/conversations/${encodeURIComponent(conversationId)}`
      );
      return Array.isArray(raw) ? (raw as Message[]) : [];
    },
    enabled: !!conversationId,
    refetchInterval: 5000,
  });
}

export function useHandoffConversation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { conversationId: string; botId: string; advisorId?: string }) =>
      api.post<Conversation>(
        `/conversations/${encodeURIComponent(body.conversationId)}/handoff`,
        { botId: body.botId, advisorId: body.advisorId }
      ),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["conversations"] });
      qc.invalidateQueries({ queryKey: ["conversation-messages", vars.conversationId] });
    },
  });
}

export function useReleaseConversation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { conversationId: string; botId: string }) =>
      api.post<Conversation>(
        `/conversations/${encodeURIComponent(body.conversationId)}/release`,
        { botId: body.botId }
      ),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["conversations"] });
      qc.invalidateQueries({ queryKey: ["conversation-messages", vars.conversationId] });
    },
  });
}

export function useSendConversationMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { conversationId: string; botId: string; content: string }) =>
      api.post<Message>(
        `/conversations/${encodeURIComponent(body.conversationId)}/messages`,
        { botId: body.botId, content: body.content }
      ),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["conversation-messages", vars.conversationId] });
      qc.invalidateQueries({ queryKey: ["conversations"] });
    },
  });
}
