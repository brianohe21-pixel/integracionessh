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
  const id = secretId(environment);
  try {
    const response = await client.send(new GetSecretValueCommand({ SecretId: id }));
    const parsed = JSON.parse(response.SecretString ?? "{}") as Partial<TelcoredSecretPayload>;
    const authorization = parsed.authorization?.trim() ?? "";
    if (!authorization) {
      throw Object.assign(
        new Error(
          `Telcored SMS credentials are incomplete. Set a non-empty authorization field in secret ${id}.`
        ),
        { statusCode: 400 }
      );
    }
    return { authorization };
  } catch (error) {
    if (error instanceof ResourceNotFoundException) {
      throw Object.assign(
        new Error(
          `Telcored SMS is not configured. Create secret ${id} in AWS Secrets Manager with {"authorization":"Basic ..."}.`
        ),
        { statusCode: 400 }
      );
    }
    throw error;
  }
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
    if ((error as { statusCode?: number }).statusCode === 400) return false;
    throw error;
  }
}
