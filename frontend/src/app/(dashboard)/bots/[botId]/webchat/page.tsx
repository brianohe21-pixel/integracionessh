"use client";

import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { useParams } from "next/navigation";
import { useBot } from "@/hooks/useBots";
import { BotWebchatSettings } from "@/components/bots/BotWebchatSettings";
import { useT } from "@/i18n/context";
import { DashboardPage } from "@/components/layout/DashboardPage";

export default function BotWebchatPage() {
  const t = useT();
  const params = useParams();
  const botId = params.botId as string;
  const { data: bot, isLoading } = useBot(botId);

  if (isLoading || !bot) {
    return (
      <DashboardPage className="lg:px-6">
        <div className="animate-pulse h-48 bg-gray-100 rounded-xl" />
      </DashboardPage>
    );
  }

  return (
    <DashboardPage className="lg:px-6">
      <Link
        href={`/bots/${botId}/edit?tab=webchat`}
        className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4"
      >
        <ChevronLeft className="w-4 h-4" />
        {t("bots.backToEdit")}
      </Link>
      <BotWebchatSettings bot={bot} />
    </DashboardPage>
  );
}
