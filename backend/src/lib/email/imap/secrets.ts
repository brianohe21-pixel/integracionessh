import {
  SecretsManagerClient,
  GetSecretValueCommand,
  PutSecretValueCommand,
  CreateSecretCommand,
  DeleteSecretCommand,
  ResourceNotFoundException,
} from "@aws-sdk/client-secrets-manager";

export interface ImapSecretPayload {
  password: string;
}

function secretId(environment: string, tenantId: string, botId: string): string {
  return `/${environment}/tenants/${tenantId}/bots/${botId}/imap`;
}

export async function getImapSecret(
  tenantId: string,
  botId: string,
  environment: string
): Promise<ImapSecretPayload> {
  const client = new SecretsManagerClient({});
  const response = await client.send(
    new GetSecretValueCommand({ SecretId: secretId(environment, tenantId, botId) })
  );
  return JSON.parse(response.SecretString ?? "{}") as ImapSecretPayload;
}

export async function saveImapSecret(
  tenantId: string,
  botId: string,
  environment: string,
  payload: ImapSecretPayload
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

export async function deleteImapSecret(
  tenantId: string,
  botId: string,
  environment: string
): Promise<void> {
  const client = new SecretsManagerClient({});
  try {
    await client.send(
      new DeleteSecretCommand({
        SecretId: secretId(environment, tenantId, botId),
        ForceDeleteWithoutRecovery: true,
      })
    );
  } catch (error) {
    if (!(error instanceof ResourceNotFoundException)) throw error;
  }
}
