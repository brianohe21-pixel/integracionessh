import { randomUUID } from "crypto";
import {
  consumeGoogleCalendarOAuthState,
  putGoogleCalendarOAuthState,
} from "../dynamodb/google-calendar-oauth.repository.js";
import { getCalendarConfig, upsertCalendarConfig } from "../dynamodb/calendar-config.repository.js";
import type { CalendarConfig, GoogleCalendarStatus } from "../../types/index.js";
import { DEFAULT_WEEKLY_SCHEDULE } from "../../types/index.js";
import {
  buildOAuthUrl,
  exchangeCodeForTokens,
  generatePkcePair,
  getGoogleUserEmail,
  listGoogleCalendars,
  revokeToken,
} from "./client.js";
import {
  deleteGoogleCalendarTokens,
  getGoogleCalendarTokens,
  saveGoogleCalendarTokens,
} from "./secrets.js";
import { resolveGoogleCalendarAccessToken } from "./token.js";

export interface GoogleCalendarListItem {
  id: string;
  name: string;
  primary?: boolean;
}

export interface GoogleCalendarConnectionView {
  connected: boolean;
  status?: GoogleCalendarStatus;
  provider: CalendarConfig["provider"];
  googleAccountEmail?: string;
  googleCalendarId?: string;
  googleCalendarName?: string;
  blockExternalEvents?: boolean;
  connectedAt?: string;
  calendars: GoogleCalendarListItem[];
}

