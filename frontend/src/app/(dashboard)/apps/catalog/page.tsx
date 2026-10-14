"use client";

import Link from "next/link";
import { useState } from "react";
import { Package, Settings2, ShoppingBag } from "lucide-react";
import { useT } from "@/i18n/context";
import { useApps } from "@/hooks/useApps";
import { useBots } from "@/hooks/useBots";
import {
  useCatalogConfig,
  useDisableCatalog,
  useEnableCatalog,
} from "@/hooks/useCatalog";
import { listOutreachAgents } from "@/lib/outreach-agents";
import { DashboardPage } from "@/components/layout/DashboardPage";
import { PageHeader } from "@/components/layout/PageHeader";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";

export default function CatalogAppsPage() {
  const t = useT();
  const { data: appsData } = useApps();
  const { data: botsData } = useBots();
  const bots = listOutreachAgents(botsData ?? [], "whatsapp");
  const [botId, setBotId] = useState("");
  const { data: configData, isFetching: configLoading } = useCatalogConfig(botId);
  const enable = useEnableCatalog(botId);
  const disable = useDisableCatalog(botId);
  const [error, setError] = useState("");

  const enabled = configData?.config?.enabled ?? false;
  const catalogApp = appsData?.apps.find((app) => app.id === "catalog");
  const activeBots = catalogApp?.installedBots.filter((bot) => bot.enabled) ?? [];
  const selectedBot = bots.find((bot) => bot.botId === botId);

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

      <section className="mb-6 rounded-xl border border-default bg-surface-elevated p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-primary">{t("catalog.quickAccess")}</h2>
            <p className="mt-1 text-sm text-secondary">{t("catalog.quickAccessHint")}</p>
          </div>
          {activeBots.length > 0 ? (
            <Badge variant="success" dot>
              {activeBots.length}
            </Badge>
          ) : null}
        </div>

        {activeBots.length === 0 ? (
          <EmptyState
            className="mt-5 py-10"
            icon={<Package className="h-6 w-6" />}
            title={t("catalog.quickAccessEmptyTitle")}
            description={t("catalog.quickAccessEmpty")}
          />
        ) : (
          <ul className="mt-5 divide-y divide-default rounded-xl border border-default">
            {activeBots.map((bot) => (
              <li
                key={bot.botId}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-3.5 transition-colors hover:bg-surface-muted/50"
              >
                <div className="min-w-0">
                  <p className="font-medium text-primary">{bot.botName}</p>
                  <Badge variant="success" dot className="mt-1.5">
                    {t("catalog.statusEnabled")}
                  </Badge>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link
                    href={`/apps/catalog/${bot.botId}`}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-field-border bg-surface-elevated px-3 py-1.5 text-sm font-medium text-primary shadow-sm transition-all hover:bg-surface-muted"
                  >
                    <Settings2 className="h-4 w-4" />
                    {t("catalog.manage")}
                  </Link>
                  <Link
                    href={`/apps/catalog/${bot.botId}?tab=products`}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-field-border bg-surface-elevated px-3 py-1.5 text-sm font-medium text-primary shadow-sm transition-all hover:bg-surface-muted"
                  >
                    <Package className="h-4 w-4" />
                    {t("catalog.tabs.products")}
                  </Link>
                  <Link
                    href={`/apps/catalog/${bot.botId}?tab=orders`}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-white shadow-sm transition-all hover:bg-accent-hover"
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

      <section className="rounded-xl border border-default bg-surface-elevated p-6">
        <h2 className="text-base font-semibold text-primary">{t("catalog.activateTitle")}</h2>
        <p className="mt-1 text-sm text-secondary">{t("catalog.activateHint")}</p>

        {bots.length === 0 ? (
          <EmptyState
            className="mt-5 py-10"
            icon={<ShoppingBag className="h-6 w-6" />}
            title={t("catalog.noWhatsAppBots")}
            action={
              <Link
                href="/bots"
                className="inline-flex items-center justify-center rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover"
              >
                {t("catalog.noWhatsAppBotsAction")}
              </Link>
            }
          />
        ) : (
          <div className="mt-5 space-y-4">
            <div className="max-w-md">
              <label className="mb-1.5 block text-sm font-medium text-secondary">
                {t("catalog.selectBot")}
              </label>
              <select
                value={botId}
                onChange={(e) => {
                  setBotId(e.target.value);
                  setError("");
                }}
                className="w-full rounded-lg border border-default bg-surface-elevated px-3 py-2 text-sm"
              >
                <option value="">{t("catalog.chooseBot")}</option>
                {bots.map((bot) => (
                  <option key={bot.botId} value={bot.botId}>
                    {bot.name}
                  </option>
                ))}
              </select>
            </div>

            {botId ? (
              <div className="flex flex-wrap items-center gap-3">
                {configLoading ? (
                  <span className="text-sm text-secondary">{t("common.loading")}</span>
                ) : (
                  <Badge variant={enabled ? "success" : "default"} dot>
                    {enabled ? t("catalog.statusEnabled") : t("catalog.statusDisabled")}
                  </Badge>
                )}
                {selectedBot ? (
                  <span className="text-sm text-secondary">{selectedBot.name}</span>
                ) : null}
              </div>
            ) : null}

            {botId ? (
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant={enabled ? "secondary" : "primary"}
                  disabled={enable.isPending || disable.isPending || configLoading}
                  onClick={() => void handleToggle()}
                >
                  {enabled ? t("catalog.disable") : t("catalog.enable")}
                </Button>
                {enabled ? (
                  <>
                    <Link
                      href={`/apps/catalog/${botId}`}
                      className="inline-flex items-center justify-center gap-2 rounded-lg border border-field-border bg-surface-elevated px-4 py-2 text-sm font-medium text-primary shadow-sm hover:bg-surface-muted"
                    >
                      <Settings2 className="h-4 w-4" />
                      {t("catalog.manage")}
                    </Link>
                    <Link
                      href={`/apps/catalog/${botId}?tab=orders`}
                      className="inline-flex items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-accent-hover"
                    >
                      <ShoppingBag className="h-4 w-4" />
                      {t("catalog.tabs.orders")}
                    </Link>
                  </>
                ) : null}
              </div>
            ) : null}

            {error ? (
              <Alert variant="danger" onDismiss={() => setError("")}>
                {error}
              </Alert>
            ) : null}
          </div>
        )}
      </section>
    </DashboardPage>
  );
}
