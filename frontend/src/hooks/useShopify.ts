"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

export type ShopifyNotificationEvent =
  | "abandoned_checkout"
  | "order_paid"
  | "order_cancelled"
  | "fulfillment_shipped";

export interface ShopifyTemplateMapping {
  templateName: string;
  templateLanguage: string;
  variableKeys: string[];
}

export interface ShopifyConnectionView {
  connected: boolean;
  configured: boolean;
  enabled: boolean;
  status?: "pending" | "connected" | "error" | "disconnected";
  shopDomain?: string;
  botId?: string;
  abandonDelayMinutes: number;
  defaultCountry: string;
  templates: Partial<Record<ShopifyNotificationEvent, ShopifyTemplateMapping>>;
  connectedAt?: string;
  lastError?: string;
}

export interface ShopifyDelivery {
  deliveryId: string;
  tenantId: string;
  event: ShopifyNotificationEvent;
  phone?: string;
  templateName?: string;
  status: "sent" | "skipped" | "failed";
  reason?: string;
  shopifyResourceId?: string;
  createdAt: string;
}

export function useShopifyConnection() {
  return useQuery({
    queryKey: ["shopify-connection"],
    queryFn: () => api.get<ShopifyConnectionView>("/shopify/connection"),
    staleTime: 30_000,
  });
}

export function useShopifyDeliveries() {
  return useQuery({
    queryKey: ["shopify-deliveries"],
    queryFn: () => api.get<{ deliveries: ShopifyDelivery[] }>("/shopify/deliveries"),
    staleTime: 15_000,
  });
}

export function useStartShopifyOAuth() {
  return useMutation({
    mutationFn: (shop: string) =>
      api.post<{ authUrl: string; state: string }>("/shopify/oauth/start", { shop }),
  });
}

export function useUpdateShopifyConnection() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      enabled?: boolean;
      botId?: string;
      abandonDelayMinutes?: number;
      defaultCountry?: string;
      templates?: Partial<Record<ShopifyNotificationEvent, ShopifyTemplateMapping>>;
    }) => api.patch<ShopifyConnectionView>("/shopify/connection", body),
    onSuccess: (data) => {
      queryClient.setQueryData(["shopify-connection"], data);
      queryClient.invalidateQueries({ queryKey: ["apps"] });
    },
  });
}

export function useDisconnectShopify() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.delete<ShopifyConnectionView>("/shopify/connection"),
    onSuccess: (data) => {
      queryClient.setQueryData(["shopify-connection"], data);
      queryClient.invalidateQueries({ queryKey: ["apps"] });
      queryClient.invalidateQueries({ queryKey: ["shopify-deliveries"] });
    },
  });
}
