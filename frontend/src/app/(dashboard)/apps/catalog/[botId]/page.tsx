"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useT } from "@/i18n/context";
import {
  useCatalogConfig,
  useLinkMetaCatalog,
  useMetaCatalogs,
  useSaveCatalogConfig,
  useSyncCatalog,
} from "@/hooks/useCatalog";
import { usePaymentsConfig } from "@/hooks/usePayments";
import type { CatalogConfig } from "@/types";
import { DashboardPage } from "@/components/layout/DashboardPage";
import { PageHeader } from "@/components/layout/PageHeader";
import { CatalogConfigForm } from "@/components/catalog/CatalogConfigForm";
import { CatalogProductsList } from "@/components/catalog/CatalogProductsList";
import { CatalogOrdersList } from "@/components/catalog/CatalogOrdersList";

type Tab = "config" | "products" | "orders";

function parseTab(value: string | null): Tab {
  if (value === "products") return "products";
  if (value === "orders") return "orders";
  return "config";
}

export default function CatalogBotPage() {
  const t = useT();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { botId } = useParams<{ botId: string }>();
  const [tab, setTab] = useState<Tab>(() => parseTab(searchParams.get("tab")));
  const [draft, setDraft] = useState<CatalogConfig | null>(null);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [selectedCatalogId, setSelectedCatalogId] = useState("");

  const { data, isLoading } = useCatalogConfig(botId);
  const { data: metaCatalogs } = useMetaCatalogs(botId);
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

  if (isLoading || !draft) {
    return (
      <DashboardPage>
        <div className="h-64 animate-pulse rounded-xl bg-gray-100" />
      </DashboardPage>
    );
  }

  return (
    <DashboardPage maxWidth="5xl">
      <PageHeader title={t("catalog.manageTitle")} subtitle={t("catalog.manageSubtitle")} />

      <div className="mb-6 flex flex-wrap gap-2 border-b border-gray-200 pb-2">
        {(["config", "products", "orders"] as Tab[]).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => selectTab(key)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
              tab === key
                ? "bg-indigo-50 text-indigo-700"
                : "text-gray-600 hover:bg-gray-50"
            }`}
          >
            {t(`catalog.tabs.${key}`)}
          </button>
        ))}
      </div>

      {error ? (
        <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      {tab === "config" ? (
        <div className="space-y-6">
          <section className="rounded-xl border border-gray-200 bg-white p-6 space-y-4">
            <h2 className="text-base font-semibold text-gray-900">{t("catalog.metaCatalogTitle")}</h2>
            <p className="text-sm text-gray-500">{t("catalog.metaCatalogHint")}</p>
            <div className="flex flex-wrap items-end gap-3">
              <select
                value={selectedCatalogId}
                onChange={(e) => setSelectedCatalogId(e.target.value)}
                className="min-w-[240px] rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white"
              >
                <option value="">{t("catalog.chooseMetaCatalog")}</option>
                {(metaCatalogs?.catalogs ?? []).map((catalog) => (
                  <option key={catalog.id} value={catalog.id}>
                    {catalog.name} ({catalog.id})
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => void handleLinkCatalog()}
                disabled={!selectedCatalogId || linkCatalog.isPending}
                className="rounded-lg border border-indigo-200 px-4 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-50"
              >
                {t("catalog.linkCatalog")}
              </button>
              <button
                type="button"
                onClick={() => void syncCatalog.mutateAsync()}
                disabled={!draft.metaCatalogId || syncCatalog.isPending}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {t("catalog.syncProducts")}
              </button>
            </div>
            {draft.syncStatus ? (
              <p className="text-sm text-gray-600">
                {t("catalog.syncStatus")}: {draft.syncStatus}
                {draft.lastSyncError ? ` — ${draft.lastSyncError}` : ""}
              </p>
            ) : null}
          </section>

          <section className="rounded-xl border border-gray-200 bg-white p-6">
            <CatalogConfigForm
              config={draft}
              paymentsEnabled={paymentsData?.config?.enabled ?? false}
              onChange={(patch) => setDraft((current) => (current ? { ...current, ...patch } : current))}
            />
            <div className="mt-4 flex items-center gap-3">
              <button
                type="button"
                onClick={() => void handleSave()}
                disabled={saveConfig.isPending}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
              >
                {t("common.save")}
              </button>
              {saved ? <span className="text-sm text-green-600">{t("catalog.saved")}</span> : null}
            </div>
          </section>
        </div>
      ) : null}

      {tab === "products" ? <CatalogProductsList botId={botId} /> : null}
      {tab === "orders" ? <CatalogOrdersList botId={botId} /> : null}
    </DashboardPage>
  );
}
