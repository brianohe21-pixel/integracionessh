"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/i18n/context";
import type { HostedForm, HostedFormCrmMapping, HostedFormField } from "@/types";
import { useBots } from "@/hooks/useBots";
import {
  useCreateHostedForm,
  useHostedFormFlowOptions,
  useUpdateHostedForm,
} from "@/hooks/useHostedForms";
import { Button } from "@/components/ui/Button";
import { Input, Select, Textarea } from "@/components/ui/Input";
import { FormFieldListEditor } from "@/components/forms/FormFieldListEditor";
import { FormRenderer } from "@/components/forms/FormRenderer";
import { defaultEditorFields } from "@/lib/hosted-form-fields";

interface FormEditorProps {
  form?: HostedForm;
}

export function FormEditor({ form }: FormEditorProps) {
  const t = useT();
  const router = useRouter();
  const { data: bots } = useBots();
  const { data: flowOptions } = useHostedFormFlowOptions();
  const createForm = useCreateHostedForm();
  const updateForm = useUpdateHostedForm(form?.formId ?? "");

  const [name, setName] = useState(form?.name ?? "");
  const [description, setDescription] = useState(form?.description ?? "");
  const [botId, setBotId] = useState(form?.botId ?? "");
  const [fields, setFields] = useState<HostedFormField[]>(form?.fields ?? defaultEditorFields());
  const [submitLabel, setSubmitLabel] = useState(form?.submitLabel ?? t("forms.defaults.submit"));
  const [successTitle, setSuccessTitle] = useState(form?.successTitle ?? t("forms.defaults.successTitle"));
  const [successMessage, setSuccessMessage] = useState(
    form?.successMessage ?? t("forms.defaults.successMessage")
  );
  const [redirectUrl, setRedirectUrl] = useState(form?.redirectUrl ?? "");
  const [flowId, setFlowId] = useState(form?.flowId ?? "");
  const [crmMapping, setCrmMapping] = useState<HostedFormCrmMapping>(
    form?.crmMapping ?? { name: "name", email: "email", phone: "phone" }
  );
  const [createLeadOnSubmit, setCreateLeadOnSubmit] = useState(form?.createLeadOnSubmit ?? false);
  const [error, setError] = useState("");
  const [previewValues, setPreviewValues] = useState<Record<string, string | boolean | string[]>>({});

  const fieldNames = useMemo(() => fields.map((field) => field.name), [fields]);
  const saving = createForm.isPending || updateForm.isPending;

  async function handleSave() {
    setError("");
    const body = {
      name: name.trim(),
      description: description.trim() || undefined,
      botId: botId || undefined,
      fields,
      submitLabel: submitLabel.trim(),
      successTitle: successTitle.trim(),
      successMessage: successMessage.trim(),
      redirectUrl: redirectUrl.trim() || undefined,
      flowId: flowId || undefined,
      crmMapping,
      createLeadOnSubmit,
    };
    try {
      if (form) {
        await updateForm.mutateAsync(body);
      } else {
        const created = await createForm.mutateAsync(body);
        router.push(`/forms/${created.formId}/edit`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t("forms.saveError"));
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
      <div className="space-y-6">
        <section className="space-y-3 rounded-xl border border-default bg-surface-elevated p-4">
          <h3 className="text-sm font-semibold text-primary">{t("forms.editor.details")}</h3>
          <div>
            <label className="mb-1 block text-xs text-secondary">{t("forms.editor.name")}</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-xs text-secondary">{t("forms.editor.description")}</label>
            <Textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-xs text-secondary">{t("forms.editor.bot")}</label>
            <Select value={botId} onChange={(e) => setBotId(e.target.value)}>
              <option value="">{t("forms.editor.botNone")}</option>
              {(bots ?? []).map((bot) => (
                <option key={bot.botId} value={bot.botId}>
                  {bot.name}
                </option>
              ))}
            </Select>
          </div>
        </section>

        <FormFieldListEditor fields={fields} onChange={setFields} />

        <section className="space-y-3 rounded-xl border border-default bg-surface-elevated p-4">
          <h3 className="text-sm font-semibold text-primary">{t("forms.editor.submit")}</h3>
          <div>
            <label className="mb-1 block text-xs text-secondary">{t("forms.editor.submitLabel")}</label>
            <Input value={submitLabel} onChange={(e) => setSubmitLabel(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-xs text-secondary">{t("forms.editor.successTitle")}</label>
            <Input value={successTitle} onChange={(e) => setSuccessTitle(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-xs text-secondary">{t("forms.editor.successMessage")}</label>
            <Textarea rows={3} value={successMessage} onChange={(e) => setSuccessMessage(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-xs text-secondary">{t("forms.editor.redirectUrl")}</label>
            <Input
              value={redirectUrl}
              placeholder="https://"
              onChange={(e) => setRedirectUrl(e.target.value)}
            />
          </div>
        </section>

        <section className="space-y-3 rounded-xl border border-default bg-surface-elevated p-4">
          <h3 className="text-sm font-semibold text-primary">{t("forms.editor.crm")}</h3>
          <label className="flex items-center gap-2 text-sm text-primary">
            <input
              type="checkbox"
              checked={createLeadOnSubmit}
              onChange={(e) => setCreateLeadOnSubmit(e.target.checked)}
            />
            {t("forms.editor.createLead")}
          </label>
          {(["name", "email", "phone"] as const).map((key) => (
            <div key={key}>
              <label className="mb-1 block text-xs text-secondary">{t(`forms.crm.${key}`)}</label>
              <Select
                value={crmMapping[key] ?? ""}
                onChange={(e) => setCrmMapping({ ...crmMapping, [key]: e.target.value || undefined })}
              >
                <option value="">{t("forms.crm.unmapped")}</option>
                {fieldNames.map((fieldName) => (
                  <option key={fieldName} value={fieldName}>
                    {fieldName}
                  </option>
                ))}
              </Select>
            </div>
          ))}
          <div>
            <label className="mb-1 block text-xs text-secondary">{t("forms.editor.flow")}</label>
            <Select value={flowId} onChange={(e) => setFlowId(e.target.value)}>
              <option value="">{t("forms.editor.flowNone")}</option>
              {(flowOptions?.items ?? []).map((flow) => (
                <option key={flow.flowId} value={flow.flowId}>
                  {flow.name}
                  {flow.enabled ? "" : ` (${t("forms.editor.flowDraft")})`}
                </option>
              ))}
            </Select>
            <p className="mt-1 text-xs text-secondary">{t("forms.editor.flowHint")}</p>
          </div>
        </section>

        {error ? <p className="text-sm text-danger">{error}</p> : null}
        <Button type="button" onClick={() => void handleSave()} disabled={saving || !name.trim()}>
          {saving ? t("forms.saving") : t("forms.save")}
        </Button>
      </div>

      <div className="xl:sticky xl:top-6 h-fit rounded-xl border border-default bg-surface p-5">
        <p className="mb-4 text-xs uppercase tracking-wide text-muted">{t("forms.editor.preview")}</p>
        <FormRenderer
          name={name || t("forms.editor.untitled")}
          description={description}
          fields={fields}
          submitLabel={submitLabel || t("forms.defaults.submit")}
          values={previewValues}
          onChange={(fieldName, value) =>
            setPreviewValues((current) => ({ ...current, [fieldName]: value }))
          }
          onSubmit={(event) => event.preventDefault()}
        />
      </div>
    </div>
  );
}
