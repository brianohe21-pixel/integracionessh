"use client";

import { Plus, Trash2 } from "lucide-react";
import { useT } from "@/i18n/context";
import { Input, Select, Textarea } from "@/components/ui/Input";
import { extractBodyVariables, sortBodyVariables } from "@/lib/templates/variables";
import type { TemplateButton } from "@/types";
import {
  BUTTON_TEXT_MAX_LENGTH,
  getButtonGroup,
  maxButtonsForGroup,
  type TemplateButtonFormValue,
  type WhatsAppTemplateFormValues,
} from "./types";

interface WhatsAppTemplateFormFieldsProps {
  values: WhatsAppTemplateFormValues;
  onChange: (values: WhatsAppTemplateFormValues) => void;
}

function defaultButtonForGroup(
  group: "quick_reply" | "cta" | null
): TemplateButtonFormValue {
  if (group === "cta") {
    return { type: "URL", text: "", url: "" };
  }
  return { type: "QUICK_REPLY", text: "" };
}

export function WhatsAppTemplateFormFields({ values, onChange }: WhatsAppTemplateFormFieldsProps) {
  const t = useT();
  const bodyVars = sortBodyVariables(extractBodyVariables(values.bodyText));
  const buttonGroup = getButtonGroup(values.buttons);
  const canAddButton =
    buttonGroup !== "mixed" && values.buttons.length < maxButtonsForGroup(buttonGroup);

  function updateButtons(buttons: TemplateButtonFormValue[]) {
    onChange({ ...values, buttons });
  }

  function addButton() {
    const group = buttonGroup === "mixed" ? null : buttonGroup;
    updateButtons([...values.buttons, defaultButtonForGroup(group)]);
  }

  function removeButton(index: number) {
    updateButtons(values.buttons.filter((_, i) => i !== index));
  }

  function updateButton(index: number, patch: Partial<TemplateButtonFormValue>) {
    updateButtons(
      values.buttons.map((button, i) => (i === index ? { ...button, ...patch } : button))
    );
  }

  function handleButtonTypeChange(index: number, type: TemplateButton["type"]) {
    const next: TemplateButtonFormValue = { type, text: values.buttons[index]?.text ?? "" };
    if (type === "URL") {
      next.url = values.buttons[index]?.url ?? "";
      next.urlExample = values.buttons[index]?.urlExample ?? "";
    }
    if (type === "PHONE_NUMBER") {
      next.phone_number = values.buttons[index]?.phone_number ?? "";
    }
    updateButton(index, next);
  }

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

      <div className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <label className="block text-sm font-medium text-secondary">
              {t("templates.buttons")}{" "}
              <span className="text-muted font-normal">{t("templates.optional")}</span>
            </label>
            <p className="text-xs text-muted mt-1">{t("templates.buttonsHint")}</p>
          </div>
          <button
            type="button"
            onClick={addButton}
            disabled={!canAddButton}
            className="inline-flex items-center gap-1.5 rounded-lg border border-default px-3 py-1.5 text-sm font-medium text-secondary hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            {t("templates.addButton")}
          </button>
        </div>

        {buttonGroup === "mixed" && (
          <p className="text-sm text-red-600">{t("templates.buttonsMixedError")}</p>
        )}

        {values.buttons.map((button, index) => (
          <div
            key={index}
            className="rounded-lg border border-default bg-surface p-4 space-y-3"
          >
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-medium text-secondary">
                {t("templates.buttonLabel", { index: index + 1 })}
              </span>
              <button
                type="button"
                onClick={() => removeButton(index)}
                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-red-600 hover:bg-red-50"
              >
                <Trash2 className="h-3.5 w-3.5" />
                {t("templates.removeButton")}
              </button>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-medium text-secondary mb-1">
                  {t("templates.buttonType")}
                </label>
                <Select
                  value={button.type}
                  onChange={(e) =>
                    handleButtonTypeChange(index, e.target.value as TemplateButton["type"])
                  }
                >
                  <option value="QUICK_REPLY">{t("templates.buttonTypeQuickReply")}</option>
                  <option value="URL">{t("templates.buttonTypeUrl")}</option>
                  <option value="PHONE_NUMBER">{t("templates.buttonTypePhone")}</option>
                </Select>
              </div>
              <div>
                <label className="block text-xs font-medium text-secondary mb-1">
                  {t("templates.buttonText")}
                </label>
                <Input
                  type="text"
                  value={button.text}
                  maxLength={BUTTON_TEXT_MAX_LENGTH}
                  onChange={(e) => updateButton(index, { text: e.target.value })}
                  placeholder={t("templates.buttonTextPlaceholder")}
                />
                <p className="text-xs text-muted mt-1">
                  {t("templates.buttonTextMax", { max: BUTTON_TEXT_MAX_LENGTH })}
                </p>
              </div>
            </div>

            {button.type === "URL" && (
              <>
                <div>
                  <label className="block text-xs font-medium text-secondary mb-1">
                    {t("templates.buttonUrl")}
                  </label>
                  <Input
                    type="text"
                    value={button.url ?? ""}
                    onChange={(e) => updateButton(index, { url: e.target.value })}
                    placeholder={t("templates.buttonUrlPlaceholder")}
                  />
                </div>
                {/\{\{\d+\}\}/.test(button.url ?? "") && (
                  <div>
                    <label className="block text-xs font-medium text-secondary mb-1">
                      {t("templates.buttonUrlExample")}
                    </label>
                    <Input
                      type="text"
                      value={button.urlExample ?? ""}
                      onChange={(e) => updateButton(index, { urlExample: e.target.value })}
                      placeholder={t("templates.buttonUrlExamplePlaceholder")}
                    />
                  </div>
                )}
              </>
            )}

            {button.type === "PHONE_NUMBER" && (
              <div>
                <label className="block text-xs font-medium text-secondary mb-1">
                  {t("templates.buttonPhone")}
                </label>
                <Input
                  type="text"
                  value={button.phone_number ?? ""}
                  onChange={(e) => updateButton(index, { phone_number: e.target.value })}
                  placeholder={t("templates.buttonPhonePlaceholder")}
                />
              </div>
            )}
          </div>
        ))}
      </div>
    </>
  );
}
