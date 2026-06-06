import {
  SecretsManagerClient,
  GetSecretValueCommand,
  PutSecretValueCommand,
  CreateSecretCommand,
  DeleteSecretCommand,
  ResourceNotFoundException,
} from "@aws-sdk/client-secrets-manager";

function secretId(environment: string, tenantId: string): string {
  return `/${environment}/tenants/${tenantId}/openai`;
}

function makeClient(): SecretsManagerClient {
  return new SecretsManagerClient({});
}

export async function saveOpenAIApiKey(
  tenantId: string,
  environment: string,
  apiKey: string
): Promise<void> {
  const client = makeClient();
  const id = secretId(environment, tenantId);
  const secretString = JSON.stringify({ apiKey });

  try {
    await client.send(
      new PutSecretValueCommand({ SecretId: id, SecretString: secretString })
    );
  } catch (error) {
    if (!(error instanceof ResourceNotFoundException)) throw error;
    await client.send(
      new CreateSecretCommand({ Name: id, SecretString: secretString })
    );
  }
}

export async function deleteOpenAIApiKey(
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
    if (!(error instanceof ResourceNotFoundException)) throw error;
  }
}

export async function hasOpenAIApiKey(
  tenantId: string,
  environment: string
): Promise<boolean> {
  const client = makeClient();
  try {
    const response = await client.send(
      new GetSecretValueCommand({ SecretId: secretId(environment, tenantId) })
    );
    const secret = JSON.parse(response.SecretString ?? "{}") as { apiKey?: string };
    return Boolean(secret.apiKey);
  } catch {
    return false;
  }
}
