"use client";

import Image from "next/image";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useParams } from "next/navigation";
import { useT } from "@/i18n/context";
import { publicFormApi } from "@/lib/public-form-api";
import { captureAttributionFromUrl, getStoredAttribution } from "@/lib/utm";
import type { PublicHostedForm } from "@/types";
import { FormRenderer } from "@/components/forms/FormRenderer";

export default function PublicFormPage() {
  const t = useT();
  const { publicKey } = useParams<{ publicKey: string }>();
  const [embed, setEmbed] = useState(false);
  const [form, setForm] = useState<PublicHostedForm | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [values, setValues] = useState<Record<string, string | boolean | string[]>>({});

  const accent = form?.branding?.primaryColor ?? "#128C7E";

  const initialValues = useMemo(() => {
    const next: Record<string, string | boolean | string[]> = {};
    for (const field of form?.fields ?? []) {
      if (field.type === "checkbox" && field.options?.length) next[field.name] = [];
      else if (field.type === "checkbox") next[field.name] = false;
      else next[field.name] = field.defaultValue ?? "";
    }
    return next;
  }, [form]);

  useEffect(() => {
    setValues(initialValues);
  }, [initialValues]);

  useEffect(() => {
    setEmbed(new URLSearchParams(window.location.search).get("embed") === "1");
    captureAttributionFromUrl();
  }, []);

  useEffect(() => {
    if (!publicKey) return;
    setLoading(true);
    setError("");
    publicFormApi
      .getForm(publicKey)
      .then((data) => setForm(data))
      .catch((err) => setError(err instanceof Error ? err.message : t("publicForm.loadError")))
      .finally(() => setLoading(false));
  }, [publicKey, t]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!publicKey) return;
    setSubmitting(true);
    setError("");
    try {
      const payload: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(values)) {
        payload[key] = value;
      }
      const attribution = getStoredAttribution();
      const result = await publicFormApi.submit(
        publicKey,
        payload,
        attribution ?? undefined
      );
      if (result.redirectUrl) {
        window.location.assign(result.redirectUrl);
        return;
      }
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("publicForm.submitError"));
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface text-sm text-secondary">
        {t("publicForm.loading")}
      </div>
    );
  }

  if (!form) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface px-4 text-center">
        <p className="text-sm text-secondary">{error || t("publicForm.notFound")}</p>
      </div>
    );
  }

  return (
    <div className={embed ? "min-h-screen bg-surface" : "min-h-screen bg-surface"}>
      {!embed ? (
        <header className="border-b border-default bg-surface-elevated">
          <div className="mx-auto flex max-w-lg items-center gap-3 px-4 py-4">
            {form.branding?.logoUrl ? (
              <Image
                src={form.branding.logoUrl}
                alt=""
                width={40}
                height={40}
                unoptimized
                className="h-10 w-10 rounded-lg object-contain"
              />
            ) : null}
            <div>
              <h1 className="text-lg font-semibold text-primary">
                {form.branding?.brandName ?? form.name}
              </h1>
              <p className="text-sm text-secondary">{t("publicForm.badge")}</p>
            </div>
          </div>
        </header>
      ) : null}

      <main className="mx-auto max-w-lg px-4 py-6">
        {done ? (
          <div className="rounded-xl border border-green-200 bg-surface-elevated p-6 text-center">
            <p className="text-lg font-semibold text-primary">{form.successTitle}</p>
            <p className="mt-2 text-secondary">{form.successMessage}</p>
          </div>
        ) : (
          <div className="rounded-xl border border-default bg-surface-elevated p-6">
            <FormRenderer
              name={form.name}
              description={form.description}
              fields={form.fields}
              submitLabel={submitting ? t("publicForm.submitting") : form.submitLabel}
              values={values}
              onChange={(fieldName, value) =>
                setValues((current) => ({ ...current, [fieldName]: value }))
              }
              onSubmit={(event) => void handleSubmit(event)}
              submitting={submitting}
              accent={accent}
              error={error}
            />
          </div>
        )}
      </main>
    </div>
  );
}
