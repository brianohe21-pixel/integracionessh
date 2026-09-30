"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Bot, CheckSquare, Mail, MessageSquare, Phone, User, X } from "lucide-react";
import { useT } from "@/i18n/context";
import { useBots } from "@/hooks/useBots";
import { useAdvisors } from "@/hooks/useAdvisors";
import { useTenantRole } from "@/hooks/useTenantRole";
import {
  useConvertLead,
  useLoseLead,
  useUpdateLead,
} from "@/hooks/useLeads";
import { useCreateSalesTask, useSalesTasks } from "@/hooks/useSales";
import { TaskFormModal, type TaskFormValues } from "@/components/tasks/TaskFormModal";
import { SideDrawer } from "@/components/ui/SideDrawer";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Select, Textarea } from "@/components/ui/Input";
import { useFormatters } from "@/hooks/useFormatters";
import type { Lead, LeadStatus, SalesTask } from "@/types";

const TASK_HISTORY_PREVIEW_LIMIT = 5;

function taskStatusVariant(status: SalesTask["status"]): "success" | "danger" | "default" | "warning" {
  if (status === "done") return "success";
  if (status === "cancelled") return "danger";
  return "warning";
}

function taskStatusLabelKey(status: SalesTask["status"]): "tasks.statusOpen" | "tasks.statusDone" | "tasks.statusCancelled" {
  if (status === "done") return "tasks.statusDone";
  if (status === "cancelled") return "tasks.statusCancelled";
  return "tasks.statusOpen";
}

