"use client";

import { useEffect, useState } from "react";
import { CheckCircle, Mail, RefreshCw, Trash2 } from "lucide-react";
import { useT } from "@/i18n/context";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  SettingsCard,
  SettingsCardSkeleton,
  SettingsToggleRow,
} from "@/components/settings/SettingsCard";
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
      <p className="mb-1 text-xs font-medium text-secondary">{label}</p>
      <div className="flex items-center gap-2">
        <code className="flex-1 truncate rounded-lg border border-subtle bg-surface px-3 py-2 font-mono text-xs text-secondary">
          {value}
        </code>
        <Button type="button" variant="secondary" size="sm" onClick={() => void copy()}>
          {copied ? copiedLabel : copyLabel}
        </Button>
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
    <li className="space-y-3 rounded-xl border border-subtle bg-surface p-4">
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
    return <SettingsCardSkeleton lines={4} />;
  }

  if (isError) {
    return (
      <SettingsCard
        icon={<Mail className="h-4 w-4" />}
        title={t("settings.emailTitle")}
        description={t("settings.emailDescription")}
      >
        <p className="text-sm text-danger">
          {error instanceof Error ? error.message : t("settings.emailLoadError")}
        </p>
      </SettingsCard>
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
    <SettingsCard
      icon={<Mail className="h-4 w-4" />}
      title={t("settings.emailTitle")}
      description={t("settings.emailDescription")}
      badge={
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={domainStatusVariant(domainStatus)}>
            {t(`settings.emailDomainStatus.${domainStatus}`)}
          </Badge>
          {data?.canSend ? <Badge variant="success">{t("settings.emailReady")}</Badge> : null}
        </div>
      }
    >
      <div className="space-y-3">
        <label className="block text-sm font-medium text-primary">{t("settings.emailDomainLabel")}</label>
        <div className="flex flex-wrap gap-2">
          <Input
            type="text"
            value={domainInput}
            onChange={(e) => setDomainInput(e.target.value)}
            placeholder={t("settings.emailDomainPlaceholder")}
            className="min-w-[200px] flex-1"
          />
          <Button
            type="button"
            onClick={() => void handleRegisterDomain()}
            disabled={registerDomain.isPending || !domainInput.trim()}
          >
            {registerDomain.isPending ? t("common.saving") : t("settings.emailDomainSave")}
          </Button>
          {settings?.domain ? (
            <>
              <Button
                type="button"
                variant="secondary"
                onClick={() => void handleVerifyDomain()}
                disabled={verifyDomain.isPending}
              >
                <RefreshCw className={`h-4 w-4 ${verifyDomain.isPending ? "animate-spin" : ""}`} />
                {t("settings.emailVerify")}
              </Button>
              <Button
                type="button"
                variant="danger"
                onClick={() => void removeDomain.mutateAsync()}
                disabled={removeDomain.isPending}
              >
                <Trash2 className="h-4 w-4" />
                {t("settings.emailDomainRemove")}
              </Button>
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

      <div className="space-y-4 border-t border-subtle pt-6">
        <p className="text-sm font-medium text-primary">{t("settings.emailSenderTitle")}</p>
        <div className="grid gap-3 md:grid-cols-2">
          <Input
            type="email"
            value={fromEmail}
            onChange={(e) => setFromEmail(e.target.value)}
            placeholder={t("settings.emailFromPlaceholder")}
          />
          <Input
            type="text"
            value={fromName}
            onChange={(e) => setFromName(e.target.value)}
            placeholder={t("settings.emailFromNamePlaceholder")}
          />
        </div>
        <SettingsToggleRow
          label={t("settings.emailEnabled")}
          checked={enabled}
          onChange={setEnabled}
        />
        <div className="flex items-center gap-3">
          <Button type="button" onClick={() => void handleSaveSender()} disabled={updateSettings.isPending}>
            {updateSettings.isPending ? t("common.saving") : t("common.save")}
          </Button>
          {saved ? (
            <span className="flex items-center gap-1 text-sm text-success">
              <CheckCircle className="h-4 w-4" />
              {t("settings.emailSaved")}
            </span>
          ) : null}
        </div>
      </div>

      {formError ? <p className="text-sm text-danger">{formError}</p> : null}
    </SettingsCard>
  );
}
