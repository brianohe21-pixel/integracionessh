"use client";

import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { AvailableSlot, Booking, PaymentRequest } from "@/types";

function bookingSlotsRange() {
  const from = new Date().toISOString();
  const to = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  return { from, to };
}

export function useConversationBookingSlots(
  conversationId: string,
  botId: string,
  enabled = true
) {
  const { from, to } = useMemo(
    () => (enabled ? bookingSlotsRange() : { from: "", to: "" }),
    [conversationId, botId, enabled]
  );
  const params = new URLSearchParams({ botId, from, to });

  return useQuery({
    queryKey: ["conversations", conversationId, "booking-slots", botId, from, to],
    queryFn: () =>
      api.get<{ enabled: boolean; slots: AvailableSlot[]; timezone?: string }>(
        `/conversations/${encodeURIComponent(conversationId)}/booking-slots?${params.toString()}`
      ),
    enabled: Boolean(conversationId && botId && enabled),
    staleTime: 60_000,
  });
}

export function useCreateConversationBooking(conversationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { botId: string; startAt: string; notes?: string }) =>
      api.post<{ booking: Booking; payment?: PaymentRequest }>(
        `/conversations/${encodeURIComponent(conversationId)}/bookings`,
        payload
      ),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({
        queryKey: ["conversations", conversationId, "booking-slots"],
      });
      void queryClient.invalidateQueries({
        queryKey: ["conversations", conversationId, "messages"],
      });
      void queryClient.invalidateQueries({ queryKey: ["conversation-messages", conversationId] });
      void queryClient.invalidateQueries({ queryKey: ["calendar", variables.botId, "bookings"] });
      void queryClient.invalidateQueries({ queryKey: ["conversations"] });
    },
  });
}
