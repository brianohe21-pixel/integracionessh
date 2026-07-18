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
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";

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
      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
        <Card className="space-y-4 p-6">
        <div>
          <label className="mb-1 block text-sm font-medium text-secondary">{t("flows.colName")}</label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("flows.namePlaceholder")}
            required
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-secondary">{t("flows.selectBot")}</label>
          <Select value={botId} onChange={(e) => setBotId(e.target.value)} required>
            <option value="">—</option>
            {bots?.map((b) => (
              <option key={b.botId} value={b.botId}>
                {b.name}
              </option>
            ))}
          </Select>
        </div>
        <Button type="submit" disabled={create.isPending} className="w-full">
          {t("flows.new")}
        </Button>
        </Card>
      </form>
    </DashboardPage>
  );
}
