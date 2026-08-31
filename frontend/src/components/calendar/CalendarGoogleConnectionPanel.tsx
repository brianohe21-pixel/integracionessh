"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useT } from "@/i18n/context";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import {
  useDisconnectGoogleCalendar,
  useGoogleCalendar,
  useRefreshGoogleCalendars,
  useStartGoogleCalendarOAuth,
  useUpdateGoogleCalendar,
} from "@/hooks/useGoogleCalendar";

interface CalendarGoogleConnectionPanelProps {
  botId: string;
}

export function CalendarGoogleConnectionPanel({ botId }: CalendarGoogleConnectionPanelProps) {
  const t = useT();
  const searchParams = useSearchParams();
  const { data, isLoading, isError, error } = useGoogleCalendar(botId);
  const startOAuth = useStartGoogleCalendarOAuth(botId);
  const updateMutation = useUpdateGoogleCalendar(botId);
  const refreshMutation = useRefreshGoogleCalendars(botId);
  const disconnectMutation = useDisconnectGoogleCalendar(botId);

  const [selectedCalendarId, setSelectedCalendarId] = useState("");
  const [blockExternalEvents, setBlockExternalEvents] = useState(true);
  const [saved, setSaved] = useState(false);
  const [formError, setFormError] = useState("");
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const [oauthMessage, setOauthMessage] = useState("");

  useEffect(() => {
    if (!data) return;
    setSelectedCalendarId(data.googleCalendarId ?? "");
    setBlockExternalEvents(data.blockExternalEvents ?? true);
  }, [data]);

  useEffect(() => {
    if (searchParams.get("googleConnected") === "1") {
      setOauthMessage(t("calendar.google.connectedSuccess"));
    }
    const oauthError = searchParams.get("error");
    if (oauthError) {
      setOauthMessage(decodeURIComponent(oauthError));
    }
  }, [searchParams, t]);

  if (isLoading) {
    return <div className="h-40 animate-pulse rounded-xl bg-surface-muted" />;
  }

  if (isError) {
    return (
      <Alert variant="danger">
        {error instanceof Error ? error.message : t("calendar.google.loadError")}
      </Alert>
    );
  }

  const connected = Boolean(data?.connected);
  const active = data?.status === "active" && data.provider === "google";
  const pendingSelection = connected && !active;

  async function handleConnect() {
    setFormError("");
    try {
      const result = await startOAuth.mutateAsync();
      window.location.href = result.authUrl;
    } catch (connectError) {
      setFormError(
        connectError instanceof Error ? connectError.message : t("calendar.google.connectError")
      );
    }
  }

  async function handleSave() {
    setFormError("");
    setSaved(false);
    if (!selectedCalendarId) {
      setFormError(t("calendar.google.selectCalendarRequired"));
      return;
    }
    try {
      await updateMutation.mutateAsync({
        googleCalendarId: selectedCalendarId,
        blockExternalEvents,
      });
      setSaved(true);
    } catch (saveError) {
      setFormError(
        saveError instanceof Error ? saveError.message : t("calendar.google.saveError")
      );
    }
  }

  async function handleDisconnect() {
    setFormError("");
    try {
      await disconnectMutation.mutateAsync();
      setConfirmDisconnect(false);
    } catch (disconnectError) {
      setFormError(
        disconnectError instanceof Error
          ? disconnectError.message
          : t("calendar.google.disconnectError")
      );
    }
  }

  return (
    <section className="rounded-xl border border-default bg-surface-elevated p-6">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-primary">{t("calendar.google.title")}</h3>
          <p className="mt-1 text-sm text-secondary">{t("calendar.google.subtitle")}</p>
        </div>
        {active ? (
          <Badge variant="success">{t("calendar.google.statusActive")}</Badge>
        ) : data?.status === "error" ? (
          <Badge variant="danger">{t("calendar.google.statusError")}</Badge>
        ) : connected ? (
          <Badge variant="warning">{t("calendar.google.statusPending")}</Badge>
        ) : null}
      </div>

      {oauthMessage ? (
        <Alert variant={data?.status === "error" ? "danger" : "success"} className="mb-4">
          {oauthMessage}
        </Alert>
      ) : null}

      {formError ? (
        <Alert variant="danger" className="mb-4">
          {formError}
        </Alert>
      ) : null}

      {!connected ? (
        <Button onClick={() => void handleConnect()} disabled={startOAuth.isPending}>
          {t("calendar.google.connect")}
        </Button>
      ) : (
        <div className="space-y-4">
          {data?.googleAccountEmail ? (
            <p className="text-sm text-secondary">
              {t("calendar.google.connectedAs", { email: data.googleAccountEmail })}
            </p>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              onClick={() => void refreshMutation.mutateAsync()}
              disabled={refreshMutation.isPending}
            >
              {t("calendar.google.refreshCalendars")}
            </Button>
            {active ? (
              <Button variant="secondary" onClick={() => void handleConnect()}>
                {t("calendar.google.reconnect")}
              </Button>
            ) : null}
            <Button variant="danger" onClick={() => setConfirmDisconnect(true)}>
              {t("calendar.google.disconnect")}
            </Button>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-primary">
              {t("calendar.google.selectCalendar")}
            </label>
            <select
              value={selectedCalendarId}
              onChange={(event) => setSelectedCalendarId(event.target.value)}
              className="w-full rounded-lg border border-default bg-surface px-3 py-2 text-sm"
            >
              <option value="">{t("calendar.google.selectCalendarPlaceholder")}</option>
              {(data?.calendars ?? []).map((calendar) => (
                <option key={calendar.id} value={calendar.id}>
                  {calendar.name}
                  {calendar.primary ? ` (${t("calendar.google.primary")})` : ""}
                </option>
              ))}
            </select>
          </div>

          <label className="flex items-start gap-3 text-sm text-secondary">
            <input
              type="checkbox"
              checked={blockExternalEvents}
              onChange={(event) => setBlockExternalEvents(event.target.checked)}
              className="mt-1"
            />
            <span>
              <span className="block font-medium text-primary">
                {t("calendar.google.blockExternalEvents")}
              </span>
              {t("calendar.google.blockExternalEventsHint")}
            </span>
          </label>

          <div className="flex items-center gap-3">
            <Button onClick={() => void handleSave()} disabled={updateMutation.isPending}>
              {t("common.save")}
            </Button>
            {saved ? <span className="text-sm text-green-600">{t("calendar.saved")}</span> : null}
            {pendingSelection ? (
              <span className="text-sm text-secondary">{t("calendar.google.pendingSelection")}</span>
            ) : null}
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirmDisconnect}
        title={t("calendar.google.disconnect")}
        description={t("calendar.google.disconnectConfirm")}
        confirmLabel={t("calendar.google.disconnect")}
        cancelLabel={t("common.cancel")}
        tone="danger"
        onConfirm={() => void handleDisconnect()}
        onCancel={() => setConfirmDisconnect(false)}
        loading={disconnectMutation.isPending}
      />
    </section>
  );
}
