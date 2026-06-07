"use client";

import { FaqAccordion } from "@/components/support/FaqAccordion";
import { SupportTicketForm } from "@/components/support/SupportTicketForm";
import { SupportTicketList } from "@/components/support/SupportTicketList";
import { useT } from "@/i18n/context";
import { CircleHelp, MessageSquare } from "lucide-react";
import { DashboardPage } from "@/components/layout/DashboardPage";
import { PageHeader } from "@/components/layout/PageHeader";

export default function SupportPage() {
  const t = useT();

  return (
    <DashboardPage maxWidth="3xl">
      <PageHeader
        title={t("support.title")}
        subtitle={t("support.subtitle")}
      />

      <div className="space-y-6">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <CircleHelp className="w-4 h-4 text-gray-500" />
            <h2 className="font-semibold text-gray-900 text-sm">{t("support.faqTitle")}</h2>
          </div>
          <FaqAccordion />
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <MessageSquare className="w-4 h-4 text-gray-500" />
            <h2 className="font-semibold text-gray-900 text-sm">{t("support.contactTitle")}</h2>
          </div>
          <SupportTicketForm />
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="font-semibold text-gray-900 text-sm mb-4">{t("support.myTickets")}</h2>
          <SupportTicketList />
        </div>
      </div>
    </DashboardPage>
  );
}
