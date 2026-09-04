"use client";

import { useEffect, useState } from "react";
import { BarChart3 } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  SettingsCard,
  SettingsCardSkeleton,
  SettingsToggleRow,
} from "@/components/settings/SettingsCard";
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
    return <SettingsCardSkeleton />;
  }

  if (loadError) {
    return (
      <SettingsCard
        icon={<BarChart3 className="h-4 w-4" />}
        title={t("settings.websiteAnalyticsTitle")}
        description={t("settings.websiteAnalyticsDescription")}
      >
        <p className="text-sm text-red-500">
          {loadError instanceof Error ? loadError.message : t("settings.websiteAnalyticsSaveError")}
        </p>
      </SettingsCard>
    );
  }

  return (
    <SettingsCard
      icon={<BarChart3 className="h-4 w-4" />}
      title={t("settings.websiteAnalyticsTitle")}
      description={t("settings.websiteAnalyticsDescription")}
      badge={
        <Badge variant={enabled ? "success" : "default"}>
          {enabled ? t("settings.websiteAnalyticsEnabled") : t("settings.websiteAnalyticsDisabled")}
        </Badge>
      }
    >
      <form onSubmit={handleSave} className="space-y-4">
        <SettingsToggleRow
          label={t("settings.websiteAnalyticsEnableLabel")}
          hint={t("settings.websiteAnalyticsEnableHint")}
          checked={enabled}
          onChange={setEnabled}
        />

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

        <Button type="submit" disabled={save.isPending}>
          {save.isPending ? t("common.saving") : t("common.save")}
        </Button>
      </form>
    </SettingsCard>
  );
}
