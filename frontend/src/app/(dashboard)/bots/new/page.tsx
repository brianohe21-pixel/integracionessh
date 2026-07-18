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
        className="flex items-center gap-1 text-sm text-secondary hover:text-secondary mb-4"
      >
        <ChevronLeft className="w-4 h-4" />
        {t("bots.backToBots")}
      </Link>
      <PageHeader
        title={t("bots.createTitle")}
        subtitle={t("bots.createSubtitle")}
      />

      <div className="bg-surface-elevated rounded-xl border border-default p-6">
        <BotForm />
      </div>
    </DashboardPage>
  );
}
