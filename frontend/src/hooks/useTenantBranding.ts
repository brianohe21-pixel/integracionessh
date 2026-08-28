"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { ResolvedTenantBranding } from "@/types";

export interface TenantBrandingResponse extends ResolvedTenantBranding {
  canCustomize: boolean;
}

export const TENANT_BRANDING_QUERY_KEY = ["tenant-branding"] as const;

const MAX_LOGO_BYTES = 1_500_000;

function normalizeLogoContentType(contentType: string): string {
  const normalized = contentType.trim().toLowerCase().split(";")[0]?.trim() ?? "";
  switch (normalized) {
    case "image/png":
    case "image/x-png":
      return "image/png";
    case "image/jpeg":
    case "image/jpg":
    case "image/pjpeg":
      return "image/jpeg";
    case "image/webp":
      return "image/webp";
    case "image/svg+xml":
      return "image/svg+xml";
    default:
      return "image/png";
  }
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result ?? "");
      const base64 = result.includes(",") ? result.split(",")[1]! : result;
      resolve(base64);
    };
    reader.onerror = () => reject(reader.error ?? new Error("Failed to read logo file"));
    reader.readAsDataURL(file);
  });
}

function mergeBrandingCache(
  previous: TenantBrandingResponse | undefined,
  data: TenantBrandingResponse,
  options?: { clearLogo?: boolean }
): TenantBrandingResponse {
  return {
    ...previous,
    ...data,
    canCustomize: data.canCustomize ?? previous?.canCustomize ?? true,
    brandName: data.brandName ?? previous?.brandName,
    primaryColor: data.primaryColor ?? previous?.primaryColor,
    logoUrl: options?.clearLogo ? undefined : data.logoUrl ?? previous?.logoUrl,
  };
}

export function seedTenantBrandingCache(
  queryClient: ReturnType<typeof useQueryClient>,
  data: TenantBrandingResponse
): void {
  queryClient.setQueryData<TenantBrandingResponse>(TENANT_BRANDING_QUERY_KEY, (previous) =>
    mergeBrandingCache(previous, data)
  );
}

export function useTenantBranding(enabled = true) {
  return useQuery({
    queryKey: TENANT_BRANDING_QUERY_KEY,
    queryFn: () => api.get<TenantBrandingResponse>("/tenants/me/branding"),
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    retry: 3,
    retryDelay: (attempt) => Math.min(1000, 200 * (attempt + 1)),
    enabled,
  });
}

export function useUpdateTenantBranding() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { brandName?: string; primaryColor?: string }) =>
      api.put<TenantBrandingResponse>("/tenants/me/branding", body),
    onSuccess: (data) => {
      queryClient.setQueryData<TenantBrandingResponse>(TENANT_BRANDING_QUERY_KEY, (previous) =>
        mergeBrandingCache(previous, data)
      );
    },
  });
}

export function useUploadTenantLogo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (file: File) => {
      if (file.size > MAX_LOGO_BYTES) {
        throw new Error("Logo must be 1.5MB or smaller");
      }
      const contentType = normalizeLogoContentType(file.type || "image/png");
      const data = await fileToBase64(file);
      return api.post<TenantBrandingResponse>("/tenants/me/branding/logo", {
        contentType,
        data,
      });
    },
    onSuccess: (data) => {
      queryClient.setQueryData<TenantBrandingResponse>(TENANT_BRANDING_QUERY_KEY, (previous) =>
        mergeBrandingCache(previous, data)
      );
    },
  });
}

export function useDeleteTenantLogo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.delete<TenantBrandingResponse>("/tenants/me/branding/logo"),
    onSuccess: (data) => {
      queryClient.setQueryData<TenantBrandingResponse>(TENANT_BRANDING_QUERY_KEY, (previous) =>
        mergeBrandingCache(previous, data, { clearLogo: true })
      );
    },
  });
}

export function useResetTenantBranding() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.delete<TenantBrandingResponse>("/tenants/me/branding"),
    onSuccess: (data) => {
      queryClient.setQueryData<TenantBrandingResponse>(TENANT_BRANDING_QUERY_KEY, (previous) =>
        mergeBrandingCache(previous, data, { clearLogo: true })
      );
      void queryClient.invalidateQueries({ queryKey: ["tenants", "me"] });
    },
  });
}
