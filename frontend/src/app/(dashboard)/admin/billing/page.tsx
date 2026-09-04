"use client";

import { useEffect, useState } from "react";
import {
  useAdminBillingConfig,
  useAdminBillingOverview,
  useUpdateAdminBillingConfig,
} from "@/hooks/useAdminBilling";
import { useT } from "@/i18n/context";
import { DashboardPage } from "@/components/layout/DashboardPage";
import { PageHeader } from "@/components/layout/PageHeader";
import { TableContainer } from "@/components/ui/TableContainer";

function formatCents(cents: number): string {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

function centsFromPesosInput(value: string): number | null {
  const normalized = value.replace(",", ".").trim();
  if (!normalized) return 0;
  const pesos = Number(normalized);
  if (!Number.isFinite(pesos) || pesos < 0) return null;
  return Math.round(pesos * 100);
}

function pesosInputFromCents(cents: number): string {
  if (cents === 0) return "0";
  return String(cents / 100);
}

export default function AdminBillingPage() {
  const t = useT();
  const configQuery = useAdminBillingConfig();
  const overviewQuery = useAdminBillingOverview();
  const updateConfig = useUpdateAdminBillingConfig();
  const [priceInput, setPriceInput] = useState("0");
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState(false);

  useEffect(() => {
    if (configQuery.data) {
      setPriceInput(pesosInputFromCents(configQuery.data.pricePerMessageCents));
    }
  }, [configQuery.data]);

  async function handleSaveConfig() {
    const cents = centsFromPesosInput(priceInput);
    if (cents === null) {
      setSaveError(true);
      return;
    }
    setSaveError(false);
    try {
      await updateConfig.mutateAsync({ pricePerMessageCents: cents });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch {
      setSaveError(true);
    }
  }

  const overview = overviewQuery.data;
  const rows = overview?.rows ?? [];

  return (
    <DashboardPage className="space-y-10 pb-8">
      <PageHeader
        title={t("admin.billing.title")}
        subtitle={t("admin.billing.subtitle")}
      />

      <section className="rounded-xl border border-default bg-surface-elevated p-6">
        <h2 className="text-lg font-semibold text-primary mb-1">
          {t("admin.billing.configTitle")}
        </h2>
        <p className="text-sm text-secondary mb-6">{t("admin.billing.configHint")}</p>

        {configQuery.isLoading ? (
          <div className="h-12 w-full max-w-sm bg-surface-muted rounded-lg animate-pulse" />
        ) : (
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
            <label className="flex flex-col gap-2 text-sm text-secondary max-w-xs">
              <span>{t("admin.billing.pricePerMessage")}</span>
              <div className="flex items-center gap-2">
                <span className="text-primary font-medium">$</span>
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  value={priceInput}
                  onChange={(e) => setPriceInput(e.target.value)}
                  className="w-full rounded-lg border border-default bg-surface px-3 py-2 text-primary"
                />
                <span className="text-secondary whitespace-nowrap">COP</span>
              </div>
            </label>
            <button
              type="button"
              onClick={handleSaveConfig}
              disabled={updateConfig.isPending}
              className="rounded-lg bg-accent px-4 py-2 text-sm text-white hover:bg-accent-hover disabled:opacity-50"
            >
              {t("common.save")}
            </button>
            {saved ? (
              <span className="text-sm text-green-600">{t("admin.billing.configSaved")}</span>
            ) : null}
            {saveError ? (
              <span className="text-sm text-red-600">{t("admin.billing.configError")}</span>
            ) : null}
          </div>
        )}

        {configQuery.data?.updatedAt ? (
          <p className="mt-4 text-xs text-secondary">
            {t("admin.billing.lastUpdated")}:{" "}
            {new Date(configQuery.data.updatedAt).toLocaleString()}
          </p>
        ) : null}
      </section>

      <section>
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-primary">
              {t("admin.billing.overviewTitle")}
            </h2>
            {overview?.period ? (
              <p className="text-sm text-secondary">
                {t("admin.billing.period")}: {overview.period}
              </p>
            ) : null}
          </div>
          {overview ? (
            <div className="text-sm text-secondary">
              <span className="mr-4">
                {t("admin.billing.totalMessages")}: {overview.totals.messagesCount.toLocaleString()}
              </span>
              <span className="font-medium text-primary">
                {t("admin.billing.totalEstimated")}:{" "}
                {formatCents(overview.totals.estimatedMessageCostCents)}
              </span>
            </div>
          ) : null}
        </div>

        {overviewQuery.isLoading ? (
          <div className="h-32 bg-surface-muted rounded-xl animate-pulse" />
        ) : !rows.length ? (
          <p className="text-sm text-secondary">{t("admin.billing.emptyTenants")}</p>
        ) : (
          <TableContainer className="overflow-hidden rounded-xl border border-default bg-surface-elevated">
            <table className="min-w-[960px] w-full text-sm">
              <thead className="bg-surface text-left text-secondary">
                <tr>
                  <th className="px-4 py-3 font-medium">{t("auth.companyName")}</th>
                  <th className="px-4 py-3 font-medium">{t("common.email")}</th>
                  <th className="px-4 py-3 font-medium">{t("admin.users.plan")}</th>
                  <th className="px-4 py-3 font-medium">{t("admin.billing.messagesCount")}</th>
                  <th className="px-4 py-3 font-medium">{t("admin.billing.bulkRecipients")}</th>
                  <th className="px-4 py-3 font-medium">{t("admin.billing.unitPrice")}</th>
                  <th className="px-4 py-3 font-medium">{t("admin.billing.estimatedCost")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map((row) => (
                  <tr key={row.tenantId}>
                    <td className="px-4 py-3 text-primary">{row.name}</td>
                    <td className="px-4 py-3 text-secondary">{row.email}</td>
                    <td className="px-4 py-3 text-secondary">{row.plan}</td>
                    <td className="px-4 py-3 text-secondary">
                      {row.messagesCount.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-secondary">
                      {row.bulkRecipientsCount.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-secondary">
                      {formatCents(overview?.config.pricePerMessageCents ?? 0)}
                    </td>
                    <td className="px-4 py-3 font-medium text-primary">
                      {formatCents(row.estimatedMessageCostCents)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableContainer>
        )}
      </section>
    </DashboardPage>
  );
}
