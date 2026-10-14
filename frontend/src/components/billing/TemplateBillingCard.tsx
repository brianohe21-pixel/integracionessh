"use client";

import { MessageSquareText } from "lucide-react";
import { useBillingStatus } from "@/hooks/useBilling";
import { useT } from "@/i18n/context";
import { formatCopPrice } from "@/lib/plan-config";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import {
  SettingsCard,
  SettingsCardSkeleton,
  SettingsCallout,
} from "@/components/settings/SettingsCard";
import { useRouter } from "next/navigation";

export function TemplateBillingCard() {
  const t = useT();
  const router = useRouter();
  const { data, isLoading } = useBillingStatus();

  if (isLoading || !data) {
    return <SettingsCardSkeleton lines={4} />;
  }

  if (data.plan !== "starter") return null;

  const templates = data.templateBilling;
  const breakdown = data.checkoutBreakdown;
  if (!templates || !breakdown) return null;

  return (
    <SettingsCard
      icon={<MessageSquareText className="h-4 w-4" />}
      title={t("billing.templateUsageTitle")}
      description={t("billing.templateUsageHint")}
      badge={
        templates.blockReason === "past_due" ? (
          <Badge variant="warning">{t("billing.subscriptionStatus.past_due")}</Badge>
        ) : templates.creditCapReached ? (
          <Badge variant="warning">{t("billing.templateCreditCap")}</Badge>
        ) : undefined
      }
      footer={
        data.canRenew || templates.templatesBlocked ? (
          <Button type="button" onClick={() => router.push("/billing/checkout?plan=starter")}>
            {t("billing.renewPlan")}
          </Button>
        ) : undefined
      }
    >
      {templates.creditCapReached ? (
        <SettingsCallout variant="warning">{t("billing.templateCreditCapReached")}</SettingsCallout>
      ) : null}
      {templates.blockReason === "past_due" ? (
        <SettingsCallout variant="warning">{t("billing.templatePastDue")}</SettingsCallout>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-xl border border-subtle bg-surface px-4 py-3">
          <p className="text-sm text-secondary">{t("billing.templateUnitPrice")}</p>
          <p className="mt-1 text-lg font-semibold tabular-nums text-primary">
            {formatCopPrice(templates.unitPriceCents)}
          </p>
        </div>
        <div className="rounded-xl border border-subtle bg-surface px-4 py-3">
          <p className="text-sm text-secondary">{t("billing.templateAcceptedCount")}</p>
          <p className="mt-1 text-lg font-semibold tabular-nums text-primary">
            {templates.templatesAcceptedCount.toLocaleString()}
            {templates.creditCapCount != null ? (
              <span className="font-normal text-muted">
                {" "}
                / {templates.creditCapCount.toLocaleString()}
              </span>
            ) : null}
          </p>
        </div>
        <div className="rounded-xl border border-subtle bg-surface px-4 py-3">
          <p className="text-sm text-secondary">{t("billing.templateFeeDue")}</p>
          <p className="mt-1 text-lg font-semibold tabular-nums text-primary">
            {formatCopPrice(templates.templateFeeCents)}
          </p>
        </div>
      </div>

      <div className="mt-4 space-y-1 rounded-xl bg-surface-muted/40 px-4 py-3 text-sm">
        <div className="flex justify-between gap-3">
          <span className="text-secondary">{t("billing.templatePlanFee")}</span>
          <span className="font-medium tabular-nums text-primary">
            {formatCopPrice(breakdown.planFeeCents)}
          </span>
        </div>
        <div className="flex justify-between gap-3">
          <span className="text-secondary">{t("billing.templateFeeDue")}</span>
          <span className="font-medium tabular-nums text-primary">
            {formatCopPrice(breakdown.templateFeeCents)}
          </span>
        </div>
        <div className="flex justify-between gap-3 border-t border-subtle pt-2">
          <span className="font-medium text-primary">{t("billing.templateRenewalTotal")}</span>
          <span className="font-semibold tabular-nums text-primary">
            {formatCopPrice(breakdown.totalCents)}
          </span>
        </div>
      </div>
    </SettingsCard>
  );
}
