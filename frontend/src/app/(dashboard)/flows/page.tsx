"use client";

import Link from "next/link";
import { Plus } from "lucide-react";
import { useT } from "@/i18n/context";
import { useFlows, useToggleFlow, useDeleteFlow } from "@/hooks/useFlows";
import { useBots } from "@/hooks/useBots";

export default function FlowsPage() {
  const t = useT();
  const { data: flows, isLoading } = useFlows();
  const { data: bots } = useBots();
  const toggle = useToggleFlow();
  const remove = useDeleteFlow();

  const botName = (botId: string) => bots?.find((b) => b.botId === botId)?.name ?? botId;

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t("flows.title")}</h1>
          <p className="text-sm text-gray-500 mt-1">{t("flows.subtitle")}</p>
        </div>
        <Link
          href="/flows/new"
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700"
        >
          <Plus className="w-4 h-4" />
          {t("flows.new")}
        </Link>
      </div>

      {isLoading ? (
        <div className="h-32 bg-white border rounded-xl animate-pulse" />
      ) : !flows?.length ? (
        <p className="text-sm text-gray-500">{t("flows.empty")}</p>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-gray-600">
              <tr>
                <th className="px-4 py-3">{t("flows.colName")}</th>
                <th className="px-4 py-3">{t("flows.colBot")}</th>
                <th className="px-4 py-3">{t("flows.colStatus")}</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {flows.map((flow) => (
                <tr key={flow.flowId} className="border-t border-gray-100">
                  <td className="px-4 py-3">
                    <Link
                      href={`/flows/${flow.flowId}/edit`}
                      className="text-indigo-600 hover:underline font-medium"
                    >
                      {flow.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{botName(flow.botId)}</td>
                  <td className="px-4 py-3">
                    {flow.enabled ? t("flows.enabled") : t("flows.disabled")}
                  </td>
                  <td className="px-4 py-3 text-right space-x-2">
                    <button
                      type="button"
                      onClick={() =>
                        toggle.mutate({ flowId: flow.flowId, enabled: !flow.enabled })
                      }
                      className="text-indigo-600 hover:underline"
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
        </div>
      )}
    </div>
  );
}
