"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import {
  useAdminTenants,
  useAdminUpdateTenant,
  useResellerPlanDefaults,
  useUpdateResellerPlanDefaults,
  useActivateResellerDomain,
} from "@/hooks/useAdminTenants";
import {
  useAdminCognitoUsers,
  useAdminPlatformAdmins,
  useAdminUpdateCognitoUser,
} from "@/hooks/useAdminCognitoUsers";
import { useFormatters } from "@/hooks/useFormatters";
import { useT } from "@/i18n/context";
import type { CognitoUserSummary, ResellerPlanDefaults, Tenant, TenantPlan } from "@/types";
import { DashboardPage } from "@/components/layout/DashboardPage";
import { PageHeader } from "@/components/layout/PageHeader";
import { TableContainer } from "@/components/ui/TableContainer";
import { AdminTenantsTable } from "@/components/admin/AdminTenantsTable";

type Tab = "tenants" | "cognito" | "reseller";

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
      <td className="px-4 py-3 text-primary">
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
          className="rounded-lg border border-default px-2 py-1 text-sm"
        >
          <option value="member">{t("admin.users.roleMember")}</option>
          <option value="admin">{t("admin.users.roleAdmin")}</option>
        </select>
      </td>
      <td className="px-4 py-3">
        <input
          value={edits.tenantId}
          onChange={(e) => onEditsChange({ ...edits, tenantId: e.target.value })}
          className="w-full min-w-[12rem] rounded-lg border border-default px-2 py-1 text-sm"
        />
      </td>
      <td className="px-4 py-3 text-secondary">
        {user.enabled ? t("admin.users.enabled") : t("admin.users.disabled")}
      </td>
      <td className="px-4 py-3 text-secondary whitespace-nowrap">
        {user.createdAt ? formatDate(user.createdAt) : "—"}
      </td>
      <td className="px-4 py-3 pr-6">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onToggle}
            disabled={pending}
            className="text-xs px-2 py-1 rounded border border-default hover:bg-surface disabled:opacity-50"
          >
            {user.enabled ? t("admin.users.disable") : t("admin.users.enable")}
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={pending}
            className="text-xs px-2 py-1 rounded bg-accent text-white hover:bg-accent-hover disabled:opacity-50"
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
  const defaultsQuery = useResellerPlanDefaults();
  const updateDefaults = useUpdateResellerPlanDefaults();
  const activateDomain = useActivateResellerDomain();
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
  const [defaultsForm, setDefaultsForm] = useState<ResellerPlanDefaults | null>(null);
  const [defaultsSaved, setDefaultsSaved] = useState(false);

  useEffect(() => {
    if (defaultsQuery.data) setDefaultsForm(defaultsQuery.data);
  }, [defaultsQuery.data]);

  const platformAdmins =
    adminsQuery.data?.pages.flatMap((page) => page.users) ?? [];
  const cognitoUsers =
    cognitoQuery.data?.pages.flatMap((page) => page.users) ?? [];

  const adminEmails = new Set(
    platformAdmins.map((u) => u.email.toLowerCase()).filter(Boolean)
  );
  const adminTenantIds = new Set(
    platformAdmins.map((u) => u.tenantId).filter(Boolean)
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
    if (plan === "starter") return t("common.planStarter");
    if (plan === "pro") return t("common.planPro");
    if (plan === "scale" || (plan as string) === "enterprise") return t("common.planScale");
    if (plan === "reseller") return t("common.planReseller");
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
    updates: {
      plan?: TenantPlan;
      status?: "active" | "suspended";
      law2300Exempt?: boolean;
      resellerConfig?: Partial<Tenant["resellerConfig"]>;
    }
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

  async function handleSaveDefaults() {
    if (!defaultsForm) return;
    await updateDefaults.mutateAsync(defaultsForm);
    setDefaultsSaved(true);
    setTimeout(() => setDefaultsSaved(false), 2500);
  }

  const cognitoTableHeader = (
    <thead className="bg-surface text-left text-secondary">
      <tr>
        <th className="px-4 py-3 font-medium">{t("common.email")}</th>
        <th className="px-4 py-3 font-medium">{t("admin.users.role")}</th>
        <th className="px-4 py-3 font-medium">{t("admin.users.tenantId")}</th>
        <th className="px-4 py-3 font-medium">{t("common.status")}</th>
        <th className="px-4 py-3 font-medium">{t("common.date")}</th>
        <th className="px-4 py-3 pr-6 font-medium whitespace-nowrap">
          {t("admin.users.actions")}
        </th>
      </tr>
    </thead>
  );

  const resellerTenants = (tenants ?? []).filter((tenant) => tenant.plan === "reseller");

  return (
    <DashboardPage className="space-y-8 pb-8">
      <PageHeader title={t("admin.users.title")} subtitle={t("admin.users.subtitle")} />

      <section>
        <div className="mb-3">
          <h2 className="text-lg font-semibold text-primary">
            {t("admin.users.adminsSection")}
          </h2>
          <p className="text-sm text-secondary">{t("admin.users.adminsSectionHint")}</p>
        </div>
        {adminsQuery.isLoading ? (
          <div className="h-24 bg-surface-muted rounded-xl animate-pulse" />
        ) : !platformAdmins.length ? (
          <p className="text-sm text-secondary">{t("admin.users.emptyAdmins")}</p>
        ) : (
          <div className="space-y-4">
            <TableContainer className="rounded-xl border border-accent/30 bg-surface-elevated">
              <table className="min-w-full text-sm">
                {cognitoTableHeader}
                <tbody className="divide-y divide-default">
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
          </div>
        )}
      </section>

      <div className="flex gap-2">
        {(["tenants", "cognito", "reseller"] as Tab[]).map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium ${
              tab === id
                ? "bg-accent text-white"
                : "bg-surface-elevated border border-default text-secondary"
            }`}
          >
            {id === "tenants"
              ? t("admin.users.tabTenants")
              : id === "cognito"
                ? t("admin.users.tabCognito")
                : t("admin.users.tabReseller")}
          </button>
        ))}
      </div>

      {tab === "tenants" ? (
        <>
          <p className="text-sm text-secondary">{t("admin.users.planManualHint")}</p>
          <AdminTenantsTable
            tenants={tenants ?? []}
            isLoading={tenantsLoading}
            isUpdating={updateTenant.isPending}
            tenantFeedback={tenantFeedback}
            isTenantAlsoAdmin={isTenantAlsoAdmin}
            tenantPlanLabel={tenantPlanLabel}
            onTenantUpdate={handleTenantUpdate}
            formatDate={formatDate}
          />
        </>
      ) : tab === "reseller" ? (
        <div className="space-y-8">
          <section className="rounded-xl border border-default bg-surface-elevated p-6 space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-primary">
                {t("admin.users.resellerDefaultsTitle")}
              </h2>
              <p className="text-sm text-secondary">{t("admin.users.resellerDefaultsHint")}</p>
            </div>
            {defaultsForm ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="text-sm space-y-1">
                  <span className="text-secondary">{t("admin.users.maxSubaccounts")}</span>
                  <input
                    type="number"
                    min={1}
                    value={defaultsForm.maxSubaccounts}
                    onChange={(e) =>
                      setDefaultsForm({
                        ...defaultsForm,
                        maxSubaccounts: Number(e.target.value),
                      })
                    }
                    className="w-full rounded-lg border border-default px-3 py-2"
                  />
                </label>
                <label className="text-sm space-y-1">
                  <span className="text-secondary">{t("admin.users.defaultSubaccountPlan")}</span>
                  <select
                    value={defaultsForm.defaultSubaccountPlan}
                    onChange={(e) =>
                      setDefaultsForm({
                        ...defaultsForm,
                        defaultSubaccountPlan: e.target.value as "free" | "starter" | "pro",
                      })
                    }
                    className="w-full rounded-lg border border-default px-3 py-2"
                  >
                    <option value="free">{t("common.planFree")}</option>
                    <option value="starter">{t("common.planStarter")}</option>
                    <option value="pro">{t("common.planPro")}</option>
                  </select>
                </label>
                <label className="flex items-center gap-2 text-sm text-secondary sm:col-span-2">
                  <input
                    type="checkbox"
                    checked={defaultsForm.allowSubaccountBranding}
                    onChange={(e) =>
                      setDefaultsForm({
                        ...defaultsForm,
                        allowSubaccountBranding: e.target.checked,
                      })
                    }
                  />
                  {t("admin.users.allowSubaccountBranding")}
                </label>
                <div className="sm:col-span-2 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => void handleSaveDefaults()}
                    disabled={updateDefaults.isPending}
                    className="rounded-lg bg-accent px-4 py-2 text-sm text-white hover:bg-accent-hover disabled:opacity-50"
                  >
                    {t("admin.users.saveDefaults")}
                  </button>
                  {defaultsSaved && (
                    <span className="text-sm text-green-600">{t("admin.users.defaultsSaved")}</span>
                  )}
                </div>
              </div>
            ) : (
              <div className="h-24 animate-pulse rounded bg-surface-muted" />
            )}
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-primary">{t("admin.users.resellerConfig")}</h2>
            {!resellerTenants.length ? (
              <p className="text-sm text-secondary">{t("admin.users.emptyTenants")}</p>
            ) : (
              <TableContainer className="rounded-xl border border-default bg-surface-elevated">
                <table className="min-w-full text-sm">
                  <thead className="bg-surface text-left text-secondary">
                    <tr>
                      <th className="px-4 py-3 font-medium">{t("auth.companyName")}</th>
                      <th className="px-4 py-3 font-medium">{t("admin.users.maxSubaccounts")}</th>
                      <th className="px-4 py-3 font-medium">{t("admin.users.customDomain")}</th>
                      <th className="px-4 py-3 font-medium">{t("common.status")}</th>
                      <th className="px-4 py-3 pr-6 font-medium" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-default">
                    {resellerTenants.map((tenant) => (
                      <tr key={tenant.tenantId}>
                        <td className="px-4 py-3 text-primary">{tenant.name}</td>
                        <td className="px-4 py-3">
                          <input
                            type="number"
                            min={1}
                            defaultValue={tenant.resellerConfig?.maxSubaccounts ?? 25}
                            onBlur={(e) =>
                              void handleTenantUpdate(tenant, {
                                resellerConfig: {
                                  maxSubaccounts: Number(e.target.value),
                                },
                              })
                            }
                            className="w-24 rounded-lg border border-default px-2 py-1"
                          />
                        </td>
                        <td className="px-4 py-3 text-secondary">
                          {tenant.resellerConfig?.customDomain ?? "—"}
                        </td>
                        <td className="px-4 py-3 text-secondary">
                          {tenant.resellerConfig?.customDomainStatus ?? "none"}
                        </td>
                        <td className="px-4 py-3 pr-6">
                          {tenant.resellerConfig?.customDomain &&
                            tenant.resellerConfig.customDomainStatus !== "active" && (
                              <button
                                type="button"
                                disabled={activateDomain.isPending}
                                onClick={() =>
                                  void activateDomain.mutateAsync({
                                    tenantId: tenant.tenantId,
                                    status: "active",
                                  })
                                }
                                className="text-xs px-2 py-1 rounded bg-accent text-white disabled:opacity-50"
                              >
                                {t("admin.users.activateDomain")}
                              </button>
                            )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableContainer>
            )}
          </section>
        </div>
      ) : cognitoQuery.isLoading ? (
        <div className="h-40 bg-surface-muted rounded-xl animate-pulse" />
      ) : !cognitoUsers.length ? (
        <p className="text-sm text-secondary">{t("admin.users.emptyCognito")}</p>
      ) : (
        <div className="space-y-4">
          <TableContainer className="rounded-xl border border-default bg-surface-elevated">
            <table className="min-w-full text-sm">
              {cognitoTableHeader}
              <tbody className="divide-y divide-default">
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
        </div>
      )}
    </DashboardPage>
  );
}
