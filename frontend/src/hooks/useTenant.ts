"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Tenant } from "@/types";

export const TENANT_QUERY_KEY = ["tenant"] as const;

export function useTenant(enabled = true) {
  return useQuery({
    queryKey: TENANT_QUERY_KEY,
    queryFn: () => api.get<Tenant>("/tenants/me"),
    enabled,
  });
}

export function useUpdateTenant() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { name: string }) => api.put<Tenant>("/tenants/me", body),
    onSuccess: (tenant) => {
      queryClient.setQueryData(TENANT_QUERY_KEY, tenant);
      queryClient.setQueryData(["tenants", "me"], tenant);
      void queryClient.invalidateQueries({ queryKey: TENANT_QUERY_KEY });
      void queryClient.invalidateQueries({ queryKey: ["tenants", "me"] });
    },
  });
}
