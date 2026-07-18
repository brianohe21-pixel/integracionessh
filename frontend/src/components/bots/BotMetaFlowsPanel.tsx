"use client";

import Link from "next/link";
import { Workflow } from "lucide-react";
import { useT } from "@/i18n/context";

export function BotMetaFlowsPanel({ botId }: { botId: string }) {
  const t = useT();

  return (
    <div className="bg-surface-elevated rounded-xl border border-default p-6">
      <div className="flex items-center gap-2 mb-2">
        <Workflow className="w-5 h-5 text-accent" />
        <h2 className="text-lg font-semibold text-primary">{t("metaFlows.title")}</h2>
      </div>
      <p className="text-sm text-secondary mb-4">{t("metaFlows.subtitle")}</p>
      <Link
        href={`/bots/${botId}/meta-flows`}
        className="inline-flex px-4 py-2 text-sm font-medium text-accent border border-accent/30 rounded-lg hover:bg-accent-muted"
      >
        {t("metaFlows.manage")}
      </Link>
    </div>
  );
}
