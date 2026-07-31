"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useT } from "@/i18n/context";
import type { Bot } from "@/types";

type ConnectResponse = {
  connected: boolean;
  messengerPageId: string;
  pageName?: string;
};

export function BotMessengerConnect({ bot }: { bot: Bot }) {
  const t = useT();
  const qc = useQueryClient();
  const [pageId, setPageId] = useState(bot.messengerPageId ?? "");
  const [pageAccessToken, setPageAccessToken] = useState("");
  const [connectedPageName, setConnectedPageName] = useState<string | null>(null);

  const connect = useMutation({
    mutationFn: () =>
      api.post<ConnectResponse>("/messenger/connect", {
        botId: bot.botId,
        ...(pageId ? { pageId } : {}),
        pageAccessToken,
      }),
    onSuccess: (data) => {
      void qc.invalidateQueries({ queryKey: ["bots", "detail", bot.botId] });
      void qc.invalidateQueries({ queryKey: ["bots", "list"] });
      setPageAccessToken("");
      setPageId(data.messengerPageId);
      setConnectedPageName(data.pageName ?? null);
    },
  });

  const displayPageName = connectedPageName ?? bot.name;

  return (
    <div className="bg-surface-elevated rounded-xl border border-default p-6 space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-primary">{t("messenger.title")}</h2>
        <p className="text-sm text-secondary mt-1">{t("messenger.subtitle")}</p>
        {bot.messengerPageId && (
          <p className="text-sm text-green-700 mt-2">
            {t("messenger.connected", {
              pageId: bot.messengerPageId,
              pageName: displayPageName,
            })}
          </p>
        )}
      </div>

      <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 space-y-2">
        <p className="text-xs font-semibold text-blue-800">{t("messenger.setupTitle")}</p>
        <ol className="text-xs text-blue-700 space-y-1 list-decimal list-inside">
          <li>{t("messenger.setupStep1")}</li>
          <li>{t("messenger.setupStep2")}</li>
          <li>{t("messenger.setupStep3")}</li>
        </ol>
        <p className="text-xs text-blue-700">{t("messenger.tokenHint")}</p>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <input
          value={pageId}
          onChange={(e) => setPageId(e.target.value)}
          placeholder={t("messenger.pageId")}
          className="w-full px-3 py-2 border border-default rounded-lg text-sm"
        />
        <input
          type="password"
          value={pageAccessToken}
          onChange={(e) => setPageAccessToken(e.target.value)}
          placeholder={t("messenger.pageToken")}
          className="w-full px-3 py-2 border border-default rounded-lg text-sm lg:col-span-2"
        />
      </div>

      {connect.isError && (
        <p className="text-sm text-red-600">
          {connect.error instanceof Error ? connect.error.message : t("messenger.connectError")}
        </p>
      )}

      <button
        type="button"
        onClick={() => connect.mutate()}
        disabled={connect.isPending || !pageAccessToken}
        className="px-4 py-2 bg-accent text-white text-sm rounded-lg disabled:opacity-50"
      >
        {connect.isPending ? t("common.saving") : t("messenger.connect")}
      </button>
    </div>
  );
}
