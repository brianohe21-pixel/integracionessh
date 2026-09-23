"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CalendarClock } from "lucide-react";
import { PlanUsageCard } from "@/components/billing/PlanUsageCard";
import { BillingPlanCards } from "@/components/billing/BillingPlanCards";
import { PaymentHistoryTab } from "@/components/billing/PaymentHistoryTab";
import { useBillingPayments, useBillingStatus } from "@/hooks/useBilling";
import { useFormatters } from "@/hooks/useFormatters";
import { useT } from "@/i18n/context";
import { isPaidBillingPlan, storePendingBillingPlan } from "@/lib/post-login-path";
import type { TenantPlan } from "@/types";
import { DashboardPage } from "@/components/layout/DashboardPage";
import { PageHeader } from "@/components/layout/PageHeader";
import { SettingsCallout } from "@/components/settings/SettingsCard";
import { Tabs } from "@/components/ui/Tabs";

type BillingTab = "plans" | "history";

function parsePlanParam(value: string | null): TenantPlan | null {
  if (
    value === "starter" ||
    value === "pro" ||
    value === "free" ||
    value === "reseller"
  ) {
    return value;
  }
  if (value === "enterprise") return "pro";
  return null;
}

function BillingPageContent() {
  const t = useT();
  const router = useRouter();
  const { formatDate, planLabel } = useFormatters();
  const searchParams = useSearchParams();
  const planParam = parsePlanParam(searchParams.get("plan"));
  const { data: status } = useBillingStatus();
  const { data: payments } = useBillingPayments();
  const [tab, setTab] = useState<BillingTab>("plans");

  useEffect(() => {
    const requested = searchParams.get("tab");
    if (requested === "plans" || requested === "history") {
      setTab(requested);
    }
  }, [searchParams]);

  useEffect(() => {
    if (isPaidBillingPlan(planParam)) {
      storePendingBillingPlan(planParam);
    }
  }, [planParam]);

  function selectTab(nextTab: BillingTab) {
    setTab(nextTab);
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", nextTab);
    router.replace(`/billing?${params.toString()}`, { scroll: false });
  }

  const showRenewalBanner =
    status?.canRenew &&
    status.plan !== "free" &&
    status.currentPeriodEnd &&
    !status.isExpired;

  return (
    <DashboardPage>
      <PageHeader
        title={t("billing.pageTitle")}
        subtitle={t("billing.pageSubtitle")}
      />

      <div className="space-y-6">
        {showRenewalBanner ? (
          <SettingsCallout variant="warning" title={t("billing.renewalBannerTitle")}>
            <div className="flex items-start gap-2">
              <CalendarClock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <p>
                {t("billing.renewalBannerBody", {
                  date: formatDate(status.currentPeriodEnd!),
                })}
              </p>
            </div>
          </SettingsCallout>
        ) : null}

        <Tabs
          value={tab}
          onChange={(value) => selectTab(value as BillingTab)}
          items={[
            { id: "plans", label: t("billing.tabPlans") },
            {
              id: "history",
              label: t("billing.tabPaymentHistory"),
              count: payments?.length ?? 0,
            },
          ]}
          className="w-full max-w-md"
        />

        {tab === "plans" ? (
          <>
            <PlanUsageCard hideActions />

            <section className="rounded-2xl border border-default bg-surface-elevated p-6 sm:p-8">
              <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-primary">{t("billing.choosePlan")}</h2>
                  <p className="mt-1 text-sm text-secondary">{t("billing.choosePlanHint")}</p>
                </div>
                {status?.currentPeriodEnd && status.plan !== "free" && !status.isExpired ? (
                  <p className="text-sm text-muted">
                    {planLabel(status.plan)} · {t("billing.renewsOn")}{" "}
                    <span className="font-medium text-primary">
                      {formatDate(status.currentPeriodEnd)}
                    </span>
                  </p>
                ) : null}
              </div>
              <BillingPlanCards autoCheckoutPlan={planParam} />
            </section>
          </>
        ) : (
          <section className="rounded-2xl border border-default bg-surface-elevated p-6 sm:p-8">
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-primary">
                {t("billing.paymentHistory.title")}
              </h2>
            </div>
            <PaymentHistoryTab />
          </section>
        )}
      </div>
    </DashboardPage>
  );
}

export default function BillingPage() {
  return (
    <Suspense
      fallback={
        <DashboardPage>
          <div className="animate-pulse space-y-6">
            <div className="h-20 rounded-2xl bg-surface-muted" />
            <div className="h-48 rounded-2xl bg-surface-muted" />
            <div className="h-80 rounded-2xl bg-surface-muted" />
          </div>
        </DashboardPage>
      }
    >
      <BillingPageContent />
    </Suspense>
  );
}
