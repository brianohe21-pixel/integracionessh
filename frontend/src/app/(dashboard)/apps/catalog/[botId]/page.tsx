"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Check, Link2, Package, RefreshCw } from "lucide-react";
import { useT } from "@/i18n/context";
import { useBots } from "@/hooks/useBots";
import {
  useCatalogConfig,
  useCatalogOrders,
  useCatalogProducts,
  useLinkMetaCatalog,
  useMetaCatalogs,
  useSaveCatalogConfig,
  useSyncCatalog,
} from "@/hooks/useCatalog";
import { usePaymentsConfig } from "@/hooks/usePayments";
import type { CatalogConfig, CatalogSyncStatus } from "@/types";
import { DashboardPage } from "@/components/layout/DashboardPage";
import { PageHeader } from "@/components/layout/PageHeader";
import { CatalogConfigForm } from "@/components/catalog/CatalogConfigForm";
import { CatalogProductsList } from "@/components/catalog/CatalogProductsList";
import { CatalogOrdersList } from "@/components/catalog/CatalogOrdersList";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Tabs } from "@/components/ui/Tabs";

type Tab = "config" | "products" | "orders";

function parseTab(value: string | null): Tab {
  if (value === "products") return "products";
  if (value === "orders") return "orders";
  return "config";
}

function syncBadgeVariant(
  status: CatalogSyncStatus
): "success" | "warning" | "danger" | "info" | "default" {
  if (status === "linked") return "success";
  if (status === "syncing") return "info";
  if (status === "error") return "danger";
  return "warning";
}

