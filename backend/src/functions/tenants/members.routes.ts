import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyResultV2 } from "aws-lambda";
import { z } from "zod";
import { randomUUID } from "crypto";
import type { Advisor, AuthContext, TenantMember } from "../../types/index.js";
import { assertMemberRole } from "../../lib/auth/cognito.js";
import { ensureTenant, getTenant } from "../../lib/dynamodb/tenant.repository.js";
import {
  countMembersByRole,
  deleteMember,
  getMember,
  listMembers,
  putMember,
} from "../../lib/dynamodb/member.repository.js";
import {
  createAdvisor,
  deleteAdvisor,
  getAdvisorByPhone,
  listAdvisors,
} from "../../lib/dynamodb/advisor.repository.js";
import { inviteMemberUser } from "../../lib/cognito/invite-member.js";
import { inviteAdvisorUser } from "../../lib/cognito/invite-advisor.js";
import { deleteCognitoUserBySub } from "../../lib/cognito/admin-users.js";
import { resolveBranding } from "../../lib/branding/resolve.js";
import { sendMemberInviteEmail } from "../../lib/email/member-invite.js";
import { assertAssignedServices } from "../../lib/billing/subaccount-services.js";
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
    role: z.enum(["member", "advisor"]),
    phoneNumber: z.string().min(8).max(20).optional(),
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

function formatZodError(error: z.ZodError): string {
  return error.issues.map((issue) => issue.message).join("; ") || "Invalid input";
}

async function upsertCurrentUser(auth: AuthContext): Promise<void> {
  if (auth.role !== "member" && auth.role !== "advisor") return;

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
      role: auth.role,
      enabled: true,
      createdAt: existing?.createdAt ?? now,
      ...(advisorId ? { advisorId } : {}),
      ...(existing?.lastLoginAt ? { lastLoginAt: existing.lastLoginAt } : {}),
    },
    auth.tenantId
  );
}

async function buildUnifiedMemberList(tenantId: string): Promise<TenantMember[]> {
  const members = await listMembers(tenantId);
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
    });
  }

  return [...byUserId.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

async function sendInviteEmail(params: {
  to: string;
  name: string;
  tenantId: string;
  temporaryPassword: string;
  role: "member" | "advisor";
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

export async function handleMemberRoutes(
  event: APIGatewayProxyEventV2WithJWTAuthorizer,
  method: string,
  auth: AuthContext
): Promise<APIGatewayProxyResultV2 | null> {
  const rawPath = event.rawPath ?? "";
  if (!rawPath.includes("/tenants/me/members")) return null;

  assertMemberRole(auth);
  await ensureTenant(auth.tenantId, auth.email, auth.name);

  const userId = event.pathParameters?.userId;

  if (method === "GET" && rawPath.endsWith("/tenants/me/members") && !userId) {
    await upsertCurrentUser(auth);
    const members = await buildUnifiedMemberList(auth.tenantId);
    return ok({ members, currentUserId: auth.userId });
  }

  if (method === "POST" && rawPath.endsWith("/tenants/me/members")) {
    const body = parseJsonBody(event);
    const parsed = CreateMemberSchema.safeParse(body);
    if (!parsed.success) {
      return badRequest(formatZodError(parsed.error));
    }

    if (parsed.data.role === "advisor") {
      await assertAssignedServices(auth.tenantId, "advisors");
    }

    const now = new Date().toISOString();
    const { name, email, role } = parsed.data;

    if (role === "member") {
      const invited = await inviteMemberUser({
        email,
        name,
        tenantId: auth.tenantId,
      });

      const member: TenantMember = {
        userId: invited.cognitoUserId,
        username: invited.username,
        email,
        name,
        role: "member",
        enabled: true,
        createdAt: now,
      };
      await putMember(member, auth.tenantId);

      const invite = await sendInviteEmail({
        to: email,
        name,
        tenantId: auth.tenantId,
        temporaryPassword: invited.temporaryPassword,
        role: "member",
      });

      return created({
        member,
        invite: {
          email,
          ...invite,
        },
      });
    }

    const phoneNumber = parsed.data.phoneNumber!;
    const duplicate = await getAdvisorByPhone(auth.tenantId, phoneNumber);
    if (duplicate) {
      return badRequest("An advisor with this phone number already exists");
    }

    const invited = await inviteAdvisorUser({
      email,
      name,
      tenantId: auth.tenantId,
    });

    const advisor: Advisor = {
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

    const member: TenantMember = {
      userId: invited.cognitoUserId,
      username: invited.username,
      email,
      name,
      role: "advisor",
      enabled: true,
      createdAt: now,
      advisorId: advisor.advisorId,
    };
    await putMember(member, auth.tenantId);

    const invite = await sendInviteEmail({
      to: email,
      name,
      tenantId: auth.tenantId,
      temporaryPassword: invited.temporaryPassword,
      role: "advisor",
    });

    return created({
      member,
      advisor,
      invite: {
        email,
        ...invite,
      },
    });
  }

  if (method === "DELETE" && userId && rawPath.includes("/tenants/me/members/")) {
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

    await deleteMember(auth.tenantId, userId);
    return noContent();
  }

  return badRequest("Route not found");
}
