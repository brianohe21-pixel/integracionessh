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
  iconTone: string;
  getValue: (metrics: SalesFunnelMetrics, locale: string) => string;
}> = [
  {
    key: "total",
    icon: Briefcase,
    iconTone: "text-accent bg-accent-muted",
    getValue: (m) => String(m.total),
  },
  {
    key: "pipelineValue",
    icon: CircleDollarSign,
    iconTone: "text-info bg-info/15",
    getValue: (m, locale) => formatSalesMoney(m.totalValue, "USD", locale),
  },
  {
    key: "wonValue",
    icon: Trophy,
    iconTone: "text-success bg-success/15",
    getValue: (m, locale) => formatSalesMoney(m.wonValue, "USD", locale),
  },
  {
    key: "forecast",
    icon: Target,
    iconTone: "text-warning bg-warning/15",
    getValue: (m, locale) => formatSalesMoney(m.forecastValue, "USD", locale),
  },
  {
    key: "conversion",
    icon: Percent,
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
          <div key={item.key} className="content-card group relative overflow-hidden">
            <div className="section-header py-3">
              <p className="section-header-title text-[11px] uppercase tracking-[0.06em]">
                {labels[item.key]}
              </p>
            </div>
            <div className="card-body">
              <div className="flex items-start justify-between gap-3">
                <p className="truncate text-xl font-bold tracking-tight text-primary sm:text-2xl">
                  {item.getValue(metrics, locale)}
                </p>
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
          </div>
        );
      })}
    </div>
  );
}
