"use client";

import type { Bot } from "@/types";
import { useT } from "@/i18n/context";

interface BotWhatsAppCoexistenceStatusProps {
  bot: Bot;
}

export function BotWhatsAppCoexistenceStatus({ bot }: BotWhatsAppCoexistenceStatusProps) {
  const t = useT();

  if (bot.whatsappOnboardingMode !== "coexistence") {
    return null;
  }

  const sync = bot.whatsappSyncStatus;
  const disconnected = Boolean(bot.whatsappDisconnectedAt);

  return (
    <div className="rounded-lg border border-default bg-surface-muted/40 p-4 space-y-2">
      <p className="text-sm font-medium text-primary">{t("whatsapp.coexistenceStatusTitle")}</p>
      {disconnected ? (
        <p className="text-sm text-danger">{t("whatsapp.coexistenceDisconnected")}</p>
      ) : null}
      {sync ? (
        <ul className="text-xs text-secondary space-y-1">
          {sync.contacts ? (
            <li>
              {t("whatsapp.syncContacts")}: {t(`whatsapp.syncPhase.${sync.contacts}`)}
            </li>
          ) : null}
          {sync.history ? (
            <li>
              {t("whatsapp.syncHistory")}: {t(`whatsapp.syncPhase.${sync.history}`)}
              {sync.historyProgress !== undefined ? ` (${sync.historyProgress}%)` : ""}
            </li>
          ) : null}
        </ul>
      ) : (
        <p className="text-xs text-secondary">{t("whatsapp.coexistenceSyncPending")}</p>
      )}
      <p className="text-xs text-muted">{t("whatsapp.coexistenceLimitations")}</p>
    </div>
  );
}
