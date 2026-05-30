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

function secretId(environment: string, tenantId: string): string {
  return `/${environment}/tenants/${tenantId}/whatsapp`;
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
  const client = new SecretsManagerClient({});
  const command = new GetSecretValueCommand({
    SecretId: secretId(environment, tenantId),
  });

  const response = await client.send(command);
  return JSON.parse(response.SecretString ?? "{}") as WhatsAppSecretPayload;
}

export async function saveTenantWhatsAppSecret(
  tenantId: string,
  environment: string,
  payload: WhatsAppSecretPayload
): Promise<void> {
  const client = new SecretsManagerClient({});
  const id = secretId(environment, tenantId);
  const secretString = JSON.stringify(payload);

  try {
    await client.send(
      new PutSecretValueCommand({
        SecretId: id,
        SecretString: secretString,
      })
    );
  } catch (error) {
    if (!(error instanceof ResourceNotFoundException)) {
      throw error;
    }

    await client.send(
      new CreateSecretCommand({
        Name: id,
        SecretString: secretString,
      })
    );
  }
}
