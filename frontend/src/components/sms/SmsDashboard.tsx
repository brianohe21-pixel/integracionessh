"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { BarChart3, FileText, History, LayoutGrid, Megaphone } from "lucide-react";
import { useT } from "@/i18n/context";
import { DashboardPage } from "@/components/layout/DashboardPage";
import { PageHeader } from "@/components/layout/PageHeader";
import { VoiceAgentSideNav } from "@/components/voice-agents/VoiceAgentSideNav";
import { SmsOverviewStrip } from "./SmsOverviewStrip";
import { SmsHistoryTab } from "./SmsHistoryTab";
import { SmsCampaignsTab } from "./SmsCampaignsTab";
import { SmsTemplatesTab } from "./SmsTemplatesTab";
import { SmsShortcuts } from "./SmsShortcuts";

type SmsTab = "overview" | "history" | "campaigns" | "templates";

function parseSmsTab(value: string | null): SmsTab {
  if (value === "history" || value === "campaigns" || value === "templates" || value === "overview") {
    return value;
  }
  return "overview";
}

export function SmsDashboard() {
  const t = useT();
  const searchParams = useSearchParams();
  const initialTab = useMemo(() => parseSmsTab(searchParams.get("tab")), [searchParams]);
  const [tab, setTab] = useState<SmsTab>(initialTab);

  const tabs = useMemo(
    () =>
      [
        {
          id: "overview" as const,
          label: t("smsDashboard.tabs.overview"),
          icon: <LayoutGrid className="h-4 w-4" />,
        },
        {
          id: "history" as const,
          label: t("smsDashboard.tabs.history"),
          icon: <History className="h-4 w-4" />,
        },
        {
          id: "campaigns" as const,
          label: t("smsDashboard.tabs.campaigns"),
          icon: <Megaphone className="h-4 w-4" />,
        },
        {
          id: "templates" as const,
          label: t("smsDashboard.tabs.templates"),
          icon: <FileText className="h-4 w-4" />,
        },
      ] satisfies Array<{ id: SmsTab; label: string; icon: ReactNode }>,
    [t]
  );

  useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);

  return (
    <DashboardPage className="min-h-full gap-6">
      <PageHeader
        title={t("smsDashboard.title")}
        subtitle={t("smsDashboard.subtitle")}
        actions={<SmsShortcuts />}
      />
      {tab === "overview" ? <SmsOverviewStrip /> : null}

      <div className="grid flex-1 gap-6 lg:grid-cols-[16rem_minmax(0,1fr)]">
        <VoiceAgentSideNav
          tabs={tabs}
          activeTab={tab}
          onSelect={setTab}
          sectionTitle={t("smsDashboard.navSectionTitle")}
          sectionSubtitle={t("smsDashboard.navSectionSubtitle")}
        />

        <div className="min-w-0 space-y-4">
          {tab === "overview" ? (
            <div className="rounded-xl border border-default bg-surface-elevated p-6">
              <div className="flex items-start gap-3">
                <BarChart3 className="mt-0.5 h-5 w-5 text-accent" />
                <div>
                  <h2 className="font-semibold text-primary">{t("smsDashboard.overview.panelTitle")}</h2>
                  <p className="mt-1 text-sm text-secondary">{t("smsDashboard.overview.panelSubtitle")}</p>
                </div>
              </div>
            </div>
          ) : null}
          {tab === "history" ? <SmsHistoryTab /> : null}
          {tab === "campaigns" ? <SmsCampaignsTab /> : null}
          {tab === "templates" ? <SmsTemplatesTab /> : null}
        </div>
      </div>
    </DashboardPage>
  );
}
