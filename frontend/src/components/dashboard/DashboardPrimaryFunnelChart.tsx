"use client";

import { DashboardCampaignFunnelChart } from "./DashboardCampaignFunnelChart";
import { DashboardLeadFunnelChart } from "./DashboardLeadFunnelChart";
import type { LeadMetrics, MarketingMetrics } from "@/types";

interface DashboardPrimaryFunnelChartProps {
  marketing?: MarketingMetrics | null;
  leads?: LeadMetrics | null;
  isLoadingMarketing: boolean;
  isLoadingLeads: boolean;
}

export function DashboardPrimaryFunnelChart({
  marketing,
  leads,
  isLoadingMarketing,
  isLoadingLeads,
}: DashboardPrimaryFunnelChartProps) {
  const campaignSent = marketing?.campaigns.aggregates.sent ?? 0;
  const leadTotal = leads?.total ?? 0;
  const preferLeads = campaignSent === 0 && leadTotal > 0;

  if (preferLeads) {
    return (
      <DashboardLeadFunnelChart leads={leads} isLoading={isLoadingLeads} error={null} />
    );
  }

  return (
    <DashboardCampaignFunnelChart
      marketing={marketing}
      isLoading={isLoadingMarketing}
      error={null}
    />
  );
}
