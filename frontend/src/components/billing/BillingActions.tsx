"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import {
  useCheckout,
  useBillingPortal,
  useBillingProviders,
} from "@/hooks/useBilling";
import { formatCopPrice } from "@/lib/plan-config";
import { useT } from "@/i18n/context";
import type { Tenant } from "@/types";

export function BillingActions() {
  const t = useT();
  const checkout = useCheckout();
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

  async function goToCheckout(plan: "pro" | "enterprise") {
    setError("");
    if (!defaultProvider) {
      setError(t("billing.noProviderConfigured"));
      return;
    }
    try {
      const result = await checkout.mutateAsync({
        plan,
        provider: defaultProvider,
      });
      if (result.url) window.location.href = result.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : t("billing.checkoutError"));
    }
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
  const proPrice = providers?.plans?.pro
    ? formatCopPrice(providers.plans.pro.amountCents)
    : null;
  const enterprisePrice = providers?.plans?.enterprise
    ? formatCopPrice(providers.plans.enterprise.amountCents)
    : null;

  return (
    <div className="flex flex-col gap-3 mt-4">
      {showWompiNote && (
        <p className="text-xs text-secondary">{t("billing.wompiNote")}</p>
      )}
      <div className="flex flex-wrap gap-2">
        {tenant?.plan !== "pro" && (
          <button
            type="button"
            onClick={() => goToCheckout("pro")}
            disabled={!canCheckout || checkout.isPending}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50"
          >
            {t("billing.upgradePro")}
            {proPrice ? ` · ${proPrice}` : ""}
          </button>
        )}
        {tenant?.plan !== "enterprise" && (
          <button
            type="button"
            onClick={() => goToCheckout("enterprise")}
            disabled={!canCheckout || checkout.isPending}
            className="rounded-lg border border-accent px-4 py-2 text-sm font-medium text-accent hover:bg-accent-muted disabled:opacity-50"
          >
            {t("billing.upgradeEnterprise")}
            {enterprisePrice ? ` · ${enterprisePrice}` : ""}
          </button>
        )}
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
