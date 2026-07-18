"use client";

import Link from "next/link";
import { BotMessageSquare, Phone, Trash2, Edit, Power, PowerOff, Webhook } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { useFormatters } from "@/hooks/useFormatters";
import { useT } from "@/i18n/context";
import type { Bot } from "@/types";
import { useDeleteBot, useUpdateBot } from "@/hooks/useBots";

interface BotCardProps {
  bot: Bot;
}

export function BotCard({ bot }: BotCardProps) {
  const t = useT();
  const { formatDate } = useFormatters();
  const deleteBot = useDeleteBot();
  const updateBot = useUpdateBot(bot.botId);

  function handleDelete() {
    if (confirm(t("common.confirmDelete", { name: bot.name }))) {
      deleteBot.mutate(bot.botId);
    }
  }

  function handleToggleStatus() {
    updateBot.mutate({ status: bot.status === "active" ? "inactive" : "active" });
  }

  return (
    <div className="bg-surface-elevated rounded-xl border border-default p-5 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-accent-muted rounded-xl flex items-center justify-center">
            <BotMessageSquare className="w-5 h-5 text-accent" />
          </div>
          <div>
            <h3 className="font-semibold text-primary text-sm">{bot.name}</h3>
            {bot.responseMode === "webhook" ? (
              <p className="text-xs text-accent flex items-center gap-1">
                <Webhook className="w-3 h-3" />
                {t("bots.webhookOwn")}
              </p>
            ) : (
              <p className="text-xs text-muted">{bot.model}</p>
            )}
          </div>
        </div>
        <Badge variant={bot.status === "active" ? "success" : "default"}>
          {bot.status === "active" ? t("common.active") : t("common.inactive")}
        </Badge>
      </div>

      <p className="text-xs text-secondary line-clamp-2 mb-4 leading-relaxed">
        {bot.responseMode === "webhook" ? bot.webhookUrl : bot.systemPrompt}
      </p>

      <div className="flex items-center gap-1.5 text-xs text-muted mb-4">
        <Phone className="w-3.5 h-3.5" />
        <span className="font-mono">{bot.phoneNumberId}</span>
      </div>

      <div className="text-xs text-muted mb-4">
        {t("bots.created", { date: formatDate(bot.createdAt) })}
      </div>

      <div className="flex items-center gap-2 pt-4 border-t border-subtle">
        <Link
          href={`/bots/${bot.botId}/edit`}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-secondary hover:text-primary hover:bg-surface rounded-lg transition-colors"
        >
          <Edit className="w-3.5 h-3.5" />
          {t("common.edit")}
        </Link>

        <button
          onClick={handleToggleStatus}
          disabled={updateBot.isPending}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-secondary hover:text-primary hover:bg-surface rounded-lg transition-colors"
        >
          {bot.status === "active" ? (
            <PowerOff className="w-3.5 h-3.5" />
          ) : (
            <Power className="w-3.5 h-3.5" />
          )}
          {bot.status === "active" ? t("bots.deactivate") : t("bots.activate")}
        </button>

        <button
          onClick={handleDelete}
          disabled={deleteBot.isPending}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors ml-auto"
        >
          <Trash2 className="w-3.5 h-3.5" />
          {t("common.delete")}
        </button>
      </div>
    </div>
  );
}
