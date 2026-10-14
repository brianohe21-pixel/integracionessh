"use client";

import { useT } from "@/i18n/context";
import type { CatalogConfig } from "@/types";

export function CatalogConfigForm({
  config,
  paymentsEnabled,
  onChange,
}: {
  config: CatalogConfig;
  paymentsEnabled: boolean;
  onChange: (patch: Partial<CatalogConfig>) => void;
}) {
  const t = useT();

  return (
    <div className="space-y-5">
      <div>
        <label className="mb-1.5 block text-sm font-medium text-secondary">
          {t("catalog.catalogMessageText")}
        </label>
        <input
          value={config.catalogMessageText ?? ""}
          onChange={(e) => onChange({ catalogMessageText: e.target.value })}
          className="w-full rounded-lg border border-default px-3 py-2 text-sm"
        />
        <p className="mt-1.5 text-xs text-secondary">{t("catalog.catalogMessageHint")}</p>
      </div>
      <div>
        <label className="mb-1.5 block text-sm font-medium text-secondary">
          {t("catalog.orderConfirmationMessage")}
        </label>
        <textarea
          value={config.orderConfirmationMessage ?? ""}
          onChange={(e) => onChange({ orderConfirmationMessage: e.target.value })}
          rows={3}
          className="w-full rounded-lg border border-default px-3 py-2 text-sm"
        />
        <p className="mt-1.5 text-xs text-secondary">{t("catalog.orderConfirmationHint")}</p>
      </div>
      <div>
        <label className="mb-1.5 block text-sm font-medium text-secondary">
          {t("catalog.orderStatusMessageTemplate")}
        </label>
        <textarea
          value={config.orderStatusMessageTemplate ?? ""}
          onChange={(e) => onChange({ orderStatusMessageTemplate: e.target.value })}
          rows={3}
          className="w-full rounded-lg border border-default px-3 py-2 text-sm"
        />
        <p className="mt-1.5 text-xs text-secondary">{t("catalog.orderStatusHint")}</p>
      </div>
      <label className="flex items-start gap-3 rounded-xl border border-default p-4 transition-colors hover:bg-surface-muted/40">
        <input
          type="checkbox"
          checked={config.autoCollectPayment}
          disabled={!paymentsEnabled}
          onChange={(e) => onChange({ autoCollectPayment: e.target.checked })}
          className="mt-1 h-4 w-4 rounded border-default text-accent"
        />
        <span>
          <span className="block text-sm font-medium text-primary">
            {t("catalog.autoCollectPayment")}
          </span>
          <span className="mt-0.5 block text-sm text-secondary">
            {paymentsEnabled
              ? t("catalog.autoCollectPaymentHint")
              : t("catalog.autoCollectPaymentDisabled")}
          </span>
        </span>
      </label>
    </div>
  );
}
