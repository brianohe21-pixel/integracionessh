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
        "relative inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-default bg-surface-elevated text-secondary shadow-sm transition-colors hover:bg-surface-muted hover:text-primary",
        isOpen && "bg-surface-muted text-primary"
      )}
    >
      <CircleHelp className="h-4 w-4" />
      {pendingCount > 0 ? (
        <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-semibold text-white">
          {pendingCount}
        </span>
      ) : null}
    </button>
  );
}
