"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Bot } from "@/types";

function normalizeBotsPayload(raw: unknown): Bot[] {
  if (Array.isArray(raw)) return raw as Bot[];
  if (raw && typeof raw === "object") {
    const o = raw as Record<string, unknown>;
    if (Array.isArray(o.data)) return o.data as Bot[];
    if (typeof o.botId === "string") return [raw as Bot];
  }
  if (typeof raw === "string") {
    try {
      return normalizeBotsPayload(JSON.parse(raw) as unknown);
    } catch {
      return [];
    }
  }
  return [];
}

export function useBots() {
  return useQuery({
    queryKey: ["bots", "list"],
    queryFn: async () => {
      const raw = await api.get<unknown>("/bots");
      return normalizeBotsPayload(raw);
    },
    staleTime: 0,
    refetchOnMount: "always",
  });
}

export function useBot(botId: string) {
  return useQuery({
    queryKey: ["bots", "detail", botId],
    queryFn: () => api.get<Bot>(`/bots/${encodeURIComponent(botId)}`),
    enabled: !!botId,
  });
}

export function useCreateBot() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<Bot>) => api.post<Bot>("/bots", data),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["bots"] });
      await queryClient.refetchQueries({ queryKey: ["bots", "list"] });
    },
  });
}

export function useUpdateBot(botId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<Bot>) => api.put<Bot>(`/bots/${encodeURIComponent(botId)}`, data),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["bots"] });
      await queryClient.refetchQueries({ queryKey: ["bots", "list"] });
      await queryClient.invalidateQueries({ queryKey: ["bots", "detail", botId] });
    },
  });
}

export function useDeleteBot() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (botId: string) => api.delete(`/bots/${encodeURIComponent(botId)}`),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["bots"] });
      await queryClient.refetchQueries({ queryKey: ["bots", "list"] });
    },
  });
}
