"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Conversation, Message } from "@/types";

export function useConversations(botId?: string) {
  return useQuery({
    queryKey: ["conversations", { botId }],
    queryFn: () =>
      api.get<Conversation[]>(`/conversations${botId ? `?botId=${botId}` : ""}`),
  });
}

export function useConversationMessages(conversationId: string) {
  return useQuery({
    queryKey: ["conversations", conversationId, "messages"],
    queryFn: () => api.get<Message[]>(`/conversations/${conversationId}`),
    enabled: !!conversationId,
    refetchInterval: 5000,
  });
}
