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
  ScrollText,
  Settings2,
  Shield,
  SlidersHorizontal,
  SunMoon,
  User as UserIcon,
} from "lucide-react";
import { ActivityLogCard } from "@/components/settings/ActivityLogCard";
import { usePermissions } from "@/hooks/usePermissions";
import { useTenantRole } from "@/hooks/useTenantRole";
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
  "activity",
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
  const { can, loading: permissionsLoading } = usePermissions();
  const { isAdvisor, loading: roleLoading } = useTenantRole();
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<SettingsTab>("general");
  const accessLoading = permissionsLoading || roleLoading;
  const canReadSettings = can("settings.read");
  const canAccessSettings = isAdvisor || canReadSettings;
  const defaultTab: SettingsTab = isAdvisor ? "profile" : "general";

  useEffect(() => {
    if (accessLoading) return;
    const requested = searchParams.get("tab");
    if (requested === "team") {
      router.replace("/users");
      return;
    }
    if (isAdvisor) {
      setTab("profile");
      if (requested && requested !== "profile") {
        router.replace("/settings?tab=profile", { scroll: false });
      }
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
    setTab(defaultTab);
  }, [searchParams, router, isAdvisor, accessLoading, defaultTab]);

  const { data: tenant } = useQuery({
    queryKey: ["tenant"],
    queryFn: () => api.get<Tenant>("/tenants/me"),
    enabled: canAccessSettings && !isAdvisor,
  });
  const showBilling = isBillingVisible(tenant, getTenantContext());
  const canManageSettings = can("settings.manage");
  const canReadAudit = can("audit.read");

  useEffect(() => {
    if (!accessLoading && !canAccessSettings) {
      router.replace("/dashboard");
    }
  }, [canAccessSettings, accessLoading, router]);

  function selectTab(nextTab: SettingsTab) {
    if (isAdvisor && nextTab !== "profile") return;
    setTab(nextTab);
    const params = new URLSearchParams(searchParams.toString());
    if (nextTab === "general") params.delete("tab");
    else params.set("tab", nextTab);
    const query = params.toString();
    router.replace(query ? `/settings?${query}` : "/settings", { scroll: false });
  }

  const tabs: { id: SettingsTab; label: string; icon: ReactNode }[] = isAdvisor
    ? [{ id: "profile", label: t("settings.tabProfile"), icon: <UserIcon className="h-4 w-4" /> }]
    : [
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
        ...(canReadAudit
          ? [{ id: "activity" as const, label: t("settings.tabActivity"), icon: <ScrollText className="h-4 w-4" /> }]
          : []),
      ];

  if (accessLoading || !canAccessSettings) return null;

  const activeTab: SettingsTab = isAdvisor ? "profile" : tab;

  return (
    <DashboardPage>
      <PageHeader
        title={isAdvisor ? t("settings.tabProfile") : t("settings.title")}
        subtitle={isAdvisor ? t("settings.profilePhotoDescription") : t("settings.subtitle")}
      />

      {!isAdvisor ? (
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
                const active = activeTab === tabItem.id;
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
      ) : null}

      {activeTab === "profile" ? (
        isAdvisor ? (
          <ProfileSettingsCard />
        ) : (
          <SettingsPanel title={t("settings.tabProfile")}>
            <ProfileSettingsCard />
          </SettingsPanel>
        )
      ) : null}

      {activeTab === "general" ? (
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

          <fieldset disabled={!canManageSettings} className="disabled:opacity-60">
            <CompanySettingsCard />
          </fieldset>
        </SettingsPanel>
      ) : null}

      {activeTab === "security" ? (
        <SettingsPanel title={t("settings.tabSecurity")}>
          <div className="grid gap-6 xl:grid-cols-2">
            <ChangePasswordCard />
            <TwoFactorAuthCard />
          </div>
        </SettingsPanel>
      ) : null}

      {activeTab === "workspace" ? (
        <SettingsPanel title={t("settings.tabWorkspace")}>
          <fieldset disabled={!canManageSettings} className="space-y-6 disabled:opacity-60">
            {showBilling ? <PlanUsageCard /> : null}
            <InboxSlaCard />
            <ScheduledReportsCard />
          </fieldset>
        </SettingsPanel>
      ) : null}

      {activeTab === "branding" ? (
        <fieldset disabled={!canManageSettings} className="disabled:opacity-60">
          <BrandingSettingsCard />
        </fieldset>
      ) : null}

      {activeTab === "integrations" ? (
        <SettingsPanel title={t("settings.tabIntegrations")}>
          <fieldset disabled={!canManageSettings} className="space-y-6 disabled:opacity-60">
            <WebsiteAnalyticsCard />
            <TenantEmailSettingsCard />
          </fieldset>
        </SettingsPanel>
      ) : null}

      {activeTab === "activity" && canReadAudit ? (
        <SettingsPanel title={t("settings.tabActivity")}>
          <ActivityLogCard />
        </SettingsPanel>
      ) : null}

      {activeTab === "apiKeys" ? (
        <SettingsPanel title={t("settings.tabApiKeys")}>
          <fieldset disabled={!canManageSettings} className="disabled:opacity-60">
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
          </fieldset>
        </SettingsPanel>
      ) : null}
    </DashboardPage>
  );
}
