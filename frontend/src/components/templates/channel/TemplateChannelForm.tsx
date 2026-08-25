"use client";

import { useMemo } from "react";
import { useT } from "@/i18n/context";
import { Select } from "@/components/ui/Input";
import { SmsTemplatePreview } from "@/components/templates/SmsTemplatePreview";
import { TemplateMessagePreview } from "@/components/templates/TemplateMessagePreview";
import type { OutreachChannel } from "@/types";
import { SmsTemplateFormFields } from "./SmsTemplateFormFields";
import { WhatsAppTemplateFormFields } from "./WhatsAppTemplateFormFields";
import { buildWhatsAppComponents } from "./types";
import type { SmsTemplateFormValues, WhatsAppTemplateFormValues } from "./types";

interface TemplateChannelFormProps {
  channel: OutreachChannel;
  onChannelChange?: (channel: OutreachChannel) => void;
  whatsapp: WhatsAppTemplateFormValues;
  onWhatsappChange: (values: WhatsAppTemplateFormValues) => void;
  sms: SmsTemplateFormValues;
  onSmsChange: (values: SmsTemplateFormValues) => void;
  showChannelSelect?: boolean;
  showPreview?: boolean;
  previewName?: string;
}

export function TemplateChannelForm({
  channel,
  onChannelChange,
  whatsapp,
  onWhatsappChange,
  sms,
  onSmsChange,
  showChannelSelect = false,
  showPreview = true,
  previewName = "preview",
}: TemplateChannelFormProps) {
  const t = useT();

  const whatsappPreview = useMemo(
    () => ({
      templateId: "preview",
      tenantId: "",
      botId: "",
      name: previewName,
      language: "es",
      category: "UTILITY" as const,
      status: "APPROVED" as const,
      components: buildWhatsAppComponents(whatsapp),
      syncedAt: "",
      createdAt: "",
    }),
    [whatsapp, previewName]
  );

  const smsPreview = useMemo(
    () => ({
      templateId: "preview",
      tenantId: "",
      botId: "",
      channel: "sms" as const,
      name: previewName,
      language: "es",
      category: "UTILITY" as const,
      status: "APPROVED" as const,
      body: sms.body,
      createdAt: "",
      updatedAt: "",
    }),
    [sms.body, previewName]
  );

  return (
    <div className="space-y-4">
      {showChannelSelect && onChannelChange && (
        <div>
          <label className="block text-sm font-medium text-secondary mb-1">
            {t("outreach.channel")}
          </label>
          <Select
            value={channel}
            onChange={(e) => onChannelChange(e.target.value as OutreachChannel)}
          >
            <option value="whatsapp">{t("outreach.channelWhatsapp")}</option>
            <option value="sms">{t("outreach.channelSms")}</option>
          </Select>
          <p className="text-xs text-muted mt-1">{t("templates.channelBuilderHint")}</p>
        </div>
      )}

      {channel === "sms" ? (
        <SmsTemplateFormFields values={sms} onChange={onSmsChange} />
      ) : (
        <WhatsAppTemplateFormFields values={whatsapp} onChange={onWhatsappChange} />
      )}

      {showPreview && channel === "sms" && sms.body.trim() && (
        <SmsTemplatePreview template={smsPreview} label={t("templates.previewLabel")} />
      )}

      {showPreview && channel === "whatsapp" && whatsapp.bodyText.trim() && (
        <TemplateMessagePreview template={whatsappPreview} label={t("templates.previewLabel")} />
      )}
    </div>
  );
}
