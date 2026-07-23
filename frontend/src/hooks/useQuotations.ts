"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { PaymentRequest, Quotation } from "@/types";

export function useConversationQuotations(conversationId: string, botId: string) {
  return useQuery<{ quotations: Quotation[] }>({
    queryKey: ["conversations", conversationId, "quotations"],
    queryFn: () =>
      api.get<{ quotations: Quotation[] }>(
        `/conversations/${conversationId}/quotations?botId=${botId}`
      ),
    enabled: Boolean(conversationId && botId),
  });
}

export function useCreateQuotation(conversationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: {
      botId: string;
      items: Array<{ description: string; quantity: number; unitPriceInCents: number }>;
      notes?: string;
      validUntil?: string;
      paymentDescription?: string;
    }) =>
      api.post<{ quotation: Quotation; payment: PaymentRequest }>(
        `/conversations/${conversationId}/quotations`,
        payload
      ),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({
        queryKey: ["conversations", conversationId, "quotations"],
      });
      void queryClient.invalidateQueries({
        queryKey: ["conversations", conversationId, "messages"],
      });
      void queryClient.invalidateQueries({
        queryKey: ["payments", variables.botId, "requests"],
      });
    },
  });
}
