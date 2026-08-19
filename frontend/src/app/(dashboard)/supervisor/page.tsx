"use client";

import { Users } from "lucide-react";
import { useAdvisorWorkload } from "@/hooks/useAdvisorWorkload";
import { AdvisorWorkloadTable } from "@/components/supervisor/AdvisorWorkloadTable";
import { ContactCenterWallboard } from "@/components/contact-center/ContactCenterWallboard";
import { DashboardPage } from "@/components/layout/DashboardPage";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { useT } from "@/i18n/context";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Tenant } from "@/types";
import { isSubaccountServiceEnabled } from "@/lib/subaccount-services";

export default function SupervisorPage() {
  const t = useT();
  const { data, isLoading, error } = useAdvisorWorkload();
  const { data: me } = useQuery({
    queryKey: ["tenants", "me"],
    queryFn: () => api.get<Tenant>("/tenants/me"),
  });
  const showWallboard = isSubaccountServiceEnabled(me, "contactCenter");

  return (
    <DashboardPage>
      <PageHeader
        title={t("supervisor.title")}
        subtitle={t("supervisor.subtitle")}
      />

      {isLoading && <p className="text-sm text-muted">{t("common.loading")}</p>}

      {error && (
        <p className="text-sm text-red-600">
          {error instanceof Error ? error.message : t("supervisor.loadError")}
        </p>
      )}

      {data && data.advisors.length === 0 && data.unassigned.count === 0 && (
        <EmptyState
          icon={<Users className="h-5 w-5" />}
          title={t("supervisor.emptyTitle")}
          description={t("supervisor.emptyDescription")}
        />
      )}

      {data && (data.advisors.length > 0 || data.unassigned.count > 0) && (
        <AdvisorWorkloadTable advisors={data.advisors} unassigned={data.unassigned} />
      )}

      {showWallboard ? (
        <div className="mt-8">
          <ContactCenterWallboard showSupervise />
        </div>
      ) : null}
    </DashboardPage>
  );
}
