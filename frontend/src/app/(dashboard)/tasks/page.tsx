"use client";

import { useMemo, useState } from "react";
import {
  AlignLeft,
  ArrowRightCircle,
  AtSign,
  Check,
  CheckSquare,
  ChevronsDown,
  ChevronsUp,
  Equal,
  Plus,
  Settings2,
  Tag,
} from "lucide-react";
import { DashboardPage } from "@/components/layout/DashboardPage";
import { PageHeader } from "@/components/layout/PageHeader";
import { TaskActionsMenu } from "@/components/tasks/TaskActionsMenu";
import { TaskFormModal, type TaskFormValues } from "@/components/tasks/TaskFormModal";
import { TaskWhatsAppReminderSettings } from "@/components/tasks/TaskWhatsAppReminderSettings";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input, Select } from "@/components/ui/Input";
import { SearchInput } from "@/components/ui/SearchInput";
import { SkeletonTable } from "@/components/ui/Skeleton";
import { TableContainer } from "@/components/ui/TableContainer";
import { useAdvisors } from "@/hooks/useAdvisors";
import { useCreateSalesTask, useSalesTasks, useUpdateSalesTask } from "@/hooks/useSales";
import { useTenantRole } from "@/hooks/useTenantRole";
import { useT } from "@/i18n/context";
import { cn } from "@/lib/utils";
import type { SalesTask, SalesTaskPriority } from "@/types";

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
  "bg-[#0052CC] text-white",
  "bg-[#128C7E] text-white",
  "bg-[#0EA5E9] text-white",
  "bg-[#DD2A7B] text-white",
  "bg-[#F58529] text-white",
  "bg-[#14B8A6] text-white",
  "bg-[#EA4335] text-white",
  "bg-[#64748B] text-white",
] as const;

function advisorAvatarTone(name?: string): string {
  const seed = (name?.trim() || "?").toLowerCase();
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return ADVISOR_AVATAR_PALETTE[hash % ADVISOR_AVATAR_PALETTE.length];
}

