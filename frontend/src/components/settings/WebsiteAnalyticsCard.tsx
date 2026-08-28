"use client";

import { useEffect, useState } from "react";
import { BarChart3 } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import {
  useSaveWebsiteAnalyticsSettings,
  useWebsiteAnalyticsSettings,
} from "@/hooks/useWebsiteAnalytics";
import { resolveWebsiteAnalyticsSettings } from "@/lib/website-analytics";
import { useT } from "@/i18n/context";

export function WebsiteAnalyticsCard() {
  const t = useT();
  const { data: settings, isLoading, error: loadError } = useWebsiteAnalyticsSettings();
  const save = useSaveWebsiteAnalyticsSettings();

  const [enabled, setEnabled] = useState(false);
  const [measurementId, setMeasurementId] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!settings) return;
    const resolved = resolveWebsiteAnalyticsSettings(settings);
    setEnabled(resolved.enabled);
    setMeasurementId(resolved.googleAnalyticsMeasurementId ?? "");
  }, [settings]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    const trimmedId = measurementId.trim().toUpperCase();
    if (enabled && !/^G-[A-Z0-9]{10}$/.test(trimmedId)) {
      setError(t("settings.websiteAnalyticsIdInvalid"));
      return;
    }

    try {
      await save.mutateAsync({
        enabled,
        ...(enabled ? { googleAnalyticsMeasurementId: trimmedId } : {}),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : t("settings.websiteAnalyticsSaveError"));
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
          {loadError instanceof Error ? loadError.message : t("settings.websiteAnalyticsSaveError")}
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-default overflow-hidden">
      <div className="flex items-center gap-3 border-b border-default bg-surface p-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent-muted text-accent">
          <BarChart3 className="h-4 w-4" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-medium text-primary">{t("settings.websiteAnalyticsTitle")}</p>
          <p className="text-xs text-muted">{t("settings.websiteAnalyticsDescription")}</p>
        </div>
        <Badge variant={enabled ? "success" : "default"}>
          {enabled ? t("settings.websiteAnalyticsEnabled") : t("settings.websiteAnalyticsDisabled")}
        </Badge>
      </div>

      <form onSubmit={handleSave} className="space-y-4 p-4">
        <label className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-primary">
              {t("settings.websiteAnalyticsEnableLabel")}
            </p>
            <p className="text-xs text-muted">{t("settings.websiteAnalyticsEnableHint")}</p>
          </div>
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            className="h-4 w-4 rounded border-default text-accent focus:ring-accent"
          />
        </label>

        <div className="space-y-1">
          <label className="text-xs font-medium uppercase tracking-wide text-secondary">
            {t("settings.websiteAnalyticsMeasurementId")}
          </label>
          <Input
            value={measurementId}
            onChange={(e) => setMeasurementId(e.target.value.toUpperCase())}
            placeholder="G-XXXXXXXXXX"
            disabled={!enabled}
          />
          <p className="text-xs text-muted">{t("settings.websiteAnalyticsMeasurementIdHint")}</p>
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}

        <button
          type="submit"
          disabled={save.isPending}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {save.isPending ? t("common.saving") : t("common.save")}
        </button>
      </form>
    </div>
  );
}
