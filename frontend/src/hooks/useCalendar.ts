"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Booking, BookingStatus, CalendarConfig, AvailableSlot } from "@/types";

export function useCalendarConfig(botId: string) {
  return useQuery<{ config: CalendarConfig }>({
    queryKey: ["calendar", botId, "config"],
    queryFn: () => api.get<{ config: CalendarConfig }>(`/calendar/${botId}/config`),
    enabled: Boolean(botId),
  });
}

export function useCalendarSlots(botId: string, from?: string, to?: string) {
  const params = new URLSearchParams();
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  const qs = params.toString();
  return useQuery<{ slots: AvailableSlot[] }>({
    queryKey: ["calendar", botId, "slots", from, to],
    queryFn: () =>
      api.get<{ slots: AvailableSlot[] }>(
        `/calendar/${botId}/slots${qs ? `?${qs}` : ""}`
      ),
    enabled: Boolean(botId),
  });
}

export function useCalendarBookings(
  botId: string,
  filters?: { from?: string; to?: string; status?: BookingStatus }
) {
  const params = new URLSearchParams();
  if (filters?.from) params.set("from", filters.from);
  if (filters?.to) params.set("to", filters.to);
  if (filters?.status) params.set("status", filters.status);
  const qs = params.toString();
  return useQuery<{ bookings: Booking[] }>({
    queryKey: ["calendar", botId, "bookings", filters],
    queryFn: () =>
      api.get<{ bookings: Booking[] }>(
        `/calendar/${botId}/bookings${qs ? `?${qs}` : ""}`
      ),
    enabled: Boolean(botId),
  });
}

export function useSaveCalendarConfig(botId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: Partial<CalendarConfig>) =>
      api.put<{ config: CalendarConfig }>(`/calendar/${botId}/config`, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["calendar", botId] });
      void queryClient.invalidateQueries({ queryKey: ["apps"] });
    },
  });
}

export function useEnableCalendar(botId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<{ config: CalendarConfig }>(`/calendar/${botId}/enable`, {}),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["calendar", botId] });
      void queryClient.invalidateQueries({ queryKey: ["apps"] });
    },
  });
}

export function useDisableCalendar(botId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<{ config: CalendarConfig }>(`/calendar/${botId}/disable`, {}),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["calendar", botId] });
      void queryClient.invalidateQueries({ queryKey: ["apps"] });
    },
  });
}

export function useUpdateBookingStatus(botId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: { bookingId: string; status: BookingStatus }) =>
      api.patch<{ booking: Booking }>(
        `/calendar/${botId}/bookings/${params.bookingId}`,
        { status: params.status }
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["calendar", botId, "bookings"] });
    },
  });
}
