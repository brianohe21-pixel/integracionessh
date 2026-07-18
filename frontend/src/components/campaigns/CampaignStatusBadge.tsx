"use client";

import { cn } from "@/lib/utils";
import { useT } from "@/i18n/context";
import type { CampaignStatus } from "@/types";

const STATUS_STYLES: Record<CampaignStatus, string> = {
  draft: "bg-surface-muted text-secondary",
  scheduled: "bg-blue-100 text-blue-700",
  running: "bg-green-100 text-green-700",
  paused: "bg-yellow-100 text-yellow-700",
  completed: "bg-accent-muted text-accent",
  failed: "bg-red-100 text-red-700",
  cancelled: "bg-surface-muted text-secondary",
};

const DOT_STYLES: Record<CampaignStatus, string> = {
  draft: "bg-gray-400",
  scheduled: "bg-blue-500",
  running: "bg-green-500 animate-pulse",
  paused: "bg-yellow-500",
  completed: "bg-accent",
  failed: "bg-red-500",
  cancelled: "bg-gray-400",
};

interface CampaignStatusBadgeProps {
  status: CampaignStatus;
  className?: string;
}

export function CampaignStatusBadge({ status, className }: CampaignStatusBadgeProps) {
  const t = useT();
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium",
        STATUS_STYLES[status],
        className
      )}
    >
      <span className={cn("w-1.5 h-1.5 rounded-full", DOT_STYLES[status])} />
      {t(`campaigns.status.${status}`)}
    </span>
  );
}
