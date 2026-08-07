"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useT } from "@/i18n/context";
import { SkeletonCard } from "@/components/ui/Skeleton";
import { Alert } from "@/components/ui/Alert";
import { cn } from "@/lib/utils";

interface DashboardWidgetCardProps {
  title: string;
  subtitle?: string;
  detailHref?: string;
  detailLabel?: string;
  isLoading?: boolean;
  error?: Error | null;
  isEmpty?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyIcon?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}

export function DashboardWidgetCard({
  title,
  subtitle,
  detailHref,
  detailLabel,
  isLoading,
  error,
  isEmpty,
  emptyTitle,
  emptyDescription,
  emptyIcon,
  className,
  children,
}: DashboardWidgetCardProps) {
  const t = useT();

  return (
    <div className={cn("content-card overflow-hidden", className)}>
      <div className="section-header sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="section-header-title">{title}</h2>
          {subtitle ? <p className="section-header-subtitle">{subtitle}</p> : null}
        </div>
        {detailHref ? (
          <Link
            href={detailHref}
            className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-accent hover:underline"
          >
            {detailLabel ?? t("dashboard.viewDetail")}
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        ) : null}
      </div>
      <div className="p-4 sm:p-6">
        {isLoading ? (
          <SkeletonCard lines={4} className="border-0 p-0 shadow-none" />
        ) : error ? (
          <Alert variant="danger" title={t("dashboard.loadError")}>
            <p className="text-xs opacity-80 break-words">{error.message}</p>
          </Alert>
        ) : isEmpty ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            {emptyIcon ? (
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-accent-muted text-accent">
                {emptyIcon}
              </div>
            ) : null}
            <p className="text-sm font-medium text-primary">{emptyTitle ?? t("dashboard.emptyTitle")}</p>
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
