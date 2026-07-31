"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useT } from "@/i18n/context";
import type { Bot } from "@/types";

export function BotSmsSettings({ bot }: { bot: Bot }) {
  const t = useT();
  const qc = useQueryClient();
  const [enabled, setEnabled] = useState(Boolean(bot.smsEnabled));
  const [number, setNumber] = useState(bot.smsOriginationNumber ?? "");

  const save = useMutation({
    mutationFn: () =>
      api.put(`/bots/${bot.botId}/sms`, {
        enabled,
        smsOriginationNumber: number,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["bots", "detail", bot.botId] });
      void qc.invalidateQueries({ queryKey: ["bots", "list"] });
    },
  });

  return (
    <div className="bg-surface-elevated rounded-xl border border-default p-6 space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-primary">{t("sms.title")}</h2>
        <p className="text-sm text-secondary mt-1">{t("sms.subtitle")}</p>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
        {t("sms.enabled")}
      </label>
      <input
        value={number}
        onChange={(e) => setNumber(e.target.value)}
        placeholder={t("sms.originationNumber")}
        className="w-full px-3 py-2 border border-default rounded-lg text-sm"
      />
      <p className="text-xs text-secondary">{t("sms.webhookHint")}</p>
      <button
        type="button"
        onClick={() => save.mutate()}
        disabled={save.isPending || (enabled && !number)}
        className="px-4 py-2 bg-accent text-white text-sm rounded-lg disabled:opacity-50"
      >
        {save.isPending ? t("common.saving") : t("common.save")}
      </button>
    </div>
  );
}
