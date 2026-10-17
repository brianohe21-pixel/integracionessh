import { randomUUID } from "crypto";
import {
  consumeOneDriveOAuthState,
  putOneDriveOAuthState,
} from "../dynamodb/onedrive-oauth.repository.js";
import {
  deleteOneDriveConfig,
  getOneDriveConfig,
  upsertOneDriveConfig,
} from "../dynamodb/onedrive.repository.js";
import type { CloudDriveFileItem, OneDriveConfig } from "../../types/index.js";
import {
  buildOAuthUrl,
  createOneDriveFolder,
  exchangeCodeForTokens,
  generatePkcePair,
  getMicrosoftUserProfile,
  getOneDriveFile,
  listOneDriveFiles,
  updateOneDriveFile,
  uploadOneDriveFile,
} from "./client.js";
import { deleteOneDriveTokens, getOneDriveTokens, saveOneDriveTokens } from "./secrets.js";
import { resolveOneDriveAccessToken } from "./token.js";

export interface OneDriveConnectionView {
  connected: boolean;
  configured: boolean;
  enabled: boolean;
  status?: OneDriveConfig["status"];
  accountEmail?: string;
  displayName?: string;
  connectedAt?: string;
  lastError?: string;
}

function frontendBaseUrl(): string {
  return (process.env.FRONTEND_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

function defaultConfig(tenantId: string): OneDriveConfig {
  const now = new Date().toISOString();
  return {
    tenantId,
    status: "disconnected",
    enabled: false,
    createdAt: now,
    updatedAt: now,
  };
}

function toView(config: OneDriveConfig | null, hasTokens: boolean): OneDriveConnectionView {
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
    ...(config.displayName ? { displayName: config.displayName } : {}),
    ...(config.connectedAt ? { connectedAt: config.connectedAt } : {}),
    ...(config.lastError ? { lastError: config.lastError } : {}),
  };
}

export async function getOneDriveConnectionView(
  tenantId: string,
  environment: string
): Promise<OneDriveConnectionView> {
  const config = await getOneDriveConfig(tenantId);
  const tokens = await getOneDriveTokens(tenantId, environment);
  return toView(config, Boolean(tokens?.refreshToken));
}

export async function startOneDriveOAuth(
  tenantId: string
): Promise<{ authUrl: string; state: string }> {
  const state = randomUUID();
  const { codeVerifier, codeChallenge } = generatePkcePair();
  await putOneDriveOAuthState(state, { tenantId, codeVerifier });
  return { authUrl: buildOAuthUrl(state, codeChallenge), state };
}

export async function handleOneDriveOAuthCallback(
  code: string,
  state: string,
  environment: string
): Promise<string> {
  const oauthState = await consumeOneDriveOAuthState(state);
  if (!oauthState) {
    return `${frontendBaseUrl()}/apps/onedrive?error=invalid_state`;
  }

  try {
    const tokenResponse = await exchangeCodeForTokens(code, oauthState.codeVerifier);
    if (!tokenResponse.refresh_token) {
      throw new Error("Microsoft did not return a refresh token");
    }

    const accessToken = tokenResponse.access_token;
    const profile = await getMicrosoftUserProfile(accessToken);
    const existing =
      (await getOneDriveConfig(oauthState.tenantId)) ?? defaultConfig(oauthState.tenantId);
    const now = new Date().toISOString();
    const { lastError: _lastError, ...rest } = existing;
    void _lastError;

    await saveOneDriveTokens(oauthState.tenantId, environment, {
      refreshToken: tokenResponse.refresh_token,
      accessToken,
      expiresAt: tokenResponse.expires_in
        ? Date.now() + tokenResponse.expires_in * 1000
        : Date.now() + 3_600_000,
      ...(tokenResponse.scope ? { scope: tokenResponse.scope } : {}),
    });

    await upsertOneDriveConfig({
      ...rest,
      status: "connected",
      enabled: true,
      ...(profile.email ? { accountEmail: profile.email } : {}),
      ...(profile.displayName ? { displayName: profile.displayName } : {}),
      connectedAt: existing.connectedAt ?? now,
      updatedAt: now,
    });

    return `${frontendBaseUrl()}/apps/onedrive?connected=1`;
  } catch (error) {
    const message = error instanceof Error ? error.message : "oauth_failed";
    return `${frontendBaseUrl()}/apps/onedrive?error=${encodeURIComponent(message)}`;
  }
}

export async function updateOneDriveSettings(
  tenantId: string,
  environment: string,
  params: { enabled?: boolean }
): Promise<OneDriveConnectionView> {
  const existing = (await getOneDriveConfig(tenantId)) ?? defaultConfig(tenantId);
  const tokens = await getOneDriveTokens(tenantId, environment);
  if (!tokens?.refreshToken) {
    throw Object.assign(new Error("Connect OneDrive first"), { statusCode: 400 });
  }

  const updated: OneDriveConfig = {
    ...existing,
    ...(params.enabled !== undefined ? { enabled: params.enabled } : {}),
    updatedAt: new Date().toISOString(),
  };
  await upsertOneDriveConfig(updated);
  return toView(updated, true);
}

export async function disconnectOneDrive(
  tenantId: string,
  environment: string
): Promise<OneDriveConnectionView> {
  await deleteOneDriveTokens(tenantId, environment);
  await deleteOneDriveConfig(tenantId);
  return toView(null, false);
}

export async function listTenantOneDriveFiles(
  tenantId: string,
  environment: string,
  options?: { folderId?: string; pageToken?: string; query?: string }
): Promise<{ files: CloudDriveFileItem[]; nextPageToken?: string }> {
  const config = await getOneDriveConfig(tenantId);
  if (!config || config.status !== "connected") {
    throw Object.assign(new Error("OneDrive is not connected"), { statusCode: 400 });
  }
  const accessToken = await resolveOneDriveAccessToken(tenantId, environment);
  return listOneDriveFiles(accessToken, options);
}

export async function getTenantOneDriveFile(
  tenantId: string,
  environment: string,
  fileId: string
): Promise<CloudDriveFileItem> {
  const config = await getOneDriveConfig(tenantId);
  if (!config || config.status !== "connected") {
    throw Object.assign(new Error("OneDrive is not connected"), { statusCode: 400 });
  }
  const accessToken = await resolveOneDriveAccessToken(tenantId, environment);
  return getOneDriveFile(accessToken, fileId);
}

export async function uploadTenantOneDriveFile(
  tenantId: string,
  environment: string,
  params: { name: string; mimeType: string; contentBase64: string; parentId?: string }
): Promise<CloudDriveFileItem> {
  const config = await getOneDriveConfig(tenantId);
  if (!config || config.status !== "connected") {
    throw Object.assign(new Error("OneDrive is not connected"), { statusCode: 400 });
  }
  if (!config.enabled) {
    throw Object.assign(new Error("OneDrive is disabled"), { statusCode: 400 });
  }
  const accessToken = await resolveOneDriveAccessToken(tenantId, environment);
  return uploadOneDriveFile(accessToken, params);
}

export async function createTenantOneDriveFolder(
  tenantId: string,
  environment: string,
  params: { name: string; parentId?: string }
): Promise<CloudDriveFileItem> {
  const config = await getOneDriveConfig(tenantId);
  if (!config || config.status !== "connected") {
    throw Object.assign(new Error("OneDrive is not connected"), { statusCode: 400 });
  }
  if (!config.enabled) {
    throw Object.assign(new Error("OneDrive is disabled"), { statusCode: 400 });
  }
  const accessToken = await resolveOneDriveAccessToken(tenantId, environment);
  return createOneDriveFolder(accessToken, params.name, params.parentId);
}

export async function updateTenantOneDriveFile(
  tenantId: string,
  environment: string,
  fileId: string,
  params: { name?: string; mimeType?: string; contentBase64?: string }
): Promise<CloudDriveFileItem> {
  const config = await getOneDriveConfig(tenantId);
  if (!config || config.status !== "connected") {
    throw Object.assign(new Error("OneDrive is not connected"), { statusCode: 400 });
  }
  if (!config.enabled) {
    throw Object.assign(new Error("OneDrive is disabled"), { statusCode: 400 });
  }
  const accessToken = await resolveOneDriveAccessToken(tenantId, environment);
  const existing = await getOneDriveFile(accessToken, fileId);
  if (existing.isFolder && params.contentBase64) {
    throw Object.assign(new Error("Cannot update folder content"), { statusCode: 400 });
  }
  return updateOneDriveFile(accessToken, fileId, params);
}
