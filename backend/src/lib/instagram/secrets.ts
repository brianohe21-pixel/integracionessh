import {
  SecretsManagerClient,
  GetSecretValueCommand,
  PutSecretValueCommand,
  CreateSecretCommand,
  ResourceNotFoundException,
} from "@aws-sdk/client-secrets-manager";

export interface InstagramSecretPayload {
  pageAccessToken: string;
  pageId: string;
  instagramAccountId?: string;
}

function secretId(environment: string, tenantId: string, botId: string): string {
  return `/${environment}/tenants/${tenantId}/bots/${botId}/instagram`;
}

function legacySecretId(environment: string, tenantId: string): string {
  return `/${environment}/tenants/${tenantId}/instagram`;
}

async function readSecret(secretName: string): Promise<InstagramSecretPayload> {
  const client = new SecretsManagerClient({});
  const response = await client.send(new GetSecretValueCommand({ SecretId: secretName }));
  return JSON.parse(response.SecretString ?? "{}") as InstagramSecretPayload;
}

export async function getInstagramAccessToken(
  tenantId: string,
  environment: string,
  botId?: string
): Promise<string> {
  const secret = await getInstagramSecrets(tenantId, environment, botId);
  return secret.pageAccessToken;
}

export async function getInstagramSecrets(
  tenantId: string,
  environment: string,
  botId?: string
): Promise<InstagramSecretPayload> {
  if (botId) {
    try {
      return await readSecret(secretId(environment, tenantId, botId));
    } catch (error) {
      if (!(error instanceof ResourceNotFoundException)) throw error;
    }
  }
  return readSecret(legacySecretId(environment, tenantId));
}

export async function saveInstagramSecret(
  tenantId: string,
  botId: string,
  environment: string,
  payload: InstagramSecretPayload
): Promise<void> {
  const client = new SecretsManagerClient({});
  const id = secretId(environment, tenantId, botId);
  const secretString = JSON.stringify(payload);

  try {
    await client.send(new PutSecretValueCommand({ SecretId: id, SecretString: secretString }));
  } catch (error) {
    if (!(error instanceof ResourceNotFoundException)) throw error;
    await client.send(new CreateSecretCommand({ Name: id, SecretString: secretString }));
  }
}
