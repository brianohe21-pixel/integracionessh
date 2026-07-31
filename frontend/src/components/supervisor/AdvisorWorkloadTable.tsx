"use client";

import { useRouter } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { TableContainer } from "@/components/ui/TableContainer";
import { useT } from "@/i18n/context";
import type { AdvisorWorkloadMetric, AdvisorWorkloadUnassigned } from "@/types";

type Props = {
  advisors: AdvisorWorkloadMetric[];
  unassigned: AdvisorWorkloadUnassigned;
};

export function AdvisorWorkloadTable({ advisors, unassigned }: Props) {
  const t = useT();
  const router = useRouter();

  function navigateToConversations(params: Record<string, string>) {
    const search = new URLSearchParams(params);
    router.push(`/conversations?${search.toString()}`);
  }

  return (
    <TableContainer>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-default">
            <th className="px-4 py-3 text-left text-xs font-medium uppercase text-secondary">
              {t("supervisor.colAdvisor")}
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium uppercase text-secondary">
              {t("supervisor.colNew")}
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium uppercase text-secondary">
              {t("supervisor.colOpen")}
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium uppercase text-secondary">
              {t("supervisor.colPending")}
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium uppercase text-secondary">
              {t("supervisor.colTotal")}
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium uppercase text-secondary">
              {t("supervisor.colSla")}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            className="cursor-pointer border-b border-subtle bg-warning/5 hover:bg-warning/10"
            onClick={() => navigateToConversations({ assignment: "unassigned", handoffMode: "human" })}
          >
            <td className="px-4 py-3 font-medium text-primary">
              {t("supervisor.unassignedQueue")}
              <Badge variant="warning" className="ml-2 text-[10px]">
                {unassigned.count}
              </Badge>
            </td>
            <td className="px-4 py-3 text-right text-secondary">{unassigned.new}</td>
            <td className="px-4 py-3 text-right text-secondary">{unassigned.open}</td>
            <td className="px-4 py-3 text-right text-secondary">{unassigned.pending}</td>
            <td className="px-4 py-3 text-right font-semibold text-primary">
              {unassigned.totalActive}
            </td>
            <td className="px-4 py-3 text-right">
              {unassigned.slaBreached > 0 && (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-red-600">
                  <AlertTriangle className="h-3 w-3" />
                  {unassigned.slaBreached}
                </span>
              )}
              {unassigned.slaAtRisk > 0 && unassigned.slaBreached === 0 && (
                <span className="text-xs font-medium text-amber-600">{unassigned.slaAtRisk}</span>
              )}
              {unassigned.slaBreached === 0 && unassigned.slaAtRisk === 0 && (
                <span className="text-xs text-muted">—</span>
              )}
            </td>
          </tr>
          {advisors.map((advisor) => (
            <tr
              key={advisor.advisorId}
              className="cursor-pointer border-b border-subtle hover:bg-surface-muted"
              onClick={() =>
                navigateToConversations({
                  assignedAdvisorId: advisor.advisorId,
                  handoffMode: "human",
                })
              }
            >
              <td className="px-4 py-3 font-medium text-primary">{advisor.name}</td>
              <td className="px-4 py-3 text-right text-secondary">{advisor.new}</td>
              <td className="px-4 py-3 text-right text-secondary">{advisor.open}</td>
              <td className="px-4 py-3 text-right text-secondary">{advisor.pending}</td>
              <td className="px-4 py-3 text-right font-semibold text-primary">
                {advisor.totalActive}
              </td>
              <td className="px-4 py-3 text-right">
                {advisor.slaBreached > 0 && (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-red-600">
                    <AlertTriangle className="h-3 w-3" />
                    {advisor.slaBreached}
                  </span>
                )}
                {advisor.slaAtRisk > 0 && advisor.slaBreached === 0 && (
                  <span className="text-xs font-medium text-amber-600">{advisor.slaAtRisk}</span>
                )}
                {advisor.slaBreached === 0 && advisor.slaAtRisk === 0 && (
                  <span className="text-xs text-muted">—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </TableContainer>
  );
}
