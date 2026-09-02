"use client";

import { useEffect, useState } from "react";
import { CheckCircle, Mail, RefreshCw, Trash2 } from "lucide-react";
import { useT } from "@/i18n/context";
import { Badge } from "@/components/ui/Badge";
import {
  useRegisterTenantEmailDomain,
  useRemoveTenantEmailDomain,
  useTenantEmailSettings,
  useUpdateTenantEmailSettings,
  useVerifyTenantEmailDomain,
} from "@/hooks/useTenantEmailSettings";
import type { TenantEmailDnsRecord } from "@/types";

function DnsCopyField({
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
    if (!value) return;
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div>
      <p className="text-xs font-medium text-secondary mb-1">{label}</p>
      <div className="flex items-center gap-2">
        <code className="flex-1 truncate rounded-lg border border-default bg-surface px-3 py-2 text-xs font-mono text-secondary">
          {value}
        </code>
        <button
          type="button"
          onClick={() => void copy()}
          className="shrink-0 rounded-lg border border-default px-3 py-2 text-xs font-medium text-secondary hover:bg-surface-muted"
        >
          {copied ? copiedLabel : copyLabel}
        </button>
      </div>
    </div>
  );
}

function DnsRecordCard({
  record,
  t,
}: {
  record: TenantEmailDnsRecord;
  t: (key: string) => string;
}) {
  const isVerification = record.purpose === "verification";
  return (
    <li className="space-y-3 rounded-xl border border-default bg-surface p-4">
      <div>
        <p className="text-sm font-semibold text-primary">
          {isVerification ? t("settings.emailDnsVerification") : t("settings.emailDnsDkim")}
        </p>
        <p className="mt-1 text-sm text-secondary">
          {isVerification ? t("settings.emailDnsVerificationHelp") : t("settings.emailDnsDkimHelp")}
        </p>
      </div>
      <DnsCopyField
        label={t("settings.emailDnsType")}
        value={record.type}
        copyLabel={t("settings.emailDnsCopy")}
        copiedLabel={t("settings.emailDnsCopied")}
      />
      <DnsCopyField
        label={t("settings.emailDnsHost")}
        value={record.name}
        copyLabel={t("settings.emailDnsCopy")}
        copiedLabel={t("settings.emailDnsCopied")}
      />
      <DnsCopyField
        label={t("settings.emailDnsValue")}
        value={record.value}
        copyLabel={t("settings.emailDnsCopy")}
        copiedLabel={t("settings.emailDnsCopied")}
      />
    </li>
  );
}

function domainStatusVariant(status: string | undefined): "success" | "warning" | "danger" | "default" {
  if (status === "verified") return "success";
  if (status === "pending") return "warning";
  if (status === "failed") return "danger";
  return "default";
}

