"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useBillingPayments } from "@/hooks/useBilling";
import { useFormatters } from "@/hooks/useFormatters";
import { useT } from "@/i18n/context";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { TableContainer } from "@/components/ui/TableContainer";
import {
  dateRangeFromDays,
  isPresetRange,
  isWithinDateRange,
  normalizeDateRange,
  type MetricsDateRange,
} from "@/lib/metrics-date-range";
import { cn } from "@/lib/utils";
import type { PaymentStatus } from "@/types";

const PAGE_SIZE_OPTIONS = [5, 10, 20] as const;
const PERIOD_OPTIONS = [7, 30, 90] as const;

type DateFilterState = {
  from: string;
  to: string;
};

const EMPTY_DATE_FILTERS: DateFilterState = { from: "", to: "" };

function paymentStatusVariant(
  status: PaymentStatus
): "success" | "warning" | "danger" | "default" {
  if (status === "approved") return "success";
  if (status === "pending") return "warning";
  if (status === "declined") return "danger";
  return "default";
}

function hasDateRange(filters: DateFilterState): boolean {
  return Boolean(filters.from && filters.to);
}

function activeDateRange(filters: DateFilterState): MetricsDateRange | null {
  if (!hasDateRange(filters)) return null;
  return normalizeDateRange(filters.from, filters.to);
}

function isPresetDateRange(filters: DateFilterState, days: number): boolean {
  const range = activeDateRange(filters);
  return range ? isPresetRange(range, days) : false;
}

