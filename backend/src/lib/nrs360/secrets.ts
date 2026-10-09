import {
  CreateSecretCommand,
  DeleteSecretCommand,
  GetSecretValueCommand,
  PutSecretValueCommand,
  ResourceNotFoundException,
  SecretsManagerClient,
} from "@aws-sdk/client-secrets-manager";
import type { MaskedMailrelayCredentials, Nrs360Credentials } from "../../types/index.js";

const client = new SecretsManagerClient({});
const DEFAULT_BASE_URL = "https://dashboard.360nrs.com";

export function tenantNrs360SecretId(environment: string, tenantId: string): string {
  return `/${environment}/tenants/${tenantId}/nrs360`;
}

export function normalizeNrs360BaseUrl(value: string | undefined): string {
  const trimmed = (value ?? DEFAULT_BASE_URL).trim().replace(/\/+$/, "");
  if (!trimmed) return DEFAULT_BASE_URL;
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  const url = new URL(withScheme);
  return `${url.origin}`;
}

export function maskNrs360Credentials(
  credentials: Nrs360Credentials | null,
  provider: "nrs360" = "nrs360"
): MaskedMailrelayCredentials {
  if (!credentials) {
    return { configured: false, provider };
  }
  const suffix = credentials.apiPassword.slice(-4);
  return {
    configured: true,
    provider,
    username: credentials.username,
    apiPassword: suffix ? `********${suffix}` : "********",
    baseUrl: credentials.baseUrl,
  };
}

export async function getNrs360Credentials(
  environment: string,
  tenantId: string
): Promise<Nrs360Credentials | null> {
  try {
    const response = await client.send(
      new GetSecretValueCommand({ SecretId: tenantNrs360SecretId(environment, tenantId) })
    );
    const value = JSON.parse(response.SecretString ?? "{}") as Partial<Nrs360Credentials>;
    const username = value.username?.trim() ?? "";
    const apiPassword = value.apiPassword?.trim() ?? "";
    if (!username || !apiPassword) return null;
    return {
      username,
      apiPassword,
      baseUrl: normalizeNrs360BaseUrl(value.baseUrl),
    };
  } catch (error) {
    if (error instanceof ResourceNotFoundException) return null;
    throw error;
  }
}

export async function saveNrs360Credentials(
  environment: string,
  tenantId: string,
  payload: { username: string; apiPassword: string; baseUrl?: string }
): Promise<Nrs360Credentials> {
  const credentials: Nrs360Credentials = {
    username: payload.username.trim(),
    apiPassword: payload.apiPassword.trim(),
    baseUrl: normalizeNrs360BaseUrl(payload.baseUrl),
  };
  if (!credentials.username || !credentials.apiPassword) {
    throw Object.assign(new Error("360nrs username and API password are required"), {
      statusCode: 400,
    });
  }

  const secretId = tenantNrs360SecretId(environment, tenantId);
  const secretString = JSON.stringify(credentials);
  try {
    await client.send(
      new PutSecretValueCommand({ SecretId: secretId, SecretString: secretString })
    );
  } catch (error) {
    if (!(error instanceof ResourceNotFoundException)) throw error;
    await client.send(
      new CreateSecretCommand({ Name: secretId, SecretString: secretString })
    );
  }
  return credentials;
}

export async function deleteNrs360Credentials(
  environment: string,
  tenantId: string
): Promise<void> {
  try {
    await client.send(
      new DeleteSecretCommand({
        SecretId: tenantNrs360SecretId(environment, tenantId),
        ForceDeleteWithoutRecovery: true,
      })
    );
  } catch (error) {
    if (error instanceof ResourceNotFoundException) return;
    throw error;
  }
}
