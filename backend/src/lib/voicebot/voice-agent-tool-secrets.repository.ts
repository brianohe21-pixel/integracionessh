import {
  SecretsManagerClient,
  GetSecretValueCommand,
  PutSecretValueCommand,
  CreateSecretCommand,
  DeleteSecretCommand,
  ResourceNotFoundException,
} from "@aws-sdk/client-secrets-manager";

function makeClient(): SecretsManagerClient {
  return new SecretsManagerClient({});
}

function voiceToolSecretsId(environment: string, tenantId: string, botId: string): string {
  return `/${environment}/tenants/${tenantId}/bots/${botId}/voice-tools/secrets`;
}

async function readSecretMap(secretId: string): Promise<Record<string, string>> {
  const client = makeClient();
  try {
    const response = await client.send(new GetSecretValueCommand({ SecretId: secretId }));
    const parsed = JSON.parse(response.SecretString ?? "{}") as Record<string, string>;
    return typeof parsed === "object" && parsed !== null ? parsed : {};
  } catch (error) {
    if (error instanceof ResourceNotFoundException) return {};
    throw error;
  }
}

async function writeSecretMap(secretId: string, payload: Record<string, string>): Promise<void> {
  const client = makeClient();
  const secretString = JSON.stringify(payload);
  try {
    await client.send(new PutSecretValueCommand({ SecretId: secretId, SecretString: secretString }));
  } catch (error) {
    if (!(error instanceof ResourceNotFoundException)) throw error;
    await client.send(new CreateSecretCommand({ Name: secretId, SecretString: secretString }));
  }
}

export async function listVoiceAgentToolSecretNames(
  tenantId: string,
  environment: string,
  botId: string
): Promise<string[]> {
  const secrets = await readSecretMap(voiceToolSecretsId(environment, tenantId, botId));
  return Object.keys(secrets).sort();
}

export async function getVoiceAgentToolSecrets(
  tenantId: string,
  environment: string,
  botId: string
): Promise<Record<string, string>> {
  return readSecretMap(voiceToolSecretsId(environment, tenantId, botId));
}

export async function getVoiceAgentToolSecret(
  tenantId: string,
  environment: string,
  botId: string,
  name: string
): Promise<string | null> {
  const secrets = await readSecretMap(voiceToolSecretsId(environment, tenantId, botId));
  const value = secrets[name]?.trim();
  return value || null;
}

export async function saveVoiceAgentToolSecret(
  tenantId: string,
  environment: string,
  botId: string,
  name: string,
  value: string
): Promise<void> {
  const secretId = voiceToolSecretsId(environment, tenantId, botId);
  const existing = await readSecretMap(secretId);
  existing[name] = value;
  await writeSecretMap(secretId, existing);
}

export async function deleteVoiceAgentToolSecret(
  tenantId: string,
  environment: string,
  botId: string,
  name: string
): Promise<void> {
  const secretId = voiceToolSecretsId(environment, tenantId, botId);
  const existing = await readSecretMap(secretId);
  delete existing[name];
  if (Object.keys(existing).length === 0) {
    const client = makeClient();
    try {
      await client.send(
        new DeleteSecretCommand({ SecretId: secretId, ForceDeleteWithoutRecovery: true })
      );
    } catch (error) {
      if (!(error instanceof ResourceNotFoundException)) throw error;
    }
    return;
  }
  await writeSecretMap(secretId, existing);
}
