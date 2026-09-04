import type { OrganizationTeam } from "../../types/index.js";
import { listMembers } from "../dynamodb/member.repository.js";
import { getTeam, listTeams, putTeam } from "../dynamodb/team.repository.js";

export async function syncMemberTeamMembership(
  tenantId: string,
  userId: string,
  teamIds: string[]
): Promise<void> {
  const teams = await listTeams(tenantId);
  const targetSet = new Set(teamIds);

  for (const team of teams) {
    const hasMember = team.memberUserIds.includes(userId);
    const shouldHave = targetSet.has(team.teamId);

    if (hasMember === shouldHave) continue;

    const memberUserIds = shouldHave
      ? [...team.memberUserIds, userId]
      : team.memberUserIds.filter((id) => id !== userId);

    await putTeam({
      ...team,
      memberUserIds,
      updatedAt: new Date().toISOString(),
    });
  }
}

export async function syncSupervisorTeamMembership(
  tenantId: string,
  userId: string,
  teamIds: string[]
): Promise<void> {
  const teams = await listTeams(tenantId);
  const targetSet = new Set(teamIds);

  for (const team of teams) {
    const hasSupervisor = team.supervisorUserIds.includes(userId);
    const shouldHave = targetSet.has(team.teamId);

    if (hasSupervisor === shouldHave) continue;

    const supervisorUserIds = shouldHave
      ? [...team.supervisorUserIds, userId]
      : team.supervisorUserIds.filter((id) => id !== userId);

    await putTeam({
      ...team,
      supervisorUserIds,
      updatedAt: new Date().toISOString(),
    });
  }
}

export async function removeUserFromAllTeams(tenantId: string, userId: string): Promise<void> {
  const teams = await listTeams(tenantId);

  for (const team of teams) {
    const memberUserIds = team.memberUserIds.filter((id) => id !== userId);
    const supervisorUserIds = team.supervisorUserIds.filter((id) => id !== userId);

    if (
      memberUserIds.length === team.memberUserIds.length &&
      supervisorUserIds.length === team.supervisorUserIds.length
    ) {
      continue;
    }

    await putTeam({
      ...team,
      memberUserIds,
      supervisorUserIds,
      updatedAt: new Date().toISOString(),
    });
  }
}

export function teamIdsForUser(teams: OrganizationTeam[], userId: string): string[] {
  return teams
    .filter(
      (team) =>
        team.memberUserIds.includes(userId) || team.supervisorUserIds.includes(userId)
    )
    .map((team) => team.teamId);
}

export async function assertTeamUserIdsBelongToTenant(
  tenantId: string,
  userIds: string[]
): Promise<void> {
  if (userIds.length === 0) return;

  const members = await listMembers(tenantId);
  const memberIds = new Set(members.map((member) => member.userId));

  for (const userId of userIds) {
    if (!memberIds.has(userId)) {
      const error = new Error("One or more users do not belong to this tenant");
      (error as Error & { statusCode: number }).statusCode = 400;
      throw error;
    }
  }
}

export async function assertTeamIdsBelongToTenant(
  tenantId: string,
  teamIds: string[]
): Promise<void> {
  if (teamIds.length === 0) return;

  const teams = await listTeams(tenantId);
  const validIds = new Set(teams.map((team) => team.teamId));

  for (const teamId of teamIds) {
    if (!validIds.has(teamId)) {
      const error = new Error("One or more teams do not belong to this tenant");
      (error as Error & { statusCode: number }).statusCode = 400;
      throw error;
    }
  }
}

export function supervisorCanManageTeam(
  team: OrganizationTeam,
  supervisorUserId: string
): boolean {
  return team.supervisorUserIds.includes(supervisorUserId);
}

export async function getSupervisorManagedTeamIds(
  tenantId: string,
  supervisorUserId: string
): Promise<string[]> {
  const teams = await listTeams(tenantId);
  return teams
    .filter((team) => team.supervisorUserIds.includes(supervisorUserId))
    .map((team) => team.teamId);
}

export async function getSupervisorManagedUserIds(
  tenantId: string,
  supervisorUserId: string
): Promise<Set<string>> {
  const teams = await listTeams(tenantId);
  const userIds = new Set<string>();

  for (const team of teams) {
    if (!team.supervisorUserIds.includes(supervisorUserId)) continue;
    for (const memberId of team.memberUserIds) {
      userIds.add(memberId);
    }
  }

  return userIds;
}

export async function getTeamOrThrow(tenantId: string, teamId: string): Promise<OrganizationTeam> {
  const team = await getTeam(tenantId, teamId);
  if (!team) {
    const error = new Error("Team not found");
    (error as Error & { statusCode: number }).statusCode = 404;
    throw error;
  }
  return team;
}
