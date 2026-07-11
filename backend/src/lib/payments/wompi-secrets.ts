import {
  SecretsManagerClient,
  GetSecretValueCommand,
  PutSecretValueCommand,
  CreateSecretCommand,
  DeleteSecretCommand,
  ResourceNotFoundException,
} from "@aws-sdk/client-secrets-manager";
import type { WompiCredentials } from "../billing/wompi.js";

export interface TenantWompiSecretPayload {
  publicKey: string;
  privateKey: string;
  integritySecret: string;
  eventsSecret: string;
}

export interface MaskedTenantWompiCredentials {
  configured: boolean;
  publicKey?: string;
  privateKey?: string;
  integritySecret?: string;
  eventsSecret?: string;
}

function secretId(environment: string, tenantId: string): string {
  return `/${environment}/tenants/${tenantId}/wompi`;
}

function maskValue(value: string): string {
  if (value.length <= 8) return "****";
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

export function maskWompiSecrets(
  payload: TenantWompiSecretPayload | null
): MaskedTenantWompiCredentials {
  if (!payload) return { configured: false };
  return {
    configured: true,
    publicKey: maskValue(payload.publicKey),
    privateKey: maskValue(payload.privateKey),
    integritySecret: maskValue(payload.integritySecret),
    eventsSecret: maskValue(payload.eventsSecret),
  };
}

export async function getTenantWompiSecrets(
  tenantId: string,
  environment: string
): Promise<TenantWompiSecretPayload | null> {
  const client = new SecretsManagerClient({});
  try {
    const response = await client.send(
      new GetSecretValueCommand({
        SecretId: secretId(environment, tenantId),
      })
    );
    const parsed = JSON.parse(response.SecretString ?? "{}") as TenantWompiSecretPayload;
    if (!parsed.publicKey || !parsed.integritySecret || !parsed.eventsSecret) {
      return null;
    }
    return parsed;
  } catch (error) {
    if (error instanceof ResourceNotFoundException) return null;
    throw error;
  }
}

export async function getTenantWompiCredentials(
  tenantId: string,
  environment: string
): Promise<WompiCredentials | null> {
  const secrets = await getTenantWompiSecrets(tenantId, environment);
  if (!secrets) return null;
  return {
    publicKey: secrets.publicKey,
    privateKey: secrets.privateKey,
    integritySecret: secrets.integritySecret,
    eventsSecret: secrets.eventsSecret,
  };
}

export async function saveTenantWompiSecrets(
  tenantId: string,
  environment: string,
  payload: TenantWompiSecretPayload
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

export async function deleteTenantWompiSecrets(
  tenantId: string,
  environment: string
): Promise<void> {
  const client = new SecretsManagerClient({});
  try {
    await client.send(
      new DeleteSecretCommand({
        SecretId: secretId(environment, tenantId),
        ForceDeleteWithoutRecovery: true,
      })
    );
  } catch (error) {
    if (error instanceof ResourceNotFoundException) return;
    throw error;
  }
}
