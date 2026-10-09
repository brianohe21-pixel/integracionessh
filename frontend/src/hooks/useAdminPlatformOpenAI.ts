"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

export interface PlatformOpenAICredentialStatus {
  configured: boolean;
  maskedKey: string | null;
}

const queryKey = ["admin-platform-openai"];

export function useAdminPlatformOpenAI() {
  return useQuery({
    queryKey,
    queryFn: () => api.get<PlatformOpenAICredentialStatus>("/admin/platform/openai"),
  });
}

export function useSaveAdminPlatformOpenAI() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (apiKey: string) =>
      api.put<PlatformOpenAICredentialStatus>("/admin/platform/openai", { apiKey }),
    onSuccess: (data) => {
      queryClient.setQueryData(queryKey, data);
    },
  });
}

export function useDeleteAdminPlatformOpenAI() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.delete<PlatformOpenAICredentialStatus>("/admin/platform/openai"),
    onSuccess: (data) => {
      queryClient.setQueryData(queryKey, data);
    },
  });
}
