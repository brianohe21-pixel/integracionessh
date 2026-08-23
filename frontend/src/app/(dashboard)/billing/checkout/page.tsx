"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertCircle, Loader2 } from "lucide-react";
import {
  dismissWompiOverlay,
  WompiCheckoutWidget,
} from "@/components/billing/WompiCheckoutWidget";
import { DashboardPage } from "@/components/layout/DashboardPage";
import { useCheckout, useBillingProviders } from "@/hooks/useBilling";
import { formatCopPrice, formatUsdPrice } from "@/lib/plan-config";
import type { PaidBillingPlan } from "@/lib/plan-config";
import { useFormatters } from "@/hooks/useFormatters";
import { useT } from "@/i18n/context";
import type { WompiCheckoutParams } from "@/hooks/useBilling";

function parsePlan(value: string | null): PaidBillingPlan | null {
  if (value === "starter" || value === "pro" || value === "enterprise") return value;
  return null;
}

function BillingCheckoutPageContent() {
  const t = useT();
  const router = useRouter();
  const { planLabel } = useFormatters();
  const searchParams = useSearchParams();
  const plan = parsePlan(searchParams.get("plan"));
  const checkout = useCheckout();
  const { data: providers } = useBillingProviders();
  const [error, setError] = useState("");
  const [wompiConfig, setWompiConfig] = useState<WompiCheckoutParams | null>(null);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const started = useRef(false);

  const defaultProvider =
    providers?.default ??
    (providers?.wompi ? "wompi" : providers?.stripe ? "stripe" : null);

  const startCheckout = useCallback(async () => {
    if (!plan) {
      setError(t("billing.checkoutInvalidPlan"));
      return;
    }
    if (!defaultProvider) {
      setError(t("billing.noProviderConfigured"));
      return;
    }

    setError("");
    try {
      const result = await checkout.mutateAsync({ plan, provider: defaultProvider });
      if (result.provider === "stripe" && result.url) {
        window.location.href = result.url;
        return;
      }
      if (result.provider === "wompi" && result.wompi) {
        setWompiConfig(result.wompi);
        return;
      }
      if (result.url) {
        window.location.href = result.url;
        return;
      }
      setError(t("billing.checkoutError"));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("billing.checkoutError"));
    }
  }, [checkout, defaultProvider, plan, t]);

  useEffect(() => {
    if (started.current || !plan || !providers) return;
    started.current = true;
    void startCheckout();
  }, [plan, providers, startCheckout]);

  const handleApproved = useCallback(
    (transactionId: string) => {
      const reference = wompiConfig?.reference;
      if (!reference) {
        router.push("/billing/success");
        return;
      }
      router.push(
        `/billing/success?reference=${encodeURIComponent(reference)}&id=${encodeURIComponent(transactionId)}`
      );
    },
    [router, wompiConfig?.reference]
  );

  const handleWidgetError = useCallback((message: string) => {
    setError(message);
    setPaymentOpen(false);
    setWompiConfig(null);
  }, []);

  const handleCancelCheckout = useCallback(() => {
    dismissWompiOverlay();
    setPaymentOpen(false);
    setWompiConfig(null);
    router.push("/billing");
  }, [router]);

  const handlePaymentDismiss = useCallback(() => {
    setPaymentOpen(false);
  }, []);

  const price = plan ? providers?.plans?.[plan] : null;

  if (!plan) {
    return (
      <DashboardPage maxWidth="3xl">
        <div className="rounded-xl border border-default bg-surface-elevated p-6 sm:p-8 text-center">
          <AlertCircle className="mx-auto mb-4 h-12 w-12 text-amber-500" />
          <h1 className="text-xl font-semibold text-primary">{t("billing.checkoutInvalidPlan")}</h1>
          <Link
            href="/billing"
            className="mt-6 inline-block rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-white hover:bg-accent-hover"
          >
            {t("billing.backToBilling")}
          </Link>
        </div>
      </DashboardPage>
    );
  }

  return (
    <DashboardPage maxWidth="3xl">
      <div className="rounded-xl border border-default bg-surface-elevated p-6 sm:p-8 text-center">
        {checkout.isPending && !wompiConfig ? (
          <>
            <Loader2 className="mx-auto mb-4 h-12 w-12 animate-spin text-accent" />
            <h1 className="text-xl font-semibold text-primary">{t("billing.checkoutPreparingTitle")}</h1>
            <p className="mt-2 text-sm text-secondary">{t("billing.checkoutPreparingBody")}</p>
          </>
        ) : (
          <>
            <h1 className="text-xl font-semibold text-primary">{t("billing.checkoutTitle")}</h1>
            <p className="mt-2 text-sm text-secondary">
              {planLabel(plan)}
              {price
                ? ` · ${formatUsdPrice(price.listPriceUsd)} · ${formatCopPrice(price.amountCents)}`
                : ""}
            </p>
            <p className="mt-2 text-sm text-secondary">{t("billing.checkoutWidgetHint")}</p>
          </>
        )}

        <div className="mt-6 flex flex-col gap-2">
          {wompiConfig && !paymentOpen ? (
            <button
              type="button"
              onClick={() => setPaymentOpen(true)}
              className="rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-white hover:bg-accent-hover"
            >
              {t("billing.checkoutOpenPayment")}
            </button>
          ) : null}
          <button
            type="button"
            onClick={handleCancelCheckout}
            className="rounded-lg border border-default px-4 py-2.5 text-sm font-medium text-secondary hover:bg-surface"
          >
            {t("billing.cancelCheckout")}
          </button>
          {error ? (
            <button
              type="button"
              onClick={() => {
                started.current = false;
                setPaymentOpen(false);
                void startCheckout();
              }}
              className="rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-white hover:bg-accent-hover"
            >
              {t("billing.tryAgain")}
            </button>
          ) : null}
        </div>

        {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}
      </div>

      {wompiConfig ? (
        <WompiCheckoutWidget
          config={wompiConfig}
          open={paymentOpen}
          onApproved={handleApproved}
          onDismiss={handlePaymentDismiss}
          onError={handleWidgetError}
        />
      ) : null}

      {paymentOpen ? (
        <div className="fixed inset-x-0 bottom-0 z-[2147483647] border-t border-default bg-surface-elevated p-4 shadow-lg">
          <button
            type="button"
            onClick={handleCancelCheckout}
            className="w-full rounded-lg border border-default px-4 py-3 text-sm font-medium text-secondary hover:bg-surface"
          >
            {t("billing.cancelCheckout")}
          </button>
        </div>
      ) : null}
    </DashboardPage>
  );
}

export default function BillingCheckoutPage() {
  return (
    <Suspense
      fallback={
        <DashboardPage maxWidth="3xl">
          <div className="rounded-xl border border-default bg-surface-elevated p-6 sm:p-8 text-center">
            <Loader2 className="mx-auto mb-4 h-12 w-12 animate-spin text-accent" />
          </div>
        </DashboardPage>
      }
    >
      <BillingCheckoutPageContent />
    </Suspense>
  );
}
