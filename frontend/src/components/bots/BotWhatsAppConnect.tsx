"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useUpdateBot } from "@/hooks/useBots";
import { useWhatsAppConnect } from "@/hooks/useWhatsAppConnect";
import { useT } from "@/i18n/context";
import { EmbeddedSignupLauncher } from "@/components/whatsapp/EmbeddedSignupLauncher";
import { Button } from "@/components/ui/Button";
import type { Bot } from "@/types";

interface BotWhatsAppConnectProps {
  bot: Bot;
}

export function BotWhatsAppConnect({ bot }: BotWhatsAppConnectProps) {
  const t = useT();
  const queryClient = useQueryClient();
  const updateBot = useUpdateBot(bot.botId);
  const { connectManual, status: whatsappStatus } = useWhatsAppConnect();

  const [phoneNumberId, setPhoneNumberId] = useState(bot.phoneNumberId ?? "");
  const [whatsappBusinessAccountId, setWhatsappBusinessAccountId] = useState(
    bot.whatsappBusinessAccountId ?? ""
  );
  const [accessToken, setAccessToken] = useState("");
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState("");
  const [error, setError] = useState("");
  const [advancedMode, setAdvancedMode] = useState(false);

  const whatsappConnected = Boolean(bot.whatsappPhone) || Boolean(bot.phoneNumberId?.trim());
  const pinValid = /^\d{6}$/.test(pin);
  const hasManualIds =
    phoneNumberId.trim().length > 0 && whatsappBusinessAccountId.trim().length > 0;
  const hasManualCredentials = accessToken.trim().length > 0 && pinValid;
  const isSaving = updateBot.isPending || whatsappStatus === "connecting";

  async function linkBotToWhatsApp(nextPhoneNumberId: string, nextWabaId: string) {
    await updateBot.mutateAsync({
      phoneNumberId: nextPhoneNumberId,
      whatsappBusinessAccountId: nextWabaId,
    });
    await queryClient.invalidateQueries({ queryKey: ["bots", "detail", bot.botId] });
    await queryClient.invalidateQueries({ queryKey: ["bots", "list"] });
  }

  async function handleEmbeddedConnected(data: {
    phoneNumberId: string;
    whatsappBusinessAccountId: string;
  }) {
    setError("");
    try {
      setPhoneNumberId(data.phoneNumberId);
      setWhatsappBusinessAccountId(data.whatsappBusinessAccountId);
      await linkBotToWhatsApp(data.phoneNumberId, data.whatsappBusinessAccountId);
    } catch (err) {
      setError((err as Error).message ?? t("bots.saveError"));
    }
  }

  async function handleManualConnect() {
    setError("");
    setPinError("");

    if (!hasManualIds || !hasManualCredentials) {
      setError(t("bots.manualCredentialsRequired"));
      return;
    }

    if (!pinValid) {
      setPinError(t("whatsapp.pinInvalid"));
      return;
    }

    try {
      const result = await connectManual({
        accessToken: accessToken.trim(),
        wabaId: whatsappBusinessAccountId.trim(),
        phoneNumberId: phoneNumberId.trim(),
        pin,
      });
      await linkBotToWhatsApp(result.phoneNumberId, result.whatsappBusinessAccountId);
      setAccessToken("");
      setPin("");
    } catch (err) {
      setError((err as Error).message ?? t("bots.saveError"));
    }
  }

  return (
    <div className="content-card space-y-4 p-5 sm:p-6">
      <div>
        <h2 className="text-lg font-semibold text-primary">{t("whatsapp.sectionTitle")}</h2>
        <p className="mt-1 text-sm text-secondary">{t("whatsapp.sectionDescription")}</p>
      </div>

      {!advancedMode && (
        <>
          <EmbeddedSignupLauncher
            alreadyConnected={whatsappConnected}
            onConnected={handleEmbeddedConnected}
          />
          <p className="text-xs text-secondary">{t("bots.sharedTokenNote")}</p>
        </>
      )}

      <button
        type="button"
        onClick={() => setAdvancedMode((value) => !value)}
        className="text-xs font-medium text-accent hover:text-accent"
      >
        {advancedMode ? t("bots.advancedModeHide") : t("bots.advancedMode")}
      </button>

      {advancedMode && (
        <div className="space-y-4 border-t border-subtle pt-4">
          <p className="text-xs text-secondary">{t("bots.manualModeHint")}</p>
          <p className="text-xs text-secondary">{t("bots.sharedTokenNote")}</p>

          <details className="rounded-lg border border-accent/20 bg-accent-muted/60 p-4 text-xs text-secondary">
            <summary className="cursor-pointer select-none font-medium text-accent">
              {t("bots.accessTokenGuideTitle")}
            </summary>
            <ol className="mt-3 list-inside list-decimal space-y-2 text-secondary">
              <li>{t("bots.accessTokenGuideStep1")}</li>
              <li>{t("bots.accessTokenGuideStep2")}</li>
              <li>{t("bots.accessTokenGuideStep3")}</li>
              <li>{t("bots.accessTokenGuideStep4")}</li>
              <li>{t("bots.accessTokenGuideStep5")}</li>
              <li>{t("bots.accessTokenGuideStep6")}</li>
              <li>{t("bots.accessTokenGuideStep7")}</li>
            </ol>
            <a
              href="https://developers.facebook.com/docs/whatsapp/business-management-api/get-started#system-user-access-tokens"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-block text-accent underline hover:text-accent"
            >
              {t("bots.accessTokenGuideMetaLink")}
            </a>
          </details>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-secondary">
                {t("bots.phoneNumberId")}
              </label>
              <input
                type="text"
                value={phoneNumberId}
                onChange={(e) => setPhoneNumberId(e.target.value)}
                className="w-full rounded-lg border border-default px-3 py-2 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                placeholder={t("bots.phonePlaceholder")}
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-secondary">
                {t("bots.wabaId")}
              </label>
              <input
                type="text"
                value={whatsappBusinessAccountId}
                onChange={(e) => setWhatsappBusinessAccountId(e.target.value)}
                className="w-full rounded-lg border border-default px-3 py-2 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                placeholder={t("bots.wabaPlaceholder")}
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-secondary">
              {t("bots.accessTokenLabel")}
            </label>
            <input
              type="password"
              value={accessToken}
              onChange={(e) => setAccessToken(e.target.value)}
              className="w-full rounded-lg border border-default px-3 py-2 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-accent"
              placeholder={t("bots.accessTokenPlaceholder")}
            />
            <p className="mt-1 text-xs text-secondary">{t("bots.accessTokenHint")}</p>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-secondary">
              {t("whatsapp.pinLabel")}
            </label>
            <input
              type="password"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={pin}
              onChange={(e) => {
                setPin(e.target.value.replace(/\D/g, "").slice(0, 6));
                if (pinError) setPinError("");
              }}
              className="w-full max-w-xs rounded-lg border border-default px-3 py-2 font-mono text-sm tracking-widest focus:outline-none focus:ring-2 focus:ring-accent"
              placeholder={t("whatsapp.pinPlaceholder")}
            />
            <p className="mt-1 text-xs text-secondary">{t("whatsapp.pinHint")}</p>
            {pinError ? <p className="mt-1 text-xs text-danger">{pinError}</p> : null}
          </div>

          <Button
            type="button"
            onClick={() => void handleManualConnect()}
            disabled={isSaving || !hasManualIds || !hasManualCredentials}
          >
            {isSaving ? t("bots.saving") : t("whatsapp.connectButton")}
          </Button>
        </div>
      )}

      {error ? (
        <div className="rounded-lg border border-danger/20 bg-[var(--alert-danger-bg)] p-3">
          <p className="text-sm text-danger">{error}</p>
        </div>
      ) : null}
    </div>
  );
}
