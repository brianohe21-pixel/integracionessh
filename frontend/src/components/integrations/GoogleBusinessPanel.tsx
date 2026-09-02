"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useT } from "@/i18n/context";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import {
  useDeleteGoogleBusiness,
  useGoogleBusiness,
  useRefreshGoogleBusinessLocations,
  useStartGoogleBusinessOAuth,
  useUpdateGoogleBusiness,
} from "@/hooks/useGoogleBusiness";
import { IntegrationErrorSupport } from "@/components/support/IntegrationErrorSupport";

export function GoogleBusinessPanel() {
  const t = useT();
  const searchParams = useSearchParams();
  const { data, isLoading, isError, error } = useGoogleBusiness();
  const startOAuth = useStartGoogleBusinessOAuth();
  const updateMutation = useUpdateGoogleBusiness();
  const refreshMutation = useRefreshGoogleBusinessLocations();
  const deleteMutation = useDeleteGoogleBusiness();

  const [selectedLocationIds, setSelectedLocationIds] = useState<string[]>([]);
  const [enabled, setEnabled] = useState(false);
  const [saved, setSaved] = useState(false);
  const [formError, setFormError] = useState("");
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const [oauthMessage, setOauthMessage] = useState("");

  useEffect(() => {
    if (!data) return;
    setSelectedLocationIds(data.selectedLocationIds ?? []);
    setEnabled(Boolean(data.enabled));
  }, [data]);

  useEffect(() => {
    if (searchParams.get("connected") === "1") {
      setOauthMessage(t("integrationsPage.googleBusiness.connectedSuccess"));
    }
    const oauthError = searchParams.get("error");
    if (oauthError) {
      setOauthMessage(decodeURIComponent(oauthError));
    }
  }, [searchParams, t]);

  if (isLoading) {
    return <div className="h-48 animate-pulse rounded-xl bg-surface-muted" />;
  }

  if (isError) {
    return (
      <IntegrationErrorSupport
        integration="google"
        error={error instanceof Error ? error.message : t("integrationsPage.googleBusiness.loadError")}
        context={{ flow: "google_business_load" }}
      />
    );
  }

  const configured = Boolean(data?.configured);
  const statusLabel = configured
    ? data?.enabled
      ? t("integrationsPage.enabled")
      : t("integrationsPage.configured")
    : t("integrationsPage.notConfigured");

  async function handleConnect() {
    setFormError("");
    try {
      const result = await startOAuth.mutateAsync();
      window.location.href = result.authUrl;
    } catch (connectError) {
      setFormError(
        connectError instanceof Error
          ? connectError.message
          : t("integrationsPage.googleBusiness.connectError")
      );
    }
  }

  async function handleSave() {
    setFormError("");
    setSaved(false);
    try {
      await updateMutation.mutateAsync({
        enabled,
        selectedLocationIds,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (saveError) {
      setFormError(
        saveError instanceof Error
          ? saveError.message
          : t("integrationsPage.googleBusiness.saveError")
      );
    }
  }

  function toggleLocation(locationId: string) {
    setSelectedLocationIds((current) =>
      current.includes(locationId)
        ? current.filter((id) => id !== locationId)
        : [...current, locationId]
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <Link
          href="/integrations"
          className="text-sm font-medium text-accent hover:text-accent-hover"
        >
          {t("integrationsPage.backToIntegrations")}
        </Link>
        <Badge variant={configured ? "success" : "default"}>{statusLabel}</Badge>
      </div>

      {oauthMessage ? (
        <Alert variant={searchParams.get("error") ? "danger" : "success"}>{oauthMessage}</Alert>
      ) : null}

      {!configured ? (
        <Alert variant="info">{t("integrationsPage.googleBusiness.notConfiguredAlert")}</Alert>
      ) : (
        <Alert variant="success">{t("integrationsPage.googleBusiness.configuredAlert")}</Alert>
      )}

      {formError ? (
        <IntegrationErrorSupport
          integration="google"
          error={formError}
          context={{ flow: "google_business_connect" }}
        />
      ) : null}
      {saved ? <Alert variant="success">{t("integrationsPage.googleBusiness.saved")}</Alert> : null}

      <div className="rounded-xl border border-default bg-surface-elevated p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-primary">
          {t("integrationsPage.googleBusiness.statusTitle")}
        </h2>

        {configured ? (
          <div className="space-y-3 text-sm text-secondary">
            {data?.googleAccountEmail ? (
              <p>
                <span className="font-medium text-primary">
                  {t("integrationsPage.googleBusiness.accountEmail")}:
                </span>{" "}
                {data.googleAccountEmail}
              </p>
            ) : null}
            {data?.connectedAt ? (
              <p>
                <span className="font-medium text-primary">
                  {t("integrationsPage.googleBusiness.connectedAt")}:
                </span>{" "}
                {new Date(data.connectedAt).toLocaleString()}
              </p>
            ) : null}
          </div>
        ) : (
          <p className="text-sm text-secondary">
            {t("integrationsPage.googleBusiness.connectHint")}
          </p>
        )}

        <div className="mt-6 flex flex-wrap gap-3">
          {!configured ? (
            <Button onClick={() => void handleConnect()} disabled={startOAuth.isPending}>
              {startOAuth.isPending
                ? t("integrationsPage.googleBusiness.connecting")
                : t("integrationsPage.googleBusiness.connect")}
            </Button>
          ) : (
            <>
              <Button
                variant="secondary"
                onClick={() => void refreshMutation.mutateAsync()}
                disabled={refreshMutation.isPending}
              >
                {refreshMutation.isPending
                  ? t("integrationsPage.googleBusiness.refreshing")
                  : t("integrationsPage.googleBusiness.refreshLocations")}
              </Button>
              <Button variant="danger" onClick={() => setConfirmDisconnect(true)}>
                {t("integrationsPage.googleBusiness.disconnect")}
              </Button>
            </>
          )}
        </div>
      </div>

      {configured && (data?.locations?.length ?? 0) > 0 ? (
        <div className="rounded-xl border border-default bg-surface-elevated p-6 shadow-sm">
          <h2 className="mb-2 text-lg font-semibold text-primary">
            {t("integrationsPage.googleBusiness.locationsTitle")}
          </h2>
          <p className="mb-4 text-sm text-secondary">
            {t("integrationsPage.googleBusiness.locationsHint")}
          </p>

          <label className="mb-4 flex items-center gap-3 text-sm text-primary">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(event) => setEnabled(event.target.checked)}
              className="h-4 w-4 rounded border-default"
            />
            {t("integrationsPage.googleBusiness.enabledLabel")}
          </label>

          <div className="space-y-3">
            {data?.locations.map((location) => (
              <label
                key={location.id}
                className="flex cursor-pointer items-start gap-3 rounded-lg border border-default p-4"
              >
                <input
                  type="checkbox"
                  checked={selectedLocationIds.includes(location.id)}
                  onChange={() => toggleLocation(location.id)}
                  className="mt-1 h-4 w-4 rounded border-default"
                />
                <div>
                  <p className="font-medium text-primary">{location.name}</p>
                  {location.address ? (
                    <p className="text-sm text-secondary">{location.address}</p>
                  ) : null}
                </div>
              </label>
            ))}
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <Button onClick={() => void handleSave()} disabled={updateMutation.isPending}>
              {updateMutation.isPending
                ? t("integrationsPage.googleBusiness.saving")
                : t("integrationsPage.googleBusiness.save")}
            </Button>
            <Link
              href="/reviews"
              className="inline-flex items-center rounded-lg border border-default px-4 py-2 text-sm font-medium text-secondary hover:bg-surface-muted"
            >
              {t("integrationsPage.googleBusiness.openReviews")}
            </Link>
          </div>
        </div>
      ) : null}

      <ConfirmDialog
        open={confirmDisconnect}
        title={t("integrationsPage.googleBusiness.disconnect")}
        description={t("integrationsPage.googleBusiness.disconnectConfirm")}
        confirmLabel={t("integrationsPage.googleBusiness.disconnect")}
        cancelLabel={t("common.cancel")}
        tone="danger"
        onConfirm={() => {
          setConfirmDisconnect(false);
          void deleteMutation.mutateAsync();
        }}
        onCancel={() => setConfirmDisconnect(false)}
      />
    </div>
  );
}
