import {
  SecretsManagerClient,
  GetSecretValueCommand,
  PutSecretValueCommand,
  CreateSecretCommand,
  ResourceNotFoundException,
} from "@aws-sdk/client-secrets-manager";

export interface WhatsAppSecretPayload {
  accessToken: string;
  appSecret: string;
}

function tenantSecretId(environment: string, tenantId: string): string {
  return `/${environment}/tenants/${tenantId}/whatsapp`;
}

function accountSecretId(environment: string, tenantId: string, accountId: string): string {
  return `/${environment}/tenants/${tenantId}/whatsapp-accounts/${accountId}`;
}

async function readSecret(secretId: string): Promise<WhatsAppSecretPayload> {
  const client = new SecretsManagerClient({});
  const response = await client.send(
    new GetSecretValueCommand({ SecretId: secretId })
  );
  return JSON.parse(response.SecretString ?? "{}") as WhatsAppSecretPayload;
}

async function writeSecret(secretId: string, payload: WhatsAppSecretPayload): Promise<void> {
  const client = new SecretsManagerClient({});
  const secretString = JSON.stringify(payload);

  try {
    await client.send(
      new PutSecretValueCommand({
        SecretId: secretId,
        SecretString: secretString,
      })
    );
  } catch (error) {
    if (!(error instanceof ResourceNotFoundException)) {
      throw error;
    }

    await client.send(
      new CreateSecretCommand({
        Name: secretId,
        SecretString: secretString,
      })
    );
  }
}

export async function getWhatsAppAccessToken(
  tenantId: string,
  environment: string
): Promise<string> {
  const secret = await getWhatsAppSecrets(tenantId, environment);
  return secret.accessToken;
}

export async function getWhatsAppSecrets(
  tenantId: string,
  environment: string
): Promise<WhatsAppSecretPayload> {
  return readSecret(tenantSecretId(environment, tenantId));
}

export async function getWhatsAppAccessTokenForAccount(
  tenantId: string,
  accountId: string,
  environment: string
): Promise<string> {
  if (accountId === "legacy") {
    return getWhatsAppAccessToken(tenantId, environment);
  }
  const secret = await getWhatsAppAccountSecrets(tenantId, accountId, environment);
  return secret.accessToken;
}

export async function getWhatsAppAccountSecrets(
  tenantId: string,
  accountId: string,
  environment: string
): Promise<WhatsAppSecretPayload> {
  try {
    return await readSecret(accountSecretId(environment, tenantId, accountId));
  } catch {
    return getWhatsAppSecrets(tenantId, environment);
  }
}

export async function saveTenantWhatsAppSecret(
  tenantId: string,
  environment: string,
  payload: WhatsAppSecretPayload
): Promise<void> {
  await writeSecret(tenantSecretId(environment, tenantId), payload);
}

export async function saveWhatsAppAccountSecret(
  tenantId: string,
  accountId: string,
  environment: string,
  payload: WhatsAppSecretPayload
): Promise<void> {
  await writeSecret(accountSecretId(environment, tenantId, accountId), payload);
}
