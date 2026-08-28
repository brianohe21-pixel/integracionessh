"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import {
  useBillingPortal,
  useBillingProviders,
} from "@/hooks/useBilling";
import { formatCopPrice, formatUsdPrice } from "@/lib/plan-config";
import type { PaidBillingPlan } from "@/lib/plan-config";
import { useT } from "@/i18n/context";
import type { Tenant } from "@/types";

const UPGRADE_PLANS: PaidBillingPlan[] = ["starter", "pro", "scale"];

export function BillingActions() {
  const t = useT();
  const router = useRouter();
  const portal = useBillingPortal();
  const { data: providers } = useBillingProviders();
  const [error, setError] = useState("");

  const { data: tenant } = useQuery({
    queryKey: ["tenant"],
    queryFn: () => api.get<Tenant>("/tenants/me"),
  });

  const defaultProvider: "wompi" | "stripe" | null =
    providers?.default ??
    (providers?.wompi ? "wompi" : providers?.stripe ? "stripe" : null);
  const canCheckout = Boolean(defaultProvider);

  function goToCheckout(plan: PaidBillingPlan) {
    setError("");
    if (!defaultProvider) {
      setError(t("billing.noProviderConfigured"));
      return;
    }
    router.push(`/billing/checkout?plan=${plan}`);
  }

  async function goToPortal() {
    setError("");
    try {
      const { url } = await portal.mutateAsync();
      if (url) window.location.href = url;
    } catch (err) {
      setError(err instanceof Error ? err.message : t("billing.portalError"));
    }
  }

  const hasStripePortal = Boolean(tenant?.stripeCustomerId);
  const showWompiNote = defaultProvider === "wompi";
  const currentPlan = tenant?.plan ?? "free";

  function upgradeLabel(plan: PaidBillingPlan): string {
    if (plan === "starter") return t("billing.upgradeStarter");
    if (plan === "pro") return t("billing.upgradePro");
    return t("billing.upgradeEnterprise");
  }

  function formatPlanPrice(plan: PaidBillingPlan): string | null {
    const price = providers?.plans?.[plan] ?? (plan === "scale" ? providers?.plans?.enterprise : undefined);
    if (!price) return null;
    return `${formatUsdPrice(price.listPriceUsd)} · ${formatCopPrice(price.amountCents)}`;
  }

  return (
    <div className="flex flex-col gap-3 mt-4">
      {showWompiNote && (
        <p className="text-xs text-secondary">{t("billing.wompiNote")}</p>
      )}
      <div className="flex flex-wrap gap-2">
        {UPGRADE_PLANS.filter((plan) => currentPlan !== plan).map((plan) => {
          const price = formatPlanPrice(plan);
          const isPrimary = plan === "pro";

          return (
            <button
              key={plan}
              type="button"
              onClick={() => goToCheckout(plan)}
              disabled={!canCheckout}
              className={
                isPrimary
                  ? "rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50"
                  : "rounded-lg border border-accent px-4 py-2 text-sm font-medium text-accent hover:bg-accent-muted disabled:opacity-50"
              }
            >
              {upgradeLabel(plan)}
              {price ? ` · ${price}` : ""}
            </button>
          );
        })}
        {hasStripePortal && (
          <button
            type="button"
            onClick={goToPortal}
            disabled={portal.isPending}
            className="rounded-lg border border-default px-4 py-2 text-sm font-medium text-secondary hover:bg-surface disabled:opacity-50"
          >
            {t("billing.manageSubscription")}
          </button>
        )}
      </div>
      <Link href="/billing" className="text-sm text-accent hover:text-accent">
        {t("billing.viewAllPlans")}
      </Link>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
