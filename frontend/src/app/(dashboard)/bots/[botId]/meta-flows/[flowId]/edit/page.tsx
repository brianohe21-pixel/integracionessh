"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { useT } from "@/i18n/context";
import {
  useMetaFlow,
  useUpdateMetaFlow,
  usePublishMetaFlow,
  useTestSendMetaFlow,
} from "@/hooks/useMetaFlows";
import { MetaFlowJsonEditor } from "@/components/meta-flows/MetaFlowJsonEditor";
import { DashboardPage } from "@/components/layout/DashboardPage";

export default function EditMetaFlowPage() {
  const t = useT();
  const { botId, flowId } = useParams<{ botId: string; flowId: string }>();
  const { data: flow, isLoading } = useMetaFlow(botId, flowId);
  const update = useUpdateMetaFlow(botId, flowId);
  const publish = usePublishMetaFlow(botId);
  const testSend = useTestSendMetaFlow(botId);
  const [jsonText, setJsonText] = useState("{}");
  const [testPhone, setTestPhone] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (flow?.jsonDefinition) {
      setJsonText(JSON.stringify(flow.jsonDefinition, null, 2));
    }
  }, [flow]);

  async function handleSave() {
    const jsonDefinition = JSON.parse(jsonText) as Record<string, unknown>;
    await update.mutateAsync({ jsonDefinition });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  if (isLoading || !flow) {
    return (
      <DashboardPage maxWidth="3xl">
        <div className="animate-pulse h-64 bg-gray-100 rounded-xl" />
      </DashboardPage>
    );
  }

  return (
    <DashboardPage maxWidth="3xl">
      <Link
        href={`/bots/${botId}/meta-flows`}
        className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4"
      >
        <ChevronLeft className="w-4 h-4" />
        {flow.name}
      </Link>

      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-gray-900">{flow.name}</h1>
        <span className="text-sm text-gray-500">{flow.status}</span>
      </div>

      <p className="text-sm text-gray-600 mb-2">{t("metaFlows.jsonEditor")}</p>
      <MetaFlowJsonEditor value={jsonText} onChange={setJsonText} readOnly={flow.status !== "DRAFT"} />

      <div className="flex flex-wrap gap-2 mt-4">
        {flow.status === "DRAFT" && (
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={update.isPending}
            className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg"
          >
            {t("flows.save")}
          </button>
        )}
        {flow.status === "DRAFT" && (
          <button
            type="button"
            onClick={() => publish.mutate(flowId)}
            className="px-4 py-2 text-sm font-medium border border-indigo-600 text-indigo-600 rounded-lg"
          >
            {t("metaFlows.publish")}
          </button>
        )}
        {saved && <span className="text-sm text-green-600 self-center">Saved</span>}
      </div>

      {flow.status === "PUBLISHED" && (
        <div className="mt-6 p-4 border border-gray-200 rounded-xl space-y-2">
          <p className="text-sm font-medium text-gray-700">{t("metaFlows.testSend")}</p>
          <input
            value={testPhone}
            onChange={(e) => setTestPhone(e.target.value)}
            placeholder={t("metaFlows.phonePlaceholder")}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />
          <button
            type="button"
            onClick={() => testSend.mutate({ flowId, to: testPhone, flowCta: "Open" })}
            className="px-4 py-2 text-sm bg-gray-900 text-white rounded-lg"
          >
            {t("metaFlows.testSend")}
          </button>
        </div>
      )}
    </DashboardPage>
  );
}
