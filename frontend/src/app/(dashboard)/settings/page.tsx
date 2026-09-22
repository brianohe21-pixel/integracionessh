"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { api, getTenantContext } from "@/lib/api";
import { isBillingVisible } from "@/lib/subaccount-services";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/Badge";
import { useT } from "@/i18n/context";
import { LanguageSwitcher } from "@/components/layout/LanguageSwitcher";
import { ThemeSwitcher } from "@/components/theme/ThemeSwitcher";
import { SettingsCard } from "@/components/settings/SettingsCard";
import { CompanySettingsCard } from "@/components/settings/CompanySettingsCard";
import { ProviderCredentialsSection } from "@/components/settings/ProviderCredentialCard";
import { ChangePasswordCard } from "@/components/settings/ChangePasswordCard";
import { ProfileSettingsCard } from "@/components/settings/ProfileSettingsCard";
import { TwoFactorAuthCard } from "@/components/settings/TwoFactorAuthCard";
import { InboxSlaCard } from "@/components/settings/InboxSlaCard";
import { ScheduledReportsCard } from "@/components/settings/ScheduledReportsCard";
import { BrandingSettingsCard } from "@/components/branding/BrandingSettingsCard";
import { TenantEmailSettingsCard } from "@/components/settings/TenantEmailSettingsCard";
import { WebsiteAnalyticsCard } from "@/components/settings/WebsiteAnalyticsCard";
import {
  Key,
  Languages,
  Palette,
  Plug,
  Settings2,
  Shield,
  SlidersHorizontal,
  SunMoon,
  User as UserIcon,
} from "lucide-react";
import { PlanUsageCard } from "@/components/billing/PlanUsageCard";
import type { Tenant } from "@/types";
import { DashboardPage } from "@/components/layout/DashboardPage";
import { PageHeader } from "@/components/layout/PageHeader";

const SETTINGS_TABS = [
  "profile",
  "general",
  "security",
  "workspace",
  "branding",
  "integrations",
  "apiKeys",
] as const;

type SettingsTab = (typeof SETTINGS_TABS)[number];

function isSettingsTab(value: string | null): value is SettingsTab {
  return SETTINGS_TABS.includes(value as SettingsTab);
}

function SettingsPanel({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-base font-semibold text-primary">{title}</h2>
        {description ? <p className="mt-1 text-sm text-secondary">{description}</p> : null}
      </div>
      <div className="space-y-6">{children}</div>
    </section>
  );
}

