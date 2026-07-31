"use client";

import { useT } from "@/i18n/context";
import type { CampaignBatchConfig } from "@/types";

export const DEFAULT_BATCH_SIZE = 100;
export const DEFAULT_BATCH_DELAY_MINUTES = 5;
export const MIN_BATCH_SIZE = 1;
export const MAX_BATCH_SIZE = 1000;
export const MIN_BATCH_DELAY_MINUTES = 1;
export const MAX_BATCH_DELAY_HOURS = 24;

export type BatchDelayUnit = "minutes" | "hours";

export interface BatchFormState {
  enabled: boolean;
  size: number;
  delayValue: number;
  delayUnit: BatchDelayUnit;
}

export const DEFAULT_BATCH_FORM: BatchFormState = {
  enabled: false,
  size: DEFAULT_BATCH_SIZE,
  delayValue: DEFAULT_BATCH_DELAY_MINUTES,
  delayUnit: "minutes",
};

export function batchFormToConfig(form: BatchFormState): CampaignBatchConfig | undefined {
  if (!form.enabled) return undefined;
  const delaySeconds =
    form.delayUnit === "hours" ? form.delayValue * 3600 : form.delayValue * 60;
  return { size: form.size, delaySeconds };
}

export function validateBatchForm(form: BatchFormState): string | null {
  if (!form.enabled) return null;
  if (!Number.isInteger(form.size) || form.size < MIN_BATCH_SIZE || form.size > MAX_BATCH_SIZE) {
    return "invalidSize";
  }
  if (!Number.isInteger(form.delayValue) || form.delayValue < 1) {
    return "invalidDelay";
  }
  const delaySeconds =
    form.delayUnit === "hours" ? form.delayValue * 3600 : form.delayValue * 60;
  if (delaySeconds < 60 || delaySeconds > 86_400) {
    return "invalidDelay";
  }
  return null;
}

export function estimateBatchCount(totalRecipients: number, batchSize: number): number {
  if (totalRecipients <= 0 || batchSize <= 0) return 0;
  return Math.ceil(totalRecipients / batchSize);
}

export function formatBatchDelay(seconds: number, t: (key: string, vars?: Record<string, string | number>) => string): string {
  if (seconds % 3600 === 0) {
    const hours = seconds / 3600;
    return t("campaigns.batch.delayHours", { count: hours });
  }
  const minutes = Math.round(seconds / 60);
  return t("campaigns.batch.delayMinutes", { count: minutes });
}

interface CampaignBatchSettingsProps {
  value: BatchFormState;
  onChange: (value: BatchFormState) => void;
  totalRecipients?: number;
}

export function CampaignBatchSettings({
  value,
  onChange,
  totalRecipients,
}: CampaignBatchSettingsProps) {
  const t = useT();
  const validationError = validateBatchForm(value);
  const estimatedBatches =
    value.enabled && totalRecipients
      ? estimateBatchCount(totalRecipients, value.size)
      : null;

  return (
    <div className="space-y-3 rounded-lg border border-default p-4">
      <label className="flex items-start gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={value.enabled}
          onChange={(e) => onChange({ ...value, enabled: e.target.checked })}
          className="mt-0.5 h-4 w-4 rounded border-default text-accent focus:ring-accent"
        />
        <span className="text-sm text-secondary">
          <span className="font-medium text-primary">{t("campaigns.batch.enable")}</span>
          <span className="block text-xs text-muted mt-0.5">{t("campaigns.batch.enableHint")}</span>
        </span>
      </label>

      {value.enabled && (
        <div className="grid sm:grid-cols-2 gap-4 pt-1">
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-secondary">
              {t("campaigns.batch.sizeLabel")}
            </label>
            <input
              type="number"
              min={MIN_BATCH_SIZE}
              max={MAX_BATCH_SIZE}
              value={value.size}
              onChange={(e) =>
                onChange({ ...value, size: Math.max(1, parseInt(e.target.value, 10) || 1) })
              }
              className="w-full px-3 py-2 border border-default rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent/30"
            />
            <p className="text-xs text-muted">{t("campaigns.batch.sizeHint")}</p>
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-secondary">
              {t("campaigns.batch.delayLabel")}
            </label>
            <div className="flex gap-2">
              <input
                type="number"
                min={1}
                max={value.delayUnit === "hours" ? MAX_BATCH_DELAY_HOURS : MAX_BATCH_DELAY_HOURS * 60}
                value={value.delayValue}
                onChange={(e) =>
                  onChange({
                    ...value,
                    delayValue: Math.max(1, parseInt(e.target.value, 10) || 1),
                  })
                }
                className="flex-1 px-3 py-2 border border-default rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent/30"
              />
              <select
                value={value.delayUnit}
                onChange={(e) =>
                  onChange({
                    ...value,
                    delayUnit: e.target.value as BatchDelayUnit,
                    delayValue:
                      e.target.value === "hours" && value.delayValue > MAX_BATCH_DELAY_HOURS
                        ? MAX_BATCH_DELAY_HOURS
                        : value.delayValue,
                  })
                }
                className="px-3 py-2 border border-default rounded-lg text-sm bg-surface-elevated focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent/30"
              >
                <option value="minutes">{t("campaigns.batch.unitMinutes")}</option>
                <option value="hours">{t("campaigns.batch.unitHours")}</option>
              </select>
            </div>
            <p className="text-xs text-muted">{t("campaigns.batch.delayHint")}</p>
          </div>
        </div>
      )}

      {validationError && value.enabled && (
        <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">
          {t(`campaigns.batch.errors.${validationError}`)}
        </p>
      )}

      {estimatedBatches !== null && estimatedBatches > 0 && !validationError && (
        <p className="text-xs text-secondary bg-surface-muted px-3 py-2 rounded-lg">
          {t("campaigns.batch.estimate", {
            batches: estimatedBatches,
            size: value.size,
          })}
        </p>
      )}
    </div>
  );
}
