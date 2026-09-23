"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Plus, GitBranch } from "lucide-react";
import { useT } from "@/i18n/context";
import { useFlows, useToggleFlow, useDeleteFlow, useDuplicateFlow } from "@/hooks/useFlows";
import { useFormatters } from "@/hooks/useFormatters";
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
import { IntegrationErrorSupport } from "@/components/support/IntegrationErrorSupport";
import { FlowActionsMenu } from "@/components/flows/FlowActionsMenu";

export default function FlowsPage() {
  const t = useT();
  const { formatDate } = useFormatters();
  const router = useRouter();
  const { data: flows, isLoading } = useFlows();
  const { data: bots } = useBots();
  const toggle = useToggleFlow();
  const remove = useDeleteFlow();
  const duplicate = useDuplicateFlow();
  const [actionError, setActionError] = useState<{
    message: string;
    flowName?: string;
    botId?: string;
  } | null>(null);

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

      {actionError ? (
        <IntegrationErrorSupport
          integration="flow"
          error={actionError.message}
          context={{ botId: actionError.botId, flow: actionError.flowName }}
          className="mb-4"
        />
      ) : null}

      {isLoading ? (
        <SkeletonTable rows={4} cols={6} />
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
              <DataTableCell header>{t("flows.colUpdated")}</DataTableCell>
              <DataTableCell header>{t("flows.colPublished")}</DataTableCell>
              <DataTableCell header className="text-right">{t("flows.colActions")}</DataTableCell>
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
                <DataTableCell className="text-sm text-secondary">
                  {flow.updatedAt ? formatDate(flow.updatedAt) : "—"}
                </DataTableCell>
                <DataTableCell className="text-sm text-secondary">
                  {flow.publishedAt ? formatDate(flow.publishedAt) : t("flows.notPublished")}
                </DataTableCell>
                <DataTableCell className="text-right">
                  <div className="flex items-center justify-end">
                    <FlowActionsMenu
                      enabled={flow.enabled}
                      busy={toggle.isPending || duplicate.isPending || remove.isPending}
                      tourId={index === 0 ? "flows-toggle" : undefined}
                      onToggleEnabled={() => {
                        setActionError(null);
                        toggle.mutate(
                          { flowId: flow.flowId, enabled: !flow.enabled },
                          {
                            onError: (err) =>
                              setActionError({
                                message: err.message,
                                flowName: flow.name,
                                botId: flow.botId,
                              }),
                          }
                        );
                      }}
                      onDuplicate={() => {
                        setActionError(null);
                        duplicate.mutate(flow.flowId, {
                          onSuccess: (cloned) => router.push(`/flows/${cloned.flowId}/edit`),
                          onError: (err) =>
                            setActionError({
                              message: err.message || t("flows.duplicateError"),
                              flowName: flow.name,
                              botId: flow.botId,
                            }),
                        });
                      }}
                      onDelete={() => remove.mutate(flow.flowId)}
                    />
                  </div>
                </DataTableCell>
              </DataTableRow>
            ))}
          </DataTableBody>
        </DataTable>
      )}
    </DashboardPage>
  );
}
