"use client";

import { useT } from "@/i18n/context";
import type { PaymentsConfig } from "@/types";

export function PaymentsConfigForm({
  draft,
  onChange,
}: {
  draft: PaymentsConfig;
  onChange: (next: PaymentsConfig) => void;
}) {
  const t = useT();

  return (
    <div className="rounded-xl border border-default bg-surface-elevated p-6 space-y-4">
      <h2 className="text-base font-semibold text-primary">{t("payments.configTitle")}</h2>
      <div>
        <label className="mb-1 block text-sm font-medium text-secondary">
          {t("payments.defaultAmount")}
        </label>
        <input
          type="number"
          min={1000}
          step={100}
          value={draft.defaultAmountInCents ?? ""}
          onChange={(e) =>
            onChange({
              ...draft,
              defaultAmountInCents: e.target.value ? Number(e.target.value) : undefined,
            })
          }
          className="w-full max-w-xs rounded-lg border border-default px-3 py-2 text-sm"
          placeholder="50000"
        />
        <p className="mt-1 text-xs text-secondary">{t("payments.amountInCentsHint")}</p>
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-secondary">
          {t("payments.messageTemplate")}
        </label>
        <textarea
          value={draft.paymentMessageTemplate ?? ""}
          onChange={(e) =>
            onChange({ ...draft, paymentMessageTemplate: e.target.value })
          }
          rows={3}
          className="w-full rounded-lg border border-default px-3 py-2 text-sm"
        />
        <p className="mt-1 text-xs text-secondary">{t("payments.templateHint")}</p>
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-secondary">
          {t("payments.successRedirectUrl")}
        </label>
        <input
          type="url"
          value={draft.successRedirectUrl ?? ""}
          onChange={(e) =>
            onChange({
              ...draft,
              successRedirectUrl: e.target.value || undefined,
            })
          }
          className="w-full rounded-lg border border-default px-3 py-2 text-sm"
          placeholder="https://..."
        />
      </div>
    </div>
  );
}
