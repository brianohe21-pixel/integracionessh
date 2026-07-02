"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useT } from "@/i18n/context";
import {
  publicCalendarApi,
  type PublicCalendarDate,
  type PublicCalendarInfo,
  type PublicBookingResult,
} from "@/lib/public-calendar-api";
import type { AvailableSlot } from "@/types";

type Step = "date" | "slot" | "contact" | "done";

export default function PublicBookPage() {
  const t = useT();
  const { publicKey } = useParams<{ publicKey: string }>();
  const [info, setInfo] = useState<PublicCalendarInfo | null>(null);
  const [dates, setDates] = useState<PublicCalendarDate[]>([]);
  const [slots, setSlots] = useState<AvailableSlot[]>([]);
  const [step, setStep] = useState<Step>("date");
  const [selectedDate, setSelectedDate] = useState<PublicCalendarDate | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<AvailableSlot | null>(null);
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [booking, setBooking] = useState<PublicBookingResult["booking"] | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const accent = info?.branding?.primaryColor ?? "#4f46e5";

  useEffect(() => {
    if (!publicKey) return;
    setLoading(true);
    setError("");
    Promise.all([
      publicCalendarApi.getInfo(publicKey),
      publicCalendarApi.getDates(publicKey),
    ])
      .then(([infoRes, datesRes]) => {
        setInfo(infoRes);
        setDates(datesRes.dates);
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [publicKey]);

  async function handleSelectDate(date: PublicCalendarDate) {
    if (!publicKey) return;
    setSelectedDate(date);
    setError("");
    setSubmitting(true);
    try {
      const res = await publicCalendarApi.getSlots(publicKey, date.isoDate);
      setSlots(res.slots);
      if (res.slots.length === 0) {
        setError(t("publicBook.noSlotsForDate"));
        return;
      }
      setStep("slot");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  function handleSelectSlot(slot: AvailableSlot) {
    setSelectedSlot(slot);
    setStep("contact");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!publicKey || !selectedSlot) return;
    setError("");
    setSubmitting(true);
    try {
      const result = await publicCalendarApi.createBooking(publicKey, {
        startAt: selectedSlot.startAt,
        contactName: contactName.trim(),
        contactPhone: contactPhone.trim(),
      });
      setBooking(result.booking);
      setStep("done");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-gray-300 border-t-indigo-600" />
      </div>
    );
  }

  if (error && !info) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
        <div className="max-w-md rounded-xl border border-red-200 bg-white p-6 text-center">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-lg items-center gap-3 px-4 py-4">
          {info?.branding?.logoUrl ? (
            <img
              src={info.branding.logoUrl}
              alt=""
              className="h-10 w-10 rounded-lg object-contain"
            />
          ) : null}
          <div>
            <h1 className="text-lg font-semibold text-gray-900">
              {info?.branding?.brandName ?? info?.botName}
            </h1>
            <p className="text-sm text-gray-500">{t("publicBook.title")}</p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-lg px-4 py-6">
        {step === "done" && booking ? (
          <div className="rounded-xl border border-green-200 bg-white p-6 text-center">
            <p className="text-lg font-semibold text-gray-900">{t("publicBook.confirmed")}</p>
            <p className="mt-2 text-gray-600">{booking.label}</p>
            <p className="mt-4 text-xs text-gray-400">
              {t("publicBook.reference")}: {booking.bookingId.slice(0, 8)}
            </p>
          </div>
        ) : null}

        {step === "date" ? (
          <section className="space-y-4">
            <h2 className="text-base font-medium text-gray-900">{t("publicBook.pickDate")}</h2>
            {dates.length === 0 ? (
              <p className="text-sm text-gray-500">{t("publicBook.noDates")}</p>
            ) : (
              <div className="grid gap-2">
                {dates.map((date) => (
                  <button
                    key={date.isoDate}
                    type="button"
                    disabled={submitting}
                    onClick={() => void handleSelectDate(date)}
                    className="rounded-lg border border-gray-200 bg-white px-4 py-3 text-left text-sm font-medium text-gray-900 hover:border-gray-300 disabled:opacity-50"
                    style={{ borderColor: selectedDate?.isoDate === date.isoDate ? accent : undefined }}
                  >
                    {date.label}
                  </button>
                ))}
              </div>
            )}
          </section>
        ) : null}

        {step === "slot" ? (
          <section className="space-y-4">
            <button
              type="button"
              onClick={() => {
                setStep("date");
                setSelectedSlot(null);
                setSlots([]);
              }}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              {t("publicBook.back")}
            </button>
            <h2 className="text-base font-medium text-gray-900">
              {t("publicBook.pickSlot")} — {selectedDate?.label}
            </h2>
            <div className="grid grid-cols-2 gap-2">
              {slots.map((slot) => (
                <button
                  key={slot.startAt}
                  type="button"
                  onClick={() => handleSelectSlot(slot)}
                  className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-900 hover:border-gray-300"
                >
                  {slot.label}
                </button>
              ))}
            </div>
          </section>
        ) : null}

        {step === "contact" && selectedSlot ? (
          <section className="space-y-4">
            <button
              type="button"
              onClick={() => setStep("slot")}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              {t("publicBook.back")}
            </button>
            <h2 className="text-base font-medium text-gray-900">{t("publicBook.yourDetails")}</h2>
            <p className="text-sm text-gray-500">
              {selectedDate?.label} · {selectedSlot.label}
            </p>
            <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  {t("publicBook.name")}
                </label>
                <input
                  type="text"
                  required
                  maxLength={120}
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  {t("publicBook.phone")}
                </label>
                <input
                  type="tel"
                  required
                  minLength={8}
                  maxLength={20}
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-lg px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50"
                style={{ backgroundColor: accent }}
              >
                {submitting ? t("publicBook.submitting") : t("publicBook.confirm")}
              </button>
            </form>
          </section>
        ) : null}

        {error && step !== "done" ? (
          <p className="mt-4 text-sm text-red-600">{error}</p>
        ) : null}
      </main>
    </div>
  );
}
