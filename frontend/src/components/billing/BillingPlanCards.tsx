"use client";

import { useEffect, useRef, useState } from "react";
import { useCheckout, useBillingProviders, useBillingStatus } from "@/hooks/useBilling";
import { formatCopPrice } from "@/lib/plan-config";
import { useFormatters } from "@/hooks/useFormatters";
import { useT } from "@/i18n/context";
import type { TenantPlan } from "@/types";

const PAID_PLANS: Array<"pro" | "enterprise"> = ["pro", "enterprise"];

export function BillingPlanCards({ autoCheckoutPlan }: { autoCheckoutPlan?: TenantPlan | null }) {
  const t = useT();
  const { planLabel } = useFormatters();
  const checkout = useCheckout();
  const { data: providers } = useBillingProviders();
  const { data: status } = useBillingStatus();
  const [error, setError] = useState("");
  const [pendingPlan, setPendingPlan] = useState<TenantPlan | null>(null);
  const autoStarted = useRef(false);

  const defaultProvider =
    providers?.default ??
    (providers?.wompi ? "wompi" : providers?.stripe ? "stripe" : null);

  async function startCheckout(plan: "pro" | "enterprise") {
    setError("");
    setPendingPlan(plan);
    if (!defaultProvider) {
      setError(t("billing.noProviderConfigured"));
      setPendingPlan(null);
      return;
    }
    try {
      const result = await checkout.mutateAsync({ plan, provider: defaultProvider });
      if (result.url) window.location.href = result.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : t("billing.checkoutError"));
      setPendingPlan(null);
    }
  }

  useEffect(() => {
    if (autoStarted.current) return;
    if (!autoCheckoutPlan || autoCheckoutPlan === "free") return;
    if (!status || !providers) return;
    if (status.plan === autoCheckoutPlan && !status.isExpired) return;
    autoStarted.current = true;
    void startCheckout(autoCheckoutPlan);
  }, [autoCheckoutPlan, status, providers]);

  const currentPlan = status?.plan ?? "free";

  return (
    <div className="grid min-w-0 gap-4 sm:grid-cols-2">
      <div className="min-w-0 rounded-xl border border-default bg-surface-elevated p-4 sm:p-6">
        <p className="text-sm font-medium text-secondary">Free</p>
        <p className="mt-2 text-xl font-bold text-primary sm:text-2xl">{t("billing.freePrice")}</p>
        <p className="mt-2 text-sm text-secondary">{t("billing.freeDescription")}</p>
        {currentPlan === "free" ? (
          <span className="mt-4 inline-block rounded-full bg-green-50 px-3 py-1 text-xs font-medium text-green-700">
            {t("billing.currentPlanBadge")}
          </span>
        ) : null}
      </div>

      {PAID_PLANS.map((plan) => {
        const price = providers?.plans?.[plan];
        const isCurrent = currentPlan === plan && !status?.isExpired;
        const isPending = pendingPlan === plan && checkout.isPending;

        return (
          <div
            key={plan}
            className={`min-w-0 rounded-xl border bg-surface-elevated p-4 sm:p-6 ${
              plan === "pro" ? "border-accent/30 ring-1 ring-accent/20" : "border-default"
            }`}
          >
            <p className="text-sm font-medium text-secondary">{planLabel(plan)}</p>
            <p className="mt-2 text-xl font-bold text-primary sm:text-2xl">
              {price ? formatCopPrice(price.amountCents) : "—"}
            </p>
            <p className="mt-1 text-xs text-muted">
              {t("billing.periodDays", { days: price?.periodDays ?? 30 })}
            </p>
            <p className="mt-3 text-sm text-secondary">
              {plan === "pro" ? t("billing.proDescription") : t("billing.enterpriseDescription")}
            </p>
            {isCurrent ? (
              <span className="mt-4 inline-block rounded-full bg-green-50 px-3 py-1 text-xs font-medium text-green-700">
                {t("billing.currentPlanBadge")}
              </span>
            ) : (
              <button
                type="button"
                onClick={() => startCheckout(plan)}
                disabled={!defaultProvider || isPending}
                className="mt-4 w-full rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50"
              >
                {isPending ? t("billing.redirecting") : t("billing.subscribe")}
              </button>
            )}
          </div>
        );
      })}

      {defaultProvider === "wompi" && (
        <p className="sm:col-span-2 text-xs text-secondary">{t("billing.wompiNote")}</p>
      )}
      {error && <p className="sm:col-span-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
