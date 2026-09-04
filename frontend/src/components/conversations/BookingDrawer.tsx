"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Calendar, X } from "lucide-react";
import { useT } from "@/i18n/context";
import {
  useConversationBookingSlots,
  useCreateConversationBooking,
} from "@/hooks/useConversationBookings";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import type { AvailableSlot, Conversation } from "@/types";

type Props = {
  conversation: Conversation;
  open: boolean;
  onClose: () => void;
};

function groupSlotsByDate(slots: AvailableSlot[]): Map<string, AvailableSlot[]> {
  const map = new Map<string, AvailableSlot[]>();
  for (const slot of slots) {
    const dateKey = slot.startAt.slice(0, 10);
    const current = map.get(dateKey) ?? [];
    current.push(slot);
    map.set(dateKey, current);
  }
  for (const [key, value] of map) {
    map.set(
      key,
      [...value].sort((a, b) => a.startAt.localeCompare(b.startAt))
    );
  }
  return map;
}

function formatDateLabel(isoDate: string, locale: string): string {
  return new Intl.DateTimeFormat(locale === "en" ? "en-US" : "es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date(`${isoDate}T12:00:00`));
}

function formatTimeLabel(iso: string, locale: string, timeZone?: string): string {
  return new Intl.DateTimeFormat(locale === "en" ? "en-US" : "es-ES", {
    hour: "2-digit",
    minute: "2-digit",
    ...(timeZone ? { timeZone } : {}),
  }).format(new Date(iso));
}

export function BookingDrawer({ conversation, open, onClose }: Props) {
  const t = useT();
  const botId = conversation.botId;
  const { data, isLoading, isError } = useConversationBookingSlots(
    conversation.conversationId,
    botId,
    open
  );
  const create = useCreateConversationBooking(conversation.conversationId);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<AvailableSlot | null>(null);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");

  const locale = conversation.locale === "en" ? "en" : "es";
  const slotsByDate = useMemo(() => groupSlotsByDate(data?.slots ?? []), [data?.slots]);
  const availableDates = useMemo(
    () => [...slotsByDate.keys()].sort((a, b) => a.localeCompare(b)),
    [slotsByDate]
  );
  const slotsForSelectedDate = selectedDate ? (slotsByDate.get(selectedDate) ?? []) : [];

  useEffect(() => {
    if (!open) return;
    setSelectedDate(null);
    setSelectedSlot(null);
    setNotes("");
    setError("");
  }, [open, conversation.conversationId]);

  useEffect(() => {
    if (!selectedDate && availableDates.length > 0) {
      setSelectedDate(availableDates[0] ?? null);
    }
  }, [availableDates, selectedDate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!selectedSlot) {
      setError(t("conversations.bookMeetingPickSlot"));
      return;
    }

    try {
      await create.mutateAsync({
        botId,
        startAt: selectedSlot.startAt,
        ...(notes.trim() ? { notes: notes.trim() } : {}),
      });
      onClose();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  if (!open) return null;

  const calendarEnabled = data?.enabled === true;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4">
      <div className="flex max-h-[90vh] w-full max-w-lg flex-col rounded-t-xl border border-default bg-surface-elevated shadow-xl sm:rounded-xl">
        <div className="flex items-center justify-between border-b border-default px-5 py-4">
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-accent" />
            <h2 className="text-lg font-semibold text-primary">
              {t("conversations.bookMeetingTitle")}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-muted hover:bg-surface-muted"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)} className="flex flex-1 flex-col overflow-hidden">
          <div className="flex-1 space-y-4 overflow-y-auto p-5">
            {isLoading ? (
              <div className="h-40 animate-pulse rounded-lg bg-surface-muted" />
            ) : isError ? (
              <p className="text-sm text-secondary">{t("conversations.bookMeetingLoadError")}</p>
            ) : !calendarEnabled ? (
              <div className="rounded-lg border border-default bg-surface-muted/60 p-4 text-sm text-secondary">
                <p>{t("conversations.bookMeetingCalendarDisabled")}</p>
                <Link
                  href={`/apps/calendar/${botId}`}
                  className="mt-2 inline-block font-medium text-accent hover:underline"
                >
                  {t("conversations.configureCalendar")}
                </Link>
              </div>
            ) : availableDates.length === 0 ? (
              <p className="text-sm text-secondary">{t("conversations.bookMeetingNoSlots")}</p>
            ) : (
              <>
                <div className="space-y-2">
                  <p className="text-sm font-medium text-primary">
                    {t("conversations.bookMeetingPickDate")}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {availableDates.map((dateKey) => (
                      <button
                        key={dateKey}
                        type="button"
                        onClick={() => {
                          setSelectedDate(dateKey);
                          setSelectedSlot(null);
                        }}
                        className={cn(
                          "rounded-full border px-3 py-1.5 text-sm transition-colors",
                          selectedDate === dateKey
                            ? "border-accent bg-accent text-white"
                            : "border-default bg-surface-muted text-primary hover:bg-surface-elevated"
                        )}
                      >
                        {formatDateLabel(dateKey, locale)}
                      </button>
                    ))}
                  </div>
                </div>

                {selectedDate ? (
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-primary">
                      {t("conversations.bookMeetingPickSlot")}
                    </p>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {slotsForSelectedDate.map((slot) => (
                        <button
                          key={slot.startAt}
                          type="button"
                          onClick={() => setSelectedSlot(slot)}
                          className={cn(
                            "rounded-lg border px-3 py-2 text-sm transition-colors",
                            selectedSlot?.startAt === slot.startAt
                              ? "border-accent bg-accent-muted text-accent"
                              : "border-default bg-surface-muted text-primary hover:bg-surface-elevated"
                          )}
                        >
                          {formatTimeLabel(slot.startAt, locale, data?.timezone)}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}

                <label className="block text-sm text-secondary">
                  {t("conversations.bookMeetingNotes")}
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={2}
                    className="mt-1 w-full rounded-lg border border-default px-3 py-2 text-sm"
                  />
                </label>
              </>
            )}

            {error ? <p className="text-sm text-red-600">{error}</p> : null}
          </div>

          <div className="flex justify-end gap-2 border-t border-default p-4">
            <Button type="button" variant="ghost" onClick={onClose}>
              {t("common.cancel")}
            </Button>
            <Button
              type="submit"
              disabled={!calendarEnabled || !selectedSlot || create.isPending}
            >
              {t("conversations.bookMeetingSubmit")}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
