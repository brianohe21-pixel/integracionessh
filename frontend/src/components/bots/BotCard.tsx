"use client";

import Link from "next/link";
import {
  BotMessageSquare,
  Camera,
  Globe,
  Mail,
  MessagesSquare,
  Mic,
  Phone,
  PhoneCall,
  Send,
  Trash2,
  Edit,
  Power,
  PowerOff,
  Webhook,
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { useFormatters } from "@/hooks/useFormatters";
import { useT } from "@/i18n/context";
import { getModelLabel } from "@/lib/ai-models";
import type { Bot } from "@/types";
import { useDeleteBot, useUpdateBot } from "@/hooks/useBots";
import { useWhatsAppChannels } from "@/hooks/useWhatsAppChannels";
import { countBlockedWhatsAppChannels } from "@/components/whatsapp/WhatsAppEnforcementPanel";
import { useDialog } from "@/components/ui/DialogProvider";
import { cn } from "@/lib/utils";

interface BotCardProps {
  bot: Bot;
}

function getConnectedChannels(bot: Bot, whatsappChannelCount?: number) {
  const channels: { key: string; icon: typeof Phone; label: string }[] = [];

  if (bot.phoneNumberId || bot.whatsappPhone || (whatsappChannelCount ?? 0) > 0) {
    const count = whatsappChannelCount ?? (bot.phoneNumberId || bot.whatsappPhone ? 1 : 0);
    channels.push({
      key: "whatsapp",
      icon: Phone,
      label: count > 1 ? `WhatsApp (${count})` : "WhatsApp",
    });
  }
  if (bot.instagramPageId || bot.instagramAccountId) {
    channels.push({ key: "instagram", icon: Camera, label: "Instagram" });
  }
  if (bot.webchatEnabled) {
    channels.push({ key: "webchat", icon: Globe, label: "Web" });
  }
  if (bot.telegramEnabled) {
    channels.push({ key: "telegram", icon: Send, label: "Telegram" });
  }
  if (bot.messengerPageId) {
    channels.push({ key: "messenger", icon: MessagesSquare, label: "Messenger" });
  }
  if (bot.smsEnabled) {
    channels.push({ key: "sms", icon: Phone, label: "SMS" });
  }
  if (bot.emailEnabled) {
    channels.push({ key: "email", icon: Mail, label: "Email" });
  }
  if (bot.voicebotEnabled) {
    channels.push({ key: "voicebot", icon: Mic, label: "Voicebot" });
  }
  if (bot.telephonyEnabled) {
    channels.push({ key: "telephony", icon: PhoneCall, label: "Telephony" });
  }

  return channels;
}

export function BotCard({ bot }: BotCardProps) {
  const t = useT();
  const { formatDate } = useFormatters();
  const deleteBot = useDeleteBot();
  const updateBot = useUpdateBot(bot.botId);
  const { confirm } = useDialog();
  const hasWhatsApp = Boolean(bot.phoneNumberId || bot.whatsappPhone);
  const { data: whatsappChannels } = useWhatsAppChannels(bot.botId, { enabled: hasWhatsApp });
  const blockedWhatsAppCount = countBlockedWhatsAppChannels(whatsappChannels ?? []);
  const channels = getConnectedChannels(bot, whatsappChannels?.length);

  async function handleDelete() {
    const confirmed = await confirm({
      title: t("common.delete"),
      description: t("common.confirmDelete", { name: bot.name }),
      confirmLabel: t("common.delete"),
      tone: "danger",
    });
    if (!confirmed) return;
    deleteBot.mutate(bot.botId);
  }

  function handleToggleStatus() {
    updateBot.mutate({ status: bot.status === "active" ? "inactive" : "active" });
  }

  return (
    <div className="content-card content-card-interactive group flex flex-col overflow-hidden">
      <div className="card-header px-5 py-5">
        <div className="flex items-start gap-3">
          <div className="card-header-chip flex h-12 w-12 shrink-0 items-center justify-center rounded-xl transition-transform duration-200 group-hover:scale-105">
            <BotMessageSquare className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h3 className="truncate text-base font-semibold text-[var(--card-header-title)]">{bot.name}</h3>
            {bot.responseMode === "webhook" ? (
              <p className="mt-0.5 flex items-center gap-1 text-xs text-[var(--card-header-link)]">
                <Webhook className="h-3 w-3" />
                {t("bots.webhookOwn")}
              </p>
            ) : (
              <p className="mt-0.5 text-xs text-[var(--card-header-subtitle)]">{getModelLabel(bot.model ?? "")}</p>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-1 flex-col card-body">
        <div className="mb-4">
          <Badge variant={bot.status === "active" ? "success" : "default"} dot>
            {bot.status === "active" ? t("common.active") : t("common.inactive")}
          </Badge>
        </div>
        <p className="mb-4 line-clamp-2 text-sm leading-relaxed text-secondary">
          {bot.responseMode === "webhook" ? bot.webhookUrl : bot.systemPrompt}
        </p>

        <div className="mb-4">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-secondary">
            {t("bots.channelsConnected")}
          </p>
          {channels.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {channels.map((channel) => {
                const Icon = channel.icon;
                const showBlocked =
                  channel.key === "whatsapp" && blockedWhatsAppCount > 0;
                return (
                  <span
                    key={channel.key}
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium ring-1",
                      showBlocked
                        ? "bg-danger/10 text-danger ring-danger/20"
                        : "bg-surface-muted text-secondary ring-default"
                    )}
                  >
                    <Icon className={cn("h-3 w-3", showBlocked ? "text-danger" : "text-accent")} />
                    {channel.label}
                    {showBlocked ? ` · ${blockedWhatsAppCount}` : ""}
                  </span>
                );
              })}
            </div>
          ) : (
            <p className="text-xs text-muted">{t("bots.noChannelsConnected")}</p>
          )}
        </div>

        <p className="mb-4 text-xs text-muted">
          {t("bots.created", { date: formatDate(bot.createdAt) })}
        </p>

        <div className="mt-auto flex items-center gap-1 border-t border-subtle pt-4">
          <Link href={`/bots/${bot.botId}/edit`} className="flex-1">
            <Button variant="secondary" size="sm" className="w-full">
              <Edit className="h-3.5 w-3.5" />
              {t("common.edit")}
            </Button>
          </Link>

          <button
            onClick={handleToggleStatus}
            disabled={updateBot.isPending}
            className="flex items-center justify-center rounded-lg border border-default p-2 text-secondary transition-colors hover:bg-surface-muted hover:text-primary"
            title={bot.status === "active" ? t("bots.deactivate") : t("bots.activate")}
          >
            {bot.status === "active" ? (
              <PowerOff className="h-4 w-4" />
            ) : (
              <Power className="h-4 w-4" />
            )}
          </button>

          <button
            onClick={handleDelete}
            disabled={deleteBot.isPending}
            className={cn(
              "flex items-center justify-center rounded-lg border border-default p-2 text-danger transition-colors",
              "hover:border-danger/30 hover:bg-[var(--alert-danger-bg)]"
            )}
            title={t("common.delete")}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
