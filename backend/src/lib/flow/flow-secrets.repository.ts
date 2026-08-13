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

function flowSecretsId(environment: string, tenantId: string, flowId: string): string {
  return `/${environment}/tenants/${tenantId}/flows/${flowId}/secrets`;
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

export async function listFlowSecretNames(
  tenantId: string,
  environment: string,
  flowId: string
): Promise<string[]> {
  const secrets = await readSecretMap(flowSecretsId(environment, tenantId, flowId));
  return Object.keys(secrets).sort();
}

export async function getFlowSecretNamesSet(
  tenantId: string,
  environment: string,
  flowId: string
): Promise<Set<string>> {
  return new Set(await listFlowSecretNames(tenantId, environment, flowId));
}

export async function getFlowSecret(
  tenantId: string,
  environment: string,
  flowId: string,
  name: string
): Promise<string | null> {
  const secrets = await readSecretMap(flowSecretsId(environment, tenantId, flowId));
  const value = secrets[name]?.trim();
  return value || null;
}

export async function getFlowSecrets(
  tenantId: string,
  environment: string,
  flowId: string
): Promise<Record<string, string>> {
  return readSecretMap(flowSecretsId(environment, tenantId, flowId));
}

export async function saveFlowSecret(
  tenantId: string,
  environment: string,
  flowId: string,
  name: string,
  value: string
): Promise<void> {
  const secretId = flowSecretsId(environment, tenantId, flowId);
  const existing = await readSecretMap(secretId);
  existing[name] = value;
  await writeSecretMap(secretId, existing);
}

export async function deleteFlowSecret(
  tenantId: string,
  environment: string,
  flowId: string,
  name: string
): Promise<void> {
  const secretId = flowSecretsId(environment, tenantId, flowId);
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
