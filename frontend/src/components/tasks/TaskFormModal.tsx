"use client";

import { useMemo, useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input, Select, Textarea } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { TaskTimePicker } from "@/components/tasks/TaskTimePicker";
import { TaskCommentsPanel } from "@/components/tasks/TaskCommentsPanel";
import { useLeads, useLead } from "@/hooks/useLeads";
import { useTenantMembers } from "@/hooks/useTenantMembers";
import { useT } from "@/i18n/context";
import type {
  Advisor,
  Lead,
  SalesTask,
  SalesTaskPriority,
  SalesTaskReminderChannel,
  SalesTaskReminderExternal,
  SalesTaskReminderTarget,
} from "@/types";

export type TaskFormValues = {
  title: string;
  description?: string;
  dueAt?: string | null;
  advisorId?: string;
  leadId?: string | null;
  conversationId?: string;
  botId?: string;
  contactPhone?: string;
  contactEmail?: string;
  contactName?: string;
  priority: SalesTaskPriority;
  reminderTargets: SalesTaskReminderTarget[];
  reminderUserIds: string[];
  reminderExternal: SalesTaskReminderExternal | null;
  reminderChannels: SalesTaskReminderChannel[];
  reminderMinutesBefore: number;
};

type Props = {
  onClose: () => void;
  onSubmit: (values: TaskFormValues) => Promise<void>;
  advisors?: Advisor[];
  showAdvisorSelect?: boolean;
  defaults?: Partial<TaskFormValues>;
  task?: SalesTask | null;
  mode?: "create" | "edit";
  submitting?: boolean;
};

function toLocalInputValue(iso?: string): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function fromLocalInputValue(value: string): string | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toISOString();
}

function splitLocalDateTime(value: string): { date: string; time: string } {
  if (!value.includes("T")) return { date: "", time: "" };
  const [date, time = ""] = value.split("T");
  return { date: date ?? "", time: time.slice(0, 5) };
}

function joinLocalDateTime(date: string, time: string): string {
  if (!date) return "";
  return `${date}T${time || "09:00"}`;
}

function roundToQuarterHour(time: string): string {
  const match = /^(\d{2}):(\d{2})$/.exec(time);
  if (!match) return "09:00";
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  const rounded = Math.round(minutes / 15) * 15;
  if (rounded === 60) {
    return `${String((hours + 1) % 24).padStart(2, "0")}:00`;
  }
  return `${String(hours).padStart(2, "0")}:${String(rounded).padStart(2, "0")}`;
}

function toggleValue<T extends string>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}

const DESCRIPTION_CHIP_KEYS = [
  "followUp",
  "callBack",
  "sendQuote",
  "confirmMeeting",
  "requestDocs",
  "checkPayment",
] as const;

type DescriptionChipKey = (typeof DESCRIPTION_CHIP_KEYS)[number];

const REMINDER_CHANNELS: SalesTaskReminderChannel[] = ["email", "whatsapp", "platform"];
const TASK_PRIORITIES: SalesTaskPriority[] = ["low", "medium", "high", "highest"];

function appendDescriptionChip(current: string, chip: string): string {
  const trimmed = current.trim();
  if (!trimmed) return chip;
  if (trimmed.toLowerCase().includes(chip.toLowerCase())) return trimmed;
  return `${trimmed}\n${chip}`;
}

function leadLabel(lead: Lead): string {
  const name = lead.name?.trim() || lead.phone;
  return lead.name?.trim() ? `${name} · ${lead.phone}` : name;
}

function defaultsFromTask(task?: SalesTask | null): Partial<TaskFormValues> {
  if (!task) return {};
  return {
    title: task.title,
    ...(task.description ? { description: task.description } : {}),
    ...(task.dueAt ? { dueAt: task.dueAt } : {}),
    ...(task.advisorId ? { advisorId: task.advisorId } : {}),
    ...(task.leadId ? { leadId: task.leadId } : {}),
    ...(task.conversationId ? { conversationId: task.conversationId } : {}),
    ...(task.botId ? { botId: task.botId } : {}),
    ...(task.contactPhone ? { contactPhone: task.contactPhone } : {}),
    ...(task.contactEmail ? { contactEmail: task.contactEmail } : {}),
    ...(task.contactName ? { contactName: task.contactName } : {}),
    priority: task.priority ?? "medium",
    reminderTargets: task.reminderTargets ?? ["advisor"],
    reminderUserIds: task.reminderUserIds ?? [],
    reminderExternal: task.reminderExternal ?? null,
    reminderChannels: task.reminderChannels ?? ["email"],
    reminderMinutesBefore: task.reminderMinutesBefore ?? 60,
  };
}

