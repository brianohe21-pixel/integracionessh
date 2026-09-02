"use client";

import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { useT } from "@/i18n/context";
import type { HostedFormField, HostedFormFieldType } from "@/types";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Input";
import { createHostedFormField, FORM_FIELD_TYPE_ORDER } from "@/lib/hosted-form-fields";

interface FormFieldListEditorProps {
  fields: HostedFormField[];
  onChange: (fields: HostedFormField[]) => void;
}

export function FormFieldListEditor({ fields, onChange }: FormFieldListEditorProps) {
  const t = useT();

  function updateField(id: string, patch: Partial<HostedFormField>) {
    onChange(fields.map((field) => (field.id === id ? { ...field, ...patch } : field)));
  }

  function moveField(index: number, direction: -1 | 1) {
    const next = index + direction;
    if (next < 0 || next >= fields.length) return;
    const copy = [...fields];
    const [item] = copy.splice(index, 1);
    copy.splice(next, 0, item);
    onChange(copy);
  }

  function addField(type: HostedFormFieldType) {
    onChange([...fields, createHostedFormField(type)]);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-primary">{t("forms.fields.title")}</h3>
        <Select
          defaultValue=""
          onChange={(e) => {
            const type = e.target.value as HostedFormFieldType;
            if (type) addField(type);
            e.target.value = "";
          }}
        >
          <option value="">{t("forms.fields.add")}</option>
          {FORM_FIELD_TYPE_ORDER.map((type) => (
            <option key={type} value={type}>
              {t(`forms.fieldTypes.${type}`)}
            </option>
          ))}
        </Select>
      </div>
      {fields.length === 0 ? (
        <p className="text-sm text-secondary">{t("forms.fields.empty")}</p>
      ) : (
        <div className="space-y-3">
          {fields.map((field, index) => (
            <div key={field.id} className="rounded-xl border border-default bg-surface-elevated p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium text-primary">{t(`forms.fieldTypes.${field.type}`)}</p>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => moveField(index, -1)}
                    className="rounded p-1.5 text-secondary hover:text-primary"
                    aria-label={t("forms.fields.moveUp")}
                  >
                    <ArrowUp className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => moveField(index, 1)}
                    className="rounded p-1.5 text-secondary hover:text-primary"
                    aria-label={t("forms.fields.moveDown")}
                  >
                    <ArrowDown className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onChange(fields.filter((item) => item.id !== field.id))}
                    className="rounded p-1.5 text-danger hover:bg-danger/10"
                    aria-label={t("forms.fields.remove")}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs text-secondary">{t("forms.fields.label")}</label>
                  <Input
                    value={field.label}
                    onChange={(e) => updateField(field.id, { label: e.target.value })}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-secondary">{t("forms.fields.name")}</label>
                  <Input
                    value={field.name}
                    onChange={(e) =>
                      updateField(field.id, { name: e.target.value.replace(/[^a-zA-Z0-9_]/g, "") })
                    }
                  />
                </div>
                {field.type !== "checkbox" && field.type !== "hidden" ? (
                  <div>
                    <label className="mb-1 block text-xs text-secondary">{t("forms.fields.placeholder")}</label>
                    <Input
                      value={field.placeholder ?? ""}
                      onChange={(e) => updateField(field.id, { placeholder: e.target.value })}
                    />
                  </div>
                ) : null}
                <div>
                  <label className="mb-1 block text-xs text-secondary">{t("forms.fields.helper")}</label>
                  <Input
                    value={field.helperText ?? ""}
                    onChange={(e) => updateField(field.id, { helperText: e.target.value })}
                  />
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm text-primary">
                <input
                  type="checkbox"
                  checked={field.required}
                  onChange={(e) => updateField(field.id, { required: e.target.checked })}
                />
                {t("forms.fields.required")}
              </label>
              {field.type === "select" || field.type === "radio" || (field.type === "checkbox" && (field.options?.length ?? 0) > 0) ? (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-secondary">{t("forms.fields.options")}</p>
                  {(field.options ?? []).map((option, optionIndex) => (
                    <div key={`${field.id}-${optionIndex}`} className="flex gap-2">
                      <Input
                        value={option.label}
                        placeholder={t("forms.fields.optionLabel")}
                        onChange={(e) => {
                          const options = [...(field.options ?? [])];
                          options[optionIndex] = { ...options[optionIndex], label: e.target.value };
                          updateField(field.id, { options });
                        }}
                      />
                      <Input
                        value={option.value}
                        placeholder={t("forms.fields.optionValue")}
                        onChange={(e) => {
                          const options = [...(field.options ?? [])];
                          options[optionIndex] = {
                            ...options[optionIndex],
                            value: e.target.value.replace(/[^a-zA-Z0-9_-]/g, ""),
                          };
                          updateField(field.id, { options });
                        }}
                      />
                      <button
                        type="button"
                        className="rounded p-1.5 text-danger"
                        onClick={() => {
                          const options = (field.options ?? []).filter((_, i) => i !== optionIndex);
                          updateField(field.id, { options });
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      const options = [
                        ...(field.options ?? []),
                        {
                          value: `option_${(field.options?.length ?? 0) + 1}`,
                          label: `Option ${(field.options?.length ?? 0) + 1}`,
                        },
                      ];
                      updateField(field.id, { options });
                    }}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    {t("forms.fields.addOption")}
                  </Button>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
