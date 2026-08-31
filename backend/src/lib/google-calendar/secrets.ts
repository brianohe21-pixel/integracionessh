import {
  SecretsManagerClient,
  GetSecretValueCommand,
  PutSecretValueCommand,
  CreateSecretCommand,
  DeleteSecretCommand,
  ResourceNotFoundException,
} from "@aws-sdk/client-secrets-manager";

export interface GoogleCalendarSecretPayload {
  refreshToken: string;
  accessToken?: string;
  expiresAt?: number;
}

function makeClient(): SecretsManagerClient {
  return new SecretsManagerClient({});
}

function secretId(environment: string, tenantId: string, botId: string): string {
  return `/${environment}/tenants/${tenantId}/bots/${botId}/google-calendar`;
}

async function readSecret(secretPath: string): Promise<GoogleCalendarSecretPayload | null> {
  const client = makeClient();
  try {
    const response = await client.send(new GetSecretValueCommand({ SecretId: secretPath }));
    return JSON.parse(response.SecretString ?? "{}") as GoogleCalendarSecretPayload;
  } catch (error) {
    if (error instanceof ResourceNotFoundException) return null;
    throw error;
  }
}

export async function getGoogleCalendarTokens(
  tenantId: string,
  botId: string,
  environment: string
): Promise<GoogleCalendarSecretPayload | null> {
  const payload = await readSecret(secretId(environment, tenantId, botId));
  if (!payload?.refreshToken?.trim()) return null;
  return payload;
}

export async function saveGoogleCalendarTokens(
  tenantId: string,
  botId: string,
  environment: string,
  tokens: GoogleCalendarSecretPayload
): Promise<void> {
  const client = makeClient();
  const path = secretId(environment, tenantId, botId);
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

export async function deleteGoogleCalendarTokens(
  tenantId: string,
  botId: string,
  environment: string
): Promise<void> {
  const client = makeClient();
  try {
    await client.send(
      new DeleteSecretCommand({
        SecretId: secretId(environment, tenantId, botId),
        ForceDeleteWithoutRecovery: true,
      })
    );
  } catch (error) {
    if (error instanceof ResourceNotFoundException) return;
    throw error;
  }
}
