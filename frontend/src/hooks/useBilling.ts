"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { BillingUsageResponse, TenantPlan } from "@/types";

export type BillingProvider = "wompi" | "stripe";

export interface BillingPlanPrice {
  amountCents: number;
  currency: string;
  periodDays: number;
}

export interface BillingProvidersResponse {
  wompi: boolean;
  stripe: boolean;
  default: BillingProvider | null;
  plans?: {
    pro: BillingPlanPrice;
    enterprise: BillingPlanPrice;
  };
}

export function useBillingProviders() {
  return useQuery({
    queryKey: ["billing-providers"],
    queryFn: () => api.get<BillingProvidersResponse>("/billing/providers"),
  });
}

export function useBillingUsage() {
  return useQuery({
    queryKey: ["billing-usage"],
    queryFn: () => api.get<BillingUsageResponse>("/billing/usage"),
  });
}

export function useCheckout() {
  return useMutation({
    mutationFn: (input: { plan: "pro" | "enterprise"; provider?: BillingProvider }) =>
      api.post<{ url: string; reference?: string; provider: BillingProvider }>(
        "/billing/checkout",
        input
      ),
  });
}

export function useConfirmWompiPayment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { id: string; reference: string }) =>
      api.post<{ activated: boolean }>("/billing/wompi/confirm", input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["billing-usage"] });
      queryClient.invalidateQueries({ queryKey: ["tenant"] });
    },
  });
}

export function useBillingPortal() {
  return useMutation({
    mutationFn: () => api.post<{ url: string }>("/billing/portal", {}),
  });
}

export type { TenantPlan };
