"use client";

import { useMemo, useState, type ReactNode } from "react";
import { CalendarClock, ChevronsDown, ChevronsUp, Equal, UserRound, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { FieldLabel } from "@/components/ui/FieldLabel";
import { Input, Select, Textarea } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { TaskTimePicker } from "@/components/tasks/TaskTimePicker";
import { TaskCommentsPanel } from "@/components/tasks/TaskCommentsPanel";
import { useLeads, useLead } from "@/hooks/useLeads";
import { useTenantMembers } from "@/hooks/useTenantMembers";
import { useT } from "@/i18n/context";
import { cn } from "@/lib/utils";
import type {
  Advisor,
  Lead,
  SalesTask,
  SalesTaskPriority,
  SalesTaskReminderChannel,
  SalesTaskReminderExternal,
  SalesTaskReminderTarget,
} from "@/types";

const ACTIVE_REMINDER_TARGETS: SalesTaskReminderTarget[] = ["advisor"];

function sanitizeReminderTargets(
  targets: SalesTaskReminderTarget[] | undefined
): SalesTaskReminderTarget[] {
  const next = (targets ?? ["advisor"]).filter((target) =>
    ACTIVE_REMINDER_TARGETS.includes(target)
  );
  return next.length > 0 ? next : ["advisor"];
}

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

function localDateString(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function addDays(base: Date, days: number): Date {
  const next = new Date(base);
  next.setDate(next.getDate() + days);
  return next;
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
const DUE_PRESETS = [
  { key: "today", days: 0 },
  { key: "tomorrow", days: 1 },
  { key: "in3Days", days: 3 },
  { key: "nextWeek", days: 7 },
] as const;

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
    reminderTargets: sanitizeReminderTargets(task.reminderTargets),
    reminderUserIds: task.reminderUserIds ?? [],
    reminderExternal: null,
    reminderChannels: task.reminderChannels ?? ["email"],
    reminderMinutesBefore: task.reminderMinutesBefore ?? 60,
  };
}

function FormSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-default bg-surface p-4 space-y-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-secondary">{title}</p>
      {children}
    </section>
  );
}

function ChipButton({
  active,
  onClick,
  children,
  className,
}: {
  active?: boolean;
  onClick: () => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors",
        active
          ? "border-accent bg-accent-muted text-accent"
          : "border-default text-secondary hover:bg-surface-muted",
        className
      )}
    >
      {children}
    </button>
  );
}

function priorityTone(value: SalesTaskPriority, active: boolean): string {
  if (value === "highest") {
    return active
      ? "border-rose-500 bg-rose-500 text-white shadow-sm"
      : "border-rose-200 bg-rose-50 text-rose-700 hover:border-rose-300 hover:bg-rose-100";
  }
  if (value === "high") {
    return active
      ? "border-orange-500 bg-orange-500 text-white shadow-sm"
      : "border-orange-200 bg-orange-50 text-orange-700 hover:border-orange-300 hover:bg-orange-100";
  }
  if (value === "medium") {
    return active
      ? "border-amber-500 bg-amber-500 text-white shadow-sm"
      : "border-amber-200 bg-amber-50 text-amber-700 hover:border-amber-300 hover:bg-amber-100";
  }
  return active
    ? "border-sky-500 bg-sky-500 text-white shadow-sm"
    : "border-sky-200 bg-sky-50 text-sky-700 hover:border-sky-300 hover:bg-sky-100";
}

function priorityLabelKey(value: SalesTaskPriority): string {
  if (value === "low") return "tasks.priorityLow";
  if (value === "medium") return "tasks.priorityMedium";
  if (value === "high") return "tasks.priorityHigh";
  return "tasks.priorityHighest";
}

