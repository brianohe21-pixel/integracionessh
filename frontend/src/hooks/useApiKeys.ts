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

import type { MetricsDateRange } from "@/lib/metrics-date-range";
import { dateRangeToIso } from "@/lib/metrics-date-range";

function usageQueryParams(range?: MetricsDateRange): string {
  if (!range) return "";
  const { from, to } = dateRangeToIso(range);
  const params = new URLSearchParams({ from: from.slice(0, 10), to: to.slice(0, 10) });
  return `?${params.toString()}`;
}

export function useApiKeyUsage(range?: MetricsDateRange) {
  return useQuery<ApiKeyUsageSummary[]>({
    queryKey: ["api-keys", "usage", range?.from, range?.to],
    queryFn: () => api.get<ApiKeyUsageSummary[]>(`/api-keys/usage${usageQueryParams(range)}`),
  });
}

export function useApiKeyLogs(
  keyId: string | null,
  options?: { errorsOnly?: boolean; range?: MetricsDateRange }
) {
  const errorsOnly = options?.errorsOnly ?? false;
  const range = options?.range;
  return useQuery<ApiKeyUsageLog[]>({
    queryKey: ["api-keys", keyId, "logs", errorsOnly ? "errors" : "all", range?.from, range?.to],
    queryFn: () => {
      const params = new URLSearchParams({ limit: "50" });
      if (errorsOnly) params.set("errorsOnly", "true");
      if (range) {
        const { from, to } = dateRangeToIso(range);
        params.set("from", from.slice(0, 10));
        params.set("to", to.slice(0, 10));
      }
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
