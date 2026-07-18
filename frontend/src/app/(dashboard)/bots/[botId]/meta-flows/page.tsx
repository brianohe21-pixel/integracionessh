"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ChevronLeft, Plus, RefreshCw } from "lucide-react";
import { useT } from "@/i18n/context";
import {
  useMetaFlows,
  usePublishMetaFlow,
  useDeprecateMetaFlow,
  useDeleteMetaFlow,
} from "@/hooks/useMetaFlows";
import { useState } from "react";
import { DashboardPage } from "@/components/layout/DashboardPage";
import { PageHeader } from "@/components/layout/PageHeader";
import { TableContainer } from "@/components/ui/TableContainer";

export default function MetaFlowsPage() {
  const t = useT();
  const { botId } = useParams<{ botId: string }>();
  const [sync, setSync] = useState(false);
  const { data: flows, isLoading, refetch } = useMetaFlows(botId, sync);
  const publish = usePublishMetaFlow(botId);
  const deprecate = useDeprecateMetaFlow(botId);
  const remove = useDeleteMetaFlow(botId);

  return (
    <DashboardPage maxWidth="4xl">
      <Link
        href={`/bots/${botId}/edit`}
        className="flex items-center gap-1 text-sm text-secondary hover:text-secondary mb-4"
      >
        <ChevronLeft className="w-4 h-4" />
        {t("bots.backToBots")}
      </Link>

      <PageHeader
        title={t("metaFlows.title")}
        subtitle={t("metaFlows.subtitle")}
        actions={
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                setSync(true);
                void refetch().finally(() => setSync(false));
              }}
              className="flex items-center gap-2 px-3 py-2 text-sm border border-default rounded-lg hover:bg-surface"
            >
              <RefreshCw className="w-4 h-4" />
              {t("metaFlows.sync")}
            </button>
            <Link
              href={`/bots/${botId}/meta-flows/new`}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-accent rounded-lg hover:bg-accent-hover"
            >
              <Plus className="w-4 h-4" />
              {t("metaFlows.new")}
            </Link>
          </div>
        }
      />

      {isLoading ? (
        <div className="h-32 bg-surface-elevated border border-default rounded-xl animate-pulse" />
      ) : !flows?.length ? (
        <p className="text-sm text-secondary">{t("metaFlows.empty")}</p>
      ) : (
        <TableContainer className="overflow-hidden rounded-xl border border-default bg-surface-elevated">
          <table className="w-full min-w-[480px] text-sm">
            <thead className="bg-surface text-left text-secondary">
              <tr>
                <th className="px-4 py-3">{t("flows.colName")}</th>
                <th className="px-4 py-3">{t("flows.colStatus")}</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {flows.map((flow) => (
                <tr key={flow.metaFlowId} className="border-t border-subtle">
                  <td className="px-4 py-3">
                    <Link
                      href={`/bots/${botId}/meta-flows/${flow.metaFlowId}/edit`}
                      className="text-accent hover:underline font-medium"
                    >
                      {flow.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-secondary">{flow.status}</td>
                  <td className="px-4 py-3 text-right space-x-2">
                    {flow.status === "DRAFT" && (
                      <button
                        type="button"
                        onClick={() => publish.mutate(flow.metaFlowId)}
                        className="text-accent hover:underline"
                      >
                        {t("metaFlows.publish")}
                      </button>
                    )}
                    {flow.status === "PUBLISHED" && (
                      <button
                        type="button"
                        onClick={() => deprecate.mutate(flow.metaFlowId)}
                        className="text-amber-600 hover:underline"
                      >
                        {t("metaFlows.deprecate")}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => remove.mutate(flow.metaFlowId)}
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

      <Link
        href={`/bots/${botId}/meta-flows/responses`}
        className="inline-block mt-6 text-sm text-accent hover:underline"
      >
        {t("metaFlows.responses")} →
      </Link>
    </DashboardPage>
  );
}
