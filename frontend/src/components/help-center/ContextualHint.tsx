"use client";

import type { ReactNode } from "react";
import { X } from "lucide-react";
import { useHelpCenter } from "@/components/help-center/HelpCenterProvider";
import { useT } from "@/i18n/context";
import { cn } from "@/lib/utils";

type ContextualHintProps = {
  hintId: string;
  content: string;
  children: ReactNode;
  className?: string;
};

export function ContextualHint({ hintId, content, children, className }: ContextualHintProps) {
  const t = useT();
  const { isHintDismissed, dismissHint } = useHelpCenter();

  if (isHintDismissed(hintId)) {
    return <>{children}</>;
  }

  return (
    <span className={cn("relative inline-flex", className)}>
      {children}
      <span
        className="absolute left-0 top-full z-30 mt-2 w-64 rounded-xl border border-accent/30 bg-surface-elevated p-3 shadow-lg"
        role="status"
      >
        <p className="pr-6 text-xs leading-relaxed text-primary">{content}</p>
        <button
          type="button"
          onClick={() => dismissHint(hintId)}
          className="absolute right-2 top-2 rounded p-0.5 text-muted hover:text-primary"
          aria-label={t("helpCenter.close")}
        >
          <X className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={() => dismissHint(hintId)}
          className="mt-2 text-xs font-medium text-accent hover:underline"
        >
          {t("helpCenter.hints.gotIt")}
        </button>
      </span>
    </span>
  );
}
