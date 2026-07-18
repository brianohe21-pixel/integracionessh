"use client";

import { useAdminPayments } from "@/hooks/useAdminPayments";
import { useAdminTenants } from "@/hooks/useAdminTenants";
import { useFormatters } from "@/hooks/useFormatters";
import { useT } from "@/i18n/context";
import { DashboardPage } from "@/components/layout/DashboardPage";
import { PageHeader } from "@/components/layout/PageHeader";
import { TableContainer } from "@/components/ui/TableContainer";

function formatCents(cents: number): string {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

export default function AdminPaymentsPage() {
  const t = useT();
  const { formatDate } = useFormatters();
  const { data: tenants, isLoading: tenantsLoading } = useAdminTenants();
  const { data: payments, isLoading: paymentsLoading } = useAdminPayments();

  return (
    <DashboardPage maxWidth="6xl" className="space-y-10">
      <PageHeader
        title={t("admin.payments.title")}
        subtitle={t("admin.payments.subtitle")}
      />

      <section>
        <h2 className="text-lg font-semibold text-primary mb-4">
          {t("admin.payments.tenantsSection")}
        </h2>
        {tenantsLoading ? (
          <div className="h-32 bg-surface-muted rounded-xl animate-pulse" />
        ) : !tenants?.length ? (
          <p className="text-sm text-secondary">{t("admin.payments.emptyTenants")}</p>
        ) : (
          <TableContainer className="overflow-hidden rounded-xl border border-default bg-surface-elevated">
            <table className="min-w-[720px] w-full text-sm">
              <thead className="bg-surface text-left text-secondary">
                <tr>
                  <th className="px-4 py-3 font-medium">{t("auth.companyName")}</th>
                  <th className="px-4 py-3 font-medium">{t("common.email")}</th>
                  <th className="px-4 py-3 font-medium">{t("admin.users.plan")}</th>
                  <th className="px-4 py-3 font-medium">{t("admin.users.subscription")}</th>
                  <th className="px-4 py-3 font-medium">{t("admin.payments.provider")}</th>
                  <th className="px-4 py-3 font-medium">{t("admin.payments.stripeCustomer")}</th>
                  <th className="px-4 py-3 font-medium">{t("admin.payments.periodEnd")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {tenants.map((tenant) => (
                  <tr key={tenant.tenantId}>
                    <td className="px-4 py-3 text-primary">{tenant.name}</td>
                    <td className="px-4 py-3 text-secondary">{tenant.email}</td>
                    <td className="px-4 py-3 text-secondary">{tenant.plan}</td>
                    <td className="px-4 py-3 text-secondary">
                      {tenant.subscriptionStatus ?? "none"}
                    </td>
                    <td className="px-4 py-3 text-secondary">
                      {tenant.paymentProvider ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-secondary font-mono text-xs">
                      {tenant.stripeCustomerId?.slice(0, 16) ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-secondary">
                      {tenant.currentPeriodEnd
                        ? formatDate(tenant.currentPeriodEnd)
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableContainer>
        )}
      </section>

      <section>
        <h2 className="text-lg font-semibold text-primary mb-4">
          {t("admin.payments.paymentsSection")}
        </h2>
        {paymentsLoading ? (
          <div className="h-32 bg-surface-muted rounded-xl animate-pulse" />
        ) : !payments?.length ? (
          <p className="text-sm text-secondary">{t("admin.payments.emptyPayments")}</p>
        ) : (
          <TableContainer className="overflow-hidden rounded-xl border border-default bg-surface-elevated">
            <table className="min-w-[640px] w-full text-sm">
              <thead className="bg-surface text-left text-secondary">
                <tr>
                  <th className="px-4 py-3 font-medium">{t("admin.payments.reference")}</th>
                  <th className="px-4 py-3 font-medium">{t("admin.users.tenantId")}</th>
                  <th className="px-4 py-3 font-medium">{t("admin.users.plan")}</th>
                  <th className="px-4 py-3 font-medium">{t("admin.payments.amount")}</th>
                  <th className="px-4 py-3 font-medium">{t("common.status")}</th>
                  <th className="px-4 py-3 font-medium">{t("common.date")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {payments.map((payment) => (
                  <tr key={`${payment.tenantId}-${payment.reference}`}>
                    <td className="px-4 py-3 font-mono text-xs text-primary">
                      {payment.reference}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-secondary">
                      {payment.tenantId.slice(0, 8)}…
                    </td>
                    <td className="px-4 py-3 text-secondary">{payment.plan}</td>
                    <td className="px-4 py-3 text-secondary">
                      {formatCents(payment.amountInCents)}
                    </td>
                    <td className="px-4 py-3 text-secondary">{payment.status}</td>
                    <td className="px-4 py-3 text-secondary">{formatDate(payment.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableContainer>
        )}
      </section>
    </DashboardPage>
  );
}
