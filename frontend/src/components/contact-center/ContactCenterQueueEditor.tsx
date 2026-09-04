"use client";

import { useEffect, useState } from "react";
import { FormField } from "@/components/contact-center/FormField";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Input";
import { useUpdateQueue } from "@/hooks/useContactCenter";
import { useT } from "@/i18n/context";
import type {
  ContactCenterQueue,
  QueueBusinessHours,
  QueueDayHours,
  QueueFallbackAction,
  QueueStrategy,
} from "@/types";

const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;

const DEFAULT_HOURS: QueueBusinessHours = {
  timezone: "America/Bogota",
  days: {
    mon: { start: "08:00", end: "18:00" },
    tue: { start: "08:00", end: "18:00" },
    wed: { start: "08:00", end: "18:00" },
    thu: { start: "08:00", end: "18:00" },
    fri: { start: "08:00", end: "18:00" },
    sat: null,
    sun: null,
  },
};

function fallbackActionOptions(t: (key: string) => string) {
  return [
    { value: "ai", label: t("contactCenter.actionAi") },
    { value: "voicemail", label: t("contactCenter.actionVoicemail") },
    { value: "callback", label: t("contactCenter.actionCallback") },
    { value: "hangup", label: t("contactCenter.actionHangup") },
  ];
}

interface ContactCenterQueueEditorProps {
  queue: ContactCenterQueue;
  queues: ContactCenterQueue[];
  expanded: boolean;
  onToggle: () => void;
}

