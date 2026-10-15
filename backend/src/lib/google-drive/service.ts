import { randomUUID } from "crypto";
import {
  consumeGoogleDriveOAuthState,
  putGoogleDriveOAuthState,
} from "../dynamodb/google-drive-oauth.repository.js";
import {
  deleteGoogleDriveConfig,
  getGoogleDriveConfig,
  upsertGoogleDriveConfig,
} from "../dynamodb/google-drive.repository.js";
import type { CloudDriveFileItem, GoogleDriveConfig } from "../../types/index.js";
import {
  buildOAuthUrl,
  createGoogleDriveFolder,
  exchangeCodeForTokens,
  generatePkcePair,
  getGoogleDriveFile,
  getGoogleUserEmail,
  listGoogleDriveFiles,
  revokeToken,
  updateGoogleDriveFile,
  uploadGoogleDriveFile,
} from "./client.js";
import {
  deleteGoogleDriveTokens,
  getGoogleDriveTokens,
  saveGoogleDriveTokens,
} from "./secrets.js";
import { resolveGoogleDriveAccessToken } from "./token.js";

export interface GoogleDriveConnectionView {
  connected: boolean;
  configured: boolean;
  enabled: boolean;
  status?: GoogleDriveConfig["status"];
  accountEmail?: string;
  connectedAt?: string;
  lastError?: string;
}

