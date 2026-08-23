"use client";

import { Users, Mail, Send, FileText, TrendingUp, MousePointerClick } from "lucide-react";
import { useMailrelayOverview } from "@/hooks/useMailrelay";
import { useT } from "@/i18n/context";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { StatCard } from "@/components/ui/StatCard";

function formatRate(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

export function MailrelayOverviewStrip({ connected }: { connected: boolean }) {
  const t = useT();
  const overviewQuery = useMailrelayOverview(connected);

  if (!connected) return null;
  if (overviewQuery.isLoading) return <Skeleton className="h-28 w-full" />;

  const overview = overviewQuery.data?.overview;
  if (!overview) return null;

  const lastSync = overview.lastSyncAt
    ? new Date(overview.lastSyncAt).toLocaleString()
    : t("mailrelay.overview.noSync");

  return (
    <Card padding="lg" className="space-y-4">
      <div>
        <h2 className="font-semibold text-primary">{t("mailrelay.overview.title")}</h2>
        <p className="mt-1 text-sm text-secondary">{t("mailrelay.overview.subtitle", { lastSync })}</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard
          label={t("mailrelay.overview.subscribers")}
          value={overview.subscriberCount.toLocaleString()}
          icon={<Users className="h-4 w-4" />}
        />
        <StatCard
          label={t("mailrelay.overview.drafts")}
          value={overview.draftCampaigns.toLocaleString()}
          icon={<Mail className="h-4 w-4" />}
        />
        <StatCard
          label={t("mailrelay.overview.sent")}
          value={overview.sentCampaigns.toLocaleString()}
          icon={<Send className="h-4 w-4" />}
        />
        <StatCard
          label={t("mailrelay.overview.templates")}
          value={overview.templateCount.toLocaleString()}
          icon={<FileText className="h-4 w-4" />}
        />
        <StatCard
          label={t("mailrelay.overview.avgOpenRate")}
          value={formatRate(overview.averageOpenRate)}
          icon={<TrendingUp className="h-4 w-4" />}
        />
        <StatCard
          label={t("mailrelay.overview.avgClickRate")}
          value={formatRate(overview.averageClickRate)}
          icon={<MousePointerClick className="h-4 w-4" />}
        />
      </div>
    </Card>
  );
}
