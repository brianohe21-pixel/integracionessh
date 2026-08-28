import {
  SecretsManagerClient,
  GetSecretValueCommand,
  PutSecretValueCommand,
  CreateSecretCommand,
  DeleteSecretCommand,
  ResourceNotFoundException,
} from "@aws-sdk/client-secrets-manager";

interface MicrosoftSsoSecretPayload {
  clientSecret: string;
}

function makeClient(): SecretsManagerClient {
  return new SecretsManagerClient({});
}

function secretId(environment: string, tenantId: string): string {
  return `/${environment}/tenants/${tenantId}/microsoft-sso`;
}

async function readSecret(secretPath: string): Promise<MicrosoftSsoSecretPayload | null> {
  const client = makeClient();
  try {
    const response = await client.send(new GetSecretValueCommand({ SecretId: secretPath }));
    return JSON.parse(response.SecretString ?? "{}") as MicrosoftSsoSecretPayload;
  } catch (error) {
    if (error instanceof ResourceNotFoundException) return null;
    throw error;
  }
}

export async function getMicrosoftSsoClientSecret(
  tenantId: string,
  environment: string
): Promise<string | null> {
  const payload = await readSecret(secretId(environment, tenantId));
  const secret = payload?.clientSecret?.trim() ?? "";
  return secret || null;
}

export async function saveMicrosoftSsoClientSecret(
  tenantId: string,
  environment: string,
  clientSecret: string
): Promise<void> {
  const client = makeClient();
  const path = secretId(environment, tenantId);
  const secretString = JSON.stringify({ clientSecret: clientSecret.trim() });
  try {
    await client.send(new PutSecretValueCommand({ SecretId: path, SecretString: secretString }));
  } catch (error) {
    if (!(error instanceof ResourceNotFoundException)) throw error;
    await client.send(new CreateSecretCommand({ Name: path, SecretString: secretString }));
  }
}

export async function deleteMicrosoftSsoClientSecret(
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

export function maskClientSecret(secret: string): string {
  const trimmed = secret.trim();
  if (trimmed.length <= 4) return "********";
  return `********${trimmed.slice(-4)}`;
}
