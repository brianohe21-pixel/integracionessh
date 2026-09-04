import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyResultV2 } from "aws-lambda";
import { z } from "zod";
import { randomUUID } from "crypto";
import type { AuthContext, OrganizationTeam } from "../../types/index.js";
import {
  assertTenantAdminRole,
  assertUserCenterAccess,
} from "../../lib/auth/cognito.js";
import { ensureTenant } from "../../lib/dynamodb/tenant.repository.js";
import {
  deleteTeam,
  getTeam,
  listTeams,
  putTeam,
} from "../../lib/dynamodb/team.repository.js";
import {
  assertTeamUserIdsBelongToTenant,
  getSupervisorManagedTeamIds,
  getTeamOrThrow,
  supervisorCanManageTeam,
  teamIdsForUser,
} from "../../lib/teams/membership.js";
import { listMembers, updateMember } from "../../lib/dynamodb/member.repository.js";
import {
  badRequest,
  created,
  forbidden,
  noContent,
  notFound,
  ok,
  parseJsonBody,
} from "../../lib/http.js";

const CreateTeamSchema = z.object({
  name: z.string().min(1).max(128),
  description: z.string().max(512).optional(),
  supervisorUserIds: z.array(z.string().min(1)).optional(),
  memberUserIds: z.array(z.string().min(1)).optional(),
});

const UpdateTeamSchema = z.object({
  name: z.string().min(1).max(128).optional(),
  description: z.string().max(512).optional(),
  status: z.enum(["active", "inactive"]).optional(),
  supervisorUserIds: z.array(z.string().min(1)).optional(),
  memberUserIds: z.array(z.string().min(1)).optional(),
});

function formatZodError(error: z.ZodError): string {
  return error.issues.map((issue) => issue.message).join("; ") || "Invalid input";
}

function enrichTeamsWithCounts(teams: OrganizationTeam[]) {
  return teams.map((team) => ({
    ...team,
    memberCount: team.memberUserIds.length,
    supervisorCount: team.supervisorUserIds.length,
  }));
}

