"use client";

import Link from "next/link";
import { Plus, GitBranch } from "lucide-react";
import { useT } from "@/i18n/context";
import { useFlows, useToggleFlow, useDeleteFlow } from "@/hooks/useFlows";
import { useBots } from "@/hooks/useBots";
import { DashboardPage } from "@/components/layout/DashboardPage";
import { PageHeader } from "@/components/layout/PageHeader";
import { DataTable, DataTableHead, DataTableBody, DataTableRow, DataTableCell } from "@/components/ui/DataTable";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { SkeletonTable } from "@/components/ui/Skeleton";
import { ContextualHint } from "@/components/help-center/ContextualHint";
import { TourPageSuggestion } from "@/components/help-center/TourList";

export default function FlowsPage() {
  const t = useT();
  const { data: flows, isLoading } = useFlows();
  const { data: bots } = useBots();
  const toggle = useToggleFlow();
  const remove = useDeleteFlow();

  const botName = (botId?: string) =>
    botId ? (bots?.find((b) => b.botId === botId)?.name ?? botId) : t("flows.bot.unassigned");

  return (
    <DashboardPage>
      <div data-tour="flows-header">
        <PageHeader
          title={t("flows.title")}
          subtitle={t("flows.subtitle")}
          actions={
            <ContextualHint hintId="flows-create" content={t("helpCenter.hints.flowsCreate")}>
              <Link data-tour="flows-create" href="/flows/new">
                <Button>
                  <Plus className="h-4 w-4" />
                  {t("flows.new")}
                </Button>
              </Link>
            </ContextualHint>
          }
        />
      </div>

      <TourPageSuggestion tourId="flows" />

      {isLoading ? (
        <SkeletonTable rows={4} cols={4} />
      ) : !flows?.length ? (
        <EmptyState
          icon={<GitBranch className="h-6 w-6" />}
          title={t("flows.empty")}
          action={
            <Link href="/flows/new">
              <Button>
                <Plus className="h-4 w-4" />
                {t("flows.new")}
              </Button>
            </Link>
          }
        />
      ) : (
        <DataTable data-tour="flows-table">
          <DataTableHead>
            <DataTableRow>
              <DataTableCell header>{t("flows.colName")}</DataTableCell>
              <DataTableCell header>{t("flows.colBot")}</DataTableCell>
              <DataTableCell header>{t("flows.colStatus")}</DataTableCell>
              <DataTableCell header className="text-right">Actions</DataTableCell>
            </DataTableRow>
          </DataTableHead>
          <DataTableBody>
            {flows.map((flow, index) => (
              <DataTableRow key={flow.flowId}>
                <DataTableCell>
                  <Link
                    href={`/flows/${flow.flowId}/edit`}
                    className="font-medium text-accent hover:underline"
                  >
                    {flow.name}
                  </Link>
                </DataTableCell>
                <DataTableCell className="text-secondary">{botName(flow.botId)}</DataTableCell>
                <DataTableCell>
                  <Badge variant={flow.enabled ? "success" : "default"} dot>
                    {flow.enabled ? t("flows.enabled") : t("flows.disabled")}
                  </Badge>
                </DataTableCell>
                <DataTableCell className="space-x-2 text-right">
                  <button
                    type="button"
                    data-tour={index === 0 ? "flows-toggle" : undefined}
                    onClick={() =>
                      toggle.mutate({ flowId: flow.flowId, enabled: !flow.enabled })
                    }
                    className="text-xs font-medium text-accent hover:underline"
                  >
                    {flow.enabled ? t("flows.disable") : t("flows.enable")}
                  </button>
                  <button
                    type="button"
                    onClick={() => remove.mutate(flow.flowId)}
                    className="text-xs font-medium text-danger hover:underline"
                  >
                    Delete
                  </button>
                </DataTableCell>
              </DataTableRow>
            ))}
          </DataTableBody>
        </DataTable>
      )}
    </DashboardPage>
  );
}
