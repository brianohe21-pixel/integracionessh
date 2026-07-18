"use client";

import { EmbeddedSignupLauncher } from "@/components/whatsapp/EmbeddedSignupLauncher";
import { useT } from "@/i18n/context";
import { CheckCircle } from "lucide-react";

interface OnboardingStepWhatsAppProps {
  connected: boolean;
  onConnected: (data: {
    phoneNumberId: string;
    whatsappBusinessAccountId: string;
  }) => void;
}

export function OnboardingStepWhatsApp({
  connected,
  onConnected,
}: OnboardingStepWhatsAppProps) {
  const t = useT();

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-primary">{t("onboarding.whatsapp.title")}</h2>
        <p className="mt-1 text-sm text-secondary">{t("onboarding.whatsapp.description")}</p>
      </div>

      {connected ? (
        <div className="flex items-center gap-3 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          <CheckCircle className="h-5 w-5 shrink-0" />
          {t("onboarding.whatsapp.connected")}
        </div>
      ) : (
        <EmbeddedSignupLauncher onConnected={onConnected} />
      )}
    </div>
  );
}
