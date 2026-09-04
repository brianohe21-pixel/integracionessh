"use client";

import { ShieldAlert, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { useFormatters } from "@/hooks/useFormatters";
import { useClearWhatsAppEnforcement } from "@/hooks/useWhatsAppChannels";
import { useAdminRole } from "@/hooks/useAdminRole";
import { useT } from "@/i18n/context";
import { useDialog } from "@/components/ui/DialogProvider";
import type { WhatsAppChannel } from "@/types";

export function isChannelMessagingBlocked(channel: WhatsAppChannel): boolean {
  return Boolean(channel.messagingEnforcement?.blocked);
}

export function countBlockedWhatsAppChannels(channels: WhatsAppChannel[]): number {
  return channels.filter(isChannelMessagingBlocked).length;
}

function enforcementReasonLabel(
  reason: string | undefined,
  t: ReturnType<typeof useT>
): string {
  if (!reason) return t("whatsapp.enforcement.reasonUnknown");
  const key = `whatsapp.enforcement.reason_${reason}` as Parameters<typeof t>[0];
  const translated = t(key);
  if (translated !== key) return translated;
  return reason;
}

interface WhatsAppEnforcementPanelProps {
  botId: string;
  channel: WhatsAppChannel;
  compact?: boolean;
}

export function WhatsAppEnforcementPanel({
  botId,
  channel,
  compact = false,
}: WhatsAppEnforcementPanelProps) {
  const t = useT();
  const { formatDate } = useFormatters();
  const { confirm, alert } = useDialog();
  const { isAdmin, loading: adminLoading } = useAdminRole();
  const clearEnforcement = useClearWhatsAppEnforcement(botId);

  const enforcement = channel.messagingEnforcement;
  const snapshot = channel.qualitySnapshot;
  const blocked = isChannelMessagingBlocked(channel);

  if (!blocked && !snapshot) return null;

  if (!blocked && snapshot && snapshot.risk !== "block" && snapshot.risk !== "warn") {
    return null;
  }

  async function handleClear() {
    const confirmed = await confirm({
      title: t("whatsapp.enforcement.adminClearConfirmTitle"),
      description: t("whatsapp.enforcement.adminClearConfirmDescription"),
      confirmLabel: t("whatsapp.enforcement.adminClearButton"),
      tone: "warning",
    });
    if (!confirmed) return;

    try {
      await clearEnforcement.mutateAsync(channel.channelId);
      await alert({
        title: t("whatsapp.enforcement.adminClearSuccess"),
        message: t("whatsapp.enforcement.adminClearSuccessBody"),
        tone: "success",
      });
    } catch (err) {
      await alert({
        title: t("whatsapp.enforcement.adminClearError"),
        message: (err as Error).message ?? t("whatsapp.enforcement.adminClearErrorBody"),
        tone: "danger",
      });
    }
  }

  const canClearMetaBlock =
    !adminLoading &&
    isAdmin &&
    blocked &&
    enforcement?.source === "meta_auto";

  return (
    <div
      className={
        blocked
          ? "mt-3 space-y-2 rounded-lg border border-danger/25 bg-danger/5 p-3"
          : "mt-3 space-y-1 rounded-lg border border-warning/20 bg-warning/5 p-3"
      }
    >
      {blocked ? (
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="flex items-start gap-2">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-danger" />
            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold text-primary">
                  {t("whatsapp.enforcement.blockedTitle")}
                </p>
                <Badge variant="danger" dot>
                  {t("whatsapp.enforcement.blockedBadge")}
                </Badge>
              </div>
              {!compact ? (
                <p className="text-xs text-secondary">{t("whatsapp.enforcement.blockedDescription")}</p>
              ) : null}
              {enforcement?.reason ? (
                <p className="text-xs text-secondary">
                  {t("whatsapp.enforcement.reason", {
                    reason: enforcementReasonLabel(enforcement.reason, t),
                  })}
                </p>
              ) : null}
              {enforcement?.source === "meta_auto" ? (
                <p className="text-xs text-secondary">{t("whatsapp.enforcement.sourceMeta")}</p>
              ) : enforcement?.source === "platform_admin" ? (
                <p className="text-xs text-secondary">{t("whatsapp.enforcement.sourceAdmin")}</p>
              ) : null}
              {enforcement?.blockedAt ? (
                <p className="text-xs text-secondary">
                  {t("whatsapp.enforcement.blockedAt", {
                    date: formatDate(enforcement.blockedAt),
                  })}
                </p>
              ) : null}
            </div>
          </div>
          {canClearMetaBlock ? (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={clearEnforcement.isPending}
              onClick={() => void handleClear()}
            >
              {clearEnforcement.isPending
                ? t("whatsapp.enforcement.adminClearing")
                : t("whatsapp.enforcement.adminClearButton")}
            </Button>
          ) : null}
        </div>
      ) : null}

      {snapshot && (snapshot.risk === "warn" || snapshot.risk === "block") ? (
        <p className="text-xs text-secondary">
          {t("whatsapp.enforcement.qualitySnapshot", {
            rating: snapshot.qualityRating,
            status: snapshot.phoneStatus,
          })}
        </p>
      ) : null}

      {blocked && !canClearMetaBlock && !isAdmin && !adminLoading ? (
        <p className="text-xs text-secondary">{t("whatsapp.enforcement.resellerHint")}</p>
      ) : null}

      {blocked && isAdmin && enforcement?.source !== "meta_auto" && !adminLoading ? (
        <p className="flex items-center gap-1 text-xs text-secondary">
          <ShieldCheck className="h-3.5 w-3.5" />
          {t("whatsapp.enforcement.adminNonMetaHint")}
        </p>
      ) : null}
    </div>
  );
}
