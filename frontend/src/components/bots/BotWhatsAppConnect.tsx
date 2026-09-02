"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Phone, Plus, Star, Trash2 } from "lucide-react";
import { useWhatsAppConnect } from "@/hooks/useWhatsAppConnect";
import {
  useDeleteWhatsAppChannel,
  useRegisterWhatsAppChannel,
  useUpdateWhatsAppChannel,
  useWhatsAppChannels,
} from "@/hooks/useWhatsAppChannels";
import { useT } from "@/i18n/context";
import { useDialog } from "@/components/ui/DialogProvider";
import { EmbeddedSignupLauncher } from "@/components/whatsapp/EmbeddedSignupLauncher";
import { IntegrationErrorSupport } from "@/components/support/IntegrationErrorSupport";
import { BotWhatsAppCoexistenceStatus } from "@/components/bots/BotWhatsAppCoexistenceStatus";
import { BotWhatsAppCloudApiTest } from "@/components/bots/BotWhatsAppCloudApiTest";
import { Button } from "@/components/ui/Button";
import { api } from "@/lib/api";
import { isScaleOrResellerPlan } from "@/lib/normalize-plan";
import type { Bot, Tenant, WhatsAppChannel } from "@/types";

interface BotWhatsAppConnectProps {
  bot: Bot;
}

function legacyDisplayNumber(bot: Bot): string {
  return bot.whatsappPhone?.displayPhoneNumber?.trim() || bot.phoneNumberId?.trim() || "";
}

function channelDisplayNumber(channel: WhatsAppChannel): string {
  return channel.displayPhoneNumber?.trim() || channel.phoneNumberId;
}

function channelStatusLabel(
  channel: WhatsAppChannel,
  t: ReturnType<typeof useT>
): string {
  if (channel.status === "pending_registration") return t("whatsapp.channels.statusPending");
  if (channel.status === "disconnected") return t("whatsapp.channels.statusDisconnected");
  return t("whatsapp.channels.statusActive");
}

