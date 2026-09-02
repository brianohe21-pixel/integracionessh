import { refreshAccessToken } from "./client.js";
import { getGoogleCalendarTokens, saveGoogleCalendarTokens } from "./secrets.js";

export async function resolveGoogleCalendarAccessToken(
  tenantId: string,
  botId: string,
  environment: string
): Promise<string> {
  const tokens = await getGoogleCalendarTokens(tenantId, botId, environment);
  if (!tokens?.refreshToken) {
    throw Object.assign(new Error("Google Calendar is not connected"), { statusCode: 400 });
  }

  const now = Date.now();
  if (tokens.accessToken && tokens.expiresAt && tokens.expiresAt > now + 60_000) {
    return tokens.accessToken;
  }

  const refreshed = await refreshAccessToken(tokens.refreshToken);
  const accessToken = refreshed.access_token;
  const expiresAt = refreshed.expires_in
    ? now + refreshed.expires_in * 1000
    : now + 3_600_000;
  await saveGoogleCalendarTokens(tenantId, botId, environment, {
    refreshToken: refreshed.refresh_token ?? tokens.refreshToken,
    accessToken,
    expiresAt,
  });
  return accessToken;
}
