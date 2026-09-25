"use client";

import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { UserMemberActionsMenu } from "@/components/users/UserMemberActionsMenu";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input, SelectControl } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { SearchInput } from "@/components/ui/SearchInput";
import { SideDrawer } from "@/components/ui/SideDrawer";
import { SkeletonTable } from "@/components/ui/Skeleton";
import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableHead,
  DataTableRow,
} from "@/components/ui/DataTable";
import { useDialog } from "@/components/ui/DialogProvider";
import {
  useInviteTenantMember,
  useOrganizationTeams,
  useRemoveTenantMember,
  useTenantMembers,
  useUpdateTenantMember,
} from "@/hooks/useTenantMembers";
import { useCustomRoles } from "@/hooks/usePermissions";
import { useTenantRole } from "@/hooks/useTenantRole";
import { useFormatters } from "@/hooks/useFormatters";
import { useT } from "@/i18n/context";
import type { TenantMember } from "@/types";

type MemberRole = TenantMember["role"];

function roleLabel(role: MemberRole, t: ReturnType<typeof useT>): string {
  if (role === "member") return t("nav.roleAdministrator");
  if (role === "supervisor") return t("nav.roleSupervisor");
  return t("nav.roleAdvisor");
}

export function UsersTab() {
  const t = useT();
  const { confirm } = useDialog();
  const { formatRelativeTime } = useFormatters();
  const { isMember, isSupervisor } = useTenantRole();
  const { data, isLoading } = useTenantMembers();
  const { data: teamsData } = useOrganizationTeams();
  const { data: rolesData } = useCustomRoles(isMember);
  const inviteMember = useInviteTenantMember();
  const updateMember = useUpdateTenantMember();
  const removeMember = useRemoveTenantMember();

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | MemberRole>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<TenantMember | null>(null);
  const [error, setError] = useState("");

  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<MemberRole>("advisor");
  const [invitePhone, setInvitePhone] = useState("");
  const [inviteTeamIds, setInviteTeamIds] = useState<string[]>([]);
  const [inviteCustomRoleId, setInviteCustomRoleId] = useState("");

  const [editName, setEditName] = useState("");
  const [editRole, setEditRole] = useState<MemberRole>("advisor");
  const [editTeamIds, setEditTeamIds] = useState<string[]>([]);
  const [editPhone, setEditPhone] = useState("");
  const [editCustomRoleId, setEditCustomRoleId] = useState("");

  const members = data?.members ?? [];
  const currentUserId = data?.currentUserId ?? "";
  const teams = teamsData?.teams ?? [];
  const customRoles = rolesData?.roles ?? [];

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return members.filter((member) => {
      if (roleFilter !== "all" && member.role !== roleFilter) return false;
      if (statusFilter === "active" && !member.enabled) return false;
      if (statusFilter === "inactive" && member.enabled) return false;
      if (!query) return true;
      return (
        member.name.toLowerCase().includes(query) ||
        member.email.toLowerCase().includes(query) ||
        member.username.toLowerCase().includes(query)
      );
    });
  }, [members, roleFilter, search, statusFilter]);

  function memberErrorMessage(message: string): string {
    if (message === "A user with this email already exists") return t("userCenter.emailAlreadyExists");
    if (message === "An advisor with this phone number already exists") {
      return t("userCenter.phoneAlreadyExists");
    }
    if (message === "Cannot remove the last account administrator") {
      return t("userCenter.lastAdminError");
    }
    if (message === "You cannot remove yourself from the account") {
      return t("userCenter.selfRemoveError");
    }
    if (message === "Cannot disable the last account administrator") {
      return t("userCenter.lastAdminError");
    }
    return message;
  }

  function teamNames(teamIds: string[] | undefined): string {
    if (!teamIds?.length) return t("userCenter.noTeams");
    return teamIds
      .map((id) => teams.find((team) => team.teamId === id)?.name ?? id)
      .join(", ");
  }

  function openEdit(member: TenantMember) {
    setEditTarget(member);
    setEditName(member.name);
    setEditRole(member.role);
    setEditTeamIds(member.teamIds ?? []);
    setEditPhone("");
    setEditCustomRoleId(member.customRoleId ?? "");
    setError("");
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try {
      await inviteMember.mutateAsync({
        name: inviteName,
        email: inviteEmail,
        role: inviteRole,
        ...(inviteRole === "advisor" ? { phoneNumber: invitePhone } : {}),
        ...(inviteTeamIds.length ? { teamIds: inviteTeamIds } : {}),
        ...(inviteCustomRoleId ? { customRoleId: inviteCustomRoleId } : {}),
      });
      setInviteOpen(false);
      setInviteName("");
      setInviteEmail("");
      setInvitePhone("");
      setInviteRole("advisor");
      setInviteTeamIds([]);
      setInviteCustomRoleId("");
    } catch (err) {
      setError(memberErrorMessage((err as Error).message));
    }
  }

  async function handleEditSave() {
    if (!editTarget) return;
    setError("");
    try {
      await updateMember.mutateAsync({
        userId: editTarget.userId,
        body: {
          name: editName,
          ...(isMember ? { role: editRole, customRoleId: editCustomRoleId || null } : {}),
          teamIds: editTeamIds,
          ...(editRole === "advisor" && editPhone ? { phoneNumber: editPhone } : {}),
        },
      });
      setEditTarget(null);
    } catch (err) {
      setError(memberErrorMessage((err as Error).message));
    }
  }

  async function handleToggleEnabled(member: TenantMember) {
    if (!isMember) return;
    try {
      await updateMember.mutateAsync({
        userId: member.userId,
        body: { enabled: !member.enabled },
      });
    } catch (err) {
      setError(memberErrorMessage((err as Error).message));
    }
  }

  async function handleDelete(member: TenantMember) {
    const confirmed = await confirm({
      title: t("userCenter.confirmRemoveTitle"),
      description: t("userCenter.confirmRemove", { name: member.name }),
      confirmLabel: t("common.delete"),
      tone: "danger",
    });
    if (!confirmed) return;
    try {
      await removeMember.mutateAsync(member.userId);
    } catch (err) {
      setError(memberErrorMessage((err as Error).message));
    }
  }

  function toggleTeamSelection(teamId: string, selected: string[], setter: (ids: string[]) => void) {
    setter(
      selected.includes(teamId)
        ? selected.filter((id) => id !== teamId)
        : [...selected, teamId]
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <SearchInput
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("userCenter.searchUsers")}
            className="w-full sm:w-72"
          />
          <SelectControl
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value as "all" | MemberRole)}
            className="w-full sm:w-40"
          >
            <option value="all">{t("userCenter.filterAllRoles")}</option>
            <option value="member">{t("nav.roleAdministrator")}</option>
            <option value="supervisor">{t("nav.roleSupervisor")}</option>
            <option value="advisor">{t("nav.roleAdvisor")}</option>
          </SelectControl>
          <SelectControl
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as "all" | "active" | "inactive")}
            className="w-full sm:w-40"
          >
            <option value="all">{t("userCenter.filterAllStatuses")}</option>
            <option value="active">{t("userCenter.statusActive")}</option>
            <option value="inactive">{t("userCenter.statusInactive")}</option>
          </SelectControl>
        </div>
        {isMember ? (
          <Button type="button" onClick={() => setInviteOpen(true)}>
            <Plus className="h-4 w-4" />
            {t("userCenter.inviteUser")}
          </Button>
        ) : null}
      </div>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {isLoading ? <SkeletonTable rows={5} cols={6} /> : null}

      {!isLoading && filtered.length === 0 ? (
        <EmptyState
          title={t("userCenter.usersEmptyTitle")}
          description={t("userCenter.usersEmptyDescription")}
        />
      ) : null}

      {!isLoading && filtered.length > 0 ? (
        <DataTable>
          <DataTableHead>
            <DataTableRow>
              <DataTableCell header>{t("userCenter.colName")}</DataTableCell>
              <DataTableCell header>{t("userCenter.colRole")}</DataTableCell>
              <DataTableCell header>{t("userCenter.colTeams")}</DataTableCell>
              <DataTableCell header>{t("userCenter.colStatus")}</DataTableCell>
              <DataTableCell header>{t("userCenter.colLastLogin")}</DataTableCell>
              <DataTableCell header className="text-right">{t("userCenter.colActions")}</DataTableCell>
            </DataTableRow>
          </DataTableHead>
          <DataTableBody>
            {filtered.map((member) => {
              const isSelf = member.userId === currentUserId;
              const canManage =
                isMember ||
                (isSupervisor && member.role !== "member" && member.userId !== currentUserId);
              return (
                <DataTableRow key={member.userId}>
                  <DataTableCell>
                    <div>
                      <p className="font-medium text-primary">{member.name}</p>
                      <p className="text-xs text-secondary">
                        {member.email || member.username}
                      </p>
                      {isSelf ? (
                        <Badge variant="info" className="mt-1">{t("settings.teamYou")}</Badge>
                      ) : null}
                    </div>
                  </DataTableCell>
                  <DataTableCell>
                    <Badge variant={member.role === "member" ? "info" : "default"}>
                      {roleLabel(member.role, t)}
                    </Badge>
                  </DataTableCell>
                  <DataTableCell className="max-w-xs truncate text-secondary">
                    {teamNames(member.teamIds)}
                  </DataTableCell>
                  <DataTableCell>
                    <Badge variant={member.enabled ? "success" : "default"}>
                      {member.enabled ? t("userCenter.statusActive") : t("userCenter.statusInactive")}
                    </Badge>
                  </DataTableCell>
                  <DataTableCell className="text-secondary">
                    {member.lastLoginAt
                      ? formatRelativeTime(member.lastLoginAt)
                      : t("userCenter.neverLoggedIn")}
                  </DataTableCell>
                  <DataTableCell className="text-right">
                    {canManage ? (
                      <div className="flex justify-end">
                        <UserMemberActionsMenu
                          member={member}
                          busy={updateMember.isPending || removeMember.isPending}
                          canEdit={canManage}
                          canToggleStatus={isMember && !isSelf}
                          canDelete={isMember && !isSelf}
                          onEdit={() => openEdit(member)}
                          onToggleStatus={() => void handleToggleEnabled(member)}
                          onDelete={() => void handleDelete(member)}
                        />
                      </div>
                    ) : null}
                  </DataTableCell>
                </DataTableRow>
              );
            })}
          </DataTableBody>
        </DataTable>
      ) : null}

      {inviteOpen ? (
        <Modal>
          <form
            onSubmit={(e) => void handleInvite(e)}
            className="mx-4 w-full max-w-md rounded-xl border border-default bg-surface-elevated p-6 shadow-xl"
          >
            <h2 className="mb-4 text-lg font-semibold text-primary">{t("userCenter.inviteUser")}</h2>
            <div className="space-y-3">
              <Input
                required
                value={inviteName}
                onChange={(e) => setInviteName(e.target.value)}
                placeholder={t("settings.teamNamePlaceholder")}
              />
              <Input
                required
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder={t("settings.teamEmailPlaceholder")}
              />
              <SelectControl
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as MemberRole)}
              >
                <option value="member">{t("nav.roleAdministrator")}</option>
                <option value="supervisor">{t("nav.roleSupervisor")}</option>
                <option value="advisor">{t("nav.roleAdvisor")}</option>
              </SelectControl>
              {isMember && customRoles.length > 0 ? (
                <SelectControl
                  value={inviteCustomRoleId}
                  onChange={(e) => setInviteCustomRoleId(e.target.value)}
                >
                  <option value="">{t("userCenter.customRoleNone")}</option>
                  {customRoles.map((role) => (
                    <option key={role.roleId} value={role.roleId}>
                      {role.name}
                    </option>
                  ))}
                </SelectControl>
              ) : null}
              {inviteRole === "advisor" ? (
                <Input
                  required
                  value={invitePhone}
                  onChange={(e) => setInvitePhone(e.target.value)}
                  placeholder={t("settings.teamPhonePlaceholder")}
                />
              ) : null}
              {teams.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-xs text-secondary">{t("userCenter.assignTeams")}</p>
                  <div className="flex flex-wrap gap-2">
                    {teams.map((team) => (
                      <button
                        key={team.teamId}
                        type="button"
                        onClick={() =>
                          toggleTeamSelection(team.teamId, inviteTeamIds, setInviteTeamIds)
                        }
                        className={`rounded-lg border px-3 py-1.5 text-xs ${
                          inviteTeamIds.includes(team.teamId)
                            ? "border-accent bg-accent-muted text-accent"
                            : "border-default text-secondary"
                        }`}
                      >
                        {team.name}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setInviteOpen(false)}>
                {t("common.cancel")}
              </Button>
              <Button type="submit" disabled={inviteMember.isPending}>
                {inviteMember.isPending ? t("common.loading") : t("settings.teamSendInvite")}
              </Button>
            </div>
          </form>
        </Modal>
      ) : null}

      {editTarget ? (
        <SideDrawer
          title={t("userCenter.editUser")}
          onClose={() => setEditTarget(null)}
          footer={
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setEditTarget(null)}>
                {t("common.cancel")}
              </Button>
              <Button
                type="button"
                onClick={() => void handleEditSave()}
                disabled={updateMember.isPending}
              >
                {updateMember.isPending ? t("common.loading") : t("common.save")}
              </Button>
            </div>
          }
        >
          <div className="space-y-4 p-5">
            <Input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              placeholder={t("settings.teamNamePlaceholder")}
            />
            {isMember ? (
              <SelectControl
                value={editRole}
                onChange={(e) => setEditRole(e.target.value as MemberRole)}
              >
                <option value="member">{t("nav.roleAdministrator")}</option>
                <option value="supervisor">{t("nav.roleSupervisor")}</option>
                <option value="advisor">{t("nav.roleAdvisor")}</option>
              </SelectControl>
            ) : null}
            {isMember && customRoles.length > 0 ? (
              <SelectControl
                value={editCustomRoleId}
                onChange={(e) => setEditCustomRoleId(e.target.value)}
              >
                <option value="">{t("userCenter.customRoleNone")}</option>
                {customRoles.map((role) => (
                  <option key={role.roleId} value={role.roleId}>
                    {role.name}
                  </option>
                ))}
              </SelectControl>
            ) : null}
            {editRole === "advisor" ? (
              <Input
                value={editPhone}
                onChange={(e) => setEditPhone(e.target.value)}
                placeholder={t("settings.teamPhonePlaceholder")}
              />
            ) : null}
            {teams.length > 0 ? (
              <div className="space-y-2">
                <p className="text-xs text-secondary">{t("userCenter.assignTeams")}</p>
                <div className="flex flex-wrap gap-2">
                  {teams.map((team) => (
                    <button
                      key={team.teamId}
                      type="button"
                      onClick={() =>
                        toggleTeamSelection(team.teamId, editTeamIds, setEditTeamIds)
                      }
                      className={`rounded-lg border px-3 py-1.5 text-xs ${
                        editTeamIds.includes(team.teamId)
                          ? "border-accent bg-accent-muted text-accent"
                          : "border-default text-secondary"
                      }`}
                    >
                      {team.name}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </SideDrawer>
      ) : null}
    </div>
  );
}
