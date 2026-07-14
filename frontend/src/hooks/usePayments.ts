"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type {
  MaskedWompiCredentials,
  PaymentRequest,
  PaymentsConfig,
  TenantWompiSecretPayload,
} from "@/types";

export function usePaymentsConfig(botId: string) {
  return useQuery<{ config: PaymentsConfig; wompiConfigured: boolean }>({
    queryKey: ["payments", botId, "config"],
    queryFn: () =>
      api.get<{ config: PaymentsConfig; wompiConfigured: boolean }>(
        `/payments/${botId}/config`
      ),
    enabled: Boolean(botId),
  });
}

export function useWompiCredentials() {
  return useQuery<MaskedWompiCredentials>({
    queryKey: ["payments", "wompi", "credentials"],
    queryFn: () => api.get<MaskedWompiCredentials>("/payments/wompi/credentials"),
  });
}

export function usePaymentRequests(botId: string) {
  return useQuery<{ requests: PaymentRequest[] }>({
    queryKey: ["payments", botId, "requests"],
    queryFn: () => api.get<{ requests: PaymentRequest[] }>(`/payments/${botId}/requests`),
    enabled: Boolean(botId),
  });
}

export function useSavePaymentsConfig(botId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: Partial<PaymentsConfig>) =>
      api.put<{ config: PaymentsConfig }>(`/payments/${botId}/config`, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["payments", botId] });
      void queryClient.invalidateQueries({ queryKey: ["apps"] });
    },
  });
}

export function useSaveWompiCredentials() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: TenantWompiSecretPayload) =>
      api.put<{ saved: boolean }>("/payments/wompi/credentials", payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["payments", "wompi"] });
    },
  });
}

export function useDeleteWompiCredentials() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.delete<{ deleted: boolean }>("/payments/wompi/credentials"),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["payments", "wompi"] });
    },
  });
}

export function useEnablePayments(botId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<{ config: PaymentsConfig }>(`/payments/${botId}/enable`, {}),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["payments", botId] });
      void queryClient.invalidateQueries({ queryKey: ["apps"] });
    },
  });
}

export function useDisablePayments(botId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<{ config: PaymentsConfig }>(`/payments/${botId}/disable`, {}),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["payments", botId] });
      void queryClient.invalidateQueries({ queryKey: ["apps"] });
    },
  });
}

export function useCreatePaymentRequest(botId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: {
      contactPhone: string;
      contactName?: string;
      amountInCents: number;
      description: string;
      customerEmail?: string;
    }) => api.post<{ request: PaymentRequest }>(`/payments/${botId}/requests`, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["payments", botId, "requests"] });
    },
  });
}
