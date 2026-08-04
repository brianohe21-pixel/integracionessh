"use client";

import type { SmsTemplate } from "@/types";

interface SmsTemplatePreviewProps {
  template: SmsTemplate;
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

export function SmsTemplatePreview({
  template,
  variableValues,
  label,
  className,
}: SmsTemplatePreviewProps) {
  return (
    <div className={className}>
      {label && (
        <p className="text-xs font-medium text-secondary uppercase tracking-wider mb-2">{label}</p>
      )}
      <div className="rounded-xl border border-default bg-surface p-4">
        <div className="max-w-sm">
          <p className="text-xs font-medium text-muted mb-2">{template.name}</p>
          <p className="text-sm text-primary whitespace-pre-wrap leading-relaxed">
            {formatBodyText(template.body, variableValues)}
          </p>
        </div>
      </div>
    </div>
  );
}
