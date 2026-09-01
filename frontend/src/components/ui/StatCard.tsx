import { cn } from "@/lib/utils";
import { CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
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
    <div className={cn("content-card group overflow-hidden", className)}>
      <CardHeader className={compact ? "py-2" : "py-3"}>
        <CardTitle as="p" className="text-[11px] uppercase tracking-[0.08em]">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent className={compact ? "pb-3 pt-0" : undefined}>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p
              className={cn(
                "font-bold tracking-tight text-primary",
                compact ? "text-xl" : "text-2xl sm:text-[1.75rem]"
              )}
            >
              {value}
            </p>
            {sub && (
              <p className={cn("text-muted", compact ? "mt-0.5 text-[11px]" : "mt-1.5 text-xs leading-relaxed")}>
                {sub}
              </p>
            )}
            {trend && (
              <p
                className={cn(
                  "mt-2 text-xs font-medium",
                  trend.positive ? "text-success" : "text-danger"
                )}
              >
                {trend.value}
              </p>
            )}
          </div>
          {icon && (
            <div
              className={cn(
                "icon-badge shrink-0 transition-transform duration-200 group-hover:scale-105",
                compact ? "h-9 w-9" : "h-11 w-11"
              )}
            >
              {icon}
            </div>
          )}
        </div>
      </CardContent>
    </div>
  );
}
