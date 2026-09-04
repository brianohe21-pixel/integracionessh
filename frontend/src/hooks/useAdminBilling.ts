"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { AdminBillingOverview, PlatformBillingConfig } from "@/types";

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

export function useAdminBillingOverview() {
  return useQuery({
    queryKey: ["admin-billing-overview"],
    queryFn: () => api.get<AdminBillingOverview>("/admin/billing/overview"),
  });
}
