"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/i18n/context";
import { useBots } from "@/hooks/useBots";
import { useCreateFlow } from "@/hooks/useFlows";
import {
  createDefaultFlowEdges,
  createDefaultFlowNodes,
} from "@/components/flows/FlowCanvas";
import { DashboardPage } from "@/components/layout/DashboardPage";
import { PageHeader } from "@/components/layout/PageHeader";

export default function NewFlowPage() {
  const t = useT();
  const router = useRouter();
  const { data: bots } = useBots();
  const create = useCreateFlow();
  const [name, setName] = useState("");
  const [botId, setBotId] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const nodes = createDefaultFlowNodes();
    const edges = createDefaultFlowEdges();
    const flow = await create.mutateAsync({
      name,
      botId,
      enabled: false,
      nodes,
      edges,
      entryNodeId: nodes[0]?.id ?? "",
    });
    router.push(`/flows/${flow.flowId}/edit`);
  }

  return (
    <DashboardPage maxWidth="3xl">
      <PageHeader title={t("flows.new")} />
      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4 bg-white border rounded-xl p-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t("flows.colName")}</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("flows.namePlaceholder")}
            required
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t("flows.selectBot")}</label>
          <select
            value={botId}
            onChange={(e) => setBotId(e.target.value)}
            required
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"
          >
            <option value="">—</option>
            {bots?.map((b) => (
              <option key={b.botId} value={b.botId}>
                {b.name}
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          disabled={create.isPending}
          className="w-full py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg"
        >
          {t("flows.new")}
        </button>
      </form>
    </DashboardPage>
  );
}
