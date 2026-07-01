"use client";

import type { Booking, BookingStatus } from "@/types";
import { useT } from "@/i18n/context";
import { TableContainer } from "@/components/ui/TableContainer";
import { useUpdateBookingStatus } from "@/hooks/useCalendar";

interface CalendarBookingsTableProps {
  botId: string;
  bookings: Booking[];
  isLoading?: boolean;
}

const STATUS_OPTIONS: BookingStatus[] = ["confirmed", "cancelled", "completed", "no_show"];

export function CalendarBookingsTable({
  botId,
  bookings,
  isLoading,
}: CalendarBookingsTableProps) {
  const t = useT();
  const updateStatus = useUpdateBookingStatus(botId);

  if (isLoading) {
    return <div className="h-48 animate-pulse rounded-xl bg-gray-100" />;
  }

  return (
    <TableContainer>
      <table className="min-w-full divide-y divide-gray-200 text-sm">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-3 text-left font-medium text-gray-600">{t("calendar.colDate")}</th>
            <th className="px-4 py-3 text-left font-medium text-gray-600">{t("calendar.colContact")}</th>
            <th className="px-4 py-3 text-left font-medium text-gray-600">{t("calendar.colSource")}</th>
            <th className="px-4 py-3 text-left font-medium text-gray-600">{t("common.status")}</th>
            <th className="px-4 py-3 text-left font-medium text-gray-600" />
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 bg-white">
          {bookings.length === 0 ? (
            <tr>
              <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                {t("calendar.noBookings")}
              </td>
            </tr>
          ) : (
            bookings.map((booking) => (
              <tr key={booking.bookingId}>
                <td className="px-4 py-3 text-gray-900">
                  {new Date(booking.startAt).toLocaleString()}
                </td>
                <td className="px-4 py-3 text-gray-700">
                  <div>{booking.contactName || "—"}</div>
                  <div className="text-xs text-gray-500">{booking.contactPhone}</div>
                </td>
                <td className="px-4 py-3 text-gray-600">{booking.source}</td>
                <td className="px-4 py-3">
                  <select
                    value={booking.status}
                    onChange={(e) =>
                      void updateStatus.mutateAsync({
                        bookingId: booking.bookingId,
                        status: e.target.value as BookingStatus,
                      })
                    }
                    className="rounded border border-gray-300 px-2 py-1 text-sm"
                  >
                    {STATUS_OPTIONS.map((status) => (
                      <option key={status} value={status}>
                        {t(`calendar.status.${status}`)}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-4 py-3 text-xs text-gray-400">{booking.bookingId.slice(0, 8)}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </TableContainer>
  );
}
