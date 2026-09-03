"use client";

import {
  Banknote,
  Eye,
  Globe,
  MessageSquare,
  Phone,
  SendHorizonal,
  ShieldCheck,
  UserPlus,
} from "lucide-react";
import { StatCard } from "@/components/ui/StatCard";
import { Skeleton } from "@/components/ui/Skeleton";
import { useT } from "@/i18n/context";
import { useFormatters } from "@/hooks/useFormatters";
import type {
  UsageMetrics,
  MarketingMetrics,
  SalesMetrics,
  LeadMetrics,
  InboxSlaMetrics,
  CallingMetrics,
  WebsiteMetrics,
} from "@/types";

interface DashboardKpiGridProps {
  usage?: UsageMetrics | null;
  marketing?: MarketingMetrics | null;
  sales?: SalesMetrics | null;
  leads?: LeadMetrics | null;
  inboxSla?: InboxSlaMetrics | null;
  calling?: CallingMetrics | null;
  website?: WebsiteMetrics | null;
  isLoading: boolean;
}

export function DashboardKpiGrid({
  usage,
  marketing,
  sales,
  leads,
  inboxSla,
  calling,
  website,
  isLoading,
}: DashboardKpiGridProps) {
  const t = useT();
  const { formatCurrency, formatNumber } = useFormatters();

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 9 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
    );
  }

  const slaEnabled = inboxSla?.enabled ?? false;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard
        label={t("dashboard.kpiRevenue")}
        value={formatCurrency(sales?.totalRevenueInCents ?? 0)}
        sub={t("dashboard.kpiRevenueSub", { count: formatNumber(sales?.paidCount ?? 0) })}
        icon={<Banknote className="h-5 w-5" />}
      />
      <StatCard
        label={t("dashboard.kpiActiveConversations")}
        value={formatNumber(usage?.summary.activeConversations ?? 0)}
        sub={t("dashboard.kpiActiveConversationsSub", {
          total: formatNumber(usage?.summary.totalConversations ?? 0),
        })}
        icon={<MessageSquare className="h-5 w-5" />}
      />
      <StatCard
        label={t("dashboard.kpiDeliveryRate")}
        value={`${marketing?.campaigns.rates.deliveryRate ?? 0}%`}
        sub={t("dashboard.kpiDeliveryRateSub", {
          delivered: formatNumber(marketing?.campaigns.aggregates.delivered ?? 0),
          sent: formatNumber(marketing?.campaigns.aggregates.sent ?? 0),
        })}
        icon={<SendHorizonal className="h-5 w-5" />}
      />
      <StatCard
        label={t("dashboard.kpiLeadConversion")}
        value={`${leads?.conversionRate ?? 0}%`}
        sub={t("dashboard.kpiLeadConversionSub", {
          total: formatNumber(leads?.total ?? 0),
          week: formatNumber(leads?.capturedThisWeek ?? 0),
        })}
        icon={<UserPlus className="h-5 w-5" />}
      />
      <StatCard
        label={t("dashboard.kpiReadRate")}
        value={`${marketing?.campaigns.rates.readRate ?? 0}%`}
        sub={t("dashboard.kpiReadRateSub", {
          read: formatNumber(marketing?.campaigns.aggregates.read ?? 0),
          delivered: formatNumber(marketing?.campaigns.aggregates.delivered ?? 0),
        })}
        icon={<Eye className="h-5 w-5" />}
      />
      <StatCard
        label={t("dashboard.kpiTotalMessages")}
        value={formatNumber(usage?.summary.totalMessages ?? 0)}
        sub={t("dashboard.kpiTotalMessagesSub", {
          bots: formatNumber(usage?.summary.activeBots ?? 0),
        })}
        icon={<MessageSquare className="h-5 w-5" />}
      />
      <StatCard
        label={t("dashboard.kpiSlaCompliance")}
        value={slaEnabled ? `${inboxSla?.complianceRate ?? 0}%` : "—"}
        sub={
          slaEnabled
            ? t("dashboard.kpiSlaComplianceSub", {
                met: formatNumber(inboxSla?.metCount ?? 0),
                atRisk: formatNumber(inboxSla?.openAtRisk ?? 0),
              })
            : t("dashboard.controlSlaDisabled")
        }
        icon={<ShieldCheck className="h-5 w-5" />}
      />
      <StatCard
        label={t("dashboard.kpiPickupRate")}
        value={`${calling?.summary.pickupRate ?? 0}%`}
        sub={t("dashboard.kpiPickupRateSub", {
          calls: formatNumber(calling?.summary.totalCalls ?? 0),
        })}
        icon={<Phone className="h-5 w-5" />}
      />
      <StatCard
        label={t("dashboard.kpiPageviews")}
        value={formatNumber(website?.summary.pageviews ?? 0)}
        sub={t("dashboard.kpiPageviewsSub", {
          visitors: formatNumber(website?.summary.uniqueVisitors ?? 0),
        })}
        icon={<Globe className="h-5 w-5" />}
      />
    </div>
  );
}
