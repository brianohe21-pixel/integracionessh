import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type PageHeaderProps = {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  className?: string;
};

export function PageHeader({ title, subtitle, actions, className }: PageHeaderProps) {
  return (
    <div
      className={cn(
        "mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-start sm:justify-between",
        className
      )}
    >
      <div className="min-w-0 flex items-start gap-3">
        <div className="mt-1 hidden h-9 w-1 shrink-0 rounded-full bg-gradient-to-b from-accent to-brand-primary sm:block" />
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight text-primary sm:text-[1.75rem]">{title}</h1>
          {subtitle ? (
            <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-secondary">{subtitle}</p>
          ) : null}
        </div>
      </div>
      {actions ? (
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 sm:max-w-[50%] sm:pt-0.5">
          {actions}
        </div>
      ) : null}
    </div>
  );
}
