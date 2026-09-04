"use client";

import { Banknote, Clock, Eye, UserPlus } from "lucide-react";
import { StatCard } from "@/components/ui/StatCard";
import { Skeleton } from "@/components/ui/Skeleton";
import { useT } from "@/i18n/context";
import { useFormatters } from "@/hooks/useFormatters";
import type { MarketingMetrics, SalesMetrics, LeadMetrics } from "@/types";

interface DashboardKpiGridProps {
  marketing?: MarketingMetrics | null;
  sales?: SalesMetrics | null;
  leads?: LeadMetrics | null;
  rangeLabel: string;
  isLoading: boolean;
}

export function DashboardKpiGrid({
  marketing,
  sales,
  leads,
  rangeLabel,
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

  const inbox = marketing?.inbox;
  const aggregates = marketing?.campaigns.aggregates;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard
        label={t("dashboard.kpiRevenuePeriod", { period: rangeLabel })}
        value={formatCurrency(sales?.totalRevenueInCents ?? 0)}
        sub={t("dashboard.kpiRevenueSub", {
          count: formatNumber(sales?.paidCount ?? 0),
          ticket: formatCurrency(sales?.averageTicketInCents ?? 0),
        })}
        icon={<Banknote className="h-5 w-5" />}
      />
      <StatCard
        label={t("dashboard.kpiPendingResponses")}
        value={formatNumber(inbox?.pending ?? 0)}
        sub={t("dashboard.kpiPendingResponsesSub", {
          open: formatNumber(inbox?.open ?? 0),
        })}
        icon={<Clock className="h-5 w-5" />}
      />
      <StatCard
        label={t("dashboard.kpiReadRate")}
        value={`${marketing?.campaigns.rates.readRate ?? 0}%`}
        sub={t("dashboard.kpiReadRateSub", {
          read: formatNumber(aggregates?.read ?? 0),
          delivered: formatNumber(aggregates?.delivered ?? 0),
        })}
        icon={<Eye className="h-5 w-5" />}
      />
      <StatCard
        label={t("dashboard.kpiLeadsThisWeek")}
        value={formatNumber(leads?.capturedThisWeek ?? 0)}
        sub={t("dashboard.kpiLeadsThisWeekSub", {
          total: formatNumber(leads?.total ?? 0),
        })}
        icon={<UserPlus className="h-5 w-5" />}
      />
    </div>
  );
}
