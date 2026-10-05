"use client";

import { useEffect, useState } from "react";
import { PlugZap, Trash2 } from "lucide-react";
import {
  useDeleteMailrelayCredentials,
  useMailrelayConfig,
  useMailrelayCredentials,
  useSaveMailrelayConfig,
  useSaveMailrelayCredentials,
  useTestMailrelayConnection,
} from "@/hooks/useMailrelay";
import { useT } from "@/i18n/context";
import type { EmailMarketingProvider } from "@/types";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Input, Select } from "@/components/ui/Input";
import { Skeleton } from "@/components/ui/Skeleton";

export function MailrelaySettingsTab() {
  const t = useT();
  const credentials = useMailrelayCredentials();
  const configQuery = useMailrelayConfig();
  const saveConfig = useSaveMailrelayConfig();
  const saveCredentials = useSaveMailrelayCredentials();
  const deleteCredentials = useDeleteMailrelayCredentials();
  const test = useTestMailrelayConnection();

  const provider = (configQuery.data?.config.provider ?? "mailrelay") as EmailMarketingProvider;
  const configured = credentials.data?.credentials.configured ?? false;

  const [username, setUsername] = useState("");
  const [apiPassword, setApiPassword] = useState("");
  const [baseUrl, setBaseUrl] = useState("https://dashboard.360nrs.com");
  const [fromEmail, setFromEmail] = useState("");
  const [fromName, setFromName] = useState("");
  const [replyTo, setReplyTo] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    const config = configQuery.data?.config;
    if (!config) return;
    setFromEmail(config.fromEmail ?? "");
    setFromName(config.fromName ?? "");
    setReplyTo(config.replyTo ?? "");
  }, [configQuery.data]);

  useEffect(() => {
    const value = credentials.data?.credentials;
    if (!value) return;
    if (value.username) setUsername(value.username);
    if (value.baseUrl) setBaseUrl(value.baseUrl);
  }, [credentials.data]);

  async function handleProviderChange(next: EmailMarketingProvider) {
    setError("");
    setSuccess("");
    try {
      const current = configQuery.data?.config;
      await saveConfig.mutateAsync({
        senderId: current?.senderId ?? "",
        defaultGroupId: current?.defaultGroupId ?? "",
        tagGroupMappings: current?.tagGroupMappings ?? [],
        enabled: current?.enabled !== false,
        eventTypes: current?.eventTypes ?? [],
        provider: next,
        fromEmail: current?.fromEmail ?? "",
        fromName: current?.fromName ?? "",
        replyTo: current?.replyTo ?? "",
      });
      setSuccess(t("mailrelay.settings.providerSaved"));
      await credentials.refetch();
    } catch (cause) {
      setError((cause as Error).message);
    }
  }

  async function handleSaveCredentials() {
    setError("");
    setSuccess("");
    try {
      await saveCredentials.mutateAsync({
        username: username.trim(),
        apiPassword: apiPassword.trim(),
        baseUrl: baseUrl.trim() || undefined,
      });
      setApiPassword("");
      setSuccess(t("mailrelay.settings.saved"));
    } catch (cause) {
      setError((cause as Error).message);
    }
  }

  async function handleSaveSender() {
    setError("");
    setSuccess("");
    try {
      const current = configQuery.data?.config;
      await saveConfig.mutateAsync({
        senderId: current?.senderId ?? "1",
        defaultGroupId: current?.defaultGroupId ?? "",
        tagGroupMappings: current?.tagGroupMappings ?? [],
        enabled: current?.enabled !== false,
        eventTypes: current?.eventTypes ?? [],
        provider: "nrs360",
        fromEmail: fromEmail.trim(),
        fromName: fromName.trim(),
        replyTo: replyTo.trim() || fromEmail.trim(),
      });
      setSuccess(t("mailrelay.settings.senderSaved"));
    } catch (cause) {
      setError((cause as Error).message);
    }
  }

  async function handleTest() {
    setError("");
    setSuccess("");
    try {
      await test.mutateAsync();
      setSuccess(t("mailrelay.settings.tested"));
    } catch (cause) {
      setError((cause as Error).message);
    }
  }

  async function handleDelete() {
    setError("");
    setSuccess("");
    try {
      await deleteCredentials.mutateAsync();
      setConfirmDelete(false);
      setSuccess(t("mailrelay.settings.deleted"));
    } catch (cause) {
      setError((cause as Error).message);
    }
  }

  if (credentials.isLoading || configQuery.isLoading) {
    return <Skeleton className="h-40 w-full" />;
  }

  if (credentials.isError) {
    return <Alert variant="danger">{credentials.error.message}</Alert>;
  }

  return (
    <div className="space-y-6">
      <Card padding="lg" className="space-y-5">
        <div>
          <h2 className="font-semibold text-primary">{t("mailrelay.settings.providerTitle")}</h2>
          <p className="mt-1 text-sm text-secondary">{t("mailrelay.settings.providerDescription")}</p>
        </div>

        <label className="space-y-2 text-sm font-medium text-primary">
          <span>{t("mailrelay.settings.provider")}</span>
          <Select
            value={provider}
            onChange={(event) =>
              void handleProviderChange(event.target.value as EmailMarketingProvider)
            }
            disabled={saveConfig.isPending}
          >
            <option value="mailrelay">{t("mailrelay.settings.providerMailrelay")}</option>
            <option value="nrs360">{t("mailrelay.settings.providerNrs360")}</option>
          </Select>
        </label>

        {configured ? (
          <Alert variant="success">{t("mailrelay.settings.connected")}</Alert>
        ) : (
          <Alert variant="warning">{t("mailrelay.settings.notConnected")}</Alert>
        )}

        {error ? <Alert variant="danger">{error}</Alert> : null}
        {success ? <Alert variant="success">{success}</Alert> : null}

        {provider === "mailrelay" ? (
          <p className="text-sm text-secondary">{t("mailrelay.settings.mailrelayHint")}</p>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-secondary">{t("mailrelay.settings.nrsDescription")}</p>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-2 text-sm font-medium text-primary">
                <span>{t("mailrelay.settings.username")}</span>
                <Input
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  placeholder={t("mailrelay.settings.usernamePlaceholder")}
                />
              </label>
              <label className="space-y-2 text-sm font-medium text-primary">
                <span>{t("mailrelay.settings.apiPassword")}</span>
                <Input
                  type="password"
                  value={apiPassword}
                  onChange={(event) => setApiPassword(event.target.value)}
                  placeholder={
                    configured
                      ? t("mailrelay.settings.replacePassword")
                      : t("mailrelay.settings.apiPasswordPlaceholder")
                  }
                />
              </label>
            </div>
            <label className="space-y-2 text-sm font-medium text-primary">
              <span>{t("mailrelay.settings.baseUrl")}</span>
              <Input
                value={baseUrl}
                onChange={(event) => setBaseUrl(event.target.value)}
                placeholder="https://dashboard.360nrs.com"
              />
            </label>
            <p className="text-xs text-secondary">{t("mailrelay.settings.securityHint")}</p>
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={() => void handleSaveCredentials()}
                disabled={saveCredentials.isPending || !username.trim() || !apiPassword.trim()}
              >
                {saveCredentials.isPending
                  ? t("mailrelay.actions.saving")
                  : t("mailrelay.actions.save")}
              </Button>
              {configured ? (
                <Button
                  variant="secondary"
                  onClick={() => setConfirmDelete(true)}
                  disabled={deleteCredentials.isPending}
                >
                  <Trash2 className="h-4 w-4" />
                  {t("mailrelay.actions.delete")}
                </Button>
              ) : null}
            </div>
          </div>
        )}

        {configured ? (
          <Button variant="secondary" onClick={() => void handleTest()} disabled={test.isPending}>
            <PlugZap className="h-4 w-4" />
            {test.isPending ? t("mailrelay.actions.testing") : t("mailrelay.actions.test")}
          </Button>
        ) : null}
      </Card>

      {provider === "nrs360" ? (
        <Card padding="lg" className="space-y-5">
          <div>
            <h2 className="font-semibold text-primary">{t("mailrelay.settings.senderTitle")}</h2>
            <p className="mt-1 text-sm text-secondary">{t("mailrelay.settings.senderDescription")}</p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2 text-sm font-medium text-primary">
              <span>{t("mailrelay.settings.fromEmail")}</span>
              <Input
                type="email"
                value={fromEmail}
                onChange={(event) => setFromEmail(event.target.value)}
                placeholder="info@example.com"
              />
            </label>
            <label className="space-y-2 text-sm font-medium text-primary">
              <span>{t("mailrelay.settings.replyTo")}</span>
              <Input
                type="email"
                value={replyTo}
                onChange={(event) => setReplyTo(event.target.value)}
                placeholder="reply@example.com"
              />
            </label>
          </div>
          <label className="space-y-2 text-sm font-medium text-primary">
            <span>{t("mailrelay.settings.fromName")}</span>
            <Input
              value={fromName}
              onChange={(event) => setFromName(event.target.value)}
              placeholder={t("mailrelay.settings.fromNamePlaceholder")}
            />
          </label>
          <Button
            onClick={() => void handleSaveSender()}
            disabled={saveConfig.isPending || !fromEmail.trim()}
          >
            {saveConfig.isPending ? t("mailrelay.actions.saving") : t("mailrelay.actions.save")}
          </Button>
        </Card>
      ) : null}

      <ConfirmDialog
        open={confirmDelete}
        title={t("mailrelay.settings.deleteTitle")}
        description={t("mailrelay.settings.deleteDescription")}
        confirmLabel={t("mailrelay.actions.delete")}
        onConfirm={() => void handleDelete()}
        onCancel={() => setConfirmDelete(false)}
        loading={deleteCredentials.isPending}
        tone="danger"
      />
    </div>
  );
}
