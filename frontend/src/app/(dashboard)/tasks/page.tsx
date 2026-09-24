"use client";

import { useMemo, useState } from "react";
import {
  Bell,
  Calendar,
  CheckSquare,
  Clock,
  Mail,
  MessageCircle,
  Plus,
} from "lucide-react";
import { DashboardPage } from "@/components/layout/DashboardPage";
import { PageHeader } from "@/components/layout/PageHeader";
import { TaskActionsMenu } from "@/components/tasks/TaskActionsMenu";
import { TaskCommentsPanel } from "@/components/tasks/TaskCommentsPanel";
import { TaskFormModal, type TaskFormValues } from "@/components/tasks/TaskFormModal";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input, Select } from "@/components/ui/Input";
import { SearchInput } from "@/components/ui/SearchInput";
import { SkeletonTable } from "@/components/ui/Skeleton";
import { useAdvisors } from "@/hooks/useAdvisors";
import { useCreateSalesTask, useSalesTasks, useUpdateSalesTask } from "@/hooks/useSales";
import { useTenantRole } from "@/hooks/useTenantRole";
import { useT } from "@/i18n/context";
import { cn } from "@/lib/utils";
import type { SalesTask } from "@/types";

type StatusFilter = "open" | "today" | "overdue" | "done" | "all";

