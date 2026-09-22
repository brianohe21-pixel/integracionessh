"use client";

import Link from "next/link";
import { Sparkles, X } from "lucide-react";
import { useT } from "@/i18n/context";
import { useOnboardingStatus, useUpdateOnboarding } from "@/hooks/useOnboarding";
import { ONBOARDING_STEPS } from "@/lib/onboarding";

export function OnboardingBanner() {
  const t = useT();
  const { showBanner, stepNumber, isLoading } = useOnboardingStatus();
  const dismissBanner = useUpdateOnboarding();

  if (isLoading || !showBanner) return null;

  return (
    <div className="mb-6 flex flex-col gap-3 rounded-xl border border-accent/30 bg-accent-muted/40 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent/10">
          <Sparkles className="h-5 w-5 text-accent" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-primary">{t("onboarding.bannerTitle")}</p>
          <p className="text-sm text-secondary">{t("onboarding.bannerDescription")}</p>
          <p className="mt-1 text-xs text-muted">
            {t("onboarding.stepOf", {
              current: stepNumber,
              total: ONBOARDING_STEPS.length,
            })}
          </p>
        </div>
      </div>
      <div className="flex shrink-0 items-center justify-end gap-2">
        <Link
          href="/onboarding"
          className="inline-flex items-center justify-center rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover transition-colors"
        >
          {t("onboarding.bannerResume")}
        </Link>
        <button
          type="button"
          onClick={() => void dismissBanner.mutate("dismissBanner")}
          disabled={dismissBanner.isPending}
          aria-label={t("onboarding.bannerDismiss")}
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-default bg-surface-elevated text-secondary transition-colors hover:bg-surface-muted hover:text-primary disabled:opacity-60"
        >
          <X className="h-4 w-4" strokeWidth={2.25} />
        </button>
      </div>
    </div>
  );
}
