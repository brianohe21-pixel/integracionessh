"use client";

import { useRouter } from "next/navigation";
import {
  Camera,
  Globe,
  Mail,
  MessagesSquare,
  Mic,
  Phone,
  PhoneCall,
  Send,
  Webhook,
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { BotActionsMenu } from "@/components/bots/BotActionsMenu";
import { BotAvatar } from "@/components/bots/BotAvatar";
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
  const router = useRouter();
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

  const editHref = `/bots/${bot.botId}/edit`;

  function handleCardClick() {
    router.push(editHref);
  }

  function handleCardKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    router.push(editHref);
  }

  return (
    <div
      className="content-card content-card-interactive group flex cursor-pointer flex-col overflow-hidden"
      onClick={handleCardClick}
      onKeyDown={handleCardKeyDown}
      role="link"
      tabIndex={0}
      aria-label={t("bots.editBot", { name: bot.name })}
    >
      <div className="card-header px-5 py-5">
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-start gap-3">
            <BotAvatar
              name={bot.name}
              size="md"
              variant={bot.responseMode === "webhook" ? "webhook" : "ai"}
              className="transition-transform duration-200 group-hover:scale-105"
            />
            <div className="min-w-0">
              <h3 className="truncate text-base font-semibold text-primary transition-colors group-hover:text-accent">
                {bot.name}
              </h3>
              {bot.responseMode === "webhook" ? (
                <p className="mt-0.5 flex items-center gap-1 text-xs text-accent">
                  <Webhook className="h-3 w-3" />
                  {t("bots.webhookOwn")}
                </p>
              ) : (
                <p className="mt-0.5 text-xs text-muted">{getModelLabel(bot.model ?? "")}</p>
              )}
            </div>
          </div>
          <div
            onClick={(event) => event.stopPropagation()}
            onKeyDown={(event) => event.stopPropagation()}
          >
            <BotActionsMenu
              active={bot.status === "active"}
              busy={updateBot.isPending || deleteBot.isPending}
              onEdit={() => router.push(editHref)}
              onToggleStatus={handleToggleStatus}
              onDelete={() => void handleDelete()}
            />
          </div>
        </div>
      </div>

      <div className="flex flex-1 flex-col card-body">
        <div className="mb-4">
          <Badge variant={bot.status === "active" ? "success" : "default"} dot>
            {bot.status === "active" ? t("common.active") : t("common.inactive")}
          </Badge>
        </div>

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

        <p className="mt-auto text-xs text-muted">
          {t("bots.created", { date: formatDate(bot.createdAt) })}
        </p>
      </div>
    </div>
  );
}