export function ContactCenterQueueEditor({
  queue,
  queues,
  expanded,
  onToggle,
}: ContactCenterQueueEditorProps) {
  const t = useT();
  const updateQueue = useUpdateQueue();

  const [name, setName] = useState(queue.name);
  const [strategy, setStrategy] = useState<QueueStrategy>(queue.strategy);
  const [skills, setSkills] = useState(queue.skills.join(", "));
  const [slaSeconds, setSlaSeconds] = useState(String(queue.slaSeconds));
  const [maxWaitSeconds, setMaxWaitSeconds] = useState(
    queue.maxWaitSeconds !== undefined ? String(queue.maxWaitSeconds) : ""
  );
  const [wrapUpSeconds, setWrapUpSeconds] = useState(
    queue.wrapUpSeconds !== undefined ? String(queue.wrapUpSeconds) : "30"
  );
  const [holdAudioUrl, setHoldAudioUrl] = useState(queue.holdAudioUrl ?? "");
  const [overflowQueueId, setOverflowQueueId] = useState(queue.overflowQueueId ?? "");
  const [afterHoursAction, setAfterHoursAction] = useState<QueueFallbackAction>(
    queue.afterHoursAction
  );
  const [overflowAction, setOverflowAction] = useState<QueueFallbackAction>(
    queue.overflowAction ?? "hangup"
  );
  const [announcePosition, setAnnouncePosition] = useState(Boolean(queue.announcePosition));
  const [callbackEnabled, setCallbackEnabled] = useState(Boolean(queue.callbackEnabled));
  const [hoursEnabled, setHoursEnabled] = useState(Boolean(queue.hours));
  const [hours, setHours] = useState<QueueBusinessHours>(queue.hours ?? DEFAULT_HOURS);

  useEffect(() => {
    setName(queue.name);
    setStrategy(queue.strategy);
    setSkills(queue.skills.join(", "));
    setSlaSeconds(String(queue.slaSeconds));
    setMaxWaitSeconds(queue.maxWaitSeconds !== undefined ? String(queue.maxWaitSeconds) : "");
    setWrapUpSeconds(queue.wrapUpSeconds !== undefined ? String(queue.wrapUpSeconds) : "30");
    setHoldAudioUrl(queue.holdAudioUrl ?? "");
    setOverflowQueueId(queue.overflowQueueId ?? "");
    setAfterHoursAction(queue.afterHoursAction);
    setOverflowAction(queue.overflowAction ?? "hangup");
    setAnnouncePosition(Boolean(queue.announcePosition));
    setCallbackEnabled(Boolean(queue.callbackEnabled));
    setHoursEnabled(Boolean(queue.hours));
    setHours(queue.hours ?? DEFAULT_HOURS);
  }, [queue]);

  function updateDayHours(day: (typeof DAY_KEYS)[number], patch: Partial<QueueDayHours> | null) {
    setHours((prev) => ({
      ...prev,
      days: {
        ...prev.days,
        [day]: patch === null ? null : { ...(prev.days[day] ?? { start: "08:00", end: "18:00" }), ...patch },
      },
    }));
  }

  async function save() {
    const parsedSkills = skills
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
    const parsedSla = Number.parseInt(slaSeconds, 10);
    const parsedMaxWait = maxWaitSeconds.trim()
      ? Number.parseInt(maxWaitSeconds, 10)
      : undefined;
    const parsedWrapUp = Number.parseInt(wrapUpSeconds, 10);

    await updateQueue.mutateAsync({
      queueId: queue.queueId,
      body: {
        name: name.trim() || queue.name,
        strategy,
        skills: parsedSkills,
        slaSeconds: Number.isFinite(parsedSla) ? parsedSla : queue.slaSeconds,
        ...(parsedMaxWait !== undefined && Number.isFinite(parsedMaxWait)
          ? { maxWaitSeconds: parsedMaxWait }
          : {}),
        ...(Number.isFinite(parsedWrapUp) ? { wrapUpSeconds: parsedWrapUp } : {}),
        ...(holdAudioUrl.trim() ? { holdAudioUrl: holdAudioUrl.trim() } : {}),
        ...(overflowQueueId ? { overflowQueueId } : {}),
        afterHoursAction,
        overflowAction,
        announcePosition,
        callbackEnabled,
        ...(hoursEnabled ? { hours } : {}),
      },
    });
  }

  const actionOptions = fallbackActionOptions(t);
  const otherQueues = queues.filter((item) => item.queueId !== queue.queueId);

  return (
    <li className="rounded-lg border border-default">
      <button
        type="button"
        className="flex w-full items-center justify-between px-3 py-2 text-left text-sm"
        onClick={onToggle}
      >
        <span className="font-medium">{queue.name}</span>
        <span className="text-secondary">
          {queue.strategy}
          {queue.hours ? ` · ${t("contactCenter.hoursConfigured")}` : ""}
        </span>
      </button>
      {expanded ? (
        <div className="space-y-4 border-t border-default px-3 py-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField label={t("contactCenter.queueName")}>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </FormField>
            <FormField label={t("contactCenter.strategy")}>
              <Select value={strategy} onChange={(e) => setStrategy(e.target.value as QueueStrategy)}>
                <option value="longest_idle">{t("contactCenter.longestIdle")}</option>
                <option value="round_robin">{t("contactCenter.roundRobin")}</option>
                <option value="fewest_calls">{t("contactCenter.fewestCalls")}</option>
              </Select>
            </FormField>
            <FormField label={t("contactCenter.skills")}>
              <Input value={skills} onChange={(e) => setSkills(e.target.value)} />
            </FormField>
            <FormField label={t("contactCenter.sla")}>
              <Input
                value={slaSeconds}
                onChange={(e) => setSlaSeconds(e.target.value)}
                type="number"
                min={5}
              />
            </FormField>
            <FormField label={t("contactCenter.maxWait")}>
              <Input
                value={maxWaitSeconds}
                onChange={(e) => setMaxWaitSeconds(e.target.value)}
                type="number"
                min={10}
              />
            </FormField>
            <FormField label={t("contactCenter.wrapUp")}>
              <Input
                value={wrapUpSeconds}
                onChange={(e) => setWrapUpSeconds(e.target.value)}
                type="number"
                min={0}
              />
            </FormField>
            <FormField label={t("contactCenter.holdAudioUrl")}>
              <Input value={holdAudioUrl} onChange={(e) => setHoldAudioUrl(e.target.value)} />
            </FormField>
            <FormField label={t("contactCenter.overflowQueue")}>
              <Select value={overflowQueueId} onChange={(e) => setOverflowQueueId(e.target.value)}>
                <option value="">{t("contactCenter.noOverflowQueue")}</option>
                {otherQueues.map((item) => (
                  <option key={item.queueId} value={item.queueId}>
                    {item.name}
                  </option>
                ))}
              </Select>
            </FormField>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <FormField label={t("contactCenter.afterHoursAction")}>
              <Select
                value={afterHoursAction}
                onChange={(e) => setAfterHoursAction(e.target.value as QueueFallbackAction)}
              >
                {actionOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField label={t("contactCenter.overflowAction")}>
              <Select
                value={overflowAction}
                onChange={(e) => setOverflowAction(e.target.value as QueueFallbackAction)}
              >
                {actionOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </FormField>
          </div>

          <div className="flex flex-wrap gap-4 text-sm">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={announcePosition}
                onChange={(e) => setAnnouncePosition(e.target.checked)}
              />
              {t("contactCenter.announcePosition")}
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={callbackEnabled}
                onChange={(e) => setCallbackEnabled(e.target.checked)}
              />
              {t("contactCenter.callbackEnabled")}
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={hoursEnabled}
                onChange={(e) => setHoursEnabled(e.target.checked)}
              />
              {t("contactCenter.businessHours")}
            </label>
          </div>

          {hoursEnabled ? (
            <div className="space-y-3 rounded-lg border border-default p-3">
              <FormField label={t("contactCenter.timezone")}>
                <Input
                  value={hours.timezone}
                  onChange={(e) => setHours((prev) => ({ ...prev, timezone: e.target.value }))}
                />
              </FormField>
              <div className="grid grid-cols-[80px_1fr_1fr_auto] items-center gap-2 text-xs font-medium text-secondary">
                <span />
                <span>{t("contactCenter.hoursStart")}</span>
                <span>{t("contactCenter.hoursEnd")}</span>
                <span />
              </div>
              <div className="space-y-2">
                {DAY_KEYS.map((day) => {
                  const window = hours.days[day];
                  const open = window !== null && window !== undefined;
                  return (
                    <div key={day} className="grid grid-cols-[80px_1fr_1fr_auto] items-center gap-2 text-sm">
                      <span className="font-medium text-secondary">{t(`contactCenter.day.${day}`)}</span>
                      <Input
                        value={window?.start ?? "08:00"}
                        onChange={(e) => updateDayHours(day, { start: e.target.value })}
                        disabled={!open}
                        aria-label={`${t(`contactCenter.day.${day}`)} ${t("contactCenter.hoursStart")}`}
                      />
                      <Input
                        value={window?.end ?? "18:00"}
                        onChange={(e) => updateDayHours(day, { end: e.target.value })}
                        disabled={!open}
                        aria-label={`${t(`contactCenter.day.${day}`)} ${t("contactCenter.hoursEnd")}`}
                      />
                      <label className="flex items-center gap-1 text-xs text-secondary">
                        <input
                          type="checkbox"
                          checked={open}
                          onChange={(e) =>
                            updateDayHours(day, e.target.checked ? { start: "08:00", end: "18:00" } : null)
                          }
                        />
                        {t("contactCenter.dayOpen")}
                      </label>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}

          <div className="flex justify-end">
            <Button onClick={() => void save()} disabled={updateQueue.isPending}>
              {t("contactCenter.saveQueue")}
            </Button>
          </div>
        </div>
      ) : null}
    </li>
  );
}
