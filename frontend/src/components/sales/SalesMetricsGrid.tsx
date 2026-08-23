"use client";

import {
  Briefcase,
  CircleDollarSign,
  Percent,
  Target,
  Trophy,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { SalesFunnelMetrics } from "@/types";
import { formatSalesMoney } from "./sales-ui";

interface SalesMetricsGridProps {
  metrics: SalesFunnelMetrics;
  locale: string;
  labels: {
    total: string;
    pipelineValue: string;
    wonValue: string;
    forecast: string;
    conversion: string;
  };
}

const METRIC_ITEMS: Array<{
  key: keyof SalesMetricsGridProps["labels"];
  icon: LucideIcon;
  tone: string;
  iconTone: string;
  getValue: (metrics: SalesFunnelMetrics, locale: string) => string;
}> = [
  {
    key: "total",
    icon: Briefcase,
    tone: "from-accent/12 to-surface-elevated",
    iconTone: "text-accent bg-accent-muted",
    getValue: (m) => String(m.total),
  },
  {
    key: "pipelineValue",
    icon: CircleDollarSign,
    tone: "from-info/10 to-surface-elevated",
    iconTone: "text-info bg-info/15",
    getValue: (m, locale) => formatSalesMoney(m.totalValue, "USD", locale),
  },
  {
    key: "wonValue",
    icon: Trophy,
    tone: "from-success/10 to-surface-elevated",
    iconTone: "text-success bg-success/15",
    getValue: (m, locale) => formatSalesMoney(m.wonValue, "USD", locale),
  },
  {
    key: "forecast",
    icon: Target,
    tone: "from-warning/10 to-surface-elevated",
    iconTone: "text-warning bg-warning/15",
    getValue: (m, locale) => formatSalesMoney(m.forecastValue, "USD", locale),
  },
  {
    key: "conversion",
    icon: Percent,
    tone: "from-human/10 to-surface-elevated",
    iconTone: "text-human bg-human/15",
    getValue: (m) => `${m.conversionRate}%`,
  },
];

export function SalesMetricsGrid({ metrics, locale, labels }: SalesMetricsGridProps) {
  return (
    <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-5">
      {METRIC_ITEMS.map((item) => {
        const Icon = item.icon;
        return (
          <div
            key={item.key}
            className={cn(
              "content-card group relative overflow-hidden p-4",
              "bg-gradient-to-br",
              item.tone
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-secondary">
                  {labels[item.key]}
                </p>
                <p className="mt-2 truncate text-xl font-bold tracking-tight text-primary sm:text-2xl">
                  {item.getValue(metrics, locale)}
                </p>
              </div>
              <div
                className={cn(
                  "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-transform duration-200 group-hover:scale-105",
                  item.iconTone
                )}
              >
                <Icon className="h-5 w-5" />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
