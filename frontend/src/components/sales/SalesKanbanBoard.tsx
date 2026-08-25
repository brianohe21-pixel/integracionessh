"use client";

import { GripVertical, Mail, Phone, User } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";
import type { Opportunity, OpportunityEnriched, PipelineStage, SalesFunnelMetrics } from "@/types";
import {
  contactInitials,
  formatSalesMoney,
  stageBarColor,
  stageVariant,
} from "./sales-ui";

interface SalesKanbanBoardProps {
  stages: PipelineStage[];
  opportunities: OpportunityEnriched[];
  metricsByStage?: SalesFunnelMetrics["byStage"];
  locale: string;
  dragOverStageId: string | null;
  emptyDescription: string;
  onDragOverStage: (stageId: string | null) => void;
  onDrop: (opportunityId: string, stageId: string) => void;
  onSelectOpportunity: (opportunity: OpportunityEnriched) => void;
}

export function SalesKanbanBoard({
  stages,
  opportunities,
  metricsByStage,
  locale,
  dragOverStageId,
  emptyDescription,
  onDragOverStage,
  onDrop,
  onSelectOpportunity,
}: SalesKanbanBoardProps) {
  const hasOpportunities = opportunities.length > 0;

  return (
    <div className="space-y-4">
      {!hasOpportunities ? (
        <div className="rounded-xl border border-dashed border-accent/25 bg-accent-muted/30 px-4 py-6 text-center text-sm text-secondary">
          {emptyDescription}
        </div>
      ) : null}

      <div className="flex gap-4 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:thin]">
        {stages.map((stage) => {
          const stageOpportunities = opportunities.filter((item) => item.stageId === stage.stageId);
          const stageMetrics = metricsByStage?.find((item) => item.stageId === stage.stageId);
          const isDragOver = dragOverStageId === stage.stageId;

          return (
            <div
              key={stage.stageId}
              className={cn(
                "flex w-72 shrink-0 flex-col rounded-xl border transition-all duration-150",
                isDragOver
                  ? "border-2 border-accent/40 bg-accent-muted/25 shadow-md ring-2 ring-accent/20"
                  : "border-2 border-default bg-surface-elevated/80"
              )}
              onDragOver={(e) => {
                e.preventDefault();
                onDragOverStage(stage.stageId);
              }}
              onDragLeave={() => onDragOverStage(null)}
              onDrop={(e) => {
                onDragOverStage(null);
                const opportunityId = e.dataTransfer.getData("opportunityId");
                if (opportunityId) onDrop(opportunityId, stage.stageId);
              }}
            >
              <div className="relative overflow-hidden rounded-t-xl px-3 pb-3 pt-3">
                <div className={cn("absolute inset-x-0 top-0 h-1", stageBarColor(stage))} />
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-semibold text-primary">{stage.label}</h3>
                    {stageMetrics && stageMetrics.value > 0 ? (
                      <p className="mt-0.5 text-xs font-medium text-accent">
                        {formatSalesMoney(stageMetrics.value, "USD", locale)}
                      </p>
                    ) : (
                      <p className="mt-0.5 text-xs text-muted">
                        {stage.probability != null ? `${stage.probability}%` : "—"}
                      </p>
                    )}
                  </div>
                  <Badge variant={stageVariant(stage)}>{stageOpportunities.length}</Badge>
                </div>
              </div>

              <div className="flex min-h-[280px] flex-1 flex-col gap-2 px-2 pb-3">
                {stageOpportunities.map((opportunity) => (
                  <button
                    key={opportunity.opportunityId}
                    type="button"
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData("opportunityId", opportunity.opportunityId);
                      onDragOverStage(null);
                    }}
                    onClick={() => onSelectOpportunity(opportunity)}
                    className="group w-full rounded-xl border-2 border-default bg-surface p-3 text-left shadow-sm transition-all duration-150 hover:-translate-y-0.5 hover:border-accent/30 hover:shadow-md active:cursor-grabbing"
                  >
                    <div className="flex items-start gap-2.5">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-accent/20 to-accent-muted text-xs font-bold text-accent">
                        {contactInitials(opportunity.name, opportunity.title)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="line-clamp-2 text-sm font-semibold leading-snug text-primary">
                          {opportunity.title}
                        </p>
                        {opportunity.amount !== undefined ? (
                          <p className="mt-1 text-sm font-bold text-accent">
                            {formatSalesMoney(opportunity.amount, opportunity.currency, locale)}
                          </p>
                        ) : null}
                        {opportunity.companyName ? (
                          <p className="mt-1 text-xs text-secondary truncate">
                            {opportunity.companyName}
                          </p>
                        ) : null}
                        {opportunity.daysInStage > 0 ? (
                          <p className="mt-0.5 text-xs text-muted">
                            {opportunity.daysInStage}d
                          </p>
                        ) : null}
                      </div>
                      <GripVertical className="mt-0.5 h-4 w-4 shrink-0 text-muted opacity-0 transition-opacity group-hover:opacity-100" />
                    </div>

                    {(opportunity.name || opportunity.email || opportunity.phone) && (
                      <div className="mt-3 space-y-1 border-t border-subtle pt-2.5">
                        {opportunity.name ? (
                          <p className="flex items-center gap-1.5 truncate text-xs text-secondary">
                            <User className="h-3 w-3 shrink-0 text-muted" />
                            {opportunity.name}
                          </p>
                        ) : null}
                        {opportunity.email ? (
                          <p className="flex items-center gap-1.5 truncate text-xs text-secondary">
                            <Mail className="h-3 w-3 shrink-0 text-muted" />
                            {opportunity.email}
                          </p>
                        ) : null}
                        {opportunity.phone ? (
                          <p className="flex items-center gap-1.5 truncate text-xs text-secondary">
                            <Phone className="h-3 w-3 shrink-0 text-muted" />
                            {opportunity.phone}
                          </p>
                        ) : null}
                      </div>
                    )}
                  </button>
                ))}

                {stageOpportunities.length === 0 ? (
                  <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-subtle px-3 py-8 text-center text-xs text-muted">
                    —
                  </div>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
