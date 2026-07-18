"use client";

import { Suspense, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { PlanUsageCard } from "@/components/billing/PlanUsageCard";
import { BillingPlanCards } from "@/components/billing/BillingPlanCards";
import { useBillingStatus } from "@/hooks/useBilling";
import { useFormatters } from "@/hooks/useFormatters";
import { useT } from "@/i18n/context";
import { isPaidBillingPlan, storePendingBillingPlan } from "@/lib/post-login-path";
import type { TenantPlan } from "@/types";
import { DashboardPage } from "@/components/layout/DashboardPage";
import { PageHeader } from "@/components/layout/PageHeader";

function parsePlanParam(value: string | null): TenantPlan | null {
  if (value === "pro" || value === "enterprise" || value === "free") return value;
  return null;
}

function BillingPageContent() {
  const t = useT();
  const { formatDate } = useFormatters();
  const searchParams = useSearchParams();
  const planParam = parsePlanParam(searchParams.get("plan"));
  const { data: status } = useBillingStatus();

  useEffect(() => {
    if (isPaidBillingPlan(planParam)) {
      storePendingBillingPlan(planParam);
    }
  }, [planParam]);

  return (
    <DashboardPage maxWidth="4xl">
      <PageHeader
        title={t("billing.pageTitle")}
        subtitle={
          <>
            {t("billing.pageSubtitle")}
            {status?.currentPeriodEnd && status.plan !== "free" && (
              <span className="block mt-2">
                {t("billing.renewsOn")}: {formatDate(status.currentPeriodEnd)}
                {status.canRenew ? ` · ${t("billing.renewSoon")}` : ""}
              </span>
            )}
          </>
        }
      />

      <div className="space-y-6">
        <PlanUsageCard hideActions />
        <div className="bg-surface-elevated rounded-xl border border-default p-6">
          <h2 className="font-semibold text-primary text-sm mb-4">{t("billing.choosePlan")}</h2>
          <BillingPlanCards autoCheckoutPlan={planParam} />
        </div>
      </div>
    </DashboardPage>
  );
}

export default function BillingPage() {
  return (
    <Suspense fallback={<DashboardPage maxWidth="4xl"><div className="animate-pulse h-64 bg-surface-muted rounded-xl" /></DashboardPage>}>
      <BillingPageContent />
    </Suspense>
  );
}
