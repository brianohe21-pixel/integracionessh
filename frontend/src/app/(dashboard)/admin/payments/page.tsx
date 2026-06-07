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
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          {t("admin.payments.tenantsSection")}
        </h2>
        {tenantsLoading ? (
          <div className="h-32 bg-gray-100 rounded-xl animate-pulse" />
        ) : !tenants?.length ? (
          <p className="text-sm text-gray-500">{t("admin.payments.emptyTenants")}</p>
        ) : (
          <TableContainer className="overflow-hidden rounded-xl border border-gray-200 bg-white">
            <table className="min-w-[720px] w-full text-sm">
              <thead className="bg-gray-50 text-left text-gray-500">
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
                    <td className="px-4 py-3 text-gray-900">{tenant.name}</td>
                    <td className="px-4 py-3 text-gray-600">{tenant.email}</td>
                    <td className="px-4 py-3 text-gray-600">{tenant.plan}</td>
                    <td className="px-4 py-3 text-gray-600">
                      {tenant.subscriptionStatus ?? "none"}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {tenant.paymentProvider ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-gray-500 font-mono text-xs">
                      {tenant.stripeCustomerId?.slice(0, 16) ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-gray-500">
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
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          {t("admin.payments.paymentsSection")}
        </h2>
        {paymentsLoading ? (
          <div className="h-32 bg-gray-100 rounded-xl animate-pulse" />
        ) : !payments?.length ? (
          <p className="text-sm text-gray-500">{t("admin.payments.emptyPayments")}</p>
        ) : (
          <TableContainer className="overflow-hidden rounded-xl border border-gray-200 bg-white">
            <table className="min-w-[640px] w-full text-sm">
              <thead className="bg-gray-50 text-left text-gray-500">
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
                    <td className="px-4 py-3 font-mono text-xs text-gray-900">
                      {payment.reference}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-600">
                      {payment.tenantId.slice(0, 8)}…
                    </td>
                    <td className="px-4 py-3 text-gray-600">{payment.plan}</td>
                    <td className="px-4 py-3 text-gray-600">
                      {formatCents(payment.amountInCents)}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{payment.status}</td>
                    <td className="px-4 py-3 text-gray-500">{formatDate(payment.createdAt)}</td>
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
