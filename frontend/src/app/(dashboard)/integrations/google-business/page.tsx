"use client";

import { Star } from "lucide-react";
import { useT } from "@/i18n/context";
import { DashboardPage } from "@/components/layout/DashboardPage";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { Badge } from "@/components/ui/Badge";
import { isGoogleBusinessComingSoon } from "@/lib/feature-flags";
import { GoogleBusinessPanel } from "@/components/integrations/GoogleBusinessPanel";
import { Suspense } from "react";

function GoogleBusinessPanelFallback() {
  return <div className="h-48 animate-pulse rounded-xl bg-surface-muted" />;
}

export default function GoogleBusinessIntegrationPage() {
  const t = useT();

  if (isGoogleBusinessComingSoon()) {
    return (
      <DashboardPage>
        <PageHeader
          title={t("integrationsPage.googleBusiness.name")}
          subtitle={t("integrationsPage.googleBusiness.description")}
          actions={<Badge variant="default">{t("integrationsPage.comingSoon")}</Badge>}
        />
        <EmptyState
          icon={<Star className="h-5 w-5" />}
          title={t("integrationsPage.comingSoon")}
        />
      </DashboardPage>
    );
  }

  return (
    <DashboardPage>
      <PageHeader
        title={t("integrationsPage.googleBusiness.name")}
        subtitle={t("integrationsPage.googleBusiness.description")}
      />
      <Suspense fallback={<GoogleBusinessPanelFallback />}>
        <GoogleBusinessPanel />
      </Suspense>
    </DashboardPage>
  );
}
