"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useT } from "@/i18n/context";
import {
  useCalendarBookings,
  useCalendarConfig,
  useCalendarSlots,
  useCalendarWaitlist,
  useSaveCalendarConfig,
} from "@/hooks/useCalendar";
import type { CalendarConfig } from "@/types";
import { DashboardPage } from "@/components/layout/DashboardPage";
import { PageHeader } from "@/components/layout/PageHeader";
import { CalendarWeeklySchedule } from "@/components/calendar/CalendarWeeklySchedule";
import { CalendarSettingsForm } from "@/components/calendar/CalendarSettingsForm";
import { CalendarBookingsTable } from "@/components/calendar/CalendarBookingsTable";
import { CalendarSlotsPreview } from "@/components/calendar/CalendarSlotsPreview";
import { CalendarPublicLinkPanel } from "@/components/calendar/CalendarPublicLinkPanel";
import { CalendarReminderSettings } from "@/components/calendar/CalendarReminderSettings";
import { CalendarPaymentSettings } from "@/components/calendar/CalendarPaymentSettings";
import { CalendarWaitlistSettings } from "@/components/calendar/CalendarWaitlistSettings";
import { CalendarWaitlistTable } from "@/components/calendar/CalendarWaitlistTable";
import { usePaymentsConfig } from "@/hooks/usePayments";

type Tab = "availability" | "bookings";

function parseTab(value: string | null): Tab {
  return value === "bookings" ? "bookings" : "availability";
}

export default function CalendarBotPage() {
  const t = useT();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { botId } = useParams<{ botId: string }>();
  const [tab, setTab] = useState<Tab>(() => parseTab(searchParams.get("tab")));
  const [draft, setDraft] = useState<CalendarConfig | null>(null);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const { data: configData, isLoading } = useCalendarConfig(botId);
  const saveConfig = useSaveCalendarConfig(botId);
  const { data: slotsData, isLoading: slotsLoading } = useCalendarSlots(botId);
  const { data: bookingsData, isLoading: bookingsLoading } = useCalendarBookings(botId);
  const { data: waitlistData, isLoading: waitlistLoading } = useCalendarWaitlist(botId);
  const { data: paymentsData } = usePaymentsConfig(botId);

  useEffect(() => {
    if (configData?.config) {
      setDraft(configData.config);
    }
  }, [configData]);

  useEffect(() => {
    setTab(parseTab(searchParams.get("tab")));
  }, [searchParams]);

  function selectTab(next: Tab) {
    setTab(next);
    const params = new URLSearchParams(searchParams.toString());
    if (next === "availability") {
      params.delete("tab");
    } else {
      params.set("tab", next);
    }
    const qs = params.toString();
    router.replace(`/apps/calendar/${botId}${qs ? `?${qs}` : ""}`, { scroll: false });
  }

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
        reminderEnabled: draft.reminderEnabled,
        reminderMinutesBefore: draft.reminderMinutesBefore,
        reminderChannel: draft.reminderChannel,
        reminderMessage: draft.reminderMessage,
        reminderTemplateName: draft.reminderTemplateName,
        reminderTemplateLanguage: draft.reminderTemplateLanguage,
        autoCollectPayment: draft.autoCollectPayment,
        bookingPriceInCents: draft.bookingPriceInCents,
        waitlistEnabled: draft.waitlistEnabled,
      });
      setSaved(true);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  if (isLoading || !draft) {
    return (
      <DashboardPage>
        <div className="h-64 animate-pulse rounded-xl bg-surface-muted" />
      </DashboardPage>
    );
  }

  return (
    <DashboardPage maxWidth="5xl">
      <PageHeader title={t("calendar.manageTitle")} subtitle={t("calendar.manageSubtitle")} />

      <div className="mb-6 flex gap-2 border-b border-default">
        {(["availability", "bookings"] as Tab[]).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => selectTab(key)}
            className={`border-b-2 px-4 py-2 text-sm font-medium ${
              tab === key
                ? "border-accent text-accent"
                : "border-transparent text-secondary hover:text-secondary"
            }`}
          >
            {t(`calendar.tabs.${key}`)}
          </button>
        ))}
      </div>

      {tab === "availability" ? (
        <div className="space-y-6">
          <CalendarPublicLinkPanel botId={botId} calendarEnabled={draft.enabled} />
          <CalendarReminderSettings
            botId={botId}
            config={draft}
            onChange={(patch) => setDraft((prev) => (prev ? { ...prev, ...patch } : prev))}
          />
          <CalendarPaymentSettings
            config={draft}
            paymentsEnabled={paymentsData?.config.enabled ?? false}
            wompiConfigured={paymentsData?.wompiConfigured ?? false}
            onChange={(patch) => setDraft((prev) => (prev ? { ...prev, ...patch } : prev))}
          />
          <CalendarWaitlistSettings
            config={draft}
            onChange={(patch) => setDraft((prev) => (prev ? { ...prev, ...patch } : prev))}
          />
          <section className="rounded-xl border border-default bg-surface-elevated p-6">
            <h3 className="mb-4 font-semibold text-primary">{t("calendar.settings")}</h3>
            <CalendarSettingsForm
              config={draft}
              onChange={(patch) => setDraft((prev) => (prev ? { ...prev, ...patch } : prev))}
            />
          </section>
          <section className="rounded-xl border border-default bg-surface-elevated p-6">
            <h3 className="mb-4 font-semibold text-primary">{t("calendar.weeklySchedule")}</h3>
            <CalendarWeeklySchedule
              schedule={draft.weeklySchedule}
              onChange={(weeklySchedule) => setDraft((prev) => (prev ? { ...prev, weeklySchedule } : prev))}
            />
          </section>
          <section className="rounded-xl border border-default bg-surface-elevated p-6">
            <h3 className="mb-4 font-semibold text-primary">{t("calendar.slotsPreview")}</h3>
            <CalendarSlotsPreview slots={slotsData?.slots ?? []} isLoading={slotsLoading} />
          </section>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={saveConfig.isPending}
              className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover"
            >
              {t("common.save")}
            </button>
            {saved ? <span className="text-sm text-green-600">{t("calendar.saved")}</span> : null}
            {error ? <span className="text-sm text-red-600">{error}</span> : null}
          </div>
        </div>
      ) : (
        <div className="space-y-8">
          <CalendarBookingsTable
            botId={botId}
            bookings={bookingsData?.bookings ?? []}
            isLoading={bookingsLoading}
          />
          <section>
            <h3 className="mb-4 font-semibold text-primary">{t("calendar.waitlist.title")}</h3>
            <CalendarWaitlistTable
              botId={botId}
              entries={waitlistData?.entries ?? []}
              isLoading={waitlistLoading}
            />
          </section>
        </div>
      )}
    </DashboardPage>
  );
}
