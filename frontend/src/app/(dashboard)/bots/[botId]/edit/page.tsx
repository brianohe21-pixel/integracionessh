"use client";

import { useParams } from "next/navigation";
import { useBot } from "@/hooks/useBots";
import { BotForm } from "@/components/bots/BotForm";
import { BotKnowledge } from "@/components/bots/BotKnowledge";
import { BotWhatsAppQuality } from "@/components/bots/BotWhatsAppQuality";
import { useT } from "@/i18n/context";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";

export default function EditBotPage() {
  const t = useT();
  const { botId } = useParams<{ botId: string }>();
  const { data: bot, isLoading } = useBot(botId);

  if (isLoading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-4 max-w-2xl">
          <div className="h-6 w-48 bg-gray-200 rounded" />
          <div className="h-4 w-64 bg-gray-200 rounded" />
          <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
            <div className="h-10 bg-gray-200 rounded" />
            <div className="h-32 bg-gray-200 rounded" />
            <div className="h-10 bg-gray-200 rounded" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="mb-6">
        <Link
          href="/bots"
          className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4"
        >
          <ChevronLeft className="w-4 h-4" />
          {t("bots.backToBots")}
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">
          {t("bots.editBot", { name: bot?.name ?? t("bots.defaultName") })}
        </h1>
        <p className="text-sm text-gray-500 mt-1">{t("bots.editSubtitle")}</p>
      </div>

      <div className="max-w-2xl space-y-4">
        {bot && (
          <BotWhatsAppQuality
            phoneNumberId={bot.phoneNumberId}
            whatsappPhone={bot.whatsappPhone}
          />
        )}

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          {bot && <BotForm bot={bot} />}
        </div>

        {bot && <BotKnowledge bot={bot} />}
      </div>
    </div>
  );
}
