"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Play,
  Pause,
  RotateCcw,
  X,
  Pencil,
  Trash2,
  RefreshCw,
  Copy,
} from "lucide-react";
import { useT } from "@/i18n/context";
import {
  useStartCampaign,
  usePauseCampaign,
  useResumeCampaign,
  useCancelCampaign,
  useArchiveCampaign,
  useRetryCampaign,
  useCloneCampaign,
} from "@/hooks/useCampaigns";
import { CampaignQualityConfirmModal } from "@/components/campaigns/CampaignQualityConfirmModal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useWhatsAppQualityGuard } from "@/hooks/useWhatsAppQualityGuard";
import type { Campaign } from "@/types";

type PendingConfirm = "archive" | "retry" | "clone" | "cancel";

interface CampaignManagementActionsProps {
  campaign: Campaign;
  variant?: "compact" | "detail";
  onArchived?: () => void;
  onCloned?: (campaignId: string) => void;
}

export function CampaignManagementActions({
  campaign,
  variant = "compact",
  onArchived,
  onCloned,
}: CampaignManagementActionsProps) {
  const t = useT();
  const router = useRouter();
  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirm | null>(null);
  const [actionError, setActionError] = useState("");
  const start = useStartCampaign();
  const pause = usePauseCampaign();
  const resume = useResumeCampaign();
  const cancel = useCancelCampaign();
  const archive = useArchiveCampaign();
  const retry = useRetryCampaign();
  const clone = useCloneCampaign();
  const isWhatsApp = (campaign.channel ?? "whatsapp") === "whatsapp";
  const { assessment, confirmStart, qualityConfirm, resolveQualityConfirm } = useWhatsAppQualityGuard(
    campaign.botId,
    isWhatsApp
  );

  const isPending =
    start.isPending ||
    pause.isPending ||
    resume.isPending ||
    cancel.isPending ||
    archive.isPending ||
    retry.isPending ||
    clone.isPending;
  const startBlocked = isWhatsApp && assessment.risk === "block";
  const canEdit = campaign.status === "draft" || campaign.status === "scheduled";
  const canRetry =
    campaign.failed > 0 &&
    (campaign.status === "completed" ||
      campaign.status === "paused" ||
      campaign.status === "failed" ||
      campaign.status === "cancelled");
  const canClone = campaign.status !== "running" && campaign.status !== "paused";
  const canArchive = campaign.status !== "running";

  const confirmLoading =
    (pendingConfirm === "archive" && archive.isPending) ||
    (pendingConfirm === "retry" && retry.isPending) ||
    (pendingConfirm === "clone" && clone.isPending) ||
    (pendingConfirm === "cancel" && cancel.isPending);

  function closeConfirm() {
    if (confirmLoading) return;
    setPendingConfirm(null);
    setActionError("");
  }

  async function handleStart() {
    if (startBlocked) {
      window.alert(t("campaigns.qualityStartBlocked"));
      return;
    }
    if (isWhatsApp) {
      const confirmed = await confirmStart("start");
      if (!confirmed) return;
    }
    start.mutate(campaign.campaignId);
  }

  async function handleResume() {
    if (startBlocked) {
      window.alert(t("campaigns.qualityStartBlocked"));
      return;
    }
    if (isWhatsApp) {
      const confirmed = await confirmStart("resume");
      if (!confirmed) return;
    }
    resume.mutate(campaign.campaignId);
  }

  async function handleConfirmAction() {
    if (!pendingConfirm) return;
    setActionError("");

    try {
      if (pendingConfirm === "archive") {
        await archive.mutateAsync(campaign.campaignId);
        setPendingConfirm(null);
        if (onArchived) {
          onArchived();
        } else {
          router.push("/campaigns");
        }
        return;
      }

      if (pendingConfirm === "retry") {
        await retry.mutateAsync(campaign.campaignId);
        setPendingConfirm(null);
        return;
      }

      if (pendingConfirm === "clone") {
        const cloned = await clone.mutateAsync(campaign.campaignId);
        setPendingConfirm(null);
        if (onCloned) {
          onCloned(cloned.campaignId);
        } else {
          router.push(`/campaigns/${cloned.campaignId}/edit`);
        }
        return;
      }

      if (pendingConfirm === "cancel") {
        await cancel.mutateAsync(campaign.campaignId);
        setPendingConfirm(null);
      }
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : pendingConfirm === "archive"
          ? t("campaigns.archiveError")
          : pendingConfirm === "retry"
          ? t("campaigns.retryError")
          : pendingConfirm === "clone"
          ? t("campaigns.cloneError")
          : t("campaigns.loadError");
      setActionError(message);
    }
  }

  const confirmConfig =
    pendingConfirm === "archive"
      ? {
          title: t("campaigns.archiveTitle"),
          description: t("campaigns.confirmArchive", { name: campaign.name }),
          confirmLabel: t("campaigns.archive"),
          tone: "danger" as const,
        }
      : pendingConfirm === "retry"
      ? {
          title: t("campaigns.retryFailed"),
          description: t("campaigns.confirmRetryFailed", { count: campaign.failed }),
          confirmLabel: t("campaigns.retryFailed"),
          tone: "warning" as const,
        }
      : pendingConfirm === "clone"
      ? {
          title: t("campaigns.clone"),
          description: t("campaigns.confirmClone", { name: campaign.name }),
          confirmLabel: t("campaigns.clone"),
          tone: "default" as const,
        }
      : pendingConfirm === "cancel"
      ? {
          title: t("campaigns.cancel"),
          description: t("campaigns.confirmCancel", { name: campaign.name }),
          confirmLabel: t("campaigns.cancel"),
          tone: "danger" as const,
        }
      : null;

  const buttonClass =
    variant === "compact"
      ? "p-1.5 rounded-lg disabled:opacity-40 transition-colors"
      : "inline-flex items-center gap-2 px-3 py-2 rounded-lg disabled:opacity-50 text-sm font-medium transition-colors";

  return (
    <>
      <div className={`flex items-center gap-1 ${variant === "detail" ? "flex-wrap" : ""}`}>
        {canEdit && (
          <Link
            href={`/campaigns/${campaign.campaignId}/edit`}
            title={t("campaigns.edit")}
            className={`${buttonClass} text-secondary hover:bg-surface-muted`}
          >
            <Pencil className="w-4 h-4" />
            {variant === "detail" && t("campaigns.edit")}
          </Link>
        )}
        {(campaign.status === "draft" || campaign.status === "scheduled") && (
          <button
            onClick={handleStart}
            disabled={isPending || startBlocked}
            title={startBlocked ? t("campaigns.qualityStartBlocked") : t("campaigns.start")}
            className={`${buttonClass} text-green-600 hover:bg-green-50`}
          >
            <Play className="w-4 h-4" />
            {variant === "detail" && t("campaigns.start")}
          </button>
        )}
        {campaign.status === "running" && (
          <button
            onClick={() => pause.mutate(campaign.campaignId)}
            disabled={isPending}
            title={t("campaigns.pause")}
            className={`${buttonClass} text-yellow-600 hover:bg-yellow-50`}
          >
            <Pause className="w-4 h-4" />
            {variant === "detail" && t("campaigns.pause")}
          </button>
        )}
        {campaign.status === "paused" && (
          <button
            onClick={handleResume}
            disabled={isPending || startBlocked}
            title={startBlocked ? t("campaigns.qualityStartBlocked") : t("campaigns.resume")}
            className={`${buttonClass} text-green-600 hover:bg-green-50`}
          >
            <RotateCcw className="w-4 h-4" />
            {variant === "detail" && t("campaigns.resume")}
          </button>
        )}
        {canRetry && (
          <button
            onClick={() => setPendingConfirm("retry")}
            disabled={isPending}
            title={t("campaigns.retryFailed")}
            className={`${buttonClass} text-blue-600 hover:bg-blue-50`}
          >
            <RefreshCw className="w-4 h-4" />
            {variant === "detail" && t("campaigns.retryFailed")}
          </button>
        )}
        {canClone && (
          <button
            onClick={() => setPendingConfirm("clone")}
            disabled={isPending}
            title={t("campaigns.clone")}
            className={`${buttonClass} text-secondary hover:bg-surface-muted`}
          >
            <Copy className="w-4 h-4" />
            {variant === "detail" && t("campaigns.clone")}
          </button>
        )}
        {campaign.status !== "completed" && campaign.status !== "cancelled" && (
          <button
            onClick={() => setPendingConfirm("cancel")}
            disabled={isPending}
            title={t("campaigns.cancel")}
            className={`${buttonClass} text-red-500 hover:bg-red-50`}
          >
            <X className="w-4 h-4" />
            {variant === "detail" && t("campaigns.cancel")}
          </button>
        )}
        {canArchive && (
          <button
            onClick={() => setPendingConfirm("archive")}
            disabled={isPending}
            title={t("campaigns.archiveTitle")}
            className={`${buttonClass} text-red-500 hover:bg-red-50`}
          >
            <Trash2 className="w-4 h-4" />
            {variant === "detail" && t("campaigns.archive")}
          </button>
        )}
      </div>

      {confirmConfig && (
        <ConfirmDialog
          open
          title={confirmConfig.title}
          description={
            actionError ? (
              <span className="space-y-2 block">
                <span>{confirmConfig.description}</span>
                <span className="block rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-red-700">
                  {actionError}
                </span>
              </span>
            ) : (
              confirmConfig.description
            )
          }
          confirmLabel={confirmConfig.confirmLabel}
          tone={confirmConfig.tone}
          loading={confirmLoading}
          onCancel={closeConfirm}
          onConfirm={handleConfirmAction}
        />
      )}

      <CampaignQualityConfirmModal
        open={Boolean(qualityConfirm)}
        action={qualityConfirm?.action ?? "start"}
        onCancel={() => resolveQualityConfirm(false)}
        onConfirm={() => resolveQualityConfirm(true)}
      />
    </>
  );
}
