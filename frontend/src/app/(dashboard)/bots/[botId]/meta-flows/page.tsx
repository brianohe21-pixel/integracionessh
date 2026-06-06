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

export default function MetaFlowsPage() {
  const t = useT();
  const { botId } = useParams<{ botId: string }>();
  const [sync, setSync] = useState(false);
  const { data: flows, isLoading, refetch } = useMetaFlows(botId, sync);
  const publish = usePublishMetaFlow(botId);
  const deprecate = useDeprecateMetaFlow(botId);
  const remove = useDeleteMetaFlow(botId);

  return (
    <div className="p-8 max-w-4xl">
      <Link
        href={`/bots/${botId}/edit`}
        className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4"
      >
        <ChevronLeft className="w-4 h-4" />
        {t("bots.backToBots")}
      </Link>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t("metaFlows.title")}</h1>
          <p className="text-sm text-gray-500 mt-1">{t("metaFlows.subtitle")}</p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => {
              setSync(true);
              void refetch().finally(() => setSync(false));
            }}
            className="flex items-center gap-2 px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            <RefreshCw className="w-4 h-4" />
            {t("metaFlows.sync")}
          </button>
          <Link
            href={`/bots/${botId}/meta-flows/new`}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700"
          >
            <Plus className="w-4 h-4" />
            {t("metaFlows.new")}
          </Link>
        </div>
      </div>

      {isLoading ? (
        <div className="h-32 bg-white border border-gray-200 rounded-xl animate-pulse" />
      ) : !flows?.length ? (
        <p className="text-sm text-gray-500">{t("metaFlows.empty")}</p>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-gray-600">
              <tr>
                <th className="px-4 py-3">{t("flows.colName")}</th>
                <th className="px-4 py-3">{t("flows.colStatus")}</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {flows.map((flow) => (
                <tr key={flow.metaFlowId} className="border-t border-gray-100">
                  <td className="px-4 py-3">
                    <Link
                      href={`/bots/${botId}/meta-flows/${flow.metaFlowId}/edit`}
                      className="text-indigo-600 hover:underline font-medium"
                    >
                      {flow.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{flow.status}</td>
                  <td className="px-4 py-3 text-right space-x-2">
                    {flow.status === "DRAFT" && (
                      <button
                        type="button"
                        onClick={() => publish.mutate(flow.metaFlowId)}
                        className="text-indigo-600 hover:underline"
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
        </div>
      )}

      <Link
        href={`/bots/${botId}/meta-flows/responses`}
        className="inline-block mt-6 text-sm text-indigo-600 hover:underline"
      >
        {t("metaFlows.responses")} →
      </Link>
    </div>
  );
}
