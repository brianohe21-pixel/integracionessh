"use client";

import { useEffect, useState } from "react";
import { Eye, EyeOff, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import {
  useDeleteProviderCredential,
  useProviderCredentials,
  useSaveProviderCredential,
  type ProviderId,
} from "@/hooks/useProviderCredentials";
import { useT } from "@/i18n/context";

interface FieldConfig {
  key: string;
  labelKey: string;
  placeholder?: string;
  secret?: boolean;
}

const PROVIDER_FIELDS: Record<ProviderId, FieldConfig[]> = {
  openai: [{ key: "apiKey", labelKey: "settings.providerApiKey", secret: true, placeholder: "sk-..." }],
  telnyx: [{ key: "apiKey", labelKey: "settings.providerApiKey", secret: true }],
  elevenlabs: [
    { key: "apiKey", labelKey: "settings.providerApiKey", secret: true },
  ],
};

function sourceBadgeVariant(source: string): "info" | "success" | "default" | "warning" {
  if (source === "own") return "info";
  if (source === "reseller") return "success";
  if (source === "platform") return "default";
  return "warning";
}

export function ProviderCredentialCard({ provider }: { provider: ProviderId }) {
  const t = useT();
  const { data, isLoading } = useProviderCredentials();
  const save = useSaveProviderCredential(provider);
  const remove = useDeleteProviderCredential(provider);

  const status = data?.items?.find((item) => item.provider === provider);
  const [editing, setEditing] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});
  const [visibleFields, setVisibleFields] = useState<Record<string, boolean>>({});
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!saved) return;
    const timer = window.setTimeout(() => setSaved(false), 3000);
    return () => window.clearTimeout(timer);
  }, [saved]);

  const isOwn = status?.source === "own";
  const isConfigured = status?.configured ?? false;
  const fields = PROVIDER_FIELDS[provider];

  function sourceLabel(source: string | undefined): string {
    if (source === "own") return t("settings.ownBadge");
    if (source === "reseller") return t("settings.resellerBadge");
    if (source === "platform") return t("settings.platformBadge");
    return t("settings.notConfiguredBadge");
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try {
      await save.mutateAsync(values);
      setValues({});
      setEditing(false);
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("settings.providerSaveError"));
    }
  }

  async function handleDelete() {
    if (!window.confirm(t("settings.providerRemoveConfirm"))) return;
    setError("");
    try {
      await remove.mutateAsync();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("settings.providerSaveError"));
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center gap-3 p-3 bg-surface rounded-lg border border-default animate-pulse">
        <div className="w-2 h-2 bg-gray-300 rounded-full" />
        <div className="flex-1 h-4 bg-gray-200 rounded" />
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-default overflow-hidden">
      <div className="flex items-center gap-3 p-3 bg-surface">
        <div className={`w-2 h-2 rounded-full ${isConfigured ? "bg-accent" : "bg-gray-300"}`} />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-secondary">{t(`settings.provider.${provider}.title`)}</p>
          <p className="text-xs text-muted">
            {isOwn
              ? provider === "telnyx"
                ? t("settings.telnyxConnected")
                : t("settings.providerOwnSaved")
              : t(`settings.provider.${provider}.desc`)}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Badge variant={sourceBadgeVariant(status?.source ?? "none")}>
            {sourceLabel(status?.source)}
          </Badge>
          {isOwn ? (
            <button
              type="button"
              onClick={() => void handleDelete()}
              disabled={remove.isPending}
              title={t("settings.providerRemove")}
              className="p-1 text-muted hover:text-red-500 transition-colors disabled:opacity-50"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                setEditing((v) => !v);
                setError("");
                setValues({});
              }}
              className="text-xs font-medium text-accent hover:text-accent px-2 py-1 rounded hover:bg-accent-muted transition-colors"
            >
              {editing ? t("settings.cancel") : t("settings.providerAdd")}
            </button>
          )}
        </div>
      </div>

      {status?.webhookUrl && provider === "telnyx" && !isOwn ? (
        <div className="px-3 pb-3 bg-surface border-t border-subtle">
          <p className="text-xs text-secondary mt-2">{t("settings.telnyxWebhookUrl")}</p>
          <p className="text-xs text-muted mb-1">{t("settings.telnyxWebhookHint")}</p>
          <code className="mt-1 block break-all rounded-md bg-surface-muted px-2 py-1.5 text-xs text-primary">
            {status.webhookUrl}
          </code>
        </div>
      ) : null}

      {editing && !isOwn ? (
        <form onSubmit={(e) => void handleSave(e)} className="p-3 border-t border-subtle bg-surface-elevated space-y-2">
          {provider === "telnyx" ? (
            <p className="text-xs text-muted">{t("settings.telnyxPlugAndPlayHint")}</p>
          ) : null}
          {fields.map((field) => (
            <div key={field.key} className="space-y-1">
              <label className="text-xs font-medium text-secondary">{t(field.labelKey)}</label>
              <div className="relative">
                <input
                  type={field.secret && !visibleFields[field.key] ? "password" : "text"}
                  value={values[field.key] ?? ""}
                  onChange={(e) =>
                    setValues((prev) => ({ ...prev, [field.key]: e.target.value }))
                  }
                  placeholder={field.placeholder}
                  className="w-full pr-9 px-3 py-2 text-sm border border-default rounded-lg font-mono focus:outline-none focus:ring-2 focus:ring-accent"
                />
                {field.secret ? (
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() =>
                      setVisibleFields((prev) => ({
                        ...prev,
                        [field.key]: !prev[field.key],
                      }))
                    }
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted hover:text-secondary"
                  >
                    {visibleFields[field.key] ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                ) : null}
              </div>
            </div>
          ))}
          {error ? <p className="text-xs text-red-600">{error}</p> : null}
          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={() => {
                setEditing(false);
                setValues({});
                setError("");
              }}
              className="px-3 py-1.5 text-xs font-medium text-secondary border border-default rounded-lg hover:bg-surface"
            >
              {t("common.cancel")}
            </button>
            <button
              type="submit"
              disabled={save.isPending}
              className="px-3 py-1.5 text-xs font-medium text-white bg-accent rounded-lg hover:bg-accent-hover disabled:opacity-50"
            >
              {save.isPending ? t("settings.openaiKeySaving") : t("common.save")}
            </button>
          </div>
        </form>
      ) : null}

      {!editing && saved ? (
        <p className="px-3 pb-3 text-xs text-green-600">{t("settings.providerSaved")}</p>
      ) : null}

      {!editing && error ? <p className="px-3 pb-3 text-xs text-red-600">{error}</p> : null}
    </div>
  );
}

export function ProviderCredentialsSection() {
  const t = useT();
  const { isError } = useProviderCredentials();

  return (
    <div className="space-y-3">
      {isError ? (
        <p className="text-xs text-red-600">{t("settings.providerLoadError")}</p>
      ) : null}
      <ProviderCredentialCard provider="openai" />
      <ProviderCredentialCard provider="telnyx" />
      <ProviderCredentialCard provider="elevenlabs" />
    </div>
  );
}