function formatDueDatePill(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function taskStatusMeta(
  task: SalesTask,
  t: (key: string) => string
): { label: string; className: string } {
  if (task.status === "done") {
    return {
      label: t("tasks.statusDone"),
      className: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200/80",
    };
  }
  if (task.status === "cancelled") {
    return {
      label: t("tasks.statusCancelled"),
      className: "bg-slate-100 text-slate-600 ring-1 ring-slate-200/80",
    };
  }
  if (isOverdue(task)) {
    return {
      label: t("tasks.statusOverdue"),
      className: "bg-rose-50 text-rose-700 ring-1 ring-rose-200/80",
    };
  }
  return {
    label: t("tasks.statusOpen"),
    className: "bg-sky-50 text-sky-800 ring-1 ring-sky-200/80",
  };
}

function taskPriorityMeta(
  priority: SalesTaskPriority | undefined,
  t: (key: string) => string
): { label: string; iconClass: string; Icon: typeof ChevronsUp } {
  switch (priority) {
    case "low":
      return {
        label: t("tasks.priorityLow"),
        iconClass: "text-sky-600",
        Icon: ChevronsDown,
      };
    case "high":
      return {
        label: t("tasks.priorityHigh"),
        iconClass: "text-orange-500",
        Icon: ChevronsUp,
      };
    case "highest":
      return {
        label: t("tasks.priorityHighest"),
        iconClass: "text-rose-600",
        Icon: ChevronsUp,
      };
    case "medium":
    default:
      return {
        label: t("tasks.priorityMedium"),
        iconClass: "text-amber-500",
        Icon: Equal,
      };
  }
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
  const [showWhatsAppSettings, setShowWhatsAppSettings] = useState(false);

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

  const headerAdvisors = useMemo(() => {
    const seen = new Set<string>();
    const list: Array<{ id: string; name: string }> = [];
    for (const task of tasks) {
      if (!task.advisorId || seen.has(task.advisorId)) continue;
      const name = advisorNameById.get(task.advisorId);
      if (!name) continue;
      seen.add(task.advisorId);
      list.push({ id: task.advisorId, name });
      if (list.length >= 5) break;
    }
    return list;
  }, [tasks, advisorNameById]);

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
      ...(values.leadId ? { leadId: values.leadId } : {}),
      ...(values.conversationId ? { conversationId: values.conversationId } : {}),
      ...(values.botId ? { botId: values.botId } : {}),
      ...(values.contactPhone ? { contactPhone: values.contactPhone } : {}),
      ...(values.contactEmail ? { contactEmail: values.contactEmail } : {}),
      ...(values.contactName ? { contactName: values.contactName } : {}),
      priority: values.priority,
      reminderTargets: values.reminderTargets,
      reminderUserIds: values.reminderUserIds,
      reminderExternal: values.reminderExternal,
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
      leadId: values.leadId ?? null,
      priority: values.priority,
      reminderTargets: values.reminderTargets,
      reminderUserIds: values.reminderUserIds,
      reminderExternal: values.reminderExternal,
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
          <div className="flex flex-wrap items-center gap-2">
            {canManageAll ? (
              <Button
                variant="secondary"
                onClick={() => setShowWhatsAppSettings(true)}
              >
                <Settings2 className="h-4 w-4" />
                {t("tasks.whatsappTemplateConfigure")}
              </Button>
            ) : null}
            <Button onClick={() => setShowCreate(true)}>
              <Plus className="h-4 w-4" />
              {t("tasks.newTask")}
            </Button>
          </div>
        }
      />

      <div className="mb-3 flex flex-wrap gap-1.5">
        {filters.map((filter) => (
          <button
            key={filter.id}
            type="button"
            onClick={() => setStatusFilter(filter.id)}
            className={cn(
              "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
              statusFilter === filter.id
                ? "border-accent bg-accent-muted text-accent"
                : "border-default text-secondary hover:bg-surface-muted"
            )}
          >
            {filter.label}
          </button>
        ))}
      </div>

      <div className="mb-3 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
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
        <TableContainer className="overflow-hidden">
          {headerAdvisors.length > 0 ? (
            <div className="flex items-center justify-end border-b border-default px-3 py-2">
              <div className="flex -space-x-1.5">
                {headerAdvisors.map((advisor) => (
                  <span
                    key={advisor.id}
                    title={advisor.name}
                    className={cn(
                      "inline-flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-semibold ring-2 ring-surface",
                      advisorAvatarTone(advisor.name)
                    )}
                  >
                    {advisorInitials(advisor.name)}
                  </span>
                ))}
              </div>
            </div>
          ) : null}

          <div className="overflow-x-auto">
            <table className="min-w-[920px] w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-default text-xs font-semibold uppercase tracking-wide text-muted">
                  <th className="w-12 px-4 py-3" />
                  <th className="px-4 py-3">
                    <span className="inline-flex items-center gap-1.5">
                      <AlignLeft className="h-4 w-4" />
                      {t("tasks.colSummary")}
                    </span>
                  </th>
                  <th className="w-[150px] px-4 py-3">
                    <span className="inline-flex items-center gap-1.5">
                      <ArrowRightCircle className="h-4 w-4" />
                      {t("tasks.colStatus")}
                    </span>
                  </th>
                  <th className="w-[180px] px-4 py-3">
                    <span className="inline-flex items-center gap-1.5">
                      <AtSign className="h-4 w-4" />
                      {t("tasks.colAssignee")}
                    </span>
                  </th>
                  <th className="w-[140px] px-4 py-3">
                    <span className="inline-flex items-center gap-1.5">
                      <Tag className="h-4 w-4" />
                      {t("tasks.colDueDate")}
                    </span>
                  </th>
                  <th className="w-[140px] px-4 py-3">
                    <span className="inline-flex items-center gap-1.5">
                      <ChevronsUp className="h-4 w-4" />
                      {t("tasks.colPriority")}
                    </span>
                  </th>
                  <th className="w-12 px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {tasks.map((task) => {
                  const overdue = isOverdue(task);
                  const advisorName = task.advisorId
                    ? advisorNameById.get(task.advisorId)
                    : undefined;
                  const status = taskStatusMeta(task, t);
                  const priority = taskPriorityMeta(task.priority, t);
                  const PriorityIcon = priority.Icon;
                  const done = task.status === "done";

                  return (
                    <tr
                      key={task.taskId}
                      className="group border-b border-default/70 last:border-b-0 hover:bg-surface-muted/40"
                    >
                      <td className="px-4 py-4 align-middle">
                        <button
                          type="button"
                          aria-label={done ? t("tasks.reopen") : t("tasks.markDone")}
                          disabled={updateTask.isPending || task.status === "cancelled"}
                          onClick={() => void handleToggleComplete(task)}
                          className={cn(
                            "flex h-6 w-6 items-center justify-center rounded-[5px] border transition-colors",
                            done
                              ? "border-[#0052CC] bg-[#0052CC] text-white"
                              : "border-slate-300 bg-surface text-transparent hover:border-[#0052CC]",
                            "disabled:cursor-not-allowed disabled:opacity-50"
                          )}
                        >
                          <Check className="h-4 w-4" strokeWidth={3} />
                        </button>
                      </td>
                      <td className="px-4 py-4 align-middle">
                        <button
                          type="button"
                          onClick={() => setEditingTask(task)}
                          className="flex min-w-0 w-full items-center gap-2.5 text-left"
                          title={task.description || task.title}
                        >
                          <span
                            className={cn(
                              "min-w-0 flex-1 truncate text-base font-medium text-primary transition-colors group-hover:text-accent",
                              done && "text-secondary line-through"
                            )}
                          >
                            {task.title}
                          </span>
                          {typeof task.commentCount === "number" && task.commentCount > 0 ? (
                            <span className="shrink-0 text-xs font-medium text-muted">
                              {t("tasks.commentsCount", { count: task.commentCount })}
                            </span>
                          ) : null}
                        </button>
                      </td>
                      <td className="px-4 py-4 align-middle">
                        <span
                          className={cn(
                            "inline-flex rounded-md px-2.5 py-1 text-xs font-semibold uppercase tracking-wide",
                            status.className
                          )}
                        >
                          {status.label}
                        </span>
                      </td>
                      <td className="px-4 py-4 align-middle">
                        {advisorName ? (
                          <div className="flex min-w-0 items-center gap-2.5">
                            <span
                              className={cn(
                                "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                                advisorAvatarTone(advisorName)
                              )}
                            >
                              {advisorInitials(advisorName)}
                            </span>
                            <span className="truncate text-base text-primary">{advisorName}</span>
                          </div>
                        ) : (
                          <span className="text-base text-muted">{t("tasks.anyAdvisor")}</span>
                        )}
                      </td>
                      <td className="px-4 py-4 align-middle">
                        {task.dueAt ? (
                          <span
                            className={cn(
                              "inline-flex rounded-md bg-slate-100 px-2.5 py-1 text-sm font-medium text-slate-700",
                              overdue && "bg-rose-50 text-rose-700"
                            )}
                            title={new Date(task.dueAt).toLocaleString()}
                          >
                            {formatDueDatePill(task.dueAt)}
                          </span>
                        ) : (
                          <span className="text-sm text-muted">{t("tasks.noDueDate")}</span>
                        )}
                      </td>
                      <td className="px-4 py-4 align-middle">
                        <span className="inline-flex items-center gap-2 text-base text-primary">
                          <PriorityIcon className={cn("h-5 w-5", priority.iconClass)} />
                          {priority.label}
                        </span>
                      </td>
                      <td className="px-4 py-4 align-middle">
                        <TaskActionsMenu
                          status={task.status}
                          busy={updateTask.isPending}
                          onEdit={() => setEditingTask(task)}
                          onToggleComplete={() => void handleToggleComplete(task)}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="border-t border-default px-4 py-3">
            <button
              type="button"
              onClick={() => setShowCreate(true)}
              className="inline-flex items-center gap-2 rounded-md px-2.5 py-2 text-base font-semibold text-[#0052CC] transition-colors hover:bg-sky-50"
            >
              <Plus className="h-5 w-5" />
              {t("tasks.createRow")}
            </button>
          </div>
        </TableContainer>
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

      <TaskWhatsAppReminderSettings
        open={showWhatsAppSettings}
        onClose={() => setShowWhatsAppSettings(false)}
      />
    </DashboardPage>
  );
}
