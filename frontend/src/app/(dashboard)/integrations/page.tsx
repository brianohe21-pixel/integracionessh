"use client";

import { useT } from "@/i18n/context";
import {
  mergeIntegrationCatalog,
  useIntegrationCatalog,
} from "@/hooks/useMicrosoftSso";
import { DashboardPage } from "@/components/layout/DashboardPage";
import { PageHeader } from "@/components/layout/PageHeader";
import { IntegrationsGrid } from "@/components/integrations/IntegrationsGrid";

export default function IntegrationsPage() {
  const t = useT();
  const { data, isLoading } = useIntegrationCatalog();
  const items = mergeIntegrationCatalog(data?.items);

  return (
    <DashboardPage>
      <PageHeader
        title={t("integrationsPage.title")}
        subtitle={t("integrationsPage.subtitle")}
      />
      {isLoading ? (
        <div className="h-48 animate-pulse rounded-xl bg-surface-muted" />
      ) : (
        <IntegrationsGrid items={items} />
      )}
    </DashboardPage>
  );
}
