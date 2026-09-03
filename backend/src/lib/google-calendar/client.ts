import { createHash, randomBytes } from "crypto";

const OAUTH_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const OAUTH_TOKEN_URL = "https://oauth2.googleapis.com/token";
const OAUTH_REVOKE_URL = "https://oauth2.googleapis.com/revoke";
const USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo";
const CALENDAR_API = "https://www.googleapis.com/calendar/v3";

export const GOOGLE_CALENDAR_SCOPES = [
  "https://www.googleapis.com/auth/calendar.calendarlist.readonly",
  "https://www.googleapis.com/auth/calendar.events",
].join(" ");

export interface GoogleOAuthCredentials {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

export interface GoogleTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  token_type?: string;
}

export interface GoogleCalendarListEntry {
  id: string;
  summary: string;
  primary?: boolean;
  accessRole?: string;
}

export interface GoogleCalendarEvent {
  id: string;
  status?: string;
  hangoutLink?: string;
  htmlLink?: string;
  conferenceData?: {
    entryPoints?: Array<{
      entryPointType?: string;
      uri?: string;
    }>;
  };
}

export interface GoogleFreeBusyResponse {
  calendars?: Record<
    string,
    {
      busy?: Array<{ start?: string; end?: string }>;
    }
  >;
}

function getCredentials(): GoogleOAuthCredentials {
  const clientId = process.env.GOOGLE_CALENDAR_CLIENT_ID?.trim() ?? "";
  const clientSecret = process.env.GOOGLE_CALENDAR_CLIENT_SECRET?.trim() ?? "";
  const redirectUri =
    process.env.GOOGLE_CALENDAR_REDIRECT_URI?.trim() ||
    `${(process.env.API_PUBLIC_URL ?? "").replace(/\/$/, "")}/public/integrations/google-calendar/oauth/callback`;
  if (!clientId || !clientSecret || !redirectUri) {
    throw Object.assign(new Error("Google Calendar OAuth is not configured"), {
      statusCode: 503,
    });
  }
  return { clientId, clientSecret, redirectUri };
}

async function parseGoogleError(response: Response): Promise<string> {
  const body = await response.text();
  try {
    const json = JSON.parse(body) as { error?: { message?: string }; error_description?: string };
    return json.error?.message ?? json.error_description ?? body;
  } catch {
    return body || response.statusText;
  }
}

async function googleFetch<T>(
  url: string,
  accessToken: string,
  init?: RequestInit
): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!response.ok) {
    const message = await parseGoogleError(response);
    throw Object.assign(new Error(message), { statusCode: response.status === 403 ? 403 : 502 });
  }
  if (response.status === 204) return {} as T;
  return (await response.json()) as T;
}

export function generatePkcePair(): { codeVerifier: string; codeChallenge: string } {
  const codeVerifier = randomBytes(32).toString("base64url");
  const codeChallenge = createHash("sha256").update(codeVerifier).digest("base64url");
  return { codeVerifier, codeChallenge };
}

export function buildOAuthUrl(state: string, codeChallenge: string): string {
  const { clientId, redirectUri } = getCredentials();
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: GOOGLE_CALENDAR_SCOPES,
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
  });
  return `${OAUTH_AUTH_URL}?${params.toString()}`;
}

export async function exchangeCodeForTokens(
  code: string,
  codeVerifier: string
): Promise<GoogleTokenResponse> {
  const { clientId, clientSecret, redirectUri } = getCredentials();
  const response = await fetch(OAUTH_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
      code_verifier: codeVerifier,
    }),
  });
  if (!response.ok) {
    const message = await parseGoogleError(response);
    throw Object.assign(new Error(message), { statusCode: 400 });
  }
  return (await response.json()) as GoogleTokenResponse;
}

export async function refreshAccessToken(refreshToken: string): Promise<GoogleTokenResponse> {
  const { clientId, clientSecret } = getCredentials();
  const response = await fetch(OAUTH_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
    }),
  });
  if (!response.ok) {
    const message = await parseGoogleError(response);
    throw Object.assign(new Error(message), { statusCode: 401 });
  }
  return (await response.json()) as GoogleTokenResponse;
}

export async function revokeToken(token: string): Promise<void> {
  const response = await fetch(`${OAUTH_REVOKE_URL}?token=${encodeURIComponent(token)}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });
  if (!response.ok && response.status !== 400) {
    const message = await parseGoogleError(response);
    throw Object.assign(new Error(message), { statusCode: 502 });
  }
}

export async function getGoogleUserEmail(accessToken: string): Promise<string | undefined> {
  const response = await fetch(USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) return undefined;
  const data = (await response.json()) as { email?: string };
  return data.email;
}

export async function listGoogleCalendars(
  accessToken: string
): Promise<GoogleCalendarListEntry[]> {
  const data = await googleFetch<{ items?: GoogleCalendarListEntry[] }>(
    `${CALENDAR_API}/users/me/calendarList`,
    accessToken
  );
  return (data.items ?? []).filter((item) => item.id && item.summary);
}

export function resolveGoogleMeetingLink(event: GoogleCalendarEvent): string | undefined {
  const conferenceLink = event.conferenceData?.entryPoints?.find(
    (entry) =>
      entry.entryPointType === "video" ||
      (entry.uri?.includes("meet.google.com") ?? false)
  )?.uri;
  return conferenceLink ?? event.hangoutLink ?? event.htmlLink;
}

export async function createGoogleCalendarEvent(
  accessToken: string,
  calendarId: string,
  event: {
    summary: string;
    description?: string;
    startAt: string;
    endAt: string;
    timezone: string;
    privateExtendedProperties: Record<string, string>;
    requestId: string;
  }
): Promise<GoogleCalendarEvent> {
  return googleFetch<GoogleCalendarEvent>(
    `${CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events?conferenceDataVersion=1`,
    accessToken,
    {
      method: "POST",
      body: JSON.stringify({
        summary: event.summary,
        ...(event.description ? { description: event.description } : {}),
        start: { dateTime: event.startAt, timeZone: event.timezone },
        end: { dateTime: event.endAt, timeZone: event.timezone },
        conferenceData: {
          createRequest: {
            requestId: event.requestId,
            conferenceSolutionKey: { type: "hangoutsMeet" },
          },
        },
        extendedProperties: {
          private: event.privateExtendedProperties,
        },
      }),
    }
  );
}

export async function deleteGoogleCalendarEvent(
  accessToken: string,
  calendarId: string,
  eventId: string
): Promise<void> {
  const response = await fetch(
    `${CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );
  if (response.status === 404 || response.status === 410) return;
  if (!response.ok) {
    const message = await parseGoogleError(response);
    throw Object.assign(new Error(message), { statusCode: 502 });
  }
}

export async function queryGoogleFreeBusy(
  accessToken: string,
  calendarId: string,
  timeMin: string,
  timeMax: string
): Promise<Array<{ startAt: string; endAt: string }>> {
  const data = await googleFetch<GoogleFreeBusyResponse>(
    `${CALENDAR_API}/freeBusy`,
    accessToken,
    {
      method: "POST",
      body: JSON.stringify({
        timeMin,
        timeMax,
        items: [{ id: calendarId }],
      }),
    }
  );
  const busy = data.calendars?.[calendarId]?.busy ?? [];
  return busy
    .filter((block) => block.start && block.end)
    .map((block) => ({
      startAt: block.start!,
      endAt: block.end!,
    }));
}
