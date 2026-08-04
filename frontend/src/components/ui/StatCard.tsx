import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

interface StatCardProps {
  label: string;
  value: string;
  sub?: string;
  icon?: ReactNode;
  trend?: { value: string; positive?: boolean };
  className?: string;
}

export function StatCard({ label, value, sub, icon, trend, className }: StatCardProps) {
  return (
    <div className={cn("content-card p-5", className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wider text-secondary">{label}</p>
          <p className="mt-1.5 text-2xl font-bold tracking-tight text-primary">{value}</p>
          {sub && <p className="mt-1 text-xs text-muted">{sub}</p>}
          {trend && (
            <p
              className={cn(
                "mt-1.5 text-xs font-medium",
                trend.positive ? "text-success" : "text-danger"
              )}
            >
              {trend.value}
            </p>
          )}
        </div>
        {icon && (
          <div className="icon-badge h-11 w-11 shrink-0">
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}
