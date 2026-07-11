"use client";

import Link from "next/link";
import { useState } from "react";
import { CreditCard, Settings2 } from "lucide-react";
import { useT } from "@/i18n/context";
import { useApps } from "@/hooks/useApps";
import { useBots } from "@/hooks/useBots";
import {
  useDisablePayments,
  useEnablePayments,
  usePaymentsConfig,
} from "@/hooks/usePayments";
import { DashboardPage } from "@/components/layout/DashboardPage";
import { PageHeader } from "@/components/layout/PageHeader";

export default function PaymentsAppsPage() {
  const t = useT();
  const { data: appsData } = useApps();
  const { data: botsData } = useBots();
  const bots = botsData ?? [];
  const [botId, setBotId] = useState("");
  const { data: configData } = usePaymentsConfig(botId);
  const enable = useEnablePayments(botId);
  const disable = useDisablePayments(botId);
  const [error, setError] = useState("");

  const enabled = configData?.config?.enabled ?? false;
  const paymentsApp = appsData?.apps.find((app) => app.id === "payments");
  const activeBots = paymentsApp?.installedBots.filter((bot) => bot.enabled) ?? [];

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
      <PageHeader title={t("payments.title")} subtitle={t("payments.selectBotSubtitle")} />

      <section className="mb-6 rounded-xl border border-gray-200 bg-white p-6">
        <h2 className="text-base font-semibold text-gray-900">{t("payments.quickAccess")}</h2>
        <p className="mt-1 text-sm text-gray-500">{t("payments.quickAccessHint")}</p>
        {activeBots.length === 0 ? (
          <p className="mt-4 text-sm text-gray-500">{t("payments.quickAccessEmpty")}</p>
        ) : (
          <ul className="mt-4 divide-y divide-gray-100 rounded-lg border border-gray-200">
            {activeBots.map((bot) => (
              <li
                key={bot.botId}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
              >
                <span className="font-medium text-gray-900">{bot.botName}</span>
                <div className="flex flex-wrap gap-2">
                  <Link
                    href={`/apps/payments/${bot.botId}`}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 px-3 py-1.5 text-sm font-medium text-indigo-700 hover:bg-indigo-50"
                  >
                    <Settings2 className="h-4 w-4" />
                    {t("payments.manage")}
                  </Link>
                  <Link
                    href={`/apps/payments/${bot.botId}?tab=requests`}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700"
                  >
                    <CreditCard className="h-4 w-4" />
                    {t("payments.tabs.requests")}
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <h2 className="mb-4 text-base font-semibold text-gray-900">{t("payments.activateTitle")}</h2>
        <select
          value={botId}
          onChange={(e) => setBotId(e.target.value)}
          className="w-full max-w-md rounded-lg border border-gray-300 px-3 py-2 text-sm"
        >
          <option value="">{t("payments.chooseBot")}</option>
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
              {enabled ? t("payments.disable") : t("payments.enable")}
            </button>
            {enabled ? (
              <Link
                href={`/apps/payments/${botId}`}
                className="rounded-lg border border-indigo-200 px-4 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-50"
              >
                {t("payments.manage")}
              </Link>
            ) : null}
            {error ? <p className="text-sm text-red-600">{error}</p> : null}
          </div>
        ) : null}
      </div>
    </DashboardPage>
  );
}
