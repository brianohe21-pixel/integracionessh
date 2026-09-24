"use client";

import { useMemo, useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input, Select, Textarea } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { useT } from "@/i18n/context";
import type {
  Advisor,
  SalesTask,
  SalesTaskReminderChannel,
  SalesTaskReminderTarget,
} from "@/types";

export type TaskFormValues = {
  title: string;
  description?: string;
  dueAt?: string | null;
  advisorId?: string;
  conversationId?: string;
  botId?: string;
  contactPhone?: string;
  contactEmail?: string;
  contactName?: string;
  reminderTargets: SalesTaskReminderTarget[];
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

function appendDescriptionChip(current: string, chip: string): string {
  const trimmed = current.trim();
  if (!trimmed) return chip;
  if (trimmed.toLowerCase().includes(chip.toLowerCase())) return trimmed;
  return `${trimmed}\n${chip}`;
}

function defaultsFromTask(task?: SalesTask | null): Partial<TaskFormValues> {
  if (!task) return {};
  return {
    title: task.title,
    ...(task.description ? { description: task.description } : {}),
    ...(task.dueAt ? { dueAt: task.dueAt } : {}),
    ...(task.advisorId ? { advisorId: task.advisorId } : {}),
    ...(task.conversationId ? { conversationId: task.conversationId } : {}),
    ...(task.botId ? { botId: task.botId } : {}),
    ...(task.contactPhone ? { contactPhone: task.contactPhone } : {}),
    ...(task.contactEmail ? { contactEmail: task.contactEmail } : {}),
    ...(task.contactName ? { contactName: task.contactName } : {}),
    reminderTargets: task.reminderTargets ?? ["advisor"],
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
  const [dueLocal, setDueLocal] = useState(toLocalInputValue(initial.dueAt ?? undefined));
  const [advisorId, setAdvisorId] = useState(initial.advisorId ?? "");
  const [reminderTargets, setReminderTargets] = useState<SalesTaskReminderTarget[]>(
    initial.reminderTargets ?? ["advisor"]
  );
  const [reminderChannels, setReminderChannels] = useState<SalesTaskReminderChannel[]>(
    initial.reminderChannels ?? ["email"]
  );
  const [reminderMinutesBefore, setReminderMinutesBefore] = useState(
    initial.reminderMinutesBefore ?? 60
  );

  const canSubmit = title.trim().length > 0 && !submitting;
  const isEdit = mode === "edit";

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

  async function handleSubmit() {
    if (!canSubmit) return;
    const dueAt = fromLocalInputValue(dueLocal);
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
      ...(initial.conversationId ? { conversationId: initial.conversationId } : {}),
      ...(initial.botId ? { botId: initial.botId } : {}),
      ...(initial.contactPhone ? { contactPhone: initial.contactPhone } : {}),
      ...(initial.contactEmail ? { contactEmail: initial.contactEmail } : {}),
      ...(initial.contactName ? { contactName: initial.contactName } : {}),
      reminderTargets,
      reminderChannels,
      reminderMinutesBefore,
    });
  }

  return (
    <Modal>
      <div className="mx-4 max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-surface-elevated shadow-xl">
        <div className="flex items-center justify-between border-b border-default px-6 py-4">
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
        <div className="space-y-4 px-6 py-5">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-primary">
              {t("tasks.taskTitle")}
            </label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t("tasks.taskTitle")}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-primary">
              {t("tasks.description")}
            </label>
            <div className="mb-2 flex flex-wrap gap-1.5">
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
              className="min-h-[90px]"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-primary">
              {t("tasks.dueAt")}
            </label>
            <Input
              type="datetime-local"
              value={dueLocal}
              onChange={(e) => setDueLocal(e.target.value)}
            />
          </div>
          {showAdvisorSelect ? (
            <div>
              <label className="mb-1.5 block text-sm font-medium text-primary">
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
          ) : null}
          <div>
            <p className="mb-2 text-sm font-medium text-primary">{t("tasks.reminderTargets")}</p>
            <div className="flex flex-wrap gap-2">
              {(["advisor", "contact"] as SalesTaskReminderTarget[]).map((target) => (
                <button
                  key={target}
                  type="button"
                  onClick={() => setReminderTargets((prev) => toggleValue(prev, target))}
                  className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
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
            <p className="mb-2 text-sm font-medium text-primary">{t("tasks.reminderChannels")}</p>
            <div className="flex flex-wrap gap-2">
              {REMINDER_CHANNELS.map((channel) => (
                <button
                  key={channel}
                  type="button"
                  onClick={() => setReminderChannels((prev) => toggleValue(prev, channel))}
                  className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                    reminderChannels.includes(channel)
                      ? "border-accent bg-accent-muted text-accent"
                      : "border-default text-secondary hover:bg-surface-muted"
                  }`}
                >
                  {t(`tasks.channel.${channel}`)}
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-xs text-muted">{t("tasks.reminderHint")}</p>
          </div>
          {reminderChannels.length > 0 &&
          (reminderTargets.length > 0 || reminderChannels.includes("platform")) ? (
            <div>
              <label className="mb-1.5 block text-sm font-medium text-primary">
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
          <div className="flex justify-end gap-2 pt-2">
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
