import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyResultV2 } from "aws-lambda";
import { z } from "zod";
import { randomUUID } from "crypto";
import type { Advisor, AuthContext, TenantMember, TenantMemberRole } from "../../types/index.js";
import {
  assertUserCenterAccess,
} from "../../lib/auth/cognito.js";
import { ensureTenant, getTenant } from "../../lib/dynamodb/tenant.repository.js";
import {
  countMembersByRole,
  deleteMember,
  getMember,
  listMembers,
  putMember,
  updateMember,
} from "../../lib/dynamodb/member.repository.js";
import {
  createAdvisor,
  deleteAdvisor,
  getAdvisorByPhone,
  listAdvisors,
  updateAdvisor,
} from "../../lib/dynamodb/advisor.repository.js";
import { listTeams } from "../../lib/dynamodb/team.repository.js";
import { inviteTenantUser } from "../../lib/cognito/invite-tenant-user.js";
import {
  deleteCognitoUserBySub,
  updateCognitoUserBySub,
} from "../../lib/cognito/admin-users.js";
import { resolveBranding } from "../../lib/branding/resolve.js";
import { sendMemberInviteEmail } from "../../lib/email/member-invite.js";
import { assertAssignedServices } from "../../lib/billing/subaccount-services.js";
import {
  assertTeamIdsBelongToTenant,
  getSupervisorManagedUserIds,
  removeUserFromAllTeams,
  syncMemberTeamMembership,
  syncSupervisorTeamMembership,
  teamIdsForUser,
} from "../../lib/teams/membership.js";
import {
  badRequest,
  created,
  forbidden,
  noContent,
  notFound,
  ok,
  parseJsonBody,
} from "../../lib/http.js";

const CreateMemberSchema = z
  .object({
    name: z.string().min(1).max(128),
    email: z.string().email(),
    role: z.enum(["member", "supervisor", "advisor"]),
    phoneNumber: z.string().min(8).max(20).optional(),
    teamIds: z.array(z.string().min(1)).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.role === "advisor" && !data.phoneNumber) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "phoneNumber is required for advisor role",
        path: ["phoneNumber"],
      });
    }
  });

const UpdateMemberSchema = z.object({
  name: z.string().min(1).max(128).optional(),
  role: z.enum(["member", "supervisor", "advisor"]).optional(),
  enabled: z.boolean().optional(),
  teamIds: z.array(z.string().min(1)).optional(),
  phoneNumber: z.string().min(8).max(20).optional(),
});

function formatZodError(error: z.ZodError): string {
  return error.issues.map((issue) => issue.message).join("; ") || "Invalid input";
}

async function upsertCurrentUser(auth: AuthContext): Promise<void> {
  if (
    auth.role !== "member" &&
    auth.role !== "supervisor" &&
    auth.role !== "advisor"
  ) {
    return;
  }

  const existing = await getMember(auth.tenantId, auth.userId);
  const now = new Date().toISOString();
  let advisorId = existing?.advisorId;

  if (auth.role === "advisor" && !advisorId) {
    const advisors = await listAdvisors(auth.tenantId);
    const linked = advisors.find((a) => a.cognitoUserId === auth.userId);
    advisorId = linked?.advisorId;
  }

  await putMember(
    {
      userId: auth.userId,
      username: auth.email,
      email: auth.email,
      name: auth.name ?? auth.email,
      role: auth.role as TenantMemberRole,
      enabled: true,
      createdAt: existing?.createdAt ?? now,
      ...(advisorId ? { advisorId } : {}),
      ...(existing?.teamIds ? { teamIds: existing.teamIds } : {}),
      ...(existing?.lastLoginAt ? { lastLoginAt: existing.lastLoginAt } : {}),
    },
    auth.tenantId
  );
}

