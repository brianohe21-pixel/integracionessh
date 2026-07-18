"use client";

import { Plus, Trash2 } from "lucide-react";
import { useT } from "@/i18n/context";
import { Button } from "@/components/ui/Button";
import type { VisualField, VisualFieldType, VisualMetaFlow } from "@/lib/meta-flow-editor";

interface MetaFlowVisualEditorProps {
  value: VisualMetaFlow;
  onChange: (value: VisualMetaFlow) => void;
  readOnly?: boolean;
}

function updateField(
  fields: VisualField[],
  id: string,
  patch: Partial<VisualField>
): VisualField[] {
  return fields.map((field) => (field.id === id ? { ...field, ...patch } : field));
}

export function MetaFlowVisualEditor({ value, onChange, readOnly }: MetaFlowVisualEditorProps) {
  const t = useT();

  function patchFlow(patch: Partial<VisualMetaFlow>) {
    onChange({ ...value, ...patch });
  }

  function addField() {
    const id = `field-${Date.now()}`;
    patchFlow({
      fields: [
        ...value.fields,
        {
          id,
          name: `field_${value.fields.length + 1}`,
          label: t("metaFlows.newField"),
          type: "text",
          required: false,
        },
      ],
    });
  }

  function removeField(id: string) {
    if (value.fields.length <= 1) return;
    patchFlow({ fields: value.fields.filter((field) => field.id !== id) });
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px]">
      <div className="space-y-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-secondary">
            {t("metaFlows.screenTitle")}
          </label>
          <input
            value={value.screenTitle}
            onChange={(e) => patchFlow({ screenTitle: e.target.value })}
            readOnly={readOnly}
            className="w-full rounded-lg border border-default p-2 text-sm"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-secondary">
            {t("metaFlows.submitLabel")}
          </label>
          <input
            value={value.submitLabel}
            onChange={(e) => patchFlow({ submitLabel: e.target.value })}
            readOnly={readOnly}
            className="w-full rounded-lg border border-default p-2 text-sm"
          />
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted">
              {t("metaFlows.fields")}
            </p>
            {!readOnly && (
              <Button type="button" variant="secondary" size="sm" onClick={addField}>
                <Plus className="h-3.5 w-3.5" />
                {t("metaFlows.addField")}
              </Button>
            )}
          </div>

          {value.fields.map((field) => (
            <div key={field.id} className="space-y-2 rounded-xl border border-default p-3">
              <div className="flex items-start justify-between gap-2">
                <p className="text-xs font-medium text-secondary">{t("metaFlows.field")}</p>
                {!readOnly && value.fields.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeField(field.id)}
                    className="rounded p-1 text-muted hover:bg-danger/10 hover:text-danger"
                    aria-label={t("common.delete")}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-[11px] text-muted">{t("metaFlows.fieldLabel")}</label>
                  <input
                    value={field.label}
                    onChange={(e) =>
                      patchFlow({
                        fields: updateField(value.fields, field.id, { label: e.target.value }),
                      })
                    }
                    readOnly={readOnly}
                    className="w-full rounded-lg border border-default p-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] text-muted">{t("metaFlows.fieldName")}</label>
                  <input
                    value={field.name}
                    onChange={(e) =>
                      patchFlow({
                        fields: updateField(value.fields, field.id, {
                          name: e.target.value.replace(/\s+/g, "_"),
                        }),
                      })
                    }
                    readOnly={readOnly}
                    className="w-full rounded-lg border border-default p-2 font-mono text-sm"
                  />
                </div>
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-[11px] text-muted">{t("metaFlows.fieldType")}</label>
                  <select
                    value={field.type}
                    onChange={(e) =>
                      patchFlow({
                        fields: updateField(value.fields, field.id, {
                          type: e.target.value as VisualFieldType,
                          options:
                            e.target.value === "radio"
                              ? field.options ?? [
                                  { id: "1", title: "Option 1" },
                                  { id: "2", title: "Option 2" },
                                ]
                              : undefined,
                        }),
                      })
                    }
                    disabled={readOnly}
                    className="w-full rounded-lg border border-default bg-surface-elevated p-2 text-sm"
                  >
                    <option value="text">{t("metaFlows.fieldTypeText")}</option>
                    <option value="email">{t("metaFlows.fieldTypeEmail")}</option>
                    <option value="phone">{t("metaFlows.fieldTypePhone")}</option>
                    <option value="number">{t("metaFlows.fieldTypeNumber")}</option>
                    <option value="radio">{t("metaFlows.fieldTypeRadio")}</option>
                  </select>
                </div>
                <label className="flex items-end gap-2 pb-2 text-sm text-secondary">
                  <input
                    type="checkbox"
                    checked={field.required}
                    onChange={(e) =>
                      patchFlow({
                        fields: updateField(value.fields, field.id, { required: e.target.checked }),
                      })
                    }
                    disabled={readOnly}
                  />
                  {t("metaFlows.fieldRequired")}
                </label>
              </div>

              {field.type === "radio" && (
                <div className="space-y-2">
                  <p className="text-[11px] text-muted">{t("metaFlows.radioOptions")}</p>
                  {(field.options ?? []).map((option, index) => (
                    <div key={`${field.id}-${index}`} className="grid grid-cols-2 gap-2">
                      <input
                        value={option.title}
                        onChange={(e) => {
                          const options = [...(field.options ?? [])];
                          options[index] = { ...options[index], title: e.target.value };
                          patchFlow({
                            fields: updateField(value.fields, field.id, { options }),
                          });
                        }}
                        readOnly={readOnly}
                        placeholder={t("metaFlows.optionTitle")}
                        className="rounded-lg border border-default p-2 text-sm"
                      />
                      <input
                        value={option.id}
                        onChange={(e) => {
                          const options = [...(field.options ?? [])];
                          options[index] = { ...options[index], id: e.target.value };
                          patchFlow({
                            fields: updateField(value.fields, field.id, { options }),
                          });
                        }}
                        readOnly={readOnly}
                        placeholder={t("metaFlows.optionId")}
                        className="rounded-lg border border-default p-2 font-mono text-sm"
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-default bg-surface-muted/40 p-4">
        <p className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-muted">
          {t("metaFlows.preview")}
        </p>
        <div className="rounded-xl border border-default bg-surface-elevated p-4 shadow-sm">
          <p className="mb-3 text-sm font-semibold text-primary">{value.screenTitle}</p>
          <div className="space-y-3">
            {value.fields.map((field) => (
              <div key={field.id}>
                <p className="mb-1 text-xs text-secondary">
                  {field.label}
                  {field.required ? " *" : ""}
                </p>
                {field.type === "radio" ? (
                  <div className="space-y-1">
                    {(field.options ?? []).map((option) => (
                      <div
                        key={option.id}
                        className="rounded-lg border border-default px-2 py-1.5 text-xs text-primary"
                      >
                        {option.title}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="h-9 rounded-lg border border-default bg-surface-muted/50" />
                )}
              </div>
            ))}
          </div>
          <div className="mt-4 rounded-lg bg-accent px-3 py-2 text-center text-xs font-medium text-white">
            {value.submitLabel}
          </div>
        </div>
      </div>
    </div>
  );
}
