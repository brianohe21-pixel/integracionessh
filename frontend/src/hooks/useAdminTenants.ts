"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Tenant, TenantPlan } from "@/types";

export function useAdminTenants() {
  return useQuery({
    queryKey: ["admin-tenants"],
    queryFn: () => api.get<Tenant[]>("/tenants"),
  });
}

export function useAdminUpdateTenant() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: {
      tenantId: string;
      plan?: TenantPlan;
      status?: "active" | "suspended";
    }) =>
      api.put<Tenant>(`/tenants/${input.tenantId}`, {
        ...(input.plan !== undefined ? { plan: input.plan } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-tenants"] });
    },
  });
}
