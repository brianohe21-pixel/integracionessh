"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { useAdminTenants, useAdminUpdateTenant } from "@/hooks/useAdminTenants";
import {
  useAdminCognitoUsers,
  useAdminPlatformAdmins,
  useAdminUpdateCognitoUser,
} from "@/hooks/useAdminCognitoUsers";
import { useFormatters } from "@/hooks/useFormatters";
import { useT } from "@/i18n/context";
import type { CognitoUserSummary, Tenant, TenantPlan } from "@/types";
import { DashboardPage } from "@/components/layout/DashboardPage";
import { PageHeader } from "@/components/layout/PageHeader";
import { TableContainer } from "@/components/ui/TableContainer";

type Tab = "tenants" | "cognito";

function CognitoUserActions({
  user,
  edits,
  onEditsChange,
  onToggle,
  onSave,
  pending,
  t,
  formatDate,
}: {
  user: CognitoUserSummary;
  edits: { tenantId: string; role: "admin" | "member" };
  onEditsChange: (edits: { tenantId: string; role: "admin" | "member" }) => void;
  onToggle: () => void;
  onSave: () => void;
  pending: boolean;
  t: ReturnType<typeof useT>;
  formatDate: (value: string) => string;
}) {
  return (
    <tr>
      <td className="px-4 py-3 text-gray-900">
        <div className="flex items-center gap-2">
          <span>{user.email || user.username}</span>
          {user.role === "admin" && (
            <Badge variant="info">{t("admin.users.roleAdmin")}</Badge>
          )}
        </div>
      </td>
      <td className="px-4 py-3">
        <select
          value={edits.role}
          onChange={(e) =>
            onEditsChange({
              ...edits,
              role: e.target.value as "admin" | "member",
            })
          }
          className="rounded-lg border border-gray-300 px-2 py-1 text-sm"
        >
          <option value="member">{t("admin.users.roleMember")}</option>
          <option value="admin">{t("admin.users.roleAdmin")}</option>
        </select>
      </td>
      <td className="px-4 py-3">
        <input
          value={edits.tenantId}
          onChange={(e) => onEditsChange({ ...edits, tenantId: e.target.value })}
          className="w-full min-w-[12rem] rounded-lg border border-gray-300 px-2 py-1 text-sm"
        />
      </td>
      <td className="px-4 py-3 text-gray-600">
        {user.enabled ? t("admin.users.enabled") : t("admin.users.disabled")}
      </td>
      <td className="px-4 py-3 text-gray-500">
        {user.createdAt ? formatDate(user.createdAt) : "—"}
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onToggle}
            disabled={pending}
            className="text-xs px-2 py-1 rounded border border-gray-300 hover:bg-gray-50 disabled:opacity-50"
          >
            {user.enabled ? t("admin.users.disable") : t("admin.users.enable")}
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={pending}
            className="text-xs px-2 py-1 rounded bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {t("admin.users.save")}
          </button>
        </div>
      </td>
    </tr>
  );
}

