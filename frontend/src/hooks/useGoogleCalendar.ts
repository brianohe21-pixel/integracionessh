"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { CalendarProviderType, GoogleCalendarStatus } from "@/types";

export interface GoogleCalendarListItem {
  id: string;
  name: string;
  primary?: boolean;
}

export interface GoogleCalendarConnectionView {
  connected: boolean;
  status?: GoogleCalendarStatus;
  provider: CalendarProviderType;
  googleAccountEmail?: string;
  googleCalendarId?: string;
  googleCalendarName?: string;
  blockExternalEvents?: boolean;
  connectedAt?: string;
  calendars: GoogleCalendarListItem[];
}

export function useGoogleCalendar(botId: string) {
  return useQuery({
    queryKey: ["google-calendar", botId],
    queryFn: () => api.get<GoogleCalendarConnectionView>(`/calendar/${botId}/google`),
    staleTime: 30_000,
  });
}

export function useStartGoogleCalendarOAuth(botId: string) {
  return useMutation({
    mutationFn: () =>
      api.get<{ authUrl: string; state: string }>(`/calendar/${botId}/google/oauth/start`),
  });
}

export function useRefreshGoogleCalendars(botId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      api.post<GoogleCalendarConnectionView>(`/calendar/${botId}/google/calendars/refresh`, {}),
    onSuccess: (data) => {
      queryClient.setQueryData(["google-calendar", botId], data);
    },
  });
}

export function useUpdateGoogleCalendar(botId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { googleCalendarId?: string; blockExternalEvents?: boolean }) =>
      api.patch<GoogleCalendarConnectionView>(`/calendar/${botId}/google`, body),
    onSuccess: (data) => {
      queryClient.setQueryData(["google-calendar", botId], data);
      queryClient.invalidateQueries({ queryKey: ["calendar-config", botId] });
    },
  });
}

export function useDisconnectGoogleCalendar(botId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.delete<GoogleCalendarConnectionView>(`/calendar/${botId}/google`),
    onSuccess: (data) => {
      queryClient.setQueryData(["google-calendar", botId], data);
      queryClient.invalidateQueries({ queryKey: ["calendar-config", botId] });
    },
  });
}

export function useRetryBookingSync(botId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (bookingId: string) =>
      api.post<{ booking: { bookingId: string } }>(
        `/calendar/${botId}/bookings/${bookingId}/retry-sync`,
        {}
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["calendar-bookings", botId] });
    },
  });
}
