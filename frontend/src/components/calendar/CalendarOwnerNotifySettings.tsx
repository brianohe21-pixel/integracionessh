"use client";

import Link from "next/link";
import { ExternalLink } from "lucide-react";
import type { CalendarConfig } from "@/types";
import { useT } from "@/i18n/context";
import { useTemplates } from "@/hooks/useTemplates";
import { FieldLabel } from "@/components/ui/FieldLabel";

interface CalendarOwnerNotifySettingsProps {
  botId: string;
  config: CalendarConfig;
  onChange: (patch: Partial<CalendarConfig>) => void;
}

export function CalendarOwnerNotifySettings({
  botId,
  config,
  onChange,
}: CalendarOwnerNotifySettingsProps) {
  const t = useT();
  const { data: templates } = useTemplates(botId);
  const emailOn = config.ownerNotifyEmail !== false;
  const whatsappOn = Boolean(config.ownerNotifyWhatsApp);

  return (
    <section className="rounded-xl border border-default bg-surface-elevated p-6">
      <div className="mb-4 flex items-center justify-between gap-4">
        <div>
          <h3 className="font-semibold text-primary">{t("calendar.ownerNotify.title")}</h3>
          <p className="mt-1 text-sm text-secondary">{t("calendar.ownerNotify.subtitle")}</p>
        </div>
        <button
          type="button"
          onClick={() =>
            onChange({
              ownerNotifyEnabled: !config.ownerNotifyEnabled,
              ...(config.ownerNotifyEnabled
                ? {}
                : { ownerNotifyEmail: config.ownerNotifyEmail ?? true }),
            })
          }
          className={`rounded-lg px-4 py-2 text-sm font-medium text-white ${
            config.ownerNotifyEnabled
              ? "bg-gray-600 hover:bg-gray-700"
              : "bg-accent hover:bg-accent-hover"
          }`}
        >
          {config.ownerNotifyEnabled
            ? t("calendar.ownerNotify.disable")
            : t("calendar.ownerNotify.enable")}
        </button>
      </div>

      {config.ownerNotifyEnabled ? (
        <div className="space-y-4">
          <label className="flex items-start gap-3 text-sm">
            <input
              type="checkbox"
              checked={emailOn}
              onChange={(e) => onChange({ ownerNotifyEmail: e.target.checked })}
              className="mt-1"
            />
            <span>
              <span className="font-medium text-primary">
                {t("calendar.ownerNotify.email")}
              </span>
              <span className="mt-0.5 block text-secondary">
                {t("calendar.ownerNotify.emailHint")}
              </span>
            </span>
          </label>

          <label className="flex items-start gap-3 text-sm">
            <input
              type="checkbox"
              checked={whatsappOn}
              onChange={(e) => onChange({ ownerNotifyWhatsApp: e.target.checked })}
              className="mt-1"
            />
            <span>
              <span className="font-medium text-primary">
                {t("calendar.ownerNotify.whatsapp")}
              </span>
              <span className="mt-0.5 block text-secondary">
                {t("calendar.ownerNotify.whatsappHint")}
              </span>
            </span>
          </label>

          {whatsappOn ? (
            <div className="space-y-4">
              <label className="block text-sm">
                <FieldLabel
                  label={t("calendar.ownerNotify.phone")}
                  tooltip={t("calendar.fieldHints.ownerNotifyPhone")}
                />
                <input
                  type="tel"
                  value={config.ownerNotifyPhone ?? ""}
                  onChange={(e) => onChange({ ownerNotifyPhone: e.target.value })}
                  placeholder="573001234567"
                  className="w-full max-w-md rounded-lg border border-default px-3 py-2"
                />
              </label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-sm">
                  <FieldLabel
                    label={t("calendar.ownerNotify.template")}
                    tooltip={t("calendar.fieldHints.ownerNotifyTemplate")}
                  />
                  <select
                    value={config.ownerNotifyTemplateName ?? ""}
                    onChange={(e) => {
                      const name = e.target.value;
                      const match = (templates ?? []).find((tpl) => tpl.name === name);
                      onChange({
                        ownerNotifyTemplateName: name,
                        ...(match?.language
                          ? { ownerNotifyTemplateLanguage: match.language }
                          : {}),
                      });
                    }}
                    className="w-full rounded-lg border border-default px-3 py-2"
                  >
                    <option value="">{t("calendar.ownerNotify.chooseTemplate")}</option>
                    {(templates ?? []).map((tpl) => (
                      <option key={`${tpl.name}-${tpl.language}`} value={tpl.name}>
                        {tpl.name} ({tpl.language})
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-sm">
                  <FieldLabel
                    label={t("calendar.ownerNotify.templateLanguage")}
                    tooltip={t("calendar.fieldHints.ownerNotifyTemplateLanguage")}
                  />
                  <input
                    type="text"
                    value={config.ownerNotifyTemplateLanguage ?? "es"}
                    onChange={(e) => onChange({ ownerNotifyTemplateLanguage: e.target.value })}
                    className="w-full rounded-lg border border-default px-3 py-2"
                  />
                </label>
                <div className="space-y-2 sm:col-span-2">
                  <p className="text-xs text-secondary">
                    {t("calendar.ownerNotify.templateHint")}
                  </p>
                  <Link
                    href={`/templates?create=1&botId=${encodeURIComponent(botId)}&channel=whatsapp`}
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:underline"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    {t("calendar.ownerNotify.createTemplate")}
                  </Link>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
