"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Conversation, Message } from "@/types";

export function useConversations(botId?: string) {
  return useQuery({
    queryKey: ["conversations", "list", botId ?? "all"],
    queryFn: async () => {
      const qs = botId ? `?botId=${encodeURIComponent(botId)}` : "";
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
