"use client";

import { useLocale } from "@/i18n/context";
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
  const header = template.components.find((c) => c.type === "HEADER");
  const body = template.components.find((c) => c.type === "BODY");
  const footer = template.components.find((c) => c.type === "FOOTER");
  const buttons = template.components.find((c) => c.type === "BUTTONS");

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
            {body?.text && (
              <div className="px-3 py-2">
                <p className="text-sm text-primary whitespace-pre-wrap leading-relaxed">
                  {formatBodyText(body.text, variableValues)}
                </p>
              </div>
            )}
            {footer?.text && (
              <div className="px-3 pb-2">
                <p className="text-xs text-muted leading-snug">{footer.text}</p>
              </div>
            )}
            {buttons?.buttons && buttons.buttons.length > 0 && (
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
            )}
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
