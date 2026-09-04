"use client";

import { useMemo, useState } from "react";
import { Plus, Pencil, Trash2, Users } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input, SelectControl, Textarea } from "@/components/ui/Input";
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
  useCreateOrganizationTeam,
  useDeleteOrganizationTeam,
  useOrganizationTeams,
  useTenantMembers,
  useUpdateOrganizationTeam,
} from "@/hooks/useTenantMembers";
import { useTenantRole } from "@/hooks/useTenantRole";
import { useT } from "@/i18n/context";
import type { OrganizationTeam } from "@/types";

export function TeamsTab() {
  const t = useT();
  const { confirm } = useDialog();
  const { isMember } = useTenantRole();
  const { data, isLoading } = useOrganizationTeams();
  const { data: membersData } = useTenantMembers();
  const createTeam = useCreateOrganizationTeam();
  const updateTeam = useUpdateOrganizationTeam();
  const deleteTeam = useDeleteOrganizationTeam();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<OrganizationTeam | null>(null);
  const [error, setError] = useState("");

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [supervisorUserIds, setSupervisorUserIds] = useState<string[]>([]);
  const [memberUserIds, setMemberUserIds] = useState<string[]>([]);

  const teams = data?.teams ?? [];
  const members = membersData?.members ?? [];

  const supervisorOptions = members.filter(
    (member) => member.role === "supervisor" || member.role === "member"
  );
  const memberOptions = members.filter((member) => member.role !== "member");

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return teams.filter((team) => {
      if (statusFilter === "active" && team.status !== "active") return false;
      if (statusFilter === "inactive" && team.status !== "inactive") return false;
      if (!query) return true;
      return team.name.toLowerCase().includes(query);
    });
  }, [teams, search, statusFilter]);

  function memberName(userId: string): string {
    return members.find((member) => member.userId === userId)?.name ?? userId;
  }

  function openCreate() {
    setName("");
    setDescription("");
    setSupervisorUserIds([]);
    setMemberUserIds([]);
    setError("");
    setCreateOpen(true);
  }

  function openEdit(team: OrganizationTeam) {
    setEditTarget(team);
    setName(team.name);
    setDescription(team.description ?? "");
    setSupervisorUserIds(team.supervisorUserIds);
    setMemberUserIds(team.memberUserIds);
    setError("");
  }

  function toggleUserId(userId: string, selected: string[], setter: (ids: string[]) => void) {
    setter(
      selected.includes(userId) ? selected.filter((id) => id !== userId) : [...selected, userId]
    );
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try {
      await createTeam.mutateAsync({
        name,
        ...(description ? { description } : {}),
        supervisorUserIds,
        memberUserIds,
      });
      setCreateOpen(false);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function handleEditSave() {
    if (!editTarget) return;
    setError("");
    try {
      await updateTeam.mutateAsync({
        teamId: editTarget.teamId,
        body: {
          ...(isMember ? { name, description } : {}),
          supervisorUserIds: isMember ? supervisorUserIds : undefined,
          memberUserIds,
        },
      });
      setEditTarget(null);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function handleToggleStatus(team: OrganizationTeam) {
    if (!isMember) return;
    try {
      await updateTeam.mutateAsync({
        teamId: team.teamId,
        body: { status: team.status === "active" ? "inactive" : "active" },
      });
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function handleDelete(team: OrganizationTeam) {
    const confirmed = await confirm({
      title: t("userCenter.confirmDeleteTeamTitle"),
      description: t("userCenter.confirmDeleteTeam", { name: team.name }),
      confirmLabel: t("common.delete"),
      tone: "danger",
    });
    if (!confirmed) return;
    try {
      await deleteTeam.mutateAsync(team.teamId);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <SearchInput
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("userCenter.searchTeams")}
            className="w-full sm:w-72"
          />
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
          <Button type="button" onClick={openCreate}>
            <Plus className="h-4 w-4" />
            {t("userCenter.createTeam")}
          </Button>
        ) : null}
      </div>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {isLoading ? <SkeletonTable rows={4} cols={5} /> : null}

      {!isLoading && filtered.length === 0 ? (
        <EmptyState
          icon={<Users className="h-6 w-6" />}
          title={t("userCenter.teamsEmptyTitle")}
          description={t("userCenter.teamsEmptyDescription")}
        />
      ) : null}

      {!isLoading && filtered.length > 0 ? (
        <DataTable>
          <DataTableHead>
            <DataTableRow>
              <DataTableCell header>{t("userCenter.colTeamName")}</DataTableCell>
              <DataTableCell header>{t("userCenter.colSupervisors")}</DataTableCell>
              <DataTableCell header>{t("userCenter.colMembers")}</DataTableCell>
              <DataTableCell header>{t("userCenter.colStatus")}</DataTableCell>
              <DataTableCell header className="text-right">{t("userCenter.colActions")}</DataTableCell>
            </DataTableRow>
          </DataTableHead>
          <DataTableBody>
            {filtered.map((team) => (
              <DataTableRow key={team.teamId}>
                <DataTableCell>
                  <p className="font-medium text-primary">{team.name}</p>
                  {team.description ? (
                    <p className="text-xs text-secondary">{team.description}</p>
                  ) : null}
                </DataTableCell>
                <DataTableCell className="text-secondary">
                  {team.supervisorUserIds.map(memberName).join(", ") || t("userCenter.none")}
                </DataTableCell>
                <DataTableCell className="text-secondary">
                  {team.memberUserIds.length}
                </DataTableCell>
                <DataTableCell>
                  <Badge variant={team.status === "active" ? "success" : "default"}>
                    {team.status === "active"
                      ? t("userCenter.statusActive")
                      : t("userCenter.statusInactive")}
                  </Badge>
                </DataTableCell>
                <DataTableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => openEdit(team)}
                      aria-label={t("common.edit")}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    {isMember ? (
                      <>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => void handleToggleStatus(team)}
                        >
                          {team.status === "active"
                            ? t("userCenter.deactivate")
                            : t("userCenter.activate")}
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => void handleDelete(team)}
                          aria-label={t("common.delete")}
                        >
                          <Trash2 className="h-4 w-4 text-danger" />
                        </Button>
                      </>
                    ) : null}
                  </div>
                </DataTableCell>
              </DataTableRow>
            ))}
          </DataTableBody>
        </DataTable>
      ) : null}

      {createOpen ? (
        <Modal>
          <form
            onSubmit={(e) => void handleCreate(e)}
            className="mx-4 w-full max-w-lg rounded-xl border border-default bg-surface-elevated p-6 shadow-xl"
          >
            <h2 className="mb-4 text-lg font-semibold text-primary">{t("userCenter.createTeam")}</h2>
            <div className="space-y-3">
              <Input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("userCenter.teamNamePlaceholder")}
              />
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t("userCenter.teamDescriptionPlaceholder")}
                rows={3}
              />
              <TeamUserPicker
                label={t("userCenter.supervisorsLabel")}
                options={supervisorOptions}
                selected={supervisorUserIds}
                onToggle={(id) => toggleUserId(id, supervisorUserIds, setSupervisorUserIds)}
              />
              <TeamUserPicker
                label={t("userCenter.membersLabel")}
                options={memberOptions}
                selected={memberUserIds}
                onToggle={(id) => toggleUserId(id, memberUserIds, setMemberUserIds)}
              />
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setCreateOpen(false)}>
                {t("common.cancel")}
              </Button>
              <Button type="submit" disabled={createTeam.isPending}>
                {createTeam.isPending ? t("common.loading") : t("common.create")}
              </Button>
            </div>
          </form>
        </Modal>
      ) : null}

      {editTarget ? (
        <SideDrawer
          title={t("userCenter.editTeam")}
          onClose={() => setEditTarget(null)}
          footer={
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setEditTarget(null)}>
                {t("common.cancel")}
              </Button>
              <Button
                type="button"
                onClick={() => void handleEditSave()}
                disabled={updateTeam.isPending}
              >
                {updateTeam.isPending ? t("common.loading") : t("common.save")}
              </Button>
            </div>
          }
        >
          <div className="space-y-4 p-5">
            {isMember ? (
              <>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t("userCenter.teamNamePlaceholder")}
                />
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={t("userCenter.teamDescriptionPlaceholder")}
                  rows={3}
                />
                <TeamUserPicker
                  label={t("userCenter.supervisorsLabel")}
                  options={supervisorOptions}
                  selected={supervisorUserIds}
                  onToggle={(id) => toggleUserId(id, supervisorUserIds, setSupervisorUserIds)}
                />
              </>
            ) : null}
            <TeamUserPicker
              label={t("userCenter.membersLabel")}
              options={memberOptions}
              selected={memberUserIds}
              onToggle={(id) => toggleUserId(id, memberUserIds, setMemberUserIds)}
            />
          </div>
        </SideDrawer>
      ) : null}
    </div>
  );
}

function TeamUserPicker({
  label,
  options,
  selected,
  onToggle,
}: {
  label: string;
  options: { userId: string; name: string }[];
  selected: string[];
  onToggle: (userId: string) => void;
}) {
  if (options.length === 0) return null;
  return (
    <div className="space-y-2">
      <p className="text-xs text-secondary">{label}</p>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <button
            key={option.userId}
            type="button"
            onClick={() => onToggle(option.userId)}
            className={`rounded-lg border px-3 py-1.5 text-xs ${
              selected.includes(option.userId)
                ? "border-accent bg-accent-muted text-accent"
                : "border-default text-secondary"
            }`}
          >
            {option.name}
          </button>
        ))}
      </div>
    </div>
  );
}
