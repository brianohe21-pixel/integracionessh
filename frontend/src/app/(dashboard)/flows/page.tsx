"use client";

import Link from "next/link";
import { Plus } from "lucide-react";
import { useT } from "@/i18n/context";
import { useFlows, useToggleFlow, useDeleteFlow } from "@/hooks/useFlows";
import { useBots } from "@/hooks/useBots";
import { DashboardPage } from "@/components/layout/DashboardPage";
import { PageHeader } from "@/components/layout/PageHeader";
import { TableContainer } from "@/components/ui/TableContainer";

export default function FlowsPage() {
  const t = useT();
  const { data: flows, isLoading } = useFlows();
  const { data: bots } = useBots();
  const toggle = useToggleFlow();
  const remove = useDeleteFlow();

  const botName = (botId: string) => bots?.find((b) => b.botId === botId)?.name ?? botId;

  return (
    <DashboardPage>
      <PageHeader
        title={t("flows.title")}
        subtitle={t("flows.subtitle")}
        actions={
          <Link
            href="/flows/new"
            className="flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover"
          >
            <Plus className="h-4 w-4" />
            {t("flows.new")}
          </Link>
        }
      />

      {isLoading ? (
        <div className="h-32 animate-pulse rounded-xl border bg-surface-elevated" />
      ) : !flows?.length ? (
        <p className="text-sm text-secondary">{t("flows.empty")}</p>
      ) : (
        <TableContainer className="overflow-hidden rounded-xl border border-default bg-surface-elevated">
          <table className="w-full min-w-[560px] text-sm">
            <thead className="bg-surface text-left text-secondary">
              <tr>
                <th className="px-4 py-3">{t("flows.colName")}</th>
                <th className="px-4 py-3">{t("flows.colBot")}</th>
                <th className="px-4 py-3">{t("flows.colStatus")}</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {flows.map((flow) => (
                <tr key={flow.flowId} className="border-t border-subtle">
                  <td className="px-4 py-3">
                    <Link
                      href={`/flows/${flow.flowId}/edit`}
                      className="font-medium text-accent hover:underline"
                    >
                      {flow.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-secondary">{botName(flow.botId)}</td>
                  <td className="px-4 py-3">
                    {flow.enabled ? t("flows.enabled") : t("flows.disabled")}
                  </td>
                  <td className="space-x-2 px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() =>
                        toggle.mutate({ flowId: flow.flowId, enabled: !flow.enabled })
                      }
                      className="text-accent hover:underline"
                    >
                      {flow.enabled ? t("flows.disable") : t("flows.enable")}
                    </button>
                    <button
                      type="button"
                      onClick={() => remove.mutate(flow.flowId)}
                      className="text-red-600 hover:underline"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableContainer>
      )}
    </DashboardPage>
  );
}
