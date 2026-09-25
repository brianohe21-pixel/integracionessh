import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyResultV2 } from "aws-lambda";
import { z } from "zod";
import { randomUUID } from "crypto";
import {
  createAdvisor,
  deleteAdvisor,
  getAdvisor,
  getAdvisorByPhone,
  listAdvisors,
  updateAdvisor,
} from "../../lib/dynamodb/advisor.repository.js";
import { listMembers, deleteMember, updateMember } from "../../lib/dynamodb/member.repository.js";
import {
  resolveRequestAuth,
  assertTenantManagerRole,
  assertAdvisorOrMember,
} from "../../lib/auth/cognito.js";
import { assertAssignedServices } from "../../lib/billing/subaccount-services.js";
import { inviteAdvisorUser } from "../../lib/cognito/invite-advisor.js";
import { deleteCognitoUserBySub, updateCognitoUserBySub } from "../../lib/cognito/admin-users.js";
import { getTenant } from "../../lib/dynamodb/tenant.repository.js";
import { resolveBranding } from "../../lib/branding/resolve.js";
import { sendAdvisorInviteEmail } from "../../lib/email/advisor-invite.js";
import { syncAdvisorMemberRecord } from "../../lib/members/sync-advisor-member.js";
import { ok, created, noContent, badRequest, notFound, handleError } from "../../lib/http.js";
import type { Advisor } from "../../types/index.js";

function enrichAdvisorsWithLastLogin(
  advisors: Advisor[],
  members: Awaited<ReturnType<typeof listMembers>>
): Advisor[] {
  const lastLoginByUserId = new Map(
    members
      .filter((member) => member.lastLoginAt)
      .map((member) => [member.userId, member.lastLoginAt!])
  );

  return advisors.map((advisor) => {
    if (!advisor.cognitoUserId) return advisor;
    const lastLoginAt = lastLoginByUserId.get(advisor.cognitoUserId);
    return lastLoginAt ? { ...advisor, lastLoginAt } : advisor;
  });
}

const CreateAdvisorSchema = z.object({
  name: z.string().min(1).max(128),
  phoneNumber: z.string().min(8).max(20),
  botIds: z.array(z.string().uuid()).optional(),
  inviteEmail: z.string().email().optional(),
});

const UpdateAdvisorSchema = z.object({
  name: z.string().min(1).max(128).optional(),
  phoneNumber: z.string().min(8).max(20).optional(),
  botIds: z.array(z.string().uuid()).optional(),
  status: z.enum(["active", "inactive"]).optional(),
});

