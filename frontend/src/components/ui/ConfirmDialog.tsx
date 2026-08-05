"use client";

import type { ReactNode } from "react";
import { AlertTriangle, Info } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { useT } from "@/i18n/context";
import { cn } from "@/lib/utils";

type ConfirmDialogTone = "default" | "danger" | "warning";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  tone?: ConfirmDialogTone;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

const toneStyles: Record<
  ConfirmDialogTone,
  { border: string; iconBg: string; icon: string; Icon: typeof Info }
> = {
  default: {
    border: "border-default",
    iconBg: "bg-accent-muted",
    icon: "text-accent",
    Icon: Info,
  },
  warning: {
    border: "border-amber-200",
    iconBg: "bg-amber-50",
    icon: "text-amber-600",
    Icon: AlertTriangle,
  },
  danger: {
    border: "border-red-200",
    iconBg: "bg-red-50",
    icon: "text-red-600",
    Icon: AlertTriangle,
  },
};

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel,
  tone = "default",
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
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
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
      >
        <div className="flex items-start gap-3 px-6 py-5">
          <div className={cn("rounded-xl p-2 flex-shrink-0", styles.iconBg)}>
            <Icon className={cn("h-5 w-5", styles.icon)} />
          </div>
          <div className="min-w-0 space-y-2">
            <h2 id="confirm-dialog-title" className="text-lg font-semibold text-primary">
              {title}
            </h2>
            <p className="text-sm text-secondary leading-relaxed">{description}</p>
          </div>
        </div>
        <div className="flex items-center justify-end gap-3 border-t border-default px-6 py-4">
          <Button type="button" variant="ghost" onClick={onCancel} disabled={loading}>
            {cancelLabel ?? t("common.cancel")}
          </Button>
          <Button
            type="button"
            variant={tone === "danger" ? "danger" : "primary"}
            onClick={onConfirm}
            disabled={loading}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
