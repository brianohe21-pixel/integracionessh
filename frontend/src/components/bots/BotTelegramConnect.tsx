"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useT } from "@/i18n/context";
import type { Bot } from "@/types";

export function BotTelegramConnect({ bot }: { bot: Bot }) {
  const t = useT();
  const qc = useQueryClient();
  const [botToken, setBotToken] = useState("");

  const connect = useMutation({
    mutationFn: () =>
      api.post("/telegram/connect", {
        botId: bot.botId,
        botToken,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["bots", "detail", bot.botId] });
      void qc.invalidateQueries({ queryKey: ["bots", "list"] });
      setBotToken("");
    },
  });

  return (
    <div className="bg-surface-elevated rounded-xl border border-default p-6 space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-primary">{t("telegram.title")}</h2>
        <p className="text-sm text-secondary mt-1">{t("telegram.subtitle")}</p>
        {bot.telegramEnabled && bot.telegramBotUsername && (
          <p className="text-sm text-green-700 mt-2">
            {t("telegram.connected", { username: bot.telegramBotUsername })}
          </p>
        )}
      </div>
      <input
        type="password"
        value={botToken}
        onChange={(e) => setBotToken(e.target.value)}
        placeholder={t("telegram.botToken")}
        className="w-full px-3 py-2 border border-default rounded-lg text-sm"
      />
      <button
        type="button"
        onClick={() => connect.mutate()}
        disabled={connect.isPending || !botToken}
        className="px-4 py-2 bg-accent text-white text-sm rounded-lg disabled:opacity-50"
      >
        {connect.isPending ? t("common.saving") : t("telegram.connect")}
      </button>
    </div>
  );
}