function frontendBaseUrl(): string {
  return (process.env.FRONTEND_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

function toConnectionView(
  config: CalendarConfig,
  calendars: GoogleCalendarListItem[] = []
): GoogleCalendarConnectionView {
  const connected = Boolean(config.googleAccountEmail) || config.googleStatus === "pending";
  return {
    connected,
    ...(config.googleStatus ? { status: config.googleStatus } : {}),
    provider: config.provider,
    ...(config.googleAccountEmail ? { googleAccountEmail: config.googleAccountEmail } : {}),
    ...(config.googleCalendarId ? { googleCalendarId: config.googleCalendarId } : {}),
    ...(config.googleCalendarName ? { googleCalendarName: config.googleCalendarName } : {}),
    ...(config.blockExternalEvents !== undefined
      ? { blockExternalEvents: config.blockExternalEvents }
      : {}),
    ...(config.googleConnectedAt ? { connectedAt: config.googleConnectedAt } : {}),
    calendars,
  };
}

async function getConfigOrDefault(tenantId: string, botId: string): Promise<CalendarConfig> {
  const existing = await getCalendarConfig(tenantId, botId);
  if (existing) return existing;
  const now = new Date().toISOString();
  return {
    tenantId,
    botId,
    enabled: false,
    timezone: "America/Bogota",
    slotDurationMinutes: 30,
    bufferMinutes: 15,
    maxAdvanceDays: 30,
    minNoticeHours: 2,
    weeklySchedule: DEFAULT_WEEKLY_SCHEDULE,
    provider: "native",
    createdAt: now,
    updatedAt: now,
  };
}

export async function getGoogleCalendarConnectionView(
  tenantId: string,
  botId: string,
  environment: string
): Promise<GoogleCalendarConnectionView> {
  const config = await getConfigOrDefault(tenantId, botId);
  const tokens = await getGoogleCalendarTokens(tenantId, botId, environment);
  if (!tokens?.refreshToken) {
    return toConnectionView(config);
  }

  try {
    const accessToken = await resolveGoogleCalendarAccessToken(tenantId, botId, environment);
    const calendars = (await listGoogleCalendars(accessToken)).map((item) => ({
      id: item.id,
      name: item.summary,
      ...(item.primary ? { primary: true } : {}),
    }));
    return toConnectionView(config, calendars);
  } catch {
    return toConnectionView({ ...config, googleStatus: "error" });
  }
}

export async function startGoogleCalendarOAuth(
  tenantId: string,
  botId: string
): Promise<{ authUrl: string; state: string }> {
  const state = randomUUID();
  const { codeVerifier, codeChallenge } = generatePkcePair();
  await putGoogleCalendarOAuthState(state, { tenantId, botId, codeVerifier });
  return { authUrl: buildOAuthUrl(state, codeChallenge), state };
}

export async function handleGoogleCalendarOAuthCallback(
  code: string,
  state: string,
  environment: string
): Promise<string> {
  const oauthState = await consumeGoogleCalendarOAuthState(state);
  if (!oauthState) {
    return `${frontendBaseUrl()}/apps/calendar?error=invalid_state`;
  }

  const { tenantId, botId, codeVerifier } = oauthState;

  try {
    const tokenResponse = await exchangeCodeForTokens(code, codeVerifier);
    if (!tokenResponse.refresh_token) {
      throw new Error("Google did not return a refresh token");
    }

    const accessToken = tokenResponse.access_token;
    const email = await getGoogleUserEmail(accessToken);
    const now = new Date().toISOString();
    const existing = await getConfigOrDefault(tenantId, botId);

    await saveGoogleCalendarTokens(tenantId, botId, environment, {
      refreshToken: tokenResponse.refresh_token,
      accessToken,
      expiresAt: tokenResponse.expires_in
        ? Date.now() + tokenResponse.expires_in * 1000
        : Date.now() + 3_600_000,
    });

    const googleAccountEmail = email ?? existing.googleAccountEmail;
    await upsertCalendarConfig({
      ...existing,
      ...(googleAccountEmail ? { googleAccountEmail } : {}),
      googleStatus: "pending",
      googleConnectedAt: existing.googleConnectedAt ?? now,
      blockExternalEvents: existing.blockExternalEvents ?? true,
      updatedAt: now,
    });

    return `${frontendBaseUrl()}/apps/calendar/${botId}?googleConnected=1`;
  } catch (error) {
    const message = error instanceof Error ? error.message : "oauth_failed";
    return `${frontendBaseUrl()}/apps/calendar/${botId}?error=${encodeURIComponent(message)}`;
  }
}

export async function refreshGoogleCalendarList(
  tenantId: string,
  botId: string,
  environment: string
): Promise<GoogleCalendarConnectionView> {
  return getGoogleCalendarConnectionView(tenantId, botId, environment);
}

export async function updateGoogleCalendarSettings(
  tenantId: string,
  botId: string,
  environment: string,
  params: {
    googleCalendarId?: string;
    blockExternalEvents?: boolean;
  }
): Promise<GoogleCalendarConnectionView> {
  const config = await getConfigOrDefault(tenantId, botId);
  const tokens = await getGoogleCalendarTokens(tenantId, botId, environment);
  if (!tokens?.refreshToken) {
    throw Object.assign(new Error("Connect Google Calendar before updating settings"), {
      statusCode: 400,
    });
  }

  const accessToken = await resolveGoogleCalendarAccessToken(tenantId, botId, environment);
  const calendars = await listGoogleCalendars(accessToken);
  const now = new Date().toISOString();

  let nextConfig: CalendarConfig = {
    ...config,
    updatedAt: now,
    ...(params.blockExternalEvents !== undefined
      ? { blockExternalEvents: params.blockExternalEvents }
      : {}),
  };

  if (params.googleCalendarId) {
    const selected = calendars.find((calendar) => calendar.id === params.googleCalendarId);
    if (!selected) {
      throw Object.assign(new Error("Selected calendar is not available for this account"), {
        statusCode: 400,
      });
    }
    nextConfig = {
      ...nextConfig,
      provider: "google",
      googleCalendarId: selected.id,
      googleCalendarName: selected.summary,
      googleStatus: "active",
      blockExternalEvents: params.blockExternalEvents ?? config.blockExternalEvents ?? true,
    };
  }

  await upsertCalendarConfig(nextConfig);
  return toConnectionView(
    nextConfig,
    calendars.map((item) => ({
      id: item.id,
      name: item.summary,
      ...(item.primary ? { primary: true } : {}),
    }))
  );
}

export async function disconnectGoogleCalendar(
  tenantId: string,
  botId: string,
  environment: string
): Promise<GoogleCalendarConnectionView> {
  const config = await getConfigOrDefault(tenantId, botId);
  const tokens = await getGoogleCalendarTokens(tenantId, botId, environment);
  if (tokens?.refreshToken) {
    try {
      await revokeToken(tokens.refreshToken);
    } catch {
      // ignore revoke failures
    }
  }

  await deleteGoogleCalendarTokens(tenantId, botId, environment);
  const now = new Date().toISOString();
  const {
    googleAccountEmail: _email,
    googleCalendarId: _calendarId,
    googleCalendarName: _calendarName,
    googleStatus: _status,
    googleConnectedAt: _connectedAt,
    blockExternalEvents: _blockExternalEvents,
    ...rest
  } = config;
  void _email;
  void _calendarId;
  void _calendarName;
  void _status;
  void _connectedAt;
  void _blockExternalEvents;
  const resetConfig: CalendarConfig = {
    ...rest,
    provider: "native",
    updatedAt: now,
  };
  await upsertCalendarConfig(resetConfig);
  return toConnectionView(resetConfig);
}
