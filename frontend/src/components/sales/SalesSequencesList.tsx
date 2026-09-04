"use client";

import { ListOrdered, Mail, MessageCircle, Zap } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { cn } from "@/lib/utils";
import type { SalesSequence, SalesSequenceStep } from "@/types";

interface SalesSequencesListProps {
  sequences: SalesSequence[];
  emptyTitle: string;
  emptyDescription: string;
  stepsLabel: (count: number) => string;
  activeLabel: string;
  inactiveLabel: string;
}

function channelMeta(channel: SalesSequenceStep["channel"]) {
  if (channel === "whatsapp") {
    return { icon: MessageCircle, label: "WhatsApp", tone: "text-success bg-success/15" };
  }
  if (channel === "email") {
    return { icon: Mail, label: "Email", tone: "text-info bg-info/15" };
  }
  return { icon: ListOrdered, label: "Task", tone: "text-warning bg-warning/15" };
}

export function SalesSequencesList({
  sequences,
  emptyTitle,
  emptyDescription,
  stepsLabel,
  activeLabel,
  inactiveLabel,
}: SalesSequencesListProps) {
  if (sequences.length === 0) {
    return (
      <EmptyState
        icon={<ListOrdered className="h-6 w-6" />}
        title={emptyTitle}
        description={emptyDescription}
      />
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {sequences.map((sequence) => (
        <div
          key={sequence.sequenceId}
          className="content-card overflow-hidden transition-transform duration-150 hover:-translate-y-0.5"
        >
          <div className="card-header px-5 py-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="card-header-chip mb-2 inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide">
                  <Zap className="h-3 w-3" />
                  {stepsLabel(sequence.steps.length)}
                </div>
                <h3 className="truncate text-base font-semibold text-primary">{sequence.name}</h3>
              </div>
              <Badge variant={sequence.enabled ? "success" : "default"} dot>
                {sequence.enabled ? activeLabel : inactiveLabel}
              </Badge>
            </div>
          </div>

          <div className="space-y-2 card-body">
            {sequence.steps.slice(0, 4).map((step, index) => {
              const meta = channelMeta(step.channel);
              const Icon = meta.icon;
              const preview =
                step.channel === "task"
                  ? step.taskTitle
                  : step.messageText || step.emailSubject || step.templateName;

              return (
                <div
                  key={step.stepId}
                  className="flex items-start gap-3 rounded-lg border border-subtle bg-surface-muted/50 px-3 py-2.5"
                >
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-surface-elevated text-xs font-bold text-secondary ring-2 ring-default">
                    {index + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                          meta.tone
                        )}
                      >
                        <Icon className="h-3 w-3" />
                        {meta.label}
                      </span>
                      {step.delayMinutes > 0 ? (
                        <span className="text-[10px] text-muted">+{step.delayMinutes}m</span>
                      ) : null}
                    </div>
                    {preview ? (
                      <p className="mt-1 line-clamp-2 text-xs text-secondary">{preview}</p>
                    ) : null}
                  </div>
                </div>
              );
            })}
            {sequence.steps.length > 4 ? (
              <p className="px-1 text-xs text-muted">+{sequence.steps.length - 4}</p>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}
