"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Download } from "lucide-react";
import { useAdminBillingOverview } from "@/hooks/useAdminBilling";
import { useDownloadAdminSentMessagesCsv } from "@/hooks/useAdminReports";
import { useT } from "@/i18n/context";
import { DashboardPage } from "@/components/layout/DashboardPage";
import { PageHeader } from "@/components/layout/PageHeader";
import { SearchInput } from "@/components/ui/SearchInput";
import { TableContainer } from "@/components/ui/TableContainer";
import type { AdminBillingOverviewRow, TenantPlan } from "@/types";

const PAGE_SIZE = 20;

type PlanFilter = "" | TenantPlan;
type ActivityFilter = "" | "with_messages" | "without_messages";

function currentPeriodValue(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return `${now.getFullYear()}-${month}`;
}

export default function AdminReportsPage() {
  const t = useT();
  const [period, setPeriod] = useState(currentPeriodValue);
  const [query, setQuery] = useState("");
  const [planFilter, setPlanFilter] = useState<PlanFilter>("");
  const [activityFilter, setActivityFilter] = useState<ActivityFilter>("");
  const [page, setPage] = useState(1);
  const [downloadingTenantId, setDownloadingTenantId] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const overviewQuery = useAdminBillingOverview(period);
  const downloadCsv = useDownloadAdminSentMessagesCsv();

  useEffect(() => {
    setPage(1);
  }, [query, planFilter, activityFilter, period]);

  const filteredRows = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const items = overviewQuery.data?.rows ?? [];

    return [...items]
      .sort((a, b) => a.name.localeCompare(b.name))
      .filter((row) => {
        if (planFilter && row.plan !== planFilter) return false;
        if (activityFilter === "with_messages" && row.messagesCount <= 0) return false;
        if (activityFilter === "without_messages" && row.messagesCount > 0) return false;

        if (!normalizedQuery) return true;

        return (
          row.name.toLowerCase().includes(normalizedQuery) ||
          row.email.toLowerCase().includes(normalizedQuery) ||
          row.tenantId.toLowerCase().includes(normalizedQuery)
        );
      });
  }, [overviewQuery.data?.rows, query, planFilter, activityFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageStart = filteredRows.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const pageEnd = Math.min(safePage * PAGE_SIZE, filteredRows.length);
  const paginatedRows = filteredRows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  async function handleDownload(row: AdminBillingOverviewRow) {
    setDownloadError(null);
    setDownloadingTenantId(row.tenantId);
    try {
      await downloadCsv.mutateAsync({
        tenantId: row.tenantId,
        tenantName: row.name,
        period,
      });
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

      <section className="space-y-4">
        {downloadError ? <p className="text-sm text-red-600">{downloadError}</p> : null}

        {overviewQuery.isLoading ? (
          <div className="h-32 rounded-xl bg-surface-muted animate-pulse" />
        ) : !overviewQuery.data?.rows.length ? (
          <p className="text-sm text-secondary">{t("admin.reports.emptyTenants")}</p>
        ) : (
          <>
            <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
              <SearchInput
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onClear={() => setQuery("")}
                placeholder={t("admin.reports.searchPlaceholder")}
                className="w-full xl:max-w-md"
              />
              <div className="flex flex-wrap gap-2">
                <select
                  value={planFilter}
                  onChange={(event) => setPlanFilter(event.target.value as PlanFilter)}
                  className="rounded-lg border border-default bg-surface-elevated px-3 py-2 text-sm"
                >
                  <option value="">{t("admin.users.filterPlanAll")}</option>
                  <option value="free">{t("common.planFree")}</option>
                  <option value="starter">{t("common.planStarter")}</option>
                  <option value="pro">{t("common.planPro")}</option>
                  <option value="reseller">{t("common.planReseller")}</option>
                </select>
                <select
                  value={activityFilter}
                  onChange={(event) => setActivityFilter(event.target.value as ActivityFilter)}
                  className="rounded-lg border border-default bg-surface-elevated px-3 py-2 text-sm"
                >
                  <option value="">{t("admin.reports.filterActivityAll")}</option>
                  <option value="with_messages">{t("admin.reports.filterWithMessages")}</option>
                  <option value="without_messages">{t("admin.reports.filterWithoutMessages")}</option>
                </select>
              </div>
            </div>

            {filteredRows.length === 0 ? (
              <p className="text-sm text-secondary">{t("admin.reports.noTenantsMatch")}</p>
            ) : (
              <>
                <TableContainer className="overflow-hidden rounded-xl border border-default bg-surface-elevated">
                  <table className="min-w-[720px] w-full text-sm">
                    <thead className="bg-surface text-left text-secondary">
                      <tr>
                        <th className="px-4 py-3 font-medium">{t("auth.companyName")}</th>
                        <th className="px-4 py-3 font-medium">{t("common.email")}</th>
                        <th className="px-4 py-3 font-medium">{t("admin.users.plan")}</th>
                        <th className="px-4 py-3 font-medium w-16" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {paginatedRows.map((row) => (
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
                              onClick={() => void handleDownload(row)}
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

                <div className="flex flex-col gap-3 border-t border-default pt-4 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm text-secondary">
                    {t("campaigns.showingRange", {
                      from: pageStart,
                      to: pageEnd,
                      total: filteredRows.length,
                    })}
                  </p>
                  {totalPages > 1 ? (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setPage((current) => Math.max(1, current - 1))}
                        disabled={safePage <= 1}
                        className="inline-flex items-center gap-1 rounded-lg border border-default px-3 py-1.5 text-sm text-primary transition-colors hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <ChevronLeft className="h-4 w-4" />
                        {t("campaigns.previousPage")}
                      </button>
                      <span className="px-2 text-sm text-secondary">
                        {t("campaigns.pageOf", { page: safePage, total: totalPages })}
                      </span>
                      <button
                        type="button"
                        onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                        disabled={safePage >= totalPages}
                        className="inline-flex items-center gap-1 rounded-lg border border-default px-3 py-1.5 text-sm text-primary transition-colors hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {t("campaigns.nextPage")}
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </div>
                  ) : null}
                </div>
              </>
            )}
          </>
        )}
      </section>
    </DashboardPage>
  );
}
