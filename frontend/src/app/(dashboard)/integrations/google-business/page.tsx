"use client";

import { Suspense } from "react";
import { useT } from "@/i18n/context";
import { DashboardPage } from "@/components/layout/DashboardPage";
import { PageHeader } from "@/components/layout/PageHeader";
import { GoogleBusinessPanel } from "@/components/integrations/GoogleBusinessPanel";

function GoogleBusinessPanelFallback() {
  return <div className="h-48 animate-pulse rounded-xl bg-surface-muted" />;
}

export default function GoogleBusinessIntegrationPage() {
  const t = useT();

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
