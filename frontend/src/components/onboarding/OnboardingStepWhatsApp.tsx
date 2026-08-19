"use client";

import { useState } from "react";
import { EmbeddedSignupLauncher, type WhatsAppOnboardingMode } from "@/components/whatsapp/EmbeddedSignupLauncher";
import { useT } from "@/i18n/context";
import { CheckCircle } from "lucide-react";

interface OnboardingStepWhatsAppProps {
  connected: boolean;
  onConnected: (data: {
    phoneNumberId: string;
    whatsappBusinessAccountId: string;
    onboardingMode?: WhatsAppOnboardingMode;
    isOnBizApp?: boolean;
    platformType?: string;
  }) => void;
}

export function OnboardingStepWhatsApp({
  connected,
  onConnected,
}: OnboardingStepWhatsAppProps) {
  const t = useT();
  const [mode, setMode] = useState<WhatsAppOnboardingMode>("coexistence");

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-primary">{t("onboarding.whatsapp.title")}</h2>
        <p className="mt-1 text-sm text-secondary">{t("onboarding.whatsapp.description")}</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setMode("coexistence")}
          className={`rounded-full px-3 py-1.5 text-xs font-medium ${
            mode === "coexistence"
              ? "bg-accent text-white"
              : "bg-surface-muted text-secondary"
          }`}
        >
          {t("whatsapp.modeCoexistence")}
        </button>
        <button
          type="button"
          onClick={() => setMode("cloud_api")}
          className={`rounded-full px-3 py-1.5 text-xs font-medium ${
            mode === "cloud_api"
              ? "bg-accent text-white"
              : "bg-surface-muted text-secondary"
          }`}
        >
          {t("whatsapp.modeCloudApi")}
        </button>
      </div>

      {connected ? (
        <div className="flex items-center gap-3 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          <CheckCircle className="h-5 w-5 shrink-0" />
          {t("onboarding.whatsapp.connected")}
        </div>
      ) : (
        <EmbeddedSignupLauncher onboardingMode={mode} onConnected={onConnected} />
      )}
    </div>
  );
}
