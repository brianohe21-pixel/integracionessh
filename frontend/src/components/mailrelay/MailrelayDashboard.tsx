"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { BarChart3, Megaphone, Plug, Users } from "lucide-react";
import { useMailrelayCredentials } from "@/hooks/useMailrelay";
import { useT } from "@/i18n/context";
import { DashboardPage } from "@/components/layout/DashboardPage";
import { PageHeader } from "@/components/layout/PageHeader";
import { VoiceAgentSideNav } from "@/components/voice-agents/VoiceAgentSideNav";
import { MailrelayAnalyticsTab } from "./MailrelayAnalyticsTab";
import { MailrelayAudienceTab } from "./MailrelayAudienceTab";
import { MailrelayCampaignsTab } from "./MailrelayCampaignsTab";
import { MailrelayConnectionTab } from "./MailrelayConnectionTab";
import { MailrelayOverviewStrip } from "./MailrelayOverviewStrip";

type MailrelayTab = "connection" | "audience" | "campaigns" | "analytics";

function parseMailrelayTab(value: string | null): MailrelayTab {
  if (
    value === "audience" ||
    value === "campaigns" ||
    value === "analytics" ||
    value === "connection"
  ) {
    return value;
  }
  return "connection";
}

export function MailrelayDashboard() {
  const t = useT();
  const searchParams = useSearchParams();
  const credentials = useMailrelayCredentials();
  const initialTab = useMemo(
    () => parseMailrelayTab(searchParams.get("tab")),
    [searchParams]
  );
  const [tab, setTab] = useState<MailrelayTab>(initialTab);
  const connected = credentials.data?.credentials.configured ?? false;
  const tabs = useMemo(
    () =>
      [
        {
          id: "connection" as const,
          label: t("mailrelay.tabs.connection"),
          icon: <Plug className="h-4 w-4" />,
        },
        {
          id: "audience" as const,
          label: t("mailrelay.tabs.audience"),
          icon: <Users className="h-4 w-4" />,
        },
        {
          id: "campaigns" as const,
          label: t("mailrelay.tabs.campaigns"),
          icon: <Megaphone className="h-4 w-4" />,
        },
        {
          id: "analytics" as const,
          label: t("mailrelay.tabs.analytics"),
          icon: <BarChart3 className="h-4 w-4" />,
        },
      ] satisfies Array<{ id: MailrelayTab; label: string; icon: ReactNode }>,
    [t]
  );

  useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);

  return (
    <DashboardPage className="min-h-full gap-6">
      <PageHeader title={t("mailrelay.title")} subtitle={t("mailrelay.subtitle")} />
      {connected ? <MailrelayOverviewStrip connected={connected} /> : null}

      <div className="grid flex-1 gap-6 lg:grid-cols-[16rem_minmax(0,1fr)]">
        <VoiceAgentSideNav
          tabs={tabs}
          activeTab={tab}
          onSelect={setTab}
          sectionTitle={t("mailrelay.navSectionTitle")}
          sectionSubtitle={t("mailrelay.navSectionSubtitle")}
        />

        <div className="min-w-0 space-y-4">
          {tab === "connection" ? <MailrelayConnectionTab connected={connected} /> : null}
          {tab === "audience" ? <MailrelayAudienceTab connected={connected} /> : null}
          {tab === "campaigns" ? <MailrelayCampaignsTab connected={connected} /> : null}
          {tab === "analytics" ? <MailrelayAnalyticsTab connected={connected} /> : null}
        </div>
      </div>
    </DashboardPage>
  );
}