async function buildUnifiedMemberList(tenantId: string): Promise<TenantMember[]> {
  const members = await listMembers(tenantId);
  const teams = await listTeams(tenantId);
  const byUserId = new Map(members.map((m) => [m.userId, m]));

  const advisors = await listAdvisors(tenantId);
  for (const advisor of advisors) {
    if (!advisor.cognitoUserId || byUserId.has(advisor.cognitoUserId)) continue;
    byUserId.set(advisor.cognitoUserId, {
      userId: advisor.cognitoUserId,
      username: "",
      email: "",
      name: advisor.name,
      role: "advisor",
      enabled: advisor.status === "active",
      createdAt: advisor.createdAt,
      advisorId: advisor.advisorId,
      teamIds: teamIdsForUser(teams, advisor.cognitoUserId),
    });
  }

  return [...byUserId.values()]
    .map((member) => ({
      ...member,
      teamIds: member.teamIds ?? teamIdsForUser(teams, member.userId),
    }))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

async function sendInviteEmail(params: {
  to: string;
  name: string;
  tenantId: string;
  temporaryPassword: string;
  role: TenantMemberRole;
}): Promise<{
  emailSent: boolean;
  emailFailureReason?: string;
  temporaryPassword?: string;
}> {
  const tenant = await getTenant(params.tenantId);
  const tenantName = tenant ? resolveBranding(tenant).brandName : "la plataforma";

  const emailResult = await sendMemberInviteEmail({
    to: params.to,
    memberName: params.name,
    tenantName,
    temporaryPassword: params.temporaryPassword,
    role: params.role,
  });

  if (emailResult.sent) {
    return { emailSent: true };
  }

  const result: {
    emailSent: boolean;
    emailFailureReason?: string;
    temporaryPassword?: string;
  } = {
    emailSent: false,
    temporaryPassword: params.temporaryPassword,
  };
  if (emailResult.failureReason) {
    result.emailFailureReason = emailResult.failureReason;
  }
  return result;
}

function assertSupervisorCanManageUser(
  auth: AuthContext,
  targetUserId: string,
  managedUserIds: Set<string>
): void {
  if (auth.role !== "supervisor") return;
  if (!managedUserIds.has(targetUserId)) {
    const error = new Error("Supervisor cannot manage this user");
    (error as Error & { statusCode: number }).statusCode = 403;
    throw error;
  }
}

export async function handleMemberRoutes(
  event: APIGatewayProxyEventV2WithJWTAuthorizer,
  method: string,
  auth: AuthContext
): Promise<APIGatewayProxyResultV2 | null> {
  const rawPath = event.rawPath ?? "";
  if (!rawPath.includes("/tenants/me/members")) return null;

  assertUserCenterAccess(auth);
  await ensureTenant(auth.tenantId, auth.email, auth.name);

  const userId = event.pathParameters?.userId;
  const managedUserIds =
    auth.role === "supervisor"
      ? await getSupervisorManagedUserIds(auth.tenantId, auth.userId)
      : null;

  if (method === "GET" && rawPath.endsWith("/tenants/me/members") && !userId) {
    await upsertCurrentUser(auth);
    const members = await buildUnifiedMemberList(auth.tenantId);
    if (auth.role === "supervisor") {
      const scoped = members.filter(
        (member) =>
          member.userId === auth.userId || managedUserIds?.has(member.userId)
      );
      return ok({ members: scoped, currentUserId: auth.userId });
    }
    return ok({ members, currentUserId: auth.userId });
  }

  if (method === "POST" && rawPath.endsWith("/tenants/me/members")) {
    if (auth.role === "supervisor") {
      return forbidden("Supervisor cannot invite users");
    }

    const body = parseJsonBody(event);
    const parsed = CreateMemberSchema.safeParse(body);
    if (!parsed.success) {
      return badRequest(formatZodError(parsed.error));
    }

    if (parsed.data.role === "advisor") {
      await assertAssignedServices(auth.tenantId, "advisors");
    }

    const teamIds = parsed.data.teamIds ?? [];
    await assertTeamIdsBelongToTenant(auth.tenantId, teamIds);

    const now = new Date().toISOString();
    const { name, email, role } = parsed.data;

    const invited = await inviteTenantUser({
      email,
      name,
      tenantId: auth.tenantId,
      role,
    });

    let advisor: Advisor | undefined;

    if (role === "advisor") {
      const phoneNumber = parsed.data.phoneNumber!;
      const duplicate = await getAdvisorByPhone(auth.tenantId, phoneNumber);
      if (duplicate) {
        return badRequest("An advisor with this phone number already exists");
      }

      advisor = {
        advisorId: randomUUID(),
        tenantId: auth.tenantId,
        name,
        phoneNumber,
        status: "active",
        cognitoUserId: invited.cognitoUserId,
        createdAt: now,
        updatedAt: now,
      };
      await createAdvisor(advisor);
    }

    const member: TenantMember = {
      userId: invited.cognitoUserId,
      username: invited.username,
      email,
      name,
      role,
      enabled: true,
      createdAt: now,
      ...(teamIds.length ? { teamIds } : {}),
      ...(advisor ? { advisorId: advisor.advisorId } : {}),
    };
    await putMember(member, auth.tenantId);

    if (teamIds.length) {
      if (role === "supervisor") {
        await syncSupervisorTeamMembership(auth.tenantId, member.userId, teamIds);
      } else {
        await syncMemberTeamMembership(auth.tenantId, member.userId, teamIds);
      }
    }

    const invite = await sendInviteEmail({
      to: email,
      name,
      tenantId: auth.tenantId,
      temporaryPassword: invited.temporaryPassword,
      role,
    });

    return created({
      member,
      ...(advisor ? { advisor } : {}),
      invite: {
        email,
        ...invite,
      },
    });
  }

  if (method === "PATCH" && userId && rawPath.includes("/tenants/me/members/")) {
    if (managedUserIds) {
      assertSupervisorCanManageUser(auth, userId, managedUserIds);
    }

    const target = await getMember(auth.tenantId, userId);
    if (!target) {
      return notFound("Member not found");
    }

    const body = parseJsonBody(event);
    const parsed = UpdateMemberSchema.safeParse(body);
    if (!parsed.success) {
      return badRequest(formatZodError(parsed.error));
    }

    if (auth.role === "supervisor") {
      if (parsed.data.role !== undefined || parsed.data.enabled !== undefined) {
        return forbidden("Supervisor cannot change role or status");
      }
      if (target.role === "member") {
        return forbidden("Supervisor cannot manage administrators");
      }
    }

    if (parsed.data.enabled === false && userId === auth.userId) {
      return forbidden("You cannot disable your own account");
    }

    if (
      parsed.data.role !== undefined &&
      parsed.data.role !== target.role &&
      auth.role !== "member"
    ) {
      return forbidden("Only administrators can change roles");
    }

    if (target.role === "member" && parsed.data.enabled === false) {
      const adminCount = await countMembersByRole(auth.tenantId, "member");
      if (adminCount <= 1) {
        return badRequest("Cannot disable the last account administrator");
      }
    }

    if (parsed.data.teamIds) {
      await assertTeamIdsBelongToTenant(auth.tenantId, parsed.data.teamIds);
    }

    if (parsed.data.role === "advisor" && !target.advisorId) {
      await assertAssignedServices(auth.tenantId, "advisors");
      const phoneNumber = parsed.data.phoneNumber;
      if (!phoneNumber) {
        return badRequest("phoneNumber is required when changing role to advisor");
      }
      const duplicate = await getAdvisorByPhone(auth.tenantId, phoneNumber);
      if (duplicate) {
        return badRequest("An advisor with this phone number already exists");
      }
      const now = new Date().toISOString();
      const advisor: Advisor = {
        advisorId: randomUUID(),
        tenantId: auth.tenantId,
        name: parsed.data.name ?? target.name,
        phoneNumber,
        status: "active",
        cognitoUserId: userId,
        createdAt: now,
        updatedAt: now,
      };
      await createAdvisor(advisor);
      await updateMember(auth.tenantId, userId, { advisorId: advisor.advisorId });
    }

    const nextRole = parsed.data.role ?? target.role;
    const cognitoUpdates: { enabled?: boolean; role?: string; name?: string } = {};
    if (parsed.data.enabled !== undefined) cognitoUpdates.enabled = parsed.data.enabled;
    if (parsed.data.role !== undefined) cognitoUpdates.role = parsed.data.role;
    if (parsed.data.name !== undefined) cognitoUpdates.name = parsed.data.name;

    if (Object.keys(cognitoUpdates).length > 0) {
      await updateCognitoUserBySub(userId, cognitoUpdates);
    }

    if (target.advisorId && parsed.data.enabled !== undefined) {
      await updateAdvisor(auth.tenantId, target.advisorId, {
        status: parsed.data.enabled ? "active" : "inactive",
        ...(parsed.data.name ? { name: parsed.data.name } : {}),
      });
    }

    const memberUpdates: Partial<TenantMember> = {};
    if (parsed.data.name !== undefined) memberUpdates.name = parsed.data.name;
    if (parsed.data.role !== undefined) memberUpdates.role = parsed.data.role;
    if (parsed.data.enabled !== undefined) memberUpdates.enabled = parsed.data.enabled;
    if (parsed.data.teamIds !== undefined) memberUpdates.teamIds = parsed.data.teamIds;

    const updated = await updateMember(auth.tenantId, userId, memberUpdates);
    if (!updated) return notFound("Member not found");

    if (parsed.data.teamIds !== undefined) {
      if (nextRole === "supervisor") {
        await syncSupervisorTeamMembership(auth.tenantId, userId, parsed.data.teamIds);
      } else {
        await syncMemberTeamMembership(auth.tenantId, userId, parsed.data.teamIds);
      }
    }

    return ok(updated);
  }

  if (method === "DELETE" && userId && rawPath.includes("/tenants/me/members/")) {
    if (auth.role === "supervisor") {
      return forbidden("Supervisor cannot remove users");
    }

    if (userId === auth.userId) {
      return forbidden("You cannot remove yourself from the account");
    }

    await upsertCurrentUser(auth);
    const target = await getMember(auth.tenantId, userId);
    if (!target) {
      const advisors = await listAdvisors(auth.tenantId);
      const legacy = advisors.find((a) => a.cognitoUserId === userId);
      if (!legacy) {
        return notFound("Member not found");
      }
    }

    const resolved =
      target ??
      ({
        userId,
        role: "advisor" as const,
        advisorId: (await listAdvisors(auth.tenantId)).find((a) => a.cognitoUserId === userId)
          ?.advisorId,
      } as TenantMember);

    if (resolved.role === "member") {
      const memberCount = await countMembersByRole(auth.tenantId, "member");
      if (memberCount <= 1) {
        return badRequest("Cannot remove the last account administrator");
      }
    }

    try {
      await deleteCognitoUserBySub(userId);
    } catch {
      // Member record is still removed even if Cognito delete fails.
    }

    if (resolved.advisorId) {
      await deleteAdvisor(auth.tenantId, resolved.advisorId);
    } else if (resolved.role === "advisor") {
      const advisor = await listAdvisors(auth.tenantId).then((items) =>
        items.find((a) => a.cognitoUserId === userId)
      );
      if (advisor) {
        await deleteAdvisor(auth.tenantId, advisor.advisorId);
      }
    }

    await removeUserFromAllTeams(auth.tenantId, userId);
    await deleteMember(auth.tenantId, userId);
    return noContent();
  }

  return badRequest("Route not found");
}
