"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useT } from "@/i18n/context";
import type { Bot } from "@/types";

export function BotInstagramConnect({ bot }: { bot: Bot }) {
  const t = useT();
  const qc = useQueryClient();
  const [pageId, setPageId] = useState(bot.instagramPageId ?? "");
  const [pageAccessToken, setPageAccessToken] = useState("");
  const [instagramAccountId, setInstagramAccountId] = useState(bot.instagramAccountId ?? "");

  const connect = useMutation({
    mutationFn: () =>
      api.post("/instagram/connect", {
        botId: bot.botId,
        pageId,
        pageAccessToken,
        ...(instagramAccountId ? { instagramAccountId } : {}),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["bots", "detail", bot.botId] });
      void qc.invalidateQueries({ queryKey: ["bots", "list"] });
      setPageAccessToken("");
    },
  });

  return (
    <div className="bg-surface-elevated rounded-xl border border-default p-6 space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-primary">{t("instagram.title")}</h2>
        <p className="text-sm text-secondary mt-1">{t("instagram.subtitle")}</p>
        {bot.instagramPageId && (
          <p className="text-sm text-green-700 mt-2">
            {t("instagram.connected", { pageId: bot.instagramPageId })}
          </p>
        )}
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        <input
          value={pageId}
          onChange={(e) => setPageId(e.target.value)}
          placeholder={t("instagram.pageId")}
          className="w-full px-3 py-2 border border-default rounded-lg text-sm lg:col-span-1"
        />
        <input
          value={instagramAccountId}
          onChange={(e) => setInstagramAccountId(e.target.value)}
          placeholder={t("instagram.accountId")}
          className="w-full px-3 py-2 border border-default rounded-lg text-sm lg:col-span-1"
        />
        <input
          type="password"
          value={pageAccessToken}
          onChange={(e) => setPageAccessToken(e.target.value)}
          placeholder={t("instagram.pageToken")}
          className="w-full px-3 py-2 border border-default rounded-lg text-sm lg:col-span-2"
        />
      </div>
      <button
        type="button"
        onClick={() => connect.mutate()}
        disabled={connect.isPending || !pageId || !pageAccessToken}
        className="px-4 py-2 bg-accent text-white text-sm rounded-lg disabled:opacity-50"
      >
        {connect.isPending ? t("common.saving") : t("instagram.connect")}
      </button>
    </div>
  );
}
