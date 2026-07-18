"use client";

import { useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/Badge";
import { useFormatters } from "@/hooks/useFormatters";
import { useT } from "@/i18n/context";
import { LanguageSwitcher } from "@/components/layout/LanguageSwitcher";
import { ThemeSwitcher } from "@/components/theme/ThemeSwitcher";
import { OpenAIKeyCard } from "@/components/settings/OpenAIKeyCard";
import { BrandingSettingsCard } from "@/components/branding/BrandingSettingsCard";
import {
  Building2,
  Key,
  Webhook,
  CheckCircle,
  Languages,
  Palette,
  Settings2,
  Plug,
  SunMoon,
} from "lucide-react";
import { PlanUsageCard } from "@/components/billing/PlanUsageCard";
import type { Tenant } from "@/types";
import { DashboardPage } from "@/components/layout/DashboardPage";
import { PageHeader } from "@/components/layout/PageHeader";

type SettingsTab = "general" | "branding" | "integrations" | "apiKeys";

export default function SettingsPage() {
  const t = useT();
  const { formatDate, planLabel } = useFormatters();
  const [tab, setTab] = useState<SettingsTab>("general");
  const [webhookCopied, setWebhookCopied] = useState(false);
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "";
  const webhookUrl = `${apiUrl}/webhook`;

  const { data: tenant } = useQuery({
    queryKey: ["tenant"],
    queryFn: () => api.get<Tenant>("/tenants/me"),
  });

  async function copyWebhook() {
    await navigator.clipboard.writeText(webhookUrl);
    setWebhookCopied(true);
    setTimeout(() => setWebhookCopied(false), 2000);
  }

  const tabs: { id: SettingsTab; label: string; icon: ReactNode }[] = [
    { id: "general", label: t("settings.tabGeneral"), icon: <Settings2 className="w-4 h-4" /> },
    { id: "branding", label: t("settings.tabBranding"), icon: <Palette className="w-4 h-4" /> },
    {
      id: "integrations",
      label: t("settings.tabIntegrations"),
      icon: <Plug className="w-4 h-4" />,
    },
    { id: "apiKeys", label: t("settings.tabApiKeys"), icon: <Key className="w-4 h-4" /> },
  ];

  return (
    <DashboardPage maxWidth="5xl">
      <PageHeader title={t("settings.title")} subtitle={t("settings.subtitle")} />

      <nav className="mb-6 border-b border-default" aria-label={t("settings.title")}>
        <div className="flex flex-wrap gap-1 -mb-px">
          {tabs.map((tabItem) => {
            const active = tab === tabItem.id;
            return (
              <button
                key={tabItem.id}
                type="button"
                onClick={() => setTab(tabItem.id)}
                className={cn(
                  "flex shrink-0 items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors",
                  active
                    ? "text-[var(--brand-primary,#25D366)]"
                    : "border-transparent text-secondary hover:text-secondary hover:border-default"
                )}
                style={active ? { borderBottomColor: "var(--brand-primary, #25D366)" } : undefined}
              >
                {tabItem.icon}
                {tabItem.label}
              </button>
            );
          })}
        </div>
      </nav>

      <div className="space-y-6">
        {tab === "general" && (
          <>
            <div className="bg-surface-elevated rounded-xl border border-default p-6">
              <div className="flex items-center gap-2 mb-2">
                <Languages className="w-4 h-4 text-secondary" />
                <h2 className="font-semibold text-primary text-sm">{t("settings.languageTitle")}</h2>
              </div>
              <p className="text-sm text-secondary mb-4">{t("settings.languageDescription")}</p>
              <LanguageSwitcher />
            </div>

            <div className="bg-surface-elevated rounded-xl border border-default p-6">
              <div className="flex items-center gap-2 mb-2">
                <SunMoon className="w-4 h-4 text-secondary" />
                <h2 className="font-semibold text-primary text-sm">{t("settings.themeTitle")}</h2>
              </div>
              <p className="text-sm text-secondary mb-4">{t("settings.themeDescription")}</p>
              <ThemeSwitcher />
            </div>

            <PlanUsageCard />

            <div className="bg-surface-elevated rounded-xl border border-default p-6">
              <div className="flex items-center gap-2 mb-4">
                <Building2 className="w-4 h-4 text-secondary" />
                <h2 className="font-semibold text-primary text-sm">{t("settings.accountInfo")}</h2>
              </div>

              {tenant ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between py-2 border-b border-subtle">
                    <span className="text-sm text-secondary">{t("settings.company")}</span>
                    <span className="text-sm font-medium text-primary">{tenant.name}</span>
                  </div>
                  <div className="flex items-center justify-between py-2 border-b border-subtle">
                    <span className="text-sm text-secondary">{t("common.email")}</span>
                    <span className="text-sm font-medium text-primary">{tenant.email}</span>
                  </div>
                  <div className="flex items-center justify-between py-2 border-b border-subtle">
                    <span className="text-sm text-secondary">{t("settings.plan")}</span>
                    <Badge variant="info">{planLabel(tenant.plan)}</Badge>
                  </div>
                  <div className="flex items-center justify-between py-2 border-b border-subtle">
                    <span className="text-sm text-secondary">{t("common.status")}</span>
                    <Badge variant={tenant.status === "active" ? "success" : "warning"}>
                      {tenant.status === "active" ? t("common.active") : t("common.suspended")}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between py-2">
                    <span className="text-sm text-secondary">{t("settings.memberSince")}</span>
                    <span className="text-sm text-secondary">{formatDate(tenant.createdAt)}</span>
                  </div>
                </div>
              ) : (
                <div className="space-y-3 animate-pulse">
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className="flex justify-between py-2 border-b border-subtle">
                      <div className="h-4 w-24 bg-gray-200 rounded" />
                      <div className="h-4 w-32 bg-gray-200 rounded" />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {tab === "branding" && <BrandingSettingsCard />}

        {tab === "integrations" && (
          <div className="bg-surface-elevated rounded-xl border border-default p-6">
            <div className="flex items-center gap-2 mb-4">
              <Webhook className="w-4 h-4 text-secondary" />
              <h2 className="font-semibold text-primary text-sm">{t("settings.webhookTitle")}</h2>
            </div>

            <p className="text-sm text-secondary mb-4">{t("settings.webhookDescription")}</p>

            <div className="flex items-center gap-2">
              <code className="flex-1 px-3 py-2.5 bg-surface border border-default rounded-lg text-xs font-mono text-secondary truncate">
                {webhookUrl}
              </code>
              <button
                type="button"
                onClick={() => void copyWebhook()}
                className="flex items-center gap-1.5 px-3 py-2.5 border border-default rounded-lg text-xs font-medium text-secondary hover:bg-surface transition-colors flex-shrink-0"
              >
                {webhookCopied ? (
                  <>
                    <CheckCircle className="w-3.5 h-3.5 text-green-500" />
                    {t("settings.copied")}
                  </>
                ) : (
                  t("settings.copy")
                )}
              </button>
            </div>

            <div className="mt-4 bg-blue-50 border border-blue-100 rounded-lg p-4">
              <p className="text-xs font-semibold text-blue-800 mb-2">
                {t("settings.webhookStepsTitle")}
              </p>
              <ol className="text-xs text-blue-700 space-y-1 list-decimal list-inside">
                <li>{t("settings.step0")}</li>
                <li>{t("settings.step1")}</li>
                <li>{t("settings.step2")}</li>
                <li>{t("settings.step3")}</li>
              </ol>
            </div>
          </div>
        )}

        {tab === "apiKeys" && (
          <div className="bg-surface-elevated rounded-xl border border-default p-6">
            <div className="flex items-center gap-2 mb-4">
              <Key className="w-4 h-4 text-secondary" />
              <h2 className="font-semibold text-primary text-sm">{t("settings.secretsTitle")}</h2>
            </div>

            <p className="text-sm text-secondary mb-4">{t("settings.secretsDescription")}</p>

            <div className="space-y-3">
              <div className="flex items-center gap-3 p-3 bg-surface rounded-lg border border-default">
                <div className="w-2 h-2 bg-green-400 rounded-full" />
                <div className="flex-1">
                  <p className="text-xs font-medium text-secondary">{t("settings.whatsappToken")}</p>
                  <p className="text-xs text-muted">{t("settings.whatsappTokenStored")}</p>
                </div>
                <Badge variant="success">{t("settings.configured")}</Badge>
              </div>

              <OpenAIKeyCard />
            </div>
          </div>
        )}
      </div>
    </DashboardPage>
  );
}
