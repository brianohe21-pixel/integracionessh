"use client";

import Link from "next/link";
import { Check, Circle, CircleDot } from "lucide-react";
import { useHelpCenter } from "@/components/help-center/HelpCenterProvider";
import { useOnboardingStatus } from "@/hooks/useOnboarding";
import { getChecklistItems, ONBOARDING_STEPS } from "@/lib/onboarding";
import { useT } from "@/i18n/context";
import { cn } from "@/lib/utils";

export function SetupChecklist() {
  const t = useT();
  const { close } = useHelpCenter();
  const { tenant, bots, whatsappStatus, flows, isLoading } = useOnboardingStatus();

  if (isLoading) {
    return <div className="h-40 animate-pulse rounded-xl bg-surface-muted" />;
  }

  const hasEnabledFlow = flows.some((flow) => flow.enabled);
  const items = getChecklistItems({
    onboardingCompletedAt: tenant?.onboardingCompletedAt,
    onboardingTestConfirmedAt: tenant?.onboardingTestConfirmedAt,
    whatsappConnected: whatsappStatus?.connected ?? false,
    hasBot: bots.length > 0,
    hasEnabledFlow,
  });

  const completedCount = items.filter((item) => item.status === "complete").length;
  const isFullyComplete = Boolean(tenant?.onboardingCompletedAt);

  return (
    <div className="space-y-4">
      <div>
        <div className="mb-2 flex items-center justify-between text-xs text-secondary">
          <span>
            {isFullyComplete
              ? t("helpCenter.checklist.completeTitle")
              : t("helpCenter.checklist.progress", {
                  current: completedCount,
                  total: ONBOARDING_STEPS.length,
                })}
          </span>
          <span>{Math.round((completedCount / ONBOARDING_STEPS.length) * 100)}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-surface-muted">
          <div
            className="h-full rounded-full bg-accent transition-all"
            style={{ width: `${(completedCount / ONBOARDING_STEPS.length) * 100}%` }}
          />
        </div>
      </div>

      <ul className="space-y-2">
        {items.map((item) => (
          <li
            key={item.step}
            className={cn(
              "rounded-xl border p-3",
              item.status === "current"
                ? "border-accent/40 bg-accent-muted/30"
                : "border-default bg-surface"
            )}
          >
            <div className="flex items-start gap-3">
              <span className="mt-0.5 shrink-0">
                {item.status === "complete" ? (
                  <Check className="h-4 w-4 text-accent" />
                ) : item.status === "current" ? (
                  <CircleDot className="h-4 w-4 text-accent" />
                ) : (
                  <Circle className="h-4 w-4 text-muted" />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-primary">{t(item.labelKey)}</p>
                <p className="mt-0.5 text-xs text-secondary">{t(item.descriptionKey)}</p>
                {item.status !== "complete" ? (
                  <Link
                    href={item.href}
                    onClick={close}
                    className="mt-2 inline-flex text-xs font-medium text-accent hover:underline"
                  >
                    {t("helpCenter.checklist.continue")}
                  </Link>
                ) : null}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
