import { cn } from "@/lib/utils";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import type { ReactNode } from "react";

interface StatCardProps {
  label: string;
  value: string;
  sub?: string;
  icon?: ReactNode;
  trend?: { value: string; positive?: boolean };
  className?: string;
  compact?: boolean;
}

export function StatCard({ label, value, sub, icon, trend, className, compact = false }: StatCardProps) {
  return (
    <div
      className={cn(
        "content-card group flex flex-col justify-between gap-4",
        compact ? "p-4" : "p-4 sm:p-5",
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="min-w-0 truncate text-[11px] font-semibold uppercase tracking-[0.08em] text-secondary">
          {label}
        </p>
        {icon && (
          <div
            className={cn(
              "stat-icon-badge flex shrink-0 items-center justify-center rounded-xl transition-transform duration-200 group-hover:scale-105",
              compact ? "h-9 w-9" : "h-11 w-11"
            )}
          >
            {icon}
          </div>
        )}
      </div>

      <div>
        <p
          className={cn(
            "font-bold tracking-tight text-primary",
            compact ? "text-xl" : "text-2xl sm:text-[1.75rem]"
          )}
        >
          {value}
        </p>
        {(trend || sub) && (
          <p
            className={cn(
              "mt-1.5 flex flex-wrap items-center gap-1 text-muted",
              compact ? "text-[11px]" : "text-xs"
            )}
          >
            {trend && (
              <span
                className={cn(
                  "inline-flex items-center gap-0.5 font-semibold",
                  trend.positive ? "text-success" : "text-danger"
                )}
              >
                {trend.positive ? (
                  <ArrowUpRight className="h-3 w-3" />
                ) : (
                  <ArrowDownRight className="h-3 w-3" />
                )}
                {trend.value}
              </span>
            )}
            {sub && <span className="truncate">{sub}</span>}
          </p>
        )}
      </div>
    </div>
  );
}
