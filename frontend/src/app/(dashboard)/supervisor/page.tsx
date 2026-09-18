"use client";

import { useMemo, useState } from "react";
import { Users } from "lucide-react";
import { useAdvisorWorkload } from "@/hooks/useAdvisorWorkload";
import { useBots } from "@/hooks/useBots";
import { AdvisorWorkloadTable } from "@/components/supervisor/AdvisorWorkloadTable";
import { SupervisorFilters } from "@/components/supervisor/SupervisorFilters";
import { ContactCenterWallboard } from "@/components/contact-center/ContactCenterWallboard";
import { DashboardPage } from "@/components/layout/DashboardPage";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { useT } from "@/i18n/context";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Tenant } from "@/types";
import { isSubaccountServiceEnabled } from "@/lib/subaccount-services";
import {
  filterAdvisorWorkload,
  hasSupervisorFilters,
  supervisorDateRange,
  type SupervisorFilterState,
} from "@/lib/supervisor-filters";

const EMPTY_FILTERS: SupervisorFilterState = {
  search: "",
  botId: "",
  from: "",
  to: "",
  sla: "",
  workload: "",
};

export default function SupervisorPage() {
  const t = useT();
  const [filters, setFilters] = useState<SupervisorFilterState>(EMPTY_FILTERS);
  const { data: bots } = useBots();
  const dateRange = supervisorDateRange(filters);
  const { data, isLoading, error } = useAdvisorWorkload({
    ...(filters.botId ? { botId: filters.botId } : {}),
    ...(dateRange ? { from: dateRange.from, to: dateRange.to } : {}),
  });
  const { data: me } = useQuery({
    queryKey: ["tenants", "me"],
    queryFn: () => api.get<Tenant>("/tenants/me"),
  });
  const showWallboard = isSubaccountServiceEnabled(me, "contactCenter");

  const filtered = useMemo(() => {
    if (!data) return null;
    return filterAdvisorWorkload(
      data.advisors,
      data.unassigned,
      filters,
      t("supervisor.unassignedQueue")
    );
  }, [data, filters, t]);

  const hasData = data && (data.advisors.length > 0 || data.unassigned.count > 0);
  const hasFilteredResults =
    filtered && (filtered.advisors.length > 0 || filtered.showUnassigned);
  const filtersActive = hasSupervisorFilters(filters);

  function updateFilters(patch: Partial<SupervisorFilterState>) {
    setFilters((current) => ({ ...current, ...patch }));
  }

  function clearFilters() {
    setFilters(EMPTY_FILTERS);
  }

  return (
    <DashboardPage>
      <PageHeader
        title={t("supervisor.title")}
        subtitle={
          dateRange
            ? t("supervisor.subtitleHistorical", {
                from: dateRange.from,
                to: dateRange.to,
              })
            : t("supervisor.subtitle")
        }
      />

      {hasData ? (
        <SupervisorFilters
          filters={filters}
          bots={(bots ?? []).map((bot) => ({ botId: bot.botId, name: bot.name }))}
          onChange={updateFilters}
          onClear={clearFilters}
        />
      ) : null}

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

      {hasData && filtered && hasFilteredResults && (
        <AdvisorWorkloadTable
          advisors={filtered.advisors}
          unassigned={data!.unassigned}
          showUnassigned={filtered.showUnassigned}
        />
      )}

      {hasData && filtered && !hasFilteredResults && (
        <EmptyState
          icon={<Users className="h-5 w-5" />}
          title={t("supervisor.noResultsTitle")}
          description={t("supervisor.noResultsDescription")}
          action={
            filtersActive ? (
              <Button type="button" variant="secondary" size="sm" onClick={clearFilters}>
                {t("conversations.clearFilters")}
              </Button>
            ) : undefined
          }
        />
      )}

      {showWallboard ? (
        <div className="mt-8">
          <ContactCenterWallboard showSupervise />
        </div>
      ) : null}
    </DashboardPage>
  );
}
