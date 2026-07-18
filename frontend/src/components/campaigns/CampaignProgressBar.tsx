"use client";

import { cn } from "@/lib/utils";
import type { Campaign } from "@/types";

interface CampaignProgressBarProps {
  campaign: Campaign;
  className?: string;
}

export function CampaignProgressBar({ campaign, className }: CampaignProgressBarProps) {
  const { total, sent, failed, deliveryFailed } = campaign;
  if (total === 0) return null;

  const sentPct = Math.round((sent / total) * 100);
  const failedPct = Math.round((failed / total) * 100);
  const deliveryFailedPct = Math.round((deliveryFailed / total) * 100);
  const pendingPct = Math.max(0, 100 - sentPct - failedPct);

  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex h-2.5 rounded-full overflow-hidden bg-surface-muted gap-px">
        {sentPct > 0 && (
          <div
            className="bg-green-500 transition-all duration-300"
            style={{ width: `${sentPct}%` }}
          />
        )}
        {deliveryFailedPct > 0 && (
          <div
            className="bg-orange-400 transition-all duration-300"
            style={{ width: `${deliveryFailedPct}%` }}
          />
        )}
        {failedPct > 0 && (
          <div
            className="bg-red-500 transition-all duration-300"
            style={{ width: `${failedPct}%` }}
          />
        )}
        {pendingPct > 0 && (
          <div
            className="bg-gray-200 transition-all duration-300"
            style={{ width: `${pendingPct}%` }}
          />
        )}
      </div>

      <div className="flex items-center gap-3 text-xs text-secondary flex-wrap">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
          {sent}/{total}
        </span>
        {failed > 0 && (
          <span className="flex items-center gap-1 text-red-600">
            <span className="w-2 h-2 rounded-full bg-red-500 inline-block" />
            {failed}
          </span>
        )}
        {deliveryFailed > 0 && (
          <span className="flex items-center gap-1 text-orange-600">
            <span className="w-2 h-2 rounded-full bg-orange-400 inline-block" />
            {deliveryFailed}
          </span>
        )}
      </div>
    </div>
  );
}
