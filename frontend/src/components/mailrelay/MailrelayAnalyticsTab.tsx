"use client";

import { useEffect, useMemo, useState } from "react";
import { BarChart3 } from "lucide-react";
import {
  useMailrelayCampaignMetrics,
  useMailrelaySentCampaigns,
} from "@/hooks/useMailrelay";
import { useT } from "@/i18n/context";
import { Alert } from "@/components/ui/Alert";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Select } from "@/components/ui/Input";
import { Skeleton } from "@/components/ui/Skeleton";
import { StatCard } from "@/components/ui/StatCard";

export function MailrelayAnalyticsTab({ connected }: { connected: boolean }) {
  const t = useT();
  const campaignsQuery = useMailrelaySentCampaigns(connected);
  const [campaignId, setCampaignId] = useState("");
  const metricsQuery = useMailrelayCampaignMetrics(campaignId);
  const campaigns = useMemo(
    () => campaignsQuery.data?.campaigns ?? [],
    [campaignsQuery.data?.campaigns]
  );

  useEffect(() => {
    if (!campaignId && campaigns.length > 0) setCampaignId(campaigns[0].id);
  }, [campaignId, campaigns]);

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
  const values = metrics
    ? [
        ["sent", metrics.sent],
        ["delivered", metrics.delivered],
        ["opens", metrics.opens],
        ["clicks", metrics.clicks],
        ["bounces", metrics.bounces],
        ["unsubscribes", metrics.unsubscribes],
      ]
    : [];

  return (
    <div className="space-y-6">
      <Card padding="lg">
        <label className="block max-w-xl space-y-2 text-sm font-medium text-primary">
          <span>{t("mailrelay.analytics.campaign")}</span>
          <Select value={campaignId} onChange={(event) => setCampaignId(event.target.value)}>
            {campaigns.map((campaign) => (
              <option key={campaign.id} value={campaign.id}>
                {campaign.name}
              </option>
            ))}
          </Select>
        </label>
      </Card>

      {metricsQuery.isLoading ? <Skeleton className="h-48 w-full" /> : null}
      {metricsQuery.isError ? (
        <Alert variant="danger">{metricsQuery.error.message}</Alert>
      ) : null}
      {metrics ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {values.map(([label, value]) => (
            <StatCard
              key={String(label)}
              label={t(`mailrelay.metrics.${label}`)}
              value={Number(value).toLocaleString()}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
