"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardIconHeader } from "@/components/ui/Card";

type SettingsCardProps = {
  icon: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  badge?: ReactNode;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  footer?: ReactNode;
};

export function SettingsCard({
  icon,
  title,
  description,
  badge,
  children,
  className,
  contentClassName,
  footer,
}: SettingsCardProps) {
  return (
    <Card className={cn("overflow-hidden", className)}>
      <div className="border-b border-subtle">
        <CardIconHeader
          icon={icon}
          iconClassName="card-icon-header-icon-plain"
          title={title}
          description={description}
          actions={badge}
        />
      </div>
      <CardContent className={cn("space-y-4 !py-5", contentClassName)}>{children}</CardContent>
      {footer ? (
        <div className="border-t border-subtle bg-surface-muted/20 px-5 py-4 sm:px-6">{footer}</div>
      ) : null}
    </Card>
  );
}

export function SettingsCardSkeleton({ lines = 3 }: { lines?: number }) {
  return (
    <Card className="overflow-hidden animate-pulse">
      <div className="border-b border-subtle px-5 py-4 sm:px-6">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-surface-muted" />
          <div className="space-y-2">
            <div className="h-4 w-40 rounded bg-surface-muted" />
            <div className="h-3 w-56 rounded bg-surface-muted" />
          </div>
        </div>
      </div>
      <CardContent className="space-y-3 !py-5">
        {Array.from({ length: lines }, (_, index) => (
          <div key={index} className="h-10 rounded-lg bg-surface-muted" />
        ))}
      </CardContent>
    </Card>
  );
}

export function SettingsInfoGrid({ children }: { children: ReactNode }) {
  return <div className="grid gap-3 sm:grid-cols-2">{children}</div>;
}

export function SettingsInfoTile({
  label,
  value,
  className,
}: {
  label: ReactNode;
  value: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex min-h-[3.25rem] items-center justify-between gap-4 rounded-xl border border-subtle bg-surface px-4 py-3",
        className
      )}
    >
      <span className="text-sm text-secondary">{label}</span>
      <span className="text-right text-sm font-medium text-primary">{value}</span>
    </div>
  );
}

export function SettingsMetricRow({
  label,
  used,
  max,
}: {
  label: ReactNode;
  used: ReactNode;
  max: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border border-subtle bg-surface px-4 py-3">
      <span className="text-sm text-secondary">{label}</span>
      <span className="text-sm font-semibold tabular-nums text-primary">
        {used} <span className="font-normal text-muted">/ {max}</span>
      </span>
    </div>
  );
}

export function SettingsCallout({
  title,
  children,
  variant = "info",
}: {
  title?: ReactNode;
  children: ReactNode;
  variant?: "info" | "success" | "warning";
}) {
  return (
    <div
      className={cn(
        "rounded-xl border px-4 py-3 text-sm",
        variant === "info" && "border-accent/20 bg-accent/5 text-secondary",
        variant === "success" && "border-success/20 bg-success/5 text-secondary",
        variant === "warning" && "border-warning/20 bg-warning/5 text-secondary"
      )}
    >
      {title ? <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-primary">{title}</p> : null}
      {children}
    </div>
  );
}

export function SettingsToggleRow({
  label,
  hint,
  checked,
  onChange,
  disabled,
}: {
  label: ReactNode;
  hint?: ReactNode;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label className="flex items-start justify-between gap-4 rounded-xl border border-subtle bg-surface px-4 py-3">
      <span className="min-w-0">
        <span className="block text-sm font-medium text-primary">{label}</span>
        {hint ? <span className="mt-0.5 block text-xs text-muted">{hint}</span> : null}
      </span>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 shrink-0 rounded border-default text-accent focus:ring-accent disabled:opacity-50"
      />
    </label>
  );
}