export function TaskFormModal({
  onClose,
  onSubmit,
  advisors = [],
  showAdvisorSelect = false,
  defaults,
  task,
  mode = "create",
  submitting = false,
}: Props) {
  const t = useT();
  const initial = { ...defaultsFromTask(task), ...defaults };
  const [title, setTitle] = useState(initial.title ?? "");
  const [description, setDescription] = useState(initial.description ?? "");
  const initialDue = splitLocalDateTime(toLocalInputValue(initial.dueAt ?? undefined));
  const [dueDate, setDueDate] = useState(initialDue.date);
  const [dueTime, setDueTime] = useState(
    initialDue.time ? roundToQuarterHour(initialDue.time) : "09:00"
  );
  const [advisorId, setAdvisorId] = useState(initial.advisorId ?? "");
  const [leadId, setLeadId] = useState(initial.leadId ?? "");
  const [contactPhone, setContactPhone] = useState(initial.contactPhone ?? "");
  const [contactEmail, setContactEmail] = useState(initial.contactEmail ?? "");
  const [contactName, setContactName] = useState(initial.contactName ?? "");
  const [priority, setPriority] = useState<SalesTaskPriority>(initial.priority ?? "medium");
  const [reminderTargets, setReminderTargets] = useState<SalesTaskReminderTarget[]>(
    initial.reminderTargets ?? ["advisor"]
  );
  const [reminderUserIds, setReminderUserIds] = useState<string[]>(
    initial.reminderUserIds ?? []
  );
  const [externalEmail, setExternalEmail] = useState(
    initial.reminderExternal?.email ?? ""
  );
  const [externalWhatsapp, setExternalWhatsapp] = useState(
    initial.reminderExternal?.whatsapp ?? ""
  );
  const [reminderChannels, setReminderChannels] = useState<SalesTaskReminderChannel[]>(
    initial.reminderChannels ?? ["email"]
  );
  const [reminderMinutesBefore, setReminderMinutesBefore] = useState(
    initial.reminderMinutesBefore ?? 60
  );

  const { data: leadsData } = useLeads();
  const { data: selectedLead } = useLead(leadId || null);
  const { data: membersData } = useTenantMembers();
  const tenantMembers = useMemo(
    () => (membersData?.members ?? []).filter((member) => member.enabled),
    [membersData?.members]
  );
  const leads = useMemo(() => {
    const byId = new Map<string, Lead>();
    for (const lead of leadsData?.items ?? []) {
      if (!lead.leadId || byId.has(lead.leadId)) continue;
      byId.set(lead.leadId, lead);
    }
    if (selectedLead?.leadId && !byId.has(selectedLead.leadId)) {
      byId.set(selectedLead.leadId, selectedLead);
    }
    return Array.from(byId.values());
  }, [leadsData?.items, selectedLead]);

  const canSubmit = title.trim().length > 0 && !submitting;
  const isEdit = mode === "edit";
  const hasReminderRecipients =
    reminderTargets.length > 0 ||
    reminderUserIds.length > 0 ||
    Boolean(externalEmail.trim() || externalWhatsapp.trim()) ||
    reminderChannels.includes("platform");

  const minutesOptions = useMemo(
    () => [
      { value: 15, label: t("tasks.minutesBefore", { count: 15 }) },
      { value: 30, label: t("tasks.minutesBefore", { count: 30 }) },
      { value: 60, label: t("tasks.minutesBefore", { count: 60 }) },
      { value: 120, label: t("tasks.minutesBefore", { count: 120 }) },
      { value: 1440, label: t("tasks.hoursBefore", { count: 24 }) },
    ],
    [t]
  );

  function handleDescriptionChip(key: DescriptionChipKey) {
    const chip = t(`tasks.descriptionChips.${key}`);
    setDescription((prev) => appendDescriptionChip(prev, chip));
    if (!title.trim()) {
      setTitle(chip);
    }
  }

  function handleLeadChange(nextLeadId: string) {
    setLeadId(nextLeadId);
    if (!nextLeadId) return;
    const lead = leads.find((item) => item.leadId === nextLeadId);
    if (!lead) return;
    if (lead.name?.trim()) setContactName(lead.name.trim());
    if (lead.phone) setContactPhone(lead.phone);
    if (lead.email?.trim()) setContactEmail(lead.email.trim());
  }

  async function handleSubmit() {
    if (!canSubmit) return;
    const dueAt = fromLocalInputValue(joinLocalDateTime(dueDate, dueTime));
    const email = externalEmail.trim();
    const whatsapp = externalWhatsapp.trim();
    const reminderExternal =
      email || whatsapp
        ? {
            ...(email ? { email } : {}),
            ...(whatsapp ? { whatsapp } : {}),
          }
        : null;
    await onSubmit({
      title: title.trim(),
      description: description.trim() || undefined,
      ...(isEdit ? { dueAt: dueAt ?? null } : dueAt ? { dueAt } : {}),
      ...(showAdvisorSelect
        ? advisorId
          ? { advisorId }
          : {}
        : initial.advisorId
          ? { advisorId: initial.advisorId }
          : {}),
      ...(isEdit
        ? { leadId: leadId || null }
        : leadId
          ? { leadId }
          : {}),
      ...(initial.conversationId ? { conversationId: initial.conversationId } : {}),
      ...(initial.botId ? { botId: initial.botId } : {}),
      ...(contactPhone.trim() ? { contactPhone: contactPhone.trim() } : {}),
      ...(contactEmail.trim() ? { contactEmail: contactEmail.trim() } : {}),
      ...(contactName.trim() ? { contactName: contactName.trim() } : {}),
      priority,
      reminderTargets,
      reminderUserIds,
      reminderExternal,
      reminderChannels,
      reminderMinutesBefore,
    });
  }

  return (
    <Modal>
      <div className="mx-4 flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-surface-elevated shadow-xl">
        <div className="flex shrink-0 items-center justify-between border-b border-default px-5 py-3">
          <h2 className="text-lg font-semibold text-primary">
            {isEdit ? t("tasks.editTask") : t("tasks.newTask")}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-muted transition-colors hover:bg-surface-muted hover:text-secondary"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="space-y-3 overflow-y-auto overflow-x-visible px-5 py-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-primary">
              {t("tasks.taskTitle")}
            </label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t("tasks.taskTitle")}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-primary">
              {t("tasks.description")}
            </label>
            <div className="mb-1.5 flex flex-wrap gap-1.5">
              {DESCRIPTION_CHIP_KEYS.map((key) => {
                const label = t(`tasks.descriptionChips.${key}`);
                const active = description.toLowerCase().includes(label.toLowerCase());
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => handleDescriptionChip(key)}
                    className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                      active
                        ? "border-accent bg-accent-muted text-accent"
                        : "border-default text-secondary hover:bg-surface-muted"
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t("tasks.descriptionPlaceholder")}
              className="min-h-[64px]"
              rows={2}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-primary">
                {t("tasks.dueAt")}
              </label>
              <div className="grid grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] gap-2">
                <Input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  aria-label={t("tasks.dueDate")}
                />
                <TaskTimePicker
                  value={dueTime}
                  onChange={setDueTime}
                  disabled={!dueDate}
                  aria-label={t("tasks.dueTime")}
                />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-primary">
                {t("tasks.lead")}
              </label>
              <Select value={leadId} onChange={(e) => handleLeadChange(e.target.value)}>
                <option value="">{t("tasks.anyLead")}</option>
                {leads.map((lead) => (
                  <option key={lead.leadId} value={lead.leadId}>
                    {leadLabel(lead)}
                  </option>
                ))}
              </Select>
            </div>
          </div>
          {showAdvisorSelect ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-primary">
                  {t("tasks.advisor")}
                </label>
                <Select value={advisorId} onChange={(e) => setAdvisorId(e.target.value)}>
                  <option value="">{t("tasks.anyAdvisor")}</option>
                  {advisors.map((advisor) => (
                    <option key={advisor.advisorId} value={advisor.advisorId}>
                      {advisor.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-primary">
                  {t("tasks.priority")}
                </label>
                <Select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as SalesTaskPriority)}
                >
                  {TASK_PRIORITIES.map((value) => (
                    <option key={value} value={value}>
                      {t(
                        value === "low"
                          ? "tasks.priorityLow"
                          : value === "medium"
                            ? "tasks.priorityMedium"
                            : value === "high"
                              ? "tasks.priorityHigh"
                              : "tasks.priorityHighest"
                      )}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
          ) : (
            <div>
              <label className="mb-1 block text-sm font-medium text-primary">
                {t("tasks.priority")}
              </label>
              <Select
                value={priority}
                onChange={(e) => setPriority(e.target.value as SalesTaskPriority)}
              >
                {TASK_PRIORITIES.map((value) => (
                  <option key={value} value={value}>
                    {t(
                      value === "low"
                        ? "tasks.priorityLow"
                        : value === "medium"
                          ? "tasks.priorityMedium"
                          : value === "high"
                            ? "tasks.priorityHigh"
                            : "tasks.priorityHighest"
                    )}
                  </option>
                ))}
              </Select>
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <p className="mb-1.5 text-sm font-medium text-primary">{t("tasks.reminderTargets")}</p>
              <div className="flex flex-wrap gap-1.5">
                {(["advisor", "contact"] as SalesTaskReminderTarget[]).map((target) => (
                  <button
                    key={target}
                    type="button"
                    onClick={() => setReminderTargets((prev) => toggleValue(prev, target))}
                    className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                      reminderTargets.includes(target)
                        ? "border-accent bg-accent-muted text-accent"
                        : "border-default text-secondary hover:bg-surface-muted"
                    }`}
                  >
                    {t(`tasks.target.${target}`)}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-1.5 text-sm font-medium text-primary">{t("tasks.reminderChannels")}</p>
              <div className="flex flex-wrap gap-1.5">
                {REMINDER_CHANNELS.map((channel) => (
                  <button
                    key={channel}
                    type="button"
                    onClick={() => setReminderChannels((prev) => toggleValue(prev, channel))}
                    className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                      reminderChannels.includes(channel)
                        ? "border-accent bg-accent-muted text-accent"
                        : "border-default text-secondary hover:bg-surface-muted"
                    }`}
                  >
                    {t(`tasks.channel.${channel}`)}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-primary">
              {t("tasks.reminderUsers")}
            </label>
            <Select
              value=""
              onChange={(e) => {
                const userId = e.target.value;
                if (!userId) return;
                setReminderUserIds((prev) =>
                  prev.includes(userId) ? prev : [...prev, userId]
                );
              }}
              disabled={tenantMembers.length === 0}
            >
              <option value="">
                {tenantMembers.length === 0
                  ? t("tasks.reminderUsersEmpty")
                  : t("tasks.reminderUsersNone")}
              </option>
              {tenantMembers
                .filter((member) => !reminderUserIds.includes(member.userId))
                .map((member) => (
                  <option key={member.userId} value={member.userId}>
                    {member.name || member.email}
                  </option>
                ))}
            </Select>
            {reminderUserIds.length > 0 ? (
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {reminderUserIds.map((userId) => {
                  const member = tenantMembers.find((item) => item.userId === userId);
                  const label = member?.name || member?.email || userId;
                  return (
                    <button
                      key={userId}
                      type="button"
                      onClick={() =>
                        setReminderUserIds((prev) => prev.filter((id) => id !== userId))
                      }
                      className="inline-flex items-center gap-1 rounded-full border border-accent bg-accent-muted px-2.5 py-1 text-xs font-medium text-accent"
                    >
                      {label}
                      <X className="h-3 w-3" aria-hidden="true" />
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>
          <div>
            <p className="mb-1.5 text-sm font-medium text-primary">
              {t("tasks.reminderExternal")}
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              <Input
                type="email"
                value={externalEmail}
                onChange={(e) => setExternalEmail(e.target.value)}
                placeholder={t("tasks.reminderExternalEmail")}
              />
              <Input
                value={externalWhatsapp}
                onChange={(e) => setExternalWhatsapp(e.target.value)}
                placeholder={t("tasks.reminderExternalWhatsapp")}
              />
            </div>
            <p className="mt-1 text-xs text-muted">{t("tasks.reminderExternalHint")}</p>
          </div>
          {reminderChannels.length > 0 && hasReminderRecipients ? (
            <div>
              <label className="mb-1 block text-sm font-medium text-primary">
                {t("tasks.reminderWhen")}
              </label>
              <Select
                value={String(reminderMinutesBefore)}
                onChange={(e) => setReminderMinutesBefore(Number(e.target.value))}
              >
                {minutesOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </div>
          ) : null}
          {isEdit && task?.taskId ? <TaskCommentsPanel taskId={task.taskId} /> : null}
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="secondary" onClick={onClose} disabled={submitting}>
              {t("common.cancel")}
            </Button>
            <Button disabled={!canSubmit} onClick={() => void handleSubmit()}>
              {isEdit ? t("common.save") : t("common.create")}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
