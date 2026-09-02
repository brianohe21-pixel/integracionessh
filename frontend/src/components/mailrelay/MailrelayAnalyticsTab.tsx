"use client";

import { useEffect, useMemo, useState } from "react";
import { BarChart3 } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  useMailrelayCampaignMetrics,
  useMailrelaySentCampaigns,
} from "@/hooks/useMailrelay";
import { useT } from "@/i18n/context";
import type { MailrelayCampaignMetrics } from "@/types";
import { Alert } from "@/components/ui/Alert";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Select } from "@/components/ui/Input";
import { Skeleton } from "@/components/ui/Skeleton";
import { StatCard } from "@/components/ui/StatCard";
import { MailrelayEventsPanel } from "./MailrelayEventsPanel";

function rate(value: number, total: number) {
  if (total <= 0) return "0%";
  return `${((value / total) * 100).toFixed(1)}%`;
}

function metricRows(metrics: MailrelayCampaignMetrics) {
  const delivered = metrics.delivered || metrics.sent;
  return [
    { key: "sent", value: metrics.sent, rate: null },
    { key: "delivered", value: metrics.delivered, rate: rate(metrics.delivered, metrics.sent) },
    { key: "opens", value: metrics.opens, rate: rate(metrics.opens, delivered) },
    { key: "clicks", value: metrics.clicks, rate: rate(metrics.clicks, delivered) },
    { key: "bounces", value: metrics.bounces, rate: rate(metrics.bounces, metrics.sent) },
    {
      key: "unsubscribes",
      value: metrics.unsubscribes,
      rate: rate(metrics.unsubscribes, delivered),
    },
    {
      key: "complaints",
      value: metrics.complaints,
      rate: rate(metrics.complaints, delivered),
    },
  ];
}

function FunnelBar({
  label,
  value,
  total,
  tone,
}: {
  label: string;
  value: number;
  total: number;
  tone: string;
}) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-primary">{label}</span>
        <span className="tabular-nums text-secondary">
          {value.toLocaleString()} <span className="text-xs text-muted">({pct}%)</span>
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-surface-muted">
        <div className={`h-full rounded-full ${tone}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function MailrelayAnalyticsTab({ connected }: { connected: boolean }) {
  const t = useT();
  const campaignsQuery = useMailrelaySentCampaigns(connected);
  const [campaignId, setCampaignId] = useState("");
  const [compareId, setCompareId] = useState("");
  const metricsQuery = useMailrelayCampaignMetrics(campaignId);
  const compareMetricsQuery = useMailrelayCampaignMetrics(compareId);
  const campaigns = useMemo(
    () => campaignsQuery.data?.campaigns ?? [],
    [campaignsQuery.data?.campaigns]
  );

  useEffect(() => {
    if (!campaignId && campaigns.length > 0) setCampaignId(campaigns[0].id);
  }, [campaignId, campaigns]);

  useEffect(() => {
    if (compareId && compareId === campaignId) setCompareId("");
  }, [campaignId, compareId]);

  if (!connected) {
    return (
      <EmptyState
        icon={<BarChart3 className="h-6 w-6" />}
        title={t("mailrelay.states.connectionRequired")}
        description={t("mailrelay.states.connectionRequiredDescription")}
      />
    );
  }

  if (campaignsQuery.isLoading) {
    return <Skeleton className="h-80 w-full" />;
  }

  if (campaignsQuery.isError) {
    return <Alert variant="danger">{campaignsQuery.error.message}</Alert>;
  }

  if (campaigns.length === 0) {
    return (
      <EmptyState
        icon={<BarChart3 className="h-6 w-6" />}
        title={t("mailrelay.analytics.empty")}
        description={t("mailrelay.analytics.emptyDescription")}
      />
    );
  }

  const metrics = metricsQuery.data?.metrics;
  const compareMetrics = compareMetricsQuery.data?.metrics;
  const rows = metrics ? metricRows(metrics) : [];
  const compareChartData =
    metrics && compareMetrics
      ? [
          {
            name: t("mailrelay.analytics.primary"),
            opens: metrics.opens,
            clicks: metrics.clicks,
          },
          {
            name: t("mailrelay.analytics.compare"),
            opens: compareMetrics.opens,
            clicks: compareMetrics.clicks,
          },
        ]
      : [];

  return (
    <div className="space-y-6">
      <Card padding="lg">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="block space-y-2 text-sm font-medium text-primary">
            <span>{t("mailrelay.analytics.campaign")}</span>
            <Select value={campaignId} onChange={(event) => setCampaignId(event.target.value)}>
              {campaigns.map((campaign) => (
                <option key={campaign.id} value={campaign.id}>
                  {campaign.name}
                </option>
              ))}
            </Select>
          </label>
          <label className="block space-y-2 text-sm font-medium text-primary">
            <span>{t("mailrelay.analytics.compareWith")}</span>
            <Select value={compareId} onChange={(event) => setCompareId(event.target.value)}>
              <option value="">{t("mailrelay.analytics.noCompare")}</option>
              {campaigns
                .filter((campaign) => campaign.id !== campaignId)
                .map((campaign) => (
                  <option key={campaign.id} value={campaign.id}>
                    {campaign.name}
                  </option>
                ))}
            </Select>
          </label>
        </div>
      </Card>

      {metricsQuery.isLoading ? <Skeleton className="h-48 w-full" /> : null}
      {metricsQuery.isError ? (
        <Alert variant="danger">{metricsQuery.error.message}</Alert>
      ) : null}

      {metrics ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {rows.map((row) => (
              <StatCard
                key={row.key}
                label={t(`mailrelay.metrics.${row.key}`)}
                value={Number(row.value).toLocaleString()}
                sub={row.rate ? t("mailrelay.analytics.rate", { rate: row.rate }) : undefined}
              />
            ))}
          </div>

          <Card padding="lg" className="space-y-4">
            <h2 className="font-semibold text-primary">{t("mailrelay.analytics.funnel")}</h2>
            <FunnelBar
              label={t("mailrelay.metrics.sent")}
              value={metrics.sent}
              total={metrics.sent || 1}
              tone="bg-blue-500"
            />
            <FunnelBar
              label={t("mailrelay.metrics.delivered")}
              value={metrics.delivered}
              total={metrics.sent || 1}
              tone="bg-emerald-500"
            />
            <FunnelBar
              label={t("mailrelay.metrics.opens")}
              value={metrics.opens}
              total={metrics.delivered || metrics.sent || 1}
              tone="bg-violet-500"
            />
            <FunnelBar
              label={t("mailrelay.metrics.clicks")}
              value={metrics.clicks}
              total={metrics.delivered || metrics.sent || 1}
              tone="bg-amber-500"
            />
          </Card>

          {compareId && compareChartData.length > 0 ? (
            <Card padding="lg" className="space-y-4">
              <h2 className="font-semibold text-primary">{t("mailrelay.analytics.comparison")}</h2>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={compareChartData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-default" />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Bar dataKey="opens" name={t("mailrelay.metrics.opens")} fill="#8b5cf6" />
                    <Bar dataKey="clicks" name={t("mailrelay.metrics.clicks")} fill="#f59e0b" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          ) : null}
        </>
      ) : null}

      <MailrelayEventsPanel connected={connected} campaignId={campaignId} />
    </div>
  );
}
