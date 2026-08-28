"use client";

import type { ReactNode } from "react";
import { AlertCircle, AlertTriangle, CheckCircle2, Info } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { useT } from "@/i18n/context";
import { cn } from "@/lib/utils";

export type AlertDialogTone = "default" | "success" | "warning" | "danger" | "info";

interface AlertDialogProps {
  open: boolean;
  title?: string;
  description: ReactNode;
  confirmLabel?: string;
  tone?: AlertDialogTone;
  onClose: () => void;
}

const toneStyles: Record<
  AlertDialogTone,
  { border: string; iconBg: string; icon: string; Icon: typeof Info }
> = {
  default: {
    border: "border-default",
    iconBg: "bg-accent-muted",
    icon: "text-accent",
    Icon: Info,
  },
  success: {
    border: "border-[var(--alert-success-border)]",
    iconBg: "bg-[var(--alert-success-bg)]",
    icon: "text-success",
    Icon: CheckCircle2,
  },
  info: {
    border: "border-[var(--alert-info-border)]",
    iconBg: "bg-[var(--alert-info-bg)]",
    icon: "text-info",
    Icon: Info,
  },
  warning: {
    border: "border-[var(--alert-warning-border)]",
    iconBg: "bg-[var(--alert-warning-bg)]",
    icon: "text-warning",
    Icon: AlertTriangle,
  },
  danger: {
    border: "border-[var(--alert-danger-border)]",
    iconBg: "bg-[var(--alert-danger-bg)]",
    icon: "text-danger",
    Icon: AlertCircle,
  },
};

export function AlertDialog({
  open,
  title,
  description,
  confirmLabel,
  tone = "default",
  onClose,
}: AlertDialogProps) {
  const t = useT();
  const styles = toneStyles[tone];
  const Icon = styles.Icon;

  if (!open) return null;

  return (
    <Modal className="p-4">
      <div
        className={cn(
          "w-full max-w-md rounded-2xl border bg-surface-elevated shadow-xl",
          styles.border
        )}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="alert-dialog-title"
      >
        <div className="flex items-start gap-3 px-6 py-5">
          <div className={cn("flex-shrink-0 rounded-xl p-2", styles.iconBg)}>
            <Icon className={cn("h-5 w-5", styles.icon)} />
          </div>
          <div className="min-w-0 space-y-2">
            <h2 id="alert-dialog-title" className="text-lg font-semibold text-primary">
              {title ?? t("common.notice")}
            </h2>
            <p className="text-sm leading-relaxed text-secondary">{description}</p>
          </div>
        </div>
        <div className="flex items-center justify-end border-t border-default px-6 py-4">
          <Button type="button" variant="primary" onClick={onClose}>
            {confirmLabel ?? t("common.ok")}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
