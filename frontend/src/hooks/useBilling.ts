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

export interface BillingStatusResponse {
  plan: TenantPlan;
  limits: BillingUsageResponse["limits"];
  usage: BillingUsageResponse["usage"];
  subscriptionStatus: string;
  currentPeriodEnd: string | null;
  paymentProvider: BillingProvider | string;
  canRenew: boolean;
  isExpired: boolean;
}

export function useBillingStatus() {
  return useQuery({
    queryKey: ["billing-status"],
    queryFn: () => api.get<BillingStatusResponse>("/billing/status"),
  });
}

export interface BillingTransactionResponse {
  reference: string;
  plan: TenantPlan;
  status: "pending" | "approved" | "declined";
  amountInCents: number;
  wompiTransactionId: string | null;
}

export function useBillingTransaction(reference: string | null) {
  return useQuery({
    queryKey: ["billing-transaction", reference],
    queryFn: () =>
      api.get<BillingTransactionResponse>(
        `/billing/transaction?reference=${encodeURIComponent(reference!)}`
      ),
    enabled: Boolean(reference),
    refetchInterval: (query) =>
      query.state.data?.status === "pending" ? 2000 : false,
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
      queryClient.invalidateQueries({ queryKey: ["billing-status"] });
      queryClient.invalidateQueries({ queryKey: ["billing-transaction"] });
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
