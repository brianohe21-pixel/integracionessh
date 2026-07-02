"use client";

import type { CalendarConfig } from "@/types";
import { useT } from "@/i18n/context";
import { useTemplates } from "@/hooks/useTemplates";

const REMINDER_PRESETS = [
  { minutes: 15, key: "15m" },
  { minutes: 30, key: "30m" },
  { minutes: 60, key: "1h" },
  { minutes: 120, key: "2h" },
  { minutes: 1440, key: "24h" },
  { minutes: 2880, key: "48h" },
] as const;

interface CalendarReminderSettingsProps {
  botId: string;
  config: CalendarConfig;
  onChange: (patch: Partial<CalendarConfig>) => void;
}

export function CalendarReminderSettings({
  botId,
  config,
  onChange,
}: CalendarReminderSettingsProps) {
  const t = useT();
  const { data: templates } = useTemplates(botId);
  const channel = config.reminderChannel ?? "whatsapp_text";
  const minutes = config.reminderMinutesBefore ?? 60;

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-6">
      <div className="mb-4 flex items-center justify-between gap-4">
        <div>
          <h3 className="font-semibold text-gray-900">{t("calendar.reminder.title")}</h3>
          <p className="mt-1 text-sm text-gray-500">{t("calendar.reminder.subtitle")}</p>
        </div>
        <button
          type="button"
          onClick={() => onChange({ reminderEnabled: !config.reminderEnabled })}
          className={`rounded-lg px-4 py-2 text-sm font-medium text-white ${
            config.reminderEnabled
              ? "bg-gray-600 hover:bg-gray-700"
              : "bg-indigo-600 hover:bg-indigo-700"
          }`}
        >
          {config.reminderEnabled
            ? t("calendar.reminder.disable")
            : t("calendar.reminder.enable")}
        </button>
      </div>

      {config.reminderEnabled ? (
        <div className="space-y-4">
          <div>
            <span className="mb-2 block text-sm font-medium text-gray-700">
              {t("calendar.reminder.advance")}
            </span>
            <div className="mb-2 flex flex-wrap gap-2">
              {REMINDER_PRESETS.map((preset) => (
                <button
                  key={preset.key}
                  type="button"
                  onClick={() => onChange({ reminderMinutesBefore: preset.minutes })}
                  className={`rounded-lg border px-3 py-1.5 text-sm ${
                    minutes === preset.minutes
                      ? "border-indigo-600 bg-indigo-50 text-indigo-700"
                      : "border-gray-300 text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  {t(`calendar.reminder.presets.${preset.key}`)}
                </button>
              ))}
            </div>
            <label className="block text-sm">
              <span className="mb-1 block text-gray-600">{t("calendar.reminder.minutes")}</span>
              <input
                type="number"
                min={15}
                max={10080}
                value={minutes}
                onChange={(e) =>
                  onChange({ reminderMinutesBefore: Number(e.target.value) })
                }
                className="w-full max-w-xs rounded-lg border border-gray-300 px-3 py-2"
              />
            </label>
          </div>

          <label className="block text-sm">
            <span className="mb-1 block font-medium text-gray-700">
              {t("calendar.reminder.channel")}
            </span>
            <select
              value={channel}
              onChange={(e) =>
                onChange({
                  reminderChannel: e.target.value as CalendarConfig["reminderChannel"],
                })
              }
              className="w-full max-w-md rounded-lg border border-gray-300 px-3 py-2"
            >
              <option value="whatsapp_text">{t("calendar.reminder.channelText")}</option>
              <option value="whatsapp_template">{t("calendar.reminder.channelTemplate")}</option>
            </select>
          </label>

          {channel === "whatsapp_text" ? (
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-gray-700">
                {t("calendar.reminder.message")}
              </span>
              <textarea
                rows={4}
                value={config.reminderMessage ?? ""}
                onChange={(e) => onChange({ reminderMessage: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2"
              />
              <p className="mt-1 text-xs text-gray-500">{t("calendar.reminder.placeholders")}</p>
              <p className="mt-1 text-xs text-amber-700">{t("calendar.reminder.textHint")}</p>
            </label>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-gray-700">
                  {t("calendar.reminder.template")}
                </span>
                <select
                  value={config.reminderTemplateName ?? ""}
                  onChange={(e) => onChange({ reminderTemplateName: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2"
                >
                  <option value="">{t("calendar.reminder.chooseTemplate")}</option>
                  {(templates ?? []).map((tpl) => (
                    <option key={`${tpl.name}-${tpl.language}`} value={tpl.name}>
                      {tpl.name} ({tpl.language})
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-gray-700">
                  {t("calendar.reminder.templateLanguage")}
                </span>
                <input
                  type="text"
                  value={config.reminderTemplateLanguage ?? "es"}
                  onChange={(e) => onChange({ reminderTemplateLanguage: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2"
                />
              </label>
              <p className="text-xs text-gray-500 sm:col-span-2">
                {t("calendar.reminder.templateHint")}
              </p>
            </div>
          )}
        </div>
      ) : null}
    </section>
  );
}
