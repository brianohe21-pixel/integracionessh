"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, Megaphone, Send, XCircle } from "lucide-react";
import { useSmsOverview, type SmsOverviewFilters } from "@/hooks/useSms";
import { useT } from "@/i18n/context";
import { Skeleton } from "@/components/ui/Skeleton";
import { StatCard } from "@/components/ui/StatCard";
import { SmsOverviewChartsPanel } from "./SmsOverviewCharts";

function formatRate(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

export function SmsOverviewStrip() {
  const t = useT();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const filters = useMemo<SmsOverviewFilters>(
    () => ({
      ...(from ? { from: new Date(from).toISOString() } : {}),
      ...(to ? { to: new Date(`${to}T23:59:59.999`).toISOString() } : {}),
    }),
    [from, to]
  );

  const overviewQuery = useSmsOverview(filters);
  const hasDateFilter = Boolean(from || to);

  if (overviewQuery.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-28 w-full" />
          ))}
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-80 w-full" />
          <Skeleton className="h-80 w-full" />
        </div>
      </div>
    );
  }

  const overview = overviewQuery.data;
  if (!overview) return null;

  const totalSent = overview.dlrDelivered + overview.dlrSent + overview.dlrPending + overview.dlrFailed;

  return (
    <div className="space-y-4">
      <div className="content-card p-4 sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="font-semibold text-primary">{t("smsDashboard.overview.title")}</h2>
            <p className="mt-1 text-sm text-secondary">
              {hasDateFilter
                ? t("smsDashboard.overview.subtitleFiltered")
                : t("smsDashboard.overview.subtitle")}
            </p>
          </div>

          <div className="flex flex-wrap items-end gap-2">
            <label className="space-y-1">
              <span className="text-xs text-secondary">{t("smsDashboard.history.filterFrom")}</span>
              <input
                type="date"
                value={from}
                onChange={(event) => setFrom(event.target.value)}
                className="rounded-lg border border-default bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </label>
            <label className="space-y-1">
              <span className="text-xs text-secondary">{t("smsDashboard.history.filterTo")}</span>
              <input
                type="date"
                value={to}
                onChange={(event) => setTo(event.target.value)}
                className="rounded-lg border border-default bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </label>
            {hasDateFilter ? (
              <button
                type="button"
                onClick={() => {
                  setFrom("");
                  setTo("");
                }}
                className="rounded-lg border border-default bg-surface px-3 py-2 text-sm text-secondary transition-colors hover:bg-surface-muted"
              >
                {t("smsDashboard.overview.clearFilters")}
              </button>
            ) : null}
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label={t("smsDashboard.overview.totalSends")}
          value={totalSent.toLocaleString()}
          icon={<Send className="h-4 w-4" />}
        />
        <StatCard
          label={t("smsDashboard.overview.delivered")}
          value={overview.dlrDelivered.toLocaleString()}
          icon={<CheckCircle2 className="h-4 w-4" />}
        />
        <StatCard
          label={t("smsDashboard.overview.failed")}
          value={overview.dlrFailed.toLocaleString()}
          icon={<XCircle className="h-4 w-4" />}
        />
        <StatCard
          label={t("smsDashboard.overview.deliveryRate")}
          value={formatRate(overview.deliveryRate)}
          icon={<Megaphone className="h-4 w-4" />}
        />
      </div>

      <SmsOverviewChartsPanel charts={overview.charts} />
    </div>
  );
}
