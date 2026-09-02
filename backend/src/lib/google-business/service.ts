import { randomUUID } from "crypto";
import {
  consumeOAuthState,
  deleteGoogleBusinessConfig,
  getGoogleBusinessConfig,
  putGoogleBusinessConfig,
  putOAuthState,
  type GoogleBusinessConfig,
  type GoogleBusinessLocation,
} from "../dynamodb/google-business.repository.js";
import {
  buildOAuthUrl,
  deleteGoogleReviewReply,
  exchangeCodeForTokens,
  getGoogleUserEmail,
  listGoogleAccounts,
  listGoogleLocations,
  listGoogleReviews,
  refreshAccessToken,
  updateGoogleReviewReply,
  type GoogleReviewsListResponse,
} from "./client.js";
import {
  deleteGoogleBusinessTokens,
  getGoogleBusinessTokens,
  saveGoogleBusinessTokens,
} from "./secrets.js";

export interface GoogleBusinessPublicView {
  id: "google-business-profile";
  configured: boolean;
  enabled: boolean;
  status?: GoogleBusinessConfig["status"];
  googleAccountEmail?: string;
  googleAccountId?: string;
  selectedLocationIds: string[];
  locations: GoogleBusinessLocation[];
  connectedAt?: string;
}

function frontendBaseUrl(): string {
  return (process.env.FRONTEND_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

function toPublicView(config: GoogleBusinessConfig | null): GoogleBusinessPublicView {
  if (!config) {
    return {
      id: "google-business-profile",
      configured: false,
      enabled: false,
      selectedLocationIds: [],
      locations: [],
    };
  }
  return {
    id: "google-business-profile",
    configured: config.status === "active",
    enabled: config.enabled,
    ...(config.status ? { status: config.status } : {}),
    ...(config.googleAccountEmail ? { googleAccountEmail: config.googleAccountEmail } : {}),
    ...(config.googleAccountId ? { googleAccountId: config.googleAccountId } : {}),
    selectedLocationIds: config.selectedLocationIds ?? [],
    locations: config.locations ?? [],
    ...(config.connectedAt ? { connectedAt: config.connectedAt } : {}),
  };
}

async function resolveAccessToken(
  tenantId: string,
  environment: string
): Promise<{ accessToken: string; refreshToken: string }> {
  const tokens = await getGoogleBusinessTokens(tenantId, environment);
  if (!tokens?.refreshToken) {
    throw Object.assign(new Error("Google Business Profile is not connected"), { statusCode: 400 });
  }

  const now = Date.now();
  if (tokens.accessToken && tokens.expiresAt && tokens.expiresAt > now + 60_000) {
    return { accessToken: tokens.accessToken, refreshToken: tokens.refreshToken };
  }

  const refreshed = await refreshAccessToken(tokens.refreshToken);
  const accessToken = refreshed.access_token;
  const expiresAt = refreshed.expires_in
    ? now + refreshed.expires_in * 1000
    : now + 3_600_000;
  await saveGoogleBusinessTokens(tenantId, environment, {
    refreshToken: refreshed.refresh_token ?? tokens.refreshToken,
    accessToken,
    expiresAt,
  });
  return {
    accessToken,
    refreshToken: refreshed.refresh_token ?? tokens.refreshToken,
  };
}

async function fetchAllLocations(
  accessToken: string,
  accountResourceName: string
): Promise<GoogleBusinessLocation[]> {
  return listGoogleLocations(accessToken, accountResourceName);
}

export async function getGoogleBusinessView(tenantId: string): Promise<GoogleBusinessPublicView> {
  const config = await getGoogleBusinessConfig(tenantId);
  return toPublicView(config);
}

export async function startGoogleBusinessOAuth(
  tenantId: string
): Promise<{ authUrl: string; state: string }> {
  const state = randomUUID();
  await putOAuthState(state, tenantId);
  return { authUrl: buildOAuthUrl(state), state };
}

export async function handleGoogleBusinessOAuthCallback(
  code: string,
  state: string,
  environment: string
): Promise<string> {
  const tenantId = await consumeOAuthState(state);
  if (!tenantId) {
    return `${frontendBaseUrl()}/integrations/google-business?error=invalid_state`;
  }

  try {
    const tokenResponse = await exchangeCodeForTokens(code);
    if (!tokenResponse.refresh_token) {
      throw new Error("Google did not return a refresh token");
    }

    const accessToken = tokenResponse.access_token;
    const email = await getGoogleUserEmail(accessToken);
    const accounts = await listGoogleAccounts(accessToken);
    const primaryAccount = accounts[0];
    if (!primaryAccount) {
      throw new Error("No Google Business accounts found for this user");
    }

    const locations = await fetchAllLocations(accessToken, primaryAccount.id);
    const now = new Date().toISOString();
    const existing = await getGoogleBusinessConfig(tenantId);
    const selectedLocationIds =
      existing?.selectedLocationIds?.filter((id) => locations.some((loc) => loc.id === id)) ??
      locations.map((location) => location.id);

    await saveGoogleBusinessTokens(tenantId, environment, {
      refreshToken: tokenResponse.refresh_token,
      accessToken,
      expiresAt: tokenResponse.expires_in
        ? Date.now() + tokenResponse.expires_in * 1000
        : Date.now() + 3_600_000,
    });

    const googleAccountEmail = email ?? existing?.googleAccountEmail;
    const config: GoogleBusinessConfig = {
      tenantId,
      enabled: existing?.enabled ?? true,
      status: "active",
      ...(googleAccountEmail ? { googleAccountEmail } : {}),
      googleAccountId: primaryAccount.id,
      selectedLocationIds,
      locations,
      connectedAt: existing?.connectedAt ?? now,
      updatedAt: now,
    };
    await putGoogleBusinessConfig(config);
    return `${frontendBaseUrl()}/integrations/google-business?connected=1`;
  } catch (error) {
    const message = error instanceof Error ? error.message : "oauth_failed";
    return `${frontendBaseUrl()}/integrations/google-business?error=${encodeURIComponent(message)}`;
  }
}

export async function updateGoogleBusinessSettings(
  tenantId: string,
  params: { enabled?: boolean; selectedLocationIds?: string[] }
): Promise<GoogleBusinessPublicView> {
  const config = await getGoogleBusinessConfig(tenantId);
  if (!config || config.status !== "active") {
    throw Object.assign(new Error("Connect Google Business Profile before updating settings"), {
      statusCode: 400,
    });
  }

  const locations = config.locations ?? [];
  const selectedLocationIds = params.selectedLocationIds
    ? params.selectedLocationIds.filter((id) => locations.some((location) => location.id === id))
    : config.selectedLocationIds;

  const updated: GoogleBusinessConfig = {
    ...config,
    ...(params.enabled !== undefined ? { enabled: params.enabled } : {}),
    selectedLocationIds,
    updatedAt: new Date().toISOString(),
  };
  await putGoogleBusinessConfig(updated);
  return toPublicView(updated);
}

export async function refreshGoogleBusinessLocations(
  tenantId: string,
  environment: string
): Promise<GoogleBusinessPublicView> {
  const config = await getGoogleBusinessConfig(tenantId);
  if (!config?.googleAccountId) {
    throw Object.assign(new Error("Google Business Profile is not connected"), { statusCode: 400 });
  }

  const { accessToken } = await resolveAccessToken(tenantId, environment);
  const locations = await fetchAllLocations(accessToken, config.googleAccountId);
  const selectedLocationIds = config.selectedLocationIds.filter((id) =>
    locations.some((location) => location.id === id)
  );

  const updated: GoogleBusinessConfig = {
    ...config,
    locations,
    selectedLocationIds:
      selectedLocationIds.length > 0 ? selectedLocationIds : locations.map((location) => location.id),
    updatedAt: new Date().toISOString(),
  };
  await putGoogleBusinessConfig(updated);
  return toPublicView(updated);
}

export async function disconnectGoogleBusiness(
  tenantId: string,
  environment: string
): Promise<GoogleBusinessPublicView> {
  await deleteGoogleBusinessTokens(tenantId, environment);
  await deleteGoogleBusinessConfig(tenantId);
  return toPublicView(null);
}

export async function getGoogleBusinessCatalogItem(tenantId: string): Promise<{
  id: "google-business-profile";
  configured: boolean;
  enabled: boolean;
  status?: GoogleBusinessConfig["status"];
}> {
  const config = await getGoogleBusinessConfig(tenantId);
  return {
    id: "google-business-profile",
    configured: config?.status === "active",
    enabled: Boolean(config?.enabled),
    ...(config?.status ? { status: config.status } : {}),
  };
}

function assertLocationAllowed(config: GoogleBusinessConfig, locationId: string): void {
  if (!config.enabled || config.status !== "active") {
    throw Object.assign(new Error("Google Business Profile integration is disabled"), {
      statusCode: 400,
    });
  }
  if (!config.selectedLocationIds.includes(locationId)) {
    throw Object.assign(new Error("Location is not enabled for this tenant"), { statusCode: 400 });
  }
}

export async function listTenantGoogleReviews(
  tenantId: string,
  environment: string,
  locationId: string,
  options?: { pageToken?: string; orderBy?: string; pageSize?: number }
): Promise<GoogleReviewsListResponse> {
  const config = await getGoogleBusinessConfig(tenantId);
  if (!config) {
    throw Object.assign(new Error("Google Business Profile is not connected"), { statusCode: 400 });
  }
  assertLocationAllowed(config, locationId);
  const { accessToken } = await resolveAccessToken(tenantId, environment);
  return listGoogleReviews(accessToken, locationId, options);
}

export async function replyToTenantGoogleReview(
  tenantId: string,
  environment: string,
  locationId: string,
  reviewId: string,
  comment: string
): Promise<{ comment: string; updateTime?: string }> {
  const config = await getGoogleBusinessConfig(tenantId);
  if (!config) {
    throw Object.assign(new Error("Google Business Profile is not connected"), { statusCode: 400 });
  }
  assertLocationAllowed(config, locationId);
  const trimmed = comment.trim();
  if (!trimmed) {
    throw Object.assign(new Error("Reply comment is required"), { statusCode: 400 });
  }
  const { accessToken } = await resolveAccessToken(tenantId, environment);
  return updateGoogleReviewReply(accessToken, locationId, reviewId, trimmed);
}

export async function deleteTenantGoogleReviewReply(
  tenantId: string,
  environment: string,
  locationId: string,
  reviewId: string
): Promise<void> {
  const config = await getGoogleBusinessConfig(tenantId);
  if (!config) {
    throw Object.assign(new Error("Google Business Profile is not connected"), { statusCode: 400 });
  }
  assertLocationAllowed(config, locationId);
  const { accessToken } = await resolveAccessToken(tenantId, environment);
  await deleteGoogleReviewReply(accessToken, locationId, reviewId);
}

export async function getTenantGoogleLocations(
  tenantId: string
): Promise<GoogleBusinessLocation[]> {
  const config = await getGoogleBusinessConfig(tenantId);
  if (!config?.locations?.length) return [];
  return config.locations.filter((location) => config.selectedLocationIds.includes(location.id));
}