function frontendBaseUrl(): string {
  return (process.env.FRONTEND_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

function defaultConfig(tenantId: string): GoogleDriveConfig {
  const now = new Date().toISOString();
  return {
    tenantId,
    status: "disconnected",
    enabled: false,
    createdAt: now,
    updatedAt: now,
  };
}

function toView(config: GoogleDriveConfig | null, hasTokens: boolean): GoogleDriveConnectionView {
  if (!config) {
    return {
      connected: false,
      configured: false,
      enabled: false,
    };
  }
  return {
    connected: hasTokens && config.status === "connected",
    configured: hasTokens || config.status === "connected",
    enabled: config.enabled,
    status: config.status,
    ...(config.accountEmail ? { accountEmail: config.accountEmail } : {}),
    ...(config.connectedAt ? { connectedAt: config.connectedAt } : {}),
    ...(config.lastError ? { lastError: config.lastError } : {}),
  };
}

export async function getGoogleDriveConnectionView(
  tenantId: string,
  environment: string
): Promise<GoogleDriveConnectionView> {
  const config = await getGoogleDriveConfig(tenantId);
  const tokens = await getGoogleDriveTokens(tenantId, environment);
  return toView(config, Boolean(tokens?.refreshToken));
}

export async function startGoogleDriveOAuth(
  tenantId: string
): Promise<{ authUrl: string; state: string }> {
  const state = randomUUID();
  const { codeVerifier, codeChallenge } = generatePkcePair();
  await putGoogleDriveOAuthState(state, { tenantId, codeVerifier });
  return { authUrl: buildOAuthUrl(state, codeChallenge), state };
}

export async function handleGoogleDriveOAuthCallback(
  code: string,
  state: string,
  environment: string
): Promise<string> {
  const oauthState = await consumeGoogleDriveOAuthState(state);
  if (!oauthState) {
    return `${frontendBaseUrl()}/apps/google-drive?error=invalid_state`;
  }

  try {
    const tokenResponse = await exchangeCodeForTokens(code, oauthState.codeVerifier);
    if (!tokenResponse.refresh_token) {
      throw new Error("Google did not return a refresh token");
    }

    const accessToken = tokenResponse.access_token;
    const email = await getGoogleUserEmail(accessToken);
    const existing =
      (await getGoogleDriveConfig(oauthState.tenantId)) ?? defaultConfig(oauthState.tenantId);
    const now = new Date().toISOString();
    const { lastError: _lastError, ...rest } = existing;
    void _lastError;

    await saveGoogleDriveTokens(oauthState.tenantId, environment, {
      refreshToken: tokenResponse.refresh_token,
      accessToken,
      expiresAt: tokenResponse.expires_in
        ? Date.now() + tokenResponse.expires_in * 1000
        : Date.now() + 3_600_000,
    });

    await upsertGoogleDriveConfig({
      ...rest,
      status: "connected",
      enabled: true,
      ...(email ? { accountEmail: email } : {}),
      connectedAt: existing.connectedAt ?? now,
      updatedAt: now,
    });

    return `${frontendBaseUrl()}/apps/google-drive?connected=1`;
  } catch (error) {
    const message = error instanceof Error ? error.message : "oauth_failed";
    return `${frontendBaseUrl()}/apps/google-drive?error=${encodeURIComponent(message)}`;
  }
}

export async function updateGoogleDriveSettings(
  tenantId: string,
  environment: string,
  params: { enabled?: boolean }
): Promise<GoogleDriveConnectionView> {
  const existing = (await getGoogleDriveConfig(tenantId)) ?? defaultConfig(tenantId);
  const tokens = await getGoogleDriveTokens(tenantId, environment);
  if (!tokens?.refreshToken) {
    throw Object.assign(new Error("Connect Google Drive first"), { statusCode: 400 });
  }

  const updated: GoogleDriveConfig = {
    ...existing,
    ...(params.enabled !== undefined ? { enabled: params.enabled } : {}),
    updatedAt: new Date().toISOString(),
  };
  await upsertGoogleDriveConfig(updated);
  return toView(updated, true);
}

export async function disconnectGoogleDrive(
  tenantId: string,
  environment: string
): Promise<GoogleDriveConnectionView> {
  const tokens = await getGoogleDriveTokens(tenantId, environment);
  if (tokens?.refreshToken) {
    try {
      await revokeToken(tokens.refreshToken);
    } catch {
      // continue disconnect
    }
  }
  await deleteGoogleDriveTokens(tenantId, environment);
  await deleteGoogleDriveConfig(tenantId);
  return toView(null, false);
}

export async function listTenantGoogleDriveFiles(
  tenantId: string,
  environment: string,
  options?: { folderId?: string; pageToken?: string; query?: string }
): Promise<{ files: CloudDriveFileItem[]; nextPageToken?: string }> {
  const config = await getGoogleDriveConfig(tenantId);
  if (!config || config.status !== "connected") {
    throw Object.assign(new Error("Google Drive is not connected"), { statusCode: 400 });
  }
  const accessToken = await resolveGoogleDriveAccessToken(tenantId, environment);
  return listGoogleDriveFiles(accessToken, options);
}

export async function getTenantGoogleDriveFile(
  tenantId: string,
  environment: string,
  fileId: string
): Promise<CloudDriveFileItem> {
  const config = await getGoogleDriveConfig(tenantId);
  if (!config || config.status !== "connected") {
    throw Object.assign(new Error("Google Drive is not connected"), { statusCode: 400 });
  }
  const accessToken = await resolveGoogleDriveAccessToken(tenantId, environment);
  return getGoogleDriveFile(accessToken, fileId);
}

export async function uploadTenantGoogleDriveFile(
  tenantId: string,
  environment: string,
  params: { name: string; mimeType: string; contentBase64: string; parentId?: string }
): Promise<CloudDriveFileItem> {
  const config = await getGoogleDriveConfig(tenantId);
  if (!config || config.status !== "connected") {
    throw Object.assign(new Error("Google Drive is not connected"), { statusCode: 400 });
  }
  if (!config.enabled) {
    throw Object.assign(new Error("Google Drive is disabled"), { statusCode: 400 });
  }
  const accessToken = await resolveGoogleDriveAccessToken(tenantId, environment);
  return uploadGoogleDriveFile(accessToken, params);
}

export async function createTenantGoogleDriveFolder(
  tenantId: string,
  environment: string,
  params: { name: string; parentId?: string }
): Promise<CloudDriveFileItem> {
  const config = await getGoogleDriveConfig(tenantId);
  if (!config || config.status !== "connected") {
    throw Object.assign(new Error("Google Drive is not connected"), { statusCode: 400 });
  }
  if (!config.enabled) {
    throw Object.assign(new Error("Google Drive is disabled"), { statusCode: 400 });
  }
  const accessToken = await resolveGoogleDriveAccessToken(tenantId, environment);
  return createGoogleDriveFolder(accessToken, params.name, params.parentId);
}

export async function updateTenantGoogleDriveFile(
  tenantId: string,
  environment: string,
  fileId: string,
  params: { name?: string; mimeType?: string; contentBase64?: string }
): Promise<CloudDriveFileItem> {
  const config = await getGoogleDriveConfig(tenantId);
  if (!config || config.status !== "connected") {
    throw Object.assign(new Error("Google Drive is not connected"), { statusCode: 400 });
  }
  if (!config.enabled) {
    throw Object.assign(new Error("Google Drive is disabled"), { statusCode: 400 });
  }
  const accessToken = await resolveGoogleDriveAccessToken(tenantId, environment);
  const existing = await getGoogleDriveFile(accessToken, fileId);
  if (existing.isFolder) {
    if (params.contentBase64) {
      throw Object.assign(new Error("Cannot update folder content"), { statusCode: 400 });
    }
  }
  return updateGoogleDriveFile(accessToken, fileId, params);
}
