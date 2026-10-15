import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyEventV2WithJWTAuthorizer,
  APIGatewayProxyResultV2,
} from "aws-lambda";
import { z } from "zod";
import { assertMemberRole, resolveRequestAuth } from "../../lib/auth/cognito.js";
import { assertAssignedServices } from "../../lib/billing/subaccount-services.js";
import { writeAuditEvent } from "../../lib/audit/write-audit-event.js";
import { ensureTenant } from "../../lib/dynamodb/tenant.repository.js";
import {
  createTenantGoogleDriveFolder,
  disconnectGoogleDrive,
  getGoogleDriveConnectionView,
  getTenantGoogleDriveFile,
  handleGoogleDriveOAuthCallback,
  listTenantGoogleDriveFiles,
  startGoogleDriveOAuth,
  updateGoogleDriveSettings,
  updateTenantGoogleDriveFile,
  uploadTenantGoogleDriveFile,
} from "../../lib/google-drive/service.js";
import {
  createTenantOneDriveFolder,
  disconnectOneDrive,
  getOneDriveConnectionView,
  getTenantOneDriveFile,
  handleOneDriveOAuthCallback,
  listTenantOneDriveFiles,
  startOneDriveOAuth,
  updateOneDriveSettings,
  updateTenantOneDriveFile,
  uploadTenantOneDriveFile,
} from "../../lib/onedrive/service.js";
import {
  badRequest,
  created,
  handleError,
  ok,
  parseJsonBody,
  redirect,
} from "../../lib/http.js";

const ENVIRONMENT = process.env.ENVIRONMENT ?? "dev";

const PatchSchema = z.object({
  enabled: z.boolean().optional(),
});

const UploadSchema = z.object({
  name: z.string().min(1).max(255),
  mimeType: z.string().min(1).max(255).default("application/octet-stream"),
  contentBase64: z.string().min(1).max(7_000_000),
  parentId: z.string().min(1).max(256).optional(),
});

const UpdateFileSchema = z
  .object({
    name: z.string().min(1).max(255).optional(),
    mimeType: z.string().min(1).max(255).optional(),
    contentBase64: z.string().min(1).max(7_000_000).optional(),
  })
  .refine((value) => Boolean(value.name || value.contentBase64), {
    message: "Provide name and/or contentBase64",
  });

const FolderSchema = z.object({
  name: z.string().min(1).max(255),
  parentId: z.string().min(1).max(256).optional(),
});

function queryValue(
  event: APIGatewayProxyEventV2,
  key: string
): string | undefined {
  return event.queryStringParameters?.[key]?.trim() || undefined;
}