export default function AdminUsersPage() {
  const t = useT();
  const { formatDate } = useFormatters();
  const [tab, setTab] = useState<Tab>("tenants");
  const { data: tenants, isLoading: tenantsLoading } = useAdminTenants();
  const updateTenant = useAdminUpdateTenant();
  const adminsQuery = useAdminPlatformAdmins();
  const cognitoQuery = useAdminCognitoUsers();
  const updateCognito = useAdminUpdateCognitoUser();
  const [cognitoEdits, setCognitoEdits] = useState<
    Record<string, { tenantId: string; role: "admin" | "member" }>
  >({});
  const [tenantFeedback, setTenantFeedback] = useState<{
    tenantId: string;
    type: "success" | "error";
  } | null>(null);

  const platformAdmins =
    adminsQuery.data?.pages.flatMap((page) => page.users) ?? [];

  const cognitoUsers =
    cognitoQuery.data?.pages.flatMap((page) => page.users) ?? [];

  const adminEmails = useMemo(
    () => new Set(platformAdmins.map((u) => u.email.toLowerCase()).filter(Boolean)),
    [platformAdmins]
  );

  const adminTenantIds = useMemo(
    () => new Set(platformAdmins.map((u) => u.tenantId).filter(Boolean)),
    [platformAdmins]
  );

  function getCognitoEdits(user: CognitoUserSummary) {
    return (
      cognitoEdits[user.username] ?? {
        tenantId: user.tenantId,
        role: (user.role === "admin" ? "admin" : "member") as "admin" | "member",
      }
    );
  }

  function tenantPlanLabel(plan: TenantPlan) {
    if (plan === "pro") return t("common.planPro");
    if (plan === "enterprise") return t("common.planEnterprise");
    return t("common.planFree");
  }

  function isTenantAlsoAdmin(tenant: Tenant) {
    return (
      adminEmails.has(tenant.email.toLowerCase()) ||
      adminTenantIds.has(tenant.tenantId)
    );
  }

  async function handleTenantUpdate(
    tenant: Tenant,
    updates: { plan?: TenantPlan; status?: "active" | "suspended" }
  ) {
    try {
      await updateTenant.mutateAsync({ tenantId: tenant.tenantId, ...updates });
      if (updates.plan !== undefined) {
        setTenantFeedback({ tenantId: tenant.tenantId, type: "success" });
      }
    } catch {
      if (updates.plan !== undefined) {
        setTenantFeedback({ tenantId: tenant.tenantId, type: "error" });
      }
    }
  }

  async function handleCognitoToggle(user: CognitoUserSummary) {
    await updateCognito.mutateAsync({
      username: user.username,
      enabled: !user.enabled,
    });
  }

  async function handleCognitoSave(user: CognitoUserSummary) {
    const edits = cognitoEdits[user.username];
    if (!edits) return;
    await updateCognito.mutateAsync({
      username: user.username,
      tenantId: edits.tenantId,
      role: edits.role,
    });
  }

  const cognitoTableHeader = (
    <thead className="bg-gray-50 text-left text-gray-500">
      <tr>
        <th className="px-4 py-3 font-medium">{t("common.email")}</th>
        <th className="px-4 py-3 font-medium">{t("admin.users.role")}</th>
        <th className="px-4 py-3 font-medium">{t("admin.users.tenantId")}</th>
        <th className="px-4 py-3 font-medium">{t("common.status")}</th>
        <th className="px-4 py-3 font-medium">{t("common.date")}</th>
        <th className="px-4 py-3 font-medium" />
      </tr>
    </thead>
  );

  return (
    <DashboardPage maxWidth="6xl" className="space-y-8">
      <PageHeader title={t("admin.users.title")} subtitle={t("admin.users.subtitle")} />

      <section>
        <div className="mb-3">
          <h2 className="text-lg font-semibold text-gray-900">
            {t("admin.users.adminsSection")}
          </h2>
          <p className="text-sm text-gray-500">{t("admin.users.adminsSectionHint")}</p>
        </div>
        {adminsQuery.isLoading ? (
          <div className="h-24 bg-gray-100 rounded-xl animate-pulse" />
        ) : !platformAdmins.length ? (
          <p className="text-sm text-gray-500">{t("admin.users.emptyAdmins")}</p>
        ) : (
          <div className="space-y-4">
            <TableContainer className="rounded-xl border border-indigo-200 bg-white">
              <table className="min-w-full text-sm">
                {cognitoTableHeader}
                <tbody className="divide-y divide-gray-100">
                  {platformAdmins.map((user) => (
                    <CognitoUserActions
                      key={`admin-${user.username}`}
                      user={user}
                      edits={getCognitoEdits(user)}
                      onEditsChange={(edits) =>
                        setCognitoEdits((prev) => ({ ...prev, [user.username]: edits }))
                      }
                      onToggle={() => void handleCognitoToggle(user)}
                      onSave={() => void handleCognitoSave(user)}
                      pending={updateCognito.isPending}
                      t={t}
                      formatDate={formatDate}
                    />
                  ))}
                </tbody>
              </table>
            </TableContainer>
            {adminsQuery.hasNextPage && (
              <button
                type="button"
                onClick={() => void adminsQuery.fetchNextPage()}
                disabled={adminsQuery.isFetchingNextPage}
                className="text-sm px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                {t("admin.users.loadMore")}
              </button>
            )}
          </div>
        )}
      </section>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setTab("tenants")}
          className={`px-4 py-2 rounded-lg text-sm font-medium ${
            tab === "tenants"
              ? "bg-indigo-600 text-white"
              : "bg-white border border-gray-200 text-gray-700"
          }`}
        >
          {t("admin.users.tabTenants")}
        </button>
        <button
          type="button"
          onClick={() => setTab("cognito")}
          className={`px-4 py-2 rounded-lg text-sm font-medium ${
            tab === "cognito"
              ? "bg-indigo-600 text-white"
              : "bg-white border border-gray-200 text-gray-700"
          }`}
        >
          {t("admin.users.tabCognito")}
        </button>
      </div>

      {tab === "tenants" ? (
        <>
        <p className="text-sm text-gray-500">{t("admin.users.planManualHint")}</p>
        {tenantsLoading ? (
          <div className="h-40 bg-gray-100 rounded-xl animate-pulse" />
        ) : !tenants?.length ? (
          <p className="text-sm text-gray-500">{t("admin.users.emptyTenants")}</p>
        ) : (
          <TableContainer className="rounded-xl border border-gray-200 bg-white">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-left text-gray-500">
                <tr>
                  <th className="px-4 py-3 font-medium">{t("auth.companyName")}</th>
                  <th className="px-4 py-3 font-medium">{t("common.email")}</th>
                  <th className="px-4 py-3 font-medium">{t("admin.users.role")}</th>
                  <th className="px-4 py-3 font-medium">{t("admin.users.plan")}</th>
                  <th className="px-4 py-3 font-medium">{t("admin.users.tenantStatus")}</th>
                  <th className="px-4 py-3 font-medium">{t("admin.users.subscription")}</th>
                  <th className="px-4 py-3 font-medium">{t("admin.users.periodEnd")}</th>
                  <th className="px-4 py-3 font-medium">{t("common.date")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {tenants.map((tenant) => (
                  <tr key={tenant.tenantId}>
                    <td className="px-4 py-3 text-gray-900">{tenant.name}</td>
                    <td className="px-4 py-3 text-gray-600">{tenant.email}</td>
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
                          disabled={updateTenant.isPending}
                          onChange={(e) =>
                            void handleTenantUpdate(tenant, {
                              plan: e.target.value as TenantPlan,
                            })
                          }
                          className="rounded-lg border border-gray-300 px-2 py-1 text-sm"
                        >
                          <option value="free">{t("common.planFree")}</option>
                          <option value="pro">{t("common.planPro")}</option>
                          <option value="enterprise">{t("common.planEnterprise")}</option>
                        </select>
                        {tenantFeedback?.tenantId === tenant.tenantId && (
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
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={tenant.status}
                        disabled={updateTenant.isPending}
                        onChange={(e) =>
                          void handleTenantUpdate(tenant, {
                            status: e.target.value as "active" | "suspended",
                          })
                        }
                        className="rounded-lg border border-gray-300 px-2 py-1 text-sm"
                      >
                        <option value="active">{t("common.active")}</option>
                        <option value="suspended">{t("common.suspended")}</option>
                      </select>
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {tenant.subscriptionStatus
                        ? t(`billing.subscriptionStatus.${tenant.subscriptionStatus}`)
                        : "—"}
                      <span className="block text-xs text-gray-400">
                        {tenantPlanLabel(tenant.plan)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {tenant.currentPeriodEnd
                        ? formatDate(tenant.currentPeriodEnd)
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-gray-500">{formatDate(tenant.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableContainer>
        )}
        </>
      ) : cognitoQuery.isLoading ? (
        <div className="h-40 bg-gray-100 rounded-xl animate-pulse" />
      ) : !cognitoUsers.length ? (
        <p className="text-sm text-gray-500">{t("admin.users.emptyCognito")}</p>
      ) : (
        <div className="space-y-4">
          <TableContainer className="rounded-xl border border-gray-200 bg-white">
            <table className="min-w-full text-sm">
              {cognitoTableHeader}
              <tbody className="divide-y divide-gray-100">
                {cognitoUsers.map((user) => (
                  <CognitoUserActions
                    key={user.username}
                    user={user}
                    edits={getCognitoEdits(user)}
                    onEditsChange={(edits) =>
                      setCognitoEdits((prev) => ({ ...prev, [user.username]: edits }))
                    }
                    onToggle={() => void handleCognitoToggle(user)}
                    onSave={() => void handleCognitoSave(user)}
                    pending={updateCognito.isPending}
                    t={t}
                    formatDate={formatDate}
                  />
                ))}
              </tbody>
              </table>
            </TableContainer>
          {cognitoQuery.hasNextPage && (
            <button
              type="button"
              onClick={() => void cognitoQuery.fetchNextPage()}
              disabled={cognitoQuery.isFetchingNextPage}
              className="text-sm px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              {t("admin.users.loadMore")}
            </button>
          )}
        </div>
      )}
    </DashboardPage>
  );
}
