"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { MetaAppConfigStatus } from "@/types";

export function useMetaAppConfig() {
  return useQuery({
    queryKey: ["meta-app-config"],
    queryFn: () => api.get<MetaAppConfigStatus>("/tenants/me/meta-app"),
    staleTime: 30_000,
  });
}

export function useSaveMetaAppConfig() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      appId: string;
      appSecret: string;
      embeddedSignupConfigId: string;
    }) => api.put<MetaAppConfigStatus>("/tenants/me/meta-app", body),
    onSuccess: (status) => {
      queryClient.setQueryData(["meta-app-config"], status);
      queryClient.invalidateQueries({ queryKey: ["meta-app-config"] });
    },
  });
}

export function useDeleteMetaAppConfig() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.delete<MetaAppConfigStatus>("/tenants/me/meta-app"),
    onSuccess: (status) => {
      queryClient.setQueryData(["meta-app-config"], status);
      queryClient.invalidateQueries({ queryKey: ["meta-app-config"] });
    },
  });
}
