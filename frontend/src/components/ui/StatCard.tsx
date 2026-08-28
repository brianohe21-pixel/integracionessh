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
}

export function StatCard({ label, value, sub, icon, trend, className }: StatCardProps) {
  return (
    <div className={cn("content-card group overflow-hidden", className)}>
      <CardHeader className="py-3">
        <CardTitle as="p" className="text-[11px] uppercase tracking-[0.08em]">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-2xl font-bold tracking-tight text-primary sm:text-[1.75rem]">{value}</p>
            {sub && <p className="mt-1.5 text-xs leading-relaxed text-muted">{sub}</p>}
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
            <div className="icon-badge h-11 w-11 shrink-0 transition-transform duration-200 group-hover:scale-105">
              {icon}
            </div>
          )}
        </div>
      </CardContent>
    </div>
  );
}
