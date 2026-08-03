"use client";

import {
  Banknote,
  MessageSquare,
  SendHorizonal,
  UserPlus,
} from "lucide-react";
import { StatCard } from "@/components/ui/StatCard";
import { Skeleton } from "@/components/ui/Skeleton";
import { useT } from "@/i18n/context";
import { useFormatters } from "@/hooks/useFormatters";
import type { UsageMetrics, MarketingMetrics, SalesMetrics, LeadMetrics } from "@/types";

interface DashboardKpiGridProps {
  usage?: UsageMetrics | null;
  marketing?: MarketingMetrics | null;
  sales?: SalesMetrics | null;
  leads?: LeadMetrics | null;
  isLoading: boolean;
}

export function DashboardKpiGrid({
  usage,
  marketing,
  sales,
  leads,
  isLoading,
}: DashboardKpiGridProps) {
  const t = useT();
  const { formatCurrency, formatNumber } = useFormatters();

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
    );
  }

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
    </div>
  );
}
