import { refreshAccessToken } from "./client.js";
import { getGoogleDriveTokens, saveGoogleDriveTokens } from "./secrets.js";

export async function resolveGoogleDriveAccessToken(
  tenantId: string,
  environment: string
): Promise<string> {
  const tokens = await getGoogleDriveTokens(tenantId, environment);
  if (!tokens?.refreshToken) {
    throw Object.assign(new Error("Google Drive is not connected"), { statusCode: 400 });
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
  await saveGoogleDriveTokens(tenantId, environment, {
    refreshToken: refreshed.refresh_token ?? tokens.refreshToken,
    accessToken,
    expiresAt,
  });
  return accessToken;
}
