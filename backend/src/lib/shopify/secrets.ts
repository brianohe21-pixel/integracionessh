import {
  SecretsManagerClient,
  GetSecretValueCommand,
  PutSecretValueCommand,
  CreateSecretCommand,
  DeleteSecretCommand,
  ResourceNotFoundException,
} from "@aws-sdk/client-secrets-manager";

export interface ShopifyAppCredentials {
  apiKey: string;
  apiSecret: string;
  apiVersion: string;
  redirectUri: string;
}

export interface ShopifyShopTokenPayload {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number;
  scope?: string;
}

function makeClient(): SecretsManagerClient {
  return new SecretsManagerClient({});
}

function shopTokenSecretId(environment: string, tenantId: string): string {
  return `/${environment}/tenants/${tenantId}/shopify`;
}

export function getShopifyAppCredentials(): ShopifyAppCredentials {
  const apiKey = process.env.SHOPIFY_API_KEY?.trim() ?? "";
  const apiSecret = process.env.SHOPIFY_API_SECRET?.trim() ?? "";
  const apiVersion = process.env.SHOPIFY_API_VERSION?.trim() || "2025-01";
  const redirectUri =
    process.env.SHOPIFY_REDIRECT_URI?.trim() ||
    `${(process.env.API_PUBLIC_URL ?? "").replace(/\/$/, "")}/public/integrations/shopify/oauth/callback`;
  if (!apiKey || !apiSecret || !redirectUri) {
    throw Object.assign(new Error("Shopify OAuth is not configured"), { statusCode: 503 });
  }
  return { apiKey, apiSecret, apiVersion, redirectUri };
}

async function readSecret(secretPath: string): Promise<ShopifyShopTokenPayload | null> {
  const client = makeClient();
  try {
    const response = await client.send(new GetSecretValueCommand({ SecretId: secretPath }));
    return JSON.parse(response.SecretString ?? "{}") as ShopifyShopTokenPayload;
  } catch (error) {
    if (error instanceof ResourceNotFoundException) return null;
    throw error;
  }
}

export async function getShopifyShopTokens(
  tenantId: string,
  environment: string
): Promise<ShopifyShopTokenPayload | null> {
  const payload = await readSecret(shopTokenSecretId(environment, tenantId));
  if (!payload?.accessToken?.trim()) return null;
  return payload;
}

export async function saveShopifyShopTokens(
  tenantId: string,
  environment: string,
  tokens: ShopifyShopTokenPayload
): Promise<void> {
  const client = makeClient();
  const path = shopTokenSecretId(environment, tenantId);
  const secretString = JSON.stringify({
    accessToken: tokens.accessToken.trim(),
    ...(tokens.refreshToken ? { refreshToken: tokens.refreshToken.trim() } : {}),
    ...(tokens.expiresAt ? { expiresAt: tokens.expiresAt } : {}),
    ...(tokens.scope ? { scope: tokens.scope } : {}),
  });
  try {
    await client.send(new PutSecretValueCommand({ SecretId: path, SecretString: secretString }));
  } catch (error) {
    if (!(error instanceof ResourceNotFoundException)) throw error;
    await client.send(new CreateSecretCommand({ Name: path, SecretString: secretString }));
  }
}

export async function deleteShopifyShopTokens(
  tenantId: string,
  environment: string
): Promise<void> {
  const client = makeClient();
  try {
    await client.send(
      new DeleteSecretCommand({
        SecretId: shopTokenSecretId(environment, tenantId),
        ForceDeleteWithoutRecovery: true,
      })
    );
  } catch (error) {
    if (error instanceof ResourceNotFoundException) return;
    throw error;
  }
}
