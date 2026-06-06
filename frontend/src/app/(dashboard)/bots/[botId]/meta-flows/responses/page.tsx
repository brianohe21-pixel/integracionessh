"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { useT } from "@/i18n/context";
import { useMetaFlowResponses } from "@/hooks/useMetaFlows";

export default function MetaFlowResponsesPage() {
  const t = useT();
  const { botId } = useParams<{ botId: string }>();
  const { data: responses, isLoading } = useMetaFlowResponses(botId);

  return (
    <div className="p-8 max-w-4xl">
      <Link
        href={`/bots/${botId}/meta-flows`}
        className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4"
      >
        <ChevronLeft className="w-4 h-4" />
        {t("metaFlows.title")}
      </Link>

      <h1 className="text-2xl font-bold text-gray-900 mb-6">{t("metaFlows.responses")}</h1>

      {isLoading ? (
        <div className="h-24 animate-pulse bg-gray-100 rounded-xl" />
      ) : !responses?.length ? (
        <p className="text-sm text-gray-500">No responses yet.</p>
      ) : (
        <div className="space-y-3">
          {responses.map((r) => (
            <div key={r.responseId} className="bg-white border border-gray-200 rounded-xl p-4 text-sm">
              <div className="flex justify-between text-gray-500 mb-2">
                <span>{r.phone}</span>
                <span>{new Date(r.createdAt).toLocaleString()}</span>
              </div>
              <pre className="text-xs bg-gray-50 p-2 rounded overflow-x-auto">
                {JSON.stringify(r.responseJson, null, 2)}
              </pre>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
