import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyResultV2 } from "aws-lambda";
import { z } from "zod";
import type { AuthContext, TenantMember, TenantMemberRole, UserProfile } from "../../types/index.js";
import { getMember, putMember, updateMember } from "../../lib/dynamodb/member.repository.js";
import {
  findAdvisorByCognitoUserId,
  getAdvisor,
  updateAdvisor,
} from "../../lib/dynamodb/advisor.repository.js";
import {
  extensionForContentType,
  normalizeLogoContentType,
} from "../../lib/branding/resolve.js";
import {
  buildMemberProfilePhotoS3Key,
  deleteObject,
  getPresignedReadUrl,
  putObjectBuffer,
} from "../../lib/s3/client.js";
import { badRequest, notFound, ok, parseJsonBody } from "../../lib/http.js";

const ProfilePhotoUploadSchema = z.object({
  contentType: z.string().min(1),
  data: z.string().min(1).max(2_500_000),
});

const AdvisorStatusSchema = z.object({
  status: z.enum(["active", "inactive"]),
});

function formatZodError(error: z.ZodError): string {
  return error.issues.map((issue) => issue.message).join("; ") || "Invalid input";
}

function normalizeProfilePhotoContentType(contentType: string): string | null {
  const normalized = normalizeLogoContentType(contentType);
  if (!normalized || normalized === "image/svg+xml") return null;
  return normalized;
}

async function ensureMember(auth: AuthContext): Promise<TenantMember> {
  const existing = await getMember(auth.tenantId, auth.userId);
  if (existing) return existing;

  const now = new Date().toISOString();
  const role: TenantMemberRole =
    auth.role === "advisor" || auth.role === "supervisor" ? auth.role : "member";
  const member: TenantMember = {
    userId: auth.userId,
    username: auth.email,
    email: auth.email,
    name: auth.name ?? auth.email,
    role,
    enabled: true,
    createdAt: now,
  };
  await putMember(member, auth.tenantId);
  return member;
}

async function resolveProfilePhotoUrl(profilePhotoS3Key?: string): Promise<string | undefined> {
  if (!profilePhotoS3Key) return undefined;
  try {
    return await getPresignedReadUrl(profilePhotoS3Key);
  } catch (error) {
    console.error("Failed to resolve profile photo URL", { profilePhotoS3Key, error });
    return undefined;
  }
}

async function resolveLinkedAdvisor(auth: AuthContext, member: TenantMember) {
  if (member.advisorId) {
    const byId = await getAdvisor(auth.tenantId, member.advisorId);
    if (byId) return byId;
  }
  return findAdvisorByCognitoUserId(auth.tenantId, auth.userId);
}

async function toUserProfile(auth: AuthContext, member: TenantMember): Promise<UserProfile> {
  const profilePhotoUrl = await resolveProfilePhotoUrl(member.profilePhotoS3Key);
  const advisor = await resolveLinkedAdvisor(auth, member);
  return {
    userId: member.userId,
    email: member.email,
    name: member.name,
    role: member.role,
    ...(profilePhotoUrl ? { profilePhotoUrl } : {}),
    ...(advisor
      ? { advisorId: advisor.advisorId, advisorStatus: advisor.status }
      : {}),
  };
}

export async function handleProfileRoutes(
  event: APIGatewayProxyEventV2WithJWTAuthorizer,
  method: string,
  auth: AuthContext
): Promise<APIGatewayProxyResultV2 | null> {
  const rawPath = event.rawPath ?? event.requestContext.http.path ?? "";
  if (!rawPath.includes("/tenants/me/profile")) return null;

  const member = await ensureMember(auth);

  if (method === "GET" && rawPath.endsWith("/tenants/me/profile")) {
    return ok(await toUserProfile(auth, member));
  }

  if (method === "PATCH" && rawPath.endsWith("/tenants/me/profile/advisor-status")) {
    const body = parseJsonBody(event);
    const parsed = AdvisorStatusSchema.safeParse(body);
    if (!parsed.success) {
      return badRequest(formatZodError(parsed.error));
    }

    const advisor = await resolveLinkedAdvisor(auth, member);
    if (!advisor) return notFound("Advisor profile not found");

    const updated = await updateAdvisor(auth.tenantId, advisor.advisorId, {
      status: parsed.data.status,
    });
    if (!updated) return notFound("Advisor not found");

    if (!member.advisorId) {
      await updateMember(auth.tenantId, auth.userId, { advisorId: updated.advisorId });
    }

    return ok(await toUserProfile(auth, { ...member, advisorId: updated.advisorId }));
  }

  if (method === "POST" && rawPath.endsWith("/tenants/me/profile/photo")) {
    const body = parseJsonBody(event);
    const parsed = ProfilePhotoUploadSchema.safeParse(body);
    if (!parsed.success) {
      return badRequest(formatZodError(parsed.error));
    }

    let bytes: Buffer;
    try {
      bytes = Buffer.from(parsed.data.data, "base64");
    } catch {
      return badRequest("Invalid photo data");
    }
    if (bytes.byteLength === 0) return badRequest("Empty photo file");
    if (bytes.byteLength > 1_500_000) return badRequest("Photo must be 1.5MB or smaller");

    const contentType = normalizeProfilePhotoContentType(parsed.data.contentType);
    if (!contentType) {
      return badRequest("Unsupported photo format. Use PNG, JPEG, or WebP.");
    }

    const ext = extensionForContentType(contentType);
    const profilePhotoS3Key = buildMemberProfilePhotoS3Key(auth.tenantId, auth.userId, ext);

    if (member.profilePhotoS3Key && member.profilePhotoS3Key !== profilePhotoS3Key) {
      await deleteObject(member.profilePhotoS3Key);
    }

    await putObjectBuffer(profilePhotoS3Key, bytes, contentType);

    const updated =
      (await updateMember(auth.tenantId, auth.userId, { profilePhotoS3Key })) ?? {
        ...member,
        profilePhotoS3Key,
      };

    return ok(await toUserProfile(auth, updated));
  }

  if (method === "DELETE" && rawPath.endsWith("/tenants/me/profile/photo")) {
    if (member.profilePhotoS3Key) {
      await deleteObject(member.profilePhotoS3Key);
    }
    const updated: TenantMember = { ...member };
    delete updated.profilePhotoS3Key;
    await putMember(updated, auth.tenantId);
    return ok(await toUserProfile(auth, updated));
  }

  return badRequest("Route not found");
}
