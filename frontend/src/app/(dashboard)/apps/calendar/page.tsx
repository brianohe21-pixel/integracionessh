"use client";

import Link from "next/link";
import { useState } from "react";
import { useT } from "@/i18n/context";
import { useBots } from "@/hooks/useBots";
import {
  useCalendarConfig,
  useDisableCalendar,
  useEnableCalendar,
} from "@/hooks/useCalendar";
import { DashboardPage } from "@/components/layout/DashboardPage";
import { PageHeader } from "@/components/layout/PageHeader";

export default function CalendarAppsPage() {
  const t = useT();
  const { data: botsData } = useBots();
  const bots = botsData ?? [];
  const [botId, setBotId] = useState("");
  const { data: configData } = useCalendarConfig(botId);
  const enable = useEnableCalendar(botId);
  const disable = useDisableCalendar(botId);
  const [error, setError] = useState("");

  const config = configData?.config;
  const enabled = config?.enabled ?? false;

  async function handleToggle() {
    if (!botId) return;
    setError("");
    try {
      if (enabled) {
        await disable.mutateAsync();
      } else {
        await enable.mutateAsync();
      }
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <DashboardPage>
      <PageHeader
        title={t("calendar.title")}
        subtitle={t("calendar.selectBotSubtitle")}
      />

      <div className="mb-6 rounded-xl border border-gray-200 bg-white p-6">
        <label className="mb-2 block text-sm font-medium text-gray-700">
          {t("calendar.selectBot")}
        </label>
        <select
          value={botId}
          onChange={(e) => setBotId(e.target.value)}
          className="w-full max-w-md rounded-lg border border-gray-300 px-3 py-2 text-sm"
        >
          <option value="">{t("calendar.chooseBot")}</option>
          {bots.map((bot) => (
            <option key={bot.botId} value={bot.botId}>
              {bot.name}
            </option>
          ))}
        </select>

        {botId ? (
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => void handleToggle()}
              disabled={enable.isPending || disable.isPending}
              className={`rounded-lg px-4 py-2 text-sm font-medium text-white ${
                enabled ? "bg-gray-600 hover:bg-gray-700" : "bg-indigo-600 hover:bg-indigo-700"
              }`}
            >
              {enabled ? t("calendar.disable") : t("calendar.enable")}
            </button>
            {enabled ? (
              <Link
                href={`/apps/calendar/${botId}`}
                className="rounded-lg border border-indigo-200 px-4 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-50"
              >
                {t("calendar.manage")}
              </Link>
            ) : null}
            {error ? <p className="text-sm text-red-600">{error}</p> : null}
          </div>
        ) : null}
      </div>
    </DashboardPage>
  );
}
