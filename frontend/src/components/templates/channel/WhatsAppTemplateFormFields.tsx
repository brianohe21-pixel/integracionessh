"use client";

import { useT } from "@/i18n/context";
import { Input, Textarea } from "@/components/ui/Input";
import { extractBodyVariables, sortBodyVariables } from "@/lib/templates/variables";
import type { WhatsAppTemplateFormValues } from "./types";

interface WhatsAppTemplateFormFieldsProps {
  values: WhatsAppTemplateFormValues;
  onChange: (values: WhatsAppTemplateFormValues) => void;
}

export function WhatsAppTemplateFormFields({ values, onChange }: WhatsAppTemplateFormFieldsProps) {
  const t = useT();
  const bodyVars = sortBodyVariables(extractBodyVariables(values.bodyText));

  return (
    <>
      <div>
        <label className="block text-sm font-medium text-secondary mb-1">
          {t("templates.header")}{" "}
          <span className="text-muted font-normal">{t("templates.optional")}</span>
        </label>
        <Input
          type="text"
          value={values.headerText}
          onChange={(e) => onChange({ ...values, headerText: e.target.value })}
          placeholder={t("templates.headerPlaceholder")}
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-secondary mb-1">{t("templates.body")}</label>
        <Textarea
          value={values.bodyText}
          onChange={(e) => {
            const bodyText = e.target.value;
            const newVars = extractBodyVariables(bodyText);
            const bodyExamples: Record<string, string> = {};
            newVars.forEach((v) => {
              bodyExamples[v] = values.bodyExamples[v] ?? "";
            });
            onChange({ ...values, bodyText, bodyExamples });
          }}
          rows={4}
          placeholder={t("templates.bodyPlaceholder")}
          className="resize-none"
        />
        <p className="text-xs text-muted mt-1">{t("templates.bodyVarsHint")}</p>
      </div>

      {bodyVars.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 space-y-3">
          <div>
            <p className="text-sm font-medium text-amber-800">{t("templates.examplesTitle")}</p>
            <p className="text-xs text-amber-600 mt-0.5">{t("templates.examplesRequired")}</p>
          </div>
          {bodyVars.map((v) => (
            <div key={v} className="flex items-center gap-3">
              <span className="text-xs font-mono bg-amber-100 text-amber-700 px-2 py-1 rounded w-12 text-center shrink-0">
                {v}
              </span>
              <Input
                type="text"
                value={values.bodyExamples[v] ?? ""}
                onChange={(e) =>
                  onChange({
                    ...values,
                    bodyExamples: { ...values.bodyExamples, [v]: e.target.value },
                  })
                }
                placeholder={t("templates.exampleVar", { var: "Juan" })}
                className="flex-1 border-amber-300 focus:ring-amber-400"
              />
            </div>
          ))}
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-secondary mb-1">
          {t("templates.footer")}{" "}
          <span className="text-muted font-normal">{t("templates.optional")}</span>
        </label>
        <Input
          type="text"
          value={values.footerText}
          onChange={(e) => onChange({ ...values, footerText: e.target.value })}
          placeholder={t("templates.footerPlaceholder")}
        />
      </div>
    </>
  );
}
