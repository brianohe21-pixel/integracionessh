"use client";

import { useT } from "@/i18n/context";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

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

  const messageKey =
    action === "resume" ? "campaigns.qualityConfirmResume" : "campaigns.qualityConfirmStart";

  return (
    <ConfirmDialog
      open={open}
      title={t("campaigns.qualityWarnTitle")}
      description={t(messageKey)}
      confirmLabel={action === "resume" ? t("campaigns.resume") : t("campaigns.start")}
      tone="warning"
      onCancel={onCancel}
      onConfirm={onConfirm}
    />
  );
}