export function PaymentHistoryTab() {
  const t = useT();
  const { formatDate, formatCurrency, planLabel } = useFormatters();
  const { data: payments, isLoading } = useBillingPayments();
  const [dateFilters, setDateFilters] = useState<DateFilterState>(EMPTY_DATE_FILTERS);
  const [pageSize, setPageSize] = useState<number>(10);
  const [pageIndex, setPageIndex] = useState(0);

  const inputClass =
    "w-full px-3 py-2 border border-default rounded-lg text-sm bg-surface-elevated focus:outline-none focus:ring-2 focus:ring-accent";

  const filteredPayments = useMemo(() => {
    const all = payments ?? [];
    const range = activeDateRange(dateFilters);
    if (!range) return all;
    return all.filter((payment) => isWithinDateRange(payment.createdAt, range));
  }, [payments, dateFilters]);

  const totalPages = Math.max(1, Math.ceil(filteredPayments.length / pageSize));
  const safePageIndex = Math.min(pageIndex, totalPages - 1);
  const pageStart = safePageIndex * pageSize;
  const pageItems = filteredPayments.slice(pageStart, pageStart + pageSize);
  const rangeFrom = filteredPayments.length === 0 ? 0 : pageStart + 1;
  const rangeTo = Math.min(pageStart + pageSize, filteredPayments.length);

  useEffect(() => {
    setPageIndex(0);
  }, [dateFilters.from, dateFilters.to, pageSize]);

  useEffect(() => {
    if (pageIndex > totalPages - 1) {
      setPageIndex(Math.max(0, totalPages - 1));
    }
  }, [pageIndex, totalPages]);

  if (isLoading) {
    return <div className="h-48 animate-pulse rounded-xl bg-surface-muted" />;
  }

  if (!payments?.length) {
    return (
      <p className="text-sm text-secondary">{t("billing.paymentHistory.empty")}</p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-default bg-surface p-4 space-y-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1">
            <label className="text-xs font-medium uppercase tracking-wide text-secondary">
              {t("metrics.filterDateFrom")}
            </label>
            <input
              type="date"
              value={dateFilters.from}
              max={dateFilters.to || undefined}
              onChange={(event) => {
                const nextFrom = event.target.value;
                if (!nextFrom) {
                  setDateFilters((current) => ({ ...current, from: "" }));
                  return;
                }
                const nextTo = dateFilters.to || nextFrom;
                const range = normalizeDateRange(nextFrom, nextTo);
                setDateFilters({ from: range.from, to: range.to });
              }}
              className={inputClass}
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium uppercase tracking-wide text-secondary">
              {t("metrics.filterDateTo")}
            </label>
            <input
              type="date"
              value={dateFilters.to}
              min={dateFilters.from || undefined}
              onChange={(event) => {
                const nextTo = event.target.value;
                if (!nextTo) {
                  setDateFilters((current) => ({ ...current, to: "" }));
                  return;
                }
                const nextFrom = dateFilters.from || nextTo;
                const range = normalizeDateRange(nextFrom, nextTo);
                setDateFilters({ from: range.from, to: range.to });
              }}
              className={inputClass}
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium uppercase tracking-wide text-secondary">
              {t("billing.paymentHistory.pageSize")}
            </label>
            <select
              value={pageSize}
              onChange={(event) => setPageSize(Number(event.target.value))}
              className={inputClass}
            >
              {PAGE_SIZE_OPTIONS.map((size) => (
                <option key={size} value={size}>
                  {t("billing.paymentHistory.pageSizeOption", { size })}
                </option>
              ))}
            </select>
          </div>
          {hasDateRange(dateFilters) ? (
            <div className="flex items-end">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="w-full sm:w-auto"
                onClick={() => setDateFilters(EMPTY_DATE_FILTERS)}
              >
                {t("contacts.clearDateRange")}
              </Button>
            </div>
          ) : null}
        </div>

        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-secondary">
            {t("metrics.filterPeriod")}
          </p>
          <div className="flex flex-wrap gap-2">
            {PERIOD_OPTIONS.map((days) => (
              <button
                key={days}
                type="button"
                onClick={() => {
                  const range = dateRangeFromDays(days);
                  setDateFilters({ from: range.from, to: range.to });
                }}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors",
                  isPresetDateRange(dateFilters, days)
                    ? "border-accent bg-accent-muted text-accent"
                    : "border-default text-secondary hover:border-default hover:text-primary"
                )}
              >
                {t("metrics.filterPeriodDays", { days })}
              </button>
            ))}
          </div>
        </div>
      </div>

      {filteredPayments.length === 0 ? (
        <p className="text-sm text-secondary">{t("billing.paymentHistory.noResults")}</p>
      ) : (
        <>
          <TableContainer className="overflow-hidden rounded-xl border border-default bg-surface-elevated">
            <table className="min-w-[480px] w-full text-sm">
              <thead className="bg-surface text-left text-secondary">
                <tr>
                  <th className="px-4 py-3 font-medium">{t("common.date")}</th>
                  <th className="px-4 py-3 font-medium">{t("billing.currentPlan")}</th>
                  <th className="px-4 py-3 font-medium">{t("billing.paymentHistory.amount")}</th>
                  <th className="px-4 py-3 font-medium">{t("common.status")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {pageItems.map((payment) => (
                  <tr key={payment.reference}>
                    <td className="px-4 py-3 text-secondary">{formatDate(payment.createdAt)}</td>
                    <td className="px-4 py-3 text-primary">{planLabel(payment.plan)}</td>
                    <td className="px-4 py-3 text-secondary">
                      {formatCurrency(payment.amountInCents)}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={paymentStatusVariant(payment.status)}>
                        {t(`billing.paymentStatus.${payment.status}`)}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableContainer>

          <div className="flex flex-col gap-3 border-t border-default pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-secondary">
              {t("campaigns.showingRange", {
                from: rangeFrom,
                to: rangeTo,
                total: filteredPayments.length,
              })}
              {" · "}
              {t("billing.paymentHistory.pageOf", {
                page: safePageIndex + 1,
                total: totalPages,
              })}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPageIndex((current) => Math.max(0, current - 1))}
                disabled={safePageIndex <= 0}
                className="inline-flex items-center gap-1 rounded-lg border border-default px-3 py-1.5 text-sm text-primary transition-colors hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-50"
              >
                <ChevronLeft className="h-4 w-4" />
                {t("campaigns.previousPage")}
              </button>
              <button
                type="button"
                onClick={() =>
                  setPageIndex((current) => Math.min(totalPages - 1, current + 1))
                }
                disabled={safePageIndex >= totalPages - 1}
                className="inline-flex items-center gap-1 rounded-lg border border-default px-3 py-1.5 text-sm text-primary transition-colors hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-50"
              >
                {t("campaigns.nextPage")}
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
