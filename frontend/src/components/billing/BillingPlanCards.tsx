"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, MessageCircle, Sparkles } from "lucide-react";
import { useBillingProviders, useBillingStatus } from "@/hooks/useBilling";
import { formatCopPrice, formatUsdPrice, SALES_WHATSAPP_URL } from "@/lib/plan-config";
import { useFormatters } from "@/hooks/useFormatters";
import { useT } from "@/i18n/context";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { SettingsCallout } from "@/components/settings/SettingsCard";
import type { TenantPlan } from "@/types";

const STARTER_FEATURE_KEYS = [
  "billing.starterFeatureBots",
  "billing.starterFeatureWhatsApp",
  "billing.starterFeatureAi",
  "billing.starterFeatureCampaigns",
  "billing.starterFeatureKnowledge",
] as const;

const PRO_FEATURE_KEYS = [
  "billing.proFeatureTailored",
  "billing.proFeatureSupport",
  "billing.proFeatureScale",
] as const;

function PlanCardSkeleton() {
  return (
    <div className="animate-pulse rounded-2xl border border-default bg-surface-elevated p-6">
      <div className="h-4 w-24 rounded bg-surface-muted" />
      <div className="mt-4 h-8 w-32 rounded bg-surface-muted" />
      <div className="mt-2 h-3 w-40 rounded bg-surface-muted" />
      <div className="mt-6 space-y-2">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-3 w-full rounded bg-surface-muted" />
        ))}
      </div>
      <div className="mt-6 h-10 w-full rounded-lg bg-surface-muted" />
    </div>
  );
}

function FeatureList({ keys, t }: { keys: readonly string[]; t: (key: string) => string }) {
  return (
    <ul className="mt-5 space-y-2.5">
      {keys.map((key) => (
        <li key={key} className="flex items-start gap-2.5 text-sm text-secondary">
          <Check className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden />
          <span>{t(key)}</span>
        </li>
      ))}
    </ul>
  );
}

export function BillingPlanCards({ autoCheckoutPlan }: { autoCheckoutPlan?: TenantPlan | null }) {
  const t = useT();
  const router = useRouter();
  const { planLabel } = useFormatters();
  const { data: providers, isLoading: providersLoading } = useBillingProviders();
  const { data: status } = useBillingStatus();
  const [error, setError] = useState("");
  const autoStarted = useRef(false);

  const defaultProvider =
    providers?.default ??
    (providers?.wompi ? "wompi" : providers?.stripe ? "stripe" : null);

  const startStarterCheckout = useCallback(() => {
    setError("");
    if (!defaultProvider) {
      setError(t("billing.noProviderConfigured"));
      return;
    }
    router.push("/billing/checkout?plan=starter");
  }, [defaultProvider, router, t]);

  useEffect(() => {
    if (autoStarted.current) return;
    if (autoCheckoutPlan !== "starter") return;
    if (!status || !providers) return;
    if (status.plan === "starter" && !status.isExpired) return;
    autoStarted.current = true;
    void startStarterCheckout();
  }, [autoCheckoutPlan, startStarterCheckout, status, providers]);

  const currentPlan = status?.plan ?? "free";
  const starterPrice = providers?.plans?.starter;
  const isStarterCurrent = currentPlan === "starter" && !status?.isExpired;
  const isProCurrent = currentPlan === "pro" && !status?.isExpired;

  if (providersLoading) {
    return (
      <div className="grid min-w-0 gap-5 lg:grid-cols-2">
        <PlanCardSkeleton />
        <PlanCardSkeleton />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="grid min-w-0 gap-5 lg:grid-cols-2 lg:items-stretch">
        <article
          className={cn(
            "relative flex min-w-0 flex-col rounded-2xl border bg-surface-elevated p-6 shadow-sm",
            isStarterCurrent ? "border-success/30 ring-1 ring-success/20" : "border-accent/25 ring-1 ring-accent/15"
          )}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-secondary">{planLabel("starter")}</p>
              <div className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-1">
                <p className="text-3xl font-bold tracking-tight text-primary">
                  {formatUsdPrice(starterPrice?.listPriceUsd ?? 80)}
                </p>
                <span className="text-sm text-muted">{t("billing.perMonth")}</span>
              </div>
            </div>
            {!isStarterCurrent ? (
              <Badge variant="accent" className="shrink-0">
                <Sparkles className="h-3 w-3" aria-hidden />
                {t("billing.recommended")}
              </Badge>
            ) : (
              <Badge variant="success" dot>{t("billing.currentPlanBadge")}</Badge>
            )}
          </div>

          <div className="mt-3 space-y-1 rounded-xl bg-surface-muted/40 px-3 py-2.5">
            <p className="text-sm font-medium text-primary">
              {starterPrice ? formatCopPrice(starterPrice.amountCents) : "—"}
            </p>
            <p className="text-xs text-muted">
              {t("billing.periodDays", { days: starterPrice?.periodDays ?? 30 })}
              {starterPrice?.trm
                ? ` · ${t("billing.trmNote", { trm: starterPrice.trm.toLocaleString("es-CO") })}`
                : ""}
            </p>
          </div>

          <FeatureList keys={STARTER_FEATURE_KEYS} t={t} />

          <div className="mt-6 flex-1" />

          {isStarterCurrent ? (
            <p className="mt-6 text-center text-sm text-muted">{t("billing.currentPlan")}</p>
          ) : (
            <Button
              type="button"
              onClick={startStarterCheckout}
              disabled={!defaultProvider}
              className="mt-6 w-full"
              size="lg"
            >
              {t("billing.subscribe")}
            </Button>
          )}
        </article>

        <article
          className={cn(
            "flex min-w-0 flex-col rounded-2xl border border-default bg-surface-elevated p-6 shadow-sm",
            isProCurrent && "border-success/30 ring-1 ring-success/20"
          )}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-secondary">{planLabel("pro")}</p>
              <p className="mt-2 text-3xl font-bold tracking-tight text-primary">
                {t("billing.salesOnlyPrice")}
              </p>
            </div>
            {isProCurrent ? (
              <Badge variant="success" dot>{t("billing.currentPlanBadge")}</Badge>
            ) : null}
          </div>

          <p className="mt-3 text-sm text-secondary">{t("billing.salesOnlyHint")}</p>

          <FeatureList keys={PRO_FEATURE_KEYS} t={t} />

          <div className="mt-6 flex-1" />

          {isProCurrent ? (
            <p className="mt-6 text-center text-sm text-muted">{t("billing.currentPlan")}</p>
          ) : (
            <a
              href={SALES_WHATSAPP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-default bg-surface px-4 py-2.5 text-sm font-medium text-primary transition-colors hover:bg-surface-muted"
            >
              <MessageCircle className="h-4 w-4 text-accent" aria-hidden />
              {t("billing.contactSales")}
            </a>
          )}
        </article>
      </div>

      {defaultProvider === "wompi" ? (
        <SettingsCallout variant="info">{t("billing.wompiNote")}</SettingsCallout>
      ) : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