export async function handler(
  event: APIGatewayProxyEventV2WithJWTAuthorizer
): Promise<APIGatewayProxyResultV2> {
  try {
    const auth = await resolveRequestAuth(event);
    const method = event.requestContext.http.method;
    const advisorId = event.pathParameters?.advisorId;

    if (method === "GET") {
      assertAdvisorOrMember(auth);
      await assertAssignedServices(auth.tenantId, [
        "advisors",
        "sales",
        "conversations",
        "contactCenter",
      ]);

      if (!advisorId) {
        const [advisors, members] = await Promise.all([
          listAdvisors(auth.tenantId),
          listMembers(auth.tenantId),
        ]);
        return ok(enrichAdvisorsWithLastLogin(advisors, members));
      }

      const advisor = await getAdvisor(auth.tenantId, advisorId);
      if (!advisor) return notFound("Advisor not found");
      return ok(advisor);
    }

    assertTenantManagerRole(auth);
    await assertAssignedServices(auth.tenantId, "advisors");

    if (method === "POST") {
      const body = JSON.parse(event.body ?? "{}");
      const parsed = CreateAdvisorSchema.safeParse(body);
      if (!parsed.success) return badRequest(parsed.error.message);

      const duplicate = await getAdvisorByPhone(auth.tenantId, parsed.data.phoneNumber);
      if (duplicate) return badRequest("An advisor with this phone number already exists");

      const now = new Date().toISOString();
      const advisor: Advisor = {
        advisorId: randomUUID(),
        tenantId: auth.tenantId,
        name: parsed.data.name,
        phoneNumber: parsed.data.phoneNumber,
        status: "active",
        createdAt: now,
        updatedAt: now,
        ...(parsed.data.botIds?.length ? { botIds: parsed.data.botIds } : {}),
      };

      if (parsed.data.inviteEmail) {
        const invited = await inviteAdvisorUser({
          email: parsed.data.inviteEmail,
          name: parsed.data.name,
          tenantId: auth.tenantId,
        });
        advisor.cognitoUserId = invited.cognitoUserId;
        await createAdvisor(advisor);

        await syncAdvisorMemberRecord({
          tenantId: auth.tenantId,
          cognitoUserId: invited.cognitoUserId,
          username: invited.username,
          email: parsed.data.inviteEmail,
          name: parsed.data.name,
          advisorId: advisor.advisorId,
        });

        const tenant = await getTenant(auth.tenantId);
        const tenantName = tenant ? resolveBranding(tenant).brandName : "la plataforma";
        let emailSent = false;
        let emailFailureReason: string | undefined;
        try {
          const emailResult = await sendAdvisorInviteEmail({
            to: parsed.data.inviteEmail,
            advisorName: parsed.data.name,
            tenantName,
            temporaryPassword: invited.temporaryPassword,
          });
          emailSent = emailResult.sent;
          emailFailureReason = emailResult.failureReason;
        } catch (error) {
          console.error("Advisor invite email failed:", error);
          emailFailureReason = "send_failed";
        }

        return created({
          advisor,
          invite: {
            username: invited.username,
            email: parsed.data.inviteEmail,
            emailSent,
            ...(emailFailureReason ? { emailFailureReason } : {}),
          },
        });
      }

      await createAdvisor(advisor);
      return created({ advisor });
    }

    if (method === "PUT" && advisorId) {
      const existing = await getAdvisor(auth.tenantId, advisorId);
      if (!existing) return notFound("Advisor not found");

      const body = JSON.parse(event.body ?? "{}");
      const parsed = UpdateAdvisorSchema.safeParse(body);
      if (!parsed.success) return badRequest(parsed.error.message);

      if (parsed.data.phoneNumber && parsed.data.phoneNumber !== existing.phoneNumber) {
        const duplicate = await getAdvisorByPhone(auth.tenantId, parsed.data.phoneNumber);
        if (duplicate && duplicate.advisorId !== advisorId) {
          return badRequest("An advisor with this phone number already exists");
        }
      }

      const updates: Parameters<typeof updateAdvisor>[2] = {};
      if (parsed.data.name !== undefined) updates.name = parsed.data.name;
      if (parsed.data.phoneNumber !== undefined) updates.phoneNumber = parsed.data.phoneNumber;
      if (parsed.data.botIds !== undefined) updates.botIds = parsed.data.botIds;
      if (parsed.data.status !== undefined) updates.status = parsed.data.status;

      const updated = await updateAdvisor(auth.tenantId, advisorId, updates);
      if (!updated) return notFound("Advisor not found");

      if (
        existing.cognitoUserId &&
        parsed.data.name !== undefined &&
        parsed.data.name !== existing.name
      ) {
        try {
          await updateCognitoUserBySub(existing.cognitoUserId, { name: parsed.data.name });
        } catch {
          // Advisor name is still updated even if Cognito rename fails.
        }
        try {
          await updateMember(auth.tenantId, existing.cognitoUserId, { name: parsed.data.name });
        } catch {
          // Advisor name is still updated even if member rename fails.
        }
      }

      return ok(updated);
    }

    if (method === "DELETE" && advisorId) {
      const existing = await getAdvisor(auth.tenantId, advisorId);
      if (!existing) return notFound("Advisor not found");

      if (existing.cognitoUserId) {
        try {
          await deleteCognitoUserBySub(existing.cognitoUserId);
        } catch {
          // Advisor record is still removed even if Cognito delete fails.
        }
        try {
          await deleteMember(auth.tenantId, existing.cognitoUserId);
        } catch {
          // Advisor record is still removed even if member delete fails.
        }
      }

      await deleteAdvisor(auth.tenantId, advisorId);
      return noContent();
    }

    return badRequest("Route not found");
  } catch (error) {
    return handleError(error);
  }
}
