"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useBillingProviders, useBillingStatus } from "@/hooks/useBilling";
import { formatCopPrice, formatUsdPrice } from "@/lib/plan-config";
import { useFormatters } from "@/hooks/useFormatters";
import { useT } from "@/i18n/context";
import type { PaidBillingPlan } from "@/lib/plan-config";
import type { TenantPlan } from "@/types";

const PAID_PLANS: PaidBillingPlan[] = ["starter", "pro", "scale"];

export function BillingPlanCards({ autoCheckoutPlan }: { autoCheckoutPlan?: TenantPlan | null }) {
  const t = useT();
  const router = useRouter();
  const { planLabel } = useFormatters();
  const { data: providers } = useBillingProviders();
  const { data: status } = useBillingStatus();
  const [error, setError] = useState("");
  const autoStarted = useRef(false);

  const defaultProvider =
    providers?.default ??
    (providers?.wompi ? "wompi" : providers?.stripe ? "stripe" : null);

  const startCheckout = useCallback(
    (plan: PaidBillingPlan) => {
      setError("");
      if (!defaultProvider) {
        setError(t("billing.noProviderConfigured"));
        return;
      }
      router.push(`/billing/checkout?plan=${plan}`);
    },
    [defaultProvider, router, t]
  );

  useEffect(() => {
    if (autoStarted.current) return;
    if (
      !autoCheckoutPlan ||
      autoCheckoutPlan === "free" ||
      autoCheckoutPlan === "reseller"
    ) {
      return;
    }
    if (!status || !providers) return;
    if (status.plan === autoCheckoutPlan && !status.isExpired) return;
    autoStarted.current = true;
    void startCheckout(autoCheckoutPlan);
  }, [autoCheckoutPlan, startCheckout, status, providers]);

  const currentPlan = status?.plan ?? "free";

  function planDescription(plan: PaidBillingPlan): string {
    if (plan === "starter") return t("billing.starterDescription");
    if (plan === "pro") return t("billing.proDescription");
    return t("billing.scaleDescription");
  }

  return (
    <div className="space-y-4">
      <div className="grid min-w-0 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="min-w-0 rounded-xl border border-default bg-surface-elevated p-4 sm:p-6">
          <p className="text-sm font-medium text-secondary">{planLabel("free")}</p>
          <p className="mt-2 text-xl font-bold text-primary sm:text-2xl">{t("billing.freePrice")}</p>
          <p className="mt-2 text-sm text-secondary">{t("billing.freeDescription")}</p>
          {currentPlan === "free" ? (
            <span className="mt-4 inline-block rounded-full bg-green-50 px-3 py-1 text-xs font-medium text-green-700">
              {t("billing.currentPlanBadge")}
            </span>
          ) : null}
        </div>

        {PAID_PLANS.map((plan) => {
          const price =
            providers?.plans?.[plan] ?? (plan === "scale" ? providers?.plans?.enterprise : undefined);
          const isCurrent = currentPlan === plan && !status?.isExpired;

          return (
            <div
              key={plan}
              className={`min-w-0 rounded-xl border bg-surface-elevated p-4 sm:p-6 ${
                plan === "pro" ? "border-accent/30 ring-1 ring-accent/20" : "border-default"
              }`}
            >
              <p className="text-sm font-medium text-secondary">{planLabel(plan)}</p>
              <p className="mt-2 text-xl font-bold text-primary sm:text-2xl">
                {price ? formatUsdPrice(price.listPriceUsd) : "—"}
              </p>
              <p className="mt-1 text-xs text-muted">
                {price ? formatCopPrice(price.amountCents) : "—"} ·{" "}
                {t("billing.periodDays", { days: price?.periodDays ?? 30 })}
              </p>
              <p className="mt-3 text-sm text-secondary">{planDescription(plan)}</p>
              {isCurrent ? (
                <span className="mt-4 inline-block rounded-full bg-green-50 px-3 py-1 text-xs font-medium text-green-700">
                  {t("billing.currentPlanBadge")}
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => startCheckout(plan)}
                  disabled={!defaultProvider}
                  className="mt-4 w-full rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50"
                >
                  {t("billing.subscribe")}
                </button>
              )}
            </div>
          );
        })}
      </div>

      <div className="rounded-xl border border-dashed border-default bg-surface-elevated p-4 sm:p-6">
        <p className="text-sm font-medium text-secondary">{t("billing.customPlanTitle")}</p>
        <p className="mt-2 text-xl font-bold text-primary sm:text-2xl">{t("billing.customPlanPrice")}</p>
        <p className="mt-3 text-sm text-secondary">{t("billing.customPlanDescription")}</p>
      </div>

      {defaultProvider === "wompi" && (
        <p className="text-xs text-secondary">{t("billing.wompiNote")}</p>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
