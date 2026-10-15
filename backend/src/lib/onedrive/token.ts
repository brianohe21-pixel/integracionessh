import { refreshAccessToken } from "./client.js";
import { getOneDriveTokens, saveOneDriveTokens } from "./secrets.js";

export async function resolveOneDriveAccessToken(
  tenantId: string,
  environment: string
): Promise<string> {
  const tokens = await getOneDriveTokens(tenantId, environment);
  if (!tokens?.refreshToken) {
    throw Object.assign(new Error("OneDrive is not connected"), { statusCode: 400 });
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
  await saveOneDriveTokens(tenantId, environment, {
    refreshToken: refreshed.refresh_token ?? tokens.refreshToken,
    accessToken,
    expiresAt,
    ...(refreshed.scope || tokens.scope ? { scope: refreshed.scope ?? tokens.scope } : {}),
  });
  return accessToken;
}
