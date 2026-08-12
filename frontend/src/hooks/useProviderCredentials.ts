"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

export type ProviderId = "openai" | "telnyx" | "elevenlabs";
export type CredentialSource = "own" | "reseller" | "platform" | "none";

export interface ProviderCredentialStatus {
  provider: ProviderId;
  configured: boolean;
  source: CredentialSource;
  ownerTenantId?: string;
  webhookUrl?: string;
}

export interface ProviderCredentialsResponse {
  items: ProviderCredentialStatus[];
}

export function useProviderCredentials() {
  return useQuery({
    queryKey: ["provider-credentials"],
    queryFn: () => api.get<ProviderCredentialsResponse>("/tenants/me/provider-credentials"),
    staleTime: 30_000,
  });
}

export function useSaveProviderCredential(provider: ProviderId) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: Record<string, string>) =>
      api.put<ProviderCredentialStatus>(`/tenants/me/provider-credentials/${provider}`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["provider-credentials"] });
      queryClient.invalidateQueries({ queryKey: ["openai-key-status"] });
    },
  });
}

export function useDeleteProviderCredential(provider: ProviderId) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      api.delete<ProviderCredentialStatus>(`/tenants/me/provider-credentials/${provider}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["provider-credentials"] });
      queryClient.invalidateQueries({ queryKey: ["openai-key-status"] });
    },
  });
}