function PriorityIcon({
  value,
  className,
}: {
  value: SalesTaskPriority;
  className?: string;
}) {
  if (value === "low") return <ChevronsDown className={className} />;
  if (value === "high" || value === "highest") return <ChevronsUp className={className} />;
  return <Equal className={className} />;
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
  const [reminderTargets] = useState<SalesTaskReminderTarget[]>(
    sanitizeReminderTargets(initial.reminderTargets)
  );
  const [reminderUserIds, setReminderUserIds] = useState<string[]>(
    initial.reminderUserIds ?? []
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
    reminderChannels.includes("platform");
  const showContactSummary = Boolean(
    contactName.trim() || contactPhone.trim() || contactEmail.trim()
  );

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

  function applyDuePreset(days: number) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    setDueDate(localDateString(addDays(today, days)));
    if (!dueTime) setDueTime("09:00");
  }

  async function handleSubmit() {
    if (!canSubmit) return;
    const dueAt = fromLocalInputValue(joinLocalDateTime(dueDate, dueTime));
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
      reminderTargets: sanitizeReminderTargets(reminderTargets),
      reminderUserIds,
      reminderExternal: null,
      reminderChannels,
      reminderMinutesBefore,
    });
  }

  return (
    <Modal>
      <div className="mx-4 flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-surface-elevated shadow-xl">
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-default px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold text-primary">
              {isEdit ? t("tasks.editTask") : t("tasks.newTask")}
            </h2>
            <p className="mt-0.5 text-sm text-secondary">{t("tasks.formSubtitle")}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-muted transition-colors hover:bg-surface-muted hover:text-secondary"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 overflow-y-auto overflow-x-visible px-5 py-4">
          <FormSection title={t("tasks.sectionWhat")}>
            <div>
              <label className="mb-1 block text-sm text-secondary">{t("tasks.taskTitle")}</label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={t("tasks.taskTitlePlaceholder")}
                autoFocus={!isEdit}
              />
            </div>
            <div>
              <p className="mb-1.5 text-sm text-secondary">{t("tasks.quickTemplates")}</p>
              <div className="flex flex-wrap gap-1.5">
                {DESCRIPTION_CHIP_KEYS.map((key) => {
                  const label = t(`tasks.descriptionChips.${key}`);
                  const active = description.toLowerCase().includes(label.toLowerCase());
                  return (
                    <ChipButton
                      key={key}
                      active={active}
                      onClick={() => handleDescriptionChip(key)}
                    >
                      {label}
                    </ChipButton>
                  );
                })}
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm text-secondary">{t("tasks.description")}</label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t("tasks.descriptionPlaceholder")}
                className="min-h-[72px]"
                rows={3}
              />
            </div>
          </FormSection>

          <FormSection title={t("tasks.sectionWhen")}>
            <div className="flex flex-wrap gap-1.5">
              {DUE_PRESETS.map((preset) => {
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const presetDate = localDateString(addDays(today, preset.days));
                return (
                  <ChipButton
                    key={preset.key}
                    active={dueDate === presetDate}
                    onClick={() => applyDuePreset(preset.days)}
                  >
                    <span className="inline-flex items-center gap-1">
                      <CalendarClock className="h-3.5 w-3.5" />
                      {t(`tasks.duePresets.${preset.key}`)}
                    </span>
                  </ChipButton>
                );
              })}
              {dueDate ? (
                <ChipButton
                  onClick={() => {
                    setDueDate("");
                    setDueTime("09:00");
                  }}
                >
                  {t("tasks.clearDueDate")}
                </ChipButton>
              ) : null}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm text-secondary">{t("tasks.dueDate")}</label>
                <Input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  aria-label={t("tasks.dueDate")}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-secondary">{t("tasks.dueTime")}</label>
                <TaskTimePicker
                  value={dueTime}
                  onChange={setDueTime}
                  disabled={!dueDate}
                  aria-label={t("tasks.dueTime")}
                />
              </div>
            </div>
            <div>
              <p className="mb-1.5 text-sm text-secondary">{t("tasks.priority")}</p>
              <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                {TASK_PRIORITIES.map((value) => {
                  const active = priority === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setPriority(value)}
                      className={cn(
                        "inline-flex items-center justify-center gap-1 rounded-lg border px-2.5 py-2 text-xs font-medium transition-colors",
                        priorityTone(value, active)
                      )}
                    >
                      <PriorityIcon value={value} className="h-3.5 w-3.5" />
                      {t(priorityLabelKey(value))}
                    </button>
                  );
                })}
              </div>
            </div>
          </FormSection>

          <FormSection title={t("tasks.sectionAssignment")}>
            <div className={cn("grid gap-3", showAdvisorSelect ? "sm:grid-cols-2" : "")}>
              <div>
                <FieldLabel label={t("tasks.lead")} tooltip={t("tasks.leadHint")} />
                <Select value={leadId} onChange={(e) => handleLeadChange(e.target.value)}>
                  <option value="">{t("tasks.anyLead")}</option>
                  {leads.map((lead) => (
                    <option key={lead.leadId} value={lead.leadId}>
                      {leadLabel(lead)}
                    </option>
                  ))}
                </Select>
              </div>
              {showAdvisorSelect ? (
                <div>
                  <label className="mb-1 block text-sm text-secondary">{t("tasks.advisor")}</label>
                  <Select value={advisorId} onChange={(e) => setAdvisorId(e.target.value)}>
                    <option value="">{t("tasks.anyAdvisor")}</option>
                    {advisors.map((advisor) => (
                      <option key={advisor.advisorId} value={advisor.advisorId}>
                        {advisor.name}
                      </option>
                    ))}
                  </Select>
                </div>
              ) : null}
            </div>
            {showContactSummary ? (
              <div className="flex items-start gap-2.5 rounded-lg border border-default bg-surface-muted/60 px-3 py-2.5">
                <UserRound className="mt-0.5 h-4 w-4 shrink-0 text-muted" />
                <div className="min-w-0 space-y-0.5 text-sm">
                  <p className="font-medium text-primary">
                    {contactName.trim() || t("tasks.contactSummary")}
                  </p>
                  <p className="truncate text-secondary">
                    {[contactPhone.trim(), contactEmail.trim()].filter(Boolean).join(" · ")}
                  </p>
                </div>
              </div>
            ) : null}
          </FormSection>

          <FormSection title={t("tasks.sectionReminder")}>
            <div>
              <p className="mb-1.5 text-sm text-secondary">{t("tasks.reminderChannels")}</p>
              <div className="flex flex-wrap gap-1.5">
                {REMINDER_CHANNELS.map((channel) => (
                  <ChipButton
                    key={channel}
                    active={reminderChannels.includes(channel)}
                    onClick={() => setReminderChannels((prev) => toggleValue(prev, channel))}
                  >
                    {t(`tasks.channel.${channel}`)}
                  </ChipButton>
                ))}
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm text-secondary">{t("tasks.reminderUsers")}</label>
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
                        className="inline-flex items-center gap-1 rounded-lg border border-accent bg-accent-muted px-2.5 py-1 text-xs font-medium text-accent"
                      >
                        {label}
                        <X className="h-3 w-3" aria-hidden="true" />
                      </button>
                    );
                  })}
                </div>
              ) : null}
            </div>
            {reminderChannels.length > 0 && hasReminderRecipients ? (
              <div>
                <p className="mb-1.5 text-sm text-secondary">{t("tasks.reminderWhen")}</p>
                <div className="flex flex-wrap gap-1.5">
                  {minutesOptions.map((option) => (
                    <ChipButton
                      key={option.value}
                      active={reminderMinutesBefore === option.value}
                      onClick={() => setReminderMinutesBefore(option.value)}
                    >
                      {option.label}
                    </ChipButton>
                  ))}
                </div>
              </div>
            ) : null}
          </FormSection>

          {isEdit && task?.taskId ? (
            <FormSection title={t("tasks.commentsTitle")}>
              <TaskCommentsPanel taskId={task.taskId} />
            </FormSection>
          ) : null}
        </div>

        <div className="flex shrink-0 justify-end gap-2 border-t border-default px-5 py-3">
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            {t("common.cancel")}
          </Button>
          <Button disabled={!canSubmit} onClick={() => void handleSubmit()}>
            {isEdit ? t("common.save") : t("common.create")}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
