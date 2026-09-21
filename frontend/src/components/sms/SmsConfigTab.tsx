"use client";

import { FileText, History, Megaphone, ShieldCheck } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { VoiceAgentSideNav } from "@/components/voice-agents/VoiceAgentSideNav";
import { useT } from "@/i18n/context";
import { SmsCampaignsTab } from "./SmsCampaignsTab";
import { SmsHistoryTab } from "./SmsHistoryTab";
import { SmsOtpTab } from "./SmsOtpTab";
import { SmsTemplatesTab } from "./SmsTemplatesTab";

export type SmsConfigSection = "history" | "campaigns" | "templates" | "otp";

const CONFIG_SECTIONS: SmsConfigSection[] = ["history", "campaigns", "templates", "otp"];

function parseConfigSection(value: string | null): SmsConfigSection {
  if (value && CONFIG_SECTIONS.includes(value as SmsConfigSection)) {
    return value as SmsConfigSection;
  }
  return "history";
}

export function SmsConfigTab() {
  const t = useT();
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialSection = useMemo(
    () => parseConfigSection(searchParams.get("section")),
    [searchParams]
  );
  const [section, setSection] = useState<SmsConfigSection>(initialSection);

  const sections = useMemo(
    () =>
      [
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
        {
          id: "otp" as const,
          label: t("smsDashboard.tabs.otp"),
          icon: <ShieldCheck className="h-4 w-4" />,
        },
      ] satisfies Array<{ id: SmsConfigSection; label: string; icon: ReactNode }>,
    [t]
  );

  useEffect(() => {
    setSection(initialSection);
  }, [initialSection]);

  function handleSelect(nextSection: SmsConfigSection) {
    setSection(nextSection);
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", "config");
    params.set("section", nextSection);
    router.replace(`/sms?${params.toString()}`, { scroll: false });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[16rem_minmax(0,1fr)]">
      <VoiceAgentSideNav
        tabs={sections}
        activeTab={section}
        onSelect={handleSelect}
        sectionTitle={t("smsDashboard.navSectionTitle")}
        sectionSubtitle={t("smsDashboard.navSectionSubtitle")}
      />

      <div className="min-w-0">
        {section === "history" ? <SmsHistoryTab /> : null}
        {section === "campaigns" ? <SmsCampaignsTab /> : null}
        {section === "templates" ? <SmsTemplatesTab /> : null}
        {section === "otp" ? <SmsOtpTab /> : null}
      </div>
    </div>
  );
}
