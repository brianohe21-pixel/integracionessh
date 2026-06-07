"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { useT } from "@/i18n/context";
import { useCreateMetaFlow } from "@/hooks/useMetaFlows";
import { DashboardPage } from "@/components/layout/DashboardPage";
import { PageHeader } from "@/components/layout/PageHeader";

export default function NewMetaFlowPage() {
  const t = useT();
  const router = useRouter();
  const { botId } = useParams<{ botId: string }>();
  const create = useCreateMetaFlow(botId);
  const [name, setName] = useState("");
  const [template, setTemplate] = useState<"lead_capture" | "feedback">("lead_capture");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const flow = await create.mutateAsync({ name, template, categories: ["OTHER"] });
    router.push(`/bots/${botId}/meta-flows/${flow.metaFlowId}/edit`);
  }

  return (
    <DashboardPage maxWidth="3xl">
      <Link
        href={`/bots/${botId}/meta-flows`}
        className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4"
      >
        <ChevronLeft className="w-4 h-4" />
        {t("metaFlows.title")}
      </Link>

      <PageHeader title={t("metaFlows.new")} />

      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4 bg-white border border-gray-200 rounded-xl p-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t("flows.colName")}</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Template</label>
          <select
            value={template}
            onChange={(e) => setTemplate(e.target.value as "lead_capture" | "feedback")}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"
          >
            <option value="lead_capture">{t("metaFlows.templateLead")}</option>
            <option value="feedback">{t("metaFlows.templateFeedback")}</option>
          </select>
        </div>
        <button
          type="submit"
          disabled={create.isPending}
          className="w-full py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50"
        >
          {t("metaFlows.new")}
        </button>
      </form>
    </DashboardPage>
  );
}
