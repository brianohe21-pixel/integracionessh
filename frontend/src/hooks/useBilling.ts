"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { PaidBillingPlan } from "@/lib/plan-config";
import type {
  AiMessagePack,
  AiUsageSnapshot,
  BillingUsageResponse,
  PaymentIntent,
  TenantPlan,
} from "@/types";

export type BillingProvider = "wompi" | "stripe";

export interface BillingPlanPrice {
  amountCents?: number;
  listPriceUsd?: number;
  currency: string;
  periodDays: number;
  trm?: number;
  salesOnly?: boolean;
  renewalOnly?: boolean;
  maxMessagesPerMonth?: number;
}

export interface WompiCheckoutParams {
  publicKey: string;
  currency: string;
  amountInCents: number;
  reference: string;
  signatureIntegrity: string;
  redirectUrl: string;
  customerEmail: string;
}

export interface StarterCheckoutBreakdown {
  planFeeCents: number;
  templatesAcceptedCount: number;
  unitPriceCents: number;
  templateFeeCents: number;
  totalCents: number;
  trm?: number;
}

export interface TemplateBillingStatus {
  templatesAcceptedCount: number;
  unitPriceCents: number;
  templateFeeCents: number;
  creditCapCount: number | null;
  creditCapReached: boolean;
  templatesBlocked: boolean;
  blockReason: "past_due" | "credit_cap" | "subscription" | null;
}

export interface BillingCheckoutResponse {
  url: string;
  reference?: string;
  provider: BillingProvider;
  kind?: "plan" | "ai_pack";
  aiPack?: AiMessagePack;
  wompi?: WompiCheckoutParams;
  breakdown?: StarterCheckoutBreakdown;
}

export interface BillingProvidersResponse {
  wompi: boolean;
  stripe: boolean;
  default: BillingProvider | null;
  plans?: {
    starter?: BillingPlanPrice;
    pro?: BillingPlanPrice;
  };
  aiPacks?: AiMessagePack[];
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
  aiUsage?: AiUsageSnapshot;
  aiPacks?: AiMessagePack[];
  canPurchaseAiPacks?: boolean;
  subscriptionStatus: string;
  currentPeriodEnd: string | null;
  paymentProvider: BillingProvider | string;
  canRenew: boolean;
  isExpired: boolean;
  templateBilling?: TemplateBillingStatus;
  checkoutBreakdown?: StarterCheckoutBreakdown | null;
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
  kind?: "plan" | "ai_pack";
  aiPackId?: string | null;
  aiMessagesGranted?: number | null;
  status: "pending" | "approved" | "declined";
  amountInCents: number;
  wompiTransactionId: string | null;
}

export function useBillingPayments() {
  return useQuery({
    queryKey: ["billing-payments"],
    queryFn: () => api.get<PaymentIntent[]>("/billing/payments"),
  });
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
    mutationFn: (
      input:
        | { plan: PaidBillingPlan; provider?: BillingProvider; aiPackId?: never }
        | { aiPackId: string; provider?: BillingProvider; plan?: never }
    ) => api.post<BillingCheckoutResponse>("/billing/checkout", input),
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
      queryClient.invalidateQueries({ queryKey: ["billing-payments"] });
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
