"use client";

import { useMemo } from "react";
import { useT } from "@/i18n/context";
import { Select } from "@/components/ui/Input";
import { SmsTemplatePreview } from "@/components/templates/SmsTemplatePreview";
import { TemplateMessagePreview } from "@/components/templates/TemplateMessagePreview";
import type { OutreachChannel } from "@/types";
import { AuthOtpTemplateFormFields } from "./AuthOtpTemplateFormFields";
import { SmsTemplateFormFields } from "./SmsTemplateFormFields";
import { WhatsAppTemplateFormFields } from "./WhatsAppTemplateFormFields";
import { buildAuthOtpComponents, buildWhatsAppComponents } from "./types";
import type {
  AuthOtpTemplateFormValues,
  SmsTemplateFormValues,
  TemplateCategory,
  WhatsAppTemplateFormValues,
} from "./types";

interface TemplateChannelFormProps {
  channel: OutreachChannel;
  onChannelChange?: (channel: OutreachChannel) => void;
  category?: TemplateCategory;
  whatsapp: WhatsAppTemplateFormValues;
  onWhatsappChange: (values: WhatsAppTemplateFormValues) => void;
  authOtp: AuthOtpTemplateFormValues;
  onAuthOtpChange: (values: AuthOtpTemplateFormValues) => void;
  sms: SmsTemplateFormValues;
  onSmsChange: (values: SmsTemplateFormValues) => void;
  showChannelSelect?: boolean;
  showPreview?: boolean;
  previewName?: string;
}

export function TemplateChannelForm({
  channel,
  onChannelChange,
  category = "UTILITY",
  whatsapp,
  onWhatsappChange,
  authOtp,
  onAuthOtpChange,
  sms,
  onSmsChange,
  showChannelSelect = false,
  showPreview = true,
  previewName = "preview",
}: TemplateChannelFormProps) {
  const t = useT();
  const isAuthOtp = channel === "whatsapp" && category === "AUTHENTICATION";

  const whatsappPreview = useMemo(
    () => ({
      templateId: "preview",
      tenantId: "",
      botId: "",
      name: previewName,
      language: "es",
      category: isAuthOtp ? ("AUTHENTICATION" as const) : ("UTILITY" as const),
      status: "APPROVED" as const,
      components: isAuthOtp
        ? buildAuthOtpComponents(authOtp)
        : buildWhatsAppComponents(whatsapp),
      syncedAt: "",
      createdAt: "",
    }),
    [authOtp, isAuthOtp, previewName, whatsapp]
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
      ) : isAuthOtp ? (
        <AuthOtpTemplateFormFields values={authOtp} onChange={onAuthOtpChange} />
      ) : (
        <WhatsAppTemplateFormFields values={whatsapp} onChange={onWhatsappChange} />
      )}

      {showPreview && channel === "sms" && sms.body.trim() && (
        <SmsTemplatePreview template={smsPreview} label={t("templates.previewLabel")} />
      )}

      {showPreview && channel === "whatsapp" && (isAuthOtp || whatsapp.bodyText.trim()) && (
        <TemplateMessagePreview template={whatsappPreview} label={t("templates.previewLabel")} />
      )}
    </div>
  );
}
