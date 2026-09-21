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
      title={t("helpCenter.openButton")}
      className={cn(
        "topbar-icon relative inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors",
        isOpen && "bg-white/15 text-white"
      )}
    >
      <CircleHelp className="h-4 w-4" />
      {pendingCount > 0 ? (
        <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[9px] font-semibold text-white">
          {pendingCount}
        </span>
      ) : null}
    </button>
  );
}
