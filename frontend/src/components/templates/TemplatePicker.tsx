"use client";

import { useMemo } from "react";
import { useT } from "@/i18n/context";
import { useTemplates } from "@/hooks/useTemplates";
import { Select } from "@/components/ui/Input";
import type { MessageTemplate, OutreachChannel } from "@/types";
import { isSmsTemplate } from "@/types";

export interface TemplatePickerValue {
  name: string;
  language: string;
}

interface TemplatePickerProps {
  botId: string;
  channel: OutreachChannel;
  value: TemplatePickerValue | null;
  onChange: (value: TemplatePickerValue, template: MessageTemplate) => void;
  disabled?: boolean;
  className?: string;
}

export function TemplatePicker({
  botId,
  channel,
  value,
  onChange,
  disabled,
  className,
}: TemplatePickerProps) {
  const t = useT();
  const { data: templates = [], isLoading } = useTemplates(botId, channel);

  const approvedTemplates = useMemo(
    () => templates.filter((template) => template.status === "APPROVED"),
    [templates]
  );

  const channelLabel =
    channel === "sms" ? t("outreach.channelSms") : t("outreach.channelWhatsapp");

  const selectValue = value ? `${value.name}||${value.language}` : "";

  return (
    <div className={className}>
      <Select
        value={selectValue}
        disabled={disabled || !botId || isLoading}
        onChange={(e) => {
          const [name, language] = e.target.value.split("||");
          const template = approvedTemplates.find(
            (item) => item.name === name && item.language === language
          );
          if (template) onChange({ name, language }, template);
        }}
      >
        <option value="">
          {isLoading ? t("common.loading") : t("templates.pickerPlaceholder")}
        </option>
        {approvedTemplates.map((template) => (
          <option key={`${template.name}-${template.language}`} value={`${template.name}||${template.language}`}>
            {template.name} ({template.language})
            {isSmsTemplate(template) ? "" : ` — ${template.category}`}
          </option>
        ))}
      </Select>
      {!isLoading && botId && approvedTemplates.length === 0 && (
        <p className="text-xs text-muted mt-1">{t("templates.pickerEmpty", { channel: channelLabel })}</p>
      )}
    </div>
  );
}
