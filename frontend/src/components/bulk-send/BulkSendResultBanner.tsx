"use client";

import { CheckCircle2, X, XCircle } from "lucide-react";
import { BulkJobFailures } from "@/components/bulk-send/BulkJobFailures";
import { useT } from "@/i18n/context";

interface BulkSendResultBannerProps {
  sent: number;
  failed: number;
  deliveryFailed: number;
  jobId: string;
  templateName?: string;
  onDismiss: () => void;
}

export function BulkSendResultBanner({
  sent,
  failed,
  deliveryFailed,
  jobId,
  templateName,
  onDismiss,
}: BulkSendResultBannerProps) {
  const t = useT();
  const hasFailures = failed > 0 || deliveryFailed > 0;

  return (
    <div
      className={`mb-6 rounded-xl border p-5 space-y-4 ${
        hasFailures
          ? "border-amber-200 bg-amber-50"
          : "border-green-200 bg-green-50"
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2 min-w-0">
          <p
            className={`text-sm font-semibold ${
              hasFailures ? "text-amber-900" : "text-green-900"
            }`}
          >
            {hasFailures ? t("bulkSend.resultWithFailuresTitle") : t("bulkSend.resultCompletedTitle")}
          </p>
          <div className="flex flex-wrap items-center gap-4">
            <div className={`flex items-center gap-2 ${hasFailures ? "text-green-800" : "text-green-700"}`}>
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span className="text-sm font-medium">{t("bulkSend.acceptedMeta", { count: sent })}</span>
            </div>
            {failed > 0 && (
              <div className="flex items-center gap-2 text-red-700">
                <XCircle className="w-4 h-4 shrink-0" />
                <span className="text-sm font-medium">{t("bulkSend.rejectedMeta", { count: failed })}</span>
              </div>
            )}
            {deliveryFailed > 0 && (
              <div className="flex items-center gap-2 text-orange-700">
                <XCircle className="w-4 h-4 shrink-0" />
                <span className="text-sm font-medium">{t("bulkSend.deliveryFailed", { count: deliveryFailed })}</span>
              </div>
            )}
          </div>
          {hasFailures && (
            <p className="text-sm text-amber-800">{t("bulkSend.resultWithFailuresHint")}</p>
          )}
          <p className="text-xs text-secondary">{t("bulkSend.resultHint")}</p>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          className="shrink-0 p-1 rounded-lg text-muted hover:text-secondary hover:bg-surface-elevated/60 transition-colors"
          aria-label={t("bulkSend.dismissResult")}
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {hasFailures && (
        <div className="rounded-lg border border-amber-200 bg-surface-elevated overflow-hidden">
          <BulkJobFailures jobId={jobId} templateName={templateName} />
        </div>
      )}
    </div>
  );
}
