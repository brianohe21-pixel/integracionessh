"use client";

import { useMemo } from "react";
import {
  BarChart3,
  BotMessageSquare,
  MessageSquare,
  SendHorizonal,
  LayoutTemplate,
  Activity,
  Phone,
  AlertTriangle,
} from "lucide-react";
import Link from "next/link";
import { useMetrics } from "@/hooks/useMetrics";
import { useMarketingMetrics } from "@/hooks/useMarketingMetrics";
import { useCallingMetrics, formatCallDuration } from "@/hooks/useCallingMetrics";
import {
  MetricsFiltersBar,
  useFilteredUsageMetrics,
  useMetricsFilters,
} from "@/components/metrics/MetricsFilters";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { useFormatters } from "@/hooks/useFormatters";
import { DashboardPage } from "@/components/layout/DashboardPage";
import { PageHeader } from "@/components/layout/PageHeader";
import { TableContainer } from "@/components/ui/TableContainer";
import { useT } from "@/i18n/context";
import type { BulkSendJobStatus, CallingMetricsHealth } from "@/types";

function KpiCard({
  label,
  value,
  sub,
  icon,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="bg-surface-elevated rounded-xl border border-default p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-secondary uppercase tracking-wide">{label}</p>
          <p className="text-2xl font-bold text-primary mt-1">{value}</p>
          {sub && <p className="text-xs text-muted mt-1">{sub}</p>}
        </div>
        <div className="flex items-center justify-center w-10 h-10 bg-accent-muted rounded-xl text-accent">
          {icon}
        </div>
      </div>
    </div>
  );
}

function bulkStatusVariant(status: BulkSendJobStatus): "success" | "warning" | "danger" | "default" | "info" {
  switch (status) {
    case "completed":
      return "success";
    case "processing":
    case "queued":
      return "info";
    case "failed":
      return "danger";
    default:
      return "default";
  }
}

