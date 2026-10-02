"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { TemplatePicker, type TemplatePickerValue } from "@/components/templates/TemplatePicker";
import { TemplateMessagePreview } from "@/components/templates/TemplateMessagePreview";
import { useSendConversationTemplate } from "@/hooks/useConversations";
import { useT } from "@/i18n/context";
import {
  buildTemplateSendComponents,
  emptySlotValues,
  listTemplateSendSlots,
  placeholderValues,
  slotsAreComplete,
  type TemplateSendSlot,
} from "@/lib/templates/send-components";
import { isSmsTemplate, type Conversation, type MessageTemplate } from "@/types";

type Props = {
  conversation: Conversation;
};

function slotLabel(
  slot: TemplateSendSlot,
  t: (key: string, values?: Record<string, string | number>) => string
): string {
  if (slot.kind === "auth_code") return t("templates.authOtpCodeLabel");
  if (slot.kind === "header_text") return t("templates.sendVarHeader", { key: slot.placeholder });
  if (slot.kind === "button_url") {
    return t("templates.sendVarButton", {
      name: slot.buttonText?.trim() || String((slot.buttonIndex ?? 0) + 1),
      key: slot.placeholder,
    });
  }
  return slot.placeholder;
}

export function ConversationTemplateComposeBar({ conversation }: Props) {
  const t = useT();
  const sendTemplate = useSendConversationTemplate();
  const [selection, setSelection] = useState<TemplatePickerValue | null>(null);
  const [template, setTemplate] = useState<MessageTemplate | null>(null);
  const [params, setParams] = useState<Record<string, string>>({});
  const [error, setError] = useState("");

  useEffect(() => {
    setSelection(null);
    setTemplate(null);
    setParams({});
    setError("");
  }, [conversation.conversationId]);

  const slots = useMemo(() => {
    if (!template || isSmsTemplate(template)) return [];
    return listTemplateSendSlots(template);
  }, [template]);

  const canSend =
    Boolean(selection && template) &&
    slotsAreComplete(slots, params) &&
    !sendTemplate.isPending;

  function handleTemplateChange(value: TemplatePickerValue, next: MessageTemplate) {
    setSelection(value);
    setTemplate(next);
    setError("");
    if (isSmsTemplate(next)) {
      setParams({});
      return;
    }
    setParams(emptySlotValues(listTemplateSendSlots(next)));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selection || !template || isSmsTemplate(template) || !canSend) return;

    const components = buildTemplateSendComponents(template, params);

    setError("");
    try {
      await sendTemplate.mutateAsync({
        conversationId: conversation.conversationId,
        botId: conversation.botId,
        templateName: selection.name,
        language: selection.language,
        ...(components ? { components } : {}),
      });
      setSelection(null);
      setTemplate(null);
      setParams({});
    } catch (err) {
      setError(err instanceof Error ? err.message : t("conversations.templateSendFailed"));
    }
  }

  const whatsappTemplate = template && !isSmsTemplate(template) ? template : null;

  return (
    <form onSubmit={handleSubmit} className="conversations-compose-bar relative space-y-3 py-2 sm:py-3">
      <div className="rounded-2xl border border-default bg-surface-elevated p-3 sm:p-4">
        <p className="text-sm font-medium text-primary">
          {t("conversations.templateComposeTitle")}
        </p>
        <p className="mt-1 text-xs leading-relaxed text-secondary">
          {t("conversations.templateComposeHint")}
        </p>

        <div className="mt-3 space-y-3">
          <TemplatePicker
            botId={conversation.botId}
            channel="whatsapp"
            value={selection}
            onChange={handleTemplateChange}
            disabled={sendTemplate.isPending}
          />

          {slots.length > 0 ? (
            <div className="space-y-2">
              <p className="text-xs font-medium text-secondary">
                {t("templates.templateVars")}
              </p>
              {slots.map((slot) => (
                <div key={slot.key}>
                  <label className="mb-1 block text-xs text-secondary">
                    {slotLabel(slot, t)}
                  </label>
                  <Input
                    type="text"
                    value={params[slot.key] ?? ""}
                    onChange={(e) =>
                      setParams((prev) => ({ ...prev, [slot.key]: e.target.value }))
                    }
                    disabled={sendTemplate.isPending}
                    placeholder={
                      slot.kind === "auth_code"
                        ? "123456"
                        : t("templates.valueFor", { key: slot.placeholder })
                    }
                  />
                </div>
              ))}
            </div>
          ) : null}

          {whatsappTemplate ? (
            <TemplateMessagePreview
              template={whatsappTemplate}
              variableValues={
                placeholderValues(slots, params, "auth_code") ??
                placeholderValues(slots, params, "body_text")
              }
              headerVariableValues={placeholderValues(slots, params, "header_text")}
              label={t("templates.previewLabel")}
            />
          ) : null}
        </div>

        {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
          <Link
            href="/templates"
            className="text-xs font-medium text-accent hover:text-accent"
          >
            {t("conversations.templateComposeManage")}
          </Link>
          <Button type="submit" disabled={!canSend} className="inline-flex items-center gap-2">
            {sendTemplate.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            {sendTemplate.isPending
              ? t("conversations.templateSending")
              : t("conversations.templateSend")}
          </Button>
        </div>
      </div>
    </form>
  );
}
