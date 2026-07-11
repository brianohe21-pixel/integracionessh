"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type {
  CatalogConfig,
  CatalogOrder,
  CatalogProduct,
  MetaCatalogSummary,
  OrderStatus,
  ProductAvailability,
} from "@/types";

export function useCatalogConfig(botId: string) {
  return useQuery<{ config: CatalogConfig }>({
    queryKey: ["catalog", botId, "config"],
    queryFn: () => api.get<{ config: CatalogConfig }>(`/catalog/${botId}/config`),
    enabled: Boolean(botId),
  });
}

export function useMetaCatalogs(botId: string) {
  return useQuery<{ catalogs: MetaCatalogSummary[] }>({
    queryKey: ["catalog", botId, "meta-catalogs"],
    queryFn: () => api.get<{ catalogs: MetaCatalogSummary[] }>(`/catalog/${botId}/meta-catalogs`),
    enabled: Boolean(botId),
  });
}

export function useCatalogProducts(botId: string) {
  return useQuery<{ products: CatalogProduct[] }>({
    queryKey: ["catalog", botId, "products"],
    queryFn: () => api.get<{ products: CatalogProduct[] }>(`/catalog/${botId}/products`),
    enabled: Boolean(botId),
  });
}

export function useCatalogOrders(botId: string, status?: OrderStatus) {
  return useQuery<{ orders: CatalogOrder[] }>({
    queryKey: ["catalog", botId, "orders", status ?? "all"],
    queryFn: () =>
      api.get<{ orders: CatalogOrder[] }>(
        `/catalog/${botId}/orders${status ? `?status=${status}` : ""}`
      ),
    enabled: Boolean(botId),
  });
}

export function useSaveCatalogConfig(botId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: Partial<CatalogConfig>) =>
      api.put<{ config: CatalogConfig }>(`/catalog/${botId}/config`, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["catalog", botId] });
      void queryClient.invalidateQueries({ queryKey: ["apps"] });
    },
  });
}

export function useEnableCatalog(botId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<{ config: CatalogConfig }>(`/catalog/${botId}/enable`, {}),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["catalog", botId] });
      void queryClient.invalidateQueries({ queryKey: ["apps"] });
    },
  });
}

export function useDisableCatalog(botId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<{ config: CatalogConfig }>(`/catalog/${botId}/disable`, {}),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["catalog", botId] });
      void queryClient.invalidateQueries({ queryKey: ["apps"] });
    },
  });
}

export function useLinkMetaCatalog(botId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (metaCatalogId: string) =>
      api.post<{ config: CatalogConfig }>(`/catalog/${botId}/link-catalog`, { metaCatalogId }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["catalog", botId] });
    },
  });
}

export function useSyncCatalog(botId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<{ synced: number; failed: number }>(`/catalog/${botId}/sync`, {}),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["catalog", botId] });
    },
  });
}

export function useCreateCatalogProduct(botId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: {
      retailerId: string;
      name: string;
      description?: string;
      priceInCents: number;
      availability: ProductAvailability;
    }) => api.post<{ product: CatalogProduct }>(`/catalog/${botId}/products`, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["catalog", botId, "products"] });
    },
  });
}

export function useUpdateCatalogProduct(botId: string, productId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: Partial<CatalogProduct>) =>
      api.put<{ product: CatalogProduct }>(`/catalog/${botId}/products/${productId}`, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["catalog", botId, "products"] });
    },
  });
}

export function useDeleteCatalogProduct(botId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (productId: string) =>
      api.delete<{ deleted: boolean }>(`/catalog/${botId}/products/${productId}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["catalog", botId, "products"] });
    },
  });
}

export function useUpdateCatalogOrder(botId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { orderId: string; status: OrderStatus; internalNotes?: string }) =>
      api.patch<{ order: CatalogOrder }>(`/catalog/${botId}/orders/${payload.orderId}`, {
        status: payload.status,
        ...(payload.internalNotes !== undefined ? { internalNotes: payload.internalNotes } : {}),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["catalog", botId, "orders"] });
    },
  });
}

export function useUploadCatalogProductImage(botId: string, productId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (file: File) => {
      const { uploadUrl, s3Key } = await api.post<{ uploadUrl: string; s3Key: string }>(
        `/catalog/${botId}/products/${productId}/image`,
        { filename: file.name, contentType: file.type }
      );
      await fetch(uploadUrl, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type },
      });
      return api.post<{ product: CatalogProduct }>(
        `/catalog/${botId}/products/${productId}/image/finalize`,
        { s3Key }
      );
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["catalog", botId, "products"] });
    },
  });
}
