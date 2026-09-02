"use client";

import { useState } from "react";
import { Copy, RefreshCw } from "lucide-react";
import { useT } from "@/i18n/context";
import type { HostedForm } from "@/types";
import { Button } from "@/components/ui/Button";
import {
  usePublishHostedForm,
  useRotateHostedFormKey,
  useUnpublishHostedForm,
} from "@/hooks/useHostedForms";
import { useDialog } from "@/components/ui/DialogProvider";

interface FormSharePanelProps {
  form: HostedForm;
}

export function FormSharePanel({ form }: FormSharePanelProps) {
  const t = useT();
  const { confirm } = useDialog();
  const publish = usePublishHostedForm();
  const unpublish = useUnpublishHostedForm();
  const rotate = useRotateHostedFormKey();
  const [copied, setCopied] = useState<"url" | "embed" | null>(null);
  const [error, setError] = useState("");

  const publicUrl =
    form.publicUrl ??
    (typeof window !== "undefined" ? `${window.location.origin}/f/${form.publicKey}` : "");
  const embedSnippet =
    form.embedSnippet ??
    `<iframe src="${publicUrl}?embed=1" title="${form.name}" width="100%" height="720" frameborder="0" style="border:0;min-height:480px;"></iframe>`;

  async function copy(kind: "url" | "embed", text: string) {
    await navigator.clipboard.writeText(text);
    setCopied(kind);
    window.setTimeout(() => setCopied(null), 1500);
  }

  async function handleRotate() {
    const ok = await confirm({
      title: t("forms.share.rotateTitle"),
      description: t("forms.share.rotateHint"),
      tone: "warning",
    });
    if (!ok) return;
    try {
      await rotate.mutateAsync(form.formId);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("forms.share.rotateError"));
    }
  }

  return (
    <div className="space-y-4 rounded-xl border border-default bg-surface-elevated p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-primary">{t("forms.share.title")}</h3>
          <p className="mt-1 text-xs text-secondary">{t("forms.share.subtitle")}</p>
        </div>
        {form.published ? (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={unpublish.isPending}
            onClick={() => void unpublish.mutateAsync(form.formId).catch((err) => setError(err.message))}
          >
            {t("forms.share.unpublish")}
          </Button>
        ) : (
          <Button
            type="button"
            size="sm"
            disabled={publish.isPending}
            onClick={() => void publish.mutateAsync(form.formId).catch((err) => setError(err.message))}
          >
            {t("forms.share.publish")}
          </Button>
        )}
      </div>

      <div>
        <p className="text-[10px] uppercase tracking-wide text-muted">{t("forms.share.url")}</p>
        <div className="mt-1 flex items-center gap-2">
          <code className="flex-1 truncate rounded bg-surface px-2 py-1 text-xs">{publicUrl}</code>
          <button
            type="button"
            onClick={() => void copy("url", publicUrl)}
            className="rounded border border-default p-1.5 text-secondary hover:text-primary"
          >
            <Copy className="h-3.5 w-3.5" />
          </button>
        </div>
        {copied === "url" ? <p className="mt-1 text-xs text-success">{t("forms.share.copied")}</p> : null}
      </div>

      <div>
        <p className="text-[10px] uppercase tracking-wide text-muted">{t("forms.share.embed")}</p>
        <textarea
          readOnly
          rows={3}
          value={embedSnippet}
          className="mt-1 w-full rounded-lg border border-default bg-surface p-2 font-mono text-xs"
        />
        <button
          type="button"
          onClick={() => void copy("embed", embedSnippet)}
          className="mt-2 text-sm text-accent hover:underline"
        >
          {copied === "embed" ? t("forms.share.copied") : t("forms.share.copyEmbed")}
        </button>
      </div>

      <Button
        type="button"
        variant="secondary"
        size="sm"
        disabled={rotate.isPending}
        onClick={() => void handleRotate()}
      >
        <RefreshCw className="h-3.5 w-3.5" />
        {t("forms.share.rotate")}
      </Button>
      {error ? <p className="text-sm text-danger">{error}</p> : null}
    </div>
  );
}
