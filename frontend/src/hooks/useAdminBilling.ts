"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { AdminBillingOverview, PlatformBillingConfig, Tenant } from "@/types";

export function useAdminBillingConfig() {
  return useQuery({
    queryKey: ["admin-billing-config"],
    queryFn: () => api.get<PlatformBillingConfig>("/admin/billing-config"),
  });
}

export function useUpdateAdminBillingConfig() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: Pick<PlatformBillingConfig, "pricePerMessageCents">) =>
      api.put<PlatformBillingConfig>("/admin/billing-config", body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-billing-config"] });
      queryClient.invalidateQueries({ queryKey: ["admin-billing-overview"] });
    },
  });
}

export function useAdminBillingOverview(period?: string) {
  return useQuery({
    queryKey: ["admin-billing-overview", period ?? "current"],
    queryFn: () => {
      const qs =
        period && /^\d{4}-\d{2}$/.test(period)
          ? `?period=${encodeURIComponent(period)}`
          : "";
      return api.get<AdminBillingOverview>(`/admin/billing/overview${qs}`);
    },
  });
}

export function useUpdateTenantBillingPrice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { tenantId: string; pricePerMessageCents: number | null }) =>
      api.put<Tenant>(`/tenants/${input.tenantId}`, {
        pricePerMessageCents: input.pricePerMessageCents,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-billing-overview"] });
      queryClient.invalidateQueries({ queryKey: ["admin-tenants"] });
    },
  });
}
