"use client";

import { useT } from "@/i18n/context";
import { DashboardPage } from "@/components/layout/DashboardPage";
import { PageHeader } from "@/components/layout/PageHeader";
import { MicrosoftSsoPanel } from "@/components/integrations/MicrosoftSsoPanel";

export default function MicrosoftIntegrationPage() {
  const t = useT();

  return (
    <DashboardPage>
      <PageHeader
        title={t("integrationsPage.microsoft.name")}
        subtitle={t("integrationsPage.microsoft.description")}
      />
      <MicrosoftSsoPanel />
    </DashboardPage>
  );
}
