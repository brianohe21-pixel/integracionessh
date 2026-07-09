"use client";

import Link from "next/link";
import { Workflow } from "lucide-react";
import { useT } from "@/i18n/context";

export function BotMetaFlowsPanel({ botId }: { botId: string }) {
  const t = useT();

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-center gap-2 mb-2">
        <Workflow className="w-5 h-5 text-indigo-600" />
        <h2 className="text-lg font-semibold text-gray-900">{t("metaFlows.title")}</h2>
      </div>
      <p className="text-sm text-gray-500 mb-4">{t("metaFlows.subtitle")}</p>
      <Link
        href={`/bots/${botId}/meta-flows`}
        className="inline-flex px-4 py-2 text-sm font-medium text-indigo-600 border border-indigo-200 rounded-lg hover:bg-indigo-50"
      >
        {t("metaFlows.manage")}
      </Link>
    </div>
  );
}
