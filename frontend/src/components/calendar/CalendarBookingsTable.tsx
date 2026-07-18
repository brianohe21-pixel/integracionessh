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
    return <div className="h-48 animate-pulse rounded-xl bg-surface-muted" />;
  }

  return (
    <TableContainer>
      <table className="min-w-full divide-y divide-gray-200 text-sm">
        <thead className="bg-surface">
          <tr>
            <th className="px-4 py-3 text-left font-medium text-secondary">{t("calendar.colDate")}</th>
            <th className="px-4 py-3 text-left font-medium text-secondary">{t("calendar.colContact")}</th>
            <th className="px-4 py-3 text-left font-medium text-secondary">{t("calendar.colSource")}</th>
            <th className="px-4 py-3 text-left font-medium text-secondary">{t("calendar.colPayment")}</th>
            <th className="px-4 py-3 text-left font-medium text-secondary">
              {t("calendar.colReminder")}
            </th>
            <th className="px-4 py-3 text-left font-medium text-secondary">{t("common.status")}</th>
            <th className="px-4 py-3 text-left font-medium text-secondary" />
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 bg-surface-elevated">
          {bookings.length === 0 ? (
            <tr>
              <td colSpan={7} className="px-4 py-8 text-center text-secondary">
                {t("calendar.noBookings")}
              </td>
            </tr>
          ) : (
            bookings.map((booking) => (
              <tr key={booking.bookingId}>
                <td className="px-4 py-3 text-primary">
                  {new Date(booking.startAt).toLocaleString()}
                </td>
                <td className="px-4 py-3 text-secondary">
                  <div>{booking.contactName || "—"}</div>
                  <div className="text-xs text-secondary">{booking.contactPhone}</div>
                </td>
                <td className="px-4 py-3 text-secondary">
                  {t(`calendar.source.${booking.source}` as "calendar.source.flow")}
                </td>
                <td className="px-4 py-3 text-secondary">
                  {booking.paymentStatus
                    ? t(
                        `calendar.payment.status.${booking.paymentStatus}` as "calendar.payment.status.paid"
                      )
                    : "—"}
                  {booking.amountInCents
                    ? ` · ${new Intl.NumberFormat("es-CO", {
                        style: "currency",
                        currency: "COP",
                        maximumFractionDigits: 0,
                      }).format(booking.amountInCents / 100)}`
                    : ""}
                </td>
                <td className="px-4 py-3 text-secondary">
                  {booking.reminderStatus
                    ? t(`calendar.reminder.status.${booking.reminderStatus}` as "calendar.reminder.status.sent")
                    : "—"}
                </td>
                <td className="px-4 py-3">
                  <select
                    value={booking.status}
                    onChange={(e) =>
                      void updateStatus.mutateAsync({
                        bookingId: booking.bookingId,
                        status: e.target.value as BookingStatus,
                      })
                    }
                    className="rounded border border-default px-2 py-1 text-sm"
                  >
                    {STATUS_OPTIONS.map((status) => (
                      <option key={status} value={status}>
                        {t(`calendar.status.${status}`)}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-4 py-3 text-xs text-muted">{booking.bookingId.slice(0, 8)}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </TableContainer>
  );
}
