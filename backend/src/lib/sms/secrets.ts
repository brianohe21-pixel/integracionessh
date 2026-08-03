import {
  SecretsManagerClient,
  GetSecretValueCommand,
  ResourceNotFoundException,
} from "@aws-sdk/client-secrets-manager";

export interface TelcoredSecretPayload {
  authorization: string;
}

function secretId(environment: string): string {
  return `/${environment}/platform/sms/telcored`;
}

export async function getTelcoredSecrets(environment: string): Promise<TelcoredSecretPayload> {
  const client = new SecretsManagerClient({});
  const response = await client.send(
    new GetSecretValueCommand({ SecretId: secretId(environment) })
  );
  const parsed = JSON.parse(response.SecretString ?? "{}") as Partial<TelcoredSecretPayload>;
  const authorization = parsed.authorization?.trim() ?? "";
  if (!authorization) {
    throw Object.assign(new Error("Telcored SMS credentials are not configured"), { statusCode: 500 });
  }
  return { authorization };
}

export async function getTelcoredAuthorizationHeader(environment: string): Promise<string> {
  const { authorization } = await getTelcoredSecrets(environment);
  if (authorization.toLowerCase().startsWith("basic ")) {
    return authorization;
  }
  return `Basic ${authorization}`;
}

export async function hasTelcoredCredentials(environment: string): Promise<boolean> {
  try {
    await getTelcoredSecrets(environment);
    return true;
  } catch (error) {
    if (error instanceof ResourceNotFoundException) return false;
    if ((error as { statusCode?: number }).statusCode === 500) return false;
    throw error;
  }
}
