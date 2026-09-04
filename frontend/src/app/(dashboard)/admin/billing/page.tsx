"use client";

import { useEffect, useState } from "react";
import {
  useAdminBillingConfig,
  useAdminBillingOverview,
  useUpdateAdminBillingConfig,
  useUpdateTenantBillingPrice,
} from "@/hooks/useAdminBilling";
import { useT } from "@/i18n/context";
import { downloadAdminBillingPdf, downloadAdminCompanyBillingPdf } from "@/lib/admin-billing-pdf";
import { DashboardPage } from "@/components/layout/DashboardPage";
import { PageHeader } from "@/components/layout/PageHeader";
import { TableContainer } from "@/components/ui/TableContainer";
import { Button } from "@/components/ui/Button";
import { SideDrawer } from "@/components/ui/SideDrawer";
import { Download, Pencil, Settings2 } from "lucide-react";
import type { AdminBillingOverviewRow } from "@/types";
import { cn } from "@/lib/utils";

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

function DefaultBillingConfigDrawer({
  open,
  initialCents,
  lastUpdated,
  saving,
  onClose,
  onSave,
}: {
  open: boolean;
  initialCents: number;
  lastUpdated?: string;
  saving: boolean;
  onClose: () => void;
  onSave: (pricePerMessageCents: number) => Promise<void>;
}) {
  const t = useT();
  const [priceInput, setPriceInput] = useState(pesosInputFromCents(initialCents));
  const [error, setError] = useState(false);

  useEffect(() => {
    if (open) {
      setPriceInput(pesosInputFromCents(initialCents));
      setError(false);
    }
  }, [open, initialCents]);

  async function handleSave() {
    const cents = centsFromPesosInput(priceInput);
    if (cents === null) {
      setError(true);
      return;
    }
    setError(false);
    await onSave(cents);
  }

  if (!open) return null;

  return (
    <SideDrawer
      title={t("admin.billing.configTitle")}
      onClose={onClose}
      footer={
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button type="button" onClick={() => void handleSave()} disabled={saving}>
            {saving ? t("common.loading") : t("common.save")}
          </Button>
        </div>
      }
    >
      <div className="space-y-5 p-5">
        <p className="text-sm text-secondary">{t("admin.billing.configHint")}</p>
        <p className="text-xs text-muted">{t("admin.billing.configDefaultHint")}</p>
        <label className="flex flex-col gap-2 text-sm text-secondary">
          <span>{t("admin.billing.pricePerMessage")}</span>
          <div className="flex items-center gap-2">
            <span className="text-primary font-medium">$</span>
            <input
              type="number"
              min={0}
              step={0.01}
              value={priceInput}
              onChange={(e) => setPriceInput(e.target.value)}
              className={cn(
                "w-full rounded-lg border bg-surface px-3 py-2 text-primary",
                error ? "border-danger" : "border-default"
              )}
            />
            <span className="text-secondary whitespace-nowrap">COP</span>
          </div>
        </label>
        {error ? (
          <p className="text-sm text-red-600">{t("admin.billing.configError")}</p>
        ) : null}
        {lastUpdated ? (
          <p className="text-xs text-secondary">
            {t("admin.billing.lastUpdated")}: {new Date(lastUpdated).toLocaleString()}
          </p>
        ) : null}
      </div>
    </SideDrawer>
  );
}