async function handlePublicRoutes(
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyResultV2 | null> {
  const method = event.requestContext.http.method;
  const rawPath = event.rawPath ?? event.requestContext.http.path ?? "";

  if (
    method === "GET" &&
    (rawPath.includes("/public/integrations/drive/google-drive/oauth/callback") ||
      rawPath.includes("/public/integrations/google-drive/oauth/callback"))
  ) {
    const code = queryValue(event, "code") ?? "";
    const state = queryValue(event, "state") ?? "";
    const oauthError = queryValue(event, "error");
    if (oauthError) {
      return redirect(
        `${(process.env.FRONTEND_URL ?? "http://localhost:3000").replace(/\/$/, "")}/apps/google-drive?error=${encodeURIComponent(oauthError)}`
      );
    }
    if (!code || !state) {
      return redirect(
        `${(process.env.FRONTEND_URL ?? "http://localhost:3000").replace(/\/$/, "")}/apps/google-drive?error=missing_oauth_params`
      );
    }
    const redirectUrl = await handleGoogleDriveOAuthCallback(code, state, ENVIRONMENT);
    return redirect(redirectUrl);
  }

  if (
    method === "GET" &&
    (rawPath.includes("/public/integrations/drive/onedrive/oauth/callback") ||
      rawPath.includes("/public/integrations/onedrive/oauth/callback"))
  ) {
    const code = queryValue(event, "code") ?? "";
    const state = queryValue(event, "state") ?? "";
    const oauthError = queryValue(event, "error");
    if (oauthError) {
      return redirect(
        `${(process.env.FRONTEND_URL ?? "http://localhost:3000").replace(/\/$/, "")}/apps/onedrive?error=${encodeURIComponent(oauthError)}`
      );
    }
    if (!code || !state) {
      return redirect(
        `${(process.env.FRONTEND_URL ?? "http://localhost:3000").replace(/\/$/, "")}/apps/onedrive?error=missing_oauth_params`
      );
    }
    const redirectUrl = await handleOneDriveOAuthCallback(code, state, ENVIRONMENT);
    return redirect(redirectUrl);
  }

  return null;
}

function matchProvider(rawPath: string): "google-drive" | "onedrive" | null {
  if (rawPath.includes("/drive/google-drive")) return "google-drive";
  if (rawPath.includes("/drive/onedrive")) return "onedrive";
  return null;
}

export async function handler(
  event: APIGatewayProxyEventV2WithJWTAuthorizer
): Promise<APIGatewayProxyResultV2> {
  try {
    const publicResponse = await handlePublicRoutes(event);
    if (publicResponse) return publicResponse;

    const method = event.requestContext.http.method;
    const rawPath = event.rawPath ?? event.requestContext.http.path ?? "";
    const provider = matchProvider(rawPath);
    if (!provider) {
      return badRequest("Route not found");
    }

    const auth = await resolveRequestAuth(event);
    assertMemberRole(auth);
    await assertAssignedServices(auth.tenantId, "apps");
    await ensureTenant(auth.tenantId, auth.email, auth.name);

    if (method === "GET" && rawPath.endsWith("/connection")) {
      const view =
        provider === "google-drive"
          ? await getGoogleDriveConnectionView(auth.tenantId, ENVIRONMENT)
          : await getOneDriveConnectionView(auth.tenantId, ENVIRONMENT);
      return ok(view);
    }

    if (method === "POST" && rawPath.endsWith("/oauth/start")) {
      const result =
        provider === "google-drive"
          ? await startGoogleDriveOAuth(auth.tenantId)
          : await startOneDriveOAuth(auth.tenantId);
      return ok(result);
    }

    if (method === "PATCH" && rawPath.endsWith("/connection")) {
      const body = parseJsonBody(event);
      const parsed = PatchSchema.safeParse(body);
      if (!parsed.success) {
        return badRequest(parsed.error.issues.map((i) => i.message).join("; "));
      }
      const patch =
        parsed.data.enabled !== undefined ? { enabled: parsed.data.enabled } : {};
      const view =
        provider === "google-drive"
          ? await updateGoogleDriveSettings(auth.tenantId, ENVIRONMENT, patch)
          : await updateOneDriveSettings(auth.tenantId, ENVIRONMENT, patch);
      await writeAuditEvent({
        tenantId: auth.tenantId,
        actorUserId: auth.userId,
        actorEmail: auth.email,
        module: "settings",
        action: "update",
        entityType: provider,
        entityId: auth.tenantId,
        summary: `Updated ${provider} settings`,
      });
      return ok(view);
    }

    if (method === "DELETE" && rawPath.endsWith("/connection")) {
      const view =
        provider === "google-drive"
          ? await disconnectGoogleDrive(auth.tenantId, ENVIRONMENT)
          : await disconnectOneDrive(auth.tenantId, ENVIRONMENT);
      await writeAuditEvent({
        tenantId: auth.tenantId,
        actorUserId: auth.userId,
        actorEmail: auth.email,
        module: "settings",
        action: "delete",
        entityType: provider,
        entityId: auth.tenantId,
        summary: `Disconnected ${provider}`,
      });
      return ok(view);
    }

    if (
      (method === "GET" || method === "PATCH") &&
      /\/files\/[^/]+$/.test(rawPath) &&
      !rawPath.endsWith("/files")
    ) {
      const fileId = decodeURIComponent(rawPath.split("/").pop() ?? "");
      if (!fileId) return badRequest("fileId is required");

      if (method === "GET") {
        const file =
          provider === "google-drive"
            ? await getTenantGoogleDriveFile(auth.tenantId, ENVIRONMENT, fileId)
            : await getTenantOneDriveFile(auth.tenantId, ENVIRONMENT, fileId);
        return ok(file);
      }

      const body = parseJsonBody(event);
      const parsed = UpdateFileSchema.safeParse(body);
      if (!parsed.success) {
        return badRequest(parsed.error.issues.map((i) => i.message).join("; "));
      }
      const updatePayload = {
        ...(parsed.data.name ? { name: parsed.data.name } : {}),
        ...(parsed.data.mimeType ? { mimeType: parsed.data.mimeType } : {}),
        ...(parsed.data.contentBase64 ? { contentBase64: parsed.data.contentBase64 } : {}),
      };
      const file =
        provider === "google-drive"
          ? await updateTenantGoogleDriveFile(auth.tenantId, ENVIRONMENT, fileId, updatePayload)
          : await updateTenantOneDriveFile(auth.tenantId, ENVIRONMENT, fileId, updatePayload);
      await writeAuditEvent({
        tenantId: auth.tenantId,
        actorUserId: auth.userId,
        actorEmail: auth.email,
        module: "settings",
        action: "update",
        entityType: provider,
        entityId: file.id,
        summary: `Updated file in ${provider}`,
      });
      return ok(file);
    }

    if (method === "GET" && rawPath.endsWith("/files")) {
      const folderId = queryValue(event, "folderId");
      const pageToken = queryValue(event, "pageToken");
      const query = queryValue(event, "query");
      const options = {
        ...(folderId ? { folderId } : {}),
        ...(pageToken ? { pageToken } : {}),
        ...(query ? { query } : {}),
      };
      const result =
        provider === "google-drive"
          ? await listTenantGoogleDriveFiles(auth.tenantId, ENVIRONMENT, options)
          : await listTenantOneDriveFiles(auth.tenantId, ENVIRONMENT, options);
      return ok(result);
    }

    if (method === "POST" && rawPath.endsWith("/files")) {
      const body = parseJsonBody(event);
      const parsed = UploadSchema.safeParse(body);
      if (!parsed.success) {
        return badRequest(parsed.error.issues.map((i) => i.message).join("; "));
      }
      const uploadPayload = {
        name: parsed.data.name,
        mimeType: parsed.data.mimeType,
        contentBase64: parsed.data.contentBase64,
        ...(parsed.data.parentId ? { parentId: parsed.data.parentId } : {}),
      };
      const file =
        provider === "google-drive"
          ? await uploadTenantGoogleDriveFile(auth.tenantId, ENVIRONMENT, uploadPayload)
          : await uploadTenantOneDriveFile(auth.tenantId, ENVIRONMENT, uploadPayload);
      await writeAuditEvent({
        tenantId: auth.tenantId,
        actorUserId: auth.userId,
        actorEmail: auth.email,
        module: "settings",
        action: "create",
        entityType: provider,
        entityId: file.id,
        summary: `Uploaded file to ${provider}`,
      });
      return created(file);
    }

    if (method === "POST" && rawPath.endsWith("/folders")) {
      const body = parseJsonBody(event);
      const parsed = FolderSchema.safeParse(body);
      if (!parsed.success) {
        return badRequest(parsed.error.issues.map((i) => i.message).join("; "));
      }
      const folderPayload = {
        name: parsed.data.name,
        ...(parsed.data.parentId ? { parentId: parsed.data.parentId } : {}),
      };
      const folder =
        provider === "google-drive"
          ? await createTenantGoogleDriveFolder(auth.tenantId, ENVIRONMENT, folderPayload)
          : await createTenantOneDriveFolder(auth.tenantId, ENVIRONMENT, folderPayload);
      await writeAuditEvent({
        tenantId: auth.tenantId,
        actorUserId: auth.userId,
        actorEmail: auth.email,
        module: "settings",
        action: "create",
        entityType: provider,
        entityId: folder.id,
        summary: `Created folder in ${provider}`,
      });
      return created(folder);
    }

    return badRequest("Route not found");
  } catch (error) {
    return handleError(error);
  }
}
