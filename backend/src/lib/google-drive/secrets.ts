import {
  SecretsManagerClient,
  GetSecretValueCommand,
  PutSecretValueCommand,
  CreateSecretCommand,
  DeleteSecretCommand,
  ResourceNotFoundException,
} from "@aws-sdk/client-secrets-manager";

export interface GoogleDriveSecretPayload {
  refreshToken: string;
  accessToken?: string;
  expiresAt?: number;
}

function makeClient(): SecretsManagerClient {
  return new SecretsManagerClient({});
}

function secretId(environment: string, tenantId: string): string {
  return `/${environment}/tenants/${tenantId}/google-drive`;
}

async function readSecret(secretPath: string): Promise<GoogleDriveSecretPayload | null> {
  const client = makeClient();
  try {
    const response = await client.send(new GetSecretValueCommand({ SecretId: secretPath }));
    return JSON.parse(response.SecretString ?? "{}") as GoogleDriveSecretPayload;
  } catch (error) {
    if (error instanceof ResourceNotFoundException) return null;
    throw error;
  }
}

export async function getGoogleDriveTokens(
  tenantId: string,
  environment: string
): Promise<GoogleDriveSecretPayload | null> {
  const payload = await readSecret(secretId(environment, tenantId));
  if (!payload?.refreshToken?.trim()) return null;
  return payload;
}

export async function saveGoogleDriveTokens(
  tenantId: string,
  environment: string,
  tokens: GoogleDriveSecretPayload
): Promise<void> {
  const client = makeClient();
  const path = secretId(environment, tenantId);
  const secretString = JSON.stringify({
    refreshToken: tokens.refreshToken.trim(),
    ...(tokens.accessToken ? { accessToken: tokens.accessToken } : {}),
    ...(tokens.expiresAt ? { expiresAt: tokens.expiresAt } : {}),
  });
  try {
    await client.send(new PutSecretValueCommand({ SecretId: path, SecretString: secretString }));
  } catch (error) {
    if (!(error instanceof ResourceNotFoundException)) throw error;
    await client.send(new CreateSecretCommand({ Name: path, SecretString: secretString }));
  }
}

export async function deleteGoogleDriveTokens(
  tenantId: string,
  environment: string
): Promise<void> {
  const client = makeClient();
  try {
    await client.send(
      new DeleteSecretCommand({
        SecretId: secretId(environment, tenantId),
        ForceDeleteWithoutRecovery: true,
      })
    );
  } catch (error) {
    if (error instanceof ResourceNotFoundException) return;
    throw error;
  }
}
