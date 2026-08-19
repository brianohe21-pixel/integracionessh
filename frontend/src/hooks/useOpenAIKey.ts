"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { ProviderCredentialsResponse } from "./useProviderCredentials";

interface OpenAIKeyStatus {
  configured: boolean;
}

function openAIStatusFromResponse(data: ProviderCredentialsResponse | undefined): OpenAIKeyStatus {
  const openai = data?.items?.find((item) => item.provider === "openai");
  return { configured: openai?.source === "own" };
}

export function useOpenAIKeyStatus() {
  return useQuery({
    queryKey: ["openai-key-status"],
    queryFn: async () => {
      const data = await api.get<ProviderCredentialsResponse>("/tenants/me/provider-credentials");
      const normalized = Array.isArray(data?.items) ? data : { items: [] };
      return openAIStatusFromResponse(normalized);
    },
    staleTime: 30_000,
  });
}

export function useSaveOpenAIKey() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (apiKey: string) =>
      api.put("/tenants/me/provider-credentials/openai", { apiKey }),
    onSuccess: () => {
      queryClient.setQueryData<OpenAIKeyStatus>(["openai-key-status"], { configured: true });
      queryClient.invalidateQueries({ queryKey: ["provider-credentials"] });
    },
  });
}

export function useDeleteOpenAIKey() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.delete("/tenants/me/provider-credentials/openai"),
    onSuccess: () => {
      queryClient.setQueryData<OpenAIKeyStatus>(["openai-key-status"], { configured: false });
      queryClient.invalidateQueries({ queryKey: ["provider-credentials"] });
    },
  });
}
