"use client";

import { useT } from "@/i18n/context";
import type { CalendarConfig } from "@/types";
import { FieldLabel } from "@/components/ui/FieldLabel";

export function CalendarPaymentSettings({
  config,
  paymentsEnabled,
  wompiConfigured,
  onChange,
}: {
  config: CalendarConfig;
  paymentsEnabled: boolean;
  wompiConfigured: boolean;
  onChange: (patch: Partial<CalendarConfig>) => void;
}) {
  const t = useT();
  const canCollect = paymentsEnabled && wompiConfigured;

  return (
    <section className="rounded-xl border border-default bg-surface-elevated p-6">
      <h3 className="font-semibold text-primary">{t("calendar.payment.title")}</h3>
      <p className="mt-1 text-sm text-secondary">{t("calendar.payment.subtitle")}</p>

      <label className="mt-4 flex items-start gap-3 rounded-lg border border-default p-4">
        <input
          type="checkbox"
          checked={config.autoCollectPayment ?? false}
          disabled={!canCollect}
          onChange={(e) => onChange({ autoCollectPayment: e.target.checked })}
          className="mt-1 h-4 w-4 rounded border-default text-accent"
        />
        <span className="min-w-0 flex-1">
          <FieldLabel
            label={t("calendar.payment.autoCollect")}
            tooltip={t("calendar.fieldHints.autoCollectPayment")}
            className="mb-0 text-primary"
          />
          <span className="mt-1 block text-sm text-secondary">
            {canCollect
              ? t("calendar.payment.autoCollectHint")
              : t("calendar.payment.autoCollectDisabled")}
          </span>
        </span>
      </label>

      {config.autoCollectPayment ? (
        <div className="mt-4">
          <FieldLabel
            label={t("calendar.payment.bookingPrice")}
            tooltip={t("calendar.fieldHints.bookingPrice")}
          />
          <input
            type="number"
            min={1000}
            step={100}
            value={config.bookingPriceInCents ?? ""}
            onChange={(e) =>
              onChange({
                bookingPriceInCents: e.target.value ? Number(e.target.value) : undefined,
              })
            }
            className="w-full max-w-xs rounded-lg border border-default px-3 py-2 text-sm"
            placeholder="50000"
          />
          <p className="mt-1 text-xs text-secondary">{t("calendar.payment.bookingPriceHint")}</p>
        </div>
      ) : null}
    </section>
  );
}
