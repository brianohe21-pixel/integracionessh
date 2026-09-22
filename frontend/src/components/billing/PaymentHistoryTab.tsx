"use client";

import { useBillingPayments } from "@/hooks/useBilling";
import { useFormatters } from "@/hooks/useFormatters";
import { useT } from "@/i18n/context";
import { Badge } from "@/components/ui/Badge";
import { TableContainer } from "@/components/ui/TableContainer";
import type { PaymentStatus } from "@/types";

function paymentStatusVariant(
  status: PaymentStatus
): "success" | "warning" | "danger" | "default" {
  if (status === "approved") return "success";
  if (status === "pending") return "warning";
  if (status === "declined") return "danger";
  return "default";
}

export function PaymentHistoryTab() {
  const t = useT();
  const { formatDate, formatCurrency, planLabel } = useFormatters();
  const { data: payments, isLoading } = useBillingPayments();

  if (isLoading) {
    return <div className="h-48 animate-pulse rounded-xl bg-surface-muted" />;
  }

  if (!payments?.length) {
    return (
      <p className="text-sm text-secondary">{t("billing.paymentHistory.empty")}</p>
    );
  }

  return (
    <TableContainer className="overflow-hidden rounded-xl border border-default bg-surface-elevated">
      <table className="min-w-[640px] w-full text-sm">
        <thead className="bg-surface text-left text-secondary">
          <tr>
            <th className="px-4 py-3 font-medium">{t("common.date")}</th>
            <th className="px-4 py-3 font-medium">{t("billing.currentPlan")}</th>
            <th className="px-4 py-3 font-medium">{t("billing.paymentHistory.amount")}</th>
            <th className="px-4 py-3 font-medium">{t("common.status")}</th>
            <th className="px-4 py-3 font-medium">{t("billing.paymentHistory.reference")}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {payments.map((payment) => (
            <tr key={payment.reference}>
              <td className="px-4 py-3 text-secondary">{formatDate(payment.createdAt)}</td>
              <td className="px-4 py-3 text-primary">{planLabel(payment.plan)}</td>
              <td className="px-4 py-3 text-secondary">
                {formatCurrency(payment.amountInCents)}
              </td>
              <td className="px-4 py-3">
                <Badge variant={paymentStatusVariant(payment.status)}>
                  {t(`billing.paymentStatus.${payment.status}`)}
                </Badge>
              </td>
              <td className="px-4 py-3 font-mono text-xs text-secondary">
                {payment.reference}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </TableContainer>
  );
}
