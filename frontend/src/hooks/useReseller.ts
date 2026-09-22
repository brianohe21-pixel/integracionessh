"use client";

import { useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, setTenantContext } from "@/lib/api";
import type { Tenant, ResellerLimitsOverride, SubaccountServiceId, MonthlyUsage } from "@/types";
import type { ResellerBag } from "@/lib/subaccount-services";

export interface SubaccountsResponse {
  items: Tenant[];
  maxSubaccounts: number;
  count: number;
  bag?: ResellerBag;
  usagePeriod?: string;
  usageTotals?: Omit<MonthlyUsage, "tenantId">;
}

export interface ResellerDomainDnsRecord {
  type: string;
  name: string;
  value: string;
  purpose: "certificate" | "subdomain";
}

export interface ResellerDomainResponse {
  customDomain: string | null;
  customDomainStatus: string;
  cnameTarget: string;
  amplifyStatus?: string | null;
  amplifyStatusReason?: string | null;
  subdomainVerified?: boolean;
  dnsRecords?: ResellerDomainDnsRecord[];
}

export function useResellerSubaccounts(enabled = true) {
  return useQuery({
    queryKey: ["reseller-subaccounts"],
    queryFn: () => api.get<SubaccountsResponse>("/reseller/subaccounts"),
    enabled,
  });
}

export function useCreateSubaccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      name: string;
      email: string;
      ownerName?: string;
      plan?: "free" | "starter" | "pro";
      inviteOwner?: boolean;
      enabledServices?: SubaccountServiceId[];
      serviceLimits?: ResellerLimitsOverride;
    }) =>
      api.post<{
        tenant: Tenant;
        invite?: {
          username: string;
          temporaryPassword: string;
          emailSent: boolean;
          emailFailureReason?: string;
        };
      }>("/reseller/subaccounts", body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reseller-subaccounts"] });
    },
  });
}

export function useDeleteSubaccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (subaccountId: string) =>
      api.delete<void>(`/reseller/subaccounts/${subaccountId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reseller-subaccounts"] });
    },
  });
}

export function useSendSubaccountCredentials() {
  return useMutation({
    mutationFn: (subaccountId: string) =>
      api.post<{
        invite: {
          username: string;
          temporaryPassword: string;
          emailSent: boolean;
          created: boolean;
          emailFailureReason?: string;
        };
      }>(`/reseller/subaccounts/${subaccountId}/send-credentials`, {}),
  });
}

export function useUpdateSubaccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      subaccountId: string;
      name?: string;
      status?: "active" | "suspended";
      plan?: "free" | "starter" | "pro";
      enabledServices?: SubaccountServiceId[];
      serviceLimits?: ResellerLimitsOverride;
    }) =>
      api.put<Tenant>(`/reseller/subaccounts/${input.subaccountId}`, {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.plan !== undefined ? { plan: input.plan } : {}),
        ...(input.enabledServices !== undefined
          ? { enabledServices: input.enabledServices }
          : {}),
        ...(input.serviceLimits !== undefined ? { serviceLimits: input.serviceLimits } : {}),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reseller-subaccounts"] });
    },
  });
}

export function useAssumeSubaccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (subaccountId: string) =>
      api.post<{ tenantId: string; tenant: Tenant }>(
        `/reseller/subaccounts/${subaccountId}/assume`,
        {}
      ),
    onSuccess: (data) => {
      setTenantContext(data.tenantId);
      queryClient.invalidateQueries();
    },
  });
}

export function useClearTenantContext() {
  const queryClient = useQueryClient();
  return useCallback(() => {
    setTenantContext(null);
    queryClient.invalidateQueries();
  }, [queryClient]);
}

export function useResellerDomain(enabled = true) {
  return useQuery({
    queryKey: ["reseller-domain"],
    queryFn: () => api.get<ResellerDomainResponse>("/reseller/domain"),
    enabled,
    refetchInterval: (query) => {
      const status = query.state.data?.customDomainStatus;
      return status === "pending_dns" ? 15_000 : false;
    },
  });
}

export function useRegisterResellerDomain() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (customDomain: string) =>
      api.put<ResellerDomainResponse>("/reseller/domain", { customDomain }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reseller-domain"] });
      queryClient.invalidateQueries({ queryKey: ["tenants"] });
    },
  });
}

export function useDeleteResellerDomain() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.delete<ResellerDomainResponse>("/reseller/domain"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reseller-domain"] });
      queryClient.invalidateQueries({ queryKey: ["tenants"] });
    },
  });
}
