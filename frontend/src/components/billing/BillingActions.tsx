"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import {
  useCheckout,
  useBillingPortal,
  useConfirmWompiPayment,
  useBillingProviders,
} from "@/hooks/useBilling";
import { useT } from "@/i18n/context";
import type { Tenant } from "@/types";

export function BillingActions() {
  const t = useT();
  const searchParams = useSearchParams();
  const checkout = useCheckout();
  const portal = useBillingPortal();
  const confirmWompi = useConfirmWompiPayment();
  const { data: providers } = useBillingProviders();
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const { data: tenant, refetch: refetchTenant } = useQuery({
    queryKey: ["tenant"],
    queryFn: () => api.get<Tenant>("/tenants/me"),
  });

  const defaultProvider: "wompi" | "stripe" | null =
    providers?.default ??
    (providers?.wompi ? "wompi" : providers?.stripe ? "stripe" : null);
  const canCheckout = Boolean(defaultProvider);

  useEffect(() => {
    const billing = searchParams.get("billing");
    const id = searchParams.get("id");
    const reference = searchParams.get("reference");

    if (billing !== "success" || !id) return;

    confirmWompi
      .mutateAsync({ id, reference: reference ?? "" })
      .then(() => {
        setSuccess(t("billing.wompiSuccess"));
        refetchTenant();
        window.history.replaceState({}, "", "/settings");
      })
      .catch(() => {
        setError(t("billing.wompiConfirmError"));
      });
  }, [searchParams, confirmWompi, refetchTenant, t]);

  async function goToCheckout(plan: "pro" | "enterprise") {
    setError("");
    setSuccess("");
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

  return (
    <div className="flex flex-col gap-3 mt-4">
      {showWompiNote && (
        <p className="text-xs text-gray-500">{t("billing.wompiNote")}</p>
      )}
      <div className="flex flex-wrap gap-2">
        {tenant?.plan !== "pro" && (
          <button
            type="button"
            onClick={() => goToCheckout("pro")}
            disabled={!canCheckout || checkout.isPending || confirmWompi.isPending}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {t("billing.upgradePro")}
          </button>
        )}
        {tenant?.plan !== "enterprise" && (
          <button
            type="button"
            onClick={() => goToCheckout("enterprise")}
            disabled={!canCheckout || checkout.isPending || confirmWompi.isPending}
            className="rounded-lg border border-indigo-600 px-4 py-2 text-sm font-medium text-indigo-600 hover:bg-indigo-50 disabled:opacity-50"
          >
            {t("billing.upgradeEnterprise")}
          </button>
        )}
        {hasStripePortal && (
          <button
            type="button"
            onClick={goToPortal}
            disabled={portal.isPending}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            {t("billing.manageSubscription")}
          </button>
        )}
      </div>
      {success && <p className="text-sm text-green-600">{success}</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
