"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useT } from "@/i18n/context";
import {
  IMAP_PRESETS,
  matchImapPreset,
  type ImapPresetId,
} from "@/lib/email-imap-presets";
import type { Bot } from "@/types";

export function BotEmailSettings({ bot }: { bot: Bot }) {
  const t = useT();
  const qc = useQueryClient();
  const [provider, setProvider] = useState<"ses" | "imap">(bot.emailInboundProvider ?? "ses");
  const [enabled, setEnabled] = useState(Boolean(bot.emailEnabled));
  const [address, setAddress] = useState(bot.emailAddress ?? "");
  const [host, setHost] = useState(bot.emailImapHost ?? "");
  const [port, setPort] = useState(String(bot.emailImapPort ?? 993));
  const [username, setUsername] = useState(bot.emailImapUsername ?? "");
  const [password, setPassword] = useState("");
  const [mailbox, setMailbox] = useState(bot.emailImapMailbox ?? "INBOX");
  const [useTls, setUseTls] = useState(bot.emailImapUseTls !== false);
  const [selectedPreset, setSelectedPreset] = useState<ImapPresetId | null>(() =>
    matchImapPreset(bot.emailImapHost ?? "", bot.emailImapPort ?? 993, bot.emailImapUseTls !== false)
  );

  function applyPreset(presetId: ImapPresetId) {
    const preset = IMAP_PRESETS.find((item) => item.id === presetId);
    if (!preset) return;

    setSelectedPreset(presetId);
    setHost(preset.host);
    setPort(String(preset.port));
    setUseTls(preset.useTls);
    setMailbox(preset.mailbox);
    if (address.trim()) {
      setUsername(address.trim());
    }
  }

  function updateHost(value: string) {
    setHost(value);
    setSelectedPreset(matchImapPreset(value, Number(port), useTls));
  }

  function updatePort(value: string) {
    setPort(value);
    setSelectedPreset(matchImapPreset(host, Number(value), useTls));
  }

  function updateUseTls(value: boolean) {
    setUseTls(value);
    setSelectedPreset(matchImapPreset(host, Number(port), value));
  }

  const activePreset = IMAP_PRESETS.find((item) => item.id === selectedPreset);

  const saveSes = useMutation({
    mutationFn: () =>
      api.put(`/bots/${bot.botId}/email`, {
        enabled,
        emailAddress: address,
        inboundProvider: "ses",
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["bots", "detail", bot.botId] });
      void qc.invalidateQueries({ queryKey: ["bots", "list"] });
    },
  });

  const testImap = useMutation({
    mutationFn: () =>
      api.post("/email/imap/test", {
        botId: bot.botId,
        host,
        port: Number(port),
        username,
        password,
        mailbox,
        useTls,
        emailAddress: address,
      }),
  });

  const connectImap = useMutation({
    mutationFn: () =>
      api.post("/email/imap/connect", {
        botId: bot.botId,
        host,
        port: Number(port),
        username,
        password,
        mailbox,
        useTls,
        emailAddress: address,
      }),
    onSuccess: () => {
      setPassword("");
      void qc.invalidateQueries({ queryKey: ["bots", "detail", bot.botId] });
      void qc.invalidateQueries({ queryKey: ["bots", "list"] });
    },
  });

  const disconnectImap = useMutation({
    mutationFn: () => api.delete("/email/imap/connect", { botId: bot.botId }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["bots", "detail", bot.botId] });
      void qc.invalidateQueries({ queryKey: ["bots", "list"] });
    },
  });

  const isImapConnected = bot.emailInboundProvider === "imap" && bot.emailEnabled;

  return (
    <div className="bg-surface-elevated rounded-xl border border-default p-6 space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-primary">{t("emailChannel.title")}</h2>
        <p className="text-sm text-secondary mt-1">{t("emailChannel.subtitle")}</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setProvider("ses")}
          className={`px-3 py-1.5 rounded-lg text-sm border ${
            provider === "ses" ? "border-accent bg-accent-muted text-primary" : "border-default"
          }`}
        >
          {t("emailChannel.providerSes")}
        </button>
        <button
          type="button"
          onClick={() => setProvider("imap")}
          className={`px-3 py-1.5 rounded-lg text-sm border ${
            provider === "imap" ? "border-accent bg-accent-muted text-primary" : "border-default"
          }`}
        >
          {t("emailChannel.providerImap")}
        </button>
      </div>

      <input
        type="email"
        value={address}
        onChange={(e) => setAddress(e.target.value)}
        placeholder={t("emailChannel.address")}
        className="w-full px-3 py-2 border border-default rounded-lg text-sm"
      />

      {provider === "ses" ? (
        <>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
            {t("emailChannel.enabled")}
          </label>
          <p className="text-xs text-secondary">{t("emailChannel.inboundHint")}</p>
          <button
            type="button"
            onClick={() => saveSes.mutate()}
            disabled={saveSes.isPending || (enabled && !address)}
            className="px-4 py-2 bg-accent text-white text-sm rounded-lg disabled:opacity-50"
          >
            {saveSes.isPending ? t("common.saving") : t("common.save")}
          </button>
        </>
      ) : (
        <>
          <div className="space-y-2">
            <p className="text-xs font-medium text-secondary">{t("emailChannel.imapPresetsTitle")}</p>
            <div className="flex flex-wrap gap-2">
              {IMAP_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => applyPreset(preset.id)}
                  className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                    selectedPreset === preset.id
                      ? "bg-accent text-white"
                      : "bg-surface-muted text-secondary hover:text-primary"
                  }`}
                >
                  {t(preset.labelKey)}
                </button>
              ))}
            </div>
            {activePreset?.hintKey && (
              <p className="text-xs text-secondary">{t(activePreset.hintKey)}</p>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input
              type="text"
              value={host}
              onChange={(e) => updateHost(e.target.value)}
              placeholder={t("emailChannel.imapHost")}
              className="w-full px-3 py-2 border border-default rounded-lg text-sm"
            />
            <input
              type="number"
              value={port}
              onChange={(e) => updatePort(e.target.value)}
              placeholder={t("emailChannel.imapPort")}
              className="w-full px-3 py-2 border border-default rounded-lg text-sm"
            />
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder={t("emailChannel.imapUsername")}
              className="w-full px-3 py-2 border border-default rounded-lg text-sm"
            />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t("emailChannel.imapPassword")}
              className="w-full px-3 py-2 border border-default rounded-lg text-sm"
            />
            <input
              type="text"
              value={mailbox}
              onChange={(e) => setMailbox(e.target.value)}
              placeholder={t("emailChannel.imapMailbox")}
              className="w-full px-3 py-2 border border-default rounded-lg text-sm"
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={useTls} onChange={(e) => updateUseTls(e.target.checked)} />
            {t("emailChannel.imapUseTls")}
          </label>
          <p className="text-xs text-secondary">{t("emailChannel.imapHint")}</p>
          {isImapConnected && (
            <div className="rounded-lg border border-default bg-surface-muted p-3 text-xs space-y-1">
              <p className="text-success font-medium">{t("emailChannel.imapConnected")}</p>
              {bot.emailImapLastSyncAt && (
                <p>{t("emailChannel.imapLastSync", { time: new Date(bot.emailImapLastSyncAt).toLocaleString() })}</p>
              )}
              {bot.emailImapLastError && (
                <p className="text-danger">{bot.emailImapLastError}</p>
              )}
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => testImap.mutate()}
              disabled={testImap.isPending || !host || !username || !password || !address}
              className="px-4 py-2 border border-default text-sm rounded-lg disabled:opacity-50"
            >
              {testImap.isPending ? t("emailChannel.imapTesting") : t("emailChannel.imapTest")}
            </button>
            <button
              type="button"
              onClick={() => connectImap.mutate()}
              disabled={connectImap.isPending || !host || !username || !password || !address}
              className="px-4 py-2 bg-accent text-white text-sm rounded-lg disabled:opacity-50"
            >
              {connectImap.isPending ? t("common.saving") : t("emailChannel.imapConnect")}
            </button>
            {isImapConnected && (
              <button
                type="button"
                onClick={() => disconnectImap.mutate()}
                disabled={disconnectImap.isPending}
                className="px-4 py-2 border border-danger text-danger text-sm rounded-lg disabled:opacity-50"
              >
                {t("emailChannel.imapDisconnect")}
              </button>
            )}
          </div>
          {testImap.isSuccess && (
            <p className="text-xs text-success">{t("emailChannel.imapTestSuccess")}</p>
          )}
          {testImap.isError && (
            <p className="text-xs text-danger">
              {testImap.error instanceof Error ? testImap.error.message : t("emailChannel.imapTestError")}
            </p>
          )}
          {connectImap.isError && (
            <p className="text-xs text-danger">
              {connectImap.error instanceof Error ? connectImap.error.message : t("emailChannel.imapConnectError")}
            </p>
          )}
        </>
      )}
    </div>
  );
}