function LeadTaskHistoryList({
  tasks,
  formatDate,
  t,
}: {
  tasks: SalesTask[];
  formatDate: (value: string) => string;
  t: (key: string) => string;
}) {
  return (
    <div className="relative space-y-0">
      <div className="absolute left-[7px] top-2 bottom-2 w-px bg-default" />
      {tasks.map((task) => (
        <div key={task.taskId} className="relative flex gap-3 pb-4 last:pb-0">
          <div className="relative z-10 mt-1.5 h-3.5 w-3.5 shrink-0 rounded-full border-2 border-accent bg-surface" />
          <div className="min-w-0 flex-1 rounded-lg border border-default p-3">
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-medium text-primary">{task.title}</p>
              <Badge variant={taskStatusVariant(task.status)}>
                {t(taskStatusLabelKey(task.status))}
              </Badge>
            </div>
            {task.description ? (
              <p className="mt-1 text-sm text-secondary">{task.description}</p>
            ) : null}
            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted">
              <span>{formatDate(task.createdAt)}</span>
              {task.dueAt ? (
                <span>
                  {t("tasks.dueAt")}: {formatDate(task.dueAt)}
                </span>
              ) : null}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function statusVariant(status: LeadStatus): "success" | "warning" | "danger" | "default" | "info" {
  if (status === "converted") return "success";
  if (status === "lost") return "danger";
  if (status === "qualified") return "info";
  if (status === "contacted") return "warning";
  return "default";
}

function leadInitials(name?: string, phone?: string): string {
  if (name?.trim()) {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return name.slice(0, 2).toUpperCase();
  }
  return phone?.slice(-2) ?? "?";
}

export function LeadDetailPanel({
  lead,
  onClose,
}: {
  lead: Lead;
  onClose: () => void;
}) {
  const t = useT();
  const { formatDate } = useFormatters();
  const { isAdvisor } = useTenantRole();
  const { data: bots } = useBots({ enabled: !isAdvisor });
  const { data: advisors } = useAdvisors();
  const updateLead = useUpdateLead();
  const convertLead = useConvertLead();
  const loseLead = useLoseLead();
  const createTask = useCreateSalesTask();
  const { data: tasksData, isLoading: tasksLoading } = useSalesTasks();
  const [notes, setNotes] = useState(lead.notes ?? "");
  const [optInOnConvert, setOptInOnConvert] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [showTaskHistoryModal, setShowTaskHistoryModal] = useState(false);

  const leadTasks = useMemo(
    () =>
      (tasksData?.items ?? [])
        .filter((task) => task.leadId === lead.leadId)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [tasksData?.items, lead.leadId]
  );
  const hasMoreTasks = leadTasks.length > TASK_HISTORY_PREVIEW_LIMIT;
  const previewTasks = hasMoreTasks
    ? leadTasks.slice(0, TASK_HISTORY_PREVIEW_LIMIT)
    : leadTasks;

  const botName = bots?.find((b) => b.botId === lead.botId)?.name ?? lead.botId;
  const isClosed = lead.status === "converted" || lead.status === "lost";
  const initials = leadInitials(lead.name, lead.phone);
  const title = lead.name?.trim() || lead.phone;
  const conversationHref = isAdvisor
    ? `/inbox?botId=${lead.botId}&phone=${encodeURIComponent(lead.phone)}`
    : `/conversations?botId=${lead.botId}&phone=${encodeURIComponent(lead.phone)}`;
  const assignedAdvisorName =
    advisors?.find((a) => a.advisorId === lead.assignedAdvisorId)?.name ??
    (lead.assignedAdvisorId ? lead.assignedAdvisorId : t("leads.unassigned"));

  async function saveNotes() {
    setError("");
    setSaved(false);
    try {
      await updateLead.mutateAsync({ leadId: lead.leadId, notes });
      setSaved(true);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function handleConvert() {
    setError("");
    try {
      await convertLead.mutateAsync({
        leadId: lead.leadId,
        ...(optInOnConvert ? { marketingConsent: "opt_in" } : {}),
      });
      onClose();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function handleLose() {
    setError("");
    try {
      await loseLead.mutateAsync(lead.leadId);
      onClose();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function handleCreateTask(values: TaskFormValues) {
    setError("");
    try {
      await createTask.mutateAsync({
        title: values.title,
        ...(values.description ? { description: values.description } : {}),
        ...(values.dueAt ? { dueAt: values.dueAt } : {}),
        ...(values.advisorId
          ? { advisorId: values.advisorId }
          : lead.assignedAdvisorId
            ? { advisorId: lead.assignedAdvisorId }
            : {}),
        leadId: lead.leadId,
        ...(lead.conversationId ? { conversationId: lead.conversationId } : {}),
        botId: lead.botId,
        contactPhone: values.contactPhone || lead.phone,
        ...(values.contactEmail || lead.email
          ? { contactEmail: values.contactEmail || lead.email }
          : {}),
        ...(values.contactName || lead.name
          ? { contactName: values.contactName || lead.name }
          : {}),
        reminderTargets: values.reminderTargets,
        reminderUserIds: values.reminderUserIds,
        reminderExternal: values.reminderExternal,
        reminderChannels: values.reminderChannels,
        reminderMinutesBefore: values.reminderMinutesBefore,
        priority: values.priority,
      });
      setShowTaskModal(false);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <>
      <SideDrawer
        title={title}
        onClose={onClose}
        footer={
          !isClosed ? (
            <div className="space-y-3">
              <label className="flex items-center gap-2 text-sm text-secondary">
                <input
                  type="checkbox"
                  checked={optInOnConvert}
                  onChange={(e) => setOptInOnConvert(e.target.checked)}
                  className="rounded border-default"
                />
                {t("leads.optInOnConvert")}
              </label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  className="flex-1"
                  onClick={handleConvert}
                  disabled={convertLead.isPending}
                >
                  {t("leads.convert")}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={handleLose}
                  disabled={loseLead.isPending}
                >
                  {t("leads.markLost")}
                </Button>
              </div>
            </div>
          ) : undefined
        }
      >
        <div className="space-y-6 p-5">
          <div className="flex flex-col items-center text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-accent-muted text-lg font-semibold text-accent">
              {initials}
            </div>
            <p className="mt-3 font-mono text-sm text-secondary">{lead.phone}</p>
            <div className="mt-2 flex flex-wrap justify-center gap-1.5">
              <Badge variant={statusVariant(lead.status)}>
                {t(`leads.status_${lead.status}`)}
              </Badge>
              {lead.tags.map((tag) => (
                <Badge key={tag} variant="default">{tag}</Badge>
              ))}
            </div>
            <p className="mt-2 text-xs text-muted">{formatDate(lead.createdAt)}</p>
          </div>

          <div className="rounded-xl border border-default bg-surface p-4 space-y-3 text-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-secondary">
              {t("leads.sectionInfo")}
            </p>
            <div className="flex items-start gap-3">
              <Phone className="mt-0.5 h-4 w-4 shrink-0 text-muted" />
              <div>
                <p className="text-secondary">{t("common.phone")}</p>
                <p className="font-mono text-primary">{lead.phone}</p>
              </div>
            </div>
            {lead.name && (
              <div className="flex items-start gap-3">
                <User className="mt-0.5 h-4 w-4 shrink-0 text-muted" />
                <div>
                  <p className="text-secondary">{t("leads.colName")}</p>
                  <p className="text-primary">{lead.name}</p>
                </div>
              </div>
            )}
            {lead.email && (
              <div className="flex items-start gap-3">
                <Mail className="mt-0.5 h-4 w-4 shrink-0 text-muted" />
                <div>
                  <p className="text-secondary">{t("common.email")}</p>
                  <p className="text-primary">{lead.email}</p>
                </div>
              </div>
            )}
            {!isAdvisor ? (
              <div className="flex items-start gap-3">
                <Bot className="mt-0.5 h-4 w-4 shrink-0 text-muted" />
                <div>
                  <p className="text-secondary">{t("leads.colBot")}</p>
                  <p className="text-primary">{botName}</p>
                </div>
              </div>
            ) : null}
          </div>

          <div className="rounded-xl border border-default bg-surface p-4 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-secondary">
              {t("leads.assignedAdvisor")}
            </p>
            {isAdvisor ? (
              <p className="text-sm text-primary">{assignedAdvisorName}</p>
            ) : (
              <Select
                value={lead.assignedAdvisorId ?? ""}
                disabled={isClosed}
                onChange={(e) =>
                  updateLead.mutate({
                    leadId: lead.leadId,
                    assignedAdvisorId: e.target.value || null,
                  })
                }
              >
                <option value="">{t("leads.unassigned")}</option>
                {(advisors ?? []).map((a) => (
                  <option key={a.advisorId} value={a.advisorId}>{a.name}</option>
                ))}
              </Select>
            )}
          </div>

          <div className="rounded-xl border border-default bg-surface p-4 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-secondary">
              {t("leads.notes")}
            </p>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={isClosed}
              rows={4}
            />
            {!isClosed && (
              <div className="flex items-center gap-2">
                <Button type="button" size="sm" onClick={saveNotes} disabled={updateLead.isPending}>
                  {t("common.save")}
                </Button>
                {saved && <span className="text-xs text-success">{t("leads.saved")}</span>}
              </div>
            )}
          </div>

          <div className="rounded-xl border border-default bg-surface p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-secondary">
                {t("leads.taskHistory")}
              </p>
              <button
                type="button"
                onClick={() => setShowTaskModal(true)}
                className="inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:underline"
              >
                <CheckSquare className="h-4 w-4" />
                {t("leads.createTask")}
              </button>
            </div>
            {tasksLoading ? (
              <p className="text-sm text-muted">{t("common.loading")}</p>
            ) : leadTasks.length === 0 ? (
              <p className="text-sm text-secondary">{t("leads.noTaskHistory")}</p>
            ) : (
              <div className="space-y-3">
                <LeadTaskHistoryList tasks={previewTasks} formatDate={formatDate} t={t} />
                {hasMoreTasks ? (
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="w-full"
                    onClick={() => setShowTaskHistoryModal(true)}
                  >
                    {t("leads.viewAllTasks", { count: leadTasks.length })}
                  </Button>
                ) : null}
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href={conversationHref}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:underline"
            >
              <MessageSquare className="h-4 w-4" />
              {t("leads.openConversation")}
            </Link>
            {lead.status === "converted" && !isAdvisor ? (
              <Link
                href={`/contacts?q=${encodeURIComponent(lead.phone)}`}
                className="text-sm font-medium text-accent hover:underline"
              >
                {t("leads.viewContact")}
              </Link>
            ) : null}
          </div>

          {error && <p className="text-sm text-danger">{error}</p>}
        </div>
      </SideDrawer>

      {showTaskModal ? (
        <TaskFormModal
          onClose={() => setShowTaskModal(false)}
          submitting={createTask.isPending}
          advisors={advisors ?? []}
          showAdvisorSelect={!isAdvisor}
          defaults={{
            leadId: lead.leadId,
            conversationId: lead.conversationId,
            botId: lead.botId,
            advisorId: lead.assignedAdvisorId,
            contactPhone: lead.phone,
            contactEmail: lead.email,
            contactName: lead.name,
            reminderTargets: ["advisor"],
            reminderChannels: ["email", "whatsapp"],
            reminderMinutesBefore: 60,
          }}
          onSubmit={handleCreateTask}
        />
      ) : null}

      {showTaskHistoryModal ? (
        <Modal>
          <div className="mx-4 flex max-h-[85vh] w-full max-w-lg flex-col rounded-2xl bg-surface-elevated shadow-xl">
            <div className="flex items-center justify-between border-b border-default px-6 py-4">
              <h2 className="text-lg font-semibold text-primary">{t("leads.taskHistory")}</h2>
              <button
                type="button"
                onClick={() => setShowTaskHistoryModal(false)}
                className="text-muted hover:text-secondary"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="overflow-y-auto px-6 py-5">
              <LeadTaskHistoryList tasks={leadTasks} formatDate={formatDate} t={t} />
            </div>
          </div>
        </Modal>
      ) : null}
    </>
  );
}
