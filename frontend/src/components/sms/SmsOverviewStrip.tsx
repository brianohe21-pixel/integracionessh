"use client";

import { MessageSquareText, Megaphone, Send, CheckCircle2, XCircle, Clock } from "lucide-react";
import { useSmsOverview } from "@/hooks/useSms";
import { useT } from "@/i18n/context";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { StatCard } from "@/components/ui/StatCard";

function formatRate(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

export function SmsOverviewStrip() {
  const t = useT();
  const overviewQuery = useSmsOverview();

  if (overviewQuery.isLoading) return <Skeleton className="h-28 w-full" />;

  const overview = overviewQuery.data;
  if (!overview) return null;

  const totalSent = overview.dlrDelivered + overview.dlrSent + overview.dlrPending + overview.dlrFailed;

  return (
    <Card padding="lg" className="space-y-4">
      <div>
        <h2 className="font-semibold text-primary">{t("smsDashboard.overview.title")}</h2>
        <p className="mt-1 text-sm text-secondary">{t("smsDashboard.overview.subtitle")}</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard
          label={t("smsDashboard.overview.enabledBots")}
          value={overview.enabledBots.toLocaleString()}
          icon={<MessageSquareText className="h-4 w-4" />}
        />
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
          label={t("smsDashboard.overview.pending")}
          value={overview.dlrPending.toLocaleString()}
          icon={<Clock className="h-4 w-4" />}
        />
        <StatCard
          label={t("smsDashboard.overview.deliveryRate")}
          value={formatRate(overview.deliveryRate)}
          icon={<Megaphone className="h-4 w-4" />}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label={t("smsDashboard.overview.activeCampaigns")}
          value={overview.activeCampaigns.toLocaleString()}
          icon={<Megaphone className="h-4 w-4" />}
        />
        <StatCard
          label={t("smsDashboard.overview.campaignSent")}
          value={overview.campaignSent.toLocaleString()}
          icon={<Send className="h-4 w-4" />}
        />
        <StatCard
          label={t("smsDashboard.overview.bulkJobs")}
          value={overview.bulkJobs.toLocaleString()}
          icon={<Send className="h-4 w-4" />}
        />
        <StatCard
          label={t("smsDashboard.overview.bulkSent")}
          value={overview.bulkSent.toLocaleString()}
          icon={<CheckCircle2 className="h-4 w-4" />}
        />
      </div>
    </Card>
  );
}
