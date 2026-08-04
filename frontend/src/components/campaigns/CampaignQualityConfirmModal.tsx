"use client";

import { AlertTriangle } from "lucide-react";
import { useT } from "@/i18n/context";
import { Button } from "@/components/ui/Button";

interface CampaignQualityConfirmModalProps {
  open: boolean;
  action: "start" | "resume";
  onConfirm: () => void;
  onCancel: () => void;
}

export function CampaignQualityConfirmModal({
  open,
  action,
  onConfirm,
  onCancel,
}: CampaignQualityConfirmModalProps) {
  const t = useT();

  if (!open) return null;

  const messageKey =
    action === "resume" ? "campaigns.qualityConfirmResume" : "campaigns.qualityConfirmStart";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl border border-amber-200 bg-surface-elevated shadow-xl">
        <div className="flex items-start gap-3 border-b border-default px-6 py-5">
          <div className="rounded-xl bg-amber-50 p-2">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
          </div>
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-primary">{t("campaigns.qualityWarnTitle")}</h2>
            <p className="mt-2 text-sm text-secondary">{t(messageKey)}</p>
          </div>
        </div>
        <div className="flex items-center justify-end gap-3 px-6 py-4">
          <Button type="button" variant="ghost" onClick={onCancel}>
            {t("common.cancel")}
          </Button>
          <Button type="button" onClick={onConfirm}>
            {action === "resume" ? t("campaigns.resume") : t("campaigns.start")}
          </Button>
        </div>
      </div>
    </div>
  );
}