function TenantBillingPriceDrawer({
  row,
  platformPriceCents,
  saving,
  onClose,
  onSave,
}: {
  row: AdminBillingOverviewRow;
  platformPriceCents: number;
  saving: boolean;
  onClose: () => void;
  onSave: (pricePerMessageCents: number | null) => Promise<void>;
}) {
  const t = useT();
  const [priceInput, setPriceInput] = useState(pesosInputFromCents(row.pricePerMessageCents));
  const [error, setError] = useState(false);

  useEffect(() => {
    setPriceInput(pesosInputFromCents(row.pricePerMessageCents));
    setError(false);
  }, [row]);

  async function handleSave() {
    const cents = centsFromPesosInput(priceInput);
    if (cents === null) {
      setError(true);
      return;
    }
    setError(false);
    await onSave(cents);
  }

  async function handleReset() {
    setError(false);
    await onSave(null);
  }

  return (
    <SideDrawer
      title={t("admin.billing.companyPriceDrawerTitle", { name: row.name })}
      onClose={onClose}
      footer={
        <div className="flex flex-wrap justify-end gap-2">
          {!row.usesPlatformPrice ? (
            <Button type="button" variant="ghost" onClick={() => void handleReset()} disabled={saving}>
              {t("admin.billing.resetPlatformPrice")}
            </Button>
          ) : null}
          <Button type="button" variant="ghost" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button type="button" onClick={() => void handleSave()} disabled={saving}>
            {saving ? t("common.loading") : t("common.save")}
          </Button>
        </div>
      }
    >
      <div className="space-y-5 p-5">
        <p className="text-sm text-secondary">{t("admin.billing.companyPriceDrawerHint")}</p>
        <div className="rounded-lg border border-default bg-surface px-4 py-3 text-sm">
          <p className="text-secondary">{t("admin.billing.currentDefaultPrice")}</p>
          <p className="mt-1 font-medium text-primary">{formatCents(platformPriceCents)}</p>
        </div>
        <label className="flex flex-col gap-2 text-sm text-secondary">
          <span>{t("admin.billing.unitPrice")}</span>
          <div className="flex items-center gap-2">
            <span className="text-primary font-medium">$</span>
            <input
              type="number"
              min={0}
              step={0.01}
              value={priceInput}
              onChange={(e) => setPriceInput(e.target.value)}
              className={cn(
                "w-full rounded-lg border bg-surface px-3 py-2 text-primary",
                error ? "border-danger" : "border-default"
              )}
            />
            <span className="text-secondary whitespace-nowrap">COP</span>
          </div>
        </label>
        <p className={cn("text-xs", row.usesPlatformPrice ? "text-muted" : "text-accent")}>
          {row.usesPlatformPrice
            ? t("admin.billing.usesPlatformPrice")
            : t("admin.billing.customPrice")}
        </p>
        {error ? (
          <p className="text-sm text-red-600">{t("admin.billing.configError")}</p>
        ) : null}
      </div>
    </SideDrawer>
  );
}

