"use client";

import Link from "next/link";
import { useState } from "react";
import { Settings2, Sparkles } from "lucide-react";
import { useT } from "@/i18n/context";
import { useApps } from "@/hooks/useApps";
import { useBots } from "@/hooks/useBots";
import {
  useAiAssistant,
  useDisableAiAssistant,
  useEnableAiAssistant,
} from "@/hooks/useAiAssistant";
import { DashboardPage } from "@/components/layout/DashboardPage";
import { PageHeader } from "@/components/layout/PageHeader";

export default function AiAssistantAppsPage() {
  const t = useT();
  const { data: appsData } = useApps();
  const { data: botsData } = useBots();
  const bots = botsData ?? [];
  const [botId, setBotId] = useState("");
  const { data: config } = useAiAssistant(botId);
  const enable = useEnableAiAssistant(botId);
  const disable = useDisableAiAssistant(botId);
  const [error, setError] = useState("");

  const enabled = config?.enabled ?? false;
  const aiApp = appsData?.apps.find((app) => app.id === "ai-assistant");
  const activeBots = aiApp?.installedBots.filter((bot) => bot.enabled) ?? [];

  async function handleToggle() {
    if (!botId) return;
    setError("");
    try {
      if (enabled) {
        await disable.mutateAsync();
      } else {
        await enable.mutateAsync({
          systemPrompt: t("aiAssistant.defaultPrompt"),
        });
      }
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <DashboardPage>
      <PageHeader title={t("aiAssistant.title")} subtitle={t("aiAssistant.selectAgentSubtitle")} />

      <section className="mb-6 rounded-xl border border-default bg-surface-elevated p-6">
        <h2 className="text-base font-semibold text-primary">{t("aiAssistant.quickAccess")}</h2>
        <p className="mt-1 text-sm text-secondary">{t("aiAssistant.quickAccessHint")}</p>

        {activeBots.length === 0 ? (
          <p className="mt-4 text-sm text-secondary">{t("aiAssistant.quickAccessEmpty")}</p>
        ) : (
          <ul className="mt-4 divide-y divide-gray-100 rounded-lg border border-default">
            {activeBots.map((bot) => (
              <li
                key={bot.botId}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
              >
                <span className="font-medium text-primary">{bot.botName}</span>
                <Link
                  href={`/apps/ai-assistant/${bot.botId}`}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-accent/30 px-3 py-1.5 text-sm font-medium text-accent hover:bg-accent-muted"
                >
                  <Settings2 className="h-4 w-4" />
                  {t("aiAssistant.configure")}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="rounded-xl border border-default bg-surface-elevated p-6">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent-muted text-accent">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-primary">{t("aiAssistant.activateTitle")}</h2>
            <p className="text-sm text-secondary">{t("aiAssistant.activateDescription")}</p>
          </div>
        </div>

        <label className="mb-2 block text-sm font-medium text-secondary">
          {t("aiAssistant.selectAgent")}
        </label>
        <select
          value={botId}
          onChange={(e) => setBotId(e.target.value)}
          className="w-full max-w-md rounded-lg border border-default px-3 py-2 text-sm"
        >
          <option value="">{t("aiAssistant.chooseAgent")}</option>
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
                enabled ? "bg-gray-600 hover:bg-gray-700" : "bg-accent hover:bg-accent-hover"
              }`}
            >
              {enabled ? t("aiAssistant.disable") : t("aiAssistant.enable")}
            </button>
            {enabled && (
              <Link
                href={`/apps/ai-assistant/${botId}`}
                className="text-sm font-medium text-accent hover:underline"
              >
                {t("aiAssistant.configure")}
              </Link>
            )}
          </div>
        ) : null}

        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      </div>
    </DashboardPage>
  );
}
