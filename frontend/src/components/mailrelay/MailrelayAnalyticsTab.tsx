"use client";

import { useEffect, useMemo, useState } from "react";
import { BarChart3, Download } from "lucide-react";
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
  useMailrelayDeliverability,
  useMailrelaySentCampaigns,
} from "@/hooks/useMailrelay";
import { useT } from "@/i18n/context";
import type {
  MailrelayCampaignMetrics,
  MailrelayDeliverabilityDailyPoint,
  MailrelayDeliverabilityReport,
} from "@/types";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableHead,
  DataTableRow,
} from "@/components/ui/DataTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input, Select } from "@/components/ui/Input";
import { Skeleton } from "@/components/ui/Skeleton";
import { StatCard } from "@/components/ui/StatCard";
import { downloadMailrelayDeliverabilityCsv } from "@/lib/reports/mailrelay-deliverability-export";
import { MailrelayEventsPanel } from "./MailrelayEventsPanel";

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

function percent(value: number, total: number) {
  if (total <= 0) return "0.0%";
  return `${((value / total) * 100).toFixed(1)}%`;
}

function rangeFromInputs(
  from: string,
  to: string
): { from: string; to: string } | "tooLong" | null {
  if (!from && !to) return null;
  if (!DATE_ONLY.test(from) || !DATE_ONLY.test(to)) return null;
  const nextFrom = from <= to ? from : to;
  const nextTo = from <= to ? to : from;
  const days =
    Math.floor(
      (Date.parse(`${nextTo}T00:00:00.000Z`) - Date.parse(`${nextFrom}T00:00:00.000Z`)) /
        86_400_000
    ) + 1;
  if (days > 90) return "tooLong";
  return { from: nextFrom, to: nextTo };
}

function emptyMetrics(campaignId: string): MailrelayCampaignMetrics {
  return {
    campaignId,
    sent: 0,
    delivered: 0,
    opens: 0,
    clicks: 0,
    bounces: 0,
    hardBounces: 0,
    softBounces: 0,
    genericBounces: 0,
    unsubscribes: 0,
    complaints: 0,
  };
}

