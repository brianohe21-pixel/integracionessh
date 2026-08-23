"use client";

import { Calendar, CheckCircle2, CheckSquare, Clock } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { cn } from "@/lib/utils";
import type { SalesTask } from "@/types";

interface SalesTasksListProps {
  tasks: SalesTask[];
  emptyTitle: string;
  emptyDescription: string;
  dueLabel: string;
  markDoneLabel: string;
  onComplete: (taskId: string) => void;
}

function isOverdue(dueAt?: string): boolean {
  if (!dueAt) return false;
  return new Date(dueAt).getTime() < Date.now();
}

export function SalesTasksList({
  tasks,
  emptyTitle,
  emptyDescription,
  dueLabel,
  markDoneLabel,
  onComplete,
}: SalesTasksListProps) {
  if (tasks.length === 0) {
    return (
      <EmptyState
        icon={<CheckSquare className="h-6 w-6" />}
        title={emptyTitle}
        description={emptyDescription}
      />
    );
  }

  return (
    <div className="space-y-3">
      {tasks.map((task) => {
        const overdue = isOverdue(task.dueAt);

        return (
          <div
            key={task.taskId}
            className={cn(
              "content-card flex items-start justify-between gap-4 p-4 transition-all duration-150 hover:shadow-md",
              overdue && "border-danger/25 bg-danger/[0.03]"
            )}
          >
            <div className="flex min-w-0 flex-1 gap-3">
              <div
                className={cn(
                  "mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
                  overdue ? "bg-danger/15 text-danger" : "bg-accent-muted text-accent"
                )}
              >
                <CheckSquare className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-semibold text-primary">{task.title}</h3>
                  {overdue ? (
                    <Badge variant="danger" dot>
                      {dueLabel}
                    </Badge>
                  ) : null}
                </div>
                {task.description ? (
                  <p className="mt-1 text-sm leading-relaxed text-secondary">{task.description}</p>
                ) : null}
                {task.dueAt ? (
                  <p
                    className={cn(
                      "mt-2 inline-flex items-center gap-1.5 text-xs font-medium",
                      overdue ? "text-danger" : "text-muted"
                    )}
                  >
                    {overdue ? (
                      <Clock className="h-3.5 w-3.5" />
                    ) : (
                      <Calendar className="h-3.5 w-3.5" />
                    )}
                    {dueLabel}: {new Date(task.dueAt).toLocaleString()}
                  </p>
                ) : null}
              </div>
            </div>
            <Button
              variant="secondary"
              size="sm"
              className="shrink-0"
              onClick={() => onComplete(task.taskId)}
            >
              <CheckCircle2 className="h-4 w-4 text-success" />
              {markDoneLabel}
            </Button>
          </div>
        );
      })}
    </div>
  );
}
