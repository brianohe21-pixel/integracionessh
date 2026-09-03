"use client";

import { useMemo } from "react";
import Link from "next/link";
import { BarChart3, ArrowRight } from "lucide-react";
import { useMetrics } from "@/hooks/useMetrics";
import { useMarketingMetrics } from "@/hooks/useMarketingMetrics";
import { useSalesMetrics } from "@/hooks/useSalesMetrics";
import { useLeadMetrics } from "@/hooks/useLeads";
import { useInboxSlaMetrics } from "@/hooks/useInboxSlaMetrics";
import { useCallingMetrics } from "@/hooks/useCallingMetrics";
import { useWebsiteMetrics } from "@/hooks/useWebsiteMetrics";
import { useConversationCategoryMetrics } from "@/hooks/useConversationCategoryMetrics";
import { dateRangeFromDays } from "@/lib/metrics-date-range";
import { DashboardPage } from "@/components/layout/DashboardPage";
import { PageHeader } from "@/components/layout/PageHeader";
import { OnboardingBanner } from "@/components/onboarding/OnboardingBanner";
import { DashboardControlSummary } from "@/components/dashboard/DashboardControlSummary";
import { DashboardKpiGrid } from "@/components/dashboard/DashboardKpiGrid";
import { DashboardActivityChart } from "@/components/dashboard/DashboardActivityChart";
import { DashboardCampaignFunnelChart } from "@/components/dashboard/DashboardCampaignFunnelChart";
import { DashboardSalesBySourceChart } from "@/components/dashboard/DashboardSalesBySourceChart";
import { DashboardLeadFunnelChart } from "@/components/dashboard/DashboardLeadFunnelChart";
import { DashboardInboxStatusChart } from "@/components/dashboard/DashboardInboxStatusChart";
import { DashboardTopCampaignsChart } from "@/components/dashboard/DashboardTopCampaignsChart";
import { DashboardCallingSummaryChart } from "@/components/dashboard/DashboardCallingSummaryChart";
import { DashboardWebsiteTrendChart } from "@/components/dashboard/DashboardWebsiteTrendChart";
import { DashboardSlaByAdvisorChart } from "@/components/dashboard/DashboardSlaByAdvisorChart";
import { DashboardSalesByBotChart } from "@/components/dashboard/DashboardSalesByBotChart";
import { DashboardConversationCategoriesChart } from "@/components/dashboard/DashboardConversationCategoriesChart";
import { DashboardOperationalStatus } from "@/components/dashboard/DashboardOperationalStatus";
import { DashboardQuickActions } from "@/components/dashboard/DashboardQuickActions";
import { useT } from "@/i18n/context";

export default function DashboardPageRoute() {
  const t = useT();
  const metricsRange = useMemo(() => dateRangeFromDays(30), []);

  const { data: usage, isLoading: usageLoading, error: usageError } = useMetrics();
  const {
    data: marketing,
    isLoading: marketingLoading,
    error: marketingError,
  } = useMarketingMetrics();
  const {
    data: sales,
    isLoading: salesLoading,
    error: salesError,
  } = useSalesMetrics(metricsRange);
  const {
    data: leads,
    isLoading: leadsLoading,
    error: leadsError,
  } = useLeadMetrics();
  const {
    data: inboxSla,
    isLoading: slaLoading,
    error: slaError,
  } = useInboxSlaMetrics();
  const {
    data: calling,
    isLoading: callingLoading,
    error: callingError,
  } = useCallingMetrics(metricsRange);
  const {
    data: website,
    isLoading: websiteLoading,
    error: websiteError,
  } = useWebsiteMetrics(metricsRange);
  const {
    data: categories,
    isLoading: categoriesLoading,
    error: categoriesError,
  } = useConversationCategoryMetrics(metricsRange.from, metricsRange.to);

  const kpiLoading =
    usageLoading ||
    marketingLoading ||
    salesLoading ||
    leadsLoading ||
    slaLoading ||
    callingLoading ||
    websiteLoading;
  const controlLoading = usageLoading || marketingLoading || slaLoading;

  return (
    <DashboardPage className="gap-6">
      <PageHeader
        title={t("dashboard.title")}
        subtitle={t("dashboard.subtitle")}
        className="mb-0 sm:mb-0"
        actions={
          <Link
            href="/metrics"
            className="inline-flex items-center gap-2 rounded-xl border border-default bg-surface-elevated px-3.5 py-2.5 text-sm font-medium text-primary transition-colors hover:bg-surface-muted"
          >
            <BarChart3 className="h-4 w-4 text-accent" />
            {t("dashboard.viewMetrics")}
          </Link>
        }
      />

      <OnboardingBanner />

      <DashboardControlSummary
        usage={usage}
        marketing={marketing}
        inboxSla={inboxSla}
        isLoading={controlLoading}
      />

      <DashboardKpiGrid
        usage={usage}
        marketing={marketing}
        sales={sales}
        leads={leads}
        inboxSla={inboxSla}
        calling={calling}
        website={website}
        isLoading={kpiLoading}
      />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <DashboardActivityChart
            usage={usage}
            isLoading={usageLoading}
            error={usageError}
          />
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <DashboardCampaignFunnelChart
              marketing={marketing}
              isLoading={marketingLoading}
              error={marketingError}
            />
            <DashboardSalesBySourceChart
              sales={sales}
              isLoading={salesLoading}
              error={salesError}
            />
            <DashboardInboxStatusChart
              marketing={marketing}
              isLoading={marketingLoading}
              error={marketingError}
            />
            <DashboardTopCampaignsChart
              marketing={marketing}
              isLoading={marketingLoading}
              error={marketingError}
            />
            <DashboardCallingSummaryChart
              calling={calling}
              isLoading={callingLoading}
              error={callingError}
            />
            <DashboardWebsiteTrendChart
              website={website}
              isLoading={websiteLoading}
              error={websiteError}
            />
            <DashboardSlaByAdvisorChart
              inboxSla={inboxSla}
              isLoading={slaLoading}
              error={slaError}
            />
            <DashboardConversationCategoriesChart
              categories={categories}
              isLoading={categoriesLoading}
              error={categoriesError}
            />
          </div>
          <DashboardLeadFunnelChart
            leads={leads}
            isLoading={leadsLoading}
            error={leadsError}
          />
          <DashboardSalesByBotChart
            sales={sales}
            isLoading={salesLoading}
            error={salesError}
          />
        </div>

        <div className="space-y-6">
          <DashboardOperationalStatus
            marketing={marketing}
            inboxSla={inboxSla}
            isLoadingMarketing={marketingLoading}
            isLoadingSla={slaLoading}
          />
          <DashboardQuickActions />
          <div className="content-card overflow-hidden">
            <div className="section-header">
              <h2 className="section-header-title">{t("dashboard.dataScopeTitle")}</h2>
            </div>
            <div className="p-4 sm:p-5">
              <ul className="space-y-2 text-xs text-muted">
                <li>{t("dashboard.dataScopeSales")}</li>
                <li>{t("dashboard.dataScopeUsage")}</li>
                <li>{t("dashboard.dataScopeMarketing")}</li>
                <li>{t("dashboard.dataScopeCalling")}</li>
                <li>{t("dashboard.dataScopeWebsite")}</li>
              </ul>
              <Link
                href="/metrics"
                className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline"
              >
                {t("dashboard.viewDetail")}
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </DashboardPage>
  );
}
