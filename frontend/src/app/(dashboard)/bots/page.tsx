"use client";

import Link from "next/link";
import { Plus, BotMessageSquare } from "lucide-react";
import { useBots } from "@/hooks/useBots";
import { BotCard } from "@/components/bots/BotCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { useT } from "@/i18n/context";

export default function BotsPage() {
  const t = useT();
  const { data: bots, isLoading, error } = useBots();

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t("bots.title")}</h1>
          <p className="text-sm text-gray-500 mt-1">{t("bots.subtitle")}</p>
        </div>
        <Link
          href="/bots/new"
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          {t("bots.newBot")}
        </Link>
      </div>

      {isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 p-5 animate-pulse">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-gray-200 rounded-xl" />
                <div className="space-y-1.5">
                  <div className="h-3.5 w-28 bg-gray-200 rounded" />
                  <div className="h-3 w-20 bg-gray-200 rounded" />
                </div>
              </div>
              <div className="space-y-2">
                <div className="h-3 bg-gray-200 rounded w-full" />
                <div className="h-3 bg-gray-200 rounded w-3/4" />
              </div>
            </div>
          ))}
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <p className="text-sm text-red-600 font-medium">{t("bots.loadError")}</p>
          <p className="text-xs text-red-500 mt-1 break-words">{error.message}</p>
        </div>
      )}

      {!isLoading && !error && bots?.length === 0 && (
        <EmptyState
          icon={<BotMessageSquare className="w-6 h-6" />}
          title={t("bots.emptyTitle")}
          description={t("bots.emptyDescription")}
          action={
            <Link
              href="/bots/new"
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              {t("bots.createFirst")}
            </Link>
          }
        />
      )}

      {!isLoading && bots && bots.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {bots.map((bot) => (
            <BotCard key={bot.botId} bot={bot} />
          ))}
        </div>
      )}
    </div>
  );
}
