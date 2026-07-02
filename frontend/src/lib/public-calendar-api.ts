import type { AvailableSlot } from "@/types";

const BASE_URL = (process.env.NEXT_PUBLIC_API_URL ?? "").replace(/\/$/, "");

function assertApiBaseUrl(): void {
  if (!BASE_URL) {
    throw new Error("NEXT_PUBLIC_API_URL is not set");
  }
}

async function publicRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  assertApiBaseUrl();
  const response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "Unknown error" }));
    throw new Error((error as { error: string }).error ?? `HTTP ${response.status}`);
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export interface PublicCalendarBranding {
  brandName?: string;
  primaryColor?: string;
  logoUrl?: string;
}

export interface PublicCalendarInfo {
  botName: string;
  timezone: string;
  maxAdvanceDays: number;
  slotDurationMinutes: number;
  branding?: PublicCalendarBranding;
}

export interface PublicCalendarDate {
  isoDate: string;
  label: string;
}

export interface PublicBookingResult {
  booking: {
    bookingId: string;
    startAt: string;
    endAt: string;
    label: string;
  };
}

export const publicCalendarApi = {
  getInfo: (publicKey: string) =>
    publicRequest<PublicCalendarInfo>(`/public/calendar/${encodeURIComponent(publicKey)}`),

  getDates: (publicKey: string) =>
    publicRequest<{ dates: PublicCalendarDate[] }>(
      `/public/calendar/${encodeURIComponent(publicKey)}/dates`
    ),

  getSlots: (publicKey: string, date: string) =>
    publicRequest<{ slots: AvailableSlot[] }>(
      `/public/calendar/${encodeURIComponent(publicKey)}/slots?date=${encodeURIComponent(date)}`
    ),

  createBooking: (
    publicKey: string,
    body: { startAt: string; contactPhone: string; contactName: string; notes?: string }
  ) =>
    publicRequest<PublicBookingResult>(
      `/public/calendar/${encodeURIComponent(publicKey)}/bookings`,
      { method: "POST", body: JSON.stringify(body) }
    ),
};
