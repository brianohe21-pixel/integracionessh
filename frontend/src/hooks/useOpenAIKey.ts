"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

interface OpenAIKeyStatus {
  configured: boolean;
}

export function useOpenAIKeyStatus() {
  return useQuery({
    queryKey: ["openai-key-status"],
    queryFn: () => api.get<OpenAIKeyStatus>("/tenants/me/openai-key"),
    staleTime: 30_000,
  });
}

export function useSaveOpenAIKey() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (apiKey: string) =>
      api.put<OpenAIKeyStatus>("/tenants/me/openai-key", { apiKey }),
    onSuccess: () => {
      queryClient.setQueryData<OpenAIKeyStatus>(["openai-key-status"], { configured: true });
    },
  });
}

export function useDeleteOpenAIKey() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.delete("/tenants/me/openai-key"),
    onSuccess: () => {
      queryClient.setQueryData<OpenAIKeyStatus>(["openai-key-status"], { configured: false });
    },
  });
}