export function BotWhatsAppConnect({ bot }: BotWhatsAppConnectProps) {
  const t = useT();
  const { confirm } = useDialog();
  const queryClient = useQueryClient();
  const { data: tenant } = useQuery({
    queryKey: ["tenants", "me"],
    queryFn: () => api.get<Tenant>("/tenants/me"),
  });
  const { data: channels = [], isLoading } = useWhatsAppChannels(bot.botId);
  const updateChannel = useUpdateWhatsAppChannel(bot.botId);
  const deleteChannel = useDeleteWhatsAppChannel(bot.botId);
  const registerChannel = useRegisterWhatsAppChannel(bot.botId);
  const { connectManual, status: whatsappStatus } = useWhatsAppConnect(bot.botId);

  const multiChannelEnabled = isScaleOrResellerPlan(tenant?.plan);
  const [showAddPanel, setShowAddPanel] = useState(false);
  const [editingLabelId, setEditingLabelId] = useState<string | null>(null);
  const [labelDraft, setLabelDraft] = useState("");
  const [registerPin, setRegisterPin] = useState<Record<string, string>>({});
  const [phoneNumberId, setPhoneNumberId] = useState("");
  const [whatsappBusinessAccountId, setWhatsappBusinessAccountId] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [pin, setPin] = useState("");
  const [channelLabel, setChannelLabel] = useState("");
  const [pinError, setPinError] = useState("");
  const [error, setError] = useState("");
  const [advancedMode, setAdvancedMode] = useState(false);
  const [connectMode, setConnectMode] = useState<"coexistence" | "cloud_api">("coexistence");

  const sortedChannels = useMemo(
    () =>
      [...channels].sort((a, b) => {
        if (a.isDefault !== b.isDefault) return a.isDefault ? -1 : 1;
        return a.createdAt.localeCompare(b.createdAt);
      }),
    [channels]
  );

  const hasChannels = sortedChannels.length > 0;
  const legacyConnected = Boolean(bot.phoneNumberId?.trim()) && !hasChannels;
  const canAddChannel = multiChannelEnabled || !hasChannels;
  const isSaving =
    updateChannel.isPending ||
    deleteChannel.isPending ||
    registerChannel.isPending ||
    whatsappStatus === "connecting";
  const pinValid = /^\d{6}$/.test(pin);
  const hasManualIds =
    phoneNumberId.trim().length > 0 && whatsappBusinessAccountId.trim().length > 0;
  const hasManualCredentials = accessToken.trim().length > 0 && pinValid;

  async function refreshChannels() {
    await queryClient.invalidateQueries({ queryKey: ["bots", bot.botId, "whatsapp-channels"] });
    await queryClient.invalidateQueries({ queryKey: ["bots", "detail", bot.botId] });
    await queryClient.invalidateQueries({ queryKey: ["bots", "list"] });
  }

  async function handleEmbeddedConnected() {
    setError("");
    setShowAddPanel(false);
    await refreshChannels();
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
      await connectManual({
        accessToken: accessToken.trim(),
        wabaId: whatsappBusinessAccountId.trim(),
        phoneNumberId: phoneNumberId.trim(),
        pin,
        ...(channelLabel.trim() ? { label: channelLabel.trim() } : {}),
      });
      setAccessToken("");
      setPin("");
      setPhoneNumberId("");
      setWhatsappBusinessAccountId("");
      setChannelLabel("");
      setShowAddPanel(false);
      await refreshChannels();
    } catch (err) {
      setError((err as Error).message ?? t("bots.saveError"));
    }
  }

  async function handleSetDefault(channel: WhatsAppChannel) {
    setError("");
    try {
      await updateChannel.mutateAsync({ channelId: channel.channelId, isDefault: true });
    } catch (err) {
      setError((err as Error).message ?? t("bots.saveError"));
    }
  }

  async function handleSaveLabel(channel: WhatsAppChannel) {
    setError("");
    try {
      await updateChannel.mutateAsync({
        channelId: channel.channelId,
        label: labelDraft.trim() || undefined,
      });
      setEditingLabelId(null);
      setLabelDraft("");
    } catch (err) {
      setError((err as Error).message ?? t("bots.saveError"));
    }
  }

  async function handleDelete(channel: WhatsAppChannel) {
    const confirmed = await confirm({
      title: t("whatsapp.channels.deleteConfirmTitle"),
      description: t("whatsapp.channels.deleteConfirmDescription", {
        number: channelDisplayNumber(channel),
      }),
      confirmLabel: t("whatsapp.channels.deleteConfirmAction"),
      tone: "danger",
    });
    if (!confirmed) return;
    setError("");
    try {
      await deleteChannel.mutateAsync(channel.channelId);
    } catch (err) {
      setError((err as Error).message ?? t("bots.saveError"));
    }
  }

  async function handleRegister(channel: WhatsAppChannel) {
    const channelPin = registerPin[channel.channelId] ?? "";
    if (!/^\d{6}$/.test(channelPin)) {
      setError(t("whatsapp.pinInvalid"));
      return;
    }
    setError("");
    try {
      await registerChannel.mutateAsync({ channelId: channel.channelId, pin: channelPin });
      setRegisterPin((current) => ({ ...current, [channel.channelId]: "" }));
    } catch (err) {
      setError((err as Error).message ?? t("bots.saveError"));
    }
  }

  function renderAddPanel() {
    return (
      <div className="space-y-4 rounded-lg border border-subtle bg-surface-muted/30 p-4">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setConnectMode("coexistence")}
            className={`rounded-full px-3 py-1.5 text-xs font-medium ${
              connectMode === "coexistence"
                ? "bg-accent text-white"
                : "bg-surface-muted text-secondary"
            }`}
          >
            {t("whatsapp.modeCoexistence")}
          </button>
          <button
            type="button"
            onClick={() => setConnectMode("cloud_api")}
            className={`rounded-full px-3 py-1.5 text-xs font-medium ${
              connectMode === "cloud_api"
                ? "bg-accent text-white"
                : "bg-surface-muted text-secondary"
            }`}
          >
            {t("whatsapp.modeCloudApi")}
          </button>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-secondary">
            {t("whatsapp.channels.labelOptional")}
          </label>
          <input
            type="text"
            value={channelLabel}
            onChange={(e) => setChannelLabel(e.target.value)}
            className="w-full rounded-lg border border-default px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
            placeholder={t("whatsapp.channels.labelPlaceholder")}
          />
        </div>

        <EmbeddedSignupLauncher
          botId={bot.botId}
          alreadyConnected={false}
          onboardingMode={connectMode}
          onConnected={() => void handleEmbeddedConnected()}
        />

        <button
          type="button"
          onClick={() => setAdvancedMode((value) => !value)}
          className="text-xs font-medium text-accent hover:text-accent"
        >
          {advancedMode ? t("bots.advancedModeHide") : t("bots.advancedMode")}
        </button>

        {advancedMode ? (
          <div className="space-y-4 border-t border-subtle pt-4">
            <p className="text-xs text-secondary">{t("bots.manualModeHint")}</p>
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
        ) : null}
      </div>
    );
  }

  return (
    <div className="content-card space-y-4 p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-primary">{t("whatsapp.sectionTitle")}</h2>
          <p className="mt-1 text-sm text-secondary">
            {multiChannelEnabled
              ? t("whatsapp.channels.multiDescription")
              : t("whatsapp.channels.singleDescription")}
          </p>
        </div>
        {canAddChannel ? (
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => setShowAddPanel((value) => !value)}
          >
            <Plus className="h-4 w-4" />
            {hasChannels ? t("whatsapp.channels.addNumber") : t("whatsapp.connectButton")}
          </Button>
        ) : null}
      </div>

      {!multiChannelEnabled && hasChannels ? (
        <div className="rounded-lg border border-accent/20 bg-accent-muted/40 p-4 text-sm text-secondary">
          <p>{t("whatsapp.channels.upgradeHint")}</p>
          <Link href="/billing" className="mt-2 inline-block text-sm font-medium text-accent hover:underline">
            {t("billing.viewAllPlans")}
          </Link>
        </div>
      ) : null}

      {isLoading ? (
        <div className="h-24 animate-pulse rounded-lg bg-surface-muted" />
      ) : hasChannels ? (
        <div className="space-y-3">
          {sortedChannels.map((channel) => (
            <div
              key={channel.channelId}
              className="rounded-lg border border-default bg-surface p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Phone className="h-4 w-4 text-accent" />
                    <p className="font-medium text-primary">{channelDisplayNumber(channel)}</p>
                    {channel.isDefault ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-accent-muted px-2 py-0.5 text-[11px] font-medium text-accent">
                        <Star className="h-3 w-3" />
                        {t("whatsapp.channels.defaultBadge")}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 text-xs text-secondary">
                    {channelStatusLabel(channel, t)}
                    {channel.label ? ` · ${channel.label}` : ""}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {!channel.isDefault ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      disabled={isSaving}
                      onClick={() => void handleSetDefault(channel)}
                    >
                      {t("whatsapp.channels.setDefault")}
                    </Button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => void handleDelete(channel)}
                    disabled={isSaving}
                    className="rounded-lg border border-default p-2 text-danger hover:bg-[var(--alert-danger-bg)]"
                    title={t("common.delete")}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {editingLabelId === channel.channelId ? (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <input
                    type="text"
                    value={labelDraft}
                    onChange={(e) => setLabelDraft(e.target.value)}
                    className="min-w-[12rem] flex-1 rounded-lg border border-default px-3 py-2 text-sm"
                    placeholder={t("whatsapp.channels.labelPlaceholder")}
                  />
                  <Button type="button" size="sm" onClick={() => void handleSaveLabel(channel)}>
                    {t("common.save")}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      setEditingLabelId(null);
                      setLabelDraft("");
                    }}
                  >
                    {t("common.cancel")}
                  </Button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setEditingLabelId(channel.channelId);
                    setLabelDraft(channel.label ?? "");
                  }}
                  className="mt-2 text-xs font-medium text-accent hover:underline"
                >
                  {channel.label
                    ? t("whatsapp.channels.editLabel")
                    : t("whatsapp.channels.addLabel")}
                </button>
              )}

              {channel.status === "pending_registration" ? (
                <div className="mt-3 space-y-2 rounded-lg border border-warning/20 bg-warning/5 p-3">
                  <p className="text-xs text-secondary">{t("whatsapp.pendingDescription")}</p>
                  <div className="flex flex-wrap items-end gap-2">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-secondary">
                        {t("whatsapp.pinLabel")}
                      </label>
                      <input
                        type="password"
                        inputMode="numeric"
                        maxLength={6}
                        value={registerPin[channel.channelId] ?? ""}
                        onChange={(e) =>
                          setRegisterPin((current) => ({
                            ...current,
                            [channel.channelId]: e.target.value.replace(/\D/g, "").slice(0, 6),
                          }))
                        }
                        className="w-32 rounded-lg border border-default px-3 py-2 font-mono text-sm"
                      />
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      disabled={isSaving}
                      onClick={() => void handleRegister(channel)}
                    >
                      {t("whatsapp.registerButton")}
                    </Button>
                  </div>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      ) : legacyConnected ? (
        <div className="rounded-lg border border-[var(--alert-warning-border)] bg-[var(--alert-warning-bg)] p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-primary">
                {t("whatsapp.channels.legacyTitle")}
              </p>
              <p className="mt-1 text-sm font-medium text-primary">{legacyDisplayNumber(bot)}</p>
              <p className="mt-2 text-sm text-secondary">
                {t("whatsapp.channels.legacyHint", { number: legacyDisplayNumber(bot) })}
              </p>
            </div>
            <Button
              type="button"
              size="sm"
              onClick={() => setShowAddPanel(true)}
            >
              {t("whatsapp.channels.legacyAction")}
            </Button>
          </div>
        </div>
      ) : (
        <p className="text-sm text-secondary">{t("whatsapp.channels.empty")}</p>
      )}

      {showAddPanel && canAddChannel ? renderAddPanel() : null}

      {!hasChannels && !showAddPanel && !legacyConnected ? renderAddPanel() : null}

      {hasChannels || legacyConnected ? (
        <BotWhatsAppCloudApiTest bot={bot} channels={sortedChannels} />
      ) : null}

      <BotWhatsAppCoexistenceStatus bot={bot} />
      <p className="text-xs text-secondary">{t("bots.sharedTokenNote")}</p>

      {error ? (
        <IntegrationErrorSupport
          integration="whatsapp"
          error={error}
          context={{ botId: bot.botId, flow: "bot_whatsapp_connect" }}
        />
      ) : null}
    </div>
  );
}
