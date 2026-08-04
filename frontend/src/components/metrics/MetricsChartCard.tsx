"use client";

import { cn } from "@/lib/utils";
import { useT } from "@/i18n/context";

interface MetricsChartCardProps {
  title: string;
  subtitle?: string;
  className?: string;
  isEmpty?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyIcon?: React.ReactNode;
  children: React.ReactNode;
}

export function MetricsChartCard({
  title,
  subtitle,
  className,
  isEmpty,
  emptyTitle,
  emptyDescription,
  emptyIcon,
  children,
}: MetricsChartCardProps) {
  const t = useT();

  return (
    <div className={cn("content-card overflow-hidden", className)}>
      <div className="border-b border-subtle px-4 py-4 sm:px-6">
        <h3 className="text-sm font-semibold text-primary">{title}</h3>
        {subtitle ? <p className="mt-0.5 text-xs text-secondary">{subtitle}</p> : null}
      </div>
      <div className="p-4 sm:p-6">
        {isEmpty ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            {emptyIcon ? (
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-accent-muted text-accent">
                {emptyIcon}
              </div>
            ) : null}
            <p className="text-sm font-medium text-primary">
              {emptyTitle ?? t("metrics.chartsEmptyTitle")}
            </p>
            {emptyDescription ? (
              <p className="mt-1 max-w-xs text-xs text-secondary">{emptyDescription}</p>
            ) : null}
          </div>
        ) : (
          children
        )}
      </div>
    </div>
  );
}
