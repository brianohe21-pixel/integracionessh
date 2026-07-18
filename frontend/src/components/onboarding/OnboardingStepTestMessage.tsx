"use client";

import { useBot } from "@/hooks/useBots";
import { useT } from "@/i18n/context";
import { whatsAppMeLink } from "@/lib/onboarding";
import { Button } from "@/components/ui/Button";
import { MessageCircle } from "lucide-react";

interface OnboardingStepTestMessageProps {
  botId: string;
  onConfirm: () => void;
  confirming: boolean;
}

export function OnboardingStepTestMessage({
  botId,
  onConfirm,
  confirming,
}: OnboardingStepTestMessageProps) {
  const t = useT();
  const { data: bot, isLoading } = useBot(botId);
  const displayPhone = bot?.whatsappPhone?.displayPhoneNumber;
  const waLink = displayPhone ? whatsAppMeLink(displayPhone) : null;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-primary">{t("onboarding.testMessage.title")}</h2>
        <p className="mt-1 text-sm text-secondary">{t("onboarding.testMessage.description")}</p>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted">{t("common.loading")}</p>
      ) : displayPhone ? (
        <div className="rounded-xl border border-default bg-surface-muted p-4 text-center">
          <p className="text-2xl font-semibold text-primary tracking-wide">{displayPhone}</p>
          {waLink && (
            <a
              href={waLink}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-accent hover:underline"
            >
              <MessageCircle className="h-4 w-4" />
              {t("onboarding.testMessage.openWhatsApp")}
            </a>
          )}
        </div>
      ) : (
        <p className="text-sm text-muted">{t("onboarding.testMessage.noPhone")}</p>
      )}

      <Button onClick={onConfirm} disabled={confirming} className="w-full">
        {confirming ? t("onboarding.testMessage.confirming") : t("onboarding.testMessage.confirm")}
      </Button>
    </div>
  );
}