export function TenantEmailSettingsCard() {
  const t = useT();
  const { data, isLoading, isError, error } = useTenantEmailSettings();
  const updateSettings = useUpdateTenantEmailSettings();
  const registerDomain = useRegisterTenantEmailDomain();
  const verifyDomain = useVerifyTenantEmailDomain();
  const removeDomain = useRemoveTenantEmailDomain();

  const [domainInput, setDomainInput] = useState("");
  const [fromEmail, setFromEmail] = useState("");
  const [fromName, setFromName] = useState("");
  const [enabled, setEnabled] = useState(false);
  const [saved, setSaved] = useState(false);
  const [formError, setFormError] = useState("");

  useEffect(() => {
    if (!data?.settings) return;
    setDomainInput(data.settings.domain ?? "");
    setFromEmail(data.settings.fromEmail ?? "");
    setFromName(data.settings.fromName ?? "");
    setEnabled(data.settings.enabled);
  }, [data]);

  if (isLoading) {
    return (
      <div className="rounded-xl border border-default bg-surface-elevated p-6">
        <div className="h-24 animate-pulse rounded-lg bg-surface-muted" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rounded-xl border border-danger/30 bg-danger/10 p-6 text-sm text-danger">
        {error instanceof Error ? error.message : t("settings.emailLoadError")}
      </div>
    );
  }

  const settings = data?.settings;
  const dnsRecords = data?.dnsRecords ?? [];
  const domainStatus = settings?.domainStatus ?? "none";

  async function handleSaveSender() {
    setFormError("");
    setSaved(false);
    try {
      await updateSettings.mutateAsync({
        enabled,
        fromEmail: fromEmail.trim() || undefined,
        fromName: fromName.trim() || undefined,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : t("settings.emailSaveError"));
    }
  }

  async function handleRegisterDomain() {
    setFormError("");
    try {
      await registerDomain.mutateAsync(domainInput.trim());
    } catch (err) {
      setFormError(err instanceof Error ? err.message : t("settings.emailDomainError"));
    }
  }

  async function handleVerifyDomain() {
    setFormError("");
    try {
      await verifyDomain.mutateAsync();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : t("settings.emailVerifyError"));
    }
  }

  return (
    <div className="rounded-xl border border-default bg-surface-elevated p-6 space-y-6">
      <div className="flex items-start gap-3">
        <Mail className="mt-0.5 h-5 w-5 text-secondary shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-semibold text-primary text-sm">{t("settings.emailTitle")}</h2>
            <Badge variant={domainStatusVariant(domainStatus)}>
              {t(`settings.emailDomainStatus.${domainStatus}`)}
            </Badge>
            {data?.canSend ? (
              <Badge variant="success">{t("settings.emailReady")}</Badge>
            ) : null}
          </div>
          <p className="mt-1 text-sm text-secondary">{t("settings.emailDescription")}</p>
        </div>
      </div>

      <div className="space-y-3">
        <label className="block text-sm font-medium text-primary">{t("settings.emailDomainLabel")}</label>
        <div className="flex flex-wrap gap-2">
          <input
            type="text"
            value={domainInput}
            onChange={(e) => setDomainInput(e.target.value)}
            placeholder={t("settings.emailDomainPlaceholder")}
            className="min-w-[200px] flex-1 rounded-lg border border-default px-3 py-2 text-sm"
          />
          <button
            type="button"
            onClick={() => void handleRegisterDomain()}
            disabled={registerDomain.isPending || !domainInput.trim()}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {registerDomain.isPending ? t("common.saving") : t("settings.emailDomainSave")}
          </button>
          {settings?.domain ? (
            <>
              <button
                type="button"
                onClick={() => void handleVerifyDomain()}
                disabled={verifyDomain.isPending}
                className="flex items-center gap-1.5 rounded-lg border border-default px-4 py-2 text-sm font-medium text-secondary hover:bg-surface-muted disabled:opacity-50"
              >
                <RefreshCw className={`h-4 w-4 ${verifyDomain.isPending ? "animate-spin" : ""}`} />
                {t("settings.emailVerify")}
              </button>
              <button
                type="button"
                onClick={() => void removeDomain.mutateAsync()}
                disabled={removeDomain.isPending}
                className="flex items-center gap-1.5 rounded-lg border border-danger/30 px-4 py-2 text-sm font-medium text-danger hover:bg-danger/5 disabled:opacity-50"
              >
                <Trash2 className="h-4 w-4" />
                {t("settings.emailDomainRemove")}
              </button>
            </>
          ) : null}
        </div>
        <p className="text-xs text-secondary">{t("settings.emailDomainHint")}</p>
      </div>

      {dnsRecords.length > 0 ? (
        <div className="space-y-3">
          <p className="text-sm font-medium text-primary">{t("settings.emailDnsTitle")}</p>
          <ul className="space-y-3">
            {dnsRecords.map((record) => (
              <DnsRecordCard key={`${record.purpose}-${record.name}`} record={record} t={t} />
            ))}
          </ul>
        </div>
      ) : null}

      <div className="border-t border-default pt-6 space-y-4">
        <p className="text-sm font-medium text-primary">{t("settings.emailSenderTitle")}</p>
        <div className="grid gap-3 md:grid-cols-2">
          <input
            type="email"
            value={fromEmail}
            onChange={(e) => setFromEmail(e.target.value)}
            placeholder={t("settings.emailFromPlaceholder")}
            className="rounded-lg border border-default px-3 py-2 text-sm"
          />
          <input
            type="text"
            value={fromName}
            onChange={(e) => setFromName(e.target.value)}
            placeholder={t("settings.emailFromNamePlaceholder")}
            className="rounded-lg border border-default px-3 py-2 text-sm"
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-secondary">
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
          {t("settings.emailEnabled")}
        </label>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => void handleSaveSender()}
            disabled={updateSettings.isPending}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {updateSettings.isPending ? t("common.saving") : t("common.save")}
          </button>
          {saved ? (
            <span className="flex items-center gap-1 text-sm text-success">
              <CheckCircle className="h-4 w-4" />
              {t("settings.emailSaved")}
            </span>
          ) : null}
        </div>
      </div>

      {formError ? <p className="text-sm text-danger">{formError}</p> : null}
    </div>
  );
}