export default function SettingsPage() {
  const t = useT();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<SettingsTab>("general");

  useEffect(() => {
    const requested = searchParams.get("tab");
    if (requested === "team") {
      router.replace("/users");
      return;
    }
    if (requested === "general") {
      setTab("general");
      router.replace("/settings", { scroll: false });
      return;
    }
    if (requested && isSettingsTab(requested)) {
      setTab(requested);
      return;
    }
    setTab("general");
  }, [searchParams, router]);

  const { data: tenant } = useQuery({
    queryKey: ["tenant"],
    queryFn: () => api.get<Tenant>("/tenants/me"),
  });
  const showBilling = isBillingVisible(tenant, getTenantContext());

  function selectTab(nextTab: SettingsTab) {
    setTab(nextTab);
    const params = new URLSearchParams(searchParams.toString());
    if (nextTab === "general") params.delete("tab");
    else params.set("tab", nextTab);
    const query = params.toString();
    router.replace(query ? `/settings?${query}` : "/settings", { scroll: false });
  }

  const tabs: { id: SettingsTab; label: string; icon: ReactNode }[] = [
    { id: "profile", label: t("settings.tabProfile"), icon: <UserIcon className="h-4 w-4" /> },
    { id: "general", label: t("settings.tabGeneral"), icon: <Settings2 className="h-4 w-4" /> },
    { id: "security", label: t("settings.tabSecurity"), icon: <Shield className="h-4 w-4" /> },
    {
      id: "workspace",
      label: t("settings.tabWorkspace"),
      icon: <SlidersHorizontal className="h-4 w-4" />,
    },
    { id: "branding", label: t("settings.tabBranding"), icon: <Palette className="h-4 w-4" /> },
    {
      id: "integrations",
      label: t("settings.tabIntegrations"),
      icon: <Plug className="h-4 w-4" />,
    },
    { id: "apiKeys", label: t("settings.tabApiKeys"), icon: <Key className="h-4 w-4" /> },
  ];

  return (
    <DashboardPage>
      <PageHeader title={t("settings.title")} subtitle={t("settings.subtitle")} />

      <div className="mb-6 space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-secondary">
          {t("settings.sectionsLabel")}
        </p>
        <nav
          className="rounded-xl border border-default bg-surface-elevated shadow-sm"
          aria-label={t("settings.title")}
        >
          <div className="flex gap-1 overflow-x-auto p-1.5">
            {tabs.map((tabItem) => {
              const active = tab === tabItem.id;
              return (
                <button
                  key={tabItem.id}
                  type="button"
                  onClick={() => selectTab(tabItem.id)}
                  className={cn(
                    "flex shrink-0 items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all duration-150",
                    active
                      ? "bg-accent text-white shadow-sm"
                      : "text-secondary hover:bg-surface-muted hover:text-primary"
                  )}
                >
                  {tabItem.icon}
                  {tabItem.label}
                </button>
              );
            })}
          </div>
        </nav>
      </div>

      {tab === "profile" ? (
        <SettingsPanel title={t("settings.tabProfile")}>
          <ProfileSettingsCard />
        </SettingsPanel>
      ) : null}

      {tab === "general" ? (
        <SettingsPanel title={t("settings.tabGeneral")}>
          <div className="grid gap-6 lg:grid-cols-2">
            <SettingsCard
              icon={<Languages className="h-4 w-4" />}
              title={t("settings.languageTitle")}
              description={t("settings.languageDescription")}
            >
              <LanguageSwitcher />
            </SettingsCard>

            <SettingsCard
              icon={<SunMoon className="h-4 w-4" />}
              title={t("settings.themeTitle")}
              description={t("settings.themeDescription")}
            >
              <ThemeSwitcher />
            </SettingsCard>
          </div>

          <CompanySettingsCard />
        </SettingsPanel>
      ) : null}

      {tab === "security" ? (
        <SettingsPanel title={t("settings.tabSecurity")}>
          <div className="grid gap-6 xl:grid-cols-2">
            <ChangePasswordCard />
            <TwoFactorAuthCard />
          </div>
        </SettingsPanel>
      ) : null}

      {tab === "workspace" ? (
        <SettingsPanel title={t("settings.tabWorkspace")}>
          {showBilling ? <PlanUsageCard /> : null}
          <InboxSlaCard />
          <ScheduledReportsCard />
        </SettingsPanel>
      ) : null}

      {tab === "branding" ? <BrandingSettingsCard /> : null}

      {tab === "integrations" ? (
        <SettingsPanel title={t("settings.tabIntegrations")}>
          <WebsiteAnalyticsCard />
          <TenantEmailSettingsCard />
        </SettingsPanel>
      ) : null}

      {tab === "apiKeys" ? (
        <SettingsPanel title={t("settings.tabApiKeys")}>
          <SettingsCard
            icon={<Key className="h-4 w-4" />}
            title={t("settings.secretsTitle")}
            description={t("settings.secretsDescription")}
          >
            <div className="space-y-3">
              <div className="flex items-center gap-3 rounded-xl border border-subtle bg-surface px-4 py-3">
                <div className="h-2 w-2 shrink-0 rounded-full bg-success" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-secondary">{t("settings.whatsappToken")}</p>
                  <p className="text-xs text-muted">{t("settings.whatsappTokenStored")}</p>
                </div>
                <Badge variant="success">{t("settings.configured")}</Badge>
              </div>

              <ProviderCredentialsSection />
            </div>
          </SettingsCard>
        </SettingsPanel>
      ) : null}
    </DashboardPage>
  );
}
