"use client";

import { useEffect, useState } from "react";
import { Eye, EyeOff, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import {
  useDeleteMetaAppConfig,
  useMetaAppConfig,
  useSaveMetaAppConfig,
} from "@/hooks/useMetaAppConfig";
import { useT } from "@/i18n/context";

function sourceBadgeVariant(source: string): "info" | "success" | "default" | "warning" {
  if (source === "own") return "info";
  if (source === "reseller") return "success";
  if (source === "platform") return "default";
  return "warning";
}

function CopyField({
  label,
  value,
  copyLabel,
  copiedLabel,
}: {
  label: string;
  value: string;
  copyLabel: string;
  copiedLabel: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    if (!value.trim()) return;
    await navigator.clipboard.writeText(value);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-secondary">{label}</label>
      <div className="flex gap-2">
        <input
          readOnly
          value={value}
          className="min-w-0 flex-1 rounded-lg border border-default bg-surface px-3 py-2 font-mono text-xs"
        />
        <Button type="button" variant="outline" size="sm" onClick={() => void copy()}>
          {copied ? copiedLabel : copyLabel}
        </Button>
      </div>
    </div>
  );
}

export function ResellerMetaAppPanel() {
  const t = useT();
  const { data, isLoading } = useMetaAppConfig();
  const save = useSaveMetaAppConfig();
  const remove = useDeleteMetaAppConfig();

  const [appId, setAppId] = useState("");
  const [appSecret, setAppSecret] = useState("");
  const [configId, setConfigId] = useState("");
  const [showSecret, setShowSecret] = useState(false);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!saved) return;
    const timer = window.setTimeout(() => setSaved(false), 3000);
    return () => window.clearTimeout(timer);
  }, [saved]);

  useEffect(() => {
    if (!editing || !data) return;
    if (data.appId) setAppId(data.appId);
    if (data.embeddedSignupConfigId) setConfigId(data.embeddedSignupConfigId);
  }, [editing, data]);

  const isOwn = data?.source === "own";

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
      await save.mutateAsync({
        appId: appId.trim(),
        appSecret: appSecret.trim(),
        embeddedSignupConfigId: configId.trim(),
      });
      setAppSecret("");
      setEditing(false);
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("reseller.metaApp.saveError"));
    }
  }

  async function handleDelete() {
    setError("");
    try {
      await remove.mutateAsync();
      setAppId("");
      setAppSecret("");
      setConfigId("");
      setConfirmDelete(false);
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("reseller.metaApp.saveError"));
      setConfirmDelete(false);
    }
  }

  if (isLoading) {
    return (
      <section className="content-card animate-pulse space-y-4 p-5 sm:p-6">
        <div className="h-5 w-48 rounded bg-gray-200" />
        <div className="h-10 rounded bg-gray-100" />
      </section>
    );
  }

  return (
    <section className="content-card space-y-5 p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h2 className="text-base font-semibold text-primary">{t("reseller.metaApp.title")}</h2>
          <p className="text-sm text-secondary">{t("reseller.metaApp.hint")}</p>
        </div>
        <Badge variant={sourceBadgeVariant(data?.source ?? "none")}>
          {sourceLabel(data?.source)}
        </Badge>
      </div>

      {!isOwn && !editing ? (
        <p className="rounded-lg border border-default bg-surface px-4 py-3 text-sm text-secondary">
          {t("reseller.metaApp.platformFallback")}
        </p>
      ) : null}

      {isOwn && !editing ? (
        <div className="space-y-4">
          {data?.appId ? (
            <CopyField
              label={t("reseller.metaApp.appId")}
              value={data.appId}
              copyLabel={t("reseller.dnsCopy")}
              copiedLabel={t("reseller.dnsCopied")}
            />
          ) : null}
          {data?.embeddedSignupConfigId ? (
            <div className="space-y-3 rounded-lg border border-default bg-surface p-4">
              <div className="space-y-1">
                <p className="text-sm font-medium text-primary">
                  {t("reseller.metaApp.embeddedSignupTitle")}
                </p>
                <p className="text-xs text-secondary">{t("reseller.metaApp.embeddedSignupHint")}</p>
              </div>
              <CopyField
                label={t("reseller.metaApp.configId")}
                value={data.embeddedSignupConfigId}
                copyLabel={t("reseller.dnsCopy")}
                copiedLabel={t("reseller.dnsCopied")}
              />
            </div>
          ) : null}
          {data?.webhookUrl && data.webhookVerifyToken ? (
            <div className="space-y-3 rounded-lg border border-default bg-surface p-4">
              <p className="text-sm font-medium text-primary">{t("reseller.metaApp.webhookTitle")}</p>
              <p className="text-xs text-secondary">{t("reseller.metaApp.webhookHint")}</p>
              <CopyField
                label={t("reseller.metaApp.webhookUrl")}
                value={data.webhookUrl}
                copyLabel={t("reseller.dnsCopy")}
                copiedLabel={t("reseller.dnsCopied")}
              />
              <CopyField
                label={t("reseller.metaApp.verifyToken")}
                value={data.webhookVerifyToken}
                copyLabel={t("reseller.dnsCopy")}
                copiedLabel={t("reseller.dnsCopied")}
              />
            </div>
          ) : null}
        </div>
      ) : null}

      {editing || !isOwn ? (
        <form onSubmit={(e) => void handleSave(e)} className="space-y-5">
          <div className="space-y-3 rounded-lg border border-default bg-surface p-4">
            <div className="space-y-1">
              <p className="text-sm font-medium text-primary">{t("reseller.metaApp.credentialsTitle")}</p>
              <p className="text-xs text-secondary">{t("reseller.metaApp.credentialsHint")}</p>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-secondary">{t("reseller.metaApp.appId")}</label>
              <input
                value={appId}
                onChange={(e) => setAppId(e.target.value)}
                placeholder={data?.appId ?? "1234567890"}
                className="w-full rounded-lg border border-default px-3 py-2 text-sm"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-secondary">
                {t("reseller.metaApp.appSecret")}
              </label>
              <div className="relative">
                <input
                  type={showSecret ? "text" : "password"}
                  value={appSecret}
                  onChange={(e) => setAppSecret(e.target.value)}
                  placeholder={isOwn ? t("reseller.metaApp.secretKeep") : ""}
                  className="w-full rounded-lg border border-default px-3 py-2 pr-10 text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowSecret((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted"
                >
                  {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </div>
          <div className="space-y-3 rounded-lg border border-default bg-surface p-4">
            <div className="space-y-1">
              <p className="text-sm font-medium text-primary">
                {t("reseller.metaApp.embeddedSignupTitle")}
              </p>
              <p className="text-xs text-secondary">{t("reseller.metaApp.embeddedSignupHint")}</p>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-secondary">
                {t("reseller.metaApp.configId")}
              </label>
              <input
                required
                value={configId}
                onChange={(e) => setConfigId(e.target.value)}
                placeholder={data?.embeddedSignupConfigId ?? ""}
                className="w-full rounded-lg border border-default px-3 py-2 font-mono text-xs"
              />
              <p className="text-xs text-secondary">{t("reseller.metaApp.configIdHelp")}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={save.isPending}>
              {t("reseller.metaApp.save")}
            </Button>
            {isOwn ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setEditing(false);
                  setAppSecret("");
                }}
              >
                {t("reseller.metaApp.cancel")}
              </Button>
            ) : null}
          </div>
        </form>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={() => setEditing(true)}>
            {t("reseller.metaApp.edit")}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="text-red-600"
            onClick={() => setConfirmDelete(true)}
          >
            <Trash2 className="mr-1 h-4 w-4" />
            {t("reseller.metaApp.remove")}
          </Button>
        </div>
      )}

      {saved ? (
        <p className="text-sm text-success">{t("reseller.metaApp.saved")}</p>
      ) : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <ConfirmDialog
        open={confirmDelete}
        title={t("reseller.metaApp.removeTitle")}
        description={t("reseller.metaApp.removeConfirm")}
        confirmLabel={t("reseller.metaApp.remove")}
        cancelLabel={t("reseller.metaApp.cancel")}
        tone="danger"
        onConfirm={() => void handleDelete()}
        onCancel={() => setConfirmDelete(false)}
      />
    </section>
  );
}
