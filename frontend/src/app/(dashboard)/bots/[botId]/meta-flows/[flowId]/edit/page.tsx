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
import { MetaFlowEditorPanel } from "@/components/meta-flows/MetaFlowEditorPanel";
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

  async function handlePublish() {
    const jsonDefinition = JSON.parse(jsonText) as Record<string, unknown>;
    await update.mutateAsync({ jsonDefinition });
    publish.mutate(flowId);
  }

  if (isLoading || !flow) {
    return (
      <DashboardPage maxWidth="3xl">
        <div className="animate-pulse h-64 bg-surface-muted rounded-xl" />
      </DashboardPage>
    );
  }

  return (
    <DashboardPage maxWidth="3xl">
      <Link
        href={`/bots/${botId}/meta-flows`}
        className="flex items-center gap-1 text-sm text-secondary hover:text-secondary mb-4"
      >
        <ChevronLeft className="w-4 h-4" />
        {flow.name}
      </Link>

      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-primary">{flow.name}</h1>
        <span className="text-sm text-secondary">{flow.status}</span>
      </div>

      <MetaFlowEditorPanel
        value={jsonText}
        onChange={setJsonText}
        readOnly={flow.status !== "DRAFT"}
      />

      <div className="flex flex-wrap gap-2 mt-4">
        {flow.status === "DRAFT" && (
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={update.isPending}
            className="px-4 py-2 text-sm font-medium text-white bg-accent rounded-lg"
          >
            {t("flows.save")}
          </button>
        )}
        {flow.status === "DRAFT" && (
          <button
            type="button"
            onClick={() => void handlePublish()}
            disabled={update.isPending || publish.isPending}
            className="px-4 py-2 text-sm font-medium border border-accent text-accent rounded-lg"
          >
            {t("metaFlows.publish")}
          </button>
        )}
        {saved && <span className="text-sm text-green-600 self-center">Saved</span>}
        {update.isError && (
          <p className="w-full text-sm text-red-600">{update.error.message}</p>
        )}
        {publish.isError && (
          <p className="w-full text-sm text-red-600">{publish.error.message}</p>
        )}
      </div>

      {flow.status === "PUBLISHED" && (
        <div className="mt-6 p-4 border border-default rounded-xl space-y-2">
          <p className="text-sm font-medium text-secondary">{t("metaFlows.testSend")}</p>
          <input
            value={testPhone}
            onChange={(e) => setTestPhone(e.target.value)}
            placeholder={t("metaFlows.phonePlaceholder")}
            className="w-full border border-default rounded-lg px-3 py-2 text-sm"
          />
          <button
            type="button"
            onClick={() => testSend.mutate({ flowId, to: testPhone, flowCta: "Open" })}
            className="px-4 py-2 text-sm bg-surface text-white rounded-lg"
          >
            {t("metaFlows.testSend")}
          </button>
        </div>
      )}
    </DashboardPage>
  );
}
