"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { TemplatePicker, type TemplatePickerValue } from "@/components/templates/TemplatePicker";
import { TemplateMessagePreview } from "@/components/templates/TemplateMessagePreview";
import { isAuthenticationTemplate } from "@/components/templates/channel/types";
import { useSendConversationTemplate } from "@/hooks/useConversations";
import { useT } from "@/i18n/context";
import { extractBodyVariables, sortBodyVariables } from "@/lib/templates/variables";
import { isSmsTemplate, type Conversation, type MessageTemplate } from "@/types";

type Props = {
  conversation: Conversation;
};

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

  const variableKeys = useMemo(() => {
    if (!template || isSmsTemplate(template)) return [];
    if (
      template.category === "AUTHENTICATION" ||
      isAuthenticationTemplate(template.components)
    ) {
      return ["{{1}}"];
    }
    const bodyText = template.components.find((c) => c.type === "BODY")?.text ?? "";
    return sortBodyVariables(extractBodyVariables(bodyText));
  }, [template]);

  const canSend =
    Boolean(selection && template) &&
    variableKeys.every((key) => Boolean(params[key]?.trim())) &&
    !sendTemplate.isPending;

  function handleTemplateChange(value: TemplatePickerValue, next: MessageTemplate) {
    setSelection(value);
    setTemplate(next);
    setError("");
    if (isSmsTemplate(next)) {
      setParams({});
      return;
    }
    if (
      next.category === "AUTHENTICATION" ||
      isAuthenticationTemplate(next.components)
    ) {
      setParams({ "{{1}}": "" });
      return;
    }
    const bodyText = next.components.find((c) => c.type === "BODY")?.text ?? "";
    const vars = sortBodyVariables(extractBodyVariables(bodyText));
    const initial: Record<string, string> = {};
    vars.forEach((v) => {
      initial[v] = "";
    });
    setParams(initial);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selection || !template || isSmsTemplate(template) || !canSend) return;

    const isAuthOtp =
      template.category === "AUTHENTICATION" ||
      isAuthenticationTemplate(template.components);
    const otpCode = params["{{1}}"]?.trim() || Object.values(params)[0]?.trim() || "";
    const components = isAuthOtp
      ? [
          {
            type: "body",
            parameters: [{ type: "text" as const, text: otpCode }],
          },
          {
            type: "button",
            sub_type: "url",
            index: "0",
            parameters: [{ type: "text" as const, text: otpCode }],
          },
        ]
      : variableKeys.length
        ? [
            {
              type: "body",
              parameters: variableKeys.map((key) => ({
                type: "text" as const,
                text: params[key] ?? "",
              })),
            },
          ]
        : undefined;

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

          {variableKeys.length > 0 ? (
            <div className="space-y-2">
              <p className="text-xs font-medium text-secondary">
                {t("templates.templateVars")}
              </p>
              {variableKeys.map((key) => {
                const isAuthCodeField =
                  template &&
                  !isSmsTemplate(template) &&
                  (template.category === "AUTHENTICATION" ||
                    isAuthenticationTemplate(template.components)) &&
                  key === "{{1}}";
                return (
                  <div key={key}>
                    <label className="mb-1 block text-xs text-secondary">
                      {isAuthCodeField ? t("templates.authOtpCodeLabel") : key}
                    </label>
                    <Input
                      type="text"
                      value={params[key] ?? ""}
                      onChange={(e) =>
                        setParams((prev) => ({ ...prev, [key]: e.target.value }))
                      }
                      disabled={sendTemplate.isPending}
                      placeholder={
                        isAuthCodeField
                          ? "123456"
                          : t("templates.valueFor", { key })
                      }
                    />
                  </div>
                );
              })}
            </div>
          ) : null}

          {template && !isSmsTemplate(template) ? (
            <TemplateMessagePreview
              template={template}
              variableValues={
                variableKeys.length
                  ? variableKeys.map((key) => params[key] ?? "")
                  : undefined
              }
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
