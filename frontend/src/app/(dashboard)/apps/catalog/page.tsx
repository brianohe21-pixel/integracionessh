"use client";

import Link from "next/link";
import { useState } from "react";
import { Settings2, ShoppingBag } from "lucide-react";
import { useT } from "@/i18n/context";
import { useApps } from "@/hooks/useApps";
import { useBots } from "@/hooks/useBots";
import {
  useCatalogConfig,
  useDisableCatalog,
  useEnableCatalog,
} from "@/hooks/useCatalog";
import { DashboardPage } from "@/components/layout/DashboardPage";
import { PageHeader } from "@/components/layout/PageHeader";

export default function CatalogAppsPage() {
  const t = useT();
  const { data: appsData } = useApps();
  const { data: botsData } = useBots();
  const bots = botsData ?? [];
  const [botId, setBotId] = useState("");
  const { data: configData } = useCatalogConfig(botId);
  const enable = useEnableCatalog(botId);
  const disable = useDisableCatalog(botId);
  const [error, setError] = useState("");

  const enabled = configData?.config?.enabled ?? false;
  const catalogApp = appsData?.apps.find((app) => app.id === "catalog");
  const activeBots = catalogApp?.installedBots.filter((bot) => bot.enabled) ?? [];

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
      <PageHeader title={t("catalog.title")} subtitle={t("catalog.selectBotSubtitle")} />

      <section className="mb-6 rounded-xl border border-gray-200 bg-white p-6">
        <h2 className="text-base font-semibold text-gray-900">{t("catalog.quickAccess")}</h2>
        <p className="mt-1 text-sm text-gray-500">{t("catalog.quickAccessHint")}</p>
        {activeBots.length === 0 ? (
          <p className="mt-4 text-sm text-gray-500">{t("catalog.quickAccessEmpty")}</p>
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
                    href={`/apps/catalog/${bot.botId}`}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 px-3 py-1.5 text-sm font-medium text-indigo-700 hover:bg-indigo-50"
                  >
                    <Settings2 className="h-4 w-4" />
                    {t("catalog.manage")}
                  </Link>
                  <Link
                    href={`/apps/catalog/${bot.botId}?tab=orders`}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700"
                  >
                    <ShoppingBag className="h-4 w-4" />
                    {t("catalog.tabs.orders")}
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-6">
        <h2 className="text-base font-semibold text-gray-900">{t("catalog.activateTitle")}</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t("catalog.selectBot")}
            </label>
            <select
              value={botId}
              onChange={(e) => setBotId(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white"
            >
              <option value="">{t("catalog.chooseBot")}</option>
              {bots.map((bot) => (
                <option key={bot.botId} value={bot.botId}>
                  {bot.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <button
              type="button"
              disabled={!botId || enable.isPending || disable.isPending}
              onClick={() => void handleToggle()}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {enabled ? t("catalog.disable") : t("catalog.enable")}
            </button>
          </div>
        </div>
        {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
      </section>
    </DashboardPage>
  );
}
