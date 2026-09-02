"use client";

import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Input";
import { useT } from "@/i18n/context";
import {
  createStructuredOutputField,
  STRUCTURED_OUTPUT_FIELD_TYPES,
  type StructuredOutputExtractionMethod,
  type StructuredOutputFormField,
} from "@/lib/telephony-structured-outputs";

interface StructuredOutputFieldListEditorProps {
  method: StructuredOutputExtractionMethod;
  fields: StructuredOutputFormField[];
  onChange: (fields: StructuredOutputFormField[]) => void;
}

export function StructuredOutputFieldListEditor({
  method,
  fields,
  onChange,
}: StructuredOutputFieldListEditorProps) {
  const t = useT();

  function updateField(id: string, patch: Partial<StructuredOutputFormField>) {
    onChange(fields.map((field) => (field.id === id ? { ...field, ...patch } : field)));
  }

  function addField() {
    onChange([...fields, createStructuredOutputField()]);
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium text-primary">
          {t("voiceAgents.structuredOutputsFieldsTitle")}
        </p>
        <Button type="button" variant="secondary" size="sm" onClick={addField}>
          <Plus className="h-3.5 w-3.5" />
          {t("voiceAgents.structuredOutputsAddField")}
        </Button>
      </div>

      {fields.length === 0 ? (
        <p className="rounded-lg border border-dashed border-default px-4 py-6 text-center text-sm text-secondary">
          {t("voiceAgents.structuredOutputsFieldsEmpty")}
        </p>
      ) : (
        <div className="space-y-3">
          {fields.map((field) => (
            <div
              key={field.id}
              className="rounded-xl border border-default bg-surface p-4 space-y-3"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-medium text-primary">
                  {field.name.trim() || t("voiceAgents.structuredOutputsUntitledField")}
                </p>
                <button
                  type="button"
                  onClick={() => onChange(fields.filter((item) => item.id !== field.id))}
                  className="rounded p-1.5 text-danger hover:bg-danger/10"
                  aria-label={t("voiceAgents.structuredOutputsRemoveField")}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs text-secondary">
                    {t("voiceAgents.structuredOutputsFieldName")}
                  </label>
                  <Input
                    value={field.name}
                    onChange={(e) =>
                      updateField(field.id, {
                        name: e.target.value.replace(/[^a-zA-Z0-9_]/g, ""),
                      })
                    }
                    placeholder="customer_name"
                  />
                </div>

                {method === "ai" ? (
                  <div>
                    <label className="mb-1 block text-xs text-secondary">
                      {t("voiceAgents.structuredOutputsFieldType")}
                    </label>
                    <Select
                      value={field.type}
                      onChange={(e) =>
                        updateField(field.id, {
                          type: e.target.value as StructuredOutputFormField["type"],
                        })
                      }
                    >
                      {STRUCTURED_OUTPUT_FIELD_TYPES.map((type) => (
                        <option key={type} value={type}>
                          {t(`voiceAgents.structuredOutputsFieldTypes.${type}`)}
                        </option>
                      ))}
                    </Select>
                  </div>
                ) : null}

                <div className={method === "regex" ? "sm:col-span-2" : ""}>
                  <label className="mb-1 block text-xs text-secondary">
                    {t("voiceAgents.structuredOutputsFieldDescription")}
                  </label>
                  <Input
                    value={field.description}
                    onChange={(e) => updateField(field.id, { description: e.target.value })}
                    placeholder={t("voiceAgents.structuredOutputsFieldDescriptionPlaceholder")}
                  />
                </div>

                {method === "regex" ? (
                  <div className="sm:col-span-2">
                    <label className="mb-1 block text-xs text-secondary">
                      {t("voiceAgents.structuredOutputsFieldPattern")}
                    </label>
                    <Input
                      value={field.pattern ?? ""}
                      onChange={(e) => updateField(field.id, { pattern: e.target.value })}
                      placeholder="ORD-[A-Z0-9]+"
                      className="font-mono text-xs"
                    />
                  </div>
                ) : null}
              </div>

              {method === "ai" ? (
                <label className="flex items-center gap-2 text-sm text-primary">
                  <input
                    type="checkbox"
                    checked={field.required}
                    onChange={(e) => updateField(field.id, { required: e.target.checked })}
                  />
                  {t("voiceAgents.structuredOutputsFieldRequired")}
                </label>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
