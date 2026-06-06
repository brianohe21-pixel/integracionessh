"use client";

import {
  BarChart3,
  BotMessageSquare,
  MessageSquare,
  SendHorizonal,
  LayoutTemplate,
  Activity,
} from "lucide-react";
import Link from "next/link";
import { useMetrics } from "@/hooks/useMetrics";
import { useMarketingMetrics } from "@/hooks/useMarketingMetrics";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { useFormatters } from "@/hooks/useFormatters";
import { useT } from "@/i18n/context";
import type { BulkSendJobStatus } from "@/types";

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
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
          {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
        </div>
        <div className="flex items-center justify-center w-10 h-10 bg-indigo-50 rounded-xl text-indigo-600">
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
  const { data: metrics, isLoading, error } = useMetrics();
  const { data: marketing, isLoading: marketingLoading } = useMarketingMetrics();

  function bulkStatusLabel(status: BulkSendJobStatus): string {
    const labels: Record<BulkSendJobStatus, string> = {
      queued: t("bulkSend.statusQueued"),
      processing: t("bulkSend.statusProcessing"),
      completed: t("bulkSend.statusCompleted"),
      failed: t("bulkSend.statusFailed"),
    };
    return labels[status] ?? status;
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">{t("metrics.title")}</h1>
        <p className="text-sm text-gray-500 mt-1">{t("metrics.subtitle")}</p>
      </div>

      {isLoading && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-white rounded-xl border border-gray-200 p-5 animate-pulse h-24" />
            ))}
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-6 animate-pulse h-48" />
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <p className="text-sm text-red-600 font-medium">{t("metrics.loadError")}</p>
          <p className="text-xs text-red-500 mt-1 break-words">{error.message}</p>
        </div>
      )}

      {!isLoading && !error && metrics && (
        <div className="space-y-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard
              label={t("metrics.activeBots")}
              value={`${formatNumber(metrics.summary.activeBots)} / ${formatNumber(metrics.summary.totalBots)}`}
              icon={<BotMessageSquare className="w-5 h-5" />}
            />
            <KpiCard
              label={t("metrics.conversations")}
              value={formatNumber(metrics.summary.totalConversations)}
              sub={t("metrics.activeSub", { count: metrics.summary.activeConversations })}
              icon={<MessageSquare className="w-5 h-5" />}
            />
            <KpiCard
              label={t("metrics.messages")}
              value={formatNumber(metrics.summary.totalMessages)}
              sub={t("metrics.messagesSub")}
              icon={<BarChart3 className="w-5 h-5" />}
            />
            <KpiCard
              label={t("metrics.bulkSends")}
              value={formatNumber(metrics.summary.bulkMessagesSent)}
              sub={
                metrics.summary.bulkMessagesFailed > 0
                  ? t("metrics.bulkFailed", { count: metrics.summary.bulkMessagesFailed })
                  : t("metrics.bulkCampaigns", { count: metrics.summary.bulkJobsCount })
              }
              icon={<SendHorizonal className="w-5 h-5" />}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <KpiCard
              label={t("metrics.templates")}
              value={formatNumber(metrics.summary.totalTemplates)}
              icon={<LayoutTemplate className="w-5 h-5" />}
            />
            <KpiCard
              label={t("metrics.bulkCampaignsLabel")}
              value={formatNumber(metrics.summary.bulkJobsCount)}
              icon={<SendHorizonal className="w-5 h-5" />}
            />
            <KpiCard
              label={t("metrics.lastActivity")}
              value={
                metrics.summary.lastActivityAt
                  ? formatRelativeTime(metrics.summary.lastActivityAt)
                  : t("common.noActivity")
              }
              sub={
                metrics.summary.lastActivityAt
                  ? formatDate(metrics.summary.lastActivityAt)
                  : undefined
              }
              icon={<Activity className="w-5 h-5" />}
            />
          </div>

          {!marketingLoading && marketing?.campaigns?.rates && marketing.inbox && (
            <div className="space-y-4">
              <div>
                <h2 className="font-semibold text-gray-900">{t("metrics.marketingTitle")}</h2>
                <p className="text-sm text-gray-500">{t("metrics.marketingSubtitle")}</p>
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
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  <div className="px-6 py-4 border-b border-gray-100">
                    <h3 className="font-semibold text-gray-900 text-sm">{t("metrics.topCampaigns")}</h3>
                  </div>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 text-left text-xs text-gray-500 uppercase">
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
                              className="text-indigo-600 text-xs hover:underline"
                            >
                              {t("metrics.viewCampaign")}
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900 text-sm">{t("metrics.usageByBot")}</h2>
            </div>

            {metrics.byBot.length === 0 ? (
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
                    <tr className="bg-gray-50 text-left text-xs text-gray-500 uppercase tracking-wide">
                      <th className="px-6 py-3 font-medium">{t("metrics.colBot")}</th>
                      <th className="px-6 py-3 font-medium">{t("common.status")}</th>
                      <th className="px-6 py-3 font-medium text-right">{t("metrics.colConversations")}</th>
                      <th className="px-6 py-3 font-medium text-right">{t("metrics.colMessages")}</th>
                      <th className="px-6 py-3 font-medium text-right">{t("metrics.colTemplates")}</th>
                      <th className="px-6 py-3 font-medium text-right">{t("metrics.colLastActivity")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {metrics.byBot.map((bot) => (
                      <tr key={bot.botId} className="hover:bg-gray-50/50">
                        <td className="px-6 py-3.5 font-medium text-gray-900">{bot.botName}</td>
                        <td className="px-6 py-3.5">
                          <Badge variant={bot.status === "active" ? "success" : "default"}>
                            {bot.status === "active" ? t("common.active") : t("common.inactive")}
                          </Badge>
                        </td>
                        <td className="px-6 py-3.5 text-right text-gray-700">
                          {formatNumber(bot.conversations)}
                          {bot.activeConversations > 0 && (
                            <span className="text-gray-400 ml-1">
                              {t("metrics.activeInline", { count: bot.activeConversations })}
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-3.5 text-right text-gray-700 font-medium">
                          {formatNumber(bot.messages)}
                        </td>
                        <td className="px-6 py-3.5 text-right text-gray-700">
                          {formatNumber(bot.templates)}
                        </td>
                        <td className="px-6 py-3.5 text-right text-gray-500">
                          {bot.lastActivityAt ? formatRelativeTime(bot.lastActivityAt) : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {metrics.recentBulkJobs.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100">
                <h2 className="font-semibold text-gray-900 text-sm">{t("metrics.recentBulkTitle")}</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 text-left text-xs text-gray-500 uppercase tracking-wide">
                      <th className="px-6 py-3 font-medium">{t("bulkSend.colTemplate")}</th>
                      <th className="px-6 py-3 font-medium">{t("common.status")}</th>
                      <th className="px-6 py-3 font-medium text-right">{t("metrics.colSent")}</th>
                      <th className="px-6 py-3 font-medium text-right">{t("metrics.colFailed")}</th>
                      <th className="px-6 py-3 font-medium text-right">{t("common.total")}</th>
                      <th className="px-6 py-3 font-medium text-right">{t("common.date")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {metrics.recentBulkJobs.map((job) => (
                      <tr key={job.jobId} className="hover:bg-gray-50/50">
                        <td className="px-6 py-3.5 font-medium text-gray-900">{job.templateName}</td>
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
                        <td className="px-6 py-3.5 text-right text-gray-700">
                          {formatNumber(job.total)}
                        </td>
                        <td className="px-6 py-3.5 text-right text-gray-500">
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
    </div>
  );
}
