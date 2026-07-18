"use client";

import { useCallback, useMemo } from "react";
import { useT } from "@/i18n/context";
import { useBot } from "@/hooks/useBots";
import {
  assessWhatsAppQuality,
  type WhatsAppQualityAssessment,
} from "@/lib/whatsapp-quality";
import type { WhatsAppPhoneInfo } from "@/types";

export function useWhatsAppQualityGuard(botId?: string) {
  const t = useT();
  const { data: bot, isLoading, isFetching, refetch } = useBot(botId ?? "");

  const phone = bot?.whatsappPhone;
  const assessment = useMemo(() => assessWhatsAppQuality(phone), [phone]);

  const confirmStart = useCallback(
    async (action: "start" | "resume" = "start"): Promise<boolean> => {
      const latest = await refetch();
      const latestPhone = latest.data?.whatsappPhone;
      const latestAssessment = assessWhatsAppQuality(latestPhone);

      if (latestAssessment.risk === "block") {
        return false;
      }

      if (latestAssessment.risk === "warn") {
        const key =
          action === "resume"
            ? "campaigns.qualityConfirmResume"
            : "campaigns.qualityConfirmStart";
        return window.confirm(t(key));
      }

      return true;
    },
    [refetch, t]
  );

  return {
    assessment,
    phone: phone as WhatsAppPhoneInfo | null | undefined,
    isLoading: isLoading || isFetching,
    confirmStart,
    refetch,
  };
}

export type { WhatsAppQualityAssessment };