export async function handleTeamRoutes(
  event: APIGatewayProxyEventV2WithJWTAuthorizer,
  method: string,
  auth: AuthContext
): Promise<APIGatewayProxyResultV2 | null> {
  const rawPath = event.rawPath ?? "";
  if (!rawPath.includes("/tenants/me/teams")) return null;

  assertUserCenterAccess(auth);
  await ensureTenant(auth.tenantId, auth.email, auth.name);

  const teamId = event.pathParameters?.teamId;

  if (method === "GET" && rawPath.endsWith("/tenants/me/teams") && !teamId) {
    const teams = await listTeams(auth.tenantId);
    if (auth.role === "supervisor") {
      const managedIds = new Set(await getSupervisorManagedTeamIds(auth.tenantId, auth.userId));
      const scoped = teams.filter((team) => managedIds.has(team.teamId));
      return ok({ teams: enrichTeamsWithCounts(scoped) });
    }
    return ok({ teams: enrichTeamsWithCounts(teams) });
  }

  if (method === "GET" && teamId && rawPath.includes("/tenants/me/teams/")) {
    const team = await getTeam(auth.tenantId, teamId);
    if (!team) return notFound("Team not found");
    if (
      auth.role === "supervisor" &&
      !supervisorCanManageTeam(team, auth.userId)
    ) {
      return forbidden("Supervisor cannot access this team");
    }
    return ok(team);
  }

  if (method === "POST" && rawPath.endsWith("/tenants/me/teams")) {
    assertTenantAdminRole(auth);
    const body = parseJsonBody(event);
    const parsed = CreateTeamSchema.safeParse(body);
    if (!parsed.success) return badRequest(formatZodError(parsed.error));

    const supervisorUserIds = parsed.data.supervisorUserIds ?? [];
    const memberUserIds = parsed.data.memberUserIds ?? [];
    await assertTeamUserIdsBelongToTenant(auth.tenantId, [
      ...supervisorUserIds,
      ...memberUserIds,
    ]);

    const now = new Date().toISOString();
    const team: OrganizationTeam = {
      teamId: randomUUID(),
      tenantId: auth.tenantId,
      name: parsed.data.name,
      ...(parsed.data.description ? { description: parsed.data.description } : {}),
      status: "active",
      supervisorUserIds,
      memberUserIds,
      createdAt: now,
      updatedAt: now,
    };

    await putTeam(team);

    for (const userId of memberUserIds) {
      const member = (await listMembers(auth.tenantId)).find((item) => item.userId === userId);
      if (!member) continue;
      const teamIds = [...new Set([...(member.teamIds ?? []), team.teamId])];
      await updateMember(auth.tenantId, userId, { teamIds });
    }

    for (const userId of supervisorUserIds) {
      const member = (await listMembers(auth.tenantId)).find((item) => item.userId === userId);
      if (!member) continue;
      const teamIds = [...new Set([...(member.teamIds ?? []), team.teamId])];
      await updateMember(auth.tenantId, userId, { teamIds });
    }

    return created(team);
  }

  if (method === "PATCH" && teamId && rawPath.includes("/tenants/me/teams/")) {
    const team = await getTeamOrThrow(auth.tenantId, teamId);
    if (auth.role === "supervisor" && !supervisorCanManageTeam(team, auth.userId)) {
      return forbidden("Supervisor cannot manage this team");
    }
    if (auth.role === "supervisor") {
      const body = parseJsonBody(event);
      const parsed = UpdateTeamSchema.safeParse(body);
      if (!parsed.success) return badRequest(formatZodError(parsed.error));
      if (parsed.data.supervisorUserIds !== undefined) {
        return forbidden("Supervisor cannot change team supervisors");
      }
      if (parsed.data.name !== undefined || parsed.data.description !== undefined) {
        return forbidden("Supervisor cannot edit team details");
      }
    }

    const body = parseJsonBody(event);
    const parsed = UpdateTeamSchema.safeParse(body);
    if (!parsed.success) return badRequest(formatZodError(parsed.error));

    if (parsed.data.supervisorUserIds) {
      await assertTeamUserIdsBelongToTenant(auth.tenantId, parsed.data.supervisorUserIds);
    }
    if (parsed.data.memberUserIds) {
      await assertTeamUserIdsBelongToTenant(auth.tenantId, parsed.data.memberUserIds);
    }

    const now = new Date().toISOString();
    const updated: OrganizationTeam = {
      ...team,
      ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
      ...(parsed.data.description !== undefined ? { description: parsed.data.description } : {}),
      ...(parsed.data.status !== undefined ? { status: parsed.data.status } : {}),
      ...(parsed.data.supervisorUserIds !== undefined
        ? { supervisorUserIds: parsed.data.supervisorUserIds }
        : {}),
      ...(parsed.data.memberUserIds !== undefined
        ? { memberUserIds: parsed.data.memberUserIds }
        : {}),
      updatedAt: now,
    };

    await putTeam(updated);

    const members = await listMembers(auth.tenantId);
    for (const member of members) {
      const derivedTeamIds = teamIdsForUser([updated], member.userId);
      const inThisTeam = derivedTeamIds.includes(updated.teamId);
      const currentTeamIds = member.teamIds ?? [];
      const nextTeamIds = inThisTeam
        ? [...new Set([...currentTeamIds, updated.teamId])]
        : currentTeamIds.filter((id) => id !== updated.teamId);
      if (nextTeamIds.length !== currentTeamIds.length || nextTeamIds.some((id, i) => id !== currentTeamIds[i])) {
        await updateMember(auth.tenantId, member.userId, { teamIds: nextTeamIds });
      }
    }

    return ok(updated);
  }

  if (method === "DELETE" && teamId && rawPath.includes("/tenants/me/teams/")) {
    assertTenantAdminRole(auth);
    const team = await getTeam(auth.tenantId, teamId);
    if (!team) return notFound("Team not found");

    const members = await listMembers(auth.tenantId);
    for (const member of members) {
      if (!member.teamIds?.includes(teamId)) continue;
      const teamIds = member.teamIds.filter((id) => id !== teamId);
      await updateMember(auth.tenantId, member.userId, { teamIds });
    }

    await deleteTeam(auth.tenantId, teamId);
    return noContent();
  }

  return badRequest("Route not found");
}
