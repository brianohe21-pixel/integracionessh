import {
  SecretsManagerClient,
  GetSecretValueCommand,
  PutSecretValueCommand,
  CreateSecretCommand,
  ResourceNotFoundException,
} from "@aws-sdk/client-secrets-manager";

export interface MessengerSecretPayload {
  pageAccessToken: string;
  pageId: string;
}

function secretId(environment: string, tenantId: string, botId: string): string {
  return `/${environment}/tenants/${tenantId}/bots/${botId}/messenger`;
}

export async function getMessengerAccessToken(
  tenantId: string,
  botId: string,
  environment: string
): Promise<string> {
  const secret = await getMessengerSecrets(tenantId, botId, environment);
  return secret.pageAccessToken;
}

export async function getMessengerSecrets(
  tenantId: string,
  botId: string,
  environment: string
): Promise<MessengerSecretPayload> {
  const client = new SecretsManagerClient({});
  const response = await client.send(
    new GetSecretValueCommand({ SecretId: secretId(environment, tenantId, botId) })
  );
  return JSON.parse(response.SecretString ?? "{}") as MessengerSecretPayload;
}

export async function saveMessengerSecret(
  tenantId: string,
  botId: string,
  environment: string,
  payload: MessengerSecretPayload
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
