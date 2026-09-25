"use client";

import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/Button";
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
import {
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

  const permissions = catalog.length > 0 ? catalog : [];
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
  }

  function openEdit(role: CustomRole) {
    setCreating(false);
    setEditing(role);
    setName(role.name);
    setSelected(role.permissions);
  }

  function closeDrawer() {
    setCreating(false);
    setEditing(null);
  }

  function togglePermission(permission: string) {
    setSelected((current) =>
      current.includes(permission)
        ? current.filter((item) => item !== permission)
        : [...current, permission]
    );
  }

  async function saveRole() {
    if (!name.trim()) return;
    if (editing) {
      await updateRole.mutateAsync({
        roleId: editing.roleId,
        body: { name: name.trim(), permissions: selected },
      });
    } else {
      await createRole.mutateAsync({ name: name.trim(), permissions: selected });
    }
    closeDrawer();
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

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-default bg-surface-elevated p-5">
        <h2 className="text-sm font-semibold text-primary">{t("userCenter.presetRoles")}</h2>
        <p className="mt-1 text-sm text-secondary">{t("userCenter.presetRolesHint")}</p>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {(["member", "supervisor", "advisor"] as const).map((role) => (
            <div key={role} className="rounded-lg border border-default p-3">
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
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-primary">{t("userCenter.customRoles")}</h2>
          {isMember ? (
            <Button type="button" size="sm" onClick={openCreate}>
              <Plus className="h-4 w-4" />
              {t("userCenter.createRole")}
            </Button>
          ) : null}
        </div>
        {isLoading ? <p className="text-sm text-muted">{t("common.loading")}</p> : null}
        {!isLoading && roles.length === 0 ? (
          <p className="text-sm text-secondary">{t("userCenter.customRolesEmpty")}</p>
        ) : null}
        <div className="space-y-2">
          {roles.map((role) => (
            <div
              key={role.roleId}
              className="flex items-center justify-between rounded-xl border border-default bg-surface-elevated px-4 py-3"
            >
              <div>
                <p className="text-sm font-medium text-primary">{role.name}</p>
                <p className="text-xs text-secondary">
                  {t("userCenter.permissionCount", { count: role.permissions.length })}
                </p>
              </div>
              {isMember ? (
                <div className="flex gap-2">
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
          footer={
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={closeDrawer}>
                {t("common.cancel")}
              </Button>
              <Button
                type="button"
                onClick={() => void saveRole()}
                disabled={createRole.isPending || updateRole.isPending || !name.trim()}
              >
                {t("common.save")}
              </Button>
            </div>
          }
        >
          <div className="space-y-4 p-5">
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={t("userCenter.roleNamePlaceholder")}
            />
            {grouped.map((group) => (
              <div key={group.module} className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-secondary">
                  {t(`permissions.modules.${group.module}`)}
                </p>
                {group.items.map((permission) => (
                  <label key={permission} className="flex items-center gap-2 text-sm text-primary">
                    <input
                      type="checkbox"
                      checked={selected.includes(permission)}
                      onChange={() => togglePermission(permission)}
                    />
                    {t(`permissions.actions.${permissionAction(permission as Permission)}`)}
                  </label>
                ))}
              </div>
            ))}
          </div>
        </SideDrawer>
      ) : null}
    </div>
  );
}
