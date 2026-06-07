"use client";

import { BotForm } from "@/components/bots/BotForm";
import { useT } from "@/i18n/context";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { DashboardPage } from "@/components/layout/DashboardPage";
import { PageHeader } from "@/components/layout/PageHeader";

export default function NewBotPage() {
  const t = useT();

  return (
    <DashboardPage>
      <Link
        href="/bots"
        className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4"
      >
        <ChevronLeft className="w-4 h-4" />
        {t("bots.backToBots")}
      </Link>
      <PageHeader
        title={t("bots.createTitle")}
        subtitle={t("bots.createSubtitle")}
      />

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <BotForm />
      </div>
    </DashboardPage>
  );
}