function metricRows(metrics: MailrelayCampaignMetrics) {
  const delivered = metrics.delivered || metrics.sent;
  return [
    { key: "sent", value: metrics.sent, rate: null, rateBase: null },
    {
      key: "delivered",
      value: metrics.delivered,
      rate: percent(metrics.delivered, metrics.sent),
      rateBase: "sent" as const,
    },
    {
      key: "opens",
      value: metrics.opens,
      rate: percent(metrics.opens, delivered),
      rateBase: "delivered" as const,
    },
    {
      key: "clicks",
      value: metrics.clicks,
      rate: percent(metrics.clicks, delivered),
      rateBase: "delivered" as const,
    },
    {
      key: "bounces",
      value: metrics.bounces,
      rate: percent(metrics.bounces, metrics.sent),
      rateBase: "sent" as const,
    },
    {
      key: "hardBounces",
      value: metrics.hardBounces,
      rate: percent(metrics.hardBounces, metrics.sent),
      rateBase: "sent" as const,
    },
    {
      key: "softBounces",
      value: metrics.softBounces,
      rate: percent(metrics.softBounces, metrics.sent),
      rateBase: "sent" as const,
    },
    {
      key: "genericBounces",
      value: metrics.genericBounces,
      rate: percent(metrics.genericBounces, metrics.sent),
      rateBase: "sent" as const,
    },
    {
      key: "unsubscribes",
      value: metrics.unsubscribes,
      rate: percent(metrics.unsubscribes, delivered),
      rateBase: "delivered" as const,
    },
    {
      key: "complaints",
      value: metrics.complaints,
      rate: percent(metrics.complaints, delivered),
      rateBase: "delivered" as const,
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
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const range = rangeFromInputs(from, to);
  const reportQuery = useMailrelayDeliverability(range && range !== "tooLong" ? range : null, connected);
  const sentCampaigns = useMemo(
    () => campaignsQuery.data?.campaigns ?? [],
    [campaignsQuery.data?.campaigns]
  );
  const report = reportQuery.data?.report;

  const options = useMemo(() => {
    const byId = new Map<string, string>();
    for (const campaign of sentCampaigns) byId.set(campaign.id, campaign.name);
    for (const row of report?.campaigns ?? []) {
      if (!byId.has(row.campaignId)) byId.set(row.campaignId, row.name);
    }
    return [...byId.entries()].map(([id, name]) => ({ id, name }));
  }, [report?.campaigns, sentCampaigns]);

  useEffect(() => {
    if (!campaignId && options.length > 0) setCampaignId(options[0].id);
  }, [campaignId, options]);

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

  if (campaignsQuery.isLoading || (options.length === 0 && reportQuery.isLoading)) {
    return <Skeleton className="h-80 w-full" />;
  }

  if (campaignsQuery.isError) {
    return <Alert variant="danger">{campaignsQuery.error.message}</Alert>;
  }

  if (options.length === 0) {
    return (
      <EmptyState
        icon={<BarChart3 className="h-6 w-6" />}
        title={t("mailrelay.analytics.empty")}
        description={t("mailrelay.analytics.emptyDescription")}
      />
    );
  }

  const selectedRow = report?.campaigns.find((row) => row.campaignId === campaignId);
  const selected = selectedRow ?? emptyMetrics(campaignId);
  const compared = compareId
    ? report?.campaigns.find((row) => row.campaignId === compareId) ?? emptyMetrics(compareId)
    : undefined;
  const rows = metricRows(selected);
  const compareChartData = compared
    ? [
        {
          name: t("mailrelay.analytics.primary"),
          opens: selected.opens,
          clicks: selected.clicks,
          hardBounces: selected.hardBounces,
          softBounces: selected.softBounces,
        },
        {
          name: t("mailrelay.analytics.compare"),
          opens: compared.opens,
          clicks: compared.clicks,
          hardBounces: compared.hardBounces,
          softBounces: compared.softBounces,
        },
      ]
    : [];
  const series: MailrelayDeliverabilityDailyPoint[] = selectedRow?.daily ?? [];

  function exportReport(current: MailrelayDeliverabilityReport) {
    downloadMailrelayDeliverabilityCsv(current, {
      campaign: t("mailrelay.analytics.colCampaign"),
      date: t("mailrelay.analytics.colDate"),
      sent: t("mailrelay.metrics.sent"),
      delivered: t("mailrelay.metrics.delivered"),
      opens: t("mailrelay.metrics.opens"),
      clicks: t("mailrelay.metrics.clicks"),
      bounces: t("mailrelay.metrics.bounces"),
      hardBounces: t("mailrelay.metrics.hardBounces"),
      softBounces: t("mailrelay.metrics.softBounces"),
      genericBounces: t("mailrelay.metrics.genericBounces"),
      unsubscribes: t("mailrelay.metrics.unsubscribes"),
      complaints: t("mailrelay.metrics.complaints"),
      hardBounceRate: t("mailrelay.analytics.hardBounceRate"),
      softBounceRate: t("mailrelay.analytics.softBounceRate"),
      complaintRate: t("mailrelay.analytics.complaintRate"),
      unsubscribeRate: t("mailrelay.analytics.unsubscribeRate"),
      campaignsTitle: t("mailrelay.analytics.campaignsTitle"),
      seriesTitle: t("mailrelay.analytics.series"),
      filenamePrefix: "email-deliverability",
    });
  }

  return (
    <div className="space-y-6">
      <Card padding="lg" className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <label className="block space-y-2 text-sm font-medium text-primary">
            <span>{t("mailrelay.analytics.campaign")}</span>
            <Select value={campaignId} onChange={(event) => setCampaignId(event.target.value)}>
              {options.map((campaign) => (
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
              {options
                .filter((campaign) => campaign.id !== campaignId)
                .map((campaign) => (
                  <option key={campaign.id} value={campaign.id}>
                    {campaign.name}
                  </option>
                ))}
            </Select>
          </label>
          <label className="block space-y-2 text-sm font-medium text-primary">
            <span>{t("mailrelay.analytics.from")}</span>
            <Input type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
          </label>
          <label className="block space-y-2 text-sm font-medium text-primary">
            <span>{t("mailrelay.analytics.to")}</span>
            <Input type="date" value={to} onChange={(event) => setTo(event.target.value)} />
          </label>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-secondary">{t("mailrelay.analytics.rangeHint")}</p>
          <div className="flex gap-2">
            {from || to ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setFrom("");
                  setTo("");
                }}
              >
                {t("mailrelay.analytics.clearRange")}
              </Button>
            ) : null}
            <Button
              variant="secondary"
              size="sm"
              disabled={!report}
              onClick={() => {
                if (report) exportReport(report);
              }}
            >
              <Download className="h-4 w-4" />
              {t("mailrelay.analytics.export")}
            </Button>
          </div>
        </div>
      </Card>

      {range === "tooLong" ? (
        <Alert variant="warning">{t("mailrelay.analytics.rangeTooLong")}</Alert>
      ) : null}
      {reportQuery.isLoading ? <Skeleton className="h-48 w-full" /> : null}
      {reportQuery.isError ? <Alert variant="danger">{reportQuery.error.message}</Alert> : null}

      {report ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {rows.map((row) => (
              <StatCard
                key={row.key}
                label={t(`mailrelay.metrics.${row.key}`)}
                value={Number(row.value).toLocaleString()}
                sub={
                  row.rate
                    ? t(
                        row.rateBase === "sent"
                          ? "mailrelay.analytics.rateOfSent"
                          : "mailrelay.analytics.rateOfDelivered",
                        { rate: row.rate }
                      )
                    : undefined
                }
              />
            ))}
          </div>

          <Card padding="lg" className="space-y-4">
            <h2 className="font-semibold text-primary">{t("mailrelay.analytics.funnel")}</h2>
            <FunnelBar
              label={t("mailrelay.metrics.sent")}
              value={selected.sent}
              total={selected.sent || 1}
              tone="bg-blue-500"
            />
            <FunnelBar
              label={t("mailrelay.metrics.delivered")}
              value={selected.delivered}
              total={selected.sent || 1}
              tone="bg-emerald-500"
            />
            <FunnelBar
              label={t("mailrelay.metrics.opens")}
              value={selected.opens}
              total={selected.delivered || selected.sent || 1}
              tone="bg-violet-500"
            />
            <FunnelBar
              label={t("mailrelay.metrics.clicks")}
              value={selected.clicks}
              total={selected.delivered || selected.sent || 1}
              tone="bg-amber-500"
            />
          </Card>

          {series.length > 0 ? (
            <Card padding="lg" className="space-y-4">
              <h2 className="font-semibold text-primary">{t("mailrelay.analytics.series")}</h2>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={series}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-default" />
                    <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Bar
                      dataKey="hardBounces"
                      name={t("mailrelay.metrics.hardBounces")}
                      fill="#ef4444"
                    />
                    <Bar
                      dataKey="softBounces"
                      name={t("mailrelay.metrics.softBounces")}
                      fill="#f97316"
                    />
                    <Bar
                      dataKey="genericBounces"
                      name={t("mailrelay.metrics.genericBounces")}
                      fill="#a8a29e"
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          ) : null}

          {compareChartData.length > 0 ? (
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
                    <Bar
                      dataKey="hardBounces"
                      name={t("mailrelay.metrics.hardBounces")}
                      fill="#ef4444"
                    />
                    <Bar
                      dataKey="softBounces"
                      name={t("mailrelay.metrics.softBounces")}
                      fill="#f97316"
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          ) : null}

          <div className="space-y-3">
            <h2 className="font-semibold text-primary">{t("mailrelay.analytics.campaignsTitle")}</h2>
            <DataTable minWidth="960px">
              <DataTableHead>
                <DataTableRow>
                  <DataTableCell header>{t("mailrelay.analytics.colCampaign")}</DataTableCell>
                  <DataTableCell header>{t("mailrelay.metrics.sent")}</DataTableCell>
                  <DataTableCell header>{t("mailrelay.metrics.delivered")}</DataTableCell>
                  <DataTableCell header>{t("mailrelay.metrics.opens")}</DataTableCell>
                  <DataTableCell header>{t("mailrelay.metrics.clicks")}</DataTableCell>
                  <DataTableCell header>{t("mailrelay.metrics.bounces")}</DataTableCell>
                  <DataTableCell header>{t("mailrelay.metrics.hardBounces")}</DataTableCell>
                  <DataTableCell header>{t("mailrelay.metrics.softBounces")}</DataTableCell>
                  <DataTableCell header>{t("mailrelay.metrics.genericBounces")}</DataTableCell>
                  <DataTableCell header>{t("mailrelay.metrics.unsubscribes")}</DataTableCell>
                  <DataTableCell header>{t("mailrelay.metrics.complaints")}</DataTableCell>
                </DataTableRow>
              </DataTableHead>
              <DataTableBody>
                {report.campaigns.length === 0 ? (
                  <DataTableRow>
                    <DataTableCell className="text-secondary">
                      {t("mailrelay.analytics.noCampaignsInRange")}
                    </DataTableCell>
                  </DataTableRow>
                ) : (
                  report.campaigns.map((row) => (
                    <DataTableRow key={row.campaignId}>
                      <DataTableCell>{row.name}</DataTableCell>
                      <DataTableCell>{row.sent.toLocaleString()}</DataTableCell>
                      <DataTableCell>{row.delivered.toLocaleString()}</DataTableCell>
                      <DataTableCell>{row.opens.toLocaleString()}</DataTableCell>
                      <DataTableCell>{row.clicks.toLocaleString()}</DataTableCell>
                      <DataTableCell>{row.bounces.toLocaleString()}</DataTableCell>
                      <DataTableCell>
                        {row.hardBounces.toLocaleString()}{" "}
                        <span className="text-xs text-muted">
                          ({percent(row.hardBounces, row.sent)})
                        </span>
                      </DataTableCell>
                      <DataTableCell>
                        {row.softBounces.toLocaleString()}{" "}
                        <span className="text-xs text-muted">
                          ({percent(row.softBounces, row.sent)})
                        </span>
                      </DataTableCell>
                      <DataTableCell>{row.genericBounces.toLocaleString()}</DataTableCell>
                      <DataTableCell>
                        {row.unsubscribes.toLocaleString()}{" "}
                        <span className="text-xs text-muted">
                          ({percent(row.unsubscribes, row.delivered || row.sent)})
                        </span>
                      </DataTableCell>
                      <DataTableCell>
                        {row.complaints.toLocaleString()}{" "}
                        <span className="text-xs text-muted">
                          ({percent(row.complaints, row.delivered || row.sent)})
                        </span>
                      </DataTableCell>
                    </DataTableRow>
                  ))
                )}
              </DataTableBody>
            </DataTable>
          </div>
        </>
      ) : null}

      <MailrelayEventsPanel connected={connected} campaignId={campaignId} />
    </div>
  );
}
