"use client";

import { useEffect, useState } from "react";
import { Clock } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { useInboxSlaSettings, useSaveInboxSlaSettings } from "@/hooks/useInboxSla";
import { DEFAULT_INBOX_SLA } from "@/lib/inbox-sla";
import { useT } from "@/i18n/context";

export function InboxSlaCard() {
  const t = useT();
  const { data: settings, isLoading, error: loadError } = useInboxSlaSettings();
  const save = useSaveInboxSlaSettings();

  const [enabled, setEnabled] = useState(DEFAULT_INBOX_SLA.enabled);
  const [minutes, setMinutes] = useState(DEFAULT_INBOX_SLA.firstResponseMinutes);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!settings) return;
    setEnabled(settings.enabled);
    setMinutes(settings.firstResponseMinutes);
  }, [settings]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    const parsedMinutes = Math.round(Number(minutes));
    if (!Number.isFinite(parsedMinutes) || parsedMinutes < 1 || parsedMinutes > 1440) {
      setError(t("settings.inboxSlaMinutesInvalid"));
      return;
    }

    try {
      await save.mutateAsync({
        enabled: Boolean(enabled),
        firstResponseMinutes: parsedMinutes,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : t("settings.inboxSlaSaveError"));
    }
  }

  if (isLoading) {
    return (
      <div className="rounded-lg border border-default p-4 animate-pulse">
        <div className="h-4 w-40 bg-surface-muted rounded" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="rounded-lg border border-default p-4">
        <p className="text-sm text-red-500">
          {loadError instanceof Error ? loadError.message : t("settings.inboxSlaSaveError")}
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-default overflow-hidden">
      <div className="flex items-center gap-3 border-b border-default bg-surface p-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent-muted text-accent">
          <Clock className="h-4 w-4" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-medium text-primary">{t("settings.inboxSlaTitle")}</p>
          <p className="text-xs text-muted">{t("settings.inboxSlaDescription")}</p>
        </div>
        <Badge variant={enabled ? "success" : "default"}>
          {enabled ? t("settings.inboxSlaEnabled") : t("settings.inboxSlaDisabled")}
        </Badge>
      </div>

      <form onSubmit={handleSave} className="space-y-4 p-4">
        <label className="flex items-center justify-between gap-4">
          <span className="text-sm text-secondary">{t("settings.inboxSlaEnableLabel")}</span>
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            className="h-4 w-4 rounded border-default text-accent focus:ring-accent"
          />
        </label>

        <label className="block space-y-1.5">
          <span className="text-sm text-secondary">{t("settings.inboxSlaMinutesLabel")}</span>
          <input
            type="number"
            min={1}
            max={1440}
            value={minutes}
            onChange={(e) => {
              const next = parseInt(e.target.value, 10);
              setMinutes(Number.isFinite(next) ? next : DEFAULT_INBOX_SLA.firstResponseMinutes);
            }}
            disabled={!enabled}
            className="w-full rounded-lg border border-default bg-surface px-3 py-2 text-sm text-primary disabled:opacity-50"
          />
        </label>

        {error && <p className="text-xs text-red-500">{error}</p>}

        <button
          type="submit"
          disabled={save.isPending}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          {save.isPending ? t("auth.saving") : t("common.save")}
        </button>
      </form>
    </div>
  );
}
