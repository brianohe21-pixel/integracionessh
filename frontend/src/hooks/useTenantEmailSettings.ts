"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { TenantEmailSettingsResponse } from "@/types";

export const TENANT_EMAIL_SETTINGS_KEY = ["tenant-email-settings"] as const;

export function useTenantEmailSettings(enabled = true) {
  return useQuery({
    queryKey: TENANT_EMAIL_SETTINGS_KEY,
    queryFn: () => api.get<TenantEmailSettingsResponse>("/tenants/me/email-settings"),
    enabled,
    refetchOnWindowFocus: true,
  });
}

export function useUpdateTenantEmailSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { enabled?: boolean; fromEmail?: string; fromName?: string }) =>
      api.put<TenantEmailSettingsResponse>("/tenants/me/email-settings", payload),
    onSuccess: (data) => qc.setQueryData(TENANT_EMAIL_SETTINGS_KEY, data),
  });
}

export function useRegisterTenantEmailDomain() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (domain: string) =>
      api.put<TenantEmailSettingsResponse>("/tenants/me/email-settings/domain", { domain }),
    onSuccess: (data) => qc.setQueryData(TENANT_EMAIL_SETTINGS_KEY, data),
  });
}

export function useVerifyTenantEmailDomain() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      api.post<TenantEmailSettingsResponse>("/tenants/me/email-settings/domain/verify", {}),
    onSuccess: (data) => qc.setQueryData(TENANT_EMAIL_SETTINGS_KEY, data),
  });
}

export function useRemoveTenantEmailDomain() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.delete<TenantEmailSettingsResponse>("/tenants/me/email-settings/domain"),
    onSuccess: (data) => qc.setQueryData(TENANT_EMAIL_SETTINGS_KEY, data),
  });
}
