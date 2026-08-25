"use client";

import { useT } from "@/i18n/context";
import { Textarea } from "@/components/ui/Input";
import type { SmsTemplateFormValues } from "./types";

interface SmsTemplateFormFieldsProps {
  values: SmsTemplateFormValues;
  onChange: (values: SmsTemplateFormValues) => void;
}

export function SmsTemplateFormFields({ values, onChange }: SmsTemplateFormFieldsProps) {
  const t = useT();

  return (
    <div>
      <label className="block text-sm font-medium text-secondary mb-1">{t("templates.body")}</label>
      <Textarea
        value={values.body}
        onChange={(e) => onChange({ body: e.target.value })}
        rows={6}
        placeholder={t("templates.smsBodyPlaceholder")}
        className="resize-none"
      />
      <p className="text-xs text-muted mt-1">{t("templates.bodyVarsHint")}</p>
    </div>
  );
}
