"use client";

import { useCallback, useMemo, useState } from "react";
import { useBot } from "@/hooks/useBots";
import {
  assessWhatsAppQuality,
  type WhatsAppQualityAssessment,
} from "@/lib/whatsapp-quality";
import type { WhatsAppPhoneInfo } from "@/types";

type QualityConfirmAction = "start" | "resume";

interface PendingQualityConfirm {
  action: QualityConfirmAction;
  resolve: (confirmed: boolean) => void;
}

const OK_ASSESSMENT: WhatsAppQualityAssessment = {
  risk: "ok",
  qualityRating: null,
  phoneStatus: null,
};

export function useWhatsAppQualityGuard(botId?: string, enabled = true) {
  const isEnabled = enabled && Boolean(botId);
  const { data: bot, isLoading, isFetching, refetch } = useBot(botId ?? "");

  const phone = isEnabled ? bot?.whatsappPhone : undefined;
  const assessment = useMemo(
    () => (isEnabled ? assessWhatsAppQuality(phone) : OK_ASSESSMENT),
    [isEnabled, phone]
  );

  const [pendingConfirm, setPendingConfirm] = useState<PendingQualityConfirm | null>(null);

  const confirmStart = useCallback(
    async (action: QualityConfirmAction = "start"): Promise<boolean> => {
      if (!isEnabled) {
        return true;
      }

      const latest = await refetch();
      const latestPhone = latest.data?.whatsappPhone;
      const latestAssessment = assessWhatsAppQuality(latestPhone);

      if (latestAssessment.risk === "block") {
        return false;
      }

      if (latestAssessment.risk === "warn") {
        return new Promise<boolean>((resolve) => {
          setPendingConfirm({ action, resolve });
        });
      }

      return true;
    },
    [isEnabled, refetch]
  );

  const resolveQualityConfirm = useCallback((confirmed: boolean) => {
    setPendingConfirm((current) => {
      current?.resolve(confirmed);
      return null;
    });
  }, []);

  return {
    assessment,
    phone: phone as WhatsAppPhoneInfo | null | undefined,
    isLoading: isEnabled && (isLoading || isFetching),
    confirmStart,
    qualityConfirm: pendingConfirm,
    resolveQualityConfirm,
    refetch,
  };
}

export type { WhatsAppQualityAssessment };
