"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { ResellerConfig, ResellerPlanDefaults, Tenant, TenantPlan } from "@/types";

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
      resellerConfig?: Partial<ResellerConfig>;
    }) =>
      api.put<Tenant>(`/tenants/${input.tenantId}`, {
        ...(input.plan !== undefined ? { plan: input.plan } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.resellerConfig !== undefined
          ? { resellerConfig: input.resellerConfig }
          : {}),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-tenants"] });
    },
  });
}

export function useResellerPlanDefaults() {
  return useQuery({
    queryKey: ["admin-reseller-plan-defaults"],
    queryFn: () => api.get<ResellerPlanDefaults>("/admin/reseller-plan-defaults"),
  });
}

export function useUpdateResellerPlanDefaults() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: ResellerPlanDefaults) =>
      api.put<ResellerPlanDefaults>("/admin/reseller-plan-defaults", body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-reseller-plan-defaults"] });
    },
  });
}

export function useActivateResellerDomain() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { tenantId: string; status?: "pending_dns" | "active" | "error" }) =>
      api.post<{
        tenantId: string;
        customDomain?: string;
        customDomainStatus?: string;
      }>("/admin/reseller-domain/activate", input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-tenants"] });
    },
  });
}
