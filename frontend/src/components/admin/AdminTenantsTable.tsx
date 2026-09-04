"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { SearchInput } from "@/components/ui/SearchInput";
import { TableContainer } from "@/components/ui/TableContainer";
import { useT } from "@/i18n/context";
import type { Tenant, TenantPlan } from "@/types";

const PAGE_SIZE = 20;

type PlanFilter = "" | TenantPlan;
type StatusFilter = "" | Tenant["status"];
type RoleFilter = "" | "admin" | "member";

interface AdminTenantsTableProps {
  tenants: Tenant[];
  isLoading: boolean;
  isUpdating: boolean;
  tenantFeedback: { tenantId: string; type: "success" | "error" } | null;
  isTenantAlsoAdmin: (tenant: Tenant) => boolean;
  tenantPlanLabel: (plan: TenantPlan) => string;
  onTenantUpdate: (
    tenant: Tenant,
    updates: {
      plan?: TenantPlan;
      status?: "active" | "suspended";
      law2300Exempt?: boolean;
    }
  ) => Promise<void>;
  formatDate: (iso: string) => string;
}

export function AdminTenantsTable({
  tenants,
  isLoading,
  isUpdating,
  tenantFeedback,
  isTenantAlsoAdmin,
  tenantPlanLabel,
  onTenantUpdate,
  formatDate,
}: AdminTenantsTableProps) {
  const t = useT();
  const [query, setQuery] = useState("");
  const [planFilter, setPlanFilter] = useState<PlanFilter>("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPage(1);
  }, [query, planFilter, statusFilter, roleFilter]);

  const filteredTenants = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return [...tenants]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .filter((tenant) => {
        if (planFilter && tenant.plan !== planFilter) return false;
        if (statusFilter && tenant.status !== statusFilter) return false;

        const isAdmin = isTenantAlsoAdmin(tenant);
        if (roleFilter === "admin" && !isAdmin) return false;
        if (roleFilter === "member" && isAdmin) return false;

        if (!normalizedQuery) return true;

        return (
          tenant.name.toLowerCase().includes(normalizedQuery) ||
          tenant.email.toLowerCase().includes(normalizedQuery) ||
          tenant.tenantId.toLowerCase().includes(normalizedQuery)
        );
      });
  }, [tenants, query, planFilter, statusFilter, roleFilter, isTenantAlsoAdmin]);

  const totalPages = Math.max(1, Math.ceil(filteredTenants.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageStart = filteredTenants.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const pageEnd = Math.min(safePage * PAGE_SIZE, filteredTenants.length);
  const paginatedTenants = filteredTenants.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE
  );

  if (isLoading) {
    return <div className="h-40 animate-pulse rounded-xl bg-surface-muted" />;
  }

  if (!tenants.length) {
    return <p className="text-sm text-secondary">{t("admin.users.emptyTenants")}</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
        <SearchInput
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onClear={() => setQuery("")}
          placeholder={t("admin.users.searchTenantsPlaceholder")}
          className="w-full xl:max-w-md"
        />
        <div className="flex flex-wrap gap-2">
          <select
            value={planFilter}
            onChange={(event) => setPlanFilter(event.target.value as PlanFilter)}
            className="rounded-lg border border-default bg-surface-elevated px-3 py-2 text-sm"
          >
            <option value="">{t("admin.users.filterPlanAll")}</option>
            <option value="free">{t("common.planFree")}</option>
            <option value="starter">{t("common.planStarter")}</option>
            <option value="pro">{t("common.planPro")}</option>
            <option value="scale">{t("common.planScale")}</option>
            <option value="reseller">{t("common.planReseller")}</option>
          </select>
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
            className="rounded-lg border border-default bg-surface-elevated px-3 py-2 text-sm"
          >
            <option value="">{t("admin.users.filterStatusAll")}</option>
            <option value="active">{t("common.active")}</option>
            <option value="suspended">{t("common.suspended")}</option>
          </select>
          <select
            value={roleFilter}
            onChange={(event) => setRoleFilter(event.target.value as RoleFilter)}
            className="rounded-lg border border-default bg-surface-elevated px-3 py-2 text-sm"
          >
            <option value="">{t("admin.users.filterRoleAll")}</option>
            <option value="admin">{t("admin.users.roleAdmin")}</option>
            <option value="member">{t("admin.users.roleMember")}</option>
          </select>
        </div>
      </div>

      {filteredTenants.length === 0 ? (
        <p className="text-sm text-secondary">{t("admin.users.noTenantsMatch")}</p>
      ) : (
        <>
          <TableContainer className="rounded-xl border border-default bg-surface-elevated">
            <table className="min-w-full text-sm">
              <thead className="bg-surface text-left text-secondary">
                <tr>
                  <th className="px-4 py-3 font-medium">{t("auth.companyName")}</th>
                  <th className="px-4 py-3 font-medium">{t("common.email")}</th>
                  <th className="px-4 py-3 font-medium">{t("admin.users.role")}</th>
                  <th className="px-4 py-3 font-medium">{t("admin.users.plan")}</th>
                  <th className="px-4 py-3 font-medium">{t("admin.users.tenantStatus")}</th>
                  <th className="px-4 py-3 font-medium">{t("admin.users.subscription")}</th>
                  <th className="px-4 py-3 font-medium">{t("admin.users.law2300")}</th>
                  <th className="px-4 py-3 font-medium">{t("admin.users.periodEnd")}</th>
                  <th className="px-4 py-3 pr-6 font-medium whitespace-nowrap">
                    {t("common.date")}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-default">
                {paginatedTenants.map((tenant) => (
                  <tr key={tenant.tenantId}>
                    <td className="px-4 py-3 text-primary">{tenant.name}</td>
                    <td className="px-4 py-3 text-secondary">{tenant.email}</td>
                    <td className="px-4 py-3">
                      {isTenantAlsoAdmin(tenant) ? (
                        <Badge variant="info">{t("admin.users.roleAdmin")}</Badge>
                      ) : (
                        <Badge variant="default">{t("admin.users.roleMember")}</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="space-y-1">
                        <select
                          value={tenant.plan}
                          disabled={isUpdating}
                          onChange={(event) =>
                            void onTenantUpdate(tenant, {
                              plan: event.target.value as TenantPlan,
                            })
                          }
                          className="rounded-lg border border-default px-2 py-1 text-sm"
                        >
                          <option value="free">{t("common.planFree")}</option>
                          <option value="starter">{t("common.planStarter")}</option>
                          <option value="pro">{t("common.planPro")}</option>
                          <option value="scale">{t("common.planScale")}</option>
                          <option value="reseller">{t("common.planReseller")}</option>
                        </select>
                        {tenantFeedback?.tenantId === tenant.tenantId ? (
                          <p
                            className={`text-xs ${
                              tenantFeedback.type === "success"
                                ? "text-green-600"
                                : "text-red-600"
                            }`}
                          >
                            {tenantFeedback.type === "success"
                              ? t("admin.users.planUpdated")
                              : t("admin.users.planUpdateError")}
                          </p>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={tenant.status}
                        disabled={isUpdating}
                        onChange={(event) =>
                          void onTenantUpdate(tenant, {
                            status: event.target.value as "active" | "suspended",
                          })
                        }
                        className="rounded-lg border border-default px-2 py-1 text-sm"
                      >
                        <option value="active">{t("common.active")}</option>
                        <option value="suspended">{t("common.suspended")}</option>
                      </select>
                    </td>
                    <td className="px-4 py-3 text-secondary">
                      {tenant.subscriptionStatus
                        ? t(`billing.subscriptionStatus.${tenant.subscriptionStatus}`)
                        : "—"}
                      <span className="block text-xs text-muted">
                        {tenantPlanLabel(tenant.plan)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <label className="inline-flex items-center gap-2 text-sm text-secondary">
                        <input
                          type="checkbox"
                          checked={tenant.law2300Exempt ?? false}
                          disabled={isUpdating}
                          onChange={(event) =>
                            void onTenantUpdate(tenant, {
                              law2300Exempt: event.target.checked,
                            })
                          }
                          className="rounded border-default"
                        />
                        <span>{t("admin.users.law2300Exempt")}</span>
                      </label>
                    </td>
                    <td className="px-4 py-3 text-secondary whitespace-nowrap">
                      {tenant.currentPeriodEnd ? formatDate(tenant.currentPeriodEnd) : "—"}
                    </td>
                    <td className="px-4 py-3 pr-6 text-secondary whitespace-nowrap">
                      {formatDate(tenant.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableContainer>

          <div className="flex flex-col gap-3 border-t border-default pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-secondary">
              {t("campaigns.showingRange", {
                from: pageStart,
                to: pageEnd,
                total: filteredTenants.length,
              })}
            </p>
            {totalPages > 1 ? (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                  disabled={safePage <= 1}
                  className="inline-flex items-center gap-1 rounded-lg border border-default px-3 py-1.5 text-sm text-primary transition-colors hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <ChevronLeft className="h-4 w-4" />
                  {t("campaigns.previousPage")}
                </button>
                <span className="px-2 text-sm text-secondary">
                  {t("campaigns.pageOf", { page: safePage, total: totalPages })}
                </span>
                <button
                  type="button"
                  onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                  disabled={safePage >= totalPages}
                  className="inline-flex items-center gap-1 rounded-lg border border-default px-3 py-1.5 text-sm text-primary transition-colors hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {t("campaigns.nextPage")}
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            ) : null}
          </div>
        </>
      )}
    </div>
  );
}
