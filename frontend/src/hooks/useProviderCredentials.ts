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

function mergeProviderStatus(
  prev: ProviderCredentialsResponse | undefined,
  status: ProviderCredentialStatus
): ProviderCredentialsResponse {
  const items = Array.isArray(prev?.items) ? [...prev.items] : [];
  const index = items.findIndex((item) => item.provider === status.provider);
  if (index >= 0) items[index] = status;
  else items.push(status);
  return { items };
}

export function useProviderCredentials() {
  return useQuery({
    queryKey: ["provider-credentials"],
    queryFn: async () => {
      const data = await api.get<ProviderCredentialsResponse>("/tenants/me/provider-credentials");
      if (Array.isArray(data?.items)) return data;
      throw new Error("Invalid provider credentials response");
    },
    staleTime: 30_000,
  });
}

export function useSaveProviderCredential(provider: ProviderId) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: Record<string, string>) =>
      api.put<ProviderCredentialStatus>(`/tenants/me/provider-credentials/${provider}`, body),
    onSuccess: (status) => {
      queryClient.setQueryData<ProviderCredentialsResponse>(["provider-credentials"], (prev) =>
        mergeProviderStatus(prev, status)
      );
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
    onSuccess: (status) => {
      queryClient.setQueryData<ProviderCredentialsResponse>(["provider-credentials"], (prev) =>
        mergeProviderStatus(prev, status)
      );
      queryClient.invalidateQueries({ queryKey: ["provider-credentials"] });
      queryClient.invalidateQueries({ queryKey: ["openai-key-status"] });
    },
  });
}
