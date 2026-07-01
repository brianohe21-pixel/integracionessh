"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useT } from "@/i18n/context";
import {
  useCalendarBookings,
  useCalendarConfig,
  useCalendarSlots,
  useSaveCalendarConfig,
} from "@/hooks/useCalendar";
import type { CalendarConfig } from "@/types";
import { DashboardPage } from "@/components/layout/DashboardPage";
import { PageHeader } from "@/components/layout/PageHeader";
import { CalendarWeeklySchedule } from "@/components/calendar/CalendarWeeklySchedule";
import { CalendarSettingsForm } from "@/components/calendar/CalendarSettingsForm";
import { CalendarBookingsTable } from "@/components/calendar/CalendarBookingsTable";
import { CalendarSlotsPreview } from "@/components/calendar/CalendarSlotsPreview";

type Tab = "availability" | "bookings";

export default function CalendarBotPage() {
  const t = useT();
  const { botId } = useParams<{ botId: string }>();
  const [tab, setTab] = useState<Tab>("availability");
  const [draft, setDraft] = useState<CalendarConfig | null>(null);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const { data: configData, isLoading } = useCalendarConfig(botId);
  const saveConfig = useSaveCalendarConfig(botId);
  const { data: slotsData, isLoading: slotsLoading } = useCalendarSlots(botId);
  const { data: bookingsData, isLoading: bookingsLoading } = useCalendarBookings(botId);

  useEffect(() => {
    if (configData?.config) {
      setDraft(configData.config);
    }
  }, [configData]);

  async function handleSave() {
    if (!draft) return;
    setError("");
    setSaved(false);
    try {
      await saveConfig.mutateAsync({
        timezone: draft.timezone,
        slotDurationMinutes: draft.slotDurationMinutes,
        bufferMinutes: draft.bufferMinutes,
        maxAdvanceDays: draft.maxAdvanceDays,
        minNoticeHours: draft.minNoticeHours,
        weeklySchedule: draft.weeklySchedule,
      });
      setSaved(true);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  if (isLoading || !draft) {
    return (
      <DashboardPage>
        <div className="h-64 animate-pulse rounded-xl bg-gray-100" />
      </DashboardPage>
    );
  }

  return (
    <DashboardPage maxWidth="5xl">
      <PageHeader title={t("calendar.manageTitle")} subtitle={t("calendar.manageSubtitle")} />

      <div className="mb-6 flex gap-2 border-b border-gray-200">
        {(["availability", "bookings"] as Tab[]).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`border-b-2 px-4 py-2 text-sm font-medium ${
              tab === key
                ? "border-indigo-600 text-indigo-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {t(`calendar.tabs.${key}`)}
          </button>
        ))}
      </div>

      {tab === "availability" ? (
        <div className="space-y-6">
          <section className="rounded-xl border border-gray-200 bg-white p-6">
            <h3 className="mb-4 font-semibold text-gray-900">{t("calendar.settings")}</h3>
            <CalendarSettingsForm
              config={draft}
              onChange={(patch) => setDraft((prev) => (prev ? { ...prev, ...patch } : prev))}
            />
          </section>
          <section className="rounded-xl border border-gray-200 bg-white p-6">
            <h3 className="mb-4 font-semibold text-gray-900">{t("calendar.weeklySchedule")}</h3>
            <CalendarWeeklySchedule
              schedule={draft.weeklySchedule}
              onChange={(weeklySchedule) => setDraft((prev) => (prev ? { ...prev, weeklySchedule } : prev))}
            />
          </section>
          <section className="rounded-xl border border-gray-200 bg-white p-6">
            <h3 className="mb-4 font-semibold text-gray-900">{t("calendar.slotsPreview")}</h3>
            <CalendarSlotsPreview slots={slotsData?.slots ?? []} isLoading={slotsLoading} />
          </section>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={saveConfig.isPending}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            >
              {t("common.save")}
            </button>
            {saved ? <span className="text-sm text-green-600">{t("calendar.saved")}</span> : null}
            {error ? <span className="text-sm text-red-600">{error}</span> : null}
          </div>
        </div>
      ) : (
        <CalendarBookingsTable
          botId={botId}
          bookings={bookingsData?.bookings ?? []}
          isLoading={bookingsLoading}
        />
      )}
    </DashboardPage>
  );
}
