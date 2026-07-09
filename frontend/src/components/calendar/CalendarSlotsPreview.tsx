"use client";

import type { AvailableSlot } from "@/types";
import { useT } from "@/i18n/context";

export function CalendarSlotsPreview({
  slots,
  isLoading,
}: {
  slots: AvailableSlot[];
  isLoading?: boolean;
}) {
  const t = useT();

  if (isLoading) {
    return <div className="h-24 animate-pulse rounded-lg bg-gray-100" />;
  }

  if (slots.length === 0) {
    return <p className="text-sm text-gray-500">{t("calendar.noSlots")}</p>;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {slots.slice(0, 24).map((slot) => (
        <span
          key={slot.startAt}
          className="rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-sm text-indigo-700"
        >
          {new Date(slot.startAt).toLocaleString(undefined, {
            weekday: "short",
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
      ))}
      {slots.length > 24 ? (
        <span className="text-sm text-gray-500">+{slots.length - 24}</span>
      ) : null}
    </div>
  );
}
