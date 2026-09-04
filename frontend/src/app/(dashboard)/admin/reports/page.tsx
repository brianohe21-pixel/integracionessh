"use client";

import { useMemo, useState } from "react";
import { Download } from "lucide-react";
import { useAdminBillingOverview } from "@/hooks/useAdminBilling";
import { useDownloadAdminSentMessagesCsv } from "@/hooks/useAdminReports";
import { useT } from "@/i18n/context";
import { DashboardPage } from "@/components/layout/DashboardPage";
import { PageHeader } from "@/components/layout/PageHeader";
import { TableContainer } from "@/components/ui/TableContainer";

function currentPeriodValue(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return `${now.getFullYear()}-${month}`;
}

export default function AdminReportsPage() {
  const t = useT();
  const [period, setPeriod] = useState(currentPeriodValue);
  const [downloadingTenantId, setDownloadingTenantId] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const overviewQuery = useAdminBillingOverview(period);
  const downloadCsv = useDownloadAdminSentMessagesCsv();

  const rows = useMemo(() => {
    const items = overviewQuery.data?.rows ?? [];
    return [...items].sort((a, b) => a.name.localeCompare(b.name));
  }, [overviewQuery.data?.rows]);

  async function handleDownload(tenantId: string, tenantName: string) {
    setDownloadError(null);
    setDownloadingTenantId(tenantId);
    try {
      await downloadCsv.mutateAsync({ tenantId, tenantName, period });
    } catch {
      setDownloadError(t("admin.reports.downloadError"));
    } finally {
      setDownloadingTenantId(null);
    }
  }

  return (
    <DashboardPage className="space-y-8 pb-8">
      <PageHeader title={t("admin.reports.title")} subtitle={t("admin.reports.subtitle")} />

      <section className="rounded-xl border border-default bg-surface-elevated p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-primary">{t("admin.reports.sectionTitle")}</h2>
            <p className="mt-1 text-sm text-secondary">{t("admin.reports.sectionHint")}</p>
            <p className="mt-2 text-xs text-muted">{t("admin.reports.retentionHint")}</p>
          </div>
          <label className="flex flex-col gap-2 text-sm text-secondary">
            <span>{t("admin.reports.period")}</span>
            <input
              type="month"
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="rounded-lg border border-default bg-surface px-3 py-2 text-primary"
            />
          </label>
        </div>
      </section>

      <section>
        {downloadError ? <p className="mb-3 text-sm text-red-600">{downloadError}</p> : null}

        {overviewQuery.isLoading ? (
          <div className="h-32 rounded-xl bg-surface-muted animate-pulse" />
        ) : !rows.length ? (
          <p className="text-sm text-secondary">{t("admin.reports.emptyTenants")}</p>
        ) : (
          <TableContainer className="overflow-hidden rounded-xl border border-default bg-surface-elevated">
            <table className="min-w-[720px] w-full text-sm">
              <thead className="bg-surface text-left text-secondary">
                <tr>
                  <th className="px-4 py-3 font-medium">{t("auth.companyName")}</th>
                  <th className="px-4 py-3 font-medium">{t("common.email")}</th>
                  <th className="px-4 py-3 font-medium">{t("admin.users.plan")}</th>
                  <th className="px-4 py-3 font-medium w-40" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map((row) => (
                  <tr key={row.tenantId}>
                    <td className="px-4 py-3 text-primary">{row.name}</td>
                    <td className="px-4 py-3 text-secondary">{row.email}</td>
                    <td className="px-4 py-3 text-secondary">{row.plan}</td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        title={t("admin.reports.downloadCsv")}
                        aria-label={t("admin.reports.downloadCsv")}
                        disabled={downloadingTenantId === row.tenantId}
                        onClick={() => void handleDownload(row.tenantId, row.name)}
                        className="inline-flex items-center justify-center rounded-lg border border-default p-1.5 text-secondary hover:bg-surface-muted hover:text-primary disabled:opacity-50"
                      >
                        <Download className="h-4 w-4" />
                      </button>
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