function startOfDayIso(date = new Date()): string {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function endOfDayIso(date = new Date()): string {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d.toISOString();
}

function isOverdue(task: SalesTask): boolean {
  return task.status === "open" && !!task.dueAt && new Date(task.dueAt).getTime() < Date.now();
}

function isDueToday(task: SalesTask): boolean {
  if (!task.dueAt || task.status !== "open") return false;
  const due = new Date(task.dueAt);
  const now = new Date();
  return (
    due.getFullYear() === now.getFullYear() &&
    due.getMonth() === now.getMonth() &&
    due.getDate() === now.getDate()
  );
}

function fromDateStart(value: string): string | undefined {
  if (!value) return undefined;
  return new Date(`${value}T00:00:00`).toISOString();
}

function fromDateEnd(value: string): string | undefined {
  if (!value) return undefined;
  return new Date(`${value}T23:59:59.999`).toISOString();
}

function advisorInitials(name?: string): string {
  if (!name?.trim()) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

const ADVISOR_AVATAR_PALETTE = [
  "bg-[#0084FF] text-white",
  "bg-[#128C7E] text-white",
  "bg-[#7C3AED] text-white",
  "bg-[#DD2A7B] text-white",
  "bg-[#F58529] text-white",
  "bg-[#0EA5E9] text-white",
  "bg-[#14B8A6] text-white",
  "bg-[#EA4335] text-white",
] as const;

function advisorAvatarTone(name?: string): string {
  const seed = (name?.trim() || "?").toLowerCase();
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return ADVISOR_AVATAR_PALETTE[hash % ADVISOR_AVATAR_PALETTE.length];
}

export default function TasksPage() {
  const t = useT();
  const { isMember, isSupervisor } = useTenantRole();
  const canManageAll = isMember || isSupervisor;
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("open");
  const [advisorFilter, setAdvisorFilter] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [q, setQ] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [editingTask, setEditingTask] = useState<SalesTask | null>(null);
  const [expandedCommentsTaskId, setExpandedCommentsTaskId] = useState<string | null>(null);

  const queryStatus =
    statusFilter === "done" ? "done" : statusFilter === "all" ? undefined : "open";

  const queryFrom =
    statusFilter === "today"
      ? startOfDayIso()
      : statusFilter === "overdue"
        ? undefined
        : fromDateStart(fromDate);
  const queryTo =
    statusFilter === "today"
      ? endOfDayIso()
      : statusFilter === "overdue"
        ? new Date().toISOString()
        : fromDateEnd(toDate);

  const { data, isLoading } = useSalesTasks({
    ...(queryStatus ? { status: queryStatus } : {}),
    ...(canManageAll && advisorFilter ? { advisorId: advisorFilter } : {}),
    ...(queryFrom ? { from: queryFrom } : {}),
    ...(queryTo ? { to: queryTo } : {}),
    ...(q.trim() ? { q: q.trim() } : {}),
  });
  const { data: advisors } = useAdvisors();
  const createTask = useCreateSalesTask();
  const updateTask = useUpdateSalesTask();

  const advisorNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const advisor of advisors ?? []) {
      map.set(advisor.advisorId, advisor.name);
    }
    return map;
  }, [advisors]);

  const tasks = useMemo(() => {
    const items = data?.items ?? [];
    if (statusFilter === "overdue") {
      return items.filter(isOverdue);
    }
    if (statusFilter === "today") {
      return items.filter(isDueToday);
    }
    return items;
  }, [data?.items, statusFilter]);

  const filters: Array<{ id: StatusFilter; label: string }> = [
    { id: "open", label: t("tasks.filterOpen") },
    { id: "today", label: t("tasks.filterToday") },
    { id: "overdue", label: t("tasks.filterOverdue") },
    { id: "done", label: t("tasks.filterDone") },
    { id: "all", label: t("tasks.filterAll") },
  ];

  async function handleCreate(values: TaskFormValues) {
    await createTask.mutateAsync({
      title: values.title,
      ...(values.description ? { description: values.description } : {}),
      ...(values.dueAt ? { dueAt: values.dueAt } : {}),
      ...(values.advisorId ? { advisorId: values.advisorId } : {}),
      ...(values.conversationId ? { conversationId: values.conversationId } : {}),
      ...(values.botId ? { botId: values.botId } : {}),
      ...(values.contactPhone ? { contactPhone: values.contactPhone } : {}),
      ...(values.contactEmail ? { contactEmail: values.contactEmail } : {}),
      ...(values.contactName ? { contactName: values.contactName } : {}),
      reminderTargets: values.reminderTargets,
      reminderChannels: values.reminderChannels,
      reminderMinutesBefore: values.reminderMinutesBefore,
    });
    setShowCreate(false);
  }

  async function handleEdit(values: TaskFormValues) {
    if (!editingTask) return;
    await updateTask.mutateAsync({
      taskId: editingTask.taskId,
      title: values.title,
      description: values.description ?? "",
      dueAt: values.dueAt ?? null,
      ...(values.advisorId ? { advisorId: values.advisorId } : {}),
      reminderTargets: values.reminderTargets,
      reminderChannels: values.reminderChannels,
      reminderMinutesBefore: values.reminderMinutesBefore,
    });
    setEditingTask(null);
  }

  async function handleToggleComplete(task: SalesTask) {
    await updateTask.mutateAsync({
      taskId: task.taskId,
      status: task.status === "done" ? "open" : "done",
    });
  }

  return (
    <DashboardPage>
      <PageHeader
        title={t("tasks.title")}
        subtitle={t("tasks.subtitle")}
        actions={
          <Button onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4" />
            {t("tasks.newTask")}
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap gap-2">
        {filters.map((filter) => (
          <button
            key={filter.id}
            type="button"
            onClick={() => setStatusFilter(filter.id)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
              statusFilter === filter.id
                ? "border-accent bg-accent-muted text-accent"
                : "border-default text-secondary hover:bg-surface-muted"
            )}
          >
            {filter.label}
          </button>
        ))}
      </div>

      <div className="mb-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <SearchInput
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onClear={() => setQ("")}
          placeholder={t("tasks.searchPlaceholder")}
        />
        <Input
          type="date"
          value={fromDate}
          onChange={(e) => setFromDate(e.target.value)}
          aria-label={t("tasks.fromDate")}
        />
        <Input
          type="date"
          value={toDate}
          onChange={(e) => setToDate(e.target.value)}
          aria-label={t("tasks.toDate")}
        />
        {canManageAll ? (
          <Select value={advisorFilter} onChange={(e) => setAdvisorFilter(e.target.value)}>
            <option value="">{t("tasks.allAdvisors")}</option>
            {(advisors ?? []).map((advisor) => (
              <option key={advisor.advisorId} value={advisor.advisorId}>
                {advisor.name}
              </option>
            ))}
          </Select>
        ) : null}
      </div>

      {isLoading ? (
        <SkeletonTable rows={6} />
      ) : tasks.length === 0 ? (
        <EmptyState
          icon={<CheckSquare className="h-6 w-6" />}
          title={t("tasks.emptyTitle")}
          description={t("tasks.emptyDescription")}
        />
      ) : (
        <div className="space-y-3">
          {tasks.map((task) => {
            const overdue = isOverdue(task);
            const advisorName = task.advisorId
              ? advisorNameById.get(task.advisorId)
              : undefined;

            return (
              <div
                key={task.taskId}
                className={cn(
                  "content-card p-4 transition-all duration-150 hover:shadow-md",
                  overdue && "border-danger/25 bg-danger/[0.03]"
                )}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex min-w-0 flex-1 gap-3">
                    <div
                      className={cn(
                        "mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                        advisorName
                          ? advisorAvatarTone(advisorName)
                          : overdue
                            ? "bg-danger/15 text-danger"
                            : "bg-accent-muted text-accent"
                      )}
                      title={advisorName ?? t("tasks.anyAdvisor")}
                    >
                      {advisorName ? (
                        advisorInitials(advisorName)
                      ) : (
                        <CheckSquare className="h-5 w-5" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3
                          className={cn(
                            "font-semibold text-primary",
                            task.status === "done" && "text-secondary line-through"
                          )}
                        >
                          {task.title}
                        </h3>
                        {overdue ? (
                          <Badge variant="danger" dot>
                            {t("tasks.filterOverdue")}
                          </Badge>
                        ) : null}
                        {task.status === "done" ? (
                          <Badge variant="success" dot>
                            {t("tasks.filterDone")}
                          </Badge>
                        ) : null}
                      </div>
                      {task.description ? (
                        <p className="mt-1 text-sm leading-relaxed text-secondary">
                          {task.description}
                        </p>
                      ) : null}
                      <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted">
                        {task.dueAt ? (
                          <span
                            className={cn(
                              "inline-flex items-center gap-1.5 font-medium",
                              overdue ? "text-danger" : "text-muted"
                            )}
                          >
                            <Clock className="h-3.5 w-3.5" />
                            {new Date(task.dueAt).toLocaleString()}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5">
                            <Calendar className="h-3.5 w-3.5" />
                            {t("tasks.noDueDate")}
                          </span>
                        )}
                        {advisorName ? (
                          <span className="inline-flex items-center gap-1.5 font-medium text-secondary">
                            {advisorName}
                          </span>
                        ) : null}
                        {task.contactName || task.contactPhone ? (
                          <span>
                            {[task.contactName, task.contactPhone].filter(Boolean).join(" · ")}
                          </span>
                        ) : null}
                        {(task.reminderChannels ?? []).includes("email") ? (
                          <span className="inline-flex items-center gap-1">
                            <Mail className="h-3.5 w-3.5" />
                            {t("tasks.channel.email")}
                          </span>
                        ) : null}
                        {(task.reminderChannels ?? []).includes("whatsapp") ? (
                          <span className="inline-flex items-center gap-1">
                            <MessageCircle className="h-3.5 w-3.5" />
                            {t("tasks.channel.whatsapp")}
                          </span>
                        ) : null}
                        {(task.reminderChannels ?? []).includes("platform") ? (
                          <span className="inline-flex items-center gap-1">
                            <Bell className="h-3.5 w-3.5" />
                            {t("tasks.channel.platform")}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>
                  <TaskActionsMenu
                    status={task.status}
                    commentCount={task.commentCount}
                    busy={updateTask.isPending}
                    onEdit={() => setEditingTask(task)}
                    onComments={() =>
                      setExpandedCommentsTaskId((prev) =>
                        prev === task.taskId ? null : task.taskId
                      )
                    }
                    onToggleComplete={() => void handleToggleComplete(task)}
                  />
                </div>
                {expandedCommentsTaskId === task.taskId ? (
                  <TaskCommentsPanel taskId={task.taskId} />
                ) : null}
              </div>
            );
          })}
        </div>
      )}

      {showCreate ? (
        <TaskFormModal
          onClose={() => setShowCreate(false)}
          onSubmit={handleCreate}
          advisors={advisors ?? []}
          showAdvisorSelect={canManageAll}
          submitting={createTask.isPending}
        />
      ) : null}

      {editingTask ? (
        <TaskFormModal
          mode="edit"
          task={editingTask}
          onClose={() => setEditingTask(null)}
          onSubmit={handleEdit}
          advisors={advisors ?? []}
          showAdvisorSelect={canManageAll}
          submitting={updateTask.isPending}
        />
      ) : null}
    </DashboardPage>
  );
}
