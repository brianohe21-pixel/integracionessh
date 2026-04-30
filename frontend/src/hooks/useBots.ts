"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Bot } from "@/types";

export function useBots() {
  return useQuery({
    queryKey: ["bots"],
    queryFn: () => api.get<Bot[]>("/bots"),
  });
}

export function useBot(botId: string) {
  return useQuery({
    queryKey: ["bots", botId],
    queryFn: () => api.get<Bot>(`/bots/${botId}`),
    enabled: !!botId,
  });
}

export function useCreateBot() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<Bot>) => api.post<Bot>("/bots", data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["bots"] }),
  });
}

export function useUpdateBot(botId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<Bot>) => api.put<Bot>(`/bots/${botId}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bots"] });
      queryClient.invalidateQueries({ queryKey: ["bots", botId] });
    },
  });
}

export function useDeleteBot() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (botId: string) => api.delete(`/bots/${botId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["bots"] }),
  });
}
