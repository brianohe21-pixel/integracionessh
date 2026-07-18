"use client";

import { AlertTriangle, Ban, Signal } from "lucide-react";
import { useT } from "@/i18n/context";
import {
  assessWhatsAppQuality,
  formatMessagingLimit,
  type WhatsAppQualityAssessment,
} from "@/lib/whatsapp-quality";
import type { WhatsAppPhoneInfo } from "@/types";

const QUALITY_LABEL_KEYS = {
  GREEN: "bots.qualityHigh",
  YELLOW: "bots.qualityMedium",
  RED: "bots.qualityLow",
  NA: "bots.qualityNa",
} as const;

interface CampaignQualityAlertProps {
  phone?: WhatsAppPhoneInfo | null;
  assessment?: WhatsAppQualityAssessment;
  isLoading?: boolean;
  className?: string;
}

export function CampaignQualityAlert({
  phone,
  assessment: assessmentProp,
  isLoading,
  className,
}: CampaignQualityAlertProps) {
  const t = useT();
  const assessment = assessmentProp ?? assessWhatsAppQuality(phone);

  if (isLoading) {
    return (
      <div className={`rounded-lg border border-default bg-surface px-4 py-3 text-sm text-secondary ${className ?? ""}`}>
        {t("campaigns.qualityLoading")}
      </div>
    );
  }

  if (assessment.risk === "ok" && phone) {
    return (
      <div className={`rounded-lg border border-green-200 bg-green-50 px-4 py-3 ${className ?? ""}`}>
        <div className="flex items-start gap-3">
          <Signal className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
          <div className="text-sm text-green-900 space-y-1">
            <p className="font-medium">{t("campaigns.qualityOkTitle")}</p>
            <p className="text-green-800">
              {t("campaigns.qualityOkBody", {
                rating: t(QUALITY_LABEL_KEYS[phone.qualityRating]),
                limit: formatMessagingLimit(phone.messagingLimit) ?? t("campaigns.qualityLimitUnknown"),
              })}
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (assessment.risk === "block") {
    const messageKey = assessment.blockReason
      ? (`campaigns.qualityBlock_${assessment.blockReason}` as const)
      : "campaigns.qualityBlock_generic";

    return (
      <div className={`rounded-lg border border-red-200 bg-red-50 px-4 py-3 ${className ?? ""}`}>
        <div className="flex items-start gap-3">
          <Ban className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
          <div className="text-sm text-red-900 space-y-1">
            <p className="font-medium">{t("campaigns.qualityBlockTitle")}</p>
            <p className="text-red-800">{t(messageKey)}</p>
            {phone?.qualityRating && (
              <p className="text-xs text-red-700">
                {t("campaigns.qualityCurrentRating", {
                  rating: t(QUALITY_LABEL_KEYS[phone.qualityRating]),
                  status: phone.status,
                })}
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  const warnKey = assessment.warnReason
    ? (`campaigns.qualityWarn_${assessment.warnReason}` as const)
    : "campaigns.qualityWarn_generic";

  return (
    <div className={`rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 ${className ?? ""}`}>
      <div className="flex items-start gap-3">
        <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
        <div className="text-sm text-amber-900 space-y-1">
          <p className="font-medium">{t("campaigns.qualityWarnTitle")}</p>
          <p className="text-amber-800">{t(warnKey)}</p>
          {phone?.qualityRating && phone.qualityRating !== "NA" && (
            <p className="text-xs text-amber-700">
              {t("campaigns.qualityCurrentRating", {
                rating: t(QUALITY_LABEL_KEYS[phone.qualityRating]),
                status: phone.status,
              })}
            </p>
          )}
          {phone?.messagingLimit && (
            <p className="text-xs text-amber-700">
              {t("campaigns.qualityMessagingLimit", {
                limit: formatMessagingLimit(phone.messagingLimit) ?? phone.messagingLimit,
              })}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
