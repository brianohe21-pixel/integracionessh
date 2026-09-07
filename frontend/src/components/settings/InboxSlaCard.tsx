"use client";

import { useEffect, useState } from "react";
import { Clock } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  SettingsCard,
  SettingsCardSkeleton,
  SettingsToggleRow,
} from "@/components/settings/SettingsCard";
import { useInboxSlaSettings, useSaveInboxSlaSettings } from "@/hooks/useInboxSla";
import { DEFAULT_INBOX_SLA, resolveInboxSlaSettings } from "@/lib/inbox-sla";
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
    const resolved = resolveInboxSlaSettings(settings);
    setEnabled(resolved.enabled);
    setMinutes(resolved.firstResponseMinutes);
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
    return <SettingsCardSkeleton />;
  }

  if (loadError) {
    return (
      <SettingsCard
        icon={<Clock className="h-4 w-4" />}
        title={t("settings.inboxSlaTitle")}
        description={t("settings.inboxSlaDescription")}
      >
        <p className="text-sm text-red-500">
          {loadError instanceof Error ? loadError.message : t("settings.inboxSlaSaveError")}
        </p>
      </SettingsCard>
    );
  }

  return (
    <SettingsCard
      icon={<Clock className="h-4 w-4" />}
      title={t("settings.inboxSlaTitle")}
      description={t("settings.inboxSlaDescription")}
      badge={
        <Badge variant={enabled ? "success" : "default"}>
          {enabled ? t("settings.inboxSlaEnabled") : t("settings.inboxSlaDisabled")}
        </Badge>
      }
    >
      <form onSubmit={handleSave} className="space-y-4">
        <SettingsToggleRow
          label={t("settings.inboxSlaEnableLabel")}
          checked={Boolean(enabled)}
          onChange={setEnabled}
        />

        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-secondary">{t("settings.inboxSlaMinutesLabel")}</span>
          <Input
            type="number"
            min={1}
            max={1440}
            value={minutes ?? DEFAULT_INBOX_SLA.firstResponseMinutes}
            onChange={(e) => {
              const next = parseInt(e.target.value, 10);
              setMinutes(Number.isFinite(next) ? next : DEFAULT_INBOX_SLA.firstResponseMinutes);
            }}
            disabled={!enabled}
          />
        </label>

        {error ? <p className="text-xs text-red-500">{error}</p> : null}

        <Button type="submit" disabled={save.isPending}>
          {save.isPending ? t("auth.saving") : t("common.save")}
        </Button>
      </form>
    </SettingsCard>
  );
}