export default function AdminBillingPage() {
  const t = useT();
  const configQuery = useAdminBillingConfig();
  const overviewQuery = useAdminBillingOverview();
  const updateConfig = useUpdateAdminBillingConfig();
  const updateTenantPrice = useUpdateTenantBillingPrice();
  const [defaultConfigOpen, setDefaultConfigOpen] = useState(false);
  const [editingTenant, setEditingTenant] = useState<AdminBillingOverviewRow | null>(null);
  const [saved, setSaved] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadingCompanyId, setDownloadingCompanyId] = useState<string | null>(null);

  async function handleSaveDefaultConfig(pricePerMessageCents: number) {
    try {
      await updateConfig.mutateAsync({ pricePerMessageCents });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
      setDefaultConfigOpen(false);
    } catch {
      throw new Error("save failed");
    }
  }

  async function handleSaveTenantPrice(
    tenantId: string,
    pricePerMessageCents: number | null
  ) {
    await updateTenantPrice.mutateAsync({ tenantId, pricePerMessageCents });
    setEditingTenant(null);
  }

  const overview = overviewQuery.data;
  const rows = overview?.rows ?? [];
  const platformPriceCents = configQuery.data?.pricePerMessageCents ?? 0;

  function adminPdfLabels() {
    return {
      title: t("admin.billing.overviewTitle"),
      period: t("admin.billing.period"),
      metric: t("admin.billing.pdfMetric"),
      value: t("admin.billing.pdfValue"),
      totalMessages: t("admin.billing.totalMessages"),
      totalEstimated: t("admin.billing.totalEstimated"),
      companyName: t("auth.companyName"),
      email: t("common.email"),
      plan: t("admin.users.plan"),
      messagesCount: t("admin.billing.messagesCount"),
      bulkRecipients: t("admin.billing.bulkRecipients"),
      unitPrice: t("admin.billing.unitPrice"),
      estimatedCost: t("admin.billing.estimatedCost"),
      filenamePrefix: t("admin.billing.pdfFilename"),
    };
  }

  return (
    <DashboardPage className="space-y-10 pb-8">
      <PageHeader
        title={t("admin.billing.title")}
        subtitle={t("admin.billing.subtitle")}
      />

      <section className="rounded-xl border border-default bg-surface-elevated p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-primary mb-1">
              {t("admin.billing.configTitle")}
            </h2>
            <p className="text-sm text-secondary">{t("admin.billing.configHint")}</p>
            <p className="mt-2 text-xs text-muted">{t("admin.billing.configDefaultHint")}</p>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={() => setDefaultConfigOpen(true)}
            disabled={configQuery.isLoading}
          >
            <Settings2 className="mr-1.5 h-4 w-4" />
            {t("admin.billing.configureDefaultPrice")}
          </Button>
        </div>

        {configQuery.isLoading ? (
          <div className="mt-6 h-10 w-full max-w-xs bg-surface-muted rounded-lg animate-pulse" />
        ) : configQuery.data ? (
          <div className="mt-6 flex flex-wrap items-center gap-3 text-sm">
            <span className="text-secondary">{t("admin.billing.currentDefaultPrice")}:</span>
            <span className="font-medium text-primary">
              {formatCents(configQuery.data.pricePerMessageCents)}
            </span>
            {saved ? (
              <span className="text-green-600">{t("admin.billing.configSaved")}</span>
            ) : null}
            {configQuery.data.updatedAt ? (
              <span className="text-xs text-muted">
                {t("admin.billing.lastUpdated")}:{" "}
                {new Date(configQuery.data.updatedAt).toLocaleString()}
              </span>
            ) : null}
          </div>
        ) : null}
      </section>

      <section>
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
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
          <div className="flex flex-col gap-2 sm:items-end">
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
            {overview && rows.length > 0 ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={downloading}
                onClick={() => {
                  setDownloading(true);
                  void downloadAdminBillingPdf({
                    overview,
                    labels: adminPdfLabels(),
                  })
                    .catch(() => undefined)
                    .finally(() => setDownloading(false));
                }}
              >
                <Download className="mr-1.5 h-4 w-4" />
                {downloading ? t("admin.billing.pdfGenerating") : t("admin.billing.downloadPdf")}
              </Button>
            ) : null}
          </div>
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
                  <th className="px-4 py-3 font-medium w-24" />
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
                    <td className="px-4 py-3">
                      <div className="space-y-1">
                        <p className="font-medium text-primary tabular-nums">
                          {formatCents(row.pricePerMessageCents)}
                        </p>
                        <p
                          className={cn(
                            "text-[11px]",
                            row.usesPlatformPrice ? "text-muted" : "text-accent"
                          )}
                        >
                          {row.usesPlatformPrice
                            ? t("admin.billing.usesPlatformPrice")
                            : t("admin.billing.customPrice")}
                        </p>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-medium text-primary">
                      {formatCents(row.estimatedMessageCostCents)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          title={t("admin.billing.configureCompanyPrice")}
                          aria-label={t("admin.billing.configureCompanyPrice")}
                          onClick={() => setEditingTenant(row)}
                          className="inline-flex items-center justify-center rounded-lg p-1.5 text-secondary hover:bg-surface-muted hover:text-primary"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          title={t("admin.billing.downloadCompanyPdf")}
                          aria-label={t("admin.billing.downloadCompanyPdf")}
                          disabled={downloadingCompanyId === row.tenantId}
                          onClick={() => {
                            if (!overview) return;
                            setDownloadingCompanyId(row.tenantId);
                            void downloadAdminCompanyBillingPdf({
                              row,
                              period: overview.period,
                              labels: adminPdfLabels(),
                            })
                              .catch(() => undefined)
                              .finally(() => setDownloadingCompanyId(null));
                          }}
                          className="inline-flex items-center justify-center rounded-lg p-1.5 text-secondary hover:bg-surface-muted hover:text-primary disabled:opacity-50"
                        >
                          <Download className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableContainer>
        )}
      </section>

      {defaultConfigOpen && configQuery.data ? (
        <DefaultBillingConfigDrawer
          open={defaultConfigOpen}
          initialCents={configQuery.data.pricePerMessageCents}
          lastUpdated={configQuery.data.updatedAt}
          saving={updateConfig.isPending}
          onClose={() => setDefaultConfigOpen(false)}
          onSave={handleSaveDefaultConfig}
        />
      ) : null}

      {editingTenant ? (
        <TenantBillingPriceDrawer
          row={editingTenant}
          platformPriceCents={platformPriceCents}
          saving={updateTenantPrice.isPending}
          onClose={() => setEditingTenant(null)}
          onSave={(pricePerMessageCents) =>
            handleSaveTenantPrice(editingTenant.tenantId, pricePerMessageCents)
          }
        />
      ) : null}
    </DashboardPage>
  );
}
