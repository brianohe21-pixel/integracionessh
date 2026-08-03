"use client";

import Link from "next/link";
import { BotMessageSquare, Phone, Trash2, Edit, Power, PowerOff, Webhook } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { useFormatters } from "@/hooks/useFormatters";
import { useT } from "@/i18n/context";
import { getModelLabel } from "@/lib/ai-models";
import type { Bot } from "@/types";
import { useDeleteBot, useUpdateBot } from "@/hooks/useBots";
import { cn } from "@/lib/utils";

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
    <div className="content-card group flex flex-col p-5">
      <div className="mb-4 flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="icon-badge h-11 w-11 transition-transform duration-200 group-hover:scale-105">
            <BotMessageSquare className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-primary">{bot.name}</h3>
            {bot.responseMode === "webhook" ? (
              <p className="flex items-center gap-1 text-xs text-accent">
                <Webhook className="h-3 w-3" />
                {t("bots.webhookOwn")}
              </p>
            ) : (
              <p className="text-xs text-muted">{getModelLabel(bot.model ?? "")}</p>
            )}
          </div>
        </div>
        <Badge variant={bot.status === "active" ? "success" : "default"} dot>
          {bot.status === "active" ? t("common.active") : t("common.inactive")}
        </Badge>
      </div>

      <p className="mb-4 line-clamp-2 text-xs leading-relaxed text-secondary">
        {bot.responseMode === "webhook" ? bot.webhookUrl : bot.systemPrompt}
      </p>

      <div className="mb-3 flex items-center gap-1.5 text-xs text-muted">
        <Phone className="h-3.5 w-3.5" />
        <span className="font-mono">{bot.phoneNumberId}</span>
      </div>

      <div className="mb-4 text-xs text-muted">
        {t("bots.created", { date: formatDate(bot.createdAt) })}
      </div>

      <div className="mt-auto flex items-center gap-1 border-t border-subtle pt-4">
        <Link
          href={`/bots/${bot.botId}/edit`}
          className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-secondary transition-colors hover:bg-surface-muted hover:text-primary"
        >
          <Edit className="h-3.5 w-3.5" />
          {t("common.edit")}
        </Link>

        <button
          onClick={handleToggleStatus}
          disabled={updateBot.isPending}
          className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-secondary transition-colors hover:bg-surface-muted hover:text-primary"
        >
          {bot.status === "active" ? (
            <PowerOff className="h-3.5 w-3.5" />
          ) : (
            <Power className="h-3.5 w-3.5" />
          )}
          {bot.status === "active" ? t("bots.deactivate") : t("bots.activate")}
        </button>

        <button
          onClick={handleDelete}
          disabled={deleteBot.isPending}
          className={cn(
            "ml-auto flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-danger transition-colors",
            "hover:bg-[var(--alert-danger-bg)]"
          )}
        >
          <Trash2 className="h-3.5 w-3.5" />
          {t("common.delete")}
        </button>
      </div>
    </div>
  );
}
