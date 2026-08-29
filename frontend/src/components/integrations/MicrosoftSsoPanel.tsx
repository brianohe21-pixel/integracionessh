"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Eye, EyeOff } from "lucide-react";
import { useT } from "@/i18n/context";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import {
  useDeleteMicrosoftSso,
  useMicrosoftSso,
  useSaveMicrosoftSso,
  useTestMicrosoftSso,
  useToggleMicrosoftSso,
  type MicrosoftSsoProtocol,
} from "@/hooks/useMicrosoftSso";

function CopyField({ label, value }: { label: string; value: string }) {
  const t = useT();
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
        <code className="flex-1 truncate rounded-lg border border-default bg-surface px-3 py-2 text-xs font-mono text-secondary">
          {value}
        </code>
        <button
          type="button"
          onClick={() => void copy()}
          className="shrink-0 rounded-lg border border-default px-3 py-2 text-xs font-medium text-secondary hover:bg-surface-muted"
        >
          {copied ? t("integrationsPage.microsoft.copied") : t("integrationsPage.microsoft.copy")}
        </button>
      </div>
    </div>
  );
}

export function MicrosoftSsoPanel() {
  const t = useT();
  const { data, isLoading, isError, error } = useMicrosoftSso();
  const saveMutation = useSaveMicrosoftSso();
  const testMutation = useTestMicrosoftSso();
  const toggleMutation = useToggleMicrosoftSso();
  const deleteMutation = useDeleteMicrosoftSso();

  const [protocol, setProtocol] = useState<MicrosoftSsoProtocol>("oidc");
  const [entraTenantId, setEntraTenantId] = useState("");
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [metadataUrl, setMetadataUrl] = useState("");
  const [allowedDomains, setAllowedDomains] = useState("");
  const [enforceSso, setEnforceSso] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const [saved, setSaved] = useState(false);
  const [formError, setFormError] = useState("");
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);

  useEffect(() => {
    if (!data) return;
    setProtocol(data.protocol ?? "oidc");
    setEntraTenantId(data.entraTenantId ?? "");
    setClientId(data.clientId ?? "");
    setMetadataUrl(data.metadataUrl ?? "");
    setAllowedDomains((data.allowedDomains ?? []).join(", "));
    setEnforceSso(Boolean(data.enforceSso));
  }, [data]);

  if (isLoading) {
    return <div className="h-48 animate-pulse rounded-xl bg-surface-muted" />;
  }

  if (isError) {
    return (
      <Alert variant="danger">
        {(error as Error)?.message ?? t("common.error")}
      </Alert>
    );
  }

  const configured = Boolean(data?.configured);
  const enabled = Boolean(data?.enabled);
  const testFailed = data?.lastTestStatus === "failed";

  async function handleSave() {
    setFormError("");
    setSaved(false);
    try {
      await saveMutation.mutateAsync({
        protocol,
        entraTenantId: entraTenantId.trim() || undefined,
        clientId: clientId.trim() || undefined,
        clientSecret: clientSecret.trim() || undefined,
        metadataUrl: metadataUrl.trim() || undefined,
        allowedDomains: allowedDomains
          .split(",")
          .map((domain) => domain.trim())
          .filter(Boolean),
        enforceSso,
      });
      setClientSecret("");
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setFormError((err as Error).message ?? t("common.error"));
    }
  }

  async function handleTest() {
    setFormError("");
    try {
      await testMutation.mutateAsync();
    } catch (err) {
      setFormError((err as Error).message ?? t("common.error"));
    }
  }

  async function handleToggleEnabled(next: boolean) {
    setFormError("");
    try {
      await toggleMutation.mutateAsync(next);
    } catch (err) {
      setFormError((err as Error).message ?? t("common.error"));
    }
  }

  async function handleDisconnect() {
    setFormError("");
    try {
      await deleteMutation.mutateAsync();
      setConfirmDisconnect(false);
      setClientSecret("");
    } catch (err) {
      setFormError((err as Error).message ?? t("common.error"));
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/integrations"
          className="text-sm font-medium text-accent hover:underline"
        >
          {t("integrationsPage.backToIntegrations")}
        </Link>
      </div>

      {configured ? (
        <Alert variant={testFailed ? "warning" : "success"}>
          {testFailed
            ? `${t("integrationsPage.microsoft.errorAlert")}: ${data?.lastTestMessage ?? ""}`
            : t("integrationsPage.microsoft.configuredAlert")}
        </Alert>
      ) : (
        <Alert variant="warning">{t("integrationsPage.microsoft.notConfiguredAlert")}</Alert>
      )}

      <div className="rounded-xl border border-default bg-surface-elevated p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h3 className="text-lg font-semibold text-primary">
            {t("integrationsPage.microsoft.statusTitle")}
          </h3>
          <Badge variant={enabled ? "success" : configured ? "warning" : "default"}>
            {enabled
              ? t("integrationsPage.enabled")
              : configured
                ? t("integrationsPage.configured")
                : t("integrationsPage.notConfigured")}
          </Badge>
        </div>
        <label className="flex items-center gap-3 text-sm text-secondary">
          <input
            type="checkbox"
            checked={enabled}
            disabled={!configured || toggleMutation.isPending}
            onChange={(event) => void handleToggleEnabled(event.target.checked)}
            className="h-4 w-4 rounded border-default text-accent focus:ring-accent"
          />
          {t("integrationsPage.microsoft.enabledLabel")}
        </label>
      </div>

      <div className="rounded-xl border border-default bg-surface-elevated p-6 shadow-sm space-y-4">
        <h3 className="text-lg font-semibold text-primary">
          {t("integrationsPage.microsoft.instructionsTitle")}
        </h3>
        <ol className="list-decimal space-y-2 pl-5 text-sm text-secondary">
          <li>{t("integrationsPage.microsoft.step1")}</li>
          <li>{t("integrationsPage.microsoft.step2")}</li>
          <li>{t("integrationsPage.microsoft.step3")}</li>
          <li>{t("integrationsPage.microsoft.step4")}</li>
        </ol>
      </div>

      <div className="rounded-xl border border-default bg-surface-elevated p-6 shadow-sm space-y-4">
        <h3 className="text-lg font-semibold text-primary">
          {t("integrationsPage.microsoft.urlsTitle")}
        </h3>
        {data?.redirectUri ? (
          <CopyField label={t("integrationsPage.microsoft.redirectUri")} value={data.redirectUri} />
        ) : null}
        {data?.samlAcsUrl ? (
          <CopyField label={t("integrationsPage.microsoft.samlAcsUrl")} value={data.samlAcsUrl} />
        ) : null}
        {data?.samlEntityId ? (
          <CopyField label={t("integrationsPage.microsoft.samlEntityId")} value={data.samlEntityId} />
        ) : null}
        {data?.appCallbackUrl ? (
          <CopyField
            label={t("integrationsPage.microsoft.appCallbackUrl")}
            value={data.appCallbackUrl}
          />
        ) : null}
      </div>

      <div className="rounded-xl border border-default bg-surface-elevated p-6 shadow-sm space-y-4">
        <h3 className="text-lg font-semibold text-primary">
          {t("integrationsPage.microsoft.credentialsTitle")}
        </h3>

        <div>
          <label className="mb-1 block text-sm font-medium text-secondary">
            {t("integrationsPage.microsoft.protocol")}
          </label>
          <select
            value={protocol}
            onChange={(event) => setProtocol(event.target.value as MicrosoftSsoProtocol)}
            className="w-full rounded-lg border border-default bg-surface px-3 py-2 text-sm"
          >
            <option value="oidc">{t("integrationsPage.microsoft.protocolOidc")}</option>
            <option value="saml">{t("integrationsPage.microsoft.protocolSaml")}</option>
          </select>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-secondary">
            {t("integrationsPage.microsoft.tenantId")}
          </label>
          <input
            value={entraTenantId}
            onChange={(event) => setEntraTenantId(event.target.value)}
            className="w-full rounded-lg border border-default px-3 py-2 text-sm"
          />
        </div>

        {protocol === "oidc" ? (
          <>
            <div>
              <label className="mb-1 block text-sm font-medium text-secondary">
                {t("integrationsPage.microsoft.clientId")}
              </label>
              <input
                value={clientId}
                onChange={(event) => setClientId(event.target.value)}
                className="w-full rounded-lg border border-default px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-secondary">
                {t("integrationsPage.microsoft.clientSecret")}
              </label>
              <div className="relative">
                <input
                  type={showSecret ? "text" : "password"}
                  value={clientSecret}
                  onChange={(event) => setClientSecret(event.target.value)}
                  placeholder={data?.clientSecretMasked ?? ""}
                  className="w-full rounded-lg border border-default px-3 py-2 pr-10 text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowSecret((value) => !value)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-secondary"
                >
                  {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p className="mt-1 text-xs text-muted">{t("integrationsPage.microsoft.secretHint")}</p>
            </div>
          </>
        ) : (
          <div>
            <label className="mb-1 block text-sm font-medium text-secondary">
              {t("integrationsPage.microsoft.metadataUrl")}
            </label>
            <input
              value={metadataUrl}
              onChange={(event) => setMetadataUrl(event.target.value)}
              className="w-full rounded-lg border border-default px-3 py-2 text-sm"
            />
          </div>
        )}

        <div>
          <label className="mb-1 block text-sm font-medium text-secondary">
            {t("integrationsPage.microsoft.allowedDomains")}
          </label>
          <input
            value={allowedDomains}
            onChange={(event) => setAllowedDomains(event.target.value)}
            className="w-full rounded-lg border border-default px-3 py-2 text-sm"
          />
          <p className="mt-1 text-xs text-muted">
            {t("integrationsPage.microsoft.allowedDomainsHint")}
          </p>
        </div>

        <label className="flex items-center gap-3 text-sm text-secondary">
          <input
            type="checkbox"
            checked={enforceSso}
            onChange={(event) => setEnforceSso(event.target.checked)}
            className="h-4 w-4 rounded border-default text-accent focus:ring-accent"
          />
          <span>
            {t("integrationsPage.microsoft.enforceSso")}
            <span className="mt-1 block text-xs text-muted">
              {t("integrationsPage.microsoft.enforceSsoHint")}
            </span>
          </span>
        </label>

        {formError ? <Alert variant="danger">{formError}</Alert> : null}
        {saved ? <Alert variant="success">{t("integrationsPage.microsoft.saved")}</Alert> : null}
        {testMutation.isSuccess ? (
          <Alert variant="success">{t("integrationsPage.microsoft.testSuccess")}</Alert>
        ) : null}

        <div className="flex flex-wrap gap-3">
          <Button onClick={() => void handleSave()} disabled={saveMutation.isPending}>
            {saveMutation.isPending
              ? t("integrationsPage.microsoft.saving")
              : t("integrationsPage.microsoft.save")}
          </Button>
          <Button
            variant="secondary"
            onClick={() => void handleTest()}
            disabled={!configured || testMutation.isPending}
          >
            {testMutation.isPending
              ? t("integrationsPage.microsoft.testing")
              : t("integrationsPage.microsoft.test")}
          </Button>
          {configured ? (
            <Button
              variant="secondary"
              onClick={() => setConfirmDisconnect(true)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending
                ? t("integrationsPage.microsoft.disconnecting")
                : t("integrationsPage.microsoft.disconnect")}
            </Button>
          ) : null}
        </div>
      </div>

      <ConfirmDialog
        open={confirmDisconnect}
        title={t("integrationsPage.microsoft.disconnect")}
        description={t("integrationsPage.microsoft.disconnectConfirm")}
        confirmLabel={t("integrationsPage.microsoft.disconnect")}
        tone="danger"
        onConfirm={() => void handleDisconnect()}
        onCancel={() => setConfirmDisconnect(false)}
      />
    </div>
  );
}