export default function CatalogBotPage() {
  const t = useT();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { botId } = useParams<{ botId: string }>();
  const { data: botsData } = useBots();
  const botName = botsData?.find((bot) => bot.botId === botId)?.name;
  const [tab, setTab] = useState<Tab>(() => parseTab(searchParams.get("tab")));
  const [draft, setDraft] = useState<CatalogConfig | null>(null);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [selectedCatalogId, setSelectedCatalogId] = useState("");

  const { data, isLoading } = useCatalogConfig(botId);
  const { data: metaCatalogs } = useMetaCatalogs(botId);
  const { data: productsData } = useCatalogProducts(botId);
  const { data: ordersData } = useCatalogOrders(botId);
  const { data: paymentsData } = usePaymentsConfig(botId);
  const saveConfig = useSaveCatalogConfig(botId);
  const linkCatalog = useLinkMetaCatalog(botId);
  const syncCatalog = useSyncCatalog(botId);

  useEffect(() => {
    if (data?.config) {
      setDraft(data.config);
      setSelectedCatalogId(data.config.metaCatalogId ?? "");
    }
  }, [data]);

  useEffect(() => {
    setTab(parseTab(searchParams.get("tab")));
  }, [searchParams]);

  function selectTab(next: Tab) {
    setTab(next);
    const params = new URLSearchParams(searchParams.toString());
    if (next === "config") params.delete("tab");
    else params.set("tab", next);
    const qs = params.toString();
    router.replace(`/apps/catalog/${botId}${qs ? `?${qs}` : ""}`, { scroll: false });
  }

  async function handleSave() {
    if (!draft) return;
    setError("");
    setSaved(false);
    try {
      await saveConfig.mutateAsync({
        autoCollectPayment: draft.autoCollectPayment,
        orderConfirmationMessage: draft.orderConfirmationMessage,
        orderStatusMessageTemplate: draft.orderStatusMessageTemplate,
        catalogMessageText: draft.catalogMessageText,
      });
      setSaved(true);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function handleLinkCatalog() {
    if (!selectedCatalogId) return;
    setError("");
    try {
      await linkCatalog.mutateAsync(selectedCatalogId);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function handleSync() {
    setError("");
    try {
      await syncCatalog.mutateAsync();
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

  const productsCount = productsData?.products?.length ?? 0;
  const ordersCount = ordersData?.orders?.length ?? 0;
  const isLinked = Boolean(draft.metaCatalogId);
  const syncVariant = syncBadgeVariant(draft.syncStatus);

  return (
    <DashboardPage>
      <div className="mb-4">
        <Link
          href="/apps/catalog"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-secondary transition-colors hover:text-primary"
        >
          <ArrowLeft className="h-4 w-4" />
          {t("catalog.backToCatalog")}
        </Link>
      </div>

      <PageHeader
        title={botName ? `${t("catalog.manageTitle")} · ${botName}` : t("catalog.manageTitle")}
        subtitle={t("catalog.manageSubtitle")}
      />

      <section className="mb-6 rounded-xl border border-default bg-surface-elevated p-4 sm:p-5">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-secondary">
          {t("catalog.setupTitle")}
        </p>
        <ol className="grid gap-3 sm:grid-cols-3">
          <li className="flex items-center gap-3 rounded-lg border border-default px-3 py-2.5">
            <span
              className={`flex h-8 w-8 items-center justify-center rounded-full ${
                isLinked ? "bg-success/15 text-success" : "bg-surface-muted text-secondary"
              }`}
            >
              {isLinked ? <Check className="h-4 w-4" /> : <Link2 className="h-4 w-4" />}
            </span>
            <div>
              <p className="text-sm font-medium text-primary">{t("catalog.setupStepLink")}</p>
              <p className="text-xs text-secondary">
                {isLinked ? t("catalog.setupLinked") : t("catalog.setupNotLinked")}
              </p>
            </div>
          </li>
          <li className="flex items-center gap-3 rounded-lg border border-default px-3 py-2.5">
            <span
              className={`flex h-8 w-8 items-center justify-center rounded-full ${
                draft.syncStatus === "linked" || draft.lastSyncAt
                  ? "bg-success/15 text-success"
                  : "bg-surface-muted text-secondary"
              }`}
            >
              <RefreshCw className="h-4 w-4" />
            </span>
            <div>
              <p className="text-sm font-medium text-primary">{t("catalog.setupStepSync")}</p>
              <p className="text-xs text-secondary">
                {t(`catalog.catalogSyncStatus.${draft.syncStatus}`)}
              </p>
            </div>
          </li>
          <li className="flex items-center gap-3 rounded-lg border border-default px-3 py-2.5">
            <span
              className={`flex h-8 w-8 items-center justify-center rounded-full ${
                productsCount > 0 ? "bg-success/15 text-success" : "bg-surface-muted text-secondary"
              }`}
            >
              <Package className="h-4 w-4" />
            </span>
            <div>
              <p className="text-sm font-medium text-primary">{t("catalog.setupStepProducts")}</p>
              <p className="text-xs text-secondary">{productsCount}</p>
            </div>
          </li>
        </ol>
      </section>

      <div className="mb-6">
        <Tabs
          value={tab}
          onChange={selectTab}
          items={[
            { id: "config", label: t("catalog.tabs.config") },
            { id: "products", label: t("catalog.tabs.products"), count: productsCount },
            { id: "orders", label: t("catalog.tabs.orders"), count: ordersCount },
          ]}
        />
      </div>

      {error ? (
        <Alert className="mb-4" variant="danger" onDismiss={() => setError("")}>
          {error}
        </Alert>
      ) : null}

      {tab === "config" ? (
        <div className="space-y-6">
          <section className="rounded-xl border border-default bg-surface-elevated p-6 space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-primary">
                  {t("catalog.metaCatalogTitle")}
                </h2>
                <p className="mt-1 text-sm text-secondary">{t("catalog.metaCatalogHint")}</p>
              </div>
              <Badge variant={syncVariant} dot>
                {t(`catalog.catalogSyncStatus.${draft.syncStatus}`)}
              </Badge>
            </div>

            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-[240px] flex-1">
                <label className="mb-1.5 block text-sm font-medium text-secondary">
                  {t("catalog.chooseMetaCatalog")}
                </label>
                <select
                  value={selectedCatalogId}
                  onChange={(e) => setSelectedCatalogId(e.target.value)}
                  className="w-full rounded-lg border border-default bg-surface-elevated px-3 py-2 text-sm"
                >
                  <option value="">{t("catalog.chooseMetaCatalog")}</option>
                  {(metaCatalogs?.catalogs ?? []).map((catalog) => (
                    <option key={catalog.id} value={catalog.id}>
                      {catalog.name}
                    </option>
                  ))}
                </select>
              </div>
              <Button
                type="button"
                variant="secondary"
                onClick={() => void handleLinkCatalog()}
                disabled={!selectedCatalogId || linkCatalog.isPending}
              >
                <Link2 className="h-4 w-4" />
                {t("catalog.linkCatalog")}
              </Button>
              <Button
                type="button"
                onClick={() => void handleSync()}
                disabled={!draft.metaCatalogId || syncCatalog.isPending}
              >
                <RefreshCw
                  className={`h-4 w-4 ${syncCatalog.isPending ? "animate-spin" : ""}`}
                />
                {syncCatalog.isPending ? t("catalog.syncing") : t("catalog.syncProducts")}
              </Button>
            </div>

            {draft.lastSyncAt || draft.lastSyncError ? (
              <div className="space-y-1 text-sm text-secondary">
                {draft.lastSyncAt ? (
                  <p>
                    {t("catalog.lastSyncAt")}: {new Date(draft.lastSyncAt).toLocaleString()}
                  </p>
                ) : null}
                {draft.lastSyncError ? (
                  <Alert variant="warning">{draft.lastSyncError}</Alert>
                ) : null}
              </div>
            ) : null}
          </section>

          <section className="rounded-xl border border-default bg-surface-elevated p-6">
            <div className="mb-4">
              <h2 className="text-base font-semibold text-primary">{t("catalog.messagesTitle")}</h2>
              <p className="mt-1 text-sm text-secondary">{t("catalog.messagesHint")}</p>
            </div>
            <CatalogConfigForm
              config={draft}
              paymentsEnabled={paymentsData?.config?.enabled ?? false}
              onChange={(patch) =>
                setDraft((current) => (current ? { ...current, ...patch } : current))
              }
            />
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <Button
                type="button"
                onClick={() => void handleSave()}
                disabled={saveConfig.isPending}
              >
                {saveConfig.isPending ? t("common.saving") : t("common.save")}
              </Button>
              {saved ? (
                <span className="inline-flex items-center gap-1.5 text-sm text-success">
                  <Check className="h-4 w-4" />
                  {t("catalog.saved")}
                </span>
              ) : null}
            </div>
          </section>
        </div>
      ) : null}

      {tab === "products" ? <CatalogProductsList botId={botId} /> : null}
      {tab === "orders" ? <CatalogOrdersList botId={botId} /> : null}
    </DashboardPage>
  );
}
