"use client";

import { useLocale, useT } from "@/i18n/context";
import type { WhatsAppTemplate } from "@/types";

interface TemplateMessagePreviewProps {
  template: WhatsAppTemplate;
  variableValues?: string[];
  label?: string;
  className?: string;
}

function formatBodyText(text: string, variableValues?: string[]): string {
  if (variableValues?.length) {
    return text.replace(/\{\{(\d+)\}\}/g, (_, n: string) => {
      const idx = parseInt(n, 10) - 1;
      const val = variableValues[idx];
      return val !== undefined && val !== "" ? val : `{{${n}}}`;
    });
  }
  return text.replace(/\{\{(\d+)\}\}/g, (_: string, n: string) => `{{var${n}}}`);
}

export function TemplateMessagePreview({
  template,
  variableValues,
  label,
  className,
}: TemplateMessagePreviewProps) {
  const locale = useLocale();
  const t = useT();
  const header = template.components.find((c) => c.type === "HEADER");
  const body = template.components.find((c) => c.type === "BODY");
  const footer = template.components.find((c) => c.type === "FOOTER");
  const buttons = template.components.find((c) => c.type === "BUTTONS");
  const isAuthOtp =
    template.category === "AUTHENTICATION" ||
    Boolean(buttons?.buttons?.some((button) => button.type === "OTP"));

  const sampleCode = variableValues?.[0]?.trim() || "123456";
  const authBodyParts = [
    t("templates.authOtpPreviewBody", { code: sampleCode }),
    body?.add_security_recommendation ? t("templates.authOtpPreviewSecurity") : null,
  ].filter(Boolean);
  const authBodyText = authBodyParts.join(" ");
  const authFooterText =
    typeof footer?.code_expiration_minutes === "number"
      ? t("templates.authOtpPreviewExpiration", { minutes: footer.code_expiration_minutes })
      : footer?.text;
  const authButtonText =
    buttons?.buttons?.find((button) => button.type === "OTP")?.text?.trim() ||
    t("templates.authOtpPreviewButton");

  const bodyText = isAuthOtp
    ? authBodyText
    : body?.text
      ? formatBodyText(body.text, variableValues)
      : "";
  const footerText = isAuthOtp ? authFooterText : footer?.text;

  return (
    <div className={className}>
      {label && (
        <p className="text-xs font-medium text-secondary uppercase tracking-wider mb-2">{label}</p>
      )}
      <div className="bg-[#e5ddd5] rounded-xl p-4">
        <div className="max-w-xs ml-auto">
          <div className="bg-surface-elevated rounded-2xl rounded-tr-sm shadow-sm overflow-hidden">
            {header?.text && (
              <div className="px-3 pt-3 pb-1">
                <p className="text-sm font-semibold text-primary leading-snug">{header.text}</p>
              </div>
            )}
            {bodyText && (
              <div className="px-3 py-2">
                <p className="text-sm text-primary whitespace-pre-wrap leading-relaxed">{bodyText}</p>
              </div>
            )}
            {footerText && (
              <div className="px-3 pb-2">
                <p className="text-xs text-muted leading-snug">{footerText}</p>
              </div>
            )}
            {isAuthOtp ? (
              <div className="border-t border-subtle">
                <div className="px-3 py-2 text-center text-xs font-medium text-accent">
                  {authButtonText}
                </div>
              </div>
            ) : buttons?.buttons && buttons.buttons.length > 0 ? (
              <div className="border-t border-subtle">
                {buttons.buttons.map((btn, i) => (
                  <div
                    key={i}
                    className="px-3 py-2 text-center text-xs font-medium text-accent border-t border-subtle first:border-t-0"
                  >
                    {btn.text}
                  </div>
                ))}
              </div>
            ) : null}
            <div className="flex justify-end px-3 pb-2">
              <span className="text-[10px] text-muted">
                {new Date().toLocaleTimeString(locale === "en" ? "en-US" : "es-CO", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
