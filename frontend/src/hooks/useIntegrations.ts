"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { IntegrationDelivery, TenantIntegration } from "@/types";

export function useIntegrationWebhook() {
  return useQuery<TenantIntegration>({
    queryKey: ["integrations", "webhook"],
    queryFn: () => api.get<TenantIntegration>("/integrations/webhook"),
  });
}

export function useIntegrationDeliveries() {
  return useQuery<{ deliveries: IntegrationDelivery[] }>({
    queryKey: ["integrations", "deliveries"],
    queryFn: () => api.get<{ deliveries: IntegrationDelivery[] }>("/integrations/deliveries"),
  });
}

export function useUpdateIntegrationWebhook() {
  const queryClient = useQueryClient();
  return useMutation<
    TenantIntegration,
    Error,
    {
      webhookUrl: string;
      webhookSecret?: string;
      subscribedEvents: string[];
      enabled: boolean;
    }
  >({
    mutationFn: (payload) => api.put<TenantIntegration>("/integrations/webhook", payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["integrations"] });
    },
  });
}

export function useTestIntegrationWebhook() {
  return useMutation<{ success: boolean }, Error, void>({
    mutationFn: () => api.post<{ success: boolean }>("/integrations/webhook/test", {}),
  });
}
