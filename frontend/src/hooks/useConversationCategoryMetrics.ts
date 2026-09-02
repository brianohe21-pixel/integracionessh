"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { ConversationCategoryMetrics } from "@/types";

function isConversationCategoryMetrics(data: unknown): data is ConversationCategoryMetrics {
  if (!data || typeof data !== "object") return false;
  const metrics = data as ConversationCategoryMetrics;
  return Array.isArray(metrics.byCategory) && typeof metrics.total === "number";
}

async function fetchConversationCategoryMetrics(
  from?: string,
  to?: string,
  botId?: string
): Promise<ConversationCategoryMetrics> {
  const params = new URLSearchParams();
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  if (botId) params.set("botId", botId);
  const query = params.toString();
  const data = await api.get<ConversationCategoryMetrics>(
    `/metrics/conversation-categories${query ? `?${query}` : ""}`
  );
  if (!isConversationCategoryMetrics(data)) {
    throw new Error("Invalid conversation category metrics response");
  }
  return data;
}

export function useConversationCategoryMetrics(from?: string, to?: string, botId?: string) {
  return useQuery({
    queryKey: ["metrics", "conversation-categories", from ?? "default", to ?? "default", botId ?? "all"],
    queryFn: () => fetchConversationCategoryMetrics(from, to, botId),
    refetchInterval: 60_000,
    retry: false,
  });
}
