"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { ResolvedTenantBranding } from "@/types";

export interface TenantBrandingResponse extends ResolvedTenantBranding {
  canCustomize: boolean;
}

export function useTenantBranding(enabled = true) {
  return useQuery({
    queryKey: ["tenant-branding"],
    queryFn: () => api.get<TenantBrandingResponse>("/tenants/me/branding"),
    staleTime: 5 * 60 * 1000,
    enabled,
  });
}

export function useUpdateTenantBranding() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { brandName?: string; primaryColor?: string }) =>
      api.put<TenantBrandingResponse>("/tenants/me/branding", body),
    onSuccess: (data) => {
      queryClient.setQueryData(["tenant-branding"], data);
    },
  });
}

export function useUploadTenantLogo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (file: File) => {
      const contentType = file.type || "image/png";
      const { uploadUrl, branding } = await api.post<{
        uploadUrl: string;
        branding: TenantBrandingResponse;
      }>("/tenants/me/branding/logo", { contentType });

      const uploadResponse = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": contentType },
        body: file,
      });
      if (!uploadResponse.ok) {
        throw new Error("Logo upload failed");
      }

      return branding;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["tenant-branding"], data);
    },
  });
}

export function useDeleteTenantLogo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.delete<TenantBrandingResponse>("/tenants/me/branding/logo"),
    onSuccess: (data) => {
      queryClient.setQueryData(["tenant-branding"], data);
    },
  });
}
