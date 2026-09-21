"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { LayoutGrid, Settings } from "lucide-react";
import { useT } from "@/i18n/context";
import { DashboardPage } from "@/components/layout/DashboardPage";
import { PageHeader } from "@/components/layout/PageHeader";
import { VoiceAgentSideNav } from "@/components/voice-agents/VoiceAgentSideNav";
import { SmsOverviewStrip } from "./SmsOverviewStrip";
import { SmsConfigTab, type SmsConfigSection } from "./SmsConfigTab";
import { SmsShortcuts } from "./SmsShortcuts";

type SmsMainTab = "overview" | "config";

const LEGACY_CONFIG_TABS: SmsConfigSection[] = ["history", "campaigns", "templates", "otp"];

function parseMainTab(tab: string | null, section: string | null): SmsMainTab {
  if (tab === "config") return "config";
  if (tab && LEGACY_CONFIG_TABS.includes(tab as SmsConfigSection)) return "config";
  if (section && LEGACY_CONFIG_TABS.includes(section as SmsConfigSection)) return "config";
  return "overview";
}

function parseLegacySection(tab: string | null, section: string | null): SmsConfigSection | null {
  if (section && LEGACY_CONFIG_TABS.includes(section as SmsConfigSection)) {
    return section as SmsConfigSection;
  }
  if (tab && LEGACY_CONFIG_TABS.includes(tab as SmsConfigSection)) {
    return tab as SmsConfigSection;
  }
  return null;
}

export function SmsDashboard() {
  const t = useT();
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");
  const sectionParam = searchParams.get("section");
  const initialTab = useMemo(
    () => parseMainTab(tabParam, sectionParam),
    [tabParam, sectionParam]
  );
  const [tab, setTab] = useState<SmsMainTab>(initialTab);

  const tabs = useMemo(
    () =>
      [
        {
          id: "overview" as const,
          label: t("smsDashboard.tabs.overview"),
          icon: <LayoutGrid className="h-4 w-4" />,
        },
        {
          id: "config" as const,
          label: t("smsDashboard.tabs.config"),
          icon: <Settings className="h-4 w-4" />,
        },
      ] satisfies Array<{ id: SmsMainTab; label: string; icon: ReactNode }>,
    [t]
  );

  useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    const legacySection = parseLegacySection(tabParam, sectionParam);
    if (!legacySection) return;

    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", "config");
    params.set("section", legacySection);
    router.replace(`/sms?${params.toString()}`, { scroll: false });
  }, [router, searchParams, sectionParam, tabParam]);

  function handleSelect(nextTab: SmsMainTab) {
    setTab(nextTab);
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", nextTab);
    if (nextTab === "config" && !params.get("section")) {
      params.set("section", "history");
    }
    if (nextTab === "overview") {
      params.delete("section");
    }
    router.replace(`/sms?${params.toString()}`, { scroll: false });
  }

  return (
    <DashboardPage className="min-h-full gap-6">
      <PageHeader
        title={t("smsDashboard.title")}
        subtitle={t("smsDashboard.subtitle")}
        actions={<SmsShortcuts />}
      />

      <div className="content-card overflow-hidden">
        <div className="border-b border-default px-3 py-2 sm:px-4">
          <VoiceAgentSideNav
            tabs={tabs}
            activeTab={tab}
            onSelect={handleSelect}
            variant="horizontal"
          />
        </div>

        <div className="p-4 sm:p-6">
          {tab === "overview" ? <SmsOverviewStrip /> : null}
          {tab === "config" ? <SmsConfigTab /> : null}
        </div>
      </div>
    </DashboardPage>
  );
}
