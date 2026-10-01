import {
  getShopifyShopTokens,
  saveShopifyShopTokens,
} from "./secrets.js";
import { refreshAccessToken } from "./client.js";

export async function resolveShopifyAccessToken(
  tenantId: string,
  shopDomain: string,
  environment: string
): Promise<string> {
  const tokens = await getShopifyShopTokens(tenantId, environment);
  if (!tokens?.accessToken) {
    throw Object.assign(new Error("Shopify store is not connected"), { statusCode: 400 });
  }

  const expiresSoon =
    typeof tokens.expiresAt === "number" && tokens.expiresAt < Date.now() + 60_000;
  if (!expiresSoon || !tokens.refreshToken) {
    return tokens.accessToken;
  }

  const refreshed = await refreshAccessToken(shopDomain, tokens.refreshToken);
  await saveShopifyShopTokens(tenantId, environment, {
    accessToken: refreshed.access_token,
    refreshToken: refreshed.refresh_token ?? tokens.refreshToken,
    ...(refreshed.expires_in
      ? { expiresAt: Date.now() + refreshed.expires_in * 1000 }
      : tokens.expiresAt
        ? { expiresAt: tokens.expiresAt }
        : {}),
    ...(refreshed.scope || tokens.scope
      ? { scope: refreshed.scope ?? tokens.scope }
      : {}),
  });
  return refreshed.access_token;
}
