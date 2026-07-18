"use client";

import { useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { useT } from "@/i18n/context";
import {
  dateRangeFromDays,
  isPresetRange,
  isWithinDateRange,
  normalizeDateRange,
  type MetricsDateRange,
} from "@/lib/metrics-date-range";
import type { BotUsageMetrics, BulkSendJob, UsageMetrics, UsageMetricsSummary } from "@/types";

export const METRICS_PERIOD_OPTIONS = [7, 14, 30] as const;
export type MetricsPeriod = (typeof METRICS_PERIOD_OPTIONS)[number];
export type MetricsSection = "all" | "usage" | "marketing" | "calling";

export interface MetricsFilterState extends MetricsDateRange {
  botId: string;
  section: MetricsSection;
}

function parseSection(value: string | null): MetricsSection {
  if (value === "usage" || value === "marketing" || value === "calling") return value;
  return "all";
}

function parseDateRange(searchParams: URLSearchParams): MetricsDateRange {
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  if (from && to) return normalizeDateRange(from, to);

  const daysParam = searchParams.get("days");
  const days = daysParam ? parseInt(daysParam, 10) : 7;
  if (Number.isFinite(days) && days > 0) return dateRangeFromDays(days);

  return dateRangeFromDays(7);
}

export function useMetricsFilters(): {
  filters: MetricsFilterState;
  setFilters: (patch: Partial<MetricsFilterState>) => void;
} {
  const router = useRouter();
  const searchParams = useSearchParams();

  const filters: MetricsFilterState = {
    ...parseDateRange(searchParams),
    botId: searchParams.get("botId") ?? "",
    section: parseSection(searchParams.get("section")),
  };

  function setFilters(patch: Partial<MetricsFilterState>) {
    const params = new URLSearchParams(searchParams.toString());
    const nextRange = normalizeDateRange(
      patch.from ?? filters.from,
      patch.to ?? filters.to
    );
    const next: MetricsFilterState = {
      ...nextRange,
      botId: patch.botId ?? filters.botId,
      section: patch.section ?? filters.section,
    };

    params.set("from", next.from);
    params.set("to", next.to);
    params.delete("days");
    if (next.botId) params.set("botId", next.botId);
    else params.delete("botId");
    if (next.section !== "all") params.set("section", next.section);
    else params.delete("section");

    router.replace(`/metrics?${params.toString()}`, { scroll: false });
  }

  return { filters, setFilters };
}

export function filterUsageMetrics(
  metrics: UsageMetrics,
  botId: string,
  range: MetricsDateRange
): { summary: UsageMetricsSummary; byBot: BotUsageMetrics[]; recentBulkJobs: BulkSendJob[] } {
  const inRange = (iso: string) => isWithinDateRange(iso, range);
  const recentBulkJobs = metrics.recentBulkJobs.filter(
    (job) => inRange(job.createdAt) && (!botId || job.botId === botId)
  );

  if (!botId) {
    return {
      summary: {
        ...metrics.summary,
        bulkJobsCount: recentBulkJobs.length,
        bulkMessagesSent: recentBulkJobs.reduce((sum, job) => sum + job.sent, 0),
        bulkMessagesFailed: recentBulkJobs.reduce((sum, job) => sum + job.failed, 0),
      },
      byBot: metrics.byBot,
      recentBulkJobs,
    };
  }

  const byBot = metrics.byBot.filter((bot) => bot.botId === botId);
  const selected = byBot[0];
  if (!selected) {
    return {
      summary: {
        totalBots: 0,
        activeBots: 0,
        totalConversations: 0,
        activeConversations: 0,
        totalMessages: 0,
        totalTemplates: 0,
        bulkJobsCount: recentBulkJobs.length,
        bulkMessagesSent: recentBulkJobs.reduce((sum, job) => sum + job.sent, 0),
        bulkMessagesFailed: recentBulkJobs.reduce((sum, job) => sum + job.failed, 0),
        lastActivityAt: null,
      },
      byBot: [],
      recentBulkJobs,
    };
  }

  const bulkMessagesSent = recentBulkJobs.reduce((sum, job) => sum + job.sent, 0);
  const bulkMessagesFailed = recentBulkJobs.reduce((sum, job) => sum + job.failed, 0);

  return {
    summary: {
      totalBots: 1,
      activeBots: selected.status === "active" ? 1 : 0,
      totalConversations: selected.conversations,
      activeConversations: selected.activeConversations,
      totalMessages: selected.messages,
      totalTemplates: selected.templates,
      bulkJobsCount: recentBulkJobs.length,
      bulkMessagesSent,
      bulkMessagesFailed,
      lastActivityAt: selected.lastActivityAt,
    },
    byBot,
    recentBulkJobs,
  };
}

type MetricsFiltersBarProps = {
  filters: MetricsFilterState;
  bots: Array<{ botId: string; botName: string }>;
  onChange: (patch: Partial<MetricsFilterState>) => void;
};

export function MetricsFiltersBar({ filters, bots, onChange }: MetricsFiltersBarProps) {
  const t = useT();

  const selectClass =
    "w-full px-3 py-2 border border-default rounded-lg text-sm bg-surface-elevated focus:outline-none focus:ring-2 focus:ring-accent";

  const inputClass =
    "w-full px-3 py-2 border border-default rounded-lg text-sm bg-surface-elevated focus:outline-none focus:ring-2 focus:ring-accent";

  return (
    <div className="rounded-xl border border-default bg-surface-elevated p-4 space-y-4">
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="space-y-1">
            <label className="text-xs font-medium uppercase tracking-wide text-secondary">
              {t("metrics.filterDateFrom")}
            </label>
            <input
              type="date"
              value={filters.from}
              max={filters.to}
              onChange={(e) => onChange({ from: e.target.value })}
              className={inputClass}
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium uppercase tracking-wide text-secondary">
              {t("metrics.filterDateTo")}
            </label>
            <input
              type="date"
              value={filters.to}
              min={filters.from}
              onChange={(e) => onChange({ to: e.target.value })}
              className={inputClass}
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium uppercase tracking-wide text-secondary">
              {t("metrics.filterBot")}
            </label>
            <select
              value={filters.botId}
              onChange={(e) => onChange({ botId: e.target.value })}
              className={selectClass}
            >
              <option value="">{t("metrics.filterBotAll")}</option>
              {bots.map((bot) => (
                <option key={bot.botId} value={bot.botId}>
                  {bot.botName}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium uppercase tracking-wide text-secondary">
              {t("metrics.filterSection")}
            </label>
            <select
              value={filters.section}
              onChange={(e) => onChange({ section: e.target.value as MetricsSection })}
              className={selectClass}
            >
              <option value="all">{t("metrics.filterSectionAll")}</option>
              <option value="usage">{t("metrics.filterSectionUsage")}</option>
              <option value="marketing">{t("metrics.filterSectionMarketing")}</option>
              <option value="calling">{t("metrics.filterSectionCalling")}</option>
            </select>
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-secondary">
            {t("metrics.filterPeriod")}
          </p>
          <div className="flex flex-wrap gap-2">
            {METRICS_PERIOD_OPTIONS.map((days) => (
              <button
                key={days}
                type="button"
                onClick={() => onChange(dateRangeFromDays(days))}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors",
                  isPresetRange(filters, days)
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
    </div>
  );
}

export function useFilteredUsageMetrics(
  metrics: UsageMetrics | undefined,
  botId: string,
  range: MetricsDateRange
) {
  return useMemo(
    () => (metrics ? filterUsageMetrics(metrics, botId, range) : undefined),
    [metrics, botId, range]
  );
}
