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
    <div className="p-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">{t("billing.pageTitle")}</h1>
        <p className="text-sm text-gray-500 mt-1">{t("billing.pageSubtitle")}</p>
        {status?.currentPeriodEnd && status.plan !== "free" && (
          <p className="text-sm text-gray-500 mt-2">
            {t("billing.renewsOn")}: {formatDate(status.currentPeriodEnd)}
            {status.canRenew ? ` · ${t("billing.renewSoon")}` : ""}
          </p>
        )}
      </div>

      <div className="space-y-6">
        <PlanUsageCard hideActions />
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="font-semibold text-gray-900 text-sm mb-4">{t("billing.choosePlan")}</h2>
          <BillingPlanCards autoCheckoutPlan={planParam} />
        </div>
      </div>
    </div>
  );
}

export default function BillingPage() {
  return (
    <Suspense fallback={<div className="p-8 max-w-4xl animate-pulse h-64 bg-gray-100 rounded-xl" />}>
      <BillingPageContent />
    </Suspense>
  );
}