export default function MetricsPage() {
  const t = useT();
  const { formatDate, formatNumber, formatRelativeTime } = useFormatters();
  const { filters, setFilters } = useMetricsFilters();
  const { data: metrics, isLoading, error } = useMetrics();
  const dateRange = useMemo(
    () => ({ from: filters.from, to: filters.to }),
    [filters.from, filters.to]
  );
  const filteredUsage = useFilteredUsageMetrics(metrics, filters.botId, dateRange);
  const { data: marketing, isLoading: marketingLoading } = useMarketingMetrics();
  const { data: calling, isLoading: callingLoading } = useCallingMetrics(
    dateRange,
    filters.botId || undefined
  );

  const botOptions = useMemo(
    () =>
      (metrics?.byBot ?? []).map((bot) => ({
        botId: bot.botId,
        botName: bot.botName,
      })),
    [metrics?.byBot]
  );

  const showUsage = filters.section === "all" || filters.section === "usage";
  const showMarketing = filters.section === "all" || filters.section === "marketing";
  const showCalling = filters.section === "all" || filters.section === "calling";

  function callingHealthVariant(
    health: CallingMetricsHealth
  ): "success" | "warning" | "default" {
    if (health === "healthy") return "success";
    if (health === "at_risk") return "warning";
    return "default";
  }

  function callingHealthLabel(health: CallingMetricsHealth): string {
    if (health === "healthy") return t("metrics.callingHealthHealthy");
    if (health === "at_risk") return t("metrics.callingHealthAtRisk");
    return t("metrics.callingHealthInsufficient");
  }

  function bulkStatusLabel(status: BulkSendJobStatus): string {
    const labels: Record<BulkSendJobStatus, string> = {
      queued: t("bulkSend.statusQueued"),
      processing: t("bulkSend.statusProcessing"),
      completed: t("bulkSend.statusCompleted"),
      failed: t("bulkSend.statusFailed"),
    };
    return labels[status] ?? status;
  }

  function formatRangeDate(date: string): string {
    return formatDate(`${date}T12:00:00.000Z`);
  }

  return (
    <DashboardPage>
      <PageHeader title={t("metrics.title")} subtitle={t("metrics.subtitle")} />

      {!isLoading && metrics && (
        <div className="mb-6">
          <MetricsFiltersBar filters={filters} bots={botOptions} onChange={setFilters} />
        </div>
      )}

      {isLoading && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-surface-elevated rounded-xl border border-default p-5 animate-pulse h-24" />
            ))}
          </div>
          <div className="bg-surface-elevated rounded-xl border border-default p-6 animate-pulse h-48" />
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <p className="text-sm text-red-600 font-medium">{t("metrics.loadError")}</p>
          <p className="text-xs text-red-500 mt-1 break-words">{error.message}</p>
        </div>
      )}

      {!isLoading && !error && metrics && filteredUsage && (
        <div className="space-y-8">
          {showUsage && (
            <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard
              label={t("metrics.activeBots")}
              value={`${formatNumber(filteredUsage.summary.activeBots)} / ${formatNumber(filteredUsage.summary.totalBots)}`}
              icon={<BotMessageSquare className="w-5 h-5" />}
            />
            <KpiCard
              label={t("metrics.conversations")}
              value={formatNumber(filteredUsage.summary.totalConversations)}
              sub={t("metrics.activeSub", { count: filteredUsage.summary.activeConversations })}
              icon={<MessageSquare className="w-5 h-5" />}
            />
            <KpiCard
              label={t("metrics.messages")}
              value={formatNumber(filteredUsage.summary.totalMessages)}
              sub={t("metrics.messagesSub")}
              icon={<BarChart3 className="w-5 h-5" />}
            />
            <KpiCard
              label={t("metrics.bulkSends")}
              value={formatNumber(filteredUsage.summary.bulkMessagesSent)}
              sub={
                filteredUsage.summary.bulkMessagesFailed > 0
                  ? t("metrics.bulkFailed", { count: filteredUsage.summary.bulkMessagesFailed })
                  : t("metrics.bulkCampaigns", { count: filteredUsage.summary.bulkJobsCount })
              }
              icon={<SendHorizonal className="w-5 h-5" />}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <KpiCard
              label={t("metrics.templates")}
              value={formatNumber(filteredUsage.summary.totalTemplates)}
              icon={<LayoutTemplate className="w-5 h-5" />}
            />
            <KpiCard
              label={t("metrics.bulkCampaignsLabel")}
              value={formatNumber(filteredUsage.summary.bulkJobsCount)}
              icon={<SendHorizonal className="w-5 h-5" />}
            />
            <KpiCard
              label={t("metrics.lastActivity")}
              value={
                filteredUsage.summary.lastActivityAt
                  ? formatRelativeTime(filteredUsage.summary.lastActivityAt)
                  : t("common.noActivity")
              }
              sub={
                filteredUsage.summary.lastActivityAt
                  ? formatDate(filteredUsage.summary.lastActivityAt)
                  : undefined
              }
              icon={<Activity className="w-5 h-5" />}
            />
          </div>
            </>
          )}

          {showMarketing && !marketingLoading && marketing?.campaigns?.rates && marketing.inbox && (
            <div className="space-y-4">
              <div>
                <h2 className="font-semibold text-primary">{t("metrics.marketingTitle")}</h2>
                <p className="text-sm text-secondary">{t("metrics.marketingSubtitle")}</p>
                {filters.botId && (
                  <p className="text-xs text-amber-700 mt-1">{t("metrics.marketingTenantScope")}</p>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <KpiCard
                  label={t("metrics.deliveryRate")}
                  value={`${marketing.campaigns.rates.deliveryRate}%`}
                  sub={`${formatNumber(marketing.campaigns.aggregates.delivered)} / ${formatNumber(marketing.campaigns.aggregates.sent)}`}
                  icon={<SendHorizonal className="w-5 h-5" />}
                />
                <KpiCard
                  label={t("metrics.readRate")}
                  value={`${marketing.campaigns.rates.readRate}%`}
                  sub={`${formatNumber(marketing.campaigns.aggregates.read)}`}
                  icon={<BarChart3 className="w-5 h-5" />}
                />
                <KpiCard
                  label={t("metrics.inboxOpen")}
                  value={formatNumber(marketing.inbox.open)}
                  sub={`${t("metrics.inboxPending")}: ${marketing.inbox.pending}`}
                  icon={<MessageSquare className="w-5 h-5" />}
                />
                <KpiCard
                  label={t("metrics.resolvedToday")}
                  value={formatNumber(marketing.inbox.resolvedToday)}
                  icon={<Activity className="w-5 h-5" />}
                />
              </div>
              {(marketing.topCampaigns?.length ?? 0) > 0 && (
                <div className="overflow-hidden rounded-xl border border-default bg-surface-elevated">
                  <div className="border-b border-subtle px-4 py-4 sm:px-6">
                    <h3 className="text-sm font-semibold text-primary">{t("metrics.topCampaigns")}</h3>
                  </div>
                  <TableContainer>
                  <table className="w-full min-w-[560px] text-sm">
                    <thead>
                      <tr className="bg-surface text-left text-xs text-secondary uppercase">
                        <th className="px-6 py-3">{t("campaigns.nameLabel")}</th>
                        <th className="px-6 py-3 text-right">{t("metrics.colSent")}</th>
                        <th className="px-6 py-3 text-right">{t("metrics.deliveryRate")}</th>
                        <th className="px-6 py-3 text-right">{t("metrics.readRate")}</th>
                        <th className="px-6 py-3" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {marketing.topCampaigns.map((c) => (
                        <tr key={c.campaignId}>
                          <td className="px-6 py-3 font-medium">{c.name}</td>
                          <td className="px-6 py-3 text-right">{formatNumber(c.sent)}</td>
                          <td className="px-6 py-3 text-right">{c.deliveryRate}%</td>
                          <td className="px-6 py-3 text-right">{c.readRate}%</td>
                          <td className="px-6 py-3 text-right">
                            <Link
                              href={`/campaigns/${c.campaignId}`}
                              className="text-accent text-xs hover:underline"
                            >
                              {t("metrics.viewCampaign")}
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  </TableContainer>
                </div>
              )}
            </div>
          )}

          {showCalling && !callingLoading && calling && (
            <div className="space-y-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className="font-semibold text-primary">{t("metrics.callingTitle")}</h2>
                  <p className="text-sm text-secondary">
                    {t("metrics.callingSubtitle", {
                      from: formatRangeDate(calling.from),
                      to: formatRangeDate(calling.to),
                    })}
                  </p>
                </div>
                <Badge variant={callingHealthVariant(calling.summary.health)}>
                  {callingHealthLabel(calling.summary.health)}
                </Badge>
              </div>

              {calling.summary.health === "at_risk" && (
                <div className="flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
                  <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
                  <p className="text-sm text-amber-900">
                    {t("metrics.callingMetaWarning", {
                      threshold: calling.metaPickupThreshold,
                      rate: calling.summary.pickupRate,
                    })}
                  </p>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <KpiCard
                  label={t("metrics.pickupRate")}
                  value={`${calling.summary.pickupRate}%`}
                  sub={t("metrics.pickupRateSub", {
                    picked: formatNumber(calling.summary.outboundPickedUp),
                    total: formatNumber(calling.summary.outboundAttempts),
                  })}
                  icon={<Phone className="w-5 h-5" />}
                />
                <KpiCard
                  label={t("metrics.avgCallDuration")}
                  value={formatCallDuration(calling.summary.averageDurationSeconds)}
                  sub={t("metrics.avgCallDurationSub")}
                  icon={<Activity className="w-5 h-5" />}
                />
                <KpiCard
                  label={t("metrics.outboundMissed")}
                  value={formatNumber(calling.summary.outboundMissed)}
                  sub={t("metrics.outboundMissedSub", {
                    from: formatRangeDate(calling.from),
                    to: formatRangeDate(calling.to),
                  })}
                  icon={<BarChart3 className="w-5 h-5" />}
                />
                <KpiCard
                  label={t("metrics.inboundAnswerRate")}
                  value={`${calling.summary.inboundAnswerRate}%`}
                  sub={t("metrics.inboundAnswerRateSub", {
                    answered: formatNumber(calling.summary.inboundAnswered),
                    total: formatNumber(calling.summary.inboundCalls),
                  })}
                  icon={<Phone className="w-5 h-5" />}
                />
              </div>

              {calling.byBot.length > 0 && (
                <div className="overflow-hidden rounded-xl border border-default bg-surface-elevated">
                  <div className="border-b border-subtle px-4 py-4 sm:px-6">
                    <h3 className="text-sm font-semibold text-primary">
                      {t("metrics.callingByBot")}
                    </h3>
                  </div>
                  <TableContainer>
                    <table className="w-full min-w-[720px] text-sm">
                      <thead>
                        <tr className="bg-surface text-left text-xs text-secondary uppercase">
                          <th className="px-6 py-3">{t("metrics.colBot")}</th>
                          <th className="px-6 py-3 text-right">{t("metrics.pickupRate")}</th>
                          <th className="px-6 py-3 text-right">{t("metrics.colOutbound")}</th>
                          <th className="px-6 py-3 text-right">{t("metrics.colPickedUp")}</th>
                          <th className="px-6 py-3 text-right">{t("metrics.avgCallDuration")}</th>
                          <th className="px-6 py-3">{t("common.status")}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {calling.byBot.map((bot) => (
                          <tr key={bot.botId}>
                            <td className="px-6 py-3 font-medium">{bot.botName}</td>
                            <td className="px-6 py-3 text-right">{bot.pickupRate}%</td>
                            <td className="px-6 py-3 text-right">
                              {formatNumber(bot.outboundAttempts)}
                            </td>
                            <td className="px-6 py-3 text-right">
                              {formatNumber(bot.outboundPickedUp)}
                            </td>
                            <td className="px-6 py-3 text-right">
                              {formatCallDuration(bot.averageDurationSeconds)}
                            </td>
                            <td className="px-6 py-3">
                              <Badge variant={callingHealthVariant(bot.health)}>
                                {callingHealthLabel(bot.health)}
                              </Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </TableContainer>
                </div>
              )}

              {calling.summary.totalCalls === 0 && (
                <div className="rounded-xl border border-default bg-surface-elevated p-6">
                  <EmptyState
                    icon={<Phone className="w-6 h-6" />}
                    title={t("metrics.callingEmptyTitle")}
                    description={t("metrics.callingEmptyDescription")}
                  />
                </div>
              )}
            </div>
          )}

          {showUsage && (
          <div className="bg-surface-elevated rounded-xl border border-default overflow-hidden">
            <div className="px-6 py-4 border-b border-subtle">
              <h2 className="font-semibold text-primary text-sm">{t("metrics.usageByBot")}</h2>
            </div>

            {filteredUsage.byBot.length === 0 ? (
              <div className="p-6">
                <EmptyState
                  icon={<BotMessageSquare className="w-6 h-6" />}
                  title={t("metrics.emptyTitle")}
                  description={t("metrics.emptyDescription")}
                />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-surface text-left text-xs text-secondary uppercase tracking-wide">
                      <th className="px-6 py-3 font-medium">{t("metrics.colBot")}</th>
                      <th className="px-6 py-3 font-medium">{t("common.status")}</th>
                      <th className="px-6 py-3 font-medium text-right">{t("metrics.colConversations")}</th>
                      <th className="px-6 py-3 font-medium text-right">{t("metrics.colMessages")}</th>
                      <th className="px-6 py-3 font-medium text-right">{t("metrics.colTemplates")}</th>
                      <th className="px-6 py-3 font-medium text-right">{t("metrics.colLastActivity")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredUsage.byBot.map((bot) => (
                      <tr key={bot.botId} className="hover:bg-surface/50">
                        <td className="px-6 py-3.5 font-medium text-primary">{bot.botName}</td>
                        <td className="px-6 py-3.5">
                          <Badge variant={bot.status === "active" ? "success" : "default"}>
                            {bot.status === "active" ? t("common.active") : t("common.inactive")}
                          </Badge>
                        </td>
                        <td className="px-6 py-3.5 text-right text-secondary">
                          {formatNumber(bot.conversations)}
                          {bot.activeConversations > 0 && (
                            <span className="text-muted ml-1">
                              {t("metrics.activeInline", { count: bot.activeConversations })}
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-3.5 text-right text-secondary font-medium">
                          {formatNumber(bot.messages)}
                        </td>
                        <td className="px-6 py-3.5 text-right text-secondary">
                          {formatNumber(bot.templates)}
                        </td>
                        <td className="px-6 py-3.5 text-right text-secondary">
                          {bot.lastActivityAt ? formatRelativeTime(bot.lastActivityAt) : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          )}

          {showUsage && filteredUsage.recentBulkJobs.length > 0 && (
            <div className="bg-surface-elevated rounded-xl border border-default overflow-hidden">
              <div className="px-6 py-4 border-b border-subtle">
                <h2 className="font-semibold text-primary text-sm">{t("metrics.recentBulkTitle")}</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-surface text-left text-xs text-secondary uppercase tracking-wide">
                      <th className="px-6 py-3 font-medium">{t("bulkSend.colTemplate")}</th>
                      <th className="px-6 py-3 font-medium">{t("common.status")}</th>
                      <th className="px-6 py-3 font-medium text-right">{t("metrics.colSent")}</th>
                      <th className="px-6 py-3 font-medium text-right">{t("metrics.colFailed")}</th>
                      <th className="px-6 py-3 font-medium text-right">{t("common.total")}</th>
                      <th className="px-6 py-3 font-medium text-right">{t("common.date")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredUsage.recentBulkJobs.map((job) => (
                      <tr key={job.jobId} className="hover:bg-surface/50">
                        <td className="px-6 py-3.5 font-medium text-primary">{job.templateName}</td>
                        <td className="px-6 py-3.5">
                          <Badge variant={bulkStatusVariant(job.status)}>
                            {bulkStatusLabel(job.status)}
                          </Badge>
                        </td>
                        <td className="px-6 py-3.5 text-right text-green-700 font-medium">
                          {formatNumber(job.sent)}
                        </td>
                        <td className="px-6 py-3.5 text-right text-red-600">
                          {formatNumber(job.failed)}
                        </td>
                        <td className="px-6 py-3.5 text-right text-secondary">
                          {formatNumber(job.total)}
                        </td>
                        <td className="px-6 py-3.5 text-right text-secondary">
                          {formatDate(job.createdAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </DashboardPage>
  );
}
