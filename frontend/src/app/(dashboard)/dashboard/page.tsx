"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { BarChart3 } from "lucide-react";
import { useMetrics } from "@/hooks/useMetrics";
import { useMarketingMetrics } from "@/hooks/useMarketingMetrics";
import { useSalesMetrics } from "@/hooks/useSalesMetrics";
import { useLeadMetrics } from "@/hooks/useLeads";
import { useInboxSlaMetrics } from "@/hooks/useInboxSlaMetrics";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { dateRangeFromDays, getDashboardRangeLabel } from "@/lib/metrics-date-range";
import { DashboardPage } from "@/components/layout/DashboardPage";
import { PageHeader } from "@/components/layout/PageHeader";
import { OnboardingBanner } from "@/components/onboarding/OnboardingBanner";
import { DashboardKpiGrid } from "@/components/dashboard/DashboardKpiGrid";
import { DashboardPrimaryFunnelChart } from "@/components/dashboard/DashboardPrimaryFunnelChart";
import { DashboardMessagesSentChart } from "@/components/dashboard/DashboardMessagesSentChart";
import { DashboardSalesBySourceChart } from "@/components/dashboard/DashboardSalesBySourceChart";
import { DashboardOperationalStatus } from "@/components/dashboard/DashboardOperationalStatus";
import { DashboardQuickActions } from "@/components/dashboard/DashboardQuickActions";
import { DashboardDateRangeFilter } from "@/components/dashboard/DashboardDateRangeFilter";
import { useLocale, useT } from "@/i18n/context";

export default function DashboardPageRoute() {
  const t = useT();
  const locale = useLocale();
  const { user } = useCurrentUser();
  const [metricsRange, setMetricsRange] = useState(() => dateRangeFromDays(30));

  const rangeLabel = useMemo(
    () =>
      getDashboardRangeLabel(
        metricsRange,
        {
          last7: t("dashboard.rangeLast7"),
          last14: t("dashboard.rangeLast14"),
          last30: t("dashboard.rangeLast30"),
          thisMonth: t("dashboard.rangeThisMonth"),
          lastMonth: t("dashboard.rangeLastMonth"),
          custom: (from, to) => t("dashboard.rangeCustomLabel", { from, to }),
        },
        locale
      ),
    [metricsRange, t, locale]
  );

  const firstName = user?.name?.trim().split(/\s+/)[0];
  const greetingTitle = firstName
    ? t("dashboard.greeting", { name: firstName })
    : t("dashboard.greetingFallback");

  const { data: marketing, isLoading: marketingLoading } = useMarketingMetrics();
  const { data: usage, isLoading: usageLoading, error: usageError } = useMetrics();
  const {
    data: sales,
    isLoading: salesLoading,
    error: salesError,
  } = useSalesMetrics(metricsRange);
  const { data: leads, isLoading: leadsLoading } = useLeadMetrics();
  const { data: inboxSla, isLoading: slaLoading } = useInboxSlaMetrics();

  const kpiLoading = marketingLoading || salesLoading || leadsLoading;

  return (
    <DashboardPage className="gap-6">
      <PageHeader
        title={greetingTitle}
        subtitle={t("dashboard.greetingSubtitle")}
        className="mb-0 sm:mb-0"
        actions={
          <>
            <DashboardDateRangeFilter value={metricsRange} onChange={setMetricsRange} />
            <Link
              href="/metrics"
              className="inline-flex items-center gap-2 rounded-xl border border-default bg-surface-elevated px-3.5 py-2.5 text-sm font-medium text-primary transition-colors hover:bg-surface-muted"
            >
              <BarChart3 className="h-4 w-4 text-accent" />
              {t("dashboard.viewMetrics")}
            </Link>
          </>
        }
      />

      <OnboardingBanner />

      <DashboardKpiGrid
        marketing={marketing}
        sales={sales}
        leads={leads}
        rangeLabel={rangeLabel}
        isLoading={kpiLoading}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <DashboardPrimaryFunnelChart
          marketing={marketing}
          leads={leads}
          isLoadingMarketing={marketingLoading}
          isLoadingLeads={leadsLoading}
        />
        <DashboardMessagesSentChart
          usage={usage}
          isLoading={usageLoading}
          error={usageError}
        />
        <DashboardSalesBySourceChart
          sales={sales}
          rangeLabel={rangeLabel}
          isLoading={salesLoading}
          error={salesError}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <DashboardOperationalStatus
            marketing={marketing}
            inboxSla={inboxSla}
            isLoadingMarketing={marketingLoading}
            isLoadingSla={slaLoading}
          />
        </div>
        <DashboardQuickActions />
      </div>
    </DashboardPage>
  );
}
