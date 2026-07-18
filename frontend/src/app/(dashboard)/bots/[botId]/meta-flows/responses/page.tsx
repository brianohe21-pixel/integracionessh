"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { useT } from "@/i18n/context";
import { useMetaFlowResponses } from "@/hooks/useMetaFlows";
import { useLeads, useConvertLead } from "@/hooks/useLeads";
import { DashboardPage } from "@/components/layout/DashboardPage";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/Badge";
import type { LeadStatus } from "@/types";

function statusVariant(status: LeadStatus): "success" | "warning" | "danger" | "default" | "info" {
  if (status === "converted") return "success";
  if (status === "lost") return "danger";
  if (status === "qualified") return "info";
  if (status === "contacted") return "warning";
  return "default";
}

export default function MetaFlowResponsesPage() {
  const t = useT();
  const { botId } = useParams<{ botId: string }>();
  const { data: responses, isLoading } = useMetaFlowResponses(botId);
  const { data: leadsData } = useLeads({ botId });
  const convertLead = useConvertLead();

  const leadsByResponse = new Map(
    (leadsData?.items ?? []).map((l) => [l.flowResponseId, l])
  );

  return (
    <DashboardPage maxWidth="4xl">
      <Link
        href={`/bots/${botId}/meta-flows`}
        className="flex items-center gap-1 text-sm text-secondary hover:text-secondary mb-4"
      >
        <ChevronLeft className="w-4 h-4" />
        {t("metaFlows.title")}
      </Link>

      <PageHeader title={t("metaFlows.responses")} />

      {isLoading ? (
        <div className="h-24 animate-pulse bg-surface-muted rounded-xl" />
      ) : !responses?.length ? (
        <p className="text-sm text-secondary">{t("leads.noResponses")}</p>
      ) : (
        <div className="space-y-3">
          {responses.map((r) => {
            const name = typeof r.responseJson.name === "string" ? r.responseJson.name : undefined;
            const email = typeof r.responseJson.email === "string" ? r.responseJson.email : undefined;
            const lead = leadsByResponse.get(r.responseId) ?? (r.leadId
              ? leadsData?.items.find((l) => l.leadId === r.leadId)
              : undefined);

            return (
              <div key={r.responseId} className="bg-surface-elevated border border-default rounded-xl p-4 text-sm">
                <div className="flex flex-wrap justify-between gap-2 text-secondary mb-3">
                  <span>{r.phone}</span>
                  <span>{new Date(r.createdAt).toLocaleString()}</span>
                </div>
                <div className="space-y-1 mb-3">
                  {name && <p><span className="text-secondary">{t("leads.colName")}:</span> {name}</p>}
                  {email && <p><span className="text-secondary">{t("common.email")}:</span> {email}</p>}
                  {!name && !email && (
                    <pre className="text-xs bg-surface p-2 rounded overflow-x-auto">
                      {JSON.stringify(r.responseJson, null, 2)}
                    </pre>
                  )}
                </div>
                {lead && (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-secondary">{t("leads.leadStatus")}:</span>
                    <Badge variant={statusVariant(lead.status)}>
                      {t(`leads.status_${lead.status}`)}
                    </Badge>
                    <Link
                      href="/leads"
                      className="text-accent hover:text-accent text-xs"
                    >
                      {t("leads.viewLead")}
                    </Link>
                    {lead.status !== "converted" && lead.status !== "lost" && (
                      <button
                        type="button"
                        onClick={() => convertLead.mutate({ leadId: lead.leadId })}
                        disabled={convertLead.isPending}
                        className="text-xs text-accent hover:text-accent"
                      >
                        {t("leads.convert")}
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </DashboardPage>
  );
}
