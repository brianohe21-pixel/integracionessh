"use client";

import { useT } from "@/i18n/context";
import type { Campaign } from "@/types";

interface CampaignFunnelChartProps {
  campaign: Campaign;
}

interface FunnelStep {
  labelKey: string;
  value: number;
  color: string;
  bg: string;
}

export function CampaignFunnelChart({ campaign }: CampaignFunnelChartProps) {
  const t = useT();
  const { total, sent, deliveredCount, readCount } = campaign;

  const steps: FunnelStep[] = [
    {
      labelKey: "campaigns.analytics.total",
      value: total,
      color: "text-secondary",
      bg: "bg-surface-muted",
    },
    {
      labelKey: "campaigns.analytics.sent",
      value: sent,
      color: "text-blue-700",
      bg: "bg-blue-100",
    },
    {
      labelKey: "campaigns.analytics.delivered",
      value: deliveredCount,
      color: "text-green-700",
      bg: "bg-green-100",
    },
    {
      labelKey: "campaigns.analytics.read",
      value: readCount,
      color: "text-accent",
      bg: "bg-accent-muted",
    },
  ];

  const maxValue = total || 1;

  return (
    <div className="space-y-2">
      {steps.map((step) => {
        const pct = Math.round((step.value / maxValue) * 100);
        return (
          <div key={step.labelKey} className="space-y-1">
            <div className="flex items-center justify-between text-sm">
              <span className={`font-medium ${step.color}`}>{t(step.labelKey)}</span>
              <span className="font-semibold tabular-nums">
                {step.value.toLocaleString()}
                <span className="text-xs text-muted ml-1">({pct}%)</span>
              </span>
            </div>
            <div className="h-3 rounded-full bg-surface-muted overflow-hidden">
              <div
                className={`h-full ${step.bg.replace("100", "400")} rounded-full transition-all duration-500`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
