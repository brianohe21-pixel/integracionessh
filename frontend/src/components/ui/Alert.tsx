import { cn } from "@/lib/utils";
import { AlertCircle, CheckCircle2, Info, AlertTriangle, X } from "lucide-react";
import type { ReactNode } from "react";

type AlertVariant = "success" | "warning" | "danger" | "info";

interface AlertProps {
  variant?: AlertVariant;
  title?: string;
  children: ReactNode;
  onDismiss?: () => void;
  className?: string;
}

const variantStyles: Record<AlertVariant, string> = {
  success: "bg-[var(--alert-success-bg)] border-[var(--alert-success-border)] text-success",
  warning: "bg-[var(--alert-warning-bg)] border-[var(--alert-warning-border)] text-warning",
  danger: "bg-[var(--alert-danger-bg)] border-[var(--alert-danger-border)] text-danger",
  info: "bg-[var(--alert-info-bg)] border-[var(--alert-info-border)] text-info",
};

const icons: Record<AlertVariant, ReactNode> = {
  success: <CheckCircle2 className="h-4 w-4 shrink-0" />,
  warning: <AlertTriangle className="h-4 w-4 shrink-0" />,
  danger: <AlertCircle className="h-4 w-4 shrink-0" />,
  info: <Info className="h-4 w-4 shrink-0" />,
};

export function Alert({ variant = "info", title, children, onDismiss, className }: AlertProps) {
  return (
    <div
      role="alert"
      className={cn(
        "flex gap-3 rounded-xl border p-4",
        variantStyles[variant],
        className
      )}
    >
      <div className="mt-0.5">{icons[variant]}</div>
      <div className="min-w-0 flex-1">
        {title && <p className="mb-0.5 text-sm font-semibold">{title}</p>}
        <div className="text-sm opacity-90">{children}</div>
      </div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="shrink-0 rounded-md p-0.5 opacity-60 transition-opacity hover:opacity-100"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
