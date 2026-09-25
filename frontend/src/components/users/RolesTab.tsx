"use client";

import { useMemo, useState } from "react";
import { Check, Plus, Shield } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/Input";
import { SideDrawer } from "@/components/ui/SideDrawer";
import { useDialog } from "@/components/ui/DialogProvider";
import {
  useCreateCustomRole,
  useCustomRoles,
  useDeleteCustomRole,
  usePermissions,
  useUpdateCustomRole,
  type CustomRole,
} from "@/hooks/usePermissions";
import { useTenantRole } from "@/hooks/useTenantRole";
import { useT } from "@/i18n/context";
import { cn } from "@/lib/utils";
import {
  PERMISSIONS,
  PERMISSION_MODULES,
  permissionAction,
  permissionModule,
  type Permission,
} from "@/lib/permissions";

export function RolesTab() {
  const t = useT();
  const { confirm } = useDialog();
  const { isMember } = useTenantRole();
  const { catalog, presets } = usePermissions();
  const { data, isLoading } = useCustomRoles();
  const createRole = useCreateCustomRole();
  const updateRole = useUpdateCustomRole();
  const deleteRole = useDeleteCustomRole();

  const [editing, setEditing] = useState<CustomRole | null>(null);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [saveError, setSaveError] = useState<string | null>(null);

  const permissions = catalog.length > 0 ? catalog : [...PERMISSIONS];
  const grouped = useMemo(() => {
    return PERMISSION_MODULES.map((module) => ({
      module,
      items: permissions.filter((permission) => permissionModule(permission) === module),
    })).filter((group) => group.items.length > 0);
  }, [permissions]);

  function openCreate() {
    setEditing(null);
    setCreating(true);
    setName("");
    setSelected([]);
    setSaveError(null);
  }

  function openEdit(role: CustomRole) {
    setCreating(false);
    setEditing(role);
    setName(role.name);
    setSelected(role.permissions);
    setSaveError(null);
  }

  function closeDrawer() {
    setCreating(false);
    setEditing(null);
    setSaveError(null);
  }

  function togglePermission(permission: string) {
    setSelected((current) =>
      current.includes(permission)
        ? current.filter((item) => item !== permission)
        : [...current, permission]
    );
  }

  function setModulePermissions(moduleItems: string[], enabled: boolean) {
    setSelected((current) => {
      const without = current.filter((item) => !moduleItems.includes(item));
      return enabled ? [...without, ...moduleItems] : without;
    });
  }

  async function saveRole() {
    if (!name.trim()) return;
    setSaveError(null);
    try {
      if (editing) {
        await updateRole.mutateAsync({
          roleId: editing.roleId,
          body: { name: name.trim(), permissions: selected },
        });
      } else {
        await createRole.mutateAsync({ name: name.trim(), permissions: selected });
      }
      closeDrawer();
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : t("userCenter.roleSaveError"));
    }
  }

  async function removeRole(role: CustomRole) {
    const accepted = await confirm({
      title: t("userCenter.confirmDeleteRoleTitle"),
      description: t("userCenter.confirmDeleteRole", { name: role.name }),
      confirmLabel: t("common.delete"),
      tone: "danger",
    });
    if (!accepted) return;
    await deleteRole.mutateAsync(role.roleId);
  }

  const drawerOpen = creating || editing !== null;
  const roles = data?.roles ?? [];
  const saving = createRole.isPending || updateRole.isPending;
  const canSave = name.trim().length > 0 && !saving;

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-default bg-surface-elevated p-5">
        <h2 className="text-sm font-semibold text-primary">{t("userCenter.presetRoles")}</h2>
        <p className="mt-1 text-sm text-secondary">{t("userCenter.presetRolesHint")}</p>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {(["member", "supervisor", "advisor"] as const).map((role) => (
            <div key={role} className="rounded-lg border border-default bg-surface p-3">
              <p className="text-sm font-medium text-primary">
                {role === "member"
                  ? t("nav.roleAdministrator")
                  : role === "supervisor"
                    ? t("nav.roleSupervisor")
                    : t("nav.roleAdvisor")}
              </p>
              <p className="mt-2 text-xs text-secondary">
                {(presets?.[role] ?? []).length === 0
                  ? t("userCenter.noModuleAccess")
                  : t("userCenter.permissionCount", { count: presets?.[role].length ?? 0 })}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-primary">{t("userCenter.customRoles")}</h2>
            <p className="mt-0.5 text-sm text-secondary">{t("userCenter.customRolesHint")}</p>
          </div>
          {isMember && roles.length > 0 ? (
            <Button type="button" size="sm" onClick={openCreate}>
              <Plus className="h-4 w-4" />
              {t("userCenter.createRole")}
            </Button>
          ) : null}
        </div>
        {isLoading ? <p className="text-sm text-muted">{t("common.loading")}</p> : null}
        {data && "error" in data && data.error ? (
          <p className="text-sm text-danger">{t("userCenter.rolesLoadError")}</p>
        ) : null}
        {!isLoading && roles.length === 0 && !(data && "error" in data && data.error) ? (
          <EmptyState
            icon={<Shield className="h-6 w-6" />}
            title={t("userCenter.customRolesEmptyTitle")}
            description={t("userCenter.customRolesEmpty")}
            action={
              isMember ? (
                <Button type="button" onClick={openCreate}>
                  <Plus className="h-4 w-4" />
                  {t("userCenter.createRole")}
                </Button>
              ) : undefined
            }
            className="py-12"
          />
        ) : null}
        <div className="space-y-2">
          {roles.map((role) => (
            <div
              key={role.roleId}
              className="flex items-center justify-between gap-3 rounded-xl border border-default bg-surface-elevated px-4 py-3"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-primary">{role.name}</p>
                <div className="mt-1.5">
                  <Badge variant={role.permissions.length > 0 ? "accent" : "default"}>
                    {t("userCenter.permissionCount", { count: role.permissions.length })}
                  </Badge>
                </div>
              </div>
              {isMember ? (
                <div className="flex shrink-0 gap-2">
                  <Button type="button" variant="ghost" size="sm" onClick={() => openEdit(role)}>
                    {t("common.edit")}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => void removeRole(role)}
                  >
                    {t("common.delete")}
                  </Button>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </section>

      {drawerOpen ? (
        <SideDrawer
          title={editing ? t("userCenter.editRole") : t("userCenter.createRole")}
          onClose={closeDrawer}
          widthClass="max-w-xl"
          footer={
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-secondary">
                {t("userCenter.permissionCount", { count: selected.length })}
              </p>
              <div className="flex gap-2">
                <Button type="button" variant="ghost" onClick={closeDrawer} disabled={saving}>
                  {t("common.cancel")}
                </Button>
                <Button type="button" onClick={() => void saveRole()} disabled={!canSave}>
                  {saving
                    ? t("common.loading")
                    : editing
                      ? t("common.save")
                      : t("userCenter.createRole")}
                </Button>
              </div>
            </div>
          }
        >
          <div className="space-y-5 p-5">
            <div>
              <label htmlFor="role-name" className="mb-1.5 block text-sm font-medium text-secondary">
                {t("userCenter.roleNameLabel")}
              </label>
              <Input
                id="role-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder={t("userCenter.roleNamePlaceholder")}
                autoFocus
                maxLength={64}
              />
              <p className="mt-1.5 text-xs text-muted">{t("userCenter.roleNameHint")}</p>
            </div>

            <div className="space-y-3">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-secondary">
                    {t("userCenter.permissionsLabel")}
                  </p>
                  <p className="mt-0.5 text-xs text-muted">{t("userCenter.permissionsHint")}</p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelected([...permissions])}
                  >
                    {t("userCenter.selectAllPermissions")}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelected([])}
                    disabled={selected.length === 0}
                  >
                    {t("userCenter.clearPermissions")}
                  </Button>
                </div>
              </div>

              {grouped.map((group) => {
                const selectedInModule = group.items.filter((item) => selected.includes(item)).length;
                const allSelected = selectedInModule === group.items.length;

                return (
                  <div
                    key={group.module}
                    className="overflow-hidden rounded-xl border border-default bg-surface"
                  >
                    <div className="flex items-center justify-between gap-3 border-b border-default bg-surface-muted/60 px-3 py-2.5">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-primary">
                          {t(`permissions.modules.${group.module}`)}
                        </p>
                        <p className="text-xs text-muted">
                          {t("userCenter.modulePermissionCount", {
                            selected: selectedInModule,
                            total: group.items.length,
                          })}
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setModulePermissions(group.items, !allSelected)}
                      >
                        {allSelected ? t("userCenter.clearModule") : t("userCenter.selectModule")}
                      </Button>
                    </div>
                    <div className="divide-y divide-default">
                      {group.items.map((permission) => {
                        const checked = selected.includes(permission);
                        return (
                          <button
                            key={permission}
                            type="button"
                            onClick={() => togglePermission(permission)}
                            className={cn(
                              "flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors",
                              checked
                                ? "bg-accent-muted/40"
                                : "hover:bg-surface-muted/80"
                            )}
                          >
                            <span
                              className={cn(
                                "flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors",
                                checked
                                  ? "border-accent bg-accent text-white"
                                  : "border-field-border bg-surface-elevated text-transparent"
                              )}
                              aria-hidden
                            >
                              <Check className="h-3.5 w-3.5" strokeWidth={3} />
                            </span>
                            <span className="min-w-0">
                              <span className="block text-sm font-medium text-primary">
                                {t(`permissions.actions.${permissionAction(permission as Permission)}`)}
                              </span>
                              <span className="block text-xs text-muted">{permission}</span>
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            {saveError ? <p className="text-sm text-danger">{saveError}</p> : null}
          </div>
        </SideDrawer>
      ) : null}
    </div>
  );
}
