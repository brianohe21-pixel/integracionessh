"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useMailrelayCredentials } from "@/hooks/useMailrelay";
import { useT } from "@/i18n/context";
import { DashboardPage } from "@/components/layout/DashboardPage";
import { PageHeader } from "@/components/layout/PageHeader";
import { Tabs } from "@/components/ui/Tabs";
import { MailrelayAnalyticsTab } from "./MailrelayAnalyticsTab";
import { MailrelayAudienceTab } from "./MailrelayAudienceTab";
import { MailrelayCampaignsTab } from "./MailrelayCampaignsTab";

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
  return "audience";
}

export function MailrelayDashboard() {
  const t = useT();
  const searchParams = useSearchParams();
  const credentials = useMailrelayCredentials();
  const initialTab = useMemo(
    () => parseMailrelayTab(searchParams.get("tab")),
    [searchParams]
  );
  const [tab, setTab] = useState<MailrelayTab>(initialTab === "connection" ? "audience" : initialTab);
  const connected = credentials.data?.credentials.configured ?? false;
  const tabs = [
    { id: "audience" as const, label: t("mailrelay.tabs.audience") },
    { id: "campaigns" as const, label: t("mailrelay.tabs.campaigns") },
    { id: "analytics" as const, label: t("mailrelay.tabs.analytics") },
  ];

  useEffect(() => {
    if (initialTab === "connection") {
      setTab("audience");
      return;
    }
    setTab(initialTab);
  }, [initialTab]);

  return (
    <DashboardPage>
      <PageHeader title={t("mailrelay.title")} subtitle={t("mailrelay.subtitle")} />
      <Tabs items={tabs} value={tab} onChange={setTab} className="mb-6 w-full lg:w-auto" />
      {tab === "audience" ? <MailrelayAudienceTab connected={connected} /> : null}
      {tab === "campaigns" ? <MailrelayCampaignsTab connected={connected} /> : null}
      {tab === "analytics" ? <MailrelayAnalyticsTab connected={connected} /> : null}
    </DashboardPage>
  );
}
