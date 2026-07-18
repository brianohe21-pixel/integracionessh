"use client";

import { useHelpCenter } from "@/components/help-center/HelpCenterProvider";
import { useOnboardingStatus } from "@/hooks/useOnboarding";
import { getPendingChecklistCount } from "@/lib/onboarding";
import { useT } from "@/i18n/context";
import { CircleHelp } from "lucide-react";
import { cn } from "@/lib/utils";

export function HelpCenterButton() {
  const t = useT();
  const { toggle, isOpen } = useHelpCenter();
  const { tenant, bots, whatsappStatus, flows, isLoading } = useOnboardingStatus();

  const hasEnabledFlow = flows.some((flow) => flow.enabled);
  const pendingCount = isLoading
    ? 0
    : getPendingChecklistCount({
        onboardingCompletedAt: tenant?.onboardingCompletedAt,
        onboardingTestConfirmedAt: tenant?.onboardingTestConfirmedAt,
        whatsappConnected: whatsappStatus?.connected ?? false,
        hasBot: bots.length > 0,
        hasEnabledFlow,
      });

  return (
    <button
      type="button"
      onClick={toggle}
      aria-expanded={isOpen}
      aria-label={t("helpCenter.openButton")}
      className={cn(
        "fixed bottom-5 right-5 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-accent text-white shadow-lg transition-colors hover:bg-accent-hover",
        "sm:bottom-6 sm:right-6"
      )}
    >
      <CircleHelp className="h-5 w-5" />
      {pendingCount > 0 ? (
        <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-semibold text-white">
          {pendingCount}
        </span>
      ) : null}
    </button>
  );
}
