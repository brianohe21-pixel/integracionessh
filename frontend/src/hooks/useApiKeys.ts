"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { ApiKey, ApiKeyWithSecret, ApiKeyUsageSummary, ApiKeyUsageLog } from "@/types";

export function useApiKeys() {
  return useQuery<ApiKey[]>({
    queryKey: ["api-keys"],
    queryFn: () => api.get<ApiKey[]>("/api-keys"),
  });
}

export function useApiKeyUsage() {
  return useQuery<ApiKeyUsageSummary[]>({
    queryKey: ["api-keys", "usage"],
    queryFn: () => api.get<ApiKeyUsageSummary[]>("/api-keys/usage"),
  });
}

export function useApiKeyLogs(keyId: string | null, options?: { errorsOnly?: boolean }) {
  const errorsOnly = options?.errorsOnly ?? false;
  return useQuery<ApiKeyUsageLog[]>({
    queryKey: ["api-keys", keyId, "logs", errorsOnly ? "errors" : "all"],
    queryFn: () => {
      const params = new URLSearchParams({ limit: "50" });
      if (errorsOnly) params.set("errorsOnly", "true");
      return api.get<ApiKeyUsageLog[]>(
        `/api-keys/${encodeURIComponent(keyId!)}/logs?${params.toString()}`
      );
    },
    enabled: keyId !== null,
  });
}

export function useCreateApiKey() {
  const queryClient = useQueryClient();
  return useMutation<
    ApiKeyWithSecret,
    Error,
    { name: string; botId: string }
  >({
    mutationFn: (payload) => api.post<ApiKeyWithSecret>("/api-keys", payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["api-keys"] });
    },
  });
}

export function useUpdateApiKey() {
  const queryClient = useQueryClient();
  return useMutation<
    ApiKey,
    Error,
    { keyId: string; name?: string; enabled?: boolean }
  >({
    mutationFn: ({ keyId, ...payload }) => api.patch<ApiKey>(`/api-keys/${keyId}`, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["api-keys"] });
    },
  });
}

export function useDeleteApiKey() {
  const queryClient = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: (keyId) => api.delete(`/api-keys/${keyId}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["api-keys"] });
    },
  });
}
